const router = require('express').Router();
const db = require('../database');

function canPhanLich(req, res, next) {
  const { role, is_phan_lich } = req.user || {};
  if (['SUPER_ADMIN', 'DIRECTOR'].includes(role) || is_phan_lich) return next();
  return res.status(403).json({ error: 'Không có quyền phân lịch làm việc' });
}

function canEditSchedule(sched, user) {
  if (['SUPER_ADMIN', 'DIRECTOR'].includes(user.role)) return true;
  if (!!user.is_truong_phong) return true;
  if (sched.status === 'draft') return !!user.is_phan_lich;
  return sched.scheduler_user_id === user.id;
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

function parseRow(row) {
  const out = { ...row };
  for (const p of PHASES) {
    try { out[`${p}_leads`] = JSON.parse(row[`${p}_leads`] || '[]'); } catch { out[`${p}_leads`] = []; }
    try { out[`${p}_km_staff`] = JSON.parse(row[`${p}_km_staff`] || '[]'); } catch { out[`${p}_km_staff`] = []; }
    out[`${p}_dates`] = parseDatesField(row[`${p}_date`]);
    out[`${p}_date`] = out[`${p}_dates`][0] || null; // first date for backward compat
  }
  return out;
}

router.get('/', (req, res) => {
  const { event_id } = req.query;
  let sql = 'SELECT * FROM work_schedules';
  const params = [];
  if (event_id) { sql += ' WHERE event_id = ?'; params.push(event_id); }
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(parseRow));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM work_schedules WHERE id = ?').get(req.params.id);
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
    cols.push(`${p}_leads`, `${p}_km_staff`, `${p}_freelancers`);
    vals.push(JSON.stringify(b[`${p}_leads`] || []), JSON.stringify(b[`${p}_km_staff`] || []), b[`${p}_freelancers`] || '');
  }
  const placeholders = cols.map(() => '?').join(',');
  const r = db.prepare(`INSERT INTO work_schedules (${cols.join(',')}) VALUES (${placeholders})`).run(...vals);
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
    cols.push(`${p}_leads`, `${p}_km_staff`, `${p}_freelancers`);
    vals.push(JSON.stringify(b[`${p}_leads`] || []), JSON.stringify(b[`${p}_km_staff`] || []), b[`${p}_freelancers`] || '');
  }
  const setSql = cols.map(c => `${c} = ?`).join(', ');
  db.prepare(`UPDATE work_schedules SET ${setSql} WHERE id = ?`).run(...vals, req.params.id);
  res.json({ ok: true });
});

router.post('/:id/confirm', canPhanLich, (req, res) => {
  const sched = db.prepare('SELECT * FROM work_schedules WHERE id = ?').get(req.params.id);
  if (!sched) return res.status(404).json({ error: 'Không tìm thấy lịch làm việc' });
  if (sched.status === 'confirmed') return res.status(400).json({ error: 'Lịch đã được xác nhận' });
  db.prepare(`UPDATE work_schedules SET status = 'confirmed', confirmed_at = datetime('now','localtime'), confirmed_by_id = ? WHERE id = ?`)
    .run(req.user.id, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const sched = db.prepare('SELECT * FROM work_schedules WHERE id = ?').get(req.params.id);
  if (!sched) return res.status(404).json({ error: 'Không tìm thấy lịch làm việc' });
  if (!canEditSchedule(sched, req.user)) return res.status(403).json({ error: 'Không có quyền xóa lịch đã xác nhận' });
  db.prepare('DELETE FROM work_schedules WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
