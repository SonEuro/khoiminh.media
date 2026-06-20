const router = require('express').Router();
const db = require('../database');

router.get('/summary', (req, res) => {
  const totals = db.prepare(`
    SELECT
      SUM(qty_total)       as total_items,
      SUM(qty_available)   as available,
      SUM(qty_in_use)      as in_use,
      SUM(qty_maintenance) as maintenance,
      SUM(qty_damaged)     as damaged,
      SUM(qty_lost)        as lost
    FROM equipment
  `).get();

  const by_category = db.prepare(`
    SELECT c.name, c.code, c.icon,
      SUM(e.qty_total)       as total,
      SUM(e.qty_available)   as available,
      SUM(e.qty_in_use)      as in_use,
      SUM(e.qty_damaged)     as damaged
    FROM equipment e
    JOIN categories c ON c.id = e.category_id
    GROUP BY c.id
    ORDER BY c.name
  `).all();

  const active_events = db.prepare(`
    SELECT e.id, e.code, e.name, e.client, e.start_date, e.end_date,
      (SELECT SUM(ti.quantity) FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.event_id = e.id AND t.type = 'OUT') as qty_out,
      (SELECT SUM(ti.quantity) FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.event_id = e.id AND t.type = 'RETURN') as qty_returned
    FROM events e WHERE e.status IN ('planned','active')
    ORDER BY e.start_date
  `).all();

  const low_stock = db.prepare(`
    SELECT e.code, e.name, e.qty_available, e.unit, c.name as category
    FROM equipment e
    JOIN categories c ON c.id = e.category_id
    WHERE e.qty_available <= 2 AND e.qty_total > 0
    ORDER BY e.qty_available
    LIMIT 10
  `).all();

  const damaged_list = db.prepare(`
    SELECT e.code, e.name, e.qty_damaged, e.qty_lost, e.unit, c.name as category
    FROM equipment e
    JOIN categories c ON c.id = e.category_id
    WHERE e.qty_damaged > 0 OR e.qty_lost > 0
    ORDER BY e.qty_damaged DESC
  `).all();

  const recent_tx = db.prepare(`
    SELECT t.code, t.type, t.transaction_date, t.responsible_person, ev.name as event_name,
      (SELECT COUNT(*) FROM transaction_items ti WHERE ti.transaction_id = t.id) as item_count
    FROM transactions t
    LEFT JOIN events ev ON ev.id = t.event_id
    ORDER BY t.created_at DESC LIMIT 10
  `).all();

  res.json({ totals, by_category, active_events, low_stock, damaged_list, recent_tx });
});

router.get('/inventory', (req, res) => {
  const rows = db.prepare(`
    SELECT e.code, e.name, c.name as category, c.icon, e.unit,
           e.qty_total, e.qty_available, e.qty_in_use,
           e.qty_maintenance, e.qty_damaged, e.qty_lost
    FROM equipment e
    JOIN categories c ON c.id = e.category_id
    ORDER BY c.code, e.code
  `).all();
  res.json(rows);
});

module.exports = router;
