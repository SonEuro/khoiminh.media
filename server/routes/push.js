const router = require('express').Router();
const db = require('../database');

router.get('/vapid-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || '' });
});

router.post('/subscribe', (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return res.status(400).json({ error: 'Invalid subscription' });
  db.prepare(
    'INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)'
  ).run(req.user?.id || null, endpoint, keys.p256dh, keys.auth);
  res.json({ ok: true });
});

router.delete('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  res.json({ ok: true });
});

module.exports = router;
