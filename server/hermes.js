// Hermes Agent integration: Kantor AI can send its Telegram messages through the Hermes bot,
// and Hermes gets a skill (hermes/kantor-ai/SKILL.md) that teaches it to call this API.
import { existsSync, mkdirSync, readFileSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ROOT, PORT } from './config.js';
import { db, getSetting, setSetting } from './db.js';
import { BUILDER, enabledDivisions, getStatus } from './agents.js';
import { HttpError, sendJson } from './http.js';

const SKILL_SOURCE = join(ROOT, 'hermes', 'kantor-ai', 'SKILL.md');

export function hermesHome() {
  if (process.env.HERMES_HOME) return process.env.HERMES_HOME;
  // Hermes on Windows lives in %LOCALAPPDATA%\hermes, elsewhere in ~/.hermes.
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) return join(process.env.LOCALAPPDATA, 'hermes');
  return join(homedir(), '.hermes');
}

export function parseEnv(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    values[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

// The bot token and the chat Hermes treats as "home". Read fresh each time, the file is tiny.
export function hermesTelegram() {
  const file = join(hermesHome(), '.env');
  if (!existsSync(file)) return null;
  const env = parseEnv(readFileSync(file, 'utf8'));
  const chatId = env.TELEGRAM_HOME_CHANNEL || env.TELEGRAM_ALLOWED_USERS?.split(',')[0]?.trim();
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return null;
  return { token: env.TELEGRAM_BOT_TOKEN, chat: { id: chatId, name: env.TELEGRAM_HOME_CHANNEL_NAME || 'chat Hermes' } };
}

export const usingHermesTelegram = () => getSetting('telegramVia') === 'hermes' && Boolean(hermesTelegram());

const skillTarget = () => join(hermesHome(), 'skills', 'kantor-ai', 'SKILL.md');

function skillInstalled() {
  const target = skillTarget();
  return existsSync(target) && readFileSync(target, 'utf8') === readFileSync(SKILL_SOURCE, 'utf8');
}

const amount = (n) => Number(Number(n).toFixed(2)).toLocaleString('id-ID');

// A plain-text picture of the office, written for an LLM agent to read and relay.
export function statusText(now = Date.now()) {
  const business = getSetting('business', {});
  const lines = [`Kantor AI "${business.name || '-'}" (${new Date(now).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB)`];

  lines.push('', 'Agent:');
  for (const division of enabledDivisions()) {
    for (const agent of [...division.agents]) {
      const status = getStatus(agent.id);
      const label = { idle: 'santai', queued: 'antre', working: 'lagi kerja', waiting: 'NUNGGU DICEK', error: 'ERROR', chatting: 'lagi chat', meeting: 'rapat' }[status.state] ?? status.state;
      lines.push(`- ${agent.id} (${agent.name}, ${agent.role}, ${division.name}): ${label}${status.text ? ` - ${status.text}` : ''}`);
    }
  }
  const builder = getStatus(BUILDER.id);
  if (builder.state !== 'idle') lines.push(`- builder: ${builder.state} ${builder.text}`);

  const queued = db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE state IN ('queued', 'running')").get().n;
  const failed = db.prepare("SELECT id, agent_id, title, error FROM tasks WHERE state = 'failed' ORDER BY id DESC LIMIT 3").all();
  lines.push('', `Tugas di antrean: ${queued}`);
  for (const t of failed) lines.push(`- gagal #${t.id} (${t.agent_id}): ${t.title} - ${t.error}`);

  const enabled = new Set(enabledDivisions().map((d) => d.id));
  if (enabled.has('sosmed')) {
    const review = db.prepare("SELECT contents.id, clients.name, contents.brief FROM contents JOIN clients ON clients.id = contents.client_id WHERE contents.state = 'review' LIMIT 5").all();
    lines.push('', `Konten nunggu dicek: ${review.length}`);
    for (const c of review) lines.push(`- #${c.id} ${c.name}: ${c.brief.slice(0, 70)}`);
  }
  if (enabled.has('tugas')) {
    const soon = db.prepare(`SELECT title, course, due_at FROM coursework
      WHERE due_at IS NOT NULL AND (submission IS NULL OR submission NOT IN ('TURNED_IN', 'RETURNED'))
        AND due_at > ? ORDER BY due_at LIMIT 5`).all(new Date(now).toISOString());
    lines.push('', 'Tugas kuliah terdekat:');
    for (const c of soon) lines.push(`- ${c.title} (${c.course}), deadline ${new Date(c.due_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
    if (!soon.length) lines.push('- gak ada yang deadline-nya dekat');
  }
  if (enabled.has('admin')) {
    const low = db.prepare('SELECT id, name, unit, stock, min_stock FROM products WHERE stock <= min_stock ORDER BY name').all();
    lines.push('', `Stok tipis: ${low.length}`);
    for (const p of low) lines.push(`- #${p.id} ${p.name}: ${amount(p.stock)} ${p.unit} (minimum ${amount(p.min_stock)})`);
  }
  if (enabled.has('marketing')) {
    const report = db.prepare("SELECT name, analysis FROM ad_reports WHERE state = 'done' ORDER BY id DESC LIMIT 1").get();
    if (report) lines.push('', `Laporan iklan terakhir "${report.name}": ${JSON.parse(report.analysis).ringkasan}`);
  }
  return lines.join('\n');
}

export function registerHermesRoutes(router) {
  router.get('/api/hermes', (req, res) => {
    const telegram = hermesTelegram();
    sendJson(res, 200, {
      found: existsSync(hermesHome()),
      telegram: Boolean(telegram),
      chat: telegram?.chat ?? null,
      using: usingHermesTelegram(),
      skillInstalled: existsSync(hermesHome()) && skillInstalled(),
      baseUrl: `http://localhost:${PORT}`,
    });
  });

  router.post('/api/hermes/telegram', (req, res) => {
    if (!hermesTelegram()) throw new HttpError(409, 'Token bot atau chat utama Hermes gak ketemu di .env Hermes.');
    setSetting('telegramVia', getSetting('telegramVia') === 'hermes' ? 'own' : 'hermes');
    sendJson(res, 200, { using: usingHermesTelegram() });
  });

  router.post('/api/hermes/skill', (req, res) => {
    if (!existsSync(hermesHome())) throw new HttpError(409, `Folder Hermes gak ketemu (${hermesHome()}). Pasang Hermes dulu.`);
    mkdirSync(join(hermesHome(), 'skills', 'kantor-ai'), { recursive: true });
    copyFileSync(SKILL_SOURCE, skillTarget());
    sendJson(res, 200, { skillInstalled: true });
  });

  // Plain text on purpose: this is what Hermes reads when asked "kantor lagi gimana?".
  router.get('/api/hermes/status', (req, res) => {
    const body = statusText();
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  });
}
