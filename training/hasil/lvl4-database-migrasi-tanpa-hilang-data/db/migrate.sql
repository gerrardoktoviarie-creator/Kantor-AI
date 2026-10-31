-- Migrasi skema customers: fullname -> name, phone INTEGER -> TEXT (dengan leading zero).
-- Mengikuti pola 12 langkah: foreign_keys OFF di luar transaksi,
-- RENAME cuma pada tabel baru, foreign_key_check sebelum COMMIT.
PRAGMA foreign_keys = OFF;
BEGIN;

CREATE TABLE customers_new (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO customers_new (id, name, phone, created_at)
SELECT
  id,
  TRIM(fullname),
  CASE WHEN phone IS NULL THEN NULL ELSE '0' || printf('%010d', phone) END,
  datetime('now')
FROM customers;

DROP TABLE customers;

ALTER TABLE customers_new RENAME TO customers;

CREATE INDEX idx_orders_customer_id ON orders (customer_id);

PRAGMA foreign_key_check;

COMMIT;
PRAGMA foreign_keys = ON;

PRAGMA user_version = 2;