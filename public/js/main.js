import { api } from './api.js';
import { h, hook } from './dom.js';
import { avatarCanvas } from './sprites.js';
import { createSetupView } from './views/setup.js';
import { createOfficeView } from './views/office.js';
import { createContentView } from './views/content.js';
import { createClipsView } from './views/clips.js';
import { createItView } from './views/it.js';
import { createTugasView } from './views/tugas.js';
import { createUsageView } from './views/usage.js';
import { createMarketingView } from './views/marketing.js';
import { createStockView } from './views/stock.js';
import { createTeamView } from './views/team.js';

const POLL_MS = 4000;
const nav = hook('nav');
const health = hook('health');

const views = {
  setup: createSetupView({ onDone: () => boot('#kantor') }),
  kantor: createOfficeView({ onOffice: renderChrome }),
  konten: createContentView(),
  klip: createClipsView(),
  it: createItView(),
  tugas: createTugasView(),
  iklan: createMarketingView(),
  stok: createStockView(),
  latih: createTeamView(),
  pemakaian: createUsageView(),
};

let active = null;
let enabled = [];
let crewKey = '';

// The people who work on a page stand on its header rule, drawn from the office data.
function renderCrews(divisions) {
  const key = JSON.stringify(divisions.map((d) => [d.id, d.agents.map((a) => a.id)]));
  if (key === crewKey) return;
  crewKey = key;
  for (const slot of document.querySelectorAll('[data-crew]')) {
    const division = divisions.find((d) => d.id === slot.dataset.crew);
    slot.replaceChildren(...(division?.agents ?? []).map((agent) => {
      const avatar = avatarCanvas(agent.look);
      avatar.title = `${agent.name} · ${agent.role}`;
      return avatar;
    }));
  }
}

const HEALTH_TEXT = {
  up: '9router nyala',
  checking: 'Ngecek 9router…',
  slow: '9router lambat banget, agent nunggu',
  error: '9router nolak permintaan, cek API key',
  down: '9router mati, agent gak bisa kerja',
};

function renderChrome(office) {
  hook('business-name').textContent = office.business.name ?? '';
  enabled = office.divisions.map((d) => d.id);
  renderCrews(office.divisions);
  for (const link of nav.querySelectorAll('[data-division]')) {
    link.hidden = !enabled.includes(link.dataset.division);
  }

  const waiting = office.divisions.flatMap((d) => d.agents)
    .filter((a) => a.status.state === 'waiting' || a.status.state === 'error').length;
  const badge = hook('attention-count');
  badge.hidden = waiting === 0;
  badge.textContent = String(waiting);

  const status = HEALTH_TEXT[office.health.ok ? 'up' : office.health.state] ?? HEALTH_TEXT.down;
  health.replaceChildren(
    h('span', { class: `dot ${office.health.ok ? 'dot--ok' : office.health.state === 'checking' ? '' : 'dot--bad'}` }),
    h('span', {}, office.health.ok ? `${status} · model ${office.health.model}` : status),
  );
}

async function show(name) {
  if (active === name) return;
  const previous = views[active];
  active = name;
  for (const section of document.querySelectorAll('[data-view]')) {
    section.hidden = section.dataset.view !== name;
  }
  for (const link of nav.querySelectorAll('.nav__link')) {
    link.classList.toggle('nav__link--active', link.getAttribute('href') === `#${name}`);
  }
  try {
    previous?.hide();
    await views[name].show();
  } catch (err) {
    showError(err);
  }
}

function showError(err) {
  health.replaceChildren(h('span', { class: 'dot dot--bad' }), h('span', {}, err.message));
}

// "#atur" reopens the setup wizard with the current answers, to add teams or change the look.
async function openSettings() {
  try {
    views.setup.fill(await api('/api/setup'), { editing: true });
    await show('setup');
  } catch (err) {
    showError(err);
  }
}

function route() {
  const name = window.location.hash.slice(1);
  if (name === 'atur') {
    openSettings();
    return;
  }
  show(views[name] && name !== 'setup' ? name : 'kantor');
}

async function boot(hash) {
  let setup;
  try {
    setup = await api('/api/setup');
  } catch (err) {
    showError(err);
    return;
  }

  if (!setup.done) {
    nav.hidden = true;
    views.setup.fill(setup);
    show('setup');
    return;
  }

  nav.hidden = false;
  try {
    renderChrome(await api('/api/office'));
  } catch (err) {
    showError(err);
  }
  if (hash) window.location.hash = hash;
  route();
}

window.addEventListener('hashchange', () => {
  if (!nav.hidden) route();
});

setInterval(async () => {
  if (!active || active === 'setup' || document.hidden) return;
  try {
    // The office view already refreshes the header; other pages poll it separately for the badge.
    if (active !== 'kantor') renderChrome(await api('/api/office'));
    await views[active].refresh();
  } catch (err) {
    showError(err);
  }
}, POLL_MS);

boot();
