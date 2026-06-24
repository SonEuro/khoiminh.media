const Database = require('better-sqlite3');
const path = require('path');
const fs   = require('fs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'kho.db');

// Tạo thư mục nếu chưa có (cần thiết khi disk mới mount)
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

console.log(`[DB] Sử dụng database tại: ${DB_PATH}`);
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

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    position      TEXT DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'ATAS',
    is_active     INTEGER DEFAULT 1,
    created_at    TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// Migrations
try { db.prepare("ALTER TABLE users ADD COLUMN position TEXT DEFAULT ''").run(); } catch (_) {}
try { db.prepare("ALTER TABLE events ADD COLUMN created_by TEXT DEFAULT ''").run(); } catch (_) {}
try { db.prepare("ALTER TABLE events ADD COLUMN deleted_at TEXT DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE events ADD COLUMN filming_date TEXT DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE transactions ADD COLUMN created_by_id INTEGER DEFAULT NULL").run(); } catch (_) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS event_reports (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id         INTEGER REFERENCES events(id),
    event_label      TEXT,
    location         TEXT,
    report_date      TEXT,
    km_staff         TEXT DEFAULT '[]',
    freelancer_staff TEXT,
    time_present     TEXT,
    time_onset       TEXT,
    time_off         TEXT,
    time_end         TEXT,
    incomplete       TEXT,
    incidents        TEXT,
    progress         TEXT,
    completed_work   TEXT,
    service_quality  TEXT,
    images           TEXT DEFAULT '[]',
    reporter_name    TEXT,
    created_at       TEXT DEFAULT (datetime('now','localtime'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS external_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    supplier       TEXT NOT NULL,
    name           TEXT NOT NULL,
    quantity       INTEGER DEFAULT 1,
    notes          TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS violations (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id       INTEGER REFERENCES events(id),
    event_label    TEXT DEFAULT 'Nội bộ',
    reporter_name  TEXT NOT NULL,
    violator       TEXT NOT NULL,
    violation_type TEXT,
    description    TEXT,
    images         TEXT DEFAULT '[]',
    created_at     TEXT DEFAULT (datetime('now','localtime'))
  );
`);

module.exports = db;
