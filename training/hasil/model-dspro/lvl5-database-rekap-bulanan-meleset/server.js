import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

// Kontrak API:
// GET /api/report/monthly?year=YYYY
//   Query: year (wajib, 4 digit angka)
//   Sukses (200): [{ "month": "YYYY-MM", "total": number, "orders": number }, ...] (12 bulan urut Jan-Des)
//   Error (400): { "error": "pesan" } jika year gak ada atau format salah
//   Error (500): { "error": "Terjadi kesalahan server." }

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
    if (req.method === 'GET' && url.pathname === '/api/report/monthly') {
      const yearParam = url.searchParams.get('year');

      if (!yearParam || !/^\d{4}$/.test(yearParam)) {
        return sendJson(res, 400, { error: 'Parameter year wajib diisi dengan 4 digit angka.' });
      }

      const year = Number(yearParam);

      // Geser paid_at ke WIB dulu (agar jam UTC + 7 jam masuk zona bisnis), lalu ambil
      // tahun dan bulan berdasarkan waktu WIB itu. Filter status batal, dan ambil semua
      // baris (termasuk bulan kosong) agar bisa dipetakan ke kalender 12 bulan.
      const rows = db.prepare(`
        SELECT
          strftime('%Y', datetime(paid_at, '+7 hours')) AS y,
          strftime('%m', datetime(paid_at, '+7 hours')) AS m,
          total
        FROM orders
        WHERE status != 'batal'
      `).all();

      const totals = new Map();
      const counts = new Map();
      for (const r of rows) {
        if (String(r.y) !== String(year)) continue;
        const key = `${year}-${r.m}`;
        totals.set(key, (totals.get(key) || 0) + r.total);
        counts.set(key, (counts.get(key) || 0) + 1);
      }

      const result = [];
      for (let i = 1; i <= 12; i++) {
        const mm = String(i).padStart(2, '0');
        const key = `${year}-${mm}`;
        result.push({
          month: key,
          total: totals.get(key) ?? 0,
          orders: counts.get(key) ?? 0
        });
      }

      return sendJson(res, 200, result);
    }

    sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Terjadi kesalahan server.' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));