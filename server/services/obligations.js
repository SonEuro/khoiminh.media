const db = require('../database');

const PHASES = ['setup', 'teardown', 'rehearsal', 'filming'];
const PHASE_LABEL = { setup: 'Setup', teardown: 'Tháo dỡ', rehearsal: 'Rehearsal', filming: 'Ghi hình' };

// VN time helpers (Vietnam = UTC+7, no DST)
function getVNNow() {
  const vnTime = new Date(Date.now() + 7 * 3600 * 1000);
  return vnTime.toISOString().slice(0, 16).replace('T', ' ');
}

// deadline = day after assigned_date at 12:00 VN
function computeDeadline(date) {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const ny = next.getUTCFullYear();
  const nm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(next.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd} 12:00`;
}

function parseDates(raw) {
  if (!raw) return [];
  if (typeof raw === 'string' && raw.startsWith('[')) {
    try { const v = JSON.parse(raw); if (Array.isArray(v)) return v; } catch {}
  }
  if (typeof raw === 'string' && raw.match(/^\d{4}-\d{2}-\d{2}$/)) return [raw];
  return [];
}

function parseLeads(raw, date) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v; // flat list: same leads for all dates
    if (v && typeof v === 'object') return v[date] || []; // map: per-date leads
  } catch {}
  return [];
}

function syncObligations(scheduleId) {
  const sched = db.prepare('SELECT * FROM work_schedules WHERE id = ?').get(scheduleId);
  if (!sched) return;

  for (const phase of PHASES) {
    const rawDates = sched[`${phase}_dates`] || sched[`${phase}_date`];
    const dates = parseDates(rawDates);
    if (!dates.length) continue;

    const rawLeads = sched[`${phase}_leads`];

    for (const date of dates) {
      const leads = parseLeads(rawLeads, date);
      for (const lead of leads) {
        if (!lead?.name) continue;
        const deadline = computeDeadline(date);
        const user = db.prepare('SELECT id FROM users WHERE full_name = ? AND is_active = 1 LIMIT 1').get(lead.name);
        db.prepare(`
          INSERT OR IGNORE INTO lead_report_obligations
            (schedule_id, event_id, event_name, lead_name, user_id, phase, assigned_date, deadline)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(scheduleId, sched.event_id || null, sched.event_name || '', lead.name, user?.id || null, phase, date, deadline);
        // Cập nhật user_id nếu vừa tìm được
        if (user?.id) {
          db.prepare('UPDATE lead_report_obligations SET user_id = ?, event_name = ? WHERE schedule_id = ? AND lead_name = ? AND phase = ? AND assigned_date = ?')
            .run(user.id, sched.event_name || '', scheduleId, lead.name, phase, date);
        }
      }
    }
  }
}

function checkAndCreateViolations() {
  const now = getVNNow();
  const overdue = db.prepare(`
    SELECT o.*, e.name AS ev_display
    FROM lead_report_obligations o
    LEFT JOIN events e ON e.id = o.event_id
    WHERE o.deadline <= ? AND o.violation_created = 0
  `).all(now);

  for (const ob of overdue) {
    // Kiểm tra xem đã nộp báo cáo chưa
    let hasReport = false;
    if (ob.user_id) {
      hasReport = !!db.prepare(`
        SELECT 1 FROM event_reports
        WHERE report_date = ? AND event_id = ? AND (reporter_user_id = ? OR reporter_name = ?)
        LIMIT 1
      `).get(ob.assigned_date, ob.event_id, ob.user_id, ob.lead_name);
    } else {
      hasReport = !!db.prepare(`
        SELECT 1 FROM event_reports
        WHERE report_date = ? AND event_id = ? AND reporter_name = ?
        LIMIT 1
      `).get(ob.assigned_date, ob.event_id, ob.lead_name);
    }

    if (!hasReport) {
      const label = ob.ev_display || ob.event_name || 'Sự kiện';
      const desc = `Không nộp báo cáo sự kiện ngày ${ob.assigned_date} (${PHASE_LABEL[ob.phase] || ob.phase}) trong vòng 12 giờ sau khi kết thúc ngày làm việc.`;
      db.prepare(`
        INSERT INTO violations (event_id, event_label, reporter_name, violator, violation_type, description)
        VALUES (?, ?, 'Hệ thống', ?, 'Không nộp báo cáo', ?)
      `).run(ob.event_id || null, label, ob.lead_name, desc);
    }
    db.prepare('UPDATE lead_report_obligations SET violation_created = 1 WHERE id = ?').run(ob.id);
  }
}

module.exports = { syncObligations, checkAndCreateViolations };
