// What the boss checks after each review: the planted bugs are gone, nothing that worked before
// broke (mission 01's checks run again), and Bayu wrote down what he found.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { withServer, getJson } from '../../lib.js';
import { grade as gradeMission01 } from '../01-kasir-stok/check.js';

const read = (dir, path) => readFileSync(join(dir, path), 'utf8');
const tempDb = () => join(mkdtempSync(join(tmpdir(), 'misi-review-')), 'data.db');
const ORIGINAL_SCHEMA = readFileSync(new URL('../01-kasir-stok/proyek/db/schema.sql', import.meta.url), 'utf8');
const STOCK_MIGRATION = readFileSync(new URL('proyek/db/migrations/002-stok.sql', import.meta.url), 'utf8');

// A database from before the stock feature, with sales at known times (stored in UTC).
function salesDb() {
  const path = tempDb();
  const db = new DatabaseSync(path);
  db.exec(ORIGINAL_SCHEMA);
  db.exec(`INSERT INTO sales (product_id, qty, total, created_at) VALUES
    (1, 2, 30000, '2026-10-01 03:00:00'),
    (3, 1, 18000, '2026-09-30 20:00:00'),
    (2, 1, 12000, '2026-10-01 18:30:00'),
    (1, 1, 15000, '2026-10-02 10:00:00'),
    (4, 1, 10000, '2026-10-03 17:30:00')`);
  db.close();
  return path;
}

// The cashier laptop after the stock release: version 2, stock already filled in.
function stockDb() {
  const path = tempDb();
  const db = new DatabaseSync(path);
  db.exec(ORIGINAL_SCHEMA);
  db.exec(STOCK_MIGRATION);
  db.exec('UPDATE products SET stock = 12, min_stock = 3 WHERE id = 1');
  db.exec("INSERT INTO sales (product_id, qty, total) VALUES (1, 1, 15000)");
  db.close();
  return path;
}

async function regression(dir, check, steps) {
  for (const step of steps) {
    const { output } = await gradeMission01(step, dir);
    for (const line of output.split('\n')) {
      const failed = line.startsWith('GAGAL');
      await check(`[fitur lama: ${step}] ${line.slice(7).split(':')[0]}`, () => {
        if (failed) throw new Error(line.slice(7).split(':').slice(1).join(':').trim());
      });
    }
  }
}

async function reviewNotes(dir, check, file) {
  await check(`catatan review ${file} ada dan nyebut minimal 3 temuan`, () => {
    assert.ok(existsSync(join(dir, file)), `${file} belum ada`);
    const findings = read(dir, file).split('\n').filter((l) => /^\s*([-*]|\d+[.)])\s+\S/.test(l));
    assert.ok(findings.length >= 3, `baru ${findings.length} temuan`);
  });
}

const byProduct = (items) => Object.fromEntries((items ?? []).map((i) => [i.product_id, [i.qty, i.total]]));

