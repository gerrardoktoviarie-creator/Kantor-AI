import assert from 'node:assert/strict';
import { withServer, getJson, postJson, runChecks } from '../../lib.js';

await withServer(process.argv[2], (base) => runChecks([
  ['POST dengan judul jadi 201', async () => {
    const { status, body } = await postJson(`${base}/api/notes`, { title: 'Bayar listrik' });
    assert.equal(status, 201);
    assert.equal(body.title, 'Bayar listrik');
    assert.ok(Number.isInteger(body.id));
  }],
  ['POST tanpa judul tetap 400', async () => {
    const { status } = await postJson(`${base}/api/notes`, {});
    assert.equal(status, 400);
  }],
  ['catatan baru muncul di daftar', async () => {
    const { body } = await getJson(`${base}/api/notes`);
    assert.ok(body.some((n) => n.title === 'Bayar listrik'));
  }],
]));
