const Database = require("better-sqlite3");

const db = new Database("tracker.db");

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ozon_product_id TEXT NOT NULL UNIQUE,
  name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  target_price INTEGER,
  target_triggered INTEGER NOT NULL DEFAULT 0
);

  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    price INTEGER NOT NULL,
    timestamp TEXT NOT NULL,

    FOREIGN KEY (product_id)
      REFERENCES products(id)
      ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_price_history_product_timestamp
  ON price_history(product_id, timestamp);
`);

module.exports = db;
