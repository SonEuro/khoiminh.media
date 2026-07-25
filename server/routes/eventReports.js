const router = require('express').Router();
const db = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { pushByRoles } = require('../services/pushNotify');
const ALL_ROLES = ['DIRECTOR','SUPER_ADMIN','PRODUCTION','ACCOUNTING','TECHNICAL','ATAS','STAGE','CSVC'];

function canManage(req, res, next) {
  const { role, is_truong_phong } = req.user || {};
  if (['SUPER_ADMIN', 'DIRECTOR'].includes(role) || is_truong_phong) return next();
  return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
}

router.get('/', (req, res) => {
  const { event_id } = req.query;
  // Trả slim — bỏ images/timeline/edit_history nặng, chỉ giữ image_count
  let sql = `
    SELECT er.id, er.event_id, er.event_label, er.location, er.report_date,
           er.reporter_name, er.reporter_user_id, er.created_at, er.confirmed_at, er.confirmed_by_id,
           er.job_content, er.freelancer_staff, er.incomplete, er.incidents, er.progress,
           er.completed_work, er.service_quality, er.time_present, er.time_onset, er.time_off, er.time_end,
           er.km_staff, er.no_lunch_break, er.no_afternoon_break, er.is_holiday,
           json_array_length(er.images) AS image_count,
           u.role AS reporter_role,
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
  const conditions = ['er.deleted_at IS NULL'];
  if (event_id) { conditions.push('er.event_id = ?'); params.push(event_id); }
  sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY er.created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(r => ({
    ...r,
    km_staff: JSON.parse(r.km_staff || '[]'),
  })));
});

router.get('/:id', (req, res) => {
  const r = db.prepare(`
    SELECT er.*, u.role AS reporter_role
    FROM event_reports er
    LEFT JOIN users u ON u.id = er.reporter_user_id
    WHERE er.id = ? AND er.deleted_at IS NULL
  `).get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Không tìm thấy' });
  res.json({ ...r, km_staff: JSON.parse(r.km_staff || '[]'), images: JSON.parse(r.images || '[]'), timeline: JSON.parse(r.timeline || '[]'), edit_history: JSON.parse(r.edit_history || '[]') });
});

router.post('/', requireAuth, (req, res) => {
  const {
    event_id, event_label, location, report_date,
    km_staff, freelancer_staff,
    time_present, time_onset, time_off, time_end,
    no_lunch_break, no_afternoon_break,
    incomplete, incidents, progress, completed_work, service_quality,
    images, reporter_name, job_content, timeline,
  } = req.body;

  const result = db.prepare(`
    INSERT INTO event_reports
      (event_id, event_label, location, report_date, km_staff, freelancer_staff,
       time_present, time_onset, time_off, time_end,
       no_lunch_break, no_afternoon_break,
       incomplete, incidents, progress, completed_work, service_quality,
       images, reporter_name, reporter_user_id, job_content, timeline)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    event_id || null, event_label || '', location || '', report_date || '',
    JSON.stringify(km_staff || []), freelancer_staff || '',
    time_present || '', time_onset || '', time_off || '', time_end || '',
    no_lunch_break ? 1 : 0, no_afternoon_break ? 1 : 0,
    incomplete || '', incidents || '', progress || '', completed_work || '', service_quality || '',
    JSON.stringify(images || []), reporter_name || '',
    req.user?.id || null,
    job_content || '',
    JSON.stringify((timeline || []).filter(t => t.time)),
  );
  pushByRoles(`📋 Báo cáo sự kiện mới`, `${event_label || '—'} · ${reporter_name || req.user?.full_name || '—'}`, `/event-report?id=${result.lastInsertRowid}`, ALL_ROLES).catch(() => {});
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
  const report = db.prepare('SELECT * FROM event_reports WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Không tìm thấy báo cáo' });

  const { role } = req.user;
  const isDirector = role === 'DIRECTOR';
  const isOwner = report.reporter_user_id === req.user.id;

  if (!isDirector && !isOwner) return res.status(403).json({ error: 'Không có quyền chỉnh sửa báo cáo này' });
  if (!isDirector && !withinEditDeadline(report.report_date)) return res.status(403).json({ error: 'Đã quá hạn chỉnh sửa (hạn: ngày làm việc + 21:00 hôm sau)' });

  const {
    location,
    km_staff, freelancer_staff,
    time_present, time_onset, time_off, time_end,
    no_lunch_break, no_afternoon_break,
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
      no_lunch_break=?, no_afternoon_break=?,
      incomplete=?, incidents=?, progress=?, completed_work=?, service_quality=?,
      images=?, job_content=?, timeline=?, edit_history=?
    WHERE id=?
  `).run(
    location || '',
    JSON.stringify(km_staff || []), freelancer_staff || '',
    time_present || '', time_onset || '', time_off || '', time_end || '',
    no_lunch_break ? 1 : 0, no_afternoon_break ? 1 : 0,
    incomplete || '', incidents || '', progress || '', completed_work || '', service_quality || '',
    JSON.stringify(images || []),
    job_content || '',
    JSON.stringify((timeline || []).filter(t => t.time)),
    JSON.stringify(newHistory),
    req.params.id,
  );
  pushByRoles(`✏️ Báo cáo sự kiện cập nhật`, `${report.event_label || '—'} · ${report.reporter_name || '—'}`, `/event-report?id=${req.params.id}`, ALL_ROLES).catch(() => {});
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
  const { role, is_truong_phong, id: userId, full_name } = req.user;
  const isFullAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(role);

  const report = db.prepare(`
    SELECT er.id, er.event_label, er.report_date, er.reporter_name, er.reporter_user_id,
           er.job_content, er.deleted_at
    FROM event_reports er WHERE er.id = ?
  `).get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
  if (report.deleted_at) return res.status(410).json({ error: 'Báo cáo đã bị xóa trước đó' });

  if (!isFullAdmin && is_truong_phong && report.reporter_user_id) {
    const reporter = db.prepare('SELECT role FROM users WHERE id = ?').get(report.reporter_user_id);
    if (reporter && reporter.role !== role) {
      return res.status(403).json({ error: 'Chỉ được xóa báo cáo của nhân viên trong phòng' });
    }
  }

  const now = db.prepare("SELECT datetime('now','localtime') AS t").get().t;
  db.prepare('UPDATE event_reports SET deleted_at = ?, deleted_by_id = ? WHERE id = ?')
    .run(now, userId, report.id);
  db.prepare(`
    INSERT INTO report_delete_log (report_id, event_label, event_date, reporter_name, report_summary, deleted_by_id, deleted_by_name, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(report.id, report.event_label || '', report.report_date || '', report.reporter_name || '',
         report.job_content ? String(report.job_content).slice(0, 200) : '', userId, full_name, now);

  res.json({ ok: true });
});

router.get('/admin/delete-log', (req, res) => {
  const { role } = req.user;
  if (!['SUPER_ADMIN', 'DIRECTOR'].includes(role))
    return res.status(403).json({ error: 'Không có quyền' });
  const rows = db.prepare(`
    SELECT l.*, er.deleted_at AS soft_deleted_at
    FROM report_delete_log l
    LEFT JOIN event_reports er ON er.id = l.report_id
    ORDER BY l.deleted_at DESC
    LIMIT 200
  `).all();
  res.json(rows);
});

module.exports = router;
