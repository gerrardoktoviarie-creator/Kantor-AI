import { db } from './db.js';
import { getAgent, listTasks, personaPrompt, setOverlay, clearOverlay } from './agents.js';
import { chat } from './llm.js';
import { HttpError, readJson, requireText, sendJson } from './http.js';

const HISTORY = 16;

// What each agent should know about right now when you talk to it.
const CONTEXT = {
  sari: () => listRows(`SELECT clients.name AS client, contents.format, contents.brief, contents.state, contents.schedule_at
    FROM contents JOIN clients ON clients.id = contents.client_id ORDER BY contents.id DESC LIMIT 12`,
  (r) => `- [${r.state}] ${r.client}, ${r.format}: ${r.brief.slice(0, 80)} (tayang ${r.schedule_at ?? '-'})`, 'Konten terbaru'),
  ale: () => CONTEXT.sari(),
  dimas: () => listRows('SELECT name, duration, state FROM videos ORDER BY id DESC LIMIT 8',
    (r) => `- ${r.name} (${Math.round(r.duration ?? 0)} detik, ${r.state})`, 'Video yang pernah diupload'),
  mira: () => listRows(`SELECT course, title, due_at, submission FROM coursework
    WHERE submission IS NULL OR submission NOT IN ('TURNED_IN', 'RETURNED') ORDER BY due_at IS NULL, due_at LIMIT 15`,
  (r) => `- [${r.course}] ${r.title}, deadline ${r.due_at ?? 'gak ada'}`, 'Tugas kuliah yang belum dikumpul'),
};
CONTEXT.raka = () => listRows('SELECT name, state, summary FROM ad_reports ORDER BY id DESC LIMIT 5',
  (r) => { const t = JSON.parse(r.summary).totals; return `- ${r.name} (${r.state}): ${t.ads} iklan, biaya Rp${Math.round(t.spend).toLocaleString('id-ID')}, hasil ${t.results}`; },
  'Laporan iklan terakhir');
CONTEXT.wulan = () => listRows('SELECT product, goal, state FROM audience_ideas ORDER BY id DESC LIMIT 5',
  (r) => `- ${r.product.slice(0, 60)} (tujuan: ${r.goal}, ${r.state})`, 'Permintaan ide audiens');
CONTEXT.dewi = () => listRows('SELECT name, unit, stock, min_stock FROM products ORDER BY stock <= min_stock DESC, name LIMIT 20',
  (r) => `- ${r.name}: ${r.stock} ${r.unit} (minimum ${r.min_stock})${r.stock <= r.min_stock ? ' TIPIS' : ''}`, 'Stok barang');
CONTEXT.rudi = () => [CONTEXT.dewi(), listRows('SELECT week, text FROM stock_recaps WHERE text IS NOT NULL ORDER BY id DESC LIMIT 1',
  (r) => `- minggu ${r.week}: ${r.text.slice(0, 300)}`, 'Rekap terakhir')].join('\n\n');
for (const id of ['bayu', 'nadia', 'tari', 'joko', 'fajar', 'rani']) {
  CONTEXT[id] = () => listRows('SELECT name, kind, state, step, brief FROM projects ORDER BY id DESC LIMIT 8',
    (r) => `- ${r.name} (${r.kind}, ${r.state}${r.step ? `, tahap ${r.step}` : ''}): ${r.brief.slice(0, 80)}`, 'Proyek IT');
}

function listRows(sql, format, title) {
  const rows = db.prepare(sql).all();
  return rows.length ? `${title}:\n${rows.map(format).join('\n')}` : `${title}: belum ada.`;
}

function history(agentId, limit = HISTORY) {
  return db.prepare('SELECT * FROM messages WHERE agent_id = ? ORDER BY id DESC LIMIT ?')
    .all(agentId, limit).reverse()
    .map((m) => ({ id: m.id, role: m.role, text: m.text, createdAt: m.created_at }));
}

export function registerChatRoutes(router) {
  router.get('/api/agents/:id/messages', (req, res, { id }) => {
    if (!getAgent(id)) throw new HttpError(404, 'Agent gak ketemu.');
    sendJson(res, 200, history(id, 50));
  });

  router.post('/api/agents/:id/messages', async (req, res, { id }) => {
    const agent = getAgent(id);
    if (!agent) throw new HttpError(404, 'Agent gak ketemu.');
    const { text } = await readJson(req);
    const message = requireText(text, 'Pesan', 4000);

    const past = history(id);
    db.prepare("INSERT INTO messages (agent_id, role, text) VALUES (?, 'user', ?)").run(id, message);

    const recentWork = listTasks({ agentId: id, limit: 5 })
      .map((t) => `- ${t.title} (${t.state})`).join('\n') || '- belum ada';
    const transcript = past.map((m) => `${m.role === 'user' ? 'Bos' : agent.name}: ${m.text}`).join('\n');

    setOverlay(id, 'chatting', 'Ngobrol sama kamu', 5 * 60 * 1000);
    let reply;
    try {
      reply = await chat({
        agentId: id,
        system: `${personaPrompt(id)}
Kamu lagi ngobrol langsung sama bos kamu (pemilik bisnis) lewat chat kantor.
Jawab singkat kayak chat (1-6 kalimat), boleh pakai daftar pendek kalau perlu. Jangan pakai markdown heading.
Kalau ditanya hal di luar bidangmu, jawab seadanya lalu sebut rekan yang lebih cocok.
Kamu belum bisa mengeksekusi tugas dari chat ini; kalau bos minta dikerjakan, bilang tombol mana di halaman kantor yang harus dipakai.

Kerjaan terakhirmu:
${recentWork}

${CONTEXT[id]?.() ?? ''}`,
        prompt: `${transcript ? `Obrolan sebelumnya:\n${transcript}\n\n` : ''}Bos: ${message}\n${agent.name}:`,
        maxTokens: 1200,
      });
    } finally {
      clearOverlay(id);
    }

    const clean = reply.replace(new RegExp(`^${agent.name}:\\s*`), '').trim();
    db.prepare("INSERT INTO messages (agent_id, role, text) VALUES (?, 'agent', ?)").run(id, clean);
    sendJson(res, 200, history(id, 50));
  });

  router.delete('/api/agents/:id/messages', (req, res, { id }) => {
    if (!getAgent(id)) throw new HttpError(404, 'Agent gak ketemu.');
    db.prepare('DELETE FROM messages WHERE agent_id = ?').run(id);
    sendJson(res, 200, []);
  });
}
