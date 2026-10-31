## Review #3 — Migrasi kategori (Joko)

1. **db/migrations/004-kategori-nullable.sql — DROP NOT NULL langsung tidak jalan di SQLite.** SQLite tidak punya `ALTER COLUMN ... DROP NOT NULL`; perintah itu ditolak dengan "near 'ALTER' syntax error" (DB versi 1) atau "no such column: category" kalau tabel belum punya kolom (DB versi 1). Dampak: server mati pas start. Perbaikan: ulang skema kolom via temp column (ADD temp, copy, DROP, ADD baru, copy back).

2. **db/migrations/005-pisah-perubahan-kategori.js — dieksekusi lewat db.exec(readFileSync(...)), padahal isinya JavaScript.** Syntax error `import` karena JS dianggap SQL. Perbaikan: migrasi ini sekarang cuma SQL langsung (mirip 003) dan dijalankan inline di server.js sesuai versi, tanpa perlu file JS terpisah.

3. **server.js — alur migrasi salah urutan dan bergantung versi yang tidak sinkron.** Kondisi `version < 4` menjalankan 004, lalu `version < 5` mengeksekusi file JS yang syntax-nya JS. Dampak: crash di semua versi DB (1, 2, dan 3). Perbaikan: satukan logika penambahan kolom kategori di satu blok `if (version < 5)` di server.js, cek dulu apakah kolom `category` sudah ada lewat `pragma_table_info` supaya idempoten. Migrasi 005 jadi tidak lagi dieksekusi.

4. **db/migrations/003-kategori.sql — masih `ADD COLUMN category TEXT` tanpa DEFAULT tapi sudah dihapus NOT NULL, jadi aman untuk DB lama.** Migrasi ini tetap dipakai DB versi 1. Tambah kolom TEXT nullable, lalu update kategori. Aman karena kolom boleh NULL dan value semua diisi.

5. **db/schema.sql — user_version sudah dinaikkan ke 5, kolom category sudah ada dengan CHECK, data awal lengkap.** Instalasi baru langsung punya kategori (kategori terisi semua saat insert).

Yang belum dibenerin / perlu dicek:
- [perlu dicek] Migrasi belum diuji jalannya di ketiga skenario (DB versi 1 kosong, DB versi 2 berisi data, DB baru) karena tidak bisa menjalankan `node server.js`. Harap test manual setelah rilis: restart server dengan data.db laptop kasir, lalu cek `PRAGMA user_version` = 5 dan `SELECT id, category FROM products`.
