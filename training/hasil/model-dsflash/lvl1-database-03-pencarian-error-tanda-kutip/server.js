import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.PORT) || 3000;

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price INTEGER NOT NULL);
  INSERT INTO products (name, price) VALUES
    ('Roti Jum''at Berkah', 10000),
    ('Roti Sobek Cokelat', 15000),
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
      const q = url.searchParams.get('q');
      const params = q === null || q === '' ? {} : { q: `%${q}%` };
      const rows = db.prepare('SELECT id, name, price FROM products WHERE name LIKE :q ORDER BY id').all(params);
      return sendJson(res, 200, rows);
    }
    sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Server error.' });
  }
});

server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));