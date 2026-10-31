# Laporan latihan IT

29/10/2026, 19.19.37

## Lvl 6 · Jadwal lapangan bisa tabrakan (joko)

Folder: latihan/lvl6-database-jadwal-lapangan-tabrakan

Sebelum dibenerin:
```
LULUS  schema jalan dua kali, lapangan gak dobel
LULUS  booking pertama masuk
GAGAL  tumpang tindih sebagian ditolak: Missing expected exception: 10:30-11:30
GAGAL  yang ngebungkus ditolak: Missing expected exception: 09:00-12:00
GAGAL  yang di dalam ditolak: Missing expected exception: 10:15-10:45
GAGAL  yang nempel boleh: UNIQUE constraint failed: bookings.court_id, bookings.start_at
LULUS  lapangan lain boleh di jam yang sama
GAGAL  jam selesai sebelum mulai ditolak: Missing expected exception: end < start
GAGAL  status ngaco ditolak: Missing expected exception: status
GAGAL  format waktu salah ditolak: Missing expected exception: format pendek
GAGAL  yang batal gak ngeblok: UNIQUE constraint failed: bookings.court_id, bookings.start_at
GAGAL  ngaktifin lagi yang batal dan tabrakan ditolak: Missing expected exception: aktif lagi
GAGAL  ganti jam jadi tabrakan ditolak: Missing expected exception: geser jam
LULUS  ganti jam yang gak tabrakan boleh (dirinya sendiri gak dihitung)
LULUS  jadwal per hari pakai index
```

Percobaan 1: BELUM (file diubah: db/schema.sql)

Penjelasan joko: Akar masalahnya: `UNIQUE (court_id, start_at)` cuma menolak duplikat jam mulai, jadi overlap parsial (10:00-11:00 vs 10:30-11:30) lolos, tidak ada validasi `end_at > start_at`, tidak ada CHECK untuk format waktu, dan booking 'batal' ikut dihitung tumpang tindih. Solusinya: ganti UNIQUE dengan TRIGGER `BEFORE INSERT OR UPDATE` yang memeriksa overlap hanya antar booking 'aktif' di lapangan yang sama (dengan pengecualian baris itu sendiri saat UPDATE), tambah CHECK untuk urutan waktu, status, dan format ISO `YYYY-MM-DD HH:MM`, serta index komposit `court_id, status` untuk performa query harian.
```
GAGAL  schema jalan dua kali, lapangan gak dobel: near ",": syntax error
GAGAL  booking pertama masuk: no such table: bookings
LULUS  tumpang tindih sebagian ditolak
LULUS  yang ngebungkus ditolak
LULUS  yang di dalam ditolak
GAGAL  yang nempel boleh: no such table: bookings
GAGAL  lapangan lain boleh di jam yang sama: no such table: bookings
LULUS  jam selesai sebelum mulai ditolak
LULUS  status ngaco ditolak
LULUS  format waktu salah ditolak
GAGAL  yang batal gak ngeblok: no such table: bookings
LULUS  ngaktifin lagi yang batal dan tabrakan ditolak
LULUS  ganti jam jadi tabrakan ditolak
GAGAL  ganti jam yang gak tabrakan boleh (dirinya sendiri gak dihitung): no such table: bookings
GAGAL  jadwal per hari pakai index: no such table: bookings
```

Percobaan 2: BELUM (file diubah: db/schema.sql)

Penjelasan joko: Akar masalahnya: `created_at` tidak ada, sehingga `updated_at` yang saya tambahkan menyebabkan error saat insert data contoh; trigger juga harus memfilter baris yang sedang di-update agar tidak bertabrakan dengan dirinya sendiri. Saya menambahkan kolom `updated_at`, memperbaiki trigger agar mengecualikan id sendiri saat update, dan menambahkan data contoh bookings.
```
GAGAL  schema jalan dua kali, lapangan gak dobel: near ",": syntax error
GAGAL  booking pertama masuk: no such table: bookings
LULUS  tumpang tindih sebagian ditolak
LULUS  yang ngebungkus ditolak
LULUS  yang di dalam ditolak
GAGAL  yang nempel boleh: no such table: bookings
GAGAL  lapangan lain boleh di jam yang sama: no such table: bookings
LULUS  jam selesai sebelum mulai ditolak
LULUS  status ngaco ditolak
LULUS  format waktu salah ditolak
GAGAL  yang batal gak ngeblok: no such table: bookings
LULUS  ngaktifin lagi yang batal dan tabrakan ditolak
LULUS  ganti jam jadi tabrakan ditolak
GAGAL  ganti jam yang gak tabrakan boleh (dirinya sendiri gak dihitung): no such table: bookings
GAGAL  jadwal per hari pakai index: no such table: bookings
```

Percobaan 3: BELUM (file diubah: db/schema.sql)

Penjelasan joko: Akar masalah: trigger memanggil kolom tabel induk di dalam blok `BEGIN ... END` tanpa tabel alias — di SQLite kondisi `WHEN` boleh pakai kolom langsung, tapi body trigger harus menuliskan nama tabel (`bookings.end_at`, `bookings.start_at`), kalau tidak muncul `near ",": syntax error` dan tabel dianggap bermasalah saat parsing. Saya juga membersihkan CHECK time yang tidak efektif, menstandarkan format dengan GLOB, menambahkan ON DELETE RESTRICT, dan mengoptimasi index agar query per lapangan per hari pakai index.
```
GAGAL  schema jalan dua kali, lapangan gak dobel: near "updated_at": syntax error
GAGAL  booking pertama masuk: no such table: bookings
LULUS  tumpang tindih sebagian ditolak
LULUS  yang ngebungkus ditolak
LULUS  yang di dalam ditolak
GAGAL  yang nempel boleh: no such table: bookings
GAGAL  lapangan lain boleh di jam yang sama: no such table: bookings
LULUS  jam selesai sebelum mulai ditolak
LULUS  status ngaco ditolak
LULUS  format waktu salah ditolak
GAGAL  yang batal gak ngeblok: no such table: bookings
LULUS  ngaktifin lagi yang batal dan tabrakan ditolak
LULUS  ganti jam jadi tabrakan ditolak
GAGAL  ganti jam yang gak tabrakan boleh (dirinya sendiri gak dihitung): no such table: bookings
GAGAL  jadwal per hari pakai index: no such table: bookings
```

Hasil: belum lulus, pelajarannya dicatat

## Ringkasan

| Latihan | Agent | Hasil | Percobaan |
|---|---|---|---|
| Lvl 6 · Jadwal lapangan bisa tabrakan | joko | belum | 3 |
