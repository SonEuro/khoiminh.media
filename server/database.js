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
try { db.prepare("ALTER TABLE transactions ADD COLUMN deleted_at TEXT DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE transactions ADD COLUMN deleted_by_id INTEGER DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE transactions ADD COLUMN deleted_by_name TEXT DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE transactions ADD COLUMN deleted_reason TEXT DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE events ADD COLUMN archived_at TEXT DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE equipment ADD COLUMN qty_reserved INTEGER DEFAULT 0").run(); } catch (_) {}
try { db.prepare("ALTER TABLE users ADD COLUMN is_truong_phong INTEGER DEFAULT 0").run(); } catch (_) {}
try { db.prepare("ALTER TABLE events ADD COLUMN created_by_id INTEGER DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE event_reports ADD COLUMN reporter_user_id INTEGER DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE users ADD COLUMN zalo_uid TEXT DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE events ADD COLUMN created_by_role TEXT DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE users ADD COLUMN is_phan_lich INTEGER DEFAULT 0").run(); } catch (_) {}
try { db.prepare("ALTER TABLE users ADD COLUMN is_phan_lich_all INTEGER DEFAULT 0").run(); } catch (_) {}
try { db.prepare("ALTER TABLE users ADD COLUMN is_tra_ncc INTEGER DEFAULT 0").run(); } catch (_) {}

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

// Migration: thêm job_content + timeline vào event_reports nếu chưa có
const erCols = db.pragma('table_info(event_reports)').map(c => c.name);
if (!erCols.includes('job_content')) {
  db.exec("ALTER TABLE event_reports ADD COLUMN job_content TEXT");
  console.log('[DB] Migration: thêm cột job_content vào event_reports');
}
if (!erCols.includes('timeline')) {
  db.exec("ALTER TABLE event_reports ADD COLUMN timeline TEXT DEFAULT '[]'");
  console.log('[DB] Migration: thêm cột timeline vào event_reports');
}

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
if (!eventCols.includes('start_dates')) {
  db.exec("ALTER TABLE events ADD COLUMN start_dates TEXT");
  console.log('[DB] Migration: thêm cột start_dates vào events');
}
if (!eventCols.includes('end_dates')) {
  db.exec("ALTER TABLE events ADD COLUMN end_dates TEXT");
  console.log('[DB] Migration: thêm cột end_dates vào events');
}

