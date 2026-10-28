import { api } from '../api.js';
import { h, hook, formatRelative } from '../dom.js';
import { avatarCanvas } from '../sprites.js';
import { createOffice } from '../office-canvas.js';
import { currentPrayer, nextPrayer } from '../prayer-clock.js';

const clock = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });

const STATE_LABEL = {
  idle: ['Santai', ''],
  queued: ['Antre', ''],
  working: ['Lagi kerja', 'badge--working'],
  waiting: ['Nunggu kamu cek', 'badge--attention'],
  error: ['Error', 'badge--error'],
  chatting: ['Ngobrol sama kamu', 'badge--working'],
  meeting: ['Lagi rapat', 'badge--working'],
};

// Where to go to act on an agent's pending item.
const AGENT_PAGE = {
  sari: '#konten', ale: '#konten', dimas: '#klip', mira: '#tugas',
  bayu: '#it', nadia: '#it', tari: '#it', joko: '#it', fajar: '#it', rani: '#it',
  raka: '#iklan', wulan: '#iklan', dewi: '#stok', rudi: '#stok',
};

export function createOfficeView({ onOffice }) {
  const canvas = hook('office-canvas');
  const filter = hook('room-filter');
  const attention = hook('attention-list');
  const card = hook('agent-card');
  const stats = hook('office-stats');
  const root = hook('office');
  const panel = hook('office-panel');
  const panelToggle = root.querySelector('[data-action="toggle-panel"]');
  const fullscreenButton = root.querySelector('[data-action="fullscreen"]');
  const banner = hook('prayer-banner');
  const prayerList = hook('prayer-list');
  let schedule = null;
  let selectedId = null;
  let roomsKey = '';
  let activeRoom = null;

  const office = createOffice(canvas, {
    onSelect: (id) => {
      setPanel(true);
      showAgent(id);
    },
  });

  function setPanel(open) {
    root.classList.toggle('office--panel-open', open);
    panelToggle.setAttribute('aria-expanded', String(open));
  }

  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'toggle-panel') setPanel(!root.classList.contains('office--panel-open'));
    if (action === 'close-panel') setPanel(false);
    if (action === 'zoom-in') office.zoomBy(1.4);
    if (action === 'zoom-out') office.zoomBy(1 / 1.4);
    if (action === 'fullscreen') {
      if (document.fullscreenElement) document.exitFullscreen();
      else root.requestFullscreen?.();
    }
  });

  document.addEventListener('fullscreenchange', () => {
    fullscreenButton.textContent = document.fullscreenElement === root ? 'Keluar layar penuh' : 'Layar penuh';
  });

  filter.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-room]');
    if (!chip) return;
    activeRoom = chip.dataset.room || null;
    office.focus(activeRoom);
    for (const el of filter.children) el.classList.toggle('chip--active', el === chip);
  });

  attention.addEventListener('click', (event) => {
    const item = event.target.closest('[data-agent]');
    if (item) showAgent(item.dataset.agent);
  });

  function minutesUntil(iso) {
    const minutes = Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000);
    if (minutes < 60) return `${minutes} menit lagi`;
    return `${Math.floor(minutes / 60)} jam ${minutes % 60} menit lagi`;
  }

  function renderPrayer() {
    const now = currentPrayer(schedule);
    const next = nextPrayer(schedule);
    banner.classList.toggle('prayer-banner--now', Boolean(now));
    if (now?.phase === 'gather') banner.textContent = `${clock.format(new Date(now.at))} · Azan ${now.name}, agent lagi wudhu`;
    else if (now?.phase === 'khutbah') banner.textContent = 'Jumatan · lagi khutbah, kamu khatibnya';
    else if (now) banner.textContent = `Lagi salat ${now.name} berjamaah`;
    else if (next) banner.textContent = `${next.name} ${clock.format(new Date(next.at))} · ${minutesUntil(next.at)}`;
    else banner.textContent = 'Salat hari ini udah semua. Besok Subuh.';

    prayerList.replaceChildren(...(schedule?.prayers ?? []).map((prayer) => {
      const tone = prayer.id === now?.id ? ' prayer-list__item--now' : prayer === next ? ' prayer-list__item--next' : '';
      return h('li', { class: `prayer-list__item${tone}` },
        h('span', {}, prayer.name),
        h('time', { datetime: prayer.at }, clock.format(new Date(prayer.at))),
      );
    }));
    hook('prayer-title').textContent = `Jadwal salat · ${schedule?.city ?? ''}`;
  }

  card.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const input = form.elements.text;
    const text = input.value.trim();
    if (!text) return;
    const agentId = selectedId;
    const log = hook('chat-log', card);
    const button = form.querySelector('button[type="submit"]');

    log.append(chatBubble({ role: 'user', text }), h('p', { class: 'chat__typing', dataset: { hook: 'typing' } }, 'lagi ngetik…'));
    log.scrollTop = log.scrollHeight;
    input.value = '';
    button.disabled = true;
    try {
      const messages = await api(`/api/agents/${agentId}/messages`, { method: 'POST', body: { text } });
      if (selectedId === agentId) renderChat(messages);
    } catch (err) {
      hook('typing', card)?.remove();
      log.append(h('p', { class: 'error-text' }, err.message));
      input.value = text;
    } finally {
      button.disabled = false;
      input.focus();
    }
  });

  card.addEventListener('keydown', (event) => {
    // Enter sends, Shift+Enter makes a new line, like most chat apps.
    if (event.key !== 'Enter' || event.shiftKey || !event.target.matches('textarea[name="text"]')) return;
    event.preventDefault();
    event.target.form.requestSubmit();
  });

  card.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'clear-chat') {
      if (!window.confirm('Hapus semua obrolan sama agent ini?')) return;
      renderChat(await api(`/api/agents/${selectedId}/messages`, { method: 'DELETE' }));
      return;
    }
    button.disabled = true;
    try {
      if (button.dataset.action === 'ack') await api(`/api/agents/${selectedId}/ack`, { method: 'POST' });
      if (button.dataset.action === 'retry') await api(`/api/tasks/${button.dataset.id}/retry`, { method: 'POST' });
      await refresh();
      await showAgent(selectedId);
    } catch (err) {
      window.alert(err.message);
    } finally {
      button.disabled = false;
    }
  });

  function renderFilter(rooms) {
    const key = rooms.map((r) => r.id).join();
    if (key === roomsKey) return;
    roomsKey = key;
    const chips = [{ id: '', label: 'Semua' }, ...rooms].map((room) => h('button', {
      class: `chip${(activeRoom ?? '') === room.id ? ' chip--active' : ''}`,
      type: 'button',
      dataset: { room: room.id },
    }, room.label));
    filter.replaceChildren(...chips);
  }

  function renderAttention(everyone) {
    const pending = everyone.filter((a) => a.status.state === 'waiting' || a.status.state === 'error');
    const count = hook('panel-count');
    count.hidden = !pending.length;
    count.textContent = String(pending.length);
    if (!pending.length) {
      attention.replaceChildren(h('li', { class: 'muted' }, 'Belum ada yang nunggu. Tim lagi aman.'));
      return;
    }
    attention.replaceChildren(...pending.map((agent) => h('li', {},
      h('button', { class: 'attention__item', type: 'button', dataset: { agent: agent.id } },
        avatarCanvas(agent.look, 'avatar avatar--small'),
        h('strong', {}, `${agent.name} · ${agent.role}`),
        h('span', { class: 'attention__text' }, agent.status.text),
      ),
    )));
  }

  function chatBubble(message) {
    return h('p', { class: `chat__msg chat__msg--${message.role}` }, message.text);
  }

  function renderChat(messages) {
    const log = hook('chat-log', card);
    if (!log) return;
    log.replaceChildren(...(messages.length
      ? messages.map(chatBubble)
      : [h('p', { class: 'muted' }, 'Belum pernah ngobrol. Tanya apa aja soal kerjaannya.')]));
    log.scrollTop = log.scrollHeight;
  }

  async function showAgent(id) {
    const switching = selectedId !== id;
    selectedId = id;
    office.select(id);
    let agent;
    let messages;
    try {
      [agent, messages] = await Promise.all([api(`/api/agents/${id}`), api(`/api/agents/${id}/messages`)]);
    } catch (err) {
      card.hidden = false;
      card.replaceChildren(h('p', { class: 'error-text' }, err.message));
      return;
    }

    const [label, tone] = STATE_LABEL[agent.status.state] ?? STATE_LABEL.idle;
    const needsYou = agent.status.state === 'waiting' || agent.status.state === 'error';
    const page = AGENT_PAGE[agent.id];
    const draft = switching ? '' : card.querySelector('textarea[name="text"]')?.value ?? '';

    card.hidden = false;
    card.replaceChildren(
      h('div', { class: 'agent-card__head' },
        avatarCanvas(agent.look),
        h('div', {},
          h('h2', {}, agent.name),
          h('p', { class: 'muted' }, agent.role),
          h('span', { class: `badge ${tone}` }, label),
        ),
      ),
      agent.status.text ? h('p', {}, agent.status.text) : '',
      needsYou ? h('div', { class: 'actions' },
        page && h('a', { class: 'btn btn--primary btn--small', href: page }, 'Buka kerjaannya'),
        h('button', { class: 'btn btn--small', type: 'button', dataset: { action: 'ack' } }, 'Udah gw cek'),
      ) : '',
      h('section', { class: 'chat', 'aria-label': `Chat sama ${agent.name}` },
        h('div', { class: 'task__line' },
          h('h3', {}, `Ngobrol sama ${agent.name}`),
          h('button', { class: 'btn btn--small', type: 'button', dataset: { action: 'clear-chat' } }, 'Hapus'),
        ),
        h('div', { class: 'chat__log', dataset: { hook: 'chat-log' }, 'aria-live': 'polite' }),
        h('form', { class: 'chat__form' },
          h('label', { class: 'visually-hidden', for: 'chat-input' }, `Pesan buat ${agent.name}`),
          h('textarea', { id: 'chat-input', name: 'text', rows: '2', maxlength: '4000', placeholder: `Tulis pesan buat ${agent.name}…`, value: draft }),
          h('button', { class: 'btn btn--primary btn--small', type: 'submit' }, 'Kirim'),
        ),
      ),
      h('h3', {}, 'Tugas terakhir'),
      agent.tasks.length
        ? h('div', {}, agent.tasks.map((task) => h('div', { class: 'task' },
          h('div', { class: 'task__line' },
            h('span', {}, task.title),
            h('span', { class: `badge ${taskTone(task.state)}` }, taskLabel(task.state)),
          ),
          task.error && h('span', { class: 'error-text' }, task.error),
          task.state === 'failed' && h('button', {
            class: 'btn btn--small', type: 'button', dataset: { action: 'retry', id: task.id },
          }, 'Coba lagi'),
          h('span', { class: 'muted' }, formatRelative(task.createdAt)),
        )))
        : h('p', { class: 'muted' }, 'Belum pernah dikasih tugas.'),
    );
    renderChat(messages);
  }

  async function refresh() {
    const data = await api('/api/office');
    onOffice(data);
    office.update(data.divisions, data.builder, data.office);
    schedule = data.prayer;
    office.setPrayer(schedule);
    renderPrayer();
    renderFilter(office.rooms());
    const everyone = data.divisions.flatMap((d) => d.agents);
    renderAttention(everyone);
    const working = everyone.filter((a) => a.status.state === 'working').length;
    stats.textContent = `${everyone.length} agent · ${working} lagi kerja · ${data.queued} tugas di antrean`;
  }

  return {
    async show() {
      office.start();
      await refresh();
      if (selectedId) showAgent(selectedId);
    },
    hide() {
      office.stop();
    },
    refresh,
  };
}

function taskLabel(state) {
  return { queued: 'Antre', running: 'Dikerjain', done: 'Beres', failed: 'Gagal' }[state] ?? state;
}

function taskTone(state) {
  return { running: 'badge--working', done: 'badge--ok', failed: 'badge--error' }[state] ?? '';
}
