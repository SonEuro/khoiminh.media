/**
 * Tạo thumbnail cho ảnh cũ trong uploads/ và cập nhật DB
 * Chạy một lần: node server/migrate-thumbnails.js
 */
const path  = require('path');
const fs    = require('fs');
const sharp = require('sharp');
const db    = require('./database');

const UPLOADS_DIR = path.join(__dirname, 'uploads');

async function genThumb(filename) {
  const src  = path.join(UPLOADS_DIR, filename);
  const name = path.parse(filename).name;
  const thumbFilename = `thumb_${name}.jpg`;
  const dest = path.join(UPLOADS_DIR, thumbFilename);
  if (fs.existsSync(dest)) return `/uploads/${thumbFilename}`; // đã có
  await sharp(src)
    .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toFile(dest);
  return `/uploads/${thumbFilename}`;
}

async function run() {
  const reports = db.prepare('SELECT id, images FROM event_reports').all();
  let countReports = 0, countImages = 0, skipped = 0;

  for (const report of reports) {
    let images;
    try { images = JSON.parse(report.images || '[]'); } catch { continue; }
    if (!Array.isArray(images) || images.length === 0) continue;

    let changed = false;
    const newImages = await Promise.all(images.map(async src => {
      // Đã là object {url, thumb} → bỏ qua
      if (src && typeof src === 'object') { skipped++; return src; }
      // String URL
      if (typeof src !== 'string' || !src.startsWith('/uploads/')) { skipped++; return src; }
      const filename = src.replace('/uploads/', '');
      // Bỏ qua nếu chính nó là thumbnail
      if (filename.startsWith('thumb_')) { skipped++; return src; }
      try {
        const thumb = await genThumb(filename);
        changed = true;
        countImages++;
        return { url: src, thumb };
      } catch (e) {
        console.error(`  ⚠️  Lỗi tạo thumb cho ${filename}:`, e.message);
        skipped++;
        return src;
      }
    }));

    if (changed) {
      db.prepare('UPDATE event_reports SET images = ? WHERE id = ?')
        .run(JSON.stringify(newImages), report.id);
      countReports++;
      console.log(`[OK] report #${report.id} — ${countImages} ảnh đã có thumb`);
    }
  }

  console.log(`\n✅ Xong: ${countReports} báo cáo, ${countImages} thumbnail tạo mới, ${skipped} bỏ qua.`);
}

run().catch(e => { console.error('Lỗi:', e.message); process.exit(1); });
