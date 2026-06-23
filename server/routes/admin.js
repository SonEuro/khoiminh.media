const router = require('express').Router();
const { requireRole } = require('../middleware/auth');
const { doImport } = require('../import-equipment');

router.post('/import-equipment', requireRole('SUPER_ADMIN'), (req, res) => {
  try {
    const result = doImport();
    res.json({ success: true, message: `Đã import ${result.count} thiết bị vào ${result.categories} danh mục.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
