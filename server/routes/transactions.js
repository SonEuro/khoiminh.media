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

// Outstanding items for an event (OUT qty - RETURN qty > 0)
router.get('/outstanding', (req, res) => {
  const { event_id } = req.query;
  if (!event_id) return res.json([]);
  const rows = db.prepare(`
    SELECT
      e.id   AS equipment_id,
      e.code AS eq_code,
      e.name AS eq_name,
      e.unit,
      c.code AS category_code,
      c.name AS category_name,
      COALESCE(SUM(CASE WHEN t.type='OUT'    THEN ti.quantity ELSE 0 END),0) AS qty_out,
      COALESCE(SUM(CASE WHEN t.type='RETURN' THEN ti.quantity ELSE 0 END),0) AS qty_returned
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN equipment    e ON e.id = ti.equipment_id
    LEFT JOIN categories c ON c.id = e.category_id
    WHERE t.event_id = ?
    GROUP BY e.id
    HAVING qty_out > qty_returned
    ORDER BY c.code, e.name
  `).all(event_id);
  res.json(rows.map(r => ({ ...r, qty_pending: r.qty_out - r.qty_returned })));
});

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

  const external_items = db.prepare(
    'SELECT * FROM external_items WHERE transaction_id = ?'
  ).all(req.params.id);

  res.json({ ...tx, items, external_items });
});

