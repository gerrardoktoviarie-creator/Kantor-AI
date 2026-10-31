# Laporan latihan IT

29/10/2026, 19.16.27

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

Penjelasan joko: Akar masalahnya: email tidak unik secara kasus-insensitive, status tidak divalidasi CHECK, dan query riwayat tidak punya index komposit (user_id, created_at DESC). Saya tambahkan `UNIQUE COLLATE NOCASE` pada email, `CHECK (status IN (...))` pada status, serta index komposit yang urutan kolomnya mengikuti pola `WHERE user_id = ? ORDER BY created_at DESC` agar SQLite tidak perlu melakukan sort tambahan.
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

Percobaan 1: BELUM (file diubah: server.js, lib/store.js)

Penjelasan bayu: Akar masalahnya ada dua: server hanya menangani method PATCH, sehingga PUT ditolak 404; dan karena `const match` di-reassign saat update, muncul `TypeError: Assignment to constant variable`. Saya menambahkan handler PUT, memisahkan logika penegasan tipe id, validasi field `title`/`done` menjadi 400, mengabaikan field lain, dan menandakan catatan tak ada sebagai 404.
```
LULUS  PUT done:true jadi 200 dan ke-update
GAGAL  perubahan kesimpan di daftar: Expected values to be strictly equal:

false !== true

LULUS  id di body diabaikan
LULUS  ganti judul boleh
LULUS  done bukan boolean jadi 400
LULUS  judul kosong jadi 400
LULUS  catatan yang gak ada jadi 404
```

Percobaan 2: LULUS (file diubah: lib/store.js, server.js)

Penjelasan bayu: Akar masalahnya: `updateNote` hanya mengembalikan objek hasil update, tapi tidak memodifikasi data di dalam array `notes` yang dibaca `listNotes()`, jadi perubahan tidak tersimpan. Solusinya, tambahkan `Object.assign(note, updated)` di `updateNote` agar state di dalam array terupdate, lalu `listNotes()` tetap mengembalikan array yang sama sehingga catatan yang ter-update ikut berubah saat di-GET.
```
LULUS  PUT done:true jadi 200 dan ke-update
LULUS  perubahan kesimpan di daftar
LULUS  id di body diabaikan
LULUS  ganti judul boleh
LULUS  done bukan boolean jadi 400
LULUS  judul kosong jadi 400
LULUS  catatan yang gak ada jadi 404
```

Hasil: lulus di percobaan 2, pelajarannya dicatat

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

Penjelasan fajar: Akar masalah: query asal meng-`LIMIT`/`OFFSET` sebelum `COUNT`, jadi `total` dihitung dari halaman (bukan semua hasil) dan `LIMIT` ter-suntik lewat string, membuat `?limit=abc` error 500 serta `OFFSET` salah hitung. Gue ganti pagination jadi dua query terparameterisasi (COUNT(*) untuk total, SELECT+LIMIT/OFFSET untuk items), validasi page/limit jadi integer positif (400 kalau salah), limit dibatasi max 50, urutan naik per harga, dan halaman beyond terakhir kasih items kosong plus pages yang benar.
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

Penjelasan joko: Akar masalahnya: skema lama tidak menampung data dengan benar (phone INTEGER menghilangkan leading zero, fullname boleh NULL dan tidak ditrim), sementara ALTER TABLE RENAME COLUMN tidak mendukung perubahan tipe/konstraint secara aman dan akan merusak relasi foreign key. Solusinya membuat tabel baru dengan skema final, menyalin data yang sudah dirapikan (TRIM, prefix '0', format leading zero), lalu mengganti tabel lama dengan aman sesuai SOP 12 langkah tanpa kehilangan data.
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

Percobaan 1: LULUS (file diubah: server.js)

