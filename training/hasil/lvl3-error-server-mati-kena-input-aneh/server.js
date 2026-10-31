import { createServer } from 'node:http';

const RATES = { usd: 16250, sgd: 12100, myr: 3450 };

const ALLOWED_CURRENCIES = Object.keys(RATES);

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw);
}

function convert(amount, currency) {
  const rate = RATES[currency];
  if (!rate) throw new Error(`Mata uang ${currency} gak dikenal`);
  return Math.round(amount * rate);
}

function normalizeBody(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Bad request: body harus JSON objek');
  }
  if (Object.keys(body).length === 0) {
    throw new Error('Bad request: body tidak boleh kosong');
  }
  if (typeof body.amount !== 'number' || body.amount <= 0 || !Number.isFinite(body.amount)) {
    throw new Error('Bad request: amount harus angka positif');
  }
  if (typeof body.currency !== 'string') {
    throw new Error('Bad request: currency harus string');
  }
  const normalized = body.currency.toLowerCase();
  if (!ALLOWED_CURRENCIES.includes(normalized)) {
    throw new Error(`Bad request: ${body.currency} tidak didukung (USD, SGD, MYR)`);
  }
  return { amount: Number(body.amount), currency: normalized };
}

const server = createServer(async (req, res) => {
  try {
    if (req.url === '/api/health') {
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'POST' && req.url === '/api/convert') {
      let body;
      try {
        body = await readJson(req);
      } catch {
        return sendJson(res, 400, { error: 'Bad request: body bukan JSON valid' });
      }
      const { amount, currency } = normalizeBody(body);
      const rupiah = convert(amount, currency);
      return sendJson(res, 200, { rupiah });
    }
    sendJson(res, 404, { error: 'Gak ketemu.' });
  } catch (err) {
    return sendJson(res, 400, { error: String(err.message) });
  }
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));