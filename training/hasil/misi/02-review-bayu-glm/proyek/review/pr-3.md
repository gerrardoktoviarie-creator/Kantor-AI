Review: PR-3 Joko — kategori menu (db/migrations/003-kategori.sql, db/schema.sql, server.js)

## Temuan & perbaikan

### 1. Migrasi 003 gak pernah dipanggil (server.js) — Critical
- **Masalah:** server.js cuma punya cabang `user_version < 2`, jadi `003-kategori.sql` tidak pernah dijalankan. Dampak: GET /api/products 500 (field `category` belum ada), seluruh kasir blank, jualan/restok/batal mati.
- **Perbaikan:** tambahkan `else if (user_version < 3)` di server.js.

### 2. Migrasi 003 menimpa data user — Critical
- **Masalah:** `UPDATE products SET category = 'minuman' WHERE name != 'Roti Bakar Cokelat';` membatalkan kategori yang pernah diisi user, dan bukan idempoten. Dampak: data user hilang; Roti Bakar Cokelat malah jadi `minuman` (harusnya `makanan`).
- **Perbaikan:** hapus UPDATE generik; `Roti Bakar Cokelat` = `makanan`, sisanya ambil default kolom. Migrasi sekarang aman dijalankan berulang.

### 3. Restok ngaco (`body.find is not a function`) & 201 vs 409 — Correctness
- **Masalah:** response restock dikembalikan pakai `toProduct(db.prepare(...).get(...))` yang return object, bukan array — frontend memanggil `.find` padanya. Juga: jalur restok return 200 padahal kode 201 dipakai untuk create di `/api/sales`.
- **Status:** perlu dicek di frontend (app.js tidak punya logika restok saat ini; jika ada yang `.find`, itu bug frontend terpisah, belum dibenerin). Untuk konsistensi, response restock tetap object hasil `toProduct(...)` tapi tanpa `.find` di konsumen.

### 4. Jalur database (dicepak di kepala)
- **DB versi 1 (sebelum stok):** fresh install → schema.sql (user_version 3, `category` DEFAULT 'minuman') → Roti Bakar Cokelat = `makanan` → OK.
- **DB versi 2 (laptop kasir, berisi data asli):** fresh check → kondisi < 2 salah, < 3 benar → 003-kategori.sql jalan (tambah `category`, set Roti Bakar Cokelat = `makanan`, sisanya default) → user_version 3 → OK, data stok & penjualan lama utuh.
- **DB baru (fresh install):** schema.sql langsung user_version 3 → 4 produk, kategori benar → OK.
- **Restart server di DB versi 3:** fresh check salah, kedua elif salah, foreign_keys ON → OK, tidak ada duplikasi migrasi.

## Catatan
- `db/schema.sql` dan `003-kategori.sql` sudah disesuaikan (DEFAULT 'minuman', tanpa UPDATE generik).
- `server.js` tidak ubah query `ORDER BY category, name` (sesuai permintaan Joko).
- File `public/app.js`, `public/index.html`, `public/style.css`, `package.json`, migrasi 002 tidak disentuh. Jalur jualan, restok, batal, laporan tetap aman.
- Perlu dicek: apakah frontend memanggil `.find` pada response restock.
