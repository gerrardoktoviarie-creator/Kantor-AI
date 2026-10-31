import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runChecks } from '../../lib.js';

const sql = readFileSync(join(process.argv[2], 'db', 'schema.sql'), 'utf8');
const db = new DatabaseSync(':memory:');
const add = (court, start, end, status = 'aktif') => db.prepare(
  'INSERT INTO bookings (court_id, customer, start_at, end_at, status) VALUES (?, ?, ?, ?, ?)',
).run(court, 'Budi', `2026-11-07 ${start}`, `2026-11-07 ${end}`, status).lastInsertRowid;
const rejected = (fn, why) => assert.throws(fn, undefined, why);
let first;
let late;

await runChecks([
  ['schema jalan dua kali, lapangan gak dobel', () => {
    db.exec(sql);
    db.exec(sql);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM courts').get().n, 2);
  }],
  ['booking pertama masuk', () => { first = add(1, '10:00', '11:00'); }],
  ['tumpang tindih sebagian ditolak', () => rejected(() => add(1, '10:30', '11:30'), '10:30-11:30')],
  ['yang ngebungkus ditolak', () => rejected(() => add(1, '09:00', '12:00'), '09:00-12:00')],
  ['yang di dalam ditolak', () => rejected(() => add(1, '10:15', '10:45'), '10:15-10:45')],
  ['yang nempel boleh', () => {
    add(1, '09:00', '10:00');
    late = add(1, '11:00', '12:00');
  }],
  ['lapangan lain boleh di jam yang sama', () => add(2, '10:00', '11:00')],
  ['jam selesai sebelum mulai ditolak', () => {
    rejected(() => add(1, '15:00', '14:00'), 'end < start');
    rejected(() => add(1, '15:00', '15:00'), 'end = start');
  }],
  ['status ngaco ditolak', () => rejected(() => add(1, '16:00', '17:00', 'selesai'), 'status')],
  ['format waktu salah ditolak', () => {
    rejected(() => db.prepare("INSERT INTO bookings (court_id, customer, start_at, end_at) VALUES (1, 'X', '2026-11-7 9:00', '2026-11-7 10:00')").run(), 'format pendek');
    rejected(() => db.prepare("INSERT INTO bookings (court_id, customer, start_at, end_at) VALUES (1, 'X', '2026-11-07T18:00', '2026-11-07T19:00')").run(), 'pakai T');
  }],
  ['yang batal gak ngeblok', () => {
    db.prepare("UPDATE bookings SET status = 'batal' WHERE id = ?").run(first);
    add(1, '10:15', '10:45');
  }],
  ['ngaktifin lagi yang batal dan tabrakan ditolak', () => {
    rejected(() => db.prepare("UPDATE bookings SET status = 'aktif' WHERE id = ?").run(first), 'aktif lagi');
  }],
  ['ganti jam jadi tabrakan ditolak', () => {
    rejected(() => db.prepare("UPDATE bookings SET start_at = '2026-11-07 10:30' WHERE id = ?").run(late), 'geser jam');
  }],
  ['ganti jam yang gak tabrakan boleh (dirinya sendiri gak dihitung)', () => {
    db.prepare("UPDATE bookings SET end_at = '2026-11-07 12:30' WHERE id = ?").run(late);
  }],
  ['jadwal per hari pakai index', () => {
    const detail = db.prepare(`EXPLAIN QUERY PLAN SELECT * FROM bookings
      WHERE court_id = ? AND start_at >= ? AND start_at < ? AND status = 'aktif'`).all(1, 'a', 'b').map((r) => r.detail).join(' | ');
    assert.match(detail, /USING (COVERING )?INDEX/, detail);
  }],
]);
