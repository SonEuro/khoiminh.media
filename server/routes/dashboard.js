const router = require('express').Router();
const db = require('../database');

function parseDateField(val) {
  if (!val) return [];
  if (val.startsWith('[')) { try { return JSON.parse(val); } catch { return []; } }
  return [val];
}

function extractKmNames(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter(n => typeof n === 'string' && n);
    if (v && typeof v === 'object') return Object.values(v).flat().filter(n => typeof n === 'string' && n);
  } catch {}
  return [];
}

function extractFreelancerNames(raw, dateSet) {
  if (!raw) return [];
  try {
    if (raw.startsWith('{')) {
      const v = JSON.parse(raw);
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const names = new Set();
        const firstVal = Object.values(v)[0];
        for (const [date, val] of Object.entries(v)) {
          if (dateSet && !dateSet.has(date)) continue;
          if (firstVal && typeof firstVal === 'object') {
            Object.values(val || {}).forEach(s =>
              (s || '').split(',').map(n => n.trim()).filter(Boolean).forEach(n => names.add(n))
            );
          } else {
            (val || '').split(',').map(n => n.trim()).filter(Boolean).forEach(n => names.add(n));
          }
        }
        return [...names];
      }
    }
  } catch {}
  return raw.split(',').map(n => n.trim()).filter(Boolean);
}

function extractKmByDept(raw) {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) {
      const names = v.filter(n => typeof n === 'string' && n);
      return names.length ? { '': names } : {};
    }
    if (v && typeof v === 'object') {
      const result = {};
      for (const [dept, names] of Object.entries(v)) {
        const flat = Array.isArray(names) ? names.filter(n => typeof n === 'string' && n) : [];
        if (flat.length) result[dept] = flat;
      }
      return result;
    }
  } catch {}
  return {};
}

// Trích xuất km_staff cho đúng ngày — xử lý cả dạng date-indexed {date: [names]}/{date: {dept: [names]}} lẫn dept-indexed {dept: [names]}
function extractKmByDeptForDate(raw, date) {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) {
      const names = v.filter(n => typeof n === 'string' && n);
      return names.length ? { '': names } : {};
    }
    if (v && typeof v === 'object') {
      const firstKey = Object.keys(v)[0] || '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(firstKey)) {
        // Date-indexed — chỉ lấy đúng ngày cần
        const dateVal = v[date];
        if (!dateVal) return {};
        if (Array.isArray(dateVal)) {
          const names = dateVal.filter(n => typeof n === 'string' && n);
          return names.length ? { '': names } : {};
        }
        if (typeof dateVal === 'object') {
          const result = {};
          for (const [dept, names] of Object.entries(dateVal)) {
            const flat = Array.isArray(names) ? names.filter(n => typeof n === 'string' && n) : [];
            if (flat.length) result[dept] = flat;
          }
          return result;
        }
        return {};
      }
      // Dept-indexed
      const result = {};
      for (const [dept, names] of Object.entries(v)) {
        const flat = Array.isArray(names) ? names.filter(n => typeof n === 'string' && n) : [];
        if (flat.length) result[dept] = flat;
      }
      return result;
    }
  } catch {}
  return {};
}

// Ngày hiển thị (filming + show) — dùng cho label trên card
const getFilmingDates = (ev) => {
  let dates = [];
  try { dates = JSON.parse(ev.filming_dates || '[]'); } catch {}
  if (ev.filming_date) dates.push(ev.filming_date);
  if (ev.show_date)    dates.push(ev.show_date);
  return [...new Set(dates.filter(Boolean))].sort();
};

// Tất cả ngày từ sự kiện — nguồn duy nhất cho zone/filter
const getAllEventDates = (ev) => {
  const s = new Set();
  for (const [plural, singular] of [
    ['start_dates','start_date'], ['end_dates','end_date'],
    ['filming_dates','filming_date'], ['show_dates','show_date'],
  ]) {
    try { for (const d of JSON.parse(ev[plural] || '[]')) if (d) s.add(d); } catch {}
    if (ev[singular]) s.add(ev[singular]);
  }
  return [...s].sort();
};

