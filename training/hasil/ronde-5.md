# Laporan latihan IT

29/10/2026, 19.20.09

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

Percobaan 1: LULUS (file diubah: db/schema.sql)

Penjelasan joko: Akar masalahnya: UNIQUE (court_id, start_at) hanya mencegah jam mulai yang sama persis, jadi ia tidak pernah melihat durasi end_at; satu-satunya pengecekan overlap ada, tapi tidak dibatasi status 'aktif' dan tidak jalan saat UPDATE. Yang saya ubah: hapus UNIQUE yang menyesatkan, ganti dengan unique index yang hanya berlaku untuk booking 'aktif' (WHERE status = 'aktif'), dan tambah TRIGGER BEFORE INSERT / BEFORE UPDATE yang menolak tumpang tindih antar slot aktif (start_baru < end_lama AND end_baru > start_lama) dengan pengecualian diri sendiri saat UPDATE; plus trigger CHECK durasi (end_at > s
```
LULUS  schema jalan dua kali, lapangan gak dobel
LULUS  booking pertama masuk
LULUS  tumpang tindih sebagian ditolak
LULUS  yang ngebungkus ditolak
LULUS  yang di dalam ditolak
LULUS  yang nempel boleh
LULUS  lapangan lain boleh di jam yang sama
LULUS  jam selesai sebelum mulai ditolak
LULUS  status ngaco ditolak
LULUS  format waktu salah ditolak
LULUS  yang batal gak ngeblok
LULUS  ngaktifin lagi yang batal dan tabrakan ditolak
LULUS  ganti jam jadi tabrakan ditolak
LULUS  ganti jam yang gak tabrakan boleh (dirinya sendiri gak dihitung)
LULUS  jadwal per hari pakai index
```

Hasil: lulus di percobaan pertama

## Ringkasan

| Latihan | Agent | Hasil | Percobaan |
|---|---|---|---|
| Lvl 6 · Jadwal lapangan bisa tabrakan | joko | lulus | 1 |
