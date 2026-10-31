import assert from 'node:assert/strict';
import { withServer, getJson, runChecks } from '../../lib.js';

await withServer(process.argv[2], (base) => runChecks([
  ['server nyala dan /api/health ok', async () => {
    const { status, body } = await getJson(`${base}/api/health`);
    assert.equal(status, 200);
    assert.deepEqual(body, { ok: true });
  }],
  ['/api/notes masih jalan', async () => {
    const { status, body } = await getJson(`${base}/api/notes`);
    assert.equal(status, 200);
    assert.equal(body[0].title, 'Belanja bulanan');
  }],
]));
