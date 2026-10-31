import assert from 'node:assert/strict';
import { withServer, getJson, runChecks } from '../../lib.js';

const search = (base, q) => getJson(`${base}/api/products?q=${encodeURIComponent(q)}`);

await withServer(process.argv[2], (base) => runChecks([
  ['cari "Jum\'at" ketemu 1', async () => {
    const { status, body } = await search(base, "Jum'at");
    assert.equal(status, 200);
    assert.deepEqual(body.map((p) => p.name), ["Roti Jum'at Berkah"]);
  }],
  ['cari "roti" ketemu 2', async () => {
    const { body } = await search(base, 'roti');
    assert.equal(body.length, 2);
  }],
  ['teks dengan tanda kutip lain gak bikin error', async () => {
    const { status, body } = await search(base, "Ma'ruf \"spesial\"");
    assert.equal(status, 200);
    assert.equal(body.length, 0);
  }],
  ['tanpa q balikin semua', async () => {
    const { body } = await getJson(`${base}/api/products`);
    assert.equal(body.length, 3);
  }],
]));
