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

Penjelasan joko: Akar masalahnya: koma hilang antara `name TEXT` dan `price REAL`, `REFERENCES product(id)` salah nama tabel, harga pakai REAL, dan tidak ada validasi NOT NULL/CHECK/UNIQUE. Yang saya ubah: perbaikan syntax, nama tabel benar, harga jadi INTEGER rupiah, produk wajib punya nama unik, qty min 1, harga min 0, serta `CREATE TABLE IF NOT EXISTS` dan `INSERT OR IGNORE` agar aman dijalankan berulang.
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

Penjelasan fajar: Akar masalahnya query join ke tabel `order_items` bikin duplikasi baris pembayaran: pesanan #1 dengan 2 item terhitung dua kali, jadi SUM jadi 75000. Saya hapus JOIN `order_items` karena omzet dihitung dari pesanan lunas, bukan item, lalu tambahkan filter `WHERE o.status = 'paid'` supaya pesanan #3 yang belum dibayar tidak ikut dihitung. Hasilnya total 45000 dengan 2 pesanan.
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

Percobaan 1: BELUM (file diubah: server.js)

Penjelasan fajar: Akar masalahnya query `WHERE name LIKE '%${q}%'` melakukan string concatenation langsung ke SQL: karakter apostrophe di "Jum'at" menutup string literal lebih awal, menyisakan `at: syntax error`. Saya ganti jadi prepared statement dengan parameter `:q`, jadi teks apa pun (termasuk tanda kutip) dianggap sebagai data, bukan bagian dari query SQL.
```
file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:22
      if (child.exitCode !== null) throw new Error(`Server mati waktu start:\n${output.slice(-1500)}`);
                                         ^

Error: Server mati waktu start:
node:events:505
    throw er; // Unhandled 'error' event
    ^

Error: listen EADDRINUSE: address already in use :::4904
    at Server.setupListenHandle [as _listen2] (node:net:2390:16)
    at listenInCluster (node:net:2499:12)
    at Server.listen (node:net:2624:7)
    at file:///C:/Users/Gerrad/Documents/kantor-ai/training/hasil/model-dsflash/lvl1-database-03-pencarian-error-tanda-kutip/server.js:34:8
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:105:5)
Emitted 'error' event on Server instance at:
    at emitErrorNT (node:net:2478:8)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21) {
  code: 'EADDRINUSE',
  errno: -4091,
  syscall: 'listen',
  address: '::',
  port: 4904
}

Node.js v26.12.1

    at withServer (file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:22:42)
    at async file:///C:/Users/Gerrad/Documents/kantor-ai/training/latihan/lvl1-database-03-pencarian-error-tanda-kutip/check.js:6:1

Node.js v26.12.1
```

Percobaan 2: BELUM (file diubah: server.js)

Penjelasan fajar: Akar masalahnya ada dua: (1) query SQL selalu mengirim parameter `q: '%...%'` bahkan saat query kosong, sehingga SQL jadi `WHERE name LIKE ''` yang bagi SQLite sah, tapi di beberapa skenario dan logikalnya lebih tepat pakai parameter eksplisit; (2) `server.listen()` dipanggil di luar `try/catch` jadi jika port tabrakan tidak tertangani dan mematikan proses. Saya pindahkan deklarasi `PORT` ke atas agar bisa dipakai di `try/catch`, lalu buat parameter pencarian hanya diset saat ada nilai `q` (tanpa `q` balik semua produk), sehingga teks apa pun—termasuk tanda kutip dan spasi—aman lewat parameter
```
LULUS  cari "Jum'at" ketemu 1
LULUS  cari "roti" ketemu 2
LULUS  teks dengan tanda kutip lain gak bikin error
GAGAL  tanpa q balikin semua: Expected values to be strictly equal:

0 !== 3
```

Hasil: belum lulus, pelajarannya dicatat

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

