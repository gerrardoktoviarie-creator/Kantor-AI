import { createServer } from 'node:http';

const notes = [
  { id: 1, title: 'Belanja bulanan' },
  { id: 2, title: 'Servis motor' },
];

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const PORT = process.env.PORT || 3000;

const server = createServer((req, res) => {
  if (req.url === '/') return sendJson(res, 200, { app: 'catatan' });
  if (req.url === '/api/notes') return sendJson(res, 200, notes);
  const match = req.url.match(/^\/api\/notes\/(\d+)$/);
  if (match) {
    const note = notes.find((n) => n.id === Number(match[1]));
    if (!note) return sendJson(res, 404, { error: 'Catatan tidak ditemukan.' });
    return sendJson(res, 200, note);
  }
  sendJson(res, 404, { error: 'Gak ketemu.' });
});

server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));