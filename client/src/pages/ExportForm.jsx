import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { printSlip, previewSlip } from '../utils/printSlip';
import DateInput from '../components/DateInput';
import { LayoutGrid, Clapperboard, Headphones, Theater, Package } from 'lucide-react';
import { NCC_CATALOG, NCC_LIST, NCC_DEPT } from '../utils/nccCatalog';

const DEPTS = [
  { value: '',       Icon: LayoutGrid,   label: 'Tất cả',   cats: null },
  { value: 'TECH',   Icon: Clapperboard, label: 'Kỹ Thuật', cats: ['TECH'] },
  { value: 'ATAS',   Icon: Headphones,   label: 'ATAS',     cats: ['AUDIO', 'LIGHT', 'LED', 'MATRIX'] },
  { value: 'STAGE',  Icon: Theater,      label: 'Sân Khấu', cats: ['STAGE'] },
  { value: 'CSVC',   Icon: Package,      label: 'CSVC',     cats: ['CSVC'] },
];

// Map role → default dept value
const ROLE_DEPT = {
  TECHNICAL: 'TECH',
  ATAS:      'ATAS',
  STAGE:     'STAGE',
  CSVC:      'CSVC',
};

// Roles that cannot change the dept selector
const LOCKED_ROLES = ['TECHNICAL', 'ATAS', 'STAGE', 'CSVC'];

const emptyRows = (n = 10) => Array.from({ length: n }, () => ({ mode: 'kho', equipment_id: '', quantity: 1, notes: '', ext_supplier: '', ext_name: '', rental_days: 1 }));

const emptyExtRow = () => ({ supplier: '', name: '', quantity: 1, notes: '', rental_days: 1 });

