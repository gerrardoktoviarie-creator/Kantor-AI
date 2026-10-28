import { db, getSetting, parseJson } from './db.js';
import { clearStatusIf, enabledDivisions, enqueue, getAgent, getStatus, registerHandler, setOverlay, setStatus } from './agents.js';
import { chatJson } from './llm.js';
import { notify } from './telegram.js';
import { BASE_URL, PRAYER } from './config.js';
import { HttpError, readJson, requireText, sendJson, toId } from './http.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'topic',
    ref_id INTEGER,
    context TEXT NOT NULL DEFAULT '',
    agents TEXT NOT NULL,
    chair TEXT NOT NULL,
    lines TEXT NOT NULL DEFAULT '[]',
    proposal TEXT,
    state TEXT NOT NULL DEFAULT 'debating',
    due_at TEXT,
    note TEXT,
    reminded TEXT NOT NULL DEFAULT '',
    played_at INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT
  );
`);

// Each debate line stays on screen this long; the office plays them in order.
export const LINE_MS = 4500;
// Time for everyone to walk to the meeting room before the first line.
const WALK_MS = 6000;
// Overlay while the model is still writing the debate.
const THINK_MS = 4 * 60 * 1000;
const MAX_LINES = 10;
const TICK_MS = 10 * 60 * 1000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const when = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
});
const short = (text, max = 40) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// Other modules hook in here, so a project only starts once you ACC it.
const kinds = new Map();

export function onDecision(kind, hooks) {
  kinds.set(kind, hooks);
}

/** "2026-11-01T17:00" in office time (WIB by default) -> epoch ms, or null. */
export function parseLocal(text, utcOffset = PRAYER.utcOffset) {
  const m = typeof text === 'string' && text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, hh = '17', mi = '00'] = m;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mi)) - utcOffset * HOUR_MS;
  return Number.isFinite(ms) ? ms : null;
}

/** Three days from now at 17:00 office time: the fallback when nobody proposes a sane date. */
export function defaultDue(now = Date.now(), utcOffset = PRAYER.utcOffset) {
  const local = new Date(now + utcOffset * HOUR_MS + 3 * DAY_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 17, 0) - utcOffset * HOUR_MS;
}

/**
 * Cleans what the model wrote: only real participants speak, lines fit a speech bubble,
 * and the proposed deadline is in the future but not absurdly far.
 */
export function normalizeDebate(raw, { agents, chair }, now = Date.now()) {
  const lines = (Array.isArray(raw?.lines) ? raw.lines : [])
    .filter((l) => agents.includes(l?.agent) && typeof l.text === 'string' && l.text.trim())
    .slice(0, MAX_LINES)
    .map((l) => ({ agent: l.agent, text: short(l.text.trim().replace(/\s+/g, ' '), 120) }));

  let due = parseLocal(raw?.due);
  if (!due || due < now + HOUR_MS || due > now + 180 * DAY_MS) due = defaultDue(now);
  const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
  const plan = (Array.isArray(raw?.plan) ? raw.plan : []).map((p) => text(p, 200)).filter(Boolean).slice(0, 6);

  return {
    lines,
    proposal: {
      summary: text(raw?.summary, 800),
      plan,
      due: new Date(due).toISOString(),
      reason: text(raw?.reason, 300),
      question: text(raw?.question, 300) || `Deadline-nya ${when.format(due)} oke? Kalau oke, ACC ya.`,
    },
    chair,
  };
}

function toMeeting(row) {
  return {
    id: row.id,
    topic: row.topic,
    kind: row.kind,
    refId: row.ref_id,
    agents: parseJson(row.agents, []),
    chair: row.chair,
    lines: parseJson(row.lines, []),
    proposal: parseJson(row.proposal),
    state: row.state,
    dueAt: row.due_at,
    note: row.note,
    playedAt: row.played_at,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
  };
}

function loadMeeting(id) {
  const row = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, 'Rapat gak ketemu.');
  return toMeeting(row);
}

/** Calls a meeting: the agents debate, then the chair asks you for a deadline and an ACC. */
export function callMeeting({ topic, kind = 'topic', refId = null, context = '', agents, chair = agents[0] }) {
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO meetings (topic, kind, ref_id, context, agents, chair) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(topic, kind, refId, context, JSON.stringify(agents), chair);
  const id = Number(lastInsertRowid);
  enqueue(chair, 'meeting.debate', `Rapat: ${short(topic)}`, { meetingId: id });
  return id;
}

function gather(meeting, ms) {
  // Someone mid-chat with you finishes that first.
  for (const id of meeting.agents) {
    if (getStatus(id).state !== 'chatting') setOverlay(id, 'meeting', `Rapat: ${short(meeting.topic, 28)}`, ms);
  }
}

async function debate(meeting) {
  const business = getSetting('business', {});
  const people = meeting.agents.map((id) => {
    const agent = getAgent(id);
    return `- ${id}: ${agent.name}, ${agent.role}`;
  });
  const chair = getAgent(meeting.chair);
  const now = new Date(Date.now() + PRAYER.utcOffset * HOUR_MS).toISOString().slice(0, 16);
  return chatJson({
    agentId: meeting.chair,
    maxTokens: 2500,
    system: [
      `Kamu nulis jalannya rapat tim di kantor AI milik "${business.name || 'bisnis ini'}".`,
      business.about && `Tentang bisnisnya: ${business.about}`,
      business.audience && `Target audiens: ${business.audience}`,
      'Bahasa Indonesia santai kayak ngobrol di kantor, tapi isinya konkret.',
    ].filter(Boolean).join('\n'),
    prompt: `Topik rapat: ${meeting.topic}
