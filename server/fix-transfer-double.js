/**
 * fix-transfer-double.js
 * Sửa các phiếu "update sau chuyển" (type=OUT) sai logic:
 *   - Tìm tất cả OUT có code chứa "update sau chuyển"
 *   - Tính số lượng đã chuyển = items gốc - items còn lại trong "update"
 *   - Tạo phiếu RETURN tương ứng cho sự kiện nguồn
 *   - Xoá (soft-delete) phiếu "update sau chuyển" sai
 *
 * Chạy: node server/fix-transfer-double.js
 */
'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'kho.db');
const db = new Database(DB_PATH);

const now = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'medium',
}).format(new Date()).replace('T', ' ');

// 1. Tìm tất cả phiếu OUT có "update sau chuyển" trong code, chưa bị xoá
const badTxs = db.prepare(`
  SELECT t.*, e.name as event_name
  FROM transactions t
  JOIN events e ON e.id = t.event_id
  WHERE t.code LIKE '% - update sau chuyển%'
    AND t.type = 'OUT'
    AND t.deleted_at IS NULL
`).all();

console.log(`Tìm thấy ${badTxs.length} phiếu "update sau chuyển" cần sửa.`);
if (badTxs.length === 0) { console.log('Không có gì để sửa.'); process.exit(0); }

const fix = db.transaction(() => {
  let fixed = 0;

  for (const badTx of badTxs) {
    // Trích xuất code gốc (bỏ " - update sau chuyển [N]")
    const origCode = badTx.code.replace(/ - update sau chuyển(?: \d+)?$/, '').trim();

    // Tìm phiếu gốc (OUT cùng event, code khớp)
    const origTx = db.prepare(
      `SELECT * FROM transactions WHERE code = ? AND event_id = ? AND type = 'OUT' AND deleted_at IS NULL`
    ).get(origCode, badTx.event_id);

    if (!origTx) {
      console.warn(`  [SKIP] Không tìm được phiếu gốc cho "${badTx.code}" (event_id=${badTx.event_id})`);
      continue;
    }

    // Items của phiếu gốc
    const origItems = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(origTx.id);
    // Items còn lại trong phiếu "update" (remaining)
    const remainItems = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(badTx.id);
    const remainMap = {};
    for (const r of remainItems) remainMap[r.equipment_id] = r.quantity;

    // Tính số lượng đã chuyển = gốc - còn lại
    const transferredItems = [];
    for (const orig of origItems) {
      const remaining = remainMap[orig.equipment_id] || 0;
      const transferred = orig.quantity - remaining;
      if (transferred > 0) {
        transferredItems.push({ equipment_id: orig.equipment_id, quantity: transferred, notes: orig.notes, combo: orig.combo });
      }
    }

    if (transferredItems.length === 0) {
      console.log(`  [SKIP] Phiếu "${badTx.code}": không có thiết bị nào đã chuyển (toàn bộ còn lại).`);
      // Xoá phiếu rỗng này
      db.prepare(`UPDATE transactions SET deleted_at = ? WHERE id = ?`).run(now, badTx.id);
      fixed++;
      continue;
    }

    // Tạo mã phiếu RETURN
    let retCode = `${origCode} - trả sau chuyển`;
    let n = 1;
    while (db.prepare('SELECT 1 FROM transactions WHERE code = ?').get(retCode))
      retCode = `${origCode} - trả sau chuyển ${++n}`;

    // Tạo RETURN transaction
    const retTxR = db.prepare(`
      INSERT INTO transactions (code, type, status, event_id, responsible_person, notes, transaction_date, created_by_id)
      VALUES (?, 'RETURN', 'completed', ?, ?, ?, ?, ?)
    `).run(retCode, badTx.event_id, badTx.responsible_person,
           `[FIX] Thiết bị chuyển sang sự kiện khác (từ ${badTx.code})`, now, badTx.created_by_id);

    for (const it of transferredItems) {
      db.prepare(`INSERT INTO transaction_items (transaction_id, equipment_id, quantity, notes, combo) VALUES (?,?,?,?,?)`)
        .run(retTxR.lastInsertRowid, it.equipment_id, it.quantity, it.notes, it.combo);
    }

    // Soft-delete phiếu "update sau chuyển" sai
    db.prepare(`UPDATE transactions SET deleted_at = ? WHERE id = ?`).run(now, badTx.id);

    console.log(`  [OK] "${badTx.code}" (${badTx.event_name}) → tạo RETURN "${retCode}" với ${transferredItems.length} loại TB`);
    fixed++;
  }

  return fixed;
});

const count = fix();
console.log(`\nHoàn thành: sửa ${count}/${badTxs.length} phiếu.`);
db.close();
