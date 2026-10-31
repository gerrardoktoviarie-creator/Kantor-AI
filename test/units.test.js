import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NODE_ENV = 'test';

// Fake Claude Code and Hermes skill folders, so tests never read the real ones.
const skillRoot = mkdtempSync(join(tmpdir(), 'kantor-skills-'));
const writeSkill = (source, name, body) => {
  mkdirSync(join(skillRoot, source, name), { recursive: true });
  writeFileSync(join(skillRoot, source, name, 'SKILL.md'), `---\nname: ${name}\ndescription: tes ${name}\n---\n\n${body}`);
};
writeSkill('claude', 'rapi-kode', '# Rapi\nPakai nama variabel yang jelas.');
writeSkill('hermes', 'review-ketat', `# Review\n${'x'.repeat(15_000)}`);
writeSkill('hermes', 'review-lain', `# Lain\n${'y'.repeat(12_000)}`);
writeSkill('claude', 'imagegen-web', '# Gambar');
process.env.CLAUDE_SKILLS_DIR = join(skillRoot, 'claude');
process.env.HERMES_SKILLS_DIR = join(skillRoot, 'hermes');
// Set before config.js loads .env, so the owner's own choice never leaks into the tests.
process.env.LLM_AGENT_MODELS = 'bayu = model-kuat, rusak, =tanpa-agent';

const { extractJson, readSse, stripThinking, nextHealth, modelFor } = await import('../server/llm.js');
const { LLM } = await import('../server/config.js');
const { parseFiles } = await import('../server/it.js');
const { pickCandidates, parseSilences, parseDuration, musicArgs } = await import('../server/clips.js');
const { toDueIso } = await import('../server/classroom.js');
const { safeJoin } = await import('../server/http.js');
const { toWords, toLines, buildAss } = await import('../server/subtitles.js');
const { splitMessage } = await import('../server/telegram.js');
const { prayerTimes, todaySchedule } = await import('../server/prayer.js');
const { parseNumber, summarizeAds } = await import('../server/marketing.js');
const { restockSuggestion, recordMove } = await import('../server/stock.js');
const { db, setSetting } = await import('../server/db.js');
const { normalizeDebate, parseLocal, defaultDue, checkDeadlines } = await import('../server/meetings.js');
const { getStatus, personaPrompt } = await import('../server/agents.js');
const { coachingPrompt, examplesPrompt, rateWork, ratingsFor, DEFAULT_SOP, listSkills, installSkill, SKILL_BUDGET, addNote } = await import('../server/coaching.js');

test('splitMessage keeps every Telegram message under the limit without splitting a task', () => {
  const blocks = Array.from({ length: 13 }, (_, i) => `• Tugas ${i}\n  ${'x'.repeat(600)}`);
  const parts = splitMessage(`Header\n\n${blocks.join('\n\n')}`);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 3800));
  assert.equal(parts.join('\n\n'), `Header\n\n${blocks.join('\n\n')}`);
  assert.ok(splitMessage('y'.repeat(9000)).every((p) => p.length <= 3800));
});

test('toWords drops whisper non-speech markers', () => {
  const words = toWords([
    { offsets: { from: 0, to: 400 }, text: ' Halo' },
    { offsets: { from: 400, to: 900 }, text: ' [MUSIC]' },
    { offsets: { from: 900, to: 1200 }, text: ' semua.' },
  ]);
  assert.deepEqual(words.map((w) => w.text), ['Halo', 'semua.']);
  assert.equal(words[1].start, 0.9);
});

test('toLines breaks on pauses and sentence ends', () => {
  const w = (start, end, text) => ({ start, end, text });
  const lines = toLines([w(0, 0.3, 'ini'), w(0.3, 0.6, 'satu.'), w(0.7, 1, 'dua'), w(3, 3.4, 'tiga')]);
  assert.deepEqual(lines.map((l) => l.text), ['ini satu.', 'dua', 'tiga']);
});

test('buildAss shifts words into the clip and highlights the spoken one', () => {
  const words = [
    { start: 9, end: 9.5, text: 'luar' },
    { start: 10.2, end: 10.6, text: 'ini' },
    { start: 10.6, end: 11, text: 'lapangan' },
    { start: 11, end: 11.5, text: 'padel' },
  ];
  const ass = buildAss(words, { from: 10, to: 20, width: 1080, height: 1920 });
  const events = ass.split('\n').filter((l) => l.startsWith('Dialogue'));
  assert.equal(events.length, 3);
  assert.match(events[0], /^Dialogue: 0,0:00:00\.20,0:00:00\.60,Klip,,0,0,0,,\{\\c&H0000D7FF&\}INI\{\\c\} LAPANGAN PADEL$/);
  assert.doesNotMatch(ass, /LUAR/);
  assert.match(ass, /PlayResY: 1920/);
});

