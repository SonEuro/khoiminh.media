const { google } = require('googleapis');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

function getAuth() {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken)
    throw new Error('Chưa cấu hình OAuth Google Drive');
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost');
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

function getFolderId() {
  const rawId = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  if (!rawId) throw new Error('Chưa cấu hình GOOGLE_DRIVE_FOLDER_ID');
  return rawId.includes('drive.google.com')
    ? rawId.split('/folders/')[1]?.split(/[?&]/)[0]?.trim()
    : rawId;
}

function isReady() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
            process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_DRIVE_FOLDER_ID);
}

async function uploadBackupToDrive(db) {
  const auth     = getAuth();
  const drive    = google.drive({ version: 'v3', auth });
  const folderId = getFolderId();

  const date    = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const tmpFile = path.join(os.tmpdir(), `kho-backup-${Date.now()}.db`);
  await db.backup(tmpFile);

  const filename = `km-media-backup-${date}.db`;
  const uploaded = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: 'application/octet-stream', body: fs.createReadStream(tmpFile) },
    fields: 'id,name,webViewLink',
  });

  try { fs.unlinkSync(tmpFile); } catch (_) {}

  // Giữ 50 bản gần nhất (tăng từ 10 lên 50)
  const list = await drive.files.list({
    q: `'${folderId}' in parents and name contains 'km-media-backup' and trashed=false`,
    fields: 'files(id,name,createdTime)',
    orderBy: 'createdTime desc',
  });
  for (const f of (list.data.files || []).slice(50)) {
    await drive.files.delete({ fileId: f.id }).catch(() => {});
  }

  return { name: uploaded.data.name, link: uploaded.data.webViewLink };
}

async function uploadDailyBackupToDrive(db) {
  const auth     = getAuth();
  const drive    = google.drive({ version: 'v3', auth });
  const folderId = getFolderId();

  const now  = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
  const time = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now).replace(':', '');

  const tmpFile = path.join(os.tmpdir(), `kho-daily-${Date.now()}.db`);
  await db.backup(tmpFile);

  const filename = `km-media-daily-${date}_${time}.db`;
  await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: 'application/octet-stream', body: fs.createReadStream(tmpFile) },
    fields: 'id',
  });

  try { fs.unlinkSync(tmpFile); } catch (_) {}

  // Giữ 60 bản (12h/lần × 30 ngày)
  const list = await drive.files.list({
    q: `'${folderId}' in parents and name contains 'km-media-daily' and trashed=false`,
    fields: 'files(id,name,createdTime)',
    orderBy: 'createdTime desc',
  });
  for (const f of (list.data.files || []).slice(60)) {
    await drive.files.delete({ fileId: f.id }).catch(() => {});
  }

  return filename;
}

function scheduleAutoBackup(db) {
  if (!isReady()) return;

  const runShort = () => {
    let eventCount = 0;
    try { eventCount = db.prepare('SELECT COUNT(*) as c FROM events').get().c; } catch(_) {}
    if (eventCount === 0) {
      console.log('[AutoBackup] Bỏ qua — DB chưa có events, tránh ghi đè Drive.');
      return;
    }
    uploadBackupToDrive(db)
      .then(r => console.log(`[AutoBackup] ✅ ${r.name}`))
      .catch(e => console.error('[AutoBackup] ❌', e.message));
  };

  const runDaily = () => {
    let eventCount = 0;
    try { eventCount = db.prepare('SELECT COUNT(*) as c FROM events').get().c; } catch(_) {}
    if (eventCount === 0) return;
    uploadDailyBackupToDrive(db)
      .then(name => console.log(`[DailyBackup] ✅ ${name}`))
      .catch(e => console.error('[DailyBackup] ❌', e.message));
  };

  // Dọn file kho_* cũ trên Drive (1 lần khi khởi động)
  setTimeout(async () => {
    try {
      const auth = getAuth(), drive = google.drive({ version: 'v3', auth }), folderId = getFolderId();
      const list = await drive.files.list({
        q: `'${folderId}' in parents and name contains 'kho_' and trashed=false`,
        fields: 'files(id,name)', pageSize: 1000,
      });
      for (const f of list.data.files || []) {
        await drive.files.delete({ fileId: f.id }).catch(() => {});
      }
      if ((list.data.files || []).length > 0)
        console.log(`[AutoBackup] Đã xóa ${list.data.files.length} file kho_* cũ khỏi Drive`);
    } catch(e) { console.error('[AutoBackup] Lỗi dọn file kho_*:', e.message); }
  }, 3 * 60 * 1000);

  // Backup mỗi 5 phút
  setTimeout(() => { runShort(); setInterval(runShort, 5 * 60 * 1000); }, 60 * 1000);
  // Backup mỗi 12h, giữ 60 bản (30 ngày)
  setTimeout(() => { runDaily(); setInterval(runDaily, 12 * 60 * 60 * 1000); }, 2 * 60 * 1000);

  // Local backup mỗi 6 tiếng vào /var/backups/kho-khoiminh/auto/, giữ 30 ngày
  const LOCAL_DIR = '/var/backups/kho-khoiminh/auto';
  const runLocal = () => {
    let eventCount = 0;
    try { eventCount = db.prepare('SELECT COUNT(*) as c FROM events').get().c; } catch(_) {}
    if (eventCount === 0) return;
    try {
      fs.mkdirSync(LOCAL_DIR, { recursive: true });
      const stamp = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Ho_Chi_Minh', year:'numeric', month:'2-digit', day:'2-digit',
        hour:'2-digit', minute:'2-digit', second:'2-digit',
      }).format(new Date()).replace(/[-: ]/g, '').replace('T', '_');
      const dest = path.join(LOCAL_DIR, `db_${stamp}.sqlite`);
      db.backup(dest)
        .then(() => {
          console.log(`[LocalBackup] ✅ ${dest}`);
          // Xóa file cũ hơn 30 ngày
          const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
          for (const f of fs.readdirSync(LOCAL_DIR).filter(n => n.startsWith('db_') && n.endsWith('.sqlite'))) {
            const fp = path.join(LOCAL_DIR, f);
            try { if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp); } catch(_) {}
          }
        })
        .catch(e => console.error('[LocalBackup] ❌', e.message));
    } catch(e) { console.error('[LocalBackup] ❌', e.message); }
  };
  setTimeout(() => { runLocal(); setInterval(runLocal, 6 * 60 * 60 * 1000); }, 5 * 60 * 1000);

  console.log('[AutoBackup] Lên lịch: GDrive 5 phút/lần + daily 12h + local 6 tiếng/lần');
}

