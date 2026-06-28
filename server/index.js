process.env.TZ = 'Asia/Ho_Chi_Minh'; // Bắt buộc đặt trước mọi require

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');

require('./seed');
try { require('./import-equipment').runOnce(); } catch (e) { console.error('[Import] Lỗi khi import thiết bị:', e.message); }

const { requireAuth, requireRole } = require('./middleware/auth');
const db = require('./database');
const { uploadBackupToDrive, scheduleAutoBackup, restoreFromDriveIfNeeded } = require('./utils/gdriveBackup');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/categories',   requireAuth, require('./routes/categories'));
app.use('/api/equipment',    requireAuth, require('./routes/equipment'));
app.use('/api/events',       requireAuth, require('./routes/events'));
app.use('/api/transactions', requireAuth, require('./routes/transactions'));
app.use('/api/reports',      requireAuth, require('./routes/reports'));
app.use('/api/violations',     requireAuth, require('./routes/violations'));
app.use('/api/event-reports', requireAuth, require('./routes/eventReports'));
app.use('/api/admin',        requireAuth, require('./routes/admin'));
app.use('/api/dashboard',    requireAuth, require('./routes/dashboard'));

app.get('/api/health', (req, res) => {
  let userCount = 0, eventCount = 0;
  try { userCount  = db.prepare('SELECT COUNT(*) as c FROM users').get().c; } catch(_) {}
  try { eventCount = db.prepare('SELECT COUNT(*) as c FROM events').get().c; } catch(_) {}
  res.json({ ok: true, time: new Date().toISOString(), users: userCount, events: eventCount });
});

// Backup to Google Drive — SUPER_ADMIN only
app.post('/api/backup/gdrive', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const result = await uploadBackupToDrive(db);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download backup locally — SUPER_ADMIN only
app.get('/api/backup', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const tmpFile = path.join(os.tmpdir(), `kho-backup-${date}.db`);
  try {
    await db.backup(tmpFile);
    const filename = `kho-khoiminh-backup-${date}.db`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    const stream = fs.createReadStream(tmpFile);
    stream.pipe(res);
    stream.on('end', () => { try { fs.unlinkSync(tmpFile); } catch (_) {} });
    stream.on('error', () => { try { fs.unlinkSync(tmpFile); } catch (_) {} });
  } catch (err) {
    res.status(500).json({ error: 'Backup thất bại: ' + err.message });
  }
});

// Serve React frontend (production)
const publicDir = path.join(__dirname, 'public');

// sw.js: luôn serve inline để tránh loop — xóa cache cũ + unregister, không làm gì thêm
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.type('application/javascript');
  res.send(`self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.map(c=>caches.delete(c)))).then(()=>self.registration.unregister()));});`);
});
app.use(express.static(publicDir, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
}));

// Trang xóa cache SW — truy cập /clear để reset
app.get('/clear', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Đang xóa cache...</title></head><body>
<p style="font-family:sans-serif;padding:20px">Đang xóa cache, vui lòng chờ...</p>
<script>
(async () => {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  }
  if (window.caches) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  window.location.replace('/');
})();
</script></body></html>`);
});

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(publicDir, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Restore từ Drive trước (nếu DB rỗng), sau đó mới bắt đầu auto-backup
  // để tránh auto-backup ghi đè Drive bằng DB rỗng
  try {
    await restoreFromDriveIfNeeded(db);
  } catch (e) {
    console.error('[Restore] Lỗi khi restore từ Drive:', e.message);
  }
  scheduleAutoBackup(db);
});

// Backup lên Google Drive trước khi Render tắt server (SIGTERM)
process.on('SIGTERM', async () => {
  console.log('[Shutdown] Nhận SIGTERM — đang backup lên Google Drive...');
  try {
    const result = await uploadBackupToDrive(db);
    console.log(`[Shutdown] ✅ Backup xong: ${result.name}`);
  } catch (err) {
    console.error('[Shutdown] ❌ Backup thất bại:', err.message);
  }
  process.exit(0);
});
