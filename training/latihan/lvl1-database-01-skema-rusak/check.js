import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runChecks } from '../../lib.js';

const sql = readFileSync(join(process.argv[2], 'db', 'schema.sql'), 'utf8');
const db = new DatabaseSync(':memory:');
const rejects = (stmt, why) => assert.throws(() => db.exec(stmt), undefined, why);

await runChecks([
  ['schema.sql jalan tanpa error', () => db.exec(sql)],
  ['aman dijalanin dua kali, data gak dobel', () => {
    db.exec(sql);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products').get().n, 3);
  }],
  ['pesanan buat produk yang gak ada ditolak', () => rejects('INSERT INTO orders (product_id, qty) VALUES (99, 1)', 'foreign key')],
  ['pesanan valid masuk', () => db.exec('INSERT INTO orders (product_id, qty) VALUES (1, 2)')],
  ['harga minus ditolak', () => rejects("INSERT INTO products (name, price) VALUES ('X', -1)", 'CHECK harga')],
  ['qty 0 ditolak', () => rejects('INSERT INTO orders (product_id, qty) VALUES (1, 0)', 'CHECK qty')],
  ['produk tanpa nama ditolak', () => rejects('INSERT INTO products (price) VALUES (1000)', 'NOT NULL nama')],
  ['harga disimpan INTEGER', () => {
    const col = db.prepare("SELECT type FROM pragma_table_info('products') WHERE name = 'price'").get();
    assert.equal(col.type.toUpperCase(), 'INTEGER');
    assert.equal(db.prepare('SELECT typeof(price) AS t FROM products WHERE id = 1').get().t, 'integer');
  }],
]);
