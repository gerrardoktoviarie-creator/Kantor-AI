import { db, getSetting, setSetting } from './db.js';
import { DIVISIONS, BUILDER, enabledDivisions, getStatus, listTasks, clearAgentAttention, getAgent, retryTask } from './agents.js';
import { checkHealth } from './llm.js';
import { todaySchedule } from './prayer.js';
import { liveMeeting } from './meetings.js';
import { HttpError, readJson, requireText, sendJson, toId } from './http.js';

const STYLES = ['modern', 'hangat', 'mewah'];
const FACILITIES = ['rapat', 'pantry', 'musala', 'kolam'];
const DEFAULT_OFFICE = { style: 'modern', facilities: FACILITIES };

export function officeLook() {
  const saved = getSetting('office', DEFAULT_OFFICE);
  return {
    style: STYLES.includes(saved.style) ? saved.style : 'modern',
    facilities: FACILITIES.filter((f) => saved.facilities?.includes(f)),
  };
}

export function registerOfficeRoutes(router) {
  router.get('/api/setup', (req, res) => {
    sendJson(res, 200, {
      done: Boolean(getSetting('setupDone', false)),
      business: getSetting('business', {}),
      divisions: getSetting('divisions', []),
      office: officeLook(),
      builder: BUILDER,
      catalog: DIVISIONS.map(({ id, name, room, blurb, agents }) => ({
        id,
        name,
        room,
        blurb,
        manager: agents[0].name,
        size: agents.length,
        agents: agents.map(({ id: agentId, name: agentName, role, look }) => ({ id: agentId, name: agentName, role, look })),
      })),
    });
  });

  router.post('/api/setup', async (req, res) => {
    const body = await readJson(req);
    const business = {
      name: requireText(body.name, 'Nama bisnis', 120),
      about: requireText(body.about, 'Bisnisnya ngapain', 2000),
      audience: requireText(body.audience, 'Target audiens', 1000),
    };
    const known = new Set(DIVISIONS.map((d) => d.id));
    const divisions = Array.isArray(body.divisions) ? body.divisions.filter((id) => known.has(id)) : [];
    if (!divisions.length) throw new HttpError(400, 'Pilih minimal satu tim.');

    const office = body.office ?? {};
    setSetting('business', business);
    setSetting('divisions', divisions);
    setSetting('office', {
      style: STYLES.includes(office.style) ? office.style : 'modern',
      facilities: FACILITIES.filter((f) => Array.isArray(office.facilities) && office.facilities.includes(f)),
    });
    setSetting('setupDone', true);
    sendJson(res, 200, { ok: true });
  });

  router.get('/api/office', async (req, res) => {
    const divisions = enabledDivisions().map((division) => ({
      id: division.id,
      name: division.name,
      room: division.room,
      agents: division.agents.map((agent) => ({ ...agent, status: getStatus(agent.id) })),
    }));
    const queued = db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE state IN ('queued', 'running')").get().n;
    const asking = db.prepare("SELECT COUNT(*) AS n FROM meetings WHERE state = 'asking'").get().n;

    sendJson(res, 200, {
      business: getSetting('business', {}),
      builder: { ...BUILDER, status: getStatus(BUILDER.id) },
      divisions,
      queued,
      asking,
      meeting: liveMeeting(),
      office: officeLook(),
      prayer: todaySchedule(),
      health: await checkHealth(),
    });
  });

  router.get('/api/agents/:id', (req, res, { id }) => {
    const agent = getAgent(id);
    if (!agent) throw new HttpError(404, 'Agent gak ketemu.');
    sendJson(res, 200, { ...agent, status: getStatus(id), tasks: listTasks({ agentId: id, limit: 10 }) });
  });

  router.post('/api/agents/:id/ack', (req, res, { id }) => {
    if (!getAgent(id)) throw new HttpError(404, 'Agent gak ketemu.');
    clearAgentAttention(id);
    sendJson(res, 200, { ok: true });
  });

  router.get('/api/tasks', (req, res) => {
    sendJson(res, 200, listTasks({ limit: 50 }));
  });

  router.post('/api/tasks/:id/retry', (req, res, { id }) => {
    if (!retryTask(toId(id))) throw new HttpError(409, 'Tugas ini gak dalam keadaan gagal.');
    sendJson(res, 200, { ok: true });
  });
}
