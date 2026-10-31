Rekap omzet bulanan buat pemilik toko (di Jakarta, WIB = UTC+7) gak cocok sama catatan kasir.

GET /api/report/monthly?year=2026 harus balikin array 12 bulan, urut Januari sampai Desember:
[ { "month": "2026-01", "total": 55000, "orders": 2 }, ..., { "month": "2026-12", "total": 0, "orders": 0 } ]

Aturan:
- Kolom paid_at disimpan dalam UTC ('YYYY-MM-DD HH:MM:SS'). Bulan ditentukan pakai waktu WIB.
- Pesanan berstatus 'batal' gak dihitung.
- Cuma tahun yang diminta. Bulan tanpa pesanan tetap muncul dengan total 0 dan orders 0.
- year wajib 4 digit (mis. 2026). Kalau gak ada atau salah -> 400.
