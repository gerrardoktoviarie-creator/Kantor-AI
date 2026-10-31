import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

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

// Helper validasi year (wajib 4 digit angka)
function parseYear(val) {
  if (typeof val !== 'string' || !/^\d{4}$/.test(val)) return null;
  const y = Number(val);
  if (y < 1000 || y > 9999) return null;
  return y;
}

// Bulan 01 ... 12 -> array: { month: YYYY-MM, total: 0, orders: 0 }
function buildEmptyMonths(year) {
  const arr = [];
  for (let m = 1; m <= 12; ++m) {
    const mm = m.toString().padStart(2, '0');
    arr.push({ month: `${year}-${mm}`, total: 0, orders: 0 });
  }
  return arr;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/report/monthly' && req.method === 'GET') {
      const yearStr = url.searchParams.get('year');
      const year = parseYear(yearStr);
      if (!year) {
        return sendJson(res, 400, { error: 'Param year wajib 4 digit, misal 2026.' });
      }
      // Bulan dihitung dari paid_at UTC yang digeser +7 jam (WIB)
      // Ambil agregat per bulan (berdasar WIB), hanya status 'lunas', hanya tahun yg diminta
      const rows = db.prepare(`
        SELECT
          strftime('%Y-%m', datetime(paid_at, '+7 hours')) AS ym,
          SUM(total) AS total,
          COUNT(*) AS orders
        FROM orders
        WHERE status = 'lunas'
          AND strftime('%Y', datetime(paid_at, '+7 hours')) = ?
        GROUP BY ym
        ORDER BY ym
      `).all(String(year));

      // Susun array 12 bulan, isi hasil dari row (kalau ada)
      const result = buildEmptyMonths(year);
      const byMonth = {};
      for (const row of rows) {
        // jumlah bisa null kalau nggak ada order
        byMonth[row.ym] = {
          total: row.total ? Number(row.total) : 0,
          orders: row.orders ? Number(row.orders) : 0
        };
      }
      for (let i = 0; i < result.length; ++i) {
        const m = result[i].month;
        if (byMonth[m]) {
          result[i].total = byMonth[m].total;
          result[i].orders = byMonth[m].orders;
        }
      }
      return sendJson(res, 200, result);
    }
    sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Server error.' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
