---
name: kantor-ai
description: "Use when the user asks about or wants to command their Kantor AI office (agents like Sari, Bayu, Mira, Raka, Wulan, Dewi, Rudi): office status, what agents are doing, stock in/out, low stock, ads reports, audience ideas, content briefs, IT projects, homework deadlines, or 'suruh <agent> ...'. Talks to the local Kantor AI server over HTTP."
version: 1.0.0
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [kantor-ai, office, agents, stock, ads, telegram]
---

# Kantor AI

Kantor AI is the user's virtual office of AI agents. It runs locally at **http://localhost:4100**
(only reachable from this machine). You read and command it with HTTP calls from the terminal tool.
Answer the user in casual Indonesian, short, like a chat. Never invent numbers: read them from the API.

## Calling the API

- Bash / Git Bash / Linux: `curl -s http://localhost:4100/api/hermes/status`
- JSON bodies with curl: `curl -s -X POST http://localhost:4100/PATH -H "Content-Type: application/json" -d '{"text":"..."}'`
- Windows PowerShell (quoting JSON with curl is painful there), use:
  `Invoke-RestMethod -Method Post -Uri http://localhost:4100/PATH -ContentType 'application/json' -Body (@{ text = '...' } | ConvertTo-Json)`
- Errors come back as `{"error": "..."}` in Indonesian; relay the message to the user as is.
- If the connection is refused, Kantor AI is not running: tell the user to start it (`npm start` in the kantor-ai folder, or restart the laptop if it auto-starts).

## Start here: office status

`GET /api/hermes/status` returns plain text: every agent and what they're doing, anything waiting for the user
("NUNGGU DICEK"), failed tasks, low stock, nearest homework deadlines, and the latest ads summary.
Use it for "kantor gimana?", "ada yang nunggu aku?", "siapa yang lagi kerja?". Summarize, don't paste it all.

## Talk to an agent

`POST /api/agents/{id}/messages` with `{"text": "..."}`. Returns the whole chat as a JSON array; the **last item**
(`role: "agent"`) is the agent's reply. Pass the user's question through in their own words.
Agent ids: `sari` konten, `ale` creative/klien, `dimas` klip video, `bayu` `nadia` `tari` `joko` `fajar` `rani` tim IT,
`mira` tugas kuliah, `raka` iklan, `wulan` audiens iklan, `dewi` stok, `rudi` rekap penjualan, `builder` pengurus kantor.
Only agents of enabled teams show up in the status; talking to others works but they have no work context.

After the user has looked at something an agent finished: `POST /api/agents/{id}/ack` clears the "nunggu dicek" flag.

## Stock (team Admin & stok)

- List: `GET /api/stock` → `products[]` with `id, name, unit, stock, minStock, low, soldWeek, order` (order = suggested restock).
- Item in/out: `POST /api/stock/products/{id}/moves` with `{"qty": -10, "note": "terjual"}`. Negative = keluar, positive = masuk.
  Find the id by name from `GET /api/stock` first; if two names match, ask which one.
- New item: `POST /api/stock/products` with `{"name","unit","stock","minStock","price"}`.
- Weekly recap now: `POST /api/stock/recaps` (Rudi writes it; read it later with `GET /api/stock/recaps`).
Dewi messages Telegram by herself when an item drops below its minimum.

## Ads (team Marketing iklan)

- Audience ideas: `POST /api/ads/audiences` with `{"product": "...", "goal": "Penjualan|Chat WhatsApp|Datang ke toko|Nambah followers|Kenalin brand", "budget": 50000}`.
  Wulan answers in the background; read with `GET /api/ads/audiences` (`result.audiens[]`).
- Report from an ads export CSV the user sent or saved: read the file, then `POST /api/ads/reports` with
  `{"name": "...", "csv": "<whole file content>"}`. Totals are computed immediately (in the response, `summary.totals`);
  Raka's analysis arrives later in `GET /api/ads/reports` (`analysis.ringkasan`, `saran`).

## Content (team Sosmed)

- Clients: `GET /api/clients`. New brief for Sari: `POST /api/contents` with
  `{"clientId": 1, "format": "reels|single|carousel", "brief": "...", "scheduleAt": "2026-11-01T19:00"}` (scheduleAt optional).
- Status of contents: `GET /api/contents` (`state`: drafting, review = waiting for the user, waiting_client, approved).

## IT and homework

- New project for the IT team: `POST /api/projects` with `{"name","kind":"website|app","brief"}`.
- Idea research by Nadia: `POST /api/ideas` with `{"topic": "..."}`.
- Pull new Google Classroom tasks now: `POST /api/classroom/sync`.
- Retry a failed task: `POST /api/tasks/{id}/retry` (ids are in the status text).

## Rules

- Work happens in the background, one task at a time. After queuing something, tell the user who is on it
  and that the result will show in the office (and on Telegram for stock and homework), don't wait in a loop.
- Don't delete anything through the API unless the user explicitly asks for that exact item.
- The office web page is http://localhost:4100 if the user wants to see it.
