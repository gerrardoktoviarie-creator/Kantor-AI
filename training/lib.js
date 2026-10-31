import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Starts the exercise's server.js on a free-ish port and hands its base URL to `fn`.
// `env` adds variables such as DB_PATH; the rest of the environment stays minimal.
export async function withServer(dir, fn, env = {}) {
  const port = 4900 + Math.floor(Math.random() * 90);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: dir,
    env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, ...env, PORT: String(port) },
  });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  const exited = new Promise((resolve) => child.on('exit', resolve));
  const base = `http://127.0.0.1:${port}`;

  try {
    const end = Date.now() + 8000;
    for (;;) {
      if (child.exitCode !== null) throw new Error(`Server mati waktu start:\n${output.slice(-1500)}`);
      try {
        await fetch(base, { signal: AbortSignal.timeout(500) });
        break;
      } catch {
        if (Date.now() > end) throw new Error(`Server gak bisa diakses di port ${port} (process.env.PORT dipakai?):\n${output.slice(-1500)}`);
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    return await fn(base);
  } finally {
    child.kill();
    await exited;
  }
}

export async function getJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

export const postJson = (url, data) => getJson(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});

/** Runs named checks, prints each result, exits 1 if any failed. */
export async function runChecks(checks) {
  let failed = 0;
  for (const [name, check] of checks) {
    try {
      await check();
      console.log(`LULUS  ${name}`);
    } catch (err) {
      failed++;
      console.log(`GAGAL  ${name}: ${err.message}`);
    }
  }
  process.exitCode = failed ? 1 : 0;
}

export function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(relative(root, full).split(sep).join('/'));
    }
  };
  walk(root);
  return out.sort();
}

// Models sometimes close a block as "=== END FILE: path ===", so anything after END FILE is allowed.
const FILE_BLOCK = /=== FILE: (.+?) ===\r?\n([\s\S]*?)\r?\n=== END FILE[^\n]*===/g;

/** Files an agent wrote back, minus anything in `skip` (graders, metadata). */
export function parseFiles(text, skip = new Set()) {
  const files = [];
  for (const [, rawPath, content] of text.matchAll(FILE_BLOCK)) {
    const path = rawPath.trim().replace(/\\/g, '/').replace(/^\.?\//, '');
    if (!path || path.includes('..') || /^[a-z]:/i.test(path) || skip.has(path)) continue;
    const fenced = content.match(/^```[\w-]*\n([\s\S]*?)\n```\s*$/);
    files.push({ path, content: fenced ? fenced[1] : content });
  }
  return files;
}

/** Paths the agent started writing but never closed, usually because the answer was cut off. */
export function unclosedFiles(text) {
  const closed = new Set([...text.matchAll(FILE_BLOCK)].map((m) => m[1].trim()));
  return [...text.matchAll(/=== FILE: (.+?) ===/g)].map((m) => m[1].trim()).filter((p) => !closed.has(p));
}
