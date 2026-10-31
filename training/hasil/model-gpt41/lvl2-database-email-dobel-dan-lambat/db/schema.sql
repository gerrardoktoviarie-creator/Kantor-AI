PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email COLLATE NOCASE)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total INTEGER NOT NULL CHECK (total >= 0),
  status TEXT NOT NULL DEFAULT 'baru' CHECK (status IN ('baru', 'dibayar', 'dikirim', 'selesai', 'batal')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_user_createdat ON orders(user_id, created_at DESC);

INSERT OR IGNORE INTO users (id, name, email) VALUES
  (1, 'Budi Santoso', 'budi@mail.com'),
  (2, 'Siti Aminah', 'siti@mail.com');