const STEPS = {
  async 'review-1'(dir, check) {
    await withServer(dir, async (base) => {
      await check('laporan 1 hari: pakai tanggal WIB', async () => {
        const { status, body } = await getJson(`${base}/api/report?from=2026-10-01&to=2026-10-01`);
        assert.equal(status, 200);
        assert.deepEqual(byProduct(body.items), { 1: [2, 30000], 3: [1, 18000] });
        assert.equal(body.grand_total, 48000);
      });
      await check('laporan beberapa hari: tanggal terakhir ikut dihitung', async () => {
        const { body } = await getJson(`${base}/api/report?from=2026-10-01&to=2026-10-02`);
        assert.deepEqual(byProduct(body.items), { 1: [3, 45000], 2: [1, 12000], 3: [1, 18000] });
        assert.equal(body.grand_total, 75000);
      });
      await check('tanggal ngaco ditolak 400', async () => {
        for (const query of ['', 'from=2026-10-01', 'from=2026-13-01&to=2026-13-02', 'from=2026-10-05&to=2026-10-01', 'from=kemarin&to=hari-ini']) {
          assert.equal((await getJson(`${base}/api/report?${query}`)).status, 400, query || '(kosong)');
        }
      });
      await check('total hari ini masih kebaca halaman kasir', async () => {
        const { body } = await getJson(`${base}/api/sales/today`);
        const app = read(dir, 'public/app.js');
        assert.ok(typeof body.total === 'number' || (/grand_total/.test(app) && typeof body.grand_total === 'number'),
          'API gak lagi ngirim field yang dibaca app.js');
      });
    }, { DB_PATH: salesDb() });
    await regression(dir, check, ['stok-server', 'batal', 'tampilan']);
    await reviewNotes(dir, check, 'review/pr-1.md');
  },

  async 'review-2'(dir, check) {
    const app = read(dir, 'public/app.js');
    const html = read(dir, 'public/index.html');
    await check('app.js valid', () => {
      const run = spawnSync(process.execPath, ['--check', join(dir, 'public/app.js')], { encoding: 'utf8' });
      assert.equal(run.status, 0, run.stderr.slice(0, 300));
    });
    await check('semua elemen yang dicari app.js ada di index.html (halaman gak mati pas dibuka)', () => {
      for (const [, id] of app.matchAll(/querySelector\(\s*['"]#([\w-]+)['"]\s*\)/g)) {
        assert.match(html, new RegExp(`id="${id}"`), `#${id} gak ada di index.html`);
      }
    });
    await check('riwayat penjualan hari ini masih ada dengan tombol Batal', () => {
      assert.match(app, /\/api\/sales\/today/);
      assert.match(app, /Batal/);
    });
    await check('nama menu gak lewat innerHTML', () => {
      assert.doesNotMatch(app, /innerHTML\s*\+?=\s*(?!(''|""|``)\s*;)/, 'masih ada innerHTML yang diisi data');
    });
    await check('batal manggil endpoint yang bener', () => {
      assert.doesNotMatch(app, /\/api\/sale\//, 'masih ke /api/sale/ (tanpa s)');
      assert.match(app, /\/api\/sales\/\$\{[^}]+\}[`'"][\s\S]{0,80}DELETE/, 'gak ada DELETE ke /api/sales/:id');
    });
    await check('abis batal, stok di tombol menu ikut ke-update', () => {
      assert.match(app, /DELETE[\s\S]{0,500}loadMenu\(/, 'setelah DELETE, daftar menu (stok) gak dimuat ulang');
    });
    await regression(dir, check, ['stok-server', 'batal', 'tampilan']);
    await reviewNotes(dir, check, 'review/pr-2.md');
  },

  async 'review-3'(dir, check) {
    const categories = (body) => Object.fromEntries(body.map((p) => [p.id, p.category]));
    const expected = { 1: 'minuman', 2: 'minuman', 3: 'makanan', 4: 'minuman' };
    await check('database versi 1 (sebelum fitur stok): dua migrasi jalan, kategori bener', () => withServer(dir, async (base) => {
      const { status, body } = await getJson(`${base}/api/products`);
      assert.equal(status, 200, `GET /api/products ${status}`);
      assert.deepEqual(categories(body), expected);
    }, { DB_PATH: salesDb() }));
    await check('database versi 2 (laptop kasir sekarang): kategori ditambah, stok gak ilang', () => withServer(dir, async (base) => {
      const { status, body } = await getJson(`${base}/api/products`);
      assert.equal(status, 200, `GET /api/products ${status}`);
      assert.deepEqual(categories(body), expected);
      const kopi = body.find((p) => p.id === 1);
      assert.deepEqual([kopi.stock, kopi.min_stock], [12, 3], 'stok yang udah diisi hilang');
      assert.equal((await getJson(`${base}/api/sales/today`)).body.sales.length, 1, 'penjualan hari ini hilang');
    }, { DB_PATH: stockDb() }));
    await check('database baru: langsung punya kategori', () => withServer(dir, async (base) => {
      const { status, body } = await getJson(`${base}/api/products`);
      assert.equal(status, 200, `GET /api/products ${status}`);
      assert.deepEqual(categories(body), expected);
    }, { DB_PATH: tempDb() }));
    await check('nyalain ulang di database yang udah versi 3 aman', async () => {
      const path = stockDb();
      await withServer(dir, async () => {}, { DB_PATH: path });
      await withServer(dir, async (base) => {
        assert.equal((await getJson(`${base}/api/products`)).status, 200);
      }, { DB_PATH: path });
      const db = new DatabaseSync(path);
      assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
    });
    await regression(dir, check, ['stok-server', 'batal', 'tampilan']);
    await reviewNotes(dir, check, 'review/pr-3.md');
  },
};

export const STEP_IDS = Object.keys(STEPS);

const oneLine = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean)
  .filter((l) => !l.startsWith('at ') && !/^Node\.js v/.test(l)).join(' | ').slice(0, 500);

/** Runs the boss's checks for one review against the project in `dir`. */
export async function grade(stepId, dir) {
  const lines = [];
  const check = async (name, fn) => {
    try {
      await fn();
      lines.push(`LULUS  ${name}`);
    } catch (err) {
      lines.push(`GAGAL  ${name}: ${oneLine(err.message)}`);
    }
  };
  try {
    await STEPS[stepId](dir, check);
  } catch (err) {
    lines.push(`GAGAL  ${stepId}: ${oneLine(err.message)}`);
  }
  return { passed: lines.length > 0 && lines.every((l) => l.startsWith('LULUS')), output: lines.join('\n') };
}
