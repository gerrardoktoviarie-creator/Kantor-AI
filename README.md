# Kantor AI

Kantor virtual berisi agent AI per divisi. Tiap agent punya meja di denah pixel, jalan ke mejanya kalau lagi kerja, dan nongol di "Nunggu kamu cek" kalau hasilnya perlu kamu lihat.

| Divisi | Agent | Kerjaannya |
|---|---|---|
| Sosmed | Sari, Ale, Dimas | Naskah reels/carousel/single image, approve/revisi, halaman preview klien, potong video panjang jadi klip |
| IT & Programmer | Nadia, Tari, Joko, Fajar, Rani, Bayu | Riset → desain → database → backend → frontend → review, hasilnya file proyek beneran |
| Tugas & Kuliah | Mira | Narik tugas dari Google Classroom tiap 15 menit, ringkas, kasih rencana ngerjain |
| Marketing iklan | Raka, Wulan | Laporan + saran dari CSV ekspor Meta/TikTok Ads (angkanya dihitung pasti, bukan ditebak AI), ide target audiens |
| Admin & stok | Dewi, Rudi | Catat barang masuk/keluar, kabar Telegram kalau stok tipis plus saran restok, rekap tiap Senin |

Fitur lain:

- **Kantor pixel**: lantai dan perabot beda tiap ruangan, siang/malam ngikutin jam, kolam renang, zoom (scroll, drag, klik nama ruangan), layar penuh. Gaya kantor (Modern, Kayu hangat, Mewah gelap) dan fasilitasnya dipilih di wizard.
- **Musala + jadwal salat**: jadwal 5 waktu dihitung lokal (kriteria Kemenag + ihtiyath 2 menit). Pas azan, agent yang gak lagi kerja wudhu terus salat berjamaah. Jumat siang jadi Jumatan, kamu khatibnya.
- **Chat sama agent**: klik agent di kantor, ngobrol di laci kanan. Agent tahu kerjaannya sendiri.
- **Klip + subtitle**: video ditranskrip lokal pakai whisper.cpp, Dimas milih momen dari isi omongan, klip bisa ditempel subtitle gaya TikTok.
- **Jalanin proyek IT**: tombol Jalankan nyalain `server.js` proyek di port 4300+, log-nya kelihatan, dan Bayu bisa disuruh benerin pakai log error itu.
- **Telegram**: tugas baru dan pengingat deadline (Mira), stok tipis (Dewi), rekap mingguan (Rudi). Bisa pakai bot sendiri atau bot Hermes.
- **Hermes**: kalau [Hermes Agent](https://github.com/NousResearch/hermes-agent) terpasang, Kantor AI bisa ngirim pesan lewat bot Hermes, dan Hermes dapet skill buat nyuruh kantor dari Telegram ("kantor gimana?", "suruh Dewi catat kopi keluar 10").

## Pasang

Butuh AI yang kompatibel OpenAI, misalnya [9router](https://www.npmjs.com/package/9router) yang jalan di `localhost:20128`. Installer nanya alamat dan key-nya.

**Windows 10/11**, buka PowerShell, tempel:

```
irm https://raw.githubusercontent.com/gerrardoktoviarie-creator/Kantor-AI/main/install.ps1 | iex
```

Node.js dipasang lewat winget kalau belum ada, Kantor AI ditaruh di `%USERPROFILE%\kantor-ai`, nyala sendiri tiap laptop hidup, dan browser langsung kebuka ke wizard.

**VPS Linux (Debian/Ubuntu)**, login SSH, tempel:

```
curl -fsSL https://raw.githubusercontent.com/gerrardoktoviarie-creator/Kantor-AI/main/install.sh | bash
```

Installer masang Node.js 22, ffmpeg, dan service systemd, bikin password acak, terus nampilin alamat dan password buat login. Jalanin perintah yang sama lagi buat update; `.env` dan data di `workspace/` gak disentuh.

Koneksi ke VPS masih http biasa. Kalau punya domain, taruh di depan Caddy biar dapet HTTPS:

```
sudo apt install caddy
echo 'kantor.domainmu.com { reverse_proxy localhost:4100 }' | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Habis itu ganti `PUBLIC_URL=https://kantor.domainmu.com` di `.env`, tutup port 4100 di firewall, dan `sudo systemctl restart kantor-ai`.

**Manual** (semua OS): butuh Node.js 22.13+.

```
git clone https://github.com/gerrardoktoviarie-creator/Kantor-AI.git kantor-ai
cd kantor-ai
cp .env.example .env    # isi LLM_URL dan LLM_KEY
npm start
```

Buka http://localhost:4100. Builder nanya soal bisnismu, terus kamu pilih tim dan bentuk kantornya. Mau nambah tim atau ganti gaya nanti: tombol **Atur kantor** di halaman Kantor.

Tes: `npm test` (pakai AI palsu, jadi gak makan kuota).

### Fitur yang butuh program tambahan

- **ffmpeg** buat potong klip: installer Windows nawarin lewat winget, installer VPS masang otomatis. Atau taruh `ffmpeg.exe` di `bin/`.
- **whisper.cpp** buat subtitle: taruh `whisper-cli` (atau `whisper-cli.exe`) dan model `ggml-base.bin` di `bin/whisper/`. Rilis siap pakai ada di [whisper.cpp releases](https://github.com/ggml-org/whisper.cpp/releases), modelnya di [Hugging Face](https://huggingface.co/ggerganov/whisper.cpp). Tanpa ini, klip tetap bisa dipotong, cuma gak ada subtitle.

### Hermes

Kalau Hermes kepasang di komputer yang sama, buka halaman **Tugas**:

- **Pakai bot Hermes**: semua pesan Kantor AI dikirim lewat bot Telegram Hermes ke chat utamanya. Kantor AI cuma ngirim, gak baca pesan masuk, jadi gak rebutan sama Hermes.
- **Pasang skill Kantor AI ke Hermes**: nyalin `hermes/kantor-ai/SKILL.md` ke folder skill Hermes. Habis itu Hermes bisa baca status kantor dan nyuruh agent lewat API lokal.

## Pengaturan (.env)

Contoh lengkapnya di `.env.example`.

| Nama | Isi |
|---|---|
| `PORT` | Port aplikasi, default 4100 |
| `HOST` | `127.0.0.1` (default) = cuma bisa dibuka dari komputer itu. `0.0.0.0` buat VPS, wajib pakai `KANTOR_PASSWORD` |
| `KANTOR_PASSWORD` | Password login. Kalau kosong, gak ada login (aman selama `HOST` lokal) |
| `PUBLIC_URL` | Alamat yang diketik di browser kalau bukan localhost. Dipakai juga buat balikan login Google |
| `LLM_URL`, `LLM_MODEL`, `LLM_KEY` | Endpoint AI (OpenAI-compatible), nama model, dan API key-nya |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Buat Google Classroom. Cara bikinnya ada di halaman Tugas |
| `TELEGRAM_BOT_TOKEN` | Token bot dari @BotFather. Boleh kosong kalau pakai bot Hermes |
| `PRAYER_CITY`, `PRAYER_LAT`, `PRAYER_LON`, `PRAYER_UTC_OFFSET` | Lokasi buat jadwal salat. Default Jakarta (-6.2088, 106.8456, WIB = 7) |
| `FFMPEG_PATH`, `WHISPER_MODEL`, `HERMES_HOME` | Opsional, kalau program-program itu ada di tempat lain |

## Catatan

- Semua data (database, video, klip, proyek IT, token Google) ada di folder `workspace/`. Folder itu, `.env`, dan `bin/` gak ikut ke git.
- Link preview klien (`/klien/...`) gak butuh login; tiap klien punya kode rahasia sendiri di link-nya.
- Proyek IT yang dijalankan cuma dapet variabel lingkungan minimum (bukan token/key Kantor AI). Proyek yang butuh package npm harus di-`npm install` manual dulu.
- Proyek IT dan analisis ditulis model AI. Hasilnya draf kerja: cek dulu sebelum dipakai beneran.
- Agent ngerjain satu tugas dalam satu waktu (antrean), biar akun AI gratisan gak kena limit.
