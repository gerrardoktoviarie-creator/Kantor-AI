Pembeli komplain total di checkout gak sesuai promo, dan kadang checkout error 500. Endpoint: POST /api/checkout
body { "items": [ { "id": 1, "qty": 2 } ], "code": "HEMAT10" }   (code opsional)

Aturan bisnis (dari pemilik, ini yang bener):
1. subtotal = jumlah harga x qty. qty wajib bilangan bulat 1-99 (angka, bukan teks). items minimal 1. Produk yang gak ada -> 400.
2. Kode promo gak peduli huruf besar kecil. Kode yang gak dikenal -> 400.
   - HEMAT10: diskon 10% dari subtotal, dibulatkan ke bawah ke rupiah, maksimal Rp20.000. Berlaku kalau subtotal minimal Rp50.000 (50.000 pas udah boleh). Kalau belum sampai minimal, diskon 0 (bukan error).
   - ONGKIRFREE: ongkir jadi 0.
3. Ongkir Rp10.000. Gratis kalau (subtotal - diskon) minimal Rp100.000.
4. total = subtotal - diskon + ongkir. Semua angka bilangan bulat rupiah.
5. Respons 200 { "subtotal", "discount", "shipping", "total" }. Input salah -> 400 { "error" }.

Logika harga ada di lib/pricing.js, route di server.js.
