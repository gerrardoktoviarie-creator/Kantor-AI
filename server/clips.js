import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { extname, join } from 'node:path';
import { FFMPEG_PATH, ROOT, WORKSPACE } from './config.js';
import { db, parseJson } from './db.js';
import { enqueue, personaPrompt, registerHandler, setStatus } from './agents.js';
import { chatJson } from './llm.js';
import { buildAss, hasWhisper, toLines, transcribe } from './subtitles.js';
import { HttpError, readJson, requireText, sendJson, toId } from './http.js';

const UPLOAD_DIR = join(WORKSPACE, 'uploads');
const CLIP_DIR = join(WORKSPACE, 'clips');
const THUMB_DIR = join(WORKSPACE, 'thumbs');
const AUDIO_DIR = join(WORKSPACE, 'audio');
const MUSIC_DIR = join(WORKSPACE, 'music');
// Escaped for ffmpeg's filter syntax, where ":" separates options.
const FONTS_DIR = process.platform === 'win32'
  ? `${(process.env.WINDIR || 'C:\\Windows').replace(/\\/g, '/').replace(':', '\\:')}/Fonts`
  : '/usr/share/fonts';
const VIDEO_TYPES = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v']);
const MAX_UPLOAD = 4 * 1024 ** 3;
const SONG_TYPES = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.opus', '.flac']);
const MAX_SONG = 50 * 1024 ** 2;
const SONG_FADE_S = 1.5;

const CLIP_MIN = 15;
const CLIP_MAX = 60;
const CANDIDATES = 6;

const bundled = join(ROOT, 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
const ffmpegBin = FFMPEG_PATH || (existsSync(bundled) ? bundled : 'ffmpeg');

function runFfmpeg(args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin, ['-hide_banner', '-nostdin', ...args], { windowsHide: true, cwd });
    let log = '';
    proc.stderr.on('data', (chunk) => {
      log += chunk;
      // Only the tail matters for errors; silencedetect output on long videos gets big.
      if (log.length > 2_000_000) log = log.slice(-1_000_000);
    });
    proc.on('error', (err) => reject(new Error(`ffmpeg gak bisa dijalankan: ${err.message}`)));
    proc.on('close', (code) => {
      if (code === 0) resolve(log);
      else reject(new Error(`ffmpeg gagal (kode ${code}): ${log.trim().split('\n').slice(-3).join(' ')}`));
    });
  });
}

export function parseDuration(log) {
  const m = log.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

export function parseSilences(log, duration) {
  const silences = [];
  let start = null;
  for (const line of log.split('\n')) {
    const s = line.match(/silence_start: (-?\d+(?:\.\d+)?)/);
    if (s) start = Math.max(0, Number(s[1]));
    const e = line.match(/silence_end: (\d+(?:\.\d+)?)/);
    if (e && start !== null) {
      silences.push([start, Number(e[1])]);
      start = null;
    }
  }
  if (start !== null) silences.push([start, duration]);
  return silences;
}

// Picks clip windows that start and end on pauses and contain the most talking.
// Without a transcript this is the honest signal we have: dense speech, clean cut points.
export function pickCandidates(duration, silences, count = CANDIDATES) {
  const cuts = [0, ...silences.map(([s, e]) => (s + e) / 2), duration]
    .filter((t, i, all) => i === 0 || t - all[i - 1] > 0.5);

  // Prefix sums keep this fast on hour-long videos with thousands of pauses.
  const before = [0];
  for (const [s, e] of silences) before.push(before.at(-1) + (e - s));
  const silentUpTo = (t) => {
    let lo = 0;
    let hi = silences.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (silences[mid][0] < t) lo = mid + 1;
      else hi = mid;
    }
    if (lo === 0) return 0;
    const [s, e] = silences[lo - 1];
    return before[lo - 1] + Math.min(e, t) - s;
  };
  const silentIn = (from, to) => silentUpTo(to) - silentUpTo(from);

  const windows = [];
  for (let i = 0; i < cuts.length; i++) {
    for (let j = i + 1; j < cuts.length; j++) {
      const length = cuts[j] - cuts[i];
      if (length < CLIP_MIN) continue;
      if (length > CLIP_MAX) break;
      const speech = 1 - silentIn(cuts[i], cuts[j]) / length;
      // Mild preference for ~30s, the sweet spot for reels.
      const score = speech - Math.abs(length - 30) / 200;
      windows.push({ start: round(cuts[i]), end: round(cuts[j]), speech: round(speech), score });
    }
  }

  if (!windows.length && duration >= CLIP_MIN) {
    for (let t = 0; t + CLIP_MIN <= duration && windows.length < count; t += 30) {
      const end = Math.min(duration, t + 30);
      windows.push({ start: round(t), end: round(end), speech: round(1 - silentIn(t, end) / (end - t)), score: 0 });
    }
  }

  const picked = [];
  for (const w of windows.sort((a, b) => b.score - a.score)) {
    if (picked.some((p) => w.start < p.end && p.start < w.end)) continue;
    picked.push(w);
    if (picked.length === count) break;
  }
  return picked.sort((a, b) => a.start - b.start).map(({ score, ...w }) => w);
}

