import { api } from '../api.js';
import { h, hook, formatDateTime, handleSubmit } from '../dom.js';
import { renderScript } from '../script-render.js';

const STATES = {
  drafting: ['Sari lagi nulis', 'badge--working'],
  review: ['Perlu kamu cek', 'badge--attention'],
  releasing: ['Ale nyiapin penjelasan', 'badge--working'],
  waiting_client: ['Nunggu klien', ''],
  reschedule: ['Klien minta ganti jadwal', 'badge--attention'],
  approved: ['Disetujui klien', 'badge--ok'],
};

const FILTERS = {
  all: () => true,
  internal: (c) => ['drafting', 'review', 'releasing', 'reschedule'].includes(c.state),
  client: (c) => c.state === 'waiting_client',
  approved: (c) => c.state === 'approved',
};

export function createContentView() {
  const clientForm = hook('client-form');
  const clientList = hook('client-list');
  const contentForm = hook('content-form');
  const clientSelect = contentForm.elements.clientId;
  const list = hook('content-list');
  const filterBar = hook('content-filter');
  let contents = [];
  let filter = 'all';

  handleSubmit(clientForm, null, async (values, form) => {
    await api('/api/clients', { method: 'POST', body: values });
    form.reset();
    await refresh();
  });

  handleSubmit(contentForm, hook('content-error'), async (values, form) => {
    if (!values.clientId) throw new Error('Tambah klien dulu di sebelah kiri.');
    await api('/api/contents', { method: 'POST', body: values });
    form.elements.brief.value = '';
    await refresh();
  });

  filterBar.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-filter]');
    if (!chip) return;
    filter = chip.dataset.filter;
    for (const el of filterBar.children) el.classList.toggle('chip--active', el === chip);
    renderList();
  });

  clientList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action="copy-link"]');
    if (!button) return;
    const link = new URL(button.dataset.link, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(link);
      button.textContent = 'Kesalin!';
    } catch {
      window.prompt('Salin link ini:', link);
    }
  });

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const item = button.closest('[data-id]');
    const id = item.dataset.id;
    const { action } = button.dataset;

    if (action === 'show-revise') {
      item.querySelector('[data-hook="revise-form"]').hidden = false;
      item.dataset.editing = 'true';
      item.querySelector('textarea').focus();
      return;
    }
    if (action === 'cancel-revise') {
      item.querySelector('[data-hook="revise-form"]').hidden = true;
      delete item.dataset.editing;
      return;
    }

    button.disabled = true;
    try {
      if (action === 'release') await api(`/api/contents/${id}/release`, { method: 'POST' });
      if (action === 'accept-schedule') await api(`/api/contents/${id}/schedule`, { method: 'POST', body: { accept: true } });
      if (action === 'reject-schedule') await api(`/api/contents/${id}/schedule`, { method: 'POST', body: { accept: false } });
      if (action === 'delete' && window.confirm('Hapus konten ini?')) await api(`/api/contents/${id}`, { method: 'DELETE' });
      await refresh({ force: true });
    } catch (err) {
      window.alert(err.message);
      button.disabled = false;
    }
  });

  list.addEventListener('submit', async (event) => {
    event.preventDefault();
    const item = event.target.closest('[data-id]');
    const note = event.target.elements.note.value;
    try {
      await api(`/api/contents/${item.dataset.id}/revise`, { method: 'POST', body: { note } });
      await refresh({ force: true });
    } catch (err) {
      window.alert(err.message);
    }
  });

  function renderClients(clients) {
    const selected = clientSelect.value;
    clientSelect.replaceChildren(
      h('option', { value: '' }, clients.length ? 'Pilih klien' : 'Belum ada klien'),
      ...clients.map((c) => h('option', { value: String(c.id) }, c.name)),
    );
    clientSelect.value = selected;

    clientList.replaceChildren(...clients.map((client) => h('div', { class: 'client-row' },
      h('strong', {}, client.name),
      h('div', { class: 'actions' },
        h('a', { class: 'btn btn--small', href: `/klien/${client.token}`, target: '_blank', rel: 'noopener' }, 'Buka preview klien'),
        h('button', { class: 'btn btn--small', type: 'button', dataset: { action: 'copy-link', link: `/klien/${client.token}` } }, 'Salin link'),
      ),
    )));
  }

  function renderList() {
    const shown = contents.filter(FILTERS[filter]);
    if (!shown.length) {
      list.replaceChildren(h('li', { class: 'empty' }, contents.length ? 'Gak ada konten di filter ini.' : 'Belum ada konten. Kasih brief pertama ke Sari di atas.'));
      return;
    }
    list.replaceChildren(...shown.map(renderContent));
  }

  function renderContent(content) {
    const [label, tone] = STATES[content.state] ?? [content.state, ''];
    const canRevise = ['review', 'waiting_client'].includes(content.state);
    return h('li', { class: 'content-card', dataset: { id: String(content.id) } },
      h('div', { class: 'content-card__head' },
        h('h2', { class: 'content-card__title' }, content.script?.title || content.brief.slice(0, 60)),
        h('span', { class: 'badge' }, content.formatLabel),
        h('span', { class: `badge ${tone}` }, label),
      ),
      h('p', { class: 'muted' }, `${content.clientName} · tayang ${formatDateTime(content.scheduleAt)}`),
      content.clientNote && h('p', { class: 'note' }, `Catatan revisi dari klien: ${content.clientNote}`),
      content.state === 'reschedule' && h('div', { class: 'note' },
        h('p', {}, `Klien minta pindah ke ${formatDateTime(content.requestedSchedule)}.`),
        h('div', { class: 'actions' },
          h('button', { class: 'btn btn--primary btn--small', type: 'button', dataset: { action: 'accept-schedule' } }, 'Terima jadwal baru'),
          h('button', { class: 'btn btn--small', type: 'button', dataset: { action: 'reject-schedule' } }, 'Tetap jadwal lama'),
        ),
      ),
      renderScript(content.script, content.format),
      content.explain && h('p', { class: 'note' }, `Penjelasan Ale ke klien: ${content.explain}`),
      h('div', { class: 'actions' },
        content.state === 'review' && h('button', { class: 'btn btn--primary', type: 'button', dataset: { action: 'release' } }, 'Oke, rilis ke klien'),
        canRevise && h('button', { class: 'btn', type: 'button', dataset: { action: 'show-revise' } }, 'Revisi dulu'),
        h('button', { class: 'btn btn--small btn--danger', type: 'button', dataset: { action: 'delete' } }, 'Hapus'),
      ),
      canRevise && h('form', { class: 'inline-form', dataset: { hook: 'revise-form' }, hidden: true },
        h('label', { for: `revise-${content.id}` }, 'Apa yang harus Sari ubah?'),
        h('textarea', { id: `revise-${content.id}`, name: 'note', required: true, maxlength: '2000' }),
        h('div', { class: 'actions' },
          h('button', { class: 'btn btn--primary btn--small', type: 'submit' }, 'Kirim revisi'),
          h('button', { class: 'btn btn--small', type: 'button', dataset: { action: 'cancel-revise' } }, 'Batal'),
        ),
      ),
    );
  }

  async function refresh({ force = false } = {}) {
    // Don't wipe a revision note the user is in the middle of typing.
    if (!force && list.querySelector('[data-editing]')) return;
    const [clients, items] = await Promise.all([api('/api/clients'), api('/api/contents')]);
    renderClients(clients);
    contents = items;
    renderList();
  }

  return { show: refresh, hide() {}, refresh };
}
