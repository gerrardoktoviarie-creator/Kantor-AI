PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS courts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  court_id INTEGER NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
  customer TEXT NOT NULL,
  start_at TEXT NOT NULL CHECK (
    start_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]'
  ),
  end_at TEXT NOT NULL CHECK (
    end_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]'
  ),
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'batal')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_bookings_court_start_status
  ON bookings (court_id, start_at, status);

CREATE TRIGGER IF NOT EXISTS trg_bookings_no_overlap_insert
BEFORE INSERT ON bookings
WHEN NEW.status = 'aktif'
BEGIN
  SELECT RAISE(ABORT, 'Booking tumpang tindih dengan booking aktif yang sudah ada')
  FROM bookings
  WHERE court_id = NEW.court_id
    AND status = 'aktif'
    AND NEW.start_at < end_at
    AND NEW.end_at > start_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_bookings_no_overlap_update
BEFORE UPDATE ON bookings
WHEN NEW.status = 'aktif'
BEGIN
  SELECT RAISE(ABORT, 'Booking tumpang tindih dengan booking aktif yang sudah ada')
  FROM bookings
  WHERE court_id = NEW.court_id
    AND status = 'aktif'
    AND id != NEW.id
    AND NEW.start_at < end_at
    AND NEW.end_at > start_at;
END;

CREATE TRIGGER IF NOT EXISTS trg_bookings_updated_at
BEFORE UPDATE ON bookings
BEGIN
  UPDATE bookings SET updated_at = datetime('now') WHERE id = NEW.id;
END;

INSERT OR IGNORE INTO courts (id, name) VALUES (1, 'Lapangan A'), (2, 'Lapangan B');
