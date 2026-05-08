import { useState, useEffect, useRef, useCallback } from "react";
import { api, User, Product, Order } from "@/lib/api";
import Icon from "@/components/ui/icon";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

// ─── TYPES ───────────────────────────────────────────────────────────────────
type DeviceRole = "pc" | "phone";
type PhoneMode = "scanner" | "client";
type AppRole = "select_device" | "select_phone_mode" | "admin_login" | "client_auth" | "cashier" | "scanner" | "client" | "courier";

type CartItem = { product: Product; quantity: number };

// ─── STATUS LABELS ────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  processing: "Готовится",
  ready: "Готов",
  delivery: "В доставке",
  delivered: "Доставлен",
  cancelled: "Отменён",
};
const STATUS_NEXT: Record<string, string> = {
  new: "processing",
  processing: "ready",
  ready: "delivery",
  delivery: "delivered",
};

function statusClass(s: string) {
  const m: Record<string, string> = {
    new: "status-new",
    processing: "status-processing",
    ready: "status-ready",
    delivery: "status-delivery",
    delivered: "status-delivered",
    cancelled: "status-cancelled",
  };
  return m[s] || "status-new";
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center neon-glow">
        <Icon name="Zap" size={16} className="text-white" />
      </div>
      <span className="font-oswald text-xl font-bold tracking-wider text-white">NOVA <span className="text-primary">POS</span></span>
    </div>
  );
}