test('extractJson handles chatter before and after the object', () => {
  const text = 'Oke, ini hasilnya:\n```json\n{"a": 1, "b": [2]}\n```\nSemoga membantu!';
  assert.deepEqual(extractJson(text), { a: 1, b: [2] });
  assert.deepEqual(extractJson('blah {"x": "}"} blah'), { x: '}' });
  assert.throws(() => extractJson('gak ada json di sini'));
});

test('stripThinking drops <think> blocks', () => {
  assert.equal(stripThinking('<think>mikir dulu</think>\nJawaban'), 'Jawaban');
});

test('an agent can get its own model, everyone else keeps the office default', () => {
  assert.equal(modelFor('bayu'), 'model-kuat');
  assert.equal(modelFor('sari'), LLM.model);
  assert.deepEqual(Object.keys(LLM.agentModels), ['bayu'], 'pasangan yang rusak diabaikan');
});

test('readSse joins deltas and keeps the final usage', () => {
  const raw = [
    'data: {"model":"m","choices":[{"delta":{"content":"Hal"}}]}',
    'data: {"choices":[{"delta":{"reasoning_content":"ignored"}}]}',
    'data: {"choices":[{"delta":{"content":"o"}}],"usage":{"prompt_tokens":5,"completion_tokens":2}}',
    'data: [DONE]',
  ].join('\n\n');
  const out = readSse(raw);
  assert.equal(out.text, 'Halo');
  assert.deepEqual(out.usage, { prompt_tokens: 5, completion_tokens: 2 });
  assert.equal(out.model, 'm');
});

test('parseFiles reads file blocks and refuses paths that escape the project', () => {
  const text = `Ini filenya:
=== FILE: public/index.html ===
\`\`\`html
<h1>Hai</h1>
\`\`\`
=== END FILE ===
=== FILE: ../../etc/passwd ===
jahat
=== END FILE ===
=== FILE: C:/Windows/x.txt ===
jahat
=== END FILE ===
=== FILE: ./server.js ===
console.log(1);
=== END FILE ===`;
  const files = parseFiles(text);
  assert.deepEqual(files.map((f) => f.path), ['public/index.html', 'server.js']);
  assert.equal(files[0].content, '<h1>Hai</h1>');
});

test('safeJoin keeps paths inside the root', () => {
  assert.ok(safeJoin('/srv/root', 'a/b.txt'));
  assert.equal(safeJoin('/srv/root', '../secret'), null);
  assert.equal(safeJoin('/srv/root', '..%2f..%2fsecret'), null);
});

test('parseDuration and parseSilences read ffmpeg output', () => {
  const log = `Duration: 00:01:40.50, start: 0.000000
[silencedetect @ 0x1] silence_start: 10.2
[silencedetect @ 0x1] silence_end: 11.4 | silence_duration: 1.2
[silencedetect @ 0x1] silence_start: 95`;
  const duration = parseDuration(log);
  assert.equal(duration, 100.5);
  assert.deepEqual(parseSilences(log, duration), [[10.2, 11.4], [95, 100.5]]);
});

test('pickCandidates returns non-overlapping 15-60s windows cut at pauses', () => {
  const silences = [];
  for (let t = 20; t < 600; t += 20) silences.push([t, t + 1]);
  const picked = pickCandidates(600, silences);
  assert.equal(picked.length, 6);
  for (const c of picked) {
    assert.ok(c.end - c.start >= 15 && c.end - c.start <= 60, `length ${c.end - c.start}`);
  }
  for (let i = 1; i < picked.length; i++) assert.ok(picked[i].start >= picked[i - 1].end);
});

test('pickCandidates still offers windows for a video with no pauses', () => {
  const picked = pickCandidates(120, []);
  assert.ok(picked.length > 0);
  assert.equal(pickCandidates(8, []).length, 0);
});

test('toDueIso combines Classroom UTC date and time parts', () => {
  assert.equal(toDueIso({ dueDate: { year: 2026, month: 11, day: 3 }, dueTime: { hours: 16, minutes: 59 } }), '2026-11-03T16:59:00.000Z');
  assert.equal(toDueIso({ dueDate: { year: 2026, month: 11, day: 3 } }), '2026-11-03T23:59:00.000Z');
  assert.equal(toDueIso({}), null);
});

