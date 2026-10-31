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

Penjelasan joko: Akar masalah: koma hilang di kolom `name` (syntax error), referensi `product(id)` typo jadi tabel gak dikenali, harga `REAL` dan tanpa CHECK, qty tanpa CHECK, serta INSERT tanpa `IF NOT EXISTS`/`OR IGNORE` bikin duplikat dan error "table already exists". Yang saya ubah: tambah koma dan `IF NOT EXISTS` pada tabel, `ON DELETE RESTRICT`, `NOT NULL` + `UNIQUE` pada nama produk, harga jadi `INTEGER` rupiah dengan CHECK `price >= 0`, qty dengan CHECK `qty > 0`, serta `INSERT OR IGNORE` biar aman dijalankan berulang.
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

Percobaan 1: BELUM (file diubah: server.js)

Penjelasan fajar: Akar masalahnya: query asal menjumlahkan `orders.total` dan menghitung pesanan dari hasil JOIN antara `orders` dan `payments`. Karena pembayaran (payments) tidak punya status lunas dan jumlah data baris pembayaran sama persis dengan pesanan lunas (#1 dan #2), JOIN sebenarnya sudah menyaring pesanan yang belum dibayar. Namun karena pesanan #3 yang belum dibayar tidak punya baris di tabel payments, ia otomatis tereliminasi. Tunggu — query saat ini seharusnya sudah benar menghasilkan 45000, bukan 75000.

Koreksi: query yang salah adalah karena ada asumsi bahwa pesanan "belum dibayar" tetap ikut d
```
GAGAL  omzet cuma dari pesanan lunas, gak dobel: Expected values to be strictly equal:

75000 !== 45000

GAGAL  jumlah pesanan lunas 2: Expected values to be strictly equal:

3 !== 2
```

Percobaan 2: LULUS (file diubah: server.js)

Penjelasan fajar: Akar masalah: query lama pakai `JOIN order_items` + `WHERE o.total = p.amount` bikin satu pesanan lunas terhitung berkali-kali (pesanan #1 punya 2 item, jadi Rp30.000 masuk dua kali; total jadi 30000*2 + 15000 = 75000). Saya ganti join jadi `WHERE EXISTS (payments)` yang langsung cek status lunas per pesanan, dan `COUNT(DISTINCT o.id)` agar pesanan yang terduplikasi karena banyak item cuma dihitung satu.
```
LULUS  omzet cuma dari pesanan lunas, gak dobel
LULUS  jumlah pesanan lunas 2
```

Hasil: lulus di percobaan 2, pelajarannya dicatat

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

Percobaan 1: BELUM (file diubah: server.js)

Penjelasan fajar: Akar masalahnya: query `LIKE '%${q}%'` melakukan string interpolation ke dalam SQL, sehingga karakter unik seperti tanda kutip `'` di "Jum'at" menghancurkan sintaks dan memicu error 500. Saya ganti jadi prepared statement dengan placeholder (`?`) yang meng-handle escaping otomatis, tambahkan batas panjang input, validasi `limit` sebagai bilangan bulat positif, dan parameterisasi `LIMIT`/`OFFSET` (dengan default 100) biar aman dari injection sekaligus abusive query.
```
GAGAL  cari "Jum'at" ketemu 1: fetch failed
GAGAL  cari "roti" ketemu 2: fetch failed
GAGAL  teks dengan tanda kutip lain gak bikin error: fetch failed
GAGAL  tanpa q balikin semua: fetch failed
```

Percobaan 2: LULUS (file diubah: server.js)

Penjelasan fajar: Akar masalahnya: `ESCAPE '!'` mengharuskan karakter `!` dipakai sebagai escape di query; pas input `Jum'at`, SQLite menafsirkan urutan `'"` sebagai awal escape sequence yang tidak valid (`!` diikuti `"`), sehingga SQL error. Saya hapus `ESCAPE '!'` dan pindahkan nilai ke parameter prepared statement (`q`, `limit`, `offset`) sehingga kutip, `%`, `_`, dan karakter lain langsung di-handle aman.
```
LULUS  cari "Jum'at" ketemu 1
LULUS  cari "roti" ketemu 2
LULUS  teks dengan tanda kutip lain gak bikin error
LULUS  tanpa q balikin semua
```

Hasil: lulus di percobaan 2, pelajarannya dicatat

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

Penjelasan joko: Akar masalahnya: kolom `email` di tabel `users` gak punya constraint `UNIQUE` dan collation yang tepat, kolom `status` di tabel `orders` bebas diisi teks apa aja tanpa validasi, dan query riwayat pesanan lambat karena gak ada index komposit buat `user_id` dan `created_at`. Yang diubah: nambahin `UNIQUE COLLATE NOCASE` di `email`, `CHECK (status IN (...))` di `status`, `ON DELETE RESTRICT` di foreign key, dan bikin index `idx_orders_user_id_created_at` biar query riwayat langsung pakai index tanpa sort ulang.
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

Penjelasan fajar: Akar masalahnya ada empat: rumus OFFSET salah (`page * limit` harusnya `(page - 1) * limit`), total dihitung dari panjang array hasil halaman saat itu bukan dari query `COUNT(*)`, dan parameter `limit`/`offset` digabung langsung ke string SQL pakai template literal alih-alih dikirim sebagai parameter prepared statement sehingga input non-angka bikin error 500 dan gak ada batas maksimal. Perbaikan mencakup validasi ketat `page`/`limit` jadi integer positif, pemotongan limit maksimal 50, query `COUNT(*)` terpisah dengan filter `LIKE` yang sama persis (pakai parameter `?` untuk cegah SQL injectio
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

Penjelasan joko: Akar masalahnya: `ALTER TABLE ... RENAME COLUMN` di draft sebelumnya cuma ganti nama kolom tapi gak ngubah tipe data `phone` dari INTEGER ke TEXT (angka 0 di depan tetep hilang), gak nambahin constraint `NOT NULL`, dan gak bikin tabel `created_at`. Solusinya pakai pola migrasi 12 langkah SQLite (bikin tabel baru, salin+rapikan data pakai `TRIM()` dan concat `'0'`, drop yang lama, rename yang baru) dibungkus satu transaksi biar kalau ada error di tengah database langsung rollback dan gak setengah jadi.
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

Penjelasan fajar: Akar masalahnya: query asli ngambil bulan langsung dari kolom `paid_at` yang masih UTC (bukan WIB), gak filter tahun dan status 'batal', serta gak nyetak bulan yang kosong. Perbaikannya: geser waktu pakai `datetime(paid_at, '+7 hours')` lewat prepared statement sebelum diekstrak bulan/tahunnya, filter keluar pesanan berstatus 'batal', dan bikin kerangka array 12 bulan di kode supaya bulan tanpa transaksi tetap tampil dengan nilai 0.
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

Percobaan 1: BELUM (file diubah: db/schema.sql)

Penjelasan joko: Akar masalahnya: skema lama cuma pakai `UNIQUE(court_id, start_at)` yang gagal nangkap jadwal tumpang tindih parsial, gak ada `CHECK` buat maksa `end_at > start_at` dan format waktu ISO, serta gak ada `TRIGGER` buat validasi overlap saat `INSERT` maupun `UPDATE`. Yang diubah: `UNIQUE` dihapus dan diganti dua `TRIGGER BEFORE` yang pakai logika interval tumpang tindih (`NEW.start_at < end_lama AND NEW.end_at > start_lama`) khusus untuk status `'aktif'`, ditambah `CHECK` ketat untuk format waktu via `GLOB`, batasan nilai status, aturan `end_at > start_at`, index komposit `(court_id, status, start
```
GAGAL  schema jalan dua kali, lapangan gak dobel: Jadwal tumpang tindih dengan booking aktif di lapangan yang sama
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

Percobaan 2: BELUM (file diubah: db/schema.sql)

Penjelasan joko: Akar masalahnya: trigger `trg_bookings_no_overlap_insert` dijalankan untuk baris baru 'aktif' yang gagal CHECK `end_at > start_at`; karena trigger dieksekusi sebelum pengecekan CHECK, baris ilegal masih dicek overlap-nya (termasuk overlap dengan diri sendiri) sehingga INSERT ganda data contoh ditolak. Solusinya memindahkan kondisi `NEW.end_at > NEW.start_at` ke dalam `WHEN` trigger, sehingga pengecekan overlap hanya dijalankan untuk data yang sudah valid, dan trigger UPDATE menambahkan kondisi `NEW.id != OLD.id` agar tidak menghitung baris yang sedang diubah.
```
GAGAL  schema jalan dua kali, lapangan gak dobel: Jadwal tumpang tindih dengan booking aktif di lapangan yang sama
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
GAGAL  ngaktifin lagi yang batal dan tabrakan ditolak: Missing expected exception: aktif lagi
GAGAL  ganti jam jadi tabrakan ditolak: Missing expected exception: geser jam
LULUS  ganti jam yang gak tabrakan boleh (dirinya sendiri gak dihitung)
LULUS  jadwal per hari pakai index
```

Percobaan 3: BELUM (file diubah: db/schema.sql)

Penjelasan joko: Akar masalahnya: trigger `trg_bookings_no_overlap_update` punya kondisi `NEW.id != OLD.id` di `WHEN`, sehingga saat status `batal` → `aktif` atau saat jam diubah, trigger dianggap tidak relevan dan tidak dijalankan. Saya memecahnya jadi 3 trigger: INSERT (booking baru aktif), UPDATE jam pada booking aktif (dengan `id != NEW.id`), dan UPDATE restorasi `batal` → `aktif` (juga pakai `id != NEW.id` karena id tidak pernah berubah). Trigger `updated_at` sekarang hanya jalan jika ada perubahan nyata.
```
GAGAL  schema jalan dua kali, lapangan gak dobel: Jadwal tumpang tindih dengan booking aktif di lapangan yang sama
LULUS  booking pertama masuk
LULUS  tumpang tindih sebagian ditolak
LULUS  yang ngebungkus ditolak
LULUS  yang di dalam ditolak
LULUS  yang nempel boleh
LULUS  lapangan lain boleh di jam yang sama
GAGAL  jam selesai sebelum mulai ditolak: Missing expected exception: end < start
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
| Skema toko gagal dijalankan dan datanya bisa ngaco | joko | lulus | 1 |
| Angka omzet di laporan kegedean | fajar | lulus | 2 |
| Pencarian produk error kalau ada tanda kutip | fajar | lulus | 2 |
| Lvl 2 · Email pelanggan dobel dan riwayat pesanan lambat | joko | lulus | 1 |
| Lvl 3 · Halaman produk loncat dan total salah | fajar | lulus | 1 |
| Lvl 4 · Migrasi tabel pelanggan tanpa ngilangin data | joko | lulus | 1 |
| Lvl 5 · Rekap omzet bulanan meleset | fajar | lulus | 1 |
| Lvl 6 · Jadwal lapangan bisa tabrakan | joko | belum | 3 |
