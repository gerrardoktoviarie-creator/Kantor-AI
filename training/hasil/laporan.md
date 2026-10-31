# Laporan latihan IT

29/10/2026, 18.34.50

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

Percobaan 1: BELUM (file diubah: db/schema.sql)

Penjelasan joko: Masalah pertama: email tidak unik dan tidak case-insensitive — solusinya pakai `UNIQUE` pada kolom email. Masalah kedua: `status` bisa diisi sembarang, diperbaiki dengan `CHECK (status IN ('baru', 'dibayar', 'dikirim', 'selesai', 'batal'))`. Masalah ketiga: query riwayat pesanan lambat karena tanpa index — saya tambahkan `CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC)` agar filter per user dan pengurutan turun per user langsung dibaca langsung dari index tanpa sort tambahan.
```
GAGAL  schema jalan dua kali, data gak dobel: Expected values to be strictly equal:

6 !== 2

LULUS  email sama ditolak
GAGAL  email beda huruf besar ditolak: Missing expected exception: email unik tanpa peduli huruf besar
LULUS  email baru boleh
LULUS  status sah boleh
LULUS  status ngaco ditolak
LULUS  riwayat pesanan pakai index tanpa sort tambahan
```

Percobaan 2: BELUM (file diubah: db/schema.sql)

Penjelasan joko: Akar masalahnya ada di dua tempat: `email` punya `UNIQUE` tapi SQLite tidak menormalkan huruf kecil/ besar, jadi `"budi@mail.com"` dan `"BUDI@mail.com"` dianggap beda; dan kolom `email` tidak `NOT NULL` sehingga `INSERT OR IGNORE` tidak memaksa duplikasi menjadi error. Saya hapus `UNIQUE` dari kolom, ganti dengan `UNIQUE INDEX` pada `lower(email)` agar penolakan duplikat sensitif huruf, dan tambahkan `NOT NULL` pada email. Kolom `status` dan index sudah benar, tidak diubah.
```
GAGAL  schema jalan dua kali, data gak dobel: Expected values to be strictly equal:

6 !== 2

LULUS  email sama ditolak
LULUS  email beda huruf besar ditolak
LULUS  email baru boleh
LULUS  status sah boleh
LULUS  status ngaco ditolak
LULUS  riwayat pesanan pakai index tanpa sort tambahan
```

Hasil: belum lulus, pelajarannya dicatat

## Lvl 2 · Tombol tandai selesai gak jalan (bug di 2 file) (bayu)

Folder: latihan/lvl2-error-tandai-selesai

Sebelum dibenerin:
```
GAGAL  PUT done:true jadi 200 dan ke-update: Expected values to be strictly equal:

404 !== 200

GAGAL  perubahan kesimpan di daftar: Expected values to be strictly equal:

false !== true

GAGAL  id di body diabaikan: Expected values to be strictly equal:

404 !== 200

GAGAL  ganti judul boleh: Expected values to be strictly equal:

404 !== 200

GAGAL  done bukan boolean jadi 400: Expected values to be strictly equal:

404 !== 400

GAGAL  judul kosong jadi 400: Expected values to be strictly equal:

404 !== 400

LULUS  catatan yang gak ada jadi 404
```

Percobaan 1: BELUM (file diubah: server.js, lib/store.js, public/app.js, server.js, lib/store.js, public/app.js)

Penjelasan bayu: Akar masalah: (1) server hanya menangani method PATCH, bukan PUT yang dikirim frontend, makanya 404; (2) `updateNote` meng-reassign parameter `note` padahal itu bukan variabel yang bermasalah, log error "Assignment to constant variable" muncul karena ada kode yang mencoba mengassign ulang ke konstanta dalam alur asli; (3) array `notes` dan loop for-of membuatnya tetap di-same-object. Solusi: tambah route PUT, validasi `done` boolean dan `title` tidak kosong di server, update object di tempat (bukan reassign), dan return object terbaru agar GET ikut berubah.

Maaf, saya perlu memperbaiki kesala
```
LULUS  PUT done:true jadi 200 dan ke-update
LULUS  perubahan kesimpan di daftar
LULUS  id di body diabaikan
LULUS  ganti judul boleh
GAGAL  done bukan boolean jadi 400: Expected values to be strictly equal:

404 !== 400

GAGAL  judul kosong jadi 400: Expected values to be strictly equal:

404 !== 400

LULUS  catatan yang gak ada jadi 404
```

Percobaan 2: BELUM (file diubah: server.js)

Penjelasan bayu: Akar masalahnya: fungsi `updateNote` mengembalikan `null` untuk **baik** kondisi catatan tidak ditemukan **maupun** saat validasi field (done bukan boolean / title kosong) gagal. Di server, semua kasus `!note` dianggap "catatan tidak ada" sehingga merespons 404. Saya pisahkan kedua kasus: jika `updateNote` menolak karena input tidak valid, kembalikan 400; baru kalau catatan benar-benar tidak ada, kembalikan 404.
```
LULUS  PUT done:true jadi 200 dan ke-update
LULUS  perubahan kesimpan di daftar
LULUS  id di body diabaikan
LULUS  ganti judul boleh
LULUS  done bukan boolean jadi 400
LULUS  judul kosong jadi 400
GAGAL  catatan yang gak ada jadi 404: Expected values to be strictly equal:

400 !== 404
```

