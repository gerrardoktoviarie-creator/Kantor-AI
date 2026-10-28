import { randomBytes } from 'node:crypto';
import { GOOGLE } from './config.js';
import { db, getSetting, parseJson, setSetting } from './db.js';
import { enqueue, personaPrompt, registerHandler } from './agents.js';
import { chatJson } from './llm.js';
import { HttpError, sendJson } from './http.js';
import { notifyNewCoursework } from './telegram.js';

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
];
const API = 'https://classroom.googleapis.com/v1';
const SYNC_EVERY_MS = 15 * 60 * 1000;

// Several login tabs may be open at once; each state is valid for 15 minutes.
const pendingStates = new Map();
const STATE_TTL_MS = 15 * 60 * 1000;
let syncing = null;

export const isConfigured = () => Boolean(GOOGLE.clientId && GOOGLE.clientSecret);

async function tokenRequest(params) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: GOOGLE.clientId, client_secret: GOOGLE.clientSecret, ...params }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google nolak login: ${body.error_description || body.error || res.status}`);
  return body;
}

async function accessToken() {
  const tokens = getSetting('googleTokens');
  if (!tokens?.refresh_token) throw new HttpError(409, 'Google Classroom belum disambungin.');
  if (tokens.access_token && tokens.expires_at > Date.now() + 60_000) return tokens.access_token;

  const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
  const next = { ...tokens, access_token: fresh.access_token, expires_at: Date.now() + fresh.expires_in * 1000 };
  setSetting('googleTokens', next);
  return next.access_token;
}

async function api(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Classroom API ${res.status}: ${body.error?.message || 'gagal'}`);
  }
  return res.json();
}

