/**
 * Chạy TRƯỚC khi server khởi động (npm prestart).
 * Nếu DB trống/không tồn tại → tải bản backup mới nhất từ Google Drive về.
 */
const { google } = require('googleapis');
const fs   = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'kho.db');

async function restore() {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const rawFolder    = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();

  if (!clientId || !clientSecret || !refreshToken || !rawFolder) {
    console.log('[Restore] Google Drive chưa cấu hình, bỏ qua.');
    return;
  }

  // Kiểm tra DB có events chưa (chính xác hơn kiểm tra kích thước file)
  if (fs.existsSync(DB_PATH)) {
    try {
      const Database = require('better-sqlite3');
      const checkDb = new Database(DB_PATH, { readonly: true });
      const count = checkDb.prepare('SELECT COUNT(*) as c FROM events').get().c;
      checkDb.close();
      if (count > 0) {
        console.log(`[Restore] DB đã có ${count} events, bỏ qua restore.`);
        return;
      }
    } catch(_) {} // DB bị lỗi hoặc chưa có schema → tiến hành restore
  }

  console.log('[Restore] DB trống hoặc chưa có → tìm backup trên Google Drive...');

  const folderId = rawFolder.includes('drive.google.com')
    ? rawFolder.split('/folders/')[1]?.split(/[?&]/)[0]?.trim()
    : rawFolder;

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost');
  oauth2.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: 'v3', auth: oauth2 });

  const list = await drive.files.list({
    q: `'${folderId}' in parents and name contains 'kho-khoiminh-backup' and trashed=false`,
    fields: 'files(id,name,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 1,
  });

  const files = list.data.files || [];
  if (files.length === 0) {
    console.log('[Restore] Không tìm thấy backup trên Drive.');
    return;
  }

  const latest = files[0];
  console.log(`[Restore] Đang tải ${latest.name}...`);

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const res = await drive.files.get(
    { fileId: latest.id, alt: 'media' },
    { responseType: 'stream' }
  );

  await new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(DB_PATH);
    res.data.pipe(dest);
    dest.on('finish', resolve);
    dest.on('error', reject);
  });

  console.log(`[Restore] ✅ Đã khôi phục từ ${latest.name}`);
}

restore()
  .then(() => {
    try {
      const { runOnce } = require('./import-equipment');
      runOnce();
    } catch (e) {
      console.warn('[Restore] runOnce bỏ qua:', e.message);
    }
  })
  .catch(err => {
    console.error('[Restore] ❌ Lỗi:', err.message);
    try {
      const { runOnce } = require('./import-equipment');
      runOnce();
    } catch (_) {}
  });
