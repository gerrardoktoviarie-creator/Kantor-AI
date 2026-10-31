import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { WORKSPACE } from './config.js';
import { db, parseJson } from './db.js';
import { enqueue, getAgent, holdMeeting, personaPrompt, registerHandler, listTasks } from './agents.js';
import { examplesPrompt, ratingsFor, rateWork } from './coaching.js';
import { chat, chatJson } from './llm.js';
import { HttpError, readJson, requireText, safeJoin, sendJson, toId } from './http.js';
import { checkRunnable, isRunning, logsText, runInfo, startProject, stopProject } from './runner.js';
import { callMeeting, onDecision } from './meetings.js';

export const PROJECT_DIR = join(WORKSPACE, 'projects');

const KINDS = { website: 'Website', app: 'Web app (ada login/data)' };

// Order matters: each step reads what the previous ones wrote.
export const STEPS = [
  {
    id: 'research', agent: 'nadia', label: 'Riset',
    task: 'Riset kebutuhan: siapa penggunanya, masalah yang diselesaikan, fitur inti (MVP) vs nanti, contoh kompetitor/inspirasi, dan risiko. Simpan di docs/01-riset.md.',
  },
  {
    id: 'design', agent: 'tari', label: 'Desain',
    task: 'Rancang UI: daftar halaman, alur pengguna, layout tiap halaman (sketsa ASCII boleh), palet warna (hex, kontras teks >= 4.5:1), font, dan komponen. Simpan di docs/02-desain.md.',
  },
  {
    id: 'database', agent: 'joko', label: 'Database',
    task: 'Rancang data: tabel/kolom/relasi untuk SQLite. Tulis db/schema.sql (CREATE TABLE IF NOT EXISTS + data contoh secukupnya) dan docs/03-database.md yang jelasin tiap tabel. Kalau proyeknya website statis tanpa data, bikin data/content.json saja dan jelaskan alasannya.',
  },
  {
    id: 'backend', agent: 'fajar', label: 'Backend',
    task: 'Tulis backend Node.js (>= 22, tanpa library luar, pakai node:http dan node:sqlite) di server.js yang menyajikan folder public/ dan API JSON sesuai desain database. WAJIB dengerin port dari process.env.PORT (default 3000) dan tulis "Server jalan di port X" ke console saat siap. Database SQLite disimpan di file data.db di folder proyek dan tabelnya dibuat otomatis dari db/schema.sql kalau ada. Tambahkan package.json dengan "type": "module" dan script "start". Kalau proyeknya website statis, cukup server.js yang menyajikan public/.',
  },
  {
    id: 'frontend', agent: 'rani', label: 'Frontend',
    task: 'Tulis frontend di public/: index.html, style.css, app.js (HTML semantik, CSS pakai custom properties, JS modul tanpa framework, responsif mobile). Ikuti desain dan pakai API backend kalau ada. Tampilan harus bisa dibuka langsung walau API belum jalan (pakai data contoh sebagai cadangan).',
  },
  {
    id: 'review', agent: 'bayu', label: 'Review',
    task: 'Review semua file: cari bug, bagian yang belum nyambung antara frontend dan backend, lalu tulis README.md (cara jalanin, struktur folder, apa yang sudah dan belum jadi). Kalau ada bug kecil yang jelas, perbaiki dengan menulis ulang file itu utuh.',
  },
];

const FILE_RULES = `Tulis setiap file dengan format persis seperti ini (boleh beberapa file):
=== FILE: path/relatif/ke/root-proyek.ext ===
isi file lengkap
=== END FILE ===
Jangan pakai markdown code fence di dalam blok file. Tulis file UTUH, jangan dipotong atau "...".`;

