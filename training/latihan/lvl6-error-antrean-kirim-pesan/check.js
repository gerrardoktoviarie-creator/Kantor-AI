import assert from 'node:assert/strict';
import { withServer, getJson, postJson, runChecks } from '../../lib.js';

await withServer(process.argv[2], async (base) => {
  const create = async (to) => (await postJson(`${base}/api/jobs`, { to, text: 'Pesanan kamu udah siap diambil.' })).body;
  const normal = await Promise.all(['0811', '0812', '0813', '0814', '0815', '0816'].map(create));
  const flaky = await create('kadang-0817');
  const dead = await create('gagal-0818');
  const all = [...normal, flaky, dead];

  // Let the worker settle: every job sent or failed, or give up after 8 seconds.
  const end = Date.now() + 8000;
  let jobs = [];
  while (Date.now() < end) {
    jobs = await Promise.all(all.map(async (j) => (await getJson(`${base}/api/jobs/${j.id}`)).body));
    if (jobs.every((j) => j?.status === 'sent' || j?.status === 'failed')) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  // A little longer, so a double send that is still in flight shows up.
  await new Promise((r) => setTimeout(r, 500));
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const deliveries = (await getJson(`${base}/api/deliveries`)).body;
  const sentCount = (id) => deliveries.filter((d) => d.jobId === id).length;

  await runChecks([
    ['POST job baru jadi 201 queued', () => {
      assert.equal(normal[0].status, 'queued');
      assert.ok(Number.isInteger(normal[0].id));
    }],
    ['job tanpa tujuan jadi 400', async () => {
      assert.equal((await postJson(`${base}/api/jobs`, { text: 'x' })).status, 400);
    }],
    ['semua job selesai (gak ada yang nyangkut)', () => {
      for (const job of jobs) assert.ok(['sent', 'failed'].includes(job?.status), `job ${job?.id}: ${job?.status}`);
    }],
    ['tiap pesan sukses dikirim tepat sekali', () => {
      for (const job of [...normal, flaky]) assert.equal(sentCount(job.id), 1, `job ${job.id} terkirim ${sentCount(job.id)}x`);
    }],
    ['nomor normal: sent, attempts 1', () => {
      for (const job of normal) {
        assert.equal(byId.get(job.id).status, 'sent');
        assert.equal(byId.get(job.id).attempts, 1, `job ${job.id}`);
      }
    }],
    ['nomor kadang gagal: sent di percobaan ke-2', () => {
      assert.equal(byId.get(flaky.id).status, 'sent');
      assert.equal(byId.get(flaky.id).attempts, 2);
    }],
    ['nomor mati: failed setelah 3 percobaan, error kesimpan, gak pernah terkirim', () => {
      const job = byId.get(dead.id);
      assert.equal(job.status, 'failed');
      assert.equal(job.attempts, 3);
      assert.equal(job.error, 'Nomor gak aktif');
      assert.equal(sentCount(dead.id), 0);
    }],
    ['stats sesuai', async () => {
      const { body } = await getJson(`${base}/api/stats`);
      assert.deepEqual(body, { queued: 0, sending: 0, sent: 7, failed: 1 });
    }],
    ['job yang gak ada jadi 404', async () => {
      assert.equal((await getJson(`${base}/api/jobs/999`)).status, 404);
    }],
  ]);
});
