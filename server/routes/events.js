const router = require('express').Router();
const db = require('../database');
const { requireRole } = require('../middleware/auth');

const canWrite  = requireRole('SUPER_ADMIN', 'DIRECTOR', 'PRODUCTION', 'TECHNICAL', 'ATAS', 'STAGE', 'CSVC');
const adminOnly = requireRole('SUPER_ADMIN');
function canManage(req, res, next) {
  const { role, is_truong_phong } = req.user || {};
  if (['SUPER_ADMIN', 'DIRECTOR'].includes(role) || is_truong_phong) return next();
  return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
}

function nextCode() {
  const last = db.prepare("SELECT code FROM events ORDER BY id DESC LIMIT 1").get();
  if (!last) return 'EVENT-001';
  const num = parseInt(last.code.split('-')[1]) + 1;
  return `EVENT-${String(num).padStart(3, '0')}`;
}

// Auto-cleanup: xóa hẳn sự kiện trong trash quá 30 ngày
function cleanupTrash() {
  const r = db.prepare(
    "DELETE FROM events WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now','-30 days')"
  ).run();
  if (r.changes > 0) console.log(`[Trash] Đã xóa vĩnh viễn ${r.changes} sự kiện quá 30 ngày`);
}
cleanupTrash();
setInterval(cleanupTrash, 24 * 60 * 60 * 1000);

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
  `).run();
  if (r2.changes > 0) console.log(`[AutoStatus] Chuyển ${r2.changes} sự kiện → 'Đã hoàn thành' (filming_date đã qua)`);
}
autoUpdateStatuses();
setInterval(autoUpdateStatuses, 60 * 60 * 1000); // kiểm tra mỗi 1 giờ

// Auto-violation: sự kiện kết thúc + 12h mà người phụ trách chưa nhập kho → vi phạm nội quy
function checkLateReturns() {
  const lateRows = db.prepare(`
    SELECT DISTINCT
      ev.id          AS event_id,
      ev.name        AS event_name,
      ev.code        AS event_code,
      t.responsible_person
    FROM events ev
    JOIN transactions t ON t.event_id = ev.id AND t.type = 'OUT'
    WHERE ev.deleted_at IS NULL
      AND ev.end_date IS NOT NULL
      AND datetime(ev.end_date || ' 23:59:59', '+12 hours') <= datetime('now','localtime')
      AND ev.status != 'cancelled'
      AND t.responsible_person IS NOT NULL
      AND t.responsible_person != ''
      AND EXISTS (
        SELECT 1 FROM (
          SELECT
            SUM(CASE WHEN t2.type = 'OUT'    THEN ti.quantity ELSE 0 END) AS qty_out,
            SUM(CASE WHEN t2.type = 'RETURN' THEN ti.quantity ELSE 0 END) AS qty_returned
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
  const { status, limit } = req.query;
  let sql = `
    SELECT e.*,
      (SELECT COUNT(*) FROM transactions t WHERE t.event_id = e.id) as tx_count
    FROM events e WHERE e.deleted_at IS NULL
      AND (e.archived_at IS NULL OR e.archived_at > datetime('now','localtime','-24 hours'))
  `;
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

// Thùng rác — SUPER_ADMIN, DIRECTOR, TRUONG_PHONG
router.get('/trash', canManage, (req, res) => {
  const rows = db.prepare(`
    SELECT *,
      CAST((julianday(datetime(deleted_at, '+30 days')) - julianday('now','localtime')) AS INTEGER) + 1 AS days_left
    FROM events WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC
  `).all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Không tìm thấy' });

  const items = db.prepare(`
    SELECT ti.equipment_id, e.code as eq_code, e.name as eq_name, e.unit,
           SUM(CASE WHEN t.type = 'OUT' THEN ti.quantity ELSE 0 END) as qty_out,
           SUM(CASE WHEN t.type = 'RETURN' THEN ti.quantity ELSE 0 END) as qty_returned
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN equipment e ON e.id = ti.equipment_id
    WHERE t.event_id = ?
    GROUP BY ti.equipment_id
  `).all(req.params.id);

  const external_items = db.prepare(`
    SELECT ei.supplier, ei.name, ei.quantity, ei.notes
    FROM external_items ei
    JOIN transactions t ON t.id = ei.transaction_id
    WHERE t.event_id = ? AND t.type = 'OUT'
  `).all(req.params.id);

  res.json({ ...ev, items, external_items });
});

router.post('/', canWrite, (req, res) => {
  const { name, client, location, start_date, end_date, filming_date, filming_dates, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên sự kiện là bắt buộc' });

  // Chuẩn hóa filming_dates
  const datesArr = Array.isArray(filming_dates) ? filming_dates.filter(Boolean).sort() : (filming_date ? [filming_date] : []);
  const lastDate = datesArr[datesArr.length - 1] || null;
  const datesJson = datesArr.length > 0 ? JSON.stringify(datesArr) : null;

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
  const today = new Date().toISOString().slice(0, 10);
  const initialStatus = (start_date && start_date <= today) ? 'active' : 'planned';
  const r = db.prepare(`
    INSERT INTO events (code, name, client, location, start_date, end_date, filming_date, filming_dates, notes, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(code, finalName, client, location, start_date, end_date, lastDate, datesJson, notes, initialStatus, req.user?.full_name || '');
  res.json({ id: r.lastInsertRowid, code, name: finalName });
});

router.put('/:id', canWrite, (req, res) => {
  const { name, client, location, start_date, end_date, filming_date, filming_dates, status, notes } = req.body;
  const datesArrU = Array.isArray(filming_dates) ? filming_dates.filter(Boolean).sort() : (filming_date ? [filming_date] : []);
  const lastDateU = datesArrU[datesArrU.length - 1] || null;
  const datesJsonU = datesArrU.length > 0 ? JSON.stringify(datesArrU) : null;
  db.prepare(`
    UPDATE events SET name=?, client=?, location=?, start_date=?, end_date=?, filming_date=?, filming_dates=?, status=?, notes=? WHERE id=?
  `).run(name, client, location, start_date, end_date, lastDateU, datesJsonU, status, notes, req.params.id);
  res.json({ ok: true });
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
  db.prepare('UPDATE events SET deleted_at = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Hủy sự kiện — SUPER_ADMIN, DIRECTOR, TRUONG_PHONG
router.post('/:id/cancel', canManage, (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Không tìm thấy sự kiện' });
  if (ev.status === 'cancelled') return res.status(400).json({ error: 'Sự kiện đã được hủy' });
  db.prepare("UPDATE events SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Xóa vĩnh viễn khỏi trash
router.delete('/:id/permanent', adminOnly, (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Lưu trữ sự kiện (SUPER_ADMIN) — ẩn khỏi live feed, toàn bộ dữ liệu liên quan được giữ nguyên
router.post('/:id/archive', requireRole('SUPER_ADMIN'), (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Không tìm thấy sự kiện' });
  const tx_count   = db.prepare('SELECT COUNT(*) AS c FROM transactions WHERE event_id = ?').get(req.params.id).c;
  const report_count = db.prepare('SELECT COUNT(*) AS c FROM event_reports WHERE event_id = ?').get(req.params.id).c;
  db.prepare("UPDATE events SET archived_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
  res.json({ ok: true, tx_count, report_count });
});

module.exports = router;
