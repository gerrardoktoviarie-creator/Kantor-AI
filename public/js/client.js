import { api } from './api.js';
import { h, hook, formatDateTime } from './dom.js';
import { renderScript } from './script-render.js';
import { avatarCanvas } from './sprites.js';

const ALE_LOOK = { hair: '#5a3825', shirt: '#4aa3df' };
const token = window.location.pathname.split('/').filter(Boolean).at(-1);
const list = hook('post-list');
const errorEl = hook('client-error');

list.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const post = button.closest('[data-id]');
  const { action } = button.dataset;

  if (action === 'approve') {
    send(post.dataset.id, { action: 'approve' }, button);
    return;
  }
  for (const form of post.querySelectorAll('form')) {
    form.hidden = form.dataset.form !== action;
  }
  post.querySelector(`form[data-form="${action}"] textarea, form[data-form="${action}"] input`)?.focus();
});

list.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  const post = form.closest('[data-id]');
  const values = Object.fromEntries(new FormData(form));
  send(post.dataset.id, { action: form.dataset.form, ...values }, event.submitter);
});

async function send(id, body, button) {
  errorEl.textContent = '';
  if (button) button.disabled = true;
  try {
    await api(`/api/client/${token}/contents/${id}`, { method: 'POST', body });
    await load();
  } catch (err) {
    errorEl.textContent = err.message;
    if (button) button.disabled = false;
  }
}

function phonePreview(content) {
  const script = content.script ?? {};
  if (content.format === 'reels') {
    return h('div', { class: 'phone', 'aria-hidden': 'true' },
      h('p', { class: 'phone__hook' }, script.hook ?? script.title ?? ''),
      ...(script.scenes ?? []).slice(0, 5).map((s) => h('p', { class: 'phone__scene' }, s.onscreen || s.visual)),
    );
  }
  const first = script.slides?.[0] ?? {};
  return h('div', { class: 'phone', 'aria-hidden': 'true' },
    h('p', { class: 'phone__hook' }, first.headline ?? script.title ?? ''),
    h('p', { class: 'phone__scene' }, first.body ?? ''),
  );
}

function renderPost(content) {
  const waiting = content.state === 'waiting_client';
  let status = null;
  if (content.state === 'approved') status = h('span', { class: 'badge badge--ok' }, 'Udah kamu setujui');
  if (content.state === 'reschedule') status = h('span', { class: 'badge badge--attention' }, `Minta pindah ke ${formatDateTime(content.requestedSchedule)}, nunggu konfirmasi tim`);

  return h('li', { class: 'client-post', dataset: { id: String(content.id) } },
    h('div', { class: 'content-card__head' },
      h('h2', { class: 'content-card__title' }, content.script?.title ?? 'Konten'),
      h('span', { class: 'badge' }, content.formatLabel),
      status,
    ),
    h('div', { class: 'client-post__body' },
      phonePreview(content),
      h('div', { class: 'form' },
        h('div', { class: 'ale' },
          avatarCanvas(ALE_LOOK),
          h('div', { class: 'bubble' },
            h('p', { class: 'bubble__who' }, 'Ale · Creative Lead'),
            h('p', {}, content.explain ?? ''),
          ),
        ),
        h('div', { class: 'schedule' },
          h('p', { class: 'schedule__label' }, 'Jadwal tayang'),
          h('p', { class: 'schedule__value' }, formatDateTime(content.scheduleAt)),
        ),
        waiting && h('div', { class: 'actions' },
          h('button', { class: 'btn btn--primary', type: 'button', dataset: { action: 'approve' } }, 'Setujui'),
          h('button', { class: 'btn', type: 'button', dataset: { action: 'revise' } }, 'Minta revisi'),
          h('button', { class: 'btn', type: 'button', dataset: { action: 'reschedule' } }, 'Ajukan ganti jadwal'),
        ),
        waiting && h('form', { class: 'inline-form', dataset: { form: 'revise' }, hidden: true },
          h('label', { for: `note-${content.id}` }, 'Apa yang mau diubah?'),
          h('textarea', { id: `note-${content.id}`, name: 'note', required: true, maxlength: '2000' }),
          h('button', { class: 'btn btn--primary btn--small', type: 'submit' }, 'Kirim revisi'),
        ),
        waiting && h('form', { class: 'inline-form', dataset: { form: 'reschedule' }, hidden: true },
          h('label', { for: `when-${content.id}` }, 'Maunya tayang kapan?'),
          h('input', { id: `when-${content.id}`, name: 'scheduleAt', type: 'datetime-local', required: true }),
          h('button', { class: 'btn btn--primary btn--small', type: 'submit' }, 'Ajukan'),
        ),
      ),
    ),
    h('details', {},
      h('summary', {}, 'Lihat naskah lengkap'),
      renderScript(content.script, content.format),
    ),
  );
}

async function load() {
  try {
    const data = await api(`/api/client/${token}`);
    document.title = `Preview konten · ${data.client.name}`;
    hook('client-title').textContent = `Konten untuk ${data.client.name}`;
    list.replaceChildren(...(data.contents.length
      ? data.contents.map(renderPost)
      : [h('li', { class: 'empty' }, 'Belum ada konten yang perlu kamu cek. Nanti muncul di sini.')]));
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

load();
