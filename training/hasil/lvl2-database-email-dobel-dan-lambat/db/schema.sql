PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  total INTEGER NOT NULL CHECK (total >= 0),
  status TEXT NOT NULL DEFAULT 'baru' CHECK (status IN ('baru', 'dibayar', 'dikirim', 'selesai', 'batal')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders (user_id, created_at DESC);

INSERT OR IGNORE INTO users (id, name, email) VALUES
  (1, 'Budi Santoso', 'budi@mail.com'),
  (2, 'Siti Aminah', 'siti@mail.com');

INSERT OR IGNORE INTO orders (id, user_id, total, status, created_at) VALUES
  (1, 1, 150000, 'dibayar', '2025-07-01T10:00:00'),
  (2, 1, 85000, 'selesai', '2025-06-28T14:30:00'),
  (3, 2, 230000, 'baru', '2025-07-03T09:15:00');
