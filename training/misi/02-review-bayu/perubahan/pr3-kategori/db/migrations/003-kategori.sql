BEGIN;
ALTER TABLE products ADD COLUMN category TEXT NOT NULL CHECK (category IN ('minuman', 'makanan'));
UPDATE products SET category = 'makanan' WHERE name = 'Roti Bakar Cokelat';
UPDATE products SET category = 'minuman' WHERE name != 'Roti Bakar Cokelat';
PRAGMA user_version = 3;
COMMIT;
