const BASE_URL = "https://functions.poehali.dev/7f663196-ac13-4079-91b8-b50f33da04f0";

async function request(path: string, options: RequestInit = {}, token?: string, retries = 3): Promise<Record<string, unknown>> {
  // Токен передаём через query string чтобы не добавлять кастомные заголовки
  // (кастомные заголовки вызывают CORS preflight, который платформа не пропускает)
  // Используем text/plain чтобы избежать CORS preflight
  // (application/json триггерит preflight, text/plain — нет)
  const headers: Record<string, string> = {};
  const isPost = options.method === "POST" || options.method === "PUT";
  if (isPost && options.body) headers["Content-Type"] = "text/plain";

  // Добавляем токен в URL как ?_t=...
  let url = `${BASE_URL}${path}`;
  if (token) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}_t=${encodeURIComponent(token)}`;
  }

  let lastError: Error = new Error("Нет ответа от сервера");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, headers });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "Ошибка сервера");
      return data as Record<string, unknown>;
    } catch (e) {
      lastError = e as Error;
      const isNetworkError = e instanceof TypeError;
      if (isNetworkError && attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

// Прогрев функции при старте (холодный старт ~300-400ms)
let warmedUp = false;
export async function warmUp() {
  if (warmedUp) return;
  warmedUp = true;
  try { await fetch(`${BASE_URL}/`, { method: "GET" }); } catch (_) { /* ignore */ }
}

export const api = {
  // Auth
  login: (body: object) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  register: (body: object) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  me: (token: string) => request("/auth/me", {}, token),

  // Products
  getProducts: (token?: string, search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return request(`/products${qs}`, {}, token);
  },
  getProductByBarcode: (barcode: string) => request(`/products?barcode=${encodeURIComponent(barcode)}`),
  createProduct: (body: object, token: string) => request("/products", { method: "POST", body: JSON.stringify(body) }, token),
  updateProduct: (id: number, body: object, token: string) => request(`/products/${id}`, { method: "PUT", body: JSON.stringify(body) }, token),

  // Orders
  getOrders: (token: string, status?: string) => {
    const qs = status ? `?status=${status}` : "";
    return request(`/orders${qs}`, {}, token);
  },
  createOrder: (body: object, token: string) => request("/orders", { method: "POST", body: JSON.stringify(body) }, token),
  updateOrder: (id: number, body: object, token: string) => request(`/orders/${id}`, { method: "PUT", body: JSON.stringify(body) }, token),

  // Users
  getUsers: (token: string, role?: string) => {
    const qs = role ? `?role=${role}` : "";
    return request(`/users${qs}`, {}, token);
  },
  updateUser: (id: number, body: object, token: string) => request(`/users/${id}`, { method: "PUT", body: JSON.stringify(body) }, token),
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