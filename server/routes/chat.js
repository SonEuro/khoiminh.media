const express = require('express');
const router  = express.Router();
const db      = require('../database');

router.get('/', (req, res) => {
  const { since } = req.query;
  const rows = since
    ? db.prepare('SELECT * FROM messages WHERE created_at > ? ORDER BY created_at ASC LIMIT 100').all(since)
    : db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 60').all().reverse();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Nội dung không được trống' });
  const result = db.prepare(
    'INSERT INTO messages (user_id, user_name, content) VALUES (?, ?, ?)'
  ).run(req.user.id, req.user.full_name || req.user.username, content.trim());
  res.json(db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid));
});

module.exports = router;
