PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);

INSERT OR IGNORE INTO products (id, name, price) VALUES
  (1, 'Kopi Susu Gula Aren', 15000),
  (2, 'Americano', 12000),
  (3, 'Roti Bakar Cokelat', 18000);