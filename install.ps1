# Kantor AI installer for Windows 10/11. In PowerShell:
#   irm https://raw.githubusercontent.com/gerrardoktoviarie-creator/Kantor-AI/main/install.ps1 | iex
# Re-running it updates the code and keeps .env, workspace\ (your data) and bin\.
$ErrorActionPreference = 'Stop'

$Repo = if ($env:KANTOR_REPO) { $env:KANTOR_REPO } else { 'gerrardoktoviarie-creator/Kantor-AI' }
$Dir = if ($env:KANTOR_DIR) { $env:KANTOR_DIR } else { Join-Path $HOME 'kantor-ai' }
$Port = 4100

function Say($text) { Write-Host "`n==> $text" -ForegroundColor Yellow }

function Test-Node {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { return $false }
  # node:sqlite needs 22.13 or newer.
  & node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)'
  return $LASTEXITCODE -eq 0
}

function Update-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

if (-not (Test-Node)) {
  Say 'Masang Node.js (LTS) lewat winget'
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'winget gak ada. Pasang Node.js 22+ manual dari https://nodejs.org, terus jalanin installer ini lagi.'
  }
  winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
  Update-Path
  if (-not (Test-Node)) { throw 'Node.js 22.13+ belum kebaca. Tutup PowerShell, buka lagi, terus jalanin installer ini sekali lagi.' }
}

Say "Download Kantor AI ke $Dir"
$zip = Join-Path $env:TEMP 'kantor-ai.zip'
$unpacked = Join-Path $env:TEMP 'kantor-ai-src'
Invoke-WebRequest -UseBasicParsing "https://codeload.github.com/$Repo/zip/refs/heads/main" -OutFile $zip
if (Test-Path $unpacked) { Remove-Item -Recurse -Force $unpacked }
Expand-Archive $zip -DestinationPath $unpacked
$source = (Get-ChildItem $unpacked -Directory | Select-Object -First 1).FullName
New-Item -ItemType Directory -Force $Dir | Out-Null
# Copy the code over, leaving the user's settings, data and downloaded tools alone.
robocopy $source $Dir /E /XD workspace bin node_modules /XF .env /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Gagal nyalin file (robocopy $LASTEXITCODE)." }
Remove-Item -Recurse -Force $unpacked, $zip

$envFile = Join-Path $Dir '.env'
if (-not (Test-Path $envFile)) {
  Say 'Bikin pengaturan (.env)'
  Copy-Item (Join-Path $Dir '.env.example') $envFile
  $llmUrl = Read-Host 'Alamat AI (OpenAI-compatible, mis. 9router) [http://localhost:20128/v1]'
  $llmKey = Read-Host 'API key AI (boleh kosong)'
  $llmModel = Read-Host 'Nama model [code]'
  if (-not $llmUrl) { $llmUrl = 'http://localhost:20128/v1' }
  if (-not $llmModel) { $llmModel = 'code' }
  $text = Get-Content $envFile -Raw
  $text = $text -replace '(?m)^LLM_URL=.*$', "LLM_URL=$llmUrl"
  $text = $text -replace '(?m)^LLM_KEY=.*$', "LLM_KEY=$llmKey"
  $text = $text -replace '(?m)^LLM_MODEL=.*$', "LLM_MODEL=$llmModel"
  [IO.File]::WriteAllText($envFile, $text)
} else {
  Say '.env udah ada, gak diubah'
}

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue) -and -not (Test-Path (Join-Path $Dir 'bin\ffmpeg.exe'))) {
  $answer = Read-Host 'Pasang ffmpeg buat fitur potong klip video? (y/n) [y]'
  if ($answer -ne 'n' -and (Get-Command winget -ErrorAction SilentlyContinue)) {
    Say 'Masang ffmpeg lewat winget'
    winget install --id Gyan.FFmpeg --exact --silent --accept-package-agreements --accept-source-agreements
  }
}

Say 'Bikin Kantor AI nyala sendiri tiap laptop hidup'
$startup = [Environment]::GetFolderPath('Startup')
$launcher = Join-Path $startup 'kantor-ai.vbs'
$lines = @(
  'Set sh = CreateObject("WScript.Shell")',
  "sh.Run ""cmd /c cd /d $Dir && node server\index.js"", 0, False"
)
Set-Content -Encoding ASCII $launcher -Value $lines

Say 'Nyalain Kantor AI'
# Restart an older copy, identified by the port it holds (other apps may also run server\index.js).
$old = (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($old) { Stop-Process -Id $old -Force }
Start-Process wscript.exe -ArgumentList "`"$launcher`""
Start-Sleep -Seconds 3
Start-Process "http://localhost:$Port"

Write-Host @"

Kantor AI udah jalan di http://localhost:$Port
Di browser, Builder bakal nanya soal bisnismu, terus kamu pilih tim dan bentuk kantornya.

  Folder     : $Dir
  Pengaturan : $envFile
  Auto-start : $launcher (hapus file ini kalau gak mau nyala sendiri)
"@
