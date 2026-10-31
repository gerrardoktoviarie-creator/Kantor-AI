# Laporan latihan IT

29/10/2026, 19.18.57

## Lvl 5 · Rekap omzet bulanan meleset (fajar)

Folder: latihan/lvl5-database-rekap-bulanan-meleset

Sebelum dibenerin:
```
GAGAL  2026: WIB, tanpa yang batal, 12 bulan lengkap: Expected values to be strictly deep-equal:
+ actual - expected

  [
    {
+     month: '01',
+     orders: 3,
+     total: 100000
-     month: '2026-01',
-     orders: 2,
-     total: 55000
    },
    {
+     month: '02',
-     month: '2026-02',
      orders: 2,
+     total: 144000
-     total: 65000
    },
    {
+     month: '03',
-     month: '2026-03',
      orders: 1,
      total: 15000
    },
    {
+     month: '12',
+     orders: 2,
+     total: 65000
-     month: '2026-04',
-     orders: 0,
-     total: 0
    },
-   {
-     month: '2026-05',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2026-06',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2026-07',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2026-08',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2026-09',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2026-10',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2026-11',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2026-12',
-     orders: 0,
-     total: 0
-   }
  ]

GAGAL  2025: pesanan 31 Des jam 20.00 UTC pindah ke 2026: Expected values to be strictly deep-equal:
+ actual - expected

  [
    {
+     month: '01',
+     orders: 3,
+     total: 100000
-     month: '2025-01',
-     orders: 1,
-     total: 50000
    },
    {
+     month: '02',
+     orders: 2,
+     total: 144000
-     month: '2025-02',
-     orders: 0,
-     total: 0
    },
    {
+     month: '03',
+     orders: 1,
+     total: 15000
-     month: '2025-03',
-     orders: 0,
-     total: 0
    },
    {
+     month: '12',
+     orders: 2,
+     total: 65000
-     month: '2025-04',
-     orders: 0,
-     total: 0
    },
-   {
-     month: '2025-05',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2025-06',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2025-07',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2025-08',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2025-09',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2025-10',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2025-11',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2025-12',
-     orders: 0,
-     total: 0
-   }
  ]

GAGAL  2027: pesanan 31 Des 2026 jam 17.30 UTC masuk Januari 2027: Expected values to be strictly deep-equal:
+ actual - expected

  [
    {
+     month: '01',
+     orders: 3,
+     total: 100000
-     month: '2027-01',
-     orders: 1,
-     total: 40000
    },
    {
+     month: '02',
+     orders: 2,
+     total: 144000
-     month: '2027-02',
-     orders: 0,
-     total: 0
    },
    {
+     month: '03',
+     orders: 1,
+     total: 15000
-     month: '2027-03',
-     orders: 0,
-     total: 0
    },
    {
+     month: '12',
+     orders: 2,
+     total: 65000
-     month: '2027-04',
-     orders: 0,
-     total: 0
    },
-   {
-     month: '2027-05',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2027-06',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2027-07',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2027-08',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2027-09',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2027-10',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2027-11',
-     orders: 0,
-     total: 0
-   },
-   {
-     month: '2027-12',
-     orders: 0,
-     total: 0
-   }
  ]

GAGAL  year salah atau kosong jadi 400: year=undefined

200 !== 400
```

Percobaan 1: LULUS (file diubah: server.js)

Penjelasan fajar: Akar masalah: query lama pakai `strftime('%m', paid_at)` langsung dari jam UTC tanpa konversi ke WIB, jadi transaksi yang di Jakarta masuk bulan GMT (atau bulan sebelumnya), belum lagi GROUP BY per bulan tanpa per tahun dan status 'batal' ikut dihitung.

Yang diubah: konversi `paid_at` ke WIB pakai `datetime(paid_at, '+7 hours')`, filter berdasarkan tahun target, abaikan status 'batal', lalu bangun array 12 bulan di JavaScript dengan bulan kosong diisi 0.
```
LULUS  2026: WIB, tanpa yang batal, 12 bulan lengkap
LULUS  2025: pesanan 31 Des jam 20.00 UTC pindah ke 2026
LULUS  2027: pesanan 31 Des 2026 jam 17.30 UTC masuk Januari 2027
LULUS  year salah atau kosong jadi 400
```

Hasil: lulus di percobaan pertama

## Lvl 5 · Total belanja di checkout ngaco (bayu)

Folder: latihan/lvl5-error-total-belanja-ngaco

