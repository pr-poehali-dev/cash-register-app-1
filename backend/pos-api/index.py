import json
import os
import secrets
import psycopg2
from psycopg2.extras import RealDictCursor

SCHEMA = "t_p13578121_cash_register_app_1"

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def cors():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
    }

def ok(data):
    return {"statusCode": 200, "headers": {**cors(), "Content-Type": "application/json"}, "body": json.dumps(data, default=str)}

def err(msg, code=400):
    return {"statusCode": code, "headers": {**cors(), "Content-Type": "application/json"}, "body": json.dumps({"error": msg})}

def get_user(conn, token):
    if not token:
        return None
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        f"SELECT u.* FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id=s.user_id "
        f"WHERE s.token=%s AND s.expires_at>NOW()", (token,)
    )
    return cur.fetchone()

def handler(event: dict, context) -> dict:
    """POS API — все запросы на корень, путь передаётся через ?_path="""

    # 1. CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors(), "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}

    # 2. Путь берём из ?_path= (не из event["path"] — платформа блокирует подпути)
    path = qs.get("_path", "/").rstrip("/") or "/"
    token = qs.get("_t")

    # 3. Тело
    body = {}
    raw_body = event.get("body") or ""
    if raw_body:
        try:
            body = json.loads(raw_body)
        except Exception:
            pass

    # 4. QS-параметры из самого _path (если там есть ?search=...)
    extra_qs = {}
    if "?" in path:
        path, qs_str = path.split("?", 1)
        for part in qs_str.split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                extra_qs[k] = v
        path = path.rstrip("/") or "/"

    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # ── AUTH ──────────────────────────────────────────────────────────────────

    if path == "/auth/login" and method == "POST":
        if body.get("admin_password") == "admin2015!RM":
            cur.execute(f"SELECT id,name,email,role FROM {SCHEMA}.users WHERE role='admin' LIMIT 1")
            user = cur.fetchone()
            if not user:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.users(name,email,password_hash,role) "
                    f"VALUES('Администратор','admin@pos.local','admin2015!RM','admin') RETURNING id,name,email,role"
                )
                user = cur.fetchone()
            user = dict(user)
            tok = secrets.token_hex(32)
            cur.execute(f"INSERT INTO {SCHEMA}.sessions(user_id,token) VALUES(%s,%s)", (user["id"], tok))
            conn.commit()
            conn.close()
            return ok({"token": tok, "user": user})
        email = body.get("email", "").strip().lower()
        password = body.get("password", "")
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
        cur.execute(
            f"INSERT INTO {SCHEMA}.users(name,email,password_hash,role,phone) VALUES(%s,%s,%s,'client',%s) RETURNING id,name,email,role",
            (name, email, password, phone)
        )
        user = dict(cur.fetchone())
        tok = secrets.token_hex(32)
        cur.execute(f"INSERT INTO {SCHEMA}.sessions(user_id,token) VALUES(%s,%s)", (user["id"], tok))
        conn.commit()
        conn.close()
        return ok({"token": tok, "user": user})

    if path == "/auth/me" and method == "GET":
        user = get_user(conn, token)
        conn.close()
        if not user:
            return err("Не авторизован", 401)
        return ok({"user": dict(user)})

    # ── PRODUCTS ──────────────────────────────────────────────────────────────

    if path == "/products" and method == "GET":
        barcode = extra_qs.get("barcode")
        search = extra_qs.get("search")
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
        user = get_user(conn, token)
        if not user or user["role"] not in ("admin", "cashier"):
            conn.close()
            return err("Нет доступа", 403)
        name = body.get("name", "").strip()
        barcode = body.get("barcode", "").strip()
        price = body.get("price", 0)
        if not name or not barcode or not price:
            conn.close()
            return err("Заполните обязательные поля")
        cur.execute(
            f"INSERT INTO {SCHEMA}.products(name,barcode,price,category,stock,discount_percent,discount_active) "
            f"VALUES(%s,%s,%s,%s,%s,%s,%s) RETURNING *",
            (name, barcode, float(price), body.get("category",""), int(body.get("stock",0)),
             int(body.get("discount_percent",0)), bool(body.get("discount_active",False)))
        )
        p = dict(cur.fetchone())
        conn.commit()
        conn.close()
        return ok({"product": p})

    if path.startswith("/products/") and method == "PUT":
        user = get_user(conn, token)
        if not user or user["role"] not in ("admin", "cashier"):
            conn.close()
            return err("Нет доступа", 403)
        pid = path.split("/")[-1]
        cur.execute(
            f"UPDATE {SCHEMA}.products SET "
            f"name=COALESCE(%s,name), price=COALESCE(%s,price), "
            f"category=COALESCE(%s,category), stock=COALESCE(%s,stock), "
            f"discount_percent=COALESCE(%s,discount_percent), discount_active=COALESCE(%s,discount_active) "
            f"WHERE id=%s RETURNING *",
            (body.get("name"), body.get("price"), body.get("category"),
             body.get("stock"), body.get("discount_percent"), body.get("discount_active"), pid)
        )
        p = cur.fetchone()
        conn.commit()
        conn.close()
        return ok({"product": dict(p) if p else None})

    # ── ORDERS ────────────────────────────────────────────────────────────────

    if path == "/orders" and method == "GET":
        user = get_user(conn, token)
        if not user:
            conn.close()
            return err("Не авторизован", 401)
        role = user["role"]
        uid = user["id"]
        status_f = extra_qs.get("status")

        if role in ("admin", "cashier"):
            base = f"""SELECT o.*,u.name as client_name,u.phone as client_phone,
                c.name as courier_name FROM {SCHEMA}.orders o
                LEFT JOIN {SCHEMA}.users u ON u.id=o.user_id
                LEFT JOIN {SCHEMA}.users c ON c.id=o.courier_id"""
            if status_f:
                cur.execute(base + " WHERE o.status=%s ORDER BY o.created_at DESC", (status_f,))
            else:
                cur.execute(base + " ORDER BY o.created_at DESC")
        elif role == "courier":
            cur.execute(
                f"""SELECT o.*,u.name as client_name,u.phone as client_phone FROM {SCHEMA}.orders o
                LEFT JOIN {SCHEMA}.users u ON u.id=o.user_id
                WHERE o.courier_id=%s ORDER BY o.created_at DESC""", (uid,)
            )
        else:
            cur.execute(
                f"""SELECT o.*,c.name as courier_name FROM {SCHEMA}.orders o
                LEFT JOIN {SCHEMA}.users c ON c.id=o.courier_id
                WHERE o.user_id=%s ORDER BY o.created_at DESC""", (uid,)
            )
        orders = [dict(r) for r in cur.fetchall()]
        for order in orders:
            cur.execute(
                f"""SELECT oi.*,p.name as product_name FROM {SCHEMA}.order_items oi
                JOIN {SCHEMA}.products p ON p.id=oi.product_id WHERE oi.order_id=%s""",
                (order["id"],)
            )
            order["items"] = [dict(i) for i in cur.fetchall()]
        conn.close()
        return ok({"orders": orders})

    if path == "/orders" and method == "POST":
        user = get_user(conn, token)
        if not user:
            conn.close()
            return err("Не авторизован", 401)
        items = body.get("items", [])
        if not items:
            conn.close()
            return err("Корзина пуста")
        total = sum(float(i.get("price", 0)) * int(i.get("quantity", 1)) for i in items)
        cur.execute(
            f"INSERT INTO {SCHEMA}.orders(user_id,status,total,delivery_address,notes) VALUES(%s,'new',%s,%s,%s) RETURNING *",
            (user["id"], total, body.get("delivery_address",""), body.get("notes",""))
        )
        order = dict(cur.fetchone())
        for item in items:
            cur.execute(
                f"INSERT INTO {SCHEMA}.order_items(order_id,product_id,quantity,price) VALUES(%s,%s,%s,%s)",
                (order["id"], item["product_id"], item["quantity"], item["price"])
            )
        conn.commit()
        conn.close()
        return ok({"order": order})

    if path.startswith("/orders/") and method == "PUT":
        user = get_user(conn, token)
        if not user or user["role"] not in ("admin", "cashier", "courier"):
            conn.close()
            return err("Нет доступа", 403)
        oid = path.split("/")[-1]
        if "courier_id" in body:
            cur.execute(f"UPDATE {SCHEMA}.orders SET courier_id=%s,updated_at=NOW() WHERE id=%s RETURNING *", (body["courier_id"], oid))
        elif "status" in body:
            cur.execute(f"UPDATE {SCHEMA}.orders SET status=%s,updated_at=NOW() WHERE id=%s RETURNING *", (body["status"], oid))
        o = cur.fetchone()
        conn.commit()
        conn.close()
        return ok({"order": dict(o) if o else None})

    # ── USERS ─────────────────────────────────────────────────────────────────

    if path == "/users" and method == "GET":
        user = get_user(conn, token)
        if not user or user["role"] != "admin":
            conn.close()
            return err("Нет доступа", 403)
        role_f = extra_qs.get("role")
        if role_f:
            cur.execute(f"SELECT id,name,email,role,phone,created_at FROM {SCHEMA}.users WHERE role=%s ORDER BY name", (role_f,))
        else:
            cur.execute(f"SELECT id,name,email,role,phone,created_at FROM {SCHEMA}.users ORDER BY name")
        users = [dict(r) for r in cur.fetchall()]
        conn.close()
        return ok({"users": users})

    if path.startswith("/users/") and method == "PUT":
        user = get_user(conn, token)
        if not user or user["role"] != "admin":
            conn.close()
            return err("Нет доступа", 403)
        uid = path.split("/")[-1]
        cur.execute(
            f"UPDATE {SCHEMA}.users SET role=COALESCE(%s,role),name=COALESCE(%s,name) WHERE id=%s RETURNING id,name,email,role",
            (body.get("role"), body.get("name"), uid)
        )
        u = cur.fetchone()
        conn.commit()
        conn.close()
        return ok({"user": dict(u) if u else None})

    conn.close()
    return ok({"status": "ok", "path": path})