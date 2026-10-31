import { createServer } from 'node:http';
import { quote } from './lib/pricing.js';

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
    if (req.method === 'POST' && req.url === '/api/checkout') {
      const body = await readJson(req);
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return sendJson(res, 400, { error: 'Keranjang kosong (items wajib array minimal 1).' });
      }
      return sendJson(res, 200, quote(body.items, body.code));
    }
    sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    console.error(err);
    sendJson(res, 400, { error: err.message });
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));