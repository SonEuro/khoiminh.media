const router = require('express').Router();
const db = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /api/ncc/catalog — dùng cho ExportForm (tất cả user đã login)
router.get('/catalog', requireAuth, (req, res) => {
  const suppliers = db.prepare(
    'SELECT id, name, dept FROM ncc_suppliers WHERE is_active = 1 ORDER BY sort_order, id'
  ).all();
  const catalog = {};
  const stmt = db.prepare('SELECT name, unit, qty FROM ncc_equipment WHERE supplier_id = ? ORDER BY sort_order, id');
  for (const s of suppliers) {
    catalog[s.name] = stmt.all(s.id);
  }
  res.json({ suppliers, catalog });
});

// ── Admin routes — SUPER_ADMIN only ───────────────────────────────────────────
router.use(requireAuth, requireRole('SUPER_ADMIN'));

// GET /api/ncc — list suppliers với equipment count
router.get('/', (req, res) => {
  const suppliers = db.prepare(`
    SELECT s.*, COUNT(e.id) AS eq_count
    FROM ncc_suppliers s
    LEFT JOIN ncc_equipment e ON e.supplier_id = s.id
    GROUP BY s.id
    ORDER BY s.sort_order, s.id
  `).all();
  res.json(suppliers);
});

// GET /api/ncc/:id — supplier + equipment list
router.get('/:id', (req, res) => {
  const sup = db.prepare('SELECT * FROM ncc_suppliers WHERE id = ?').get(req.params.id);
  if (!sup) return res.status(404).json({ error: 'Không tìm thấy' });
  const equipment = db.prepare(
    'SELECT * FROM ncc_equipment WHERE supplier_id = ? ORDER BY sort_order, id'
  ).all(sup.id);
  res.json({ ...sup, equipment });
});

// POST /api/ncc — tạo NCC mới
router.post('/', (req, res) => {
  const { name, dept } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Tên NCC không được trống' });
  try {
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0) AS m FROM ncc_suppliers').get().m;
    const r = db.prepare('INSERT INTO ncc_suppliers (name, dept, sort_order) VALUES (?, ?, ?)').run(
      name.trim(), dept || null, maxOrder + 1
    );
    res.json({ id: r.lastInsertRowid });
  } catch {
    res.status(400).json({ error: 'Tên NCC đã tồn tại' });
  }
});

// PUT /api/ncc/:id — cập nhật supplier
router.put('/:id', (req, res) => {
  const { name, dept, is_active } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Tên NCC không được trống' });
  try {
    db.prepare('UPDATE ncc_suppliers SET name=?, dept=?, is_active=? WHERE id=?').run(
      name.trim(), dept || null, is_active ? 1 : 0, req.params.id
    );
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'Tên NCC đã tồn tại' });
  }
});

// DELETE /api/ncc/:id — xóa supplier + toàn bộ equipment (CASCADE)
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM ncc_suppliers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/ncc/:id/equipment — thêm thiết bị
router.post('/:id/equipment', (req, res) => {
  const { name, unit, qty } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Tên thiết bị không được trống' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0) AS m FROM ncc_equipment WHERE supplier_id = ?').get(req.params.id).m;
  const r = db.prepare(
    'INSERT INTO ncc_equipment (supplier_id, name, unit, qty, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, name.trim(), unit || 'Cái', parseInt(qty) || 1, maxOrder + 1);
  res.json({ id: r.lastInsertRowid });
});

// PUT /api/ncc/equipment/:id — cập nhật thiết bị
router.put('/equipment/:id', (req, res) => {
  const { name, unit, qty } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Tên thiết bị không được trống' });
  db.prepare('UPDATE ncc_equipment SET name=?, unit=?, qty=? WHERE id=?').run(
    name.trim(), unit || 'Cái', parseInt(qty) || 1, req.params.id
  );
  res.json({ ok: true });
});

// DELETE /api/ncc/equipment/:id — xóa thiết bị
router.delete('/equipment/:id', (req, res) => {
  db.prepare('DELETE FROM ncc_equipment WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