Sebelum dibenerin:
```
LULUS  tanpa promo
GAGAL  HEMAT10 huruf kecil tetap berlaku: Expected values to be strictly deep-equal:
+ actual - expected

  {
+   discount: 0,
-   discount: 8500,
    shipping: 10000,
    subtotal: 85000,
+   total: 95000
-   total: 86500
  }

GAGAL  HEMAT10 pas Rp50.000 udah boleh: Expected values to be strictly deep-equal:
+ actual - expected

  {
+   discount: 0,
-   discount: 5000,
    shipping: 10000,
    subtotal: 50000,
+   total: 60000
-   total: 55000
  }

LULUS  HEMAT10 di bawah minimal: diskon 0
GAGAL  ongkir dihitung dari subtotal setelah diskon: Expected values to be strictly deep-equal:
+ actual - expected

  {
    discount: 10000,
+   shipping: 0,
-   shipping: 10000,
    subtotal: 100000,
+   total: 90000
-   total: 100000
  }

LULUS  diskon dibulatkan ke bawah
LULUS  diskon maksimal Rp20.000 dan ongkir gratis
GAGAL  ONGKIRFREE: Expected values to be strictly deep-equal:
+ actual - expected

  {
    discount: 0,
+   shipping: 10000,
-   shipping: 0,
    subtotal: 15000,
+   total: 25000
-   total: 15000
  }

LULUS  semua angka bilangan bulat
GAGAL  input salah jadi 400: [{"id":1,"qty":0}]  dapet 200

200 !== 400
```

Percobaan 1: BELUM (file diubah: lib/pricing.js, server.js)

Penjelasan bayu: Akar masalah: `quote()` tidak pernah menolak qty teks/non-integer, produk yang tidak dikenal memicu TypeError lalu di-catch jadi 500, diskon dihitung dengan `>` bukan `>=` dan dibulatkan bukan `Math.floor` tanpa batas maksimal, serta pengecekan `code === 'HEMAT10'` case-sensitive. Saya menambahkan validasi qty bulat 1-99, pengecekan produk yang valid, normalisasi kode promo case-insensitive, diskon floor dengan cap 20.000, serta error 400 eksplisit untuk promo tidak dikenal alih-alih 500.
```
LULUS  tanpa promo
LULUS  HEMAT10 huruf kecil tetap berlaku
LULUS  HEMAT10 pas Rp50.000 udah boleh
LULUS  HEMAT10 di bawah minimal: diskon 0
LULUS  ongkir dihitung dari subtotal setelah diskon
LULUS  diskon dibulatkan ke bawah
LULUS  diskon maksimal Rp20.000 dan ongkir gratis
GAGAL  ONGKIRFREE: Expected values to be strictly deep-equal:
+ actual - expected

  {
    discount: 0,
+   shipping: 10000,
-   shipping: 0,
    subtotal: 15000,
+   total: 25000
-   total: 15000
  }

LULUS  semua angka bilangan bulat
LULUS  input salah jadi 400
```

Percobaan 2: BELUM (file diubah: lib/pricing.js)

Penjelasan bayu: Akar masalahnya: kode ONGKIRFREE jatuh ke blok `else if (normCode !== 'ONGKIRFREE' && normCode !== '')` yang melempar error karena kondisi `normCode !== 'ONGKIRFREE'` ternyata salah diimplementasi — ONGKIRFREE tidak dikenali sehingga diskon tetap 0 dan ongkir Rp10.000. Diperbaiki dengan memisahkan kasus ONGKIRFREE (diskon 0, ongkir tetap dihitung normal, shipping jadi Rp10.000 karena subtotal < Rp100.000) dan baru melempar error untuk kode yang benar-benar tidak dikenal.
```
LULUS  tanpa promo
LULUS  HEMAT10 huruf kecil tetap berlaku
LULUS  HEMAT10 pas Rp50.000 udah boleh
LULUS  HEMAT10 di bawah minimal: diskon 0
LULUS  ongkir dihitung dari subtotal setelah diskon
LULUS  diskon dibulatkan ke bawah
LULUS  diskon maksimal Rp20.000 dan ongkir gratis
GAGAL  ONGKIRFREE: Expected values to be strictly deep-equal:
+ actual - expected

  {
    discount: 0,
+   shipping: 10000,
-   shipping: 0,
    subtotal: 15000,
+   total: 25000
-   total: 15000
  }

LULUS  semua angka bilangan bulat
LULUS  input salah jadi 400
```

Percobaan 3: LULUS (file diubah: lib/pricing.js)

