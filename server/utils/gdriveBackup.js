const { google } = require('googleapis');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

function getAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error('Chưa cấu hình GOOGLE_SERVICE_ACCOUNT_KEY');
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(keyJson),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

function getFolderId() {
  const rawId = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  if (!rawId) throw new Error('Chưa cấu hình GOOGLE_DRIVE_FOLDER_ID');
  return rawId.includes('drive.google.com')
    ? rawId.split('/folders/')[1]?.split(/[?&]/)[0]?.trim()
    : rawId;
}

async function uploadBackupToDrive(db) {
  const auth     = getAuth();
  const drive    = google.drive({ version: 'v3', auth });
  const folderId = getFolderId();

  const date    = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const tmpFile = path.join(os.tmpdir(), `kho-backup-${Date.now()}.db`);
  await db.backup(tmpFile);

  const filename = `kho-khoiminh-backup-${date}.db`;
  const uploaded = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: 'application/octet-stream', body: fs.createReadStream(tmpFile) },
    fields: 'id,name,webViewLink',
    supportsAllDrives: true,
  });

  try { fs.unlinkSync(tmpFile); } catch (_) {}

  // Giữ 10 bản gần nhất
  const list = await drive.files.list({
    q: `'${folderId}' in parents and name contains 'kho-khoiminh-backup' and trashed=false`,
    fields: 'files(id,name,createdTime)',
    orderBy: 'createdTime desc',
  });
  for (const f of (list.data.files || []).slice(10)) {
    await drive.files.delete({ fileId: f.id }).catch(() => {});
  }

  return { name: uploaded.data.name, link: uploaded.data.webViewLink };
}

function isReady() {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_DRIVE_FOLDER_ID);
}

function scheduleAutoBackup(db) {
  if (!isReady()) return;

  const run = () => {
    uploadBackupToDrive(db)
      .then(r => console.log(`[AutoBackup] ✅ ${r.name}`))
      .catch(e => console.error('[AutoBackup] ❌', e.message));
  };

  setTimeout(() => { run(); setInterval(run, 2 * 60 * 1000); }, 60 * 1000);
  console.log('[AutoBackup] Lên lịch tự động backup Google Drive mỗi 2 phút');
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
    q: `'${folderId}' in parents and name contains 'kho-khoiminh-backup' and trashed=false`,
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
        backupDb.close();
        fs.unlinkSync(tmpFile);
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