Hasil: belum lulus, pelajarannya dicatat

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

Percobaan 1: BELUM (file diubah: server.js)

Penjelasan fajar: Akar masalah: `total` dihitung dari `items.length` (hasil yang sudah di-paginate, bukan seluruh baris yang cocok filter) jadi berubah tiap ganti halaman, dan query langsung meng-*inject* variabel `limit`/`offset` lewat template literal (SQL injection + bisa crash kalau `limit` bukan angka, misalnya `abc`). Yang aku ubah: validasi `page`/`limit` di boundary dengan `Number.isInteger` dan cap `limit` 1–50 (400 kalau tidak valid), `total` diambil dari `COUNT(*)` terpisah untuk seluruh hasil filter, `ORDER BY price ASC` eksplisit, dan semua query pakai prepared statement dengan parameter terikat.
```
file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:19
      if (child.exitCode !== null) throw new Error(`Server mati waktu start:\n${output.slice(-1500)}`);
                                         ^

Error: Server mati waktu start:
file:///C:/Users/Gerrad/Documents/kantor-ai/training/hasil/lvl3-database-halaman-produk-loncat/server.js:89
        'SELECT COUNT(*) AS total FROM products WHERE name LIKE ? ESCAPE '\'''
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

SyntaxError: missing ) after argument list
    at compileSourceTextModule (node:internal/modules/esm/utils:355:16)
    at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:94:18)
    at #translate (node:internal/modules/esm/loader:441:20)
    at afterLoad (node:internal/modules/esm/loader:509:29)
    at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:514:12)
    at #getOrCreateModuleJobAfterResolve (node:internal/modules/esm/loader:567:36)
    at afterResolve (node:internal/modules/esm/loader:614:52)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:620:12)
    at node:internal/modules/esm/loader:639:32
    at TracingChannel.tracePromise (node:diagnostics_channel:582:22)

Node.js v26.12.1

    at withServer (file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:19:42)
    at async file:///C:/Users/Gerrad/Documents/kantor-ai/training/latihan/lvl3-database-halaman-produk-loncat/check.js:7:1

Node.js v26.12.1
```

Percobaan 2: BELUM (file diubah: server.js)

Penjelasan fajar: Akar masalahnya cuma satu: string SQL pada baris 89 pake escaping backtick yang salah (`...ESCAPE '\'''`) sehingga Node gagal parse (SyntaxError). Gue hapus bagian `ESCAPE '\'''` yang ngarang itu, sisa logikanya (pagination offset, total count per query, limit cap 50, validasi 400) emang udah bener dan nggak ngaruh ke bug-nya.
```
file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:19
      if (child.exitCode !== null) throw new Error(`Server mati waktu start:\n${output.slice(-1500)}`);
                                         ^

Error: Server mati waktu start:
file:///C:/Users/Gerrad/Documents/kantor-ai/training/hasil/lvl3-database-halaman-produk-loncat/server.js:12
db.exec(`
   ^

Error: near ")": syntax error
    at file:///C:/Users/Gerrad/Documents/kantor-ai/training/hasil/lvl3-database-halaman-produk-loncat/server.js:12:4
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:105:5) {
  code: 'ERR_SQLITE_ERROR',
  errcode: 1,
  errstr: 'SQL logic error'
}

Node.js v26.12.1

    at withServer (file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:19:42)
    at async file:///C:/Users/Gerrad/Documents/kantor-ai/training/latihan/lvl3-database-halaman-produk-loncat/check.js:7:1

Node.js v26.12.1
```

Hasil: belum lulus, pelajarannya dicatat

## Lvl 3 · Server mati total kena input aneh (bayu)

Folder: latihan/lvl3-error-server-mati-kena-input-aneh

Sebelum dibenerin:
```
LULUS  konversi normal
GAGAL  huruf kecil boleh: fetch failed
GAGAL  JSON rusak jadi 400 dan server hidup: fetch failed
GAGAL  body kosong jadi 400 dan server hidup: fetch failed
GAGAL  mata uang gak dikenal jadi 400 dan server hidup: fetch failed
GAGAL  amount bukan angka jadi 400: fetch failed
GAGAL  amount nol atau minus jadi 400: fetch failed
GAGAL  setelah semua itu server masih hidup: fetch failed
```

Percobaan 1: LULUS (file diubah: server.js)

Penjelasan bayu: Server mati karena tiap request aneh melempar exception yang ditangkap oleh Node.js secara global dan mematikan proses. Saya ubah handler jadi wrapped try/catch agar semua error (JSON rusak, body kosong, mata uang tidak dikenal, amount bukan angka) dipetakan ke respons 400, dan mengubah `convert` jadi sinkron agar Promise timeout yang bisa melempar exception pun aman.
```
LULUS  konversi normal
LULUS  huruf kecil boleh
LULUS  JSON rusak jadi 400 dan server hidup
LULUS  body kosong jadi 400 dan server hidup
LULUS  mata uang gak dikenal jadi 400 dan server hidup
LULUS  amount bukan angka jadi 400
LULUS  amount nol atau minus jadi 400
LULUS  setelah semua itu server masih hidup
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

