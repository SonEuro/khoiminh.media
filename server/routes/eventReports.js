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
    SELECT er.*, u.role AS reporter_role,
      (SELECT deadline FROM lead_report_obligations
       WHERE lead_name = er.reporter_name
         AND assigned_date = er.report_date
         AND (event_id = er.event_id OR (event_id IS NULL AND er.event_id IS NULL))
       ORDER BY deadline ASC LIMIT 1
      ) AS obligation_deadline
    FROM event_reports er
    LEFT JOIN users u ON u.id = er.reporter_user_id
  `;
  const params = [];
  if (event_id) { sql += ' WHERE er.event_id = ?'; params.push(event_id); }
  sql += ' ORDER BY er.created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(r => ({
    ...r,
    km_staff:     JSON.parse(r.km_staff     || '[]'),
    images:       JSON.parse(r.images       || '[]'),
    timeline:     JSON.parse(r.timeline     || '[]'),
    edit_history: JSON.parse(r.edit_history || '[]'),
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
  res.json({ ...r, km_staff: JSON.parse(r.km_staff || '[]'), images: JSON.parse(r.images || '[]'), timeline: JSON.parse(r.timeline || '[]'), edit_history: JSON.parse(r.edit_history || '[]') });
});

router.post('/', requireAuth, (req, res) => {
  const {
    event_id, event_label, location, report_date,
    km_staff, freelancer_staff,
    time_present, time_onset, time_off, time_end,
    incomplete, incidents, progress, completed_work, service_quality,
    images, reporter_name, job_content, timeline,
  } = req.body;

  const result = db.prepare(`
    INSERT INTO event_reports
      (event_id, event_label, location, report_date, km_staff, freelancer_staff,
       time_present, time_onset, time_off, time_end,
       incomplete, incidents, progress, completed_work, service_quality,
       images, reporter_name, reporter_user_id, job_content, timeline)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    event_id || null, event_label || '', location || '', report_date || '',
    JSON.stringify(km_staff || []), freelancer_staff || '',
    time_present || '', time_onset || '', time_off || '', time_end || '',
    incomplete || '', incidents || '', progress || '', completed_work || '', service_quality || '',
    JSON.stringify(images || []), reporter_name || '',
    req.user?.id || null,
    job_content || '',
    JSON.stringify((timeline || []).filter(t => t.time)),
  );
  res.json({ id: result.lastInsertRowid });
});

// Cho phép chỉnh sửa đến report_date + 1 ngày 21:00 VN
function withinEditDeadline(reportDate) {
  if (!reportDate) return false;
  const [y, m, d] = reportDate.split('-').map(Number);
  const deadlineUTC = new Date(Date.UTC(y, m - 1, d + 1, 14, 0, 0)); // d+1 21:00 VN = d+1 14:00 UTC
  return Date.now() <= deadlineUTC.getTime();
}

router.put('/:id', requireAuth, (req, res) => {
  const report = db.prepare('SELECT * FROM event_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Không tìm thấy báo cáo' });

  const { role } = req.user;
  const isAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(role);
  const isOwner = report.reporter_user_id === req.user.id;

  if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Không có quyền chỉnh sửa báo cáo này' });
  if (!isAdmin && !withinEditDeadline(report.report_date)) return res.status(403).json({ error: 'Đã quá hạn chỉnh sửa (hạn: ngày làm việc + 21:00 hôm sau)' });

  const {
    location,
    km_staff, freelancer_staff,
    time_present, time_onset, time_off, time_end,
    incomplete, incidents, progress, completed_work, service_quality,
    images, job_content, timeline,
  } = req.body;

  const vnNow = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
  const editorName = req.user.full_name || req.user.username || `User#${req.user.id}`;
  const prevHistory = (() => { try { return JSON.parse(report.edit_history || '[]') || []; } catch { return []; } })();
  const newHistory = [...prevHistory, { name: editorName, at: vnNow }];

  db.prepare(`
    UPDATE event_reports SET
      location=?,
      km_staff=?, freelancer_staff=?,
      time_present=?, time_onset=?, time_off=?, time_end=?,
      incomplete=?, incidents=?, progress=?, completed_work=?, service_quality=?,
      images=?, job_content=?, timeline=?, edit_history=?
    WHERE id=?
  `).run(
    location || '',
    JSON.stringify(km_staff || []), freelancer_staff || '',
    time_present || '', time_onset || '', time_off || '', time_end || '',
    incomplete || '', incidents || '', progress || '', completed_work || '', service_quality || '',
    JSON.stringify(images || []),
    job_content || '',
    JSON.stringify((timeline || []).filter(t => t.time)),
    JSON.stringify(newHistory),
    req.params.id,
  );
  res.json({ ok: true });
});

router.patch('/:id/confirm', requireAuth, (req, res) => {
  const { role, is_phan_lich_all } = req.user || {};
  const canConfirm = ['SUPER_ADMIN', 'DIRECTOR'].includes(role) || is_phan_lich_all;
  if (!canConfirm) return res.status(403).json({ error: 'Không có quyền xác nhận' });
  const vnTime = new Date(Date.now() + 7 * 3600 * 1000);
  const now = vnTime.toISOString().slice(0, 19).replace('T', ' ');
  db.prepare('UPDATE event_reports SET confirmed_at = ?, confirmed_by_id = ? WHERE id = ?')
    .run(now, req.user.id, req.params.id);
  res.json({ ok: true, confirmed_at: now });
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
