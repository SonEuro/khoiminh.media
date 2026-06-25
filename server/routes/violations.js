const express = require('express');
const router  = express.Router();
const db      = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /api/violations
router.get('/', requireAuth, (req, res) => {
  const isSuperAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(req.user.role);
  const rows = db.prepare(`
    SELECT v.*, e.name AS event_name
    FROM violations v
    LEFT JOIN events e ON e.id = v.event_id
    ORDER BY v.created_at DESC
  `).all();

  res.json(rows.map(r => ({
    ...r,
    reporter_name: isSuperAdmin ? r.reporter_name : null,
    images: JSON.parse(r.images || '[]'),
  })));
});

// POST /api/violations
router.post('/', requireAuth, (req, res) => {
  const { event_id, event_label, violator, violation_type, description, images } = req.body;
  if (!violator?.trim())        return res.status(400).json({ error: 'Thiếu người vi phạm' });
  if (!violation_type?.trim())  return res.status(400).json({ error: 'Thiếu nội dung vi phạm' });

  const result = db.prepare(`
    INSERT INTO violations (event_id, event_label, reporter_name, violator, violation_type, description, images)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    event_id || null,
    event_label || 'Nội bộ',
    req.user.full_name,
    violator.trim(),
    violation_type.trim(),
    description || '',
    JSON.stringify(images || [])
  );

  res.json({ id: result.lastInsertRowid });
});

// DELETE /api/violations/:id  (SUPER_ADMIN, DIRECTOR)
router.delete('/:id', requireAuth, requireRole('SUPER_ADMIN', 'DIRECTOR'), (req, res) => {
  db.prepare('DELETE FROM violations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
