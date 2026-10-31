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

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/products' && req.method === 'GET') {
      const rawPage = url.searchParams.get('page') ?? '1';
      const rawLimit = url.searchParams.get('limit') ?? '10';
      const q = url.searchParams.get('q') ?? '';

      const page = Number(rawPage);
      const limit = Number(rawLimit);

      if (!Number.isInteger(page) || page < 1) {
        return sendJson(res, 400, { error: 'Parameter page harus bilangan bulat positif.' });
      }
      if (!Number.isInteger(limit) || limit < 1) {
        return sendJson(res, 400, { error: 'Parameter limit harus bilangan bulat positif.' });
      }

      const safeLimit = Math.min(limit, 50);
      const offset = (page - 1) * safeLimit;

      let whereClause = '';
      const params = [];

      if (q.trim() !== '') {
        whereClause = 'WHERE name LIKE ?';
        params.push(`%${q}%`);
      }

      const totalRow = db.prepare(`SELECT COUNT(*) as total FROM products ${whereClause}`).get(...params);
      const total = totalRow.total;
      const pages = Math.ceil(total / safeLimit);

      const items = db.prepare(
        `SELECT id, name, price FROM products ${whereClause} ORDER BY price ASC LIMIT ? OFFSET ?`
      ).all(...params, safeLimit, offset);

      return sendJson(res, 200, {
        items,
        page,
        limit: safeLimit,
        total,
        pages
      });
    }

    sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Terjadi kesalahan pada server.' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));