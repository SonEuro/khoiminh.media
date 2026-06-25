import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { printSlip, previewSlip } from '../utils/printSlip';
import DateInput from '../components/DateInput';
import { LayoutGrid, Clapperboard, Headphones, Theater, Package } from 'lucide-react';

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

const emptyRows = (n = 10) => Array.from({ length: n }, () => ({ mode: 'kho', equipment_id: '', quantity: 1, notes: '', ext_supplier: '', ext_name: '' }));

// ── Danh sách nhà cung cấp (thêm tên vào đây) ─────────────────────────────
const SUPPLIERS = [];
const emptyExtRow = () => ({ name: '', quantity: 1, notes: '' });

export default function ExportForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const defaultDept = ROLE_DEPT[user?.role] || '';
  const isLocked = LOCKED_ROLES.includes(user?.role);

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
  const [submitting, setSubmitting] = useState(false);
  const [doneSlip, setDoneSlip]     = useState(null);
  const savedSnapshot = useRef(null);

  // Thiết bị ngoài
  const [extOpen,     setExtOpen]     = useState(false);
  const [extSupplier, setExtSupplier] = useState('');
  const [extCustom,   setExtCustom]   = useState('');
  const [extItems,    setExtItems]    = useState([emptyExtRow()]);

  useEffect(() => {
    api.getEquipment().then(setEquipment);
    api.getEvents().then(setEvents);
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
      .map(it => ({ name: it.ext_name.trim(), supplier: it.ext_supplier.trim(), quantity: it.quantity, notes: it.notes || '' }));
    const supplier = extSupplier === '__custom__' ? extCustom.trim() : extSupplier;
    const sectionExt = extOpen ? extItems.filter(i => i.name.trim()).map(i => ({ ...i, supplier })) : [];
    const validExt = [...rowExt, ...sectionExt];
    if (validItems.length === 0 && validExt.length === 0) { alert('Chưa chọn thiết bị nào'); return; }
    savedSnapshot.current = { form, items, searchTerms, deptFilter, extOpen, extSupplier, extCustom, extItems };
    setSubmitting(true);
    try {
      const res = await api.createOut({ ...form, items: validItems, external_items: validExt });
      // Load full transaction for printing
      const full = await api.getTransactionById(res.id);
      setDoneSlip(full);
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
          <div className="text-5xl">✅</div>
          <h2 style={{ color:'#4ade80', fontSize:'1.2rem', fontWeight:700 }}>Xuất kho thành công!</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>
            Phiếu <strong style={{ color:'var(--gold)', fontFamily:'monospace' }}>{doneSlip.code}</strong> đã được tạo
            với <strong style={{ color:'var(--text-primary)' }}>{doneSlip.items?.length}</strong> loại thiết bị.
          </p>

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
              <label className="label">Sự kiện / Dự án *</label>
              <select className="input" required value={form.event_id} onChange={e => setField('event_id', e.target.value)}>
                <option value="">-- Chọn sự kiện --</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name} · {ev.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Người phụ trách *</label>
              <input className="input" required value={form.responsible_person}
                onChange={e => setField('responsible_person', e.target.value)}
                placeholder="Tên người nhận thiết bị"
                readOnly={user?.role !== 'SUPER_ADMIN'}
                style={{ color: '#c9a84c', fontWeight: 600, ...(user?.role !== 'SUPER_ADMIN' ? { cursor: 'default' } : {}) }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Ngày dự kiến trả</label>
              <DateInput value={form.expected_return_date}
                onChange={v => setField('expected_return_date', v)}
                min={new Date().toISOString().slice(0,10)} />
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
              const H = 38;

              /* ── EXT ROW ─────────────────────────────────────────── */
              if (isExt) {
                const filled = !!item.ext_name.trim();
                return (
                  <div key={idx} style={{
                    backgroundColor:'#080e1c',
                    border:`1px solid ${filled ? 'rgba(96,165,250,0.45)' : 'rgba(96,165,250,0.18)'}`,
                    borderLeft:'3px solid #60a5fa',
                    borderRadius:'8px',
                  }}>
                    <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 62px 34px', gap:'6px', alignItems:'center', padding:'7px 8px' }}>
                      {/* Icon */}
                      <span style={{ textAlign:'center', fontSize:'0.85rem', lineHeight:`${H}px` }}>🏪</span>

                      {/* Nhà CC + Tên TB */}
                      <div style={{ display:'flex', gap:'4px', height:`${H}px` }}>
                        <input
                          style={{
                            flex:'0 0 36%', height:`${H}px`, padding:'0 8px', boxSizing:'border-box',
                            background:'rgba(96,165,250,0.07)', border:'1px solid rgba(96,165,250,0.28)',
                            borderRadius:'7px', color:'#93c5fd', fontSize:'0.78rem', outline:'none',
                          }}
                          placeholder="Nhà CC..."
                          value={item.ext_supplier}
                          onChange={e => setItem(idx, 'ext_supplier', e.target.value)}
                        />
                        <input
                          style={{
                            flex:1, height:`${H}px`, padding:'0 8px', boxSizing:'border-box',
                            background: filled ? 'rgba(96,165,250,0.09)' : 'rgba(255,255,255,0.04)',
                            border:`1px solid ${filled ? 'rgba(96,165,250,0.4)' : 'rgba(96,165,250,0.15)'}`,
                            borderRadius:'7px', color: filled ? '#93c5fd' : 'var(--text-muted)',
                            fontWeight: filled ? 700 : 400, fontSize:'0.875rem', outline:'none',
                          }}
                          placeholder="Tên thiết bị thuê..."
                          value={item.ext_name}
                          onChange={e => setItem(idx, 'ext_name', e.target.value)}
                        />
                      </div>

                      {/* Blue qty */}
                      <input type="number" min="1"
                        value={item.quantity}
                        onChange={e => setItem(idx, 'quantity', +e.target.value)}
                        style={{
                          display:'block', width:'100%', height:`${H}px`, padding:'0',
                          textAlign:'center', boxSizing:'border-box',
                          background:'rgba(96,165,250,0.09)', border:'1px solid rgba(96,165,250,0.35)',
                          borderRadius:'7px', color:'#60a5fa', fontSize:'1rem', fontWeight:800, outline:'none',
                        }}
                      />

                      {/* Delete */}
                      <button type="button" onClick={() => removeItem(idx)}
                        style={{
                          width:'34px', height:`${H}px`, borderRadius:'7px', cursor:'pointer',
                          border:'1px solid rgba(248,113,113,0.25)', background:'transparent',
                          color:'rgba(248,113,113,0.6)', fontSize:'0.9rem',
                          display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s',
                        }}
                        onMouseEnter={ev => { ev.currentTarget.style.background='rgba(248,113,113,0.12)'; ev.currentTarget.style.color='#f87171'; }}
                        onMouseLeave={ev => { ev.currentTarget.style.background='transparent'; ev.currentTarget.style.color='rgba(248,113,113,0.6)'; }}>
                        ✕
                      </button>
                    </div>
                  </div>
                );
              }

              /* ── KHO ROW ─────────────────────────────────────────── */
              const eq = equipment.find(e => String(e.id) === String(item.equipment_id));
              const isOpen = expandedRows.has(idx);
              const filled = !!item.equipment_id;

              const insertExtBelow = () => {
                setItems(prev => {
                  const next = [...prev];
                  next.splice(idx + 1, 0, { mode:'ext', equipment_id:'', quantity:1, notes:'', ext_supplier:'', ext_name:'' });
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
                  borderRadius:'8px',
                }}>
                  {/* ── Main row ── */}
                  <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 62px 34px 44px 34px', gap:'6px', alignItems:'center', padding:'7px 8px' }}>

                    {/* STT */}
                    <span style={{ textAlign:'center', fontSize:'0.72rem', fontWeight:700, color: filled ? 'var(--gold)' : 'var(--text-muted)', lineHeight:`${H}px` }}>
                      {idx + 1}
                    </span>

                    {/* Search */}
                    <div style={{ position:'relative' }}>
                      <input
                        style={{
                          display:'block', width:'100%', height:`${H}px`, padding:'0 10px',
                          background: filled ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.04)',
                          border:`1px solid ${filled ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius:'7px',
                          color: filled ? '#f5c842' : 'var(--text-muted)',
                          fontWeight: filled ? 700 : 400, fontSize:'0.875rem',
                          outline:'none', boxSizing:'border-box',
                        }}
                        placeholder="Tìm thiết bị..."
                        value={searchTerms[idx]}
                        onChange={e => {
                          const t = [...searchTerms]; t[idx] = e.target.value; setSearchTerms(t);
                          setItem(idx, 'equipment_id', '');
                        }}
                      />
                      {searchTerms[idx] && !item.equipment_id && (
                        <div style={{ position:'absolute', top:'calc(100% + 3px)', left:0, right:0, zIndex:100, maxHeight:'220px', overflowY:'auto', background:'#0e0e1a', border:'1px solid rgba(201,168,76,0.4)', borderRadius:'8px', boxShadow:'0 12px 32px rgba(0,0,0,0.9)' }}>
                          {filteredEquip(searchTerms[idx], idx).map(e => (
                            <button type="button" key={e.id}
                              style={{ width:'100%', textAlign:'left', padding:'8px 12px', background:'transparent', border:'none', borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px' }}
                              onMouseEnter={ev => ev.currentTarget.style.background='rgba(201,168,76,0.1)'}
                              onMouseLeave={ev => ev.currentTarget.style.background='transparent'}
                              onClick={() => {
                                setItem(idx, 'equipment_id', e.id);
                                const t = [...searchTerms]; t[idx] = e.name; setSearchTerms(t);
                              }}>
                              <span style={{ color:'#e8c97a', fontWeight:700, fontSize:'0.83rem', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.name}</span>
                              <span style={{ fontSize:'0.7rem', fontWeight:700, color: e.qty_available === 0 ? '#f87171' : '#4ade80', flexShrink:0 }}>
                                {e.qty_available} {e.unit}
                              </span>
                            </button>
                          ))}
                          {filteredEquip(searchTerms[idx], idx).length === 0 && (
                            <p style={{ padding:'10px 12px', fontSize:'0.8rem', color:'#7878a0' }}>Không tìm thấy</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quantity */}
                    <input type="number" min="1"
                      value={item.quantity}
                      onChange={e => setItem(idx, 'quantity', +e.target.value)}
                      style={{
                        display:'block', width:'100%', height:`${H}px`, padding:'0',
                        textAlign:'center', boxSizing:'border-box',
                        background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.35)',
                        borderRadius:'7px', color:'#4ade80', fontSize:'1rem', fontWeight:800, outline:'none',
                      }}
                    />

                    {/* Edit toggle */}
                    <button type="button" onClick={() => toggleExpand(idx)}
                      style={{
                        width:'34px', height:`${H}px`, borderRadius:'7px', cursor:'pointer', flexShrink:0,
                        border: isOpen ? '1px solid #c9a84c' : '1px solid rgba(201,168,76,0.2)',
                        background: isOpen ? 'rgba(201,168,76,0.2)' : 'transparent',
                        color: isOpen ? '#e8c97a' : '#5a5a7a',
                        fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s',
                      }}>
                      ✏️
                    </button>

                    {/* THUÊ — insert ext row below */}
                    <button type="button" onClick={insertExtBelow}
                      style={{
                        width:'44px', height:`${H}px`, borderRadius:'7px', cursor:'pointer', flexShrink:0,
                        border:'1px solid rgba(96,165,250,0.28)',
                        background:'transparent', color:'rgba(96,165,250,0.5)',
                        fontSize:'0.6rem', fontWeight:800, letterSpacing:'0.02em',
                        display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s',
                      }}
                      onMouseEnter={ev => { ev.currentTarget.style.background='rgba(96,165,250,0.12)'; ev.currentTarget.style.color='#60a5fa'; }}
                      onMouseLeave={ev => { ev.currentTarget.style.background='transparent'; ev.currentTarget.style.color='rgba(96,165,250,0.5)'; }}>
                      THUÊ
                    </button>

                    {/* Delete */}
                    <button type="button" onClick={() => removeItem(idx)}
                      style={{
                        width:'34px', height:`${H}px`, borderRadius:'7px', cursor:'pointer', flexShrink:0,
                        border:'1px solid rgba(248,113,113,0.25)', background:'transparent',
                        color:'rgba(248,113,113,0.6)', fontSize:'0.9rem',
                        display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s',
                      }}
                      onMouseEnter={ev => { ev.currentTarget.style.background='rgba(248,113,113,0.12)'; ev.currentTarget.style.color='#f87171'; }}
                      onMouseLeave={ev => { ev.currentTarget.style.background='transparent'; ev.currentTarget.style.color='rgba(248,113,113,0.6)'; }}>
                      ✕
                    </button>
                  </div>

                  {/* ── Info strip ── */}
                  {eq && !isOpen && (
                    <div style={{ padding:'0 8px 6px 44px', display:'flex', alignItems:'center', gap:'6px' }}>
                      <span style={{ fontSize:'0.68rem', color:'var(--text-muted)' }}>{eq.code}</span>
                      <span style={{ fontSize:'0.68rem', color:'rgba(201,168,76,0.5)' }}>·</span>
                      <span style={{ fontSize:'0.68rem', color:'var(--text-muted)' }}>{eq.category_code}</span>
                      <span style={{ fontSize:'0.68rem', color:'rgba(201,168,76,0.5)', marginLeft:'auto' }}>còn</span>
                      <span style={{ fontSize:'0.72rem', fontWeight:700, color: eq.qty_available === 0 ? '#f87171' : '#4ade80' }}>{eq.qty_available} {eq.unit}</span>
                    </div>
                  )}

                  {/* ── Expanded edit panel ── */}
                  {isOpen && (
                    <div style={{ borderTop:'1px solid rgba(201,168,76,0.12)', padding:'10px 10px 10px 44px', background:'rgba(201,168,76,0.04)', borderRadius:'0 0 8px 8px' }}>
                      {eq && (
                        <div style={{ display:'flex', gap:'12px', marginBottom:'8px', fontSize:'0.7rem' }}>
                          <span style={{ color:'var(--text-muted)' }}>Mã: <span style={{ color:'var(--gold)', fontFamily:'monospace' }}>{eq.code}</span></span>
                          <span style={{ color:'var(--text-muted)' }}>ĐVT: <span style={{ color:'var(--text-primary)' }}>{eq.unit}</span></span>
                          <span style={{ color:'var(--text-muted)' }}>Có sẵn: <span style={{ color:'#4ade80', fontWeight:700 }}>{eq.qty_available}</span></span>
                          <span style={{ color:'var(--text-muted)' }}>Đang dùng: <span style={{ color:'#60a5fa' }}>{eq.qty_in_use}</span></span>
                        </div>
                      )}
                      <input
                        style={{ width:'100%', height:'34px', padding:'0 10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:'7px', color:'var(--text-primary)', fontSize:'0.82rem', outline:'none', boxSizing:'border-box' }}
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
              🏪 Thiết bị ngoài
            </span>
            <span style={{ color: '#c9a84c', fontSize: '0.75rem' }}>{extOpen ? '▲ Thu lại' : '▼ Mở rộng'}</span>
          </button>

          {extOpen && (
            <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(201,168,76,0.15)' }}>
              {/* Nhà cung cấp */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#c9a84c', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
                  Nhà cung cấp
                </label>
                {SUPPLIERS.length > 0 ? (
                  <>
                    <select className="input" value={extSupplier} onChange={e => setExtSupplier(e.target.value)}>
                      <option value="">— Chọn nhà cung cấp —</option>
                      {SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
                      <option value="__custom__">✏️ Nhập thủ công...</option>
                    </select>
                    {extSupplier === '__custom__' && (
                      <input className="input mt-2" placeholder="Tên nhà cung cấp..."
                        value={extCustom} onChange={e => setExtCustom(e.target.value)} />
                    )}
                  </>
                ) : (
                  <input className="input" placeholder="Tên nhà cung cấp..."
                    value={extSupplier} onChange={e => setExtSupplier(e.target.value)} />
                )}
              </div>

              {/* Danh sách thiết bị ngoài */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {extItems.map((row, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 28px', gap: '6px', alignItems: 'center' }}>
                    <input className="input" placeholder="Tên thiết bị..."
                      value={row.name} onChange={e => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} />
                    <input className="input" type="number" min="1" placeholder="SL"
                      value={row.quantity} onChange={e => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, quantity: +e.target.value } : r))}
                      style={{ textAlign: 'center' }} />
                    <button type="button" onClick={() => setExtItems(prev => prev.filter((_, j) => j !== i))}
                      style={{ width: '28px', height: '38px', background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.25)', borderRadius: '6px', color: '#fc8181', cursor: 'pointer', fontSize: '0.75rem' }}>
                      ✕
                    </button>
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
