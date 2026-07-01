const jwt = require('jsonwebtoken');
const db  = require('../database');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('[FATAL] JWT_SECRET chưa được cấu hình trong môi trường!');

// Categories each role can transact (null = all)
const DEPT_CATS = {
  SUPER_ADMIN: null,
  DIRECTOR:    null,
  PRODUCTION:  null,
  ACCOUNTING:  null,
  TECHNICAL:   ['TECH'],
  ATAS:        ['AUDIO', 'LIGHT', 'LED', 'MATRIX'],
  STAGE:       ['STAGE'],
  CSVC:        ['CSVC'],
};

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    const dbUser = db.prepare('SELECT is_active, is_truong_phong, is_phan_lich, is_phan_lich_all FROM users WHERE id = ?').get(req.user.id);
    if (!dbUser || !dbUser.is_active) {
      return res.status(401).json({ error: 'Tài khoản đã bị vô hiệu hóa' });
    }
    req.user.is_truong_phong  = !!dbUser.is_truong_phong;
    req.user.is_phan_lich     = !!dbUser.is_phan_lich;
    req.user.is_phan_lich_all = !!dbUser.is_phan_lich_all;
    req.user.deptCats = DEPT_CATS[req.user.role] ?? null;
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, JWT_SECRET, DEPT_CATS };