export function parseFiles(text) {
  const files = [];
  const pattern = /=== FILE: (.+?) ===\r?\n([\s\S]*?)\r?\n=== END FILE ===/g;
  for (const [, rawPath, content] of text.matchAll(pattern)) {
    const path = rawPath.trim().replace(/\\/g, '/').replace(/^\.?\//, '');
    if (!path || path.includes('..') || /^[a-z]:/i.test(path)) continue;
    files.push({ path, content: stripFence(content) });
  }
  return files;
}

function stripFence(content) {
  const m = content.match(/^```[\w-]*\n([\s\S]*?)\n```\s*$/);
  return m ? m[1] : content;
}

export function slugify(name) {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 40) || 'proyek';
  let slug = base;
  for (let n = 2; db.prepare('SELECT 1 FROM projects WHERE slug = ?').get(slug); n++) slug = `${base}-${n}`;
  return slug;
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(full);
      } else {
        out.push({ path: relative(root, full).split(sep).join('/'), size: statSync(full).size });
      }
    }
  };
  walk(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

// Earlier steps' output, trimmed so free models with ~64k context still fit.
function projectContext(root, budget = 24_000) {
  let used = 0;
  const parts = [];
  for (const file of listFiles(root)) {
    if (used >= budget) {
      parts.push(`(file lain dipotong: ${file.path})`);
      continue;
    }
    const text = readFileSync(join(root, file.path), 'utf8');
    const slice = text.slice(0, Math.max(0, budget - used));
    used += slice.length;
    parts.push(`=== FILE: ${file.path} ===\n${slice}${slice.length < text.length ? '\n...(dipotong)' : ''}\n=== END FILE ===`);
  }
  return parts.join('\n\n') || '(belum ada file)';
}

registerHandler('it.step', async (task) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(task.payload.projectId);
  if (!project) throw new Error('Proyek udah dihapus.');
  const step = STEPS.find((s) => s.id === task.payload.step);
  const root = join(PROJECT_DIR, project.slug);
  mkdirSync(root, { recursive: true });

  const text = await chat({
    agentId: step.agent,
    system: personaPrompt(step.agent),
    maxTokens: 12_000,
    prompt: `Proyek: ${project.name} (${KINDS[project.kind]})
Brief dari pemilik: ${project.brief}
${task.payload.note ? `\nCatatan revisi untuk bagianmu: ${task.payload.note}\n` : ''}
Tugas kamu (${step.label}): ${step.task}

File yang sudah ada dari tim:
${projectContext(root)}

${examplesPrompt(step.agent)}

${FILE_RULES}`,
  });

  const files = parseFiles(text);
  if (!files.length) throw new Error(`${step.label}: model gak ngirim file sama sekali. Coba ulang.`);
  for (const file of files) {
    const target = safeJoin(root, file.path);
    if (!target) continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content);
  }

  const next = STEPS[STEPS.findIndex((s) => s.id === step.id) + 1];
  if (next && !task.payload.only) {
    db.prepare('UPDATE projects SET step = ? WHERE id = ?').run(next.id, project.id);
    enqueue(next.agent, 'it.step', `${next.label}: ${project.name}`, { projectId: project.id, step: next.id });
    return { result: { files: files.map((f) => f.path) } };
  }

  db.prepare("UPDATE projects SET step = NULL, state = 'done' WHERE id = ?").run(project.id);
  return { result: { files: files.map((f) => f.path) }, review: `Proyek "${project.name}" siap dicek` };
});

registerHandler('it.fix', async (task) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(task.payload.projectId);
  if (!project) throw new Error('Proyek udah dihapus.');
  const root = join(PROJECT_DIR, project.slug);
  const wasRunning = isRunning(project.id);
  // A failed fix must not leave the project looking busy forever.
  const release = () => db.prepare("UPDATE projects SET state = 'done', step = NULL WHERE id = ?").run(project.id);

  const text = await chat({
    agentId: 'bayu',
    system: personaPrompt('bayu'),
    maxTokens: 12_000,
    prompt: `Proyek: ${project.name}
Brief: ${project.brief}

Server proyek ini dijalankan dengan "node server.js" (PORT dari process.env.PORT) dan ada masalah.
${task.payload.note ? `Keluhan dari bos: ${task.payload.note}\n` : ''}
Log server terakhir:
${task.payload.logs || '(kosong)'}

File proyek:
${projectContext(root, 30_000)}

Cari penyebabnya dan perbaiki. Tulis ulang UTUH setiap file yang kamu ubah (cukup file yang berubah).
Tambahkan juga file docs/perbaikan-terakhir.md berisi 2-5 kalimat: apa masalahnya dan apa yang kamu ubah.

${FILE_RULES}`,
  }).catch((err) => {
    release();
    throw err;
  });

  const files = parseFiles(text);
  if (!files.length) {
    release();
    throw new Error('Bayu gak ngirim perbaikan apa-apa. Coba ulang.');
  }
  for (const file of files) {
    const target = safeJoin(root, file.path);
    if (!target) continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content);
  }
  release();

  if (wasRunning) {
    const info = await startProject(project.id, root);
    if (info.state !== 'running') {
      return { result: { files: files.map((f) => f.path) }, review: `Bayu udah benerin "${project.name}" tapi server-nya masih error` };
    }
  }
  return { result: { files: files.map((f) => f.path) }, review: `Bayu udah benerin "${project.name}"` };
});

