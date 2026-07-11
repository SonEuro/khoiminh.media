/**
 * Migration: chuyển ảnh base64 trong event_reports sang file vật lý
 * Chạy một lần: node server/migrate-images.js
 */
const path = require('path');
const fs   = require('fs');
const db   = require('./database');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function base64ToFile(dataUrl, index) {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  const ext      = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buffer   = Buffer.from(match[2], 'base64');
  const filename = `migrated-${Date.now()}-${Math.random().toString(36).slice(2)}-${index}.${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  return `/uploads/${filename}`;
}

const reports = db.prepare('SELECT id, images FROM event_reports').all();

let totalReports = 0;
let totalImages  = 0;
let skipped      = 0;

for (const report of reports) {
  let images;
  try { images = JSON.parse(report.images || '[]'); } catch { continue; }
  if (!Array.isArray(images) || images.length === 0) continue;

  let changed = false;
  const newImages = images.map((src, i) => {
    if (typeof src === 'string' && src.startsWith('data:image/')) {
      const url = base64ToFile(src, i);
      if (url) { totalImages++; changed = true; return url; }
    }
    skipped++;
    return src;
  });

  if (changed) {
    db.prepare('UPDATE event_reports SET images = ? WHERE id = ?')
      .run(JSON.stringify(newImages), report.id);
    totalReports++;
    console.log(`[OK] report #${report.id} — ${newImages.length} ảnh`);
  }
}

console.log(`\n✅ Xong: ${totalReports} báo cáo, ${totalImages} ảnh đã migrate, ${skipped} ảnh bỏ qua (đã là URL).`);
