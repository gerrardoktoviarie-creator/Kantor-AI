import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { extractJson, readSse, stripThinking } = await import('../server/llm.js');
const { parseFiles } = await import('../server/it.js');
const { pickCandidates, parseSilences, parseDuration } = await import('../server/clips.js');
const { toDueIso } = await import('../server/classroom.js');
const { safeJoin } = await import('../server/http.js');
const { toWords, toLines, buildAss } = await import('../server/subtitles.js');
const { splitMessage } = await import('../server/telegram.js');
const { prayerTimes, todaySchedule } = await import('../server/prayer.js');
const { parseNumber, summarizeAds } = await import('../server/marketing.js');
const { restockSuggestion, recordMove } = await import('../server/stock.js');
const { db, setSetting } = await import('../server/db.js');

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
