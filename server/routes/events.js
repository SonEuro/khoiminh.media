const router = require('express').Router();
const db = require('../database');
const { requireRole } = require('../middleware/auth');
const { notifyAll } = require('../services/zaloNotify');
const { pushByRoles } = require('../services/pushNotify');
const ALL_ROLES = ['DIRECTOR','SUPER_ADMIN','PRODUCTION','ACCOUNTING','TECHNICAL','ATAS','STAGE','CSVC'];

const canWrite  = requireRole('SUPER_ADMIN', 'DIRECTOR', 'PRODUCTION', 'TECHNICAL', 'ATAS', 'STAGE', 'CSVC');
const adminOnly = requireRole('SUPER_ADMIN');
function canManage(req, res, next) {
  const { role, is_truong_phong } = req.user || {};
  if (['SUPER_ADMIN', 'DIRECTOR'].includes(role) || is_truong_phong) return next();
  return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
}

// Kiểm tra TRUONG_PHONG có quyền quản lý sự kiện này không (theo phòng ban người tạo)
function checkTruongPhongDept(req, eventCreatedById) {
  const { role, is_truong_phong } = req.user || {};
  if (['SUPER_ADMIN', 'DIRECTOR'].includes(role)) return true;
  if (!is_truong_phong) return false;
  if (!eventCreatedById) return true; // sự kiện cũ chưa có created_by_id
  const creator = db.prepare('SELECT role FROM users WHERE id = ?').get(eventCreatedById);
  return !creator || creator.role === role;
}

function nextCode() {
  // Tìm max trong TẤT CẢ events (kể cả đã xóa) để tránh conflict UNIQUE
  const rows = db.prepare("SELECT code FROM events").all();
  let max = 0;
  for (const { code } of rows) {
    const n = parseInt((code || '').split('-')[1]);
    if (!isNaN(n) && n > max) max = n;
  }
  return `EVENT-${String(max + 1).padStart(3, '0')}`;
}

// Auto-cleanup: xóa hẳn sự kiện trong trash quá 30 ngày
function cleanupTrash() {
  try {
    const old = db.prepare(
      "SELECT id FROM events WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')"
    ).all();
    if (old.length === 0) return;
    const doClean = db.transaction(() => {
      for (const { id } of old) {
        const txs = db.prepare('SELECT * FROM transactions WHERE event_id = ? AND deleted_at IS NULL ORDER BY created_at DESC').all(id);
        for (const tx of txs) {
          const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(tx.id);
          for (const item of items) {
            const qty = item.quantity;
            const eqId = item.equipment_id;
            if (tx.type === 'OUT' && tx.status === 'pending') {
              // Pending không trừ kho → xóa không cần hoàn lại
            } else if (tx.type === 'OUT') {
              db.prepare('UPDATE equipment SET qty_available = qty_available + ?, qty_in_use = MAX(0, qty_in_use - ?) WHERE id = ?').run(qty, qty, eqId);
            } else if (tx.type === 'RETURN') {
              const cond = item.condition || 'good';
              if (cond === 'damaged') {
                db.prepare('UPDATE equipment SET qty_damaged = MAX(0, qty_damaged - ?), qty_in_use = qty_in_use + ? WHERE id = ?').run(qty, qty, eqId);
              } else if (cond === 'maintenance') {
                db.prepare('UPDATE equipment SET qty_maintenance = MAX(0, qty_maintenance - ?), qty_in_use = qty_in_use + ? WHERE id = ?').run(qty, qty, eqId);
              } else if (cond === 'lost') {
                db.prepare('UPDATE equipment SET qty_lost = MAX(0, qty_lost - ?), qty_in_use = qty_in_use + ? WHERE id = ?').run(qty, qty, eqId);
              } else {
                db.prepare('UPDATE equipment SET qty_available = MAX(0, qty_available - ?), qty_in_use = qty_in_use + ? WHERE id = ?').run(qty, qty, eqId);
              }
            }
          }
        }
        try { db.prepare('DELETE FROM violations WHERE event_id = ?').run(id); } catch (_) {}
        try { db.prepare('DELETE FROM event_reports WHERE event_id = ?').run(id); } catch (_) {}
        try { db.prepare('DELETE FROM lead_report_obligations WHERE event_id = ?').run(id); } catch (_) {}
        try { db.prepare('UPDATE work_schedules SET event_id = NULL WHERE event_id = ?').run(id); } catch (_) {}
        db.prepare('DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE event_id = ?)').run(id);
        try { db.prepare('DELETE FROM external_items WHERE transaction_id IN (SELECT id FROM transactions WHERE event_id = ?)').run(id); } catch (_) {}
        db.prepare('DELETE FROM transactions WHERE event_id = ?').run(id);
        db.prepare('DELETE FROM events WHERE id = ?').run(id);
      }
    });
    doClean();
    console.log(`[Trash] Đã xóa vĩnh viễn ${old.length} sự kiện quá 30 ngày`);
  } catch (err) {
    console.error('[Trash] Lỗi auto-cleanup:', err.message);
  }
}
cleanupTrash();
setInterval(cleanupTrash, 24 * 60 * 60 * 1000);

