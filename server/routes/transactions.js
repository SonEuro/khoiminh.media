const router = require('express').Router();
const db = require('../database');
const { requireRole } = require('../middleware/auth');

const canTransact = requireRole('SUPER_ADMIN', 'DIRECTOR', 'TECHNICAL', 'ATAS', 'STAGE', 'CSVC');
const canIntake   = requireRole('SUPER_ADMIN', 'DIRECTOR', 'ACCOUNTING');
const canFix      = requireRole('SUPER_ADMIN', 'DIRECTOR', 'PRODUCTION', 'TECHNICAL', 'ATAS', 'STAGE', 'CSVC');

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

function findNextSeq(existingCodes, makeCode) {
  let maxNum = 0;
  for (const r of existingCodes) {
    const m = r.code.match(/(\d+)$/);
    if (m && parseInt(m[1]) > maxNum) maxNum = parseInt(m[1]);
  }
  let seq = maxNum + 1;
  let candidate;
  do {
    candidate = makeCode(seq);
    seq++;
  } while (db.prepare('SELECT 1 FROM transactions WHERE code = ?').get(candidate));
  return candidate;
}

function nextCode(type, eventId, userName) {
  if (type === 'FIX') {
    let name = 'Sửa chữa';
    if (eventId) {
      const eq = db.prepare('SELECT name FROM equipment WHERE id = ?').get(eventId);
      if (eq) name = eq.name;
    }
    const rows = db.prepare(`SELECT code FROM transactions WHERE type = 'FIX' AND code LIKE ?`).all(name + ' %');
    return findNextSeq(rows, seq => `${name} ${String(seq).padStart(3, '0')}`);
  }
  const prefix = type === 'OUT' ? 'Xuất' : 'Nhập';
  let namePart = '';
  let rows;
  if (eventId) {
    const ev = db.prepare('SELECT name FROM events WHERE id = ?').get(eventId);
    if (ev) namePart = '-' + ev.name;
    rows = db.prepare(`SELECT code FROM transactions WHERE type = ? AND event_id = ?`).all(type, eventId);
  } else {
    if (userName) namePart = '-' + userName;
    rows = db.prepare(`SELECT code FROM transactions WHERE type = ? AND event_id IS NULL`).all(type);
  }
  return findNextSeq(rows, seq => `${prefix}${namePart}-${String(seq).padStart(3, '0')}`);
}

