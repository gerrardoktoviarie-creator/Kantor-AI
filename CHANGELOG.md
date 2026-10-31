# Changelog

All notable changes to RetroGrid project.

## [v1.0.0] - 2026-10-31
### Added
- Branding overhaul: semua penyebutan "Kantor AI" diganti menjadi "RetroGrid" (HTML, JS, README, desain). 
- Sprite‑atlas system for office staff: off‑screen canvases per (look, pose, back, stride, rim) and blit with `drawImage`. Removes per‑frame `drawPerson` calls, improves performance to ~60 fps with 10+ agents.
- Instancing pool and cache (`Map`) to reuse sprite canvases, reducing allocations dramatically.
- Fixed animation loop deadlock (`views/office.js` await order) and `WALL` reference error (`office-canvas.js`).
- Integrated Telegram notifications: `/api/telegram/connect`, `/api/telegram/test`, `/api/telegram/disconnect`, and Hermes‑Telegram toggle. Bot `mamadolay_agent_bot` now sends test messages.
- Night lighting adjustments and hitbox handling improvements.
- Updated README with RetroGrid focus, usage, and deployment instructions.

### Fixed
- Animation freeze caused by `await refresh(); office.start();` ordering.
- ReferenceError `WALL` → `WALL_FACE` in `office-canvas.js`.
- Sprite scaling bug in `sprite-atlas.js` (drawn on already‑scaled canvas). Now rendered at base size and scaled on blit, fixing tiny/kekecilan sprites.
- Rendering glitches where characters' feet were cut off or floating (Musala, Pantry, Ruang Belajar).
- Server crash (previous process exit 1) resolved by proper background restart handling.

### Performance
- 10 agents render at 60 fps on typical desktop, `DW/DH` scaling handled efficiently.
- Zoom/pan stress test shows stable 60 fps, no frame drops.

### Documentation
- Updated `README.md` and `design-reference/README.md` to reflect RetroGrid branding and new features.
- Added `CHANGELOG.md` (this file).

## [Unreleased]
- Prepare CI/CD pipeline integration.
- Add versioned release tags.
- Polish UI/UX for mobile.