test('prayerTimes matches the Kemenag method for Jakarta plus the 2-minute ihtiyath', () => {
  const jakarta = { lat: -6.2088, lon: 106.8456, utcOffset: 7 };
  // Reference: api.aladhan.com method 20 (KEMENAG), which publishes times without ihtiyath.
  const cases = [
    [{ year: 2026, month: 10, day: 28 }, ['04:08', '11:36', '14:51', '17:46', '18:57']],
    [{ year: 2026, month: 6, day: 15 }, ['04:36', '11:53', '15:15', '17:46', '19:01']],
    [{ year: 2026, month: 1, day: 10 }, ['04:22', '12:00', '15:25', '18:14', '19:29']],
  ];
  for (const [date, expected] of cases) {
    const times = Object.values(prayerTimes(date, jakarta));
    times.forEach((time, i) => {
      const [hh, mm] = expected[i].split(':').map(Number);
      const reference = Date.UTC(date.year, date.month - 1, date.day, hh - 7, mm);
      const diff = (time.getTime() - reference) / 60_000;
      assert.ok(diff >= 2 && diff <= 4, `${date.month}/${date.day} #${i}: ${diff} min off`);
    });
  }
});

test('todaySchedule calls Friday Dzuhur Jumatan', () => {
  // 2026-10-30 is a Friday; 05:00 UTC is midday in WIB.
  const friday = todaySchedule(new Date('2026-10-30T05:00:00Z'));
  assert.equal(friday.prayers[1].name, 'Jumatan');
  assert.equal(todaySchedule(new Date('2026-10-29T05:00:00Z')).prayers[1].name, 'Dzuhur');
  // Late evening WIB is already the next UTC day; the schedule must stay on the local date.
  const lateWib = todaySchedule(new Date('2026-10-29T16:30:00Z'));
  assert.equal(lateWib.prayers[1].at.slice(0, 10), '2026-10-29');
});

test('parseNumber reads Indonesian and English number formats', () => {
  assert.equal(parseNumber('123456.78'), 123456.78);
  assert.equal(parseNumber('1.234.567'), 1234567);
  assert.equal(parseNumber('1,234.56'), 1234.56);
  assert.equal(parseNumber('Rp 12.500,50'), 12500.5);
  assert.equal(parseNumber('3,25'), 3.25);
  assert.equal(parseNumber('1,234'), 1234);
  assert.equal(parseNumber(''), 0);
});

test('summarizeAds ranks a Meta export by cost per result and skips the totals row', () => {
  const csv = [
    '"Nama iklan";"Jumlah yang dibelanjakan (IDR)";"Impresi";"Klik tautan";"Hasil"',
    '"Promo A";"100.000";"20.000";"400";"10"',
    '"Promo B";"150.000";"30.000";"300";"3"',
    '"Promo C";"50.000";"5.000";"100";"5"',
    '"";"300.000";"55.000";"800";"18"',
  ].join('\n');
  const summary = summarizeAds(csv);
  assert.equal(summary.totals.ads, 3);
  assert.equal(summary.totals.spend, 300000);
  assert.equal(summary.rankedBy, 'cpr');
  assert.deepEqual(summary.ads.map((a) => a.name), ['Promo A', 'Promo C', 'Promo B']);
  assert.equal(summary.ads[0].cpr, 10000);
  assert.throws(() => summarizeAds('nama,warna\nx,y'), /Kolom biaya/);
});

test('restockSuggestion covers two weeks of sales above the minimum', () => {
  // 30 sold in 10 days = 3/day; 14 days = 42, plus minimum 10, minus 5 in stock = 47.
  assert.deepEqual(restockSuggestion({ stock: 5, minStock: 10, soldLast30: 30, daysTracked: 10 }), { perDay: 3, order: 47 });
  assert.equal(restockSuggestion({ stock: 100, minStock: 10, soldLast30: 0, daysTracked: 5 }).order, 0);
  // Two days of data still averages over a week: 14 sold -> 2/day, not 7/day.
  assert.equal(restockSuggestion({ stock: 0, minStock: 0, soldLast30: 14, daysTracked: 2 }).perDay, 2);
});

test('recordMove queues one low-stock check per dip below the minimum', () => {
  setSetting('divisions', ['admin']);
  const { lastInsertRowid } = db.prepare("INSERT INTO products (name, min_stock) VALUES ('Kopi', 5)").run();
  const id = Number(lastInsertRowid);
  const lowTasks = () => db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE kind = 'stock.low'").get().n;
  recordMove(id, 20, 'awal');
  recordMove(id, -16);
  recordMove(id, -1);
  assert.equal(lowTasks(), 1);
  recordMove(id, 10);
  recordMove(id, -12);
  assert.equal(lowTasks(), 2);
  assert.throws(() => recordMove(id, -50), /gak bisa keluar/);
});

