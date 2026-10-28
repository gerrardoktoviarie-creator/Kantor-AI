import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// A fake 9router: answers by recognising which agent prompt it got.
const WORKING_SERVER = "const http = require('node:http');\nconst port = process.env.PORT || 3000;\nhttp.createServer((req, res) => res.end('halo dari app')).listen(port, () => console.log('Server jalan di port ' + port));";

function fakeAnswer(prompt) {
  if (prompt.includes('jelasin konten ini ke klien')) return 'Ini video progres lapangan, tayang Senin jam 12.';
  if (prompt.trimEnd().endsWith('Sari:')) return 'Sari: Siap bos, konten Bakri Padel aman.';
  if (prompt.includes('Cari penyebabnya')) {
    return `=== FILE: server.js ===\n${WORKING_SERVER}\n=== END FILE ===\n=== FILE: docs/perbaikan-terakhir.md ===\nError boom dihapus.\n=== END FILE ===`;
  }
  if (prompt.includes('Tugas kamu (Backend)')) {
    return "=== FILE: server.js ===\nconsole.error('mau nyala');\nthrow new Error('boom');\n=== END FILE ===";
  }
  if (prompt.includes('Cari 5 ide')) return JSON.stringify({ ideas: [{ title: 'Ide A', problem: 'p', how: 'h', why_now: 'w', first_step: 'f' }] });
  if (prompt.includes('Tugas kamu (')) {
    return 'Siap.\n=== FILE: public/index.html ===\n<!doctype html><title>x</title>\n=== END FILE ===\n=== FILE: docs/catatan.md ===\nok\n=== END FILE ===';
  }
  if (prompt.includes('Jawab HANYA JSON dengan bentuk')) {
    return `Oke berikut naskahnya: ${JSON.stringify({
      title: 'Progres lapangan', hook: 'Ini bukan render 3D',
      scenes: [{ from: 0, to: 3, visual: 'drone', onscreen: 'BUKAN RENDER', voice: 'Ini bukan render.' }],
      caption: 'Progres asli.', hashtags: ['#padel'],
    })}`;
  }
  return 'oke';
}

let llm;
let tg;
let base;
let workspace;
let calls = 0;
const tgSent = [];
const tgUpdates = [];

before(async () => {
  tg = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const method = req.url.split('/').at(-1);
    const params = body ? JSON.parse(body) : {};
    let result = true;
    if (method === 'getMe') result = { username: 'kantor_tes_bot', first_name: 'Kantor' };
    if (method === 'getUpdates') result = tgUpdates.filter((u) => !params.offset || u.update_id >= params.offset);
    if (method === 'sendMessage') tgSent.push(params);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, result }));
  });
  await new Promise((resolve) => tg.listen(0, '127.0.0.1', resolve));
  process.env.TELEGRAM_API_URL = `http://127.0.0.1:${tg.address().port}`;
  process.env.TELEGRAM_BOT_TOKEN = 'TEST:TOKEN';

  llm = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    if (req.url.endsWith('/models')) {
      res.end('{"data":[]}');
      return;
    }
    calls += 1;
    const { messages } = JSON.parse(body);
    const text = fakeAnswer(messages.at(-1).content);
    // Alternate SSE and plain JSON, like 9router does depending on the upstream provider.
    if (calls % 2) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end(`data: ${JSON.stringify({ model: 'fake', choices: [{ delta: { content: text } }], usage: { prompt_tokens: 10, completion_tokens: 20 } })}\n\ndata: [DONE]\n\n`);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: 'fake', choices: [{ message: { content: text } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }));
    }
  });
  await new Promise((resolve) => llm.listen(0, '127.0.0.1', resolve));

  workspace = mkdtempSync(join(tmpdir(), 'kantor-test-'));
  process.env.PORT = '4197';
  process.env.WORKSPACE_DIR = workspace;
  process.env.LLM_URL = `http://127.0.0.1:${llm.address().port}/v1`;
  process.env.LLM_KEY = 'test';
  process.env.NODE_ENV = 'test';
  base = 'http://localhost:4197';
  await import('../server/index.js');
  await new Promise((resolve) => setTimeout(resolve, 300));
});

