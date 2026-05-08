import json
import os
import hashlib
import secrets
import psycopg2
from psycopg2.extras import RealDictCursor

SCHEMA = "t_p13578121_cash_register_app_1"

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-User-Id",
    }

def ok(data):
    return {"statusCode": 200, "headers": {**cors_headers(), "Content-Type": "application/json"}, "body": json.dumps(data, default=str)}

def err(msg, code=400):
    return {"statusCode": code, "headers": {**cors_headers(), "Content-Type": "application/json"}, "body": json.dumps({"error": msg})}

def get_user_from_token(conn, token):
    if not token:
        return None
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(f"SELECT u.* FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id=s.user_id WHERE s.token=%s AND s.expires_at>NOW()", (token,))
    return cur.fetchone()

def handler(event: dict, context) -> dict:
    """POS API — авторизация, товары, заказы, пользователи, курьеры"""
    # CORS preflight — должен быть ПЕРВЫМ, до любой другой логики
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-User-Id, Authorization",
                "Access-Control-Max-Age": "86400",
            },
            "body": ""
        }

    method = event.get("httpMethod", "GET")
    # path может приходить как полный путь вида /7f663196-.../auth/login
    # берём только хвост после ID функции
    raw_path = event.get("path", "/")
    # Нормализуем: убираем возможный префикс с UUID функции
    import re
    path_match = re.sub(r'^/[0-9a-f\-]{36}', '', raw_path)
    path = path_match.rstrip("/") if path_match else "/"
    qs = event.get("queryStringParameters") or {}
    # Токен приходит либо из заголовка, либо из query string ?_t=
    token = (
        (event.get("headers") or {}).get("X-Auth-Token")
        or (event.get("headers") or {}).get("x-auth-token")
        or qs.get("_t")
    )
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # ─── AUTH ───
    if path == "/auth/register" and method == "POST":
        name = body.get("name", "").strip()
        email = body.get("email", "").strip().lower()
        password = body.get("password", "")
        phone = body.get("phone", "")
        if not name or not email or not password:
            conn.close()
            return err("Заполните все поля")
        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email=%s", (email,))
        if cur.fetchone():
            conn.close()
            return err("Email уже занят")
        cur.execute(f"INSERT INTO {SCHEMA}.users(name,email,password_hash,role,phone) VALUES(%s,%s,%s,'client',%s) RETURNING id,name,email,role", (name, email, password, phone))
        user = dict(cur.fetchone())
        tok = secrets.token_hex(32)
        cur.execute(f"INSERT INTO {SCHEMA}.sessions(user_id,token) VALUES(%s,%s)", (user["id"], tok))
        conn.commit()
        conn.close()
        return ok({"token": tok, "user": user})

    if path == "/auth/login" and method == "POST":
        email = body.get("email", "").strip().lower()
        password = body.get("password", "")
        # admin shortcut
        if body.get("admin_password") == "admin2015!RM":
            cur.execute(f"SELECT id,name,email,role FROM {SCHEMA}.users WHERE role='admin' LIMIT 1")
            user = cur.fetchone()
            if not user:
                cur.execute(f"INSERT INTO {SCHEMA}.users(name,email,password_hash,role) VALUES('Администратор','admin@pos.local','admin2015!RM','admin') RETURNING id,name,email,role")
                user = cur.fetchone()
            user = dict(user)
            tok = secrets.token_hex(32)
            cur.execute(f"INSERT INTO {SCHEMA}.sessions(user_id,token) VALUES(%s,%s)", (user["id"], tok))
            conn.commit()
            conn.close()
            return ok({"token": tok, "user": user})
        cur.execute(f"SELECT id,name,email,role FROM {SCHEMA}.users WHERE email=%s AND password_hash=%s", (email, password))
        user = cur.fetchone()
        if not user:
            conn.close()
            return err("Неверный email или пароль", 401)
        user = dict(user)
        tok = secrets.token_hex(32)
        cur.execute(f"INSERT INTO {SCHEMA}.sessions(user_id,token) VALUES(%s,%s)", (user["id"], tok))
        conn.commit()
        conn.close()
        return ok({"token": tok, "user": user})

    if path == "/auth/me" and method == "GET":
        user = get_user_from_token(conn, token)
        conn.close()
        if not user:
            return err("Не авторизован", 401)
        return ok({"user": dict(user)})

    # ─── PRODUCTS ───
    if path == "/products" and method == "GET":
        barcode = qs.get("barcode")
        search = qs.get("search")
        if barcode:
            cur.execute(f"SELECT * FROM {SCHEMA}.products WHERE barcode=%s", (barcode,))
            p = cur.fetchone()
            conn.close()
            return ok({"product": dict(p) if p else None})
        if search:
            cur.execute(f"SELECT * FROM {SCHEMA}.products WHERE name ILIKE %s ORDER BY name", (f"%{search}%",))
        else:
            cur.execute(f"SELECT * FROM {SCHEMA}.products ORDER BY name")
        products = [dict(r) for r in cur.fetchall()]
        conn.close()
        return ok({"products": products})

    if path == "/products" and method == "POST":
        user = get_user_from_token(conn, token)
        if not user or user["role"] not in ("admin", "cashier"):
            conn.close()
            return err("Нет доступа", 403)
        name = body.get("name", "").strip()
        barcode = body.get("barcode", "").strip()
        price = body.get("price", 0)
        category = body.get("category", "")
        stock = body.get("stock", 0)
        discount_percent = body.get("discount_percent", 0)
        discount_active = body.get("discount_active", False)
        if not name or not barcode or not price:
            conn.close()
            return err("Заполните обязательные поля")
        cur.execute(f"INSERT INTO {SCHEMA}.products(name,barcode,price,category,stock,discount_percent,discount_active) VALUES(%s,%s,%s,%s,%s,%s,%s) RETURNING *", (name, barcode, price, category, stock, discount_percent, discount_active))
        p = dict(cur.fetchone())
        conn.commit()
        conn.close()
        return ok({"product": p})

    if path.startswith("/products/") and method == "PUT":
        user = get_user_from_token(conn, token)
        if not user or user["role"] not in ("admin", "cashier"):
            conn.close()
            return err("Нет доступа", 403)
        pid = path.split("/")[-1]
        name = body.get("name")
        price = body.get("price")
        category = body.get("category")
        stock = body.get("stock")
        discount_percent = body.get("discount_percent")
        discount_active = body.get("discount_active")
        cur.execute(f"""UPDATE {SCHEMA}.products SET
            name=COALESCE(%s,name), price=COALESCE(%s,price),
            category=COALESCE(%s,category), stock=COALESCE(%s,stock),
            discount_percent=COALESCE(%s,discount_percent), discount_active=COALESCE(%s,discount_active)
            WHERE id=%s RETURNING *""", (name, price, category, stock, discount_percent, discount_active, pid))
        p = cur.fetchone()
        conn.commit()
        conn.close()
        return ok({"product": dict(p) if p else None})

    if path.startswith("/products/") and method == "DELETE":
        user = get_user_from_token(conn, token)
        if not user or user["role"] != "admin":
            conn.close()
            return err("Нет доступа", 403)
        pid = path.split("/")[-1]
        cur.execute(f"UPDATE {SCHEMA}.products SET name=name WHERE id=%s", (pid,))
        cur.execute(f"SELECT id FROM {SCHEMA}.order_items WHERE product_id=%s", (pid,))
        has_items = cur.fetchone()
        if has_items:
            conn.close()
            return err("Товар используется в заказах")
        cur.execute(f"UPDATE {SCHEMA}.products SET stock=0 WHERE id=%s", (pid,))
        conn.commit()
        conn.close()
        return ok({"ok": True})

    # ─── ORDERS ───
    if path == "/orders" and method == "GET":
        user = get_user_from_token(conn, token)
        if not user:
            conn.close()
            return err("Не авторизован", 401)
        role = user["role"]
        uid = user["id"]
        if role == "admin" or role == "cashier":
            status_filter = qs.get("status")
            if status_filter:
                cur.execute(f"""SELECT o.*,u.name as client_name,u.phone as client_phone,
                    c.name as courier_name FROM {SCHEMA}.orders o
                    LEFT JOIN {SCHEMA}.users u ON u.id=o.user_id
                    LEFT JOIN {SCHEMA}.users c ON c.id=o.courier_id
                    WHERE o.status=%s ORDER BY o.created_at DESC""", (status_filter,))
            else:
                cur.execute(f"""SELECT o.*,u.name as client_name,u.phone as client_phone,
                    c.name as courier_name FROM {SCHEMA}.orders o
                    LEFT JOIN {SCHEMA}.users u ON u.id=o.user_id
                    LEFT JOIN {SCHEMA}.users c ON c.id=o.courier_id
                    ORDER BY o.created_at DESC""")
        elif role == "courier":
            cur.execute(f"""SELECT o.*,u.name as client_name,u.phone as client_phone FROM {SCHEMA}.orders o
                LEFT JOIN {SCHEMA}.users u ON u.id=o.user_id
                WHERE o.courier_id=%s ORDER BY o.created_at DESC""", (uid,))
        else:
            cur.execute(f"""SELECT o.*,c.name as courier_name FROM {SCHEMA}.orders o
                LEFT JOIN {SCHEMA}.users c ON c.id=o.courier_id
                WHERE o.user_id=%s ORDER BY o.created_at DESC""", (uid,))
        orders = [dict(r) for r in cur.fetchall()]
        for order in orders:
            cur.execute(f"""SELECT oi.*,p.name as product_name,p.image_url FROM {SCHEMA}.order_items oi
                JOIN {SCHEMA}.products p ON p.id=oi.product_id WHERE oi.order_id=%s""", (order["id"],))
            order["items"] = [dict(i) for i in cur.fetchall()]
        conn.close()
        return ok({"orders": orders})

    if path == "/orders" and method == "POST":
        user = get_user_from_token(conn, token)
        if not user:
            conn.close()
            return err("Не авторизован", 401)
        items = body.get("items", [])
        delivery_address = body.get("delivery_address", "")
        notes = body.get("notes", "")
        if not items:
            conn.close()
            return err("Корзина пуста")
        total = 0
        for item in items:
            total += float(item.get("price", 0)) * int(item.get("quantity", 1))
        cur.execute(f"INSERT INTO {SCHEMA}.orders(user_id,status,total,delivery_address,notes) VALUES(%s,'new',%s,%s,%s) RETURNING *", (user["id"], total, delivery_address, notes))
        order = dict(cur.fetchone())
        for item in items:
            cur.execute(f"INSERT INTO {SCHEMA}.order_items(order_id,product_id,quantity,price) VALUES(%s,%s,%s,%s)", (order["id"], item["product_id"], item["quantity"], item["price"]))
        conn.commit()
        conn.close()
        return ok({"order": order})

    if path.startswith("/orders/") and method == "PUT":
        user = get_user_from_token(conn, token)
        if not user:
            conn.close()
            return err("Не авторизован", 401)
        oid = path.split("/")[-1]
        status = body.get("status")
        courier_id = body.get("courier_id")
        role = user["role"]
        if role not in ("admin", "cashier", "courier"):
            conn.close()
            return err("Нет доступа", 403)
        if courier_id is not None:
            cur.execute(f"UPDATE {SCHEMA}.orders SET courier_id=%s,updated_at=NOW() WHERE id=%s RETURNING *", (courier_id, oid))
        elif status:
            cur.execute(f"UPDATE {SCHEMA}.orders SET status=%s,updated_at=NOW() WHERE id=%s RETURNING *", (status, oid))
        o = cur.fetchone()
        conn.commit()
        conn.close()
        return ok({"order": dict(o) if o else None})

    # ─── USERS ───
    if path == "/users" and method == "GET":
        user = get_user_from_token(conn, token)
        if not user or user["role"] != "admin":
            conn.close()
            return err("Нет доступа", 403)
        role_filter = qs.get("role")
        if role_filter:
            cur.execute(f"SELECT id,name,email,role,phone,created_at FROM {SCHEMA}.users WHERE role=%s ORDER BY name", (role_filter,))
        else:
            cur.execute(f"SELECT id,name,email,role,phone,created_at FROM {SCHEMA}.users ORDER BY name")
        users = [dict(r) for r in cur.fetchall()]
        conn.close()
        return ok({"users": users})

    if path.startswith("/users/") and method == "PUT":
        user = get_user_from_token(conn, token)
        if not user or user["role"] != "admin":
            conn.close()
            return err("Нет доступа", 403)
        uid = path.split("/")[-1]
        role = body.get("role")
        name = body.get("name")
        cur.execute(f"UPDATE {SCHEMA}.users SET role=COALESCE(%s,role),name=COALESCE(%s,name) WHERE id=%s RETURNING id,name,email,role", (role, name, uid))
        u = cur.fetchone()
        conn.commit()
        conn.close()
        return ok({"user": dict(u) if u else None})

    conn.close()
    return err("Не найдено", 404)