Penjelasan bayu: Akar masalahnya: race condition karena pengecekan slot (SELECT) dan pembuatan booking (INSERT) terpisah oleh await verifyPayment yang lambat — beberapa request bisa lolos pengecekan sekaligus. Yang diubah: tambahkan UNIQUE(court, slot) pada tabel, lakukan INSERT dulu (menegakkan aturan 1 booking per court+slot), tangkap duplikat sebagai 409, dan jika pembayaran gagal hapus booking (DELETE) agar slot kembali tersedia.
```
LULUS  booking biasa jadi 201
LULUS  slot yang udah kepakai jadi 409
LULUS  5 orang pesan barengan: cuma 1 yang dapet
LULUS  pembayaran gagal jadi 402 dan slotnya bisa dipesan lagi
LULUS  yang bayar gagal barengan sama yang sukses: yang sukses tetap dapet
LULUS  input kosong jadi 400
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

Percobaan 1: BELUM (file diubah: server.js)

Penjelasan fajar: Akar masalahnya: query asli mengambil bulan langsung dari `paid_at` UTC tanpa dikonversi ke WIB, tidak memfilter status 'batal', tidak menyertakan bulan tanpa transaksi, dan tidak ada validasi parameter `year`. Saya sudah memperbaiki semuanya: waktu di-geser ke WIB (`datetime(paid_at, '+7 hours')`), hanya pesanan 'lunas' yang dihitung, hasilnya selalu 12 bulan (Jan-Des) dengan total/orders 0 untuk bulan kosong, dan `year` divalidasi format 4 digit plus rentang wajar.
```
GAGAL  2026: WIB, tanpa yang batal, 12 bulan lengkap: Expected values to be strictly deep-equal:
+ actual - expected

  [
    {
+     month: '',
+     orders: 0,
+     total: 0
-     month: '2026-01',
-     orders: 2,
-     total: 55000
    },
    {
+     month: '',
+     orders: 0,
+     total: 0
-     month: '2026-02',
-     orders: 2,
-     total: 65000
    },
    {
+     month: '',
+     orders: 0,
+     total: 0
-     month: '2026-03',
-     orders: 1,
-     total: 15000
    },
    {
+     month: '',
-     month: '2026-04',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2026-05',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2026-06',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2026-07',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2026-08',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2026-09',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2026-10',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2026-11',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2026-12',
      orders: 0,
      total: 0
    }
  ]

GAGAL  2025: pesanan 31 Des jam 20.00 UTC pindah ke 2026: Expected values to be strictly deep-equal:
+ actual - expected

  [
    {
+     month: '',
+     orders: 0,
+     total: 0
-     month: '2025-01',
-     orders: 1,
-     total: 50000
    },
    {
+     month: '',
-     month: '2025-02',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2025-03',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2025-04',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2025-05',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2025-06',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2025-07',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2025-08',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2025-09',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2025-10',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2025-11',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2025-12',
      orders: 0,
      total: 0
    }
  ]

GAGAL  2027: pesanan 31 Des 2026 jam 17.30 UTC masuk Januari 2027: Expected values to be strictly deep-equal:
+ actual - expected

  [
    {
+     month: '',
+     orders: 0,
+     total: 0
-     month: '2027-01',
-     orders: 1,
-     total: 40000
    },
    {
+     month: '',
-     month: '2027-02',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2027-03',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2027-04',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2027-05',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2027-06',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2027-07',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2027-08',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2027-09',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2027-10',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2027-11',
      orders: 0,
      total: 0
    },
    {
+     month: '',
-     month: '2027-12',
      orders: 0,
      total: 0
    }
  ]

