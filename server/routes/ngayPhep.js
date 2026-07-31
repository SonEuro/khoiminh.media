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

  const result = users.map((u, idx) => {
    const recs    = byUser[u.id] || [];
    const da_nghi  = recs.reduce((s, r) => s + r.so_ngay, 0);
    const nghi_thang = month
      ? recs.filter(r => r.ngay.startsWith(month)).reduce((s, r) => s + r.so_ngay, 0)
      : 0;
    const phep_nam = u.phep_nam ?? 12;
    return {
      stt: idx + 1, id: u.id, full_name: u.full_name, role: u.role,
      dept: nameToDept[u.full_name] || ROLE_TO_DEPT[u.role] || u.role,
      phep_nam, da_nghi, nghi_thang, con_lai: phep_nam - da_nghi,
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

module.exports = router;
