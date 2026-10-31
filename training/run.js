// Gives each exercise in latihan/ to its agent, grades the fix with the exercise's check.js,
// and lets the agent try once more with the failing checks. A lesson goes into the agent's
// coaching notes whenever it missed on the first try, so it carries over to real projects.
//
//   node training/run.js            every exercise
//   node training/run.js lvl3 lvl4  only folders whose name contains "lvl3" or "lvl4"
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { personaPrompt } from '../server/agents.js';
import { addNote } from '../server/coaching.js';
import { db } from '../server/db.js';
import { chat } from '../server/llm.js';
import { listFiles, parseFiles } from './lib.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXERCISES = join(HERE, 'latihan');
// LATIHAN_TAG keeps side-by-side runs apart, e.g. the same exercises with different models.
const RESULTS = join(HERE, 'hasil', process.env.LATIHAN_TAG ?? '');
const DEFAULT_ATTEMPTS = 2;
// Files the agent sees but never gets to overwrite.
const PRIVATE = new Set(['check.js', 'meta.json']);

const FILE_RULES = `Tulis setiap file yang kamu ubah dengan format persis seperti ini:
=== FILE: path/relatif.ext ===
isi file lengkap
=== END FILE ===
Jangan pakai markdown code fence di dalam blok file. Tulis file UTUH, jangan dipotong atau "...".
Setelah semua file, tulis 1-3 kalimat: akar masalahnya apa dan apa yang kamu ubah.`;

function grade(exerciseDir, workDir) {
  const run = spawnSync(process.execPath, [join(exerciseDir, 'check.js'), workDir], { encoding: 'utf8', timeout: 30_000 });
  const output = `${run.stdout}${run.stderr}`.trim();
  return { passed: run.status === 0, output: output || `check.js gak jalan (${run.error?.message ?? run.status})` };
}

async function train(name) {
  const exerciseDir = join(EXERCISES, name);
  const meta = JSON.parse(readFileSync(join(exerciseDir, 'meta.json'), 'utf8'));
  const workDir = join(RESULTS, name);
  rmSync(workDir, { recursive: true, force: true });
  cpSync(exerciseDir, workDir, { recursive: true, filter: (src) => !PRIVATE.has(src.split(sep).pop()) });

  const before = grade(exerciseDir, workDir);
  const log = [`## ${meta.title} (${meta.agent})`, '', `Folder: latihan/${name}`, '', 'Sebelum dibenerin:', '```', before.output, '```'];
  let feedback = '';
  let result = { passed: false, output: '' };
  let attempt = 0;

  const attempts = meta.attempts ?? DEFAULT_ATTEMPTS;
  while (attempt < attempts && !result.passed) {
    attempt++;
    const files = listFiles(workDir).filter((p) => p !== 'TASK.md' && !p.startsWith('node_modules'));
    const answer = await chat({
      agentId: meta.agent,
      system: personaPrompt(meta.agent),
      maxTokens: 8000,
      prompt: `Latihan perbaikan dari bos.

${readFileSync(join(workDir, 'TASK.md'), 'utf8')}

File proyek:
${files.map((p) => `=== FILE: ${p} ===\n${readFileSync(join(workDir, p), 'utf8')}\n=== END FILE ===`).join('\n\n')}
${feedback}
Cari akar masalahnya dan benerin. ${FILE_RULES}`,
    });

    const changed = parseFiles(answer, PRIVATE);
    for (const file of changed) {
      const target = join(workDir, file.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.content);
    }
    // Simulated services (payment gateway, WhatsApp) stay as written, whatever the agent sent back.
    for (const path of meta.locked ?? []) cpSync(join(exerciseDir, path), join(workDir, path));
    result = grade(exerciseDir, workDir);
    const explanation = answer.replace(/=== FILE:[\s\S]*?=== END FILE ===/g, '').trim();
    log.push('', `Percobaan ${attempt}: ${result.passed ? 'LULUS' : 'BELUM'} (file diubah: ${changed.map((f) => f.path).join(', ') || 'gak ada'})`,
      '', `Penjelasan ${meta.agent}: ${explanation.slice(0, 600) || '-'}`, '```', result.output, '```');
    feedback = `\nPercobaan kamu sebelumnya belum lulus. Hasil pengecekan:\n${result.output}\nPerbaiki yang masih GAGAL tanpa merusak yang udah LULUS.\n`;
  }

  const lesson = `Latihan "${meta.title}": ${meta.lesson}`;
  // One note per lesson: failing the same exercise again must not push the owner's notes out of the prompt.
  const known = db.prepare('SELECT 1 FROM agent_feedback WHERE agent_id = ? AND note = ?').get(meta.agent, lesson);
  if ((attempt > 1 || !result.passed) && !known) addNote(meta.agent, { rating: 'down', note: lesson });
  log.push('', `Hasil: ${result.passed ? (attempt === 1 ? 'lulus di percobaan pertama' : `lulus di percobaan ${attempt}, pelajarannya dicatat`) : 'belum lulus, pelajarannya dicatat'}`, '');
  return { name, agent: meta.agent, title: meta.title, passed: result.passed, attempt, log: log.join('\n') };
}

const args = process.argv.slice(2);
const onlyUnpassed = args.includes('--sisa');
const reportName = args.find((a) => a.startsWith('--laporan='))?.slice('--laporan='.length) ?? 'laporan.md';
const filters = args.filter((a) => !a.startsWith('--'));
const statusFile = join(RESULTS, 'status.json');
const status = existsSync(statusFile) ? JSON.parse(readFileSync(statusFile, 'utf8')) : {};
const names = readdirSync(EXERCISES)
  .filter((n) => (!filters.length || filters.some((f) => n.includes(f))) && existsSync(join(EXERCISES, n, 'meta.json')))
  .filter((n) => !onlyUnpassed || !status[n])
  .sort();
mkdirSync(RESULTS, { recursive: true });
const report = join(RESULTS, reportName);
writeFileSync(report, `# Laporan latihan IT\n\n${new Date().toLocaleString('id-ID')}\n\n`);

const summary = [];
for (const name of names) {
  console.log(`> ${name}`);
  let outcome;
  try {
    outcome = await train(name);
  } catch (err) {
    outcome = { name, agent: '?', title: name, passed: false, attempt: 0, log: `## ${name}\n\nGagal jalan: ${err.message}\n` };
  }
  appendFileSync(report, `${outcome.log}\n`);
  summary.push(outcome);
  status[name] = status[name] || outcome.passed;
  writeFileSync(statusFile, `${JSON.stringify(status, null, 2)}
`);
  console.log(`  ${outcome.passed ? 'LULUS' : 'BELUM'} (${outcome.agent}, percobaan ${outcome.attempt})`);
}

const table = summary.map((s) => `| ${s.title} | ${s.agent} | ${s.passed ? 'lulus' : 'belum'} | ${s.attempt} |`).join('\n');
appendFileSync(report, `## Ringkasan\n\n| Latihan | Agent | Hasil | Percobaan |\n|---|---|---|---|\n${table}\n`);
console.log(`Laporan: ${report}`);
console.log(`Sisa belum lulus: ${Object.keys(status).filter((n) => !status[n]).length}`);