async function restoreFromDriveIfNeeded(db) {
  if (!isReady()) return false;

  const eventCount = db.prepare('SELECT COUNT(*) as c FROM events').get().c;
  if (eventCount > 0) {
    console.log(`[Restore] DB đã có ${eventCount} events, bỏ qua restore.`);
    return false;
  }

  const auth     = getAuth();
  const drive    = google.drive({ version: 'v3', auth });
  const folderId = getFolderId();

  const list = await drive.files.list({
    q: `'${folderId}' in parents and name contains 'km-media-backup' and trashed=false`,
    fields: 'files(id,name,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 5,
  });

  const files = list.data.files || [];
  if (files.length === 0) { console.log('[Restore] Không tìm thấy backup trên Drive.'); return false; }

  const Database = require('better-sqlite3');
  for (const file of files) {
    const tmpFile = path.join(os.tmpdir(), `restore-${Date.now()}.db`);
    try {
      const response = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' });
      await new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(tmpFile);
        response.data.pipe(dest);
        dest.on('finish', resolve);
        dest.on('error', reject);
      });

      const backupDb = new Database(tmpFile, { readonly: true });
      let backupEventCount = 0;
      try { backupEventCount = backupDb.prepare('SELECT COUNT(*) as c FROM events').get().c; } catch(_) {}

      if (backupEventCount === 0) {
        backupDb.close(); fs.unlinkSync(tmpFile);
        console.log(`[Restore] ${file.name}: không có events, thử file cũ hơn...`);
        continue;
      }

      db.pragma('foreign_keys = OFF');
      const doRestore = db.transaction(() => {
        let users = [], events = [], txns = [];
        try { users  = backupDb.prepare('SELECT * FROM users').all(); }        catch(_) {}
        try { events = backupDb.prepare('SELECT * FROM events').all(); }       catch(_) {}
        try { txns   = backupDb.prepare('SELECT * FROM transactions').all(); } catch(_) {}

        if (users.length > 0) {
          db.prepare('DELETE FROM users').run();
          for (const u of users) {
            const cols = Object.keys(u).join(','), ph = Object.keys(u).map(() => '?').join(',');
            try { db.prepare(`INSERT OR REPLACE INTO users (${cols}) VALUES (${ph})`).run(Object.values(u)); } catch(_) {}
          }
        }
        db.prepare('DELETE FROM events').run();
        for (const e of events) {
          const cols = Object.keys(e).join(','), ph = Object.keys(e).map(() => '?').join(',');
          try { db.prepare(`INSERT OR REPLACE INTO events (${cols}) VALUES (${ph})`).run(Object.values(e)); } catch(_) {}
        }
        try { db.prepare('DELETE FROM transactions').run(); } catch(_) {}
        for (const t of txns) {
          const cols = Object.keys(t).join(','), ph = Object.keys(t).map(() => '?').join(',');
          try { db.prepare(`INSERT OR REPLACE INTO transactions (${cols}) VALUES (${ph})`).run(Object.values(t)); } catch(_) {}
        }
        return { users: users.length, events: events.length, txns: txns.length };
      });

      const result = doRestore();
      db.pragma('foreign_keys = ON');
      backupDb.close();
      fs.unlinkSync(tmpFile);
      console.log(`[Restore] ✅ Từ ${file.name}: ${result.users} users, ${result.events} events`);
      return true;
    } catch(e) {
      try { fs.unlinkSync(tmpFile); } catch(_) {}
      console.error(`[Restore] Lỗi với ${file.name}:`, e.message);
    }
  }
  return false;
}

module.exports = { uploadBackupToDrive, scheduleAutoBackup, restoreFromDriveIfNeeded };
