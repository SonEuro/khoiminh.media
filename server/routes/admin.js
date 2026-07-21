const router = require('express').Router();
const { requireRole } = require('../middleware/auth');
const { doImport } = require('../import-equipment');
const db = require('../database');

router.post('/import-equipment', requireRole('SUPER_ADMIN', 'DIRECTOR'), (req, res) => {
  try {
    const result = doImport();
    res.json({ success: true, message: `Đã import ${result.count} thiết bị vào ${result.categories} danh mục.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Danh sách phiếu OUT để chọn reset
router.get('/out-transactions', requireRole('SUPER_ADMIN', 'DIRECTOR'), (req, res) => {
  const rows = db.prepare(`
    SELECT t.id, t.code, t.status, t.created_at, t.expected_return_date,
      e.name AS event_name,
      COUNT(ti.id) AS item_count
    FROM transactions t
    JOIN events e ON e.id = t.event_id
    LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
    WHERE t.type = 'OUT'
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all();
  res.json(rows);
});

// Reset từng phiếu xuất được chọn (theo tx_ids)
router.post('/reset-out-transactions/selective', requireRole('SUPER_ADMIN', 'DIRECTOR'), (req, res) => {
  const { tx_ids } = req.body;
  if (!Array.isArray(tx_ids) || tx_ids.length === 0)
    return res.status(400).json({ error: 'Thiếu tx_ids' });

  const ids = tx_ids.map(Number).filter(Boolean);
  const placeholders = ids.map(() => '?').join(',');

  const doReset = db.transaction(() => {
    // Lấy tất cả event_id liên quan để tìm cả RETURN transactions
    const eventIds = db.prepare(
      `SELECT DISTINCT event_id FROM transactions WHERE id IN (${placeholders})`
    ).all(...ids).map(r => r.event_id);

    const eventPlaceholders = eventIds.map(() => '?').join(',') || 'NULL';

    // Net qty của completed OUT - RETURN (tính vào qty_in_use)
    const netCompleted = db.prepare(`
      SELECT ti.equipment_id,
        SUM(CASE WHEN t.type='OUT'    THEN ti.quantity ELSE 0 END) -
        SUM(CASE WHEN t.type='RETURN' THEN ti.quantity ELSE 0 END) AS net
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      WHERE t.event_id IN (${eventPlaceholders}) AND t.status = 'completed'
      GROUP BY ti.equipment_id
      HAVING net > 0
    `).all(...eventIds);

    // Qty của pending OUT (tính vào qty_reserved)
    const netPending = db.prepare(`
      SELECT ti.equipment_id, SUM(ti.quantity) AS net
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      WHERE t.event_id IN (${eventPlaceholders}) AND t.status = 'pending' AND t.type = 'OUT'
      GROUP BY ti.equipment_id
    `).all(...eventIds);

    const updCompleted = db.prepare(
      `UPDATE equipment SET qty_available = qty_available + ?, qty_in_use = MAX(0, qty_in_use - ?) WHERE id = ?`
    );
    const updPending = db.prepare(
      `UPDATE equipment SET qty_available = qty_available + ?, qty_reserved = MAX(0, qty_reserved - ?) WHERE id = ?`
    );
    for (const item of netCompleted) updCompleted.run(item.net, item.net, item.equipment_id);
    for (const item of netPending)   updPending.run(item.net, item.net, item.equipment_id);

    // Xóa items + transactions (OUT và RETURN của cùng event)
    const allTxIds = db.prepare(
      `SELECT id FROM transactions WHERE event_id IN (${eventPlaceholders}) AND type IN ('OUT','RETURN')`
    ).all(...eventIds).map(r => r.id);

    if (allTxIds.length) {
      const allPlaceholders = allTxIds.map(() => '?').join(',');
      try { db.prepare(`DELETE FROM external_items WHERE transaction_id IN (${allPlaceholders})`).run(...allTxIds); } catch (_) {}
      db.prepare(`DELETE FROM transaction_items WHERE transaction_id IN (${allPlaceholders})`).run(...allTxIds);
      db.prepare(`DELETE FROM transactions WHERE id IN (${allPlaceholders})`).run(...allTxIds);
    }

    return { equipment_updated: netItems.length, transactions_deleted: allTxIds.length };
  });

  try {
    const result = doReset();
    res.json({ success: true, ...result });
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
    try { db.prepare('UPDATE work_schedules SET event_id = NULL').run(); } catch (_) {}
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
      try { db.prepare('UPDATE work_schedules SET event_id = NULL WHERE event_id = ?').run(eventId); } catch (_) {}
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

// Reconcile qty_in_use / qty_available từ lịch sử giao dịch
router.post('/reconcile-stock', requireRole('SUPER_ADMIN', 'DIRECTOR'), (req, res) => {
  const doReconcile = db.transaction(() => {
    // Preview: tìm các thiết bị bị lệch
    const diffs = db.prepare(`
      SELECT e.id, e.code, e.name, e.qty_in_use AS old_in_use,
        MAX(0, COALESCE((
          SELECT SUM(CASE WHEN t.type='OUT' AND t.status='completed' AND t.deleted_at IS NULL THEN ti.quantity ELSE 0 END)
               - SUM(CASE WHEN t.type='RETURN' AND t.deleted_at IS NULL THEN ti.quantity ELSE 0 END)
          FROM transaction_items ti JOIN transactions t ON t.id = ti.transaction_id
          WHERE ti.equipment_id = e.id
        ), 0)) AS correct_in_use
      FROM equipment e
    `).all().filter(r => r.old_in_use !== r.correct_in_use);

    db.prepare(`
      UPDATE equipment
      SET qty_in_use = MAX(0, COALESCE((
        SELECT SUM(CASE WHEN t.type='OUT' AND t.status='completed' AND t.deleted_at IS NULL THEN ti.quantity ELSE 0 END)
             - SUM(CASE WHEN t.type='RETURN' AND t.deleted_at IS NULL THEN ti.quantity ELSE 0 END)
        FROM transaction_items ti JOIN transactions t ON t.id = ti.transaction_id
        WHERE ti.equipment_id = equipment.id
      ), 0))
    `).run();

    db.prepare(`
      UPDATE equipment
      SET qty_available = MAX(0, qty_total - qty_in_use - qty_damaged - qty_maintenance - qty_lost)
    `).run();

    return diffs;
  });

  try {
    const diffs = doReconcile();
    res.json({ success: true, fixed: diffs.length, items: diffs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Danh sách dismissed obligations — SUPER_ADMIN only
router.get('/dismissed-obligations', requireRole('SUPER_ADMIN'), (req, res) => {
  const now = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
  const rows = db.prepare(`
    SELECT o.id, o.lead_name, o.assigned_date, o.deadline, o.dismissed, o.violation_created,
           (SELECT COUNT(*) FROM event_reports er
            WHERE er.report_date IN (o.assigned_date, date(o.assigned_date, '+1 day'))
              AND (o.event_id IS NULL OR er.event_id = o.event_id)
              AND (er.reporter_user_id = o.user_id OR er.reporter_name = o.lead_name)) AS has_report
    FROM lead_report_obligations o
    WHERE o.dismissed = 1
    ORDER BY o.deadline DESC LIMIT 100
  `).all();
  res.json(rows);
});

// Reset 1 dismissed obligation riêng lẻ — SUPER_ADMIN only
router.post('/reset-dismissed-obligation/:id', requireRole('SUPER_ADMIN'), (req, res) => {
  const row = db.prepare('SELECT id FROM lead_report_obligations WHERE id = ? AND dismissed = 1').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy hoặc chưa bị dismissed' });
  db.prepare('UPDATE lead_report_obligations SET dismissed = 0 WHERE id = ?').run(req.params.id);
  const { checkAndCreateViolations } = require('../services/obligations');
  try { checkAndCreateViolations(); } catch(e) {}
  res.json({ ok: true });
});

// Reset dismissed obligations (chưa có report) để tạo lại violations — SUPER_ADMIN only
router.post('/reset-dismissed-obligations', requireRole('SUPER_ADMIN'), (req, res) => {
  const result = db.prepare(`
    UPDATE lead_report_obligations SET dismissed = 0
    WHERE dismissed = 1
      AND id NOT IN (
        SELECT o.id FROM lead_report_obligations o
        WHERE (SELECT COUNT(*) FROM event_reports er
               WHERE er.report_date IN (o.assigned_date, date(o.assigned_date, '+1 day'))
                 AND (o.event_id IS NULL OR er.event_id = o.event_id)
                 AND (er.reporter_user_id = o.user_id OR er.reporter_name = o.lead_name)) > 0
      )
  `).run();
  const { checkAndCreateViolations } = require('../services/obligations');
  try { checkAndCreateViolations(); } catch(e) {}
  res.json({ ok: true, reset: result.changes });
});

// Debug obligations state — SUPER_ADMIN only
router.get('/debug-obligations', requireRole('SUPER_ADMIN'), (req, res) => {
  const { checkAndCreateViolations } = require('../services/obligations');
  try { checkAndCreateViolations(); } catch (e) {}

  const now = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
  const totalObs = db.prepare('SELECT COUNT(*) AS c FROM lead_report_obligations').get().c;
  const overdueObs = db.prepare(
    `SELECT COUNT(*) AS c FROM lead_report_obligations WHERE deadline <= ? AND (dismissed IS NULL OR dismissed = 0)`
  ).get(now).c;
  const dismissedObs = db.prepare('SELECT COUNT(*) AS c FROM lead_report_obligations WHERE dismissed = 1').get().c;
  const totalViols = db.prepare('SELECT COUNT(*) AS c FROM violations').get().c;
  const sysViols = db.prepare(`SELECT COUNT(*) AS c FROM violations WHERE reporter_name = 'Hệ thống'`).get().c;
  const detail = db.prepare(
    `SELECT o.id, o.lead_name, o.assigned_date, o.deadline, o.dismissed, o.violation_created,
            (SELECT COUNT(*) FROM event_reports er WHERE er.report_date IN (o.assigned_date, date(o.assigned_date, '+1 day'))
               AND (o.event_id IS NULL OR er.event_id = o.event_id)
               AND (er.reporter_user_id = o.user_id OR er.reporter_name = o.lead_name)) AS has_report
     FROM lead_report_obligations o
     WHERE o.deadline <= ?
     ORDER BY o.deadline DESC LIMIT 30`
  ).all(now);
  res.json({ now, totalObs, overdueObs, dismissedObs, totalViols, sysViols, detail });
});

module.exports = router;
