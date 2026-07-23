const router = require('express').Router();
const db = require('../database');

// Chi Phí Khôi Minh: tất cả transaction_items từ phiếu OUT
router.get('/khoi-minh', (req, res) => {
  const rows = db.prepare(`
    SELECT
      e.id            AS event_id,
      e.name          AS event_name,
      e.code          AS event_code,
      e.client,
      e.start_date,
      e.filming_date,
      e.filming_dates,
      e.show_date,
      e.show_dates,
      eq.id           AS equipment_id,
      eq.name       AS equipment_name,
      eq.unit,
      c.name        AS category_name,
      ti.quantity,
      COALESCE(CAST(ti.combo AS INTEGER), 0) AS qty_free
    FROM transactions t
    JOIN events e           ON e.id  = t.event_id
    JOIN transaction_items ti ON ti.transaction_id = t.id
    JOIN equipment eq       ON eq.id = ti.equipment_id
    LEFT JOIN categories c  ON c.id  = eq.category_id
    WHERE t.type = 'OUT'
      AND t.deleted_at IS NULL
    ORDER BY e.id DESC, c.name, eq.name
  `).all();
  res.json(rows);
});

// Chi Phí NCC: tất cả external_items từ phiếu OUT
router.get('/ncc', (req, res) => {
  const rows = db.prepare(`
    SELECT
      e.id        AS event_id,
      e.name      AS event_name,
      e.code      AS event_code,
      e.client,
      e.start_date,
      ei.supplier,
      ei.name     AS item_name,
      ei.quantity,
      ei.unit,
      ei.rental_days,
      ei.notes
    FROM transactions t
    JOIN events e          ON e.id = t.event_id
    JOIN external_items ei ON ei.transaction_id = t.id
    WHERE t.type = 'OUT'
      AND t.deleted_at IS NULL
      AND ei.supplier IS NOT NULL
      AND ei.supplier != ''
    ORDER BY e.id DESC, ei.supplier, ei.name
  `).all();
  res.json(rows);
});

module.exports = router;