// Dọn obligations mồ côi (event đã xóa vĩnh viễn nhưng obligation vẫn còn)
try {
  const r = db.prepare(
    `DELETE FROM lead_report_obligations WHERE event_id IS NOT NULL AND event_id NOT IN (SELECT id FROM events)`
  ).run();
  if (r.changes > 0) console.log(`[Cleanup] Xóa ${r.changes} obligations mồ côi`);
} catch (_) {}

// Auto-update: sự kiện 'planned' đã đến ngày bắt đầu → chuyển sang 'active'
function autoUpdateStatuses() {
  // planned + start_date đến hôm nay → active
  const r1 = db.prepare(`
    UPDATE events SET status = 'active'
    WHERE status = 'planned'
      AND start_date IS NOT NULL
      AND start_date <= date('now','localtime')
      AND deleted_at IS NULL
  `).run();
  if (r1.changes > 0) console.log(`[AutoStatus] Chuyển ${r1.changes} sự kiện → 'Đang diễn ra' (start_date)`);

  // planned + chỉ có filming_date = hôm nay (không có start_date) → active
  const r1b = db.prepare(`
    UPDATE events SET status = 'active'
    WHERE status = 'planned'
      AND start_date IS NULL
      AND filming_date IS NOT NULL
      AND (
        filming_date = date('now','localtime')
        OR (filming_dates IS NOT NULL AND filming_dates LIKE '%"' || date('now','localtime') || '"%')
        OR (filming_dates IS NOT NULL
            AND json_extract(filming_dates, '$[0]') <= date('now','localtime')
            AND filming_date >= date('now','localtime'))
      )
      AND deleted_at IS NULL
  `).run();
  if (r1b.changes > 0) console.log(`[AutoStatus] Chuyển ${r1b.changes} sự kiện → 'Đang diễn ra' (filming_date hôm nay)`);

  // filming_date đã qua → completed
  const r2 = db.prepare(`
    UPDATE events SET status = 'completed'
    WHERE status NOT IN ('completed', 'cancelled')
      AND filming_date IS NOT NULL
      AND filming_date < date('now','localtime')
      AND deleted_at IS NULL
      AND archived_at IS NULL
  `).run();
  if (r2.changes > 0) console.log(`[AutoStatus] Chuyển ${r2.changes} sự kiện → 'Đã hoàn thành' (filming_date đã qua)`);

  // Không có filming_date nhưng end_date đã qua → completed
  const r3 = db.prepare(`
    UPDATE events SET status = 'completed'
    WHERE status NOT IN ('completed', 'cancelled')
      AND filming_date IS NULL
      AND end_date IS NOT NULL
      AND end_date < date('now','localtime')
      AND deleted_at IS NULL
      AND archived_at IS NULL
  `).run();
  if (r3.changes > 0) console.log(`[AutoStatus] Chuyển ${r3.changes} sự kiện → 'Đã hoàn thành' (end_date đã qua)`);
}
autoUpdateStatuses();
setInterval(autoUpdateStatuses, 60 * 60 * 1000); // kiểm tra mỗi 1 giờ

