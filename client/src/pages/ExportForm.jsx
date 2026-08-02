import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { printSlip, previewSlip } from '../utils/printSlip';
import { printNccReturn } from '../utils/printNccReturn';
import Modal from '../components/Modal';
import DateInput from '../components/DateInput';
import { LayoutGrid, Clapperboard, Headphones, Theater, Package, Printer } from 'lucide-react';
import { NCC_CATALOG as NCC_CATALOG_STATIC, NCC_LIST as NCC_LIST_STATIC, NCC_DEPT as NCC_DEPT_STATIC } from '../utils/nccCatalog';

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

const emptyRows = (n = 5) => Array.from({ length: n }, () => ({ mode: 'kho', equipment_id: '', quantity: 1, notes: '', combo: null, ext_supplier: '', ext_name: '', rental_days: 1 }));

const emptyExtRow = () => ({ supplier: '', name: '', quantity: 1, notes: '', rental_days: 1, combo: null });
const NCC_DEPTS    = ['Sản Xuất','Kế Toán','Kỹ Thuật','ATAS-LED','Sân Khấu','Cơ Sở Vật Chất'];
const DEPT_KEY     = { 'Kỹ Thuật':'TECH', 'ATAS-LED':'ATAS', 'Sân Khấu':'STAGE' };
const ROLE_TO_DEPT = { TECHNICAL:'Kỹ Thuật', ATAS:'ATAS-LED', STAGE:'Sân Khấu', PRODUCTION:'Sản Xuất', ACCOUNTING:'Kế Toán', CSVC:'Cơ Sở Vật Chất' };

