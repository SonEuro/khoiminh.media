const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { requireAuth } = require('../middleware/auth');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB — giữ ảnh gốc chất lượng cao
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Chỉ chấp nhận file ảnh'));
    cb(null, true);
  },
});

router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file' });

  const url = `/uploads/${req.file.filename}`;
  const thumbFilename = `thumb_${path.parse(req.file.filename).name}.jpg`;
  const thumbPath = path.join(UPLOADS_DIR, thumbFilename);

  try {
    await sharp(req.file.path)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toFile(thumbPath);
    res.json({ url, thumb: `/uploads/${thumbFilename}` });
  } catch (e) {
    console.error('[upload] thumb generation failed:', e.message);
    res.json({ url, thumb: url });
  }
});

module.exports = router;
