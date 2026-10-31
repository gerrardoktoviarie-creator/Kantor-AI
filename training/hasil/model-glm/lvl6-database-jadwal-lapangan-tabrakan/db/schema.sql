PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS courts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  court_id INTEGER NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
  customer TEXT NOT NULL,
  start_at TEXT NOT NULL CHECK (start_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9] [0-2][0-9]:[0-5][0-9]'),
  end_at TEXT NOT NULL CHECK (end_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9] [0-2][0-9]:[0-5][0-9]'),
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'batal')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_court_start_status
ON bookings (court_id, status, start_at);

CREATE TRIGGER IF NOT EXISTS trg_bookings_updated_at
AFTER UPDATE ON bookings
FOR EACH ROW
WHEN NEW.status != OLD.status OR NEW.start_at != OLD.start_at OR NEW.end_at != OLD.end_at
BEGIN
  UPDATE bookings SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Tumpang tindih saat INSERT, hanya untuk booking baru yang aktif.
-- end_at > start_at sudah dijamin CHECK.
CREATE TRIGGER IF NOT EXISTS trg_bookings_no_overlap_insert
BEFORE INSERT ON bookings
FOR EACH ROW
WHEN NEW.status = 'aktif'
BEGIN
  SELECT RAISE(ABORT, 'Jadwal tumpang tindih dengan booking aktif di lapangan yang sama')
  FROM bookings
  WHERE court_id = NEW.court_id
    AND status = 'aktif'
    AND NEW.start_at < end_at
    AND NEW.end_at > start_at;
END;

-- Tumpang tindih saat UPDATE jam (start_at/end_at berubah), hanya untuk booking yang aktif.
-- Baris itu sendiri dikecualikan lewat id != NEW.id.
CREATE TRIGGER IF NOT EXISTS trg_bookings_no_overlap_update
BEFORE UPDATE ON bookings
FOR EACH ROW
WHEN NEW.status = 'aktif'
  AND OLD.status = 'aktif'
  AND (NEW.start_at != OLD.start_at OR NEW.end_at != OLD.end_at)
BEGIN
  SELECT RAISE(ABORT, 'Jadwal tumpang tindih dengan booking aktif di lapangan yang sama')
  FROM bookings
  WHERE court_id = NEW.court_id
    AND status = 'aktif'
    AND id != NEW.id
    AND NEW.start_at < end_at
    AND NEW.end_at > start_at;
END;

-- Mengaktifkan kembali booking batal yang ngeblokir.
CREATE TRIGGER IF NOT EXISTS trg_bookings_no_overlap_restore
BEFORE UPDATE ON bookings
FOR EACH ROW
WHEN NEW.status = 'aktif'
  AND OLD.status = 'batal'
BEGIN
  SELECT RAISE(ABORT, 'Jadwal tumpang tindih dengan booking aktif di lapangan yang sama')
  FROM bookings
  WHERE court_id = NEW.court_id
    AND status = 'aktif'
    AND id != NEW.id
    AND NEW.start_at < end_at
    AND NEW.end_at > start_at;
END;

INSERT OR IGNORE INTO courts (id, name) VALUES (1, 'Lapangan A'), (2, 'Lapangan B');

INSERT OR IGNORE INTO bookings (id, court_id, customer, start_at, end_at, status) VALUES
(1, 1, 'Budi Santoso', '2026-11-07 19:00', '2026-11-07 20:00', 'aktif'),
(2, 1, 'Andi Wijaya', '2026-11-07 20:00', '2026-11-07 21:00', 'aktif'),
(3, 1, 'Siti Rahayu', '2026-11-07 18:00', '2026-11-07 19:00', 'batal'),
(4, 2, 'Dewi Lestari', '2026-11-07 17:00', '2026-11-07 18:30', 'aktif'),
(5, 2, 'Rizky Pratama', '2026-11-07 19:00', '2026-11-07 20:00', 'aktif'),
(6, 1, 'Fajar Hidayat', '2026-11-08 10:00', '2026-11-08 11:00', 'aktif'),
(7, 2, 'Nurul Aini', '2026-11-08 15:00', '2026-11-08 16:30', 'aktif');