import { db, parseJson } from './db.js';
import { enqueue, personaPrompt, registerHandler } from './agents.js';
import { chatJson } from './llm.js';
import { HttpError, readJson, requireText, sendJson, toId } from './http.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS ad_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    summary TEXT NOT NULL,
    analysis TEXT,
    state TEXT NOT NULL DEFAULT 'analyzing',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audience_ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product TEXT NOT NULL,
    goal TEXT NOT NULL,
    budget INTEGER,
    result TEXT,
    state TEXT NOT NULL DEFAULT 'thinking',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Header names seen in Meta Ads Manager and TikTok Ads exports, English and Indonesian.
// The first matching column wins, so more specific names come first.
const COLUMNS = {
  name: ['ad name', 'nama iklan', 'ad set name', 'nama set iklan', 'campaign name', 'nama kampanye', 'iklan'],
  spend: ['amount spent', 'jumlah yang dibelanjakan', 'jumlah dibelanjakan', 'total cost', 'cost', 'biaya', 'spend'],
  impressions: ['impressions', 'impresi', 'tayangan'],
  clicks: ['link clicks', 'klik tautan', 'clicks (all)', 'klik (semua)', 'clicks', 'klik'],
  results: ['results', 'hasil', 'conversions', 'konversi', 'purchases', 'pembelian'],
  reach: ['reach', 'jangkauan'],
};

export function parseCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.slice(0, clean.indexOf('\n') + 1 || undefined);
  // Excel in Indonesian locale saves CSV with semicolons.
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

// "1.234.567", "1,234.56", "Rp 12.500,50" and "3,2%" all turn into plain numbers.
export function parseNumber(raw) {
  if (raw == null) return 0;
  let s = String(raw).replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? '.' : ',';
    s = s.split(decimal === '.' ? ',' : '.').join('').replace(decimal, '.');
  } else if (lastComma >= 0) {
    // A lone comma followed by 1-2 digits is a decimal comma; otherwise thousands.
    s = /,\d{1,2}$/.test(s) && s.split(',').length === 2 ? s.replace(',', '.') : s.split(',').join('');
  } else if (lastDot >= 0 && s.split('.').length > 2) {
    s = s.split('.').join('');
  } else if (lastDot >= 0 && /\.\d{3}$/.test(s) && !/^0\./.test(s)) {
    s = s.replace('.', '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function findColumn(headers, names) {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const exact = lower.findIndex((h) => h === name || h.startsWith(`${name} (`));
    if (exact >= 0) return exact;
  }
  for (const name of names) {
    const loose = lower.findIndex((h) => h.includes(name));
    if (loose >= 0) return loose;
  }
  return -1;
}

const ratio = (a, b) => (b > 0 ? a / b : null);

// Turns an ads export into per-ad numbers and totals. Throws with a readable message
// when the file doesn't look like an ads export at all.
export function summarizeAds(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new HttpError(400, 'File CSV-nya kosong atau cuma ada judul kolom.');
  const headers = rows[0];
  const col = Object.fromEntries(Object.entries(COLUMNS).map(([key, names]) => [key, findColumn(headers, names)]));
  if (col.spend < 0 || col.impressions < 0) {
    throw new HttpError(400, 'Kolom biaya atau impresi gak ketemu. Ekspor ulang dari Ads Manager dengan kolom "Amount spent" dan "Impressions".');
  }

  const ads = [];
  for (const cells of rows.slice(1)) {
    const name = (cells[col.name] ?? '').trim();
    // Ads Manager adds a totals row with an empty name at the bottom; skip it.
    if (!name || /^(total|jumlah)/i.test(name)) continue;
    const ad = {
      name,
      spend: parseNumber(cells[col.spend]),
      impressions: parseNumber(cells[col.impressions]),
      clicks: col.clicks >= 0 ? parseNumber(cells[col.clicks]) : 0,
      results: col.results >= 0 ? parseNumber(cells[col.results]) : 0,
      reach: col.reach >= 0 ? parseNumber(cells[col.reach]) : 0,
    };
    if (!ad.spend && !ad.impressions) continue;
    ads.push({
      ...ad,
      ctr: ratio(ad.clicks, ad.impressions),
      cpc: ratio(ad.spend, ad.clicks),
      cpr: ratio(ad.spend, ad.results),
    });
  }
  if (!ads.length) throw new HttpError(400, 'Gak ada baris iklan yang punya biaya atau impresi.');

  const sum = (key) => ads.reduce((total, ad) => total + ad[key], 0);
  const totals = {
    ads: ads.length,
    spend: sum('spend'),
    impressions: sum('impressions'),
    clicks: sum('clicks'),
    results: sum('results'),
  };
  totals.ctr = ratio(totals.clicks, totals.impressions);
  totals.cpc = ratio(totals.spend, totals.clicks);
  totals.cpr = ratio(totals.spend, totals.results);

  // Best and worst by cost per result when results exist, otherwise by CTR.
  const byResults = totals.results > 0;
  const score = (ad) => (byResults ? ad.cpr ?? Infinity : -(ad.ctr ?? 0));
  const ranked = [...ads].sort((a, b) => score(a) - score(b));
  return {
    totals,
    rankedBy: byResults ? 'cpr' : 'ctr',
    best: ranked.slice(0, 3),
    worst: ranked.slice(-3).reverse().filter((ad) => !ranked.slice(0, 3).includes(ad)),
    ads: ranked,
  };
}

