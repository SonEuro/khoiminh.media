const router = require('express').Router();
const db = require('../database');
const { syncObligations } = require('../services/obligations');
const { pushByRoles } = require('../services/pushNotify');
const ALL_ROLES = ['DIRECTOR','SUPER_ADMIN','PRODUCTION','ACCOUNTING','TECHNICAL','ATAS','STAGE','CSVC'];

function canPhanLich(req, res, next) {
  const { role, is_phan_lich, is_phan_lich_all } = req.user || {};
  if (['SUPER_ADMIN', 'DIRECTOR'].includes(role) || is_phan_lich || is_phan_lich_all) return next();
  return res.status(403).json({ error: 'Không có quyền phân lịch làm việc' });
}

function isPastSchedule(sched) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const dates = ['setup', 'teardown', 'rehearsal', 'filming'].flatMap(p => {
    const val = sched[`${p}_date`]; // DB column is singular
    if (!val) return [];
    if (typeof val === 'string' && val.startsWith('[')) {
      try { return JSON.parse(val); } catch { return []; }
    }
    return [val];
  });
  return dates.length > 0 && dates.every(d => d < today);
}

function canEditSchedule(sched, user) {
  if (['SUPER_ADMIN', 'DIRECTOR'].includes(user.role)) return true;
  if (isPastSchedule(sched)) return false; // chỉ SA/Director mới sửa lịch đã qua
  if (!!user.is_phan_lich_all) return true;
  if (!!user.is_truong_phong) return true;
  if (sched.status === 'draft') return !!user.is_phan_lich;
  return sched.scheduler_user_id === user.id;
}

function canDeleteSchedule(sched, user) {
  if (sched.status !== 'draft') return user.role === 'SUPER_ADMIN';
  if (['SUPER_ADMIN', 'DIRECTOR'].includes(user.role)) return true;
  if (!!user.is_phan_lich_all) return true;
  if (!!user.is_truong_phong) return !isPastSchedule(sched);
  return !!user.is_phan_lich || sched.scheduler_user_id === user.id;
}

const PHASES = ['setup', 'teardown', 'rehearsal', 'filming'];

function parseDatesField(val) {
  if (!val) return [];
  if (typeof val === 'string' && val.startsWith('[')) {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [val]; // backward compat: old single-date string
}

function serializeDate(val) {
  if (!val) return null;
  if (Array.isArray(val)) return val.length ? JSON.stringify(val) : null;
  return val;
}

function parseJsonMapField(raw) {
  if (!raw) return { flat: [], map: null };
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return { flat: v, map: null };
    if (v && typeof v === 'object') return { flat: Object.values(v).flat().filter(Boolean), map: v };
  } catch {}
  return { flat: [], map: null };
}

function parseFreelancersField(raw) {
  if (!raw) return { flat: '', map: null };
  if (raw.startsWith('{')) {
    try {
      const v = JSON.parse(raw);
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const firstVal = Object.values(v)[0];
        if (firstVal && typeof firstVal === 'object') {
          // New format: {date: {dept: "names"}}
          const allNames = Object.values(v).flatMap(dObj =>
            Object.values(dObj || {}).flatMap(s => (s || '').split(',').map(n => n.trim())).filter(Boolean)
          );
          return { flat: allNames.join(', '), map: v };
        }
        // Old format: {date: "string"}
        return { flat: Object.values(v).filter(Boolean).join(', '), map: null };
      }
    } catch {}
  }
  return { flat: raw, map: null };
}

function serializeFieldValue(v) {
  if (!v) return typeof v === 'string' ? '' : null;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function parseNotesMap(raw) {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  } catch {}
  return {};
}

function parseRow(row) {
  const out = { ...row };
  for (const p of PHASES) {
    const { flat: flatLeads, map: leadsMap } = parseJsonMapField(row[`${p}_leads`]);
    out[`${p}_leads`]     = flatLeads;
    out[`${p}_leads_map`] = leadsMap;

    const { flat: flatKm, map: kmMap } = parseJsonMapField(row[`${p}_km_staff`]);
    out[`${p}_km_staff`]     = flatKm;
    out[`${p}_km_staff_map`] = kmMap;

    const { flat: flatFree, map: freeMap } = parseFreelancersField(row[`${p}_freelancers`]);
    out[`${p}_freelancers`]     = flatFree;
    out[`${p}_freelancers_map`] = freeMap;

    out[`${p}_notes`]       = parseNotesMap(row[`${p}_notes`]);
    out[`${p}_start_times`] = parseNotesMap(row[`${p}_start_times`]);
    out[`${p}_km_support`]  = parseNotesMap(row[`${p}_km_support`]);
    out[`${p}_dates`] = parseDatesField(row[`${p}_date`]);
    out[`${p}_date`]  = out[`${p}_dates`][0] || null;
  }
  return out;
}

