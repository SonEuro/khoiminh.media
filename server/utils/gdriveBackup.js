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

  setTimeout(() => { run(); setInterval(run, 12 * 60 * 60 * 1000); }, 60 * 1000);
  console.log('[AutoBackup] Lên lịch tự động backup Google Drive mỗi 12h');
}

module.exports = { uploadBackupToDrive, scheduleAutoBackup };