Percobaan 1: BELUM (file diubah: db/migrate.sql, db/current.sql)

Penjelasan joko: Akar masalahnya: schema lama pakai `name TEXT` (boleh NULL) dan `phone INTEGER` yang bikin `0812...` jadi `812...` karena angka di depan hilang. Yang diperbaiki: migrasi membuat tabel baru dengan `name` NOT NULL + TRIM, `phone` jadi TEXT berformat 0-padded, index komposit, foreign key checked, dan PRAGMA user_version = 2, semua dalam satu transaction biar gak setengah jadi.
```
GAGAL  migrate.sql jalan tanpa error: near "DO": syntax error
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

Penjelasan joko: Akar masalah: syntax error `ON CONFLICT ... DO NOTHING` pada `INSERT` ke tabel yang baru dibuat, dan `orders` asli tidak punya kolom `created_at` sehingga index komposit fail. Saya hapus `ON CONFLICT` (tidak diperlukan saat mentransfer dari tabel lama), dan memisahkan index `orders(customer_id)` agar tidak bergantung pada kolom `created_at` yang tidak ada.
```
GAGAL  migrate.sql jalan tanpa error: no such column: created_at
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
    'orders',
+   'orders_new'
  ]

GAGAL  index orders(customer_id) ada: kolom ber-index: gak ada
LULUS  foreign key nyala lagi dan nolak data ngaco
GAGAL  user_version = 2: Expected values to be strictly equal:

0 !== 2

LULUS  pakai transaksi
```

Percobaan 3: BELUM (file diubah: db/migrate.sql)

Penjelasan joko: Akar masalah: skema `db/current.sql` sudah punya kolom `name`/`created_at` (bukan `fullname`), jadi semua `SELECT fullname`/`TRIM(fullname)`/`COALESCE(fullname)` di migrate.sql error "no such column", lalu INSERT ke `customers_new` gagal total, tabel baru gak terisi, `CREATE TABLE customers_new` di-skip karena `IF NOT EXISTS` pas tabel terisi tapi kosong, dan swap gak pernah terjadi. Karena swap gagal, `user_version` dan index gak sempat jalan.

Perbaikan: hapus seluruh referensi `fullname` dan `TRIM`, ganti `created_at` diisi `datetime('now')` (karena tabel lama memang belum punya kolom ini, 
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
    'orders',
+   'orders_new'
  ]

GAGAL  index orders(customer_id) ada: kolom ber-index: gak ada
LULUS  foreign key nyala lagi dan nolak data ngaco
GAGAL  user_version = 2: Expected values to be strictly equal:

0 !== 2

LULUS  pakai transaksi
```

Hasil: belum lulus, pelajarannya dicatat

## Lvl 4 · Satu jadwal kebooking dobel kalau dipesan barengan (bayu)

Folder: latihan/lvl4-error-booking-dobel

Sebelum dibenerin:
```
LULUS  booking biasa jadi 201
LULUS  slot yang udah kepakai jadi 409
GAGAL  5 orang pesan barengan: cuma 1 yang dapet: Expected values to be strictly deep-equal:
+ actual - expected

  [
    201,
+   201,
+   201,
+   201,
+   201
-   409,
-   409,
-   409,
-   409
  ]

LULUS  pembayaran gagal jadi 402 dan slotnya bisa dipesan lagi
LULUS  yang bayar gagal barengan sama yang sukses: yang sukses tetap dapet
LULUS  input kosong jadi 400
```

Percobaan 1: BELUM (file diubah: server.js)

Penjelasan bayu: Akar masalahnya: tidak ada penangguhan konkurensi per slot. Banyak request yang datang bersamaan melewati pengecekan `taken` secara bersamaan (semuanya melihat slot masih kosong), lalu semuanya berhasil melakukan `INSERT` — pelanggaran aturan "satu court+slot = 1 booking". Saya menambahkan lock per slot yang memastikan pengecekan ketersediaan dan penulisan booking dijalankan satu per satu, sehingga status slot terverifikasi sebelum payment, dan slot tetap bisa dipesan orang lain jika pembayaran gagal (baris tidak pernah masuk ke database).
```
check.js gak jalan (spawnSync C:\Program Files\nodejs\node.exe ETIMEDOUT)
```

Percobaan 2: BELUM (file diubah: server.js)

