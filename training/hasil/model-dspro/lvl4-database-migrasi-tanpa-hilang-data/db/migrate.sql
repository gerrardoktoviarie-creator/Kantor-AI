-- Migrasi skema customers dari versi 1 ke versi 2
-- Dijalankan sekali di atas database yang sudah ada (db/current.sql)

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- 1. Buat tabel baru dengan struktur target
CREATE TABLE IF NOT EXISTS customers_new (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Salin dan rapikan data dari tabel lama
-- fullname di-trim jadi name, phone INTEGER dikonversi ke TEXT dengan awalan '0'
INSERT INTO customers_new (id, name, phone, created_at)
SELECT
  id,
  TRIM(fullname),
  CASE
    WHEN phone IS NULL THEN NULL
    ELSE '0' || CAST(phone AS TEXT)
  END,
  datetime('now')
FROM customers;

-- 3. Drop tabel lama
-- Jangan RENAME dulu sebelum drop, karena foreign key di orders akan ikut pindah nunjuk ke nama lama
DROP TABLE customers;

-- 4. Rename tabel baru ke nama asli
ALTER TABLE customers_new RENAME TO customers;

-- 5. Bikin ulang index buat orders(customer_id)
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- 6. Validasi integritas foreign key setelah perubahan struktur
PRAGMA foreign_key_check;

COMMIT;

PRAGMA foreign_keys = ON;

-- 7. Tandai versi skema
PRAGMA user_version = 2;