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

async function pushAll(title, body, url = '/') {
  if (!webpush || !process.env.VAPID_PUBLIC_KEY) return;
  const subs = db.prepare('SELECT * FROM push_subscriptions').all();
  if (!subs.length) return;
  await Promise.allSettled(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url })
      );
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
      }
    }
  }));
}

module.exports = { pushAll };
