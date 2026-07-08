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

  const currentKeys = new Set(); // "lead_name|phase|date"

  for (const phase of PHASES) {
    const rawDates = sched[`${phase}_dates`] || sched[`${phase}_date`];
    const dates = parseDates(rawDates);
    if (!dates.length) continue;

    const rawLeads = sched[`${phase}_leads`];

    for (const date of dates) {
      const leads = parseLeads(rawLeads, date);
      for (const lead of leads) {
        if (!lead?.name) continue;
        currentKeys.add(`${lead.name}|${phase}|${date}`);
        const deadline = computeDeadline(date);
        const user = db.prepare('SELECT id FROM users WHERE full_name = ? AND is_active = 1 LIMIT 1').get(lead.name);
        db.prepare(`
          INSERT OR IGNORE INTO lead_report_obligations
            (schedule_id, event_id, event_name, lead_name, user_id, phase, assigned_date, deadline)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(scheduleId, sched.event_id || null, sched.event_name || '', lead.name, user?.id || null, phase, date, deadline);
        // Luôn cập nhật event_id, event_name, user_id (kể cả khi đổi sự kiện)
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
  // Lấy tất cả obligations đã qua deadline, chưa bị dismissed thủ công
  // Bỏ filter violation_created=0 để reprocess các obligation có thể bị set sai trước đây
  const overdue = db.prepare(`
    SELECT o.*, e.name AS ev_display
    FROM lead_report_obligations o
    LEFT JOIN events e ON e.id = o.event_id
    WHERE o.deadline <= ? AND (o.dismissed IS NULL OR o.dismissed = 0)
  `).all(now);

  for (const ob of overdue) {
    try {
      // Tìm báo cáo đã nộp (nếu có) — lấy cả created_at để biết nộp đúng hay trễ hạn
      const reportRow = ob.user_id
        ? db.prepare(`
            SELECT created_at FROM event_reports
            WHERE report_date = ? AND event_id IS ?
              AND (reporter_user_id = ? OR reporter_name = ?)
            ORDER BY created_at ASC LIMIT 1
          `).get(ob.assigned_date, ob.event_id, ob.user_id, ob.lead_name)
        : db.prepare(`
            SELECT created_at FROM event_reports
            WHERE report_date = ? AND event_id IS ? AND reporter_name = ?
            ORDER BY created_at ASC LIMIT 1
          `).get(ob.assigned_date, ob.event_id, ob.lead_name);

      const label = ob.ev_display || ob.event_name || 'Sự kiện';
      const phaseLabel = PHASE_LABEL[ob.phase] || ob.phase;
      const submittedAt = reportRow?.created_at?.slice(0, 16);

      // Kiểm tra event_id còn tồn tại không (FK = ON → dùng null nếu event đã xóa)
      const safeEventId = ob.event_id
        ? (db.prepare('SELECT id FROM events WHERE id = ?').get(ob.event_id) ? ob.event_id : null)
        : null;

      // Kiểm tra vi phạm đã tồn tại chưa (tránh tạo trùng khi reprocess)
      const violationExists = !!db.prepare(`
        SELECT id FROM violations
        WHERE violator = ? AND violation_type IN ('Không nộp báo cáo', 'Nộp báo cáo trễ')
          AND description LIKE ? LIMIT 1
      `).get(ob.lead_name, `%ngày ${ob.assigned_date}%`);

      const doInsertAndFlag = db.transaction(() => {
        if (!violationExists) {
          if (!reportRow) {
            db.prepare(`
              INSERT INTO violations (event_id, event_label, reporter_name, violator, violation_type, description)
              VALUES (?, ?, 'Hệ thống', ?, 'Không nộp báo cáo', ?)
            `).run(
              safeEventId, label, ob.lead_name,
              `Không nộp báo cáo sự kiện ngày ${ob.assigned_date} (${phaseLabel}). Hạn chót: ${ob.deadline}.`,
            );
          } else if (submittedAt > ob.deadline) {
            db.prepare(`
              INSERT INTO violations (event_id, event_label, reporter_name, violator, violation_type, description)
              VALUES (?, ?, 'Hệ thống', ?, 'Nộp báo cáo trễ', ?)
            `).run(
              safeEventId, label, ob.lead_name,
              `Nộp báo cáo sự kiện ngày ${ob.assigned_date} (${phaseLabel}) sau hạn chót ${ob.deadline} (nộp lúc ${reportRow.created_at}).`,
            );
          }
        }
        // Nộp trước hạn hoặc vi phạm đã tồn tại → chỉ đánh dấu đã xử lý
        db.prepare('UPDATE lead_report_obligations SET violation_created = 1 WHERE id = ?').run(ob.id);
      });
      doInsertAndFlag();
    } catch (e) {
      console.error(`[obligations] skip ob id=${ob.id} (${ob.lead_name}): ${e.message}`);
    }
  }
}

module.exports = { syncObligations, checkAndCreateViolations };
