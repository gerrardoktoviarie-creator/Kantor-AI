// Kasir Kedai Kopi Senja.
//   GET  /api/products      daftar menu
//   POST /api/sales         { product_id, qty } -> catat penjualan
//   GET  /api/sales/today   penjualan hari ini (WIB) + total
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(ROOT, 'public');

const db = new DatabaseSync(process.env.DB_PATH || join(ROOT, 'data.db'));
db.exec(readFileSync(join(ROOT, 'db', 'schema.sql'), 'utf8'));

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return null;
  }
}

async function serveStatic(pathname, res) {
  const file = normalize(join(PUBLIC, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC + sep)) return sendJson(res, 404, { error: 'Gak ketemu.' });
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    sendJson(res, 404, { error: 'Gak ketemu.' });
  }
}

const routes = {
  'GET /api/products': (req, res) => {
    sendJson(res, 200, db.prepare('SELECT id, name, price FROM products ORDER BY name').all());
  },

  'POST /api/sales': async (req, res) => {
    const body = await readJson(req);
    if (!body) return sendJson(res, 400, { error: 'Body harus JSON.' });
    const { product_id: productId, qty } = body;
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return sendJson(res, 400, { error: 'Jumlah harus 1-99.' });
    const product = db.prepare('SELECT id, price FROM products WHERE id = ?').get(productId ?? 0);
    if (!product) return sendJson(res, 404, { error: 'Menu gak ketemu.' });
    const total = product.price * qty;
    const { lastInsertRowid } = db.prepare('INSERT INTO sales (product_id, qty, total) VALUES (?, ?, ?)').run(product.id, qty, total);
    sendJson(res, 201, { id: Number(lastInsertRowid), product_id: product.id, qty, total });
  },

  'GET /api/sales/today': (req, res) => {
    const sales = db.prepare(`SELECT s.id, s.product_id, p.name, s.qty, s.total, s.created_at
      FROM sales s JOIN products p ON p.id = s.product_id
      WHERE date(s.created_at, '+7 hours') = date('now', '+7 hours')
      ORDER BY s.id DESC`).all();
    sendJson(res, 200, { sales, total: sales.reduce((sum, s) => sum + s.total, 0) });
  },
};

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    const route = routes[`${req.method} ${pathname}`];
    if (route) return await route(req, res);
    if (req.method === 'GET' && !pathname.startsWith('/api/')) return await serveStatic(pathname, res);
    sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Server error.' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