const round = (n) => Math.round(n * 10) / 10;

registerHandler('clip.analyze', async (task) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(task.payload.videoId);
  if (!video) throw new Error('Video udah dihapus.');
  const src = join(UPLOAD_DIR, video.file);

  setStatus('dimas', 'working', `Dengerin ${video.name}`);
  const log = await runFfmpeg(['-i', src, '-vn', '-af', 'silencedetect=noise=-32dB:d=0.5', '-f', 'null', '-']);
  const duration = parseDuration(log);
  if (!duration) throw new Error('Durasi video gak kebaca. File-nya mungkin rusak.');
  const size = parseSize(log);

  let words = [];
  if (hasWhisper()) {
    mkdirSync(AUDIO_DIR, { recursive: true });
    const wav = join(AUDIO_DIR, `video-${video.id}.wav`);
    await runFfmpeg(['-y', '-i', src, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
    try {
      ({ words } = await transcribe(wav, (pct) => setStatus('dimas', 'working', `Transkrip ${video.name}: ${pct}%`)));
    } finally {
      rmSync(wav, { force: true });
    }
  }

  let candidates = [];
  if (words.length > 20) {
    setStatus('dimas', 'working', `Milih bagian terbaik dari ${video.name}`);
    candidates = await pickFromTranscript(words, duration).catch(() => []);
  }
  if (!candidates.length) candidates = pickCandidates(duration, parseSilences(log, duration));

  mkdirSync(THUMB_DIR, { recursive: true });
  for (const [i, c] of candidates.entries()) {
    const thumb = `video-${video.id}-${i}.jpg`;
    await runFfmpeg(['-y', '-ss', String(c.start + 1), '-i', src, '-frames:v', '1', '-vf', 'scale=320:-2', join(THUMB_DIR, thumb)]);
    c.thumb = thumb;
  }

  db.prepare("UPDATE videos SET duration = ?, candidates = ?, transcript = ?, width = ?, height = ?, state = 'ready' WHERE id = ?")
    .run(duration, JSON.stringify(candidates), words.length ? JSON.stringify(words) : null, size?.width ?? null, size?.height ?? null, video.id);
  return { result: { candidates: candidates.length }, review: `${candidates.length} calon klip dari "${video.name}"` };
});

/**
 * Extra ffmpeg input and audio graph that put a song under the clip's own sound ("mix")
 * or in place of it ("replace"). The song loops if it's shorter than the clip and fades
 * out over the last 1.5 s. A source without audio can only be replaced.
 */
export function musicArgs({ song, start = 0, mode, volume, length, sourceHasAudio }) {
  const level = (volume / 100).toFixed(2);
  const fadeAt = Math.max(0, length - SONG_FADE_S).toFixed(2);
  const music = `[1:a]volume=${level},afade=t=in:d=0.3,afade=t=out:st=${fadeAt}:d=${SONG_FADE_S}`;
  const graph = mode === 'replace' || !sourceHasAudio
    ? `${music}[aout]`
    // normalize=0 keeps the voice at full volume; amix would otherwise halve both inputs.
    : `${music}[music];[0:a][music]amix=inputs=2:duration=first:normalize=0[aout]`;
  return {
    input: ['-stream_loop', '-1', '-ss', String(start), '-i', song],
    output: ['-filter_complex', graph, '-map', '0:v:0', '-map', '[aout]'],
  };
}

export function parseSize(log) {
  const m = log.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

// Long transcripts are cut into chunks so they fit free models' context; each chunk proposes a few moments.
async function pickFromTranscript(words, duration) {
  const lines = toLines(words);
  const chunks = [];
  let current = [];
  let size = 0;
  for (const line of lines) {
    const text = `[${line.start.toFixed(1)}-${line.end.toFixed(1)}] ${line.text}`;
    if (size + text.length > 12_000 && current.length) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(text);
    size += text.length + 1;
  }
  if (current.length) chunks.push(current);

  const proposals = [];
  for (const chunk of chunks.slice(0, 8)) {
    const answer = await chatJson({
      agentId: 'dimas',
      system: personaPrompt('dimas'),
      maxTokens: 1500,
      prompt: `Ini transkrip video (format [detik_mulai-detik_selesai] kalimat):
${chunk.join('\n')}

Pilih maksimal 3 momen yang paling layak jadi klip reels/TikTok: punya hook kuat di awal, utuh (gak kepotong di tengah pikiran), 15-60 detik.
Mulai dan selesai harus pas di batas kalimat di atas.
Jawab HANYA JSON: { "clips": [ { "start": 12.3, "end": 45.6, "title": "judul klip pendek", "reason": "kenapa ini menarik, 1 kalimat", "score": 1-10 } ] }`,
    });
    proposals.push(...(answer?.clips ?? []));
  }

  const valid = proposals
    .map((c) => ({ ...c, start: Number(c.start), end: Number(c.end), score: Number(c.score) || 5 }))
    .filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end) && c.start >= 0 && c.end <= duration + 1
      && c.end - c.start >= 8 && c.end - c.start <= 90 && typeof c.title === 'string')
    .sort((a, b) => b.score - a.score);

  const picked = [];
  for (const c of valid) {
    if (picked.some((p) => c.start < p.end && p.start < c.end)) continue;
    picked.push({ start: round(c.start), end: round(Math.min(c.end, duration)), title: c.title.slice(0, 120), reason: String(c.reason ?? '').slice(0, 300) });
    if (picked.length === CANDIDATES) break;
  }
  return picked.sort((a, b) => a.start - b.start);
}

