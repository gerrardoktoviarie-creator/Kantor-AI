PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  total INTEGER NOT NULL CHECK (total >= 0),
  status TEXT NOT NULL DEFAULT 'baru',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO users (id, name, email) VALUES
  (1, 'Budi Santoso', 'budi@mail.com'),
  (2, 'Siti Aminah', 'siti@mail.com');
