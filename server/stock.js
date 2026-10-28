import { db, getSetting, parseJson, setSetting } from './db.js';
import { enqueue, enabledDivisions, personaPrompt, registerHandler } from './agents.js';
import { chat } from './llm.js';
import { notify } from './telegram.js';
import { HttpError, readJson, requireText, sendJson, toId } from './http.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'pcs',
    stock REAL NOT NULL DEFAULT 0,
    min_stock REAL NOT NULL DEFAULT 0,
    price INTEGER,
    low_alerted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stock_moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    qty REAL NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stock_recaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week TEXT NOT NULL,
    data TEXT NOT NULL,
    text TEXT,
    state TEXT NOT NULL DEFAULT 'writing',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Restock aims for this many days of sales on top of the minimum.
const COVER_DAYS = 14;
const RECAP_HOUR = 8;
const TICK_MS = 30 * 60 * 1000;

const DAY_MS = 86_400_000;
const sqlTime = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);

/**
 * How much to order so the product lasts COVER_DAYS past its minimum, from the
 * average daily outflow over the last 30 days. Pure, so it can be tested directly.
 */
export function restockSuggestion({ stock, minStock, soldLast30, daysTracked }) {
  // A product tracked for only a day or two would look like it sells its whole week in a day;
  // averaging over at least a week keeps fresh entries from asking for absurd orders.
  const days = Math.max(7, Math.min(30, daysTracked));
  const perDay = soldLast30 / days;
  const target = minStock + perDay * COVER_DAYS;
  return { perDay, order: Math.max(0, Math.ceil(target - stock)) };
}

function outflow(productId, sinceMs) {
  return -(db.prepare('SELECT COALESCE(SUM(qty), 0) AS n FROM stock_moves WHERE product_id = ? AND qty < 0 AND at >= ?')
    .get(productId, sqlTime(sinceMs)).n);
}

function suggestionFor(row, now = Date.now()) {
  const first = db.prepare('SELECT MIN(at) AS at FROM stock_moves WHERE product_id = ?').get(row.id).at;
  const daysTracked = first ? (now - new Date(`${first.replace(' ', 'T')}Z`).getTime()) / DAY_MS : 1;
  return restockSuggestion({ stock: row.stock, minStock: row.min_stock, soldLast30: outflow(row.id, now - 30 * DAY_MS), daysTracked });
}

function toProduct(row) {
  const suggestion = suggestionFor(row);
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    stock: row.stock,
    minStock: row.min_stock,
    price: row.price,
    low: row.stock <= row.min_stock,
    soldWeek: outflow(row.id, Date.now() - 7 * DAY_MS),
    perDay: suggestion.perDay,
    order: suggestion.order,
  };
}

function loadProduct(id) {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, 'Barang gak ketemu.');
  return row;
}

const amount = (n) => Number(n.toFixed(2)).toLocaleString('id-ID');

// Stock changes go through here so the low-stock alert fires once per dip below the minimum.
export function recordMove(productId, qty, note = '') {
  const row = loadProduct(productId);
  const stock = row.stock + qty;
  if (stock < 0) throw new HttpError(400, `Stok ${row.name} tinggal ${amount(row.stock)} ${row.unit}, gak bisa keluar ${amount(-qty)}.`);
  db.prepare('INSERT INTO stock_moves (product_id, qty, note) VALUES (?, ?, ?)').run(productId, qty, note);

  const low = stock <= row.min_stock;
  db.prepare('UPDATE products SET stock = ?, low_alerted = ? WHERE id = ?').run(stock, low ? 1 : 0, productId);
  if (low && !row.low_alerted && enabledDivisions().some((d) => d.id === 'admin')) {
    enqueue('dewi', 'stock.low', `Cek stok tipis: ${row.name}`, { productId });
  }
  return loadProduct(productId);
}

registerHandler('stock.low', async (task) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(task.payload.productId);
  if (!row || row.stock > row.min_stock) return {};
  const { perDay, order } = suggestionFor(row);
  const pace = perDay > 0 ? `Rata-rata keluar ${amount(perDay)} ${row.unit}/hari.` : 'Belum ada catatan barang keluar.';
  const text = `📦 Dewi: stok ${row.name} tinggal ${amount(row.stock)} ${row.unit} (minimum ${amount(row.min_stock)}).\n${pace}\n`
    + (order > 0 ? `Saran restok: ${amount(order)} ${row.unit}, cukup buat sekitar ${COVER_DAYS} hari.` : 'Belum perlu restok banyak.');
  // A missing Telegram connection shouldn't fail the task; the office still shows it.
  await notify(text).catch(() => false);
  return { review: `Stok ${row.name} tipis, saran restok ${amount(order)} ${row.unit}` };
});

export function weeklyData(now = Date.now()) {
  const products = db.prepare('SELECT * FROM products ORDER BY name').all();
  const rows = products.map((p) => ({
    name: p.name,
    unit: p.unit,
    stock: p.stock,
    minStock: p.min_stock,
    sold: outflow(p.id, now - 7 * DAY_MS),
    soldTwoWeeks: outflow(p.id, now - 14 * DAY_MS),
    revenue: p.price ? outflow(p.id, now - 7 * DAY_MS) * p.price : null,
  }));
  return {
    top: rows.filter((r) => r.sold > 0).sort((a, b) => b.sold - a.sold).slice(0, 5),
    slow: rows.filter((r) => r.stock > 0 && r.soldTwoWeeks === 0),
    low: rows.filter((r) => r.stock <= r.minStock),
    revenue: rows.reduce((sum, r) => sum + (r.revenue ?? 0), 0),
    products: rows.length,
  };
}