test('parseEnv reads Hermes .env lines and ignores comments', async () => {
  const { parseEnv } = await import('../server/hermes.js');
  const env = parseEnv('# TELEGRAM_BOT_TOKEN=commented\nTELEGRAM_BOT_TOKEN="123:abc"\r\nTELEGRAM_ALLOWED_USERS=42, 43\n\nBROKEN\n');
  assert.equal(env.TELEGRAM_BOT_TOKEN, '123:abc');
  assert.equal(env.TELEGRAM_ALLOWED_USERS, '42, 43');
  assert.equal(Object.keys(env).length, 2);
});

test('parseLocal reads office time and defaultDue lands three days later at 17:00', () => {
  assert.equal(new Date(parseLocal('2026-11-01T09:30', 7)).toISOString(), '2026-11-01T02:30:00.000Z');
  assert.equal(new Date(parseLocal('2026-11-01', 7)).toISOString(), '2026-11-01T10:00:00.000Z');
  assert.equal(parseLocal('besok sore'), null);
  assert.equal(new Date(defaultDue(Date.parse('2026-10-28T20:00:00Z'), 7)).toISOString(), '2026-11-01T10:00:00.000Z');
});

test('normalizeDebate keeps only participants and replaces a deadline in the past', () => {
  const now = Date.parse('2026-10-28T03:00:00Z');
  const { lines, proposal } = normalizeDebate({
    lines: [{ agent: 'bayu', text: '  MVP   dulu ' }, { agent: 'orang-lain', text: 'halo' }, { agent: 'nadia', text: 'x'.repeat(300) }, { agent: 'nadia' }],
    plan: ['Riset', '', 5],
    due: '2026-10-01T10:00',
  }, { agents: ['bayu', 'nadia'], chair: 'bayu' }, now);
  assert.deepEqual(lines.map((l) => l.agent), ['bayu', 'nadia']);
  assert.equal(lines[0].text, 'MVP dulu');
  assert.ok(lines[1].text.length <= 120);
  assert.deepEqual(proposal.plan, ['Riset']);
  assert.equal(proposal.due, new Date(defaultDue(now)).toISOString());
  assert.match(proposal.question, /ACC/);

  const fine = normalizeDebate({ due: '2026-10-30T15:00' }, { agents: ['bayu'], chair: 'bayu' }, now);
  assert.equal(fine.proposal.due, '2026-10-30T08:00:00.000Z');
});

test('checkDeadlines warns the chair a day before and once more when it is late', async () => {
  const now = Date.parse('2026-10-28T03:00:00Z');
  const due = new Date(now + 5 * 3_600_000).toISOString();
  const { lastInsertRowid } = db.prepare(`INSERT INTO meetings (topic, agents, chair, state, due_at)
    VALUES ('Promo', '["raka","wulan"]', 'raka', 'approved', ?)`).run(due);
  const reminded = () => db.prepare('SELECT reminded FROM meetings WHERE id = ?').get(lastInsertRowid).reminded;

  await checkDeadlines(now - 2 * 86_400_000);
  assert.equal(reminded(), '');
  await checkDeadlines(now);
  await checkDeadlines(now + 60_000);
  assert.equal(reminded(), 'h24');
  assert.equal(getStatus('raka').text, 'Deadline besok: Promo');

  await checkDeadlines(now + 6 * 3_600_000);
  assert.equal(reminded(), 'h24,late');
});

test('nextHealth waits for a second slow probe but reports a dead 9router at once', () => {
  const up = { ok: true, state: 'up' };
  const slow = { ok: false, state: 'slow' };
  const down = { ok: false, state: 'down' };
  assert.equal(nextHealth(up, slow, 1), up);
  assert.equal(nextHealth(up, slow, 2), slow);
  assert.equal(nextHealth(up, down, 0), down);
  assert.equal(nextHealth(null, slow, 1), slow);
});

test('rateWork keeps one verdict per piece of work and only good work as an example', () => {
  const base = { agentId: 'joko', refKind: 'project', refId: 77, part: 'database' };
  assert.equal(examplesPrompt('joko'), '');
  assert.match(coachingPrompt('joko'), /SOP kamu/);
  assert.ok(coachingPrompt('joko').includes(DEFAULT_SOP.joko));

  rateWork({ ...base, rating: 1, note: 'relasinya jelas', example: { title: 'Toko · Database', content: 'CREATE TABLE x (id INTEGER PRIMARY KEY);' } });
  assert.match(examplesPrompt('joko'), /Toko · Database/);
  assert.deepEqual(ratingsFor('project', 77), { database: 'up' });

  // Changing your mind replaces the verdict and drops the example.
  rateWork({ ...base, rating: -1, note: 'lupa index' });
  assert.equal(examplesPrompt('joko'), '');
  assert.deepEqual(ratingsFor('project', 77), { database: 'down' });
  assert.match(coachingPrompt('joko'), /\[kurang\] lupa index/);
  assert.doesNotMatch(coachingPrompt('joko'), /relasinya jelas/);

  assert.throws(() => rateWork({ ...base, rating: -1, note: '' }), /catatan/);
  assert.equal(coachingPrompt('nobody'), '');
});

