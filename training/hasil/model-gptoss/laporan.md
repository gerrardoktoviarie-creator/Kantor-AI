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

Penjelasan joko: Akar masalah: file schema.sql memiliki sintaks yang salah, tidak ada constraints untuk mencegah data buruk, dan tidak melindungi duplikasi tabel serta data contoh. Saya memperbaiki sintaks (tambah koma, referensi tabel benar), menambahkan `IF NOT EXISTS`, menetapkan tipe harga sebagai INTEGER dengan CHECK >=0, wajibkan `name`, `qty > 0`, serta foreign key yang tepat, menambah indeks, dan memakai `INSERT OR IGNORE` untuk contoh data.
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

Penjelasan fajar: Akar masalah: query menggabungkan tabel order_items dan payments yang menyebabkan duplikasi baris serta menghitung semua order yang memiliki setidaknya satu pembayaran, termasuk yang belum lunas.  
Perbaikan: menghapus join ke order_items, meng‑aggregasi pembayaran per order, lalu hanya menjumlahkan serta menghitung order yang total pembayaran sama dengan total order (lunas).
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

Penjelasan fajar: Akar masalah: query SQL disusun dengan interpolasi string, menyebabkan error sintaks saat pencarian mengandung tanda kutip (contoh “Jum'at”). Saya mengganti ke prepared statement dengan parameter `?`, menambah escape untuk karakter `%` dan `_`, serta menambahkan validasi panjang q (≤100) sehingga pencarian aman untuk teks apa pun. Tanpa `q`, semua produk tetap dikembalikan.
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

Penjelasan joko: Akar masalah: email tidak unik secara case‑insensitive, kolom status tidak dibatasi nilai valid, dan tidak ada indeks untuk pencarian riwayat order sehingga SQLite harus meng‑scan + sort. Perbaikan: tambahkan UNIQUE COLLATE NOCASE pada email, tambahkan CHECK enum pada status, serta buat indeks terkomposit (user_id, created_at DESC) untuk menghindari sorting tambahan.
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

Penjelasan fajar: Akar masalah: pagination offset salah, total dihitung dari result halaman, tidak ada validasi batas limit/page, dan limit tidak dibatasi. Perbaikan meliputi validasi page & limit, batas maksimal limit 50, perhitungan total dengan COUNT(*), pengurutan harga naik, serta offset yang benar ( (page‑1)*limit ).
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

Percobaan 1: BELUM (file diubah: db/migrate.sql)

Penjelasan joko: Akar masalah: kolom `fullname` mempunyai spasi dan tipe yang tidak sesuai, serta nomor HP disimpan sebagai INTEGER sehingga kehilangan angka 0 di depan. Saya membuat migrasi yang membuat tabel `customers` baru dengan skema yang benar, menyalin data sambil men‑trim nama dan menambahkan 0 pada nomor telepon, menambah kolom `created_at`, serta membuat indeks pada `orders.customer_id` dan menetapkan `user_version = 2`. Semua langkah dibungkus dalam transaksi agar tidak ada perubahan parsial.
```
GAGAL  migrate.sql jalan tanpa error: FOREIGN KEY constraint failed
GAGAL  kolom customers sesuai: Expected values to be strictly deep-equal:
+ actual - expected

  [
    'id',
+   'fullname',
-   'name',
    'phone',
-   'created_at'
  ]

GAGAL  data pelanggan kebawa dan rapi: no such column: name
GAGAL  created_at keisi: no such column: created_at
GAGAL  pesanan utuh dan nyambung ke pelanggan: no such column: c.name
LULUS  foreign key orders masih ke tabel customers
GAGAL  gak ada tabel sisa migrasi: Expected values to be strictly deep-equal:
+ actual - expected

  [
    'customers',
+   'customers_new',
    'orders'
  ]

GAGAL  index orders(customer_id) ada: kolom ber-index: gak ada
LULUS  foreign key nyala lagi dan nolak data ngaco
GAGAL  user_version = 2: Expected values to be strictly equal:

0 !== 2

LULUS  pakai transaksi
```

Percobaan 2: BELUM (file diubah: db/migrate.sql)

Penjelasan joko: Akar masalah: mengaktifkan PRAGMA foreign_keys di dalam transaksi menyebabkan SQLite memeriksa constraint sebelum tabel customers telah sepenuhnya diganti, sehingga migrasi gagal dan meninggalkan tabel sementara. Perbaikan: memindahkan PRAGMA foreign_keys = ON setelah COMMIT, serta menyesuaikan urutan langkah sehingga tabel baru dibuat, data dipindahkan, tabel lama di‑drop, dan rename selesai sebelum kembali mengaktifkan foreign key dan menambahkan indeks.
```
GAGAL  migrate.sql jalan tanpa error: FOREIGN KEY constraint failed
GAGAL  kolom customers sesuai: Expected values to be strictly deep-equal:
+ actual - expected

  [
    'id',
+   'fullname',
-   'name',
    'phone',
-   'created_at'
  ]

GAGAL  data pelanggan kebawa dan rapi: no such column: name
GAGAL  created_at keisi: no such column: created_at
GAGAL  pesanan utuh dan nyambung ke pelanggan: no such column: c.name
LULUS  foreign key orders masih ke tabel customers
GAGAL  gak ada tabel sisa migrasi: Expected values to be strictly deep-equal:
+ actual - expected

  [
    'customers',
+   'customers_new',
    'orders'
  ]

GAGAL  index orders(customer_id) ada: kolom ber-index: gak ada
LULUS  foreign key nyala lagi dan nolak data ngaco
GAGAL  user_version = 2: Expected values to be strictly equal:

0 !== 2

LULUS  pakai transaksi
```

Percobaan 3: BELUM (file diubah: db/migrate.sql)

Penjelasan joko: Akar masalah: DROP TABLE customers gagal karena masih direferensi oleh foreign key di tabel orders, meninggalkan tabel sementara dan membuat migrasi gagal. Solusi: mengganti pendekatan menjadi rename tabel lama, buat tabel baru dengan skema yang diinginkan, salin data yang sudah dibersihkan, lalu hapus tabel lama—sehingga tabel yang direferensi tidak pernah di‑drop selama transaksi. Semua langkah dibungkus dalam satu transaksi, indeks dan version dibuat setelahnya.
```
GAGAL  migrate.sql jalan tanpa error: FOREIGN KEY constraint failed
LULUS  kolom customers sesuai
LULUS  data pelanggan kebawa dan rapi
LULUS  created_at keisi
LULUS  pesanan utuh dan nyambung ke pelanggan
GAGAL  foreign key orders masih ke tabel customers: Expected values to be strictly deep-equal:
+ actual - expected

  [
+   'customers_old'
-   'customers'
  ]

GAGAL  gak ada tabel sisa migrasi: Expected values to be strictly deep-equal:
+ actual - expected

  [
    'customers',
+   'customers_old',
    'orders'
  ]

GAGAL  index orders(customer_id) ada: kolom ber-index: gak ada
LULUS  foreign key nyala lagi dan nolak data ngaco
GAGAL  user_version = 2: Expected values to be strictly equal:

0 !== 2

LULUS  pakai transaksi
```

Hasil: belum lulus, pelajarannya dicatat

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

Penjelasan fajar: Akar masalah: query tidak mengonversi waktu UTC ke WIB, mengabaikan status 'batal', tidak memfilter tahun, dan tidak menyertakan bulan dengan nol. Saya menambahkan validasi `year`, mengubah SQL untuk menyesuaikan zona waktu (+7 jam), menyaring status, membatasi pada tahun yang diminta, serta menghasilkan array lengkap 12 bulan dengan nilai default 0.
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

Penjelasan joko: Akar masalah: tabel bookings hanya mencegah start_at yang sama, tidak memeriksa tumpang tindih, tidak memvalidasi end > start, nor status enum, nor time format, nor mengabaikan booking batal. Perbaikan: menambah CHECK untuk format, status, urutan waktu; membuat index untuk query; menambahkan trigger BEFORE INSERT/UPDATE yang menolak booking aktif yang tumpang tindih; menghapus UNIQUE (court_id, start_at) yang tidak cukup.
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
| Lvl 4 · Migrasi tabel pelanggan tanpa ngilangin data | joko | belum | 3 |
| Lvl 5 · Rekap omzet bulanan meleset | fajar | lulus | 1 |
| Lvl 6 · Jadwal lapangan bisa tabrakan | joko | lulus | 1 |
