const router = require('express').Router();
const db = require('../database');
const { checkAndCreateViolations } = require('../services/obligations');

router.get('/', (req, res) => {
  try { checkAndCreateViolations(); } catch (e) { console.error('[obligations] check error:', e.message); }

  const { role, id: userId, full_name, is_truong_phong, is_phan_lich_all } = req.user;
  const isAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(role) || !!is_truong_phong || !!is_phan_lich_all;

  // Cho phép report_date = assigned_date HOẶC ngày hôm sau (người dùng có thể nộp muộn 1 ngày)
  const reportSubquery = `
    (SELECT id FROM event_reports
     WHERE report_date IN (o.assigned_date, date(o.assigned_date, '+1 day'))
       AND (o.event_id IS NULL OR event_id = o.event_id)
       AND (reporter_user_id = o.user_id OR reporter_name = o.lead_name)
     ORDER BY created_at ASC LIMIT 1) AS report_id
  `;

  let rows;
  if (isAdmin) {
    rows = db.prepare(`
      SELECT o.*, e.name AS event_display,
        datetime(o.deadline, '+24 hours') AS lock_time,
        ${reportSubquery}
      FROM lead_report_obligations o
      LEFT JOIN events e ON e.id = o.event_id
      ORDER BY o.assigned_date DESC
    `).all();
  } else {
    rows = db.prepare(`
      SELECT o.*, e.name AS event_display,
        datetime(o.deadline, '+24 hours') AS lock_time,
        ${reportSubquery}
      FROM lead_report_obligations o
      LEFT JOIN events e ON e.id = o.event_id
      WHERE o.user_id = ? OR o.lead_name = ?
      ORDER BY o.assigned_date DESC
    `).all(userId, full_name);
  }

  const now = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
  res.json(rows.map(r => {
    const submitted = !!r.report_id;
    const overdue = !submitted && !!r.deadline && r.deadline <= now;
    const locked  = !submitted && !!r.lock_time && r.lock_time <= now;
    return { ...r, submitted, overdue, locked };
  }));
});

module.exports = router;
