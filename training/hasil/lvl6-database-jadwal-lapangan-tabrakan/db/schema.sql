PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS courts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  court_id INTEGER NOT NULL,
  customer TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktif',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE RESTRICT,
  CHECK (status IN ('aktif', 'batal')),
  CHECK (start_at >= '0000-01-01 00:00' AND end_at >= '0000-01-01 00:00')
);

CREATE INDEX IF NOT EXISTS idx_bookings_court_active
  ON bookings (court_id, status, start_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_per_slot
  ON bookings (court_id, start_at, end_at)
  WHERE status = 'aktif';

CREATE TRIGGER IF NOT EXISTS bookings_check_overlap_before_insert
  BEFORE INSERT ON bookings
  WHEN NEW.status = 'aktif'
  BEGIN
    SELECT RAISE(ABORT,
      'Tabrakan jadwal: ada booking aktif lain di lapangan ini yang menumpuk dengan slot ini.')
    FROM bookings
    WHERE court_id = NEW.court_id
      AND status = 'aktif'
      AND NEW.start_at < end_at
      AND NEW.end_at > start_at;
  END;

CREATE TRIGGER IF NOT EXISTS bookings_check_overlap_before_update
  BEFORE UPDATE ON bookings
  WHEN OLD.status != NEW.status OR OLD.start_at != NEW.start_at OR OLD.end_at != NEW.end_at
  BEGIN
    SELECT RAISE(ABORT,
      'Tabrakan jadwal: ada booking aktif lain di lapangan ini yang menumpuk dengan slot ini.')
    FROM bookings
    WHERE court_id = NEW.court_id
      AND id != NEW.id
      AND status = 'aktif'
      AND NEW.start_at < end_at
      AND NEW.end_at > start_at;
  END;

CREATE TRIGGER IF NOT EXISTS bookings_check_duration_before_insert
  BEFORE INSERT ON bookings
  BEGIN
    SELECT RAISE(ABORT, 'end_at harus lebih besar dari start_at.')
    WHERE NEW.end_at <= NEW.start_at;
  END;

CREATE TRIGGER IF NOT EXISTS bookings_check_duration_before_update
  BEFORE UPDATE ON bookings
  WHEN OLD.start_at != NEW.start_at OR OLD.end_at != NEW.end_at
  BEGIN
    SELECT RAISE(ABORT, 'end_at harus lebih besar dari start_at.')
    WHERE NEW.end_at <= NEW.start_at;
  END;

CREATE TRIGGER IF NOT EXISTS bookings_check_time_format_before_insert
  BEFORE INSERT ON bookings
  BEGIN
    SELECT RAISE(ABORT, 'start_at/end_at harus berformat YYYY-MM-DD HH:MM, misal 2026-11-07 19:00.')
    WHERE NEW.start_at NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]'
       OR NEW.end_at NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]';
  END;

CREATE TRIGGER IF NOT EXISTS bookings_check_time_format_before_update
  BEFORE UPDATE ON bookings
  WHEN OLD.start_at != NEW.start_at OR OLD.end_at != NEW.end_at
  BEGIN
    SELECT RAISE(ABORT, 'start_at/end_at harus berformat YYYY-MM-DD HH:MM, misal 2026-11-07 19:00.')
    WHERE NEW.start_at NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]'
       OR NEW.end_at NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]';
  END;

INSERT OR IGNORE INTO courts (id, name) VALUES (1, 'Lapangan A'), (2, 'Lapangan B');