Penjelasan bayu: Akar masalahnya ada di mekanisme kunci antrian (`acquireSlotLock`): antrian dilepas lewat timer `setTimeout(..., 0)` dan kode membuka kunci pakai `if (locked) locked()`, padahal fungsi itu mengembalikan `promise` yang diselesaikan oleh callback antrian — jadi `locked` bernilai `undefined` dan kunci cuma terbuka saat timer jalan, membiarkan request lain masuk barengan. Saya ganti dengan single-queue per slot yang memanggil callback `run()` secara sinkron se-urutan, jadi validasi pembayaran dan insert dikerjakan satu per satu dan slot bebas otomatis kalau pembayaran gagal.
```
GAGAL  booking biasa jadi 201: Expected values to be strictly equal:

500 !== 201

GAGAL  slot yang udah kepakai jadi 409: Expected values to be strictly equal:

500 !== 409

GAGAL  5 orang pesan barengan: cuma 1 yang dapet: Expected values to be strictly deep-equal:
+ actual - expected

  [
+   500,
+   500,
+   500,
+   500,
+   500
-   201,
-   409,
-   409,
-   409,
-   409
  ]

GAGAL  pembayaran gagal jadi 402 dan slotnya bisa dipesan lagi: Expected values to be strictly equal:

500 !== 402

GAGAL  yang bayar gagal barengan sama yang sukses: yang sukses tetap dapet: Expected values to be strictly equal:

500 !== 402

LULUS  input kosong jadi 400
```

Percobaan 3: BELUM (file diubah: server.js)

Penjelasan bayu: Akar masalah: di `run()` antrian dipanggil tapi result-nya diabaikan (`await run(...)` saja) sehingga `handleBooking` di-return langsung, malah memicu error handling 500. Saya perbaiki menjadi `const { status, body } = await run(court, slot, name)`. Tambahan: INSERT kini dibungkus try/catch — kalau UNIQUE violation masih masuk (race window), dikembalikan 409 bukan 500, dan slot tetep terbuka buat user berikutnya.
```
file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:19
      if (child.exitCode !== null) throw new Error(`Server mati waktu start:\n${output.slice(-1500)}`);
                                         ^

Error: Server mati waktu start:
file:///C:/Users/Gerrad/Documents/kantor-ai/training/hasil/lvl4-error-booking-dobel/server.js:119
      const { status, body } = await run(court, slot, name);
                      ^

SyntaxError: Identifier 'body' has already been declared
    at compileSourceTextModule (node:internal/modules/esm/utils:355:16)
    at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:94:18)
    at #translate (node:internal/modules/esm/loader:441:20)
    at afterLoad (node:internal/modules/esm/loader:509:29)
    at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:514:12)
    at #getOrCreateModuleJobAfterResolve (node:internal/modules/esm/loader:567:36)
    at afterResolve (node:internal/modules/esm/loader:614:52)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:620:12)
    at node:internal/modules/esm/loader:639:32
    at TracingChannel.tracePromise (node:diagnostics_channel:582:22)

Node.js v26.12.1

    at withServer (file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:19:42)
    at async file:///C:/Users/Gerrad/Documents/kantor-ai/training/latihan/lvl4-error-booking-dobel/check.js:6:1

Node.js v26.12.1
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

Percobaan 1: BELUM (file diubah: server.js)

Penjelasan fajar: Akar masalah: query lama menghitung bulan berdasarkan tanggal UTC (`paid_at`) dan melewatkan pesanan batal, jadi pesanan yang jam UTC-nya masih di hari/tanggal 31 Jan tapi WIB-nya sudah 1 Feb (id 3: 18:30 UTC -> 01:30 WIB, 1 Feb) "loncat" ke Februari. Saya ubah penentuan bulan ke WIB (+7 jam), filter status batal, validasi year 4 digit, dan selalu emit 12 bulan Januari–Desember dengan bulan kosong bernilai 0.
```
GAGAL  2026: WIB, tanpa yang batal, 12 bulan lengkap: Expected values to be strictly deep-equal:
+ actual - expected
... Skipped lines

  [
    {
      month: '2026-01',
+     orders: 3,
+     total: 100000
-     orders: 2,
-     total: 55000
    },
    {
      month: '2026-02',
+     orders: 1,
+     total: 45000
-     orders: 2,
-     total: 65000
    },
    {
      month: '2026-03',
      orders: 1,
      total: 15000
...
      month: '2026-12',
+     orders: 2,
+     total: 65000
-     orders: 0,
-     total: 0
    }
  ]

GAGAL  2025: pesanan 31 Des jam 20.00 UTC pindah ke 2026: Expected values to be strictly deep-equal:
+ actual - expected

  [
    {
+     month: '2026-01',
+     orders: 0,
+     total: 0
-     month: '2025-01',
-     orders: 1,
-     total: 50000
    },
    {
+     month: '2026-02',
-     month: '2025-02',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-03',
-     month: '2025-03',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-04',
-     month: '2025-04',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-05',
-     month: '2025-05',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-06',
-     month: '2025-06',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-07',
-     month: '2025-07',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-08',
-     month: '2025-08',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-09',
-     month: '2025-09',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-10',
-     month: '2025-10',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-11',
-     month: '2025-11',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-12',
-     month: '2025-12',
      orders: 0,
      total: 0
    }
  ]

