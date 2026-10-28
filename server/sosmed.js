import { randomBytes } from 'node:crypto';
import { db, parseJson } from './db.js';
import { enqueue, personaPrompt, registerHandler, clearAgentAttention } from './agents.js';
import { chatJson, chat } from './llm.js';
import { HttpError, readJson, requireText, sendJson, toId } from './http.js';

const FORMATS = {
  reels: 'Reels / video pendek',
  single: 'Single image',
  carousel: 'Carousel',
};

// What each state means for who acts next. The client page only sees VISIBLE_TO_CLIENT.
const VISIBLE_TO_CLIENT = ['waiting_client', 'approved', 'reschedule'];

function toContent(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    format: row.format,
    formatLabel: FORMATS[row.format],
    brief: row.brief,
    scheduleAt: row.schedule_at,
    state: row.state,
    script: parseJson(row.script),
    explain: row.explain,
    clientNote: row.client_note,
    requestedSchedule: row.requested_schedule,
    updatedAt: row.updated_at,
  };
}

function loadContent(id) {
  const row = db.prepare(`SELECT contents.*, clients.name AS client_name, clients.about AS client_about
    FROM contents JOIN clients ON clients.id = contents.client_id WHERE contents.id = ?`).get(id);
  if (!row) throw new HttpError(404, 'Konten gak ketemu.');
  return row;
}

function setState(id, state, extra = {}) {
  const fields = Object.keys(extra);
  const sets = ['state = ?', "updated_at = datetime('now')", ...fields.map((f) => `${f} = ?`)];
  db.prepare(`UPDATE contents SET ${sets.join(', ')} WHERE id = ?`).run(state, ...Object.values(extra), id);
}

function scriptShape(format) {
  if (format === 'reels') {
    return `{
  "title": "judul internal singkat",
  "hook": "kalimat pembuka 3 detik pertama",
  "scenes": [ { "from": 0, "to": 3, "visual": "apa yang direkam/ditampilkan", "onscreen": "teks di layar", "voice": "voice over / ucapan" } ],
  "caption": "caption lengkap",
  "hashtags": ["#contoh"]
}
Durasi total 30-60 detik, 5-9 scene, "from"/"to" dalam detik dan nyambung.`;
  }
  const count = format === 'single' ? 'tepat 1 slide' : '4-7 slide';
  return `{
  "title": "judul internal singkat",
  "slides": [ { "headline": "teks besar di gambar", "body": "teks pendukung", "visual": "arahan foto/ilustrasi" } ],
  "caption": "caption lengkap",
  "hashtags": ["#contoh"]
}
Isi ${count}.`;
}

registerHandler('content.write', async (task) => {
  const row = loadContent(task.payload.contentId);
  const revision = task.payload.note
    ? `\n\nINI REVISI. Naskah sebelumnya:\n${row.script}\n\nCatatan revisi (${task.payload.from === 'client' ? 'dari klien' : 'dari atasan'}): ${task.payload.note}`
    : '';

  const script = await chatJson({
    agentId: 'sari',
    system: personaPrompt('sari'),
    prompt: `Bikin konten ${FORMATS[row.format]} untuk klien "${row.client_name}".
Tentang klien: ${row.client_about || '-'}
Brief: ${row.brief}
${row.schedule_at ? `Jadwal tayang: ${row.schedule_at}` : ''}${revision}

Jawab HANYA JSON dengan bentuk:
${scriptShape(row.format)}`,
  });

  if (!script || typeof script !== 'object' || !script.caption) {
    throw new Error('Naskah dari model gak lengkap (caption kosong). Coba ulang.');
  }
  setState(row.id, 'review', { script: JSON.stringify(script), client_note: null });
  return { result: { contentId: row.id }, review: `Naskah "${script.title || row.brief.slice(0, 30)}" nunggu kamu cek` };
});

registerHandler('content.explain', async (task) => {
  const row = loadContent(task.payload.contentId);
  const explain = await chat({
    agentId: 'ale',
    system: personaPrompt('ale'),
    maxTokens: 800,
    prompt: `Kamu yang jelasin konten ini ke klien "${row.client_name}" di halaman preview mereka.
Tulis 2-4 kalimat: konten ini isinya apa, kenapa dibikin begini, dan kapan tayang.
Ngomong langsung ke klien ("kamu"), jangan pakai markdown.

Format: ${FORMATS[row.format]}
Jadwal: ${row.schedule_at || 'belum ditentukan'}
Naskah:
${row.script}`,
  });
  setState(row.id, 'waiting_client', { explain });
  return { result: { contentId: row.id } };
});