// Outstanding items for an event (OUT qty - RETURN qty > 0)
// Events that have OUT items not yet fully returned
router.get('/pending-returns', (req, res) => {
  const rows = db.prepare(`
    SELECT
      ev.id        AS event_id,
      ev.name      AS event_name,
      ev.code      AS event_code,
      ev.start_date,
      (SELECT GROUP_CONCAT(t2.code)
       FROM transactions t2
       WHERE t2.event_id = ev.id AND t2.type = 'OUT') AS out_codes,
      COALESCE(kho.item_types, 0)    AS item_types,
      COALESCE(kho.total_pending, 0) AS total_pending,
      COALESCE(ncc.ncc_types, 0)     AS ncc_types
    FROM events ev
    JOIN (
      SELECT t.event_id
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      WHERE t.event_id IS NOT NULL AND t.status != 'pending'
      GROUP BY t.event_id, ti.equipment_id
      HAVING SUM(CASE WHEN t.type='OUT' THEN ti.quantity ELSE 0 END) >
             SUM(CASE WHEN t.type='RETURN' THEN ti.quantity ELSE 0 END)
      UNION
      SELECT t.event_id
      FROM external_items ei
      JOIN transactions t ON t.id = ei.transaction_id
      WHERE t.event_id IS NOT NULL AND t.status != 'pending'
      GROUP BY t.event_id, ei.supplier, ei.name
      HAVING SUM(CASE WHEN t.type='OUT' THEN ei.quantity ELSE 0 END) >
             SUM(CASE WHEN t.type='RETURN' THEN ei.quantity ELSE 0 END)
    ) any_pend ON any_pend.event_id = ev.id
    LEFT JOIN (
      SELECT event_id, COUNT(*) AS item_types, SUM(net_qty) AS total_pending
      FROM (
        SELECT t.event_id, ti.equipment_id,
          SUM(CASE WHEN t.type='OUT'    THEN ti.quantity ELSE 0 END) -
          SUM(CASE WHEN t.type='RETURN' THEN ti.quantity ELSE 0 END) AS net_qty
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        WHERE t.event_id IS NOT NULL AND t.status != 'pending'
        GROUP BY t.event_id, ti.equipment_id
      ) per_eq WHERE net_qty > 0
      GROUP BY event_id
    ) kho ON kho.event_id = ev.id
    LEFT JOIN (
      SELECT event_id, COUNT(*) AS ncc_types
      FROM (
        SELECT t.event_id, ei.supplier, ei.name
        FROM external_items ei
        JOIN transactions t ON t.id = ei.transaction_id
        WHERE t.event_id IS NOT NULL AND t.status != 'pending'
        GROUP BY t.event_id, ei.supplier, ei.name
        HAVING SUM(CASE WHEN t.type='OUT' THEN ei.quantity ELSE 0 END) >
               SUM(CASE WHEN t.type='RETURN' THEN ei.quantity ELSE 0 END)
      ) GROUP BY event_id
    ) ncc ON ncc.event_id = ev.id
    WHERE ev.archived_at IS NULL AND ev.deleted_at IS NULL
    ORDER BY ev.start_date DESC
  `).all();
  res.json(rows);
});

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
      COALESCE(SUM(CASE WHEN t.type='RETURN' THEN ti.quantity ELSE 0 END),0) AS qty_returned,
      MIN(ti.id) AS first_row
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN equipment    e ON e.id = ti.equipment_id
    LEFT JOIN categories c ON c.id = e.category_id
    WHERE t.event_id = ? AND t.status != 'pending'
    GROUP BY e.id
    HAVING qty_out > qty_returned
    ORDER BY first_row ASC
  `).all(event_id);
  res.json(rows.map(r => ({ ...r, qty_pending: r.qty_out - r.qty_returned })));
});

// NCC items chưa trả theo event
router.get('/outstanding-ext', (req, res) => {
  const { event_id } = req.query;
  if (!event_id) return res.json([]);
  const rows = db.prepare(`
    SELECT
      ei.supplier,
      ei.name,
      ei.unit,
      MAX(ei.rental_days) AS rental_days,
      SUM(CASE WHEN t.type = 'OUT'    THEN ei.quantity ELSE 0 END) AS qty_out,
      SUM(CASE WHEN t.type = 'RETURN' THEN ei.quantity ELSE 0 END) AS qty_returned
    FROM external_items ei
    JOIN transactions t ON t.id = ei.transaction_id
    WHERE t.event_id = ? AND t.status != 'pending'
    GROUP BY ei.supplier, ei.name, ei.unit
    HAVING qty_out > qty_returned
    ORDER BY ei.supplier, ei.name
  `).all(event_id);
  res.json(rows.map(r => ({ ...r, qty_pending: r.qty_out - r.qty_returned })));
});

router.get('/', (req, res) => {
  const { type, event_id, limit = 50, status, hide_archived } = req.query;
  let sql = `
    SELECT t.*, e.name as event_name,
           (SELECT COUNT(*) FROM transaction_items ti WHERE ti.transaction_id = t.id) as item_count,
           (SELECT COUNT(*) FROM external_items ei WHERE ei.transaction_id = t.id) as ext_count
    FROM transactions t
    LEFT JOIN events e ON e.id = t.event_id
    WHERE 1=1
  `;
  const params = [];
  if (type)         { sql += ' AND t.type = ?'; params.push(type); }
  if (event_id)     { sql += ' AND t.event_id = ?'; params.push(event_id); }
  if (status)       { sql += ' AND t.status = ?'; params.push(status); }
  if (hide_archived === 'true') { sql += ' AND (t.event_id IS NULL OR e.archived_at IS NULL)'; }
  sql += ' ORDER BY t.created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const tx = db.prepare(`
    SELECT t.*, e.name as event_name, e.code as event_code, e.filming_date, e.show_date, e.client as event_client, e.location as event_location
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

  let edits = [];
  try {
    edits = db.prepare(
      'SELECT * FROM transaction_edits WHERE transaction_id = ? ORDER BY created_at ASC'
    ).all(req.params.id);
  } catch (_) {}

  res.json({ ...tx, items, external_items, edits });
});