export default function ExportForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const defaultDept = ROLE_DEPT[user?.role] || '';
  const isLocked = LOCKED_ROLES.includes(user?.role);

  // Lọc NCC theo bộ phận của người dùng
  const roleDeptCode = { TECHNICAL: 'TECH', ATAS: 'ATAS', STAGE: 'STAGE', CSVC: 'CSVC' };
  const userDept = roleDeptCode[user?.role];
  const visibleNCC = isLocked
    ? NCC_LIST.filter(s => NCC_DEPT[s]?.includes(userDept))
    : NCC_LIST; // SUPER_ADMIN / DIRECTOR / PRODUCTION thấy tất cả

  const [equipment, setEquipment] = useState([]);
  const [events, setEvents]       = useState([]);
  const [deptFilter, setDeptFilter] = useState(defaultDept);
  const [form, setForm] = useState({
    event_id: '',
    responsible_person: user?.full_name || '',
    expected_return_date: '',
    notes: '',
  });
  const [items, setItems]           = useState(emptyRows(10));
  const [searchTerms, setSearchTerms] = useState(Array(10).fill(''));
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [nccFocusIdx, setNccFocusIdx] = useState(-1);
  const [nccSupplierFocusIdx, setNccSupplierFocusIdx] = useState(-1);
  const [submitting, setSubmitting] = useState(false);
  const [doneSlip, setDoneSlip]     = useState(null);
  const [dateError, setDateError]     = useState('');
  const [eventError, setEventError]   = useState(false);
  const [eventDropOpen, setEventDropOpen] = useState(false);
  const savedSnapshot = useRef(null);

  // Thiết bị ngoài
  const [extOpen,     setExtOpen]     = useState(false);
  const [extSupplier, setExtSupplier] = useState('');
  const [extCustom,   setExtCustom]   = useState('');
  const [extItems,    setExtItems]    = useState([emptyExtRow()]);

  const reloadEquipment = () => api.getEquipment().then(setEquipment);

  // Tính ngày tối thiểu phải trả dựa trên sự kiện đang chọn
  const parseFilmingDates = (ev) => {
    if (!ev) return [];
    try {
      if (ev.filming_dates) return typeof ev.filming_dates === 'string' ? JSON.parse(ev.filming_dates) : ev.filming_dates;
      return ev.filming_date ? [ev.filming_date] : [];
    } catch { return ev.filming_date ? [ev.filming_date] : []; }
  };

  const getMinReturnDate = (eventId) => {
    const ev = events.find(e => String(e.id) === String(eventId));
    if (!ev) return new Date().toISOString().slice(0, 10);
    const filmingArr = parseFilmingDates(ev);
    const lastFilming = filmingArr.length ? filmingArr[filmingArr.length - 1] : null;
    const candidates = [lastFilming, ev.end_date, new Date().toISOString().slice(0, 10)].filter(Boolean);
    return candidates.sort().pop();
  };

  useEffect(() => {
    reloadEquipment();
    api.getEvents().then(data => setEvents((data || []).filter(e => ['planned','active'].includes(e.status))));
    const onFocus = () => reloadEquipment();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addItem = () => {
    setItems(i => [...i, ...emptyRows(5)]);
    setSearchTerms(s => [...s, ...Array(5).fill('')]);
  };

  const removeItem = (idx) => {
    setItems(i => i.filter((_, j) => j !== idx));
    setSearchTerms(s => s.filter((_, j) => j !== idx));
    setExpandedRows(prev => {
      const next = new Set();
      prev.forEach(r => { if (r < idx) next.add(r); else if (r > idx) next.add(r - 1); });
      return next;
    });
  };

  const toggleExpand = (idx) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const setItem = (idx, key, val) =>
    setItems(prev => prev.map((it, j) => j === idx ? { ...it, [key]: val } : it));

  // Filter equipment by dept + search term
  const deptCats = DEPTS.find(d => d.value === deptFilter)?.cats ?? null;

  const filteredEquip = (term, currentIdx) => {
    const usedIds = new Set(
      items
        .filter((_, j) => j !== currentIdx)
        .map(i => String(i.equipment_id))
        .filter(Boolean)
    );
    let list = deptCats
      ? equipment.filter(e => deptCats.includes(e.category_code))
      : equipment;
    list = list.filter(e => !usedIds.has(String(e.id)));
    if (term) {
      const t = term.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(t) || e.code.toLowerCase().includes(t));
    }
    return list.slice(0, 20);
  };

  const submit = async (e) => {
    e.preventDefault();
    const validItems = items.filter(it => it.mode === 'kho' && it.equipment_id && it.quantity > 0);
    const rowExt = items
      .filter(it => it.mode === 'ext' && it.ext_name.trim())
      .map(it => {
        const catalog = NCC_CATALOG[it.ext_supplier] || [];
        const found = catalog.find(c => c.name === it.ext_name.trim());
        return { name: it.ext_name.trim(), supplier: it.ext_supplier.trim(), quantity: it.quantity, notes: it.notes || '', unit: found?.unit || 'Cái', rental_days: it.rental_days || 1 };
      });
    const sectionExt = extOpen ? extItems.filter(i => i.name.trim() && i.supplier.trim()).map(i => ({ ...i })) : [];
    const validExt = [...rowExt, ...sectionExt];
    if (!form.event_id) { setEventError(true); return; }
    setEventError(false);
    if (!form.expected_return_date) { setDateError('Vui lòng chọn ngày dự kiến trả'); return; }
    const minReturn = getMinReturnDate(form.event_id);
    if (form.expected_return_date < minReturn) {
      const selEv = events.find(ev => String(ev.id) === String(form.event_id));
      const filmingArr = parseFilmingDates(selEv);
      const lastFilming = filmingArr.length ? filmingArr[filmingArr.length - 1] : null;
      const fmtDate = d => d ? `${d.slice(8,10)}-${d.slice(5,7)}-${d.slice(2,4)}` : '';
      const parts = [
        lastFilming && `ngày ghi hình (${fmtDate(lastFilming)})`,
        selEv?.end_date && `ngày kết thúc (${fmtDate(selEv.end_date)})`,
      ].filter(Boolean);
      setDateError(`Ngày trả phải từ ${parts.join(' và ')} trở đi`);
      return;
    }
    setDateError('');
    if (validItems.length === 0 && validExt.length === 0) { alert('Chưa chọn thiết bị nào'); return; }
    savedSnapshot.current = { form, items, searchTerms, deptFilter, extOpen, extSupplier, extCustom, extItems };
    setSubmitting(true);
    try {
      const res = await api.createOut({ ...form, items: validItems, external_items: validExt });
      const full = await api.getTransactionById(res.id);
      setDoneSlip({ ...full, _pending: res.status === 'pending', _filmingDate: res._filmingDate });
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // After success — show confirmation with print option
  if (doneSlip) {
    return (
      <div onClick={() => navigate('/')}
        style={{ minHeight:'100vh', width:'100%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
        <div className="card text-center space-y-5" onClick={e => e.stopPropagation()}
          style={{ maxWidth:'420px', width:'100%', margin:'0 16px' }}>
          {doneSlip._pending ? (
            <>
              <div className="text-5xl">🕐</div>
              <h2 style={{ color:'#fbbf24', fontSize:'1.2rem', fontWeight:700 }}>Phiếu xuất kho tạm đã tạo!</h2>
              <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>
                Phiếu <strong style={{ color:'#fbbf24', fontFamily:'monospace' }}>{doneSlip.code}</strong> đang chờ xác nhận.
                {doneSlip._filmingDate && <> Ngày ghi hình: <strong style={{ color:'#fbbf24' }}>{doneSlip._filmingDate.slice(8,10)}-{doneSlip._filmingDate.slice(5,7)}-{doneSlip._filmingDate.slice(2,4)}</strong>.</>}
              </p>
              <p style={{ color:'rgba(251,191,36,0.65)', fontSize:'0.78rem', background:'rgba(251,191,36,0.07)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:'8px', padding:'8px 12px' }}>
                ⚠ Thiết bị <strong>chưa bị trừ kho</strong>. Vào <em>Lịch Sử Vận Hành → Xuất Kho Tạm</em> để xác nhận khi đến ngày ghi hình.
              </p>
            </>
          ) : (
            <>
              <div className="text-5xl">✅</div>
              <h2 style={{ color:'#4ade80', fontSize:'1.2rem', fontWeight:700 }}>Xuất kho thành công!</h2>
              <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>
                Phiếu <strong style={{ color:'var(--gold)', fontFamily:'monospace' }}>{doneSlip.code}</strong> đã được tạo
                với <strong style={{ color:'var(--text-primary)' }}>{(doneSlip.items?.length || 0) + (doneSlip.external_items?.length || 0)}</strong> loại thiết bị{doneSlip.external_items?.length > 0 ? ` (${doneSlip.external_items.length} thuê NCC)` : ''}.
              </p>
            </>
          )}

          {/* Row 1: Preview + Print */}
          <div className="flex gap-3 justify-center">
            <button onClick={() => previewSlip(doneSlip)} className="btn-secondary flex items-center gap-2">
              👁 Xem trước
            </button>
            <button onClick={() => printSlip(doneSlip)} className="btn-primary flex items-center gap-2">
              🖨️ In phiếu
            </button>
          </div>

          {/* Row 2: Back to edit + History */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={async () => {
                try { await api.deleteTransaction(doneSlip.id); } catch {}
                const s = savedSnapshot.current;
                if (s) {
                  setForm(s.form);
                  setItems(s.items);
                  setSearchTerms(s.searchTerms);
                  setDeptFilter(s.deptFilter);
                  setExtOpen(s.extOpen);
                  setExtSupplier(s.extSupplier);
                  setExtCustom(s.extCustom);
                  setExtItems(s.extItems);
                }
                reloadEquipment();
                setDoneSlip(null);
              }}
              style={{
                display:'flex', alignItems:'center', gap:'6px',
                padding:'8px 16px', borderRadius:'8px', fontSize:'0.875rem',
                background:'rgba(201,168,76,0.1)',
                border:'1px solid rgba(201,168,76,0.35)',
                color:'#e8c97a', cursor:'pointer',
              }}>
              ← Quay lại chỉnh sửa
            </button>
            <button onClick={() => navigate('/transactions')} className="btn-secondary">
              Xem lịch sử
            </button>
          </div>

          {/* New slip */}
          <button
            onClick={() => {
              setDoneSlip(null);
              setForm({ event_id: '', responsible_person: user?.full_name || '', expected_return_date: '', notes: '' });
              setItems(emptyRows(10));
              setSearchTerms(Array(10).fill(''));
              reloadEquipment();
            }}
            style={{ color:'var(--text-muted)', fontSize:'0.8rem', background:'none', border:'none', cursor:'pointer' }}>
            + Tạo phiếu mới
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Phiếu Xuất Kho</h1>
        <p className="text-gray-500 text-sm">Phải chọn sự kiện trước khi xuất thiết bị</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Header info */}
        <div className="card space-y-4">
          <h2 style={{ fontWeight:700, color:'var(--gold)', fontSize:'0.9rem', letterSpacing:'0.04em', textTransform:'uppercase' }}>Thông tin phiếu</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" style={ eventError ? { color:'#f87171' } : {} }>Sự kiện / Dự án <span style={{ color:'#f87171' }}>*</span></label>
              {(() => {
                const selEv = events.find(ev => String(ev.id) === String(form.event_id));
                return (
                  <div style={{ position:'relative' }}>
                    <button type="button"
                      onClick={() => setEventDropOpen(v => !v)}
                      style={{
                        width:'100%', padding:'8px 12px', borderRadius:'8px', cursor:'pointer',
                        border: eventError ? '1.5px solid #f87171' : (selEv ? '1px solid rgba(201,168,76,0.5)' : '1px solid rgba(255,255,255,0.1)'),
                        background: selEv ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.04)',
                        display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px',
                        boxShadow: eventError ? '0 0 0 2px rgba(248,113,113,0.18)' : 'none',
                        minHeight:'40px',
                      }}>
                      {selEv ? (
                        <span style={{ display:'inline-flex', alignItems:'baseline', gap:'5px', overflow:'hidden' }}>
                          <span style={{ color:'#e8c97a', fontWeight:700, fontSize:'0.9rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{selEv.name}</span>
                          <span style={{ color:'rgba(201,168,76,0.38)', fontSize:'0.78rem', fontFamily:'monospace', flexShrink:0 }}>· {selEv.code}</span>
                        </span>
                      ) : (
                        <span style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>-- Chọn sự kiện --</span>
                      )}
                      <span style={{ color:'#c9a84c', fontSize:'0.75rem', flexShrink:0 }}>▾</span>
                    </button>

                    {eventDropOpen && (
                      <>
                        <div style={{ position:'fixed', inset:0, zIndex:99 }} onClick={() => setEventDropOpen(false)} />
                        <div style={{
                          position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:200,
                          background:'#0e0e1a', border:'1px solid rgba(201,168,76,0.4)',
                          borderRadius:'8px', boxShadow:'0 12px 32px rgba(0,0,0,0.9)',
                          maxHeight:'220px', overflowY:'auto',
                        }}>
                          {events.map(ev => (
                            <button key={ev.id} type="button"
                              onClick={() => { setField('event_id', ev.id); setEventError(false); setEventDropOpen(false); setDateError(''); setField('expected_return_date', ''); }}
                              style={{
                                width:'100%', textAlign:'left', padding:'8px 12px',
                                background: String(ev.id) === String(form.event_id) ? 'rgba(201,168,76,0.12)' : 'transparent',
                                border:'none', borderBottom:'1px solid rgba(255,255,255,0.05)',
                                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background='rgba(201,168,76,0.08)'}
                              onMouseLeave={e => e.currentTarget.style.background = String(ev.id) === String(form.event_id) ? 'rgba(201,168,76,0.12)' : 'transparent'}>
                              <span style={{ color:'#e8c97a', fontWeight:600, fontSize:'0.875rem' }}>{ev.name}</span>
                              <span style={{ color:'rgba(201,168,76,0.4)', fontSize:'0.65rem', fontFamily:'monospace', flexShrink:0 }}>{ev.code}</span>
                            </button>
                          ))}
                          {events.length === 0 && (
                            <p style={{ padding:'10px 12px', fontSize:'0.8rem', color:'#7878a0' }}>Không có sự kiện nào</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
              {eventError && (
                <p style={{ color:'#f87171', fontSize:'0.72rem', fontWeight:600, marginTop:'4px' }}>
                  ⚠ Vui lòng chọn sự kiện trước khi xuất kho
                </p>
              )}
            </div>
            <div>
              <label className="label">Người phụ trách *</label>
              <input className="input" required value={form.responsible_person}
                onChange={e => setField('responsible_person', e.target.value)}
                placeholder="Tên người nhận thiết bị"
                readOnly={!['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role)}
                style={{ color: '#c9a84c', fontWeight: 600, ...(!['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role) ? { cursor: 'default' } : {}) }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" style={ dateError ? { color:'#f87171' } : {} }>
                Ngày dự kiến trả <span style={{ color:'#f87171' }}>*</span>
              </label>
              <DateInput value={form.expected_return_date}
                onChange={v => { setField('expected_return_date', v); if (v) setDateError(''); }}
                min={getMinReturnDate(form.event_id)}
                className={dateError ? 'input' : 'input'}
                style={ dateError ? { border:'1.5px solid #f87171', boxShadow:'0 0 0 2px rgba(248,113,113,0.18)' } : {} } />
              {dateError && (
                <p style={{ color:'#f87171', fontSize:'0.72rem', fontWeight:600, marginTop:'4px' }}>
                  ⚠ {dateError}
                </p>
              )}
            </div>
            <div>
              <label className="label">Ghi chú</label>
              <input className="input" value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                placeholder="Ghi chú thêm..." />
            </div>
          </div>
        </div>

        {/* Equipment items */}
        <div className="card space-y-4">
          <h2 style={{ fontWeight:700, color:'var(--gold)', fontSize:'0.9rem', letterSpacing:'0.04em', textTransform:'uppercase' }}>Danh sách thiết bị xuất</h2>

          {/* Department filter */}
          <div>
            <label className="label">Lọc theo bộ phận</label>
            <div className="flex flex-wrap gap-2">
              {DEPTS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  disabled={isLocked && d.value !== deptFilter}
                  onClick={() => {
                    if (!isLocked) {
                      setDeptFilter(d.value);
                      setItems(emptyRows(10));
                      setSearchTerms(Array(10).fill(''));
                      setExpandedRows(new Set());
                    }
                  }}
                  style={{
                    padding: '6px 14px', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    border: deptFilter === d.value ? '1px solid #c9a84c' : '1px solid rgba(201,168,76,0.25)',
                    background: deptFilter === d.value ? '#c9a84c' : 'transparent',
                    color: deptFilter === d.value ? '#08080e' : '#c9a84c',
                    cursor: (isLocked && d.value !== deptFilter) ? 'not-allowed' : 'pointer',
                    opacity: (isLocked && d.value !== deptFilter) ? 0.3 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  <d.Icon size={13} strokeWidth={1.75} />
                  {d.label}
                </button>
              ))}
            </div>
            {deptCats && (
              <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:'4px' }}>
                Đang hiển thị: <strong style={{ color:'var(--gold)' }}>{deptCats.join(', ')}</strong>
              </p>
            )}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            {items.map((item, idx) => {
              const isExt = item.mode === 'ext';
              const khoSeq = items.slice(0, idx).filter(it => it.mode !== 'ext').length + 1;
              const nccSeq = items.slice(0, idx).filter(it => it.mode === 'ext').length + 1;

              /* ── EXT ROW (card layout mobile-friendly) ──────────── */
              if (isExt) {
                const filled = !!item.ext_name.trim();
                const supplierSuggestions = item.ext_supplier
                  ? visibleNCC.filter(s => s.toLowerCase().includes(item.ext_supplier.toLowerCase()) && s !== item.ext_supplier).slice(0, 6)
                  : visibleNCC.slice(0, 6);
                const catalog = item.ext_supplier ? (NCC_CATALOG[item.ext_supplier] || []) : [];
                const nameSuggestions = item.ext_name
                  ? catalog.filter(c => c.name.toLowerCase().includes(item.ext_name.toLowerCase())).slice(0, 8)
                  : [];
                const isExpanded = expandedRows.has(idx);

                return (
                  <div key={idx} style={{
                    backgroundColor:'#080e1c',
                    border:`1px solid ${filled ? 'rgba(96,165,250,0.45)' : 'rgba(96,165,250,0.18)'}`,
                    borderLeft:'3px solid #60a5fa',
                    borderRadius:'10px',
                    padding:'10px',
                  }}>

                    {/* ── Dòng 1: Badge + Nhà CC + Qty + Ngày + ✏️ + X ── */}
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px' }}>
                      <span style={{ display:'none' }}>N{nccSeq}</span>

                      {/* Supplier search */}
                      <div style={{ flex:1, position:'relative', minWidth:0 }}>
                        <input
                          style={{
                            width:'100%', height:'38px', padding:'0 10px', boxSizing:'border-box',
                            background:'rgba(96,165,250,0.07)',
                            border:`1px solid ${item.ext_supplier ? 'rgba(96,165,250,0.5)' : 'rgba(96,165,250,0.25)'}`,
                            borderRadius:'8px',
                            color: item.ext_supplier ? '#93c5fd' : 'var(--text-muted)',
                            fontSize:'0.875rem', fontWeight: item.ext_supplier ? 700 : 400, outline:'none',
                          }}
                          placeholder="Nhà cung cấp..."
                          value={item.ext_supplier}
                          onChange={e => { setItem(idx, 'ext_supplier', e.target.value); setItem(idx, 'ext_name', ''); }}
                          onFocus={() => setNccSupplierFocusIdx(idx)}
                          onBlur={() => setTimeout(() => setNccSupplierFocusIdx(v => v === idx ? -1 : v), 150)}
                        />
                        {nccSupplierFocusIdx === idx && supplierSuggestions.length > 0 && (
                          <div style={{ position:'absolute', top:'calc(100% + 3px)', left:0, right:0, zIndex:300, maxHeight:'200px', overflowY:'auto', background:'#0e0e1a', border:'1px solid rgba(96,165,250,0.4)', borderRadius:'8px', boxShadow:'0 12px 32px rgba(0,0,0,0.9)' }}>
                            {supplierSuggestions.map((s, i) => (
                              <button key={i} type="button"
                                style={{ width:'100%', textAlign:'left', padding:'10px 14px', background:'transparent', border:'none', borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer', color:'#93c5fd', fontSize:'0.9rem', fontWeight:600 }}
                                onMouseEnter={ev => ev.currentTarget.style.background='rgba(96,165,250,0.1)'}
                                onMouseLeave={ev => ev.currentTarget.style.background='transparent'}
                                onClick={() => { setItem(idx, 'ext_supplier', s); setItem(idx, 'ext_name', ''); setNccSupplierFocusIdx(-1); }}>
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Qty blue compact */}
                      <input type="number" min="1"
                        value={item.quantity}
                        onChange={e => setItem(idx, 'quantity', +e.target.value)}
                        style={{
                          flexShrink:0, width:'56px', height:'36px', padding:'0', textAlign:'center', boxSizing:'border-box',
                          background:'rgba(96,165,250,0.09)', border:'1px solid rgba(96,165,250,0.35)',
                          borderRadius:'8px', color:'#60a5fa', fontSize:'1.05rem', fontWeight:800, outline:'none',
                        }}
                      />

                      {/* Rental days gold */}
                      <div style={{
                        flexShrink:0, width:'56px', height:'36px', display:'flex', flexDirection:'column',
                        alignItems:'center', justifyContent:'center',
                        background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.45)',
                        borderRadius:'8px', overflow:'hidden', gap:'1px',
                      }}>
                        <input type="number" min="1"
                          value={item.rental_days || 1}
                          onChange={e => setItem(idx, 'rental_days', +e.target.value)}
                          style={{
                            width:'100%', border:'none', background:'transparent', outline:'none',
                            textAlign:'center', color:'#fbbf24', fontSize:'1rem', fontWeight:800,
                            padding:0, lineHeight:1,
                          }}
                        />
                        <span style={{ fontSize:'0.58rem', color:'rgba(251,191,36,0.7)', lineHeight:1, letterSpacing:'0.03em' }}>ngày</span>
                      </div>

                      {/* Notes toggle */}
                      <button type="button" onClick={() => toggleExpand(idx)}
                        style={{
                          flexShrink:0, width:'56px', height:'36px', borderRadius:'8px', cursor:'pointer',
                          border: isExpanded ? '1px solid #60a5fa' : '1px solid rgba(96,165,250,0.2)',
                          background: isExpanded ? 'rgba(96,165,250,0.2)' : 'transparent',
                          color: isExpanded ? '#60a5fa' : 'rgba(96,165,250,0.35)',
                          fontSize:'0.95rem', display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                        ✏️
                      </button>

                      {/* Delete */}
                      <button type="button" onClick={() => removeItem(idx)}
                        style={{
                          flexShrink:0, width:'56px', height:'36px', borderRadius:'8px', cursor:'pointer',
                          border:'1px solid rgba(248,113,113,0.3)', background:'transparent',
                          color:'rgba(248,113,113,0.7)', fontSize:'1rem',
                          display:'flex', alignItems:'center', justifyContent:'center',
                        }}
                        onMouseEnter={ev => { ev.currentTarget.style.background='rgba(248,113,113,0.12)'; ev.currentTarget.style.color='#f87171'; }}
                        onMouseLeave={ev => { ev.currentTarget.style.background='transparent'; ev.currentTarget.style.color='rgba(248,113,113,0.7)'; }}>
                        ✕
                      </button>
                    </div>

                    {/* ── Dòng 2: Tên thiết bị (full width) ── */}
                    <div style={{ position:'relative', marginBottom:'8px' }}>
                      <input
                        style={{
                          width:'100%', height:'42px', padding:'0 12px', boxSizing:'border-box',
                          background: filled ? 'rgba(96,165,250,0.09)' : 'rgba(255,255,255,0.04)',
                          border:`1px solid ${filled ? 'rgba(96,165,250,0.45)' : 'rgba(96,165,250,0.15)'}`,
                          borderRadius:'8px',
                          color: filled ? '#93c5fd' : 'var(--text-muted)',
                          fontWeight: filled ? 700 : 400, fontSize:'0.95rem', outline:'none',
                        }}
                        placeholder={item.ext_supplier ? `Tên thiết bị (${catalog.length} mẫu)...` : 'Tên thiết bị...'}
                        value={item.ext_name}
                        onChange={e => { setItem(idx, 'ext_name', e.target.value); setNccFocusIdx(idx); }}
                        onFocus={() => setNccFocusIdx(idx)}
                        onBlur={() => setTimeout(() => setNccFocusIdx(v => v === idx ? -1 : v), 150)}
                      />
                      {nccFocusIdx === idx && nameSuggestions.length > 0 && (
                        <div style={{ position:'absolute', top:'calc(100% + 3px)', left:0, right:0, zIndex:200, maxHeight:'220px', overflowY:'auto', background:'#0e0e1a', border:'1px solid rgba(96,165,250,0.4)', borderRadius:'8px', boxShadow:'0 12px 32px rgba(0,0,0,0.9)' }}>
                          {nameSuggestions.map((c, i) => (
                            <button key={i} type="button"
                              style={{ width:'100%', textAlign:'left', padding:'10px 14px', background:'transparent', border:'none', borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' }}
                              onMouseEnter={ev => ev.currentTarget.style.background='rgba(96,165,250,0.1)'}
                              onMouseLeave={ev => ev.currentTarget.style.background='transparent'}
                              onClick={() => { setItem(idx, 'ext_name', c.name); setNccFocusIdx(-1); }}>
                              <span style={{ color:'#93c5fd', fontWeight:600, fontSize:'0.9rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
                              <span style={{ fontSize:'0.72rem', color:'#4ade80', flexShrink:0 }}>{c.qty > 0 ? c.qty : '–'} {c.unit}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Notes expanded */}
                    {isExpanded && (
                      <div style={{ marginTop:'8px' }}>
                        <input
                          style={{ width:'100%', height:'40px', padding:'0 12px', boxSizing:'border-box', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:'8px', color:'var(--text-primary)', fontSize:'0.9rem', outline:'none' }}
                          placeholder="Ghi chú cho dòng NCC này..."
                          value={item.notes || ''}
                          onChange={e => setItem(idx, 'notes', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                );
              }

              /* ── KHO ROW (card layout mobile-friendly) ──────────── */
              const eq = equipment.find(e => String(e.id) === String(item.equipment_id));
              const isOpen = expandedRows.has(idx);
              const filled = !!item.equipment_id;

              const insertExtBelow = () => {
                setItems(prev => {
                  const next = [...prev];
                  next.splice(idx + 1, 0, { mode:'ext', equipment_id:'', quantity:1, notes:'', ext_supplier:'', ext_name:'', rental_days:1 });
                  return next;
                });
                setSearchTerms(prev => {
                  const next = [...prev];
                  next.splice(idx + 1, 0, '');
                  return next;
                });
                setExpandedRows(prev => {
                  const next = new Set();
                  prev.forEach(r => next.add(r > idx ? r + 1 : r));
                  return next;
                });
              };

              return (
                <div key={idx} style={{
                  backgroundColor:'#10101a',
                  border:`1px solid ${filled ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  borderLeft:`3px solid ${filled ? '#c9a84c' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius:'10px',
                  padding:'10px',
                }}>

                  {/* ── Layout: [#] [Search flex:1] [2×2 grid: Qty/X trên, ✏️/THUÊ dưới] ── */}
                  <div style={{ display:'flex', alignItems:'flex-start', gap:'6px' }}>
                    <span style={{
                      fontSize:'0.72rem', fontWeight:700, flexShrink:0, minWidth:'20px', textAlign:'center',
                      paddingTop:'10px',
                      color: filled ? 'var(--gold)' : 'var(--text-muted)',
                    }}>{khoSeq}</span>

                    {/* Search */}
                    <div style={{ flex:1, position:'relative', minWidth:0 }}>
                      <input
                        style={{
                          display:'block', width:'100%', height:'38px', padding:'0 10px', boxSizing:'border-box',
                          background: filled ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.04)',
                          border:`1px solid ${filled ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius:'8px',
                          color: filled ? '#f5c842' : 'var(--text-muted)',
                          fontWeight: filled ? 700 : 400, fontSize:'0.9rem', outline:'none',
                        }}
                        placeholder="Tìm thiết bị..."
                        value={searchTerms[idx]}
                        onChange={e => {
                          const t = [...searchTerms]; t[idx] = e.target.value; setSearchTerms(t);
                          setItem(idx, 'equipment_id', '');
                        }}
                      />
                      {searchTerms[idx] && !item.equipment_id && (
                        <div style={{ position:'absolute', top:'calc(100% + 3px)', left:0, right:0, zIndex:100, maxHeight:'260px', overflowY:'auto', background:'#0e0e1a', border:'1px solid rgba(201,168,76,0.4)', borderRadius:'8px', boxShadow:'0 12px 32px rgba(0,0,0,0.9)' }}>
                          {filteredEquip(searchTerms[idx], idx).map(e => {
                            const free = e.qty_available - (e.qty_reserved || 0);
                            return (
                              <button type="button" key={e.id}
                                style={{ width:'100%', textAlign:'left', padding:'10px 14px', background:'transparent', border:'none', borderBottom:'1px solid rgba(255,255,255,0.06)', cursor:'pointer', display:'block' }}
                                onMouseEnter={ev => ev.currentTarget.style.background='rgba(201,168,76,0.1)'}
                                onMouseLeave={ev => ev.currentTarget.style.background='transparent'}
                                onClick={() => {
                                  setItem(idx, 'equipment_id', e.id);
                                  const t = [...searchTerms]; t[idx] = e.name; setSearchTerms(t);
                                }}>
                                <div style={{ color:'#e8c97a', fontWeight:700, fontSize:'0.92rem', marginBottom:'4px' }}>{e.name}</div>
                                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                  <span style={{ fontSize:'0.75rem', fontWeight:700, color: free <= 0 ? '#f87171' : '#4ade80' }}>Còn {free} {e.unit}</span>
                                  {e.qty_reserved > 0 && <span style={{ fontSize:'0.72rem', color:'#fbbf24' }}>· {e.qty_reserved} đặt trước</span>}
                                  <span style={{ fontSize:'0.68rem', color:'#555570', fontFamily:'monospace', marginLeft:'auto' }}>{e.code}</span>
                                </div>
                              </button>
                            );
                          })}
                          {filteredEquip(searchTerms[idx], idx).length === 0 && (
                            <p style={{ padding:'12px 14px', fontSize:'0.85rem', color:'#7878a0' }}>Không tìm thấy</p>
                          )}
                        </div>
                      )}
                      {/* Info strip dưới search khi đã chọn */}
                      {eq && !isOpen && (() => {
                        const free = eq.qty_available - (eq.qty_reserved || 0);
                        return (
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'5px' }}>
                            <span style={{ fontSize:'0.68rem', color:'var(--text-muted)', fontFamily:'monospace' }}>{eq.code}</span>
                            <span style={{ fontSize:'0.72rem', fontWeight:700, color: free <= 0 ? '#f87171' : '#4ade80', marginLeft:'auto' }}>{free} {eq.unit}</span>
                            {eq.qty_reserved > 0 && <span style={{ fontSize:'0.65rem', color:'#fbbf24' }}>({eq.qty_reserved} đặt)</span>}
                          </div>
                        );
                      })()}
                    </div>

                    {/* 2×2 grid bên phải: [Qty][X] / [✏️][THUÊ] */}
                    <div style={{ display:'grid', gridTemplateColumns:'56px 56px', gap:'5px', flexShrink:0 }}>
                      {/* Qty */}
                      <input type="number" min="1"
                        value={item.quantity}
                        onChange={e => setItem(idx, 'quantity', +e.target.value)}
                        style={{
                          height:'36px', padding:'0', textAlign:'center', boxSizing:'border-box',
                          background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.35)',
                          borderRadius:'8px', color:'#4ade80', fontSize:'1.05rem', fontWeight:800, outline:'none',
                        }}
                      />
                      {/* Delete X */}
                      <button type="button" onClick={() => removeItem(idx)}
                        style={{
                          height:'36px', borderRadius:'8px', cursor:'pointer',
                          border:'1px solid rgba(248,113,113,0.3)', background:'transparent',
                          color:'rgba(248,113,113,0.65)', fontSize:'1rem',
                          display:'flex', alignItems:'center', justifyContent:'center',
                        }}
                        onMouseEnter={ev => { ev.currentTarget.style.background='rgba(248,113,113,0.12)'; ev.currentTarget.style.color='#f87171'; }}
                        onMouseLeave={ev => { ev.currentTarget.style.background='transparent'; ev.currentTarget.style.color='rgba(248,113,113,0.65)'; }}>
                        ✕
                      </button>
                      {/* Notes toggle ✏️ */}
                      <button type="button" onClick={() => toggleExpand(idx)}
                        style={{
                          height:'36px', borderRadius:'8px', cursor:'pointer',
                          border: isOpen ? '1px solid #c9a84c' : '1px solid rgba(201,168,76,0.2)',
                          background: isOpen ? 'rgba(201,168,76,0.18)' : 'transparent',
                          color: isOpen ? '#e8c97a' : '#4a4a6a',
                          fontSize:'0.95rem', display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                        ✏️
                      </button>
                      {/* THUÊ NCC */}
                      <button type="button" onClick={insertExtBelow}
                        style={{
                          height:'36px', borderRadius:'8px', cursor:'pointer',
                          border:'1px solid rgba(96,165,250,0.3)',
                          background:'transparent', color:'rgba(96,165,250,0.6)',
                          fontSize:'0.67rem', fontWeight:800, letterSpacing:'0.02em',
                          display:'flex', alignItems:'center', justifyContent:'center',
                        }}
                        onMouseEnter={ev => { ev.currentTarget.style.background='rgba(96,165,250,0.12)'; ev.currentTarget.style.color='#60a5fa'; }}
                        onMouseLeave={ev => { ev.currentTarget.style.background='transparent'; ev.currentTarget.style.color='rgba(96,165,250,0.6)'; }}>
                        THUÊ
                      </button>
                    </div>
                  </div>

                  {/* ── Expanded edit panel ── */}
                  {isOpen && (
                    <div style={{ marginTop:'8px', borderTop:'1px solid rgba(201,168,76,0.12)', paddingTop:'8px', background:'rgba(201,168,76,0.03)', borderRadius:'0 0 8px 8px' }}>
                      {eq && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'10px', marginBottom:'8px', fontSize:'0.7rem' }}>
                          <span style={{ color:'var(--text-muted)' }}>Mã: <span style={{ color:'var(--gold)', fontFamily:'monospace' }}>{eq.code}</span></span>
                          <span style={{ color:'var(--text-muted)' }}>ĐVT: <span style={{ color:'var(--text-primary)' }}>{eq.unit}</span></span>
                          <span style={{ color:'var(--text-muted)' }}>Tự do: <span style={{ color:'#4ade80', fontWeight:700 }}>{eq.qty_available - (eq.qty_reserved || 0)}</span></span>
                          {eq.qty_reserved > 0 && <span style={{ color:'var(--text-muted)' }}>Đặt trước: <span style={{ color:'#fbbf24', fontWeight:700 }}>{eq.qty_reserved}</span></span>}
                          <span style={{ color:'var(--text-muted)' }}>Đang dùng: <span style={{ color:'#60a5fa' }}>{eq.qty_in_use}</span></span>
                        </div>
                      )}
                      <input
                        style={{ width:'100%', height:'40px', padding:'0 12px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:'8px', color:'var(--text-primary)', fontSize:'0.9rem', outline:'none', boxSizing:'border-box' }}
                        placeholder="Ghi chú cho dòng này..."
                        value={item.notes || ''}
                        onChange={e => setItem(idx, 'notes', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button type="button" onClick={addItem}
            style={{
              width:'100%', padding:'8px', borderRadius:'8px', cursor:'pointer',
              border:'1px dashed rgba(201,168,76,0.3)', background:'transparent',
              color:'rgba(201,168,76,0.6)', fontSize:'0.8rem', fontWeight:600,
              transition:'all 0.15s',
            }}
            onMouseEnter={ev => { ev.currentTarget.style.background='rgba(201,168,76,0.07)'; ev.currentTarget.style.color='#c9a84c'; }}
            onMouseLeave={ev => { ev.currentTarget.style.background='transparent'; ev.currentTarget.style.color='rgba(201,168,76,0.6)'; }}>
            + Thêm 5 dòng
          </button>
        </div>

        {/* Thiết bị ngoài */}
        <div style={{ border: '1px solid rgba(201,168,76,0.2)', borderRadius: '10px', overflow: 'hidden' }}>
          <button type="button"
            onClick={() => setExtOpen(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: extOpen ? 'rgba(201,168,76,0.1)' : 'rgba(201,168,76,0.04)',
              border: 'none', cursor: 'pointer', transition: 'background 0.2s',
            }}>
            <span style={{ color: '#c9a84c', fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🏪 Nhà cung cấp mới
            </span>
            <span style={{ color: '#c9a84c', fontSize: '0.75rem' }}>{extOpen ? '▲ Thu lại' : '▼ Mở rộng'}</span>
          </button>

          {extOpen && (
            <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(201,168,76,0.15)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {extItems.map((row, i) => (
                  <div key={i} style={{ background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:'10px', padding:'10px' }}>
                    {/* Dòng 1: NCC + Qty + Ngày + X */}
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'6px' }}>
                      <input
                        placeholder="Nhà cung cấp *"
                        value={row.supplier}
                        onChange={e => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, supplier: e.target.value } : r))}
                        style={{
                          flex:1, height:'36px', padding:'0 10px', boxSizing:'border-box',
                          background: row.supplier ? 'rgba(96,165,250,0.07)' : 'rgba(255,255,255,0.04)',
                          border:`1px solid ${row.supplier ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.12)'}`,
                          borderRadius:'8px', color: row.supplier ? '#93c5fd' : 'var(--text-muted)',
                          fontWeight: row.supplier ? 700 : 400, fontSize:'0.875rem', outline:'none',
                        }}
                      />
                      {/* Qty */}
                      <input type="number" min="1"
                        value={row.quantity}
                        onChange={e => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, quantity: +e.target.value } : r))}
                        style={{ flexShrink:0, width:'56px', height:'36px', padding:'0', textAlign:'center', boxSizing:'border-box', background:'rgba(96,165,250,0.09)', border:'1px solid rgba(96,165,250,0.35)', borderRadius:'8px', color:'#60a5fa', fontSize:'1rem', fontWeight:800, outline:'none' }}
                      />
                      {/* Ngày */}
                      <div style={{ flexShrink:0, width:'56px', height:'36px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.45)', borderRadius:'8px', overflow:'hidden', gap:'1px' }}>
                        <input type="number" min="1"
                          value={row.rental_days || 1}
                          onChange={e => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, rental_days: +e.target.value } : r))}
                          style={{ width:'100%', border:'none', background:'transparent', outline:'none', textAlign:'center', color:'#fbbf24', fontSize:'0.95rem', fontWeight:800, padding:0, lineHeight:1 }}
                        />
                        <span style={{ fontSize:'0.55rem', color:'rgba(251,191,36,0.7)', lineHeight:1 }}>ngày</span>
                      </div>
                      {/* X */}
                      <button type="button" onClick={() => setExtItems(prev => prev.filter((_, j) => j !== i))}
                        style={{ flexShrink:0, width:'56px', height:'36px', background:'rgba(229,62,62,0.1)', border:'1px solid rgba(229,62,62,0.3)', borderRadius:'8px', color:'#fc8181', cursor:'pointer', fontSize:'0.9rem', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        ✕
                      </button>
                    </div>
                    {/* Dòng 2: Tên thiết bị */}
                    <input
                      placeholder="Tên thiết bị *"
                      value={row.name}
                      onChange={e => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                      style={{
                        width:'100%', height:'38px', padding:'0 10px', boxSizing:'border-box',
                        background: row.name ? 'rgba(96,165,250,0.09)' : 'rgba(255,255,255,0.04)',
                        border:`1px solid ${row.name ? 'rgba(96,165,250,0.4)' : 'rgba(96,165,250,0.15)'}`,
                        borderRadius:'8px', color: row.name ? '#93c5fd' : 'var(--text-muted)',
                        fontWeight: row.name ? 700 : 400, fontSize:'0.9rem', outline:'none',
                      }}
                    />
                  </div>
                ))}
              </div>

              <button type="button" onClick={() => setExtItems(prev => [...prev, emptyExtRow()])}
                style={{ marginTop: '8px', fontSize: '0.8rem', color: '#c9a84c', background: 'none', border: '1px dashed rgba(201,168,76,0.3)', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', width: '100%' }}>
                + Thêm thiết bị ngoài
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Đang xuất...' : '⬆️ Xác nhận xuất kho'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Hủy</button>
        </div>
      </form>
    </div>
  );
}
