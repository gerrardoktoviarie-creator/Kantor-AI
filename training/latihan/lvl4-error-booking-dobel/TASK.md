Pemilik lapangan marah: jadwal Sabtu jam 19.00 Lapangan 1 kebooking 3 orang sekaligus. Di tes satu-satu semuanya kelihatan normal. Masalahnya baru muncul waktu banyak orang pesan di detik yang sama, mis. pas promo dibuka.

Aturan POST /api/bookings body { "court": 1, "slot": "2026-11-07 19:00", "name": "Budi" }:
- Kalau slot masih kosong dan pembayaran berhasil -> 201 { id, court, slot, name }.
- Slot udah kepakai -> 409.
- Pembayaran gagal (verifyPayment balikin false) -> 402, dan slotnya HARUS bisa dipesan orang lain setelahnya.
- court/slot/name kosong -> 400.
- Dalam kondisi apa pun, satu court + slot cuma boleh punya 1 booking.

verifyPayment memang lambat (ngehubungin payment gateway) dan gak boleh dihapus.
