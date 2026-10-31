import { db, getSetting, parseJson } from './db.js';
import { coachingPrompt } from './coaching.js';

export const DIVISIONS = [
  {
    id: 'sosmed',
    name: 'Sosmed',
    room: 'Studio Sosmed',
    blurb: 'Ide konten, naskah reels, caption, jadwal posting, potong video panjang jadi klip.',
    agents: [
      { id: 'sari', name: 'Sari', role: 'Manajer Konten', look: { hair: '#7a2e4a', shirt: '#e0607e', style: 'hijab', skin: '#e8b98a' } },
      { id: 'ale', name: 'Ale', role: 'Creative Lead', look: { hair: '#5a3825', shirt: '#4aa3df', skin: '#c68642' } },
      { id: 'dimas', name: 'Dimas', role: 'Editor Klip', look: { hair: '#1c1c1c', shirt: '#f2994a', style: 'spiky', skin: '#e0ac69' } },
    ],
  },
  {
    id: 'it',
    name: 'IT & Programmer',
    room: 'Lab IT',
    blurb: 'Riset ide baru, desain, database, backend, frontend. Bikin website dan app.',
    agents: [
      { id: 'bayu', name: 'Bayu', role: 'Lead Programmer', look: { hair: '#222222', shirt: '#2d6a4f', glasses: true, skin: '#c68642' } },
      { id: 'nadia', name: 'Nadia', role: 'Riset Ide', look: { hair: '#4a4e69', shirt: '#9b5de5', style: 'hijab', skin: '#f1c27d' } },
      { id: 'tari', name: 'Tari', role: 'Desainer UI', look: { hair: '#3b2416', shirt: '#ef476f', style: 'long', skin: '#ffdbac' } },
      { id: 'joko', name: 'Joko', role: 'Database', look: { hair: '#2b2b2b', shirt: '#118ab2', glasses: true, skin: '#a86b3c' } },
      { id: 'fajar', name: 'Fajar', role: 'Backend', look: { hair: '#3d2b1f', shirt: '#073b4c', style: 'spiky', skin: '#e0ac69' } },
      { id: 'rani', name: 'Rani', role: 'Frontend', look: { hair: '#8d5524', shirt: '#06d6a0', style: 'bun', skin: '#f1c27d' } },
    ],
  },
  {
    id: 'tugas',
    name: 'Tugas & Kuliah',
    room: 'Ruang Belajar',
    blurb: 'Pantau tugas baru dari Google Classroom, ringkas, dan kasih rencana ngerjain.',
    agents: [
      { id: 'mira', name: 'Mira', role: 'Asisten Tugas', look: { hair: '#4a2c2a', shirt: '#ffd166', style: 'long', skin: '#e8b98a' } },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing iklan',
    room: 'Ruang Iklan',
    blurb: 'Laporan dan saran dari ekspor Meta/TikTok Ads, plus ide target audiens buat dites.',
    agents: [
      { id: 'raka', name: 'Raka', role: 'Manajer Iklan', look: { hair: '#2b1d14', shirt: '#e76f51', glasses: true, skin: '#c68642' } },
      { id: 'wulan', name: 'Wulan', role: 'Analis Audiens', look: { hair: '#1f6f8b', shirt: '#f4a261', style: 'hijab', skin: '#e8b98a' } },
    ],
  },
  {
    id: 'admin',
    name: 'Admin & stok',
    room: 'Gudang & Admin',
    blurb: 'Catat stok barang masuk-keluar, kabarin kalau stok tipis, rekap tiap Senin.',
    agents: [
      { id: 'dewi', name: 'Dewi', role: 'Admin Stok', look: { hair: '#3b2416', shirt: '#8d99ae', style: 'long', skin: '#f1c27d' } },
      { id: 'rudi', name: 'Rudi', role: 'Analis Penjualan', look: { hair: '#1c1c1c', shirt: '#264653', style: 'peci', skin: '#a86b3c' } },
    ],
  },
];

export const BUILDER = { id: 'builder', name: 'Builder', role: 'Pengurus Kantor', look: { hair: '#5c4033', shirt: '#f4f1de', skin: '#e0ac69' } };

const agentIndex = new Map();
for (const division of DIVISIONS) {
  for (const agent of division.agents) agentIndex.set(agent.id, { ...agent, divisionId: division.id });
}
agentIndex.set(BUILDER.id, { ...BUILDER, divisionId: null });

export function getAgent(id) {
  return agentIndex.get(id);
}

export function enabledDivisions() {
  const enabled = getSetting('divisions', []);
  return DIVISIONS.filter((d) => enabled.includes(d.id));
}

// Live status shown in the office. Kept in memory: after a restart everyone starts idle,
// which is also what the queue does (running tasks are re-queued).
const status = new Map();

export function setStatus(agentId, state, text = '') {
  status.set(agentId, { state, text, at: Date.now() });
}

// Short-lived states (chatting with you, a kickoff meeting) sit on top of the real one
// and fall away on their own, so they never get stuck if something fails midway.
const overlays = new Map();

export function setOverlay(agentId, state, text, ms) {
  overlays.set(agentId, { state, text, at: Date.now(), until: Date.now() + ms });
}

export function clearOverlay(agentId) {
  overlays.delete(agentId);
}

export function getStatus(agentId) {
  const overlay = overlays.get(agentId);
  if (overlay && overlay.until > Date.now()) return overlay;
  if (overlay) overlays.delete(agentId);
  return status.get(agentId) ?? { state: 'idle', text: '', at: 0 };
}

export function holdMeeting(agentIds, text, ms = 12_000) {
  for (const id of agentIds) setOverlay(id, 'meeting', text, ms);
}

const WORK_STANDARD = `Standar kerja (berlaku di semua tugas):
- Langsung kerjakan, gak banyak omong. Gak usah salam pembuka, basa-basi, ngulang permintaan, atau nawarin bantuan lagi di akhir. Kasih hasilnya.
- Kerja di level expert bidangmu: pakai cara kerja dan standar yang dipakai profesional senior, bukan jawaban umum.
- Jangan ngarang. Angka, nama, tanggal, harga, dan fakta cuma boleh dari data yang dikasih. Kalau datanya gak ada, bilang "datanya belum ada" atau "perlu dicek", jangan nebak.
- Baca semua yang dikasih dulu: brief, data, catatan bos. Kalau ada yang ambigu, pilih asumsi paling masuk akal dan tulis asumsinya.
- Jawaban harus spesifik buat bisnis dan permintaan ini. Kalimat yang bisa ditempel ke bisnis mana aja itu tandanya asal jawab.
- Sebelum setor, cek ulang: sesuai permintaan, formatnya bener, gak ada bagian yang kepotong atau diganti "...".`;

export function personaPrompt(agentId) {
  const agent = getAgent(agentId);
  const business = getSetting('business', {});
  return [
    `Kamu ${agent.name}, ${agent.role} di kantor AI milik "${business.name || 'bisnis ini'}".`,
    business.about && `Tentang bisnisnya: ${business.about}`,
    business.audience && `Target audiens / gaya: ${business.audience}`,
    'Pakai Bahasa Indonesia yang santai tapi profesional. Konkret, jangan bertele-tele.',
    WORK_STANDARD,
    coachingPrompt(agentId),
  ].filter(Boolean).join('\n');
}

const handlers = new Map();

export function registerHandler(kind, handler) {
  handlers.set(kind, handler);
}

export function enqueue(agentId, kind, title, payload = {}) {
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO tasks (agent_id, kind, title, payload) VALUES (?, ?, ?, ?)',
  ).run(agentId, kind, title, JSON.stringify(payload));
  if (getStatus(agentId).state === 'idle') setStatus(agentId, 'queued', `Antre: ${title}`);
  wake();
  return Number(lastInsertRowid);
}

