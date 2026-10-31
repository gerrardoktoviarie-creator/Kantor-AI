import { createServer } from 'node:http';

const notes = [
  { id: 1, title: 'Belanja bulanan' },
  { id: 2, title: 'Servis motor' },
];

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = createServer((req, res) => {
  if (req.url === '/') return sendJson(res, 200, { app: 'catatan' });
  if (req.url === '/api/notes') return sendJson(res, 200, notes);
  const match = req.url.match(/^\/api\/notes\/(\w+)$/);
  if (match) {
    const note = notes.find((n) => n.id === match[1]);
    return sendJson(res, 200, note ?? null);
  }
  sendJson(res, 404, { error: 'Gak ketemu.' });
});

server.listen(3000, () => console.log('Server jalan di port 3000'));
