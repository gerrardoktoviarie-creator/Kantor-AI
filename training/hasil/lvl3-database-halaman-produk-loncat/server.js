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

// Kontrak API
// GET /api/products?page=1&limit=3&q=kopi
//   page  (optional) -> int >= 1, default 1
//   limit (optional) -> int >= 1, default 10, max 50 (dilimit)
//   q     (optional) -> string, cari nama produk (case-insensitive)
//   respons sukses: { items: [{id,name,price}], page, limit, total, pages }
//   error:   { error: "pesan" } -> 400 (input salah), 404 (path gak ada)

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const MAX_LIMIT = 50;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

function parseIntStrict(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || Number.isNaN(parsed)) return null;
  return parsed;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname !== '/api/products') {
    return sendJson(res, 404, { error: 'Gak ketemu.' });
  }

  const page = parseIntStrict(url.searchParams.get('page'), DEFAULT_PAGE);
  let limit = parseIntStrict(url.searchParams.get('limit'), DEFAULT_LIMIT);

  if (page === null) {
    return sendJson(res, 400, { error: 'page harus bilangan bulat positif.' });
  }
  if (limit === null) {
    return sendJson(res, 400, { error: 'limit harus bilangan bulat positif.' });
  }
  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  const q = url.searchParams.get('q') ?? '';
  const likePattern = '%' + q.replace(/%/g, '\\%').replace(/_/g, '\\_') + '%';

  // Hitung total dulu dengan filter yang sama persis (COUNT(*) terparameterisasi)
  const totalCount = db.prepare(
    `SELECT COUNT(*) AS total FROM products WHERE name LIKE ?`
  ).get(likePattern).total;

  const totalPages = Math.max(0, Math.ceil(totalCount / limit));
  const offset = (page - 1) * limit;

  const items = db.prepare(
    `SELECT id, name, price FROM products WHERE name LIKE ? ORDER BY price ASC LIMIT ? OFFSET ?`
  ).all(likePattern, limit, offset);

  sendJson(res, 200, { items, page, limit, total: totalCount, pages: totalPages });
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));