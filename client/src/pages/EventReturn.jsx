import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { printSlip } from '../utils/printSlip';
import DateInput from '../components/DateInput';
import { LayoutGrid, Clapperboard, Headphones, Theater, Package } from 'lucide-react';
import { fmtD } from '../utils/fmt';

const DEPT_CATS = {
  SUPER_ADMIN: null, PRODUCTION: null, ACCOUNTING: null,
  TECHNICAL: ['TECH'],
  ATAS:      ['AUDIO','LIGHT','LED','MATRIX'],
  STAGE:     ['STAGE'],
  CSVC:      ['CSVC'],
};
const DEPT_OPTIONS = [
  { value: '',      Icon: LayoutGrid,   label: 'Tất cả',   cats: null },
  { value: 'TECH',  Icon: Clapperboard, label: 'Kỹ Thuật', cats: ['TECH'] },
  { value: 'ATAS',  Icon: Headphones,   label: 'ATAS',     cats: ['AUDIO','LIGHT','LED','MATRIX'] },
  { value: 'STAGE', Icon: Theater,      label: 'Sân Khấu', cats: ['STAGE'] },
  { value: 'CSVC',  Icon: Package,      label: 'CSVC',     cats: ['CSVC'] },
];

const COND_OPTS = [
  { value: 'good',        label: '✅ Tốt' },
  { value: 'damaged',     label: '⚠️ Hỏng' },
  { value: 'maintenance', label: '🔧 Cần sửa' },
  { value: 'lost',        label: '❌ Mất' },
];