GAGAL  2027: pesanan 31 Des 2026 jam 17.30 UTC masuk Januari 2027: Expected values to be strictly deep-equal:
+ actual - expected

  [
    {
+     month: '2026-01',
+     orders: 0,
+     total: 0
-     month: '2027-01',
-     orders: 1,
-     total: 40000
    },
    {
+     month: '2026-02',
-     month: '2027-02',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-03',
-     month: '2027-03',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-04',
-     month: '2027-04',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-05',
-     month: '2027-05',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-06',
-     month: '2027-06',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-07',
-     month: '2027-07',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-08',
-     month: '2027-08',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-09',
-     month: '2027-09',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-10',
-     month: '2027-10',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-11',
-     month: '2027-11',
      orders: 0,
      total: 0
    },
    {
+     month: '2026-12',
-     month: '2027-12',
      orders: 0,
      total: 0
    }
  ]

LULUS  year salah atau kosong jadi 400
```

Percobaan 2: BELUM (file diubah: server.js)

Penjelasan fajar: Akar masalahnya: query SQL pakai `strftime('%m', paid_at)` yang menghitung bulan dari timestamp UTC mentah, jadi pesanan yang masuk WIB di bulan berikutnya (misalnya 2026-01-31 18:30 UTC = 01:30 WIB tanggal 1 Februari) salah dihitung. Selain itu, `paidAtWibWday` di versi sebelumnya hanya mengoffset jam tetapi tetap menggabungkan bulan UTC, sehingga hasilnya terbalik.

Yang diubah: peralihan hitungan bulan sepenuhnya ke SQL dengan fungsi `strftime('%Y', paid_at, '+7 hours', 'start')` dan `date(paid_at, '+7 hours', 'start')` agar status batal tetap terfilter dan bulan dihitung berdasarkan WIB (U
```
file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:19
      if (child.exitCode !== null) throw new Error(`Server mati waktu start:\n${output.slice(-1500)}`);
                                         ^

Error: Server mati waktu start:
file:///C:/Users/Gerrad/Documents/kantor-ai/training/hasil/lvl5-database-rekap-bulanan-meleset/server.js:3
const db = new DatabaseSync(':memory:');
           ^

ReferenceError: DatabaseSync is not defined
    at file:///C:/Users/Gerrad/Documents/kantor-ai/training/hasil/lvl5-database-rekap-bulanan-meleset/server.js:3:12
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:105:5)

Node.js v26.12.1

    at withServer (file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:19:42)
    at async file:///C:/Users/Gerrad/Documents/kantor-ai/training/latihan/lvl5-database-rekap-bulanan-meleset/check.js:11:1

