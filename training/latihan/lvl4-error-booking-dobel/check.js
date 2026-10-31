import assert from 'node:assert/strict';
import { withServer, getJson, postJson, runChecks } from '../../lib.js';

const book = (base, court, slot, name) => postJson(`${base}/api/bookings`, { court, slot, name });

await withServer(process.argv[2], (base) => runChecks([
  ['booking biasa jadi 201', async () => {
    const { status, body } = await book(base, 2, '2026-11-07 08:00', 'Rina');
    assert.equal(status, 201);
    assert.equal(body.name, 'Rina');
  }],
  ['slot yang udah kepakai jadi 409', async () => {
    assert.equal((await book(base, 2, '2026-11-07 08:00', 'Joni')).status, 409);
  }],
  ['5 orang pesan barengan: cuma 1 yang dapet', async () => {
    const names = ['Budi', 'Siti', 'Agus', 'Dewi', 'Eko'];
    const results = await Promise.all(names.map((n) => book(base, 1, '2026-11-07 19:00', n)));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409, 409, 409, 409]);
    const { body } = await getJson(`${base}/api/bookings`);
    assert.equal(body.filter((b) => b.court === 1 && b.slot === '2026-11-07 19:00').length, 1, 'di database cuma 1');
  }],
  ['pembayaran gagal jadi 402 dan slotnya bisa dipesan lagi', async () => {
    assert.equal((await book(base, 1, '2026-11-08 20:00', 'Gagal Bayar')).status, 402);
    assert.equal((await book(base, 1, '2026-11-08 20:00', 'Tono')).status, 201);
  }],
  ['yang bayar gagal barengan sama yang sukses: yang sukses tetap dapet', async () => {
    const [failed, ok] = await Promise.all([
      book(base, 3, '2026-11-09 10:00', 'Gagal Bayar'),
      new Promise((r) => setTimeout(r, 20)).then(() => book(base, 3, '2026-11-09 10:00', 'Lina')),
    ]);
    assert.equal(failed.status, 402);
    // Lina either waited for the slot to free up or was told it's busy; either way it must not be double-booked.
    const { body } = await getJson(`${base}/api/bookings`);
    const rows = body.filter((b) => b.court === 3 && b.slot === '2026-11-09 10:00');
    assert.ok(rows.length <= 1, 'maksimal 1 booking');
    if (ok.status === 409) assert.equal((await book(base, 3, '2026-11-09 10:00', 'Lina')).status, 201, 'setelah gagal bayar, slot harus lepas');
    else assert.equal(ok.status, 201);
  }],
  ['input kosong jadi 400', async () => {
    assert.equal((await book(base, 1, '', 'X')).status, 400);
  }],
]));
