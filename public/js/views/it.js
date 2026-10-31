import { api } from '../api.js';
import { h, hook, handleSubmit, formatDateTime, formatRelative } from '../dom.js';
import { createCoachPanel } from '../coach-panel.js';

export function createItView() {
  const projectForm = hook('project-form');
  const ideaForm = hook('idea-form');
  const projectList = hook('project-list');
  const ideaList = hook('idea-list');
  const dialog = hook('file-dialog');
  const coach = createCoachPanel({ chips: hook('coach-agents'), body: hook('coach-body') });
  let steps = [];

  handleSubmit(projectForm, hook('project-error'), async (values, form) => {
    await api('/api/projects', { method: 'POST', body: values });
    form.reset();
    await refresh({ force: true });
  });

  handleSubmit(ideaForm, null, async (values, form) => {
    await api('/api/ideas', { method: 'POST', body: values });
    form.reset();
    await refresh({ force: true });
  });

  projectList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const card = button.closest('[data-id]');

    if (button.dataset.action === 'open-file') {
      hook('file-dialog-title').textContent = button.dataset.path;
      hook('file-dialog-body').textContent = 'Memuat…';
      dialog.showModal();
      try {
        const { content } = await api(`/api/projects/${card.dataset.id}/file?path=${encodeURIComponent(button.dataset.path)}`);
        hook('file-dialog-body').textContent = content;
      } catch (err) {
        hook('file-dialog-body').textContent = err.message;
      }
      return;
    }

    if (button.dataset.action === 'show-revise' || button.dataset.action === 'show-fix') {
      const form = button.dataset.action === 'show-revise' ? 'revise-form' : 'fix-form';
      card.querySelector(`[data-hook="${form}"]`).hidden = false;
      card.dataset.editing = 'true';
      return;
    }

    const id = card.dataset.id;
    const calls = {
      run: () => api(`/api/projects/${id}/run`, { method: 'POST' }),
      stop: () => api(`/api/projects/${id}/stop`, { method: 'POST' }),
      retry: () => api(`/api/tasks/${button.dataset.task}/retry`, { method: 'POST' }),
    };
    if (!calls[button.dataset.action]) return;
    button.disabled = true;
    if (button.dataset.action === 'run') button.textContent = 'Lagi nyalain…';
    try {
      await calls[button.dataset.action]();
    } catch (err) {
      window.alert(err.message);
    }
    await refresh({ force: true });
  });

  projectList.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const card = form.closest('[data-id]');
    const values = Object.fromEntries(new FormData(form));
    if (form.dataset.hook === 'rate-form') {
      await rateStep(card, form, { step: form.dataset.step, rating: event.submitter?.value, note: values.note });
      return;
    }
    const endpoint = form.dataset.hook === 'fix-form' ? 'fix' : 'revise';
    try {
      await api(`/api/projects/${card.dataset.id}/${endpoint}`, { method: 'POST', body: values });
      await refresh({ force: true });
    } catch (err) {
      window.alert(err.message);
    }
  });

  // Typing a rating note shouldn't get wiped by the next poll.
  projectList.addEventListener('focusin', (event) => {
    if (event.target.matches('[data-hook="rate-note"]')) event.target.closest('[data-id]').dataset.editing = 'true';
  });

  async function rateStep(card, form, body) {
    const error = form.querySelector('.error-text');
    error.textContent = '';
    try {
      await api(`/api/projects/${card.dataset.id}/rate`, { method: 'POST', body });
      await refresh({ force: true });
      const agent = steps.find((s) => s.id === body.step)?.agent;
      if (agent) await coach.show(agent);
    } catch (err) {
      error.textContent = err.message;
    }
  }

  function renderRating(project) {
    return h('section', { class: 'rate', 'aria-label': 'Nilai kerja tim' },
      h('h3', {}, 'Nilai kerja tim'),
      h('p', { class: 'panel__hint' }, '"Bagus" disimpan jadi contoh buat agent itu. "Kurang" wajib dikasih catatan, nanti dibaca tiap dia kerja.'),
      steps.map((step) => {
        const rated = project.ratings?.[step.id];
        const noteId = `rate-${project.id}-${step.id}`;
        return h('form', { class: 'rate__row', dataset: { hook: 'rate-form', step: step.id } },
          h('span', { class: 'rate__who' }, h('strong', {}, step.label), ` · ${step.name}`),
          h('label', { class: 'visually-hidden', for: noteId }, `Catatan buat ${step.name}`),
          h('input', { id: noteId, name: 'note', maxlength: '500', placeholder: 'Catatan (wajib kalau kurang)', dataset: { hook: 'rate-note' } }),
          h('button', { class: 'btn btn--small rate__up', type: 'submit', value: 'up', 'aria-pressed': String(rated === 'up') }, 'Bagus'),
          h('button', { class: 'btn btn--small rate__down', type: 'submit', value: 'down', 'aria-pressed': String(rated === 'down') }, 'Kurang'),
          h('p', { class: 'error-text rate__error', role: 'alert' }),
        );
      }),
    );
  }

  function renderSteps(project) {
    const activeIndex = project.state === 'done' ? steps.length : steps.findIndex((s) => s.id === project.step);
    return h('div', { class: 'steps', 'aria-label': 'Progres tim' }, steps.map((step, i) => {
      let tone = '';
      if (i < activeIndex) tone = 'step--done';
      else if (i === activeIndex) tone = 'step--active';
      return h('span', { class: `step ${tone}` }, step.label);
    }));
  }

  function projectBadge(project) {
    if (project.state === 'proposed') return h('span', { class: 'badge badge--attention' }, 'Nunggu ACC kamu');
    if (project.state === 'done') return h('span', { class: 'badge badge--attention' }, 'Siap kamu cek');
    return h('span', { class: 'badge badge--working' }, 'Lagi dikerjain');
  }

  function renderProject(project) {
    const done = project.state === 'done';
    return h('li', { class: 'content-card', dataset: { id: String(project.id) } },
      h('div', { class: 'content-card__head' },
        h('h2', { class: 'content-card__title' }, project.name),
        h('span', { class: 'badge' }, project.kind === 'app' ? 'Web app' : 'Website'),
        projectBadge(project),
      ),
      project.state === 'proposed'
        ? h('p', { class: 'note' }, 'Bayu, Nadia, Tari, sama Fajar lagi rapatin proyek ini. Abis itu Bayu nanya deadline dan minta ACC kamu di ', h('a', { href: '#kantor' }, 'Kantor'), '.')
        : renderSteps(project),
      project.dueAt && h('p', { class: 'muted' }, `Deadline: ${formatDateTime(project.dueAt)} (${formatRelative(project.dueAt)})`),
      h('p', { class: 'muted' }, project.brief),
      project.files.length > 0 && h('div', { class: 'form' },
        h('h3', {}, `File (${project.files.length})`),
        h('div', { class: 'files' }, project.files.map((file) => h('button', {
          class: 'file-link', type: 'button', dataset: { action: 'open-file', path: file.path },
        }, file.path))),
        h('p', { class: 'panel__hint' }, `Tersimpan di workspace/projects/${project.slug}`),
      ),
      project.failure && h('div', { class: 'note' },
        h('p', { class: 'error-text' }, `Tim kepentok: ${project.failure.error}`),
        h('button', { class: 'btn btn--small', type: 'button', dataset: { action: 'retry', task: String(project.failure.taskId) } }, 'Coba lagi'),
      ),
      h('div', { class: 'actions' },
        project.previewUrl && h('a', { class: 'btn', href: project.previewUrl, target: '_blank', rel: 'noopener' }, 'Lihat tampilannya'),
        done && h('button', { class: 'btn', type: 'button', dataset: { action: 'show-revise' } }, 'Minta revisi'),
      ),
      done && renderRating(project),
      done && project.hasServer && renderRun(project),
      done && h('form', { class: 'inline-form', dataset: { hook: 'revise-form' }, hidden: true },
        h('label', { for: `revise-step-${project.id}` }, 'Bagian yang direvisi'),
        h('select', { id: `revise-step-${project.id}`, name: 'step' },
          steps.map((s) => h('option', { value: s.id }, s.label))),
        h('label', { for: `revise-note-${project.id}` }, 'Apa yang harus diubah?'),
        h('textarea', { id: `revise-note-${project.id}`, name: 'note', required: true, maxlength: '2000' }),
        h('button', { class: 'btn btn--primary btn--small', type: 'submit' }, 'Kirim ke tim'),
      ),
    );
  }

  function renderRun(project) {
    const { run } = project;
    const live = run.state === 'running';
    const label = { running: 'Jalan', starting: 'Lagi nyala', crashed: 'Error', stopped: 'Mati' }[run.state] ?? run.state;
    const tone = { running: 'badge--ok', starting: 'badge--working', crashed: 'badge--error' }[run.state] ?? '';
    return h('section', { class: 'run', 'aria-label': 'Jalankan proyek' },
      h('div', { class: 'task__line' },
        h('h3', {}, 'Jalankan aplikasinya'),
        h('span', { class: `badge ${tone}` }, label),
      ),
      h('p', { class: 'panel__hint' }, 'Kode ini ditulis AI dan jalan di laptopmu (node server.js). Cek dulu isinya kalau ragu.'),
      h('div', { class: 'actions' },
        live
          ? h('a', { class: 'btn btn--primary', href: run.url, target: '_blank', rel: 'noopener' }, `Buka app (port ${run.port})`)
          : h('button', { class: 'btn btn--primary', type: 'button', dataset: { action: 'run' } }, run.state === 'crashed' ? 'Jalankan ulang' : 'Jalankan'),
        live && h('button', { class: 'btn', type: 'button', dataset: { action: 'stop' } }, 'Matikan'),
        h('button', { class: 'btn', type: 'button', dataset: { action: 'show-fix' } }, 'Suruh Bayu benerin'),
      ),
      h('form', { class: 'inline-form', dataset: { hook: 'fix-form' }, hidden: true },
        h('label', { for: `fix-note-${project.id}` }, 'Masalahnya apa? (boleh kosong kalau error-nya udah kelihatan di log)'),
        h('textarea', { id: `fix-note-${project.id}`, name: 'note', maxlength: '2000' }),
        h('button', { class: 'btn btn--primary btn--small', type: 'submit' }, 'Kirim ke Bayu'),
      ),
      run.logs.length > 0 && h('pre', { class: 'run__log' }, run.logs.slice(-40).join('\n')),
    );
  }

  function renderIdeas(tasks) {
    if (!tasks.length) {
      ideaList.replaceChildren(h('li', { class: 'muted' }, 'Belum ada riset ide.'));
      return;
    }
    ideaList.replaceChildren(...tasks.map((task) => h('li', { class: 'form' },
      h('div', { class: 'task__line' },
        h('strong', {}, task.payload.topic),
        h('span', { class: 'muted' }, formatRelative(task.createdAt)),
      ),
      task.state === 'failed' && h('p', { class: 'error-text' }, task.error),
      task.state !== 'done' && task.state !== 'failed' && h('p', { class: 'muted' }, 'Nadia lagi riset…'),
      ...(task.result?.ideas ?? []).map((idea) => h('div', { class: 'idea' },
        h('strong', {}, idea.title),
        h('p', {}, idea.problem),
        h('p', { class: 'muted' }, idea.how),
        idea.why_now && h('p', { class: 'muted' }, `Kenapa sekarang: ${idea.why_now}`),
        idea.first_step && h('p', {}, `Langkah pertama: ${idea.first_step}`),
      )),
    )));
  }

  async function refresh({ force = false } = {}) {
    if (!force && projectList.querySelector('[data-editing]')) return;
    const [data, ideas] = await Promise.all([api('/api/projects'), api('/api/ideas')]);
    steps = data.steps;
    projectList.replaceChildren(...(data.projects.length
      ? data.projects.map(renderProject)
      : [h('li', { class: 'empty' }, 'Belum ada proyek. Ceritain website atau app yang mau dibikin.')]));
    renderIdeas(ideas);
  }

  return {
    async show() {
      await refresh({ force: true });
      coach.setTeam([{ agents: steps.map(({ agent, name, role, look }) => ({ id: agent, name, role, look })) }]);
      await coach.show();
    },
    hide() {},
    refresh,
  };
}
