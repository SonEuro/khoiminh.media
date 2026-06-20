const router = require('express').Router();
const db = require('../database');
const QRCode = require('qrcode');
const { requireRole } = require('../middleware/auth');

const canEdit   = requireRole('SUPER_ADMIN', 'PRODUCTION');
const adminOnly = requireRole('SUPER_ADMIN');

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

router.delete('/:id', adminOnly, (req, res) => {
  const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
  if (!eq) return res.status(404).json({ error: 'Không tìm thấy' });
  if (eq.qty_in_use > 0) return res.status(400).json({ error: 'Thiết bị đang được sử dụng, không thể xóa' });
  db.prepare('DELETE FROM equipment WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
