# Laporan latihan IT

29/10/2026, 22.18.49

## Skema toko gagal dijalankan dan datanya bisa ngaco (joko)

Folder: latihan/lvl1-database-01-skema-rusak

Sebelum dibenerin:
```
GAGAL  schema.sql jalan tanpa error: table products has no column named price
GAGAL  aman dijalanin dua kali, data gak dobel: table products already exists
LULUS  pesanan buat produk yang gak ada ditolak
GAGAL  pesanan valid masuk: no such table: main.product
LULUS  harga minus ditolak
LULUS  qty 0 ditolak
LULUS  produk tanpa nama ditolak
GAGAL  harga disimpan INTEGER: Cannot read properties of undefined (reading 'type')
```

Percobaan 1: LULUS (file diubah: db/schema.sql)

Penjelasan joko: Akar masalah:  
1. Syntax error karena koma kurang setelah kolom `name` dan salah penamaan foreign key (`product` → `products`) di orders.
2. CREATE TABLE, INSERT data contoh, dan constraint tidak defensif: bikin error kalau schema.sql dijalankan ulang (tabel/data dobel/error).
3. Foreign key orders tidak valid, constraint minim; kolom price salah tipe (REAL), qty bisa 0, nama bisa kosong, foreign key tidak dicek.  
Perbaikan:  
- Pakai IF NOT EXISTS di CREATE TABLE, INSERT OR IGNORE untuk data.  
- Kolom price jadi INTEGER, constraint price >= 0, qty > 0, name NOT NULL, semua kolom NOT NULL. 
```
LULUS  schema.sql jalan tanpa error
LULUS  aman dijalanin dua kali, data gak dobel
LULUS  pesanan buat produk yang gak ada ditolak
LULUS  pesanan valid masuk
LULUS  harga minus ditolak
LULUS  qty 0 ditolak
LULUS  produk tanpa nama ditolak
LULUS  harga disimpan INTEGER
```

Hasil: lulus di percobaan pertama

## Angka omzet di laporan kegedean (fajar)

Folder: latihan/lvl1-database-02-laporan-omzet-salah

Sebelum dibenerin:
```
GAGAL  omzet cuma dari pesanan lunas, gak dobel: Expected values to be strictly equal:

75000 !== 45000

GAGAL  jumlah pesanan lunas 2: Expected values to be strictly equal:

3 !== 2
```

Percobaan 1: LULUS (file diubah: server.js)

Penjelasan fajar: Akar masalah: Query lama join ke payments dan order_items berulang, bikin order yg lunas terhitung lebih dari sekali (karena join dengan semua item barang). Solusinya: cuma join ke payments, group by order yang bener-bener lunas (distinct order). Sekarang total dan jumlah pesanan sesuai order yg lunas.
```
LULUS  omzet cuma dari pesanan lunas, gak dobel
LULUS  jumlah pesanan lunas 2
```

Hasil: lulus di percobaan pertama

## Pencarian produk error kalau ada tanda kutip (fajar)

Folder: latihan/lvl1-database-03-pencarian-error-tanda-kutip

Sebelum dibenerin:
```
GAGAL  cari "Jum'at" ketemu 1: Expected values to be strictly equal:

500 !== 200

LULUS  cari "roti" ketemu 2
GAGAL  teks dengan tanda kutip lain gak bikin error: Expected values to be strictly equal:

500 !== 200

LULUS  tanpa q balikin semua
```

Percobaan 1: LULUS (file diubah: server.js)

Penjelasan fajar: Akar masalah: query LIKE dibangun pakai interpolasi string langsung, jadi input spesial kayak `'` (tanda kutip satu) bikin SQL error.  
Perbaikan: query diubah jadi pakai prepared statement dengan parameter, jadi input apa pun (termasuk tanda kutip, wildcard, dll) selalu aman dan hasilnya tetap bener.
```
LULUS  cari "Jum'at" ketemu 1
LULUS  cari "roti" ketemu 2
LULUS  teks dengan tanda kutip lain gak bikin error
LULUS  tanpa q balikin semua
```

Hasil: lulus di percobaan pertama

## Lvl 2 · Email pelanggan dobel dan riwayat pesanan lambat (joko)

Folder: latihan/lvl2-database-email-dobel-dan-lambat

