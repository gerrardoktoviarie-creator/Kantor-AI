// Password login, only switched on when KANTOR_PASSWORD is set (needed when HOST exposes the
// server beyond this machine, e.g. on a VPS). On a laptop bound to 127.0.0.1 nothing changes.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AUTH } from './config.js';
import { HttpError, readJson, sendJson } from './http.js';

const COOKIE = 'kantor_session';
const MAX_AGE_S = 30 * 24 * 3600;
// Sessions live in memory: a restart just means logging in again.
const sessions = new Set();

export const authRequired = () => Boolean(AUTH.password);

// Data lives behind /api, /media and /preview. Pages, styles and scripts hold no data, and the
// client preview endpoints are already guarded by each client's secret token.
export function isPublic(pathname) {
  if (pathname === '/api/login' || pathname.startsWith('/api/client/')) return true;
  return !['/api/', '/media/', '/preview/'].some((prefix) => pathname.startsWith(prefix));
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

export const isLoggedIn = (req) => sessions.has(readCookie(req, COOKIE));

const digest = (text) => createHash('sha256').update(String(text)).digest();

export function registerAuthRoutes(router) {
  router.post('/api/login', async (req, res) => {
    if (!authRequired()) return sendJson(res, 200, { ok: true });
    const { password } = await readJson(req);
    if (!timingSafeEqual(digest(password), digest(AUTH.password))) {
      // Slows down guessing without needing per-IP bookkeeping.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      throw new HttpError(401, 'Password salah.');
    }
    const token = randomBytes(24).toString('base64url');
    sessions.add(token);
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_S}${secure}`);
    return sendJson(res, 200, { ok: true });
  });

  router.post('/api/logout', (req, res) => {
    sessions.delete(readCookie(req, COOKIE));
    res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    sendJson(res, 200, { ok: true });
  });
}
