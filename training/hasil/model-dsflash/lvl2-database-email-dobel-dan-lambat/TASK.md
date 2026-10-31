Masalah di db/schema.sql toko online:

1. Satu email bisa daftar berkali-kali, termasuk beda huruf besar kecil ("budi@mail.com" dan "BUDI@mail.com").
2. Kolom status pesanan bisa diisi apa aja (ada yang nulis "lunass"). Status yang sah cuma: baru, dibayar, dikirim, selesai, batal.
3. Halaman riwayat pesanan lambat. Query-nya:
   SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
   Sekarang database baca semua baris lalu ngurutin ulang. Harus pakai index dan gak perlu sort tambahan.

Tulis ulang db/schema.sql. Nama tabel/kolom dan data contoh tetap, dan file harus aman dijalanin berkali-kali.