registerHandler('stock.weekly', async (task) => {
  const recap = db.prepare('SELECT * FROM stock_recaps WHERE id = ?').get(task.payload.recapId);
  if (!recap) throw new Error('Rekapnya udah dihapus.');
  const data = parseJson(recap.data);
  const line = (r) => `- ${r.name}: keluar ${amount(r.sold)} ${r.unit} minggu ini, sisa ${amount(r.stock)}`;
  const text = await chat({
    agentId: 'rudi',
    system: personaPrompt('rudi'),
    maxTokens: 900,
    prompt: `Bikin rekap stok mingguan buat bos, maks 8 kalimat, tanpa markdown heading. Angka di bawah sudah pasti.
Jumlah barang: ${data.products}. Perkiraan omzet dari barang keluar: Rp${Math.round(data.revenue).toLocaleString('id-ID')}.
Paling laku:
${data.top.map(line).join('\n') || '- belum ada barang keluar'}
Numpuk (gak keluar 2 minggu):
${data.slow.map(line).join('\n') || '- gak ada'}
Stok tipis:
${data.low.map(line).join('\n') || '- gak ada'}
Kasih 2-3 saran konkret (restok apa, promo apa buat yang numpuk).`,
  });
  db.prepare("UPDATE stock_recaps SET text = ?, state = 'done' WHERE id = ?").run(text, recap.id);
  await notify(`🗂️ Rudi: rekap stok minggu ini\n\n${text}`).catch(() => false);
  return { result: { recapId: recap.id }, review: 'Rekap stok mingguan udah jadi' };
});

function startRecap(week) {
  const { lastInsertRowid } = db.prepare('INSERT INTO stock_recaps (week, data) VALUES (?, ?)').run(week, JSON.stringify(weeklyData()));
  const id = Number(lastInsertRowid);
  enqueue('rudi', 'stock.weekly', `Rekap stok minggu ${week}`, { recapId: id });
  return id;
}

// ISO-ish week label in local time: the Monday's date.
function weekOf(date) {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday.toLocaleDateString('sv-SE');
}

export function startStockRecaps() {
  const tick = () => {
    const now = new Date();
    if (!enabledDivisions().some((d) => d.id === 'admin')) return;
    if (now.getDay() !== 1 || now.getHours() < RECAP_HOUR) return;
    const week = weekOf(now);
    if (getSetting('stockRecapWeek') === week) return;
    setSetting('stockRecapWeek', week);
    if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n) startRecap(week);
  };
  setTimeout(tick, 20_000);
  setInterval(tick, TICK_MS).unref();
}

function productFields(body) {
  const number = (value, label) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${label} harus angka 0 atau lebih.`);
    return n;
  };
  return {
    name: requireText(body.name, 'Nama barang', 120),
    unit: typeof body.unit === 'string' && body.unit.trim() ? body.unit.trim().slice(0, 20) : 'pcs',
    minStock: number(body.minStock ?? 0, 'Stok minimum'),
    price: body.price === '' || body.price == null ? null : Math.round(number(body.price, 'Harga')),
  };
}

export function registerStockRoutes(router) {
  router.get('/api/stock', (req, res) => {
    const products = db.prepare('SELECT * FROM products ORDER BY name').all().map(toProduct);
    const moves = db.prepare(`SELECT stock_moves.*, products.name, products.unit FROM stock_moves
      JOIN products ON products.id = stock_moves.product_id ORDER BY stock_moves.id DESC LIMIT 15`).all()
      .map((m) => ({ id: m.id, productId: m.product_id, name: m.name, unit: m.unit, qty: m.qty, note: m.note, at: m.at }));
    sendJson(res, 200, { products, moves });
  });

  router.post('/api/stock/products', async (req, res) => {
    const body = await readJson(req);
    const fields = productFields(body);
    const { lastInsertRowid } = db.prepare('INSERT INTO products (name, unit, min_stock, price) VALUES (?, ?, ?, ?)')
      .run(fields.name, fields.unit, fields.minStock, fields.price);
    const id = Number(lastInsertRowid);
    const opening = Number(body.stock);
    if (Number.isFinite(opening) && opening > 0) recordMove(id, opening, 'Stok awal');
    sendJson(res, 201, toProduct(loadProduct(id)));
  });

  router.put('/api/stock/products/:id', async (req, res, { id }) => {
    const productId = toId(id);
    loadProduct(productId);
    const fields = productFields(await readJson(req));
    db.prepare('UPDATE products SET name = ?, unit = ?, min_stock = ?, price = ? WHERE id = ?')
      .run(fields.name, fields.unit, fields.minStock, fields.price, productId);
    sendJson(res, 200, toProduct(loadProduct(productId)));
  });

  router.delete('/api/stock/products/:id', (req, res, { id }) => {
    db.prepare('DELETE FROM products WHERE id = ?').run(toId(id));
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/stock/products/:id/moves', async (req, res, { id }) => {
    const body = await readJson(req);
    const qty = Number(body.qty);
    if (!Number.isFinite(qty) || qty === 0) throw new HttpError(400, 'Jumlah harus angka dan gak boleh 0.');
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : '';
    sendJson(res, 200, toProduct(recordMove(toId(id), qty, note)));
  });

  router.get('/api/stock/recaps', (req, res) => {
    const rows = db.prepare('SELECT * FROM stock_recaps ORDER BY id DESC LIMIT 8').all();
    sendJson(res, 200, rows.map((r) => ({ id: r.id, week: r.week, text: r.text, state: r.state, createdAt: r.created_at })));
  });

  router.post('/api/stock/recaps', (req, res) => {
    if (!db.prepare('SELECT COUNT(*) AS n FROM products').get().n) throw new HttpError(409, 'Tambah barang dulu sebelum bikin rekap.');
    sendJson(res, 201, { id: startRecap(weekOf(new Date())) });
  });
}
