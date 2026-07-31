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
    SELECT id, full_name, role, position, phep_nam, luong_co_ban, phu_cap FROM users
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

  const [targetYyyy, targetMm] = month ? month.split('-') : [year, null];
  const targetMonthNum = targetMm ? parseInt(targetMm, 10) : null;

  const result = users.map((u, idx) => {
    const recs = byUser[u.id] || [];
    const calc_da_nghi = recs.reduce((s, r) => s + r.so_ngay, 0);
    const thang_recs = month ? recs.filter(r => r.ngay.startsWith(month)) : [];
    const nghi_thang_dates = thang_recs
      .sort((a, b) => a.ngay.localeCompare(b.ngay))
      .map(r => ({ ngay: r.ngay, so_ngay: r.so_ngay, ghi_chu: r.ghi_chu }));

    const phep_nam = u.phep_nam ?? 12;
    const uov = ovByUser[u.id] || {};
    const monthOvKey = month || '';
    const monthOvVal = monthOvKey ? uov[monthOvKey] : undefined;
    const pnOvKey    = month ? `pn_${month}` : null;
    const pnOvVal    = pnOvKey ? uov[pnOvKey] : undefined;

    let tich_luy, da_nghi_before, nghi_thang, con_lai;
    let resetMonth = 0;

    if (targetMonthNum) {
      // Chạy chuỗi tháng 1→target: nếu tháng M có CL<0, tháng M+1 reset ĐN về 0
      for (let m = 1; m <= targetMonthNum; m++) {
        const mm_s = String(m).padStart(2, '0');
        const mKey = `${targetYyyy}-${mm_s}`;
        const mStart = `${targetYyyy}-${mm_s}-01`;
        const pnOv = uov[`pn_${mKey}`];
        let tl, dn;
        if (resetMonth > 0) {
          tl = pnOv !== undefined ? pnOv : Math.min(phep_nam, m - resetMonth + 1);
          const resetDate = `${targetYyyy}-${String(resetMonth).padStart(2, '0')}-01`;
          dn = recs.filter(r => r.ngay >= resetDate && r.ngay < mStart).reduce((s, r) => s + r.so_ngay, 0);
        } else {
          tl = pnOv !== undefined ? pnOv : Math.min(phep_nam, m - 1);
          dn = (uov[''] !== undefined) ? uov[''] : recs.filter(r => r.ngay < mStart).reduce((s, r) => s + r.so_ngay, 0);
        }
        const nt = (uov[mKey] !== undefined) ? uov[mKey] : recs.filter(r => r.ngay.startsWith(mKey)).reduce((s, r) => s + r.so_ngay, 0);
        const cl = tl - dn - nt;
        if (m === targetMonthNum) { tich_luy = tl; da_nghi_before = dn; nghi_thang = nt; con_lai = cl; }
        if (cl < 0 && m < targetMonthNum) resetMonth = m + 1;
      }
    } else {
      // Không có tháng cụ thể: dùng logic cũ
      tich_luy = phep_nam;
      da_nghi_before = (uov[''] !== undefined) ? uov[''] : calc_da_nghi;
      nghi_thang = 0;
      con_lai = phep_nam - da_nghi_before;
    }

    return {
      stt: idx + 1, id: u.id, full_name: u.full_name, role: u.role,
      truong_phong: u.position === 'Trưởng phòng' ? 1 : 0,
      dept: nameToDept[u.full_name] || ROLE_TO_DEPT[u.role] || u.role,
      phep_nam,
      tich_luy,
      luong_co_ban: u.luong_co_ban || 0,
      phu_cap: u.phu_cap || 0,
      phep_nam_is_override: pnOvVal !== undefined,
      phep_nam_override: pnOvVal ?? null,
      da_nghi: calc_da_nghi,
      da_nghi_before,
      da_nghi_is_override: resetMonth === 0 && uov[''] !== undefined,
      da_nghi_override_val: resetMonth === 0 ? (uov[''] ?? null) : null,
      nghi_thang,
      nghi_thang_is_override: monthOvVal !== undefined,
      nghi_thang_override_val: monthOvVal ?? null,
      nghi_thang_dates,
      con_lai,
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
