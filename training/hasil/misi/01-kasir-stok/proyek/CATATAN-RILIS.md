# Catatan Rilis — Fitur Stok & Batal Penjualan
Versi 2 (stok, batal penjualan)

Apa yang berubah:
- Stok tiap menu ditampilin (GET /api/products: stock, min_stock, low).
- RESTOCK stok naik. PENJUALAN otomatis kurangi stok, kalau kurang balik 409 dengan sisa stok.
- BATAL PENJUALAN hari ini (WIB) lewat DELETE /api/sales/:id -> stok balik, penjualan ilang.
- Rekap hari ini + total.
- Migrasi otomatis: database lama (user_version 1) dapat kolom stock/min_stock; data 3 bulan tetap utuh.

Langkah update di laptop kasir:
1. Backup data.db: `copy data.db data.db.backup`.
2. Copy folder proyek yang udah diupdate (server.js, db/schema.sql, db/migrations/002-stok.sql, public/index.html, public/app.js, public/style.css).
3. Jalankan `npm start` (atau node server.js). Server bakal migrasi otomatis, gak perlu ngetik SQL.
4. Buka browser di http://localhost:3000.

Risiko:
- Migrasi cuma nambah kolom, data lama aman — tapi tetap backup dulu.
- Batal penjualan cuma berlaku hari ini WIB.
- Kalau ada penjualan gagal (stok kurang), gak ada barang yang terpotong — dikembalikan seluruhnya.
- Mulai restart server sekali aja setelah update biar load schema & migrasi sekali jalan.
