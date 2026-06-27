const router = require('express').Router();
const db = require('../database');
const { requireRole } = require('../middleware/auth');

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, COUNT(e.id) as equipment_count
    FROM categories c
    LEFT JOIN equipment e ON e.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `).all();
  res.json(rows);
});

router.post('/', requireRole('SUPER_ADMIN', 'DIRECTOR'), (req, res) => {
  const { name, code, icon } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'name và code là bắt buộc' });
  try {
    const r = db.prepare('INSERT INTO categories (name, code, icon) VALUES (?, ?, ?)').run(name, code.toUpperCase(), icon || '📦');
    res.json({ id: r.lastInsertRowid, name, code, icon });
  } catch (e) {
    res.status(400).json({ error: 'Code đã tồn tại' });
  }
});

module.exports = router;
