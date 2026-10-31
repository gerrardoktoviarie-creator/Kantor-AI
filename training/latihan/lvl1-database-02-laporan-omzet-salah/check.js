import assert from 'node:assert/strict';
import { withServer, getJson, runChecks } from '../../lib.js';

await withServer(process.argv[2], (base) => runChecks([
  ['omzet cuma dari pesanan lunas, gak dobel', async () => {
    const { status, body } = await getJson(`${base}/api/report`);
    assert.equal(status, 200);
    assert.equal(body.total, 45000);
  }],
  ['jumlah pesanan lunas 2', async () => {
    const { body } = await getJson(`${base}/api/report`);
    assert.equal(body.orders, 2);
  }],
]));
