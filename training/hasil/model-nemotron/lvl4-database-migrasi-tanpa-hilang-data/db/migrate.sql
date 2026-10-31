PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TABLE customers_new (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO customers_new (id, name, phone, created_at)
SELECT
  id,
  TRIM(fullname) AS name,
  CASE
    WHEN phone IS NULL THEN NULL
    ELSE '0' || CAST(phone AS TEXT)
  END AS phone,
  datetime('now') AS created_at
FROM customers;

DROP TABLE customers;

ALTER TABLE customers_new RENAME TO customers;

CREATE INDEX idx_orders_customer_id ON orders(customer_id);

PRAGMA foreign_key_check;

COMMIT TRANSACTION;

PRAGMA foreign_keys = ON;

PRAGMA user_version = 2;
