import { api } from '../api.js';
import { h, hook, formatNumber } from '../dom.js';

const DIVISION_COLORS = {
  sosmed: '#e0607e',
  it: '#4aa3df',
  tugas: '#f4b942',
  marketing: '#e76f51',
  admin: '#8d99ae',
  builder: '#9ba6c2',
};

const dayLabel = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric' });

export function createUsageView() {
  const stats = hook('usage-stats');
  const chart = hook('usage-chart');
  const legend = hook('usage-legend');
  const agents = hook('usage-agents');

  function stat(value, label) {
    return h('div', { class: 'stat' }, h('span', { class: 'stat__value' }, value), h('span', { class: 'stat__label' }, label));
  }

  async function refresh() {
    const data = await api('/api/usage');
    const total = data.days.reduce((sum, d) => sum + d.total, 0);
    const calls = data.agents.reduce((sum, a) => sum + a.calls, 0);
    const max = Math.max(1, ...data.days.map((d) => d.total));

    stats.replaceChildren(
      stat(formatNumber(total), 'token 7 hari'),
      stat(formatNumber(calls), 'panggilan ke AI'),
      stat(formatNumber(data.tasks.done ?? 0), 'tugas beres'),
      stat(formatNumber(data.tasks.failed ?? 0), 'tugas gagal'),
    );

    chart.replaceChildren(...data.days.map((day) => h('div', { class: 'chart__col' },
      h('span', { class: 'chart__value' }, day.total ? formatNumber(day.total) : ''),
      h('div', {
        class: 'chart__bar',
        style: `height: ${Math.max(1, (day.total / max) * 100)}%`,
        title: `${day.day}: ${formatNumber(day.total)} token`,
      }, Object.entries(day.divisions).map(([id, tokens]) => h('span', {
        style: `height: ${(tokens / day.total) * 100}%; background: ${DIVISION_COLORS[id] ?? '#9ba6c2'}`,
      }))),
      h('span', {}, dayLabel.format(new Date(`${day.day}T12:00`))),
    )));

    legend.replaceChildren(...[...data.divisions, { id: 'builder', name: 'Builder' }].map((d) => h('span', { class: 'legend__item' },
      h('span', { class: 'legend__swatch', style: `background: ${DIVISION_COLORS[d.id] ?? '#9ba6c2'}` }),
      d.name,
    )));

    agents.replaceChildren(data.agents.length
      ? h('table', { class: 'usage-table' },
        h('thead', {}, h('tr', {},
          h('th', { scope: 'col' }, 'Agent'),
          h('th', { scope: 'col' }, 'Panggilan'),
          h('th', { scope: 'col' }, 'Token'),
        )),
        h('tbody', {}, data.agents.map((a) => h('tr', {},
          h('td', {}, `${a.name} · ${a.role}`),
          h('td', {}, formatNumber(a.calls)),
          h('td', {}, formatNumber(a.tokens)),
        ))))
      : h('p', { class: 'muted' }, 'Belum ada pemakaian minggu ini.'));
  }

  return { show: refresh, hide() {}, refresh };
}
