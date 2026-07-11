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
      SELECT o.*, e.name AS event_display, ${reportSubquery}
      FROM lead_report_obligations o
      LEFT JOIN events e ON e.id = o.event_id
      ORDER BY o.assigned_date DESC
    `).all();
  } else {
    rows = db.prepare(`
      SELECT o.*, e.name AS event_display, ${reportSubquery}
      FROM lead_report_obligations o
      LEFT JOIN events e ON e.id = o.event_id
      WHERE o.user_id = ? OR o.lead_name = ?
      ORDER BY o.assigned_date DESC
    `).all(userId, full_name);
  }

  const now = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');

  // lock_time = assigned_date + 1 ngày 23:59 VN (khi bị "khóa" vi phạm)
  // ws_lock_time = assigned_date + 2 ngày 12:00 VN (WorkSchedule ẩn sau thêm 12 tiếng)
  function computeLockTimes(assignedDate) {
    const [y, m, d] = assignedDate.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const ny = next.getUTCFullYear(), nm = String(next.getUTCMonth()+1).padStart(2,'0'), nd = String(next.getUTCDate()).padStart(2,'0');
    const next2 = new Date(Date.UTC(y, m - 1, d + 2));
    const ny2 = next2.getUTCFullYear(), nm2 = String(next2.getUTCMonth()+1).padStart(2,'0'), nd2 = String(next2.getUTCDate()).padStart(2,'0');
    return {
      lock_time:    `${ny}-${nm}-${nd} 23:59`,
      ws_lock_time: `${ny2}-${nm2}-${nd2} 12:00`,
    };
  }

  res.json(rows.map(r => {
    const submitted = !!r.report_id;
    const { lock_time, ws_lock_time } = computeLockTimes(r.assigned_date);
    const overdue   = !submitted && !!r.deadline && r.deadline.slice(0, 16) <= now;
    const locked    = !submitted && lock_time <= now;
    const ws_locked = !submitted && ws_lock_time <= now;
    return { ...r, lock_time, ws_lock_time, submitted, overdue, locked, ws_locked };
  }));
});

module.exports = router;
