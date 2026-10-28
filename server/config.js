import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

const envFile = join(ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env;

export const PORT = Number(env.PORT) || 4100;
// 127.0.0.1 keeps the office private to this machine. On a VPS set HOST=0.0.0.0, a password,
// and PUBLIC_URL (the address people type), which Google login also redirects back to.
export const HOST = env.HOST || '127.0.0.1';
export const BASE_URL = (env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

export const AUTH = { password: env.KANTOR_PASSWORD || '' };

export const WORKSPACE = env.WORKSPACE_DIR || join(ROOT, 'workspace');
export const PUBLIC_DIR = join(ROOT, 'public');
export const DB_PATH = join(WORKSPACE, 'kantor.db');

export const LLM = {
  url: (env.LLM_URL || 'http://localhost:20128/v1').replace(/\/$/, ''),
  model: env.LLM_MODEL || 'code',
  key: env.LLM_KEY || '',
  // Free models on 9router can take minutes on long prompts; anything shorter kills good runs.
  timeoutMs: Number(env.LLM_TIMEOUT_MS) || 6 * 60 * 1000,
};

export const GOOGLE = {
  clientId: env.GOOGLE_CLIENT_ID || '',
  clientSecret: env.GOOGLE_CLIENT_SECRET || '',
  redirectUri: `${BASE_URL}/api/classroom/callback`,
};

export const FFMPEG_PATH = env.FFMPEG_PATH || '';

// Where the office "is" for prayer times. Defaults to Jakarta (WIB).
export const PRAYER = {
  city: env.PRAYER_CITY || 'Jakarta',
  lat: Number(env.PRAYER_LAT) || -6.2088,
  lon: Number(env.PRAYER_LON) || 106.8456,
  utcOffset: Number(env.PRAYER_UTC_OFFSET) || 7,
};