export function registerSosmedRoutes(router) {
  router.get('/api/clients', (req, res) => {
    const rows = db.prepare('SELECT * FROM clients ORDER BY name').all();
    sendJson(res, 200, rows);
  });

  router.post('/api/clients', async (req, res) => {
    const body = await readJson(req);
    const name = requireText(body.name, 'Nama klien', 120);
    const about = typeof body.about === 'string' ? body.about.trim().slice(0, 2000) : '';
    const token = randomBytes(12).toString('base64url');
    const { lastInsertRowid } = db.prepare('INSERT INTO clients (name, about, token) VALUES (?, ?, ?)').run(name, about, token);
    sendJson(res, 201, { id: Number(lastInsertRowid), name, about, token });
  });

  router.get('/api/contents', (req, res) => {
    const rows = db.prepare(`SELECT contents.*, clients.name AS client_name FROM contents
      JOIN clients ON clients.id = contents.client_id ORDER BY contents.id DESC`).all();
    sendJson(res, 200, rows.map(toContent));
  });

  router.post('/api/contents', async (req, res) => {
    const body = await readJson(req);
    const clientId = toId(body.clientId);
    if (!db.prepare('SELECT 1 FROM clients WHERE id = ?').get(clientId)) throw new HttpError(404, 'Klien gak ketemu.');
    if (!FORMATS[body.format]) throw new HttpError(400, 'Format konten gak dikenal.');
    const brief = requireText(body.brief, 'Brief', 3000);
    const scheduleAt = typeof body.scheduleAt === 'string' && body.scheduleAt ? body.scheduleAt : null;

    const { lastInsertRowid } = db.prepare(
      'INSERT INTO contents (client_id, format, brief, schedule_at) VALUES (?, ?, ?, ?)',
    ).run(clientId, body.format, brief, scheduleAt);
    const id = Number(lastInsertRowid);
    enqueue('sari', 'content.write', `Nulis ${FORMATS[body.format].toLowerCase()}: ${brief.slice(0, 40)}`, { contentId: id });
    sendJson(res, 201, { id });
  });

  router.post('/api/contents/:id/release', (req, res, { id }) => {
    const row = loadContent(toId(id));
    if (row.state !== 'review') throw new HttpError(409, 'Konten ini belum siap dirilis.');
    setState(row.id, 'releasing');
    clearAgentAttention('sari');
    enqueue('ale', 'content.explain', `Siapin penjelasan buat ${row.client_name}`, { contentId: row.id });
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/contents/:id/revise', async (req, res, { id }) => {
    const row = loadContent(toId(id));
    if (!['review', 'waiting_client'].includes(row.state)) throw new HttpError(409, 'Konten ini lagi gak bisa direvisi.');
    const { note } = await readJson(req);
    const text = requireText(note, 'Catatan revisi', 2000);
    setState(row.id, 'drafting');
    clearAgentAttention('sari');
    enqueue('sari', 'content.write', `Revisi: ${row.brief.slice(0, 40)}`, { contentId: row.id, note: text, from: 'internal' });
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/contents/:id/schedule', async (req, res, { id }) => {
    const row = loadContent(toId(id));
    if (row.state !== 'reschedule') throw new HttpError(409, 'Gak ada permintaan ganti jadwal.');
    const { accept } = await readJson(req);
    setState(row.id, 'waiting_client', accept
      ? { schedule_at: row.requested_schedule, requested_schedule: null }
      : { requested_schedule: null });
    sendJson(res, 200, { ok: true });
  });

  router.delete('/api/contents/:id', (req, res, { id }) => {
    db.prepare('DELETE FROM contents WHERE id = ?').run(toId(id));
    sendJson(res, 200, { ok: true });
  });

  // Client-facing endpoints, addressed by the client's secret token instead of an id.
  router.get('/api/client/:token', (req, res, { token }) => {
    const client = findClient(token);
    const rows = db.prepare(`SELECT contents.*, clients.name AS client_name FROM contents
      JOIN clients ON clients.id = contents.client_id
      WHERE client_id = ? AND state IN (${VISIBLE_TO_CLIENT.map(() => '?').join(', ')})
      ORDER BY COALESCE(schedule_at, contents.created_at)`).all(client.id, ...VISIBLE_TO_CLIENT);
    sendJson(res, 200, { client: { name: client.name }, contents: rows.map(toContent) });
  });

  router.post('/api/client/:token/contents/:id', async (req, res, { token, id }) => {
    const client = findClient(token);
    const row = loadContent(toId(id));
    if (row.client_id !== client.id) throw new HttpError(404, 'Konten gak ketemu.');
    if (row.state !== 'waiting_client') throw new HttpError(409, 'Konten ini udah diproses.');

    const body = await readJson(req);
    if (body.action === 'approve') {
      setState(row.id, 'approved');
    } else if (body.action === 'revise') {
      const note = requireText(body.note, 'Catatan revisi', 2000);
      setState(row.id, 'drafting', { client_note: note });
      enqueue('sari', 'content.write', `Revisi dari ${client.name}`, { contentId: row.id, note, from: 'client' });
    } else if (body.action === 'reschedule') {
      const when = requireText(body.scheduleAt, 'Jadwal baru', 40);
      setState(row.id, 'reschedule', { requested_schedule: when });
    } else {
      throw new HttpError(400, 'Aksi gak dikenal.');
    }
    sendJson(res, 200, { ok: true });
  });
}

function findClient(token) {
  const client = db.prepare('SELECT * FROM clients WHERE token = ?').get(token);
  if (!client) throw new HttpError(404, 'Link klien gak valid.');
  return client;
}
