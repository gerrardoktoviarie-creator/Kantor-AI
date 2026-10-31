# Review PR-3: Kategori Menu — Joko

**1. db/migrations/003-kategori.sql — kolom NOT NULL tanpa DEFAULT (fatal untuk DB berisi data)**
- Masalah: `ADD COLUMN category TEXT NOT NULL` tanpa DEFAULT. Di DB lama (versi 2) yang udah ada 4 menu, ALTER COLUMN langsung error dan migrasi gagal. Migrasi gagal = server mati total, kasir gak bisa jualan.
- Dampak ke kasir: laptop kasir (sudah versi 2 + data asli) gak bakal jalan setelah restart, karena migrasi 003 nge-block.
- Perbaikan: tambah `NOT NULL DEFAULT 'minuman'`, lalu hanya Roti Bakar Cokelat diupdate jadi 'makanan'. Sisanya default 'minuman' (sesuai intent Rani: Roti Bakar = makanan, sisanya minuman).

**2. db/migrations/003-kategori.sql — UPDATE ke-2 yang tidak perlu dan berisiko**
- Masalah: `UPDATE products SET category = 'minuman' WHERE name != 'Roti Bakar Cokelat'` tidak diperlukan karena default 'minuman' sudah menutupi semua baris lain. Lebih jauh, query `name != 'Roti Bakar Cokelat'` berisiko aneh jika nanti ada baris dengan name NULL (walau UNIQUE/NOT NULL mencegah NULL, tapi tetap tidak perlu).
- Dampak ke kasir: risiko SQL error jika ada nama NULL (walau tidak mungkin karena constraint), dan performa sia-sia.
- Perbaikan: hapus UPDATE kedua.

**3. db/schema.sql — user_version tidak dinaikkan**
- Masalah: `PRAGMA user_version = 2` di akhir schema.sql. Server akan membaca schema ini sebagai "versi 2", padahal seharusnya sudah versi 3.
- Dampak ke kasir: jika suatu hari ada fitur ke-4, server mengira masih versi 2, sehingga migrasi 004 tidak akan dijalankan. Migrasi tidak jalan = schema tidak sinkron.
- Perbaikan: naikkan menjadi `PRAGMA user_version = 3`.

**4. server.js — tidak ada migrasi otomatis ke versi 3 (server hanya cek sampai versi 2)**
- Masalah: server cuma punya satu cabang migrasi: `user_version < 2` → migrasi 002-stok.sql. Tidak ada cabang untuk versi 2 → 3, jadi migrasi 003-kategori.sql tidak pernah dijalankan secara otomatis.
- Dampak ke kasir: setelah rilis, kolom `category` tidak punya data dan query `ORDER BY category` masih jalan (kategori kosong), laporan kategori jadi tidak bermakna. Install baru jalan karena schema.sql langsung versi 3, tapi laptop kasir (versi 2 + data) tidak naik versi.
- Perbaikan: tambahkan cabang `else if (user_version < 3)` yang menjalankan 003-kategori.sql.
