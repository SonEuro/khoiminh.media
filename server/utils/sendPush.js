const db = require('../database');

let webpush;
try { webpush = require('web-push'); } catch (_) { webpush = null; }

function initWebPush() {
  if (!webpush) return false;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || 'mailto:admin@khoiminh.com';
  if (!pub || !priv) return false;
  try { webpush.setVapidDetails(email, pub, priv); return true; } catch (_) { return false; }
}

/**
 * Gửi push notification đến danh sách user_ids.
 * Nếu subscription expired (410/404) thì tự xóa.
 */
async function sendPushToUsers(userIds, payload) {
  if (!webpush || !initWebPush()) return;
  if (!userIds?.length) return;

  const placeholders = userIds.map(() => '?').join(',');
  const subs = db.prepare(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id IN (${placeholders})`
  ).all(...userIds);

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24 }
      );
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      }
    }
  }
}

/**
 * Gửi push notification báo cáo mới theo bộ phận.
 * Nhận: tên reporter, event_label, report_date, dept của reporter.
 */
async function notifyNewEventReport({ reporterName, eventLabel, reportDate, dept }) {
  if (!webpush || !initWebPush()) return;

  // Lấy danh sách tên thành viên cùng dept
  const deptMemberNames = (() => {
    if (!dept) return [];
    const row = db.prepare("SELECT members FROM staff_groups WHERE type='km' AND dept=?").get(dept);
    return JSON.parse(row?.members || '[]');
  })();

  // Lấy user_ids: thành viên cùng dept + SUPER_ADMIN + DIRECTOR + is_phan_lich_all
  const targetUsers = db.prepare(`
    SELECT id FROM users
    WHERE is_active = 1 AND (
      full_name IN (${deptMemberNames.length ? deptMemberNames.map(() => '?').join(',') : 'NULL'})
      OR role IN ('SUPER_ADMIN', 'DIRECTOR')
      OR is_phan_lich_all = 1
    )
  `).all(...deptMemberNames);

  const userIds = targetUsers.map(u => u.id);
  if (!userIds.length) return;

  const dateLabel = reportDate ? reportDate.split('-').reverse().join('/') : '';
  await sendPushToUsers(userIds, {
    title: `📋 Báo cáo mới${dept ? ` — ${dept}` : ''}`,
    body: `${reporterName || 'Nhân viên'} đã nộp báo cáo${eventLabel ? ` cho ${eventLabel}` : ''}${dateLabel ? ` ngày ${dateLabel}` : ''}`,
    url: '/event-report',
  });
}

module.exports = { sendPushToUsers, notifyNewEventReport };
