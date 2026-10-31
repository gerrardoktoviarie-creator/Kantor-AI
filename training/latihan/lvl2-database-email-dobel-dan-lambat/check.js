import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runChecks } from '../../lib.js';

const sql = readFileSync(join(process.argv[2], 'db', 'schema.sql'), 'utf8');
const db = new DatabaseSync(':memory:');
const rejects = (stmt, why) => assert.throws(() => db.exec(stmt), undefined, why);
const plan = (query) => db.prepare(`EXPLAIN QUERY PLAN ${query}`).all(1).map((r) => r.detail).join(' | ');

await runChecks([
  ['schema jalan dua kali, data gak dobel', () => {
    db.exec(sql);
    db.exec(sql);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2);
  }],
  ['email sama ditolak', () => rejects("INSERT INTO users (name, email) VALUES ('X', 'budi@mail.com')", 'email unik')],
  ['email beda huruf besar ditolak', () => rejects("INSERT INTO users (name, email) VALUES ('X', 'BUDI@Mail.com')", 'email unik tanpa peduli huruf besar')],
  ['email baru boleh', () => db.exec("INSERT INTO users (name, email) VALUES ('Agus', 'agus@mail.com')")],
  ['status sah boleh', () => db.exec("INSERT INTO orders (user_id, total, status) VALUES (1, 15000, 'dibayar')")],
  ['status ngaco ditolak', () => rejects("INSERT INTO orders (user_id, total, status) VALUES (1, 15000, 'lunass')", 'CHECK status')],
  ['riwayat pesanan pakai index tanpa sort tambahan', () => {
    const detail = plan('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC');
    assert.match(detail, /USING (COVERING )?INDEX/, detail);
    assert.doesNotMatch(detail, /TEMP B-TREE/, `masih ada sort tambahan: ${detail}`);
  }],
]);