const rupiah = (n) => (n == null ? '-' : `Rp${Math.round(n).toLocaleString('id-ID')}`);
const percent = (n) => (n == null ? '-' : `${(n * 100).toFixed(2)}%`);

function adLine(ad) {
  return `- ${ad.name}: biaya ${rupiah(ad.spend)}, impresi ${ad.impressions}, klik ${ad.clicks}, CTR ${percent(ad.ctr)}, CPC ${rupiah(ad.cpc)}, hasil ${ad.results}, biaya/hasil ${rupiah(ad.cpr)}`;
}

registerHandler('ads.report', async (task) => {
  const row = db.prepare('SELECT * FROM ad_reports WHERE id = ?').get(task.payload.reportId);
  if (!row) throw new Error('Laporan iklannya udah dihapus.');
  const summary = parseJson(row.summary);
  const { totals } = summary;

  const analysis = await chatJson({
    agentId: 'raka',
    system: personaPrompt('raka'),
    prompt: `Ini data iklan "${row.name}" yang sudah dihitung (angka sudah pasti, jangan dihitung ulang).
Total: ${totals.ads} iklan, biaya ${rupiah(totals.spend)}, impresi ${totals.impressions}, klik ${totals.clicks}, CTR ${percent(totals.ctr)}, CPC ${rupiah(totals.cpc)}, hasil ${totals.results}, biaya/hasil ${rupiah(totals.cpr)}.
Diurutkan dari yang paling efisien (${summary.rankedBy === 'cpr' ? 'biaya per hasil' : 'CTR'}):
${summary.ads.slice(0, 15).map(adLine).join('\n')}

Tulis analisis buat pemilik bisnis. Jawab HANYA JSON:
{
  "ringkasan": "2-3 kalimat kondisi iklan secara umum",
  "bagus": ["iklan mana yang jalan bagus dan kenapa (sebut angkanya)"],
  "boros": ["iklan mana yang boros dan apa yang harus dilakukan"],
  "saran": ["3-5 langkah konkret minggu depan"],
  "anggaran": "usulan pembagian budget minggu depan dalam 1-2 kalimat"
}`,
  });
  if (!analysis?.ringkasan) throw new Error('Analisis dari model gak lengkap. Coba ulang.');
  db.prepare("UPDATE ad_reports SET analysis = ?, state = 'done' WHERE id = ?").run(JSON.stringify(analysis), row.id);
  return { result: { reportId: row.id }, review: `Laporan iklan "${row.name}" udah jadi` };
});

registerHandler('ads.audience', async (task) => {
  const row = db.prepare('SELECT * FROM audience_ideas WHERE id = ?').get(task.payload.ideaId);
  if (!row) throw new Error('Permintaan ide audiensnya udah dihapus.');
  const result = await chatJson({
    agentId: 'wulan',
    system: personaPrompt('wulan'),
    prompt: `Bikin ide target audiens iklan Meta/TikTok untuk:
Produk/layanan: ${row.product}
Tujuan iklan: ${row.goal}
${row.budget ? `Budget harian total: ${rupiah(row.budget)}` : 'Budget harian belum ditentukan, usulkan yang masuk akal untuk UMKM.'}

Jawab HANYA JSON:
{
  "audiens": [
    { "nama": "nama singkat audiens", "usia": "mis. 22-35", "gender": "semua/pria/wanita", "lokasi": "kota/area",
      "minat": ["minat atau perilaku di Ads Manager"], "alasan": "kenapa audiens ini cocok",
      "budgetHarian": 50000, "hook": "contoh kalimat pembuka iklan buat audiens ini" }
  ],
  "catatan": "cara ngetes audiens-audiens ini (berapa hari, kapan dimatikan)"
}
Kasih 3-4 audiens yang beda satu sama lain.`,
  });
  if (!Array.isArray(result?.audiens) || !result.audiens.length) throw new Error('Ide audiens dari model kosong. Coba ulang.');
  db.prepare("UPDATE audience_ideas SET result = ?, state = 'done' WHERE id = ?").run(JSON.stringify(result), row.id);
  return { result: { ideaId: row.id }, review: 'Ide target audiens udah siap' };
});

