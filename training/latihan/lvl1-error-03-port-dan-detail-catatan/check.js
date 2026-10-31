import assert from 'node:assert/strict';
import { withServer, getJson, runChecks } from '../../lib.js';

await withServer(process.argv[2], (base) => runChecks([
  ['detail catatan 1', async () => {
    const { status, body } = await getJson(`${base}/api/notes/1`);
    assert.equal(status, 200);
    assert.equal(body?.title, 'Belanja bulanan');
  }],
  ['catatan yang gak ada jadi 404', async () => {
    const { status, body } = await getJson(`${base}/api/notes/999`);
    assert.equal(status, 404);
    assert.ok(body?.error, 'ada pesan error');
  }],
  ['id bukan angka jadi 404 atau 400, bukan crash', async () => {
    const { status } = await getJson(`${base}/api/notes/abc`);
    assert.ok(status === 404 || status === 400, `status ${status}`);
  }],
]));
