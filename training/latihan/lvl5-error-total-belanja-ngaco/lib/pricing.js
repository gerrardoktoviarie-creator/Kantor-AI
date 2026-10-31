export const PRODUCTS = {
  1: { name: 'Kopi Susu Gula Aren', price: 15000 },
  2: { name: 'Roti Bakar Cokelat', price: 18000 },
  3: { name: 'Biji Kopi Gayo 250g', price: 85000 },
  4: { name: 'Air Mineral', price: 5000 },
  5: { name: 'Croissant Almond', price: 23450 },
};

const SHIPPING = 10000;

export function quote(items, code) {
  let subtotal = 0;
  for (const item of items) subtotal += PRODUCTS[item.id].price * item.qty;

  let discount = 0;
  let shipping = SHIPPING;
  if (code === 'HEMAT10' && subtotal > 50000) discount = Math.min(subtotal * 0.1, 20000);
  if (code === 'ONGKIRFREE') shipping = 0;
  if (subtotal >= 100000) shipping = 0;

  return { subtotal, discount, shipping, total: subtotal - discount + shipping };
}
