const db = require('../database');

let webpush;
try { webpush = require('web-push'); } catch (_) {}

if (webpush && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:theson119@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function sendToSubs(subs, payload) {
  await Promise.allSettled(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
      }
    }
  }));
}

async function pushAll(title, body, url = '/') {
  if (!webpush || !process.env.VAPID_PUBLIC_KEY) return;
  const subs = db.prepare('SELECT * FROM push_subscriptions').all();
  if (!subs.length) return;
  await sendToSubs(subs, { title, body, url });
}

// roles: mảng role string, vd ['SUPER_ADMIN','DIRECTOR','PRODUCTION']
async function pushByRoles(title, body, url = '/', roles = []) {
  if (!webpush || !process.env.VAPID_PUBLIC_KEY) {
    console.warn('[push] skipped — webpush or VAPID key missing');
    return;
  }
  if (!roles.length) return pushAll(title, body, url);
  const placeholders = roles.map(() => '?').join(',');
  const subs = db.prepare(`
    SELECT ps.* FROM push_subscriptions ps
    LEFT JOIN users u ON u.id = ps.user_id
    WHERE u.role IN (${placeholders}) OR ps.user_id IS NULL
  `).all(...roles);
  console.log(`[push] "${title}" → ${subs.length} subscriber(s)`);
  if (!subs.length) return;
  await sendToSubs(subs, { title, body, url });
}

module.exports = { pushAll, pushByRoles };
