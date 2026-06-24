const router = require('express').Router();
const db = require('../database');
const { requireRole } = require('../middleware/auth');

const canWrite  = requireRole('SUPER_ADMIN', 'PRODUCTION', 'TECHNICAL', 'ATAS', 'STAGE', 'CSVC');
const adminOnly = requireRole('SUPER_ADMIN');

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
  const r = db.prepare(`
    UPDATE events SET status = 'active'
    WHERE status = 'planned'
      AND start_date IS NOT NULL
      AND start_date <= date('now','localtime')
      AND deleted_at IS NULL
  `).run();
  if (r.changes > 0) console.log(`[AutoStatus] Chuyển ${r.changes} sự kiện → 'Đang diễn ra'`);
}
autoUpdateStatuses();
setInterval(autoUpdateStatuses, 60 * 60 * 1000); // kiểm tra mỗi 1 giờ

// Danh sách sự kiện (không gồm trash)
router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT e.*,
      (SELECT COUNT(*) FROM transactions t WHERE t.event_id = e.id) as tx_count
    FROM events e WHERE e.deleted_at IS NULL
  `;
  const params = [];
  if (status) { sql += ' AND e.status = ?'; params.push(status); }
  sql += ' ORDER BY e.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// Thùng rác — SUPER_ADMIN
router.get('/trash', adminOnly, (req, res) => {
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

  res.json({ ...ev, items });
});

router.post('/', canWrite, (req, res) => {
  const { name, client, location, start_date, end_date, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên sự kiện là bắt buộc' });
  const code = nextCode();
  const today = new Date().toISOString().slice(0, 10);
  const initialStatus = (start_date && start_date <= today) ? 'active' : 'planned';
  const r = db.prepare(`
    INSERT INTO events (code, name, client, location, start_date, end_date, notes, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(code, name, client, location, start_date, end_date, notes, initialStatus, req.user?.full_name || '');
  res.json({ id: r.lastInsertRowid, code });
});

router.put('/:id', canWrite, (req, res) => {
  const { name, client, location, start_date, end_date, status, notes } = req.body;
  db.prepare(`
    UPDATE events SET name=?, client=?, location=?, start_date=?, end_date=?, status=?, notes=? WHERE id=?
  `).run(name, client, location, start_date, end_date, status, notes, req.params.id);
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
router.post('/:id/restore', adminOnly, (req, res) => {
  db.prepare('UPDATE events SET deleted_at = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Xóa vĩnh viễn khỏi trash
router.delete('/:id/permanent', adminOnly, (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
