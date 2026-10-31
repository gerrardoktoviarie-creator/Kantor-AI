PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'minuman' CHECK (category IN ('minuman', 'makanan')),
  price INTEGER NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock INTEGER NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  total INTEGER NOT NULL CHECK (total >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS sales_created ON sales (created_at);

INSERT OR IGNORE INTO products (id, name, price) VALUES
  (1, 'Kopi Susu Gula Aren', 15000),
  (2, 'Americano', 12000),
  (3, 'Roti Bakar Cokelat', 18000),
  (4, 'Teh Tarik', 10000);

UPDATE products SET category = 'makanan' WHERE id = 3;

PRAGMA user_version = 3;
