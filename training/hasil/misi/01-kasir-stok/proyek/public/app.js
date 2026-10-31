const menuList = document.querySelector('#menu');
const message = document.querySelector('#message');
const todayTotal = document.querySelector('#today-total');
const emptyMsg = document.querySelector('#menu-empty');
const menuDesc = document.querySelector('#menu-desc');

const rupiah = (n) => `Rp${n.toLocaleString('id-ID')}`;

function say(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('message--error', isError);
}

function setLoading(button, text) {
  button.disabled = true;
  button.dataset.prev = button.textContent;
  button.textContent = text;
}

function restoreButton(button) {
  button.disabled = false;
  button.textContent = button.dataset.prev;
  delete button.dataset.prev;
}

function todayLabel(dateStr) {
  return dateStr.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1-$2-$3');
}

async function loadToday() {
  const res = await fetch('/api/sales/today');
  if (!res.ok) return say('Gak bisa ambil data hari ini.', true);
  const { total } = await res.json();
  todayTotal.textContent = rupiah(total);
}

async function loadMenu() {
  const res = await fetch('/api/products');
  if (!res.ok) return say('Gak bisa muat menu dari kasir.', true);
  const products = await res.json();

  if (!products.length) {
    menuList.replaceChildren();
    menuDesc.classList.add('hidden');
    emptyMsg.classList.remove('hidden');
    return;
  }

  menuDesc.classList.remove('hidden');
  emptyMsg.classList.add('hidden');
  menuList.replaceChildren(
    ...products.map((product) => {
      const isLow = !!product.low;
      const stockText = isLow ? 'Stok tipis' : `${product.stock} pcs`;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = 'sell';
      button.dataset.id = product.id;
      button.disabled = product.stock === 0;
      button.setAttribute('aria-label', `${product.name}, harga ${rupiah(product.price)}, ${stockText}`);
      button.setAttribute('aria-disabled', product.stock === 0 ? 'true' : 'false');

      const name = document.createElement('span');
      name.textContent = product.name;

      const stock = document.createElement('span');
      stock.textContent = stockText;
      if (isLow) {
        stock.classList.add('stock--low');
        stock.setAttribute('aria-label', 'Stok tipis, segera restok');
      }
      const isDisabled = product.stock === 0;
      stock.setAttribute('aria-hidden', 'true');

      const price = document.createElement('span');
      price.textContent = rupiah(product.price);

      button.append(name, stock, price);
      button.addEventListener('click', () => sell(product));
      return button;
    })
  );
}

async function sell(product) {
  const button = menuList.querySelector(`[data-action="sell"][data-id="${product.id}"]`);
  if (!button || button.disabled) return;

  setLoading(button, 'Menyimpan…');
  say('');

  try {
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: product.id, qty: 1 }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      say(body.error || 'Gagal nyimpen penjualan.', true);
      restoreButton(button);
      return;
    }
    await loadMenu();
    await loadToday();
    say(`${product.name} terjual.`);
  } catch {
    say('Gak bisa nyambung ke kasir.', true);
  } finally {
    if (button && button.disabled) restoreButton(button);
  }
}

async function cancelSale(id) {
  try {
    const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      say(body.error || 'Gagal membatalkan penjualan.', true);
      return;
    }
    await loadToday();
    await loadMenu();
    say('Penjualan dibatalin, stok kembali.');
  } catch {
    say('Gak bisa nyambung ke kasir.', true);
  }
}

menuList.addEventListener('click', (e) => {
  const button = e.target.closest('[data-action="sell"]');
  if (!button) return;
  const id = Number(button.dataset.id);
  const product = { id };
  cancelSale(id);
});

try {
  await Promise.all([loadMenu(), loadToday()]);
} catch {
  say('Gak bisa nyambung ke kasir.', true);
}
