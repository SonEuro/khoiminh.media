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
try { db.prepare("ALTER TABLE events ADD COLUMN archived_at TEXT DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE equipment ADD COLUMN qty_reserved INTEGER DEFAULT 0").run(); } catch (_) {}
try { db.prepare("ALTER TABLE users ADD COLUMN is_truong_phong INTEGER DEFAULT 0").run(); } catch (_) {}
try { db.prepare("ALTER TABLE events ADD COLUMN created_by_id INTEGER DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE event_reports ADD COLUMN reporter_user_id INTEGER DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE users ADD COLUMN zalo_uid TEXT DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE events ADD COLUMN created_by_role TEXT DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE users ADD COLUMN is_phan_lich INTEGER DEFAULT 0").run(); } catch (_) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS work_schedules (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id            INTEGER REFERENCES events(id),
    event_name          TEXT NOT NULL,
    scheduler_user_id   INTEGER REFERENCES users(id),
    scheduler_name      TEXT,
    client              TEXT,
    location            TEXT,
    setup_date          TEXT,
    teardown_date       TEXT,
    rehearsal_date      TEXT,
    filming_date        TEXT,
    setup_leads         TEXT DEFAULT '[]',
    setup_km_staff      TEXT DEFAULT '[]',
    setup_freelancers   TEXT DEFAULT '',
    teardown_leads       TEXT DEFAULT '[]',
    teardown_km_staff    TEXT DEFAULT '[]',
    teardown_freelancers TEXT DEFAULT '',
    rehearsal_leads       TEXT DEFAULT '[]',
    rehearsal_km_staff    TEXT DEFAULT '[]',
    rehearsal_freelancers TEXT DEFAULT '',
    filming_leads       TEXT DEFAULT '[]',
    filming_km_staff    TEXT DEFAULT '[]',
    filming_freelancers TEXT DEFAULT '',
    status              TEXT DEFAULT 'draft',
    confirmed_at        TEXT,
    confirmed_by_id     INTEGER REFERENCES users(id),
    created_at          TEXT DEFAULT (datetime('now','localtime'))
  );
`);

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

// Migration: thêm filming_dates, show_dates, show_date vào events nếu chưa có
const eventCols = db.pragma('table_info(events)').map(c => c.name);
if (!eventCols.includes('filming_dates')) {
  db.exec("ALTER TABLE events ADD COLUMN filming_dates TEXT");
  console.log('[DB] Migration: thêm cột filming_dates vào events');
}
if (!eventCols.includes('show_dates')) {
  db.exec("ALTER TABLE events ADD COLUMN show_dates TEXT");
  console.log('[DB] Migration: thêm cột show_dates vào events');
}
if (!eventCols.includes('show_date')) {
  db.exec("ALTER TABLE events ADD COLUMN show_date TEXT DEFAULT NULL");
  console.log('[DB] Migration: thêm cột show_date vào events');
}

// Migration: thêm cột unit + rental_days vào external_items nếu chưa có
const extCols = db.pragma('table_info(external_items)').map(c => c.name);
if (!extCols.includes('unit')) {
  db.exec("ALTER TABLE external_items ADD COLUMN unit TEXT DEFAULT 'Cái'");
  console.log('[DB] Migration: thêm cột unit vào external_items');
}
if (!extCols.includes('rental_days')) {
  db.exec('ALTER TABLE external_items ADD COLUMN rental_days INTEGER DEFAULT 1');
  console.log('[DB] Migration: thêm cột rental_days vào external_items');
}

// Bảng lịch sử chỉnh sửa phiếu xuất đã xác nhận
db.exec(`
  CREATE TABLE IF NOT EXISTS transaction_edits (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    edited_by_id   INTEGER,
    edited_by_name TEXT,
    reason         TEXT NOT NULL,
    items_before   TEXT DEFAULT '[]',
    items_after    TEXT DEFAULT '[]',
    created_at     TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// Migration: reset qty_reserved = 0 (logic mới không dùng qty_reserved nữa)
// Pending exports chỉ ghi nhận, không trừ/reserve kho
const eqCols = db.pragma('table_info(equipment)').map(c => c.name);
if (eqCols.includes('qty_reserved')) {
  const hasReserved = db.prepare('SELECT SUM(qty_reserved) AS total FROM equipment').get();
  if (hasReserved?.total > 0) {
    db.prepare('UPDATE equipment SET qty_reserved = 0').run();
    console.log('[DB] Migration: reset qty_reserved = 0 (pending không reserve kho)');
  }
}

// Seed admin mặc định nếu chưa có user nào
const bcryptSeed = require('bcryptjs');
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  db.prepare(
    `INSERT INTO users (username, password_hash, full_name, role, is_active)
     VALUES (?, ?, ?, 'SUPER_ADMIN', 1)`
  ).run('admin', bcryptSeed.hashSync('admin123', 10), 'Admin');
  console.log('[DB] Seed: đã tạo user admin mặc định (admin/admin123)');
}

module.exports = db;