registerHandler('it.ideas', async (task) => {
  const ideas = await chatJson({
    agentId: 'nadia',
    system: personaPrompt('nadia'),
    maxTokens: 3000,
    prompt: `Cari 5 ide baru seputar: ${task.payload.topic}
Untuk tiap ide kasih: judul, masalah yang diselesaikan, cara kerja singkat, kenapa sekarang, dan langkah pertama yang bisa dikerjain minggu ini.
Jawab HANYA JSON: { "ideas": [ { "title": "", "problem": "", "how": "", "why_now": "", "first_step": "" } ] }`,
  });
  if (!Array.isArray(ideas?.ideas)) throw new Error('Format ide dari model gak sesuai.');
  return { result: ideas, review: `${ideas.ideas.length} ide baru soal "${task.payload.topic.slice(0, 30)}"` };
});

function toProject(row) {
  const root = join(PROJECT_DIR, row.slug);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    brief: row.brief,
    step: row.step,
    state: row.state,
    files: listFiles(root),
    previewUrl: existsSync(join(root, 'public', 'index.html')) ? `/preview/${row.slug}/` : null,
    hasServer: existsSync(join(root, 'server.js')),
    run: runInfo(row.id),
    failure: lastFailure(row.id),
    ratings: ratingsFor('project', row.id),
    dueAt: db.prepare("SELECT due_at FROM meetings WHERE kind = 'project' AND ref_id = ? ORDER BY id DESC LIMIT 1").get(row.id)?.due_at ?? null,
  };
}

function lastFailure(projectId) {
  const task = db.prepare(`SELECT id, state, error FROM tasks
    WHERE kind IN ('it.step', 'it.fix') AND json_extract(payload, '$.projectId') = ?
    ORDER BY id DESC LIMIT 1`).get(projectId);
  return task?.state === 'failed' ? { taskId: task.id, error: task.error } : null;
}

function kickoff(projectId) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project || project.state !== 'proposed') return;
  const first = STEPS[0];
  db.prepare("UPDATE projects SET state = 'running' WHERE id = ?").run(projectId);
  holdMeeting(STEPS.map((s) => s.agent), `Kickoff: ${project.name}`);
  enqueue(first.agent, 'it.step', `${first.label}: ${project.name}`, { projectId, step: first.id });
}

onDecision('project', {
  approve: kickoff,
  // Nothing was written yet, so a rejected project just goes away.
  reject: (projectId) => db.prepare("DELETE FROM projects WHERE id = ? AND state = 'proposed'").run(projectId),
  isDone: (projectId) => db.prepare('SELECT state FROM projects WHERE id = ?').get(projectId)?.state === 'done',
});

