import { db, getSetting, parseJson, setSetting } from './db.js';
import { HttpError, sendJson } from './http.js';
import { hermesTelegram, usingHermesTelegram } from './hermes.js';

const TICK_MS = 10 * 60 * 1000;
const DIGEST_HOUR = 7;
const DONE = "('TURNED_IN', 'RETURNED')";

// With "pakai bot Hermes" on, messages go out through the Hermes bot to Hermes's home chat.
// Kantor AI only sends then; it never polls that bot, so it can't steal Hermes's updates.
const token = () => (usingHermesTelegram() ? hermesTelegram().token : process.env.TELEGRAM_BOT_TOKEN || '');
const chat = () => (usingHermesTelegram() ? hermesTelegram().chat : getSetting('telegramChat'));

async function call(method, params = {}) {
  if (!token()) throw new HttpError(409, 'TELEGRAM_BOT_TOKEN belum diisi di .env.');
  let res;
  try {
    res = await fetch(`${process.env.TELEGRAM_API_URL || 'https://api.telegram.org'}/bot${token()}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error('Telegram gak bisa dihubungi (koneksi putus atau diblok).');
  }
  const body = await res.json().catch(() => ({}));
  if (!body.ok) throw new Error(`Telegram nolak: ${body.description || res.status}`);
  return body.result;
}

// Telegram rejects messages over 4096 characters; split on blank lines (one task per block).
const MAX_MESSAGE = 3800;

export function splitMessage(text, max = MAX_MESSAGE) {
  const parts = [];
  let current = '';
  for (const block of text.split('\n\n')) {
    const piece = block.length > max ? block.slice(0, max - 1) + '…' : block;
    if (current && current.length + piece.length + 2 > max) {
      parts.push(current);
      current = piece;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) parts.push(current);
  return parts;
}

export async function notify(text) {
  const target = chat();
  if (!token() || !target) return false;
  for (const part of splitMessage(text)) {
    await call('sendMessage', { chat_id: target.id, text: part, disable_web_page_preview: true });
  }
  return true;
}

const when = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
});

function homeworkLine(row) {
  return `• ${row.title} (${row.course})${row.due_at ? `\n  deadline ${when.format(new Date(row.due_at))}` : ''}`;
}

export async function notifyNewCoursework(rows) {
  if (!rows.length) return;
  const parts = rows.map((row) => {
    const brief = parseJson(row.summary);
    const plan = brief?.plan?.length ? `\n  Rencana: ${brief.plan.join(' → ')}` : '';
    return `${homeworkLine(row)}${brief?.summary ? `\n  ${brief.summary}` : ''}${plan}${row.link ? `\n  ${row.link}` : ''}`;
  });
  await notify(`📚 Mira: ada ${rows.length} tugas baru di Classroom\n\n${parts.join('\n\n')}`);
}

// Deadline reminders go out once per window; the reminders table remembers what was already sent.
export async function sendDueReminders(now = Date.now()) {
  if (!token() || !chat()) return 0;
  // Most urgent first, so a task 2 hours out gets one "3 jam lagi" message, not that plus "besok".
  const windows = [
    { kind: 'h3', hours: 3, intro: '🚨 Mira: 3 jam lagi deadline' },
    { kind: 'h24', hours: 24, intro: '⏰ Mira: 24 jam lagi deadline' },
  ];
  let sent = 0;
  for (const window of windows) {
    const rows = db.prepare(`SELECT * FROM coursework
      WHERE due_at IS NOT NULL AND (submission IS NULL OR submission NOT IN ${DONE})
        AND due_at > ? AND due_at <= ?
        AND id NOT IN (SELECT coursework_id FROM reminders WHERE kind = ?)`)
      .all(new Date(now).toISOString(), new Date(now + window.hours * 3_600_000).toISOString(), window.kind);
    if (!rows.length) continue;
    await notify(`${window.intro}, belum dikumpul:\n\n${rows.map(homeworkLine).join('\n')}`);
    const mark = db.prepare('INSERT OR IGNORE INTO reminders (coursework_id, kind) VALUES (?, ?)');
    for (const row of rows) {
      mark.run(row.id, window.kind);
      // A 3-hour reminder makes the 24-hour one pointless if it hasn't gone out yet.
      if (window.kind === 'h3') mark.run(row.id, 'h24');
    }
    sent += rows.length;
  }
  return sent;
}

export async function sendDigest(now = new Date()) {
  if (!token() || !chat()) return false;
  const today = now.toLocaleDateString('sv-SE');
  if (now.getHours() < DIGEST_HOUR || getSetting('telegramDigestDay') === today) return false;

  const rows = db.prepare(`SELECT * FROM coursework
    WHERE due_at IS NOT NULL AND (submission IS NULL OR submission NOT IN ${DONE})
      AND due_at > ? AND due_at <= ? ORDER BY due_at`)
    .all(now.toISOString(), new Date(now.getTime() + 7 * 86_400_000).toISOString());
  setSetting('telegramDigestDay', today);
  if (!rows.length) return false;
  await notify(`☀️ Pagi! Ini tugas yang deadline-nya seminggu ke depan:\n\n${rows.map(homeworkLine).join('\n')}`);
  return true;
}

export function registerTelegramRoutes(router) {
  router.get('/api/telegram', async (req, res) => {
    const viaHermes = usingHermesTelegram();
    if (viaHermes && !getSetting('hermesBot')) {
      const me = await call('getMe').catch(() => null);
      if (me) setSetting('hermesBot', { username: me.username, name: me.first_name });
    }
    sendJson(res, 200, {
      configured: Boolean(token()),
      viaHermes,
      chat: chat(),
      bot: getSetting(viaHermes ? 'hermesBot' : 'telegramBot'),
      lastError: getSetting('telegramError'),
    });
  });

  // Picks the chat of whoever last sent /start to the bot. Only that one person gets reminders.
  router.post('/api/telegram/connect', async (req, res) => {
    const me = await call('getMe');
    setSetting('telegramBot', { username: me.username, name: me.first_name });
    const updates = await call('getUpdates', { timeout: 0, allowed_updates: ['message'] });
    const start = updates.map((u) => u.message).filter((m) => m?.text?.startsWith('/start') && m.chat.type === 'private').at(-1);
    if (!start) throw new HttpError(409, `Buka @${me.username} di Telegram, kirim /start, lalu klik tombol ini lagi.`);

    setSetting('telegramChat', { id: start.chat.id, name: [start.chat.first_name, start.chat.last_name].filter(Boolean).join(' ') });
    // Acknowledge the updates so an old /start isn't picked up again later.
    await call('getUpdates', { offset: updates.at(-1).update_id + 1, timeout: 0 });
    await notify('✅ Kantor AI udah nyambung. Mira bakal kirim tugas baru dan pengingat deadline ke sini.');
    sendJson(res, 200, { chat: chat() });
  });

  router.post('/api/telegram/test', async (req, res) => {
    if (!chat()) throw new HttpError(409, 'Telegram belum disambungin.');
    await notify('🧪 Tes dari Kantor AI. Kalau pesan ini masuk, pengingat udah siap.');
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/telegram/disconnect', (req, res) => {
    db.prepare("DELETE FROM settings WHERE key = 'telegramChat'").run();
    sendJson(res, 200, { ok: true });
  });
}

export function startTelegramReminders() {
  const tick = async () => {
    try {
      await sendDueReminders();
      await sendDigest();
      setSetting('telegramError', null);
    } catch (err) {
      setSetting('telegramError', err.message);
    }
  };
  setTimeout(tick, 15_000);
  setInterval(tick, TICK_MS).unref();
}