after(() => {
  llm.close();
  tg.close();
  rmSync(workspace, { recursive: true, force: true });
  // The app server keeps its listener open; exit explicitly once tests are done.
  setTimeout(() => process.exit(0), 100).unref();
});

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${data.error}`);
  return data;
}

async function until(check, label, timeout = 15_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timeout nunggu: ${label}`);
}

test('setup validates and enables the chosen teams', async () => {
  await assert.rejects(call('/api/setup', { method: 'POST', body: { name: 'X', about: 'a', audience: 'b', divisions: [] } }), /minimal satu tim/);
  await call('/api/setup', { method: 'POST', body: { name: 'Courtify', about: 'kontraktor padel', audience: 'pemilik lahan', divisions: ['sosmed', 'it', 'tugas'] } });
  const office = await call('/api/office');
  assert.deepEqual(office.divisions.map((d) => d.id), ['sosmed', 'it', 'tugas']);
  assert.equal(office.health.ok, true);
});

test('content goes Sari -> review -> release -> Ale -> client approves', async () => {
  const client = await call('/api/clients', { method: 'POST', body: { name: 'Bakri Padel', about: 'lapangan padel Gorontalo' } });
  const { id } = await call('/api/contents', { method: 'POST', body: { clientId: client.id, format: 'reels', brief: 'progres pembangunan', scheduleAt: '2026-11-02T12:00' } });

  const reviewed = await until(async () => (await call('/api/contents')).find((c) => c.id === id && c.state === 'review'), 'naskah Sari');
  assert.equal(reviewed.script.scenes.length, 1);

  // The client can't see drafts.
  assert.equal((await call(`/api/client/${client.token}`)).contents.length, 0);

  await call(`/api/contents/${id}/release`, { method: 'POST' });
  await until(async () => (await call(`/api/client/${client.token}`)).contents.length === 1, 'penjelasan Ale');
  const [visible] = (await call(`/api/client/${client.token}`)).contents;
  assert.match(visible.explain, /progres lapangan/);

  await call(`/api/client/${client.token}/contents/${id}`, { method: 'POST', body: { action: 'reschedule', scheduleAt: '2026-11-03T09:00' } });
  await call(`/api/contents/${id}/schedule`, { method: 'POST', body: { accept: true } });
  const moved = (await call('/api/contents')).find((c) => c.id === id);
  assert.equal(moved.scheduleAt, '2026-11-03T09:00');

  await call(`/api/client/${client.token}/contents/${id}`, { method: 'POST', body: { action: 'approve' } });
  assert.equal((await call('/api/contents')).find((c) => c.id === id).state, 'approved');

  await assert.rejects(call(`/api/client/wrong-token/contents/${id}`, { method: 'POST', body: { action: 'approve' } }), /404/);
});

test('client revision sends the content back to Sari', async () => {
  const client = await call('/api/clients', { method: 'POST', body: { name: 'Klien Dua' } });
  const { id } = await call('/api/contents', { method: 'POST', body: { clientId: client.id, format: 'reels', brief: 'tes revisi' } });
  await until(async () => (await call('/api/contents')).find((c) => c.id === id && c.state === 'review'), 'draft');
  await call(`/api/contents/${id}/release`, { method: 'POST' });
  await until(async () => (await call(`/api/client/${client.token}`)).contents.length === 1, 'rilis');

  await call(`/api/client/${client.token}/contents/${id}`, { method: 'POST', body: { action: 'revise', note: 'hook-nya kurang nendang' } });
  const back = await until(async () => (await call('/api/contents')).find((c) => c.id === id && c.state === 'review'), 'revisi');
  assert.equal(back.clientNote, null);
  const sariTasks = (await call('/api/agents/sari')).tasks;
  assert.ok(sariTasks.some((t) => t.payload.note === 'hook-nya kurang nendang' && t.payload.from === 'client'));
});