function toReport(row) {
  return {
    id: row.id,
    name: row.name,
    summary: parseJson(row.summary),
    analysis: parseJson(row.analysis),
    state: row.state,
    createdAt: row.created_at,
  };
}

function toIdea(row) {
  return {
    id: row.id,
    product: row.product,
    goal: row.goal,
    budget: row.budget,
    result: parseJson(row.result),
    state: row.state,
    createdAt: row.created_at,
  };
}

// Reports keep their state as "analyzing" until Raka is done; a failed task shows on the agent.
function syncFailed(table, kind, key) {
  const failed = db.prepare(`SELECT payload FROM tasks WHERE kind = ? AND state = 'failed'`).all(kind);
  for (const { payload } of failed) {
    const id = parseJson(payload, {})[key];
    if (id) db.prepare(`UPDATE ${table} SET state = 'failed' WHERE id = ? AND state != 'done'`).run(id);
  }
}

export function registerMarketingRoutes(router) {
  router.get('/api/ads/reports', (req, res) => {
    syncFailed('ad_reports', 'ads.report', 'reportId');
    sendJson(res, 200, db.prepare('SELECT * FROM ad_reports ORDER BY id DESC LIMIT 20').all().map(toReport));
  });

  router.post('/api/ads/reports', async (req, res) => {
    const body = await readJson(req, 5_000_000);
    const name = requireText(body.name, 'Nama laporan', 120);
    const csv = requireText(body.csv, 'Isi file CSV', 4_000_000);
    const summary = summarizeAds(csv);
    const { lastInsertRowid } = db.prepare('INSERT INTO ad_reports (name, summary) VALUES (?, ?)').run(name, JSON.stringify(summary));
    const id = Number(lastInsertRowid);
    enqueue('raka', 'ads.report', `Analisis iklan: ${name}`, { reportId: id });
    sendJson(res, 201, toReport(db.prepare('SELECT * FROM ad_reports WHERE id = ?').get(id)));
  });

  router.post('/api/ads/reports/:id/retry', (req, res, { id }) => {
    const reportId = toId(id);
    if (!db.prepare('SELECT 1 FROM ad_reports WHERE id = ?').get(reportId)) throw new HttpError(404, 'Laporan gak ketemu.');
    db.prepare("UPDATE ad_reports SET state = 'analyzing' WHERE id = ?").run(reportId);
    enqueue('raka', 'ads.report', 'Analisis iklan (ulang)', { reportId });
    sendJson(res, 200, { ok: true });
  });

  router.delete('/api/ads/reports/:id', (req, res, { id }) => {
    db.prepare('DELETE FROM ad_reports WHERE id = ?').run(toId(id));
    sendJson(res, 200, { ok: true });
  });

  router.get('/api/ads/audiences', (req, res) => {
    syncFailed('audience_ideas', 'ads.audience', 'ideaId');
    sendJson(res, 200, db.prepare('SELECT * FROM audience_ideas ORDER BY id DESC LIMIT 20').all().map(toIdea));
  });

  router.post('/api/ads/audiences', async (req, res) => {
    const body = await readJson(req);
    const product = requireText(body.product, 'Produk', 1000);
    const goal = requireText(body.goal, 'Tujuan iklan', 300);
    const budget = Number(body.budget);
    const { lastInsertRowid } = db.prepare('INSERT INTO audience_ideas (product, goal, budget) VALUES (?, ?, ?)')
      .run(product, goal, Number.isFinite(budget) && budget > 0 ? Math.round(budget) : null);
    const id = Number(lastInsertRowid);
    enqueue('wulan', 'ads.audience', `Ide audiens: ${product.slice(0, 40)}`, { ideaId: id });
    sendJson(res, 201, toIdea(db.prepare('SELECT * FROM audience_ideas WHERE id = ?').get(id)));
  });

  router.delete('/api/ads/audiences/:id', (req, res, { id }) => {
    db.prepare('DELETE FROM audience_ideas WHERE id = ?').run(toId(id));
    sendJson(res, 200, { ok: true });
  });
}
