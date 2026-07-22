const db = require('../database');

const PHASES = ['setup', 'teardown', 'rehearsal', 'filming'];
const PHASE_LABEL = { setup: 'Setup', teardown: 'Tháo dỡ', rehearsal: 'Rehearsal', filming: 'Ghi hình' };

function getVNNow() {
  const vnTime = new Date(Date.now() + 7 * 3600 * 1000);
  return vnTime.toISOString().slice(0, 16).replace('T', ' ');
}

// Hạn nộp đúng hẹn: ngày làm việc + 1 ngày 12:00 VN
function computeDeadline(date) {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const ny = next.getUTCFullYear();
  const nm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(next.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd} 12:00`;
}

// Hạn cuối cùng: ngày làm việc + 1 ngày 23:59 VN — quá mới tạo "Không nộp báo cáo"
function computeHardDeadline(date) {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const ny = next.getUTCFullYear();
  const nm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(next.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd} 23:59`;
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
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return v[date] || [];
  } catch {}
  return [];
}

// Trả về mảng tên (string) km_staff — hỗ trợ flat array hoặc per-date map
function parseKmStaff(raw, date) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter(Boolean);
    if (v && typeof v === 'object') return (v[date] || []).filter(Boolean);
  } catch {}
  return [];
}

function syncObligations(scheduleId) {
  const sched = db.prepare('SELECT * FROM work_schedules WHERE id = ?').get(scheduleId);
  if (!sched) return;

  const currentKeys = new Set();

  for (const phase of PHASES) {
    const rawDates = sched[`${phase}_dates`] || sched[`${phase}_date`];
    const dates = parseDates(rawDates);
    if (!dates.length) continue;

    const rawLeads = sched[`${phase}_leads`];

    for (const date of dates) {
      const leads = parseLeads(rawLeads, date).filter(l => l?.name);

      // Nếu không có leads → km_staff đầu tiên chịu trách nhiệm báo cáo
      let obligated = leads;
      if (obligated.length === 0) {
        const kmNames = parseKmStaff(sched[`${phase}_km_staff`], date);
        if (kmNames.length > 0) obligated = [{ name: kmNames[0] }];
      }

      for (const lead of obligated) {
        if (!lead?.name) continue;
        currentKeys.add(`${lead.name}|${phase}|${date}`);
        const deadline = computeDeadline(date);
        const user = db.prepare('SELECT id FROM users WHERE full_name = ? AND is_active = 1 LIMIT 1').get(lead.name);
        db.prepare(`
          INSERT OR IGNORE INTO lead_report_obligations
            (schedule_id, event_id, event_name, lead_name, user_id, phase, assigned_date, deadline)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(scheduleId, sched.event_id || null, sched.event_name || '', lead.name, user?.id || null, phase, date, deadline);
        db.prepare(`
          UPDATE lead_report_obligations
          SET event_id = ?, event_name = ?, user_id = COALESCE(?, user_id)
          WHERE schedule_id = ? AND lead_name = ? AND phase = ? AND assigned_date = ?
        `).run(sched.event_id || null, sched.event_name || '', user?.id || null, scheduleId, lead.name, phase, date);
      }
    }
  }

  // Xóa obligations cho lead/ngày đã bị xóa khỏi lịch (chỉ khi chưa xử lý vi phạm)
  const existing = db.prepare(`
    SELECT lead_name, phase, assigned_date FROM lead_report_obligations
    WHERE schedule_id = ? AND violation_created = 0
  `).all(scheduleId);
  for (const row of existing) {
    if (!currentKeys.has(`${row.lead_name}|${row.phase}|${row.assigned_date}`)) {
      db.prepare(`
        DELETE FROM lead_report_obligations
        WHERE schedule_id = ? AND lead_name = ? AND phase = ? AND assigned_date = ? AND violation_created = 0
      `).run(scheduleId, row.lead_name, row.phase, row.assigned_date);
    }
  }
}

function checkAndCreateViolations() {
  const now = getVNNow();

  // Lấy obligations đã qua hạn đúng hẹn (12:00), chưa bị dismissed
  const overdue = db.prepare(`
    SELECT o.*, e.name AS ev_display
    FROM lead_report_obligations o
    LEFT JOIN events e ON e.id = o.event_id
    WHERE o.deadline <= ? AND (o.dismissed IS NULL OR o.dismissed = 0)
  `).all(now);

  for (const ob of overdue) {
    try {
      const hardDeadline = computeHardDeadline(ob.assigned_date);
      const hardPassed = now >= hardDeadline;

      const nextDay = (() => {
        const [y, m, d] = ob.assigned_date.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d + 1));
        return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
      })();

      const reportRow = ob.user_id
        ? db.prepare(`
            SELECT created_at FROM event_reports
            WHERE report_date IN (?, ?)
              AND (? IS NULL OR event_id = ?)
              AND (reporter_user_id = ? OR reporter_name = ?)
            ORDER BY created_at ASC LIMIT 1
          `).get(ob.assigned_date, nextDay, ob.event_id, ob.event_id, ob.user_id, ob.lead_name)
        : db.prepare(`
            SELECT created_at FROM event_reports
            WHERE report_date IN (?, ?)
              AND (? IS NULL OR event_id = ?)
              AND reporter_name = ?
            ORDER BY created_at ASC LIMIT 1
          `).get(ob.assigned_date, nextDay, ob.event_id, ob.event_id, ob.lead_name);

      const label = ob.ev_display || ob.event_name || 'Sự kiện';
      const phaseLabel = PHASE_LABEL[ob.phase] || ob.phase;
      const submittedAt = reportRow?.created_at?.slice(0, 16);

      // Nếu event đã bị xóa vĩnh viễn → bỏ qua obligation này
      if (ob.event_id && !db.prepare('SELECT id FROM events WHERE id = ?').get(ob.event_id)) {
        db.prepare('UPDATE lead_report_obligations SET dismissed = 1 WHERE id = ?').run(ob.id);
        continue;
      }
      const safeEventId = ob.event_id || null;

      const existingViol = db.prepare(`
        SELECT id, violation_type FROM violations
        WHERE violator = ? AND violation_type IN ('Không nộp báo cáo', 'Nộp báo cáo trễ')
          AND description LIKE ? LIMIT 1
      `).get(ob.lead_name, `%ngày ${ob.assigned_date}%`);

      if (!reportRow) {
        // Chưa nộp — tạo vi phạm ngay khi qua deadline 12:00
        db.transaction(() => {
          if (!existingViol) {
            db.prepare(`
              INSERT INTO violations (event_id, event_label, reporter_name, violator, violation_type, description)
              VALUES (?, ?, 'Hệ thống', ?, 'Không nộp báo cáo', ?)
            `).run(
              safeEventId, label, ob.lead_name,
              `Không nộp báo cáo sự kiện ngày ${ob.assigned_date} (${phaseLabel}). Hạn nộp: ${ob.deadline}.`,
            );
          }
          db.prepare('UPDATE lead_report_obligations SET violation_created = 1 WHERE id = ?').run(ob.id);
        })();

      } else if (submittedAt > ob.deadline) {
        // Nộp sau 12:00 → "Nộp báo cáo trễ"
        const newDesc = `Nộp báo cáo sự kiện ngày ${ob.assigned_date} (${phaseLabel}) sau hạn đúng hẹn ${ob.deadline} (nộp lúc ${reportRow.created_at}).`;
        db.transaction(() => {
          if (!existingViol) {
            db.prepare(`
              INSERT INTO violations (event_id, event_label, reporter_name, violator, violation_type, description)
              VALUES (?, ?, 'Hệ thống', ?, 'Nộp báo cáo trễ', ?)
            `).run(safeEventId, label, ob.lead_name, newDesc);
          } else if (existingViol.violation_type === 'Không nộp báo cáo') {
            // Nâng cấp: nộp trong khoảng 12:00–23:59 sau hard deadline
            db.prepare(`
              UPDATE violations SET violation_type = 'Nộp báo cáo trễ', description = ? WHERE id = ?
            `).run(newDesc, existingViol.id);
          }
          db.prepare('UPDATE lead_report_obligations SET violation_created = 1 WHERE id = ?').run(ob.id);
        })();

      } else {
        // Nộp đúng hẹn — đánh dấu đã xử lý, không tạo vi phạm
        db.prepare('UPDATE lead_report_obligations SET violation_created = 1 WHERE id = ?').run(ob.id);
      }

    } catch (e) {
      console.error(`[obligations] skip ob id=${ob.id} (${ob.lead_name}): ${e.message}`);
    }
  }
}

// 23:59 mỗi ngày: finalize vi phạm tự động
const ranObligations = { date: null };

function scheduleObligationsCheck() {
  setInterval(() => {
    const now = new Date(Date.now() + 7 * 3600 * 1000); // VN time
    const hhmm = now.getUTCHours() * 60 + now.getUTCMinutes();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

    // 23:59 → 23:68 (window 10 phút)
    if (hhmm >= 23 * 60 + 59 && hhmm < 24 * 60 + 9 && ranObligations.date !== today) {
      ranObligations.date = today;
      console.log('[obligations] 23:59 scheduled check...');
      try { checkAndCreateViolations(); } catch (e) { console.error('[obligations] scheduled check error:', e.message); }
    }
  }, 60_000);
}

module.exports = { syncObligations, checkAndCreateViolations, scheduleObligationsCheck };
