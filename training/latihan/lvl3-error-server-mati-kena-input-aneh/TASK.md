Server konversi kurs ini mati total (proses Node berhenti) beberapa kali sehari. Semua pengguna kena imbasnya. Dari log, kejadiannya tiap ada request aneh:

- body yang bukan JSON atau kosong
- mata uang yang gak dikenal, mis. "XYZ"
- amount yang bukan angka, mis. "abc"

Aturan:
- POST /api/convert body { "amount": number > 0, "currency": "USD" | "SGD" | "MYR" } (huruf kecil juga boleh, mis. "usd") -> 200 { "rupiah": bulat }.
- Input salah apa pun -> 400 { "error": "pesan jelas" }. Server TIDAK boleh mati.
- GET /api/health tetap 200 setelah semua request di atas.
