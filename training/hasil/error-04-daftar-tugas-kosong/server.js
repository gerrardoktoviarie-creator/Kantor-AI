import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const todos = [
  { id: 1, title: 'Kerjain PR matematika', done: false },
  { id: 2, title: 'Upload tugas RPL', done: true },
];

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };

const server = createServer(async (req, res) => {
  if (req.url === '/api/todos') return sendJson(res, 200, todos);
  const file = req.url === '/' ? '/index.html' : req.url;
  if (file === '/index.html' || file === '/app.js') {
    const body = await readFile(new URL(`./public${file}`, import.meta.url));
    res.writeHead(200, { 'Content-Type': TYPES[file.slice(file.lastIndexOf('.'))] });
    return res.end(body);
  }
  sendJson(res, 404, { error: 'Gak ketemu.' });
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));