export default function EventReturn() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const allowedCats = DEPT_CATS[user?.role] ?? null;

  const defaultDept = Object.entries(DEPT_CATS).find(([k]) => k === user?.role)?.[1]
    ? DEPT_OPTIONS.find(d => d.cats?.some(c => allowedCats?.includes(c)))?.value ?? ''
    : '';
  const isLocked = allowedCats !== null;

  // Header filters
  const [events,        setEvents]       = useState([]);
  const [eventSearch,   setEventSearch]  = useState('');
  const [eventId,       setEventId]      = useState('');
  const [eventName,     setEventName]    = useState('');
  const [showEvSuggest, setShowEvSuggest] = useState(false);
  const [deptFilter,    setDeptFilter]   = useState(defaultDept);
  const [person,        setPerson]       = useState(user?.full_name || '');
  const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const [returnDate,    setReturnDate]   = useState(todayVN);

  // Pending returns list
  const [pendingReturns,  setPendingReturns]  = useState([]);
  const [loadingPending,  setLoadingPending]  = useState(true);

  // Outstanding KHO items
  const [outstanding,  setOutstanding]  = useState([]);
  const [quantities,   setQuantities]   = useState({});   // equipment_id → qty
  const [conditions,   setConditions]   = useState({});   // equipment_id → condition
  const [itemNotes,    setItemNotes]    = useState({});   // equipment_id → notes
  const [checked,      setChecked]      = useState(new Set());
  const [loading,      setLoading]      = useState(false);

  // Outstanding NCC/ext items
  const [outstandingExt,  setOutstandingExt]  = useState([]);
  const [extQty,          setExtQty]          = useState({});   // `${supplier}|${name}` → qty
  const [extNotes,        setExtNotes]        = useState({});   // key → notes
  const [checkedExt,      setCheckedExt]      = useState(new Set());

  const [submitting,   setSubmitting]   = useState(false);
  const [done,         setDone]         = useState(null);

  const extKey = (r) => `${r.supplier}|${r.name}`;

  const loadPending = () => {
    setLoadingPending(true);
    api.getPendingReturns().then(setPendingReturns).catch(() => {}).finally(() => setLoadingPending(false));
  };

  useEffect(() => { api.getEvents().then(setEvents); loadPending(); }, []);

  // Load outstanding when event selected
  useEffect(() => {
    if (!eventId) { setOutstanding([]); setOutstandingExt([]); return; }
    setLoading(true);
    Promise.all([
      api.getOutstanding(eventId),
      api.getOutstandingExt(eventId),
    ]).then(([rows, extRows]) => {
      setOutstanding(rows);
      const q = {}, c = {};
      rows.forEach(r => { q[r.equipment_id] = r.qty_pending; c[r.equipment_id] = 'good'; });
      setQuantities(q); setConditions(c);
      setChecked(new Set(rows.map(r => r.equipment_id)));

      setOutstandingExt(extRows);
      const eq = {};
      extRows.forEach(r => { eq[extKey(r)] = r.qty_pending; });
      setExtQty(eq);
      setCheckedExt(new Set(extRows.map(extKey)));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [eventId]);

  const deptCats = DEPT_OPTIONS.find(d => d.value === deptFilter)?.cats ?? null;

  const visibleItems = deptCats
    ? outstanding.filter(r => deptCats.includes(r.category_code))
    : outstanding;

  // Show all events when focused, filter when typing
  const eventSuggestions = showEvSuggest
    ? (eventSearch.trim().length >= 1
        ? events.filter(e => e.name.toLowerCase().includes(eventSearch.toLowerCase()))
        : events
      ).slice(0, 8)
    : [];

  const selectEvent = (ev) => {
    setEventId(ev.event_id);
    setEventName(ev.event_name);
    setEventSearch(ev.event_name);
    setShowEvSuggest(false);
  };

  const toggleCheck = (id) => setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const hasKhoItems = visibleItems.some(r => checked.has(r.equipment_id) && (quantities[r.equipment_id] || 0) > 0);
  const hasExtItems = outstandingExt.some(r => checkedExt.has(extKey(r)) && (extQty[extKey(r)] || 0) > 0);
  const canSubmit = eventId && person && (hasKhoItems || hasExtItems);

  const submit = async () => {
    if (!canSubmit) return;
    const items = visibleItems
      .filter(r => checked.has(r.equipment_id) && (quantities[r.equipment_id] || 0) > 0)
      .map(r => ({
        equipment_id: r.equipment_id,
        quantity:     Math.max(0, parseInt(quantities[r.equipment_id]) || 0),
        condition:    conditions[r.equipment_id] || 'good',
        notes:        itemNotes[r.equipment_id] || '',
      }));
    const external_items = outstandingExt
      .filter(r => checkedExt.has(extKey(r)) && (extQty[extKey(r)] || 0) > 0)
      .map(r => ({
        supplier:    r.supplier,
        name:        r.name,
        quantity:    Math.max(0, parseInt(extQty[extKey(r)]) || 0),
        unit:        r.unit || 'Cái',
        rental_days: r.rental_days || 1,
        notes:       extNotes[extKey(r)] || '',
      }));
    setSubmitting(true);
    try {
      const res = await api.createReturn({ event_id: eventId, responsible_person: person, notes: '', items, external_items, transaction_date: returnDate });
      const full = await api.getTransactionById(res.id);
      setDone(full);
      loadPending();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Done screen ──────────────────────────────────────────
  if (done) {
    return (
      <div onClick={() => navigate('/')} style={{ minHeight:'100vh', width:'100%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
        <div className="card text-center space-y-5" onClick={e => e.stopPropagation()} style={{ maxWidth:'420px', width:'100%', margin:'0 16px' }}>
          <div className="text-5xl">✅</div>
          <h2 style={{ color:'#4ade80', fontSize:'1.2rem', fontWeight:700 }}>Nhập kho thành công!</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>
            Phiếu <strong style={{ color:'var(--gold)', fontFamily:'monospace' }}>{done.code}</strong> —{' '}
            <strong style={{ color:'var(--text-primary)' }}>{(done.items?.length || 0) + (done.external_items?.length || 0)}</strong> loại thiết bị
            {done.external_items?.length > 0 ? ` (${done.external_items.length} NCC)` : ''}.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => printSlip(done)} className="btn-primary">🖨️ In phiếu</button>
            <button onClick={() => navigate('/transactions')} className="btn-secondary">Xem lịch sử</button>
          </div>
          <button onClick={() => { setDone(null); setEventId(''); setEventSearch(''); setEventName(''); setOutstanding([]); }}
            style={{ color:'var(--text-muted)', fontSize:'0.8rem', background:'none', border:'none', cursor:'pointer' }}>
            + Nhập kho sự kiện khác
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Nhập Kho Sự Kiện</h1>
        <p style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>Trả thiết bị sau sự kiện về kho</p>
      </div>

      {/* ── Phiếu xuất chưa nhập kho ─────────────────── */}
      {!eventId && (
        <div className="card p-0 overflow-hidden mb-5">
          <div style={{
            padding:'12px 20px', borderBottom:'1px solid rgba(201,168,76,0.2)',
            display:'flex', alignItems:'center', gap:'10px',
          }}>
            <span style={{ fontWeight:700, color:'var(--gold)', fontSize:'0.875rem' }}>
              📋 Phiếu xuất chưa nhập kho
            </span>
            {!loadingPending && (
              <span style={{
                fontSize:'0.7rem', fontWeight:700, padding:'2px 8px', borderRadius:'9999px',
                background: pendingReturns.length > 0 ? 'rgba(251,191,36,0.15)' : 'rgba(74,222,128,0.12)',
                color: pendingReturns.length > 0 ? '#fbbf24' : '#4ade80',
              }}>
                {pendingReturns.length > 0 ? `${pendingReturns.length} sự kiện` : 'Đã nhập hết'}
              </span>
            )}
          </div>

          {loadingPending && (
            <div style={{ padding:'24px', textAlign:'center', color:'var(--text-muted)', fontSize:'0.85rem' }}>
              Đang tải...
            </div>
          )}

          {!loadingPending && pendingReturns.length === 0 && (
            <div style={{ padding:'28px', textAlign:'center' }}>
              <p style={{ fontSize:'2rem', marginBottom:'6px' }}>✅</p>
              <p style={{ color:'#4ade80', fontWeight:600, fontSize:'0.875rem' }}>
                Tất cả thiết bị đã được nhập kho!
              </p>
            </div>
          )}

          {!loadingPending && pendingReturns.map((row, i) => (
            <button
              key={row.event_id}
              type="button"
              onClick={() => selectEvent(row)}
              style={{
                width:'100%', textAlign:'left',
                padding:'11px 20px',
                background:'transparent', border:'none', cursor:'pointer',
                borderBottom: i < pendingReturns.length - 1 ? '1px solid rgba(201,168,76,0.08)' : 'none',
                display:'flex', alignItems:'center', gap:'14px',
                transition:'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(201,168,76,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}
            >
              {/* Left: event info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                  <span style={{ color:'#c9a84c', fontWeight:700, fontSize:'0.875rem' }}>
                    {row.event_name}
                  </span>
                  <span style={{ fontFamily:'monospace', fontSize:'0.68rem', color:'#7878a0' }}>
                    {row.event_code}
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'3px', flexWrap:'wrap' }}>
                  {row.start_date && (
                    <span style={{ fontSize:'0.7rem', color:'#7878a0' }}>📅 {fmtD(row.start_date)}</span>
                  )}
                  {row.out_codes && (
                    <span style={{ fontSize:'0.68rem', color:'#555570', fontFamily:'monospace' }}>
                      {row.out_codes.split(',').map(c => c.trim()).slice(0, 3).join(', ')}
                      {row.out_codes.split(',').length > 3 ? ' ...' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Right: badge */}
              <div style={{
                flexShrink:0, textAlign:'right',
                fontSize:'0.75rem', fontWeight:700,
                background:'rgba(248,113,113,0.12)', color:'#f87171',
                padding:'4px 12px', borderRadius:'9999px', whiteSpace:'nowrap',
              }}>
                {row.item_types} loại · {row.total_pending} cái
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Filter card ─────────────────────────────────── */}
      <div className="card space-y-4 mb-5" style={{ overflow: 'visible' }}>

        {/* Back to list button when event selected */}
        {eventId && (
          <button
            type="button"
            onClick={() => { setEventId(''); setEventName(''); setEventSearch(''); setOutstanding([]); }}
            style={{
              display:'inline-flex', alignItems:'center', gap:'6px',
              fontSize:'0.78rem', color:'var(--text-muted)',
              background:'none', border:'none', cursor:'pointer', padding:'0',
            }}
          >
            ← Quay lại danh sách phiếu xuất
          </button>
        )}

        {/* Event search */}
        <div style={{ position:'relative', zIndex: 100 }}>
          <label className="label">Tên sự kiện *</label>
          <input
            className="input eq-search bold-input"
            placeholder="Tìm sự kiện..."
            value={eventSearch}
            autoComplete="off"
            onChange={e => { setEventSearch(e.target.value); setEventId(''); setEventName(''); setShowEvSuggest(true); }}
            onFocus={() => setShowEvSuggest(true)}
            onBlur={() => setTimeout(() => setShowEvSuggest(false), 150)}
          />
          {eventId && (
            <p style={{ fontSize:'0.75rem', color:'#4ade80', marginTop:'4px' }}>
              ✅ {eventName}
            </p>
          )}
          {showEvSuggest && eventSuggestions.length > 0 && (
            <div style={{
              position:'absolute', top:'100%', left:0, right:0, zIndex:200,
              background:'#13131d', border:'1px solid rgba(201,168,76,0.3)',
              borderRadius:'0.5rem', boxShadow:'0 8px 24px rgba(0,0,0,0.6)', marginTop:'4px',
            }}>
              {eventSuggestions.map(ev => (
                <button key={ev.id} type="button"
                  onMouseDown={() => { setEventId(ev.id); setEventName(ev.name); setEventSearch(ev.name); setShowEvSuggest(false); }}
                  style={{
                    width:'100%', textAlign:'left', padding:'9px 12px',
                    background:'transparent', border:'none', cursor:'pointer',
                    borderBottom:'1px solid rgba(201,168,76,0.08)',
                    display:'flex', alignItems:'center', gap:'10px',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(201,168,76,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  <span style={{ fontFamily:'monospace', fontSize:'0.7rem', color:'#7878a0' }}>{ev.code}</span>
                  <span style={{ color:'#c9a84c', fontWeight:600 }}>{ev.name}</span>
                  {ev.start_date && <span style={{ fontSize:'0.7rem', color:'#7878a0', marginLeft:'auto' }}>{fmtD(ev.start_date)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dept + Person + Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Người nhập kho *</label>
            <input className="input bold-input" placeholder="Tên người nhập..."
              value={person} onChange={e => setPerson(e.target.value)}
              readOnly={!['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role)}
              style={!['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role) ? { opacity: 0.6, cursor: 'default' } : {}} />
          </div>
          <div>
            <label className="label">Ngày nhập kho</label>
            <DateInput value={returnDate} onChange={setReturnDate} min={todayVN} />
          </div>
        </div>

        {/* Dept pills */}
        <div>
          <label className="label">Lọc bộ phận</label>
          <div className="flex flex-wrap gap-2">
            {DEPT_OPTIONS.map(d => (
              <button key={d.value} type="button"
                disabled={isLocked && d.value !== deptFilter}
                onClick={() => { if (!isLocked) setDeptFilter(d.value); }}
                style={{
                  padding:'6px 14px', borderRadius:'9999px', fontSize:'0.8rem', fontWeight:600,
                  display:'inline-flex', alignItems:'center', gap:'6px',
                  border: deptFilter === d.value ? '1px solid #c9a84c' : '1px solid rgba(201,168,76,0.25)',
                  background: deptFilter === d.value ? '#c9a84c' : 'transparent',
                  color: deptFilter === d.value ? '#08080e' : '#c9a84c',
                  cursor: (isLocked && d.value !== deptFilter) ? 'not-allowed' : 'pointer',
                  opacity: (isLocked && d.value !== deptFilter) ? 0.3 : 1,
                  transition:'all 0.15s',
                }}
              ><d.Icon size={13} strokeWidth={1.75} />{d.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Outstanding items ────────────────────────────── */}
      {!eventId && (
        <div className="card text-center py-10" style={{ color:'var(--text-muted)' }}>
          <p className="text-3xl mb-2">📦</p>
          <p>Chọn sự kiện để xem thiết bị cần nhập kho</p>
        </div>
      )}

      {eventId && loading && (
        <div className="card text-center py-8" style={{ color:'var(--text-muted)' }}>Đang tải...</div>
      )}

      {eventId && !loading && outstanding.length === 0 && outstandingExt.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-3xl mb-2">📭</p>
          <p style={{ color:'var(--text-muted)', fontWeight:600, marginBottom:'6px' }}>
            Chưa có thiết bị nào được xuất cho sự kiện này.
          </p>
          <p style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>
            Hãy tạo phiếu xuất kho (ExportForm) trước, sau đó quay lại đây để nhập kho.
          </p>
        </div>
      )}
      {eventId && !loading && outstanding.length > 0 && visibleItems.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-3xl mb-2">🔍</p>
          <p style={{ color:'var(--text-muted)', fontWeight:600 }}>Không có thiết bị của bộ phận này cần nhập kho.</p>
          <p style={{ color:'var(--text-muted)', fontSize:'0.8rem', marginTop:'4px' }}>Chọn bộ phận khác hoặc "Tất cả" để xem.</p>
        </div>
      )}

      {eventId && !loading && visibleItems.length > 0 && (
        <div className="card p-0 overflow-hidden mb-5">
          <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(201,168,76,0.2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontWeight:700, color:'var(--gold)' }}>Thiết bị chưa trả — {visibleItems.length} loại</span>
            <button type="button"
              onClick={() => { const q = {}; visibleItems.forEach(r => q[r.equipment_id] = r.qty_pending); setQuantities(prev => ({...prev, ...q})); setChecked(new Set(visibleItems.map(r => r.equipment_id))); }}
              style={{ fontSize:'0.75rem', color:'#c9a84c', background:'none', border:'1px solid rgba(201,168,76,0.3)', borderRadius:'6px', padding:'4px 10px', cursor:'pointer' }}>
              Chọn tất cả
            </button>
          </div>

          {/* ── Desktop: bảng ── */}
          <div className="return-table-wrap table-wrap">
            <table style={{ width:'100%', minWidth:'580px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign:'left', padding:'10px 14px' }}>Thiết bị</th>
                  <th style={{ textAlign:'center', padding:'10px 8px' }}>Đã xuất</th>
                  <th style={{ textAlign:'center', padding:'10px 8px' }}>Còn nợ</th>
                  <th style={{ textAlign:'center', padding:'10px 8px', minWidth:'90px' }}>Số nhập</th>
                  <th style={{ textAlign:'center', padding:'10px 8px', width:'44px' }}>✓</th>
                  <th style={{ textAlign:'center', padding:'10px 8px', minWidth:'130px' }}>Tình trạng</th>
                  <th style={{ textAlign:'left', padding:'10px 8px', minWidth:'140px' }}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map(r => (
                  <tr key={r.equipment_id}>
                    <td style={{ padding:'10px 14px' }}>
                      <p style={{ fontWeight:600, color:'#c9a84c' }}>{r.eq_name}</p>
                      <p style={{ fontSize:'0.72rem', color:'#7878a0' }}>{r.eq_code} · {r.category_code}</p>
                    </td>
                    <td style={{ textAlign:'center', padding:'10px 8px', color:'#f87171', fontWeight:700 }}>{r.qty_out} {r.unit}</td>
                    <td style={{ textAlign:'center', padding:'10px 8px' }}>
                      <span style={{ color:'#fbbf24', fontWeight:700 }}>{r.qty_pending}</span>
                    </td>
                    <td style={{ textAlign:'center', padding:'8px' }}>
                      <input type="number" min="0" max={r.qty_pending}
                        value={quantities[r.equipment_id] ?? r.qty_pending}
                        onChange={e => setQuantities(prev => ({ ...prev, [r.equipment_id]: e.target.value }))}
                        onBlur={e => setQuantities(prev => ({ ...prev, [r.equipment_id]: Math.min(Math.max(0, parseInt(e.target.value) || 0), r.qty_pending) }))}
                        style={{ width:'70px', padding:'4px 6px', textAlign:'center', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(201,168,76,0.3)', borderRadius:'6px', color:'#4ade80', fontSize:'1.1rem', fontWeight:700 }}
                      />
                    </td>
                    <td style={{ textAlign:'center', padding:'8px' }}>
                      <button type="button" onClick={() => toggleCheck(r.equipment_id)}
                        style={{ width:'70px', padding:'4px 6px', textAlign:'center', background: checked.has(r.equipment_id) ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)', border:`1px solid ${checked.has(r.equipment_id) ? 'rgba(74,222,128,0.5)' : 'rgba(201,168,76,0.3)'}`, borderRadius:'6px', cursor:'pointer', color: checked.has(r.equipment_id) ? '#4ade80' : '#555570', fontSize:'1.1rem', fontWeight:700, lineHeight:'1.4', display:'block', margin:'0 auto' }}
                      >{checked.has(r.equipment_id) ? '✓' : ''}</button>
                    </td>
                    <td style={{ textAlign:'center', padding:'8px' }}>
                      <select value={conditions[r.equipment_id] || 'good'} onChange={e => setConditions(prev => ({ ...prev, [r.equipment_id]: e.target.value }))}
                        style={{ padding:'4px 6px', fontSize:'0.78rem', fontWeight:600, background:'#13131d', border:'1px solid rgba(201,168,76,0.3)', borderRadius:'6px', color:'#e8c97a', cursor:'pointer' }}>
                        {COND_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:'8px' }}>
                      <input placeholder="Ghi chú..." value={itemNotes[r.equipment_id] || ''} onChange={e => setItemNotes(prev => ({ ...prev, [r.equipment_id]: e.target.value }))}
                        style={{ width:'100%', minWidth:'120px', padding:'4px 8px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:'6px', color:'var(--text-primary)', fontSize:'0.8rem' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile: cards ── */}
          <div className="return-card-list" style={{ padding:'10px 14px' }}>
            {visibleItems.map(r => (
              <div key={r.equipment_id} style={{ background:'rgba(201,168,76,0.04)', border:`1px solid ${checked.has(r.equipment_id) ? 'rgba(74,222,128,0.4)' : 'rgba(201,168,76,0.18)'}`, borderRadius:'10px', padding:'12px', transition:'border-color 0.15s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontWeight:700, color:'#c9a84c', margin:0, fontSize:'0.88rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.eq_name}</p>
                    <p style={{ fontSize:'0.7rem', color:'#7878a0', margin:'2px 0 0' }}>{r.eq_code} · {r.category_code}</p>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0, marginLeft:'10px' }}>
                    <p style={{ fontSize:'0.6rem', color:'#7878a0', margin:0, textTransform:'uppercase' }}>Còn nợ</p>
                    <p style={{ fontWeight:800, color:'#fbbf24', margin:'2px 0 0', fontSize:'1rem' }}>{r.qty_pending} {r.unit}</p>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'8px', alignItems:'flex-end', marginBottom:'8px' }}>
                  <div style={{ display:'flex', flexDirection:'column', gap:'3px', flex:1 }}>
                    <span style={{ fontSize:'0.62rem', color:'#7878a0', textTransform:'uppercase', letterSpacing:'0.04em' }}>Số nhập</span>
                    <input type="number" min="0" max={r.qty_pending}
                      value={quantities[r.equipment_id] ?? r.qty_pending}
                      onChange={e => setQuantities(prev => ({ ...prev, [r.equipment_id]: e.target.value }))}
                      onBlur={e => setQuantities(prev => ({ ...prev, [r.equipment_id]: Math.min(Math.max(0, parseInt(e.target.value) || 0), r.qty_pending) }))}
                      style={{ width:'100%', padding:'8px 10px', textAlign:'center', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(201,168,76,0.3)', borderRadius:'8px', color:'#4ade80', fontSize:'1.2rem', fontWeight:800, boxSizing:'border-box' }}
                    />
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'3px', flex:1 }}>
                    <span style={{ fontSize:'0.62rem', color:'#7878a0', textTransform:'uppercase', letterSpacing:'0.04em' }}>Tình trạng</span>
                    <select value={conditions[r.equipment_id] || 'good'} onChange={e => setConditions(prev => ({ ...prev, [r.equipment_id]: e.target.value }))}
                      style={{ width:'100%', padding:'8px 10px', background:'#13131d', border:'1px solid rgba(201,168,76,0.3)', borderRadius:'8px', color:'#e8c97a', cursor:'pointer', fontSize:'0.88rem', fontWeight:600, boxSizing:'border-box' }}>
                      {COND_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => toggleCheck(r.equipment_id)}
                    style={{ flex:1, padding:'8px 0', borderRadius:'8px', cursor:'pointer', background: checked.has(r.equipment_id) ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)', border:`2px solid ${checked.has(r.equipment_id) ? '#4ade80' : 'rgba(201,168,76,0.3)'}`, color: checked.has(r.equipment_id) ? '#4ade80' : '#555570', fontSize:'1.2rem', fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
                    {checked.has(r.equipment_id) ? '✓' : ''}
                  </button>
                </div>
                <input placeholder="Ghi chú..." value={itemNotes[r.equipment_id] || ''} onChange={e => setItemNotes(prev => ({ ...prev, [r.equipment_id]: e.target.value }))}
                  style={{ width:'100%', padding:'8px 10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:'8px', color:'var(--text-primary)', fontSize:'0.85rem', boxSizing:'border-box' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── NCC / Thiết bị ngoài ──────────────────────────── */}
      {eventId && !loading && outstandingExt.length > 0 && (
        <div className="card p-0 overflow-hidden mb-5">
          <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(96,165,250,0.2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontWeight:700, color:'#60a5fa', fontSize:'0.875rem' }}>🏪 Thiết bị NCC chưa trả — {outstandingExt.length} loại</span>
            <button type="button"
              onClick={() => {
                const eq = {};
                outstandingExt.forEach(r => { eq[extKey(r)] = r.qty_pending; });
                setExtQty(prev => ({ ...prev, ...eq }));
                setCheckedExt(new Set(outstandingExt.map(extKey)));
              }}
              style={{ fontSize:'0.75rem', color:'#60a5fa', background:'none', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'6px', padding:'4px 10px', cursor:'pointer' }}>
              Chọn tất cả
            </button>
          </div>
          {/* ── Desktop: bảng ── */}
          <div className="return-table-wrap table-wrap">
            <table style={{ width:'100%', minWidth:'560px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign:'left', padding:'10px 14px' }}>Thiết bị / Nhà CC</th>
                  <th style={{ textAlign:'center', padding:'10px 8px' }}>Còn nợ</th>
                  <th style={{ textAlign:'center', padding:'10px 8px', minWidth:'90px' }}>Số trả</th>
                  <th style={{ textAlign:'center', padding:'10px 8px', width:'44px' }}>✓</th>
                  <th style={{ textAlign:'left', padding:'10px 8px', minWidth:'140px' }}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {outstandingExt.map(r => {
                  const k = extKey(r);
                  return (
                    <tr key={k}>
                      <td style={{ padding:'10px 14px' }}>
                        <p style={{ fontWeight:600, color:'#93c5fd' }}>{r.name}</p>
                        <p style={{ fontSize:'0.72rem', color:'#7878a0' }}>{r.supplier} · {r.rental_days} ngày</p>
                      </td>
                      <td style={{ textAlign:'center', padding:'10px 8px' }}>
                        <span style={{ color:'#fbbf24', fontWeight:700 }}>{r.qty_pending} {r.unit}</span>
                      </td>
                      <td style={{ textAlign:'center', padding:'8px' }}>
                        <input type="number" min="0" max={r.qty_pending}
                          value={extQty[k] ?? r.qty_pending}
                          onChange={e => setExtQty(prev => ({ ...prev, [k]: e.target.value }))}
                          onBlur={e => setExtQty(prev => ({ ...prev, [k]: Math.min(Math.max(0, parseInt(e.target.value) || 0), r.qty_pending) }))}
                          style={{ width:'70px', padding:'4px 6px', textAlign:'center', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'6px', color:'#60a5fa', fontSize:'1.1rem', fontWeight:700 }}
                        />
                      </td>
                      <td style={{ textAlign:'center', padding:'8px' }}>
                        <button type="button"
                          onClick={() => setCheckedExt(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; })}
                          style={{ width:'70px', padding:'4px 6px', textAlign:'center', background: checkedExt.has(k) ? 'rgba(96,165,250,0.08)' : 'rgba(255,255,255,0.04)', border:`1px solid ${checkedExt.has(k) ? 'rgba(96,165,250,0.5)' : 'rgba(201,168,76,0.3)'}`, borderRadius:'6px', cursor:'pointer', color: checkedExt.has(k) ? '#60a5fa' : '#555570', fontSize:'1.1rem', fontWeight:700, lineHeight:'1.4', display:'block', margin:'0 auto' }}>
                          {checkedExt.has(k) ? '✓' : ''}
                        </button>
                      </td>
                      <td style={{ padding:'8px' }}>
                        <input placeholder="Ghi chú..." value={extNotes[k] || ''} onChange={e => setExtNotes(prev => ({ ...prev, [k]: e.target.value }))}
                          style={{ width:'100%', minWidth:'120px', padding:'4px 8px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:'6px', color:'var(--text-primary)', fontSize:'0.8rem' }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile: cards ── */}
          <div className="return-card-list" style={{ padding:'10px 14px' }}>
            {outstandingExt.map(r => {
              const k = extKey(r);
              return (
                <div key={k} style={{ background:'rgba(96,165,250,0.04)', border:`1px solid ${checkedExt.has(k) ? 'rgba(96,165,250,0.5)' : 'rgba(96,165,250,0.18)'}`, borderRadius:'10px', padding:'12px', transition:'border-color 0.15s' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontWeight:700, color:'#93c5fd', margin:0, fontSize:'0.88rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</p>
                      <p style={{ fontSize:'0.7rem', color:'#7878a0', margin:'2px 0 0' }}>{r.supplier} · {r.rental_days} ngày</p>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0, marginLeft:'10px' }}>
                      <p style={{ fontSize:'0.6rem', color:'#7878a0', margin:0, textTransform:'uppercase' }}>Còn nợ</p>
                      <p style={{ fontWeight:800, color:'#fbbf24', margin:'2px 0 0', fontSize:'1rem' }}>{r.qty_pending} {r.unit}</p>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'8px', alignItems:'flex-end', marginBottom:'8px' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:'3px', flex:1 }}>
                      <span style={{ fontSize:'0.62rem', color:'#7878a0', textTransform:'uppercase', letterSpacing:'0.04em' }}>Số trả</span>
                      <input type="number" min="0" max={r.qty_pending}
                        value={extQty[k] ?? r.qty_pending}
                        onChange={e => setExtQty(prev => ({ ...prev, [k]: e.target.value }))}
                        onBlur={e => setExtQty(prev => ({ ...prev, [k]: Math.min(Math.max(0, parseInt(e.target.value) || 0), r.qty_pending) }))}
                        style={{ width:'100%', padding:'8px 10px', textAlign:'center', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'8px', color:'#60a5fa', fontSize:'1.2rem', fontWeight:800, boxSizing:'border-box' }}
                      />
                    </div>
                    <button type="button"
                      onClick={() => setCheckedExt(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; })}
                      style={{ flex:1, padding:'8px 0', borderRadius:'8px', cursor:'pointer', background: checkedExt.has(k) ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)', border:`2px solid ${checkedExt.has(k) ? '#60a5fa' : 'rgba(201,168,76,0.3)'}`, color: checkedExt.has(k) ? '#60a5fa' : '#555570', fontSize:'1.2rem', fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
                      {checkedExt.has(k) ? '✓' : ''}
                    </button>
                  </div>
                  <input placeholder="Ghi chú..." value={extNotes[k] || ''} onChange={e => setExtNotes(prev => ({ ...prev, [k]: e.target.value }))}
                    style={{ width:'100%', padding:'8px 10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:'8px', color:'var(--text-primary)', fontSize:'0.85rem', boxSizing:'border-box' }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {eventId && !loading && (visibleItems.length > 0 || outstandingExt.length > 0) && (
        <div className="flex gap-3">
          <button onClick={submit} disabled={submitting || !canSubmit} className="btn-primary flex-1"
            style={{ fontSize:'1rem', padding:'14px' }}>
            {submitting ? 'Đang xử lý...' : '⬇️ Xác nhận nhập kho'}
          </button>
          <button onClick={() => navigate(-1)} className="btn-secondary">Hủy</button>
        </div>
      )}
    </div>
  );
}