LULUS  year salah atau kosong jadi 400
```

Percobaan 2: BELUM (file diubah: server.js)

Penjelasan fajar: Akar masalah: `monthIndex()` menghitung index dari string `"2026-01"` (slice 5) yang belum dipisahkan, jadi hasilnya NaN dan semua baris tetap `{ month: '' }`. Yang diubah: hasil `strftime` dipotong jadi bulan saja (`row.month.slice(5)`), fungsi `monthIndex()` sekarang menerima tahun + bulan terpisah serta menolak bulan di luar 1-12, dan array 12 bulan di-inisialisasi dengan `month: "${year}-${mm}"` langsung jadi string ISO lengkap.
```
GAGAL  2026: WIB, tanpa yang batal, 12 bulan lengkap: Cannot destructure property 'month' of 'object null' as it is null.
GAGAL  2025: pesanan 31 Des jam 20.00 UTC pindah ke 2026: Cannot destructure property 'month' of 'object null' as it is null.
GAGAL  2027: pesanan 31 Des 2026 jam 17.30 UTC masuk Januari 2027: Cannot destructure property 'month' of 'object null' as it is null.
LULUS  year salah atau kosong jadi 400
```

Percobaan 3: BELUM (file diubah: server.js)

Penjelasan fajar: Akar masalah: query awal pakai `COALESCE(SUM(total), 0)` padahal SUM tanpa baris yang lolos filter (misal tahun 2027 yang hanya punya transaksi 'batal' di Desember) menghasilkan `null`, lalu code mencoba `row.total` dari baris yang null — tapi sebenarnya error `Cannot destructure property 'month' of 'object null'` terjadi karena SQLite dengan `+7 hours` di `WHERE` pada tahun tanpa hasil sama sekali (2027) mengembalikan baris pertama yang null. Solusinya: hilangkan COALESCE (karena GROUP BY menjamin baris ada), dan koreksi logika agar setiap bulan di hasil tetap punya total/orders.
```
GAGAL  2026: WIB, tanpa yang batal, 12 bulan lengkap: Cannot destructure property 'month' of 'object null' as it is null.
GAGAL  2025: pesanan 31 Des jam 20.00 UTC pindah ke 2026: Cannot destructure property 'month' of 'object null' as it is null.
GAGAL  2027: pesanan 31 Des 2026 jam 17.30 UTC masuk Januari 2027: Cannot destructure property 'month' of 'object null' as it is null.
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

Penjelasan bayu: Akar masalah: (1) promo `HEMAT10` pakai `>` alih-alih `>=`, dan perbandingan case-sensitif (`code === 'HEMAT10'`) sehingga kode huruf kecil tidak terbaca; (2) ongkir gratis salah dihitung dari subtotal kotor, bukan subtotal setelah diskon; (3) qty tidak divalidasi (boleh teks atau angka di luar 1-99); (4) produk tidak dikenali lempar error 500 ke client; (5) error parsing JSON sembarangan. Perubahan: validasi ketat di frontend (qty 1-99, produk & promo dikenali), diskon max Rp20.000, diskon hanya mulai subtotal ≥ Rp50.000 (50.000 pas berlaku), dan gratis ongkir berlaku bila `(subtotal - discou
```
file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:19
      if (child.exitCode !== null) throw new Error(`Server mati waktu start:\n${output.slice(-1500)}`);
                                         ^

Error: Server mati waktu start:
file:///C:/Users/Gerrad/Documents/kantor-ai/training/hasil/lvl5-error-total-belanja-ngaco/server.js:2
import { PRODUCTS, quote } from './lib/pricing.js';
         ^^^^^^^^
SyntaxError: The requested module './lib/pricing.js' does not provide an export named 'PRODUCTS'
    at #asyncInstantiate (node:internal/modules/esm/module_job:463:21)
    at async ModuleJob.run (node:internal/modules/esm/module_job:561:5)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:105:5)

Node.js v26.12.1

    at withServer (file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:19:42)
    at async file:///C:/Users/Gerrad/Documents/kantor-ai/training/latihan/lvl5-error-total-belanja-ngaco/check.js:14:1

Node.js v26.12.1
```

Percobaan 2: BELUM (file diubah: lib/pricing.js, server.js)

Penjelasan bayu: Akar masalahnya ada di `lib/pricing.js`: tidak ada `export PRODUCTS` dan tidak ada data produk sama sekali, jadi server.js error karena gagal mengimpor `PRODUCTS`. Saya menambahkan konstanta `PRODUCTS` beserta `export`-nya dan menghapus pengecekan duplikat produk di server.js karena validasi produk sudah ada di `quote()`.
```
GAGAL  tanpa promo: Expected values to be strictly deep-equal:
+ actual - expected

  {
    discount: 0,
    shipping: 10000,
+   subtotal: 50000,
+   total: 60000
-   subtotal: 30000,
-   total: 40000
  }

