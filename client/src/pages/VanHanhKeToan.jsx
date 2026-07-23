import { useState, useEffect, useMemo } from 'react';
import { Calculator, Package, Truck, Search, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { api } from '../api';

const GOLD = '#c9a84c';

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

function groupByMonth(events) {
  const map = {};
  for (const ev of events) {
    const key = ev.start_date ? ev.start_date.slice(0, 7) : '0000-00';
    if (!map[key]) {
      const [y, m] = key.split('-');
      map[key] = { key, label: key === '0000-00' ? 'Không rõ ngày' : `Tháng ${parseInt(m)}/${y}`, evs: [] };
    }
    map[key].evs.push(ev);
  }
  return Object.values(map).sort((a, b) => b.key.localeCompare(a.key));
}

// ── Tab Chi Phí Khôi Minh ─────────────────────────────────
function KhoiMinhTab() {
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    api.getKeToanKhoiMinh().then(setRows).finally(() => setLoading(false));
  }, []);

  const events = useMemo(() => {
    const map = {};
    for (const row of rows) {
      if (!map[row.event_id]) {
        map[row.event_id] = { event_id: row.event_id, event_name: row.event_name, event_code: row.event_code, client: row.client, start_date: row.start_date, ngay_count: calcNgay(row), items: {} };
      }
      const key = row.equipment_id;
      if (!map[row.event_id].items[key]) {
        map[row.event_id].items[key] = { equipment_id: row.equipment_id, equipment_name: row.equipment_name, category_name: row.category_name, unit: row.unit, qty_total: 0, qty_free: 0 };
      }
      map[row.event_id].items[key].qty_total += row.quantity;
      map[row.event_id].items[key].qty_free  += row.qty_free;
    }
    return Object.values(map).map(ev => ({
      ...ev,
      items: Object.values(ev.items)
        .map(it => ({ ...it, qty_billed: it.qty_total - it.qty_free }))
        .filter(it => it.qty_billed > 0)
        .sort((a, b) => (a.category_name || '').localeCompare(b.category_name || '') || a.equipment_name.localeCompare(b.equipment_name)),
    })).filter(ev => ev.items.length > 0);
  }, [rows]);

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
        ws.addRow({ stt, equipment_name: it.equipment_name, unit: it.unit, qty_total: it.qty_total, qty_free: it.qty_free || '', qty_billed: it.qty_billed, ngay_count: ev.ngay_count || '' });
      }
    }
    ws.eachRow((row, n) => {
      const fill = n === 1
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } }
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: n % 2 === 0 ? 'FFF0F0F0' : 'FFFFFFFF' } };
      row.eachCell(cell => {
        cell.fill = fill;
        cell.border = BORDER_THIN;
        if (n === 1) {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });
    });
    const buf  = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
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
      {byMonth.map(({ label, evs: monthEvs }) => (
        <div key={label} style={{ marginBottom: '24px' }}>
          {/* Month header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: GOLD, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
            <span style={{ fontSize: '0.75rem', color: '#5a5a80' }}>· {monthEvs.length} sự kiện</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(201,168,76,0.15)' }} />
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
                  <button onClick={e => { e.stopPropagation(); exportExcel([ev], `Chi Phí Nghiệm Thu - ${ev.event_name}.xlsx`); }}
                    title="Xuất Excel sự kiện này"
                    style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.07)', color: GOLD, cursor: 'pointer', flexShrink: 0, gap: '4px' }}>
                    <Download size={12} />
                  </button>
                  <span style={{ fontSize: '0.74rem', color: '#5a5a80', flexShrink: 0 }}>{ev.items.length} thiết bị</span>
                </div>
                {isExp && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(120,120,160,0.12)' }}>
                          {['STT','Danh Mục','Thiết Bị','ĐVT','SL Xuất','FREE','SL Tính Tiền'].map(h => (
                            <th key={h} style={{ padding: '7px 10px', textAlign: ['STT','SL Xuất','FREE','SL Tính Tiền'].includes(h) ? 'center' : 'left', color: '#9090a8', fontWeight: 700, fontSize: '0.74rem', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ev.items.map((it, idx) => (
                          <tr key={it.equipment_id} style={{ borderBottom: '1px solid rgba(120,120,160,0.07)', background: idx % 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                            <td style={{ padding: '6px 10px', textAlign: 'center', color: '#5a5a80' }}>{idx + 1}</td>
                            <td style={{ padding: '6px 10px', color: '#9090a8' }}>{it.category_name || '—'}</td>
                            <td style={{ padding: '6px 10px', color: '#c0c0d8', fontWeight: 600 }}>{it.equipment_name}</td>
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
      ))}
    </div>
  );
}

// ── Tab Chi Phí NCC ───────────────────────────────────────
function NccTab() {
  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedNcc, setSelectedNcc] = useState('');
  const [search, setSearch]         = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    api.getKeToanNcc().then(setRows).finally(() => setLoading(false));
  }, []);

  const suppliers = useMemo(() => [...new Set(rows.map(r => r.supplier).filter(Boolean))].sort(), [rows]);

  const events = useMemo(() => {
    const relevant = selectedNcc ? rows.filter(r => r.supplier === selectedNcc) : rows;
    const map = {};
    for (const row of relevant) {
      if (!map[row.event_id]) {
        map[row.event_id] = { event_id: row.event_id, event_name: row.event_name, client: row.client, start_date: row.start_date, items: {} };
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
  }, [rows, selectedNcc]);

  const filtered = useMemo(() => {
    if (!search.trim()) return events;
    const q = search.toLowerCase();
    return events.filter(ev => ev.event_name.toLowerCase().includes(q) || (ev.client || '').toLowerCase().includes(q));
  }, [events, search]);

  const byMonth = useMemo(() => groupByMonth(filtered), [filtered]);

  const exportExcel = async (evList, filename) => {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Chi Phí NCC');
    ws.columns = [
      { header: 'Sự Kiện',      key: 'event_name', width: 32 },
      { header: 'Khách Hàng',   key: 'client',     width: 20 },
      { header: 'Ngày',         key: 'start_date', width: 12 },
      { header: 'NCC',          key: 'supplier',   width: 22 },
      { header: 'Tên Thiết Bị', key: 'item_name',  width: 32 },
      { header: 'Số Lượng',     key: 'quantity',   width: 10 },
      { header: 'ĐVT',          key: 'unit',       width: 8  },
      { header: 'Số Ngày',      key: 'rental_days',width: 10 },
      { header: 'Ghi Chú',      key: 'notes',      width: 25 },
    ];
    for (const ev of evList) {
      for (const it of ev.items) {
        ws.addRow({ event_name: ev.event_name, client: ev.client || '', start_date: fmtDate(ev.start_date), supplier: it.supplier, item_name: it.item_name, quantity: it.quantity, unit: it.unit || 'Cái', rental_days: it.rental_days, notes: it.notes || '' });
      }
    }
    ws.eachRow((row, n) => {
      const fill = n === 1
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } }
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: n % 2 === 0 ? 'FFF0F0F0' : 'FFFFFFFF' } };
      row.eachCell(cell => {
        cell.fill = fill;
        cell.border = BORDER_THIN;
        if (n === 1) {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });
    });
    const buf  = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Đang tải...</p>;

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <select value={selectedNcc} onChange={e => { setSelectedNcc(e.target.value); setExpandedId(null); }}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(120,120,160,0.2)', background: 'rgba(20,20,35,0.9)', color: selectedNcc ? '#c0c0d8' : '#7878a0', fontSize: '0.83rem', outline: 'none', minWidth: '170px', cursor: 'pointer' }}>
          <option value="">— Tất cả NCC —</option>
          {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ flex: 1, position: 'relative', minWidth: '160px' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#7878a0' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm sự kiện..."
            style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: '8px', border: '1px solid rgba(120,120,160,0.2)', background: 'rgba(255,255,255,0.04)', color: '#c0c0d8', fontSize: '0.83rem', outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>

      {!events.length
        ? <p style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Không có dữ liệu{selectedNcc ? ` cho NCC "${selectedNcc}"` : ''}</p>
        : (
          <>
            <p style={{ fontSize: '0.79rem', color: '#5a5a80', marginBottom: '10px' }}>
              {filtered.length} sự kiện{search.trim() ? ` / ${events.length}` : ''}
              {selectedNcc && <> · NCC: <span style={{ color: '#60a5fa', fontWeight: 700 }}>{selectedNcc}</span></>}
            </p>
            {byMonth.map(({ label, evs: monthEvs }) => (
              <div key={label} style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: GOLD, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
                  <span style={{ fontSize: '0.75rem', color: '#5a5a80' }}>· {monthEvs.length} sự kiện</span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(201,168,76,0.15)' }} />
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
                        <button onClick={e => { e.stopPropagation(); exportExcel([ev], `Chi Phí Nghiệm Thu NCC - ${ev.event_name}.xlsx`); }}
                          title="Xuất Excel sự kiện này"
                          style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.07)', color: GOLD, cursor: 'pointer', flexShrink: 0, gap: '4px' }}>
                          <Download size={12} />
                        </button>
                        <span style={{ fontSize: '0.74rem', color: '#5a5a80', flexShrink: 0 }}>{ev.items.length} mục</span>
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
            ))}
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
