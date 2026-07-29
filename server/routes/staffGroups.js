const express = require('express');
const router  = express.Router();
const db      = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /api/staff-groups?type=km|freelancer
router.get('/', requireAuth, (req, res) => {
  const { type } = req.query;
  const rows = type
    ? db.prepare('SELECT dept, members FROM staff_groups WHERE type = ? ORDER BY id').all(type)
    : db.prepare('SELECT type, dept, members FROM staff_groups ORDER BY type, id').all();
  const byTen = n => (n.trim().split(/\s+/).pop() || n);
  res.json(rows.map(r => ({ ...r, members: JSON.parse(r.members || '[]').sort((a, b) => byTen(a).localeCompare(byTen(b), 'vi')) })));
});

// PUT /api/staff-groups/:type  — thay toàn bộ list theo type (SUPER_ADMIN/DIRECTOR)
router.put('/:type', requireAuth, requireRole('SUPER_ADMIN', 'DIRECTOR'), (req, res) => {
  const { type } = req.params;
  if (!['km', 'freelancer'].includes(type))
    return res.status(400).json({ error: 'type phải là km hoặc freelancer' });

  const groups = req.body; // [{dept, members: []}]
  if (!Array.isArray(groups))
    return res.status(400).json({ error: 'Body phải là array [{dept, members}]' });

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const doUpdate = db.transaction(() => {
    db.prepare('DELETE FROM staff_groups WHERE type = ?').run(type);
    const ins = db.prepare('INSERT INTO staff_groups (type, dept, members, updated_at) VALUES (?, ?, ?, ?)');
    for (const g of groups) {
      if (!g.dept?.trim()) continue;
      const members = Array.isArray(g.members) ? g.members.filter(m => m?.trim()) : [];
      ins.run(type, g.dept.trim(), JSON.stringify(members), now);
    }
  });
  doUpdate();
  res.json({ ok: true });
});

module.exports = router;
