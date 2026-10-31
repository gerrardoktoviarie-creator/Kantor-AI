PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS courts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  court_id INTEGER NOT NULL REFERENCES courts(id),
  customer TEXT NOT NULL,
  start_at TEXT NOT NULL CHECK (start_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]'),
  end_at TEXT NOT NULL CHECK (end_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]'),
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'batal')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_bookings_court_start_status
  ON bookings (court_id, start_at, status);

CREATE TRIGGER IF NOT EXISTS bookings_no_overlap_before_insert
  BEFORE INSERT ON bookings
  WHEN NEW.status = 'aktif'
  BEGIN
    SELECT RAISE(ABORT, 'booking bertabrakan dengan jadwal aktif lain di lapangan ini')
    WHERE EXISTS (
      SELECT 1 FROM bookings
      WHERE court_id = NEW.court_id
        AND status = 'aktif'
        AND NEW.start_at < end_at
        AND NEW.end_at > start_at
    );
  END;

CREATE TRIGGER IF NOT EXISTS bookings_no_overlap_before_update
  BEFORE UPDATE ON bookings
  WHEN OLD.status != NEW.status OR OLD.start_at != NEW.start_at OR OLD.end_at != NEW.end_at
  BEGIN
    SELECT RAISE(ABORT, 'booking bertabrakan dengan jadwal aktif lain di lapangan ini')
    WHERE NEW.status = 'aktif'
      AND EXISTS (
        SELECT 1 FROM bookings
        WHERE court_id = NEW.court_id
          AND status = 'aktif'
          AND id != NEW.id
          AND NEW.start_at < end_at
          AND NEW.end_at > start_at
      );
  END;

INSERT OR IGNORE INTO courts (id, name) VALUES (1, 'Lapangan A'), (2, 'Lapangan B');