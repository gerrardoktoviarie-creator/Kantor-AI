Dua keluhan dari bos:

1. Kantor AI jalanin proyek ini di port lain (lewat environment PORT), tapi server-nya gak bisa diakses sama sekali.
2. Halaman detail catatan aneh: GET /api/notes/1 balikin `null`, dan GET /api/notes/999 (gak ada) balikin 200 juga.

Harusnya: GET /api/notes/1 -> 200 { id: 1, title: "Belanja bulanan" }, catatan yang gak ada -> 404 { error }.