// Auto-archive: sự kiện hoàn thành quá 72h mà chưa được lưu trữ → tự động lưu trữ
// Bỏ qua nếu còn lịch làm việc có ngày trong tương lai
function autoArchiveCompleted() {
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT id, name FROM events
    WHERE status = 'completed'
      AND archived_at IS NULL
      AND deleted_at IS NULL
      AND COALESCE(filming_date, end_date, start_date) IS NOT NULL
      AND datetime(COALESCE(filming_date, end_date, start_date) || ' 23:59:59', '+72 hours') <= datetime('now', 'localtime')
  `).all();
  if (!rows.length) return;

  const getSchedules = db.prepare(
    `SELECT filming_date, setup_date, rehearsal_date, teardown_date
     FROM work_schedules WHERE event_id = ? AND deleted_at IS NULL`
  );

  function hasUpcomingSchedule(eventId) {
    const scheds = getSchedules.all(eventId);
    return scheds.some(s =>
      ['filming_date', 'setup_date', 'rehearsal_date', 'teardown_date'].some(col => {
        const val = s[col];
        if (!val) return false;
        if (val.startsWith('[')) {
          try { return JSON.parse(val).some(d => d >= today); } catch { return false; }
        }
        return val >= today;
      })
    );
  }

  const stmt = db.prepare(`UPDATE events SET archived_at = datetime('now','localtime') WHERE id = ?`);
  for (const ev of rows) {
    if (hasUpcomingSchedule(ev.id)) {
      console.log(`[AutoArchive] Bỏ qua "${ev.name}" — còn lịch làm việc sắp tới`);
      continue;
    }
    stmt.run(ev.id);
    console.log(`[AutoArchive] Đã lưu trữ tự động: "${ev.name}" (id=${ev.id})`);
  }
}
autoArchiveCompleted();
setInterval(autoArchiveCompleted, 60 * 60 * 1000); // kiểm tra mỗi 1 giờ

// Auto-reconcile: sửa qty_in_use stale mỗi ngày lúc 3 giờ sáng
function autoReconcileStock() {
  try {
    db.prepare(`
      UPDATE equipment
      SET qty_in_use = MAX(0, COALESCE((
        SELECT SUM(CASE WHEN t.type='OUT' AND t.status='completed' AND t.deleted_at IS NULL THEN ti.quantity ELSE 0 END)
             - SUM(CASE WHEN t.type='RETURN' AND t.deleted_at IS NULL THEN ti.quantity ELSE 0 END)
        FROM transaction_items ti JOIN transactions t ON t.id = ti.transaction_id
        WHERE ti.equipment_id = equipment.id
      ), 0))
    `).run();
    db.prepare(`
      UPDATE equipment
      SET qty_available = MAX(0, qty_total - qty_in_use - qty_damaged - qty_maintenance - qty_lost)
    `).run();
    console.log('[AutoReconcile] qty_in_use đã được đồng bộ lại');
  } catch (e) {
    console.error('[AutoReconcile] Lỗi:', e.message);
  }
}
autoReconcileStock(); // chạy ngay khi khởi động
setInterval(() => {
  const h = new Date(Date.now() + 7 * 3600 * 1000).getUTCHours();
  if (h === 3) autoReconcileStock();
}, 60 * 60 * 1000); // kiểm tra mỗi giờ, chạy thật lúc 3h sáng

// Auto-violation: sự kiện kết thúc + 12h mà người phụ trách chưa nhập kho → vi phạm nội quy
function checkLateReturns() {
  const lateRows = db.prepare(`
    SELECT DISTINCT
      ev.id          AS event_id,
      ev.name        AS event_name,
      ev.code        AS event_code,
      t.responsible_person
    FROM events ev
    JOIN transactions t ON t.event_id = ev.id AND t.type = 'OUT' AND t.status = 'completed'
    WHERE ev.deleted_at IS NULL
      AND COALESCE(ev.end_date, ev.filming_date) IS NOT NULL
      AND datetime(COALESCE(ev.end_date, ev.filming_date) || ' 23:59:59', '+12 hours') <= datetime('now','localtime')
      AND ev.status != 'cancelled'
      AND t.responsible_person IS NOT NULL
      AND t.responsible_person != ''
      AND EXISTS (
        SELECT 1 FROM (
          SELECT
            SUM(CASE WHEN t2.type = 'OUT' AND t2.status = 'completed' THEN ti.quantity ELSE 0 END) AS qty_out,
            SUM(CASE WHEN t2.type = 'RETURN'                           THEN ti.quantity ELSE 0 END) AS qty_returned
          FROM transaction_items ti
          JOIN transactions t2 ON t2.id = ti.transaction_id
          WHERE t2.event_id = ev.id
          GROUP BY ti.equipment_id
        ) sub WHERE sub.qty_out > sub.qty_returned
      )
  `).all();

  for (const row of lateRows) {
    const exists = db.prepare(`
      SELECT id FROM violations
      WHERE event_id = ? AND violator = ? AND violation_type = 'Không hoàn thành nhiệm vụ đúng hạn'
    `).get(row.event_id, row.responsible_person);

    if (!exists) {
      db.prepare(`
        INSERT INTO violations (event_id, event_label, reporter_name, violator, violation_type, description)
        VALUES (?, ?, 'Hệ thống', ?, 'Không hoàn thành nhiệm vụ đúng hạn', ?)
      `).run(
        row.event_id,
        `${row.event_code} – ${row.event_name}`,
        row.responsible_person,
        `Chưa xác nhận nhập kho thiết bị sau 12 giờ kể từ khi sự kiện "${row.event_name}" kết thúc`
      );
      console.log(`[AutoViolation] ${row.responsible_person} – ${row.event_code}`);
    }
  }
}
checkLateReturns();
setInterval(checkLateReturns, 60 * 60 * 1000); // kiểm tra mỗi 1 giờ

// Danh sách sự kiện (không gồm trash)
router.get('/', (req, res) => {
  const { status, limit, include_archived } = req.query;
  let sql = `
    SELECT e.*,
      u.role AS created_by_role,
      (SELECT COUNT(*) FROM transactions t WHERE t.event_id = e.id) as tx_count
    FROM events e
    LEFT JOIN users u ON u.id = e.created_by_id
    WHERE e.deleted_at IS NULL
  `;
  if (!include_archived) {
    sql += ` AND e.archived_at IS NULL`;
  }
  const params = [];
  if (status) { sql += ' AND e.status = ?'; params.push(status); }
  sql += ` ORDER BY
    CASE e.status
      WHEN 'active'    THEN 1
      WHEN 'planned'   THEN 2
      WHEN 'completed' THEN 3
      WHEN 'cancelled' THEN 4
      ELSE 5
    END ASC,
    CASE WHEN e.status = 'planned' THEN e.start_date END ASC,
    e.created_at DESC`;
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
  res.json(db.prepare(sql).all(...params));
});

// Thùng rác — SUPER_ADMIN, DIRECTOR, TRUONG_PHONG (lọc theo phòng ban)
router.get('/trash', canManage, (req, res) => {
  const { role, is_truong_phong } = req.user;
  const isFullAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(role);

  let sql = `
    SELECT e.*,
      u.role AS created_by_role,
      CAST((julianday(datetime(e.deleted_at, '+30 days')) - julianday('now','localtime')) AS INTEGER) + 1 AS days_left,
      (SELECT COUNT(*) FROM transactions t WHERE t.event_id = e.id) AS tx_count
    FROM events e
    LEFT JOIN users u ON u.id = e.created_by_id
    WHERE e.deleted_at IS NOT NULL
  `;
  const params = [];
  if (!isFullAdmin && is_truong_phong) {
    sql += ' AND (e.created_by_id IS NULL OR u.role = ?)';
    params.push(role);
  }
  sql += ' ORDER BY e.deleted_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Không tìm thấy' });

  const items = db.prepare(`
    SELECT ti.equipment_id, e.code as eq_code, e.name as eq_name, e.unit,
           SUM(CASE WHEN t.type = 'OUT'    AND (t.notes IS NULL OR t.notes NOT LIKE 'Chuyển từ%') THEN ti.quantity ELSE 0 END) as qty_out,
           SUM(CASE WHEN t.type = 'RETURN' AND (t.notes IS NULL OR t.notes NOT LIKE 'Thiết bị chuyển sang%') THEN ti.quantity ELSE 0 END) as qty_returned,
           SUM(CASE WHEN t.type = 'OUT'    AND t.notes LIKE 'Chuyển từ%'                           THEN ti.quantity ELSE 0 END) as qty_transfer_in,
           SUM(CASE WHEN t.type = 'RETURN' AND t.notes LIKE 'Thiết bị chuyển sang%'               THEN ti.quantity ELSE 0 END) as qty_transfer_out,
           MAX(ti.combo) as combo
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN equipment e ON e.id = ti.equipment_id
    WHERE t.event_id = ? AND t.status != 'pending'
    GROUP BY ti.equipment_id
  `).all(req.params.id);

  const external_items = db.prepare(`
    SELECT ei.supplier, ei.name, SUM(ei.quantity) AS quantity, ei.unit,
           GROUP_CONCAT(ei.notes, ' / ') AS notes, MAX(ei.rental_days) AS rental_days
    FROM external_items ei
    JOIN transactions t ON t.id = ei.transaction_id
    WHERE t.event_id = ? AND t.type = 'OUT' AND t.status != 'pending'
    GROUP BY ei.supplier, ei.name, ei.unit
  `).all(req.params.id);

  res.json({ ...ev, items, external_items });
});

function parseMultiField(val, single) {
  if (Array.isArray(val)) return val.filter(Boolean).sort();
  if (val) return [val];
  if (single) return [single];
  return [];
}

router.post('/', canWrite, (req, res) => {
  const { name, client, location, start_dates, end_dates, filming_dates, show_dates, notes, departments } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên sự kiện là bắt buộc' });

  const startArr = parseMultiField(start_dates);
  const endArr   = parseMultiField(end_dates);
  const filmArr  = parseMultiField(filming_dates);
  const showArr  = parseMultiField(show_dates);
  const deptsJson = departments?.length ? JSON.stringify(departments) : null;

  const startDate = startArr[0] || null;
  const endDate   = endArr[endArr.length - 1] || null;
  const filmDate  = filmArr[filmArr.length - 1] || null;
  const showDate  = showArr[0] || null;

  // Tự thêm số thứ tự nếu tên trùng
  const base = name.trim();
  const existing = db.prepare("SELECT name FROM events WHERE deleted_at IS NULL AND (name = ? OR name LIKE ?)")
    .all(base, base + ' %').map(r => r.name);
  let finalName = base;
  if (existing.includes(base)) {
    let seq = 2;
    while (existing.includes(`${base} ${seq}`)) seq++;
    finalName = `${base} ${seq}`;
  }

  const code = nextCode();
  const today = db.prepare("SELECT date('now','localtime') AS d").get().d;
  const initialStatus = (startDate && startDate <= today) ? 'active' : 'planned';
  const r = db.prepare(`
    INSERT INTO events (code, name, client, location, start_date, start_dates, end_date, end_dates, filming_date, filming_dates, show_date, show_dates, notes, status, created_by, created_by_id, departments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    code, finalName, client, location,
    startDate, startArr.length ? JSON.stringify(startArr) : null,
    endDate,   endArr.length   ? JSON.stringify(endArr)   : null,
    filmDate,  filmArr.length  ? JSON.stringify(filmArr)  : null,
    showDate,  showArr.length  ? JSON.stringify(showArr)  : null,
    notes, initialStatus, req.user?.full_name || '', req.user?.id || null, deptsJson
  );
  res.json({ id: r.lastInsertRowid, code, name: finalName });
  notifyAll(`🗓 Sự kiện mới: ${finalName}\n📍 ${location || '—'}\n📅 ${startDate || '—'}\n👤 ${req.user?.full_name || '—'}`).catch(() => {});
  pushByRoles(`🗓 Sự kiện mới: ${finalName}`, `📍 ${location || '—'}  📅 ${startDate || '—'}`, `/events?id=${r.lastInsertRowid}`, ALL_ROLES).catch(() => {});
});

