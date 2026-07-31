const router = require('express').Router();
const db = require('../database');

const ROLE_TO_DEPT = {
  ATAS: 'ATAS-LED', STAGE: 'Sân Khấu', TECHNICAL: 'Kỹ Thuật',
  CSVC: 'Cơ Sở Vật Chất', ACCOUNTING: 'Kế Toán', PRODUCTION: 'Kinh Doanh',
  DIRECTOR: 'Ban Giám Đốc', SUPER_ADMIN: 'Admin',
};

function getNameToDept() {
  const map = {};
  try {
    for (const g of db.prepare("SELECT dept, members FROM staff_groups WHERE type='km'").all()) {
      for (const name of JSON.parse(g.members || '[]')) {
        if (typeof name === 'string' && name) map[name] = g.dept;
      }
    }
  } catch {}
  return map;
}

// GET /api/ngay-phep?year=2026&month=2026-07
router.get('/', (req, res) => {
  const year  = req.query.year  || String(new Date().getFullYear());
  const month = req.query.month || null;

  const users = db.prepare(`
    SELECT id, full_name, role, phep_nam FROM users
    WHERE is_active = 1 ORDER BY role, full_name
  `).all();

  const nameToDept = getNameToDept();

  const records = db.prepare(`
    SELECT user_id, ngay, so_ngay FROM ngay_phep
    WHERE strftime('%Y', ngay) = ?
  `).all(String(year));

  const byUser = {};
  for (const r of records) {
    if (!byUser[r.user_id]) byUser[r.user_id] = [];
    byUser[r.user_id].push(r);
  }

  // Load overrides for this year
  const overrideRows = db.prepare(`
    SELECT user_id, month, value FROM ngay_phep_override WHERE year = ?
  `).all(String(year));

  const ovByUser = {};
  for (const ov of overrideRows) {
    if (!ovByUser[ov.user_id]) ovByUser[ov.user_id] = {};
    ovByUser[ov.user_id][ov.month] = ov.value;
  }

  // monthStart: ngày đầu tháng đang xem, dùng để lọc "đã nghỉ trước tháng"
  const monthStart = month ? `${month}-01` : null;

  const result = users.map((u, idx) => {
    const recs = byUser[u.id] || [];
    const calc_da_nghi = recs.reduce((s, r) => s + r.so_ngay, 0);
    // "Đã Nghỉ" = chỉ các tháng TRƯỚC tháng đang xem (không tính tháng hiện tại)
    const calc_da_nghi_before = monthStart
      ? recs.filter(r => r.ngay < monthStart).reduce((s, r) => s + r.so_ngay, 0)
      : calc_da_nghi;
    const thang_recs = month ? recs.filter(r => r.ngay.startsWith(month)) : [];
    const calc_nghi_thang = thang_recs.reduce((s, r) => s + r.so_ngay, 0);
    const nghi_thang_dates = thang_recs
      .sort((a, b) => a.ngay.localeCompare(b.ngay))
      .map(r => ({ ngay: r.ngay, so_ngay: r.so_ngay, ghi_chu: r.ghi_chu }));

    const phep_nam = u.phep_nam ?? 12;

    const uov = ovByUser[u.id] || {};
    const yearOvVal  = uov[''];
    const monthOvKey = month || '';
    const monthOvVal = monthOvKey ? uov[monthOvKey] : undefined;
    const pnOvKey    = month ? `pn_${month}` : null;
    const pnOvVal    = pnOvKey ? uov[pnOvKey] : undefined;

    const da_nghi_before = yearOvVal !== undefined ? yearOvVal : calc_da_nghi_before;
    const nghi_thang     = monthOvVal !== undefined ? monthOvVal : calc_nghi_thang;

    return {
      stt: idx + 1, id: u.id, full_name: u.full_name, role: u.role,
      dept: nameToDept[u.full_name] || ROLE_TO_DEPT[u.role] || u.role,
      phep_nam,
      phep_nam_is_override: pnOvVal !== undefined,
      phep_nam_override: pnOvVal ?? null,
      da_nghi: calc_da_nghi,
      da_nghi_before,
      da_nghi_is_override: yearOvVal !== undefined,
      da_nghi_override_val: yearOvVal ?? null,
      nghi_thang,
      nghi_thang_is_override: monthOvVal !== undefined,
      nghi_thang_override_val: monthOvVal ?? null,
      nghi_thang_dates,
      con_lai: phep_nam - da_nghi_before - nghi_thang,
    };
  });

  res.json(result);
});

// GET /api/ngay-phep/records/:userId
router.get('/records/:userId', (req, res) => {
  const rows = db.prepare(`
    SELECT id, ngay, so_ngay, ghi_chu FROM ngay_phep
    WHERE user_id = ? ORDER BY ngay DESC
  `).all(req.params.userId);
  res.json(rows);
});

// PUT /api/ngay-phep/user/:userId
router.put('/user/:userId', (req, res) => {
  const pn = Number(req.body.phep_nam);
  if (isNaN(pn) || pn < 0) return res.status(400).json({ error: 'phep_nam không hợp lệ' });
  db.prepare('UPDATE users SET phep_nam = ? WHERE id = ?').run(pn, req.params.userId);
  res.json({ ok: true });
});

// POST /api/ngay-phep/record
router.post('/record', (req, res) => {
  const { user_id, ngay, so_ngay = 1, ghi_chu = '' } = req.body;
  if (!user_id || !ngay) return res.status(400).json({ error: 'Thiếu thông tin' });
  const r = db.prepare(
    'INSERT INTO ngay_phep (user_id, ngay, so_ngay, ghi_chu) VALUES (?, ?, ?, ?)'
  ).run(user_id, ngay, Number(so_ngay), ghi_chu);
  res.json({ id: r.lastInsertRowid });
});

// DELETE /api/ngay-phep/record/:id
router.delete('/record/:id', (req, res) => {
  db.prepare('DELETE FROM ngay_phep WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// PUT /api/ngay-phep/override  — set/update a manual override
// body: { user_id, year, month ('YYYY-MM' for month-level, '' for year-level), value }
router.put('/override', (req, res) => {
  const { user_id, year, month = '', value } = req.body;
  if (!user_id || !year || value === undefined || value === null || value === '') {
    return res.status(400).json({ error: 'Thiếu thông tin' });
  }
  const v = Number(value);
  if (isNaN(v) || v < 0) return res.status(400).json({ error: 'Giá trị không hợp lệ' });
  db.prepare(`
    INSERT INTO ngay_phep_override (user_id, year, month, value)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, year, month) DO UPDATE SET value = excluded.value
  `).run(user_id, String(year), String(month), v);
  res.json({ ok: true });
});

// DELETE /api/ngay-phep/override  — clear a manual override
// body: { user_id, year, month }
router.delete('/override', (req, res) => {
  const { user_id, year, month = '' } = req.body;
  db.prepare('DELETE FROM ngay_phep_override WHERE user_id = ? AND year = ? AND month = ?')
    .run(user_id, String(year), String(month));
  res.json({ ok: true });
});

module.exports = router;
