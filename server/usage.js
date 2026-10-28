import { db } from './db.js';
import { DIVISIONS, BUILDER, getAgent } from './agents.js';
import { sendJson } from './http.js';

export function registerUsageRoutes(router) {
  router.get('/api/usage', (req, res) => {
    const rows = db.prepare(`SELECT date(at, 'localtime') AS day, agent_id,
        SUM(prompt_tokens) AS prompt, SUM(completion_tokens) AS completion, COUNT(*) AS calls
      FROM llm_usage WHERE at >= datetime('now', '-6 days', 'start of day')
      GROUP BY day, agent_id ORDER BY day`).all();

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString('sv-SE'));
    }

    const divisionOf = (agentId) => getAgent(agentId)?.divisionId ?? BUILDER.id;
    const byDay = days.map((day) => ({ day, total: 0, divisions: {} }));
    const byAgent = new Map();

    for (const row of rows) {
      const tokens = row.prompt + row.completion;
      const bucket = byDay.find((b) => b.day === row.day);
      if (bucket) {
        const division = divisionOf(row.agent_id);
        bucket.total += tokens;
        bucket.divisions[division] = (bucket.divisions[division] ?? 0) + tokens;
      }
      const agent = byAgent.get(row.agent_id) ?? { agentId: row.agent_id, tokens: 0, calls: 0 };
      agent.tokens += tokens;
      agent.calls += row.calls;
      byAgent.set(row.agent_id, agent);
    }

    const tasks = db.prepare(`SELECT state, COUNT(*) AS n FROM tasks
      WHERE created_at >= datetime('now', '-6 days', 'start of day') GROUP BY state`).all();

    sendJson(res, 200, {
      days: byDay,
      divisions: DIVISIONS.map(({ id, name }) => ({ id, name })),
      agents: [...byAgent.values()]
        .map((a) => ({ ...a, name: getAgent(a.agentId)?.name ?? a.agentId, role: getAgent(a.agentId)?.role ?? '' }))
        .sort((a, b) => b.tokens - a.tokens),
      tasks: Object.fromEntries(tasks.map((t) => [t.state, t.n])),
    });
  });
}
