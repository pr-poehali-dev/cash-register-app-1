// Все запросы идут на КОРЕНЬ функции, путь передаётся как ?_path=...
// Это обязательно т.к. платформа не поддерживает подпути у функций
const BASE_URL = "https://functions.poehali.dev/7f663196-ac13-4079-91b8-b50f33da04f0";

async function request(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: object,
  token?: string,
  retries = 3
): Promise<Record<string, unknown>> {
  // Собираем query string
  const params = new URLSearchParams({ _path: path });
  if (token) params.set("_t", token);
  const url = `${BASE_URL}?${params.toString()}`;

  // text/plain не триггерит CORS preflight (в отличие от application/json)
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "text/plain";

  let lastError: Error = new Error("Нет ответа от сервера");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "Ошибка сервера");
      return data as Record<string, unknown>;
    } catch (e) {
      lastError = e as Error;
      // Повтор только при сетевой ошибке
      if (e instanceof TypeError && attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

// Прогрев при старте
let warmedUp = false;
export async function warmUp() {
  if (warmedUp) return;
  warmedUp = true;
  try { await fetch(`${BASE_URL}?_path=%2F`); } catch (_) { /* ignore */ }
}

export const api = {
  login:    (body: object) => request("/auth/login", "POST", body),
  register: (body: object) => request("/auth/register", "POST", body),
  me:       (token: string) => request("/auth/me", "GET", undefined, token),

  getProducts:       (token?: string, search?: string) => request(search ? `/products?search=${encodeURIComponent(search)}` : "/products", "GET", undefined, token),
  getProductByBarcode: (barcode: string) => request(`/products?barcode=${encodeURIComponent(barcode)}`, "GET"),
  createProduct:     (body: object, token: string) => request("/products", "POST", body, token),
  updateProduct:     (id: number, body: object, token: string) => request(`/products/${id}`, "PUT", body, token),

  getOrders:   (token: string, status?: string) => request(status ? `/orders?status=${status}` : "/orders", "GET", undefined, token),
  createOrder: (body: object, token: string) => request("/orders", "POST", body, token),
  updateOrder: (id: number, body: object, token: string) => request(`/orders/${id}`, "PUT", body, token),

  getUsers:   (token: string, role?: string) => request(role ? `/users?role=${role}` : "/users", "GET", undefined, token),
  updateUser: (id: number, body: object, token: string) => request(`/users/${id}`, "PUT", body, token),
};

export type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "cashier" | "client" | "courier";
  phone?: string;
};

export type Product = {
  id: number;
  name: string;
  barcode: string;
  price: number;
  category?: string;
  stock: number;
  discount_percent: number;
  discount_active: boolean;
  image_url?: string;
};

export type OrderItem = {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
};

export type Order = {
  id: number;
  user_id: number;
  courier_id?: number;
  client_name?: string;
  client_phone?: string;
  courier_name?: string;
  status: "new" | "processing" | "ready" | "delivery" | "delivered" | "cancelled";
  total: number;
  delivery_address?: string;
  notes?: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
};