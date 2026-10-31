import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { deliveries, send } from './lib/gateway.js';

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE jobs (
    id INTEGER PRIMARY KEY,
    "to" TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT
  );
`);

async function tick() {
  const jobs = db.prepare("SELECT * FROM jobs WHERE status = 'queued'").all();
  for (const job of jobs) {
    try {
      await send(job);
      db.prepare("UPDATE jobs SET status = 'sent' WHERE id = ?").run(job.id);
    } catch (err) {
      db.prepare('UPDATE jobs SET attempts = attempts + 1, error = ? WHERE id = ?').run(err.message, job.id);
    }
  }
}
setInterval(tick, 100);

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
    if (req.method === 'POST' && req.url === '/api/jobs') {
      const { to, text } = await readJson(req);
      if (!to || !text) return sendJson(res, 400, { error: 'to dan text wajib diisi.' });
      const { lastInsertRowid } = db.prepare('INSERT INTO jobs ("to", text) VALUES (?, ?)').run(to, text);
      return sendJson(res, 201, { id: Number(lastInsertRowid), status: 'queued' });
    }
    const match = req.url.match(/^\/api\/jobs\/(\d+)$/);
    if (match) {
      const job = db.prepare('SELECT id, "to", status, attempts, error FROM jobs WHERE id = ?').get(Number(match[1]));
      return job ? sendJson(res, 200, job) : sendJson(res, 404, { error: 'Job gak ketemu.' });
    }
    if (req.url === '/api/stats') {
      const rows = db.prepare('SELECT status, COUNT(*) AS n FROM jobs GROUP BY status').all();
      return sendJson(res, 200, rows);
    }
    // Debug endpoint: what the gateway actually delivered.
    if (req.url === '/api/deliveries') return sendJson(res, 200, deliveries.filter((d) => d.jobId));
    sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Server error.' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
