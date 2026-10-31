// Office missions: a half-built project and the boss's messages in a team chat, one agent at a
// time. Each agent sees the project as the previous ones left it plus the whole chat, does its
// part, and reports back. The boss checks the work and sends revisions until it holds up or the
// agent runs out of tries (then kunci/<step>/ stands in as a senior's fix); a lesson lands in the
// agent's coaching notes whenever it needed one. Agents never see kunci/ or check.js.
//
//   node training/misi.js              every mission
//   node training/misi.js 01           only missions whose folder contains "01"
//   MISI_TAG=x node training/misi.js   results go to hasil/misi/<folder>-x
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getAgent, personaPrompt } from '../server/agents.js';
import { addNote } from '../server/coaching.js';
import { db } from '../server/db.js';
import { chat, modelFor } from '../server/llm.js';
import { listFiles, parseFiles, unclosedFiles } from './lib.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MISSIONS = join(HERE, 'misi');
const RESULTS = join(HERE, 'hasil', 'misi');
const ATTEMPTS = 3;
const FILES_BUDGET = 40_000;
const CHAT_BUDGET = 8_000;

const FILE_RULES = `Tulis setiap file yang kamu ubah atau bikin dengan format persis seperti ini:
=== FILE: path/relatif/ke/proyek.ext ===
isi file lengkap
=== END FILE ===
Jangan pakai markdown code fence di dalam blok file. Tulis file UTUH, jangan dipotong atau "...". File yang gak berubah gak usah ditulis.
Setelah semua file, tulis laporan ke bos di grup (2-4 kalimat, tanpa basa-basi): apa yang kamu kerjain dan apa yang perlu bos atau tim tahu.`;

const name = (agentId) => getAgent(agentId)?.name ?? agentId;

function projectFiles(root) {
  let used = 0;
  return listFiles(root).filter((p) => !p.endsWith('.db')).map((path) => {
    const text = readFileSync(join(root, path), 'utf8');
    const slice = text.slice(0, Math.max(0, FILES_BUDGET - used));
    used += slice.length;
    return `=== FILE: ${path} ===\n${slice}${slice.length < text.length ? '\n...(dipotong)' : ''}\n=== END FILE ===`;
  }).join('\n\n');
}

function chatText(messages) {
  const lines = messages.map((m) => `${m.from}${m.to ? ` → ${m.to}` : ''}: ${m.text}`);
  let text = lines.join('\n\n');
  // Keep the newest messages when the chat gets long.
  while (text.length > CHAT_BUDGET && lines.length > 1) text = (lines.shift(), lines.join('\n\n'));
  return text;
}

/** Copies a teammate's changed files into the project and returns them as a unified diff. */
function applyChange(changeDir, workDir) {
  const empty = join(RESULTS, '.kosong');
  writeFileSync(empty, '');
  const diffs = listFiles(changeDir).map((path) => {
    const before = join(workDir, path);
    const run = spawnSync('git', ['diff', '--no-index', '--no-color', '-U4', existsSync(before) ? before : empty, join(changeDir, path)], { encoding: 'utf8' });
    // git prints absolute paths; the agent only needs the project path.
    return run.stdout.split('\n').filter((l) => !/^(diff --git|index |--- |\+\+\+ )/.test(l)).join('\n')
      .replace(/^/, `--- ${path} (sebelum)\n+++ ${path} (sesudah)\n`);
  });
  cpSync(changeDir, workDir, { recursive: true });
  return diffs.join('\n');
}

function remember(agentId, lesson, title) {
  const note = `Misi "${title}": ${lesson}`;
  const known = db.prepare('SELECT 1 FROM agent_feedback WHERE agent_id = ? AND note = ?').get(agentId, note);
  if (!known) addNote(agentId, { rating: 'down', note });
}