function Badge({ label, variant }: { label: string; variant?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variant || "status-new"}`}>
      {label}
    </span>
  );
}

// ─── SCREEN: DEVICE SELECT ────────────────────────────────────────────────────
function DeviceSelect({ onSelect }: { onSelect: (d: DeviceRole) => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in">
      <Logo />
      <p className="text-muted-foreground mt-2 mb-12 text-sm">Кассовая система нового поколения</p>

      <div className="w-full max-w-sm space-y-4">
        <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-widest mb-6">Выберите устройство</p>

        <button
          onClick={() => onSelect("pc")}
          className="w-full group glass neon-border rounded-2xl p-6 flex items-center gap-5 hover:bg-primary/10 transition-all duration-200 card-hover"
        >
          <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
            <Icon name="Monitor" size={28} className="text-primary" />
          </div>
          <div className="text-left">
            <div className="font-oswald text-lg font-semibold text-white">Компьютер / Касса</div>
            <div className="text-sm text-muted-foreground">Управление, заказы, товары</div>
          </div>
          <Icon name="ChevronRight" size={20} className="text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
        </button>

        <button
          onClick={() => onSelect("phone")}
          className="w-full group glass rounded-2xl p-6 flex items-center gap-5 hover:bg-white/5 transition-all duration-200 card-hover border border-border"
        >
          <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-secondary/80 transition-colors">
            <Icon name="Smartphone" size={28} className="text-foreground" />
          </div>
          <div className="text-left">
            <div className="font-oswald text-lg font-semibold text-white">Телефон</div>
            <div className="text-sm text-muted-foreground">Сканер или заказ клиента</div>
          </div>
          <Icon name="ChevronRight" size={20} className="text-muted-foreground ml-auto group-hover:text-white transition-colors" />
        </button>
      </div>
    </div>
  );
}

// ─── SCREEN: PHONE MODE SELECT ─────────────────────────────────────────────
function PhoneModeSelect({ onSelect, onBack }: { onSelect: (m: PhoneMode) => void; onBack: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in">
      <Logo />
      <p className="text-muted-foreground mt-2 mb-12 text-sm">Телефон</p>

      <div className="w-full max-w-sm space-y-4">
        <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-widest mb-6">Режим работы</p>

        <button
          onClick={() => onSelect("scanner")}
          className="w-full group glass neon-border rounded-2xl p-6 flex items-center gap-5 hover:bg-primary/10 transition-all duration-200"
        >
          <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
            <Icon name="ScanBarcode" size={28} className="text-primary" />
          </div>
          <div className="text-left">
            <div className="font-oswald text-lg font-semibold text-white">Сканер</div>
            <div className="text-sm text-muted-foreground">Сканировать штрихкоды</div>
          </div>
          <Icon name="ChevronRight" size={20} className="text-muted-foreground ml-auto" />
        </button>

        <button
          onClick={() => onSelect("client")}
          className="w-full group glass rounded-2xl p-6 flex items-center gap-5 hover:bg-white/5 transition-all border border-border"
        >
          <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center">
            <Icon name="ShoppingCart" size={28} className="text-foreground" />
          </div>
          <div className="text-left">
            <div className="font-oswald text-lg font-semibold text-white">Клиент</div>
            <div className="text-sm text-muted-foreground">Заказать товар</div>
          </div>
          <Icon name="ChevronRight" size={20} className="text-muted-foreground ml-auto" />
        </button>

        <button onClick={onBack} className="w-full text-muted-foreground text-sm py-3 hover:text-white transition-colors">
          ← Назад
        </button>
      </div>
    </div>
  );
}

// ─── SCREEN: ADMIN LOGIN ──────────────────────────────────────────────────────
function AdminLogin({ onLogin, onBack }: { onLogin: (user: User, token: string) => void; onBack: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.login({ admin_password: password });
      onLogin(res.user, res.token);
    } catch (e) {
      setError((e as Error).message || "Неверный пароль");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in">
      <Logo />
      <p className="text-muted-foreground mt-2 mb-12 text-sm">Вход в кассу</p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="glass neon-border rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Пароль администратора</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              autoFocus
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-xl transition-all neon-glow disabled:opacity-50"
          >
            {loading ? "Входим..." : "Войти в кассу"}
          </button>
        </div>
        <button type="button" onClick={onBack} className="w-full text-muted-foreground text-sm py-3 hover:text-white transition-colors">
          ← Назад
        </button>
      </form>
    </div>
  );
}

// ─── SCREEN: CLIENT AUTH ──────────────────────────────────────────────────────
function ClientAuth({ onLogin, onBack }: { onLogin: (user: User, token: string) => void; onBack: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let res;
      if (mode === "login") {
        res = await api.login({ email: form.email, password: form.password });
      } else {
        res = await api.register(form);
      }
      onLogin(res.user, res.token);
    } catch (e) {
      setError((e as Error).message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in">
      <Logo />
      <p className="text-muted-foreground mt-2 mb-8 text-sm">Личный кабинет клиента</p>

      <div className="w-full max-w-sm">
        <div className="flex bg-secondary rounded-xl p-1 mb-6">
          <button onClick={() => setMode("login")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === "login" ? "bg-primary text-white" : "text-muted-foreground hover:text-white"}`}>
            Войти
          </button>
          <button onClick={() => setMode("register")} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === "register" ? "bg-primary text-white" : "text-muted-foreground hover:text-white"}`}>
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4 border border-border">
          {mode === "register" && (
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Имя"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          )}
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email"
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Пароль"
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
          />
          {mode === "register" && (
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Телефон (необязательно)"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50">
            {loading ? "..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        <button type="button" onClick={onBack} className="w-full text-muted-foreground text-sm py-3 mt-2 hover:text-white transition-colors">
          ← Назад
        </button>
      </div>
    </div>
  );
}

// ─── SCREEN: SCANNER ─────────────────────────────────────────────────────────
function ScannerView({ token, onBack }: { token: string; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function lookup(barcode: string) {
    if (!barcode.trim()) return;
    setLoading(true);
    setNotFound(false);
    setProduct(null);
    try {
      const res = await api.getProductByBarcode(barcode.trim());
      if (res.product) {
        setProduct(res.product);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") lookup(code);
  }

  const finalPrice = product
    ? product.discount_active ? product.price * (1 - product.discount_percent / 100) : product.price
    : 0;

  return (
    <div className="min-h-screen flex flex-col p-4 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <Icon name="ArrowLeft" size={20} />
        </button>
        <Logo />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 max-w-sm mx-auto w-full">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4 neon-border">
            <Icon name="ScanBarcode" size={36} className="text-primary" />
          </div>
          <h2 className="font-oswald text-2xl font-bold text-white">Сканер штрихкодов</h2>
          <p className="text-muted-foreground text-sm mt-1">Введите код или поднесите сканер</p>
        </div>

        <div className="w-full flex gap-2">
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Штрихкод..."
            className="flex-1 bg-secondary border border-border rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
          <button onClick={() => lookup(code)} className="bg-primary hover:bg-primary/90 text-white px-4 rounded-xl transition-all neon-glow">
            <Icon name="Search" size={20} />
          </button>
        </div>

        {loading && (
          <div className="w-full glass rounded-2xl p-8 flex items-center justify-center border border-border">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {notFound && !loading && (
          <div className="w-full glass rounded-2xl p-6 text-center border border-destructive/30 animate-scale-in">
            <Icon name="PackageX" size={32} className="text-destructive mx-auto mb-2" />
            <p className="text-destructive font-medium">Товар не найден</p>
            <p className="text-muted-foreground text-sm">Код: {code}</p>
          </div>
        )}

        {product && !loading && (
          <div className="w-full glass neon-border rounded-2xl p-5 animate-scale-in">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                <Icon name="Package" size={28} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-lg leading-tight">{product.name}</h3>
                <p className="text-muted-foreground text-sm">{product.barcode}</p>
                {product.category && <p className="text-xs text-muted-foreground mt-1">{product.category}</p>}
                <div className="mt-3 flex items-center gap-3">
                  <span className="font-oswald text-2xl font-bold text-primary">
                    {finalPrice.toFixed(0)} ₽
                  </span>
                  {product.discount_active && (
                    <>
                      <span className="text-muted-foreground line-through text-sm">{product.price} ₽</span>
                      <Badge label={`-${product.discount_percent}%`} variant="status-delivered" />
                    </>
                  )}
                </div>
                <p className={`text-sm mt-1 ${product.stock > 0 ? "text-green-400" : "text-destructive"}`}>
                  {product.stock > 0 ? `В наличии: ${product.stock} шт.` : "Нет в наличии"}
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          После сканирования нажмите Enter или кнопку поиска
        </p>
      </div>
    </div>
  );
}

// ─── SCREEN: CLIENT VIEW ──────────────────────────────────────────────────────
function ClientView({ user, token, onLogout }: { user: User; token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<"catalog" | "cart" | "orders">("catalog");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [ordering, setOrdering] = useState(false);

  useEffect(() => { loadProducts(); loadOrders(); }, []);

  const loadProducts = async () => {
    try {
      const res = await api.getProducts(token);
      setProducts(res.products);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await api.getOrders(token);
      setOrders(res.orders);
    } catch (_) {
      // ignore
    }
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)
  );

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const exists = prev.find((c) => c.product.id === product.id);
      if (exists) return prev.map((c) => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { product, quantity: 1 }];
    });
    toast({ title: "Добавлено в корзину", description: product.name });
  };

  const removeFromCart = (id: number) => setCart((prev) => prev.filter((c) => c.product.id !== id));
  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) return removeFromCart(id);
    setCart((prev) => prev.map((c) => c.product.id === id ? { ...c, quantity: qty } : c));
  };

  const cartTotal = cart.reduce((sum, c) => {
    const price = c.product.discount_active ? c.product.price * (1 - c.product.discount_percent / 100) : c.product.price;
    return sum + price * c.quantity;
  }, 0);

  const placeOrder = async () => {
    if (!cart.length) return;
    setOrdering(true);
    try {
      const items = cart.map((c) => ({
        product_id: c.product.id,
        quantity: c.quantity,
        price: c.product.discount_active ? c.product.price * (1 - c.product.discount_percent / 100) : c.product.price,
      }));
      await api.createOrder({ items, delivery_address: address, notes }, token);
      setCart([]);
      setAddress("");
      setNotes("");
      setTab("orders");
      await loadOrders();
      toast({ title: "Заказ оформлен!", description: "Следите за статусом во вкладке «Заказы»" });
    } catch (e) {
      toast({ title: "Ошибка", description: (e as Error).message, variant: "destructive" });
    } finally {
      setOrdering(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">{user.name}</span>
          <button onClick={onLogout} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-white">
            <Icon name="LogOut" size={18} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex border-b border-border bg-card">
        {([["catalog", "ShoppingBag", "Каталог"], ["cart", "ShoppingCart", `Корзина${cart.length ? ` (${cart.length})` : ""}`], ["orders", "ClipboardList", "Заказы"]] as const).map(([t, icon, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"}`}
          >
            <Icon name={icon} size={16} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{t === "cart" && cart.length ? cart.length : ""}</span>
          </button>
        ))}
      </nav>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {/* CATALOG */}
        {tab === "catalog" && (
          <div className="animate-fade-in">
            <div className="relative mb-4">
              <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск товаров..."
                className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            {loading ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filtered.map((p) => {
                  const finalPrice = p.discount_active ? p.price * (1 - p.discount_percent / 100) : p.price;
                  const inCart = cart.find((c) => c.product.id === p.id);
                  return (
                    <div key={p.id} className="glass rounded-xl p-4 border border-border card-hover">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-white leading-tight">{p.name}</h3>
                        {p.discount_active && <Badge label={`-${p.discount_percent}%`} variant="status-delivered" />}
                      </div>
                      {p.category && <p className="text-xs text-muted-foreground mb-2">{p.category}</p>}
                      <div className="flex items-center justify-between mt-3">
                        <div>
                          <span className="font-oswald text-xl font-bold text-primary">{finalPrice.toFixed(0)} ₽</span>
                          {p.discount_active && <span className="text-xs text-muted-foreground line-through ml-2">{p.price} ₽</span>}
                          <p className={`text-xs mt-0.5 ${p.stock > 0 ? "text-green-400" : "text-destructive"}`}>
                            {p.stock > 0 ? `${p.stock} шт.` : "Нет"}
                          </p>
                        </div>
                        {inCart ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateQty(p.id, inCart.quantity - 1)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                              <Icon name="Minus" size={14} />
                            </button>
                            <span className="text-white text-sm w-6 text-center">{inCart.quantity}</span>
                            <button onClick={() => updateQty(p.id, inCart.quantity + 1)} className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors">
                              <Icon name="Plus" size={14} className="text-white" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(p)}
                            disabled={p.stock === 0}
                            className="bg-primary hover:bg-primary/90 text-white text-sm px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            В корзину
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="col-span-2 text-center py-12 text-muted-foreground">
                    <Icon name="PackageSearch" size={40} className="mx-auto mb-3 opacity-40" />
                    <p>Товары не найдены</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CART */}
        {tab === "cart" && (
          <div className="animate-fade-in space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Icon name="ShoppingCart" size={48} className="mx-auto mb-3 opacity-30" />
                <p>Корзина пуста</p>
                <button onClick={() => setTab("catalog")} className="mt-4 text-primary text-sm hover:underline">Перейти в каталог</button>
              </div>
            ) : (
              <>
                {cart.map((c) => {
                  const price = c.product.discount_active ? c.product.price * (1 - c.product.discount_percent / 100) : c.product.price;
                  return (
                    <div key={c.product.id} className="glass rounded-xl p-4 border border-border flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <Icon name="Package" size={18} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm truncate">{c.product.name}</p>
                        <p className="text-primary text-sm">{price.toFixed(0)} ₽ × {c.quantity} = <strong>{(price * c.quantity).toFixed(0)} ₽</strong></p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(c.product.id, c.quantity - 1)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80">
                          <Icon name="Minus" size={12} />
                        </button>
                        <span className="text-white text-sm w-6 text-center">{c.quantity}</span>
                        <button onClick={() => updateQty(c.product.id, c.quantity + 1)} className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/90">
                          <Icon name="Plus" size={12} className="text-white" />
                        </button>
                        <button onClick={() => removeFromCart(c.product.id)} className="w-7 h-7 rounded-lg bg-destructive/20 flex items-center justify-center hover:bg-destructive/40 ml-1">
                          <Icon name="X" size={12} className="text-destructive" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className="glass neon-border rounded-xl p-4 space-y-3">
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Адрес доставки (необязательно)"
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-white placeholder-muted-foreground focus:outline-none focus:border-primary text-sm transition-colors"
                  />
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Комментарий к заказу"
                    rows={2}
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-white placeholder-muted-foreground focus:outline-none focus:border-primary text-sm transition-colors resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Итого:</span>
                    <span className="font-oswald text-2xl font-bold text-primary">{cartTotal.toFixed(0)} ₽</span>
                  </div>
                  <button
                    onClick={placeOrder}
                    disabled={ordering}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-xl transition-all neon-glow disabled:opacity-50"
                  >
                    {ordering ? "Оформляем..." : "Оформить заказ"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ORDERS */}
        {tab === "orders" && (
          <div className="animate-fade-in space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-oswald text-lg font-semibold text-white">Мои заказы</h2>
              <button onClick={loadOrders} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
                <Icon name="RefreshCw" size={16} />
              </button>
            </div>
            {orders.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Icon name="ClipboardList" size={48} className="mx-auto mb-3 opacity-30" />
                <p>Заказов пока нет</p>
              </div>
            ) : (
              orders.map((o) => (
                <div key={o.id} className="glass rounded-xl p-4 border border-border animate-slide-up">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-oswald text-lg font-bold text-white">№{o.id}</span>
                    <Badge label={STATUS_LABELS[o.status] || o.status} variant={statusClass(o.status)} />
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {(o.items || []).map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.product_name} × {item.quantity}</span>
                        <span className="text-white">{(item.price * item.quantity).toFixed(0)} ₽</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <div className="text-xs text-muted-foreground">
                      {o.courier_name && <span>Курьер: {o.courier_name}</span>}
                    </div>
                    <span className="font-oswald font-bold text-primary">{Number(o.total).toFixed(0)} ₽</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── SCREEN: CASHIER/ADMIN VIEW ───────────────────────────────────────────────
function CashierView({ user, token, onLogout }: { user: User; token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<"orders" | "products" | "users" | "couriers">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [couriers, setCouriers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ name: "", barcode: "", price: "", category: "", stock: "", discount_percent: "0", discount_active: false });
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  useEffect(() => {
    loadOrders();
    loadProducts();
    if (user.role === "admin") { loadUsers(); loadCouriers(); }
  }, []);

  const loadOrders = async () => {
    try {
      const res = await api.getOrders(token, statusFilter || undefined);
      setOrders(res.orders);
    } finally { setLoading(false); }
  };

  const loadProducts = async () => {
    const res = await api.getProducts(token);
    setProducts(res.products);
  };

  const loadUsers = async () => {
    const res = await api.getUsers(token);
    setUsers(res.users);
  };

  const loadCouriers = async () => {
    const res = await api.getUsers(token, "courier");
    setCouriers(res.users);
  };

  useEffect(() => { loadOrders(); }, [statusFilter]);

  const changeStatus = async (orderId: number, status: string) => {
    await api.updateOrder(orderId, { status }, token);
    await loadOrders();
    toast({ title: "Статус обновлён", description: STATUS_LABELS[status] });
  };

  const assignCourier = async (orderId: number, courierId: number) => {
    await api.updateOrder(orderId, { courier_id: courierId }, token);
    await loadOrders();
    toast({ title: "Курьер назначен" });
  };

  const saveProduct = async () => {
    try {
      if (editProduct) {
        await api.updateProduct(editProduct.id, {
          name: productForm.name,
          price: parseFloat(productForm.price),
          category: productForm.category,
          stock: parseInt(productForm.stock),
          discount_percent: parseInt(productForm.discount_percent),
          discount_active: productForm.discount_active,
        }, token);
        toast({ title: "Товар обновлён" });
      } else {
        await api.createProduct({
          name: productForm.name,
          barcode: productForm.barcode,
          price: parseFloat(productForm.price),
          category: productForm.category,
          stock: parseInt(productForm.stock) || 0,
          discount_percent: parseInt(productForm.discount_percent) || 0,
          discount_active: productForm.discount_active,
        }, token);
        toast({ title: "Товар добавлен" });
      }
      await loadProducts();
      setShowProductForm(false);
      setEditProduct(null);
      setProductForm({ name: "", barcode: "", price: "", category: "", stock: "", discount_percent: "0", discount_active: false });
    } catch (e) {
      toast({ title: "Ошибка", description: (e as Error).message, variant: "destructive" });
    }
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setProductForm({
      name: p.name, barcode: p.barcode, price: String(p.price),
      category: p.category || "", stock: String(p.stock),
      discount_percent: String(p.discount_percent), discount_active: p.discount_active,
    });
    setShowProductForm(true);
  };

  const changeRole = async (userId: number, role: string) => {
    await api.updateUser(userId, { role }, token);
    await loadUsers();
    toast({ title: "Роль обновлена" });
  };

  const isAdmin = user.role === "admin";

  const tabs = [
    { key: "orders", icon: "ClipboardList", label: "Заказы" },
    { key: "products", icon: "Package", label: "Товары" },
    ...(isAdmin ? [{ key: "users", icon: "Users", label: "Клиенты" }, { key: "couriers", icon: "Bike", label: "Курьеры" }] : []),
  ] as const;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <Logo />
        <div className="flex items-center gap-3">
          <Badge label={isAdmin ? "Администратор" : "Кассир"} variant="status-processing" />
          <span className="text-sm text-muted-foreground hidden md:block">{user.name}</span>
          <button onClick={onLogout} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-white">
            <Icon name="LogOut" size={18} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex border-b border-border bg-card overflow-x-auto">
        {tabs.map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all ${tab === key ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"}`}
          >
            <Icon name={icon} size={16} />
            {label}
          </button>
        ))}
      </nav>

      <main className="flex-1 p-4 max-w-5xl mx-auto w-full">
        {/* ORDERS TAB */}
        {tab === "orders" && (
          <div className="animate-fade-in">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="flex items-center gap-2">
                <button onClick={loadOrders} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
                  <Icon name="RefreshCw" size={16} />
                </button>
                <span className="font-oswald text-lg font-semibold text-white">Заказы</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {["", "new", "processing", "ready", "delivery", "delivered"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-white"}`}
                  >
                    {s === "" ? "Все" : STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : orders.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Icon name="ClipboardList" size={48} className="mx-auto mb-3 opacity-30" />
                <p>Заказов нет</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((o) => (
                  <div key={o.id} className="glass rounded-xl border border-border overflow-hidden animate-slide-up">
                    <div
                      className="p-4 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-oswald font-bold text-white">№{o.id}</span>
                          <Badge label={STATUS_LABELS[o.status] || o.status} variant={statusClass(o.status)} />
                          {o.courier_name && <span className="text-xs text-muted-foreground">🚴 {o.courier_name}</span>}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{o.client_name || "Клиент"}</span>
                          {o.client_phone && <span>{o.client_phone}</span>}
                          <span className="font-oswald text-primary font-bold">{Number(o.total).toFixed(0)} ₽</span>
                        </div>
                      </div>
                      <Icon name={expandedOrder === o.id ? "ChevronUp" : "ChevronDown"} size={18} className="text-muted-foreground shrink-0" />
                    </div>

                    {expandedOrder === o.id && (
                      <div className="border-t border-border p-4 space-y-4 animate-fade-in">
                        {/* Items */}
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Состав заказа</p>
                          {(o.items || []).map((item) => (
                            <div key={item.id} className="flex justify-between text-sm py-1">
                              <span className="text-white">{item.product_name} × {item.quantity}</span>
                              <span className="text-muted-foreground">{(item.price * item.quantity).toFixed(0)} ₽</span>
                            </div>
                          ))}
                        </div>

                        {o.delivery_address && (
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Адрес</p>
                            <p className="text-sm text-white">{o.delivery_address}</p>
                          </div>
                        )}
                        {o.notes && (
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Комментарий</p>
                            <p className="text-sm text-white">{o.notes}</p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                          {STATUS_NEXT[o.status] && (
                            <button
                              onClick={() => changeStatus(o.id, STATUS_NEXT[o.status])}
                              className="bg-primary hover:bg-primary/90 text-white text-sm px-4 py-2 rounded-lg transition-all"
                            >
                              → {STATUS_LABELS[STATUS_NEXT[o.status]]}
                            </button>
                          )}
                          {o.status !== "cancelled" && o.status !== "delivered" && (
                            <button
                              onClick={() => changeStatus(o.id, "cancelled")}
                              className="bg-destructive/20 hover:bg-destructive/40 text-destructive text-sm px-4 py-2 rounded-lg transition-all"
                            >
                              Отменить
                            </button>
                          )}
                        </div>

                        {/* Assign courier */}
                        {isAdmin && couriers.length > 0 && o.status !== "delivered" && o.status !== "cancelled" && (
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Назначить курьера</p>
                            <div className="flex flex-wrap gap-2">
                              {couriers.map((c) => (
                                <button
                                  key={c.id}
                                  onClick={() => assignCourier(o.id, c.id)}
                                  className={`text-sm px-3 py-1.5 rounded-lg transition-all ${o.courier_id === c.id ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-white hover:bg-secondary/80"}`}
                                >
                                  🚴 {c.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PRODUCTS TAB */}
        {tab === "products" && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <span className="font-oswald text-lg font-semibold text-white">Товары</span>
              <button
                onClick={() => { setEditProduct(null); setProductForm({ name: "", barcode: "", price: "", category: "", stock: "", discount_percent: "0", discount_active: false }); setShowProductForm(true); }}
                className="bg-primary hover:bg-primary/90 text-white text-sm px-4 py-2 rounded-lg transition-all flex items-center gap-2"
              >
                <Icon name="Plus" size={16} className="text-white" />
                Добавить
              </button>
            </div>

            {showProductForm && (
              <div className="glass neon-border rounded-xl p-5 mb-4 animate-scale-in">
                <h3 className="font-oswald text-base font-semibold text-white mb-4">{editProduct ? "Редактировать товар" : "Новый товар"}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Название *" className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-white placeholder-muted-foreground focus:outline-none focus:border-primary text-sm transition-colors" />
                  <input value={productForm.barcode} onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })} placeholder="Штрихкод *" disabled={!!editProduct} className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-white placeholder-muted-foreground focus:outline-none focus:border-primary text-sm transition-colors disabled:opacity-50" />
                  <input type="number" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} placeholder="Цена, ₽ *" className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-white placeholder-muted-foreground focus:outline-none focus:border-primary text-sm transition-colors" />
                  <input value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} placeholder="Категория" className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-white placeholder-muted-foreground focus:outline-none focus:border-primary text-sm transition-colors" />
                  <input type="number" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} placeholder="Остаток" className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-white placeholder-muted-foreground focus:outline-none focus:border-primary text-sm transition-colors" />
                  <input type="number" min="0" max="100" value={productForm.discount_percent} onChange={(e) => setProductForm({ ...productForm, discount_percent: e.target.value })} placeholder="Скидка %" className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-white placeholder-muted-foreground focus:outline-none focus:border-primary text-sm transition-colors" />
                </div>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input type="checkbox" checked={productForm.discount_active} onChange={(e) => setProductForm({ ...productForm, discount_active: e.target.checked })} className="w-4 h-4 accent-orange-500" />
                  <span className="text-sm text-muted-foreground">Акция активна</span>
                </label>
                <div className="flex gap-2 mt-4">
                  <button onClick={saveProduct} className="bg-primary hover:bg-primary/90 text-white text-sm px-5 py-2 rounded-lg transition-all">Сохранить</button>
                  <button onClick={() => { setShowProductForm(false); setEditProduct(null); }} className="bg-secondary text-muted-foreground hover:text-white text-sm px-5 py-2 rounded-lg transition-colors">Отмена</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {products.map((p) => {
                const finalPrice = p.discount_active ? p.price * (1 - p.discount_percent / 100) : p.price;
                return (
                  <div key={p.id} className="glass rounded-xl p-3 border border-border flex items-center gap-3 card-hover">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <Icon name="Package" size={18} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white text-sm">{p.name}</span>
                        {p.discount_active && <Badge label={`-${p.discount_percent}%`} variant="status-delivered" />}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{p.barcode}</span>
                        {p.category && <span>{p.category}</span>}
                        <span className={p.stock > 0 ? "text-green-400" : "text-destructive"}>{p.stock} шт.</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-oswald font-bold text-primary">{finalPrice.toFixed(0)} ₽</div>
                      {p.discount_active && <div className="text-xs text-muted-foreground line-through">{p.price} ₽</div>}
                    </div>
                    <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-white shrink-0">
                      <Icon name="Pencil" size={14} />
                    </button>
                  </div>
                );
              })}
              {products.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Icon name="Package" size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Нет товаров. Добавьте первый!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {tab === "users" && isAdmin && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <span className="font-oswald text-lg font-semibold text-white">Пользователи</span>
            </div>
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="glass rounded-xl p-3 border border-border flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <Icon name="User" size={18} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-white text-sm">{u.name}</span>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="client">Клиент</option>
                    <option value="cashier">Кассир</option>
                    <option value="courier">Курьер</option>
                    <option value="admin">Админ</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COURIERS TAB */}
        {tab === "couriers" && isAdmin && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <span className="font-oswald text-lg font-semibold text-white">Курьеры</span>
              <p className="text-xs text-muted-foreground">Назначьте роль курьера во вкладке «Клиенты»</p>
            </div>

            {couriers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Icon name="Bike" size={48} className="mx-auto mb-3 opacity-30" />
                <p>Нет курьеров</p>
                <p className="text-xs mt-1">Назначьте пользователю роль «Курьер» во вкладке «Клиенты»</p>
              </div>
            ) : (
              <div className="space-y-3">
                {couriers.map((c) => {
                  const courierOrders = orders.filter((o) => o.courier_id === c.id);
                  const active = courierOrders.filter((o) => o.status === "delivery").length;
                  return (
                    <div key={c.id} className="glass rounded-xl p-4 border border-border">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                          <Icon name="Bike" size={22} className="text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.email}</p>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="text-sm font-medium text-white">{active} активных</p>
                          <p className="text-xs text-muted-foreground">доставок</p>
                        </div>
                      </div>

                      {/* Assign unassigned orders */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Назначить заказы</p>
                        <div className="flex flex-wrap gap-2">
                          {orders.filter((o) => !o.courier_id && o.status !== "delivered" && o.status !== "cancelled").map((o) => (
                            <button
                              key={o.id}
                              onClick={() => assignCourier(o.id, c.id)}
                              className="text-xs px-3 py-1.5 bg-secondary hover:bg-primary hover:text-white text-muted-foreground rounded-lg transition-all"
                            >
                              Заказ №{o.id}
                            </button>
                          ))}
                          {orders.filter((o) => !o.courier_id && o.status !== "delivered" && o.status !== "cancelled").length === 0 && (
                            <span className="text-xs text-muted-foreground">Все заказы распределены</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function Index() {
  const [screen, setScreen] = useState<AppRole>("select_device");
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>("");

  function handleDeviceSelect(d: DeviceRole) {
    if (d === "pc") setScreen("admin_login");
    else setScreen("select_phone_mode");
  }

  function handlePhoneMode(m: PhoneMode) {
    if (m === "scanner") setScreen("scanner");
    else setScreen("client_auth");
  }

  function handleLogin(u: User, t: string) {
    setUser(u);
    setToken(t);
    if (u.role === "admin" || u.role === "cashier") setScreen("cashier");
    else if (u.role === "courier") setScreen("courier");
    else setScreen("client");
  }

  function handleLogout() {
    setUser(null);
    setToken("");
    setScreen("select_device");
  }

  return (
    <>
      <Toaster />
      {screen === "select_device" && <DeviceSelect onSelect={handleDeviceSelect} />}
      {screen === "select_phone_mode" && <PhoneModeSelect onSelect={handlePhoneMode} onBack={() => setScreen("select_device")} />}
      {screen === "admin_login" && <AdminLogin onLogin={handleLogin} onBack={() => setScreen("select_device")} />}
      {screen === "client_auth" && <ClientAuth onLogin={handleLogin} onBack={() => setScreen("select_phone_mode")} />}
      {screen === "scanner" && <ScannerView token={token} onBack={() => setScreen("select_phone_mode")} />}
      {screen === "client" && user && <ClientView user={user} token={token} onLogout={handleLogout} />}
      {screen === "cashier" && user && <CashierView user={user} token={token} onLogout={handleLogout} />}
      {screen === "courier" && user && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Войдите через ПК для работы курьера</p>
            <button onClick={handleLogout} className="mt-4 text-primary hover:underline text-sm">Выйти</button>
          </div>
        </div>
      )}
    </>
  );
}