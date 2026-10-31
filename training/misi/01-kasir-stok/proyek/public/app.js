const menu = document.querySelector('#menu');
const message = document.querySelector('#message');
const todayTotal = document.querySelector('#today-total');

const rupiah = (n) => `Rp${n.toLocaleString('id-ID')}`;

function say(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('message--error', isError);
}

async function loadToday() {
  const res = await fetch('/api/sales/today');
  const { total } = await res.json();
  todayTotal.textContent = rupiah(total);
}

async function sell(product) {
  const res = await fetch('/api/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: product.id, qty: 1 }),
  });
  if (!res.ok) return say('Gagal nyimpen penjualan.', true);
  say(`${product.name} terjual.`);
  await loadToday();
}

async function loadMenu() {
  const res = await fetch('/api/products');
  const products = await res.json();
  menu.replaceChildren(...products.map((product) => {
    const button = document.createElement('button');
    button.type = 'button';
    const name = document.createElement('span');
    name.textContent = product.name;
    const price = document.createElement('span');
    price.textContent = rupiah(product.price);
    button.append(name, price);
    button.addEventListener('click', () => sell(product));
    const item = document.createElement('li');
    item.append(button);
    return item;
  }));
}

try {
  await Promise.all([loadMenu(), loadToday()]);
} catch {
  say('Gak bisa nyambung ke server.', true);
}