test('IT pipeline runs every step and writes files', async () => {
  const { id, slug } = await call('/api/projects', { method: 'POST', body: { name: 'Booking Padel', kind: 'app', brief: 'app booking lapangan' } });
  const done = await until(async () => (await call('/api/projects')).projects.find((p) => p.id === id && p.state === 'done'), 'pipeline IT', 20_000);
  assert.equal(done.previewUrl, `/preview/${slug}/`);
  assert.ok(existsSync(join(workspace, 'projects', slug, 'docs', 'catatan.md')));

  const preview = await fetch(`${base}/preview/${slug}/`);
  assert.equal(preview.status, 200);
  assert.match(await preview.text(), /<title>x<\/title>/);

  const owners = (await call('/api/tasks')).filter((t) => t.kind === 'it.step' && t.payload.projectId === id).map((t) => t.agentId);
  assert.deepEqual(owners.sort(), ['bayu', 'fajar', 'joko', 'nadia', 'rani', 'tari']);
});

test('ideas come back from Nadia', async () => {
  const { id } = await call('/api/ideas', { method: 'POST', body: { topic: 'fitur baru' } });
  const task = await until(async () => (await call('/api/ideas')).find((t) => t.id === id && t.state === 'done'), 'ide');
  assert.equal(task.result.ideas[0].title, 'Ide A');
});

test('usage is recorded per agent', async () => {
  const usage = await call('/api/usage');
  assert.ok(usage.agents.some((a) => a.agentId === 'sari' && a.tokens > 0));
  assert.ok(usage.days.at(-1).divisions.it > 0);
});

test('chatting with an agent keeps history and context', async () => {
  const messages = await call('/api/agents/sari/messages', { method: 'POST', body: { text: 'Gimana konten Bakri?' } });
  assert.deepEqual(messages.map((m) => m.role), ['user', 'agent']);
  assert.equal(messages[1].text, 'Siap bos, konten Bakri Padel aman.');
  assert.notEqual((await call('/api/agents/sari')).status.state, 'chatting');
  await assert.rejects(call('/api/agents/nobody/messages', { method: 'POST', body: { text: 'x' } }), /404/);
  assert.deepEqual(await call('/api/agents/sari/messages', { method: 'DELETE' }), []);
});

test('a crashing project shows its logs, Bayu fixes it, then it runs', async () => {
  const { id } = await call('/api/projects', { method: 'POST', body: { name: 'App Crash', kind: 'app', brief: 'tes runner' } });
  const project = await until(async () => (await call('/api/projects')).projects.find((p) => p.id === id && p.state === 'done'), 'pipeline', 20_000);
  assert.equal(project.hasServer, true);

  const crashed = await call(`/api/projects/${id}/run`, { method: 'POST' });
  assert.equal(crashed.state, 'crashed');
  assert.ok(crashed.logs.some((l) => l.includes('boom')));

  await call(`/api/projects/${id}/fix`, { method: 'POST', body: {} });
  await until(async () => (await call('/api/projects')).projects.find((p) => p.id === id && p.state === 'done'), 'fix Bayu');
  const fixTask = (await call('/api/agents/bayu')).tasks.find((t) => t.kind === 'it.fix');
  assert.ok(fixTask.payload.logs.includes('boom'), 'Bayu harus dikasih log error');

  const running = await call(`/api/projects/${id}/run`, { method: 'POST' });
  assert.equal(running.state, 'running', running.logs.join('\n'));
  assert.equal(await (await fetch(running.url)).text(), 'halo dari app');

  await call(`/api/projects/${id}/stop`, { method: 'POST' });
  await assert.rejects(fetch(running.url, { signal: AbortSignal.timeout(2000) }));
});

test('telegram connects via /start and sends each deadline reminder once', async () => {
  await assert.rejects(call('/api/telegram/connect', { method: 'POST' }), /kirim \/start/);
  tgUpdates.push({ update_id: 10, message: { text: '/start', chat: { id: 555, type: 'private', first_name: 'Dex' } } });
  const { chat } = await call('/api/telegram/connect', { method: 'POST' });
  assert.equal(chat.id, 555);
  assert.match(tgSent.at(-1).text, /udah nyambung/);

  const { db } = await import('../server/db.js');
  const { sendDueReminders } = await import('../server/telegram.js');
  const soon = new Date(Date.now() + 2 * 3_600_000).toISOString();
  const later = new Date(Date.now() + 20 * 3_600_000).toISOString();
  db.prepare('INSERT INTO coursework (id, course, title, due_at) VALUES (?, ?, ?, ?)').run('cw1', 'Basis Data', 'ERD toko', soon);
  db.prepare('INSERT INTO coursework (id, course, title, due_at, submission) VALUES (?, ?, ?, ?, ?)').run('cw2', 'Basis Data', 'Udah dikumpul', soon, 'TURNED_IN');
  db.prepare('INSERT INTO coursework (id, course, title, due_at) VALUES (?, ?, ?, ?)').run('cw3', 'Pemrograman Web', 'Landing page', later);

  const before = tgSent.length;
  assert.equal(await sendDueReminders(), 2);
  const texts = tgSent.slice(before).map((m) => m.text).join('\n');
  assert.match(texts, /3 jam lagi[\s\S]*ERD toko/);
  assert.match(texts, /24 jam lagi[\s\S]*Landing page/);
  assert.doesNotMatch(texts, /24 jam lagi[^\n]*\n\n[^]*ERD toko/, 'ERD toko cukup sekali (3 jam)');
  assert.doesNotMatch(texts, /Udah dikumpul/);
  assert.equal(await sendDueReminders(), 0, 'pengingat yang sama gak boleh dikirim dua kali');
});

