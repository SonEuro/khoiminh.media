const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('SUPER_ADMIN'));

router.get('/', (req, res) => {
  const users = db.prepare(
    'SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
  ).all();
  res.json(users);
});

router.post('/', (req, res) => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
    ).run(username, hash, full_name, role);
    res.json({ id: r.lastInsertRowid });
  } catch {
    res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
  }
});

router.put('/:id', (req, res) => {
  const { username, full_name, role, is_active, password } = req.body;
  const id = req.params.id;
  if (password) {
    db.prepare('UPDATE users SET username=?, full_name=?, role=?, is_active=?, password_hash=? WHERE id=?')
      .run(username, full_name, role, is_active ? 1 : 0, bcrypt.hashSync(password, 10), id);
  } else {
    db.prepare('UPDATE users SET username=?, full_name=?, role=?, is_active=? WHERE id=?')
      .run(username, full_name, role, is_active ? 1 : 0, id);
  }
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ error: 'Không thể xóa tài khoản đang đăng nhập' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
