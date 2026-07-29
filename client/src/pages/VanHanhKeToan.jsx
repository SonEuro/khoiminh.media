import { useState, useEffect, useMemo } from 'react';
import { Calculator, Package, Truck, Search, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { api } from '../api';

const GOLD = '#c9a84c';
const safeName = s => (s || '').replace(/[/\\:*?"<>|]/g, '-').trim();

function fmtDate(d) {
  if (!d) return '';
  const p = d.slice(0, 10).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

function parseDatesArr(multi, single) {
  if (multi) {
    try { const v = JSON.parse(multi); if (Array.isArray(v)) return v.filter(Boolean); } catch {}
  }
  if (single && single.trim()) return [single.trim()];
  return [];
}

function calcNgay(row) {
  const film = parseDatesArr(row.filming_dates, row.filming_date);
  const show = parseDatesArr(row.show_dates, row.show_date);
  return film.length * 1 + show.length * 0.5;
}

const BORDER_THIN = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

function applyBorders(ws) {
  ws.eachRow(row => row.eachCell(cell => { cell.border = BORDER_THIN; }));
}

function isMonthArchived(ym) {
  if (!ym || ym === '0000-00') return false;
  const [y, m] = ym.split('-').map(Number);
  const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const [ty, tm, td] = todayVN.split('-').map(Number);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  if (nextY < ty) return true;
  if (nextY > ty) return false;
  if (nextM < tm) return true;
  if (nextM > tm) return false;
  return td >= 8;
}

function groupByMonth(events) {
  const tryKey = s => { const k = (s || '').slice(0, 7); return /^\d{4}-\d{2}$/.test(k) ? k : null; };
  const tryJsonKey = s => { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) && v.length ? tryKey(v[0]) : null; } catch { return null; } };
  const map = {};
  for (const ev of events) {
    const key = tryKey(ev.group_date) || tryKey(ev.start_date) || tryKey(ev.filming_date) || tryJsonKey(ev.filming_dates) || tryJsonKey(ev.start_dates) || '0000-00';
    if (!map[key]) {
      const [y, m] = key.split('-');
      map[key] = { key, label: key === '0000-00' ? 'Không rõ ngày' : `Tháng ${parseInt(m)}/${y}`, evs: [] };
    }
    map[key].evs.push(ev);
  }
  return Object.values(map)
    .sort((a, b) => b.key.localeCompare(a.key))
    .map(g => ({ ...g, evs: g.evs.sort((a, b) => (b.group_date || b.start_date || '').localeCompare(a.group_date || a.start_date || '') || b.event_id - a.event_id) }));
}

// ── Tab Chi Phí Khôi Minh ─────────────────────────────────
function KhoiMinhTab() {
  const [rows, setRows]           = useState([]);
  const [nccRows, setNccRows]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => {
    Promise.all([api.getKeToanKhoiMinh(), api.getKeToanNcc()])
      .then(([km, ncc]) => { setRows(km); setNccRows(ncc); })
      .finally(() => setLoading(false));
  }, []);

  const events = useMemo(() => {
    const evMap = {};

    // Phase 1: KhoiMinh items grouped by equipment_id
    for (const row of rows) {
      if (!evMap[row.event_id]) {
        evMap[row.event_id] = { event_id: row.event_id, event_name: row.event_name, event_code: row.event_code, client: row.client, start_date: row.start_date, group_date: row.group_date, filming_date: row.filming_date, filming_dates: row.filming_dates, ngay_count: calcNgay(row), byId: {} };
      }
      const { byId } = evMap[row.event_id];
      if (!byId[row.equipment_id]) {
        byId[row.equipment_id] = { name: row.equipment_name, unit: row.unit, qty_total: 0, qty_free: 0 };
      }
      byId[row.equipment_id].qty_total += row.quantity;
      byId[row.equipment_id].qty_free  += row.qty_free;
    }

    // Phase 2: merge NCC items by name
    for (const row of nccRows) {
      if (!evMap[row.event_id]) continue;
      const { byId } = evMap[row.event_id];
      const key = `ncc__${row.item_name}`;
      if (!byId[key]) byId[key] = { name: row.item_name, unit: row.unit || 'Cái', qty_total: 0, qty_free: 0 };
      byId[key].qty_total += row.quantity;
    }

    // Phase 3: collapse by name, then build final list
    return Object.values(evMap).map(ev => {
      const byName = {};
      for (const it of Object.values(ev.byId)) {
        if (!byName[it.name]) byName[it.name] = { name: it.name, unit: it.unit, qty_total: 0, qty_free: 0 };
        byName[it.name].qty_total += it.qty_total;
        byName[it.name].qty_free  += it.qty_free;
      }
      const items = Object.values(byName)
        .map(it => ({ ...it, qty_billed: it.qty_total - it.qty_free }))
        .filter(it => it.qty_billed > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      return { event_id: ev.event_id, event_name: ev.event_name, client: ev.client, start_date: ev.start_date, group_date: ev.group_date, ngay_count: ev.ngay_count, items };
    }).filter(ev => ev.items.length > 0);
  }, [rows, nccRows]);

  const filtered = useMemo(() => {
    if (!search.trim()) return events;
    const q = search.toLowerCase();
    return events.filter(ev =>
      ev.event_name.toLowerCase().includes(q) ||
      (ev.client || '').toLowerCase().includes(q) ||
      (ev.event_code || '').toLowerCase().includes(q)
    );
  }, [events, search]);

  const byMonth = useMemo(() => groupByMonth(filtered), [filtered]);

  const exportExcel = async (evList, filename) => {
    try {
      const { default: ExcelJS } = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Chi Phí Nghiệm Thu');
      ws.columns = [
        { header: 'STT',          key: 'stt',            width: 6  },
        { header: 'Thiết Bị',     key: 'equipment_name', width: 36 },
        { header: 'ĐVT',          key: 'unit',           width: 8  },
        { header: 'SL Xuất',      key: 'qty_total',      width: 10 },
        { header: 'FREE',         key: 'qty_free',       width: 8  },
        { header: 'SL Tính Tiền', key: 'qty_billed',     width: 13 },
        { header: 'Số Ngày',      key: 'ngay_count',     width: 10 },
      ];
      let stt = 0;
      for (const ev of evList) {
        for (const it of ev.items) {
          stt++;
          ws.addRow({ stt, equipment_name: it.name, unit: it.unit, qty_total: it.qty_total, qty_free: it.qty_free || '', qty_billed: it.qty_billed, ngay_count: ev.ngay_count || '' });
        }
      }
      ws.eachRow((row, n) => {
        row.eachCell({ includeEmpty: true }, cell => {
          cell.border = BORDER_THIN;
          if (n === 1) {
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: cell.col === 2 ? 'left' : 'center', vertical: 'middle' };
          }
        });
      });
      const buf  = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Lỗi xuất Excel: ' + e.message); }
  };

  if (loading) return <p style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Đang tải...</p>;
  if (!events.length) return <p style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Chưa có dữ liệu phiếu xuất</p>;

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: '14px' }}>
        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#7878a0' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm sự kiện, khách hàng..."
          style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: '8px', border: '1px solid rgba(120,120,160,0.2)', background: 'rgba(255,255,255,0.04)', color: '#c0c0d8', fontSize: '0.83rem', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <p style={{ fontSize: '0.79rem', color: '#5a5a80', marginBottom: '10px' }}>
        {filtered.length} sự kiện{search.trim() ? ` / ${events.length}` : ''}
      </p>
      {(() => {
        const activeMonths   = byMonth.filter(g => !isMonthArchived(g.key));
        const archivedMonths = byMonth.filter(g => isMonthArchived(g.key));
        const renderMonthGroup = ({ label, evs: monthEvs, archived }) => (
          <div key={label} style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: archived ? '#94a3b8' : GOLD, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
              <span style={{ fontSize: '0.75rem', color: '#5a5a80' }}>· {monthEvs.length} sự kiện</span>
              <div style={{ flex: 1, height: '1px', background: archived ? 'rgba(148,163,184,0.15)' : 'rgba(201,168,76,0.15)' }} />
            </div>
            {monthEvs.map(ev => {
              const isExp = expandedId === ev.event_id;
              return (
                <div key={ev.event_id} style={{ marginBottom: '8px', borderRadius: '10px', border: '1px solid rgba(120,120,160,0.15)', overflow: 'hidden' }}>
                  <div onClick={() => setExpandedId(isExp ? null : ev.event_id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', userSelect: 'none' }}>
                    {isExp ? <ChevronDown size={14} style={{ color: GOLD, flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#5a5a80', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, color: GOLD, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.event_name}</p>
                      <p style={{ margin: 0, fontSize: '0.76rem', color: '#7878a0', marginTop: '2px' }}>
                        {[ev.client, fmtDate(ev.start_date)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.74rem', color: '#5a5a80', minWidth: '56px', textAlign: 'right' }}>{ev.items.length} thiết bị</span>
                      <button onClick={e => { e.stopPropagation(); exportExcel([ev], `Chi Phí Nghiệm Thu - ${safeName(ev.event_name)}.xlsx`); }}
                        title="Xuất Excel sự kiện này"
                        style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.07)', color: GOLD, cursor: 'pointer', gap: '4px' }}>
                        <Download size={12} />
                      </button>
                    </div>
                  </div>
                  {isExp && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(120,120,160,0.12)' }}>
                            {['STT','Thiết Bị','ĐVT','SL Xuất','FREE','SL Tính Tiền'].map(h => (
                              <th key={h} style={{ padding: '7px 10px', textAlign: ['STT','SL Xuất','FREE','SL Tính Tiền'].includes(h) ? 'center' : 'left', color: '#9090a8', fontWeight: 700, fontSize: '0.74rem', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ev.items.map((it, idx) => (
                            <tr key={it.name} style={{ borderBottom: '1px solid rgba(120,120,160,0.07)', background: idx % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                              <td style={{ padding: '6px 10px', textAlign: 'center', color: '#5a5a80' }}>{idx + 1}</td>
                              <td style={{ padding: '6px 10px', color: '#c0c0d8', fontWeight: 600 }}>{it.name}</td>
                              <td style={{ padding: '6px 10px', color: '#9090a8' }}>{it.unit}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'center', color: '#c0c0d8' }}>{it.qty_total}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'center', color: it.qty_free > 0 ? '#a78bfa' : '#3a3a50' }}>{it.qty_free > 0 ? it.qty_free : '—'}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'center', color: GOLD, fontWeight: 700 }}>{it.qty_billed}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
        return (
          <>
            {activeMonths.map(g => renderMonthGroup({ ...g, archived: false }))}
            {archivedMonths.length > 0 && (
              <div style={{ marginTop: '8px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(148,163,184,0.2)' }}>
                <div onClick={() => setArchiveOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', background: 'rgba(148,163,184,0.07)', borderLeft: '3px solid #94a3b8', cursor: 'pointer', userSelect: 'none' }}>
                  <span style={{ fontSize: '1rem' }}>📦</span>
                  <span style={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.84rem', flex: 1, letterSpacing: '0.04em' }}>LƯU TRỮ</span>
                  <span style={{ fontSize: '0.78rem', color: '#5a6a80', background: 'rgba(148,163,184,0.15)', borderRadius: '9999px', padding: '1px 8px', fontWeight: 700 }}>{archivedMonths.reduce((s, g) => s + g.evs.length, 0)} sự kiện</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.78rem', transition: 'transform 0.15s', display: 'inline-block', transform: archiveOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                </div>
                {archiveOpen && (
                  <div style={{ padding: '12px 14px', background: 'rgba(10,10,20,0.4)' }}>
                    {archivedMonths.map(g => renderMonthGroup({ ...g, archived: true }))}
                  </div>
                )}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

// ── Tab Chi Phí NCC ───────────────────────────────────────
function NccTab() {
  const [rows, setRows]                   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedNcc, setSelectedNcc]     = useState('');
  const [expandedId, setExpandedId]       = useState(null);
  const [archiveOpen, setArchiveOpen]     = useState(false);

  useEffect(() => {
    api.getKeToanNcc().then(setRows).finally(() => setLoading(false));
  }, []);

  const allEvents = useMemo(() => {
    const map = {};
    for (const r of rows) {
      if (!map[r.event_id]) map[r.event_id] = { event_id: r.event_id, event_name: r.event_name };
    }
    return Object.values(map).sort((a, b) => b.event_id - a.event_id);
  }, [rows]);

  const suppliers = useMemo(() => {
    const relevant = selectedEventId ? rows.filter(r => r.event_id === Number(selectedEventId)) : rows;
    return [...new Set(relevant.map(r => r.supplier).filter(Boolean))].sort();
  }, [rows, selectedEventId]);

  const events = useMemo(() => {
    let relevant = rows;
    if (selectedEventId) relevant = relevant.filter(r => r.event_id === Number(selectedEventId));
    if (selectedNcc) relevant = relevant.filter(r => r.supplier === selectedNcc);
    const map = {};
    for (const row of relevant) {
      if (!map[row.event_id]) {
        map[row.event_id] = { event_id: row.event_id, event_name: row.event_name, client: row.client, start_date: row.start_date, group_date: row.group_date, items: {} };
      }
      const key = `${row.supplier}||${row.item_name}`;
      if (!map[row.event_id].items[key]) {
        map[row.event_id].items[key] = { supplier: row.supplier, item_name: row.item_name, quantity: 0, unit: row.unit, rental_days: row.rental_days || 1, notes: row.notes };
      }
      map[row.event_id].items[key].quantity += row.quantity;
    }
    return Object.values(map).map(ev => ({
      ...ev,
      items: Object.values(ev.items).sort((a, b) => a.supplier.localeCompare(b.supplier) || a.item_name.localeCompare(b.item_name)),
    }));
  }, [rows, selectedEventId, selectedNcc]);

  const byMonth = useMemo(() => groupByMonth(events), [events]);

  const buildFilename = () => {
    const parts = ['Nghiệm Thu'];
    if (selectedNcc) parts.push(safeName(selectedNcc));
    if (selectedEventId) {
      const ev = allEvents.find(e => e.event_id === Number(selectedEventId));
      if (ev) parts.push(safeName(ev.event_name));
    }
    return parts.join(' - ') + '.xlsx';
  };

  const exportExcel = async (evList, filename) => {
    try {
      const { default: ExcelJS } = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Chi Phí NCC');
      ws.columns = [
        { header: 'STT',          key: 'stt',         width: 6  },
        { header: 'Thiết Bị',     key: 'item_name',   width: 36 },
        { header: 'ĐVT',          key: 'unit',        width: 8  },
        { header: 'SL Xuất',      key: 'quantity',    width: 10 },
        { header: 'FREE',         key: 'free',        width: 8  },
        { header: 'SL Tính Tiền', key: 'billed',      width: 13 },
        { header: 'Số Ngày',      key: 'rental_days', width: 10 },
      ];
      let stt = 0;
      for (const ev of evList) {
        for (const it of ev.items) {
          stt++;
          ws.addRow({ stt, item_name: it.item_name, unit: it.unit || 'Cái', quantity: it.quantity, free: '', billed: it.quantity, rental_days: it.rental_days || 1 });
        }
      }
      ws.eachRow((row, n) => {
        row.eachCell({ includeEmpty: true }, cell => {
          cell.border = BORDER_THIN;
          if (n === 1) {
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: cell.col === 2 ? 'left' : 'center', vertical: 'middle' };
          }
        });
      });
      const buf  = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Lỗi xuất Excel: ' + e.message); }
  };

  if (loading) return <p style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Đang tải...</p>;

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <select value={selectedEventId} onChange={e => { setSelectedEventId(e.target.value); setSelectedNcc(''); setExpandedId(null); }}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(120,120,160,0.2)', background: 'rgba(20,20,35,0.9)', color: selectedEventId ? '#c0c0d8' : '#7878a0', fontSize: '0.83rem', outline: 'none', minWidth: '200px', cursor: 'pointer' }}>
          <option value="">— Tất cả sự kiện —</option>
          {allEvents.map(e => <option key={e.event_id} value={e.event_id}>{e.event_name}</option>)}
        </select>
        <select value={selectedNcc} onChange={e => { setSelectedNcc(e.target.value); setExpandedId(null); }}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(120,120,160,0.2)', background: 'rgba(20,20,35,0.9)', color: selectedNcc ? '#c0c0d8' : '#7878a0', fontSize: '0.83rem', outline: 'none', minWidth: '170px', cursor: 'pointer' }}>
          <option value="">— Tất cả NCC —</option>
          {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(selectedEventId || selectedNcc) && events.length > 0 && (
          <button onClick={() => exportExcel(events, buildFilename())}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.1)', color: GOLD, cursor: 'pointer', fontSize: '0.83rem', fontWeight: 700 }}>
            <Download size={13} /> Xuất Excel
          </button>
        )}
      </div>

      {!events.length
        ? <p style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Không có dữ liệu{selectedNcc ? ` cho NCC "${selectedNcc}"` : ''}</p>
        : (
          <>
            <p style={{ fontSize: '0.79rem', color: '#5a5a80', marginBottom: '10px' }}>
              {events.length} sự kiện
              {selectedNcc && <> · NCC: <span style={{ color: '#60a5fa', fontWeight: 700 }}>{selectedNcc}</span></>}
            </p>
            {(() => {
              const activeMonths   = byMonth.filter(g => !isMonthArchived(g.key));
              const archivedMonths = byMonth.filter(g => isMonthArchived(g.key));
              const renderMonthGroup = ({ label, evs: monthEvs, archived }) => (
                <div key={label} style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: archived ? '#94a3b8' : GOLD, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
                    <span style={{ fontSize: '0.75rem', color: '#5a5a80' }}>· {monthEvs.length} sự kiện</span>
                    <div style={{ flex: 1, height: '1px', background: archived ? 'rgba(148,163,184,0.15)' : 'rgba(201,168,76,0.15)' }} />
                  </div>
                  {monthEvs.map(ev => {
                    const isExp = expandedId === ev.event_id;
                    return (
                      <div key={ev.event_id} style={{ marginBottom: '8px', borderRadius: '10px', border: '1px solid rgba(120,120,160,0.15)', overflow: 'hidden' }}>
                        <div onClick={() => setExpandedId(isExp ? null : ev.event_id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', userSelect: 'none' }}>
                          {isExp ? <ChevronDown size={14} style={{ color: GOLD, flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#5a5a80', flexShrink: 0 }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: 700, color: GOLD, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.event_name}</p>
                            <p style={{ margin: 0, fontSize: '0.76rem', color: '#7878a0', marginTop: '2px' }}>
                              {[ev.client, fmtDate(ev.start_date)].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.74rem', color: '#5a5a80', minWidth: '44px', textAlign: 'right' }}>{ev.items.length} mục</span>
                            <button onClick={e => { e.stopPropagation(); exportExcel([ev], `Nghiệm Thu${selectedNcc ? ` - ${safeName(selectedNcc)}` : ''} - ${safeName(ev.event_name)}.xlsx`); }}
                              title="Xuất Excel sự kiện này"
                              style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.07)', color: GOLD, cursor: 'pointer', gap: '4px' }}>
                              <Download size={12} />
                            </button>
                          </div>
                        </div>
                        {isExp && (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                              <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(120,120,160,0.12)' }}>
                                  {['STT','NCC','Tên Thiết Bị','SL','ĐVT','Số Ngày','Ghi Chú'].map(h => (
                                    <th key={h} style={{ padding: '7px 10px', textAlign: ['STT','SL','Số Ngày'].includes(h) ? 'center' : 'left', color: '#9090a8', fontWeight: 700, fontSize: '0.74rem', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {ev.items.map((it, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid rgba(120,120,160,0.07)', background: idx % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                    <td style={{ padding: '6px 10px', textAlign: 'center', color: '#5a5a80' }}>{idx + 1}</td>
                                    <td style={{ padding: '6px 10px', color: '#60a5fa', fontWeight: 600, whiteSpace: 'nowrap' }}>{it.supplier}</td>
                                    <td style={{ padding: '6px 10px', color: '#c0c0d8' }}>{it.item_name}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center', color: GOLD, fontWeight: 700 }}>{it.quantity}</td>
                                    <td style={{ padding: '6px 10px', color: '#9090a8' }}>{it.unit || 'Cái'}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center', color: '#c0c0d8' }}>{it.rental_days || 1}</td>
                                    <td style={{ padding: '6px 10px', color: '#7878a0', fontSize: '0.78rem' }}>{it.notes || ''}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
              return (
                <>
                  {activeMonths.map(g => renderMonthGroup({ ...g, archived: false }))}
                  {archivedMonths.length > 0 && (
                    <div style={{ marginTop: '8px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(148,163,184,0.2)' }}>
                      <div onClick={() => setArchiveOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', background: 'rgba(148,163,184,0.07)', borderLeft: '3px solid #94a3b8', cursor: 'pointer', userSelect: 'none' }}>
                        <span style={{ fontSize: '1rem' }}>📦</span>
                        <span style={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.84rem', flex: 1, letterSpacing: '0.04em' }}>LƯU TRỮ</span>
                        <span style={{ fontSize: '0.78rem', color: '#5a6a80', background: 'rgba(148,163,184,0.15)', borderRadius: '9999px', padding: '1px 8px', fontWeight: 700 }}>{archivedMonths.reduce((s, g) => s + g.evs.length, 0)} sự kiện</span>
                        <span style={{ color: '#94a3b8', fontSize: '0.78rem', transition: 'transform 0.15s', display: 'inline-block', transform: archiveOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                      </div>
                      {archiveOpen && (
                        <div style={{ padding: '12px 14px', background: 'rgba(10,10,20,0.4)' }}>
                          {archivedMonths.map(g => renderMonthGroup({ ...g, archived: true }))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )
      }
    </div>
  );
}

// ── Main Component ────────────────────────────────────────
export default function VanHanhKeToan() {
  const [tab, setTab] = useState('khoi-minh');

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <Calculator size={20} style={{ color: GOLD }} />
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: GOLD }}>Vận Hành Kế Toán</h1>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#7878a0' }}>Tổng hợp chi phí thiết bị từ phiếu xuất sự kiện</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid rgba(120,120,160,0.15)' }}>
        {[
          { id: 'khoi-minh', Icon: Package, label: 'Chi Phí Khôi Minh' },
          { id: 'ncc',       Icon: Truck,   label: 'Chi Phí NCC'        },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 16px', borderRadius: '8px 8px 0 0', cursor: 'pointer',
            border: 'none', background: tab === t.id ? 'rgba(201,168,76,0.1)' : 'transparent',
            color: tab === t.id ? GOLD : '#7878a0',
            fontWeight: tab === t.id ? 800 : 600, fontSize: '0.85rem',
            borderBottom: `2px solid ${tab === t.id ? GOLD : 'transparent'}`,
            transition: 'all 0.15s',
          }}>
            <t.Icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'khoi-minh' && <KhoiMinhTab />}
      {tab === 'ncc'       && <NccTab />}
    </div>
  );
}
