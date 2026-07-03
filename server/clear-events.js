/**
 * clear-events.js — Xóa sạch tất cả sự kiện, phiếu xuất/nhập, báo cáo, vi phạm.
 * Giữ nguyên: equipment, categories, users.
 * Reset số lượng tồn kho về qty_total.
 *
 * Cách dùng: node server/clear-events.js
 */

const db = require('./database');

const counts = {
  events:        db.prepare('SELECT COUNT(*) AS c FROM events').get().c,
  transactions:  db.prepare('SELECT COUNT(*) AS c FROM transactions').get().c,
  reports:       (() => { try { return db.prepare('SELECT COUNT(*) AS c FROM event_reports').get().c; } catch { return 0; } })(),
  violations:    (() => { try { return db.prepare('SELECT COUNT(*) AS c FROM violations').get().c; } catch { return 0; } })(),
};

console.log('\n📊 Dữ liệu hiện tại:');
console.log(`   Sự kiện       : ${counts.events}`);
console.log(`   Phiếu XK/NK   : ${counts.transactions}`);
console.log(`   Báo cáo SK    : ${counts.reports}`);
console.log(`   Vi phạm       : ${counts.violations}`);
console.log('');

if (counts.events === 0 && counts.transactions === 0 && counts.reports === 0 && counts.violations === 0) {
  console.log('✅ DB đã sạch, không có gì để xóa.');
  process.exit(0);
}

const doDelete = db.transaction(() => {
  // Xóa vi phạm
  try { db.prepare('DELETE FROM violations').run(); } catch (_) {}
  // Xóa báo cáo sự kiện
  try { db.prepare('DELETE FROM event_reports').run(); } catch (_) {}
  // Xóa phiếu + chi tiết (external_items cascade khi xóa transactions)
  db.prepare('DELETE FROM transaction_items').run();
  try { db.prepare('DELETE FROM external_items').run(); } catch (_) {}
  db.prepare('DELETE FROM transactions').run();
  // Xóa tất cả sự kiện (kể cả trong thùng rác)
  db.prepare('DELETE FROM events').run();
  // Reset auto-increment ID về 0
  try {
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('events','transactions','transaction_items','external_items','event_reports','violations')").run();
  } catch (_) {}
  // Reset số lượng tồn kho (qty_available = qty_total, xóa in-use/reserved/...)
  db.prepare(`
    UPDATE equipment
    SET qty_available   = qty_total,
        qty_in_use      = 0,
        qty_reserved    = 0,
        qty_maintenance = 0,
        qty_damaged     = 0,
        qty_lost        = 0
  `).run();
});

try {
  doDelete();
  console.log('✅ Đã xóa tất cả sự kiện, phiếu xuất/nhập, báo cáo, vi phạm.');
  console.log('✅ Đã reset tồn kho về qty_total cho tất cả thiết bị.');
  console.log('✅ Sự kiện tiếp theo sẽ bắt đầu từ EVENT-001.\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Lỗi:', e.message);
  process.exit(1);
}
