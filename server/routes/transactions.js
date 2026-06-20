const router = require('express').Router();
const db = require('../database');

function nextCode(type) {
  const prefix = type === 'OUT' ? 'XUAT' : type === 'RETURN' ? 'NHAP' : 'TX';
  const last = db.prepare(`SELECT code FROM transactions WHERE type = ? ORDER BY id DESC LIMIT 1`).get(type);
  if (!last) return `${prefix}-001`;
  const num = parseInt(last.code.split('-')[1]) + 1;
  return `${prefix}-${String(num).padStart(3, '0')}`;
}

router.get('/', (req, res) => {
  const { type, event_id, limit = 50 } = req.query;
  let sql = `
    SELECT t.*, e.name as event_name,
           (SELECT COUNT(*) FROM transaction_items ti WHERE ti.transaction_id = t.id) as item_count
    FROM transactions t
    LEFT JOIN events e ON e.id = t.event_id
    WHERE 1=1
  `;
  const params = [];
  if (type)     { sql += ' AND t.type = ?'; params.push(type); }
  if (event_id) { sql += ' AND t.event_id = ?'; params.push(event_id); }
  sql += ' ORDER BY t.created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const tx = db.prepare(`
    SELECT t.*, e.name as event_name, e.code as event_code
    FROM transactions t LEFT JOIN events e ON e.id = t.event_id
    WHERE t.id = ?
  `).get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Không tìm thấy' });

  const items = db.prepare(`
    SELECT ti.*, eq.code as eq_code, eq.name as eq_name, eq.unit, c.name as category
    FROM transaction_items ti
    JOIN equipment eq ON eq.id = ti.equipment_id
    LEFT JOIN categories c ON c.id = eq.category_id
    WHERE ti.transaction_id = ?
  `).all(req.params.id);

  res.json({ ...tx, items });
});

// Xuất kho (OUT)
router.post('/out', (req, res) => {
  const { event_id, responsible_person, expected_return_date, notes, items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Chưa có thiết bị nào' });

  const doOut = db.transaction(() => {
    const code = nextCode('OUT');
    const txR = db.prepare(`
      INSERT INTO transactions (code, type, event_id, responsible_person, expected_return_date, notes)
      VALUES (?, 'OUT', ?, ?, ?, ?)
    `).run(code, event_id || null, responsible_person, expected_return_date, notes);

    const txId = txR.lastInsertRowid;
    const insertItem = db.prepare(`INSERT INTO transaction_items (transaction_id, equipment_id, quantity, notes) VALUES (?, ?, ?, ?)`);
    const updateEq = db.prepare(`UPDATE equipment SET qty_available = qty_available - ?, qty_in_use = qty_in_use + ? WHERE id = ? AND qty_available >= ?`);

    for (const item of items) {
      const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(item.equipment_id);
      if (!eq) throw new Error(`Thiết bị ID ${item.equipment_id} không tồn tại`);
      if (eq.qty_available < item.quantity) throw new Error(`${eq.name}: chỉ còn ${eq.qty_available} ${eq.unit}`);
      insertItem.run(txId, item.equipment_id, item.quantity, item.notes || null);
      updateEq.run(item.quantity, item.quantity, item.equipment_id, item.quantity);
    }

    return { id: txId, code };
  });

  try {
    res.json(doOut());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Nhập kho / trả kho (RETURN)
router.post('/return', (req, res) => {
  const { event_id, responsible_person, notes, items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Chưa có thiết bị nào' });

  const doReturn = db.transaction(() => {
    const code = nextCode('RETURN');
    const txR = db.prepare(`
      INSERT INTO transactions (code, type, event_id, responsible_person, notes)
      VALUES (?, 'RETURN', ?, ?, ?)
    `).run(code, event_id || null, responsible_person, notes);

    const txId = txR.lastInsertRowid;
    const insertItem = db.prepare(`INSERT INTO transaction_items (transaction_id, equipment_id, quantity, condition, notes) VALUES (?, ?, ?, ?, ?)`);

    for (const item of items) {
      const cond = item.condition || 'good';
      insertItem.run(txId, item.equipment_id, item.quantity, cond, item.notes || null);

      // Update quantities based on condition
      if (cond === 'good') {
        db.prepare(`UPDATE equipment SET qty_in_use = qty_in_use - ?, qty_available = qty_available + ? WHERE id = ?`).run(item.quantity, item.quantity, item.equipment_id);
      } else if (cond === 'damaged') {
        db.prepare(`UPDATE equipment SET qty_in_use = qty_in_use - ?, qty_damaged = qty_damaged + ? WHERE id = ?`).run(item.quantity, item.quantity, item.equipment_id);
      } else if (cond === 'maintenance') {
        db.prepare(`UPDATE equipment SET qty_in_use = qty_in_use - ?, qty_maintenance = qty_maintenance + ? WHERE id = ?`).run(item.quantity, item.quantity, item.equipment_id);
      } else if (cond === 'lost') {
        db.prepare(`UPDATE equipment SET qty_in_use = qty_in_use - ?, qty_lost = qty_lost + ? WHERE id = ?`).run(item.quantity, item.quantity, item.equipment_id);
      }
    }

    return { id: txId, code };
  });

  try {
    res.json(doReturn());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Nhập bảo trì → trả lại kho
router.post('/fix', (req, res) => {
  const { notes, items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Chưa có thiết bị nào' });

  const doFix = db.transaction(() => {
    const last = db.prepare("SELECT code FROM transactions WHERE type='FIX' ORDER BY id DESC LIMIT 1").get();
    const num = last ? parseInt(last.code.split('-')[1]) + 1 : 1;
    const code = `FIX-${String(num).padStart(3, '0')}`;

    const txR = db.prepare(`INSERT INTO transactions (code, type, notes) VALUES (?, 'FIX', ?)`).run(code, notes);
    const txId = txR.lastInsertRowid;

    for (const item of items) {
      db.prepare(`INSERT INTO transaction_items (transaction_id, equipment_id, quantity, condition) VALUES (?, ?, ?, 'good')`).run(txId, item.equipment_id, item.quantity);
      db.prepare(`UPDATE equipment SET qty_maintenance = qty_maintenance - ?, qty_available = qty_available + ? WHERE id = ?`).run(item.quantity, item.quantity, item.equipment_id);
    }

    return { id: txId, code };
  });

  try {
    res.json(doFix());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
