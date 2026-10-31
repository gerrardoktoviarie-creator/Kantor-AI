import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runChecks } from '../../lib.js';

const here = new URL('.', import.meta.url);
const current = readFileSync(new URL('db/current.sql', here), 'utf8');
const migrate = readFileSync(join(process.argv[2], 'db', 'migrate.sql'), 'utf8');
const db = new DatabaseSync(':memory:');
db.exec(current);

await runChecks([
  ['migrate.sql jalan tanpa error', () => db.exec(migrate)],
  ['kolom customers sesuai', () => {
    const cols = db.prepare("SELECT name, type, \"notnull\" AS nn FROM pragma_table_info('customers') ORDER BY cid").all();
    assert.deepEqual(cols.map((c) => c.name), ['id', 'name', 'phone', 'created_at']);
    assert.equal(cols.find((c) => c.name === 'name').nn, 1, 'name NOT NULL');
    assert.equal(cols.find((c) => c.name === 'phone').type.toUpperCase(), 'TEXT');
  }],
  ['data pelanggan kebawa dan rapi', () => {
    const rows = db.prepare('SELECT id, name, phone FROM customers ORDER BY id').all().map((r) => ({ ...r }));
    assert.deepEqual(rows, [
      { id: 1, name: 'Budi Santoso', phone: '081234567890' },
      { id: 2, name: 'Siti Aminah', phone: '085711112222' },
      { id: 3, name: 'Agus', phone: null },
      { id: 7, name: 'Dewi Lestari', phone: '081399998888' },
    ]);
  }],
  ['created_at keisi', () => {
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM customers WHERE created_at IS NULL').get().n, 0);
  }],
  ['pesanan utuh dan nyambung ke pelanggan', () => {
    const rows = db.prepare('SELECT o.id, c.name FROM orders o JOIN customers c ON c.id = o.customer_id ORDER BY o.id').all();
    assert.deepEqual(rows.map((r) => r.name), ['Budi Santoso', 'Budi Santoso', 'Siti Aminah', 'Dewi Lestari']);
  }],
  ['foreign key orders masih ke tabel customers', () => {
    const fks = db.prepare("SELECT \"table\" AS t FROM pragma_foreign_key_list('orders')").all();
    assert.deepEqual(fks.map((f) => f.t), ['customers']);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pragma_foreign_key_check').get().n, 0);
  }],
  ['gak ada tabel sisa migrasi', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((t) => t.name);
    assert.deepEqual(tables, ['customers', 'orders']);
  }],
  ['index orders(customer_id) ada', () => {
    const indexed = db.prepare("SELECT il.name FROM pragma_index_list('orders') l JOIN pragma_index_info(l.name) il").all().map((r) => r.name);
    assert.ok(indexed.includes('customer_id'), `kolom ber-index: ${indexed.join(', ') || 'gak ada'}`);
  }],
  ['foreign key nyala lagi dan nolak data ngaco', () => {
    db.exec('PRAGMA foreign_keys = ON');
    assert.throws(() => db.exec('INSERT INTO orders (customer_id, total) VALUES (99, 1000)'));
  }],
  ['user_version = 2', () => {
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
  }],
  ['pakai transaksi', () => {
    assert.match(migrate, /\bBEGIN\b/i, 'gak ada BEGIN');
    assert.match(migrate, /\bCOMMIT\b/i, 'gak ada COMMIT');
  }],
]);
