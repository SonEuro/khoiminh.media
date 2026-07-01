const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('SUPER_ADMIN'));

router.get('/', (req, res) => {
  const users = db.prepare(
    'SELECT id, username, full_name, position, role, is_active, is_truong_phong, is_phan_lich, is_phan_lich_all, zalo_uid, created_at FROM users ORDER BY created_at DESC'
  ).all();
  res.json(users);
});

router.post('/', (req, res) => {
  const { username, password, full_name, position, role } = req.body;
  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare(
      'INSERT INTO users (username, password_hash, full_name, position, role) VALUES (?, ?, ?, ?, ?)'
    ).run(username, hash, full_name, position || '', role);
    res.json({ id: r.lastInsertRowid });
  } catch {
    res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
  }
});

router.put('/:id', (req, res) => {
  const { username, full_name, position, role, is_active, password, is_truong_phong, is_phan_lich, is_phan_lich_all, zalo_uid } = req.body;
  if (!username?.trim() || !full_name?.trim() || !role)
    return res.status(400).json({ error: 'Tên đăng nhập, họ tên và vai trò là bắt buộc' });
  const id = req.params.id;
  const tp  = is_truong_phong  ? 1 : 0;
  const pl  = is_phan_lich     ? 1 : 0;
  const pla = is_phan_lich_all ? 1 : 0;
  const zalo = zalo_uid?.trim() || null;
  if (password) {
    db.prepare('UPDATE users SET username=?, full_name=?, position=?, role=?, is_active=?, is_truong_phong=?, is_phan_lich=?, is_phan_lich_all=?, zalo_uid=?, password_hash=? WHERE id=?')
      .run(username, full_name, position || '', role, is_active ? 1 : 0, tp, pl, pla, zalo, bcrypt.hashSync(password, 10), id);
  } else {
    db.prepare('UPDATE users SET username=?, full_name=?, position=?, role=?, is_active=?, is_truong_phong=?, is_phan_lich=?, is_phan_lich_all=?, zalo_uid=? WHERE id=?')
      .run(username, full_name, position || '', role, is_active ? 1 : 0, tp, pl, pla, zalo, id);
  }
  res.json({ ok: true });
});

router.post('/:id/reset-password', (req, res) => {
  const DEFAULT_PASSWORD = '123456';
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(DEFAULT_PASSWORD, 10), req.params.id);
  res.json({ ok: true, default_password: DEFAULT_PASSWORD });
});

router.delete('/:id', (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ error: 'Không thể xóa tài khoản đang đăng nhập' });
  }
  try { db.prepare('UPDATE work_schedules SET scheduler_user_id = NULL WHERE scheduler_user_id = ?').run(req.params.id); } catch (_) {}
  try { db.prepare('UPDATE work_schedules SET confirmed_by_id = NULL WHERE confirmed_by_id = ?').run(req.params.id); } catch (_) {}
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
