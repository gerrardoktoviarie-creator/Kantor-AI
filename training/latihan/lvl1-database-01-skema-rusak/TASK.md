File db/schema.sql buat toko kopi bermasalah. Keluhan dari tim:

1. Waktu dijalanin, schema.sql langsung error syntax.
2. Server ngejalanin schema.sql tiap start. Start kedua error "table already exists" dan data contohnya dobel.
3. Pesanan bisa disimpan buat produk yang gak ada (product_id 99).
4. Harga bisa minus, harga disimpan desimal (15000.0), dan qty 0 bisa masuk.
5. Produk bisa disimpan tanpa nama.

Tulis ulang db/schema.sql yang bener. Tabel dan nama kolom tetap: products(id, name, price, created_at), orders(id, product_id, qty, created_at). Data contoh 3 produk tetap ada.
