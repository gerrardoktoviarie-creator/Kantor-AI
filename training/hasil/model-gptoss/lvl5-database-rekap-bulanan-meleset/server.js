import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

/* -------------------------------------------------------------
   ENDPOINTS
   GET /api/report/monthly?year=YYYY
   Query:
     - year (string, 4‑digit, required)
   Success 200: [
     { "month": "YYYY-01", "total": 0, "orders": 0 },
     ...,
     { "month": "YYYY-12", "total": 0, "orders": 0 }
   ]
   Errors:
     400 { "error": "year harus 4 digit, contoh: 2026" }
     500 { "error": "Server error." }
   ------------------------------------------------------------- */

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

/* Helper: validate year query param */
function validateYear(year) {
  return typeof year === 'string' && /^\d{4}$/.test(year);
}

/* Generate array of month strings for a given year: YYYY-01 … YYYY-12 */
function monthList(year) {
  const list = [];
  for (let i = 1; i <= 12; i++) {
    const mm = i.toString().padStart(2, '0');
    list.push(`${year}-${mm}`);
  }
  return list;
}

/* Main server */
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  try {
    if (req.method === 'GET' && url.pathname === '/api/report/monthly') {
      const year = url.searchParams.get('year');

      if (!validateYear(year)) {
        return sendJson(res, 400, { error: 'year harus 4 digit, contoh: 2026' });
      }

      // Aggregasi per bulan (WIB) untuk tahun yang diminta, eksklusi status 'batal'
      const stmt = db.prepare(`
        SELECT
          strftime('%m', datetime(paid_at, '+7 hours')) AS month,
          SUM(total) AS total,
          COUNT(*) AS orders
        FROM orders
        WHERE status <> 'batal'
          AND strftime('%Y', datetime(paid_at, '+7 hours')) = ?
        GROUP BY month
        ORDER BY month
      `);
      const rows = stmt.all(year);

      // Convert result set to a map for easy lookup
      const map = new Map();
      for (const r of rows) {
        const monthKey = `${year}-${r.month}`;
        map.set(monthKey, {
          month: monthKey,
          total: r.total ?? 0,
          orders: r.orders ?? 0,
        });
      }

      // Build final array with all 12 months
      const result = monthList(year).map((m) => {
        if (map.has(m)) return map.get(m);
        return { month: m, total: 0, orders: 0 };
      });

      return sendJson(res, 200, result);
    }

    // Not found
    return sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: 'Server error.' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));