async function runMission(folder) {
  const missionDir = join(MISSIONS, folder);
  const brief = JSON.parse(readFileSync(join(missionDir, 'arahan.json'), 'utf8'));
  const { grade } = await import(pathToFileURL(join(missionDir, 'check.js')).href);
  // MISI_TAG keeps runs apart, e.g. the same mission tried with different models side by side.
  const out = process.env.MISI_TAG ? `${folder}-${process.env.MISI_TAG}` : folder;
  const workDir = join(RESULTS, out, 'proyek');
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(dirname(workDir), { recursive: true });
  cpSync(join(missionDir, 'proyek'), workDir, { recursive: true });
  // Raw answers, to tell a wrong fix from a reply that got cut off.
  const answersDir = join(RESULTS, out, 'jawaban');
  rmSync(answersDir, { recursive: true, force: true });
  mkdirSync(answersDir, { recursive: true });

  const messages = [];
  const outcomes = [];

  for (const step of brief.steps) {
    const agent = name(step.agent);
    // A step can start from a known-good snapshot, the way a team builds on what was released.
    if (step.base) {
      rmSync(workDir, { recursive: true, force: true });
      cpSync(join(missionDir, step.base), workDir, { recursive: true });
    }
    // A teammate's change lands in the project, and its diff goes along with the boss's message.
    const diff = step.apply ? applyChange(join(missionDir, step.apply), workDir) : '';
    for (const line of step.chat ?? []) messages.push(line);
    messages.push({ from: 'Bos', to: agent, text: step.message });
    console.log(`> ${step.id} (${agent})`);
    let result = { passed: false, output: '' };
    let attempt = 0;

    while (attempt < ATTEMPTS && !result.passed) {
      attempt++;
      const answer = await chat({
        agentId: step.agent,
        system: personaPrompt(step.agent),
        maxTokens: 12_000,
        prompt: `Kamu lagi kerja di proyek tim: ${brief.name}.
Tentang bisnisnya: ${brief.business}

Grup chat tim (paling lama di atas):
${chatText(messages)}

Yang harus kamu kerjain sekarang: pesan terakhir dari Bos buat kamu (${agent}).
${diff && `\nLampiran: diff perubahan yang masuk (sebelum -> sesudah):\n${diff}\n`}
File proyek saat ini:
${projectFiles(workDir)}

${FILE_RULES}`,
      });

      writeFileSync(join(answersDir, `${step.id}-${attempt}.txt`), answer);
      const files = parseFiles(answer);
      const unclosed = unclosedFiles(answer);
      for (const file of files) {
        const target = join(workDir, file.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, file.content);
      }
      // Whatever is left once the files are taken out is the agent's message to the group.
      const report = answer.replace(/=== FILE:[\s\S]*?=== END FILE[^\n]*===/g, '').replace(/=== FILE:[\s\S]*$/, '').trim().slice(0, 1200);
      messages.push({ from: agent, text: `${report || '(gak ada laporan)'}\n[file: ${files.map((f) => f.path).join(', ') || 'gak ada'}]` });

      result = await grade(step.id, workDir);
      console.log(`  percobaan ${attempt}: ${result.passed ? 'beres' : 'belum'}${unclosed.length ? ` (file gak kebaca: ${unclosed.join(', ')})` : ''}`);
      if (result.passed) {
        messages.push({ from: 'Bos', to: agent, text: 'Oke, udah aku cek, beres. Makasih.' });
      } else {
        const failed = result.output.split('\n').filter((l) => l.startsWith('GAGAL')).map((l) => `- ${l.slice(7)}`).join('\n');
        const cutOff = unclosed.length
          ? `File ${unclosed.join(', ')} yang kamu kirim gak kebaca: bloknya gak ditutup "=== END FILE ===" (kayaknya kepotong), jadi yang aku cek masih versi lama. Kirim ulang file itu utuh, cukup file yang berubah.\n`
          : '';
        messages.push({
          from: 'Bos',
          to: agent,
          text: attempt < ATTEMPTS
            ? `${cutOff}Udah aku cek, masih ada yang belum beres:\n${failed}\nTolong benerin, yang udah jalan jangan dirusak.`
            : `${cutOff}Masih belum beres juga:\n${failed}`,
        });
      }
    }

    // Someone stuck after every try gets a senior's fix, so the next person builds on working
    // ground and is judged on their own part, not on the mess they inherited.
    let rescued = false;
    const keyDir = join(missionDir, 'kunci', step.id);
    if (!result.passed && existsSync(keyDir)) {
      cpSync(keyDir, workDir, { recursive: true });
      rescued = (await grade(step.id, workDir)).passed;
      messages.push({
        from: 'Bos',
        to: agent,
        text: `Bagian ini aku minta senior benerin dulu biar tim bisa lanjut (${listFiles(keyDir).join(', ')}). ${agent}, nanti pelajarin bedanya sama punyamu ya.`,
      });
    }

    if (attempt > 1 || !result.passed) remember(step.agent, step.lesson, brief.name);
    outcomes.push({ step: step.id, agent, passed: result.passed, rescued, attempt, output: result.output });
  }

  const transcript = messages.map((m) => `**${m.from}${m.to ? ` → ${m.to}` : ''}:**\n${m.text}`).join('\n\n---\n\n');
  const verdict = (o) => (o.passed ? 'beres' : o.rescued ? 'belum, dibenerin senior' : 'belum');
  const table = outcomes.map((o) => `| ${o.step} | ${o.agent} | ${verdict(o)} | ${o.attempt} |`).join('\n');
  const finalChecks = outcomes.at(-1)?.output ?? '';
  const report = join(RESULTS, `${out}.md`);
  writeFileSync(report, `# Misi: ${brief.name}

${new Date().toLocaleString('id-ID')}

| Arahan | Agent | Hasil | Percobaan |
|---|---|---|---|
${table}

Model: ${[...new Set(brief.steps.map((s) => s.agent))].map((a) => `${name(a)} = ${modelFor(a)}`).join(", ")}

Hasil kerja tim: hasil/misi/${out}/proyek

## Pengecekan akhir (review Bayu)

\`\`\`
${finalChecks}
\`\`\`

## Grup chat

${transcript}
`);
  console.log(`Laporan: ${report}`);
  return outcomes;
}

const filters = process.argv.slice(2);
const folders = readdirSync(MISSIONS)
  .filter((f) => existsSync(join(MISSIONS, f, 'arahan.json')) && (!filters.length || filters.some((x) => f.includes(x))))
  .sort();
for (const folder of folders) await runMission(folder);
