-- Migration to version 2: clean up customers table, fix phone format, trim names,
-- add created_at, enforce NOT NULL on name, and add index on orders.customer_id.
-- All schema changes are performed inside a transaction with foreign keys disabled.
-- After the transaction commits we re‑enable foreign keys and set the user_version.

BEGIN;
PRAGMA foreign_keys = OFF;

-- 1. Rename the existing table so we can create a fresh one with the proper schema.
ALTER TABLE customers RENAME TO customers_old;

-- 2. Create the new customers table with the desired columns.
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Migrate data: trim fullname → name and prepend leading zero to phone.
INSERT INTO customers (id, name, phone)
SELECT
    id,
    TRIM(fullname) AS name,
    CASE
        WHEN phone IS NULL THEN NULL
        ELSE '0' || phone
    END AS phone
FROM customers_old;

-- 4. Remove the old table now that the data has been copied.
DROP TABLE customers_old;

COMMIT;

-- 5. Turn foreign‑key enforcement back on (the new data is now valid).
PRAGMA foreign_keys = ON;

-- 6. Index for faster lookup of orders by customer.
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- 7. Record schema version.
PRAGMA user_version = 2;