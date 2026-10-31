PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  total INTEGER NOT NULL CHECK (total >= 0),
  status TEXT NOT NULL DEFAULT 'baru' CHECK (status IN ('baru','dibayar','dikirim','selesai','batal')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index to speed up “SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC”
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);

INSERT OR IGNORE INTO users (id, name, email) VALUES
  (1, 'Budi Santoso', 'budi@mail.com'),
  (2, 'Siti Aminah', 'siti@mail.com');