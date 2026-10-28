# Referensi Desain Kantor AI

Buka `index.html` (dobel-klik), atau lewat server di http://localhost:4100/design-reference/.

| File | Isi |
|---|---|
| `index.html` | Papan referensi: konsep, warna + tabel kontras, tipografi, komponen, panduan pixel art, mockup 7 layar, gerak, gaya bahasa, sumber |
| `tokens.css` | Token desain (warna, font, spasi, radius, gerak) mode gelap + terang, siap disalin ke `public/css/style.css` |
| `board.css` | Gaya papan referensi itu sendiri |
| `board.js` | Gambar sprite agent, denah mini, tabel kontras (dihitung langsung), tombol ganti tema |

## Sumber

- Palet: Huemint, navy `#121a2e` + teks + kuning `#f4b942` dikunci, teal `#00a598` dan oranye `#ee6230` dari model transformer.
  https://huemint.com/brand-intersection/#palette=121a2e-f4b942-ee6230-00a598
- Pola UI: halaman publik Mobbin `/explore` (dashboard, chat detail, calendar, video player, code editor, charts), diambil 28 Okt 2026.
- Kontras: dihitung pakai rumus WCAG 2.x di `board.js`. Satu-satunya pasangan yang gagal AA: teks putih di atas teal `#00a598` (3.07:1).

## Belum ada

Foto/video gak dibikin, karena di sesi ini gak ada alat buat generate gambar. Semua visual (karakter, kantor, layar) digambar langsung pakai HTML/CSS/canvas, jadi selalu sama dengan app aslinya.
