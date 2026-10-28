import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './config.js';

const WHISPER_DIR = join(ROOT, 'bin', 'whisper');
const WHISPER_BIN = join(WHISPER_DIR, process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli');
const WHISPER_MODEL = process.env.WHISPER_MODEL || join(WHISPER_DIR, 'ggml-base.bin');

export const hasWhisper = () => existsSync(WHISPER_BIN) && existsSync(WHISPER_MODEL);

// Runs whisper.cpp with one word per segment (-ml 1 -sow) so subtitles can follow each word.
export function transcribe(wavPath, onProgress = () => {}) {
  const outBase = wavPath.replace(/\.wav$/, '');
  return new Promise((resolve, reject) => {
    const proc = spawn(WHISPER_BIN, [
      '-m', WHISPER_MODEL, '-f', wavPath, '-l', 'auto', '-t', '4',
      '-ml', '1', '-sow', '-oj', '-of', outBase, '-np', '-pp',
    ], { windowsHide: true });

    let tail = '';
    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      tail = (tail + text).slice(-2000);
      const pct = text.match(/progress =\s*(\d+)%/g)?.at(-1)?.match(/\d+/)?.[0];
      if (pct) onProgress(Number(pct));
    });
    proc.stdout.resume();
    proc.on('error', (err) => reject(new Error(`whisper gak bisa dijalankan: ${err.message}`)));
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`whisper gagal (kode ${code}): ${tail.trim().split('\n').at(-1)}`));
        return;
      }
      try {
        const json = JSON.parse(readFileSync(`${outBase}.json`, 'utf8'));
        rmSync(`${outBase}.json`, { force: true });
        resolve({ language: json.result?.language ?? null, words: toWords(json.transcription ?? []) });
      } catch (err) {
        reject(new Error(`Hasil whisper gak kebaca: ${err.message}`));
      }
    });
  });
}

export function toWords(segments) {
  const words = [];
  for (const seg of segments) {
    const text = seg.text.trim();
    // whisper emits bracketed non-speech markers like [MUSIC] or (tertawa).
    if (!text || /^[[(].*[\])]$/.test(text)) continue;
    words.push({ start: seg.offsets.from / 1000, end: seg.offsets.to / 1000, text });
  }
  return words;
}

// Groups words into readable lines, breaking on pauses and sentence ends.
export function toLines(words, maxGap = 0.7, maxWords = 18) {
  const lines = [];
  let current = null;
  for (const word of words) {
    const breakHere = !current
      || word.start - current.end > maxGap
      || current.words.length >= maxWords
      || /[.?!]$/.test(current.words.at(-1).text);
    if (breakHere) {
      current = { start: word.start, end: word.end, words: [word] };
      lines.push(current);
    } else {
      current.end = word.end;
      current.words.push(word);
    }
  }
  return lines.map((l) => ({ start: l.start, end: l.end, text: l.words.map((w) => w.text).join(' ') }));
}

const assTime = (t) => {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};

const assText = (text) => text.toUpperCase().replace(/[{}\\]/g, '');

// TikTok-style captions: 3 words at a time, the word being spoken turns yellow.
export function buildAss(words, { from, to, width, height }) {
  const inClip = words
    .filter((w) => w.end > from && w.start < to)
    .map((w) => ({ ...w, start: Math.max(0, w.start - from), end: Math.min(to, w.end) - from }));

  const chunks = [];
  for (const word of inClip) {
    const last = chunks.at(-1);
    if (!last || last.length >= 3 || word.start - last.at(-1).end > 0.6) chunks.push([word]);
    else last.push(word);
  }

  const size = Math.round(Math.min(width, height) * 0.075);
  const events = [];
  for (const chunk of chunks) {
    chunk.forEach((word, i) => {
      const end = chunk[i + 1]?.start ?? word.end;
      const text = chunk.map((w, j) => (j === i ? `{\\c&H0000D7FF&}${assText(w.text)}{\\c}` : assText(w.text))).join(' ');
      events.push(`Dialogue: 0,${assTime(word.start)},${assTime(Math.max(end, word.start + 0.05))},Klip,,0,0,0,,${text}`);
    });
  }

  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Klip,Arial Black,${size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,${Math.round(size / 14)},2,2,60,60,${Math.round(height * 0.27)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}
`;
}