export function registerItRoutes(router) {
  router.get('/api/projects', (req, res) => {
    sendJson(res, 200, {
      steps: STEPS.map(({ id, agent, label }) => {
        const { name, role, look } = getAgent(agent);
        return { id, agent, label, name, role, look };
      }),
      projects: db.prepare('SELECT * FROM projects ORDER BY id DESC').all().map(toProject),
    });
  });

  router.post('/api/projects', async (req, res) => {
    const body = await readJson(req);
    const name = requireText(body.name, 'Nama proyek', 80);
    const brief = requireText(body.brief, 'Brief', 4000);
    const kind = KINDS[body.kind] ? body.kind : 'website';
    const slug = slugify(name);
    const { lastInsertRowid } = db.prepare(
      "INSERT INTO projects (slug, name, kind, brief, step, state) VALUES (?, ?, ?, ?, ?, 'proposed')",
    ).run(slug, name, kind, brief, STEPS[0].id);
    const id = Number(lastInsertRowid);
    // Bayu's team argues scope and timeline first; work starts once you ACC the deadline.
    callMeeting({
      topic: `Proyek baru: ${name}`,
      kind: 'project',
      refId: id,
      context: `Jenis: ${KINDS[kind]}
Brief dari owner: ${brief}
Tim ngerjain berurutan: ${STEPS.map((s) => s.label).join(' → ')}.`,
      agents: ['bayu', 'nadia', 'tari', 'fajar'],
    });
    sendJson(res, 201, { id, slug });
  });

  router.post('/api/projects/:id/revise', async (req, res, { id }) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(toId(id));
    if (!project) throw new HttpError(404, 'Proyek gak ketemu.');
    if (project.state !== 'done') throw new HttpError(409, 'Tim masih ngerjain proyek ini.');
    const body = await readJson(req);
    const step = STEPS.find((s) => s.id === body.step);
    if (!step) throw new HttpError(400, 'Pilih bagian yang mau direvisi.');
    const note = requireText(body.note, 'Catatan revisi', 2000);

    db.prepare("UPDATE projects SET step = ?, state = 'running' WHERE id = ?").run(step.id, project.id);
    enqueue(step.agent, 'it.step', `Revisi ${step.label.toLowerCase()}: ${project.name}`, {
      projectId: project.id, step: step.id, note, only: true,
    });
    sendJson(res, 200, { ok: true });
  });

  // Your verdict on one step. "Bagus" keeps that step's files as an example for the agent's next projects.
  router.post('/api/projects/:id/rate', async (req, res, { id }) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(toId(id));
    if (!project) throw new HttpError(404, 'Proyek gak ketemu.');
    const body = await readJson(req);
    const step = STEPS.find((s) => s.id === body.step);
    if (!step) throw new HttpError(400, 'Pilih bagian yang mau dinilai.');
    const task = db.prepare(`SELECT result FROM tasks WHERE kind = 'it.step' AND state = 'done'
      AND json_extract(payload, '$.projectId') = ? AND json_extract(payload, '$.step') = ?
      ORDER BY id DESC LIMIT 1`).get(project.id, step.id);
    if (!task) throw new HttpError(409, `Bagian ${step.label} belum dikerjain.`);

    const root = join(PROJECT_DIR, project.slug);
    const files = (parseJson(task.result, {})?.files ?? [])
      .map((path) => ({ path, file: safeJoin(root, path) }))
      .filter(({ file }) => file && existsSync(file));
    const content = files.map(({ path, file }) => `=== FILE: ${path} ===\n${readFileSync(file, 'utf8')}`).join('\n\n');
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';

    rateWork({
      agentId: step.agent,
      refKind: 'project',
      refId: project.id,
      part: step.id,
      rating: body.rating === 'up' ? 1 : body.rating === 'down' ? -1 : 0,
      note,
      example: { title: `${project.name} · ${step.label}`, content },
    });
    sendJson(res, 200, { ratings: ratingsFor('project', project.id) });
  });

  router.post('/api/projects/:id/run', async (req, res, { id }) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(toId(id));
    if (!project) throw new HttpError(404, 'Proyek gak ketemu.');
    if (project.state !== 'done') throw new HttpError(409, 'Tim masih ngerjain proyek ini.');
    const root = join(PROJECT_DIR, project.slug);
    const problem = checkRunnable(root);
    if (problem) throw new HttpError(409, problem);
    sendJson(res, 200, await startProject(project.id, root));
  });

  router.post('/api/projects/:id/stop', async (req, res, { id }) => {
    const projectId = toId(id);
    await stopProject(projectId);
    sendJson(res, 200, runInfo(projectId));
  });

  router.post('/api/projects/:id/fix', async (req, res, { id }) => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(toId(id));
    if (!project) throw new HttpError(404, 'Proyek gak ketemu.');
    if (project.state !== 'done') throw new HttpError(409, 'Tim masih ngerjain proyek ini.');
    const body = await readJson(req);
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';
    const logs = logsText(project.id);
    if (!note && !logs) throw new HttpError(400, 'Jalankan dulu servernya atau tulis masalahnya, biar Bayu tahu apa yang dibenerin.');

    db.prepare("UPDATE projects SET state = 'running', step = 'review' WHERE id = ?").run(project.id);
    enqueue('bayu', 'it.fix', `Benerin error: ${project.name}`, { projectId: project.id, note, logs });
    sendJson(res, 200, { ok: true });
  });

  router.get('/api/projects/:id/file', (req, res, { id }, url) => {
    const project = db.prepare('SELECT slug FROM projects WHERE id = ?').get(toId(id));
    if (!project) throw new HttpError(404, 'Proyek gak ketemu.');
    const target = safeJoin(join(PROJECT_DIR, project.slug), url.searchParams.get('path') || '');
    if (!target || !existsSync(target) || !statSync(target).isFile()) throw new HttpError(404, 'File gak ketemu.');
    sendJson(res, 200, { content: readFileSync(target, 'utf8') });
  });

  router.post('/api/ideas', async (req, res) => {
    const body = await readJson(req);
    const topic = requireText(body.topic, 'Topik', 500);
    const id = enqueue('nadia', 'it.ideas', `Riset ide: ${topic.slice(0, 40)}`, { topic });
    sendJson(res, 201, { id });
  });

  router.get('/api/ideas', (req, res) => {
    const ideas = listTasks({ agentId: 'nadia', limit: 30 }).filter((t) => t.kind === 'it.ideas');
    sendJson(res, 200, ideas);
  });
}