Penjelasan joko: Akar masalahnya: UNIQUE biasa peka huruf dan tidak mencegah duplikat seperti "budi@mail.com"/"BUDI@mail.com"; status dibiarkan sembarang tanpa CHECK; dan query riwayat pesanan tidak punya index komposit sehingga harus melakukan full scan plus re-sort. Yang diubah: email diberi UNIQUE COLLATE NOCASE, status diberi CHECK IN dengan lima nilai sah, serta ditambahkan index komposit (user_id, created_at DESC) supaya query riwayat langsung terbaca terurut tanpa sort tambahan.
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

Penjelasan fajar: Akar masalahnya adalah query SQL yang tidak memperhitungkan zona waktu (UTC ke WIB), filter status pesanan, dan tidak menghasilkan semua bulan dalam tahun yang diminta. Saya memperbaiki dengan menambahkan konversi waktu, filter status, dan menghasilkan semua bulan dalam tahun yang diminta.
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

Penjelasan joko: Akar masalahnya:唯一 constraint cuma cek detik start_at sama persis, tidak mendeteksi overlap parsial, tidak memfilter status 'batal', dan tidak berjalan saat UPDATE. Saya ganti UNIQUE dengan CHECK constraint (end > start), CHECK IN untuk status, format GLOB untuk waktu, index komposit, serta dua trigger BEFORE INSERT/BEFORE UPDATE yang menolak overlap antar booking 'aktif'.
```
GAGAL  schema jalan dua kali, lapangan gak dobel: near "INDEX": syntax error
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

Penjelasan joko: Akar masalahnya: pengecekan sebelumnya melaporkan "near INDEX: syntax error" — di SQLite `INDEX` tak boleh dipakai sebagai nama pada `CREATE INDEX` (kata kuncinya `CREATE INDEX`, bukan `CREATE TABLE ... INDEX ...`) atau nama kolom. Karena skema gagal dibuat, tabel `bookings` tak pernah lahir → semua cek yang butuh tabel itu gagal dengan `no such table: bookings`. Saya memperbaiki penulisan index menjadi `CREATE INDEX IF NOT EXISTS idx_bookings_court_status_time` yang berdiri sendiri (sesuai standar 12 langkah migrasi: index dibuat ulang setelah tabel), sehingga skema jalan berkali-kali dan sel
```
GAGAL  schema jalan dua kali, lapangan gak dobel: near "INDEX": syntax error
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

Penjelasan joko: Akar masalahnya: trigger `updates` pakai `WHEN OLD.start_at IS NOT NEW.start_at ...` — perbandingan `IS NOT` pada teks selalu TRUE kecuali nilainya literally sama di memori, sehingga trigger kadang tidak terpicu atau terpicu tanpa alasan yang benar; selain itu trigger insert tidak mengecek duplikasi jam sama persis (peraturan hanya nolak overlap, bukan duplikat sempurna, jadi itu memang tidak harus ditolak). Saya hapus kondisi `WHEN` yang bermasalah dari trigger update, pindahkan pengecekan `status != 'batal'` ke dalam EXISTS, dan menambahkan validasi format `end_at` pada CHECK.
```
GAGAL  schema jalan dua kali, lapangan gak dobel: near "INDEX": syntax error
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
| Skema toko gagal dijalankan dan datanya bisa ngaco | joko | lulus | 1 |
| Angka omzet di laporan kegedean | fajar | lulus | 1 |
| Pencarian produk error kalau ada tanda kutip | fajar | belum | 2 |
| Lvl 2 · Email pelanggan dobel dan riwayat pesanan lambat | joko | lulus | 1 |
| Lvl 3 · Halaman produk loncat dan total salah | fajar | lulus | 1 |
| Lvl 4 · Migrasi tabel pelanggan tanpa ngilangin data | joko | lulus | 1 |
| Lvl 5 · Rekap omzet bulanan meleset | fajar | lulus | 1 |
| Lvl 6 · Jadwal lapangan bisa tabrakan | joko | belum | 3 |
