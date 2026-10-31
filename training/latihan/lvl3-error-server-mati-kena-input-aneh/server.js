import { createServer } from 'node:http';

const RATES = { USD: 16250, SGD: 12100, MYR: 3450 };

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw);
}

// Pretends to ask a rate service, like the real one does.
function convert(amount, currency) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const rate = RATES[currency];
      if (!rate) throw new Error(`Mata uang ${currency} gak dikenal`);
      resolve(Math.round(amount * rate));
    }, 30);
  });
}

const server = createServer(async (req, res) => {
  if (req.url === '/api/health') return sendJson(res, 200, { ok: true });
  if (req.method === 'POST' && req.url === '/api/convert') {
    const body = await readJson(req);
    const rupiah = await convert(body.amount, body.currency);
    return sendJson(res, 200, { rupiah });
  }
  sendJson(res, 404, { error: 'Gak ketemu.' });
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
