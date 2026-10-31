import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price INTEGER NOT NULL);
  INSERT INTO products (name, price) VALUES
    ('Roti Jum''at Berkah', 10000),
    ('Roti Sobek Cokelat', 15000),
    ('Donat Gula', 5000);
`);

const PORT = Number(process.env.PORT) || 3000;
const MAX_Q_LENGTH = 256;
const LIMIT_DEFAULT = 100;
const LIMIT_MAX = 1000;

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  if (path === '/api/products') {
    const rawQ = url.searchParams.get('q') ?? '';
    let q = String(rawQ).slice(0, MAX_Q_LENGTH);

    let limit = LIMIT_DEFAULT;
    const limitRaw = url.searchParams.get('limit');
    if (limitRaw !== null && limitRaw !== '') {
      const n = Number(limitRaw);
      if (!Number.isInteger(n) || n < 1 || n > LIMIT_MAX) {
        return sendJson(res, 400, { error: 'limit harus bilangan bulat positif' });
      }
      limit = n;
    }

    const rows = db.prepare(
      'SELECT id, name, price FROM products WHERE name LIKE ? ORDER BY id LIMIT ? OFFSET ?'
    ).all('%' + q + '%', limit, 0);

    return sendJson(res, 200, rows);
  }

  sendJson(res, 404, { error: 'Gak ketemu.' });
}

const server = createServer((req, res) => {
  route(req, res);
});

server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));