${meeting.context ? `${meeting.context}\n` : ''}Peserta:
${people.join('\n')}
Sekarang: ${now} (waktu kantor).

Tulis rapatnya sebagai debat sehat: peserta beda pendapat (minimal dua sudut pandang yang bertentangan), saling sanggah pakai alasan konkret, lalu ${chair.name} menengahi dan menyimpulkan.
- 6 sampai 8 kalimat, gantian antar peserta, tiap kalimat maksimal 90 karakter.
- Habis itu ${chair.name} bikin usulan buat owner: keputusan, 2-5 langkah kerja, usulan deadline yang realistis, alasan deadline-nya, dan pertanyaan ke owner soal deadline sekalian minta ACC.
Jawab HANYA JSON:
{ "lines": [ { "agent": "<id peserta>", "text": "" } ], "summary": "", "plan": [""], "due": "YYYY-MM-DDTHH:mm", "reason": "", "question": "" }`,
  });
}

registerHandler('meeting.debate', async (task) => {
  const meeting = loadMeeting(task.payload.meetingId);
  gather(meeting, THINK_MS);

  let outcome;
  try {
    outcome = normalizeDebate(await debate(meeting), meeting);
  } catch (err) {
    // A flaky model shouldn't block your work: you can still ACC with a default deadline.
    outcome = normalizeDebate({ summary: `Rapatnya gagal jalan (${err.message}). Kamu tetep bisa ACC biar tim langsung kerja.` }, meeting);
  }

  const playedAt = Date.now() + WALK_MS;
  db.prepare("UPDATE meetings SET lines = ?, proposal = ?, state = 'asking', played_at = ? WHERE id = ?")
    .run(JSON.stringify(outcome.lines), JSON.stringify(outcome.proposal), playedAt, meeting.id);
  gather(meeting, WALK_MS + outcome.lines.length * LINE_MS + 2000);

  const chair = getAgent(meeting.chair);
  await notify(`🗳️ ${chair.name} minta ACC: ${meeting.topic}
${outcome.proposal.summary ? `\n${outcome.proposal.summary}\n` : ''}
${outcome.proposal.question}
Usul deadline: ${when.format(new Date(outcome.proposal.due))}

ACC atau ubah deadline-nya di ${BASE_URL}/#kantor`).catch(() => {});

  return { result: { meetingId: meeting.id }, review: `Minta ACC: ${short(meeting.topic, 30)}` };
});

function settle(meeting, asked = /^Minta ACC/) {
  clearStatusIf(meeting.chair, (s) => s.state === 'waiting' && asked.test(s.text));
}

export function approveMeeting(id, { due, note = '' }, now = Date.now()) {
  const meeting = loadMeeting(id);
  if (meeting.state !== 'asking') throw new HttpError(409, 'Rapat ini gak lagi nunggu ACC.');
  const dueMs = Date.parse(due);
  if (!Number.isFinite(dueMs)) throw new HttpError(400, 'Isi deadline-nya dulu.');
  if (dueMs < now) throw new HttpError(400, 'Deadline-nya udah lewat. Pilih waktu yang belum lewat.');

  db.prepare("UPDATE meetings SET state = 'approved', due_at = ?, note = ?, decided_at = datetime('now') WHERE id = ?")
    .run(new Date(dueMs).toISOString(), note, id);
  settle(meeting);
  kinds.get(meeting.kind)?.approve?.(meeting.refId, { dueAt: new Date(dueMs).toISOString(), note });
  return loadMeeting(id);
}

export function rejectMeeting(id, note = '') {
  const meeting = loadMeeting(id);
  if (meeting.state !== 'asking') throw new HttpError(409, 'Rapat ini gak lagi nunggu ACC.');
  db.prepare("UPDATE meetings SET state = 'rejected', note = ?, decided_at = datetime('now') WHERE id = ?").run(note, id);
  settle(meeting);
  kinds.get(meeting.kind)?.reject?.(meeting.refId);
  return loadMeeting(id);
}