GAGAL  HEMAT10 huruf kecil tetap berlaku: Expected values to be strictly deep-equal:
+ actual - expected

  {
+   discount: 7500,
-   discount: 8500,
    shipping: 10000,
+   subtotal: 75000,
+   total: 77500
-   subtotal: 85000,
-   total: 86500
  }

GAGAL  HEMAT10 pas Rp50.000 udah boleh: {"error":"Produk tidak ditemukan: 4"}

400 !== 200

GAGAL  HEMAT10 di bawah minimal: diskon 0: Expected values to be strictly deep-equal:
+ actual - expected

  {
+   discount: 20000,
+   shipping: 0,
+   subtotal: 300000,
+   total: 280000
-   discount: 0,
-   shipping: 10000,
-   subtotal: 36000,
-   total: 46000
  }

LULUS  ongkir dihitung dari subtotal setelah diskon
GAGAL  diskon dibulatkan ke bawah: {"error":"Produk tidak ditemukan: 5"}

400 !== 200

GAGAL  diskon maksimal Rp20.000 dan ongkir gratis: Expected values to be strictly deep-equal:
+ actual - expected

  {
    discount: 20000,
    shipping: 0,
+   subtotal: 225000,
+   total: 205000
-   subtotal: 255000,
-   total: 235000
  }

GAGAL  ONGKIRFREE: Expected values to be strictly deep-equal:
+ actual - expected

  {
    discount: 0,
    shipping: 0,
+   subtotal: 25000,
+   total: 25000
-   subtotal: 15000,
-   total: 15000
  }

GAGAL  semua angka bilangan bulat: subtotal = undefined
LULUS  input salah jadi 400
```

Percobaan 3: BELUM (file diubah: lib/pricing.js, server.js)

Penjelasan bayu: Akar masalah: duplikasi validasi kode promo (di server.js dulu, lalu di lib/pricing.js), dan pengecekan produk dijalankan sebelum normalisasi kode — jadi promo yang belum valid malah memicu error "Produk tidak ditemukan". Yang saya ubah: hilangkan validasi kode promo di server.js dan biarkan lib/pricing.js jadi satu-satunya otoritas, plus urutkan validasi kode sebelum pengecekan produk.
```
GAGAL  tanpa promo: Expected values to be strictly deep-equal:
+ actual - expected

  {
    discount: 0,
    shipping: 10000,
+   subtotal: 50000,
+   total: 60000
-   subtotal: 30000,
-   total: 40000
  }

GAGAL  HEMAT10 huruf kecil tetap berlaku: Expected values to be strictly deep-equal:
+ actual - expected

  {
+   discount: 7500,
-   discount: 8500,
    shipping: 10000,
+   subtotal: 75000,
+   total: 77500
-   subtotal: 85000,
-   total: 86500
  }

GAGAL  HEMAT10 pas Rp50.000 udah boleh: {"error":"Produk tidak ditemukan: 4"}

400 !== 200

GAGAL  HEMAT10 di bawah minimal: diskon 0: Expected values to be strictly deep-equal:
+ actual - expected

  {
+   discount: 20000,
+   shipping: 0,
+   subtotal: 300000,
+   total: 280000
-   discount: 0,
-   shipping: 10000,
-   subtotal: 36000,
-   total: 46000
  }

LULUS  ongkir dihitung dari subtotal setelah diskon
GAGAL  diskon dibulatkan ke bawah: {"error":"Produk tidak ditemukan: 5"}

400 !== 200

GAGAL  diskon maksimal Rp20.000 dan ongkir gratis: Expected values to be strictly deep-equal:
+ actual - expected

  {
    discount: 20000,
    shipping: 0,
+   subtotal: 225000,
+   total: 205000
-   subtotal: 255000,
-   total: 235000
  }

