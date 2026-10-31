import { api } from './api.js';
import { h, formatRelative } from './dom.js';
import { avatarCanvas } from './sprites.js';

const thousands = new Intl.NumberFormat('id-ID');
// The skill folders don't change while the page is open; one read serves every agent.
let skillCatalog = null;

/**
 * SOP, skills, notes and liked examples for one agent at a time.
 * `groups` is [{ label, agents: [{ id, name, role, look }] }]; a lone group needs no label.
 */
export function createCoachPanel({ chips, body }) {
  let groups = [];
  let current = null;

  const everyone = () => groups.flatMap((g) => g.agents);

  chips.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-agent]');
    if (chip) show(chip.dataset.agent);
  });

  body.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const error = form.querySelector('.error-text');
    error.textContent = '';
    try {
      if (form.dataset.hook === 'skill-form') {
        const [source, name] = form.elements.skill.value.split(':');
        await api(`/api/coaching/${current}/skills`, { method: 'POST', body: { source, name } });
        await show(current);
      } else if (form.dataset.hook === 'note-form') {
        const rating = event.submitter?.value;
        await api(`/api/coaching/${current}/notes`, { method: 'POST', body: { rating, note: form.elements.note.value } });
        await show(current);
      } else {
        await api(`/api/coaching/${current}/sop`, { method: 'PUT', body: { text: form.elements.text.value } });
        await show(current, 'SOP disimpan. Dipakai mulai tugas berikutnya.');
      }
    } catch (err) {
      error.textContent = err.message;
    }
  });

  body.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const calls = {
      'reset-sop': () => api(`/api/coaching/${current}/sop`, { method: 'PUT', body: { text: '' } }),
      'delete-note': () => api(`/api/coaching/notes/${button.dataset.id}`, { method: 'DELETE' }),
      'delete-example': () => api(`/api/coaching/examples/${button.dataset.id}`, { method: 'DELETE' }),
      'remove-skill': () => api(`/api/coaching/${current}/skills/${encodeURIComponent(button.dataset.name)}`, { method: 'DELETE' }),
    };
    if (!calls[button.dataset.action]) return;
    button.disabled = true;
    try {
      await calls[button.dataset.action]();
      await show(current);
    } catch (err) {
      window.alert(err.message);
      button.disabled = false;
    }
  });

  function renderChips() {
    const chip = (agent) => h('button', {
      class: `chip coach__chip${agent.id === current ? ' chip--active' : ''}`,
      type: 'button',
      dataset: { agent: agent.id },
      'aria-pressed': String(agent.id === current),
    }, avatarCanvas(agent.look, 'avatar avatar--tiny'), agent.name);

    chips.replaceChildren(...groups.map((group) => (group.label
      ? h('div', { class: 'coach__group' },
        h('span', { class: 'coach__group-label' }, group.label),
        h('div', { class: 'chips' }, group.agents.map(chip)))
      : group.agents.map(chip))).flat());
  }

  function renderSkills(data) {
    const used = data.skills.reduce((sum, s) => sum + s.size, 0);
    const installed = new Set(data.skills.map((s) => s.name));
    const choices = (skillCatalog ?? []).filter((s) => !installed.has(s.name));
    const tooBig = (s) => used + s.size > data.skillBudget;
    const option = (s) => h('option', { value: `${s.source}:${s.name}`, disabled: Boolean(s.blocked) || tooBig(s) },
      `${s.name} · ${thousands.format(s.size)} kar${s.blocked ? ' · butuh tool' : tooBig(s) ? ' · gak muat' : ''}`);
    const sources = [...new Set(choices.map((s) => s.label))];

    return h('section', { class: 'coach__section', 'aria-label': 'Skill' },
      h('div', { class: 'task__line' },
        h('h3', {}, 'Skill'),
        h('span', { class: 'muted' }, `${thousands.format(used)} / ${thousands.format(data.skillBudget)} karakter`),
      ),
      h('div', { class: 'meter', role: 'presentation' },
        h('span', { class: 'meter__fill', style: `width: ${Math.min(100, (used / data.skillBudget) * 100)}%` })),
      data.skills.length
        ? h('ul', { class: 'list coach__list' }, data.skills.map((s) => h('li', { class: 'coach__item' },
          h('span', { class: 'badge' }, s.label),
          h('span', {}, h('strong', {}, s.name), h('span', { class: 'muted' }, ` · ${thousands.format(s.size)} karakter`)),
          h('button', { class: 'btn btn--small', type: 'button', dataset: { action: 'remove-skill', name: s.name } }, 'Lepas'),
        )))
        : h('p', { class: 'muted' }, 'Belum ada skill yang dipasang.'),
      choices.length > 0 && h('form', { class: 'skill-form', dataset: { hook: 'skill-form' } },
        h('label', { class: 'visually-hidden', for: 'skill-pick' }, 'Pilih skill'),
        h('select', { id: 'skill-pick', name: 'skill', required: true },
          h('option', { value: '' }, 'Pilih skill dari Claude Code atau Hermes'),
          sources.map((label) => h('optgroup', { label }, choices.filter((s) => s.label === label).map(option)))),
        h('button', { class: 'btn btn--small', type: 'submit' }, 'Pasang'),
        h('p', { class: 'error-text', role: 'alert' }),
      ),
      skillCatalog && !skillCatalog.length && h('p', { class: 'panel__hint' }, 'Folder skill Claude Code atau Hermes gak ketemu di komputer ini.'),
    );
  }

  function renderNotes(data, member) {
    return h('section', { class: 'coach__section', 'aria-label': 'Catatan dari kamu' },
      h('h3', {}, 'Catatan dari kamu'),
      h('form', { class: 'note-form', dataset: { hook: 'note-form' } },
        h('label', { class: 'visually-hidden', for: 'coach-note' }, `Catatan buat ${member.name}`),
        h('input', { id: 'coach-note', name: 'note', maxlength: '500', required: true, placeholder: `Contoh: jawabanmu kepanjangan, langsung ke intinya` }),
        h('button', { class: 'btn btn--small rate__up', type: 'submit', value: 'up' }, 'Bagus'),
        h('button', { class: 'btn btn--small rate__down', type: 'submit', value: 'down' }, 'Kurang'),
        h('p', { class: 'error-text', role: 'alert' }),
      ),
      data.notes.length
        ? h('ul', { class: 'list coach__list' }, data.notes.map((n) => h('li', { class: 'coach__item' },
          h('span', { class: `badge ${n.rating === 'up' ? 'badge--working' : 'badge--error'}` }, n.rating === 'up' ? 'Bagus' : 'Kurang'),
          h('span', {}, n.note),
          h('button', { class: 'btn btn--small', type: 'button', dataset: { action: 'delete-note', id: n.id } }, 'Hapus'),
        )))
        : h('p', { class: 'muted' }, `Belum ada. 6 catatan terbaru dibaca ${member.name} tiap kerja.`),
    );
  }

  async function show(agentId, saved = '') {
    const member = everyone().find((a) => a.id === agentId);
    if (!member) return;
    current = agentId;
    renderChips();
    skillCatalog ??= (await api('/api/skills')).skills;
    const data = await api(`/api/coaching/${agentId}`);
    // Another chip may have been picked while this one loaded.
    if (current !== agentId) return;
    const total = data.score.up + data.score.down;

    body.replaceChildren(
      h('form', { class: 'form coach__sop' },
        h('div', { class: 'field' },
          h('label', { for: 'coach-sop' }, `SOP ${member.name} · ${member.role}`),
          h('textarea', { id: 'coach-sop', name: 'text', rows: '9', maxlength: '4000', value: data.sop }),
        ),
        h('p', { class: 'panel__hint' }, data.sopIsDefault
          ? 'Ini SOP bawaan. Ubah sesukamu, misalnya gaya bahasa atau aturan yang kamu mau.'
          : 'SOP ini udah kamu ubah sendiri.'),
        saved && h('p', { class: 'coach__saved', role: 'status' }, saved),
        h('p', { class: 'error-text', role: 'alert' }),
        h('div', { class: 'actions' },
          h('button', { class: 'btn btn--primary btn--small', type: 'submit' }, 'Simpan SOP'),
          !data.sopIsDefault && h('button', { class: 'btn btn--small', type: 'button', dataset: { action: 'reset-sop' } }, 'Pakai SOP bawaan'),
        ),
      ),
      h('div', { class: 'coach__side' },
        h('div', { class: 'stat-row' },
          h('div', { class: 'stat' }, h('span', { class: 'stat__value' }, String(data.score.up)), h('span', { class: 'stat__label' }, 'Dinilai bagus')),
          h('div', { class: 'stat' }, h('span', { class: 'stat__value' }, String(data.score.down)), h('span', { class: 'stat__label' }, 'Dinilai kurang')),
          h('div', { class: 'stat' }, h('span', { class: 'stat__value' }, total ? `${Math.round((data.score.up / total) * 100)}%` : '–'), h('span', { class: 'stat__label' }, 'Disukai')),
        ),
        renderSkills(data),
        renderNotes(data, member),
        data.examples.length > 0 && h('h3', {}, 'Contoh hasil bagus'),
        data.examples.length > 0 && h('ul', { class: 'list coach__list' }, data.examples.map((e) => h('li', { class: 'coach__item' },
          h('span', { class: 'badge' }, formatRelative(e.createdAt)),
          h('span', {}, e.title),
          h('button', { class: 'btn btn--small', type: 'button', dataset: { action: 'delete-example', id: e.id } }, 'Hapus'),
        ))),
      ),
    );
  }

  return {
    setTeam(next) {
      groups = next;
      if (!everyone().some((a) => a.id === current)) current = everyone()[0]?.id ?? null;
      renderChips();
    },
    show: (agentId = current, saved) => show(agentId, saved),
  };
}
