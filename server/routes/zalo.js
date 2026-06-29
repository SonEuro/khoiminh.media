const router = require('express').Router();
const db = require('../database');
const { requireRole } = require('../middleware/auth');
const { sendToUser, notifyAll } = require('../services/zaloNotify');

// Chỉ SUPER_ADMIN được dùng các route này
router.use(requireRole('SUPER_ADMIN'));

// GET /api/zalo/status — kiểm tra cấu hình
router.get('/status', (req, res) => {
  const token = process.env.ZALO_OA_TOKEN;
  const refresh = process.env.ZALO_OA_REFRESH_TOKEN;
  const appId = process.env.ZALO_APP_ID;
  const usersWithUid = db.prepare('SELECT id, full_name, zalo_uid FROM users WHERE zalo_uid IS NOT NULL AND zalo_uid != "" AND is_active = 1').all();
  res.json({
    token_set: !!token,
    token_prefix: token ? token.substring(0, 10) + '...' : null,
    refresh_token_set: !!refresh,
    app_id_set: !!appId,
    users_with_zalo_uid: usersWithUid.length,
    users: usersWithUid.map(u => ({ id: u.id, name: u.full_name, uid: u.zalo_uid })),
  });
});

// POST /api/zalo/test-send — gửi tin test đến 1 uid cụ thể
router.post('/test-send', async (req, res) => {
  const { zalo_uid, message } = req.body;
  if (!zalo_uid) return res.status(400).json({ error: 'Cần truyền zalo_uid' });
  const text = message || '✅ Test thông báo từ hệ thống Kho Khôi Minh';

  const token = process.env.ZALO_OA_TOKEN;
  if (!token) return res.status(400).json({ error: 'Chưa cấu hình ZALO_OA_TOKEN' });

  try {
    const apiRes = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': token },
      body: JSON.stringify({
        recipient: { user_id: String(zalo_uid) },
        message: { text },
      }),
    });
    const data = await apiRes.json();
    res.json({ zalo_response: data, ok: data.error === 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/zalo/test-all — gửi tin test đến tất cả nhân viên có uid
router.post('/test-all', async (req, res) => {
  await notifyAll('✅ Test thông báo từ hệ thống Kho Khôi Minh');
  const count = db.prepare('SELECT COUNT(*) AS c FROM users WHERE zalo_uid IS NOT NULL AND zalo_uid != "" AND is_active = 1').get().c;
  res.json({ ok: true, sent_to: count });
});

module.exports = router;
