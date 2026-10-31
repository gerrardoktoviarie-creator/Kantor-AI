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
    if (url.pathname === '/api/products') {
      const page = Number(url.searchParams.get('page') ?? 1);
      const limit = url.searchParams.get('limit') ?? 10;
      const q = url.searchParams.get('q') ?? '';
      const items = db.prepare(`SELECT id, name, price FROM products WHERE name LIKE ?
        ORDER BY price LIMIT ${limit} OFFSET ${page * limit}`).all(`%${q}%`);
      return sendJson(res, 200, { items, page, limit, total: items.length, pages: Math.ceil(items.length / limit) });
    }
    sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Server error.' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
