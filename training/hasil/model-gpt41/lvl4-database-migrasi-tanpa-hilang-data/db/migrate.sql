-- Migrasi struktur dan data customers/phone, jaga agar id tetap sama dan pesanan tetap nyambung
PRAGMA foreign_keys=OFF;
BEGIN;

-- 1. Buat tabel customers_temp dengan struktur baru
CREATE TABLE customers_temp (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Salin dan rapikan data, trim nama, konversi phone ke TEXT (tambah 0 di depan jika tidak NULL)
INSERT INTO customers_temp (id, name, phone, created_at)
SELECT 
  id,
  TRIM(fullname),
  CASE
    WHEN phone IS NULL THEN NULL
    ELSE
      CASE
        WHEN LENGTH(phone) >= 10 THEN
          '0' || phone
        ELSE
          -- Penanganan nomor yang terlalu pendek, tetap tambahkan '0' di depan
          '0' || phone
      END
  END,
  datetime('now')
FROM customers;

-- 3. Hapus tabel lama, ganti dengan versi baru
DROP TABLE customers;
ALTER TABLE customers_temp RENAME TO customers;

-- 4. Bikin index untuk orders(customer_id)
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- 5. Set user_version ke 2
PRAGMA user_version = 2;

PRAGMA foreign_keys=ON;
COMMIT;