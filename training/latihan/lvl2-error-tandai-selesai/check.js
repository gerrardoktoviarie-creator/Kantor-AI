import assert from 'node:assert/strict';
import { withServer, getJson, runChecks } from '../../lib.js';

const put = (url, data) => getJson(url, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});

await withServer(process.argv[2], (base) => runChecks([
  ['PUT done:true jadi 200 dan ke-update', async () => {
    const { status, body } = await put(`${base}/api/notes/1`, { done: true });
    assert.equal(status, 200);
    assert.equal(body.done, true);
    assert.equal(body.title, 'Belanja bulanan', 'judul gak boleh hilang');
  }],
  ['perubahan kesimpan di daftar', async () => {
    const { body } = await getJson(`${base}/api/notes`);
    assert.equal(body.find((n) => n.id === 1).done, true);
  }],
  ['id di body diabaikan', async () => {
    const { status, body } = await put(`${base}/api/notes/2`, { done: true, id: 77 });
    assert.equal(status, 200);
    assert.equal(body.id, 2);
  }],
  ['ganti judul boleh', async () => {
    const { status, body } = await put(`${base}/api/notes/2`, { title: 'Servis motor + ganti oli' });
    assert.equal(status, 200);
    assert.equal(body.title, 'Servis motor + ganti oli');
  }],
  ['done bukan boolean jadi 400', async () => {
    assert.equal((await put(`${base}/api/notes/1`, { done: 'ya' })).status, 400);
  }],
  ['judul kosong jadi 400', async () => {
    assert.equal((await put(`${base}/api/notes/1`, { title: '   ' })).status, 400);
  }],
  ['catatan yang gak ada jadi 404', async () => {
    assert.equal((await put(`${base}/api/notes/99`, { done: true })).status, 404);
  }],
]));
