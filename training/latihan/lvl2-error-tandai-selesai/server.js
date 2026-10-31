import { createServer } from 'node:http';
import { listNotes, updateNote } from './lib/store.js';

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
    if (req.method === 'GET' && req.url === '/api/notes') return sendJson(res, 200, listNotes());

    const match = req.url.match(/^\/api\/notes\/(\d+)$/);
    if (match && req.method === 'PATCH') {
      const body = await readJson(req);
      const note = updateNote(match[1], body);
      if (!note) return sendJson(res, 404, { error: 'Catatan gak ketemu.' });
      return sendJson(res, 200, note);
    }

    sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Server error.' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
