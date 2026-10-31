PRAGMA foreign_keys = ON;

CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  fullname TEXT,
  phone INTEGER
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  total INTEGER NOT NULL
);

INSERT INTO customers (id, fullname, phone) VALUES
  (1, 'Budi Santoso', 81234567890),
  (2, 'Siti Aminah', 85711112222),
  (3, 'Agus', NULL),
  (7, '  Dewi Lestari ', 81399998888);

INSERT INTO orders (id, customer_id, total) VALUES
  (1, 1, 15000),
  (2, 1, 30000),
  (3, 2, 12000),
  (4, 7, 18000);
