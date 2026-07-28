const router = require('express').Router();
const db = require('../database');
const { requireAuth } = require('../middleware/auth');

function canEditAccess(req, res, next) {
  const { role, is_phan_lich_all } = req.user || {};
  if (['SUPER_ADMIN', 'DIRECTOR'].includes(role) || is_phan_lich_all) return next();
  return res.status(403).json({ error: 'Không có quyền' });
}

const PHASES = ['setup', 'teardown', 'rehearsal', 'filming'];

// GET /api/xac-nhan-cong?month=YYYY-MM  (tất cả user đã đăng nhập)
router.get('/', requireAuth, (req, res) => {
  const { month } = req.query;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Thiếu tham số month (YYYY-MM)' });
  }

  const rows = db.prepare(`
    SELECT id, event_id, event_label, report_date,
           km_staff, time_present, time_onset, time_off, time_end,
           no_lunch_break, no_afternoon_break, is_holiday,
           confirmed_at,
           has_com_sang, has_com_trua, has_com_chieu, has_com_toi, has_nuoc, has_taxi, taxi_amount
    FROM event_reports
    WHERE deleted_at IS NULL
      AND report_date LIKE ?
    ORDER BY report_date ASC, id ASC
  `).all(`${month}%`);

  // Build supportByDate: { 'YYYY-MM-DD': [name, ...] }
  // Dựa trên km_support trong work_schedules — người hỗ trợ bộ phận khác
  const supportByDate = {};
  const schedRows = db.prepare(`SELECT ${PHASES.map(p => `${p}_km_support`).join(', ')} FROM work_schedules WHERE deleted_at IS NULL`).all();
  for (const s of schedRows) {
    for (const p of PHASES) {
      const raw = s[`${p}_km_support`];
      if (!raw) continue;
      try {
        const map = JSON.parse(raw); // { date: { name: forDept } }
        for (const [date, persons] of Object.entries(map)) {
          if (!date.startsWith(month)) continue;
          for (const name of Object.keys(persons)) {
            if (!supportByDate[date]) supportByDate[date] = [];
            if (!supportByDate[date].includes(name)) supportByDate[date].push(name);
          }
        }
      } catch {}
    }
  }

  // Build leadMap: { 'eventId::date': [leadNames] }
  const obligations = db.prepare(`
    SELECT event_id, assigned_date, lead_name
    FROM lead_report_obligations
    WHERE assigned_date LIKE ?
  `).all(`${month}%`);
  const leadMap = {};
  for (const ob of obligations) {
    if (!ob.event_id) continue;
    const key = `${ob.event_id}::${ob.assigned_date}`;
    if (!leadMap[key]) leadMap[key] = [];
    if (!leadMap[key].includes(ob.lead_name)) leadMap[key].push(ob.lead_name);
  }

  res.json({
    reports: rows.map(r => ({
      ...r,
      km_staff: JSON.parse(r.km_staff || '[]'),
      leaders: r.event_id ? (leadMap[`${r.event_id}::${r.report_date}`] || []) : [],
    })),
    supportByDate,
  });
});

// PATCH /api/xac-nhan-cong/:id/holiday
router.patch('/:id/holiday', requireAuth, canEditAccess, (req, res) => {
  const { is_holiday } = req.body;
  const report = db.prepare('SELECT id FROM event_reports WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
  db.prepare('UPDATE event_reports SET is_holiday = ? WHERE id = ?').run(is_holiday ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
