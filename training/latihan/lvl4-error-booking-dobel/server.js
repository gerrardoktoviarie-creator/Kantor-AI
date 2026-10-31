import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE bookings (
    id INTEGER PRIMARY KEY,
    court INTEGER NOT NULL,
    slot TEXT NOT NULL,
    name TEXT NOT NULL
  );
`);

// Talks to the payment gateway. Slow on purpose, like the real one.
function verifyPayment(name) {
  return new Promise((resolve) => setTimeout(() => resolve(name !== 'Gagal Bayar'), 150));
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/bookings') {
      return sendJson(res, 200, db.prepare('SELECT * FROM bookings ORDER BY id').all());
    }
    if (req.method === 'POST' && req.url === '/api/bookings') {
      const { court, slot, name } = await readJson(req);
      if (!court || !slot || !name) return sendJson(res, 400, { error: 'court, slot, dan name wajib diisi.' });

      const taken = db.prepare('SELECT 1 FROM bookings WHERE court = ? AND slot = ?').get(court, slot);
      if (taken) return sendJson(res, 409, { error: 'Jadwal itu udah dipesan.' });

      const paid = await verifyPayment(name);
      if (!paid) return sendJson(res, 402, { error: 'Pembayaran gagal.' });

      const { lastInsertRowid } = db.prepare('INSERT INTO bookings (court, slot, name) VALUES (?, ?, ?)').run(court, slot, name);
      return sendJson(res, 201, { id: Number(lastInsertRowid), court, slot, name });
    }
    sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Server error.' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