const ROLE_TO_DEPT = { ATAS: 'ATAS-LED', STAGE: 'Sân Khấu', TECHNICAL: 'Kỹ Thuật', CSVC: 'Cơ Sở Vật Chất' };

router.put('/:id', (req, res, next) => {
  const { role, is_truong_phong } = req.user || {};
  // SUPER_ADMIN, DIRECTOR, PRODUCTION → sửa tất cả
  if (['SUPER_ADMIN', 'DIRECTOR', 'PRODUCTION'].includes(role)) return next();
  // Trưởng phòng → chỉ sửa sự kiện có nhãn bộ phận mình
  if (is_truong_phong) {
    const ev = db.prepare('SELECT departments FROM events WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Không tìm thấy sự kiện' });
    const depts = (() => { try { return JSON.parse(ev.departments || '[]'); } catch { return []; } })();
    if (depts.includes(ROLE_TO_DEPT[role])) return next();
    return res.status(403).json({ error: 'Trưởng phòng chỉ được sửa sự kiện có nhãn bộ phận mình' });
  }
  return res.status(403).json({ error: 'Không có quyền chỉnh sửa sự kiện' });
}, (req, res) => {
  const ev = db.prepare('SELECT status, created_by_id FROM events WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Không tìm thấy sự kiện' });
  if (ev.status === 'completed' && !['SUPER_ADMIN', 'DIRECTOR', 'PRODUCTION'].includes(req.user.role) && !req.user.is_truong_phong)
    return res.status(403).json({ error: 'Không có quyền chỉnh sửa sự kiện đã hoàn thành' });
  const { name, client, location, start_dates, end_dates, filming_dates, show_dates, status, notes, departments } = req.body;
  const deptsJson2 = departments?.length ? JSON.stringify(departments) : null;
  const startArr2 = parseMultiField(start_dates);
  const endArr2   = parseMultiField(end_dates);
  const filmArr2  = parseMultiField(filming_dates);
  const showArr2  = parseMultiField(show_dates);
  const startDate2 = startArr2[0] || null;
  const endDate2   = endArr2[endArr2.length - 1] || null;
  const filmDate2  = filmArr2[filmArr2.length - 1] || null;
  const showDate2  = showArr2[0] || null;
  db.prepare(`
    UPDATE events SET name=?, client=?, location=?,
      start_date=?, start_dates=?, end_date=?, end_dates=?,
      filming_date=?, filming_dates=?, show_date=?, show_dates=?,
      status=?, notes=?, departments=? WHERE id=?
  `).run(
    name, client, location,
    startDate2, startArr2.length ? JSON.stringify(startArr2) : null,
    endDate2,   endArr2.length   ? JSON.stringify(endArr2)   : null,
    filmDate2,  filmArr2.length  ? JSON.stringify(filmArr2)  : null,
    showDate2,  showArr2.length  ? JSON.stringify(showArr2)  : null,
    status, notes, deptsJson2, req.params.id
  );
  // Đồng bộ tên sự kiện sang các bảng liên quan
  try { db.prepare('UPDATE work_schedules SET event_name = ? WHERE event_id = ?').run(name, req.params.id); } catch (_) {}
  try { db.prepare('UPDATE lead_report_obligations SET event_name = ? WHERE event_id = ?').run(name, req.params.id); } catch (_) {}
  try { db.prepare('UPDATE violations SET event_label = ? WHERE event_id = ?').run(name, req.params.id); } catch (_) {}
  try { db.prepare('UPDATE event_reports SET event_label = ? WHERE event_id = ?').run(name, req.params.id); } catch (_) {}
  res.json({ ok: true });
  notifyAll(`✏️ Sự kiện cập nhật: ${name}\n📍 ${location || '—'}\n📅 ${startDate2 || '—'}\n👤 ${req.user?.full_name || '—'}`).catch(() => {});
  pushByRoles(`✏️ Sự kiện cập nhật`, `${name}\n📍 ${location || '—'}  📅 ${startDate2 || '—'}`, `/events?id=${req.params.id}`, ALL_ROLES).catch(() => {});
});

