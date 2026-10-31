/*
Endpoint:
GET /api/products?page=1&limit=3&q=kopi
Input:
  - page: integer >= 1, default 1
  - limit: integer >=1, <=50, default 10
  - q: optional, cari pada nama produk (case-insensitive, LIKE)
Respon:
{
  "items": [ { id, name, price }, ... ],
  "page": n,
  "limit": n,
  "total": jumlah produk cocok filter,
  "pages": jumlah halaman
}
*/

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

function parsePosInt(val, def) {
  if (val === undefined || val === null) return def;
  if (!/^\d+$/.test(val)) return null;
  const n = Number(val);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return n;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/products') {
      // Ambil & validasi query
      let pageRaw = url.searchParams.get('page');
      let limitRaw = url.searchParams.get('limit');
      const qRaw = url.searchParams.get('q');
      const page = parsePosInt(pageRaw, 1);
      let limit = parsePosInt(limitRaw, 10);
      if (page == null || limit == null) {
        return sendJson(res, 400, { error: 'page dan limit harus bilangan bulat positif.' });
      }
      if (limit > 50) limit = 50;
      const q = typeof qRaw === 'string' ? qRaw : '';
      // Filtering LIKE case-insensitive
      const filterSql = `name LIKE ? COLLATE NOCASE`;
      const filterVal = `%${q}%`;

      // Total dulu agar pagination bener
      const total = db.prepare(`SELECT COUNT(*) as c FROM products WHERE ${filterSql}`).get(filterVal).c;
      const pages = total === 0 ? 1 : Math.ceil(total/limit);

      // Halaman lewat dari akhir -> kosong
      if (page > pages) {
        return sendJson(res, 200, { items: [], page, limit, total, pages });
      }
      // Pagination benar: OFFSET = (page-1)*limit
      const items = db.prepare(
        `SELECT id, name, price FROM products WHERE ${filterSql}
         ORDER BY price ASC
         LIMIT ? OFFSET ?`
      ).all(filterVal, limit, (page - 1) * limit);

      return sendJson(res, 200, { items, page, limit, total, pages });
    }
    sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Server error.' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));