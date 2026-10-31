// What the boss checks after each message. Every step gets a fresh copy of the cashier
// laptop's database: the original schema plus real sales, one of them from two days ago.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { withServer, getJson, postJson } from '../../lib.js';

const ORIGINAL_SCHEMA = readFileSync(new URL('proyek/db/schema.sql', import.meta.url), 'utf8');

const tempDb = () => join(mkdtempSync(join(tmpdir(), 'misi-kasir-')), 'data.db');

function oldDb() {
  const path = tempDb();
  const db = new DatabaseSync(path);
  db.exec(ORIGINAL_SCHEMA);
  db.exec(`INSERT INTO sales (product_id, qty, total, created_at) VALUES
    (1, 2, 30000, datetime('now', '-2 days')),
    (2, 1, 12000, datetime('now', '-2 days')),
    (1, 1, 15000, datetime('now'))`);
  db.close();
  return path;
}

const read = (dir, path) => readFileSync(join(dir, path), 'utf8');
const columns = (db, table) => db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all().map((c) => c.name);
const del = (url) => getJson(url, { method: 'DELETE' });
const product = async (base, id) => (await getJson(`${base}/api/products`)).body.find((p) => p.id === id);

// The cashier still has to open the page after any server change.
async function pageStillOpens(base) {
  const page = await getJson(`${base}/`);
  assert.equal(page.status, 200, `GET / balikin ${page.status}`);
  assert.match(String(page.body), /Kasir/);
  assert.equal((await getJson(`${base}/app.js`)).status, 200, 'GET /app.js gagal');
}