GAGAL  ONGKIRFREE: Expected values to be strictly deep-equal:
+ actual - expected

  {
    discount: 0,
    shipping: 0,
+   subtotal: 25000,
+   total: 25000
-   subtotal: 15000,
-   total: 15000
  }

GAGAL  semua angka bilangan bulat: subtotal = undefined
GAGAL  input salah jadi 400: [{"id":1,"qty":1}] NGASAL dapet 200

200 !== 400
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

Percobaan 1: BELUM (file diubah: db/schema.sql, db/schema.sql)

Penjelasan joko: Akar masalahnya: skema lama cuma punya `UNIQUE (court_id, start_at)` yang hanya mencegah jam mulai sama persis, dan tidak ada validasi overlap, validasi end_at > start_at, atau filter status 'batal' yang diabaikan. Saya menambahkan CHECK untuk memastikan start_at lebih besar dari end_at, membatasi status dengan CHECK IN, serta dua trigger BEFORE INSERT/BEFORE UPDATE yang menolak booking 'aktif' jika tumpang tindih dengan booking 'aktif' lain (metode overlap: start_baru < end_lama AND end_baru > start_lama), mengizinkan booking yang hanya menempel, dan mengesampingkan baris itu sendiri lewat `i
```
GAGAL  schema jalan dua kali, lapangan gak dobel: near "IS": syntax error
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

Penjelasan joko: Akar masalahnya ada dua: pertama, syntax `CHECK (start_at > end_at) IS NOT TRUE` tidak didukung SQLite — harus ditulis `CHECK (start_at <= end_at)`. Kedua, trigger overlap pada INSERT mengesampingkan `id != NEW.id` padahal row baru belum punya id, jadi satu-satunya cara mengizinkan booking yang tumpang tindih adalah menghapusnya; trigger UPDATE (yang sudah benar mengecualikan id lama) tetap ada untuk menjaga aturan saat diupdate.
```
GAGAL  schema jalan dua kali, lapangan gak dobel: near "IS": syntax error
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

Penjelasan joko: Akar masalahnya: sintaks `CHECK (start_at > end_at) IS NOT TRUE` bukan standar SQL dan ditolak SQLite, lalu tabel `bookings` tidak dibuat sama sekali sehingga semua tes booking gagal, bukan karena logika trigger melainkan karena tabel belum ada. Saya menghapus CHECK yang invalid, memperjelas logika overlap menjadi `NEW.start_at < end_at AND NEW.end_at > start_at` (interval beririsan iff start-baru < end-lama dan end-baru > start-lama), menambahkan `id != NEW.id` pada trigger UPDATE supaya booking yang sedang diedit tidak dibandingkan dengan dirinya sendiri, dan menghapus `updated_at` menjadi `
```
LULUS  schema jalan dua kali, lapangan gak dobel
LULUS  booking pertama masuk
LULUS  tumpang tindih sebagian ditolak
LULUS  yang ngebungkus ditolak
LULUS  yang di dalam ditolak
LULUS  yang nempel boleh
LULUS  lapangan lain boleh di jam yang sama
GAGAL  jam selesai sebelum mulai ditolak: Missing expected exception: end < start
LULUS  status ngaco ditolak
GAGAL  format waktu salah ditolak: Missing expected exception: pakai T
LULUS  yang batal gak ngeblok
LULUS  ngaktifin lagi yang batal dan tabrakan ditolak
LULUS  ganti jam jadi tabrakan ditolak
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

Penjelasan bayu: Akar masalahnya adalah race condition: `tick()` membaca semua job `queued` sekaligus lalu tiap job di-`await` di tengah loop, jadi beberapa tick bisa mengambil job yang sama, dan `attempts` bertambah tanpa status berubah (tersangkut). Saya mengubahnya jadi kunci job secara atomik dengan `UPDATE ... WHERE status='queued' RETURNING *` sehingga tiap job hanya punya satu worker, lalu mengatur status ke `sent`/`queued`/`failed` sesuai hasil dan batas 3 percobaan, serta merapikan `/api/stats` agar return object `{ queued, sending, sent, failed }`.
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

Penjelasan bayu: Akar masalahnya ada 2: (1) `attempts` pada sukses dikunci di 1 (harus naik sesuai percobaan: `attempts = attempts + 1`), dan (2) update status setelah error hanya dicek `status = 'sending'` padahal status bisa sudah berubah jadi `queued` — sehingga job gagal tersisa di 'sending'. Saya tambah flag `running` agar tick tidak tumpang-tindih, dan merapikan logika update agar `attempts` selalu naik tiap percobaan dan status diupdate ke `queued`/`failed` berdasarkan nilai terbaru dari tabel.
```
LULUS  POST job baru jadi 201 queued
LULUS  job tanpa tujuan jadi 400
LULUS  semua job selesai (gak ada yang nyangkut)
LULUS  tiap pesan sukses dikirim tepat sekali
LULUS  nomor normal: sent, attempts 1
LULUS  nomor kadang gagal: sent di percobaan ke-2
LULUS  nomor mati: failed setelah 3 percobaan, error kesimpan, gak pernah terkirim
GAGAL  stats sesuai: Expected values to be strictly deep-equal:
+ actual - expected

  {
    failed: 1,
-   queued: 0,
-   sending: 0,
    sent: 7
  }

