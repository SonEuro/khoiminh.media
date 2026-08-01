const express = require('express');
const router  = express.Router();
const db      = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { checkAndCreateViolations } = require('../services/obligations');

// GET /api/violations
router.get('/', requireAuth, (req, res) => {
  try { checkAndCreateViolations(); } catch (e) { console.error('[obligations]', e.message); }
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
  const { id: userId, full_name } = req.user;
  const viol = db.prepare('SELECT * FROM violations WHERE id = ?').get(req.params.id);
  if (!viol) return res.status(404).json({ error: 'Không tìm thấy vi phạm' });

  if (viol.reporter_name === 'Hệ thống'
      && ['Không nộp báo cáo', 'Nộp báo cáo trễ'].includes(viol.violation_type)) {
    const dateMatch = viol.description?.match(/ngày (\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      db.prepare(`
        UPDATE lead_report_obligations SET dismissed = 1
        WHERE lead_name = ? AND assigned_date = ?
      `).run(viol.violator, dateMatch[1]);
    }
  }

  db.prepare(`
    INSERT INTO violation_delete_log (violation_id, violator, violation_type, description, deleted_by_id, deleted_by_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(viol.id, viol.violator, viol.violation_type, viol.description, userId, full_name);

  db.prepare('DELETE FROM violations WHERE id = ?').run(viol.id);
  res.json({ ok: true });
});

// POST /api/violations/:id/forgive — tha vi phạm sau khi nộp BC bổ sung (không log audit)
router.post('/:id/forgive', requireAuth, (req, res) => {
  const viol = db.prepare('SELECT * FROM violations WHERE id = ?').get(req.params.id);
  if (!viol) return res.status(404).json({ error: 'Không tìm thấy vi phạm' });
  if (viol.violation_type !== 'Không nộp báo cáo') {
    return res.status(400).json({ error: 'Chỉ có thể tha vi phạm "Không nộp báo cáo"' });
  }

  if (viol.reporter_name === 'Hệ thống') {
    const dateMatch = viol.description?.match(/ngày (\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      db.prepare(`
        UPDATE lead_report_obligations SET dismissed = 1
        WHERE lead_name = ? AND assigned_date = ?
      `).run(viol.violator, dateMatch[1]);
    }
  }
  db.prepare('DELETE FROM violations WHERE id = ?').run(viol.id);
  res.json({ ok: true });
});

// PATCH /api/violations/:id/penalty — nhập số tiền phạt (SUPER_ADMIN, DIRECTOR)
router.patch('/:id/penalty', requireAuth, requireRole('SUPER_ADMIN', 'DIRECTOR'), (req, res) => {
  const viol = db.prepare('SELECT id FROM violations WHERE id = ?').get(req.params.id);
  if (!viol) return res.status(404).json({ error: 'Không tìm thấy vi phạm' });
  const amt = parseInt(req.body.penalty_amount || 0, 10) || 0;
  db.prepare('UPDATE violations SET penalty_amount = ? WHERE id = ?').run(amt, viol.id);
  res.json({ ok: true, penalty_amount: amt });
});

// GET /api/violations/delete-log  (SUPER_ADMIN, DIRECTOR)
router.get('/delete-log', requireAuth, requireRole('SUPER_ADMIN', 'DIRECTOR'), (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM violation_delete_log ORDER BY deleted_at DESC LIMIT 200
  `).all();
  res.json(rows);
});

module.exports = router;