Node.js v26.12.1
```

Percobaan 3: BELUM (file diubah: server.js)

Penjelasan fajar: Akar masalahnya `DatabaseSync` belum diimport dari `node:sqlite` (itu API Node 22, di sini butuh import eksplisit) — itu yang bikin server error start. Saya juga merapikan query: `paid_at` di-offset `'+7 hours'` di dalam `strftime`/`date` biar bulan benar-benar diambil dari waktu WIB, bukan UTC, dan `COUNT(*)`/`SUM` dihitung dengan filter `WHERE status='lunas' AND strftime('%Y', paid_at, '+7 hours', 'start') = ?` yang sama persis seperti query detail, plus parametrisasi dan `limit` sudah di sana.
```
GAGAL  2026: WIB, tanpa yang batal, 12 bulan lengkap: Expected values to be strictly deep-equal:
+ actual - expected

  [
    {
      month: '2026-01',
+     orders: 0,
+     total: 0
-     orders: 2,
-     total: 55000
    },
    {
      month: '2026-02',
+     orders: 0,
+     total: 0
-     orders: 2,
-     total: 65000
    },
    {
      month: '2026-03',
+     orders: 0,
+     total: 0
-     orders: 1,
-     total: 15000
    },
    {
      month: '2026-04',
      orders: 0,
      total: 0

GAGAL  2025: pesanan 31 Des jam 20.00 UTC pindah ke 2026: Expected values to be strictly deep-equal:
+ actual - expected

  [
    {
      month: '2025-01',
+     orders: 0,
+     total: 0
-     orders: 1,
-     total: 50000
    },
    {
      month: '2025-02',
      orders: 0,
      total: 0

GAGAL  2027: pesanan 31 Des 2026 jam 17.30 UTC masuk Januari 2027: Expected values to be strictly deep-equal:
+ actual - expected

  [
    {
      month: '2027-01',
+     orders: 0,
+     total: 0
-     orders: 1,
-     total: 40000
    },
    {
      month: '2027-02',
      orders: 0,
      total: 0

LULUS  year salah atau kosong jadi 400
```

Hasil: belum lulus, pelajarannya dicatat

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

Penjelasan bayu: Akar masalah: promo salah hitung karena `>` 50.000 (harusnya `>=`), diskon di-bulat naik via `Math.min(x, 20000)` sehingga bisa melebihi batas (harusnya `Math.floor` lalu clamp), ongkir salah urutan (dicek sebelum diskon), qty dan id produk tidak divalidasi, serta error tidak dikembalikan sebagai 400. Saya perbaiki di `lib/pricing.js` (validasi qty 1-99, lookup produk, diskon `Math.floor`, clamp, logika ongkir setelah diskon) dan `server.js` (validasi tipe `items`/`code`, tangkap JSON error, map error bisnis ke 400, bukan ke 500).
```
LULUS  tanpa promo
LULUS  HEMAT10 huruf kecil tetap berlaku
LULUS  HEMAT10 pas Rp50.000 udah boleh
LULUS  HEMAT10 di bawah minimal: diskon 0
LULUS  ongkir dihitung dari subtotal setelah diskon
LULUS  diskon dibulatkan ke bawah
LULUS  diskon maksimal Rp20.000 dan ongkir gratis
GAGAL  ONGKIRFREE: {"error":"Kode promo tidak dikenal: ongkirfree."}

400 !== 200

LULUS  semua angka bilangan bulat
LULUS  input salah jadi 400
```

Percobaan 2: BELUM (file diubah: lib/pricing.js)

Penjelasan bayu: Akar masalahnya: logika promo HEMAT10 memakai `else if`, jadi setiap kode promo selain HEMAT10 langsung dianggap tidak dikenal. Saya pisahkan ONGKIRFREE menjadi kondisi independen yang menetapkan diskon 0, sehingga promo tersebut dikenali tanpa mengubah perhitungan diskon barang atau ongkir.
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

Percobaan 3: BELUM (file diubah: lib/pricing.js)

Penjelasan bayu: Akar masalah: handler ONGKIRFREE cuma reset `discount` jadi 0 tapi tetap mengandalkan kondisi `subtotal - diskon >= 100000` untuk membuat ongkir gratis, padahal subtotal 15000 tidak mencapai Rp100.000. Perbaikan: gunakan flag `shippingFree` yang aktif saat HEMAT10 (sesuai aturan "ongkir jadi 0" untuk diskon barang juga) atau ONGKIRFREE, lalu kondisi ongkir jadi OR terhadap flag itu.
```
LULUS  tanpa promo
GAGAL  HEMAT10 huruf kecil tetap berlaku: Expected values to be strictly deep-equal:
+ actual - expected

  {
    discount: 8500,
+   shipping: 0,
-   shipping: 10000,
    subtotal: 85000,
+   total: 76500
-   total: 86500
  }

GAGAL  HEMAT10 pas Rp50.000 udah boleh: Expected values to be strictly deep-equal:
+ actual - expected

  {
    discount: 5000,
+   shipping: 0,
-   shipping: 10000,
    subtotal: 50000,
+   total: 45000
-   total: 55000
  }

GAGAL  HEMAT10 di bawah minimal: diskon 0: Expected values to be strictly deep-equal:
+ actual - expected

  {
    discount: 0,
+   shipping: 0,
-   shipping: 10000,
    subtotal: 36000,
+   total: 36000
-   total: 46000
  }

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

GAGAL  diskon dibulatkan ke bawah: Expected values to be strictly deep-equal:
+ actual - expected

  {
    discount: 7035,
+   shipping: 0,
-   shipping: 10000,
    subtotal: 70350,
+   total: 63315
-   total: 73315
  }

LULUS  diskon maksimal Rp20.000 dan ongkir gratis
LULUS  ONGKIRFREE
LULUS  semua angka bilangan bulat
LULUS  input salah jadi 400
```

Hasil: belum lulus, pelajarannya dicatat

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

Penjelasan joko: Akar masalahnya: tabel cuma punya `UNIQUE (court_id, start_at)` yang hanya menolak duplikasi jam mulai persis, tanpa constraint tumpang tindih jam, validasi `end_at > start_at`, validasi format waktu, atau pengecekan status. Yang aku ubah: tambah CHECK untuk rentang waktu, format `YYYY-MM-DD HH:MM`, dan enum status; index komposit `court_id, start_at, status`; serta 3 trigger (BEFORE INSERT/UPDATE) yang menegakkan larangan overlap jam 'aktif' (termasuk saat update jam atau mengaktifkan kembali booking batal), dengan penempel 10:00-11:00 dan 11:00-12:00 tetap diizinkan.
```
GAGAL  schema jalan dua kali, lapangan gak dobel: near "OR": syntax error
GAGAL  booking pertama masuk: UNIQUE constraint failed: bookings.court_id, bookings.start_at
GAGAL  tumpang tindih sebagian ditolak: Missing expected exception: 10:30-11:30
GAGAL  yang ngebungkus ditolak: Missing expected exception: 09:00-12:00
GAGAL  yang di dalam ditolak: Missing expected exception: 10:15-10:45
GAGAL  yang nempel boleh: UNIQUE constraint failed: bookings.court_id, bookings.start_at
LULUS  lapangan lain boleh di jam yang sama
LULUS  jam selesai sebelum mulai ditolak
LULUS  status ngaco ditolak
LULUS  format waktu salah ditolak
GAGAL  yang batal gak ngeblok: UNIQUE constraint failed: bookings.court_id, bookings.start_at
GAGAL  ngaktifin lagi yang batal dan tabrakan ditolak: Missing expected exception: aktif lagi
GAGAL  ganti jam jadi tabrakan ditolak: Missing expected exception: geser jam
LULUS  ganti jam yang gak tabrakan boleh (dirinya sendiri gak dihitung)
LULUS  jadwal per hari pakai index
```

Percobaan 2: BELUM (file diubah: db/schema.sql)

Penjelasan joko: Akar masalah: UNIQUE (court_id, start_at) melarang baris dengan jam mulai sama meskipun status 'batal' (jadi batal ngeblok) dan melarang booking baru yang nempel di jam yang sama karena baris 'aktif' yang sudah ada sudah mengisi jam itu. Saya menghapus constraint UNIQUE tersebut dan memperbaiki trigger UPDATE: operator AND/OR diparenthesasi agar pengecekan overlap baru jalan saat status berubah jadi aktif atau jam bergeser, dengan id != NEW.id supaya dirinya sendiri tak dihitung.
```
GAGAL  schema jalan dua kali, lapangan gak dobel: near "OR": syntax error
LULUS  booking pertama masuk
GAGAL  tumpang tindih sebagian ditolak: Missing expected exception: 10:30-11:30
GAGAL  yang ngebungkus ditolak: Missing expected exception: 09:00-12:00
GAGAL  yang di dalam ditolak: Missing expected exception: 10:15-10:45
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

Penjelasan joko: Akar masalahnya: trigger `bookings_no_overlap_update` punya kondisi `WHEN OLD.status != NEW.status` yang berarti hanya menyala saat status berubah, tapi saat status aktif→aktif (geser jam) kondisinya false sehingga overlap terlewat; saat batal→aktif trigger lain yang ada juga gak ngecek overlap. Saya pisah jadi tiga trigger terpisah: satu untuk insert, satu khusus batal→aktif, dan satu khusus geser jam aktif→aktif, masing-masing mengecek overlap. Juga ubah `LIKE` jadi `GLOB` di trigger format agar konsisten dengan CHECK.
```
GAGAL  schema jalan dua kali, lapangan gak dobel: near "OR": syntax error
LULUS  booking pertama masuk
GAGAL  tumpang tindih sebagian ditolak: Missing expected exception: 10:30-11:30
GAGAL  yang ngebungkus ditolak: Missing expected exception: 09:00-12:00
GAGAL  yang di dalam ditolak: Missing expected exception: 10:15-10:45
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

Hasil: belum lulus, pelajarannya dicatat

## Lvl 6 · Antrean kirim pesan: dobel kirim, retry tanpa ujung, status nyangkut (bayu)

Folder: latihan/lvl6-error-antrean-kirim-pesan

Sebelum dibenerin:
```
LULUS  POST job baru jadi 201 queued
LULUS  job tanpa tujuan jadi 400
GAGAL  semua job selesai (gak ada yang nyangkut): job 8: queued
GAGAL  tiap pesan sukses dikirim tepat sekali: job 1 terkirim 2x

2 !== 1

GAGAL  nomor normal: sent, attempts 1: job 1

0 !== 1

GAGAL  nomor kadang gagal: sent di percobaan ke-2: Expected values to be strictly equal:

1 !== 2

GAGAL  nomor mati: failed setelah 3 percobaan, error kesimpan, gak pernah terkirim: Expected values to be strictly equal:

'queued' !== 'failed'

GAGAL  stats sesuai: Expected values to be strictly deep-equal:
+ actual - expected

+ [
+   {
+     n: 1,
+     status: 'queued'
+   },
+   {
+     n: 7,
+     status: 'sent'
+   }
+ ]
- {
-   failed: 1,
-   queued: 0,
-   sending: 0,
-   sent: 7
- }

LULUS  job yang gak ada jadi 404
```

Percobaan 1: BELUM (file diubah: server.js)

Penjelasan bayu: Akar masalahnya ada 3: (1) race condition — beberapa tick interval berjalan paralel, mengambil & mengirim job yang sama berulang kali (pesanduplikat, attempts ngaco); (2) gagal kirim tidak pernah mengubah status ke "failed", jadi attempts cuma ditambah tanpa batas maksimal 3 & nomor tak aktif terus dicoba; (3) /api/stats mengembalikan array mentah bukan objek {queued, sending, sent, failed}. Perubahan: worker kini mengambil semua job queued sekaligus, mengunci statusnya jadi 'sending' di satu transaction (sehingga tick lain melewatinya), mengirim serial, membatasi total 3 attempts lalu set fai
```
LULUS  POST job baru jadi 201 queued
LULUS  job tanpa tujuan jadi 400
GAGAL  semua job selesai (gak ada yang nyangkut): job 7: sending
GAGAL  tiap pesan sukses dikirim tepat sekali: job 7 terkirim 0x

0 !== 1

LULUS  nomor normal: sent, attempts 1
GAGAL  nomor kadang gagal: sent di percobaan ke-2: Expected values to be strictly equal:

'sending' !== 'sent'

GAGAL  nomor mati: failed setelah 3 percobaan, error kesimpan, gak pernah terkirim: Expected values to be strictly equal:
+ actual - expected

+ 'sending'
- 'failed'

GAGAL  stats sesuai: Expected values to be strictly deep-equal:
+ actual - expected

  {
+   sending: 2,
+   sent: 6
-   failed: 1,
-   queued: 0,
-   sending: 0,
-   sent: 7
  }

LULUS  job yang gak ada jadi 404
```

Percobaan 2: BELUM (file diubah: server.js)

Penjelasan bayu: Akar masalah: logic update status di loop `tick()` salah (SQL `AND attempts + 1 >= 3` serta update terpisah tanpa lock yang benar) menyebabkan job gagal tetap 'sending', attempts tidak terhitung, dan job sukses tidak tercatat 'sent'. Yang diubah: kunci job dengan atomic `WHERE status = 'queued'`, perbarui attempts secara terpusat per loop (`newAttempts = job.attempts + 1`), lalu tandai 'failed' hanya pada percobaan ke-3 dengan error, sedangkan pengiriman sukses langsung di-set 'sent'.
```
LULUS  POST job baru jadi 201 queued
LULUS  job tanpa tujuan jadi 400
GAGAL  semua job selesai (gak ada yang nyangkut): job 7: sending
GAGAL  tiap pesan sukses dikirim tepat sekali: job 7 terkirim 0x

0 !== 1

LULUS  nomor normal: sent, attempts 1
GAGAL  nomor kadang gagal: sent di percobaan ke-2: Expected values to be strictly equal:

'sending' !== 'sent'

GAGAL  nomor mati: failed setelah 3 percobaan, error kesimpan, gak pernah terkirim: Expected values to be strictly equal:
+ actual - expected

+ 'sending'
- 'failed'

GAGAL  stats sesuai: Expected values to be strictly deep-equal:
+ actual - expected

  {
+   sending: 2,
+   sent: 6
-   failed: 1,
-   queued: 0,
-   sending: 0,
-   sent: 7
  }

LULUS  job yang gak ada jadi 404
```

Percobaan 3: BELUM (file diubah: server.js)

Penjelasan bayu: **Akar masalah:** `db.prepare(...).run(...ids)` yang dipanggil tanpa `await` di dalam `async function tick()` menyebabkan operasi SQL berjalan asinkronus setelah fungsi selesai (setelah `setInterval` memicu tick berikutnya), sehingga status job terupdate dengan keterlambatan yang acak → job "nyangkut" sending, attempts meledak, dan stats tidak sinkron.

**Yang diubah:** Menambahkan `await` pada setiap pemanggilan `db.prepare(...).run(...)` dan `.all(...)` di dalam loop tick agar status dan attempts terupdate sinkron sebelum tick berikutnya berjalan.
```
LULUS  POST job baru jadi 201 queued
LULUS  job tanpa tujuan jadi 400
GAGAL  semua job selesai (gak ada yang nyangkut): job 7: sending
GAGAL  tiap pesan sukses dikirim tepat sekali: job 7 terkirim 0x

0 !== 1

LULUS  nomor normal: sent, attempts 1
GAGAL  nomor kadang gagal: sent di percobaan ke-2: Expected values to be strictly equal:

'sending' !== 'sent'

GAGAL  nomor mati: failed setelah 3 percobaan, error kesimpan, gak pernah terkirim: Expected values to be strictly equal:
+ actual - expected

+ 'sending'
- 'failed'

GAGAL  stats sesuai: Expected values to be strictly deep-equal:
+ actual - expected

  {
+   sending: 2,
+   sent: 6
-   failed: 1,
-   queued: 0,
-   sending: 0,
-   sent: 7
  }

LULUS  job yang gak ada jadi 404
```

Hasil: belum lulus, pelajarannya dicatat

## Ringkasan

| Latihan | Agent | Hasil | Percobaan |
|---|---|---|---|
| Lvl 2 · Email pelanggan dobel dan riwayat pesanan lambat | joko | belum | 2 |
| Lvl 2 · Tombol tandai selesai gak jalan (bug di 2 file) | bayu | belum | 2 |
| Lvl 3 · Halaman produk loncat dan total salah | fajar | belum | 2 |
| Lvl 3 · Server mati total kena input aneh | bayu | lulus | 1 |
| Lvl 4 · Migrasi tabel pelanggan tanpa ngilangin data | joko | belum | 3 |
| Lvl 4 · Satu jadwal kebooking dobel kalau dipesan barengan | bayu | belum | 3 |
| Lvl 5 · Rekap omzet bulanan meleset | fajar | belum | 3 |
| Lvl 5 · Total belanja di checkout ngaco | bayu | belum | 3 |
| Lvl 6 · Jadwal lapangan bisa tabrakan | joko | belum | 3 |
| Lvl 6 · Antrean kirim pesan: dobel kirim, retry tanpa ujung, status nyangkut | bayu | belum | 3 |