router.get('/trash', (req, res) => {
  const { role } = req.user;
  if (!['SUPER_ADMIN', 'DIRECTOR'].includes(role))
    return res.status(403).json({ error: 'Không có quyền' });
  const rows = db.prepare(`
    SELECT *,
      CAST((julianday(datetime(deleted_at, '+30 days')) - julianday('now','localtime')) AS INTEGER) + 1 AS days_left
    FROM work_schedules WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC
  `).all();
  res.json(rows.map(parseRow));
});

router.get('/', (req, res) => {
  const { event_id } = req.query;
  const params = [];
  let sql = 'SELECT * FROM work_schedules WHERE deleted_at IS NULL';
  if (event_id) { sql += ' AND event_id = ?'; params.push(event_id); }
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(parseRow));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM work_schedules WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy lịch làm việc' });
  res.json(parseRow(row));
});

router.post('/', canPhanLich, (req, res) => {
  const b = req.body;
  if (!b.event_name?.trim()) return res.status(400).json({ error: 'Tên sự kiện là bắt buộc' });

  const cols = ['event_id', 'event_name', 'scheduler_user_id', 'scheduler_name', 'client', 'location',
    'setup_date', 'teardown_date', 'rehearsal_date', 'filming_date'];
  const vals = [
    b.event_id || null, b.event_name.trim(), req.user.id, req.user.full_name,
    b.client || null, b.location || null,
    serializeDate(b.setup_date), serializeDate(b.teardown_date),
    serializeDate(b.rehearsal_date), serializeDate(b.filming_date),
  ];
  for (const p of PHASES) {
    cols.push(`${p}_leads`, `${p}_km_staff`, `${p}_freelancers`, `${p}_notes`, `${p}_start_times`, `${p}_km_support`);
    vals.push(JSON.stringify(b[`${p}_leads`] || {}), JSON.stringify(b[`${p}_km_staff`] || {}), serializeFieldValue(b[`${p}_freelancers`]) || '', JSON.stringify(b[`${p}_notes`] || {}), JSON.stringify(b[`${p}_start_times`] || {}), JSON.stringify(b[`${p}_km_support`] || {}));
  }
  const placeholders = cols.map(() => '?').join(',');
  const r = db.prepare(`INSERT INTO work_schedules (${cols.join(',')}) VALUES (${placeholders})`).run(...vals);
  try { syncObligations(r.lastInsertRowid); } catch (e) { console.error('[obligations] sync error:', e.message); }
  pushByRoles(`📅 Lịch làm việc mới`, `${b.event_name.trim()}${b.location ? ' · ' + b.location : ''}`, '/work-schedules', ALL_ROLES).catch(() => {});
  res.json({ id: r.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const sched = db.prepare('SELECT * FROM work_schedules WHERE id = ?').get(req.params.id);
  if (!sched) return res.status(404).json({ error: 'Không tìm thấy lịch làm việc' });
  if (!canEditSchedule(sched, req.user)) return res.status(403).json({ error: 'Lịch đã xác nhận, không có quyền sửa' });

  const b = req.body;
  const cols = ['event_id', 'event_name', 'client', 'location', 'setup_date', 'teardown_date', 'rehearsal_date', 'filming_date'];
  const vals = [
    b.event_id || null, b.event_name?.trim() || sched.event_name,
    b.client || null, b.location || null,
    serializeDate(b.setup_date), serializeDate(b.teardown_date),
    serializeDate(b.rehearsal_date), serializeDate(b.filming_date),
  ];
  for (const p of PHASES) {
    cols.push(`${p}_leads`, `${p}_km_staff`, `${p}_freelancers`, `${p}_notes`, `${p}_start_times`, `${p}_km_support`);
    vals.push(JSON.stringify(b[`${p}_leads`] || {}), JSON.stringify(b[`${p}_km_staff`] || {}), serializeFieldValue(b[`${p}_freelancers`]) || '', JSON.stringify(b[`${p}_notes`] || {}), JSON.stringify(b[`${p}_start_times`] || {}), JSON.stringify(b[`${p}_km_support`] || {}));
  }
  const setSql = cols.map(c => `${c} = ?`).join(', ');
  db.prepare(`UPDATE work_schedules SET ${setSql} WHERE id = ?`).run(...vals, req.params.id);
  db.prepare(`INSERT INTO work_schedule_edits (schedule_id, edited_by_id, edited_by_name, action) VALUES (?, ?, ?, 'edit')`)
    .run(req.params.id, req.user.id, req.user.full_name);
  try { syncObligations(req.params.id); } catch (e) { console.error('[obligations] sync error:', e.message); }
  const name = b.event_name?.trim() || sched.event_name;
  console.log('[push] workSchedule update, name=', name);
  pushByRoles(`✏️ Lịch làm việc cập nhật`, `${name}${b.location ? ' · ' + b.location : ''}`, '/work-schedules', ALL_ROLES).catch(e => console.error('[push] workSchedule update error:', e.message));
  res.json({ ok: true });
});

router.post('/:id/confirm', canPhanLich, (req, res) => {
  const sched = db.prepare('SELECT * FROM work_schedules WHERE id = ?').get(req.params.id);
  if (!sched) return res.status(404).json({ error: 'Không tìm thấy lịch làm việc' });
  if (sched.status === 'confirmed') return res.status(400).json({ error: 'Lịch đã được xác nhận' });
  db.prepare(`UPDATE work_schedules SET status = 'confirmed', confirmed_at = datetime('now','localtime'), confirmed_by_id = ? WHERE id = ?`)
    .run(req.user.id, req.params.id);
  db.prepare(`INSERT INTO work_schedule_edits (schedule_id, edited_by_id, edited_by_name, action) VALUES (?, ?, ?, 'confirm')`)
    .run(req.params.id, req.user.id, req.user.full_name);
  try { syncObligations(req.params.id); } catch (e) { console.error('[obligations] sync error:', e.message); }
  pushByRoles(`✅ Lịch làm việc xác nhận`, `${sched.event_name}${sched.location ? ' · ' + sched.location : ''}`, '/work-schedules', ALL_ROLES).catch(() => {});
  res.json({ ok: true });
});

router.get('/:id/history', (req, res) => {
  const rows = db.prepare(
    `SELECT edited_by_name, action, edited_at FROM work_schedule_edits WHERE schedule_id = ? ORDER BY edited_at DESC LIMIT 50`
  ).all(req.params.id);
  res.json(rows);
});

router.delete('/:id', (req, res) => {
  const sched = db.prepare('SELECT * FROM work_schedules WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!sched) return res.status(404).json({ error: 'Không tìm thấy lịch làm việc' });
  if (!canDeleteSchedule(sched, req.user)) return res.status(403).json({ error: 'Không có quyền xóa lịch đã xác nhận' });
  db.prepare("UPDATE work_schedules SET deleted_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/restore', (req, res) => {
  const { role } = req.user;
  if (!['SUPER_ADMIN', 'DIRECTOR'].includes(role))
    return res.status(403).json({ error: 'Không có quyền' });
  const sched = db.prepare('SELECT id FROM work_schedules WHERE id = ? AND deleted_at IS NOT NULL').get(req.params.id);
  if (!sched) return res.status(404).json({ error: 'Không tìm thấy trong thùng rác' });
  db.prepare('UPDATE work_schedules SET deleted_at = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.delete('/:id/permanent', (req, res) => {
  const { role } = req.user;
  if (!['SUPER_ADMIN', 'DIRECTOR'].includes(role))
    return res.status(403).json({ error: 'Không có quyền' });
  const sched = db.prepare('SELECT id FROM work_schedules WHERE id = ? AND deleted_at IS NOT NULL').get(req.params.id);
  if (!sched) return res.status(404).json({ error: 'Không có trong thùng rác' });
  db.prepare('DELETE FROM work_schedule_edits WHERE schedule_id = ?').run(req.params.id);
  db.prepare('DELETE FROM work_schedules WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
