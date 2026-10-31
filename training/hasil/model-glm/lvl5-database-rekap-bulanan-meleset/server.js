import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

// Kontrak API:
// GET /api/report/monthly?year=YYYY
//   Query: year (wajib, 4 digit angka)
//   Respons sukses (200): Array 12 objek { "month": "YYYY-MM", "total": number, "orders": number } urut Jan-Des
//   Respons error:
//     400 { "error": "..." } - year gak ada atau format salah
//     500 { "error": "Server error." } - kegagalan internal

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    total INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('lunas', 'batal')),
    paid_at TEXT NOT NULL -- UTC
  );
  INSERT INTO orders (id, total, status, paid_at) VALUES
    (1, 50000, 'lunas', '2025-01-15 03:00:00'),
    (2, 30000, 'lunas', '2026-01-10 05:00:00'),
    (3, 20000, 'lunas', '2026-01-31 18:30:00'),
    (4, 45000, 'lunas', '2026-02-14 02:00:00'),
    (5, 99000, 'batal', '2026-02-20 10:00:00'),
    (6, 15000, 'lunas', '2026-03-05 12:00:00'),
    (7, 25000, 'lunas', '2025-12-31 20:00:00'),
    (8, 40000, 'lunas', '2026-12-31 17:30:00');
`);

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const MAX_BODY = 1024 * 1024; // 1 MB

const server = createServer((req, res) => {
  const chunks = [];
  let size = 0;

  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY) {
      req.destroy();
      return sendJson(res, 413, { error: 'Body kegedean.' });
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    const url = new URL(req.url, 'http://localhost');

    try {
      if (req.method === 'GET' && url.pathname === '/api/report/monthly') {
        return handleMonthlyReport(req, res, url);
      }

      sendJson(res, 404, { error: 'Gak ketemu.' });
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: 'Server error.' });
    }
  });

  req.on('error', () => {
    sendJson(res, 500, { error: 'Server error.' });
  });
});

function handleMonthlyReport(req, res, url) {
  const yearParam = url.searchParams.get('year');

  if (!yearParam || !/^\d{4}$/.test(yearParam)) {
    return sendJson(res, 400, { error: 'Parameter year wajib diisi dengan 4 digit angka.' });
  }

  const year = Number(yearParam);

  // Bangun kerangka 12 bulan biar bulan tanpa transaksi tetap muncul
  const result = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    result.push({
      month: `${yearParam}-${mm}`,
      total: 0,
      orders: 0,
    });
  }

  // Geser paid_at (UTC) ke WIB (+7 jam) SEBELUM dikelompokkan.
  // Filter status != 'batal'. Pakai prepared statement buat year dan offset zona waktu.
  const stmt = db.prepare(`
    SELECT
      strftime('%m', datetime(paid_at, ?)) AS mm,
      SUM(total) AS total,
      COUNT(*) AS orders
    FROM orders
    WHERE status != 'batal'
      AND strftime('%Y', datetime(paid_at, ?)) = ?
    GROUP BY mm
  `);

  const rows = stmt.all('+7 hours', '+7 hours', yearParam);

  // Map hasil query ke kerangka 12 bulan
  const map = new Map();
  for (const row of rows) {
    map.set(row.mm, {
      total: row.total || 0,
      orders: row.orders || 0,
    });
  }

  for (const item of result) {
    const mm = item.month.slice(5); // ambil bagian "MM"
    if (map.has(mm)) {
      item.total = map.get(mm).total;
      item.orders = map.get(mm).orders;
    }
  }

  sendJson(res, 200, result);
}

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));