test('skills from Claude Code and Hermes go into the prompt, within the budget', () => {
  const listed = listSkills();
  assert.deepEqual(listed.map((k) => `${k.source}:${k.name}`), ['claude:imagegen-web', 'claude:rapi-kode', 'hermes:review-ketat', 'hermes:review-lain']);
  assert.match(listed[0].blocked, /tool/);
  assert.equal(listed[1].description, 'tes rapi-kode');

  installSkill('fajar', { source: 'claude', name: 'rapi-kode' });
  installSkill('fajar', { source: 'hermes', name: 'review-ketat' });
  const prompt = coachingPrompt('fajar');
  assert.match(prompt, /### Skill: rapi-kode\n# Rapi\nPakai nama variabel/);
  assert.match(prompt, /lewati langkah yang butuh jalanin perintah/);
  assert.doesNotMatch(prompt, /description: tes/, 'frontmatter stays out of the prompt');

  assert.ok(15_000 + 12_000 > SKILL_BUDGET);
  assert.throws(() => installSkill('fajar', { source: 'hermes', name: 'review-lain' }), /gak muat/);
  assert.throws(() => installSkill('fajar', { source: 'claude', name: 'imagegen-web' }), /butuh tool/);
  assert.throws(() => installSkill('fajar', { source: 'claude', name: '../../etc' }), /gak ketemu/);
  assert.doesNotMatch(coachingPrompt('rani'), /### Skill/);
});

test('every agent gets the work standard, its own SOP and notes written from the panel', () => {
  for (const id of ['sari', 'ale', 'dimas', 'mira', 'raka', 'wulan', 'dewi', 'rudi', 'bayu']) {
    const prompt = personaPrompt(id);
    assert.match(prompt, /Jangan ngarang/, id);
    assert.ok(prompt.includes(DEFAULT_SOP[id]), `${id} punya SOP bawaan`);
  }
  addNote('wulan', { rating: 'down', note: '  hook-nya kurang nyambung sama alasannya  ' });
  // Trimmed on the way in, so the line ends right after the text.
  assert.match(personaPrompt('wulan'), /\[kurang\] hook-nya kurang nyambung sama alasannya$/m);
  assert.doesNotMatch(personaPrompt('raka'), /hook-nya kurang nyambung/);
  assert.throws(() => addNote('wulan', { rating: 'down', note: ' ' }), /catatannya/);
  assert.throws(() => addNote('wulan', { rating: 'meh', note: 'x' }), /bagus atau kurang/);
});

test('musicArgs loops the song, fades it out, and mixes or replaces the clip sound', () => {
  const mix = musicArgs({ song: 'lagu.mp3', start: 4, mode: 'mix', volume: 30, length: 20, sourceHasAudio: true });
  assert.deepEqual(mix.input, ['-stream_loop', '-1', '-ss', '4', '-i', 'lagu.mp3']);
  const graph = mix.output[mix.output.indexOf('-filter_complex') + 1];
  assert.match(graph, /^\[1:a\]volume=0\.30,afade=t=in:d=0\.3,afade=t=out:st=18\.50:d=1\.5\[music\];/);
  assert.match(graph, /\[0:a\]\[music\]amix=inputs=2:duration=first:normalize=0\[aout\]$/);
  assert.deepEqual(mix.output.slice(-4), ['-map', '0:v:0', '-map', '[aout]']);

  const replace = musicArgs({ song: 'lagu.mp3', mode: 'replace', volume: 100, length: 10, sourceHasAudio: true });
  assert.doesNotMatch(replace.output.join(' '), /amix|\[0:a\]/);
  // A video with no sound can't be mixed, so it gets the song alone.
  const silent = musicArgs({ song: 'lagu.mp3', mode: 'mix', volume: 30, length: 10, sourceHasAudio: false });
  assert.doesNotMatch(silent.output.join(' '), /amix/);
  // Clips shorter than the fade don't get a negative fade start.
  assert.match(musicArgs({ song: 'x', mode: 'replace', volume: 50, length: 1, sourceHasAudio: true }).output[1], /st=0\.00/);
});