Penjelasan bayu: Akar masalahnya: `ONGKIRFREE` hanya diset `discount = 0` sehingga alur ongkir mengikuti aturan "subtotal - diskon >= 100.000" yang tidak terpenuhi, alih-alih langsung membebaskan ongkir. Saya mengubahnya menjadi `freeShipping = true`, lalu `shipping = 0` jika `freeShipping` aktif atau setelah diskon minimal Rp100.000. Perhitungan subtotal dan aturan HEMAT10 tidak tersentuh, jadi hasil yang sudah LULUS tetap sama.
```
LULUS  tanpa promo
LULUS  HEMAT10 huruf kecil tetap berlaku
LULUS  HEMAT10 pas Rp50.000 udah boleh
LULUS  HEMAT10 di bawah minimal: diskon 0
LULUS  ongkir dihitung dari subtotal setelah diskon
LULUS  diskon dibulatkan ke bawah
LULUS  diskon maksimal Rp20.000 dan ongkir gratis
LULUS  ONGKIRFREE
LULUS  semua angka bilangan bulat
LULUS  input salah jadi 400
```

Hasil: lulus di percobaan 3, pelajarannya dicatat

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

Penjelasan joko: Akar masalah: `UNIQUE (court_id, start_at)` cuma menolak duplikat start yang identik — tidak menolak overlap sebagian, tidak memvalidasi `end_at > start_at`, dan aturan itu tidak pernah diterapkan saat UPDATE. Solusinya: hapus unik constraint tersebut, tambahkan CHECK untuk range waktu dan daftar status, lalu pasang trigger `BEFORE INSERT` dan `BEFORE UPDATE` yang mengecek overlap antar-baris (hanya status 'aktif', kecuali baris yang sedang diupdate, batas overlap ketat `start_baru < end_lama AND end_baru > start_lama`).



Akar masalahnya: `UNIQUE (court_id, start_at)` hanya menolak start yan
```
GAGAL  schema jalan dua kali, lapangan gak dobel: Tumpang tindih dengan booking aktif di lapangan yang sama
LULUS  booking pertama masuk
LULUS  tumpang tindih sebagian ditolak
LULUS  yang ngebungkus ditolak
LULUS  yang di dalam ditolak
LULUS  yang nempel boleh
LULUS  lapangan lain boleh di jam yang sama
GAGAL  jam selesai sebelum mulai ditolak: Missing expected exception: end < start
LULUS  status ngaco ditolak
GAGAL  format waktu salah ditolak: Missing expected exception: format pendek
LULUS  yang batal gak ngeblok
LULUS  ngaktifin lagi yang batal dan tabrakan ditolak
LULUS  ganti jam jadi tabrakan ditolak
LULUS  ganti jam yang gak tabrakan boleh (dirinya sendiri gak dihitung)
LULUS  jadwal per hari pakai index
```

Percobaan 2: BELUM (file diubah: db/schema.sql)

Penjelasan joko: Akar masalahnya ada dua: (1) CHECK `start_at > '2000-...'` hanya membandingkan string dengan konstanta, tidak mengecek urutan antar `start_at` dan `end_at`, jadi booking `end < start` lolos; (2) tidak ada CHECK format, jadi jam pendek `'2026-11-07 19:0'` lolos dan perbandingan teks jadi tidak konsisten. Saya mengganti konstanta dengan `CHECK (julianday(end_at) > julianday(start_at))` untuk penolakan berbasis waktu yang valid, dan menambahkan `CHECK GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]'` agar hanya format 'YYYY-MM-DD HH:MM' yang diterima. Trigger tumpang tindih
```
GAGAL  schema jalan dua kali, lapangan gak dobel: Tumpang tindih dengan booking aktif di lapangan yang sama
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

Percobaan 3: BELUM (file diubah: db/schema.sql)

Penjelasan joko: Akar masalah: urutan `CREATE TRIGGER` di atas `INSERT OR IGNORE` — saat schema dijalankan kedua kalinya, trigger `trg_bookings_overlapping_insert` sudah ada dan dieksekusi saat `INSERT OR IGNORE` men-scan baris booking yang ada, tapi baris tersebut tidak di-filter `id`/`status`, sehingga trigger membandingkan diri sendiri atau baris yang sedang di-*insert* ulang dan menolak karena duplikasi internal. Solusi: pindahkan kedua trigger *setelah* INSERT data, sehingga trigger tidak aktif saat data contoh disuntikkan ulang.
```
GAGAL  schema jalan dua kali, lapangan gak dobel: Tumpang tindih dengan booking aktif di lapangan yang sama
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

Hasil: belum lulus, pelajarannya dicatat

## Ringkasan

| Latihan | Agent | Hasil | Percobaan |
|---|---|---|---|
| Lvl 5 · Rekap omzet bulanan meleset | fajar | lulus | 1 |
| Lvl 5 · Total belanja di checkout ngaco | bayu | lulus | 3 |
| Lvl 6 · Jadwal lapangan bisa tabrakan | joko | belum | 3 |
