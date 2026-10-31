Laporan pengguna: "Tiap mau nyimpen catatan, selalu muncul 'Judul wajib diisi', padahal judulnya udah diisi."

Contoh request yang gagal:
POST /api/notes  body: {"title": "Bayar listrik"}
Respons: 400 {"error":"Judul wajib diisi."}

Harusnya 201 dan balikin catatan barunya ({ id, title }). Request tanpa judul tetap harus 400.