// Xuất kho (OUT)
router.post('/out', canTransact, (req, res) => {
  const { event_id, responsible_person, expected_return_date, notes, items, external_items } = req.body;
  if (!event_id) return res.status(400).json({ error: 'Phải chọn sự kiện trước khi xuất thiết bị' });
  const evCheck = db.prepare('SELECT id, filming_dates, filming_date, show_date, start_date FROM events WHERE id = ?').get(event_id);
  if (!evCheck) return res.status(400).json({ error: 'Sự kiện không tồn tại. Vui lòng tải lại trang và chọn lại sự kiện.' });
  const validExt = (external_items || []).filter(i => i.name?.trim());
  if ((!items || items.length === 0) && validExt.length === 0)
    return res.status(400).json({ error: 'Chưa có thiết bị nào' });
  if (items?.length) {
    const deptErr = checkDept(req.user, items.map(i => i.equipment_id));
    if (deptErr) return res.status(403).json({ error: deptErr });
  }

  let filmingDates = [];
  try { filmingDates = JSON.parse(evCheck.filming_dates || '[]'); } catch { filmingDates = []; }
  if (evCheck.filming_date) filmingDates.push(evCheck.filming_date);
  if (evCheck.show_date)    filmingDates.push(evCheck.show_date);
  if (!filmingDates.length && evCheck.start_date) filmingDates = [evCheck.start_date];
  filmingDates = filmingDates.filter(Boolean).sort();
  const earliestFilming = filmingDates[0] || null;

  // Dùng localtime từ SQLite tránh lệch múi giờ UTC của Node.js
  const { today } = db.prepare("SELECT date('now','localtime') AS today").get();
  const isPending = !!(earliestFilming && earliestFilming > today);
  const txStatus = isPending ? 'pending' : 'completed';

  const doOut = db.transaction(() => {
    const code = nextCode('OUT', event_id || null, req.user.full_name);
    const txR = db.prepare(`
      INSERT INTO transactions (code, type, status, event_id, responsible_person, expected_return_date, notes, created_by_id)
      VALUES (?, 'OUT', ?, ?, ?, ?, ?, ?)
    `).run(code, txStatus, event_id || null, responsible_person, expected_return_date, notes, req.user.id);

    const txId = txR.lastInsertRowid;
    const insertItem = db.prepare(`INSERT INTO transaction_items (transaction_id, equipment_id, quantity, notes) VALUES (?, ?, ?, ?)`);

    for (const item of (items || [])) {
      const qty = parseInt(item.quantity) || 0;
      if (qty <= 0) throw new Error(`Số lượng thiết bị phải lớn hơn 0`);
      const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(item.equipment_id);
      if (!eq) throw new Error(`Thiết bị ID ${item.equipment_id} không tồn tại`);
      insertItem.run(txId, item.equipment_id, qty, item.notes || null);
      if (!isPending) {
        if (eq.qty_available < qty)
          throw new Error(`${eq.name}: chỉ còn ${eq.qty_available} ${eq.unit}`);
        db.prepare(`UPDATE equipment SET qty_available = qty_available - ?, qty_in_use = qty_in_use + ? WHERE id = ?`)
          .run(qty, qty, item.equipment_id);
      }
      // Pending: chỉ ghi nhận, không trừ kho, không reserve
    }

    const insertExt = db.prepare(`INSERT INTO external_items (transaction_id, supplier, name, quantity, notes, unit, rental_days) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const ext of validExt) {
      insertExt.run(txId, ext.supplier || '', ext.name.trim(), ext.quantity || 1, ext.notes || null, ext.unit || 'Cái', ext.rental_days || 1);
    }

    return { id: txId, code, status: txStatus, _pending: isPending, _filmingDate: earliestFilming };
  });

  try {
    res.json(doOut());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Xác nhận xuất kho tạm → trừ kho thật
router.post('/confirm/:id', canTransact, (req, res) => {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Không tìm thấy phiếu' });
  if (tx.type !== 'OUT' || tx.status !== 'pending')
    return res.status(400).json({ error: 'Phiếu này không phải xuất kho tạm' });

  const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(tx.id);

  const doConfirm = db.transaction(() => {
    for (const item of items) {
      const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(item.equipment_id);
      if (!eq) throw new Error(`Thiết bị ID ${item.equipment_id} không tồn tại`);
      if (eq.qty_available < item.quantity)
        throw new Error(`${eq.name}: chỉ còn ${eq.qty_available} ${eq.unit}, cần ${item.quantity}`);
      db.prepare(`UPDATE equipment SET qty_available = qty_available - ?, qty_in_use = qty_in_use + ? WHERE id = ?`)
        .run(item.quantity, item.quantity, item.equipment_id);
    }
    db.prepare(`UPDATE transactions SET status = 'completed', transaction_date = datetime('now','localtime') WHERE id = ?`)
      .run(tx.id);
    return { ok: true };
  });

  try {
    res.json(doConfirm());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Nhập kho / trả kho (RETURN)
router.post('/return', canTransact, (req, res) => {
  const { event_id, responsible_person, notes, items, external_items, transaction_date } = req.body;
  const validExt = (external_items || []).filter(i => i.name?.trim());
  if ((!items || items.length === 0) && validExt.length === 0)
    return res.status(400).json({ error: 'Chưa có thiết bị nào' });
  if (items?.length) {
    const deptErr = checkDept(req.user, items.map(i => i.equipment_id));
    if (deptErr) return res.status(403).json({ error: deptErr });
  }

  const doReturn = db.transaction(() => {
    const code = nextCode('RETURN', event_id || null, req.user.full_name);
    const txDate = transaction_date ? transaction_date + ' 00:00:00' : null;
    const txR = db.prepare(`
      INSERT INTO transactions (code, type, event_id, responsible_person, notes, transaction_date)
      VALUES (?, 'RETURN', ?, ?, ?, COALESCE(?, datetime('now','localtime')))
    `).run(code, event_id || null, responsible_person, notes, txDate);

    const txId = txR.lastInsertRowid;
    const insertItem = db.prepare(`INSERT INTO transaction_items (transaction_id, equipment_id, quantity, condition, notes) VALUES (?, ?, ?, ?, ?)`);

    for (const item of (items || [])) {
      const qty = parseInt(item.quantity) || 0;
      if (qty <= 0) throw new Error(`Số lượng thiết bị phải lớn hơn 0`);
      const cond = item.condition || 'good';
      insertItem.run(txId, item.equipment_id, qty, cond, item.notes || null);

      if (cond === 'good') {
        db.prepare(`UPDATE equipment SET qty_in_use = MAX(0, qty_in_use - ?), qty_available = qty_available + ? WHERE id = ?`).run(qty, qty, item.equipment_id);
      } else if (cond === 'damaged') {
        db.prepare(`UPDATE equipment SET qty_in_use = MAX(0, qty_in_use - ?), qty_damaged = qty_damaged + ? WHERE id = ?`).run(qty, qty, item.equipment_id);
      } else if (cond === 'maintenance') {
        db.prepare(`UPDATE equipment SET qty_in_use = MAX(0, qty_in_use - ?), qty_maintenance = qty_maintenance + ? WHERE id = ?`).run(qty, qty, item.equipment_id);
      } else if (cond === 'lost') {
        db.prepare(`UPDATE equipment SET qty_in_use = MAX(0, qty_in_use - ?), qty_lost = qty_lost + ? WHERE id = ?`).run(qty, qty, item.equipment_id);
      }
    }

    const insertExt = db.prepare(`INSERT INTO external_items (transaction_id, supplier, name, quantity, notes, unit, rental_days) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const ext of validExt) {
      insertExt.run(txId, ext.supplier || '', ext.name.trim(), ext.quantity || 1, ext.notes || null, ext.unit || 'Cái', ext.rental_days || 1);
    }

    return { id: txId, code };
  });

  try {
    res.json(doReturn());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Nhập thiết bị mới (tăng tồn kho) — items: [{ name, unit, quantity }]
router.post('/intake', canIntake, (req, res) => {
  const { responsible_person, department, intake_date, notes, items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Chưa có thiết bị nào' });
  const validItems = items.filter(i => i.name?.trim() && i.quantity > 0);
  if (!validItems.length) return res.status(400).json({ error: 'Chưa có thiết bị nào hợp lệ' });

  const doIntake = db.transaction(() => {
    const intakeRows = db.prepare(`SELECT code FROM transactions WHERE type = 'INTAKE'`).all();
    const code = findNextSeq(intakeRows, seq => `NHAP-MOI-${String(seq).padStart(3, '0')}`);
    const txR = db.prepare(`
      INSERT INTO transactions (code, type, responsible_person, notes)
      VALUES (?, 'INTAKE', ?, ?)
    `).run(code, responsible_person, [department, notes].filter(Boolean).join(' | '));

    const txId = txR.lastInsertRowid;
    for (const item of validItems) {
      const name = item.name.trim();
      const unit = (item.unit || 'Cái').trim();
      const categoryId = item.category_id ? parseInt(item.category_id) || null : null;

      // Tìm thiết bị theo tên (không phân biệt hoa thường)
      let eq = db.prepare(`SELECT * FROM equipment WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1`).get(name.toLowerCase());

      if (!eq) {
        // Tạo mã theo danh mục nếu có, ngược lại dùng NEW-XXX
        let newCode;
        if (categoryId) {
          const cat = db.prepare('SELECT code FROM categories WHERE id = ?').get(categoryId);
          const prefix = cat ? cat.code : 'NEW';
          const existingCodes = db.prepare(`SELECT code FROM equipment WHERE code LIKE ?`).all(`${prefix}-%`);
          newCode = findNextSeq(existingCodes, seq => `${prefix}-${String(seq).padStart(3, '0')}`);
        } else {
          const newCodes = db.prepare(`SELECT code FROM equipment WHERE code LIKE 'NEW-%'`).all();
          newCode = findNextSeq(newCodes, seq => `NEW-${String(seq).padStart(3, '0')}`);
        }
        const ins = db.prepare(`
          INSERT INTO equipment (code, name, category_id, unit, qty_total, qty_available, qty_in_use, qty_maintenance, qty_damaged, qty_lost)
          VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0)
        `).run(newCode, name, categoryId, unit);
        eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(ins.lastInsertRowid);
      }

      db.prepare(`INSERT INTO transaction_items (transaction_id, equipment_id, quantity, condition) VALUES (?, ?, ?, 'good')`).run(txId, eq.id, item.quantity);
      db.prepare(`UPDATE equipment SET qty_total = qty_total + ?, qty_available = qty_available + ? WHERE id = ?`).run(item.quantity, item.quantity, eq.id);
    }
    return { id: txId, code };
  });

  try { res.json(doIntake()); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Nhập bảo trì → trả lại kho
router.post('/fix', canFix, (req, res) => {
  const { notes, items, responsible_person } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Chưa có thiết bị nào' });

  const doFix = db.transaction(() => {
    const code = nextCode('FIX', items[0]?.equipment_id || null);

    const txR = db.prepare(`INSERT INTO transactions (code, type, notes, responsible_person) VALUES (?, 'FIX', ?, ?)`).run(code, notes, responsible_person || null);
    const txId = txR.lastInsertRowid;

    for (const item of items) {
      const qty = parseInt(item.quantity) || 0;
      if (qty <= 0) throw new Error(`Số lượng thiết bị phải lớn hơn 0`);
      if (item.manual_name) {
        // Nhập thủ công — chỉ ghi nhận, không cập nhật tồn kho
        const unitStr = item.unit ? ` (${item.unit})` : '';
        db.prepare(`INSERT INTO transaction_items (transaction_id, equipment_id, quantity, condition, notes) VALUES (?, NULL, ?, 'good', ?)`).run(txId, qty, `[Thủ công] ${item.manual_name}${unitStr}`);
      } else {
        const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(item.equipment_id);
        if (!eq) throw new Error(`Thiết bị ID ${item.equipment_id} không tồn tại`);
        if (eq.qty_maintenance < qty)
          throw new Error(`${eq.name}: chỉ có ${eq.qty_maintenance} đang bảo trì, không thể nhập ${qty}`);
        db.prepare(`INSERT INTO transaction_items (transaction_id, equipment_id, quantity, condition) VALUES (?, ?, ?, 'good')`).run(txId, item.equipment_id, qty);
        db.prepare(`UPDATE equipment SET qty_maintenance = MAX(0, qty_maintenance - ?), qty_available = qty_available + ? WHERE id = ?`).run(qty, qty, item.equipment_id);
      }
    }

    return { id: txId, code };
  });

  try {
    res.json(doFix());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Chỉnh sửa danh sách thiết bị của phiếu xuất kho tạm (chỉ khi status=pending)
router.put('/:id/items', canTransact, (req, res) => {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Không tìm thấy phiếu' });
  if (tx.type !== 'OUT' || tx.status !== 'pending')
    return res.status(400).json({ error: 'Chỉ có thể chỉnh sửa phiếu xuất kho tạm (chờ xác nhận)' });

  const { items, external_items } = req.body;
  const validExt = (external_items || []).filter(i => i.name?.trim());
  if ((!items || items.length === 0) && validExt.length === 0)
    return res.status(400).json({ error: 'Phiếu phải có ít nhất một thiết bị' });

  if (items?.length) {
    const deptErr = checkDept(req.user, items.map(i => i.equipment_id));
    if (deptErr) return res.status(403).json({ error: deptErr });
  }

  const doUpdate = db.transaction(() => {
    // Xóa items cũ (pending không đụng kho)
    db.prepare('DELETE FROM transaction_items WHERE transaction_id = ?').run(tx.id);
    db.prepare('DELETE FROM external_items WHERE transaction_id = ?').run(tx.id);

    // Thêm items mới (pending: chỉ ghi nhận, không reserve)
    const insertItem = db.prepare(`INSERT INTO transaction_items (transaction_id, equipment_id, quantity, notes) VALUES (?, ?, ?, ?)`);
    for (const item of (items || [])) {
      const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(item.equipment_id);
      if (!eq) throw new Error(`Thiết bị ID ${item.equipment_id} không tồn tại`);
      insertItem.run(tx.id, item.equipment_id, item.quantity, item.notes || null);
    }

    // Thêm external items mới
    const insertExt = db.prepare(`INSERT INTO external_items (transaction_id, supplier, name, quantity, notes, unit, rental_days) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const ext of validExt) {
      insertExt.run(tx.id, ext.supplier || '', ext.name.trim(), ext.quantity || 1, ext.notes || null, ext.unit || 'Cái', ext.rental_days || 1);
    }

    return { ok: true };
  });

  try {
    doUpdate();
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Chỉnh sửa phiếu xuất đã xác nhận (SUPER_ADMIN / DIRECTOR / ACCOUNTING)
router.put('/:id/edit-completed', (req, res, next) => {
  const { role, is_truong_phong } = req.user || {};
  if (['SUPER_ADMIN','DIRECTOR','ACCOUNTING'].includes(role) || is_truong_phong) return next();
  return res.status(403).json({ error: 'Không có quyền chỉnh sửa phiếu xuất đã xác nhận' });
}, (req, res) => {
  const { items, reason } = req.body;
  if (!reason?.trim()) return res.status(400).json({ error: 'Vui lòng nhập lý do chỉnh sửa' });
  if (!items || items.length === 0) return res.status(400).json({ error: 'Phiếu phải có ít nhất một thiết bị' });

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Không tìm thấy phiếu' });
  if (tx.type !== 'OUT' || tx.status !== 'completed')
    return res.status(400).json({ error: 'Chỉ chỉnh sửa được phiếu xuất kho đã xác nhận' });

  const doEdit = db.transaction(() => {
    // Snapshot danh sách cũ
    const oldItems = db.prepare(`
      SELECT ti.equipment_id, ti.quantity, eq.name eq_name, eq.code eq_code, eq.unit
      FROM transaction_items ti JOIN equipment eq ON eq.id = ti.equipment_id
      WHERE ti.transaction_id = ?
    `).all(tx.id);

    // Tổng qty theo equipment_id (cũ vs mới)
    const oldMap = {};
    oldItems.forEach(i => { oldMap[i.equipment_id] = (oldMap[i.equipment_id] || 0) + i.quantity; });
    const newMap = {};
    items.forEach(i => { newMap[i.equipment_id] = (newMap[i.equipment_id] || 0) + (parseInt(i.quantity) || 1); });

    // Cập nhật tồn kho theo diff
    const allIds = new Set([...Object.keys(oldMap), ...Object.keys(newMap)].map(Number));
    for (const eqId of allIds) {
      const oldQty = oldMap[eqId] || 0;
      const newQty = newMap[eqId] || 0;
      const diff   = newQty - oldQty;
      if (diff === 0) continue;
      const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(eqId);
      if (!eq) throw new Error(`Thiết bị ID ${eqId} không tồn tại`);
      if (diff > 0) {
        if (eq.qty_available < diff)
          throw new Error(`${eq.name}: Không đủ tồn kho (còn ${eq.qty_available} ${eq.unit}, cần thêm ${diff})`);
        db.prepare('UPDATE equipment SET qty_in_use = qty_in_use + ?, qty_available = qty_available - ? WHERE id = ?')
          .run(diff, diff, eqId);
      } else {
        const ret = -diff;
        db.prepare('UPDATE equipment SET qty_in_use = MAX(0, qty_in_use - ?), qty_available = qty_available + ? WHERE id = ?')
          .run(ret, ret, eqId);
      }
    }

    // Snapshot danh sách mới (lấy tên từ DB)
    const newItemsSnap = items.map(i => {
      const eq = db.prepare('SELECT name, code, unit FROM equipment WHERE id = ?').get(i.equipment_id);
      return { eq_name: eq?.name || '?', eq_code: eq?.code || '?', quantity: parseInt(i.quantity) || 1, unit: eq?.unit || '' };
    });

    // Thay thế transaction_items
    db.prepare('DELETE FROM transaction_items WHERE transaction_id = ?').run(tx.id);
    const ins = db.prepare('INSERT INTO transaction_items (transaction_id, equipment_id, quantity, condition, notes) VALUES (?, ?, ?, ?, ?)');
    items.forEach(i => ins.run(tx.id, i.equipment_id, parseInt(i.quantity) || 1, i.condition || 'good', i.notes || null));

    // Ghi log
    db.prepare(`
      INSERT INTO transaction_edits (transaction_id, edited_by_id, edited_by_name, reason, items_before, items_after)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tx.id, req.user.id, req.user.full_name, reason.trim(),
      JSON.stringify(oldItems.map(i => ({ eq_name: i.eq_name, eq_code: i.eq_code, quantity: i.quantity, unit: i.unit }))),
      JSON.stringify(newItemsSnap));

    return { ok: true };
  });

  try { res.json(doEdit()); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Xóa phiếu — SUPER_ADMIN hoặc người tạo phiếu
router.delete('/:id', requireRole('SUPER_ADMIN', 'DIRECTOR', 'PRODUCTION', 'ACCOUNTING', 'TECHNICAL', 'ATAS', 'STAGE', 'CSVC'), (req, res) => {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'Không tìm thấy phiếu' });
  const isSuperAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(req.user.role);
  if (!isSuperAdmin && tx.created_by_id !== req.user.id) {
    return res.status(403).json({ error: 'Bạn không có quyền xóa phiếu này' });
  }

  const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(tx.id);

  const doDelete = db.transaction(() => {
    for (const item of items) {
      if (tx.type === 'OUT' && tx.status === 'pending') {
        // Pending không trừ kho trước → xóa xong không cần hoàn lại
      } else if (tx.type === 'OUT') {
        db.prepare('UPDATE equipment SET qty_available = qty_available + ?, qty_in_use = MAX(0, qty_in_use - ?) WHERE id = ?')
          .run(item.quantity, item.quantity, item.equipment_id);
      } else if (tx.type === 'RETURN') {
        const cond = item.condition || 'good';
        if (cond === 'damaged') {
          db.prepare('UPDATE equipment SET qty_damaged = MAX(0, qty_damaged - ?), qty_in_use = qty_in_use + ? WHERE id = ?')
            .run(item.quantity, item.quantity, item.equipment_id);
        } else if (cond === 'maintenance') {
          db.prepare('UPDATE equipment SET qty_maintenance = MAX(0, qty_maintenance - ?), qty_in_use = qty_in_use + ? WHERE id = ?')
            .run(item.quantity, item.quantity, item.equipment_id);
        } else if (cond === 'lost') {
          db.prepare('UPDATE equipment SET qty_lost = MAX(0, qty_lost - ?), qty_in_use = qty_in_use + ? WHERE id = ?')
            .run(item.quantity, item.quantity, item.equipment_id);
        } else {
          db.prepare('UPDATE equipment SET qty_available = MAX(0, qty_available - ?), qty_in_use = qty_in_use + ? WHERE id = ?')
            .run(item.quantity, item.quantity, item.equipment_id);
        }
      } else if (tx.type === 'FIX') {
        db.prepare('UPDATE equipment SET qty_maintenance = qty_maintenance + ?, qty_available = MAX(0, qty_available - ?) WHERE id = ?')
          .run(item.quantity, item.quantity, item.equipment_id);
      } else if (tx.type === 'INTAKE') {
        db.prepare('UPDATE equipment SET qty_total = MAX(0, qty_total - ?), qty_available = MAX(0, qty_available - ?) WHERE id = ?')
          .run(item.quantity, item.quantity, item.equipment_id);
      }
    }
    db.prepare('DELETE FROM transaction_items WHERE transaction_id = ?').run(tx.id);
    db.prepare('DELETE FROM external_items WHERE transaction_id = ?').run(tx.id);
    db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
  });

  try {
    doDelete();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
