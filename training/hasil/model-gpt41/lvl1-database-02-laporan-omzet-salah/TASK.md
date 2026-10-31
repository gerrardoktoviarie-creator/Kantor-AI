Bos curiga laporan omzet salah. GET /api/report balikin total 75000, padahal pesanan yang udah dibayar cuma:
- Pesanan #1: total Rp30.000 (2 jenis barang), lunas
- Pesanan #2: total Rp15.000 (1 jenis barang), lunas
- Pesanan #3: total Rp20.000, belum dibayar (gak boleh dihitung)

Omzet yang bener 45000. Benerin query-nya. Respons tetap { "total": angka, "orders": jumlah pesanan lunas }.
