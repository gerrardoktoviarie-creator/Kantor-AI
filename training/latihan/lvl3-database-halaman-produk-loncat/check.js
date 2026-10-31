import assert from 'node:assert/strict';
import { withServer, getJson, runChecks } from '../../lib.js';

const list = (base, query) => getJson(`${base}/api/products?${query}`);
const BY_PRICE = ['Donat Gula', 'Kopi Tubruk', 'Teh Tarik', 'Americano', 'Kopi Susu Gula Aren', 'Roti Bakar Cokelat', 'Biji Kopi Gayo 250g'];

await withServer(process.argv[2], (base) => runChecks([
  ['halaman 1 mulai dari yang termurah', async () => {
    const { status, body } = await list(base, 'page=1&limit=3');
    assert.equal(status, 200);
    assert.deepEqual(body.items.map((p) => p.name), BY_PRICE.slice(0, 3));
    assert.equal(body.page, 1);
    assert.equal(body.limit, 3);
  }],
  ['total dan pages bener dan sama di tiap halaman', async () => {
    for (const page of [1, 2, 3]) {
      const { body } = await list(base, `page=${page}&limit=3`);
      assert.equal(body.total, 7, `total halaman ${page}`);
      assert.equal(body.pages, 3, `pages halaman ${page}`);
    }
  }],
  ['semua halaman nampilin tiap produk tepat sekali', async () => {
    const names = [];
    for (const page of [1, 2, 3]) names.push(...(await list(base, `page=${page}&limit=3`)).body.items.map((p) => p.name));
    assert.deepEqual(names, BY_PRICE);
  }],
  ['halaman setelah terakhir kosong', async () => {
    const { status, body } = await list(base, 'page=4&limit=3');
    assert.equal(status, 200);
    assert.deepEqual(body.items, []);
  }],
  ['default page 1 limit 10', async () => {
    const { body } = await list(base, '');
    assert.equal(body.page, 1);
    assert.equal(body.limit, 10);
    assert.equal(body.items.length, 7);
  }],
  ['limit kegedean dipotong jadi 50', async () => {
    const { status, body } = await list(base, 'limit=100000');
    assert.equal(status, 200);
    assert.equal(body.limit, 50);
  }],
  ['page/limit ngaco jadi 400', async () => {
    for (const query of ['limit=abc', 'page=0', 'page=-1', 'page=1.5', 'limit=0']) {
      assert.equal((await list(base, query)).status, 400, query);
    }
  }],
  ['filter q: total ikut filter, huruf besar kecil bebas', async () => {
    const { body } = await list(base, 'q=KOPI&limit=2');
    assert.equal(body.total, 3);
    assert.equal(body.pages, 2);
    assert.deepEqual(body.items.map((p) => p.name), ['Kopi Tubruk', 'Kopi Susu Gula Aren']);
  }],
]));
