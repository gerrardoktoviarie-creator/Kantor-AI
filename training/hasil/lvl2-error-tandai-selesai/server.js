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

function isValidBody(body) {
  if (typeof body !== 'object' || Array.isArray(body)) return false;
  for (const key of Object.keys(body)) {
    if (key === 'title' && typeof body.title !== 'string') return false;
    if (key === 'done' && typeof body.done !== 'boolean') return false;
  }
  return true;
}

function validateUpdate(body, existing) {
  if ('title' in body) {
    if (body.title.trim() === '') return 'title tidak boleh kosong.';
  }
  if ('done' in body && typeof body.done !== 'boolean') return 'done harus boolean.';
  return null;
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/notes') {
      return sendJson(res, 200, listNotes());
    }

    const match = req.url.match(/^\/api\/notes\/(\d+)$/);
    if (match) {
      const id = Number(match[1]);
      const body = await readJson(req);

      if (req.method === 'PUT') {
        const note = updateNote(id, body);
        if (!note) {
          return sendJson(res, 404, { error: 'Catatan gak ketemu.' });
        }
        if (!isValidBody(body)) {
          return sendJson(res, 400, { error: 'Format permintaan tidak valid.' });
        }
        const validationError = validateUpdate(body, note);
        if (validationError) {
          return sendJson(res, 400, { error: validationError });
        }
        return sendJson(res, 200, note);
      }

      return sendJson(res, 404, { error: 'Gak ketemu.' });
    }

    return sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Server error.' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));