/** The debate the office should be playing right now, if any. */
export function liveMeeting(now = Date.now()) {
  const row = db.prepare(`SELECT * FROM meetings WHERE state = 'debating'
    OR (played_at IS NOT NULL AND played_at > ?) ORDER BY id DESC LIMIT 1`)
    .get(now - MAX_LINES * LINE_MS - WALK_MS);
  if (!row) return null;
  const meeting = toMeeting(row);
  if (meeting.playedAt && now > meeting.playedAt + meeting.lines.length * LINE_MS) return null;
  // While the queue hasn't reached it, nobody is in the room yet.
  if (meeting.state === 'debating' && getStatus(meeting.chair).state !== 'meeting') return null;
  const { id, topic, agents, lines, playedAt } = meeting;
  return { id, topic, agents, lines, playedAt, lineMs: LINE_MS, now };
}

/** Reminds the chair (and you on Telegram) a day before and once the deadline has passed. */
export async function checkDeadlines(now = Date.now()) {
  const rows = db.prepare("SELECT * FROM meetings WHERE state = 'approved' AND due_at IS NOT NULL").all();
  for (const row of rows) {
    const meeting = toMeeting(row);
    if (kinds.get(meeting.kind)?.isDone?.(meeting.refId)) {
      db.prepare("UPDATE meetings SET state = 'done' WHERE id = ?").run(meeting.id);
      continue;
    }
    const due = Date.parse(meeting.dueAt);
    const reminded = new Set(row.reminded.split(',').filter(Boolean));
    const chair = getAgent(meeting.chair);
    let kind = null;
    if (now > due && !reminded.has('late')) kind = 'late';
    else if (now <= due && due - now < DAY_MS && !reminded.has('h24')) kind = 'h24';
    if (!kind) continue;

    reminded.add(kind);
    if (kind === 'late') reminded.add('h24');
    db.prepare('UPDATE meetings SET reminded = ? WHERE id = ?').run([...reminded].join(','), meeting.id);
    const text = kind === 'late' ? `Lewat deadline: ${short(meeting.topic, 30)}` : `Deadline besok: ${short(meeting.topic, 30)}`;
    const current = getStatus(meeting.chair);
    if (current.state === 'idle' || current.text.startsWith('Deadline besok')) setStatus(meeting.chair, 'waiting', text);
    await notify(kind === 'late'
      ? `⏰ ${chair.name}: "${meeting.topic}" udah lewat deadline (${when.format(due)}). Mau diperpanjang atau udah beres? Cek di ${BASE_URL}/#kantor`
      : `📌 ${chair.name}: deadline "${meeting.topic}" tinggal kurang dari sehari, ${when.format(due)}.`).catch(() => {});
  }
}

export function startDeadlineChecks() {
  const tick = () => checkDeadlines().catch((err) => console.error('Cek deadline gagal:', err.message));
  setTimeout(tick, 20_000).unref();
  setInterval(tick, TICK_MS).unref();
}

// Managers of the enabled divisions; a one-team office brings its second person so there is someone to disagree with.
function topicAgents() {
  const divisions = enabledDivisions();
  const agents = divisions.map((d) => d.agents[0].id).slice(0, 4);
  if (agents.length < 2) agents.push(...(divisions[0]?.agents.slice(1, 3).map((a) => a.id) ?? []));
  return agents;
}

export function registerMeetingRoutes(router) {
  router.get('/api/meetings', (req, res) => {
    const pending = db.prepare("SELECT * FROM meetings WHERE state IN ('debating', 'asking') ORDER BY id").all().map(toMeeting);
    const active = db.prepare("SELECT * FROM meetings WHERE state = 'approved' ORDER BY due_at").all().map(toMeeting);
    const people = (m) => ({ ...m, people: Object.fromEntries(m.agents.map((id) => {
      const { name, role, look } = getAgent(id);
      return [id, { name, role, look }];
    })) });
    sendJson(res, 200, { pending: pending.map(people), active: active.map(people) });
  });

  router.post('/api/meetings', async (req, res) => {
    const body = await readJson(req);
    const topic = requireText(body.topic, 'Topik rapat', 500);
    const agents = topicAgents();
    if (agents.length < 2) throw new HttpError(409, 'Butuh minimal dua agent buat rapat. Tambah divisi dulu di "Atur kantor".');
    sendJson(res, 201, { id: callMeeting({ topic, agents }) });
  });

  router.post('/api/meetings/:id/approve', async (req, res, { id }) => {
    const body = await readJson(req);
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
    sendJson(res, 200, approveMeeting(toId(id), { due: body.due, note }));
  });

  router.post('/api/meetings/:id/reject', async (req, res, { id }) => {
    const body = await readJson(req);
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
    sendJson(res, 200, rejectMeeting(toId(id), note));
  });

  router.post('/api/meetings/:id/done', (req, res, { id }) => {
    const meeting = loadMeeting(toId(id));
    if (meeting.state !== 'approved') throw new HttpError(409, 'Cuma keputusan yang udah di-ACC yang bisa ditandai beres.');
    db.prepare("UPDATE meetings SET state = 'done' WHERE id = ?").run(meeting.id);
    settle(meeting, /deadline/i);
    sendJson(res, 200, { ok: true });
  });
}