const STEPS = {
  async migrasi(dir, check) {
    await check('file db/migrations/002-stok.sql ada', () => {
      assert.ok(existsSync(join(dir, 'db/migrations/002-stok.sql')));
    });
    await check('migrasi di database lama: kolom stok ada, data 3 bulan utuh', () => {
      const db = new DatabaseSync(oldDb());
      db.exec(read(dir, 'db/migrations/002-stok.sql'));
      for (const col of ['stock', 'min_stock']) assert.ok(columns(db, 'products').includes(col), `kolom ${col}`);
      const rows = db.prepare('SELECT id, name, price, stock, min_stock FROM products ORDER BY id').all();
      assert.deepEqual(rows.map((r) => r.name), ['Kopi Susu Gula Aren', 'Americano', 'Roti Bakar Cokelat', 'Teh Tarik']);
      assert.ok(rows.every((r) => r.stock === 0 && r.min_stock === 5), 'stok awal 0, min_stock 5');
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sales').get().n, 3, 'penjualan lama utuh');
      assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
    });
    await check('stok minus ditolak, min_stock bisa beda per menu', () => {
      const db = new DatabaseSync(oldDb());
      db.exec(read(dir, 'db/migrations/002-stok.sql'));
      assert.throws(() => db.exec('UPDATE products SET stock = -1 WHERE id = 1'), undefined, 'stok minus');
      db.exec('UPDATE products SET min_stock = 3 WHERE id = 2');
      assert.equal(db.prepare('SELECT min_stock FROM products WHERE id = 2').get().min_stock, 3);
    });
    await check('database baru dari schema.sql: langsung versi 2, aman dijalanin dua kali', () => {
      const db = new DatabaseSync(':memory:');
      const schema = read(dir, 'db/schema.sql');
      db.exec(schema);
      db.exec(schema);
      for (const col of ['stock', 'min_stock']) assert.ok(columns(db, 'products').includes(col), `kolom ${col}`);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products').get().n, 4);
      assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
      assert.throws(() => db.exec('UPDATE products SET stock = -1 WHERE id = 1'), undefined, 'stok minus');
    });
  },

  async 'stok-server'(dir, check) {
    const dbPath = oldDb();
    await withServer(dir, async (base) => {
      await check('database lama kemigrasi otomatis, penjualan lama tetap ada', async () => {
        const { status, body } = await getJson(`${base}/api/products`);
        assert.equal(status, 200);
        assert.equal(body.length, 4);
        const kopi = body.find((p) => p.id === 1);
        assert.deepEqual({ stock: kopi.stock, min_stock: kopi.min_stock, low: kopi.low }, { stock: 0, min_stock: 5, low: true });
        assert.equal((await getJson(`${base}/api/sales/today`)).body.sales.length, 1, 'penjualan hari ini');
      });
      await check('restok', async () => {
        const { status, body } = await postJson(`${base}/api/products/1/restock`, { qty: 10 });
        assert.equal(status, 200);
        assert.equal(body.stock, 10);
        assert.equal(body.low, false);
      });
      await check('restok ngaco ditolak', async () => {
        for (const qty of [0, -3, 'a', 1001, 2.5]) {
          assert.equal((await postJson(`${base}/api/products/1/restock`, { qty })).status, 400, `qty ${qty}`);
        }
        assert.equal((await postJson(`${base}/api/products/99/restock`, { qty: 5 })).status, 404);
        assert.equal((await product(base, 1)).stock, 10);
      });
      await check('jual ngurangin stok, low ikut berubah', async () => {
        assert.equal((await postJson(`${base}/api/sales`, { product_id: 1, qty: 3 })).status, 201);
        assert.deepEqual(await product(base, 1).then((p) => [p.stock, p.low]), [7, false]);
        assert.equal((await postJson(`${base}/api/sales`, { product_id: 1, qty: 2 })).status, 201);
        assert.deepEqual(await product(base, 1).then((p) => [p.stock, p.low]), [5, true]);
      });
      await check('stok kurang: 409 dengan pesan, stok gak berubah', async () => {
        const { status, body } = await postJson(`${base}/api/sales`, { product_id: 1, qty: 6 });
        assert.equal(status, 409);
        assert.ok(body?.error, 'ada pesan error');
        assert.equal((await product(base, 1)).stock, 5);
      });
      await check('menu stok 0 gak bisa dijual', async () => {
        assert.equal((await postJson(`${base}/api/sales`, { product_id: 2, qty: 1 })).status, 409);
      });
      await check('dua penjualan barengan gak bikin stok minus', async () => {
        await postJson(`${base}/api/products/3/restock`, { qty: 1 });
        const results = await Promise.all([1, 2, 3].map(() => postJson(`${base}/api/sales`, { product_id: 3, qty: 1 })));
        assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409]);
        assert.equal((await product(base, 3)).stock, 0);
      });
      await check('halaman kasir masih kebuka', () => pageStillOpens(base));
    }, { DB_PATH: dbPath });
    await check('server dinyalain ulang di database yang sama: aman, data tetap', () => withServer(dir, async (base) => {
      assert.equal((await product(base, 1)).stock, 5);
    }, { DB_PATH: dbPath }));
    await check('database baru (kosong) juga jalan', () => withServer(dir, async (base) => {
      const { body } = await getJson(`${base}/api/products`);
      assert.equal(body.length, 4);
      assert.ok(body.every((p) => p.stock === 0 && p.min_stock === 5));
    }, { DB_PATH: tempDb() }));
  },

  async batal(dir, check) {
    await withServer(dir, async (base) => {
      await postJson(`${base}/api/products/1/restock`, { qty: 10 });
      const sale = (await postJson(`${base}/api/sales`, { product_id: 1, qty: 4 })).body;
      await check('batalin penjualan hari ini: stok balik, hilang dari daftar', async () => {
        assert.equal((await del(`${base}/api/sales/${sale.id}`)).status, 200);
        assert.equal((await product(base, 1)).stock, 10);
        const { body } = await getJson(`${base}/api/sales/today`);
        assert.ok(!body.sales.some((s) => s.id === sale.id));
      });
      await check('batal dua kali: yang kedua 404, stok gak nambah', async () => {
        assert.equal((await del(`${base}/api/sales/${sale.id}`)).status, 404);
        assert.equal((await product(base, 1)).stock, 10);
      });
      await check('penjualan hari sebelumnya gak bisa dibatalin', async () => {
        assert.equal((await del(`${base}/api/sales/1`)).status, 409);
        assert.equal((await product(base, 1)).stock, 10);
      });
      await check('penjualan yang gak ada jadi 404', async () => {
        assert.equal((await del(`${base}/api/sales/999`)).status, 404);
      });
      await check('fitur stok sebelumnya masih jalan', async () => {
        assert.equal((await postJson(`${base}/api/sales`, { product_id: 1, qty: 11 })).status, 409);
        assert.equal((await postJson(`${base}/api/sales`, { product_id: 1, qty: 1 })).status, 201);
      });
      await check('halaman kasir masih kebuka', () => pageStillOpens(base));
    }, { DB_PATH: oldDb() });
  },

  async tampilan(dir, check) {
    const app = existsSync(join(dir, 'public/app.js')) ? read(dir, 'public/app.js') : '';
    await check('public/app.js valid', () => {
      const run = spawnSync(process.execPath, ['--check', join(dir, 'public/app.js')], { encoding: 'utf8' });
      assert.equal(run.status, 0, run.stderr.slice(0, 300));
    });
    await check('nampilin stok tiap menu', () => assert.match(app, /\.stock\b/, 'app.js belum pakai field stock'));
    await check('stok tipis ditandain pakai teks', () => {
      assert.match(app, /\.low\b/, 'app.js belum pakai field low');
      assert.match(app, /stok tipis/i, 'belum ada teks "Stok tipis"');
    });
    await check('stok 0 tombolnya nonaktif', () => assert.match(app, /disabled/, 'tombol belum pernah di-disable'));
    await check('pesan error dari server ditampilin', () => assert.match(app, /\.error\b/, 'pesan .error dari server belum dipakai'));
    await check('gak pakai innerHTML buat data', () => assert.doesNotMatch(app, /innerHTML\s*\+?=\s*(?!(''|""|``)\s*;)/, 'masih ada innerHTML yang diisi data'));
    // Serving the page is the server's job; here only Rani's own files count.
    await check('index.html masih muat app.js', () => {
      assert.match(read(dir, 'public/index.html'), /<script[^>]+src="\/?app\.js"/, 'index.html gak lagi muat app.js');
    });
  },

  async rilis(dir, check) {
    for (const id of ['migrasi', 'stok-server', 'batal', 'tampilan']) {
      await STEPS[id](dir, (name, fn) => check(`[${id}] ${name}`, fn));
    }
    await check('CATATAN-RILIS.md lengkap dan singkat', () => {
      assert.ok(existsSync(join(dir, 'CATATAN-RILIS.md')), 'file gak ada');
      const text = read(dir, 'CATATAN-RILIS.md');
      const words = text.split(/\s+/).filter(Boolean).length;
      assert.ok(words <= 300, `${words} kata, maksimal 300`);
      for (const [pattern, what] of [[/stok/i, 'stok'], [/backup|cadang/i, 'backup'], [/data\.db/, 'data.db'], [/risiko/i, 'risiko']]) {
        assert.match(text, pattern, `belum nyebut ${what}`);
      }
    });
  },
};

export const STEP_IDS = Object.keys(STEPS);

// The boss quotes each failure on one line, keeping the part of a crash log that names the cause.
const oneLine = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean)
  .filter((l) => !l.startsWith('at ') && !/^Node\.js v/.test(l)).join(' | ').slice(0, 500);

/** Runs the boss's checks for one step against the project in `dir`. */
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
