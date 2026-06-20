const router = require('express').Router();
const db = require('../database');
const { requireRole } = require('../middleware/auth');

const canTransact = requireRole('SUPER_ADMIN', 'TECHNICAL', 'ATAS', 'STAGE', 'CSVC');

function checkDept(user, equipmentIds) {
  const cats = user.deptCats;
  if (!cats) return null;
  for (const id of equipmentIds) {
    const row = db.prepare(
      'SELECT c.code FROM equipment e JOIN categories c ON c.id = e.category_id WHERE e.id = ?'
    ).get(id);
    if (row && !cats.includes(row.code)) {
      return `Bộ phận bạn không có quyền xuất/nhập thiết bị danh mục "${row.code}"`;
    }
  }
  return null;
}

function nextCode(type, eventId) {
  if (type === 'OUT') {
    let prefix = 'XUAT NOI BO';
    let row;
    if (eventId) {
      const ev = db.prepare('SELECT name FROM events WHERE id = ?').get(eventId);
      if (ev) prefix = ev.name.toUpperCase();
      row = db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE type = 'OUT' AND event_id = ?`).get(eventId);
    } else {
      row = db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE type = 'OUT' AND event_id IS NULL`).get();
    }
    const seq = (row?.c ?? 0) + 1;
    return `${prefix}-${String(seq).padStart(3, '0')}`;
  }
  const prefix = type === 'RETURN' ? 'NHAP' : 'FIX';
  const { c } = db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE type = ?`).get(type);
  return `${prefix}-${String(c + 1).padStart(3, '0')}`;
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
router.post('/out', canTransact, (req, res) => {
  const { event_id, responsible_person, expected_return_date, notes, items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Chưa có thiết bị nào' });
  const deptErr = checkDept(req.user, items.map(i => i.equipment_id));
  if (deptErr) return res.status(403).json({ error: deptErr });

  const doOut = db.transaction(() => {
    const code = nextCode('OUT', event_id || null);
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
router.post('/return', canTransact, (req, res) => {
  const { event_id, responsible_person, notes, items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Chưa có thiết bị nào' });
  const deptErr = checkDept(req.user, items.map(i => i.equipment_id));
  if (deptErr) return res.status(403).json({ error: deptErr });

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
router.post('/fix', canTransact, (req, res) => {
  const { notes, items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Chưa có thiết bị nào' });

  const doFix = db.transaction(() => {
    const code = nextCode('FIX');

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
