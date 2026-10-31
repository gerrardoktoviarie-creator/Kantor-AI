PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS courts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  court_id INTEGER NOT NULL,
  customer TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktif',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT fk_bookings_court FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE RESTRICT,
  CONSTRAINT chk_bookings_time_format CHECK (start_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]'
    AND end_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]'),
  CONSTRAINT chk_bookings_end_after_start CHECK (end_at > start_at),
  CONSTRAINT chk_bookings_status CHECK (status IN ('aktif','batal')),
  INDEX idx_bookings_court_status_time (court_id, status, start_at)
);

CREATE TRIGGER IF NOT EXISTS bookings_overlap_check
BEFORE INSERT ON bookings
WHEN NEW.status = 'aktif'
BEGIN
  SELECT RAISE(ABORT, 'Tumpang tindih: ada booking aktif lain di lapangan ini pada jam yang sama')
  WHERE EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.court_id = NEW.court_id
      AND b.status = 'aktif'
      AND b.start_at < NEW.end_at
      AND b.end_at > NEW.start_at
  );
END;

CREATE TRIGGER IF NOT EXISTS bookings_overlap_check_update
BEFORE UPDATE ON bookings
WHEN NEW.status = 'aktif'
BEGIN
  SELECT RAISE(ABORT, 'Tumpang tindih: ada booking aktif lain di lapangan ini pada jam yang sama')
  WHERE EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.court_id = NEW.court_id
      AND b.id != NEW.id
      AND b.status = 'aktif'
      AND b.start_at < NEW.end_at
      AND b.end_at > NEW.start_at
  );
END;

INSERT OR IGNORE INTO courts (id, name) VALUES (1, 'Lapangan A'), (2, 'Lapangan B');
INSERT OR IGNORE INTO bookings (id, court_id, customer, start_at, end_at, status) VALUES
  (1, 1, 'Budi Santoso', '2026-11-07 19:00', '2026-11-07 20:00', 'aktif'),
  (2, 1, 'Siti Aminah', '2026-11-07 20:00', '2026-11-07 21:00', 'aktif'),
  (3, 2, 'Rizky Pratama', '2026-11-07 18:00', '2026-11-07 19:00', 'batal');