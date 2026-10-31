CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT
  price REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  product_id INTEGER REFERENCES product(id),
  qty INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO products (id, name, price) VALUES (1, 'Kopi Susu Gula Aren', 15000.0);
INSERT INTO products (id, name, price) VALUES (2, 'Americano', 12000.0);
INSERT INTO products (id, name, price) VALUES (3, 'Roti Bakar Cokelat', 18000.0);
