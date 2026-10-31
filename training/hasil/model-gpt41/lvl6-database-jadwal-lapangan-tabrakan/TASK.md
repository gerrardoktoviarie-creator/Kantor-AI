Aplikasi booking lapangan padel. Skemanya (db/schema.sql) cuma nolak booking yang jam MULAI-nya persis sama. Akibatnya:
- Booking 10:00-11:00 dan 10:30-11:30 di lapangan yang sama bisa masuk dua-duanya.
- Ada booking yang jam selesainya sebelum jam mulai.
- Booking yang udah dibatalkan tetap ngeblok jadwal.
- Waktu admin ngedit jam booking atau ngaktifin lagi booking yang batal, tabrakan gak dicek sama sekali.

Aturan yang harus dijaga DATABASE-nya sendiri (bukan cuma di kode server):
1. Di satu lapangan, booking berstatus 'aktif' gak boleh tumpang tindih. Yang nempel boleh (10:00-11:00 lalu 11:00-12:00).
2. end_at harus lebih besar dari start_at.
3. status cuma 'aktif' atau 'batal'. Booking 'batal' gak ngeblok jadwal.
4. Aturan 1 juga berlaku waktu UPDATE (ganti jam atau ganti status jadi aktif lagi).
5. Format waktu wajib 'YYYY-MM-DD HH:MM' (mis. '2026-11-07 19:00').
6. Query jadwal per lapangan per hari harus pakai index:
   SELECT * FROM bookings WHERE court_id = ? AND start_at >= ? AND start_at < ? AND status = 'aktif'

Tulis ulang db/schema.sql. Tabel/kolom tetap, data lapangan tetap ada, dan file aman dijalanin berkali-kali.
