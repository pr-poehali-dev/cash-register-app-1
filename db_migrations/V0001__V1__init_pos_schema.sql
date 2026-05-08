
CREATE TABLE IF NOT EXISTS t_p13578121_cash_register_app_1.users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'client',
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p13578121_cash_register_app_1.products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  barcode VARCHAR(100) UNIQUE NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(100),
  stock INT DEFAULT 0,
  discount_percent INT DEFAULT 0,
  discount_active BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p13578121_cash_register_app_1.orders (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES t_p13578121_cash_register_app_1.users(id),
  courier_id INT REFERENCES t_p13578121_cash_register_app_1.users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  total DECIMAL(10,2) DEFAULT 0,
  delivery_address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p13578121_cash_register_app_1.order_items (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES t_p13578121_cash_register_app_1.orders(id),
  product_id INT REFERENCES t_p13578121_cash_register_app_1.products(id),
  quantity INT NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS t_p13578121_cash_register_app_1.sessions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES t_p13578121_cash_register_app_1.users(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
);

INSERT INTO t_p13578121_cash_register_app_1.users (name, email, password_hash, role)
VALUES ('Администратор', 'admin@pos.local', 'admin2015!RM', 'admin')
ON CONFLICT (email) DO NOTHING;
