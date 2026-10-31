Katalog produk pakai halaman (pagination) dan banyak keluhan:

- Halaman 1 gak pernah nampilin produk termurah, kayak kelewat satu halaman.
- Angka "total produk" berubah-ubah tiap ganti halaman, dan pas nyari "kopi" totalnya tetap ngitung semua produk.
- ?limit=abc bikin error 500. ?limit=100000 bikin server berat.

Kontrak GET /api/products?page=1&limit=3&q=kopi :
- Urut dari harga termurah.
- Respons: { "items": [...], "page": n, "limit": n, "total": jumlah semua produk yang cocok filter, "pages": jumlah halaman }
- page default 1, limit default 10, limit maksimal 50 (lebih dari itu dipotong jadi 50).
- page/limit yang bukan bilangan bulat positif -> 400.
- Halaman setelah halaman terakhir -> 200 dengan items kosong.
- q (opsional) nyari di nama produk, gak peduli huruf besar kecil.