test('video upload is analysed and cut into a vertical clip', { skip: !existsSync(new URL('../bin/ffmpeg.exe', import.meta.url)) && 'ffmpeg tidak ada' }, async () => {
  const ffmpeg = fileURLToPath(new URL('../bin/ffmpeg.exe', import.meta.url));
  const src = join(workspace, 'sample.mp4');
  // 40s test video: tone with a 1s gap every 10s, so there are pauses to cut on.
  const made = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=15:duration=40',
    '-f', 'lavfi', '-i', "aevalsrc='if(lt(mod(t,10),9),0.5*sin(440*2*PI*t),0)':d=40",
    '-shortest', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', src]);
  assert.equal(made.status, 0, made.stderr?.toString());

  const upload = await fetch(`${base}/api/videos?name=podcast.mp4`, { method: 'PUT', body: readFileSync(src) });
  assert.equal(upload.status, 201);
  const { id } = await upload.json();

  // Includes a real whisper.cpp run when bin/whisper is installed.
  const video = await until(async () => (await call('/api/videos')).find((v) => v.id === id && v.state === 'ready'), 'analisis', 120_000);
  assert.ok(Math.abs(video.duration - 40) < 1);
  assert.ok(video.candidates.length >= 1);
  const thumb = await fetch(base + video.candidates[0].thumbUrl);
  assert.equal(thumb.headers.get('content-type'), 'image/jpeg');

  const c = video.candidates[0];
  await call(`/api/videos/${id}/clips`, { method: 'POST', body: { start: c.start, end: c.end, title: 'Klip 1', layout: 'vertical' } });
  const clip = await until(async () => (await call('/api/videos')).find((v) => v.id === id).clips.find((x) => x.state === 'done'), 'potong', 30_000);

  const range = await fetch(base + clip.url, { headers: { Range: 'bytes=0-99' } });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 100);

  const probe = spawnSync(ffmpeg, ['-hide_banner', '-i', join(workspace, 'clips', clip.url.split('/').at(-1))]);
  assert.match(probe.stderr.toString(), /1080x1920/);

  await assert.rejects(call(`/api/videos/${id}/clips`, { method: 'POST', body: { start: 5, end: 2, title: 'x' } }), /gak valid/);

  // A pure tone usually yields no words; either way the subtitle request must be handled honestly.
  if (!video.hasTranscript) {
    await assert.rejects(call(`/api/videos/${id}/clips`, { method: 'POST', body: { start: 0, end: 16, title: 's', subtitles: true } }), /transkrip/);
  }
});

test('failed tasks surface on the agent and can be retried', async () => {
  const before = calls;
  llm.removeAllListeners('request');
  llm.on('request', (req, res) => {
    if (req.url.endsWith('/models')) return res.end('{}');
    calls += 1;
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end('{"error":"rate limited"}');
  });
  const { id } = await call('/api/ideas', { method: 'POST', body: { topic: 'gagal' } });
  await until(async () => (await call('/api/agents/nadia')).status.state === 'error', 'status error');
  const task = (await call('/api/agents/nadia')).tasks.find((t) => t.id === id);
  assert.equal(task.state, 'failed');
  assert.match(task.error, /429/);
  assert.ok(calls > before);
  await call(`/api/tasks/${id}/retry`, { method: 'POST' });
});