async function listAll(path, key) {
  const items = [];
  let pageToken = '';
  do {
    const sep = path.includes('?') ? '&' : '?';
    const page = await api(`${path}${sep}pageSize=50${pageToken ? `&pageToken=${pageToken}` : ''}`);
    items.push(...(page[key] ?? []));
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  return items;
}

// Classroom gives due dates as separate UTC date/time parts.
export function toDueIso(work) {
  if (!work.dueDate) return null;
  const { year, month, day } = work.dueDate;
  const { hours = 23, minutes = 59 } = work.dueTime ?? {};
  return new Date(Date.UTC(year, month - 1, day, hours, minutes)).toISOString();
}

export async function syncClassroom() {
  if (syncing) return syncing;
  syncing = (async () => {
    const courses = await listAll('/courses?courseStates=ACTIVE&studentId=me', 'courses');
    const fresh = [];
    const upsert = db.prepare(`INSERT INTO coursework (id, course, title, description, due_at, link, submission)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title = excluded.title, description = excluded.description,
        due_at = excluded.due_at, link = excluded.link, submission = excluded.submission`);

    for (const course of courses) {
      const works = await listAll(`/courses/${course.id}/courseWork?orderBy=updateTime%20desc`, 'courseWork');
      const submissions = await listAll(`/courses/${course.id}/courseWork/-/studentSubmissions?userId=me`, 'studentSubmissions');
      const stateByWork = new Map(submissions.map((s) => [s.courseWorkId, s.state]));

      for (const work of works) {
        const isNew = !db.prepare('SELECT 1 FROM coursework WHERE id = ?').get(work.id);
        upsert.run(work.id, course.name, work.title, work.description ?? '', toDueIso(work), work.alternateLink ?? null,
          stateByWork.get(work.id) ?? null);
        if (isNew) fresh.push(work.id);
      }
    }

    setSetting('classroomSyncedAt', new Date().toISOString());
    const pending = fresh.filter((id) => {
      const row = db.prepare('SELECT submission FROM coursework WHERE id = ?').get(id);
      return !['TURNED_IN', 'RETURNED'].includes(row.submission);
    });
    if (pending.length) enqueue('mira', 'classroom.brief', `Ngecek ${pending.length} tugas baru`, { ids: pending });
    return { courses: courses.length, fresh: fresh.length };
  })();

  try {
    const outcome = await syncing;
    setSetting('classroomError', null);
    return outcome;
  } catch (err) {
    setSetting('classroomError', err.message);
    throw err;
  } finally {
    syncing = null;
  }
}

registerHandler('classroom.brief', async (task) => {
  const rows = task.payload.ids
    .map((id) => db.prepare('SELECT * FROM coursework WHERE id = ?').get(id))
    .filter(Boolean);
  if (!rows.length) return {};

  const list = rows.map((r, i) => `${i + 1}. [${r.course}] ${r.title}
   Deadline: ${r.due_at ?? 'gak ada'}
   Deskripsi: ${r.description.slice(0, 1500) || '-'}`).join('\n');

  const answer = await chatJson({
    agentId: 'mira',
    system: personaPrompt('mira'),
    maxTokens: 3000,
    prompt: `Sekarang ${new Date().toISOString()}. Ada tugas kuliah baru:
${list}

Untuk tiap tugas, tulis ringkasan 1-2 kalimat (intinya disuruh ngapain) dan rencana ngerjain 2-4 langkah singkat yang realistis sebelum deadline.
Jawab HANYA JSON: { "items": [ { "no": 1, "summary": "", "plan": ["langkah 1"] } ] }`,
  });

  const save = db.prepare('UPDATE coursework SET summary = ? WHERE id = ?');
  for (const item of answer?.items ?? []) {
    const row = rows[Number(item.no) - 1];
    if (row) save.run(JSON.stringify({ summary: item.summary, plan: item.plan ?? [] }), row.id);
  }

  const fresh = rows.map((r) => db.prepare('SELECT * FROM coursework WHERE id = ?').get(r.id));
  // A Telegram outage shouldn't mark Mira's summary as failed; the page still shows it.
  await notifyNewCoursework(fresh).catch((err) => setSetting('telegramError', err.message));
  return { review: `${rows.length} tugas baru dari Classroom` };
});

export function registerClassroomRoutes(router) {
  router.get('/api/classroom', (req, res) => {
    const rows = db.prepare(`SELECT * FROM coursework
      ORDER BY (submission IN ('TURNED_IN', 'RETURNED')), due_at IS NULL, due_at`).all();
    sendJson(res, 200, {
      configured: isConfigured(),
      connected: Boolean(getSetting('googleTokens')?.refresh_token),
      redirectUri: GOOGLE.redirectUri,
      syncedAt: getSetting('classroomSyncedAt'),
      lastError: getSetting('classroomError'),
      items: rows.map((r) => ({
        id: r.id,
        course: r.course,
        title: r.title,
        dueAt: r.due_at,
        link: r.link,
        submission: r.submission,
        seen: Boolean(r.seen),
        brief: parseJson(r.summary),
      })),
    });
  });

  router.get('/api/classroom/connect', (req, res) => {
    if (!isConfigured()) throw new HttpError(409, 'GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum diisi di .env.');
    const pendingState = randomBytes(16).toString('hex');
    pendingStates.set(pendingState, Date.now() + STATE_TTL_MS);
    const params = new URLSearchParams({
      client_id: GOOGLE.clientId,
      redirect_uri: GOOGLE.redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: pendingState,
    });
    res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    res.end();
  });

  // Always lands back on the Tugas page; failures are saved so the page can say what went wrong.
  router.get('/api/classroom/callback', async (req, res, params, url) => {
    try {
      const state = url.searchParams.get('state');
      const expires = pendingStates.get(state);
      pendingStates.delete(state);
      if (!expires || expires < Date.now()) throw new Error('Sesi login kedaluwarsa atau gak cocok. Klik Sambungkan lagi.');
      const error = url.searchParams.get('error');
      if (error) throw new Error(error === 'access_denied' ? 'Izin ditolak di halaman Google.' : `Google ngembaliin error: ${error}.`);

      const tokens = await tokenRequest({
        grant_type: 'authorization_code',
        code: url.searchParams.get('code') ?? '',
        redirect_uri: GOOGLE.redirectUri,
      });
      if (!tokens.refresh_token) throw new Error('Google gak ngasih refresh token. Hapus akses "Kantor AI" di myaccount.google.com/permissions lalu sambungkan lagi.');
      setSetting('googleTokens', {
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
      });
      setSetting('classroomError', null);
      syncClassroom().catch(() => {});
    } catch (err) {
      setSetting('classroomError', `Login gagal: ${err.message}`);
    }
    res.writeHead(302, { Location: '/#tugas' });
    res.end();
  });

  router.post('/api/classroom/sync', async (req, res) => {
    sendJson(res, 200, await syncClassroom());
  });

  router.post('/api/classroom/seen', (req, res) => {
    db.prepare('UPDATE coursework SET seen = 1').run();
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/classroom/disconnect', (req, res) => {
    db.prepare("DELETE FROM settings WHERE key = 'googleTokens'").run();
    sendJson(res, 200, { ok: true });
  });
}

export function startClassroomSync() {
  const tick = () => {
    if (getSetting('googleTokens')?.refresh_token) syncClassroom().catch(() => {});
  };
  setTimeout(tick, 5_000);
  setInterval(tick, SYNC_EVERY_MS).unref();
}