registerHandler('clip.cut', async (task) => {
  const clip = db.prepare(`SELECT clips.*, videos.file AS src, videos.transcript, videos.width, videos.height
    FROM clips JOIN videos ON videos.id = clips.video_id WHERE clips.id = ?`).get(task.payload.clipId);
  if (!clip) throw new Error('Klip udah dihapus.');

  mkdirSync(CLIP_DIR, { recursive: true });
  const file = `clip-${clip.id}.mp4`;
  const assFile = `clip-${clip.id}.ass`;
  const vertical = clip.layout === 'vertical';
  // Center crop to 9:16; a source that is already narrower keeps its full width.
  const filters = vertical
    ? ["crop='min(iw,ih*9/16)':ih,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2"]
    : [];

  let music = { input: [], output: [] };
  if (clip.song_id) {
    const song = db.prepare('SELECT file FROM songs WHERE id = ?').get(clip.song_id);
    if (!song) throw new Error('Lagu buat klip ini udah dihapus. Potong ulang tanpa lagu atau pilih lagu lain.');
    // A zero-length decode is the cheapest way to get ffmpeg to list the source's streams.
    const probe = await runFfmpeg(['-i', join(UPLOAD_DIR, clip.src), '-t', '0', '-f', 'null', '-']);
    music = musicArgs({
      song: join(MUSIC_DIR, song.file),
      start: clip.song_start ?? 0,
      mode: clip.song_mode,
      volume: clip.song_volume ?? 30,
      length: clip.end_s - clip.start_s,
      sourceHasAudio: /Stream #\S+.*Audio:/.test(probe),
    });
  }

  const words = clip.subtitles ? parseJson(clip.transcript, []) : [];
  if (clip.subtitles && !words.length) throw new Error('Video ini gak punya transkrip, jadi gak bisa dikasih subtitle.');
  if (words.length) {
    const width = vertical ? 1080 : clip.width ?? 1920;
    const height = vertical ? 1920 : clip.height ?? 1080;
    writeFileSync(join(CLIP_DIR, assFile), buildAss(words, { from: clip.start_s, to: clip.end_s, width, height }));
    // Relative path + cwd avoids escaping the drive colon inside the filter string.
    filters.push(`subtitles=${assFile}:fontsdir='${FONTS_DIR}'`);
  }

  db.prepare("UPDATE clips SET state = 'cutting' WHERE id = ?").run(clip.id);
  try {
    await runFfmpeg([
      '-y', '-ss', String(clip.start_s), '-i', join(UPLOAD_DIR, clip.src), ...music.input,
      '-t', String(clip.end_s - clip.start_s),
      ...music.output,
      ...(filters.length ? ['-vf', filters.join(',')] : []),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart', file,
    ], { cwd: CLIP_DIR });
  } catch (err) {
    db.prepare("UPDATE clips SET state = 'failed' WHERE id = ?").run(clip.id);
    throw err;
  } finally {
    rmSync(join(CLIP_DIR, assFile), { force: true });
  }
  db.prepare("UPDATE clips SET state = 'done', file = ? WHERE id = ?").run(file, clip.id);
  return { result: { clipId: clip.id }, review: `Klip "${clip.title}" udah jadi` };
});

