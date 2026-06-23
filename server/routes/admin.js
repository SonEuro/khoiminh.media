const router = require('express').Router();
const { requireRole } = require('../middleware/auth');
const { doImport } = require('../import-equipment');
const db = require('../database');

router.post('/import-equipment', requireRole('SUPER_ADMIN'), (req, res) => {
  try {
    const result = doImport();
    res.json({ success: true, message: `Đã import ${result.count} thiết bị vào ${result.categories} danh mục.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset toàn bộ phiếu xuất (OUT) và đưa qty_in_use về 0
router.post('/reset-out-transactions', requireRole('SUPER_ADMIN'), (req, res) => {
  const doReset = db.transaction(() => {
    // Cộng qty_in_use trở lại qty_available, reset về 0
    const eqResult = db.prepare(
      `UPDATE equipment SET qty_available = qty_available + qty_in_use, qty_in_use = 0 WHERE qty_in_use > 0`
    ).run();

    // Xóa transaction_items thuộc các phiếu OUT
    const itemResult = db.prepare(
      `DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE type = 'OUT')`
    ).run();

    // Xóa phiếu OUT
    const txResult = db.prepare(
      `DELETE FROM transactions WHERE type = 'OUT'`
    ).run();

    return {
      equipment_updated: eqResult.changes,
      items_deleted: itemResult.changes,
      transactions_deleted: txResult.changes,
    };
  });

  try {
    const result = doReset();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
