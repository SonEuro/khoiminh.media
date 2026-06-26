const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');

require('./seed');

const { requireAuth, requireRole } = require('./middleware/auth');
const db = require('./database');
const { uploadBackupToDrive, scheduleAutoBackup } = require('./utils/gdriveBackup');

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

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

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
  const date = new Date().toISOString().slice(0, 10);
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
app.use(express.static(publicDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
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
