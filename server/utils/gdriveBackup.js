const { google } = require('googleapis');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

function getOAuth2Client() {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Chưa cấu hình GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET hoặc GOOGLE_REFRESH_TOKEN');
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

async function uploadBackupToDrive(db) {
  const rawId = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  if (!rawId) throw new Error('Chưa cấu hình GOOGLE_DRIVE_FOLDER_ID');

  const folderId = rawId.includes('drive.google.com')
    ? rawId.split('/folders/')[1]?.split(/[?&]/)[0]?.trim()
    : rawId;

  const auth  = getOAuth2Client();
  const drive = google.drive({ version: 'v3', auth });

  // Tạo bản sao DB nhất quán
  const date    = new Date().toISOString().slice(0, 10);
  const tmpFile = path.join(os.tmpdir(), `kho-backup-${Date.now()}.db`);
  await db.backup(tmpFile);

  // Upload
  const filename = `kho-khoiminh-backup-${date}.db`;
  const uploaded = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: {
      mimeType: 'application/octet-stream',
      body: fs.createReadStream(tmpFile),
    },
    fields: 'id,name,webViewLink',
  });

  try { fs.unlinkSync(tmpFile); } catch (_) {}

  // Giữ 10 bản gần nhất, xóa cũ hơn
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

function scheduleAutoBackup(db) {
  const ready = process.env.GOOGLE_CLIENT_ID &&
                process.env.GOOGLE_CLIENT_SECRET &&
                process.env.GOOGLE_REFRESH_TOKEN &&
                process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!ready) return;

  const run = () => {
    uploadBackupToDrive(db)
      .then(r => console.log(`[AutoBackup] ✅ ${r.name}`))
      .catch(e => console.error('[AutoBackup] ❌', e.message));
  };

  setTimeout(() => { run(); setInterval(run, 2 * 60 * 1000); }, 60 * 1000);
  console.log('[AutoBackup] Lên lịch tự động backup Google Drive mỗi 2 phút');
}

// Restore users + events từ Drive backup mới nhất nếu DB hiện tại rỗng
async function restoreFromDriveIfNeeded(db) {
  const ready = process.env.GOOGLE_CLIENT_ID &&
                process.env.GOOGLE_CLIENT_SECRET &&
                process.env.GOOGLE_REFRESH_TOKEN &&
                process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!ready) return false;

  const eventCount = db.prepare('SELECT COUNT(*) as c FROM events').get().c;
  if (eventCount > 0) {
    console.log(`[Restore] DB đã có ${eventCount} events, bỏ qua restore.`);
    return false;
  }

  const rawId = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  const folderId = rawId.includes('drive.google.com')
    ? rawId.split('/folders/')[1]?.split(/[?&]/)[0]?.trim()
    : rawId;

  const auth  = getOAuth2Client();
  const drive = google.drive({ version: 'v3', auth });

  const list = await drive.files.list({
    q: `'${folderId}' in parents and name contains 'kho-khoiminh-backup' and trashed=false`,
    fields: 'files(id,name,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 5,
  });

  const files = list.data.files || [];
  if (files.length === 0) { console.log('[Restore] Không tìm thấy backup trên Drive.'); return false; }

  // Thử từng file từ mới nhất, chọn cái có events
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

      // Restore users + events (không restore transaction_items vì có thể mismatch equipment IDs)
      db.pragma('foreign_keys = OFF');
      const doRestore = db.transaction(() => {
        let users = [], events = [], txns = [];
        try { users = backupDb.prepare('SELECT * FROM users').all(); } catch(_) {}
        try { events = backupDb.prepare('SELECT * FROM events').all(); } catch(_) {}
        try { txns = backupDb.prepare('SELECT * FROM transactions').all(); } catch(_) {}

        if (users.length > 0) {
          db.prepare('DELETE FROM users').run();
          for (const u of users) {
            const cols = Object.keys(u).join(',');
            const ph = Object.keys(u).map(() => '?').join(',');
            try { db.prepare(`INSERT OR REPLACE INTO users (${cols}) VALUES (${ph})`).run(Object.values(u)); } catch(_) {}
          }
        }

        db.prepare('DELETE FROM events').run();
        for (const e of events) {
          const cols = Object.keys(e).join(',');
          const ph = Object.keys(e).map(() => '?').join(',');
          try { db.prepare(`INSERT OR REPLACE INTO events (${cols}) VALUES (${ph})`).run(Object.values(e)); } catch(_) {}
        }

        // Thử restore transactions (không có items, tránh FK equipment)
        try { db.prepare('DELETE FROM transactions').run(); } catch(_) {}
        for (const t of txns) {
          const cols = Object.keys(t).join(',');
          const ph = Object.keys(t).map(() => '?').join(',');
          try { db.prepare(`INSERT OR REPLACE INTO transactions (${cols}) VALUES (${ph})`).run(Object.values(t)); } catch(_) {}
        }

        return { users: users.length, events: events.length, txns: txns.length };
      });

      const result = doRestore();
      db.pragma('foreign_keys = ON');
      backupDb.close();
      fs.unlinkSync(tmpFile);

      console.log(`[Restore] ✅ Từ ${file.name}: ${result.users} users, ${result.events} events, ${result.txns} transactions`);
      return true;
    } catch(e) {
      try { fs.unlinkSync(tmpFile); } catch(_) {}
      console.error(`[Restore] Lỗi với ${file.name}:`, e.message);
    }
  }
  return false;
}

module.exports = { uploadBackupToDrive, scheduleAutoBackup, restoreFromDriveIfNeeded };
