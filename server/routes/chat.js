const express        = require('express');
const router         = express.Router();
const db             = require('../database');
const { pushByUserIds } = require('../services/pushNotify');

function getChatUserIds(excludeId) {
  return db.prepare(`
    SELECT id FROM users WHERE is_active = 1 AND id != ?
      AND (is_phan_lich_all = 1 OR role = 'SUPER_ADMIN')
  `).all(excludeId).map(u => u.id);
}

router.get('/', (req, res) => {
  const { since } = req.query;
  const rows = since
    ? db.prepare("SELECT * FROM messages WHERE created_at > ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 100").all(since)
    : db.prepare("SELECT * FROM messages WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 60").all().reverse();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Nội dung không được trống' });
  const result = db.prepare(
    'INSERT INTO messages (user_id, user_name, content) VALUES (?, ?, ?)'
  ).run(req.user.id, req.user.full_name || req.user.username, content.trim());
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
  res.json(msg);

  // Push (fire-and-forget)
  (() => {
    try {
      const ids = getChatUserIds(req.user.id);
      if (!ids.length) return;
      pushByUserIds(
        `💬 ${req.user.full_name || req.user.username}`,
        content.trim().slice(0, 100),
        '/chat',
        ids
      ).catch(() => {});
    } catch (_) {}
  })();
});

router.patch('/:id', (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Nội dung không được trống' });
  const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Không tìm thấy' });
  if (msg.user_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền' });
  db.prepare("UPDATE messages SET content = ?, edited_at = datetime('now','localtime') WHERE id = ?")
    .run(content.trim(), msg.id);
  res.json(db.prepare('SELECT * FROM messages WHERE id = ?').get(msg.id));
});

router.delete('/:id', (req, res) => {
  const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Không tìm thấy' });
  const isAdmin = req.user.role === 'SUPER_ADMIN';
  if (msg.user_id !== req.user.id && !isAdmin) return res.status(403).json({ error: 'Không có quyền' });
  db.prepare("UPDATE messages SET deleted_at = datetime('now','localtime') WHERE id = ?").run(msg.id);
  res.json({ ok: true });
});

module.exports = router;