Sebelum dibenerin:
```
LULUS  schema jalan dua kali, data gak dobel
GAGAL  email sama ditolak: Missing expected exception: email unik
GAGAL  email beda huruf besar ditolak: Missing expected exception: email unik tanpa peduli huruf besar
LULUS  email baru boleh
LULUS  status sah boleh
GAGAL  status ngaco ditolak: Missing expected exception: CHECK status
GAGAL  riwayat pesanan pakai index tanpa sort tambahan: SCAN orders | USE TEMP B-TREE FOR ORDER BY
```

Percobaan 1: LULUS (file diubah: db/schema.sql)

Penjelasan joko: Akar masalah:
1. Unik email tidak peka huruf besar belum diterapkan (harus UNIQUE + COLLATE NOCASE).
2. Status pesanan belum divalidasi, jadi bisa diisi nilai bebas (harus pakai CHECK).
3. Query riwayat pesanan lambat karena belum ada index yang sesuai (harus index komposit user_id, created_at DESC).  
Perubahan: semua masalah tersebut sudah dibenahi di schema.sql.
```
LULUS  schema jalan dua kali, data gak dobel
LULUS  email sama ditolak
LULUS  email beda huruf besar ditolak
LULUS  email baru boleh
LULUS  status sah boleh
LULUS  status ngaco ditolak
LULUS  riwayat pesanan pakai index tanpa sort tambahan
```

Hasil: lulus di percobaan pertama

## Lvl 3 · Halaman produk loncat dan total salah (fajar)

Folder: latihan/lvl3-database-halaman-produk-loncat

Sebelum dibenerin:
```
GAGAL  halaman 1 mulai dari yang termurah: Expected values to be strictly deep-equal:
+ actual - expected

  [
+   'Americano',
+   'Kopi Susu Gula Aren',
+   'Roti Bakar Cokelat'
-   'Donat Gula',
-   'Kopi Tubruk',
-   'Teh Tarik'
  ]

GAGAL  total dan pages bener dan sama di tiap halaman: total halaman 1

3 !== 7

GAGAL  semua halaman nampilin tiap produk tepat sekali: Expected values to be strictly deep-equal:
+ actual - expected

  [
-   'Donat Gula',
-   'Kopi Tubruk',
-   'Teh Tarik',
    'Americano',
    'Kopi Susu Gula Aren',
    'Roti Bakar Cokelat',
    'Biji Kopi Gayo 250g'
  ]

LULUS  halaman setelah terakhir kosong
GAGAL  default page 1 limit 10: Expected values to be strictly equal:

0 !== 7

GAGAL  limit kegedean dipotong jadi 50: Expected values to be strictly equal:

'100000' !== 50

GAGAL  page/limit ngaco jadi 400: limit=abc

500 !== 400

GAGAL  filter q: total ikut filter, huruf besar kecil bebas: Expected values to be strictly equal:

1 !== 3
```

Percobaan 1: LULUS (file diubah: server.js)

Penjelasan fajar: Akar masalah:
- Pagination salah: OFFSET harus (page-1)*limit, bukan page*limit (ini bikin halaman 1 kelewat produk awal).
- total dan pages dihitung pakai hasil items.length, bukan total data hasil filter — ini bikin angka total dan pages salah terutama saat filter/q dipakai.
- limit gak divalidasi tipe/angka, dan batas limit/handling limit salah/missing, jadi error/gak aman.
Perubahan: Semua query pakai prepared statement; validasi input; total dihitung benar; OFFSET+LIMIT sesuai standar; urutan produk dijamin termurah dulu; handle halaman lewat akhir.
```
LULUS  halaman 1 mulai dari yang termurah
LULUS  total dan pages bener dan sama di tiap halaman
LULUS  semua halaman nampilin tiap produk tepat sekali
LULUS  halaman setelah terakhir kosong
LULUS  default page 1 limit 10
LULUS  limit kegedean dipotong jadi 50
LULUS  page/limit ngaco jadi 400
LULUS  filter q: total ikut filter, huruf besar kecil bebas
```

Hasil: lulus di percobaan pertama

## Lvl 4 · Migrasi tabel pelanggan tanpa ngilangin data (joko)

Folder: latihan/lvl4-database-migrasi-tanpa-hilang-data

