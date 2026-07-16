const db = require('../database');
const { pushByRoles } = require('./pushNotify');

const ALL_ROLES = ['DIRECTOR','SUPER_ADMIN','PRODUCTION','ACCOUNTING','TECHNICAL','ATAS','STAGE','CSVC'];

function todayVN() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

// Sự kiện "Kỹ Thuật" hôm nay chưa có phiếu xuất kho (completed OUT)
function getEventsKyThuatNoOut() {
  const today = todayVN();
  return db.prepare(`
    SELECT e.id, e.name, e.location, e.start_date, e.filming_date
    FROM events e
    WHERE e.deleted_at IS NULL
      AND e.archived_at IS NULL
      AND e.status NOT IN ('completed','cancelled')
      AND e.departments LIKE '%Kỹ Thuật%'
      AND (
        e.start_date = ?
        OR e.filming_date = ?
        OR (e.start_dates  IS NOT NULL AND e.start_dates  LIKE '%"' || ? || '"%')
        OR (e.filming_dates IS NOT NULL AND e.filming_dates LIKE '%"' || ? || '"%')
        OR (e.show_date = ?)
        OR (e.show_dates IS NOT NULL AND e.show_dates LIKE '%"' || ? || '"%')
      )
      AND NOT EXISTS (
        SELECT 1 FROM transactions t
        WHERE t.event_id = e.id
          AND t.type = 'OUT'
          AND t.status = 'completed'
          AND t.deleted_at IS NULL
      )
  `).all(today, today, today, today, today, today);
}

// 12h: cảnh báo push
function checkKhoWarning() {
  const events = getEventsKyThuatNoOut();
  if (!events.length) return;
  const names = events.map(e => e.name).join(', ');
  console.log(`[khoWarning] 12h cảnh báo: ${events.length} sự kiện chưa có phiếu xuất`);
  pushByRoles(
    '⚠️ Chưa có phiếu xuất kho',
    `${events.length} sự kiện Kỹ Thuật hôm nay chưa xuất: ${names}`,
    '/transactions',
    ALL_ROLES
  ).catch(e => console.error('[khoWarning] push error:', e.message));
}

// 15h: tạo vi phạm cho user có is_quan_ly_kho
function checkKhoViolation() {
  const events = getEventsKyThuatNoOut();
  if (!events.length) return;
  const managers = db.prepare(`SELECT id, full_name FROM users WHERE is_quan_ly_kho = 1 AND is_active = 1`).all();
  if (!managers.length) return;

  console.log(`[khoWarning] 15h vi phạm: ${events.length} SK × ${managers.length} người`);

  for (const ev of events) {
    for (const u of managers) {
      const exists = db.prepare(`
        SELECT id FROM violations
        WHERE event_id = ? AND violator = ? AND violation_type = 'Chưa xuất kho đúng hạn'
      `).get(ev.id, u.full_name);
      if (exists) continue;
      db.prepare(`
        INSERT INTO violations (event_id, event_label, reporter_name, violator, violation_type, description)
        VALUES (?, ?, 'Hệ thống', ?, 'Chưa xuất kho đúng hạn', ?)
      `).run(
        ev.id, ev.name, u.full_name,
        `Sự kiện "${ev.name}" (Kỹ Thuật) đến 15:00 vẫn chưa có phiếu xuất kho.`
      );
    }
  }

  const names = events.map(e => e.name).join(', ');
  pushByRoles(
    '🚨 Vi phạm: chưa xuất kho',
    `${events.length} sự kiện Kỹ Thuật quá 15:00 chưa xuất: ${names}`,
    '/transactions',
    ALL_ROLES
  ).catch(e => console.error('[khoWarning] push error:', e.message));
}

// Trạng thái đã chạy trong ngày
const ran = { warn: null, viol: null };

function scheduleKhoCheck() {
  setInterval(() => {
    const now = new Date(Date.now() + 7 * 3600 * 1000); // VN time
    const hhmm = now.getUTCHours() * 60 + now.getUTCMinutes();
    const today = todayVN();

    // 12:00 → 12:09 (window 10 phút)
    if (hhmm >= 12 * 60 && hhmm < 12 * 60 + 10 && ran.warn !== today) {
      ran.warn = today;
      checkKhoWarning();
    }

    // 15:00 → 15:09
    if (hhmm >= 15 * 60 && hhmm < 15 * 60 + 10 && ran.viol !== today) {
      ran.viol = today;
      checkKhoViolation();
    }
  }, 60_000); // kiểm tra mỗi phút
}

module.exports = { scheduleKhoCheck, checkKhoWarning, checkKhoViolation };
