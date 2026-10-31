import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

// Kontrak API:
// GET /api/products?page=1&limit=10&q=kopi
//   Respons sukses (200): { "items": [...], "page": n, "limit": n, "total": n, "pages": n }
//   Error (400): { "error": "pesan" } - page/limit bukan bilangan bulat positif
//   Error (404): { "error": "Gak ketemu." } - endpoint lain
//   Error (500): { "error": "Terjadi kesalahan pada server." }

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

async function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 1_000_000) {
        req.destroy();
        reject(new Error('Body terlalu besar'));
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { reject(new Error('JSON tidak valid')); }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  try {
    if (req.method === 'GET' && url.pathname === '/api/products') {
      const rawPage = url.searchParams.get('page') ?? '1';
      const rawLimit = url.searchParams.get('limit') ?? '10';
      const q = url.searchParams.get('q') ?? '';

      const pageNum = Number(rawPage);
      const limitNum = Number(rawLimit);

      if (!Number.isInteger(pageNum) || pageNum < 1) {
        return sendJson(res, 400, { error: 'Parameter page harus bilangan bulat positif.' });
      }
      if (!Number.isInteger(limitNum) || limitNum < 1) {
        return sendJson(res, 400, { error: 'Parameter limit harus bilangan bulat positif.' });
      }

      const limit = Math.min(limitNum, 50);
      const page = pageNum;
      const offset = (page - 1) * limit;

      const likeParam = `%${q}%`;

      const countRow = db.prepare(
        `SELECT COUNT(*) as total FROM products WHERE name LIKE ?`
      ).get(likeParam);
      const total = countRow.total;
      const pages = Math.ceil(total / limit);

      const items = db.prepare(
        `SELECT id, name, price FROM products WHERE name LIKE ? ORDER BY price ASC LIMIT ? OFFSET ?`
      ).all(likeParam, limit, offset);

      return sendJson(res, 200, { items, page, limit, total, pages });
    }

    sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Terjadi kesalahan pada server.' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));