function toSong(row) {
  return { id: row.id, name: row.name, duration: row.duration, url: `/media/music/${row.file}`, createdAt: row.created_at };
}

function toVideo(row) {
  const clips = db.prepare(`SELECT clips.*, songs.name AS song_name FROM clips
    LEFT JOIN songs ON songs.id = clips.song_id WHERE video_id = ? ORDER BY start_s`).all(row.id);
  return {
    id: row.id,
    name: row.name,
    url: `/media/uploads/${row.file}`,
    duration: row.duration,
    state: row.state,
    hasTranscript: Boolean(row.transcript),
    candidates: (parseJson(row.candidates, []) ?? []).map((c) => ({ ...c, thumbUrl: c.thumb && `/media/thumbs/${c.thumb}` })),
    clips: clips.map((c) => ({
      id: c.id,
      title: c.title,
      start: c.start_s,
      end: c.end_s,
      layout: c.layout,
      subtitles: Boolean(c.subtitles),
      song: c.song_id ? { name: c.song_name ?? 'lagu yang udah dihapus', mode: c.song_mode, volume: c.song_volume } : null,
      state: c.state,
      url: c.file && `/media/clips/${c.file}`,
    })),
  };
}

export function registerClipRoutes(router) {
  router.get('/api/videos', (req, res) => {
    sendJson(res, 200, db.prepare('SELECT * FROM videos ORDER BY id DESC').all().map(toVideo));
  });

  // Raw body upload: the browser sends the File as the request body, no multipart parsing needed.
  router.put('/api/videos', async (req, res, params, url) => {
    const name = requireText(url.searchParams.get('name'), 'Nama file', 200);
    const ext = extname(name).toLowerCase();
    if (!VIDEO_TYPES.has(ext)) throw new HttpError(400, 'Format video gak didukung (pakai mp4, mov, mkv, webm).');
    const size = Number(req.headers['content-length']);
    if (!size) throw new HttpError(411, 'Ukuran file gak diketahui.');
    if (size > MAX_UPLOAD) throw new HttpError(413, 'Video kegedean (maks 4 GB).');

    mkdirSync(UPLOAD_DIR, { recursive: true });
    const file = `${Date.now()}-${randomPart()}${ext}`;
    const target = join(UPLOAD_DIR, file);
    try {
      await pipeline(req, createWriteStream(target));
    } catch {
      rmSync(target, { force: true });
      throw new HttpError(400, 'Upload putus di tengah jalan.');
    }

    const { lastInsertRowid } = db.prepare('INSERT INTO videos (name, file) VALUES (?, ?)').run(name, file);
    const id = Number(lastInsertRowid);
    enqueue('dimas', 'clip.analyze', `Nyari bagian bagus di ${name}`, { videoId: id });
    sendJson(res, 201, { id });
  });

  router.post('/api/videos/:id/clips', async (req, res, { id }) => {
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(toId(id));
    if (!video) throw new HttpError(404, 'Video gak ketemu.');
    if (video.state !== 'ready') throw new HttpError(409, 'Video masih dianalisis.');

    const body = await readJson(req);
    const start = Number(body.start);
    const end = Number(body.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > video.duration + 0.5) {
      throw new HttpError(400, 'Waktu mulai/selesai gak valid.');
    }
    if (end - start > 180) throw new HttpError(400, 'Klip maksimal 3 menit.');
    const title = requireText(body.title, 'Judul klip', 120);
    const layout = body.layout === 'original' ? 'original' : 'vertical';
    const subtitles = body.subtitles === true || body.subtitles === 'on';
    if (subtitles && !video.transcript) throw new HttpError(409, 'Video ini gak punya transkrip, matikan subtitle dulu.');
    const music = songChoice(body);

    const { lastInsertRowid } = db.prepare(`INSERT INTO clips
      (video_id, title, start_s, end_s, layout, subtitles, song_id, song_mode, song_volume, song_start)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(video.id, title, start, end, layout, subtitles ? 1 : 0, music.id, music.mode, music.volume, music.start);
    const clipId = Number(lastInsertRowid);
    enqueue('dimas', 'clip.cut', `Motong klip "${title}"`, { clipId });
    sendJson(res, 201, { id: clipId });
  });

  router.get('/api/songs', (req, res) => {
    sendJson(res, 200, db.prepare('SELECT * FROM songs ORDER BY id DESC').all().map(toSong));
  });

  router.put('/api/songs', async (req, res, params, url) => {
    const name = requireText(url.searchParams.get('name'), 'Nama file', 200);
    const ext = extname(name).toLowerCase();
    if (!SONG_TYPES.has(ext)) throw new HttpError(400, 'Format lagu gak didukung (pakai mp3, m4a, wav, ogg, atau flac).');
    const size = Number(req.headers['content-length']);
    if (!size) throw new HttpError(411, 'Ukuran file gak diketahui.');
    if (size > MAX_SONG) throw new HttpError(413, 'Lagu kegedean (maks 50 MB).');

    mkdirSync(MUSIC_DIR, { recursive: true });
    const file = `${Date.now()}-${randomPart()}${ext}`;
    const target = join(MUSIC_DIR, file);
    try {
      await pipeline(req, createWriteStream(target));
    } catch {
      rmSync(target, { force: true });
      throw new HttpError(400, 'Upload putus di tengah jalan.');
    }

    let duration;
    try {
      duration = parseDuration(await runFfmpeg(['-i', target, '-f', 'null', '-']));
    } catch {
      duration = null;
    }
    if (!duration) {
      rmSync(target, { force: true });
      throw new HttpError(400, 'File ini gak kebaca sebagai lagu. Mungkin rusak atau bukan file audio.');
    }

    const { lastInsertRowid } = db.prepare('INSERT INTO songs (name, file, duration) VALUES (?, ?, ?)')
      .run(name.replace(/\.[^.]+$/, ''), file, duration);
    sendJson(res, 201, toSong(db.prepare('SELECT * FROM songs WHERE id = ?').get(Number(lastInsertRowid))));
  });

  // Finished clips keep their sound; only clips still waiting would lose the song.
  router.delete('/api/songs/:id', (req, res, { id }) => {
    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(toId(id));
    if (!song) throw new HttpError(404, 'Lagu gak ketemu.');
    const waiting = db.prepare("SELECT COUNT(*) AS n FROM clips WHERE song_id = ? AND state IN ('queued', 'cutting')").get(song.id).n;
    if (waiting) throw new HttpError(409, 'Lagu ini lagi dipakai klip yang belum selesai dipotong.');
    rmSync(join(MUSIC_DIR, song.file), { force: true });
    db.prepare('DELETE FROM songs WHERE id = ?').run(song.id);
    sendJson(res, 200, { ok: true });
  });

  router.get('/api/videos/:id/transcript', (req, res, { id }) => {
    const video = db.prepare('SELECT transcript FROM videos WHERE id = ?').get(toId(id));
    if (!video) throw new HttpError(404, 'Video gak ketemu.');
    sendJson(res, 200, toLines(parseJson(video.transcript, []) ?? []));
  });

  router.delete('/api/videos/:id', (req, res, { id }) => {
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(toId(id));
    if (!video) throw new HttpError(404, 'Video gak ketemu.');
    for (const clip of db.prepare('SELECT file FROM clips WHERE video_id = ?').all(video.id)) {
      if (clip.file) rmSync(join(CLIP_DIR, clip.file), { force: true });
    }
    for (const c of parseJson(video.candidates, []) ?? []) {
      if (c.thumb) rmSync(join(THUMB_DIR, c.thumb), { force: true });
    }
    rmSync(join(UPLOAD_DIR, video.file), { force: true });
    db.prepare('DELETE FROM videos WHERE id = ?').run(video.id);
    sendJson(res, 200, { ok: true });
  });
}

/** Validates the song part of a cut request; no songId means no song. */
export function songChoice(body) {
  if (body.songId == null || body.songId === '') return { id: null, mode: null, volume: null, start: null };
  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(toId(body.songId));
  if (!song) throw new HttpError(404, 'Lagu gak ketemu.');
  const mode = body.songMode === 'replace' ? 'replace' : 'mix';
  const volume = Number(body.songVolume ?? (mode === 'mix' ? 30 : 100));
  if (!Number.isFinite(volume) || volume < 0 || volume > 100) throw new HttpError(400, 'Volume lagu harus 0 sampai 100.');
  const start = Number(body.songStart ?? 0);
  if (!Number.isFinite(start) || start < 0 || (song.duration && start >= song.duration)) {
    throw new HttpError(400, `Mulai lagu harus antara 0 dan ${Math.floor(song.duration ?? 0)} detik.`);
  }
  return { id: song.id, mode, volume: Math.round(volume), start };
}

function randomPart() {
  return Math.random().toString(36).slice(2, 8);
}
