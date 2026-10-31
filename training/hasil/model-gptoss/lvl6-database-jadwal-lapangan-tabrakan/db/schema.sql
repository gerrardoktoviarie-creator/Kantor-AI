PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS courts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  court_id INTEGER NOT NULL REFERENCES courts(id),
  customer TEXT NOT NULL,
  start_at TEXT NOT NULL CHECK (start_at LIKE '____-__-__ __:__'),
  end_at   TEXT NOT NULL CHECK (end_at   LIKE '____-__-__ __:__'),
  status   TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','batal')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (datetime(end_at) > datetime(start_at))
);

-- Index to accelerate the typical schedule query
CREATE INDEX IF NOT EXISTS idx_bookings_court_start_status
  ON bookings (court_id, start_at, status);

-- Trigger: prevent overlapping ACTIVE bookings on INSERT
CREATE TRIGGER IF NOT EXISTS trg_bookings_no_overlap_insert
BEFORE INSERT ON bookings
FOR EACH ROW
WHEN NEW.status = 'aktif' AND EXISTS (
  SELECT 1 FROM bookings
  WHERE court_id = NEW.court_id
    AND status = 'aktif'
    AND NEW.start_at < end_at
    AND NEW.end_at   > start_at
)
BEGIN
  SELECT RAISE(ABORT, 'Overlapping active booking');
END;

-- Trigger: prevent overlapping ACTIVE bookings on UPDATE
CREATE TRIGGER IF NOT EXISTS trg_bookings_no_overlap_update
BEFORE UPDATE ON bookings
FOR EACH ROW
WHEN NEW.status = 'aktif' AND EXISTS (
  SELECT 1 FROM bookings
  WHERE court_id = NEW.court_id
    AND status = 'aktif'
    AND id <> NEW.id
    AND NEW.start_at < end_at
    AND NEW.end_at   > start_at
)
BEGIN
  SELECT RAISE(ABORT, 'Overlapping active booking');
END;

INSERT OR IGNORE INTO courts (id, name) VALUES (1, 'Lapangan A'), (2, 'Lapangan B');