Database toko yang udah jalan (struktur dan isinya ada di db/current.sql) perlu dirapikan TANPA kehilangan data. Tulis db/migrate.sql yang dijalanin sekali di atas database itu.

Masalah sekarang:
- Kolom nama namanya `fullname`, boleh kosong, dan ada yang kelebihan spasi.
- Nomor HP disimpan INTEGER, jadi angka 0 di depan hilang (81234567890 harusnya "081234567890").

Hasil yang diminta setelah migrasi:
- customers(id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))). Kolom fullname gak ada lagi.
- name = fullname yang udah di-trim. phone = teks dengan 0 di depan; yang kosong tetap NULL.
- id pelanggan tetap sama, semua pesanan tetap ada dan tetap nyambung ke pelanggannya. Foreign key orders.customer_id tetap nunjuk ke tabel customers.
- Ada index buat orders(customer_id).
- PRAGMA user_version = 2 sebagai penanda versi skema.
- Kalau ada langkah yang gagal di tengah, database gak boleh setengah jadi.
