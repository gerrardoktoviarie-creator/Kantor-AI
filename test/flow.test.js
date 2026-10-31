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
  if (prompt.includes('Topik rapat:')) {
    return JSON.stringify({
      lines: [
        { agent: 'bayu', text: 'MVP dulu, fitur lain nyusul.' },
        { agent: 'ghost', text: 'Aku gak diundang.' },
        { agent: 'sari', text: 'Kalau tampilannya jelek, gak ada yang mau pakai.' },
      ],
      summary: 'Bikin versi kecil dulu.',
      plan: ['Riset', 'Bangun'],
      due: '2099-01-01T10:00',
      reason: 'Biar ada waktu revisi.',
      question: 'Deadline Jumat sore oke?',
    });
  }
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
// Every system + user prompt the fake model got, to check what agents are told.
const prompts = [];
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
    if (req.url === '/api/health') {
      res.end('{"ok":true}');
      return;
    }
    if (req.url.endsWith('/models')) {
      res.end('{"data":[]}');
      return;
    }
    calls += 1;
    const { messages } = JSON.parse(body);
    prompts.push(messages.map((m) => m.content).join('\n'));
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

// Projects wait for a meeting and your ACC before the team starts.
async function accProject(id) {
  const meeting = await until(async () => (await call('/api/meetings')).pending
    .find((m) => m.kind === 'project' && m.refId === id && m.state === 'asking'), 'rapat proyek');
  await call(`/api/meetings/${meeting.id}/approve`, { method: 'POST', body: { due: meeting.proposal.due } });
  return meeting;
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
  // The first answer comes before the 9router probe finishes; the next polls carry its result.
  assert.ok(['checking', 'up'].includes(office.health.state));
  await until(async () => (await call('/api/office')).health.ok, 'cek 9router');
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
  assert.equal((await call('/api/projects')).projects.find((p) => p.id === id).state, 'proposed');
  const meeting = await accProject(id);
  assert.deepEqual(meeting.agents, ['bayu', 'nadia', 'tari', 'fajar']);
  assert.ok(meeting.lines.every((l) => meeting.agents.includes(l.agent)), 'cuma peserta rapat yang ngomong');
  assert.equal(meeting.proposal.question, 'Deadline Jumat sore oke?');
  const done = await until(async () => (await call('/api/projects')).projects.find((p) => p.id === id && p.state === 'done'), 'pipeline IT', 20_000);
  assert.equal(done.previewUrl, `/preview/${slug}/`);
  assert.ok(existsSync(join(workspace, 'projects', slug, 'docs', 'catatan.md')));

  const preview = await fetch(`${base}/preview/${slug}/`);
  assert.equal(preview.status, 200);
  assert.match(await preview.text(), /<title>x<\/title>/);

  const owners = (await call('/api/tasks')).filter((t) => t.kind === 'it.step' && t.payload.projectId === id).map((t) => t.agentId);
  assert.deepEqual(owners.sort(), ['bayu', 'fajar', 'joko', 'nadia', 'rani', 'tari']);
  assert.ok(done.dueAt, 'deadline yang di-ACC ikut kesimpan di proyek');
});

test('rating a step coaches the agent on the next job', async () => {
  const { projects } = await call('/api/projects');
  const project = projects.find((p) => p.name === 'Booking Padel');
  await assert.rejects(call(`/api/projects/${project.id}/rate`, { method: 'POST', body: { step: 'frontend', rating: 'down' } }), /catatan/);

  const { ratings } = await call(`/api/projects/${project.id}/rate`, { method: 'POST', body: { step: 'frontend', rating: 'up', note: 'tombolnya gede, enak di HP' } });
  assert.equal(ratings.frontend, 'up');
  await call('/api/coaching/rani/sop', { method: 'PUT', body: { text: 'Selalu pakai font Barlow.' } });

  const rani = await call('/api/coaching/rani');
  assert.deepEqual(rani.score, { up: 1, down: 0 });
  assert.equal(rani.examples.length, 1);
  assert.equal(rani.sopIsDefault, false);

  const before = prompts.length;
  await call(`/api/projects/${project.id}/revise`, { method: 'POST', body: { step: 'frontend', note: 'warna tombol' } });
  await until(async () => (await call('/api/projects')).projects.find((p) => p.id === project.id && p.state === 'done'), 'revisi Rani');
  const ranisPrompt = prompts.slice(before).find((p) => p.includes('Tugas kamu (Frontend)'));
  assert.match(ranisPrompt, /Selalu pakai font Barlow/);
  assert.match(ranisPrompt, /\[bagus\] tombolnya gede, enak di HP/);
  assert.match(ranisPrompt, /Contoh hasil kerjamu yang disukai bos/);
  assert.match(ranisPrompt, /Booking Padel · Frontend/);

  // Back to the built-in SOP; the other agents never saw Rani's notes.
  await call('/api/coaching/rani/sop', { method: 'PUT', body: { text: '' } });
  assert.equal((await call('/api/coaching/rani')).sopIsDefault, true);
  assert.equal((await call('/api/coaching/bayu')).notes.length, 0);

  await call('/api/coaching/sari/notes', { method: 'POST', body: { rating: 'up', note: 'hook-nya mantap' } });
  assert.equal((await call('/api/coaching/sari')).notes[0].note, 'hook-nya mantap');
  await assert.rejects(call('/api/coaching/sari/notes', { method: 'POST', body: { rating: 'up' } }), /catatannya/);
});

