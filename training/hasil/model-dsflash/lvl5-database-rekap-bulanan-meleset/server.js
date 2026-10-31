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

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/report/monthly') {
      const year = url.searchParams.get('year');
      if (!year || !/^\d{4}$/.test(year)) {
        return sendJson(res, 400, { error: 'Tahun harus 4 digit.' });
      }

      const months = Array.from({ length: 12 }, (_, i) => {
        const month = String(i + 1).padStart(2, '0');
        return `${year}-${month}`;
      });

      const rows = db.prepare(`
        SELECT
          strftime('%Y-%m', datetime(paid_at, '+7 hours')) AS month,
          SUM(total) AS total,
          COUNT(*) AS orders
        FROM orders
        WHERE status = 'lunas'
          AND strftime('%Y', datetime(paid_at, '+7 hours')) = ?
        GROUP BY month
      `).all(year);

      const result = months.map(month => {
        const row = rows.find(r => r.month === month);
        return {
          month,
          total: row ? row.total : 0,
          orders: row ? row.orders : 0
        };
      });

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
