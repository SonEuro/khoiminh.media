const router = require('express').Router();
const { requireRole } = require('../middleware/auth');
const { doImport } = require('../import-equipment');
const db = require('../database');

// TEMP: restore dữ liệu từ JSON — chỉ dùng 1 lần rồi xóa
router.post('/restore-json', requireRole('SUPER_ADMIN'), (req, res) => {
  const { users = [], events = [], transactions = [] } = req.body;
  try {
    db.pragma('foreign_keys = OFF');
    const doRestore = db.transaction(() => {
      if (users.length > 0) {
        db.prepare('DELETE FROM users').run();
        for (const u of users) {
          const cols = Object.keys(u).join(',');
          const ph   = Object.keys(u).map(() => '?').join(',');
          try { db.prepare(`INSERT OR REPLACE INTO users (${cols}) VALUES (${ph})`).run(Object.values(u)); } catch(_) {}
        }
      }
      if (events.length > 0) {
        db.prepare('DELETE FROM events').run();
        for (const e of events) {
          const cols = Object.keys(e).join(',');
          const ph   = Object.keys(e).map(() => '?').join(',');
          try { db.prepare(`INSERT OR REPLACE INTO events (${cols}) VALUES (${ph})`).run(Object.values(e)); } catch(_) {}
        }
      }
      if (transactions.length > 0) {
        try { db.prepare('DELETE FROM transactions').run(); } catch(_) {}
        for (const t of transactions) {
          const cols = Object.keys(t).join(',');
          const ph   = Object.keys(t).map(() => '?').join(',');
          try { db.prepare(`INSERT OR REPLACE INTO transactions (${cols}) VALUES (${ph})`).run(Object.values(t)); } catch(_) {}
        }
      }
      return { users: users.length, events: events.length, transactions: transactions.length };
    });
    const result = doRestore();
    db.pragma('foreign_keys = ON');
    res.json({ success: true, ...result });
  } catch(err) {
    db.pragma('foreign_keys = ON');
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/import-equipment', requireRole('SUPER_ADMIN', 'DIRECTOR'), (req, res) => {
  try {
    const result = doImport();
    res.json({ success: true, message: `Đã import ${result.count} thiết bị vào ${result.categories} danh mục.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset toàn bộ phiếu xuất (OUT) và đưa qty_in_use về 0
router.post('/reset-out-transactions', requireRole('SUPER_ADMIN', 'DIRECTOR'), (req, res) => {
  const doReset = db.transaction(() => {
    // Cộng qty_in_use + qty_reserved trở lại qty_available, reset cả hai về 0
    const eqResult = db.prepare(
      `UPDATE equipment SET qty_available = qty_available + qty_in_use + qty_reserved, qty_in_use = 0, qty_reserved = 0 WHERE qty_in_use > 0 OR qty_reserved > 0`
    ).run();

    // Xóa transaction_items thuộc các phiếu OUT và RETURN (cả hai đều cần reset)
    const itemResult = db.prepare(
      `DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE type IN ('OUT','RETURN'))`
    ).run();
    try {
      db.prepare(`DELETE FROM external_items WHERE transaction_id IN (SELECT id FROM transactions WHERE type IN ('OUT','RETURN'))`).run();
    } catch (_) {}

    // Xóa phiếu OUT và RETURN
    const txResult = db.prepare(
      `DELETE FROM transactions WHERE type IN ('OUT','RETURN')`
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

// Xóa tất cả sự kiện + phiếu + báo cáo + vi phạm, reset tồn kho
router.post('/clear-all-events', requireRole('SUPER_ADMIN'), (req, res) => {
  const doClear = db.transaction(() => {
    try { db.prepare('DELETE FROM violations').run(); } catch (_) {}
    try { db.prepare('DELETE FROM event_reports').run(); } catch (_) {}
    db.prepare('DELETE FROM transaction_items').run();
    try { db.prepare('DELETE FROM external_items').run(); } catch (_) {}
    db.prepare('DELETE FROM transactions').run();
    db.prepare('DELETE FROM events').run();
    try {
      db.prepare(
        "DELETE FROM sqlite_sequence WHERE name IN ('events','transactions','transaction_items','external_items','event_reports','violations')"
      ).run();
    } catch (_) {}
    db.prepare(`
      UPDATE equipment
      SET qty_available   = qty_total,
          qty_in_use      = 0,
          qty_reserved    = 0,
          qty_maintenance = 0,
          qty_damaged     = 0,
          qty_lost        = 0
    `).run();
    const remaining = db.prepare('SELECT COUNT(*) AS c FROM events').get().c;
    return { ok: true, events_remaining: remaining };
  });

  try {
    const result = doClear();
    res.json({ success: true, ...result, message: 'Đã xóa tất cả sự kiện, phiếu, báo cáo, vi phạm. Tồn kho đã reset.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Xóa các sự kiện được chọn + dữ liệu liên quan, hoàn trả tồn kho chính xác
router.post('/delete-events', requireRole('SUPER_ADMIN'), (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: 'Cần chọn ít nhất 1 sự kiện' });

  const doDelete = db.transaction(() => {
    for (const eventId of ids) {
      const txs = db.prepare('SELECT * FROM transactions WHERE event_id = ? ORDER BY created_at DESC').all(eventId);

      for (const tx of txs) {
        const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(tx.id);

        for (const item of items) {
          const qty = item.quantity;
          const eqId = item.equipment_id;

          if (tx.type === 'OUT' && tx.status === 'pending') {
            // Pending không trừ kho → xóa không cần hoàn lại
          } else if (tx.type === 'OUT') {
            db.prepare(`UPDATE equipment SET qty_available = qty_available + ?, qty_in_use = MAX(0, qty_in_use - ?) WHERE id = ?`)
              .run(qty, qty, eqId);
          } else if (tx.type === 'RETURN') {
            const cond = item.condition || 'good';
            if (cond === 'damaged') {
              db.prepare(`UPDATE equipment SET qty_damaged = MAX(0, qty_damaged - ?), qty_in_use = qty_in_use + ? WHERE id = ?`)
                .run(qty, qty, eqId);
            } else if (cond === 'maintenance') {
              db.prepare(`UPDATE equipment SET qty_maintenance = MAX(0, qty_maintenance - ?), qty_in_use = qty_in_use + ? WHERE id = ?`)
                .run(qty, qty, eqId);
            } else if (cond === 'lost') {
              db.prepare(`UPDATE equipment SET qty_lost = MAX(0, qty_lost - ?), qty_in_use = qty_in_use + ? WHERE id = ?`)
                .run(qty, qty, eqId);
            } else {
              db.prepare(`UPDATE equipment SET qty_available = MAX(0, qty_available - ?), qty_in_use = qty_in_use + ? WHERE id = ?`)
                .run(qty, qty, eqId);
            }
          } else if (tx.type === 'FIX') {
            db.prepare(`UPDATE equipment SET qty_maintenance = qty_maintenance + ?, qty_available = MAX(0, qty_available - ?) WHERE id = ?`)
              .run(qty, qty, eqId);
          } else if (tx.type === 'INTAKE') {
            db.prepare(`UPDATE equipment SET qty_total = MAX(0, qty_total - ?), qty_available = MAX(0, qty_available - ?) WHERE id = ?`)
              .run(qty, qty, eqId);
          }
        }
      }

      try { db.prepare('DELETE FROM violations WHERE event_id = ?').run(eventId); } catch (_) {}
      try { db.prepare('DELETE FROM event_reports WHERE event_id = ?').run(eventId); } catch (_) {}
      try {
        db.prepare('DELETE FROM external_items WHERE transaction_id IN (SELECT id FROM transactions WHERE event_id = ?)').run(eventId);
      } catch (_) {}
      db.prepare('DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE event_id = ?)').run(eventId);
      db.prepare('DELETE FROM transactions WHERE event_id = ?').run(eventId);
      db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
    }

    return { deleted: ids.length };
  });

  try {
    const result = doDelete();
    res.json({ success: true, ...result, message: `Đã xóa ${result.deleted} sự kiện và hoàn trả tồn kho.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