test('a rejected project never starts', async () => {
  const { id } = await call('/api/projects', { method: 'POST', body: { name: 'Gak Jadi', kind: 'website', brief: 'tes tolak' } });
  const meeting = await until(async () => (await call('/api/meetings')).pending.find((m) => m.refId === id && m.state === 'asking'), 'rapat');
  await call(`/api/meetings/${meeting.id}/reject`, { method: 'POST', body: { note: 'nanti aja' } });
  assert.equal((await call('/api/projects')).projects.find((p) => p.id === id), undefined);
  assert.ok(!(await call('/api/tasks')).some((t) => t.kind === 'it.step' && t.payload.projectId === id));
  await assert.rejects(call(`/api/meetings/${meeting.id}/approve`, { method: 'POST', body: { due: meeting.proposal.due } }), /409/);
});

test('a topic meeting asks for a deadline, then tracks it until done', async () => {
  const { id } = await call('/api/meetings', { method: 'POST', body: { topic: 'Promo 11.11: diskon atau gratis ongkir?' } });
  const meeting = await until(async () => (await call('/api/meetings')).pending.find((m) => m.id === id && m.state === 'asking'), 'debat');
  assert.deepEqual(meeting.agents, ['sari', 'bayu', 'mira']);
  assert.equal(meeting.chair, 'sari');

  await assert.rejects(call(`/api/meetings/${id}/approve`, { method: 'POST', body: { due: '2020-01-01T00:00:00Z' } }), /udah lewat/);
  const due = new Date(Date.now() + 2 * 86_400_000).toISOString();
  await call(`/api/meetings/${id}/approve`, { method: 'POST', body: { due, note: 'gas' } });
  const { active, pending } = await call('/api/meetings');
  assert.ok(!pending.some((m) => m.id === id));
  assert.equal(active.find((m) => m.id === id).dueAt, due);

  await call(`/api/meetings/${id}/done`, { method: 'POST' });
  assert.ok(!(await call('/api/meetings')).active.some((m) => m.id === id));
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
  await accProject(id);
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

  // Background song: upload, cut a clip with it, and the result has the song under the voice.
  const songSrc = join(workspace, 'lagu.mp3');
  const madeSong = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=6', songSrc]);
  assert.equal(madeSong.status, 0, madeSong.stderr?.toString());
  const songUpload = await fetch(`${base}/api/songs?name=Lagu%20Senja.mp3`, { method: 'PUT', body: readFileSync(songSrc) });
  assert.equal(songUpload.status, 201);
  const song = await songUpload.json();
  assert.equal(song.name, 'Lagu Senja');
  assert.ok(Math.abs(song.duration - 6) < 0.5);
  assert.equal((await fetch(base + song.url)).status, 200);

  const junk = await fetch(`${base}/api/songs?name=rusak.mp3`, { method: 'PUT', body: 'bukan lagu' });
  assert.equal(junk.status, 400);
  assert.equal((await call('/api/songs')).length, 1, 'file rusak gak ikut kesimpan');
  await assert.rejects(call(`/api/videos/${id}/clips`, { method: 'POST', body: { start: 0, end: 16, title: 'x', songId: song.id, songStart: 9 } }), /Mulai lagu/);

  await call(`/api/videos/${id}/clips`, { method: 'POST', body: { start: 0, end: 16, title: 'Pakai lagu', layout: 'original', songId: song.id, songMode: 'mix', songVolume: 40 } });
  await assert.rejects(call(`/api/songs/${song.id}`, { method: 'DELETE' }), /409/);
  const withSong = await until(async () => (await call('/api/videos')).find((v) => v.id === id).clips.find((x) => x.title === 'Pakai lagu' && x.state === 'done'), 'klip berlagu', 30_000);
  assert.deepEqual(withSong.song, { name: 'Lagu Senja', mode: 'mix', volume: 40 });
  const songProbe = spawnSync(ffmpeg, ['-hide_banner', '-i', join(workspace, 'clips', withSong.url.split('/').at(-1))]).stderr.toString();
  assert.match(songProbe, /Duration: 00:00:16/);
  assert.match(songProbe, /Audio: aac/);

  await call(`/api/songs/${song.id}`, { method: 'DELETE' });
  assert.equal((await call('/api/videos')).find((v) => v.id === id).clips.find((x) => x.title === 'Pakai lagu').song.name, 'lagu yang udah dihapus');

  // A pure tone usually yields no words; either way the subtitle request must be handled honestly.
  if (!video.hasTranscript) {
    await assert.rejects(call(`/api/videos/${id}/clips`, { method: 'POST', body: { start: 0, end: 16, title: 's', subtitles: true } }), /transkrip/);
  }
});

test('failed tasks surface on the agent and can be retried', async () => {
  const before = calls;
  llm.removeAllListeners('request');
  llm.on('request', (req, res) => {
    if (req.url === '/api/health' || req.url.endsWith('/models')) return res.end('{}');
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
