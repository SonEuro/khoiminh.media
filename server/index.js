const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');

require('./seed');

const { requireAuth, requireRole } = require('./middleware/auth');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/categories',   requireAuth, require('./routes/categories'));
app.use('/api/equipment',    requireAuth, require('./routes/equipment'));
app.use('/api/events',       requireAuth, require('./routes/events'));
app.use('/api/transactions', requireAuth, require('./routes/transactions'));
app.use('/api/reports',      requireAuth, require('./routes/reports'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Backup endpoint — SUPER_ADMIN only
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
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
