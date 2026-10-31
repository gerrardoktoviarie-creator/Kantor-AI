import assert from 'node:assert/strict';
import { withServer, getJson, postJson, runChecks } from '../../lib.js';

const raw = (base, body) => getJson(`${base}/api/convert`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
});
const alive = async (base) => assert.equal((await getJson(`${base}/api/health`)).status, 200, 'server harus tetap hidup');

await withServer(process.argv[2], (base) => runChecks([
  ['konversi normal', async () => {
    const { status, body } = await postJson(`${base}/api/convert`, { amount: 10, currency: 'USD' });
    assert.equal(status, 200);
    assert.equal(body.rupiah, 162500);
  }],
  ['huruf kecil boleh', async () => {
    const { body } = await postJson(`${base}/api/convert`, { amount: 2, currency: 'sgd' });
    assert.equal(body.rupiah, 24200);
  }],
  ['JSON rusak jadi 400 dan server hidup', async () => {
    assert.equal((await raw(base, '{amount: 10')).status, 400);
    await alive(base);
  }],
  ['body kosong jadi 400 dan server hidup', async () => {
    assert.equal((await raw(base, '')).status, 400);
    await alive(base);
  }],
  ['mata uang gak dikenal jadi 400 dan server hidup', async () => {
    const { status, body } = await postJson(`${base}/api/convert`, { amount: 10, currency: 'XYZ' });
    assert.equal(status, 400);
    assert.ok(body?.error, 'ada pesan error');
    await alive(base);
  }],
  ['amount bukan angka jadi 400', async () => {
    assert.equal((await postJson(`${base}/api/convert`, { amount: 'abc', currency: 'USD' })).status, 400);
    assert.equal((await postJson(`${base}/api/convert`, { amount: '10', currency: 'USD' })).status, 400);
  }],
  ['amount nol atau minus jadi 400', async () => {
    assert.equal((await postJson(`${base}/api/convert`, { amount: 0, currency: 'USD' })).status, 400);
    assert.equal((await postJson(`${base}/api/convert`, { amount: -5, currency: 'USD' })).status, 400);
  }],
  ['setelah semua itu server masih hidup', () => alive(base)],
]));