export default function ExportForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const defaultDept = ROLE_DEPT[user?.role] || '';
  const isLocked = LOCKED_ROLES.includes(user?.role);

  const roleDeptCode = { TECHNICAL: 'TECH', ATAS: 'ATAS', STAGE: 'STAGE', CSVC: 'CSVC' };
  const userDept = roleDeptCode[user?.role];

  // NCC catalog từ DB (fallback về static nếu chưa load xong)
  const [nccCatalog, setNccCatalog]       = useState(NCC_CATALOG_STATIC);
  const [nccSuppliers, setNccSuppliers]   = useState(
    NCC_LIST_STATIC.map(name => ({ name, dept: NCC_DEPT_STATIC[name]?.[0] || null }))
  );

  useEffect(() => {
    api.getNccCatalog().then(({ suppliers, catalog }) => {
      setNccSuppliers(suppliers);
      setNccCatalog(catalog);
    }).catch(() => {});
  }, []);

  const visibleNCC = isLocked
    ? nccSuppliers.filter(s => s.dept === userDept).map(s => s.name)
    : nccSuppliers.map(s => s.name);

  const [equipment, setEquipment] = useState([]);
  const [events, setEvents]       = useState([]);
  const [reservedMap, setReservedMap] = useState({});
  const [deptFilter, setDeptFilter] = useState(defaultDept);
  const [form, setForm] = useState({
    event_id: '',
    responsible_person: user?.full_name || '',
    expected_return_date: '',
    notes: '',
  });
  const [items, setItems]           = useState(emptyRows(5));
  const [searchTerms, setSearchTerms] = useState(Array(5).fill(''));
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [nccFocusIdx, setNccFocusIdx] = useState(-1);
  const [nccSupplierFocusIdx, setNccSupplierFocusIdx] = useState(-1);
  const [submitting, setSubmitting] = useState(false);
  const [submittingPending, setSubmittingPending] = useState(false);
  const [doneSlip, setDoneSlip]     = useState(null);
  const [dateError, setDateError]     = useState('');
  const [eventError, setEventError]   = useState(false);
  const [eventDropOpen, setEventDropOpen] = useState(false);
  const [showTraNcc, setShowTraNcc]   = useState(false);
  const [nccReturnItems, setNccReturnItems] = useState([]);
  const [nccSortBy,  setNccSortBy]   = useState(null);
  const [nccSortDir, setNccSortDir]  = useState('asc');
  const savedSnapshot = useRef(null);

  // Thiết bị ngoài
  const [extOpen,     setExtOpen]     = useState(false);
  const [extSupplier, setExtSupplier] = useState('');
  const [extCustom,   setExtCustom]   = useState('');
  const [extItems,    setExtItems]    = useState([emptyExtRow()]);

  const reloadEquipment = () => api.getEquipment().then(setEquipment);

  const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

  // Tính ngày tối thiểu phải trả dựa trên sự kiện đang chọn
  const parseFilmingDates = (ev) => {
    if (!ev) return [];
    const dates = [];
    try {
      const arr = ev.filming_dates ? (typeof ev.filming_dates === 'string' ? JSON.parse(ev.filming_dates) : ev.filming_dates) : [];
      dates.push(...arr);
    } catch {}
    if (ev.filming_date) dates.push(ev.filming_date);
    if (ev.show_date)    dates.push(ev.show_date);
    return [...new Set(dates.filter(Boolean))].sort();
  };

  const getMinReturnDate = (eventId) => {
    const ev = events.find(e => String(e.id) === String(eventId));
    if (!ev) return todayVN;
    const filmingArr = parseFilmingDates(ev);
    const lastFilming = filmingArr.length ? filmingArr[filmingArr.length - 1] : null;
    const candidates = [lastFilming, ev.end_date, todayVN].filter(Boolean);
    return candidates.sort().pop();
  };

  // Tính trạng thái xuất tạm dựa trên sự kiện đang chọn
  const selEvForPending = events.find(ev => String(ev.id) === String(form.event_id));
  const currentFilmingDates = parseFilmingDates(selEvForPending);
  const currentFilmingSet = new Set(currentFilmingDates);
  const isPendingExport = currentFilmingDates.length > 0 && currentFilmingDates[0] > todayVN;

  useEffect(() => {
    reloadEquipment();
    api.getEvents().then(data => setEvents((data || []).filter(e => ['planned','active'].includes(e.status))));
    api.getEquipmentReservedEvents().then(setReservedMap).catch(() => {});
    const onFocus = () => {
      reloadEquipment();
      api.getEquipmentReservedEvents().then(setReservedMap).catch(() => {});
    };
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
    const validItems = items
      .filter(it => it.mode === 'kho' && it.equipment_id && it.quantity > 0)
      .map(it => ({ ...it, quantity: Math.max(1, parseInt(it.quantity) || 1) }));
    const rowExt = items
      .filter(it => it.mode === 'ext' && it.ext_name.trim())
      .map(it => {
        const catalog = nccCatalog[it.ext_supplier] || [];
        const found = catalog.find(c => c.name === it.ext_name.trim());
        return { name: it.ext_name.trim(), supplier: it.ext_supplier.trim(), quantity: Math.max(1, parseInt(it.quantity) || 1), notes: it.notes || '', unit: found?.unit || 'Cái', rental_days: Math.max(0.5, parseFloat(it.rental_days) || 1), combo: it.combo || null };
      });
    const sectionExt = extOpen ? extItems.filter(i => i.name.trim() && i.supplier.trim()).map(i => ({ ...i, unit: i.unit || 'Cái', quantity: Math.max(1, parseInt(i.quantity) || 1), rental_days: Math.max(0.5, parseFloat(i.rental_days) || 1), combo: i.combo || null })) : [];
    const validExt = [...rowExt, ...sectionExt];
    if (!form.event_id) { setEventError(true); return; }
    setEventError(false);
    const minReturn = getMinReturnDate(form.event_id);
    if (isPendingExport) {
      // Xuất tạm: không bắt buộc ngày trả, tự dùng ngày ghi hình nếu thiếu
      if (!form.expected_return_date) setField('expected_return_date', minReturn);
      setDateError('');
    } else {
      if (!form.expected_return_date) { setDateError('Vui lòng chọn ngày dự kiến trả'); return; }
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
    }
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

  const submitAsPending = async () => {
    const validItems = items
      .filter(it => it.mode === 'kho' && it.equipment_id && it.quantity > 0)
      .map(it => ({ ...it, quantity: Math.max(1, parseInt(it.quantity) || 1) }));
    const rowExt = items
      .filter(it => it.mode === 'ext' && it.ext_name.trim())
      .map(it => {
        const catalog = nccCatalog[it.ext_supplier] || [];
        const found = catalog.find(c => c.name === it.ext_name.trim());
        return { name: it.ext_name.trim(), supplier: it.ext_supplier.trim(), quantity: Math.max(1, parseInt(it.quantity) || 1), notes: it.notes || '', unit: found?.unit || 'Cái', rental_days: Math.max(0.5, parseFloat(it.rental_days) || 1), combo: it.combo || null };
      });
    const sectionExt = extOpen ? extItems.filter(i => i.name.trim() && i.supplier.trim()).map(i => ({ ...i, unit: i.unit || 'Cái', quantity: Math.max(1, parseInt(i.quantity) || 1), rental_days: Math.max(0.5, parseFloat(i.rental_days) || 1), combo: i.combo || null })) : [];
    const validExt = [...rowExt, ...sectionExt];
    if (!form.event_id) { setEventError(true); return; }
    setEventError(false);
    setDateError('');
    if (validItems.length === 0 && validExt.length === 0) { alert('Chưa chọn thiết bị nào'); return; }
    savedSnapshot.current = { form, items, searchTerms, deptFilter, extOpen, extSupplier, extCustom, extItems };
    setSubmittingPending(true);
    try {
      const res = await api.createOut({ ...form, items: validItems, external_items: validExt, force_pending: true });
      const full = await api.getTransactionById(res.id);
      setDoneSlip({ ...full, _pending: true, _filmingDate: res._filmingDate });
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingPending(false);
    }
  };

  // After success — show confirmation with print option
  if (doneSlip) {
    return (
      <div onClick={() => navigate('/')}
        style={{ minHeight:'100dvh', width:'100%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
        <div className="card text-center space-y-5" onClick={e => e.stopPropagation()}
          style={{ maxWidth:'420px', width:'100%', margin:'0 16px' }}>
          {doneSlip._pending ? (
            <>
              <div className="text-5xl">🕐</div>
              <h2 style={{ color:'#fbbf24', fontSize:'1.2rem', fontWeight:700 }}>Phiếu xuất kho tạm đã tạo!</h2>
              <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>
                Phiếu <strong style={{ color:'#fbbf24', fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace" }}>{doneSlip.code}</strong> đang chờ xác nhận.
                {doneSlip._filmingDate && <> Ngày ghi hình: <strong style={{ color:'#fbbf24' }}>{doneSlip._filmingDate.slice(8,10)}-{doneSlip._filmingDate.slice(5,7)}-{doneSlip._filmingDate.slice(2,4)}</strong>.</>}
              </p>
              <p style={{ color:'rgba(251,191,36,0.65)', fontSize:'0.84rem', background:'rgba(251,191,36,0.07)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:'8px', padding:'8px 12px' }}>
                ⚠ Thiết bị <strong>chưa bị trừ kho</strong>. Vào <em>Lịch Sử Vận Hành → Xuất Kho Tạm</em> để xác nhận khi đến ngày ghi hình.
              </p>
            </>
          ) : (
            <>
              <div className="text-5xl">✅</div>
              <h2 style={{ color:'#4ade80', fontSize:'1.2rem', fontWeight:700 }}>Xuất kho thành công!</h2>
              <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>
                Phiếu <strong style={{ color:'var(--gold)', fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace" }}>{doneSlip.code}</strong> đã được tạo
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
                if (!confirm(`Quay lại chỉnh sửa sẽ xóa phiếu ${doneSlip.code} đang chờ.\nBạn có chắc không?`)) return;
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
                api.getEquipmentReservedEvents().then(setReservedMap).catch(() => {});
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
              setItems(emptyRows(5));
              setSearchTerms(Array(5).fill(''));
              reloadEquipment();
              api.getEquipmentReservedEvents().then(setReservedMap).catch(() => {});
            }}
            style={{ color:'var(--text-muted)', fontSize:'0.84rem', background:'none', border:'none', cursor:'pointer' }}>
            + Tạo phiếu mới
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 className="text-2xl font-bold">Phiếu Xuất Kho</h1>
          <p className="text-gray-500 text-sm">Phải chọn sự kiện trước khi xuất thiết bị</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-6" noValidate
        onKeyDown={e => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') e.preventDefault(); }}>
        {/* Header info */}
        <div className="card space-y-4">
          <h2 style={{ fontWeight:700, color:'var(--gold)', fontSize:'0.92rem', letterSpacing:'0.04em', textTransform:'uppercase' }}>Thông tin phiếu</h2>
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
                          <span style={{ color:'#e8c97a', fontWeight:700, fontSize:'0.92rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{selEv.name}</span>
                          <span style={{ color:'rgba(201,168,76,0.38)', fontSize:'0.84rem', fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace", flexShrink:0 }}>· {selEv.code}</span>
                        </span>
                      ) : (
                        <span style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>-- Chọn sự kiện --</span>
                      )}
                      <span style={{ color:'#c9a84c', fontSize:'0.82rem', flexShrink:0 }}>▾</span>
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
                              onClick={() => {
                                setField('event_id', ev.id);
                                setEventError(false);
                                setEventDropOpen(false);
                                setDateError('');
                                // Auto-set return date = ngày ghi hình nếu là sự kiện tương lai (xuất tạm)
                                const evFilmDates = parseFilmingDates(ev);
                                const earliest = evFilmDates[0] || null;
                                if (earliest && earliest > todayVN) {
                                  setField('expected_return_date', getMinReturnDate(ev.id));
                                } else {
                                  setField('expected_return_date', '');
                                }
                              }}
                              style={{
                                width:'100%', textAlign:'left', padding:'8px 12px',
                                background: String(ev.id) === String(form.event_id) ? 'rgba(201,168,76,0.12)' : 'transparent',
                                border:'none', borderBottom:'1px solid rgba(255,255,255,0.05)',
                                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background='rgba(201,168,76,0.08)'}
                              onMouseLeave={e => e.currentTarget.style.background = String(ev.id) === String(form.event_id) ? 'rgba(201,168,76,0.12)' : 'transparent'}>
                              <span style={{ color:'#e8c97a', fontWeight:600, fontSize:'0.875rem' }}>{ev.name}</span>
                              <span style={{ color:'rgba(201,168,76,0.4)', fontSize:'0.80rem', fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace", flexShrink:0 }}>{ev.code}</span>
                            </button>
                          ))}
                          {events.length === 0 && (
                            <p style={{ padding:'10px 12px', fontSize:'0.84rem', color:'#7878a0' }}>Không có sự kiện nào</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
              {eventError && (
                <p style={{ color:'#f87171', fontSize:'0.84rem', fontWeight:600, marginTop:'4px' }}>
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
                className="input"
                style={ dateError ? { border:'1.5px solid #f87171', boxShadow:'0 0 0 2px rgba(248,113,113,0.18)' } : {} } />
              {dateError && (
                <p style={{ color:'#f87171', fontSize:'0.84rem', fontWeight:600, marginTop:'4px' }}>
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
          <h2 style={{ fontWeight:700, color:'var(--gold)', fontSize:'0.92rem', letterSpacing:'0.04em', textTransform:'uppercase' }}>Danh sách thiết bị xuất</h2>

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
                      setItems(emptyRows(5));
                      setSearchTerms(Array(5).fill(''));
                      setExpandedRows(new Set());
                    }
                  }}
                  style={{
                    padding: '6px 14px', borderRadius: '9999px', fontSize: '0.84rem', fontWeight: 600,
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
              <p style={{ fontSize:'0.84rem', color:'var(--text-muted)', marginTop:'4px' }}>
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
                const catalog = item.ext_supplier ? (nccCatalog[item.ext_supplier] || []) : [];
                const nameSuggestions = item.ext_name
                  ? catalog.filter(c => c.name.toLowerCase().includes(item.ext_name.toLowerCase())).slice(0, 8)
                  : [];
                const isExpanded = expandedRows.has(idx);

                const H = '36px';
                const W = '56px';
                return (
                  <div key={idx} style={{
                    backgroundColor:'#080e1c',
                    border:`1px solid ${filled ? 'rgba(96,165,250,0.45)' : 'rgba(96,165,250,0.18)'}`,
                    borderLeft:'3px solid #60a5fa',
                    borderRadius:'10px',
                    padding:'10px',
                    display:'flex', flexDirection:'column', gap:'6px',
                  }}>

                    {/* Hàng 1: [NCC flex:1] + [SL] + [Ngày] + [✕] */}
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <div style={{ flex:1, position:'relative', minWidth:0 }}>
                        <input
                          style={{
                            width:'100%', height:H, padding:'0 10px', boxSizing:'border-box',
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
                                style={{ width:'100%', textAlign:'left', padding:'10px 14px', background:'transparent', border:'none', borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer', color:'#93c5fd', fontSize:'0.92rem', fontWeight:600 }}
                                onMouseEnter={ev => ev.currentTarget.style.background='rgba(96,165,250,0.1)'}
                                onMouseLeave={ev => ev.currentTarget.style.background='transparent'}
                                onClick={() => { setItem(idx, 'ext_supplier', s); setItem(idx, 'ext_name', ''); setNccSupplierFocusIdx(-1); }}>
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input type="number" min="1"
                        value={item.quantity ?? 1}
                        onChange={e => setItem(idx, 'quantity', e.target.value)}
                        onBlur={e => setItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ flexShrink:0, width:W, height:H, padding:'0', textAlign:'center', boxSizing:'border-box', background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.35)', borderRadius:'8px', color:'#4ade80', fontSize:'1.05rem', fontWeight:800, outline:'none' }}
                      />
                      <div style={{ flexShrink:0, width:'56px', minWidth:'56px', maxWidth:'56px', height:H, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1px', background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.45)', borderRadius:'8px', overflow:'hidden' }}>
                        <input type="number" min="0.5" step="0.5"
                          value={item.rental_days ?? 1}
                          onChange={e => setItem(idx, 'rental_days', e.target.value)}
                          onBlur={e => setItem(idx, 'rental_days', Math.max(0.5, parseFloat(e.target.value) || 1))}
                          style={{ width:'100%', height:'20px', border:'none', background:'transparent', outline:'none', textAlign:'center', color:'#fbbf24', fontSize:'1rem', fontWeight:800, padding:0, lineHeight:'20px' }}
                        />
                        <span style={{ fontSize:'0.84rem', color:'rgba(251,191,36,0.7)', lineHeight:1 }}>day</span>
                      </div>
                      <button type="button" onClick={() => removeItem(idx)}
                        style={{ flexShrink:0, width:W, height:H, borderRadius:'8px', cursor:'pointer', border:'1px solid rgba(248,113,113,0.3)', background:'transparent', color:'rgba(248,113,113,0.7)', fontSize:'0.92rem', display:'flex', alignItems:'center', justifyContent:'center' }}
                        onMouseEnter={ev => { ev.currentTarget.style.background='rgba(248,113,113,0.12)'; ev.currentTarget.style.color='#f87171'; }}
                        onMouseLeave={ev => { ev.currentTarget.style.background='transparent'; ev.currentTarget.style.color='rgba(248,113,113,0.7)'; }}>
                        ✕
                      </button>
                    </div>

                    {/* Hàng 2: [Tên flex:1] + [✏️] + [FREE] + [combo#] */}
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <div style={{ flex:1, position:'relative', minWidth:0 }}>
                        <input
                          style={{
                            width:'100%', height:H, padding:'0 10px', boxSizing:'border-box',
                            background: filled ? 'rgba(96,165,250,0.09)' : 'rgba(255,255,255,0.04)',
                            border:`1px solid ${filled ? 'rgba(96,165,250,0.45)' : 'rgba(96,165,250,0.15)'}`,
                            borderRadius:'8px',
                            color: filled ? '#93c5fd' : 'var(--text-muted)',
                            fontWeight: filled ? 700 : 400, fontSize:'0.875rem', outline:'none',
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
                                <span style={{ color:'#93c5fd', fontWeight:600, fontSize:'0.92rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
                                <span style={{ fontSize:'0.84rem', color:'#4ade80', flexShrink:0 }}>{c.qty > 0 ? c.qty : '–'} {c.unit}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => toggleExpand(idx)}
                        style={{ flexShrink:0, width:W, height:H, borderRadius:'8px', cursor:'pointer', border: isExpanded ? '1px solid #60a5fa' : '1px solid rgba(96,165,250,0.2)', background: isExpanded ? 'rgba(96,165,250,0.2)' : 'transparent', color: isExpanded ? '#60a5fa' : 'rgba(96,165,250,0.35)', fontSize:'0.85rem', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        ✏️
                      </button>
                      <button type="button"
                        onClick={() => setItem(idx, 'combo', item.combo === null ? parseInt(item.quantity) || 1 : null)}
                        style={{ flexShrink:0, width:W, height:H, borderRadius:'8px', cursor:'pointer', fontSize:'0.72rem', fontWeight:800, letterSpacing:'0.08em', display:'flex', alignItems:'center', justifyContent:'center', border: item.combo !== null ? '1px solid rgba(167,139,250,0.7)' : '1px solid rgba(167,139,250,0.3)', color: item.combo !== null ? '#a78bfa' : 'rgba(167,139,250,0.45)', background: item.combo !== null ? 'rgba(167,139,250,0.12)' : 'transparent' }}>FREE</button>
                      {item.combo !== null && (
                        <input type="number" min="1" max={item.quantity} placeholder="—"
                          value={item.combo}
                          onChange={e => setItem(idx, 'combo', e.target.value)}
                          onBlur={e => setItem(idx, 'combo', String(Math.min(Math.max(1, parseInt(e.target.value) || 1), item.quantity)))}
                          style={{ flexShrink:0, width:W, height:H, padding:'0 4px', textAlign:'center', boxSizing:'border-box', background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.5)', borderRadius:'8px', color:'#a78bfa', fontSize:'1rem', fontWeight:800, outline:'none' }}
                        />
                      )}
                    </div>

                    {/* Expand: ghi chú */}
                    {isExpanded && (
                      <div style={{ borderTop:'1px solid rgba(96,165,250,0.12)', paddingTop:'6px' }}>
                        <input
                          style={{ width:'100%', height:H, padding:'0 10px', boxSizing:'border-box', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:'8px', color:'var(--text-primary)', fontSize:'0.875rem', outline:'none' }}
                          placeholder="Ghi chú cho dòng NCC này..."
                          value={item.notes || ''}
                          onChange={e => setItem(idx, 'notes', e.target.value)}
                          autoFocus
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
              const free = eq ? Math.max(0, eq.qty_available) : 9999;
              const qtyOver = !isPendingExport && eq && item.quantity > free;
              const pendingWarnings = eq ? (reservedMap[eq.id] || []) : [];
              const sameDayWarnings = eq ? (reservedMap[eq.id] || []).filter(w => {
                if (String(w.event_id) === String(form.event_id)) return false;
                const otherEv = events.find(e => String(e.id) === String(w.event_id));
                return otherEv && parseFilmingDates(otherEv).some(d => currentFilmingSet.has(d));
              }) : [];

              const insertExtBelow = () => {
                setItems(prev => {
                  const next = [...prev];
                  next.splice(idx + 1, 0, { mode:'ext', equipment_id:'', quantity:1, notes:'', combo:null, ext_supplier:'', ext_name:'', rental_days:1 });
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
                      fontSize:'0.84rem', fontWeight:700, flexShrink:0, minWidth:'20px', textAlign:'center',
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
                          fontWeight: filled ? 700 : 400, fontSize:'0.92rem', outline:'none',
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
                            const free = Math.max(0, e.qty_available);
                            const pendingQty = (reservedMap[e.id] || []).reduce((s, r) => s + r.qty, 0);
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
                                  <span style={{ fontSize:'0.82rem', fontWeight:700, color: free <= 0 ? '#f87171' : '#4ade80' }}>Còn {free} {e.unit}</span>
                                  {pendingQty > 0 && <span style={{ fontSize:'0.84rem', color:'#fbbf24' }}>· {pendingQty} tạm xuất</span>}
                                  <span style={{ fontSize:'0.82rem', color:'#555570', fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace", marginLeft:'auto' }}>{e.code}</span>
                                </div>
                              </button>
                            );
                          })}
                          {filteredEquip(searchTerms[idx], idx).length === 0 && (
                            <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                              <p style={{ fontSize:'0.84rem', color:'#7878a0', marginBottom:'8px' }}>Không có trong kho Khôi Minh</p>
                              <button type="button"
                                onClick={() => {
                                  const name = searchTerms[idx].trim();
                                  setItems(prev => prev.map((it, j) => j === idx
                                    ? { ...it, mode:'ext', ext_name: name, ext_supplier:'' }
                                    : it));
                                  const t = [...searchTerms]; t[idx] = ''; setSearchTerms(t);
                                }}
                                style={{
                                  width:'100%', padding:'9px 12px', borderRadius:'8px', cursor:'pointer',
                                  background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.4)',
                                  color:'#93c5fd', fontSize:'0.85rem', fontWeight:600, textAlign:'left',
                                  display:'flex', alignItems:'center', gap:'8px',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background='rgba(96,165,250,0.18)'}
                                onMouseLeave={e => e.currentTarget.style.background='rgba(96,165,250,0.1)'}>
                                <span style={{ fontSize:'1rem' }}>✏️</span>
                                <span>Thêm <strong>"{searchTerms[idx].trim()}"</strong> thủ công</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Info strip dưới search khi đã chọn */}
                      {eq && !isOpen && (
                        <div style={{ marginTop:'5px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                            <span style={{ fontSize:'0.6rem', color:'var(--text-muted)', opacity:0.5, fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace" }}>{eq.code}</span>
                            <span style={{ fontSize:'0.84rem', fontWeight:700, color: free <= 0 ? '#f87171' : '#4ade80', marginLeft:'auto' }}>{free} {eq.unit} khả dụng</span>
                          </div>
                          {pendingWarnings.length > 0 && (
                            <div style={{ marginTop:'4px', display:'flex', flexDirection:'column', gap:'2px' }}>
                              {pendingWarnings.map((w, i) => (
                                <span key={i} style={{ fontSize:'0.80rem', color:'#fbbf24', background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)', borderRadius:'5px', padding:'2px 7px' }}>
                                  ⏳ Tạm xuất {w.qty} {eq.unit} → {w.event_name}
                                </span>
                              ))}
                            </div>
                          )}
                          {sameDayWarnings.length > 0 && (
                            <div style={{ marginTop:'4px', display:'flex', flexDirection:'column', gap:'2px' }}>
                              {sameDayWarnings.map((w, i) => (
                                <span key={i} style={{ fontSize:'0.80rem', color:'#fb923c', background:'rgba(251,146,60,0.08)', border:'1px solid rgba(251,146,60,0.3)', borderRadius:'5px', padding:'2px 7px' }}>
                                  📅 Cùng ngày ghi hình: {w.event_name} tạm xuất {w.qty} {eq.unit}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2×2 grid bên phải: [Qty][X] / [✏️][THUÊ] */}
                    <div style={{ display:'grid', gridTemplateColumns:'56px 56px', gap:'5px', flexShrink:0 }}>
                      {/* Qty */}
                      <input type="number" min="1" max={isPendingExport ? undefined : (eq ? free : undefined)}
                        value={item.quantity ?? 1}
                        onChange={e => setItem(idx, 'quantity', e.target.value)}
                        onBlur={e => setItem(idx, 'quantity', isPendingExport
                          ? Math.max(1, parseInt(e.target.value) || 1)
                          : Math.max(1, Math.min(parseInt(e.target.value) || 1, eq ? free : 9999)))}
                        title={eq ? (isPendingExport ? `Xuất tạm – nhập số lượng cần dùng` : `Tối đa: ${free} ${eq.unit}`) : ''}
                        style={{
                          height:'36px', padding:'0', textAlign:'center', boxSizing:'border-box',
                          background: qtyOver ? 'rgba(248,113,113,0.12)' : 'rgba(74,222,128,0.08)',
                          border: `1px solid ${qtyOver ? 'rgba(248,113,113,0.6)' : 'rgba(74,222,128,0.35)'}`,
                          borderRadius:'8px', color: qtyOver ? '#f87171' : '#4ade80', fontSize:'1.05rem', fontWeight:800, outline:'none',
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
                          fontSize:'0.80rem', fontWeight:800, letterSpacing:'0.02em',
                          display:'flex', alignItems:'center', justifyContent:'center',
                        }}
                        onMouseEnter={ev => { ev.currentTarget.style.background='rgba(96,165,250,0.12)'; ev.currentTarget.style.color='#60a5fa'; }}
                        onMouseLeave={ev => { ev.currentTarget.style.background='transparent'; ev.currentTarget.style.color='rgba(96,165,250,0.6)'; }}>
                        THUÊ
                      </button>
                      {/* Hàng 3: [FREE][_#_] — hiện khi đã chọn thiết bị + số lượng */}
                      {eq && item.quantity > 0 && (
                        <button type="button"
                          onClick={() => setItem(idx, 'combo', item.combo === null ? parseInt(item.quantity) || 1 : null)}
                          style={{ height:'36px', borderRadius:'8px', cursor:'pointer', fontSize:'0.72rem', fontWeight:800, letterSpacing:'0.08em',
                            border: item.combo !== null ? '1px solid rgba(167,139,250,0.7)' : '1px solid rgba(167,139,250,0.3)',
                            color: item.combo !== null ? '#a78bfa' : 'rgba(167,139,250,0.45)',
                            background: item.combo !== null ? 'rgba(167,139,250,0.12)' : 'transparent',
                          }}>FREE</button>
                      )}
                      {item.combo !== null && (
                        <input
                          autoFocus
                          type="number" min="1" max={item.quantity}
                          style={{ height:'36px', padding:'0 6px', background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.5)', borderRadius:'8px', color:'#a78bfa', fontSize:'1rem', fontWeight:800, outline:'none', textAlign:'center', boxSizing:'border-box', width:'100%' }}
                          placeholder="—"
                          value={item.combo}
                          onChange={e => setItem(idx, 'combo', e.target.value)}
                          onBlur={e => setItem(idx, 'combo', String(Math.min(Math.max(1, parseInt(e.target.value) || 1), item.quantity)))}
                        />
                      )}
                    </div>
                  </div>

                  {/* ── Expanded edit panel ── */}
                  {isOpen && (
                    <div style={{ marginTop:'8px', borderTop:'1px solid rgba(201,168,76,0.12)', paddingTop:'8px', background:'rgba(201,168,76,0.03)', borderRadius:'0 0 8px 8px' }}>
                      {eq && (
                        <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'10px', marginBottom:'8px', fontSize:'0.78rem' }}>
                          <span style={{ color:'var(--text-muted)' }}>Mã: <span style={{ color:'var(--gold)', fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace" }}>{eq.code}</span></span>
                          <span style={{ color:'var(--text-muted)' }}>ĐVT: <span style={{ color:'var(--text-primary)' }}>{eq.unit}</span></span>
                          <span style={{ color:'var(--text-muted)' }}>Khả dụng: <span style={{ color:'#4ade80', fontWeight:700 }}>{eq.qty_available}</span></span>
                          {(reservedMap[eq.id]||[]).reduce((s,r)=>s+r.qty,0) > 0 && <span style={{ color:'var(--text-muted)' }}>Tạm xuất: <span style={{ color:'#fbbf24', fontWeight:700 }}>{(reservedMap[eq.id]||[]).reduce((s,r)=>s+r.qty,0)}</span></span>}
                          <span style={{ color:'var(--text-muted)' }}>Đang dùng: <span style={{ color:'#60a5fa' }}>{eq.qty_in_use}</span></span>
                        </div>
                      )}
                      <input
                        style={{ width:'100%', height:'40px', padding:'0 12px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:'8px', color:'var(--text-primary)', fontSize:'0.92rem', outline:'none', boxSizing:'border-box' }}
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
              color:'rgba(201,168,76,0.6)', fontSize:'0.84rem', fontWeight:600,
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
            <span style={{ color: '#c9a84c', fontSize: '0.82rem' }}>{extOpen ? '▲ Thu lại' : '▼ Mở rộng'}</span>
          </button>

          {extOpen && (
            <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(201,168,76,0.15)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {extItems.map((row, i) => (
                  <div key={i} style={{ background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:'10px', padding:'10px', display:'flex', flexDirection:'column', gap:'6px' }}>
                    {/* Hàng 1: [NCC flex:1] + [SL] + [Ngày] + [✕] */}
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <input
                        placeholder="Nhà cung cấp *"
                        value={row.supplier}
                        onChange={e => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, supplier: e.target.value } : r))}
                        style={{ flex:1, height:'36px', padding:'0 10px', boxSizing:'border-box', background: row.supplier ? 'rgba(96,165,250,0.07)' : 'rgba(255,255,255,0.04)', border:`1px solid ${row.supplier ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.12)'}`, borderRadius:'8px', color: row.supplier ? '#93c5fd' : 'var(--text-muted)', fontWeight: row.supplier ? 700 : 400, fontSize:'0.875rem', outline:'none' }}
                      />
                      <input type="number" min="1"
                        value={row.quantity ?? 1}
                        onChange={e => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, quantity: e.target.value } : r))}
                        onBlur={e => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, quantity: Math.max(1, parseInt(e.target.value) || 1) } : r))}
                        style={{ flexShrink:0, width:'56px', height:'36px', padding:'0', textAlign:'center', boxSizing:'border-box', background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.35)', borderRadius:'8px', color:'#4ade80', fontSize:'1.05rem', fontWeight:800, outline:'none' }}
                      />
                      <div style={{ flexShrink:0, width:'56px', minWidth:'56px', maxWidth:'56px', height:'36px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1px', background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.45)', borderRadius:'8px', overflow:'hidden' }}>
                        <input type="number" min="0.5" step="0.5"
                          value={row.rental_days ?? 1}
                          onChange={e => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, rental_days: e.target.value } : r))}
                          onBlur={e => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, rental_days: Math.max(0.5, parseFloat(e.target.value) || 1) } : r))}
                          style={{ width:'100%', height:'20px', border:'none', background:'transparent', outline:'none', textAlign:'center', color:'#fbbf24', fontSize:'1rem', fontWeight:800, padding:0, lineHeight:'20px' }}
                        />
                        <span style={{ fontSize:'0.84rem', color:'rgba(251,191,36,0.7)', lineHeight:1 }}>day</span>
                      </div>
                      <button type="button" onClick={() => setExtItems(prev => prev.filter((_, j) => j !== i))}
                        style={{ flexShrink:0, width:'56px', height:'36px', background:'transparent', border:'1px solid rgba(248,113,113,0.3)', borderRadius:'8px', color:'rgba(248,113,113,0.7)', cursor:'pointer', fontSize:'0.92rem', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        ✕
                      </button>
                    </div>
                    {/* Hàng 2: [Tên flex:1] + [✏️] + [FREE] + [combo#] */}
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <input
                        placeholder="Tên thiết bị *"
                        value={row.name}
                        onChange={e => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                        style={{ flex:1, height:'36px', padding:'0 10px', boxSizing:'border-box', background: row.name ? 'rgba(96,165,250,0.09)' : 'rgba(255,255,255,0.04)', border:`1px solid ${row.name ? 'rgba(96,165,250,0.4)' : 'rgba(96,165,250,0.15)'}`, borderRadius:'8px', color: row.name ? '#93c5fd' : 'var(--text-muted)', fontWeight: row.name ? 700 : 400, fontSize:'0.875rem', outline:'none' }}
                      />
                      <button type="button"
                        onClick={() => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, _open: !r._open } : r))}
                        style={{ flexShrink:0, width:'56px', height:'36px', borderRadius:'8px', cursor:'pointer', border: row._open ? '1px solid #c9a84c' : '1px solid rgba(201,168,76,0.2)', background: row._open ? 'rgba(201,168,76,0.18)' : 'transparent', color: row._open ? '#e8c97a' : '#4a4a6a', fontSize:'0.85rem', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        ✏️
                      </button>
                      <button type="button"
                        onClick={() => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, combo: r.combo === null ? parseInt(r.quantity) || 1 : null } : r))}
                        style={{ flexShrink:0, width:'56px', height:'36px', borderRadius:'8px', cursor:'pointer', fontSize:'0.72rem', fontWeight:800, letterSpacing:'0.08em', display:'flex', alignItems:'center', justifyContent:'center', border: row.combo !== null ? '1px solid rgba(167,139,250,0.7)' : '1px solid rgba(167,139,250,0.3)', color: row.combo !== null ? '#a78bfa' : 'rgba(167,139,250,0.45)', background: row.combo !== null ? 'rgba(167,139,250,0.12)' : 'transparent' }}>FREE</button>
                      {row.combo !== null && (
                        <input type="number" min="1" max={row.quantity} placeholder="—"
                          value={row.combo}
                          onChange={e => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, combo: e.target.value } : r))}
                          onBlur={e => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, combo: String(Math.min(Math.max(1, parseInt(e.target.value) || 1), r.quantity)) } : r))}
                          style={{ flexShrink:0, width:'56px', height:'36px', padding:'0 4px', textAlign:'center', boxSizing:'border-box', background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.5)', borderRadius:'8px', color:'#a78bfa', fontSize:'1rem', fontWeight:800, outline:'none' }}
                        />
                      )}
                    </div>
                    {/* Expand: ghi chú */}
                    {row._open && (
                      <div style={{ borderTop:'1px solid rgba(96,165,250,0.12)', paddingTop:'6px' }}>
                        <input
                          placeholder="Ghi chú..."
                          value={row.notes || ''}
                          onChange={e => setExtItems(prev => prev.map((r, j) => j === i ? { ...r, notes: e.target.value } : r))}
                          autoFocus
                          style={{ width:'100%', height:'36px', padding:'0 10px', boxSizing:'border-box', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:'8px', color:'#c9b98a', fontSize:'0.875rem', outline:'none' }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button type="button" onClick={() => setExtItems(prev => [...prev, emptyExtRow()])}
                style={{ marginTop: '8px', fontSize: '0.84rem', color: '#c9a84c', background: 'none', border: '1px dashed rgba(201,168,76,0.3)', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', width: '100%' }}>
                + Thêm nhà cung cấp mới
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={submitting || submittingPending} className="btn-primary flex-1">
            {submitting ? 'Đang xuất...' : '⬆️ Xác nhận xuất kho'}
          </button>
          <button type="button" disabled={submitting || submittingPending} onClick={submitAsPending}
            style={{ padding:'0 18px', borderRadius:'8px', border:'1px solid rgba(251,191,36,0.5)', background:'rgba(251,191,36,0.1)', color:'#fbbf24', fontWeight:700, fontSize:'0.875rem', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
            {submittingPending ? '...' : '🕐 Xuất tạm'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Hủy</button>
        </div>
      </form>

      {/* ── Modal Trả NCC (standalone, không cần sự kiện) ── */}
      {showTraNcc && (() => {
        const sorted = nccSortBy
          ? [...nccReturnItems].sort((a, b) => {
              const va = (a[nccSortBy] || '').toLowerCase();
              const vb = (b[nccSortBy] || '').toLowerCase();
              return nccSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            })
          : nccReturnItems;

        function toggleSort(col) {
          if (nccSortBy === col) setNccSortDir(d => d === 'asc' ? 'desc' : 'asc');
          else { setNccSortBy(col); setNccSortDir('asc'); }
        }
        function addRow() { setNccReturnItems(p => [...p, { dept: ROLE_TO_DEPT[user?.role] || '', name:'', supplier:'', quantity:1, unit:'Cái', notes:'' }]); }
        function removeRow(realIdx) { setNccReturnItems(p => p.filter((_, j) => j !== realIdx)); }
        function updateRow(realIdx, key, val) { setNccReturnItems(p => p.map((r, j) => j === realIdx ? { ...r, [key]: val } : r)); }

        const SortArrow = ({ col }) => nccSortBy === col
          ? <span style={{ marginLeft:'4px', color:'#60a5fa' }}>{nccSortDir === 'asc' ? '↑' : '↓'}</span>
          : <span style={{ opacity:0.3, marginLeft:'4px' }}>↕</span>;

        const thSt = (col) => ({
          padding:'7px 10px', textAlign:'left', fontSize:'0.84rem', fontWeight:800,
          color: nccSortBy === col ? '#60a5fa' : '#a0a0b8', cursor:'pointer', userSelect:'none',
          background:'rgba(255,255,255,0.03)', borderBottom:'1px solid rgba(255,255,255,0.08)', whiteSpace:'nowrap',
        });

        return (
          <Modal title="🏪 NCC" onClose={() => setShowTraNcc(false)} size="lg"
            extra={
              <div style={{ display:'inline-flex', gap:'6px' }}>
                <button onClick={addRow} className="btn-secondary btn-sm">+ Thêm dòng</button>
                <button onClick={() => printNccReturn(sorted, { event_name: form.event_id ? events.find(e=>String(e.id)===String(form.event_id))?.name : '', responsible_person: form.responsible_person })}
                  className="btn-primary btn-sm" style={{ display:'inline-flex', alignItems:'center', gap:'5px' }}>
                  <Printer size={13} /> In phiếu
                </button>
              </div>
            }>
            {/* Sort bar */}
            <div style={{ display:'flex', gap:'6px', marginBottom:'10px', alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ color:'#5a5a80', fontSize:'0.84rem' }}>Sắp xếp:</span>
              {[['supplier','NCC'],['name','Tên thiết bị']].map(([col, label]) => (
                <button key={col} onClick={() => toggleSort(col)}
                  style={{ background:'rgba(255,255,255,0.06)', border:'none', borderRadius:'4px', color:'#a0a0b8', fontSize:'0.84rem', padding:'3px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:'3px' }}>
                  {label} <SortArrow col={col} />
                </button>
              ))}
            </div>
            {/* Cards */}
            <div>
              {sorted.length === 0 && (
                <div style={{ textAlign:'center', padding:'24px', color:'#7878a0', fontSize:'0.84rem' }}>Nhấn "+ Thêm dòng" để nhập thiết bị NCC cần trả.</div>
              )}
              {sorted.map((row, i) => {
                const realIdx = nccReturnItems.indexOf(row);
                const dKey = DEPT_KEY[row.dept];
                const rowNccs = dKey ? NCC_LIST.filter(n => NCC_DEPT[n]?.includes(dKey)) : row.dept ? [] : NCC_LIST;
                const dlId = `ncc-ef-${realIdx}`;
                const ipt = { width:'100%', background:'transparent', border:'none', outline:'none', fontSize:'0.85rem', padding:'4px 0' };
                const sep = { borderBottom:'1px solid rgba(255,255,255,0.07)', paddingBottom:'6px', marginBottom:'6px' };
                return (
                  <div key={i} style={{ background:'rgba(255,255,255,0.04)', borderRadius:'8px', padding:'10px 12px', marginBottom:'8px', border:'1px solid rgba(255,255,255,0.08)' }}>
                    {/* Dòng 1: index + bộ phận + xóa */}
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', ...sep }}>
                      <span style={{ color:'#5a5a80', fontSize:'0.84rem', minWidth:'18px' }}>{i+1}</span>
                      <select value={row.dept||''} onChange={e => updateRow(realIdx,'dept',e.target.value)}
                        style={{ flex:1, background:'#16162a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', color:'#a78bfa', fontSize:'0.82rem', height:'32px', padding:'0 6px', cursor:'pointer' }}>
                        <option value="">— Bộ phận —</option>
                        {NCC_DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <button onClick={() => removeRow(realIdx)}
                        style={{ background:'transparent', border:'none', cursor:'pointer', color:'#f87171', fontSize:'1.1rem', lineHeight:1, padding:'0 2px' }}>×</button>
                    </div>
                    {/* Dòng 2: NCC */}
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', ...sep }}>
                      <span style={{ color:'#5a5a80', fontSize:'0.78rem', width:'30px', flexShrink:0 }}>NCC</span>
                      <input value={row.supplier} onChange={e => updateRow(realIdx,'supplier',e.target.value)}
                        list={dlId} placeholder="Chọn hoặc nhập NCC..."
                        style={{ ...ipt, color:'#60a5fa' }} />
                      <datalist id={dlId}>{rowNccs.map(n => <option key={n} value={n} />)}</datalist>
                    </div>
                    {/* Dòng 3: Tên thiết bị */}
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', ...sep }}>
                      <span style={{ color:'#5a5a80', fontSize:'0.78rem', width:'30px', flexShrink:0 }}>Tên</span>
                      <input value={row.name} onChange={e => updateRow(realIdx,'name',e.target.value)} placeholder="Tên thiết bị..."
                        style={{ ...ipt, color:'#e0e0f0' }} />
                    </div>
                    {/* Dòng 4: SL + ĐV + Ghi chú */}
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <span style={{ color:'#5a5a80', fontSize:'0.78rem', flexShrink:0 }}>SL</span>
                      <input type="number" min={1} value={row.quantity} onChange={e => updateRow(realIdx,'quantity',parseInt(e.target.value)||1)}
                        style={{ width:'52px', background:'transparent', border:'none', outline:'none', color:'#fbbf24', fontWeight:700, fontSize:'0.85rem', textAlign:'center' }} />
                      <input value={row.unit} onChange={e => updateRow(realIdx,'unit',e.target.value)} placeholder="ĐV"
                        style={{ width:'48px', background:'transparent', border:'none', outline:'none', color:'#a0a0b8', fontSize:'0.82rem' }} />
                      <input value={row.notes} onChange={e => updateRow(realIdx,'notes',e.target.value)} placeholder="Ghi chú..."
                        style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#7878a0', fontSize:'0.84rem' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize:'0.84rem', color:'#5a5a80', marginTop:'8px' }}>{sorted.length} dòng</p>
          </Modal>
        );
      })()}
    </div>
  );
}