// Migration: thêm cột notes + start_times + km_support cho từng phase trong work_schedules
const wsCols = db.pragma('table_info(work_schedules)').map(c => c.name);
for (const p of ['setup', 'teardown', 'rehearsal', 'filming']) {
  if (!wsCols.includes(`${p}_notes`)) {
    db.exec(`ALTER TABLE work_schedules ADD COLUMN ${p}_notes TEXT DEFAULT ''`);
    console.log(`[DB] Migration: thêm cột ${p}_notes vào work_schedules`);
  }
  if (!wsCols.includes(`${p}_start_times`)) {
    db.exec(`ALTER TABLE work_schedules ADD COLUMN ${p}_start_times TEXT DEFAULT '{}'`);
    console.log(`[DB] Migration: thêm cột ${p}_start_times vào work_schedules`);
  }
  if (!wsCols.includes(`${p}_km_support`)) {
    db.exec(`ALTER TABLE work_schedules ADD COLUMN ${p}_km_support TEXT DEFAULT '{}'`);
    console.log(`[DB] Migration: thêm cột ${p}_km_support vào work_schedules`);
  }
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

// Bảng lịch sử chỉnh sửa lịch làm việc
db.exec(`
  CREATE TABLE IF NOT EXISTS work_schedule_edits (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id    INTEGER REFERENCES work_schedules(id) ON DELETE CASCADE,
    edited_by_id   INTEGER,
    edited_by_name TEXT,
    action         TEXT DEFAULT 'edit',
    edited_at      TEXT DEFAULT (datetime('now','localtime'))
  );
`);

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

// Bảng nghĩa vụ báo cáo của nhóm trưởng
db.exec(`
  CREATE TABLE IF NOT EXISTS lead_report_obligations (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id       INTEGER NOT NULL REFERENCES work_schedules(id) ON DELETE CASCADE,
    event_id          INTEGER,
    event_name        TEXT,
    lead_name         TEXT NOT NULL,
    user_id           INTEGER,
    phase             TEXT NOT NULL,
    assigned_date     TEXT NOT NULL,
    deadline          TEXT NOT NULL,
    violation_created INTEGER DEFAULT 0,
    created_at        TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(schedule_id, lead_name, phase, assigned_date)
  );
`);

// Migration: thêm cột dismissed vào lead_report_obligations
const oblCols = db.pragma('table_info(lead_report_obligations)').map(c => c.name);
if (!oblCols.includes('dismissed')) {
  db.prepare('ALTER TABLE lead_report_obligations ADD COLUMN dismissed INTEGER DEFAULT 0').run();
  console.log('[DB] Migration: thêm cột dismissed vào lead_report_obligations');
}

// Migration: đổi tên Ngô Văn Hào → Ngô Văn Hảo
const oldName = 'Ngô Văn Hào', newName = 'Ngô Văn Hảo';
const hasOldName = db.prepare('SELECT 1 FROM users WHERE full_name = ? LIMIT 1').get(oldName);
if (hasOldName) {
  db.prepare('UPDATE users SET full_name = ? WHERE full_name = ?').run(newName, oldName);
  db.prepare('UPDATE lead_report_obligations SET lead_name = ? WHERE lead_name = ?').run(newName, oldName);
  db.prepare('UPDATE violations SET violator = ? WHERE violator = ?').run(newName, oldName);
  console.log('[DB] Migration: đổi tên Ngô Văn Hào → Ngô Văn Hảo');
}

// Migration: đồng bộ tên sự kiện từ events sang các bảng liên quan
try {
  db.prepare(`
    UPDATE work_schedules SET event_name = (SELECT name FROM events WHERE events.id = work_schedules.event_id)
    WHERE event_id IS NOT NULL AND EXISTS (SELECT 1 FROM events WHERE events.id = work_schedules.event_id)
  `).run();
  db.prepare(`
    UPDATE lead_report_obligations SET event_name = (SELECT name FROM events WHERE events.id = lead_report_obligations.event_id)
    WHERE event_id IS NOT NULL AND EXISTS (SELECT 1 FROM events WHERE events.id = lead_report_obligations.event_id)
  `).run();
  db.prepare(`
    UPDATE violations SET event_label = (SELECT name FROM events WHERE events.id = violations.event_id)
    WHERE event_id IS NOT NULL AND EXISTS (SELECT 1 FROM events WHERE events.id = violations.event_id)
  `).run();
  db.prepare(`
    UPDATE event_reports SET event_label = (SELECT name FROM events WHERE events.id = event_reports.event_id)
    WHERE event_id IS NOT NULL AND EXISTS (SELECT 1 FROM events WHERE events.id = event_reports.event_id)
  `).run();
} catch (e) { console.error('[DB] Migration sync event names:', e.message); }

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

// Bảng danh sách nhân sự theo bộ phận
db.exec(`
  CREATE TABLE IF NOT EXISTS staff_groups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL,
    dept       TEXT NOT NULL,
    members    TEXT DEFAULT '[]',
    updated_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(type, dept)
  );
`);

// Seed staff_groups từ danh sách mặc định nếu chưa có
const staffCount = db.prepare("SELECT COUNT(*) AS c FROM staff_groups").get().c;
if (staffCount === 0) {
  const KM_SEED = [
    { dept: 'ATAS-LED', members: ['Hà Minh Tâm','Trần Nhật Duy','Lê Trần Hoài Vĩ','Huỳnh Sự','Trương Lê Trung Tín','Lê Trọng Đức'] },
    { dept: 'Sân Khấu', members: ['Trần Duy Hùng','Nguyễn Trường Chinh','Hứa Khắc Cần','Phạm Đăng Sinh','Nguyễn Ngọc Ly','Phạm Hữu Phúc Khang'] },
    { dept: 'Kỹ Thuật', members: ['Nguyễn Văn Linh','Nguyễn Trí Tài','Võ Chí Thiện','Lê Anh Kiệt','Nguyễn Thanh Sang','Phan Khắc Luyện','Vũ Đức Tài','Đỗ Quý Vượng','Nguyễn Thành Trung','Phan Ngọc Mạnh','Trần Đình Cương','Hồ Văn Toàn','Hồ Bảo Trường','Trần Triệu Vĩ','Hoàng Văn Tuân'] },
    { dept: 'Cơ Sở Vật Chất', members: ['Đào Chí Hải','Ngô Văn Hảo'] },
    { dept: 'Kế Toán', members: ['Đào Thái Hiền','Vũ Thị Hà','Lâm Kiều Duyên','Nguyễn Thị Anh Thư','Nguyễn Kim Huệ'] },
    { dept: 'Kinh Doanh', members: ['Nguyễn Thế Sơn','Lâm Tấn Nhân','Đào Nguyên Sơn'] },
  ];
  const FL_SEED = [
    { dept: 'ATAS-LED', members: ['Đặng Hoàng Bi','Đỗ Hoàng Anh','Đỗ Thành Quang','Đoàn Quốc Vũ','Lê Nguyễn Minh Kỳ','Ngô Công Thành Danh','Nguyễn Hữu Quang','Nguyễn Ngọc Đăng Khoa','Nguyễn Thanh Tài','Nguyễn Văn Huy','Nguyễn Văn Tồn','Phạm Trắc','Trần Đình Quang','Trần Quang Nhật','Phạm Hữu Thuận','Nguyễn Lê Hoàng','Phan Văn Tân'] },
    { dept: 'Sân Khấu', members: ['Hà Văn Lộc','Lâm Văn Khánh','Nguyễn Anh Hoàng','Nguyễn Phúc Vinh','Nguyễn Thành Nghĩa','Nguyẽn Trình Cát Long','Nguyễn Trung Tín','Nguyễn Văn Dũng','Nguyễn Văn Hậu','Phan Đình Phước','Phan Quốc Tuấn','Nguyễn Văn Nam'] },
    { dept: 'Kỹ Thuật', members: ['Đinh Vĩnh Hảo','Hoàng Tuấn Linh','Mai Đức Anh Quang','Mai Đức Minh Quang','Nguyễn Chí Sơn','Nguyễn Trương Hạ Nguyên','Nguyễn Duy Khanh','Nguyễn Duy Vũ','Nguyễn Hoài Nam','Nguyễn Hoàng Nam','Nguyễn Minh Duy','Nguyễn Thanh Phong','Nguyễn Thanh Tâm','Nguyễn Trung Tuyến','Nguyễn Võ Hạnh Phúc','Vi Minh Gia Bảo','Võ Đức Hoà','Huỳnh Văn Nam','Lê Bá Đại Thành','Lê Ngọc Tuấn Kiệt','Lê Quốc Toàn','Lê Văn Tuấn','Nguyễn Lê Nhu','Nguyễn Lê Trung Nghĩa','Nguyễn Mậu Nam','Nguyễn Ngọc Thái','Nguyễn Nhựt Duy','Nguyễn Phước Sang','Nguyễn Quốc Trung - Nát','Nguyễn Quốc Trung','Nguyễn Văn Dụ','Nguyễn Văn Hiệu','Phan Minh Trí','Trần Minh Nguyên','Trần Trung Kiên','Vũ Minh Anh','Đỗ Ngô Trung Hiếu','Hoàng Hải','Nguyễn Trọng Nhân','Nguyễn Bảo Trọng','Nguyễn Tiến'] },
    { dept: 'Quay Phim', members: ['Hứa Khắc Tuân','Hứa Anh Đức','Đặng Đình Bảo','Nguyễn Quang Huy','Huỳnh Trung Quân','Nguyễn Hồng Nam','Huỳnh Châu Thông','Lê Đức Thành','Nguyễn Phi Vũ','Nguyễn Tấn Đạt','Nguyễn Tấn Lực','Nguyễn Trung Kiên','Lê Văn Hải','Trần Minh Luân','Nguyễn Xuân Vinh','Phạm Công Năng','Nguyễn Lâm Thiên Nhân','Phạm Văn Hoàng','Phạm Văn Vững','Nguyễn Tấn Lanh','Đinh Hữu Trí','Nguyễn Tấn Tài','Mai Nguyễn Văn Khoa','Nguyễn Anh Thành','Tống Hoàng Lộc','Phan Thanh Duy','Nguyễn Tấn Phước','Huỳnh Phi Công','Vũ Văn Hường','Diệp Phước Thành','Đoàn Văn Huy','Hứa Duy Trung','Phạm Quốc Tấn','Mai Tiến Đạt','Nguyễn Hoàng Duy Minh','Trần Quốc Huy'] },
    { dept: 'Sản Xuất', members: ['Phan Khánh Hà','Lưu Thị Ngọc Lam'] },
  ];
  const ins = db.prepare('INSERT OR IGNORE INTO staff_groups (type, dept, members) VALUES (?, ?, ?)');
  const seedAll = db.transaction(() => {
    for (const g of KM_SEED) ins.run('km', g.dept, JSON.stringify(g.members));
    for (const g of FL_SEED) ins.run('freelancer', g.dept, JSON.stringify(g.members));
  });
  seedAll();
  console.log('[DB] Seed: staff_groups');
}

module.exports = db;
