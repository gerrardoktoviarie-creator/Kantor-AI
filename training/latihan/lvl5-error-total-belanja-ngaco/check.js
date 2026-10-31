import assert from 'node:assert/strict';
import { withServer, postJson, runChecks } from '../../lib.js';

const checkout = (base, items, code) => postJson(`${base}/api/checkout`, code === undefined ? { items } : { items, code });
const expectQuote = async (base, items, code, expected) => {
  const { status, body } = await checkout(base, items, code);
  assert.equal(status, 200, JSON.stringify(body));
  assert.deepEqual(
    { subtotal: body.subtotal, discount: body.discount, shipping: body.shipping, total: body.total },
    expected,
  );
};

await withServer(process.argv[2], (base) => runChecks([
  ['tanpa promo', () => expectQuote(base, [{ id: 1, qty: 2 }], undefined,
    { subtotal: 30000, discount: 0, shipping: 10000, total: 40000 })],
  ['HEMAT10 huruf kecil tetap berlaku', () => expectQuote(base, [{ id: 3, qty: 1 }], 'hemat10',
    { subtotal: 85000, discount: 8500, shipping: 10000, total: 86500 })],
  ['HEMAT10 pas Rp50.000 udah boleh', () => expectQuote(base, [{ id: 1, qty: 3 }, { id: 4, qty: 1 }], 'HEMAT10',
    { subtotal: 50000, discount: 5000, shipping: 10000, total: 55000 })],
  ['HEMAT10 di bawah minimal: diskon 0', () => expectQuote(base, [{ id: 2, qty: 2 }], 'HEMAT10',
    { subtotal: 36000, discount: 0, shipping: 10000, total: 46000 })],
  ['ongkir dihitung dari subtotal setelah diskon', () => expectQuote(base, [{ id: 1, qty: 1 }, { id: 3, qty: 1 }], 'HEMAT10',
    { subtotal: 100000, discount: 10000, shipping: 10000, total: 100000 })],
  ['diskon dibulatkan ke bawah', () => expectQuote(base, [{ id: 5, qty: 3 }], 'HEMAT10',
    { subtotal: 70350, discount: 7035, shipping: 10000, total: 73315 })],
  ['diskon maksimal Rp20.000 dan ongkir gratis', () => expectQuote(base, [{ id: 3, qty: 3 }], 'HEMAT10',
    { subtotal: 255000, discount: 20000, shipping: 0, total: 235000 })],
  ['ONGKIRFREE', () => expectQuote(base, [{ id: 1, qty: 1 }], 'ongkirfree',
    { subtotal: 15000, discount: 0, shipping: 0, total: 15000 })],
  ['semua angka bilangan bulat', async () => {
    const { body } = await checkout(base, [{ id: 5, qty: 7 }], 'HEMAT10');
    for (const key of ['subtotal', 'discount', 'shipping', 'total']) assert.ok(Number.isInteger(body[key]), `${key} = ${body[key]}`);
  }],
  ['input salah jadi 400', async () => {
    const bad = [
      [[{ id: 1, qty: 0 }]], [[{ id: 1, qty: -1 }]], [[{ id: 1, qty: 2.5 }]], [[{ id: 1, qty: '2' }]],
      [[{ id: 1, qty: 100 }]], [[{ id: 99, qty: 1 }]], [[]], ['bukan array'], [[{ id: 1, qty: 1 }], 'NGASAL'],
    ];
    for (const [items, code] of bad) {
      const { status } = await checkout(base, items, code);
      assert.equal(status, 400, `${JSON.stringify(items)} ${code ?? ''} dapet ${status}`);
    }
  }],
]));
