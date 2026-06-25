const router = require('express').Router();
const db = require('../database');
const QRCode = require('qrcode');
const { requireRole } = require('../middleware/auth');

const canEdit      = requireRole('SUPER_ADMIN', 'DIRECTOR', 'PRODUCTION');
const adminOnly    = requireRole('SUPER_ADMIN');
const canDeleteEq  = requireRole('SUPER_ADMIN', 'DIRECTOR');

router.get('/', (req, res) => {
  const { category, search, status } = req.query;
  let sql = `
    SELECT e.*, c.name as category_name, c.code as category_code, c.icon as category_icon
    FROM equipment e
    LEFT JOIN categories c ON c.id = e.category_id
    WHERE 1=1
  `;
  const params = [];
  if (category) { sql += ' AND c.code = ?'; params.push(category); }
  if (search)   { sql += ' AND (e.name LIKE ? OR e.code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (status === 'low')  sql += ' AND e.qty_available <= 2';
  if (status === 'out')  sql += ' AND e.qty_available = 0';
  sql += ' ORDER BY e.code';
  res.json(db.prepare(sql).all(...params));
});

// Tóm tắt toàn kho + top thiết bị nổi bật theo lần sử dụng gần nhất
// Thiết bị đang dùng → sự kiện nào đang giữ
router.get('/in-use-events', (req, res) => {
  const rows = db.prepare(`
    SELECT
      ti.equipment_id,
      ev.id   AS event_id,
      ev.code AS event_code,
      ev.name AS event_name,
      SUM(CASE WHEN t.type = 'OUT'    THEN ti.quantity ELSE 0 END) -
      SUM(CASE WHEN t.type = 'RETURN' THEN ti.quantity ELSE 0 END) AS qty_pending
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN events ev ON ev.id = t.event_id
    WHERE ev.deleted_at IS NULL
    GROUP BY ti.equipment_id, ev.id
    HAVING qty_pending > 0
    ORDER BY ev.name
  `).all();

  // Group by equipment_id → [events]
  const map = {};
  for (const r of rows) {
    if (!map[r.equipment_id]) map[r.equipment_id] = [];
    map[r.equipment_id].push({ event_id: r.event_id, event_code: r.event_code, event_name: r.event_name, qty: r.qty_pending });
  }
  res.json(map);
});

router.get('/reserved-events', (req, res) => {
  const rows = db.prepare(`
    SELECT
      ti.equipment_id,
      ev.id   AS event_id,
      ev.code AS event_code,
      ev.name AS event_name,
      SUM(ti.quantity) AS qty_reserved
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN events ev ON ev.id = t.event_id
    WHERE t.status = 'pending' AND t.type = 'OUT' AND ev.deleted_at IS NULL
    GROUP BY ti.equipment_id, ev.id
    ORDER BY ev.name
  `).all();

  const map = {};
  for (const r of rows) {
    if (!map[r.equipment_id]) map[r.equipment_id] = [];
    map[r.equipment_id].push({ event_id: r.event_id, event_code: r.event_code, event_name: r.event_name, qty: r.qty_reserved });
  }
  res.json(map);
});

router.get('/top-used', (req, res) => {
  const limit = parseInt(req.query.limit) || 5;

  const summary = db.prepare(`
    SELECT
      SUM(qty_total)       AS total,
      SUM(qty_available)   AS available,
      SUM(qty_in_use)      AS in_use,
      SUM(qty_maintenance) AS maintenance,
      SUM(qty_damaged + qty_lost) AS damaged,
      SUM(COALESCE(qty_reserved, 0)) AS reserved
    FROM equipment
  `).get();

  const topUsed = db.prepare(`
    SELECT e.id, e.name, e.code, e.unit,
           c.name AS category_name, c.code AS category_code,
           e.qty_in_use, e.qty_available, e.qty_total,
           MAX(t.transaction_date) AS last_used
    FROM equipment e
    LEFT JOIN categories c ON c.id = e.category_id
    LEFT JOIN transaction_items ti ON ti.equipment_id = e.id
    LEFT JOIN transactions t ON t.id = ti.transaction_id AND t.type = 'OUT'
    GROUP BY e.id
    ORDER BY last_used DESC, e.qty_in_use DESC
    LIMIT ?
  `).all(limit);

  res.json({ summary, topUsed });
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT e.*, c.name as category_name, c.code as category_code, c.icon as category_icon
    FROM equipment e LEFT JOIN categories c ON c.id = e.category_id
    WHERE e.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy' });
  res.json(row);
});

router.get('/:id/qr', async (req, res) => {
  const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
  if (!eq) return res.status(404).json({ error: 'Không tìm thấy' });
  const url = await QRCode.toDataURL(`EQUIP:${eq.code}:${eq.id}`);
  res.json({ code: eq.code, qr: url });
});

router.get('/:id/history', (req, res) => {
  const rows = db.prepare(`
    SELECT t.code as tx_code, t.type, t.transaction_date, t.responsible_person,
           ev.name as event_name, ti.quantity, ti.condition, ti.notes as item_notes
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    LEFT JOIN events ev ON ev.id = t.event_id
    WHERE ti.equipment_id = ?
    ORDER BY t.transaction_date DESC
    LIMIT 50
  `).all(req.params.id);
  res.json(rows);
});

router.post('/', canEdit, (req, res) => {
  const { code, name, category_id, unit, unit_price, qty_total, notes } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'code và name là bắt buộc' });
  try {
    const qty = qty_total || 0;
    const r = db.prepare(`
      INSERT INTO equipment (code, name, category_id, unit, unit_price, qty_total, qty_available, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, name, category_id, unit || 'Cái', unit_price || 0, qty, qty, notes || null);
    res.json({ id: r.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Mã thiết bị đã tồn tại' });
  }
});

router.put('/:id', canEdit, (req, res) => {
  const { name, category_id, unit, unit_price, notes } = req.body;
  db.prepare(`
    UPDATE equipment SET name=?, category_id=?, unit=?, unit_price=?, notes=? WHERE id=?
  `).run(name, category_id, unit, unit_price, notes, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', canDeleteEq, (req, res) => {
  const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
  if (!eq) return res.status(404).json({ error: 'Không tìm thấy' });
  if (eq.qty_in_use > 0) return res.status(400).json({ error: 'Thiết bị đang được sử dụng, không thể xóa' });
  db.prepare('DELETE FROM equipment WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