// Xuất kho (OUT)
router.post('/out', canTransact, (req, res) => {
  const { event_id, responsible_person, expected_return_date, notes, items, external_items } = req.body;
  if (!event_id) return res.status(400).json({ error: 'Phải chọn sự kiện trước khi xuất thiết bị' });
  const validExt = (external_items || []).filter(i => i.name?.trim());
  if ((!items || items.length === 0) && validExt.length === 0)
    return res.status(400).json({ error: 'Chưa có thiết bị nào' });
  if (items?.length) {
    const deptErr = checkDept(req.user, items.map(i => i.equipment_id));
    if (deptErr) return res.status(403).json({ error: deptErr });
  }

  const doOut = db.transaction(() => {
    const code = nextCode('OUT', event_id || null);
    const txR = db.prepare(`
      INSERT INTO transactions (code, type, event_id, responsible_person, expected_return_date, notes)
      VALUES (?, 'OUT', ?, ?, ?, ?)
    `).run(code, event_id || null, responsible_person, expected_return_date, notes);

    const txId = txR.lastInsertRowid;
    const insertItem = db.prepare(`INSERT INTO transaction_items (transaction_id, equipment_id, quantity, notes) VALUES (?, ?, ?, ?)`);
    const updateEq = db.prepare(`UPDATE equipment SET qty_available = qty_available - ?, qty_in_use = qty_in_use + ? WHERE id = ? AND qty_available >= ?`);

    for (const item of (items || [])) {
      const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(item.equipment_id);
      if (!eq) throw new Error(`Thiết bị ID ${item.equipment_id} không tồn tại`);
      if (eq.qty_available < item.quantity) throw new Error(`${eq.name}: chỉ còn ${eq.qty_available} ${eq.unit}`);
      insertItem.run(txId, item.equipment_id, item.quantity, item.notes || null);
      updateEq.run(item.quantity, item.quantity, item.equipment_id, item.quantity);
    }

    const insertExt = db.prepare(`INSERT INTO external_items (transaction_id, supplier, name, quantity, notes) VALUES (?, ?, ?, ?, ?)`);
    for (const ext of validExt) {
      insertExt.run(txId, ext.supplier || '', ext.name.trim(), ext.quantity || 1, ext.notes || null);
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
  const { event_id, responsible_person, notes, items, external_items } = req.body;
  const validExt = (external_items || []).filter(i => i.name?.trim());
  if ((!items || items.length === 0) && validExt.length === 0)
    return res.status(400).json({ error: 'Chưa có thiết bị nào' });
  if (items?.length) {
    const deptErr = checkDept(req.user, items.map(i => i.equipment_id));
    if (deptErr) return res.status(403).json({ error: deptErr });
  }

  const doReturn = db.transaction(() => {
    const code = nextCode('RETURN');
    const txR = db.prepare(`
      INSERT INTO transactions (code, type, event_id, responsible_person, notes)
      VALUES (?, 'RETURN', ?, ?, ?)
    `).run(code, event_id || null, responsible_person, notes);

    const txId = txR.lastInsertRowid;
    const insertItem = db.prepare(`INSERT INTO transaction_items (transaction_id, equipment_id, quantity, condition, notes) VALUES (?, ?, ?, ?, ?)`);

    for (const item of (items || [])) {
      const cond = item.condition || 'good';
      insertItem.run(txId, item.equipment_id, item.quantity, cond, item.notes || null);

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

    const insertExt = db.prepare(`INSERT INTO external_items (transaction_id, supplier, name, quantity, notes) VALUES (?, ?, ?, ?, ?)`);
    for (const ext of validExt) {
      insertExt.run(txId, ext.supplier || '', ext.name.trim(), ext.quantity || 1, ext.notes || null);
    }

    return { id: txId, code };
  });

  try {
    res.json(doReturn());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Nhập thiết bị mới (tăng tồn kho)
router.post('/intake', canTransact, (req, res) => {
  const { responsible_person, supplier, notes, items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Chưa có thiết bị nào' });

  const doIntake = db.transaction(() => {
    const { c } = db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE type = 'INTAKE'`).get();
    const code = `NHAP-MOI-${String(c + 1).padStart(3, '0')}`;
    const txR = db.prepare(`
      INSERT INTO transactions (code, type, responsible_person, notes)
      VALUES (?, 'INTAKE', ?, ?)
    `).run(code, responsible_person, notes ? `[${supplier || ''}] ${notes}` : supplier || '');

    const txId = txR.lastInsertRowid;
    for (const item of items) {
      if (!item.equipment_id || !item.quantity || item.quantity <= 0) continue;
      db.prepare(`INSERT INTO transaction_items (transaction_id, equipment_id, quantity, condition) VALUES (?, ?, ?, 'good')`).run(txId, item.equipment_id, item.quantity);
      db.prepare(`UPDATE equipment SET qty_total = qty_total + ?, qty_available = qty_available + ? WHERE id = ?`).run(item.quantity, item.quantity, item.equipment_id);
    }
    return { id: txId, code };
  });

  try { res.json(doIntake()); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Nhập thiết bị mới (tăng tồn kho)
router.post('/intake', canTransact, (req, res) => {
  const { responsible_person, department, intake_date, notes, items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Chưa có thiết bị nào' });

  const doIntake = db.transaction(() => {
    const { c } = db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE type = 'INTAKE'`).get();
    const code = `NHAP-MOI-${String(c + 1).padStart(3, '0')}`;
    const txR = db.prepare(`
      INSERT INTO transactions (code, type, responsible_person, notes)
      VALUES (?, 'INTAKE', ?, ?)
    `).run(code, responsible_person, [department, notes].filter(Boolean).join(' | '));

    const txId = txR.lastInsertRowid;
    for (const item of items) {
      if (!item.equipment_id || !item.quantity || item.quantity <= 0) continue;
      db.prepare(`INSERT INTO transaction_items (transaction_id, equipment_id, quantity, condition) VALUES (?, ?, ?, 'good')`).run(txId, item.equipment_id, item.quantity);
      db.prepare(`UPDATE equipment SET qty_total = qty_total + ?, qty_available = qty_available + ? WHERE id = ?`).run(item.quantity, item.quantity, item.equipment_id);
    }
    return { id: txId, code };
  });

  try { res.json(doIntake()); }
  catch (e) { res.status(400).json({ error: e.message }); }
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
