Sistem pengingat WhatsApp toko pakai antrean. Laporan dari lapangan:

1. Pelanggan dapet pesan yang sama 2-3 kali.
2. Pesan ke nomor yang gak aktif dicoba terus tanpa berhenti, dan statusnya nyangkut di "queued" selamanya.
3. Angka "attempts" di dashboard gak masuk akal.
4. /api/stats gak cocok sama isi antrean.

Aturan yang bener:
- POST /api/jobs { "to": "0812...", "text": "..." } -> 201 { id, status: "queued" }. to/text kosong -> 400.
- Worker ngirim tiap job. Satu job yang sukses dikirim TEPAT SATU kali (cek di GET /api/deliveries).
- attempts = berapa kali job itu udah dicoba dikirim (yang sukses di percobaan pertama -> attempts 1).
- Gagal kirim -> dicoba lagi, maksimal 3 percobaan total. Setelah itu status "failed" dan error terakhir disimpan di kolom error.
- Status yang mungkin: queued, sending, sent, failed.
- GET /api/jobs/:id -> { id, to, status, attempts, error }.
- GET /api/stats -> { "queued": n, "sending": n, "sent": n, "failed": n }.

Fungsi send() mensimulasikan gateway WhatsApp (lambat, kadang gagal). Perilaku send() gak boleh diubah.
