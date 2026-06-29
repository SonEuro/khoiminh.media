const db = require('../database');

const ZALO_API = 'https://openapi.zalo.me/v3.0/oa';

async function sendToUser(zaloUid, text) {
  const token = process.env.ZALO_OA_TOKEN;
  if (!token || !zaloUid) return;
  try {
    const res = await fetch(`${ZALO_API}/message/cs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': token },
      body: JSON.stringify({
        recipient: { user_id: String(zaloUid) },
        message: { text },
      }),
    });
    const data = await res.json();
    if (data.error !== 0) console.warn('[Zalo] Gửi thất bại uid=%s error=%s msg=%s', zaloUid, data.error, data.message);
  } catch (e) {
    console.warn('[Zalo] Lỗi gửi tin:', e.message);
  }
}

// Gửi đến tất cả nhân viên có zalo_uid
async function notifyAll(text) {
  if (!process.env.ZALO_OA_TOKEN) return;
  const users = db.prepare('SELECT zalo_uid FROM users WHERE zalo_uid IS NOT NULL AND zalo_uid != "" AND is_active = 1').all();
  await Promise.all(users.map(u => sendToUser(u.zalo_uid, text)));
}

// Gửi đến các role cụ thể
async function notifyRoles(roles, text) {
  if (!process.env.ZALO_OA_TOKEN) return;
  const placeholders = roles.map(() => '?').join(',');
  const users = db.prepare(
    `SELECT zalo_uid FROM users WHERE role IN (${placeholders}) AND zalo_uid IS NOT NULL AND zalo_uid != '' AND is_active = 1`
  ).all(...roles);
  await Promise.all(users.map(u => sendToUser(u.zalo_uid, text)));
}

module.exports = { notifyAll, notifyRoles, sendToUser };
