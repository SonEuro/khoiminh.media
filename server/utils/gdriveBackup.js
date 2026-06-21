const { google } = require('googleapis');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

async function uploadBackupToDrive(db) {
  const saJson  = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const rawId   = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();

  if (!saJson || !rawId) {
    throw new Error('Chưa cấu hình GOOGLE_SERVICE_ACCOUNT_JSON hoặc GOOGLE_DRIVE_FOLDER_ID');
  }

  // Chấp nhận cả URL đầy đủ lẫn chỉ ID
  const folderId = rawId.includes('drive.google.com')
    ? rawId.split('/folders/')[1]?.split(/[?&]/)[0]?.trim()
    : rawId;

  const credentials = JSON.parse(saJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  // 1. Tạo bản sao DB nhất quán
  const date    = new Date().toISOString().slice(0, 10);
  const tmpFile = path.join(os.tmpdir(), `kho-backup-${Date.now()}.db`);
  await db.backup(tmpFile);

  // 2. Upload lên Google Drive
  const filename = `kho-khoiminh-backup-${date}.db`;
  const uploaded = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: {
      mimeType: 'application/octet-stream',
      body: fs.createReadStream(tmpFile),
    },
    fields: 'id,name,webViewLink',
  });

  // 3. Xóa file tạm
  try { fs.unlinkSync(tmpFile); } catch (_) {}

  // 4. Giữ tối đa 10 bản backup gần nhất, xóa cũ hơn
  const list = await drive.files.list({
    q: `'${folderId}' in parents and name contains 'kho-khoiminh-backup' and trashed=false`,
    fields: 'files(id,name,createdTime)',
    orderBy: 'createdTime desc',
  });
  const old = (list.data.files || []).slice(10);
  for (const f of old) {
    await drive.files.delete({ fileId: f.id }).catch(() => {});
  }

  return {
    name: uploaded.data.name,
    link: uploaded.data.webViewLink,
    id:   uploaded.data.id,
  };
}

// Tự động backup mỗi 24 giờ nếu đã cấu hình
function scheduleAutoBackup(db) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.GOOGLE_DRIVE_FOLDER_ID) return;

  const run = () => {
    uploadBackupToDrive(db)
      .then(r => console.log(`[AutoBackup] ✅ ${r.name}`))
      .catch(e => console.error('[AutoBackup] ❌', e.message));
  };

  // Chạy lần đầu sau 1 phút (cho server khởi động xong)
  setTimeout(() => {
    run();
    setInterval(run, 24 * 60 * 60 * 1000); // mỗi 24h
  }, 60 * 1000);

  console.log('[AutoBackup] Đã lên lịch tự động backup Google Drive mỗi 24h');
}

module.exports = { uploadBackupToDrive, scheduleAutoBackup };
