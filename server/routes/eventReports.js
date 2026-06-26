const router = require('express').Router();
const db = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

function canManage(req, res, next) {
  const { role, is_truong_phong } = req.user || {};
  if (['SUPER_ADMIN', 'DIRECTOR'].includes(role) || is_truong_phong) return next();
  return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
}

router.get('/', (req, res) => {
  const { event_id } = req.query;
  let sql = `
    SELECT er.*, u.role AS reporter_role
    FROM event_reports er
    LEFT JOIN users u ON u.id = er.reporter_user_id
  `;
  const params = [];
  if (event_id) { sql += ' WHERE er.event_id = ?'; params.push(event_id); }
  sql += ' ORDER BY er.created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(r => ({
    ...r,
    km_staff: JSON.parse(r.km_staff || '[]'),
    images:   JSON.parse(r.images   || '[]'),
  })));
});

router.get('/:id', (req, res) => {
  const r = db.prepare(`
    SELECT er.*, u.role AS reporter_role
    FROM event_reports er
    LEFT JOIN users u ON u.id = er.reporter_user_id
    WHERE er.id = ?
  `).get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Không tìm thấy' });
  res.json({ ...r, km_staff: JSON.parse(r.km_staff || '[]'), images: JSON.parse(r.images || '[]') });
});

router.post('/', requireAuth, (req, res) => {
  const {
    event_id, event_label, location, report_date,
    km_staff, freelancer_staff,
    time_present, time_onset, time_off, time_end,
    incomplete, incidents, progress, completed_work, service_quality,
    images, reporter_name,
  } = req.body;

  const result = db.prepare(`
    INSERT INTO event_reports
      (event_id, event_label, location, report_date, km_staff, freelancer_staff,
       time_present, time_onset, time_off, time_end,
       incomplete, incidents, progress, completed_work, service_quality,
       images, reporter_name, reporter_user_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    event_id || null, event_label || '', location || '', report_date || '',
    JSON.stringify(km_staff || []), freelancer_staff || '',
    time_present || '', time_onset || '', time_off || '', time_end || '',
    incomplete || '', incidents || '', progress || '', completed_work || '', service_quality || '',
    JSON.stringify(images || []), reporter_name || '',
    req.user?.id || null,
  );
  res.json({ id: result.lastInsertRowid });
});

router.delete('/:id', canManage, (req, res) => {
  const { role, is_truong_phong } = req.user;
  const isFullAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(role);

  if (!isFullAdmin && is_truong_phong) {
    const report = db.prepare('SELECT reporter_user_id FROM event_reports WHERE id = ?').get(req.params.id);
    if (!report) return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
    if (report.reporter_user_id) {
      const reporter = db.prepare('SELECT role FROM users WHERE id = ?').get(report.reporter_user_id);
      if (reporter && reporter.role !== role) {
        return res.status(403).json({ error: 'Chỉ được xóa báo cáo của nhân viên trong phòng' });
      }
    }
  }

  db.prepare('DELETE FROM event_reports WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
