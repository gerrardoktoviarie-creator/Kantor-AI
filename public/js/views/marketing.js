import { api } from '../api.js';
import { h, hook, handleSubmit, formatNumber, formatRelative } from '../dom.js';

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const money = (n) => (n == null ? '-' : rupiah.format(n));
const percent = (n) => (n == null ? '-' : `${(n * 100).toFixed(2).replace('.', ',')}%`);

const STATE = {
  analyzing: ['Raka lagi baca', 'badge--working'],
  thinking: ['Wulan lagi mikir', 'badge--working'],
  done: ['Beres', 'badge--ok'],
  failed: ['Gagal', 'badge--error'],
};

function stat(value, label) {
  return h('div', { class: 'stat' }, h('span', { class: 'stat__value' }, value), h('span', { class: 'stat__label' }, label));
}

function bullets(items, ordered = false) {
  return h(ordered ? 'ol' : 'ul', { class: 'bullets' }, (items ?? []).map((text) => h('li', {}, text)));
}

function adRow(ad) {
  return h('tr', {},
    h('td', {}, ad.name),
    h('td', {}, money(ad.spend)),
    h('td', {}, percent(ad.ctr)),
    h('td', {}, money(ad.cpc)),
    h('td', {}, formatNumber(ad.results)),
    h('td', {}, money(ad.cpr)),
  );
}

