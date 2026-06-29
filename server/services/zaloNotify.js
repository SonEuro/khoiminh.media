const db = require('../database');

const ZALO_API = 'https://openapi.zalo.me/v3.0/oa';

// Tự gia hạn Access Token khi hết hạn
async function refreshAccessToken() {
  const refreshToken = process.env.ZALO_OA_REFRESH_TOKEN;
  const appId = process.env.ZALO_APP_ID;
  const appSecret = process.env.ZALO_APP_SECRET;
  if (!refreshToken || !appId || !appSecret) return null;
  try {
    const res = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'secret_key': appSecret },
      body: new URLSearchParams({ refresh_token: refreshToken, app_id: appId, grant_type: 'refresh_token' }),
    });
    const data = await res.json();
    if (data.access_token) {
      process.env.ZALO_OA_TOKEN = data.access_token;
      if (data.refresh_token) process.env.ZALO_OA_REFRESH_TOKEN = data.refresh_token;
      console.log('[Zalo] Access token đã được gia hạn');
      return data.access_token;
    }
    console.warn('[Zalo] Không thể gia hạn token:', data);
    return null;
  } catch (e) {
    console.warn('[Zalo] Lỗi gia hạn token:', e.message);
    return null;
  }
}

async function sendToUser(zaloUid, text) {
  let token = process.env.ZALO_OA_TOKEN;
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
    // -216 = token hết hạn → tự gia hạn và thử lại
    if (data.error === -216) {
      token = await refreshAccessToken();
      if (!token) return;
      const retry = await fetch(`${ZALO_API}/message/cs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': token },
        body: JSON.stringify({
          recipient: { user_id: String(zaloUid) },
          message: { text },
        }),
      });
      const retryData = await retry.json();
      if (retryData.error !== 0) console.warn('[Zalo] Retry thất bại uid=%s error=%s', zaloUid, retryData.error);
    } else if (data.error !== 0) {
      console.warn('[Zalo] Gửi thất bại uid=%s error=%s msg=%s', zaloUid, data.error, data.message);
    }
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
