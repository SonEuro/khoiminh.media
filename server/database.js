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
try { db.prepare("ALTER TABLE event_reports ADD COLUMN confirmed_at TEXT DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE event_reports ADD COLUMN confirmed_by_id INTEGER DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE event_reports ADD COLUMN edit_history TEXT DEFAULT '[]'").run(); } catch (_) {}
try { db.prepare("ALTER TABLE events ADD COLUMN departments TEXT DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE transaction_items ADD COLUMN combo TEXT DEFAULT NULL").run(); } catch (_) {}
try { db.prepare("ALTER TABLE users ADD COLUMN is_quan_ly_kho INTEGER DEFAULT 0").run(); } catch (_) {}
try { db.prepare("ALTER TABLE users ADD COLUMN is_giam_doc INTEGER DEFAULT 0").run(); } catch (_) {}
try { db.prepare("ALTER TABLE users ADD COLUMN is_van_hanh_ke_toan INTEGER DEFAULT 0").run(); } catch (_) {}
try { db.prepare("ALTER TABLE events ADD COLUMN is_exempt INTEGER DEFAULT 0").run(); } catch (_) {}
try { db.prepare("ALTER TABLE work_schedules ADD COLUMN exempt_dates TEXT DEFAULT '[]'").run(); } catch (_) {}
try { db.prepare("ALTER TABLE users ADD COLUMN phep_nam INTEGER DEFAULT 12").run(); } catch (_) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS ngay_phep (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ngay       TEXT NOT NULL,
    so_ngay    REAL NOT NULL DEFAULT 1,
    ghi_chu    TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS ncc_suppliers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    dept       TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active  INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE IF NOT EXISTS ncc_equipment (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL REFERENCES ncc_suppliers(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    unit        TEXT DEFAULT 'Cái',
    qty         INTEGER DEFAULT 1,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// Backfill location từ events table cho các báo cáo cũ chưa có địa điểm
try {
  db.prepare(`
    UPDATE event_reports
    SET location = (SELECT location FROM events WHERE id = event_reports.event_id)
    WHERE event_id IS NOT NULL
      AND (location IS NULL OR location = '')
      AND EXISTS (SELECT 1 FROM events WHERE id = event_reports.event_id AND location IS NOT NULL AND location != '')
  `).run();
} catch (_) {}

// Infer departments cho events cũ dựa trên km_staff trong work_schedule
try {
  const sgRows = db.prepare("SELECT dept, members FROM staff_groups WHERE type='km'").all();
  const nameToDept = {};
  for (const g of sgRows) {
    try {
      for (const name of JSON.parse(g.members || '[]')) {
        if (name && !nameToDept[name]) nameToDept[name] = g.dept;
      }
    } catch (_) {}
  }
  const evRows = db.prepare(`
    SELECT e.id, ws.setup_km_staff, ws.teardown_km_staff, ws.rehearsal_km_staff, ws.filming_km_staff
    FROM events e JOIN work_schedules ws ON ws.event_id = e.id
    WHERE e.departments IS NULL
  `).all();
  const upd = db.prepare('UPDATE events SET departments = ? WHERE id = ? AND departments IS NULL');
  for (const ev of evRows) {
    const depts = new Set();
    for (const ph of ['setup', 'teardown', 'rehearsal', 'filming']) {
      try {
        const km = JSON.parse(ev[`${ph}_km_staff`] || '[]');
        const arr = Array.isArray(km) ? km : Object.values(km).flat();
        for (const name of arr) { if (name && nameToDept[name]) depts.add(nameToDept[name]); }
      } catch (_) {}
    }
    if (depts.size > 0) upd.run(JSON.stringify([...depts]), ev.id);
  }
} catch (_) {}

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

// Migration: soft delete columns cho event_reports
{
  const cols = db.pragma('table_info(event_reports)').map(c => c.name);
  if (!cols.includes('deleted_at'))   db.exec("ALTER TABLE event_reports ADD COLUMN deleted_at TEXT DEFAULT NULL");
  if (!cols.includes('deleted_by_id')) db.exec("ALTER TABLE event_reports ADD COLUMN deleted_by_id INTEGER DEFAULT NULL");
}

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

// Migration: thêm no_lunch_break, no_afternoon_break, is_holiday vào event_reports
{
  const erCols2 = db.pragma('table_info(event_reports)').map(c => c.name);
  if (!erCols2.includes('no_lunch_break')) {
    db.exec('ALTER TABLE event_reports ADD COLUMN no_lunch_break INTEGER DEFAULT 0');
    console.log('[DB] Migration: thêm cột no_lunch_break vào event_reports');
  }
  if (!erCols2.includes('no_afternoon_break')) {
    db.exec('ALTER TABLE event_reports ADD COLUMN no_afternoon_break INTEGER DEFAULT 0');
    console.log('[DB] Migration: thêm cột no_afternoon_break vào event_reports');
  }
  if (!erCols2.includes('is_holiday')) {
    db.exec('ALTER TABLE event_reports ADD COLUMN is_holiday INTEGER DEFAULT 0');
    console.log('[DB] Migration: thêm cột is_holiday vào event_reports');
  }
}

// Migration: thêm các cột phụ cấp vào event_reports
{
  const erCols3 = db.pragma('table_info(event_reports)').map(c => c.name);
  for (const col of ['has_com_sang','has_com_trua','has_com_chieu','has_com_toi','has_nuoc','has_taxi']) {
    if (!erCols3.includes(col)) {
      db.exec(`ALTER TABLE event_reports ADD COLUMN ${col} INTEGER DEFAULT 0`);
      console.log(`[DB] Migration: thêm cột ${col} vào event_reports`);
    }
  }
  if (!erCols3.includes('taxi_amount')) {
    db.exec(`ALTER TABLE event_reports ADD COLUMN taxi_amount TEXT DEFAULT NULL`);
    console.log('[DB] Migration: thêm cột taxi_amount vào event_reports');
  }
}

// Migration: 4 cột phụ cấp thủ công (nhập trong XacNhanCong)
{
  const erCols4 = db.pragma('table_info(event_reports)').map(c => c.name);
  for (const col of ['xang_xe', 'tien_nuoc', 'giu_xe', 'phu_cap_khac']) {
    if (!erCols4.includes(col)) {
      db.exec(`ALTER TABLE event_reports ADD COLUMN ${col} INTEGER DEFAULT 0`);
      console.log(`[DB] Migration: thêm cột ${col} vào event_reports`);
    }
    if (!erCols4.includes(`${col}_note`)) {
      db.exec(`ALTER TABLE event_reports ADD COLUMN ${col}_note TEXT DEFAULT ''`);
      console.log(`[DB] Migration: thêm cột ${col}_note vào event_reports`);
    }
  }
}

// Migration: per-person allowances JSON
{
  const erCols5 = db.pragma('table_info(event_reports)').map(c => c.name);
  if (!erCols5.includes('per_person_allowances')) {
    db.exec("ALTER TABLE event_reports ADD COLUMN per_person_allowances TEXT DEFAULT NULL");
    console.log('[DB] Migration: thêm cột per_person_allowances vào event_reports');
  }
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

// Migration: soft delete cho work_schedules
{
  const cols = db.pragma('table_info(work_schedules)').map(c => c.name);
  if (!cols.includes('deleted_at')) db.exec("ALTER TABLE work_schedules ADD COLUMN deleted_at TEXT DEFAULT NULL");
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
// Migration: thêm cột is_lead (1 = được chỉ định lead, 0 = fallback reporter)
if (!oblCols.includes('is_lead')) {
  db.prepare('ALTER TABLE lead_report_obligations ADD COLUMN is_lead INTEGER DEFAULT 1').run();
  console.log('[DB] Migration: thêm cột is_lead vào lead_report_obligations');
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
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE IF NOT EXISTS report_delete_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id       INTEGER NOT NULL,
    event_label     TEXT,
    event_date      TEXT,
    reporter_name   TEXT,
    report_summary  TEXT,
    deleted_by_id   INTEGER,
    deleted_by_name TEXT,
    deleted_at      TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE IF NOT EXISTS staff_flags (
    name      TEXT PRIMARY KEY,
    van_phong INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS violation_delete_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    violation_id    INTEGER NOT NULL,
    violator        TEXT,
    violation_type  TEXT,
    description     TEXT,
    deleted_by_id   INTEGER,
    deleted_by_name TEXT,
    deleted_at      TEXT DEFAULT (datetime('now','localtime'))
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

// ── Salary rate columns ─────────────────────────────────────────────────────
try { db.prepare("ALTER TABLE users ADD COLUMN luong_co_ban INTEGER DEFAULT 0").run(); } catch (_) {}
try { db.prepare("ALTER TABLE users ADD COLUMN luong_ngay_cong INTEGER DEFAULT 0").run(); } catch (_) {}
try { db.prepare("ALTER TABLE users ADD COLUMN luong_ot_h INTEGER DEFAULT 0").run(); } catch (_) {}
try { db.prepare("ALTER TABLE users ADD COLUMN bac_luong TEXT DEFAULT ''").run(); } catch (_) {}
// luong_theo_thang: LCB + LNC × số ngày trong tháng (thay vì LNC × công thực tế)
try { db.prepare("ALTER TABLE users ADD COLUMN luong_theo_thang INTEGER DEFAULT 0").run(); } catch (_) {}
try {
  const setThang = db.prepare("UPDATE users SET luong_theo_thang = 1 WHERE full_name = ? AND luong_theo_thang = 0");
  ['Huỳnh Sự', 'Vũ Đức Tài', 'Đỗ Quý Vượng'].forEach(n => setThang.run(n));
} catch (_) {}
{
  const SALARY_DATA = [
    ['Trần Nhật Duy',        5500000, 230000, 38000],
    ['Lê Trần Hoài Vĩ',     4500000, 200000, 35000],
    ['Huỳnh Sự',             5500000, 230000, 38000],
    ['Trương Lê Trung Tín',  5500000, 230000, 38000],
    ['Nguyễn Trường Chinh',  4500000, 170000, 32000],
    ['Hứa Khắc Cần',         6500000, 260000, 41000],
    ['Phạm Đăng Sinh',       4000000, 170000, 32000],
    ['Nguyễn Ngọc Ly',       5500000, 260000, 41000],
    ['Phạm Hữu Phúc Khang',  4000000, 170000, 32000],
    ['Nguyễn Trí Tài',       4500000, 200000, 35000],
    ['Võ Chí Thiện',         5500000, 200000, 35000],
    ['Lê Anh Kiệt',          4500000, 200000, 35000],
    ['Nguyễn Thanh Sang',    4500000, 200000, 35000],
    ['Phan Khắc Luyện',      4500000, 170000, 32000],
    ['Đỗ Quý Vượng',         3500000, 170000, 32000],
    ['Nguyễn Thành Trung',   4000000, 170000, 32000],
    ['Phan Ngọc Mạnh',       3500000, 170000, 32000],
    ['Trần Đình Cương',      3500000, 140000, 29000],
    ['Hồ Văn Toàn',          3000000, 140000, 29000],
    ['Hồ Bảo Trường',        3000000, 140000, 29000],
    ['Trần Triệu Vĩ',        3000000, 140000, 29000],
    ['Hoàng Văn Tuân',       3000000, 140000, 29000],
    ['Ngô Văn Hảo',          4500000, 170000, 32000],
    ['Nguyễn Hoàng Gia Bảo', 2500000, 140000, 29000],
  ];
  const upd = db.prepare('UPDATE users SET luong_co_ban=?, luong_ngay_cong=?, luong_ot_h=? WHERE full_name=? AND (luong_co_ban IS NULL OR luong_co_ban=0)');
  for (const [name, lcb, lnc, lot] of SALARY_DATA) upd.run(lcb, lnc, lot, name);
}

// ── Indexes ────────────────────────────────────────────────────────────────
// SQLite không tự tạo index cho foreign keys — phải tạo thủ công
db.exec(`
  -- transactions: các cột được WHERE/JOIN thường xuyên nhất
  CREATE INDEX IF NOT EXISTS idx_tx_event_id   ON transactions(event_id);
  CREATE INDEX IF NOT EXISTS idx_tx_type        ON transactions(type);
  CREATE INDEX IF NOT EXISTS idx_tx_status      ON transactions(status);
  CREATE INDEX IF NOT EXISTS idx_tx_deleted_at  ON transactions(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_tx_type_status ON transactions(type, status);

  -- transaction_items: JOIN với transactions và equipment
  CREATE INDEX IF NOT EXISTS idx_ti_transaction_id ON transaction_items(transaction_id);
  CREATE INDEX IF NOT EXISTS idx_ti_equipment_id   ON transaction_items(equipment_id);

  -- external_items: JOIN với transactions
  CREATE INDEX IF NOT EXISTS idx_ei_transaction_id ON external_items(transaction_id);

  -- events: lọc theo status và soft delete
  CREATE INDEX IF NOT EXISTS idx_events_status     ON events(status);
  CREATE INDEX IF NOT EXISTS idx_events_deleted_at ON events(deleted_at);

  -- work_schedules: JOIN với events
  CREATE INDEX IF NOT EXISTS idx_ws_event_id ON work_schedules(event_id);

  -- lead_report_obligations: lọc theo schedule và user
  CREATE INDEX IF NOT EXISTS idx_lro_schedule_id ON lead_report_obligations(schedule_id);
  CREATE INDEX IF NOT EXISTS idx_lro_user_id     ON lead_report_obligations(user_id);

  -- transaction_edits: JOIN với transactions
  CREATE INDEX IF NOT EXISTS idx_tedits_transaction_id ON transaction_edits(transaction_id);
`);

module.exports = db;