// Kiểm tra sự kiện có ngày d không (bao gồm range check cho sự kiện liên tục)
const isEventOnDate = (ev, d) => {
  if (getAllEventDates(ev).includes(d)) return true;
  let starts = [], ends = [];
  try { starts = JSON.parse(ev.start_dates || '[]').filter(Boolean); } catch {}
  if (!starts.length && ev.start_date) starts = [ev.start_date];
  try { ends = JSON.parse(ev.end_dates || '[]').filter(Boolean); } catch {}
  if (!ends.length && ev.end_date) ends = [ev.end_date];
  return starts.length === 1 && ends.length === 1 && starts[0] <= d && d <= ends[0];
};

router.get('/', (req, res) => {
  const today = db.prepare("SELECT date('now','localtime') AS d").get().d;

  // All active events
  const allEvents = db.prepare(`
    SELECT * FROM events
    WHERE archived_at IS NULL AND deleted_at IS NULL
    ORDER BY start_date
  `).all();

  // 1. Events with operations today — chỉ dùng ngày trên sự kiện
  const todayEvents = allEvents.filter(ev => {
    if (ev.status === 'cancelled') return false;
    return isEventOnDate(ev, today);
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

  // 4. Conflict detection: dynamic inventory per date
  const upcomingEvents = allEvents.filter(ev => {
    const dates = getAllEventDates(ev);
    if (dates.some(d => d >= today)) return true;
    // Range event đang diễn ra (start đã qua, end chưa tới)
    let starts = [], ends = [];
    try { starts = JSON.parse(ev.start_dates || '[]').filter(Boolean); } catch {}
    if (!starts.length && ev.start_date) starts = [ev.start_date];
    try { ends = JSON.parse(ev.end_dates || '[]').filter(Boolean); } catch {}
    if (!ends.length && ev.end_date) ends = [ev.end_date];
    return starts.length === 1 && ends.length === 1 && ends[0] >= today;
  });

  const upcomingIds = upcomingEvents.map(ev => ev.id);
  const upcomingIdsStr = upcomingIds.length > 0 ? upcomingIds.join(',') : '-1';

  // Step 1: Build map of upcoming event needs per (date, equipment)
  const dateEquipMap = {};
  for (const ev of upcomingEvents) {
    const futureDates = getAllEventDates(ev).filter(d => d >= today);
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
            held_by_others: 0,
            events: [],
          };
        }
        const existing = dateEquipMap[key].events.find(e => e.id === ev.id);
        if (!existing) dateEquipMap[key].events.push({ id: ev.id, name: ev.name, code: ev.code, qty: item.qty });
      }
    }
  }

  // Step 2: For each unique date, find qty held by non-upcoming events (filmed already, not yet returned)
  const uniqueDates = [...new Set(Object.values(dateEquipMap).map(c => c.date))];
  for (const d of uniqueDates) {
    const heldByOthers = db.prepare(`
      SELECT ti.equipment_id,
        SUM(CASE WHEN t.type='OUT'    THEN ti.quantity ELSE 0 END) -
        SUM(CASE WHEN t.type='RETURN' THEN ti.quantity ELSE 0 END) AS qty
      FROM transactions t
      JOIN transaction_items ti ON ti.transaction_id = t.id
      JOIN events e ON e.id = t.event_id
      WHERE t.status IN ('pending', 'completed')
        AND e.archived_at IS NULL AND e.deleted_at IS NULL
        AND t.event_id NOT IN (${upcomingIdsStr})
        AND t.event_id IN (
          SELECT DISTINCT event_id FROM transactions
          WHERE type = 'OUT' AND status IN ('pending','completed')
            AND expected_return_date IS NOT NULL AND expected_return_date >= ?
        )
      GROUP BY ti.equipment_id
      HAVING qty > 0
    `).all(d);

    for (const held of heldByOthers) {
      const key = `${d}_${held.equipment_id}`;
      if (dateEquipMap[key]) {
        dateEquipMap[key].held_by_others += held.qty;
      }
    }
  }

  // Step 3: Conflict = ≥2 upcoming events competing AND total exceeds dynamic available
  const conflicts = Object.values(dateEquipMap)
    .filter(c => {
      if (c.events.length < 2) return false;
      const total = c.events.reduce((s, e) => s + e.qty, 0);
      const effective = Math.max(0, c.qty_available - c.held_by_others);
      return total > effective;
    })
    .map(c => ({ ...c, effective_available: Math.max(0, c.qty_available - c.held_by_others) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const tomorrow = db.prepare("SELECT date('now','+1 day','localtime') AS d").get().d;
  const tomorrowEvents = allEvents.filter(ev => {
    if (ev.status === 'cancelled') return false;
    return isEventOnDate(ev, tomorrow);
  }).map(ev => ({
    id: ev.id, name: ev.name, code: ev.code, status: ev.status,
    start_date: ev.start_date, end_date: ev.end_date,
    filming_dates: getFilmingDates(ev), client: ev.client, location: ev.location,
  }));

  // Build schedule_days: 7 ngày tới, mỗi ngày có events + staff
  function isoAddDays(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  }
  const nextDates = Array.from({ length: 7 }, (_, i) => isoAddDays(today, i));
  const nextDatesSet = new Set(nextDates);

  const SCHED_PHASES = ['setup', 'teardown', 'rehearsal', 'filming'];
  const workScheds = db.prepare(`
    SELECT event_id,
      setup_date, teardown_date, rehearsal_date, filming_date,
      setup_km_staff, teardown_km_staff, rehearsal_km_staff, filming_km_staff,
      setup_freelancers, teardown_freelancers, rehearsal_freelancers, filming_freelancers,
      setup_start_times, teardown_start_times, rehearsal_start_times, filming_start_times,
      setup_km_support, teardown_km_support, rehearsal_km_support, filming_km_support
    FROM work_schedules WHERE deleted_at IS NULL AND event_id IS NOT NULL
  `).all();

  function initEntry() { return { km: new Set(), free: new Set(), kmByDept: {}, support: {}, startTime: null }; }
  function mergeByDept(byDept, incoming) {
    for (const [dept, names] of Object.entries(incoming)) {
      if (!byDept[dept]) byDept[dept] = new Set();
      names.forEach(n => byDept[dept].add(n));
    }
  }
  function serializeEntry(st) {
    const kmByDept = {};
    for (const [dept, s] of Object.entries(st?.kmByDept || {})) kmByDept[dept] = [...s];
    return {
      km_staff: [...(st?.km || [])],
      km_staff_by_dept: kmByDept,
      km_support: st?.support || {},
      freelancers: [...(st?.free || [])],
      start_time: st?.startTime || null,
    };
  }

  // staffByDateEvent: key = "YYYY-MM-DD::eventId"
  const staffByDateEvent = {};
  for (const ws of workScheds) {
    const eid = ws.event_id;
    for (const p of SCHED_PHASES) {
      const dates = parseDateField(ws[`${p}_date`]);
      for (const date of dates) {
        if (!nextDatesSet.has(date)) continue;
        const key = `${date}::${eid}`;
        if (!staffByDateEvent[key]) staffByDateEvent[key] = initEntry();
        const entry = staffByDateEvent[key];
        const byDept = extractKmByDeptForDate(ws[`${p}_km_staff`], date);
        Object.values(byDept).flat().forEach(n => entry.km.add(n));
        mergeByDept(entry.kmByDept, byDept);
        extractFreelancerNames(ws[`${p}_freelancers`], new Set([date])).forEach(n => entry.free.add(n));
        let stMap = {};
        try { stMap = JSON.parse(ws[`${p}_start_times`] || '{}'); } catch {}
        if (!entry.startTime && typeof stMap[date] === 'string') entry.startTime = stMap[date];
        let supMap = {};
        try { supMap = JSON.parse(ws[`${p}_km_support`] || '{}'); } catch {}
        const sup = supMap[date];
        if (sup && typeof sup === 'object' && !Array.isArray(sup)) Object.assign(entry.support, sup);
      }
    }
  }

  const scheduleDays = nextDates.map(date => {
    const dayEvents = allEvents.filter(ev => {
      if (ev.status === 'cancelled') return false;
      return isEventOnDate(ev, date);
    }).map(ev => ({
      id: ev.id, name: ev.name, code: ev.code, status: ev.status,
      client: ev.client, location: ev.location,
      ...serializeEntry(staffByDateEvent[`${date}::${ev.id}`]),
    }));
    return { date, events: dayEvents };
  }).filter(d => d.events.length > 0);

  res.json({ today, tomorrow, today_events: todayEvents, tomorrow_events: tomorrowEvents,
    schedule_days: scheduleDays, need_confirm: needConfirm, overdue, conflicts });
});

module.exports = router;
