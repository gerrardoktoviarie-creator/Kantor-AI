PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS courts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  court_id INTEGER NOT NULL REFERENCES courts(id),
  customer TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktif',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (court_id, start_at)
);

INSERT OR IGNORE INTO courts (id, name) VALUES (1, 'Lapangan A'), (2, 'Lapangan B');
