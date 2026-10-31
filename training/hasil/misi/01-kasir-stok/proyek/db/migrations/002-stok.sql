-- Migrasi stok (v1 -> v2).
-- Menambah kolom stock dan min_stock ke produk, stok awal = 0 buat menu yang udah ada.
-- Data penjualan dan data lain gak disentuh, semua tetap utuh.

BEGIN TRANSACTION;

ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0);
ALTER TABLE products ADD COLUMN min_stock INTEGER NOT NULL DEFAULT 5 CHECK (min_stock >= 1);

UPDATE products SET stock = 0 WHERE stock IS NULL;

PRAGMA user_version = 2;

COMMIT;
