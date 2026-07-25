const router = require('express').Router();
const db = require('../database');
const { requireAuth } = require('../middleware/auth');

function canAccess(req, res, next) {
  const { role, is_phan_lich_all } = req.user || {};
  if (['SUPER_ADMIN', 'DIRECTOR'].includes(role) || is_phan_lich_all) return next();
  return res.status(403).json({ error: 'Không có quyền' });
}

// GET /api/xac-nhan-cong?month=YYYY-MM
router.get('/', requireAuth, canAccess, (req, res) => {
  const { month } = req.query;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Thiếu tham số month (YYYY-MM)' });
  }

  const rows = db.prepare(`
    SELECT id, event_id, event_label, report_date,
           km_staff, time_present, time_onset, time_off, time_end,
           no_lunch_break, no_afternoon_break, is_holiday,
           confirmed_at
    FROM event_reports
    WHERE deleted_at IS NULL
      AND report_date LIKE ?
    ORDER BY report_date ASC, id ASC
  `).all(`${month}%`);

  res.json(rows.map(r => ({
    ...r,
    km_staff: JSON.parse(r.km_staff || '[]'),
  })));
});

// PATCH /api/xac-nhan-cong/:id/holiday
router.patch('/:id/holiday', requireAuth, canAccess, (req, res) => {
  const { is_holiday } = req.body;
  const report = db.prepare('SELECT id FROM event_reports WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
  db.prepare('UPDATE event_reports SET is_holiday = ? WHERE id = ?').run(is_holiday ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
