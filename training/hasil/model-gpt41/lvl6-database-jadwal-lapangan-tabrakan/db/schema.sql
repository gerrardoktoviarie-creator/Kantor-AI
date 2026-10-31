PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS courts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  court_id INTEGER NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  customer TEXT NOT NULL,
  start_at TEXT NOT NULL CHECK (
    typeof(start_at) = 'text'
    AND length(start_at) = 16
    AND substr(start_at,5,1) = '-'
    AND substr(start_at,8,1) = '-'
    AND substr(start_at,11,1) = ' '
    AND substr(start_at,14,1) = ':'
  ),
  end_at TEXT NOT NULL CHECK (
    typeof(end_at) = 'text'
    AND length(end_at) = 16
    AND substr(end_at,5,1) = '-'
    AND substr(end_at,8,1) = '-'
    AND substr(end_at,11,1) = ' '
    AND substr(end_at,14,1) = ':'
    AND end_at > start_at
  ),
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','batal')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index untuk query jadwal per lapangan per hari
CREATE INDEX IF NOT EXISTS idx_bookings_court_start_status 
  ON bookings (court_id, start_at, status);

-- Trigger: updated_at otomatis
CREATE TRIGGER IF NOT EXISTS trg_bookings_updated_at
AFTER UPDATE ON bookings
FOR EACH ROW
BEGIN
  UPDATE bookings SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger: Cek tumpang tindih saat INSERT (hanya status 'aktif')
CREATE TRIGGER IF NOT EXISTS trg_bookings_no_overlap_insert
BEFORE INSERT ON bookings
FOR EACH ROW
WHEN NEW.status = 'aktif'
BEGIN
  -- Tabrakan jika: start_baru < end_lama AND end_baru > start_lama
  -- Hanya yang status 'aktif' (batal nggak ngeblok)
  SELECT RAISE(ABORT, 'Jadwal bertabrakan')
  WHERE EXISTS (
    SELECT 1 FROM bookings
    WHERE court_id = NEW.court_id
      AND status = 'aktif'
      AND NEW.start_at < end_at
      AND NEW.end_at > start_at
  );
END;

-- Trigger: Cek tumpang tindih saat UPDATE (hanya kalau status 'aktif')
CREATE TRIGGER IF NOT EXISTS trg_bookings_no_overlap_update
BEFORE UPDATE ON bookings
FOR EACH ROW
WHEN NEW.status = 'aktif'
BEGIN
  SELECT RAISE(ABORT, 'Jadwal bertabrakan')
  WHERE EXISTS (
    SELECT 1 FROM bookings
    WHERE court_id = NEW.court_id
      AND status = 'aktif'
      AND id != NEW.id
      AND NEW.start_at < end_at
      AND NEW.end_at > start_at
  );
END;

INSERT OR IGNORE INTO courts (id, name) VALUES (1, 'Lapangan A'), (2, 'Lapangan B');
