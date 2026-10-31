import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), 'db', 'migrations');

const content = readFileSync(join(MIGRATIONS, '003-kategori.sql'), 'utf8');
db.exec(`ALTER TABLE products ADD COLUMN category TEXT CHECK (category IN ('minuman', 'makanan'))`);
db.prepare('UPDATE products SET category = "makanan" WHERE name = "Roti Bakar Cokelat"').run();
db.prepare('UPDATE products SET category = "minuman" WHERE name != "Roti Bakar Cokelat"').run();
db.prepare('PRAGMA user_version = 5').run();
