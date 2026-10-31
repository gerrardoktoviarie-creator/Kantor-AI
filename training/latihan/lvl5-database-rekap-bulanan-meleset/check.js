import assert from 'node:assert/strict';
import { withServer, getJson, runChecks } from '../../lib.js';

const report = (base, year) => getJson(`${base}/api/report/monthly${year === undefined ? '' : `?year=${year}`}`);
const months = (year, filled) => Array.from({ length: 12 }, (_, i) => {
  const month = `${year}-${String(i + 1).padStart(2, '0')}`;
  return { month, total: 0, orders: 0, ...filled[month] };
});
const pick = (rows) => rows.map(({ month, total, orders }) => ({ month, total, orders }));

await withServer(process.argv[2], (base) => runChecks([
  ['2026: WIB, tanpa yang batal, 12 bulan lengkap', async () => {
    const { status, body } = await report(base, 2026);
    assert.equal(status, 200);
    assert.deepEqual(pick(body), months(2026, {
      '2026-01': { total: 55000, orders: 2 },
      '2026-02': { total: 65000, orders: 2 },
      '2026-03': { total: 15000, orders: 1 },
    }));
  }],
  ['2025: pesanan 31 Des jam 20.00 UTC pindah ke 2026', async () => {
    const { body } = await report(base, 2025);
    assert.deepEqual(pick(body), months(2025, { '2025-01': { total: 50000, orders: 1 } }));
  }],
  ['2027: pesanan 31 Des 2026 jam 17.30 UTC masuk Januari 2027', async () => {
    const { body } = await report(base, 2027);
    assert.deepEqual(pick(body), months(2027, { '2027-01': { total: 40000, orders: 1 } }));
  }],
  ['year salah atau kosong jadi 400', async () => {
    for (const year of [undefined, 'abc', '26', '20266']) {
      assert.equal((await report(base, year)).status, 400, `year=${year}`);
    }
  }],
]));
