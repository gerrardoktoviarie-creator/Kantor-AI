#!/usr/bin/env bash
# Kantor AI installer for a Linux VPS (Debian/Ubuntu).
#   curl -fsSL https://raw.githubusercontent.com/gerrardoktoviarie-creator/Kantor-AI/main/install.sh | bash
# Re-running it updates the code and keeps .env and workspace/ (your data).
set -euo pipefail

REPO="${KANTOR_REPO:-gerrardoktoviarie-creator/Kantor-AI}"
DIR="${KANTOR_DIR:-$HOME/kantor-ai}"
PORT="${KANTOR_PORT:-4100}"

say() { printf '\n\033[1;33m==>\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31mGagal:\033[0m %s\n' "$*" >&2; exit 1; }

# Piped through "curl | bash", stdin is the script itself; questions must read the terminal.
ask() {
  local prompt="$1" default="$2" answer=""
  if [ -r /dev/tty ]; then read -r -p "$prompt [$default]: " answer < /dev/tty || true; fi
  printf '%s' "${answer:-$default}"
}

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null || fail "Butuh sudo (atau jalanin sebagai root)."
  SUDO="sudo"
fi
command -v apt-get >/dev/null || fail "Installer ini buat Debian/Ubuntu (apt). Distro lain: ikutin cara manual di README."

node_ok() {
  command -v node >/dev/null || return 1
  # node:sqlite needs 22.13 or newer.
  node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)'
}

say "Masang git, ffmpeg, dan curl"
$SUDO apt-get update -y
$SUDO apt-get install -y git ffmpeg curl ca-certificates

if ! node_ok; then
  say "Masang Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
fi
node_ok || fail "Node.js 22.13+ gak kepasang."

if [ -d "$DIR/.git" ]; then
  say "Update kode di $DIR"
  git -C "$DIR" pull --ff-only
else
  say "Download Kantor AI ke $DIR"
  git clone "https://github.com/$REPO.git" "$DIR"
fi
cd "$DIR"

if [ ! -f .env ]; then
  say "Bikin pengaturan (.env)"
  cp .env.example .env
  ip="$(curl -fsS --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')"
  password="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 16)"
  llm_url="$(ask 'Alamat AI (OpenAI-compatible, mis. 9router)' 'http://localhost:20128/v1')"
  llm_key="$(ask 'API key AI (boleh kosong)' '')"
  llm_model="$(ask 'Nama model' 'code')"
  sed -i \
    -e "s|^PORT=.*|PORT=$PORT|" \
    -e "s|^HOST=.*|HOST=0.0.0.0|" \
    -e "s|^KANTOR_PASSWORD=.*|KANTOR_PASSWORD=$password|" \
    -e "s|^PUBLIC_URL=.*|PUBLIC_URL=http://$ip:$PORT|" \
    -e "s|^LLM_URL=.*|LLM_URL=$llm_url|" \
    -e "s|^LLM_KEY=.*|LLM_KEY=$llm_key|" \
    -e "s|^LLM_MODEL=.*|LLM_MODEL=$llm_model|" \
    .env
  chmod 600 .env
else
  say ".env udah ada, gak diubah"
fi

say "Pasang Kantor AI sebagai service (nyala sendiri tiap VPS restart)"
$SUDO tee /etc/systemd/system/kantor-ai.service >/dev/null <<UNIT
[Unit]
Description=Kantor AI
After=network-online.target
Wants=network-online.target

[Service]
User=$(id -un)
WorkingDirectory=$DIR
ExecStart=$(command -v node) server/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
$SUDO systemctl daemon-reload
$SUDO systemctl enable kantor-ai >/dev/null
$SUDO systemctl restart kantor-ai

if command -v ufw >/dev/null && $SUDO ufw status | grep -q "Status: active"; then
  $SUDO ufw allow "$PORT/tcp" >/dev/null
fi

sleep 2
$SUDO systemctl is-active --quiet kantor-ai || fail "Service gak mau nyala. Cek: sudo journalctl -u kantor-ai -n 50"

url="$(grep '^PUBLIC_URL=' .env | cut -d= -f2-)"
password="$(grep '^KANTOR_PASSWORD=' .env | cut -d= -f2-)"
cat <<DONE

Kantor AI udah jalan.

  Buka      : ${url:-http://IP-VPS:$PORT}
  Password  : $password
  Pengaturan: $DIR/.env  (habis diubah: sudo systemctl restart kantor-ai)

Di browser, Builder bakal nanya soal bisnismu, terus kamu pilih tim dan bentuk kantornya.
Koneksinya masih http biasa. Kalau punya domain, pasang HTTPS (lihat bagian VPS di README).
DONE
