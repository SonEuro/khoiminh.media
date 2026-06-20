const Database = require('better-sqlite3');
const path = require('path');

// Railway volume tại /data, local dùng thư mục server/
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'kho.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    icon TEXT DEFAULT '📦'
  );

  CREATE TABLE IF NOT EXISTS equipment (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    code             TEXT UNIQUE NOT NULL,
    name             TEXT NOT NULL,
    category_id      INTEGER REFERENCES categories(id),
    unit             TEXT DEFAULT 'Cái',
    unit_price       REAL DEFAULT 0,
    qty_total        INTEGER DEFAULT 0,
    qty_available    INTEGER DEFAULT 0,
    qty_in_use       INTEGER DEFAULT 0,
    qty_maintenance  INTEGER DEFAULT 0,
    qty_damaged      INTEGER DEFAULT 0,
    qty_lost         INTEGER DEFAULT 0,
    notes            TEXT,
    created_at       TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    client      TEXT,
    location    TEXT,
    start_date  TEXT,
    end_date    TEXT,
    status      TEXT DEFAULT 'planned',
    notes       TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    code                 TEXT UNIQUE NOT NULL,
    type                 TEXT NOT NULL,
    event_id             INTEGER REFERENCES events(id),
    responsible_person   TEXT,
    transaction_date     TEXT DEFAULT (datetime('now','localtime')),
    expected_return_date TEXT,
    notes                TEXT,
    status               TEXT DEFAULT 'completed',
    created_at           TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS transaction_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    equipment_id   INTEGER REFERENCES equipment(id),
    quantity       INTEGER NOT NULL,
    condition      TEXT DEFAULT 'good',
    notes          TEXT
  );
`);

module.exports = db;
