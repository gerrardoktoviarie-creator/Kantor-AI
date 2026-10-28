import { createServer } from 'node:http';
import { join } from 'node:path';
import { AUTH, HOST, PORT, PUBLIC_DIR, ROOT, WORKSPACE } from './config.js';
import { authRequired, isLoggedIn, isPublic, registerAuthRoutes } from './auth.js';
import { createRouter, HttpError, safeJoin, sendJson, serveFile } from './http.js';
import { startQueue } from './agents.js';
import { registerOfficeRoutes } from './office.js';
import { registerSosmedRoutes } from './sosmed.js';
import { registerClipRoutes } from './clips.js';
import { registerItRoutes, PROJECT_DIR } from './it.js';
import { registerClassroomRoutes, startClassroomSync } from './classroom.js';
import { registerUsageRoutes } from './usage.js';
import { registerChatRoutes } from './chat.js';
import { registerTelegramRoutes, startTelegramReminders } from './telegram.js';
import { registerMarketingRoutes } from './marketing.js';
import { registerStockRoutes, startStockRecaps } from './stock.js';
import { registerHermesRoutes } from './hermes.js';

const router = createRouter();
registerAuthRoutes(router);
registerChatRoutes(router);
registerTelegramRoutes(router);
registerOfficeRoutes(router);
registerSosmedRoutes(router);
registerClipRoutes(router);
registerItRoutes(router);
registerClassroomRoutes(router);
registerUsageRoutes(router);
registerMarketingRoutes(router);
registerStockRoutes(router);
registerHermesRoutes(router);

const MEDIA_DIRS = new Set(['uploads', 'clips', 'thumbs']);

function serveStatic(req, res, pathname) {
  if (pathname.startsWith('/klien/')) return serveFile(req, res, join(PUBLIC_DIR, 'klien.html'));

  if (pathname.startsWith('/media/')) {
    const [, , dir, ...rest] = pathname.split('/');
    if (!MEDIA_DIRS.has(dir)) return false;
    const file = safeJoin(join(WORKSPACE, dir), rest.join('/'));
    return Boolean(file) && serveFile(req, res, file);
  }

  if (pathname.startsWith('/preview/')) {
    const [, , slug, ...rest] = pathname.split('/');
    const root = safeJoin(PROJECT_DIR, `${slug}/public`);
    const file = root && safeJoin(root, rest.join('/') || 'index.html');
    return Boolean(file) && serveFile(req, res, file);
  }

  if (pathname === '/design-reference') {
    res.writeHead(301, { Location: '/design-reference/' });
    res.end();
    return true;
  }
  if (pathname.startsWith('/design-reference/')) {
    const file = safeJoin(join(ROOT, 'design-reference'), pathname.slice('/design-reference/'.length) || 'index.html');
    return Boolean(file) && serveFile(req, res, file);
  }

  const file = safeJoin(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname.slice(1));
  return Boolean(file) && serveFile(req, res, file);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (authRequired() && !isPublic(url.pathname) && !isLoggedIn(req)) throw new HttpError(401, 'Login dulu.');
    const found = router.match(req.method, url.pathname);
    if (found) {
      await found.handler(req, res, found.params, url);
      return;
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(req, res, url.pathname)) return;
    throw new HttpError(404, 'Halaman gak ketemu.');
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    sendJson(res, status, { error: status === 500 ? `Ada error di server: ${err.message}` : err.message });
  }
});

// Big uploads take a while; Node's default 5 min request timeout would cut them off.
server.requestTimeout = 0;

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
if (!LOOPBACK.has(HOST) && !AUTH.password) {
  console.error(`HOST=${HOST} bikin Kantor AI bisa dibuka dari luar. Isi KANTOR_PASSWORD di .env dulu, biar gak sembarang orang bisa masuk.`);
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  console.log(`Kantor AI jalan di http://${LOOPBACK.has(HOST) ? 'localhost' : HOST}:${PORT}${AUTH.password ? ' (pakai password)' : ''}`);
  startQueue();
  startClassroomSync();
  startTelegramReminders();
  startStockRecaps();
});