export function listTasks({ agentId, limit = 20 } = {}) {
  const rows = agentId
    ? db.prepare('SELECT * FROM tasks WHERE agent_id = ? ORDER BY id DESC LIMIT ?').all(agentId, limit)
    : db.prepare('SELECT * FROM tasks ORDER BY id DESC LIMIT ?').all(limit);
  return rows.map(toTask);
}

export function getTask(id) {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  return row ? toTask(row) : null;
}

function toTask(row) {
  return {
    id: row.id,
    agentId: row.agent_id,
    kind: row.kind,
    title: row.title,
    state: row.state,
    error: row.error,
    payload: parseJson(row.payload, {}),
    result: parseJson(row.result),
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

let running = false;
let wakeTimer = null;

function wake() {
  if (running || wakeTimer) return;
  wakeTimer = setTimeout(() => {
    wakeTimer = null;
    runQueue();
  }, 0);
}

// One task at a time: free 9router models rate-limit hard when hit in parallel.
async function runQueue() {
  if (running) return;
  running = true;
  try {
    let row;
    while ((row = db.prepare("SELECT * FROM tasks WHERE state = 'queued' ORDER BY id LIMIT 1").get())) {
      await runTask(toTask(row));
    }
  } finally {
    running = false;
  }
}

async function runTask(task) {
  const handler = handlers.get(task.kind);
  db.prepare("UPDATE tasks SET state = 'running', started_at = datetime('now') WHERE id = ?").run(task.id);
  setStatus(task.agentId, 'working', task.title);

  try {
    if (!handler) throw new Error(`Gak ada yang bisa ngerjain tugas jenis "${task.kind}".`);
    const outcome = (await handler(task)) ?? {};
    db.prepare("UPDATE tasks SET state = 'done', result = ?, finished_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(outcome.result ?? null), task.id);
    if (outcome.review) setStatus(task.agentId, 'waiting', outcome.review);
    else setStatus(task.agentId, 'idle', '');
  } catch (err) {
    db.prepare("UPDATE tasks SET state = 'failed', error = ?, finished_at = datetime('now') WHERE id = ?")
      .run(err.message, task.id);
    setStatus(task.agentId, 'error', err.message);
  }
}

export function startQueue() {
  db.prepare("UPDATE tasks SET state = 'queued', started_at = NULL WHERE state = 'running'").run();
  for (const { agent_id: agentId, title } of db.prepare(
    "SELECT agent_id, title FROM tasks WHERE state = 'queued' GROUP BY agent_id",
  ).all()) {
    setStatus(agentId, 'queued', `Antre: ${title}`);
  }
  wake();
}

export function retryTask(id) {
  const result = db.prepare("UPDATE tasks SET state = 'queued', error = NULL WHERE id = ? AND state = 'failed'").run(id);
  if (result.changes) wake();
  return result.changes > 0;
}

// Clears the agent's own status (never an overlay on top of it) while it still matches,
// e.g. once you have answered what they were asking.
export function clearStatusIf(agentId, matches) {
  const current = status.get(agentId);
  if (current && matches(current)) status.set(agentId, { state: 'idle', text: '', at: Date.now() });
}

export function clearAgentAttention(agentId) {
  const current = getStatus(agentId).state;
  if (current === 'waiting' || current === 'error') setStatus(agentId, 'idle', '');
}
