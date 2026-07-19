'use strict';
const db = require('./database');

// Tinh lai qty_in_use tu lich su giao dich
const correct = db.prepare(`
  SELECT
    e.id,
    e.name,
    e.unit,
    e.qty_total,
    e.qty_in_use    AS old_in_use,
    e.qty_available AS old_available,
    e.qty_damaged,
    e.qty_maintenance,
    e.qty_lost,
    MAX(0,
      COALESCE((
        SELECT SUM(CASE WHEN t.type='OUT' AND t.status='completed' AND t.deleted_at IS NULL
                        THEN ti.quantity ELSE 0 END)
               - SUM(CASE WHEN t.type='RETURN' AND t.deleted_at IS NULL
                        THEN ti.quantity ELSE 0 END)
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        WHERE ti.equipment_id = e.id
      ), 0)
    ) AS correct_in_use
  FROM equipment e
`).all();

const diffs = correct.filter(r => r.old_in_use !== r.correct_in_use);

if (diffs.length === 0) {
  console.log('Khong co sai so nao. Tong kho dang chinh xac.');
  process.exit(0);
}

console.log(`Tim thay ${diffs.length} thiet bi co sai so:\n`);
console.log(
  ['ID', 'Ten', 'Unit', 'in_use_cu', 'in_use_dung', 'available_cu', 'available_dung']
    .map(h => h.padEnd(14)).join(' ')
);
console.log('-'.repeat(100));
for (const r of diffs) {
  const correct_avail = Math.max(0, r.qty_total - r.correct_in_use - r.qty_damaged - r.qty_maintenance - r.qty_lost);
  console.log([
    String(r.id).padEnd(14),
    r.name.slice(0, 13).padEnd(14),
    r.unit.padEnd(14),
    String(r.old_in_use).padEnd(14),
    String(r.correct_in_use).padEnd(14),
    String(r.old_available).padEnd(14),
    String(correct_avail).padEnd(14),
  ].join(' '));
}

console.log('\nDang cap nhat...');

const fix = db.transaction(() => {
  // Buoc 1: cap nhat qty_in_use
  db.prepare(`
    UPDATE equipment
    SET qty_in_use = MAX(0,
      COALESCE((
        SELECT SUM(CASE WHEN t.type='OUT' AND t.status='completed' AND t.deleted_at IS NULL
                        THEN ti.quantity ELSE 0 END)
               - SUM(CASE WHEN t.type='RETURN' AND t.deleted_at IS NULL
                        THEN ti.quantity ELSE 0 END)
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        WHERE ti.equipment_id = equipment.id
      ), 0)
    )
  `).run();

  // Buoc 2: tinh lai qty_available tu qty_in_use vua cap nhat
  db.prepare(`
    UPDATE equipment
    SET qty_available = MAX(0, qty_total - qty_in_use - qty_damaged - qty_maintenance - qty_lost)
  `).run();
});

fix();

// Kiem tra sau khi sua
const errors = db.prepare(`
  SELECT id, name,
    qty_total, qty_available, qty_in_use, qty_damaged, qty_maintenance, qty_lost,
    qty_total - qty_available - qty_in_use - qty_damaged - qty_maintenance - qty_lost AS kiem_tra
  FROM equipment
  WHERE qty_total - qty_available - qty_in_use - qty_damaged - qty_maintenance - qty_lost != 0
`).all();

if (errors.length === 0) {
  console.log('\nSua xong. Tat ca thiet bi da chinh xac (tong = 0).');
} else {
  console.log('\nCANH BAO: Van con ' + errors.length + ' thiet bi chua khop:');
  console.table(errors);
}
