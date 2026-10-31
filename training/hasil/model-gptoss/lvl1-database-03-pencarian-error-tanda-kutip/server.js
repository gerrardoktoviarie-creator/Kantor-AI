import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { URL } from 'node:url';

// ------------------------------------------------------------------
// Endpoint daftar:
// GET /api/products?q=...   — cari produk (case‑insensitive), q optional.
// ------------------------------------------------------------------

// Inisialisasi DB (in‑memory) dan seed data
const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL
  );
  INSERT INTO products (name, price) VALUES
    ('Roti Jum''at Berkah', 10000),
    ('Roti Sobek Cokelat', 15000),
    ('Donat Gula', 5000);
`);

// Helper kirim JSON
function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Server HTTP
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  try {
    // ----------------------------------------------------------------
    // GET /api/products
    // ----------------------------------------------------------------
    if (url.pathname === '/api/products' && req.method === 'GET') {
      const rawQ = url.searchParams.get('q') ?? '';
      // Validasi input: maksimal 100 karakter, tipe string
      if (typeof rawQ !== 'string' || rawQ.length > 100) {
        return sendJson(res, 400, { error: 'Parameter q terlalu panjang atau tidak valid.' });
      }

      // Siapkan pola LIKE yang aman
      const pattern = `%${rawQ.replace(/[%_]/g, '\\$&')}%`; // escape % & _
      const stmt = db.prepare(`
        SELECT id, name, price
        FROM products
        WHERE name LIKE ? ESCAPE '\\'
        ORDER BY id
      `);
      const rows = stmt.all(pattern);
      return sendJson(res, 200, rows);
    }

    // Route tidak dikenali
    return sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: 'Server error.' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));