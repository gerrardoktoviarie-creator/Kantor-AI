import { api } from '../api.js';
import { hook } from '../dom.js';
import { createCoachPanel } from '../coach-panel.js';

export function createTeamView() {
  const coach = createCoachPanel({ chips: hook('team-agents'), body: hook('team-body') });

  return {
    async show() {
      const office = await api('/api/office');
      coach.setTeam(office.divisions.map((d) => ({
        label: d.name,
        agents: d.agents.map(({ id, name, role, look }) => ({ id, name, role, look })),
      })));
      await coach.show();
    },
    hide() {},
    // Polling would wipe a half-written SOP, so this page only loads when you open it.
    refresh() {},
  };
}
