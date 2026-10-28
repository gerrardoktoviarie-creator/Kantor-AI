import { api } from '../api.js';
import { h, hook, handleSubmit, formatRelative } from '../dom.js';

const qty = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

function productRow(p) {
  return h('tr', { class: p.low ? 'data-table__row--low' : '', dataset: { id: p.id } },
    h('td', {}, h('strong', {}, p.name), p.price ? h('span', { class: 'muted' }, ` · ${rupiah.format(p.price)}`) : ''),
    h('td', {}, `${qty.format(p.stock)} ${p.unit}`, p.low ? h('span', { class: 'badge badge--attention' }, 'tipis') : ''),
    h('td', {}, `${qty.format(p.minStock)} ${p.unit}`),
    h('td', {}, `${qty.format(p.soldWeek)} ${p.unit}`),
    h('td', {}, p.order > 0 ? `${qty.format(p.order)} ${p.unit}` : '-'),
    h('td', {}, h('button', { class: 'btn btn--small btn--danger', type: 'button', dataset: { action: 'delete-product' } }, 'Hapus')),
  );
}

function moveItem(m) {
  const incoming = m.qty > 0;
  return h('li', { class: 'move' },
    h('span', { class: `move__qty ${incoming ? 'move__qty--in' : 'move__qty--out'}` }, `${incoming ? '+' : '−'}${qty.format(Math.abs(m.qty))} ${m.unit}`),
    h('span', {}, m.name, m.note ? h('span', { class: 'muted' }, ` · ${m.note}`) : ''),
    h('span', { class: 'muted' }, formatRelative(m.at)),
  );
}

function recapItem(r) {
  return h('li', { class: 'panel' },
    h('div', { class: 'task__line' },
      h('strong', {}, `Minggu ${r.week}`),
      h('span', { class: `badge ${r.state === 'done' ? 'badge--ok' : 'badge--working'}` }, r.state === 'done' ? 'Beres' : 'Rudi lagi nulis'),
    ),
    r.text ? h('p', { class: 'recap__text' }, r.text) : '',
  );
}

export function createStockView() {
  const table = hook('stock-table');
  const moveSelect = hook('move-product');
  const moves = hook('stock-moves');
  const recaps = hook('stock-recaps');

  handleSubmit(hook('product-form'), hook('product-error'), async (values, form) => {
    await api('/api/stock/products', { method: 'POST', body: values });
    form.reset();
    await refresh();
  });

  handleSubmit(hook('move-form'), hook('move-error'), async (values, form) => {
    const amount = Number(values.qty);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Jumlah harus lebih dari 0.');
    await api(`/api/stock/products/${values.productId}/moves`, {
      method: 'POST',
      body: { qty: values.direction === 'out' ? -amount : amount, note: values.note },
    });
    form.elements.qty.value = '';
    form.elements.note.value = '';
    await refresh();
  });

  table.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action="delete-product"]');
    if (!button || !window.confirm('Hapus barang ini beserta riwayatnya?')) return;
    button.disabled = true;
    try {
      await api(`/api/stock/products/${button.closest('[data-id]').dataset.id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      window.alert(err.message);
      button.disabled = false;
    }
  });

  hook('recap-now').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      await api('/api/stock/recaps', { method: 'POST' });
      await refresh();
    } catch (err) {
      window.alert(err.message);
    } finally {
      event.currentTarget.disabled = false;
    }
  });

  async function refresh() {
    const [stock, recapRows] = await Promise.all([api('/api/stock'), api('/api/stock/recaps')]);
    table.replaceChildren(...(stock.products.length ? stock.products.map(productRow)
      : [h('tr', {}, h('td', { colspan: '6', class: 'muted' }, 'Belum ada barang. Tambah lewat form di atas.'))]));

    // Keep the picked product when the list redraws every few seconds.
    const picked = moveSelect.value;
    moveSelect.replaceChildren(...stock.products.map((p) => h('option', { value: String(p.id) }, `${p.name} (sisa ${qty.format(p.stock)} ${p.unit})`)));
    if (stock.products.some((p) => String(p.id) === picked)) moveSelect.value = picked;
    moveSelect.disabled = !stock.products.length;

    moves.replaceChildren(...(stock.moves.length ? stock.moves.map(moveItem) : [h('li', { class: 'muted' }, 'Belum ada barang masuk/keluar.')]));
    recaps.replaceChildren(...(recapRows.length ? recapRows.map(recapItem)
      : [h('li', { class: 'muted' }, 'Rudi bikin rekap otomatis tiap Senin jam 8 pagi.')]));
  }

  return { show: refresh, hide() {}, refresh };
}
