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
  // condSplits: { equipment_id: { damaged, maintenance, lost } }
  const [condSplits,   setCondSplits]   = useState({});
  const [goodSplits,   setGoodSplits]   = useState({});  // { eqId: number } — user-editable good qty
  const [editCond,     setEditCond]     = useState({});  // { eqId: 'damaged'|'maintenance'|'lost'|null }
  const [condNotes,    setCondNotes]    = useState({});  // { eqId: { damaged:'', maintenance:'', lost:'' } }
  const [itemNotes,    setItemNotes]    = useState({});
  const [checked,      setChecked]      = useState(new Set());
  const [loading,      setLoading]      = useState(false);

  const [submitting,   setSubmitting]   = useState(false);
  const [done,         setDone]         = useState(null);

  const loadPending = () => {
    setLoadingPending(true);
    api.getPendingReturns().then(rows => setPendingReturns(rows.filter(r => r.item_types > 0))).catch(() => {}).finally(() => setLoadingPending(false));
  };

  useEffect(() => { api.getEvents().then(setEvents); loadPending(); }, []);

  // Load outstanding when event selected
  useEffect(() => {
    if (!eventId) { setOutstanding([]); return; }
    setLoading(true);
    api.getOutstanding(eventId).then(rows => {
      setOutstanding(rows);
      const splits = {}, cn = {}, gs = {};
      rows.forEach(r => {
        splits[r.equipment_id] = { damaged: 0, maintenance: 0, lost: 0 };
        cn[r.equipment_id]     = { damaged: '', maintenance: '', lost: '' };
        gs[r.equipment_id]     = r.qty_pending;
      });
      setCondSplits(splits);
      setCondNotes(cn);
      setGoodSplits(gs);
      setEditCond({});
      setItemNotes({});
      setChecked(new Set(rows.map(r => r.equipment_id)));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [eventId]);

  const getGood = (eqId, qtyPending) => {
    const s = condSplits[eqId] || {};
    return Math.max(0, qtyPending - (s.damaged || 0) - (s.maintenance || 0) - (s.lost || 0));
  };
  const setCondVal = (eqId, cond, rawVal, qtyPending) => {
    const newVal = Math.max(0, parseInt(rawVal) || 0);
    const s = condSplits[eqId] || {};
    const otherNG = ['damaged','maintenance','lost'].filter(k => k !== cond).reduce((a, k) => a + (s[k] || 0), 0);
    const capped = Math.min(newVal, Math.max(0, qtyPending - otherNG));
    setCondSplits(prev => ({ ...prev, [eqId]: { ...(prev[eqId] || {}), [cond]: capped } }));
    const newMaxGood = Math.max(0, qtyPending - otherNG - capped);
    setGoodSplits(prev => {
      const cur = prev[eqId] ?? qtyPending;
      return cur > newMaxGood ? { ...prev, [eqId]: newMaxGood } : prev;
    });
  };

  const NON_GOOD_CFG = [
    { cond:'damaged',     label:'Hỏng', color:'#f87171', rgb:'248,113,113' },
    { cond:'maintenance', label:'Sửa',  color:'#fbbf24', rgb:'251,191,36'  },
    { cond:'lost',        label:'Mất',  color:'#94a3b8', rgb:'148,163,184' },
  ];

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

  const hasKhoItems = visibleItems.some(r => checked.has(r.equipment_id));
  const canSubmit = eventId && person && hasKhoItems;

  const submit = async () => {
    if (!canSubmit) return;
    const items = visibleItems
      .filter(r => checked.has(r.equipment_id))
      .flatMap(r => {
        const s    = condSplits[r.equipment_id] || {};
        const cn   = condNotes[r.equipment_id]  || {};
        const good = goodSplits[r.equipment_id] ?? getGood(r.equipment_id, r.qty_pending);
        const result = [];
        if (good > 0) result.push({ equipment_id: r.equipment_id, quantity: good, condition: 'good', notes: itemNotes[r.equipment_id] || '' });
        ['damaged','maintenance','lost'].forEach(cond => {
          const qty = s[cond] || 0;
          if (qty > 0) result.push({ equipment_id: r.equipment_id, quantity: qty, condition: cond, notes: cn[cond] || '' });
        });
        return result;
      });
    setSubmitting(true);
    try {
      const res = await api.createReturn({ event_id: eventId, responsible_person: person, notes: '', items, transaction_date: returnDate });
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
      <div onClick={() => navigate('/')} style={{ minHeight:'100dvh', width:'100%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
        <div className="card text-center space-y-5" onClick={e => e.stopPropagation()} style={{ maxWidth:'420px', width:'100%', margin:'0 16px' }}>
          <div className="text-5xl">✅</div>
          <h2 style={{ color:'#4ade80', fontSize:'1.2rem', fontWeight:700 }}>Nhập kho thành công!</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>
            Phiếu <strong style={{ color:'var(--gold)', fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace" }}>{done.code}</strong> —{' '}
            <strong style={{ color:'var(--text-primary)' }}>{new Set(done.items?.map(i => i.equipment_id) || []).size}</strong> loại thiết bị.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => printSlip(done)} className="btn-primary">🖨️ In phiếu</button>
            <button onClick={() => navigate('/transactions')} className="btn-secondary">Xem lịch sử</button>
          </div>
          <button onClick={() => { setDone(null); setEventId(''); setEventSearch(''); setEventName(''); setOutstanding([]); }}
            style={{ color:'var(--text-muted)', fontSize:'0.84rem', background:'none', border:'none', cursor:'pointer' }}>
            + Nhập kho sự kiện khác
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
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
                fontSize:'0.78rem', fontWeight:700, padding:'2px 8px', borderRadius:'9999px',
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
              <div style={{ flex:1, minWidth:0 }}>
                {/* Hàng 1: tên sự kiện */}
                <div style={{ color:'#c9a84c', fontWeight:700, fontSize:'0.875rem', lineHeight:1.3 }}>
                  {row.event_name}
                </div>
                {/* Hàng 2: code (trái) + badge KHO/NCC (phải) */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', marginTop:'5px' }}>
                  <span style={{ fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace", fontSize:'0.76rem', color:'#7878a0' }}>
                    {row.event_code}
                  </span>
                  <span style={{
                    flexShrink:0, fontSize:'0.78rem', fontWeight:700,
                    background:'rgba(248,113,113,0.15)', color:'#f87171',
                    padding:'3px 9px', borderRadius:'9999px', whiteSpace:'nowrap',
                  }}>
                    {row.item_types > 0 && <>{row.item_types} KHO · {row.total_pending}</>}
                    {row.item_types > 0 && row.ncc_types > 0 && ' · '}
                    {row.ncc_types > 0 && <>{row.ncc_types} NCC</>}
                  </span>
                </div>
                {/* Hàng 3: lưu trữ + ngày */}
                {(row.archived_at || row.start_date) && (
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'4px', flexWrap:'wrap' }}>
                    {row.archived_at && (
                      <span style={{ fontSize:'0.70rem', fontWeight:700, padding:'1px 5px', borderRadius:'9999px', background:'rgba(167,139,250,0.12)', color:'#a78bfa', border:'1px solid rgba(167,139,250,0.3)' }}>
                        📦 Lưu trữ
                      </span>
                    )}
                    {row.start_date && (
                      <span style={{ fontSize:'0.76rem', color:'#7878a0' }}>📅 {fmtD(row.start_date)}</span>
                    )}
                  </div>
                )}
                {/* Hàng 4: mã phiếu xuất — mỗi code 1 chip */}
                {row.out_codes && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginTop:'5px' }}>
                    {row.out_codes.split(',').map(c => c.trim()).filter(Boolean).map(c => (
                      <span key={c} style={{
                        fontSize:'0.72rem', fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace",
                        color:'#555570', background:'rgba(255,255,255,0.04)',
                        border:'1px solid rgba(255,255,255,0.08)',
                        borderRadius:'4px', padding:'1px 6px', whiteSpace:'nowrap',
                      }}>{c}</span>
                    ))}
                  </div>
                )}
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
              fontSize:'0.84rem', color:'var(--text-muted)',
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
            <p style={{ fontSize:'0.82rem', color:'#4ade80', marginTop:'4px' }}>
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
                  <span style={{ fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace", fontSize:'0.78rem', color:'#7878a0' }}>{ev.code}</span>
                  <span style={{ color:'#c9a84c', fontWeight:600 }}>{ev.name}</span>
                  {ev.start_date && <span style={{ fontSize:'0.78rem', color:'#7878a0', marginLeft:'auto' }}>{fmtD(ev.start_date)}</span>}
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
            <DateInput value={returnDate} onChange={setReturnDate} />
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
                  padding:'6px 14px', borderRadius:'9999px', fontSize:'0.84rem', fontWeight:600,
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

      {eventId && !loading && outstanding.length > 0 && visibleItems.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-3xl mb-2">🔍</p>
          <p style={{ color:'var(--text-muted)', fontWeight:600 }}>Không có thiết bị của bộ phận này cần nhập kho.</p>
          <p style={{ color:'var(--text-muted)', fontSize:'0.84rem', marginTop:'4px' }}>Chọn bộ phận khác hoặc "Tất cả" để xem.</p>
        </div>
      )}

      {eventId && !loading && visibleItems.length > 0 && (
        <div className="card p-0 overflow-hidden mb-5">
          <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(201,168,76,0.2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontWeight:700, color:'var(--gold)' }}>Thiết bị chưa trả — {visibleItems.length} loại</span>
            <button type="button"
              onClick={() => {
                const sp = {}, cn = {}, gs = {};
                visibleItems.forEach(r => {
                  sp[r.equipment_id] = { damaged: 0, maintenance: 0, lost: 0 };
                  cn[r.equipment_id] = { damaged: '', maintenance: '', lost: '' };
                  gs[r.equipment_id] = r.qty_pending;
                });
                setCondSplits(prev => ({ ...prev, ...sp }));
                setCondNotes(prev => ({ ...prev, ...cn }));
                setGoodSplits(prev => ({ ...prev, ...gs }));
                setEditCond({});
                setChecked(new Set(visibleItems.map(r => r.equipment_id)));
              }}
              style={{ fontSize:'0.82rem', color:'#c9a84c', background:'none', border:'1px solid rgba(201,168,76,0.3)', borderRadius:'6px', padding:'4px 10px', cursor:'pointer' }}>
              Chọn tất cả
            </button>
          </div>

          {/* ── Desktop: bảng ── */}
          <div className="return-table-wrap table-wrap">
            <table style={{ width:'100%', minWidth:'620px', tableLayout:'fixed' }}>
              <colgroup>
                <col style={{ width:'28%' }} />
                <col style={{ width:'72px' }} />
                <col style={{ width:'54px' }} />
                <col style={{ width:'50px' }} />
                <col />
                <col style={{ width:'130px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ textAlign:'left', padding:'10px 14px' }}>Thiết bị</th>
                  <th style={{ textAlign:'center', padding:'10px 6px' }}>Xuất</th>
                  <th style={{ textAlign:'center', padding:'10px 6px' }}>Nợ</th>
                  <th style={{ textAlign:'center', padding:'10px 6px' }}>✓</th>
                  <th style={{ textAlign:'center', padding:'10px 8px' }}>Tình trạng (số lượng)</th>
                  <th style={{ textAlign:'left', padding:'10px 8px' }}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map(r => (
                  <tr key={r.equipment_id}>
                    <td style={{ padding:'10px 14px', maxWidth:0, overflow:'hidden' }}>
                      <div style={{ fontWeight:600, color:'#c9a84c', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.eq_name}>{r.eq_name}</div>
                      <div style={{ fontSize:'0.80rem', color:'#7878a0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}><span style={{ fontSize:'0.6rem', opacity:0.5 }}>{r.eq_code}</span> · {r.category_code}</div>
                      {r.out_slip_codes && (
                        <div style={{ fontSize:'0.75rem', color:'#555570', marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          Phiếu: {r.out_slip_codes}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign:'center', padding:'10px 6px', color:'#f87171', fontWeight:700, whiteSpace:'nowrap' }}>{r.qty_out} {r.unit}</td>
                    <td style={{ textAlign:'center', padding:'10px 6px' }}>
                      <span style={{ color:'#fbbf24', fontWeight:700 }}>{r.qty_pending}</span>
                    </td>
                    <td style={{ textAlign:'center', padding:'6px' }}>
                      <button type="button" onClick={() => toggleCheck(r.equipment_id)}
                        style={{ width:'38px', height:'34px', textAlign:'center', background: checked.has(r.equipment_id) ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)', border:`1px solid ${checked.has(r.equipment_id) ? 'rgba(74,222,128,0.5)' : 'rgba(201,168,76,0.3)'}`, borderRadius:'6px', cursor:'pointer', color: checked.has(r.equipment_id) ? '#4ade80' : '#555570', fontSize:'1rem', fontWeight:700, display:'block', margin:'0 auto' }}
                      >{checked.has(r.equipment_id) ? '✓' : ''}</button>
                    </td>
                    <td style={{ padding:'8px' }}>
                      <div style={{ display:'flex', gap:'5px', alignItems:'center', flexWrap:'wrap' }}>
                        {/* Tốt — editable */}
                        <div style={{
                          display:'inline-flex', alignItems:'center', gap:'4px',
                          padding:'4px 10px', borderRadius:'20px',
                          background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.3)',
                          whiteSpace:'nowrap',
                        }}>
                          <input
                            type="number" min="0"
                            max={getGood(r.equipment_id, r.qty_pending)}
                            value={goodSplits[r.equipment_id] ?? getGood(r.equipment_id, r.qty_pending)}
                            onChange={e => {
                              const max = getGood(r.equipment_id, r.qty_pending);
                              const val = Math.max(0, Math.min(parseInt(e.target.value) || 0, max));
                              setGoodSplits(prev => ({ ...prev, [r.equipment_id]: val }));
                            }}
                            style={{ width:'30px', background:'transparent', border:'none', outline:'none', color:'#4ade80', fontSize:'0.85rem', fontWeight:800, textAlign:'center', padding:0 }}
                          />
                          <span style={{ color:'#4ade80', fontSize:'0.84rem', fontWeight:700 }}>: Tốt</span>
                        </div>

                        {/* Conditions đang active (val > 0 hoặc đang edit) */}
                        {NON_GOOD_CFG.map(({ cond, label, color, rgb }) => {
                          const val = condSplits[r.equipment_id]?.[cond] || 0;
                          const isOpen = editCond[r.equipment_id] === cond || val > 0;
                          if (!isOpen) return null;
                          return (
                            <div key={cond} style={{
                              display:'inline-flex', flexDirection:'column', gap:'4px',
                              padding:'5px 8px 6px 10px', borderRadius:'12px',
                              background:`rgba(${rgb},0.1)`, border:`1.5px solid ${color}`,
                              minWidth:'110px',
                            }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'3px' }}>
                                <span style={{ color, fontSize:'0.82rem', fontWeight:700, whiteSpace:'nowrap' }}>{label}:</span>
                                <input
                                  type="number" min="0"
                                  autoFocus={editCond[r.equipment_id] === cond && val === 0}
                                  value={val || ''}
                                  placeholder="0"
                                  onChange={e => setCondVal(r.equipment_id, cond, e.target.value, r.qty_pending)}
                                  onBlur={() => { if (!val) setEditCond(prev => ({ ...prev, [r.equipment_id]: null })); }}
                                  style={{ width:'36px', background:'transparent', border:'none', outline:'none', color, fontSize:'0.95rem', fontWeight:800, textAlign:'center', padding:'0' }}
                                />
                                <button type="button"
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => {
                                    setCondSplits(prev => ({ ...prev, [r.equipment_id]: { ...(prev[r.equipment_id] || {}), [cond]: 0 } }));
                                    setCondNotes(prev => ({ ...prev, [r.equipment_id]: { ...(prev[r.equipment_id] || {}), [cond]: '' } }));
                                    setEditCond(prev => ({ ...prev, [r.equipment_id]: null }));
                                  }}
                                  style={{ background:'none', border:'none', color:`rgba(${rgb},0.65)`, cursor:'pointer', fontSize:'0.84rem', padding:'0 0 0 1px', lineHeight:1, marginLeft:'auto' }}>×</button>
                              </div>
                              <input
                                placeholder="Ghi chú..."
                                value={condNotes[r.equipment_id]?.[cond] || ''}
                                onChange={e => setCondNotes(prev => ({ ...prev, [r.equipment_id]: { ...(prev[r.equipment_id] || {}), [cond]: e.target.value } }))}
                                style={{ background:'transparent', border:'none', borderTop:`1px solid rgba(${rgb},0.25)`, outline:'none', color:'rgba(255,255,255,0.55)', fontSize:'0.78rem', padding:'3px 0 0', width:'100%' }}
                              />
                            </div>
                          );
                        })}
                        {/* Dropdown chọn tình trạng chưa set */}
                        {(() => {
                          const unset = NON_GOOD_CFG.filter(({ cond }) => {
                            const val = condSplits[r.equipment_id]?.[cond] || 0;
                            return !val && editCond[r.equipment_id] !== cond;
                          });
                          if (!unset.length) return null;
                          return (
                            <select value=""
                              onChange={e => { if (e.target.value) setEditCond(prev => ({ ...prev, [r.equipment_id]: e.target.value })); }}
                              style={{
                                padding:'3px 8px', borderRadius:'20px', cursor:'pointer',
                                background:'transparent', border:'1px solid rgba(255,255,255,0.18)',
                                color:'#8888a8', fontSize:'0.82rem', fontWeight:600,
                                outline:'none', appearance:'none',
                              }}
                            >
                              <option value="">+ Tình trạng</option>
                              {unset.map(({ cond, label }) => <option key={cond} value={cond}>{label}</option>)}
                            </select>
                          );
                        })()}
                      </div>
                    </td>
                    <td style={{ padding:'8px' }}>
                      <input placeholder="Ghi chú..." value={itemNotes[r.equipment_id] || ''} onChange={e => setItemNotes(prev => ({ ...prev, [r.equipment_id]: e.target.value }))}
                        style={{ width:'100%', minWidth:'100px', padding:'4px 8px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:'6px', color:'var(--text-primary)', fontSize:'0.84rem' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile: cards ── */}
          <div className="return-card-list" style={{ padding:'10px 14px' }}>
            {visibleItems.map(r => {
              const isChecked = checked.has(r.equipment_id);
              return (
                <div key={r.equipment_id} style={{
                  background: isChecked ? 'rgba(74,222,128,0.04)' : 'rgba(255,255,255,0.02)',
                  border:`1.5px solid ${isChecked ? 'rgba(74,222,128,0.4)' : 'rgba(201,168,76,0.15)'}`,
                  borderRadius:'14px', padding:'12px 14px', transition:'all 0.15s',
                }}>

                  {/* ── Header: tên + checkbox ── */}
                  <div style={{ display:'flex', alignItems:'flex-start', gap:'10px', marginBottom:'6px' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontWeight:700, color:'#c9a84c', margin:0, fontSize:'0.92rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.eq_name}</p>
                      <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'3px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'0.6rem', color:'#555570', opacity:0.5, fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace" }}>{r.eq_code}</span>
                        <span style={{ fontSize:'0.80rem', color:'#44445a' }}>·</span>
                        <span style={{ fontSize:'0.82rem', color:'#555570' }}>{r.category_code}</span>
                        <span style={{ fontSize:'0.80rem', color:'#44445a' }}>·</span>
                        <span style={{ fontSize:'0.82rem', fontWeight:800, color:'#fbbf24' }}>Nợ {r.qty_pending} {r.unit}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => toggleCheck(r.equipment_id)}
                      style={{
                        width:'46px', height:'46px', flexShrink:0, borderRadius:'12px', cursor:'pointer',
                        background: isChecked ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.04)',
                        border:`2px solid ${isChecked ? '#4ade80' : 'rgba(255,255,255,0.12)'}`,
                        color: isChecked ? '#4ade80' : '#444460',
                        fontSize:'1.5rem', fontWeight:800,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        transition:'all 0.15s',
                      }}>
                      {isChecked ? '✓' : ''}
                    </button>
                  </div>

                  {/* ── Divider ── */}
                  <div style={{ height:'1px', background:'rgba(201,168,76,0.1)', margin:'8px 0' }} />

                  {/* ── Pills: Tốt + conditions + dropdown ── */}
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center', marginBottom:'8px' }}>
                    {/* Tốt — editable */}
                    <div style={{
                      display:'inline-flex', alignItems:'center', gap:'4px',
                      padding:'7px 12px', borderRadius:'20px',
                      background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.35)',
                      whiteSpace:'nowrap',
                    }}>
                      <input
                        type="number" min="0"
                        max={getGood(r.equipment_id, r.qty_pending)}
                        value={goodSplits[r.equipment_id] ?? getGood(r.equipment_id, r.qty_pending)}
                        onChange={e => {
                          const max = getGood(r.equipment_id, r.qty_pending);
                          const val = Math.max(0, Math.min(parseInt(e.target.value) || 0, max));
                          setGoodSplits(prev => ({ ...prev, [r.equipment_id]: val }));
                        }}
                        style={{ width:'34px', background:'transparent', border:'none', outline:'none', color:'#4ade80', fontSize:'0.92rem', fontWeight:800, textAlign:'center', padding:0 }}
                      />
                      <span style={{ color:'#4ade80', fontSize:'0.82rem', fontWeight:700 }}>: Tốt</span>
                    </div>

                    {/* Conditions đang active */}
                    {NON_GOOD_CFG.map(({ cond, label, color, rgb }) => {
                      const val = condSplits[r.equipment_id]?.[cond] || 0;
                      const isOpen = editCond[r.equipment_id] === cond || val > 0;
                      if (!isOpen) return null;
                      return (
                        <div key={cond} style={{
                          display:'inline-flex', flexDirection:'column', gap:'5px',
                          padding:'7px 10px 8px 12px', borderRadius:'12px',
                          background:`rgba(${rgb},0.1)`, border:`1.5px solid ${color}`,
                          minWidth:'120px',
                        }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                            <span style={{ color, fontSize:'0.82rem', fontWeight:700, whiteSpace:'nowrap' }}>{label}:</span>
                            <input
                              type="number" min="0"
                              autoFocus={editCond[r.equipment_id] === cond && val === 0}
                              value={val || ''}
                              placeholder="0"
                              onChange={e => setCondVal(r.equipment_id, cond, e.target.value, r.qty_pending)}
                              onBlur={() => { if (!val) setEditCond(prev => ({ ...prev, [r.equipment_id]: null })); }}
                              style={{ width:'44px', background:'transparent', border:'none', outline:'none', color, fontSize:'1rem', fontWeight:800, textAlign:'center', padding:'0' }}
                            />
                            <button type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => {
                                setCondSplits(prev => ({ ...prev, [r.equipment_id]: { ...(prev[r.equipment_id] || {}), [cond]: 0 } }));
                                setCondNotes(prev => ({ ...prev, [r.equipment_id]: { ...(prev[r.equipment_id] || {}), [cond]: '' } }));
                                setEditCond(prev => ({ ...prev, [r.equipment_id]: null }));
                              }}
                              style={{ background:'none', border:'none', color:`rgba(${rgb},0.65)`, cursor:'pointer', fontSize:'1rem', padding:'2px 3px 2px 2px', lineHeight:1, marginLeft:'auto' }}>×</button>
                          </div>
                          <input
                            placeholder="Ghi chú..."
                            value={condNotes[r.equipment_id]?.[cond] || ''}
                            onChange={e => setCondNotes(prev => ({ ...prev, [r.equipment_id]: { ...(prev[r.equipment_id] || {}), [cond]: e.target.value } }))}
                            style={{ background:'transparent', border:'none', borderTop:`1px solid rgba(${rgb},0.25)`, outline:'none', color:'rgba(255,255,255,0.55)', fontSize:'0.84rem', padding:'4px 0 0', width:'100%' }}
                          />
                        </div>
                      );
                    })}

                    {/* Dropdown chọn tình trạng chưa set */}
                    {(() => {
                      const unset = NON_GOOD_CFG.filter(({ cond }) => {
                        const val = condSplits[r.equipment_id]?.[cond] || 0;
                        return !val && editCond[r.equipment_id] !== cond;
                      });
                      if (!unset.length) return null;
                      return (
                        <select value=""
                          onChange={e => { if (e.target.value) setEditCond(prev => ({ ...prev, [r.equipment_id]: e.target.value })); }}
                          style={{
                            padding:'7px 12px', borderRadius:'20px', cursor:'pointer',
                            background:'transparent', border:'1px solid rgba(255,255,255,0.15)',
                            color:'#7878a0', fontSize:'0.82rem', fontWeight:600,
                            outline:'none', appearance:'none',
                          }}
                        >
                          <option value="">+ Tình trạng</option>
                          {unset.map(({ cond, label }) => <option key={cond} value={cond}>{label}</option>)}
                        </select>
                      );
                    })()}
                  </div>

                  {/* ── Ghi chú ── */}
                  <input placeholder="Ghi chú..." value={itemNotes[r.equipment_id] || ''} onChange={e => setItemNotes(prev => ({ ...prev, [r.equipment_id]: e.target.value }))}
                    style={{ width:'100%', padding:'8px 10px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', color:'var(--text-primary)', fontSize:'0.85rem', boxSizing:'border-box' }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {eventId && !loading && visibleItems.length > 0 && (
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
