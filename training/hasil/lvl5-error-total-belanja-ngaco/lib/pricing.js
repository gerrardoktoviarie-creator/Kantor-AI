export const PRODUCTS = {
  1: { name: 'Kopi Susu Gula Aren', price: 15000 },
  2: { name: 'Roti Bakar Cokelat', price: 18000 },
  3: { name: 'Biji Kopi Gayo 250g', price: 85000 },
  4: { name: 'Air Mineral', price: 5000 },
  5: { name: 'Croissant Almond', price: 23450 },
};

const SHIPPING = 10000;
const VALID_CODES = new Set(['HEMAT10', 'ONGKIRFREE']);

function isIntPositive(value) {
  return Number.isInteger(value) && value >= 1;
}

export function quote(items, code) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('items wajib minimal 1');
  }

  let subtotal = 0;
  for (const item of items) {
    if (item.id == null || !(item.id in PRODUCTS)) {
      throw new Error(`Produk id ${item.id} tidak dikenal`);
    }
    if (!isIntPositive(item.qty)) {
      throw new Error('qty wajib bilangan bulat 1-99');
    }
    if (item.qty > 99) {
      throw new Error('qty maksimum 99');
    }
    subtotal += PRODUCTS[item.id].price * item.qty;
  }

  const normCode = String(code ?? '').trim().toUpperCase();
  let discount = 0;
  let freeShipping = false;
  if (normCode === 'HEMAT10') {
    if (subtotal >= 50000) {
      discount = Math.floor(subtotal * 0.1);
      if (discount > 20000) discount = 20000;
    }
  } else if (normCode === 'ONGKIRFREE') {
    freeShipping = true;
  } else if (normCode !== '') {
    throw new Error(`Kode promo ${code} tidak dikenal`);
  }

  const afterDiscount = subtotal - discount;
  const shipping = freeShipping || afterDiscount >= 100000 ? 0 : SHIPPING;

  const total = subtotal - discount + shipping;
  return { subtotal, discount, shipping, total };
}