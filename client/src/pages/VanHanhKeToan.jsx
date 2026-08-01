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

function todayMonth() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' })
    .format(new Date()).slice(0, 7);
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtMonth(ym) {
  const [y, m] = ym.split('-');
  return `Tháng ${parseInt(m)}/${y}`;
}

function isMonthLocked(ym) {
  const [y, m] = ym.split('-').map(Number);
  const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const [ty, tm, td] = todayVN.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0));
  const lockDate = new Date(lastDay.getTime() + 30 * 86400000);
  const today = new Date(Date.UTC(ty, tm - 1, td));
  return today > lockDate;
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
  const show  = parseDatesArr(row.show_dates, row.show_date);
  return film.length * 1 + show.length * 0.5;
}

function getEventMonth(ev) {
  const tryKey = s => { const k = (s || '').slice(0, 7); return /^\d{4}-\d{2}$/.test(k) ? k : null; };
  const tryJson = s => { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) && v.length ? tryKey(v[0]) : null; } catch { return null; } };
  return tryKey(ev.group_date) || tryKey(ev.start_date) || tryKey(ev.filming_date) || tryJson(ev.filming_dates) || tryJson(ev.start_dates) || null;
}

const BORDER_THIN = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

// ── Tab Chi Phí Khôi Minh ─────────────────────────────────
function KhoiMinhTab({ month }) {
  const [rows, setRows]     = useState([]);
  const [nccRows, setNccRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    Promise.all([api.getKeToanKhoiMinh(), api.getKeToanNcc()])
      .then(([km, ncc]) => { setRows(km); setNccRows(ncc); })
      .finally(() => setLoading(false));
  }, []);

  const allEvents = useMemo(() => {
    const evMap = {};
    for (const row of rows) {
      if (!evMap[row.event_id]) {
        evMap[row.event_id] = { event_id: row.event_id, event_name: row.event_name, event_code: row.event_code, client: row.client, start_date: row.start_date, group_date: row.group_date, filming_date: row.filming_date, filming_dates: row.filming_dates, ngay_count: calcNgay(row), byId: {} };
      }
      const { byId } = evMap[row.event_id];
      if (!byId[row.equipment_id]) byId[row.equipment_id] = { name: row.equipment_name, unit: row.unit, qty_total: 0, qty_free: 0 };
      byId[row.equipment_id].qty_total += row.quantity;
      byId[row.equipment_id].qty_free  += row.qty_free;
    }
    for (const row of nccRows) {
      if (!evMap[row.event_id]) continue;
      const { byId } = evMap[row.event_id];
      const key = `ncc__${row.item_name}`;
      if (!byId[key]) byId[key] = { name: row.item_name, unit: row.unit || 'Cái', qty_total: 0, qty_free: 0 };
      byId[key].qty_total += row.quantity;
    }
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

  const events = useMemo(() => {
    const byM = allEvents.filter(ev => getEventMonth(ev) === month);
    const q = search.trim().toLowerCase();
    return q ? byM.filter(ev => ev.event_name.toLowerCase().includes(q) || (ev.client || '').toLowerCase().includes(q)) : byM;
  }, [allEvents, month, search]);

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
          cell.alignment = { horizontal: n === 1 || cell.col !== 2 ? 'center' : 'left', vertical: 'middle' };
          if (n === 1) cell.font = { bold: true };
        });
      });
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Lỗi xuất Excel: ' + e.message); }
  };

  const isLocked = isMonthLocked(month);

  if (loading) return <p style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Đang tải...</p>;

  return (
    <div>
      {isLocked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', marginBottom: '14px', borderRadius: '8px', background: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.2)', borderLeft: '3px solid #94a3b8' }}>
          <span>📦</span>
          <span style={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.84rem' }}>LƯU TRỮ — {fmtMonth(month)}</span>
          <span style={{ fontSize: '0.76rem', color: '#5a6a80', marginLeft: '4px' }}>Dữ liệu lưu trữ</span>
        </div>
      )}
      <div style={{ position: 'relative', marginBottom: '14px' }}>
        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#7878a0' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm sự kiện, khách hàng..."
          style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: '8px', border: '1px solid rgba(120,120,160,0.2)', background: 'rgba(255,255,255,0.04)', color: '#c0c0d8', fontSize: '0.83rem', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      {events.length === 0
        ? <p style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Không có dữ liệu cho {fmtMonth(month)}</p>
        : <>
          <p style={{ fontSize: '0.79rem', color: '#5a5a80', marginBottom: '10px' }}>{events.length} sự kiện</p>
          {events.sort((a, b) => (b.group_date || b.start_date || '').localeCompare(a.group_date || a.start_date || '') || b.event_id - a.event_id).map(ev => {
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
                      title="Xuất Excel" style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.07)', color: GOLD, cursor: 'pointer', gap: '4px' }}>
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
        </>
      }
    </div>
  );
}

