Tombol "Tandai selesai" di halaman catatan gak ngefek. Frontend (public/app.js) kirim:

PUT /api/notes/:id   body: { "done": true }

Kadang dapet 404, kadang server balikin 500 dengan log `TypeError: Assignment to constant variable.`

Yang diharapkan:
- PUT /api/notes/1 {"done": true} -> 200 dan balikin catatan yang udah ke-update. GET /api/notes ikut berubah.
- Boleh ubah "title" (teks gak kosong) dan/atau "done" (boolean). Field lain (mis. "id") diabaikan.
- "done" yang bukan boolean, atau title kosong -> 400. Catatan yang gak ada -> 404.
