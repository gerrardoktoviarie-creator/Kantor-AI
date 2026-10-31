import { createServer } from 'node:http';

const notes = [{ id: 1, title: 'Belanja bulanan' }];

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = createServer((req, res) => {
  if (req.url === '/api/health') return sendJson(res, 200, { ok: true });
  if (req.url === '/api/notes') return sendJson(res, 200, notes);
  sendJson(res, 404, { error: 'Gak ketemu.' });
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
