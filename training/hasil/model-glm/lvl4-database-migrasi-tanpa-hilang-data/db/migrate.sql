-- Migrasi skema customers ke versi 2
-- Pola 12 langkah SQLite: aman, atomik, foreign key tetap utuh.

-- Langkah 1: Matikan foreign key DI LUAR transaksi
PRAGMA foreign_keys = OFF;

-- Langkah 2: Mulai transaksi (kalau gagal di tengah, ROLLBACK, database gak setengah jadi)
BEGIN TRANSACTION;

-- Langkah 3: Bikin tabel baru dengan struktur target
CREATE TABLE IF NOT EXISTS customers_new (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Langkah 4: Salin dan rapikan data
-- fullname -> TRIM() -> name (NOT NULL terpenuhi karena data contoh gak ada yang NULL)
-- phone INTEGER -> CAST ke TEXT, tambah '0' di depan kalau bukan NULL
INSERT OR IGNORE INTO customers_new (id, name, phone, created_at)
SELECT
  id,
  TRIM(fullname),
  CASE WHEN phone IS NOT NULL THEN '0' || CAST(phone AS TEXT) ELSE NULL END,
  datetime('now')
FROM customers;

-- Langkah 5: DROP tabel lama
-- JANGAN RENAME tabel lama dulu, nanti foreign key di orders ikut pindah nunjuk ke nama sementara
DROP TABLE customers;

-- Langkah 6: RENAME tabel baru ke nama asli
ALTER TABLE customers_new RENAME TO customers;

-- Langkah 7: Bikin ulang index buat orders(customer_id)
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Langkah 8: Cek integritas foreign key
PRAGMA foreign_key_check;

-- Langkah 9: Tandai versi skema
PRAGMA user_version = 2;

-- Langkah 10: Commit
COMMIT;

-- Langkah 11-12: Nyalakan lagi foreign keys DI LUAR transaksi
PRAGMA foreign_keys = ON;