# Laporan latihan IT

29/10/2026, 18.20.47

## Skema toko gagal dijalankan dan datanya bisa ngaco (joko)

Folder: latihan/database-01-skema-rusak

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

Penjelasan joko: Akar masalah: syntax error karena koma hilang setelah `name TEXT`, foreign key nyasar ke tabel `product` yang belum ada, dan harga memakai REAL. Yang saya ubah: tambah IF NOT EXISTS biar aman jalankan berulang-ulang, ubah price jadi INTEGER rupiah, tambahkan CHECK (price >= 0), qty >= 1, dan NOT NULL pada name; perbaiki referensinya ke `products(id)` serta gunakan INSERT OR IGNORE supaya data contoh tidak ganda.
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

Folder: latihan/database-02-laporan-omzet-salah

Sebelum dibenerin:
```
GAGAL  omzet cuma dari pesanan lunas, gak dobel: Expected values to be strictly equal:

75000 !== 45000

GAGAL  jumlah pesanan lunas 2: Expected values to be strictly equal:

3 !== 2
```

Percobaan 1: LULUS (file diubah: server.js)

Penjelasan fajar: Akar masalahnya: JOIN ke tabel `order_items` menyebabkan duplikasi baris (order #1 punya 2 item, order #2 punya 1, tapi hasil SUM jadi 75000 karena perhitungan ganda). Yang diubah: ganti JOIN `order_items` jadi hanya JOIN `payments`, dan pakai `COUNT(DISTINCT o.id)` biar hanya pesanan yang punya tercatat pembayaran yang dihitung.
```
LULUS  omzet cuma dari pesanan lunas, gak dobel
LULUS  jumlah pesanan lunas 2
```

Hasil: lulus di percobaan pertama

## Pencarian produk error kalau ada tanda kutip (fajar)

Folder: latihan/database-03-pencarian-error-tanda-kutip

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

Penjelasan fajar: Masalahnya: query menggunakan string interpolation (`${q}`) langsung masuk ke SQL, jadi kutip ganda/tanda baca di "Jum'at" merusak sintaks. Solusinya query diubah jadi prepared statement dengan parameter `?`, dan nilai pencarian dikirim sebagai binding (bukan disisipkan), jadi teks apa pun aman dan hasil tetap akurat.
```
LULUS  cari "Jum'at" ketemu 1
LULUS  cari "roti" ketemu 2
LULUS  teks dengan tanda kutip lain gak bikin error
LULUS  tanpa q balikin semua
```

Hasil: lulus di percobaan pertama

## Server langsung mati pas dinyalain (bayu)

Folder: latihan/error-01-server-gak-mau-nyala

Sebelum dibenerin:
```
file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:19
      if (child.exitCode !== null) throw new Error(`Server mati waktu start:\n${output.slice(-1500)}`);
                                         ^

Error: Server mati waktu start:
file:///C:/Users/Gerrad/Documents/kantor-ai/training/hasil/error-01-server-gak-mau-nyala/server.js:1
const { createServer } = require('node:http');
                         ^

ReferenceError: require is not defined in ES module scope, you can use import instead
This file is being treated as an ES module because it has a '.js' file extension and '\\?\C:\Users\Gerrad\Documents\kantor-ai\training\hasil\error-01-server-gak-mau-nyala\package.json' contains "type": "module". To treat it as a CommonJS script, rename it to use the '.cjs' file extension.
    at file:///C:/Users/Gerrad/Documents/kantor-ai/training/hasil/error-01-server-gak-mau-nyala/server.js:1:26
    at ModuleJob.run (node:internal/modules/esm/module_job:569:25)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:105:5)

Node.js v26.12.1

    at withServer (file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:19:42)
    at async file:///C:/Users/Gerrad/Documents/kantor-ai/training/latihan/error-01-server-gak-mau-nyala/check.js:4:1

Node.js v26.12.1
```

Percobaan 1: LULUS (file diubah: server.js)

Penjelasan bayu: Akar masalah: `package.json` punya `"type": "module"` jadi Node menjalankan `server.js` sebagai ES module yang gak support `require()`. Ubah `require('node:http')` jadi `import { createServer } from 'node:http';`. Fitur lain (endpoint /api/health, /api/notes, 404, dan log) gak disentuh.
```
LULUS  server nyala dan /api/health ok
LULUS  /api/notes masih jalan
```

Hasil: lulus di percobaan pertama

## Simpan catatan selalu ditolak (bayu)

Folder: latihan/error-02-simpan-catatan-selalu-gagal

Sebelum dibenerin:
```
GAGAL  POST dengan judul jadi 201: Expected values to be strictly equal:

400 !== 201

LULUS  POST tanpa judul tetap 400
GAGAL  catatan baru muncul di daftar: The expression evaluated to a falsy value:

  assert.ok(body.some((n) => n.title === 'Bayar listrik'))
```

Percobaan 1: LULUS (file diubah: server.js)

Penjelasan bayu: Akar masalahnya: handler POST memanggil `readJson(req)` tapi tidak `await`, jadi `body` yang diperiksa adalah sebuah promise yang tak pernah kosong — kondisi `!body.title` tak pernah benar, sehingga pengecekan judul terlewat. Saya menambahkan `await` pada pemanggilan `readJson(req)` agar badan request terurai sebelum validasi dijalankan.
```
LULUS  POST dengan judul jadi 201
LULUS  POST tanpa judul tetap 400
LULUS  catatan baru muncul di daftar
```

Hasil: lulus di percobaan pertama

## Server gak bisa diakses dan detail catatan ngaco (bayu)

Folder: latihan/error-03-port-dan-detail-catatan

Sebelum dibenerin:
```
file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:24
        if (Date.now() > end) throw new Error(`Server gak bisa diakses di port ${port} (process.env.PORT dipakai?):\n${output.slice(-1500)}`);
                                    ^

Error: Server gak bisa diakses di port 4905 (process.env.PORT dipakai?):
Server jalan di port 3000

    at withServer (file:///C:/Users/Gerrad/Documents/kantor-ai/training/lib.js:24:37)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async file:///C:/Users/Gerrad/Documents/kantor-ai/training/latihan/error-03-port-dan-detail-catatan/check.js:4:1

Node.js v26.12.1
```

Percobaan 1: LULUS (file diubah: server.js)

Penjelasan bayu: Akar masalah: port hardcode di 3000 (harusnya ambil dari `process.env.PORT`), dan pencocokan ID pakai string (`match[1]`) vs array yang isinya `number` — sehingga ID 1 tidak pernah cocok. Ditambah, catatan tidak ada tetap mengembalikan 200. Perbaikan: port diambil dari env, regex disempitkan ke angka, pencarian memakai `Number()`, dan catatan yang tidak ditemukan dikembalikan 404.
```
LULUS  detail catatan 1
LULUS  catatan yang gak ada jadi 404
LULUS  id bukan angka jadi 404 atau 400, bukan crash
```

Hasil: lulus di percobaan pertama

## Halaman daftar tugas selalu kosong (bayu)

Folder: latihan/error-04-daftar-tugas-kosong

Sebelum dibenerin:
```
GAGAL  GET /api/todos sesuai kontrak: Expected values to be strictly equal:

404 !== 200

LULUS  halaman utama tetap tersaji
```

Percobaan 1: LULUS (file diubah: server.js)

Penjelasan bayu: Akar masalahnya: backend melayani `/api/todo` (satu kata) sedangkan frontend meminta `/api/todos` (jamak), sehingga fetch mendapat 404 dan list kosong. Saya juga menyamakan nama field di data (`name` → `title`, `isDone` → `done`) agar sesuai kontrak dan penampilannya.
```
LULUS  GET /api/todos sesuai kontrak
LULUS  halaman utama tetap tersaji
```

Hasil: lulus di percobaan pertama

## Ringkasan

| Latihan | Agent | Hasil | Percobaan |
|---|---|---|---|
| Skema toko gagal dijalankan dan datanya bisa ngaco | joko | lulus | 1 |
| Angka omzet di laporan kegedean | fajar | lulus | 1 |
| Pencarian produk error kalau ada tanda kutip | fajar | lulus | 1 |
| Server langsung mati pas dinyalain | bayu | lulus | 1 |
| Simpan catatan selalu ditolak | bayu | lulus | 1 |
| Server gak bisa diakses dan detail catatan ngaco | bayu | lulus | 1 |
| Halaman daftar tugas selalu kosong | bayu | lulus | 1 |
