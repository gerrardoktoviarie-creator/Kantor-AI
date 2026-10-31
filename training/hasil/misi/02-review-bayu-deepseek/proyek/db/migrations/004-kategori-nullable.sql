BEGIN;
ALTER TABLE products ADD COLUMN category_tmp TEXT;
UPDATE products SET category_tmp = category;
ALTER TABLE products DROP COLUMN category;
ALTER TABLE products ADD COLUMN category TEXT;
UPDATE products SET category = category_tmp;
ALTER TABLE products DROP COLUMN category_tmp;
PRAGMA user_version = 4;
COMMIT;
