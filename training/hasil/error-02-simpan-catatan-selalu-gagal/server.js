import { createServer } from 'node:http';

const notes = [{ id: 1, title: 'Belanja bulanan' }];

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
    if (req.method === 'GET' && req.url === '/api/notes') return sendJson(res, 200, notes);
    if (req.method === 'POST' && req.url === '/api/notes') {
      const body = await readJson(req);
      if (!body.title) return sendJson(res, 400, { error: 'Judul wajib diisi.' });
      const note = { id: notes.length + 1, title: String(body.title) };
      notes.push(note);
      return sendJson(res, 201, note);
    }
    sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Server error.' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));