const router = require('express').Router();
const db = require('../database');
const { requireAuth } = require('../middleware/auth');

function canEditAccess(req, res, next) {
  const { role, is_phan_lich_all } = req.user || {};
  if (['SUPER_ADMIN', 'DIRECTOR'].includes(role) || is_phan_lich_all) return next();
  return res.status(403).json({ error: 'Không có quyền' });
}

const PHASES = ['setup', 'teardown', 'rehearsal', 'filming'];

function parseDatesField(val) {
  if (!val) return [];
  if (typeof val === 'string' && val.startsWith('[')) {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [val];
}

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
           has_com_sang, has_com_trua, has_com_chieu, has_com_toi, has_nuoc, has_taxi, taxi_amount,
           xang_xe, xang_xe_note, tien_nuoc, tien_nuoc_note, giu_xe, giu_xe_note, phu_cap_khac, phu_cap_khac_note,
           per_person_allowances
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

  // Build leadMap: { 'eventId::date': [leadNames] } — chỉ người được chỉ định lead (is_lead=1, chưa dismissed)
  const obligations = db.prepare(`
    SELECT event_id, assigned_date, lead_name
    FROM lead_report_obligations
    WHERE assigned_date LIKE ?
      AND (is_lead IS NULL OR is_lead = 1)
  `).all(`${month}%`);
  const leadMap = {};
  for (const ob of obligations) {
    if (!ob.event_id) continue;
    const key = `${ob.event_id}::${ob.assigned_date}`;
    if (!leadMap[key]) leadMap[key] = [];
    if (!leadMap[key].includes(ob.lead_name)) leadMap[key].push(ob.lead_name);
  }

  // Build salaryByName: { name: { lcb, lnc, lot, luong_theo_thang } }
  const salaryRows = db.prepare('SELECT full_name, luong_co_ban, luong_ngay_cong, luong_ot_h, bac_luong, luong_theo_thang, phu_cap, role, position FROM users WHERE full_name IS NOT NULL AND is_active = 1').all();
  const salaryByName = {};
  for (const u of salaryRows) {
    if (u.full_name) salaryByName[u.full_name] = { lcb: u.luong_co_ban || 0, lnc: u.luong_ngay_cong || 0, lot: u.luong_ot_h || 0, bac: u.bac_luong || '', luong_theo_thang: u.luong_theo_thang ? 1 : 0, pc: u.phu_cap || 0, role: u.role || '', truong_phong: u.position === 'Trưởng phòng' ? 1 : 0 };
  }

  // Build leaveConLaiByName: { name: conLai } — dùng để trừ lương khi nghỉ vượt phép
  {
    const [yyyy, mm] = month.split('-');
    const monthNum = parseInt(mm, 10);
    const monthStart = `${yyyy}-${mm}-01`;
    const leaveRecs = db.prepare(`SELECT user_id, ngay, so_ngay FROM ngay_phep WHERE strftime('%Y', ngay) = ?`).all(yyyy);
    const leaveByUser = {};
    for (const r of leaveRecs) {
      if (!leaveByUser[r.user_id]) leaveByUser[r.user_id] = [];
      leaveByUser[r.user_id].push(r);
    }
    const leaveOvRows = db.prepare(`SELECT user_id, month, value FROM ngay_phep_override WHERE year = ?`).all(yyyy);
    const leaveOvByUser = {};
    for (const ov of leaveOvRows) {
      if (!leaveOvByUser[ov.user_id]) leaveOvByUser[ov.user_id] = {};
      leaveOvByUser[ov.user_id][ov.month] = ov.value;
    }
    const leaveConLaiByName = {};
    for (const u of db.prepare(`SELECT id, full_name, phep_nam FROM users WHERE is_active = 1 AND full_name IS NOT NULL`).all()) {
      const recs = leaveByUser[u.id] || [];
      const uov = leaveOvByUser[u.id] || {};
      const phep_nam = u.phep_nam ?? 12;
      const pnOvVal = uov[`pn_${yyyy}-${mm}`];
      const tl = pnOvVal !== undefined ? pnOvVal : Math.min(phep_nam, monthNum - 1);
      const da_nghi = (uov[''] !== undefined) ? uov[''] : recs.filter(r => r.ngay < monthStart).reduce((s, r) => s + r.so_ngay, 0);
      const nghi_thang = (uov[`${yyyy}-${mm}`] !== undefined) ? uov[`${yyyy}-${mm}`] : recs.filter(r => r.ngay.startsWith(`${yyyy}-${mm}`)).reduce((s, r) => s + r.so_ngay, 0);
      leaveConLaiByName[u.full_name] = tl - da_nghi - nghi_thang;
    }
    res.locals.leaveConLaiByName = leaveConLaiByName;
  }

  // Build phaseDateMap: { 'eventId::YYYY-MM-DD': phase }
  const phaseRows = db.prepare('SELECT event_id, setup_date, teardown_date, rehearsal_date, filming_date FROM work_schedules WHERE deleted_at IS NULL AND event_id IS NOT NULL').all();
  const phaseDateMap = {};
  for (const s of phaseRows) {
    const eid = s.event_id;
    for (const [phase, col] of [['filming','filming_date'],['rehearsal','rehearsal_date'],['setup','setup_date'],['teardown','teardown_date']]) {
      for (const date of parseDatesField(s[col])) {
        if (date) phaseDateMap[`${eid}::${date}`] = phase;
      }
    }
  }

  // Build violByName: { name: count } — chỉ vi phạm về báo cáo trong tháng
  // Ưu tiên lọc theo ngày trong description (chứa 'YYYY-MM-'),
  // fallback created_at cho vi phạm không có ngày trong description
  const violRows = db.prepare(`
    SELECT violator, COUNT(*) AS cnt
    FROM violations
    WHERE violation_type IN ('Không nộp báo cáo', 'Nộp báo cáo trễ')
      AND (
        description LIKE '%' || ? || '-%'
        OR (description NOT LIKE '%20__-__-%' AND created_at LIKE ?)
      )
    GROUP BY violator
  `).all(month, `${month}%`);
  const violByName = {};
  for (const v of violRows) violByName[v.violator] = v.cnt;

  res.json({
    reports: rows.map(r => ({
      ...r,
      km_staff: JSON.parse(r.km_staff || '[]'),
      per_person_allowances: (() => { try { return JSON.parse(r.per_person_allowances || '{}'); } catch { return {}; } })(),
      leaders: r.event_id ? (leadMap[`${r.event_id}::${r.report_date}`] || []) : [],
    })),
    supportByDate,
    violByName,
    salaryByName,
    phaseDateMap,
    leaveConLaiByName: res.locals.leaveConLaiByName || {},
  });
});

// PATCH /api/xac-nhan-cong/:id/time-fields — chỉ update giờ/nghỉ, không đụng content báo cáo
router.patch('/:id/time-fields', requireAuth, canEditAccess, (req, res) => {
  const report = db.prepare('SELECT id FROM event_reports WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
  const { time_present, time_end, time_onset, no_lunch_break, no_afternoon_break, is_holiday } = req.body;
  db.prepare(`UPDATE event_reports SET
    time_present=?, time_end=?, time_onset=?,
    no_lunch_break=?, no_afternoon_break=?, is_holiday=?
    WHERE id=?`).run(
    time_present || '', time_end || '', time_onset || '',
    no_lunch_break ? 1 : 0, no_afternoon_break ? 1 : 0, is_holiday ? 1 : 0,
    report.id,
  );
  res.json({ ok: true });
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
