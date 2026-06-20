const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'khoiminh-dev-secret-2025';

// Categories each role can transact (null = all)
const DEPT_CATS = {
  SUPER_ADMIN: null,
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
