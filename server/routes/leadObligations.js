const router = require('express').Router();
const db = require('../database');
const { checkAndCreateViolations } = require('../services/obligations');

router.get('/', (req, res) => {
  try { checkAndCreateViolations(); } catch (e) { console.error('[obligations] check error:', e.message); }

  const { role, id: userId, full_name, is_truong_phong } = req.user;
  const isAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(role) || !!is_truong_phong;

  const joinReport = `
    LEFT JOIN event_reports er
      ON er.report_date = o.assigned_date
      AND er.event_id IS o.event_id
      AND (er.reporter_user_id = o.user_id OR er.reporter_name = o.lead_name)
  `;

  let rows;
  if (isAdmin) {
    rows = db.prepare(`
      SELECT o.*, e.name AS event_display, er.id AS report_id
      FROM lead_report_obligations o
      LEFT JOIN events e ON e.id = o.event_id
      ${joinReport}
      ORDER BY o.assigned_date DESC
    `).all();
  } else {
    rows = db.prepare(`
      SELECT o.*, e.name AS event_display, er.id AS report_id
      FROM lead_report_obligations o
      LEFT JOIN events e ON e.id = o.event_id
      ${joinReport}
      WHERE o.user_id = ? OR o.lead_name = ?
      ORDER BY o.assigned_date DESC
    `).all(userId, full_name);
  }

  const now = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
  res.json(rows.map(r => ({
    ...r,
    submitted: !!r.report_id,
    overdue: !r.report_id && r.deadline <= now,
  })));
});

module.exports = router;
