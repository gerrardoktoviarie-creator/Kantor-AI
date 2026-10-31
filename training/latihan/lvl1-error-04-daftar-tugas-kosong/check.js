import assert from 'node:assert/strict';
import { withServer, getJson, runChecks } from '../../lib.js';

await withServer(process.argv[2], (base) => runChecks([
  ['GET /api/todos sesuai kontrak', async () => {
    const { status, body } = await getJson(`${base}/api/todos`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(body) && body.length === 2, 'array berisi 2 tugas');
    assert.equal(body[0].title, 'Kerjain PR matematika');
    assert.equal(typeof body[1].done, 'boolean');
    assert.equal(body[1].done, true);
  }],
  ['halaman utama tetap tersaji', async () => {
    const { status, body } = await getJson(`${base}/`);
    assert.equal(status, 200);
    assert.match(String(body), /Daftar tugas/);
  }],
]));