LULUS  job yang gak ada jadi 404
```

Percobaan 3: LULUS (file diubah: server.js, server.js)

Penjelasan bayu: Akar masalahnya: endpoint `/api/stats` hanya memasukkan status yang benar-benar ada di antrean, jadi kalau tidak ada job bertipe tertentu, status itu dihapus dan expected object (yang punya `queued: 0`, `sending: 0`, `failed: 0`) tidak cocok. Perubahannya cuma menginisialisasi object dengan keempat status (`queued`, `sending`, `sent`, `failed`) bernilai 0 sebelum digabung dengan hasil GROUP BY, sehingga setiap status selalu muncul walaupun jumlahnya 0.
</think>



Akar masalahnya: reducer pada `/api/stats` hanya memasukkan status yang benar-benar ada, sehingga status kosong dihapus dan expecte
```
LULUS  POST job baru jadi 201 queued
LULUS  job tanpa tujuan jadi 400
LULUS  semua job selesai (gak ada yang nyangkut)
LULUS  tiap pesan sukses dikirim tepat sekali
LULUS  nomor normal: sent, attempts 1
LULUS  nomor kadang gagal: sent di percobaan ke-2
LULUS  nomor mati: failed setelah 3 percobaan, error kesimpan, gak pernah terkirim
LULUS  stats sesuai
LULUS  job yang gak ada jadi 404
```

Hasil: lulus di percobaan 3, pelajarannya dicatat

## Ringkasan

| Latihan | Agent | Hasil | Percobaan |
|---|---|---|---|
| Lvl 2 · Email pelanggan dobel dan riwayat pesanan lambat | joko | lulus | 1 |
| Lvl 2 · Tombol tandai selesai gak jalan (bug di 2 file) | bayu | lulus | 2 |
| Lvl 3 · Halaman produk loncat dan total salah | fajar | lulus | 1 |
| Lvl 4 · Migrasi tabel pelanggan tanpa ngilangin data | joko | lulus | 1 |
| Lvl 4 · Satu jadwal kebooking dobel kalau dipesan barengan | bayu | lulus | 1 |
| Lvl 5 · Rekap omzet bulanan meleset | fajar | belum | 3 |
| Lvl 5 · Total belanja di checkout ngaco | bayu | belum | 3 |
| Lvl 6 · Jadwal lapangan bisa tabrakan | joko | belum | 3 |
| Lvl 6 · Antrean kirim pesan: dobel kirim, retry tanpa ujung, status nyangkut | bayu | lulus | 3 |