Sebelum dibenerin:
```
LULUS  migrate.sql jalan tanpa error
GAGAL  kolom customers sesuai: Expected values to be strictly deep-equal:
+ actual - expected

  [
    'id',
    'name',
    'phone',
-   'created_at'
  ]

GAGAL  data pelanggan kebawa dan rapi: Expected values to be strictly deep-equal:
+ actual - expected
... Skipped lines

  [
    {
      id: 1,
      name: 'Budi Santoso',
+     phone: 81234567890
-     phone: '081234567890'
    },
    {
      id: 2,
      name: 'Siti Aminah',
+     phone: 85711112222
-     phone: '085711112222'
    },
    {
      id: 3,
      name: 'Agus',
      phone: null
...
      id: 7,
+     name: '  Dewi Lestari ',
+     phone: 81399998888
-     name: 'Dewi Lestari',
-     phone: '081399998888'
    }
  ]

GAGAL  created_at keisi: no such column: created_at
GAGAL  pesanan utuh dan nyambung ke pelanggan: Expected values to be strictly deep-equal:
+ actual - expected

  [
    'Budi Santoso',
    'Budi Santoso',
    'Siti Aminah',
+   '  Dewi Lestari '
-   'Dewi Lestari'
  ]

LULUS  foreign key orders masih ke tabel customers
LULUS  gak ada tabel sisa migrasi
GAGAL  index orders(customer_id) ada: kolom ber-index: gak ada
LULUS  foreign key nyala lagi dan nolak data ngaco
GAGAL  user_version = 2: Expected values to be strictly equal:

0 !== 2

GAGAL  pakai transaksi: gak ada BEGIN
```

Percobaan 1: LULUS (file diubah: db/migrate.sql)

Penjelasan joko: Akar masalah: kolom fullname bisa kosong dan raw data banyak spasi, phone pakai INTEGER jadi angka 0 di depan hilang. Saya bikin tabel baru dengan struktur sesuai ketentuan, migrasi datanya sekalian trim nama dan konversi phone ke TEXT dengan awalan 0, dan jaga agar foreign key orders tetap valid. Index orders(customer_id) juga ditambah, user_version dinaikkan.
```
LULUS  migrate.sql jalan tanpa error
LULUS  kolom customers sesuai
LULUS  data pelanggan kebawa dan rapi
LULUS  created_at keisi
LULUS  pesanan utuh dan nyambung ke pelanggan
LULUS  foreign key orders masih ke tabel customers
LULUS  gak ada tabel sisa migrasi
LULUS  index orders(customer_id) ada
LULUS  foreign key nyala lagi dan nolak data ngaco
LULUS  user_version = 2
LULUS  pakai transaksi
```

Hasil: lulus di percobaan pertama

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

Penjelasan fajar: Akar masalahnya: Query aslinya ambil agregat order per bulan UTC, bukan WIB, dan nggak filter status/lunas atau tahun sesuai permintaan. Solution: Validasi input year, agregat dan filter data pakai waktu WIB (paid_at +7 jam), status 'lunas', serta pastikan 12 bulan selalu muncul walau 0.
```
LULUS  2026: WIB, tanpa yang batal, 12 bulan lengkap
LULUS  2025: pesanan 31 Des jam 20.00 UTC pindah ke 2026
LULUS  2027: pesanan 31 Des 2026 jam 17.30 UTC masuk Januari 2027
LULUS  year salah atau kosong jadi 400
```

Hasil: lulus di percobaan pertama

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

Penjelasan joko: Akar masalah: Cek tabrakan (overlap) booking sebelumnya cuma pakai UNIQUE (court_id, start_at) jadi booking tumpang tindih tetap lolos, status 'batal' tetap ngeblokir, waktu bisa salah urut, dan aturan cuma diperiksa saat INSERT. Saya tambah validasi ketat dengan CHECK format+urut waktu, status, index untuk query utama, dan trigger di INSERT/UPDATE agar tumpang tindih antar booking 'aktif' pasti dicegah—sesuai kebutuhan bisnis.
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
| Skema toko gagal dijalankan dan datanya bisa ngaco | joko | lulus | 1 |
| Angka omzet di laporan kegedean | fajar | lulus | 1 |
| Pencarian produk error kalau ada tanda kutip | fajar | lulus | 1 |
| Lvl 2 · Email pelanggan dobel dan riwayat pesanan lambat | joko | lulus | 1 |
| Lvl 3 · Halaman produk loncat dan total salah | fajar | lulus | 1 |
| Lvl 4 · Migrasi tabel pelanggan tanpa ngilangin data | joko | lulus | 1 |
| Lvl 5 · Rekap omzet bulanan meleset | fajar | lulus | 1 |
| Lvl 6 · Jadwal lapangan bisa tabrakan | joko | lulus | 1 |
