const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
  }

  const payload = { id: user.id, username: user.username, role: user.role, full_name: user.full_name, position: user.position || '', is_truong_phong: !!user.is_truong_phong, is_phan_lich: !!user.is_phan_lich };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: payload });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, full_name, role, position, is_active, is_truong_phong, is_phan_lich FROM users WHERE id = ?').get(req.user.id);
  if (!user || !user.is_active) return res.status(401).json({ error: 'Tài khoản không hợp lệ' });
  res.json(user);
});

router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 6)
    return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!current_password || !bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(new_password, 10), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