function reportCard(report) {
  const { totals } = report.summary;
  const [label, tone] = STATE[report.state] ?? STATE.analyzing;
  const a = report.analysis;
  return h('li', { class: 'panel report', dataset: { id: report.id } },
    h('div', { class: 'task__line' },
      h('h3', {}, report.name),
      h('span', { class: `badge ${tone}` }, label),
    ),
    h('p', { class: 'muted' }, `${totals.ads} iklan · ${formatRelative(report.createdAt)}`),
    h('div', { class: 'stat-row' },
      stat(money(totals.spend), 'total biaya'),
      stat(formatNumber(totals.impressions), 'impresi'),
      stat(percent(totals.ctr), 'CTR'),
      stat(money(totals.cpc), 'biaya per klik'),
      stat(formatNumber(totals.results), 'hasil'),
      stat(money(totals.cpr), 'biaya per hasil'),
    ),
    a ? h('div', { class: 'report__analysis' },
      h('p', {}, a.ringkasan),
      h('h4', {}, 'Yang jalan bagus'), bullets(a.bagus),
      h('h4', {}, 'Yang boros'), bullets(a.boros),
      h('h4', {}, 'Saran minggu depan'), bullets(a.saran, true),
      a.anggaran ? h('p', { class: 'note' }, h('strong', {}, 'Budget: '), a.anggaran) : '',
    ) : '',
    h('details', {},
      h('summary', {}, `Semua iklan (urut dari yang paling efisien, pakai ${report.summary.rankedBy === 'cpr' ? 'biaya per hasil' : 'CTR'})`),
      h('div', { class: 'table-scroll' },
        h('table', { class: 'data-table' },
          h('thead', {}, h('tr', {}, ['Iklan', 'Biaya', 'CTR', 'CPC', 'Hasil', 'Biaya/hasil'].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', {}, report.summary.ads.map(adRow)),
        ),
      ),
    ),
    h('div', { class: 'actions' },
      report.state === 'failed' ? h('button', { class: 'btn btn--small', type: 'button', dataset: { action: 'retry-report' } }, 'Suruh Raka coba lagi') : '',
      h('button', { class: 'btn btn--small btn--danger', type: 'button', dataset: { action: 'delete-report' } }, 'Hapus'),
    ),
  );
}

function audienceCard(idea) {
  const [label, tone] = STATE[idea.state] ?? STATE.thinking;
  return h('li', { class: 'panel', dataset: { id: idea.id } },
    h('div', { class: 'task__line' },
      h('h3', {}, idea.product.length > 60 ? `${idea.product.slice(0, 59)}…` : idea.product),
      h('span', { class: `badge ${tone}` }, label),
    ),
    h('p', { class: 'muted' }, `Tujuan: ${idea.goal}${idea.budget ? ` · budget ${money(idea.budget)}/hari` : ''} · ${formatRelative(idea.createdAt)}`),
    idea.result ? h('div', { class: 'audiences' }, idea.result.audiens.map((a) => h('article', { class: 'audience' },
      h('h4', {}, a.nama),
      h('p', { class: 'muted' }, [a.usia && `Usia ${a.usia}`, a.gender, a.lokasi].filter(Boolean).join(' · ')),
      h('div', { class: 'chips' }, (a.minat ?? []).map((m) => h('span', { class: 'chip' }, m))),
      h('p', {}, a.alasan),
      a.hook ? h('p', { class: 'note' }, `“${a.hook}”`) : '',
      a.budgetHarian ? h('p', { class: 'muted' }, `Budget tes: ${money(Number(a.budgetHarian))}/hari`) : '',
    ))) : '',
    idea.result?.catatan ? h('p', {}, h('strong', {}, 'Cara ngetes: '), idea.result.catatan) : '',
    h('div', { class: 'actions' },
      h('button', { class: 'btn btn--small btn--danger', type: 'button', dataset: { action: 'delete-idea' } }, 'Hapus'),
    ),
  );
}

export function createMarketingView() {
  const reportList = hook('ads-list');
  const ideaList = hook('audience-list');

  handleSubmit(hook('ads-form'), hook('ads-error'), async (values, form) => {
    const { file } = values;
    if (!(file instanceof File) || !file.size) throw new Error('Pilih file CSV dulu.');
    if (file.size > 4_000_000) throw new Error('File-nya kegedean (maks 4 MB). Ekspor rentang tanggal yang lebih pendek.');
    await api('/api/ads/reports', { method: 'POST', body: { name: values.name, csv: await file.text() } });
    form.reset();
    await refresh();
  });

  handleSubmit(hook('audience-form'), hook('audience-error'), async (values, form) => {
    await api('/api/ads/audiences', { method: 'POST', body: values });
    form.reset();
    await refresh();
  });

  async function act(event, calls) {
    const button = event.target.closest('[data-action]');
    const call = button && calls[button.dataset.action];
    if (!call) return;
    if (button.dataset.action.startsWith('delete') && !window.confirm('Hapus ini?')) return;
    button.disabled = true;
    try {
      await call(button.closest('[data-id]').dataset.id);
      await refresh();
    } catch (err) {
      window.alert(err.message);
    } finally {
      button.disabled = false;
    }
  }

  reportList.addEventListener('click', (event) => act(event, {
    'retry-report': (id) => api(`/api/ads/reports/${id}/retry`, { method: 'POST' }),
    'delete-report': (id) => api(`/api/ads/reports/${id}`, { method: 'DELETE' }),
  }));
  ideaList.addEventListener('click', (event) => act(event, {
    'delete-idea': (id) => api(`/api/ads/audiences/${id}`, { method: 'DELETE' }),
  }));

  // Open <details> survive the 4-second refresh only if we skip redrawing unchanged cards.
  let lastKey = '';
  async function refresh() {
    const [reports, ideas] = await Promise.all([api('/api/ads/reports'), api('/api/ads/audiences')]);
    const key = JSON.stringify([reports.map((r) => [r.id, r.state]), ideas.map((i) => [i.id, i.state])]);
    if (key === lastKey) return;
    lastKey = key;
    reportList.replaceChildren(...(reports.length ? reports.map(reportCard)
      : [h('li', { class: 'muted' }, 'Belum ada laporan. Upload CSV ekspor iklan di atas.')]));
    ideaList.replaceChildren(...(ideas.length ? ideas.map(audienceCard)
      : [h('li', { class: 'muted' }, 'Belum ada ide audiens.')]));
  }

  return { show: refresh, hide() {}, refresh };
}
