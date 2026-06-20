const router = require('express').Router();
const db = require('../database');

function nextCode() {
  const last = db.prepare("SELECT code FROM events ORDER BY id DESC LIMIT 1").get();
  if (!last) return 'EVENT-001';
  const num = parseInt(last.code.split('-')[1]) + 1;
  return `EVENT-${String(num).padStart(3, '0')}`;
}

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT e.*,
      (SELECT COUNT(*) FROM transactions t WHERE t.event_id = e.id) as tx_count
    FROM events e WHERE 1=1
  `;
  const params = [];
  if (status) { sql += ' AND e.status = ?'; params.push(status); }
  sql += ' ORDER BY e.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Không tìm thấy' });

  const items = db.prepare(`
    SELECT ti.equipment_id, e.code as eq_code, e.name as eq_name, e.unit,
           SUM(CASE WHEN t.type = 'OUT' THEN ti.quantity ELSE 0 END) as qty_out,
           SUM(CASE WHEN t.type = 'RETURN' THEN ti.quantity ELSE 0 END) as qty_returned
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN equipment e ON e.id = ti.equipment_id
    WHERE t.event_id = ?
    GROUP BY ti.equipment_id
  `).all(req.params.id);

  res.json({ ...ev, items });
});

router.post('/', (req, res) => {
  const { name, client, location, start_date, end_date, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên sự kiện là bắt buộc' });
  const code = nextCode();
  const r = db.prepare(`
    INSERT INTO events (code, name, client, location, start_date, end_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(code, name, client, location, start_date, end_date, notes);
  res.json({ id: r.lastInsertRowid, code });
});

router.put('/:id', (req, res) => {
  const { name, client, location, start_date, end_date, status, notes } = req.body;
  db.prepare(`
    UPDATE events SET name=?, client=?, location=?, start_date=?, end_date=?, status=?, notes=? WHERE id=?
  `).run(name, client, location, start_date, end_date, status, notes, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const txCount = db.prepare('SELECT COUNT(*) as c FROM transactions WHERE event_id = ?').get(req.params.id);
  if (txCount.c > 0) return res.status(400).json({ error: 'Sự kiện đã có phiếu xuất/nhập, không thể xóa' });
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
