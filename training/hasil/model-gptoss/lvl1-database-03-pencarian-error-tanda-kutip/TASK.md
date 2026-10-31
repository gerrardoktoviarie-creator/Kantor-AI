Pembeli nyari "Jum'at" di toko roti dan halaman pencariannya error 500. Log:

```
Error: near "at": syntax error
```

Benerin pencarian di GET /api/products?q=... biar aman buat teks apa pun yang diketik pembeli (tanda kutip, dll) dan hasilnya tetap bener. Tanpa q, balikin semua produk.
