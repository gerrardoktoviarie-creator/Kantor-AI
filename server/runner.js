import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';

const BASE_PORT = 4300;
const LOG_LINES = 200;
const READY_TIMEOUT_MS = 15_000;

// projectId -> { proc, port, logs, state, startedAt, exitCode }
const running = new Map();

export function projectPort(projectId) {
  return BASE_PORT + (projectId % 600);
}

export function runInfo(projectId) {
  const run = running.get(projectId);
  if (!run) return { state: 'stopped', logs: [] };
  return {
    state: run.state,
    port: run.port,
    url: run.state === 'running' ? `http://localhost:${run.port}/` : null,
    exitCode: run.exitCode,
    logs: run.logs,
  };
}

export function logsText(projectId, lines = 60) {
  return (running.get(projectId)?.logs ?? []).slice(-lines).join('\n');
}

// Refuses projects that need npm packages: installing whatever a model listed is not something to do silently.
export function checkRunnable(root) {
  if (!existsSync(join(root, 'server.js'))) return 'Proyek ini belum punya server.js.';
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const deps = Object.keys(pkg.dependencies ?? {});
      if (deps.length && !existsSync(join(root, 'node_modules'))) {
        return `Proyek ini butuh package npm (${deps.join(', ')}). Jalankan "npm install" sendiri di foldernya dulu, atau minta Bayu bikin versi tanpa package.`;
      }
    } catch {
      return 'package.json proyek ini rusak.';
    }
  }
  return null;
}

export async function startProject(projectId, root) {
  await stopProject(projectId);
  const port = projectPort(projectId);
  const run = { port, logs: [], state: 'starting', exitCode: null, startedAt: Date.now() };
  running.set(projectId, run);

  const push = (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line.trim()) run.logs.push(line);
    }
    if (run.logs.length > LOG_LINES) run.logs.splice(0, run.logs.length - LOG_LINES);
  };

  run.proc = spawn(process.execPath, ['server.js'], {
    cwd: root,
    // AI-written code gets only what Node needs to run, never Kantor AI's own keys and tokens.
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      TEMP: process.env.TEMP,
      TMP: process.env.TMP,
      PORT: String(port),
      NODE_ENV: 'development',
    },
    windowsHide: true,
  });
  run.proc.stdout.on('data', push);
  run.proc.stderr.on('data', push);
  run.proc.on('error', (err) => push(`Gagal jalan: ${err.message}`));
  run.proc.on('exit', (code) => {
    run.exitCode = code;
    if (run.state !== 'stopped') {
      run.state = 'crashed';
      push(`Server berhenti (kode ${code}).`);
    }
  });

  const ready = await waitForPort(port, () => run.state === 'crashed');
  if (ready && run.state === 'starting') run.state = 'running';
  if (!ready && run.state === 'starting') {
    run.state = 'crashed';
    push(`Server gak dengerin port ${port} dalam ${READY_TIMEOUT_MS / 1000} detik. Pastikan server.js pakai process.env.PORT.`);
    run.proc.kill();
  }
  return runInfo(projectId);
}

export function stopProject(projectId) {
  const run = running.get(projectId);
  if (!run?.proc || run.proc.exitCode !== null) return Promise.resolve();
  run.state = 'stopped';
  return new Promise((resolve) => {
    run.proc.once('exit', () => resolve());
    run.proc.kill();
    setTimeout(resolve, 3000).unref();
  });
}

export function isRunning(projectId) {
  return running.get(projectId)?.state === 'running';
}

function waitForPort(port, gaveUp) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  return new Promise((resolve) => {
    const attempt = () => {
      if (gaveUp()) return resolve(false);
      const socket = createConnection({ port, host: '127.0.0.1' });
      socket.once('connect', () => {
        socket.end();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) resolve(false);
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

process.on('exit', () => {
  for (const run of running.values()) run.proc?.kill();
});