// Soft delete → trash (chỉ sự kiện đã hủy)
router.delete('/:id', adminOnly, (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Không tìm thấy' });
  if (ev.status !== 'cancelled') return res.status(400).json({ error: 'Chỉ có thể xóa sự kiện đã hủy' });
  db.prepare("UPDATE events SET deleted_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Khôi phục từ trash
router.post('/:id/restore', canManage, (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Không tìm thấy' });
  if (!checkTruongPhongDept(req, ev.created_by_id))
    return res.status(403).json({ error: 'Chỉ được khôi phục sự kiện của phòng ban mình' });
  db.prepare('UPDATE events SET deleted_at = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Hủy sự kiện — SUPER_ADMIN, DIRECTOR, TRUONG_PHONG (theo phòng ban)
router.post('/:id/cancel', canManage, (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Không tìm thấy sự kiện' });
  if (!checkTruongPhongDept(req, ev.created_by_id))
    return res.status(403).json({ error: 'Chỉ được hủy sự kiện của phòng ban mình' });
  if (ev.status === 'completed' && req.user.role !== 'SUPER_ADMIN')
    return res.status(403).json({ error: 'Chỉ SUPER_ADMIN được hủy sự kiện đã hoàn thành' });
  if (ev.status === 'cancelled') return res.status(400).json({ error: 'Sự kiện đã được hủy' });
  db.prepare("UPDATE events SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Xóa vĩnh viễn khỏi trash
router.delete('/:id/permanent', adminOnly, (req, res) => {
  const id = req.params.id;
  const ev = db.prepare('SELECT id FROM events WHERE id = ? AND deleted_at IS NOT NULL').get(id);
  if (!ev) return res.status(404).json({ error: 'Sự kiện không có trong thùng rác' });
  const doPermanent = db.transaction(() => {
    // Hoàn trả tồn kho — chỉ phiếu chưa bị xóa riêng (tránh double-restore)
    const txs = db.prepare('SELECT * FROM transactions WHERE event_id = ? AND deleted_at IS NULL ORDER BY created_at DESC').all(id);
    for (const tx of txs) {
      const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(tx.id);
      for (const item of items) {
        const qty = item.quantity;
        const eqId = item.equipment_id;
        if (tx.type === 'OUT' && tx.status === 'pending') {
          // Pending không trừ kho → xóa không cần hoàn lại
        } else if (tx.type === 'OUT') {
          db.prepare('UPDATE equipment SET qty_available = qty_available + ?, qty_in_use = MAX(0, qty_in_use - ?) WHERE id = ?').run(qty, qty, eqId);
        } else if (tx.type === 'RETURN') {
          const cond = item.condition || 'good';
          if (cond === 'damaged') {
            db.prepare('UPDATE equipment SET qty_damaged = MAX(0, qty_damaged - ?), qty_in_use = qty_in_use + ? WHERE id = ?').run(qty, qty, eqId);
          } else if (cond === 'maintenance') {
            db.prepare('UPDATE equipment SET qty_maintenance = MAX(0, qty_maintenance - ?), qty_in_use = qty_in_use + ? WHERE id = ?').run(qty, qty, eqId);
          } else if (cond === 'lost') {
            db.prepare('UPDATE equipment SET qty_lost = MAX(0, qty_lost - ?), qty_in_use = qty_in_use + ? WHERE id = ?').run(qty, qty, eqId);
          } else {
            db.prepare('UPDATE equipment SET qty_available = MAX(0, qty_available - ?), qty_in_use = qty_in_use + ? WHERE id = ?').run(qty, qty, eqId);
          }
        }
      }
    }
    // Xóa dữ liệu liên quan
    try { db.prepare('DELETE FROM violations WHERE event_id = ?').run(id); } catch (_) {}
    try { db.prepare('DELETE FROM event_reports WHERE event_id = ?').run(id); } catch (_) {}
    try { db.prepare('UPDATE work_schedules SET event_id = NULL WHERE event_id = ?').run(id); } catch (_) {}
    db.prepare('DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE event_id = ?)').run(id);
    try { db.prepare('DELETE FROM external_items WHERE transaction_id IN (SELECT id FROM transactions WHERE event_id = ?)').run(id); } catch (_) {}
    db.prepare('DELETE FROM transactions WHERE event_id = ?').run(id);
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
  });
  try {
    doPermanent();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Xóa vĩnh viễn từ kho lưu trữ (SUPER_ADMIN)
router.delete('/:id/archive-permanent', requireRole('SUPER_ADMIN'), (req, res) => {
  const id = req.params.id;
  const ev = db.prepare('SELECT id FROM events WHERE id = ? AND archived_at IS NOT NULL AND deleted_at IS NULL').get(id);
  if (!ev) return res.status(404).json({ error: 'Sự kiện không có trong kho lưu trữ' });
  const doDelete = db.transaction(() => {
    const txs = db.prepare('SELECT * FROM transactions WHERE event_id = ? ORDER BY created_at DESC').all(id);
    for (const tx of txs) {
      const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(tx.id);
      for (const item of items) {
        const qty = item.quantity;
        const eqId = item.equipment_id;
        if (tx.type === 'OUT' && tx.status !== 'pending') {
          db.prepare('UPDATE equipment SET qty_available = qty_available + ?, qty_in_use = MAX(0, qty_in_use - ?) WHERE id = ?').run(qty, qty, eqId);
        } else if (tx.type === 'RETURN') {
          const cond = item.condition || 'good';
          if (cond === 'damaged')      db.prepare('UPDATE equipment SET qty_damaged = MAX(0, qty_damaged - ?), qty_in_use = qty_in_use + ? WHERE id = ?').run(qty, qty, eqId);
          else if (cond === 'maintenance') db.prepare('UPDATE equipment SET qty_maintenance = MAX(0, qty_maintenance - ?), qty_in_use = qty_in_use + ? WHERE id = ?').run(qty, qty, eqId);
          else if (cond === 'lost')    db.prepare('UPDATE equipment SET qty_lost = MAX(0, qty_lost - ?), qty_in_use = qty_in_use + ? WHERE id = ?').run(qty, qty, eqId);
          else db.prepare('UPDATE equipment SET qty_available = MAX(0, qty_available - ?), qty_in_use = qty_in_use + ? WHERE id = ?').run(qty, qty, eqId);
        }
      }
    }
    try { db.prepare('DELETE FROM violations WHERE event_id = ?').run(id); } catch (_) {}
    try { db.prepare('DELETE FROM event_reports WHERE event_id = ?').run(id); } catch (_) {}
    try { db.prepare('UPDATE work_schedules SET event_id = NULL WHERE event_id = ?').run(id); } catch (_) {}
    db.prepare('DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE event_id = ?)').run(id);
    try { db.prepare('DELETE FROM external_items WHERE transaction_id IN (SELECT id FROM transactions WHERE event_id = ?)').run(id); } catch (_) {}
    db.prepare('DELETE FROM transactions WHERE event_id = ?').run(id);
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
  });
  try { doDelete(); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Lưu trữ sự kiện (SUPER_ADMIN) — ẩn khỏi live feed, toàn bộ dữ liệu liên quan được giữ nguyên
router.post('/:id/archive', requireRole('SUPER_ADMIN'), (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Không tìm thấy sự kiện' });
  const tx_count     = db.prepare('SELECT COUNT(*) AS c FROM transactions WHERE event_id = ?').get(req.params.id).c;
  const report_count = db.prepare('SELECT COUNT(*) AS c FROM event_reports WHERE event_id = ?').get(req.params.id).c;
  db.prepare("UPDATE events SET archived_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
  res.json({ ok: true, tx_count, report_count });
});

router.post('/:id/unarchive', requireRole('SUPER_ADMIN'), (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Không tìm thấy sự kiện' });
  db.prepare('UPDATE events SET archived_at = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