// ── Tab Chi Phí NCC ───────────────────────────────────────
function NccTab({ month }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNcc, setSelectedNcc] = useState('');
  const [expandedId, setExpandedId]   = useState(null);

  useEffect(() => {
    api.getKeToanNcc().then(setRows).finally(() => setLoading(false));
  }, []);

  const suppliers = useMemo(() => {
    const relevant = rows.filter(r => getEventMonth(r) === month);
    return [...new Set(relevant.map(r => r.supplier).filter(Boolean))].sort();
  }, [rows, month]);

  const events = useMemo(() => {
    let relevant = rows.filter(r => getEventMonth(r) === month);
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
    })).sort((a, b) => (b.group_date || b.start_date || '').localeCompare(a.group_date || a.start_date || '') || b.event_id - a.event_id);
  }, [rows, month, selectedNcc]);

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
          cell.alignment = { horizontal: n === 1 || cell.col !== 2 ? 'center' : 'left', vertical: 'middle' };
          if (n === 1) cell.font = { bold: true };
        });
      });
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Lỗi xuất Excel: ' + e.message); }
  };

  const isLocked = isMonthLocked(month);

  if (loading) return <p style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Đang tải...</p>;

  return (
    <div>
      {isLocked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', marginBottom: '14px', borderRadius: '8px', background: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.2)', borderLeft: '3px solid #94a3b8' }}>
          <span>📦</span>
          <span style={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.84rem' }}>LƯU TRỮ — {fmtMonth(month)}</span>
          <span style={{ fontSize: '0.76rem', color: '#5a6a80', marginLeft: '4px' }}>Dữ liệu lưu trữ</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <select value={selectedNcc} onChange={e => { setSelectedNcc(e.target.value); setExpandedId(null); }}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(120,120,160,0.2)', background: 'rgba(20,20,35,0.9)', color: selectedNcc ? '#c0c0d8' : '#7878a0', fontSize: '0.83rem', outline: 'none', minWidth: '170px', cursor: 'pointer' }}>
          <option value="">— Tất cả NCC —</option>
          {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {selectedNcc && events.length > 0 && (
          <button onClick={() => exportExcel(events, `Nghiệm Thu - ${safeName(selectedNcc)}.xlsx`)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.1)', color: GOLD, cursor: 'pointer', fontSize: '0.83rem', fontWeight: 700 }}>
            <Download size={13} /> Xuất Excel
          </button>
        )}
      </div>
      {events.length === 0
        ? <p style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Không có dữ liệu{selectedNcc ? ` cho NCC "${selectedNcc}"` : ''} trong {fmtMonth(month)}</p>
        : <>
          <p style={{ fontSize: '0.79rem', color: '#5a5a80', marginBottom: '10px' }}>{events.length} sự kiện</p>
          {events.map(ev => {
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
                      title="Xuất Excel" style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.07)', color: GOLD, cursor: 'pointer', gap: '4px' }}>
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
        </>
      }
    </div>
  );
}

// ── Tab Sự Kiện Tháng ─────────────────────────────────────
const STATUS_LABEL = { active: 'Đang diễn ra', planned: 'Dự kiến', completed: 'Hoàn thành', cancelled: 'Huỷ' };
const STATUS_COLOR = { active: '#4ade80', planned: '#60a5fa', completed: '#a3a3a3', cancelled: '#f87171' };

function parseDates(multi, single) {
  if (multi) { try { const v = JSON.parse(multi); if (Array.isArray(v)) return v.filter(Boolean); } catch {} }
  return single ? [single] : [];
}

function SuKienThangTab({ month }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getEvents({ include_archived: 1 })
      .then(data => setEvents(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return events.filter(ev => getEventMonth(ev) === month);
  }, [events, month]);

  const [mm, yy] = month.split('-').map(Number);
  const label = `Tháng ${mm}/${yy}`;

  if (loading) return <div style={{ color: '#7878a0', padding: '20px', textAlign: 'center' }}>⏳ Đang tải...</div>;
  if (filtered.length === 0) return <div style={{ color: '#7878a0', padding: '20px', textAlign: 'center' }}>Không có sự kiện nào trong {label}</div>;

  return (
    <div>
      <p style={{ color: '#7878a0', fontSize: '0.82rem', marginBottom: '12px' }}>{filtered.length} sự kiện trong {label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map(ev => {
          const filmDates = parseDates(ev.filming_dates, ev.filming_date);
          const showDates = parseDates(ev.show_dates, ev.show_date);
          const startDates = parseDates(ev.start_dates, ev.start_date);
          const allDates = [...new Set([...filmDates, ...showDates, ...startDates])].sort();
          const color = STATUS_COLOR[ev.status] || '#7878a0';
          return (
            <div key={ev.id} style={{ background: '#13131d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 800, color: GOLD, fontSize: '0.78rem', letterSpacing: '0.06em' }}>{ev.code}</span>
                    <span style={{ fontWeight: 700, color: '#eeeef5', fontSize: '0.90rem' }}>{ev.name}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: '9999px', padding: '1px 8px' }}>
                      {STATUS_LABEL[ev.status] || ev.status}
                    </span>
                  </div>
                  {ev.client && <div style={{ fontSize: '0.80rem', color: '#a0a0b8', marginBottom: '2px' }}>👤 {ev.client}</div>}
                  {ev.location && <div style={{ fontSize: '0.80rem', color: '#a0a0b8', marginBottom: '2px' }}>📍 {ev.location}</div>}
                  {allDates.length > 0 && (
                    <div style={{ fontSize: '0.78rem', color: '#7878a0', marginTop: '4px' }}>
                      📅 {allDates.map(fmtDate).join(' · ')}
                    </div>
                  )}
                  {ev.departments && (
                    <div style={{ fontSize: '0.75rem', color: '#7878a0', marginTop: '3px' }}>
                      🏢 {(() => { try { const d = JSON.parse(ev.departments); return Array.isArray(d) ? d.join(', ') : ev.departments; } catch { return ev.departments; } })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────
export default function VanHanhKeToan() {
  const [tab, setTab]     = useState('khoi-minh');
  const [month, setMonth] = useState(todayMonth);

  const isLocked = isMonthLocked(month);
  const atCurrent = month >= todayMonth();

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <Calculator size={20} style={{ color: GOLD }} />
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: GOLD }}>Vận Hành Kế Toán</h1>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#7878a0' }}>Tổng hợp chi phí thiết bị từ phiếu xuất sự kiện</p>
      </div>

      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: isLocked ? 'rgba(148,163,184,0.08)' : 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '2px', border: isLocked ? '1px solid rgba(148,163,184,0.2)' : 'none', width: 'fit-content', marginBottom: '18px' }}>
        <button onClick={() => setMonth(m => shiftMonth(m, -1))}
          style={{ padding: '6px 13px', border: 'none', background: 'transparent', color: '#c8c8e0', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, borderRadius: '6px' }}>‹</button>
        <span style={{ padding: '6px 10px', color: isLocked ? '#94a3b8' : GOLD, fontWeight: 700, fontSize: '0.88rem', minWidth: '140px', textAlign: 'center' }}>{fmtMonth(month)}</span>
        <button onClick={() => setMonth(m => shiftMonth(m, 1))} disabled={atCurrent}
          style={{ padding: '6px 13px', border: 'none', background: 'transparent', color: atCurrent ? '#3a3a5a' : '#c8c8e0', cursor: atCurrent ? 'default' : 'pointer', fontSize: '1rem', fontWeight: 700, borderRadius: '6px' }}>›</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid rgba(120,120,160,0.15)' }}>
        {[
          { id: 'khoi-minh',  Icon: Package,  label: 'Chi Phí Khôi Minh' },
          { id: 'ncc',        Icon: Truck,    label: 'Chi Phí NCC'        },
          { id: 'su-kien',    Icon: Search,   label: `Sự Kiện ${fmtMonth(month)}` },
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

      {tab === 'khoi-minh' && <KhoiMinhTab month={month} />}
      {tab === 'ncc'       && <NccTab month={month} />}
      {tab === 'su-kien'   && <SuKienThangTab month={month} />}
    </div>
  );
}
