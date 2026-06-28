const router = require('express').Router();
const db = require('../database');

const getFilmingDates = (ev) => {
  let dates = [];
  try { dates = JSON.parse(ev.filming_dates || '[]'); } catch {}
  if (ev.filming_date) dates.push(ev.filming_date);
  if (ev.show_date)    dates.push(ev.show_date);
  return [...new Set(dates.filter(Boolean))].sort();
};

router.get('/', (req, res) => {
  const today = db.prepare("SELECT date('now','localtime') AS d").get().d;

  // All active events
  const allEvents = db.prepare(`
    SELECT * FROM events
    WHERE archived_at IS NULL AND deleted_at IS NULL
    ORDER BY start_date
  `).all();

  // 1. Events filming today or spanning today
  const todayEvents = allEvents.filter(ev => {
    const dates = getFilmingDates(ev);
    if (dates.includes(today)) return true;
    if (ev.start_date && ev.start_date <= today && (!ev.end_date || ev.end_date >= today)) return true;
    return false;
  }).map(ev => ({
    id: ev.id, name: ev.name, code: ev.code, status: ev.status,
    start_date: ev.start_date, end_date: ev.end_date,
    filming_dates: getFilmingDates(ev), client: ev.client, location: ev.location,
  }));

  // 2. Pending OUTs where filming date <= today (need to be confirmed now)
  const pendingTxs = db.prepare(`
    SELECT t.id, t.code, t.event_id, t.created_at,
      e.name AS event_name, e.code AS event_code,
      e.filming_date, e.filming_dates, e.show_date, e.start_date,
      COUNT(ti.id) AS item_count
    FROM transactions t
    JOIN events e ON e.id = t.event_id
    JOIN transaction_items ti ON ti.transaction_id = t.id
    WHERE t.type = 'OUT' AND t.status = 'pending'
      AND e.archived_at IS NULL AND e.deleted_at IS NULL
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all();

  const needConfirm = pendingTxs.filter(tx => {
    const dates = getFilmingDates(tx).sort();
    return dates.length > 0 && dates[0] <= today;
  });

  // 3. Overdue returns: OUT completed where expected_return_date < today AND event still has outstanding items
  const overdue = db.prepare(`
    SELECT DISTINCT t.id, t.code, t.event_id, t.expected_return_date, t.created_at,
      e.name AS event_name, e.code AS event_code
    FROM transactions t
    JOIN events e ON e.id = t.event_id
    WHERE t.type = 'OUT' AND t.status = 'completed'
      AND t.expected_return_date IS NOT NULL
      AND t.expected_return_date < ?
      AND e.archived_at IS NULL AND e.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM transaction_items ti
        WHERE ti.transaction_id = t.id
          AND ti.quantity > COALESCE((
            SELECT SUM(ti2.quantity)
            FROM transaction_items ti2
            JOIN transactions t2 ON t2.id = ti2.transaction_id
            WHERE t2.event_id = t.event_id AND t2.type = 'RETURN'
              AND ti2.equipment_id = ti.equipment_id
          ), 0)
      )
    ORDER BY t.expected_return_date ASC
  `).all(today);

  // 4. Conflict detection: upcoming events on same filming date sharing equipment
  const upcomingEvents = allEvents.filter(ev => {
    const dates = getFilmingDates(ev);
    return dates.some(d => d >= today);
  });

  const dateEquipMap = {};
  for (const ev of upcomingEvents) {
    const futureDates = getFilmingDates(ev).filter(d => d >= today);
    if (!futureDates.length) continue;

    const items = db.prepare(`
      SELECT ti.equipment_id, eq.name AS eq_name, eq.unit, eq.qty_available,
        SUM(CASE WHEN t.type='OUT'    THEN ti.quantity ELSE 0 END) -
        SUM(CASE WHEN t.type='RETURN' THEN ti.quantity ELSE 0 END) AS qty
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      JOIN equipment eq ON eq.id = ti.equipment_id
      WHERE t.event_id = ? AND t.status IN ('pending', 'completed')
      GROUP BY ti.equipment_id
      HAVING qty > 0
    `).all(ev.id);

    for (const item of items) {
      for (const d of futureDates) {
        const key = `${d}_${item.equipment_id}`;
        if (!dateEquipMap[key]) {
          dateEquipMap[key] = {
            date: d,
            equipment_id: item.equipment_id,
            eq_name: item.eq_name,
            unit: item.unit,
            qty_available: item.qty_available,
            events: [],
          };
        }
        const existing = dateEquipMap[key].events.find(e => e.id === ev.id);
        if (!existing) dateEquipMap[key].events.push({ id: ev.id, name: ev.name, code: ev.code, qty: item.qty });
      }
    }
  }

  const conflicts = Object.values(dateEquipMap)
    .filter(c => {
      if (c.events.length < 2) return false;
      const total = c.events.reduce((s, e) => s + e.qty, 0);
      return total > c.qty_available;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json({ today, today_events: todayEvents, need_confirm: needConfirm, overdue, conflicts });
});

module.exports = router;
