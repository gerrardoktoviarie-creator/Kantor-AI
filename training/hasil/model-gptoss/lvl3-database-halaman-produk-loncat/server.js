import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price INTEGER NOT NULL);
  INSERT INTO products (name, price) VALUES
    ('Kopi Susu Gula Aren', 15000),
    ('Americano', 12000),
    ('Roti Bakar Cokelat', 18000),
    ('Kopi Tubruk', 8000),
    ('Teh Tarik', 10000),
    ('Biji Kopi Gayo 250g', 85000),
    ('Donat Gula', 5000);
`);

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Helper to validate positive integer query params
function parsePositiveInt(value, defaultValue) {
  if (value === null || value === undefined) return defaultValue;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/products') {
      // ----- Query param parsing & validation -----
      const pageParam = url.searchParams.get('page');
      const limitParam = url.searchParams.get('limit');
      const q = url.searchParams.get('q') ?? '';

      const page = parsePositiveInt(pageParam, 1);
      let limit = parsePositiveInt(limitParam, 10);
      if (page === null || limit === null) {
        return sendJson(res, 400, { error: 'Parameter page dan limit harus bilangan bulat positif.' });
      }

      // limit maksimal 50
      if (limit > 50) limit = 50;

      const offset = (page - 1) * limit;

      // ----- Total count (filtered) -----
      const totalRow = db.prepare(
        `SELECT COUNT(*) AS cnt FROM products WHERE name LIKE ?`
      ).get(`%${q}%`);
      const total = totalRow.cnt;

      // ----- Data fetch (ordered by price termurah) -----
      const items = db.prepare(
        `SELECT id, name, price
         FROM products
         WHERE name LIKE ?
         ORDER BY price ASC
         LIMIT ? OFFSET ?`
      ).all(`%${q}%`, limit, offset);

      const pages = Math.ceil(total / limit) || 1; // set minimal 1 page when total=0

      return sendJson(res, 200, {
        items,
        page,
        limit,
        total,
        pages,
      });
    }

    // Not found
    return sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: 'Server error.' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));