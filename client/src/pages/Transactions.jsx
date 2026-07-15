import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import TransferModal from '../components/TransferModal';
import { printSlip } from '../utils/printSlip';
import { printNccReturn } from '../utils/printNccReturn';
import { NCC_LIST, NCC_DEPT } from '../utils/nccCatalog';
import { fmtD, fmtDT } from '../utils/fmt';
import {
  CalendarDays, ArrowUpFromLine, ArrowDownToLine,
  ClipboardList, ShieldAlert, ChevronUp, ChevronDown,
  Printer, MapPin, User, Archive, ArchiveRestore, Trash2,
} from 'lucide-react';

const GOLD = '#c9a84c';
const ALLOWED_ROLES = null; // tất cả người dùng đều xem được

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  planned:   { label: 'Lên kế hoạch', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  active:    { label: 'Đang diễn ra', color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  completed: { label: 'Hoàn thành',   color: GOLD,      bg: 'rgba(201,168,76,0.12)'  },
  cancelled: { label: 'Đã huỷ',       color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

const TX_CFG = {
  OUT:    { label: '↑ Xuất', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)' },
  RETURN: { label: '↓ Nhập', color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)'  },
};
const PENDING_COLOR = '#fbbf24';

function Badge({ color, bg, border, label }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '6px',
      fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap',
      background: bg, color, border: `1px solid ${border || color + '55'}`,
    }}>{label}</span>
  );
}

const fmtDate = fmtD;

// ── TX detail modal ───────────────────────────────────────────────────────────
function TxDetailModal({ txId, onClose, canEdit, onEdit, canEditCompleted, onEditCompleted }) {
  const [tx, setTx] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => { api.getTransactionById(txId).then(setTx).catch(() => setErr(true)); }, [txId]);
  if (err) return (
    <Modal title="Phiếu" onClose={onClose}>
      <div style={{ textAlign:'center', padding:'32px', color:'#f87171' }}>Không thể tải phiếu. Vui lòng thử lại.</div>
    </Modal>
  );
  if (!tx) return (
    <Modal title="Phiếu" onClose={onClose}>
      <div style={{ textAlign:'center', padding:'32px', color:'#7878a0' }}>Đang tải...</div>
    </Modal>
  );
  const condLabel = { good:'Tốt', damaged:'Hỏng', maintenance:'Cần sửa', lost:'Mất' };
  const condColor = { good:'#4ade80', damaged:'#f87171', maintenance:'#fbbf24', lost:'#94a3b8' };
  const cfg = TX_CFG[tx.type] || { label: tx.type, color: GOLD, bg: 'rgba(201,168,76,0.12)', border: 'rgba(201,168,76,0.3)' };
  const isPending = tx.status === 'pending';
  const isCompletedOut = tx.type === 'OUT' && tx.status === 'completed';
  return (
    <Modal title={tx.code} onClose={onClose} size="lg"
      extra={
        <div style={{ display:'inline-flex', gap:'6px' }}>
          {isPending && canEdit && (
            <button onClick={() => onEdit(tx.id)} className="btn-secondary btn-sm"
              style={{ display:'inline-flex', alignItems:'center', gap:'5px', borderColor:'rgba(251,191,36,0.5)', color:PENDING_COLOR }}>
              ✏️ Chỉnh sửa
            </button>
          )}
          {isCompletedOut && canEditCompleted && (
            <button onClick={() => onEditCompleted(tx.id)} className="btn-secondary btn-sm"
              style={{ display:'inline-flex', alignItems:'center', gap:'5px', borderColor:'rgba(251,191,36,0.4)', color:'#fbbf24' }}>
              ✏️ Chỉnh sửa
            </button>
          )}
          <button onClick={() => printSlip(tx)} className="btn-secondary btn-sm" style={{ display:'inline-flex', alignItems:'center', gap:'5px' }}><Printer size={13} /> In phiếu</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', fontSize:'0.85rem' }}>
          {[
            ['LOẠI', <Badge {...cfg} label={cfg.label} />],
            ['NGÀY', fmtDT(tx.transaction_date)],
            ['SỰ KIỆN', tx.event_name || 'Nội bộ'],
            ['PHỤ TRÁCH', tx.responsible_person || '—'],
          ].map(([lbl, val]) => (
            <div key={lbl}>
              <span style={{ color:'#7878a0', fontSize:'0.78rem' }}>{lbl}</span>
              <p style={{ color:'#e0e0ee', fontWeight:600, marginTop:'3px' }}>{val}</p>
            </div>
          ))}
        </div>
        {tx.notes && <p style={{ fontSize:'0.84rem', background:'rgba(255,255,255,0.04)', padding:'10px 12px', borderRadius:'8px', color:'#c9b98a', border:'1px solid rgba(201,168,76,0.22)', fontStyle:'normal' }}>{tx.notes}</p>}
        {((tx.items?.length || 0) + (tx.external_items?.length || 0)) > 0 && (
          <div>
            <h3 style={{ fontWeight:700, color:'#e0e0ee', marginBottom:'10px', fontSize:'0.85rem' }}>
              Danh sách thiết bị &nbsp;
              <span style={{ color:GOLD }}>{tx.items?.length || 0} KHO</span>
              {tx.external_items?.length > 0 && <span style={{ color:'#60a5fa' }}> · {tx.external_items.length} NCC</span>}
            </h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              {/* KHO items */}
              {(tx.items || []).map(it => (
                <div key={it.id} style={{
                  display:'grid', gridTemplateColumns:'1fr auto auto',
                  gap:'8px', alignItems:'center',
                  padding:'8px 10px', borderRadius:'8px',
                  background:'rgba(201,168,76,0.05)',
                  border:'1px solid rgba(201,168,76,0.15)',
                }}>
                  <div>
                    <p style={{ fontWeight:700, color:GOLD, margin:0, fontSize:'0.84rem' }}>{it.eq_name}</p>
                    <p style={{ fontSize:'0.82rem', color:'#7878a0', margin:'2px 0 0' }}>{it.eq_code}{it.category ? ` · ${it.category}` : ''}</p>
                  </div>
                  <span style={{ fontSize:'0.78rem', fontWeight:700, color: condColor[it.condition] || '#7878a0', whiteSpace:'nowrap' }}>
                    {condLabel[it.condition] || it.condition}
                  </span>
                  <span style={{ fontWeight:800, color:'#4ade80', fontSize:'0.92rem', whiteSpace:'nowrap', minWidth:'52px', textAlign:'right' }}>
                    {it.quantity} {it.unit}
                  </span>
                </div>
              ))}

              {/* Divider if both exist */}
              {tx.items?.length > 0 && tx.external_items?.length > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'2px 0' }}>
                  <div style={{ flex:1, height:'1px', background:'rgba(96,165,250,0.2)' }} />
                  <span style={{ fontSize:'0.80rem', color:'#60a5fa', fontWeight:700 }}>NCC</span>
                  <div style={{ flex:1, height:'1px', background:'rgba(96,165,250,0.2)' }} />
                </div>
              )}

              {/* NCC items */}
              {(tx.external_items || []).map((it, i) => (
                <div key={i} style={{
                  display:'grid', gridTemplateColumns:'1fr auto auto',
                  gap:'8px', alignItems:'center',
                  padding:'8px 10px', borderRadius:'8px',
                  background:'rgba(96,165,250,0.05)',
                  border:'1px solid rgba(96,165,250,0.18)',
                }}>
                  <div>
                    <p style={{ fontWeight:700, color:'#93c5fd', margin:0, fontSize:'0.84rem' }}>🏪 {it.name}</p>
                    <p style={{ fontSize:'0.82rem', color:'#7878a0', margin:'2px 0 0' }}>{it.supplier || 'Không rõ NCC'}</p>
                    {(it.rental_days > 0 || it.notes) && (
                      <p style={{ fontSize:'0.82rem', color:'#e8c97a', margin:'3px 0 0' }}>
                        {[it.rental_days > 0 ? `Thuê ${it.rental_days} ngày` : '', it.notes || ''].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize:'0.78rem', color:'#f87171', fontWeight:700, whiteSpace:'nowrap' }}>Thuê</span>
                  <span style={{ fontWeight:800, color:'#60a5fa', fontSize:'0.92rem', whiteSpace:'nowrap', minWidth:'52px', textAlign:'right' }}>
                    {it.quantity} {it.unit || 'Cái'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lịch sử chỉnh sửa */}
        {tx.edits?.length > 0 && (
          <div>
            <h3 style={{ fontWeight:700, color:'#fbbf24', marginBottom:'8px', fontSize:'0.84rem', textTransform:'uppercase', letterSpacing:'0.06em' }}>
              📝 Lịch sử chỉnh sửa ({tx.edits.length})
            </h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {tx.edits.map((e, i) => {
                let before = [], after = [];
                try { before = JSON.parse(e.items_before || '[]'); } catch { before = []; }
                try { after  = JSON.parse(e.items_after  || '[]'); } catch { after  = []; }
                return (
                  <div key={i} style={{ padding:'10px 12px', borderRadius:'8px', background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.2)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px', flexWrap:'wrap', marginBottom:'6px' }}>
                      <span style={{ fontWeight:700, color:'#fbbf24', fontSize:'0.84rem' }}>{e.edited_by_name}</span>
                      <span style={{ fontSize:'0.78rem', color:'#7878a0', whiteSpace:'nowrap' }}>{fmtDT(e.created_at)}</span>
                    </div>
                    <p style={{ fontSize:'0.84rem', color:'#e0e0ee', margin:'0 0 6px', fontStyle:'normal' }}>
                      Lý do: {e.reason}
                    </p>
                    <div style={{ fontSize:'0.84rem', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'6px', overflow:'hidden' }}>
                      {/* Header */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', background:'rgba(255,255,255,0.06)' }}>
                        <span style={{ padding:'4px 8px', color:'#f87171', fontWeight:700, borderRight:'1px solid rgba(255,255,255,0.15)' }}>Trước</span>
                        <span style={{ padding:'4px 8px', color:'#4ade80', fontWeight:700 }}>Sau</span>
                      </div>
                      {/* Rows */}
                      {Array.from({ length: Math.max(before.length, after.length) }).map((_, j) => {
                        const b = before[j], a = after[j];
                        const changed = b && a && (b.eq_name !== a.eq_name || b.quantity !== a.quantity);
                        return (
                          <div key={j} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', borderTop:'1px solid rgba(255,255,255,0.15)', background: changed ? 'rgba(251,191,36,0.05)' : 'transparent' }}>
                            <span style={{ padding:'4px 8px', borderRight:'1px solid rgba(255,255,255,0.15)', textDecoration: changed ? 'line-through' : 'none', opacity: changed ? 0.7 : 1 }}>
                              {b ? <>{b.eq_name} <span style={{ color:'#60a5fa', fontWeight:600 }}>×{b.quantity}</span> <span style={{ color:'#94a3b8', fontStyle:'normal' }}>{b.unit}</span></> : <span style={{ color:'#3a3a5a' }}>—</span>}
                            </span>
                            <span style={{ padding:'4px 8px' }}>
                              {a ? <>{a.eq_name} <span style={{ color: changed ? '#fbbf24' : '#60a5fa', fontWeight:600 }}>×{a.quantity}</span> <span style={{ color:'#94a3b8', fontStyle:'normal' }}>{a.unit}</span></> : <span style={{ color:'#3a3a5a' }}>—</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Edit pending OUT modal ────────────────────────────────────────────────────
function EditPendingModal({ txId, onClose, onSaved }) {
  const [tx, setTx]               = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [khoItems, setKhoItems]   = useState([]);
  const [extItems, setExtItems]   = useState([]);
  const [search, setSearch]       = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const mounted = useRef(true);
  const searchWrapRef = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    Promise.all([api.getTransactionById(txId), api.getEquipment()]).then(([txData, eqList]) => {
      if (!mounted.current) return;
      setTx(txData);
      setEquipment(eqList);
      setKhoItems((txData.items || []).map(it => ({
        equipment_id: it.equipment_id,
        eq_name: it.eq_name,
        eq_code: it.eq_code,
        unit: it.unit,
        quantity: it.quantity,
      })));
      setExtItems((txData.external_items || []).map(it => ({
        name:        it.name,
        supplier:    it.supplier    || '',
        quantity:    it.quantity    || 1,
        unit:        it.unit        || 'Cái',
        rental_days: it.rental_days || 1,
        notes:       it.notes       || '',
      })));
    }).catch(() => {
      if (mounted.current) setError('Không thể tải dữ liệu phiếu');
    });
  }, [txId]);

  const { user: currentUser } = useAuth();
  const ROLE_CAT = { TECHNICAL: ['TECH'], ATAS: ['LED','MATRIX','LIGHT','AUDIO'], STAGE: ['STAGE'], CSVC: ['CSVC'] };
  const allowedCats = ROLE_CAT[currentUser?.role] || null;

  const filteredEq = search.length >= 1
    ? equipment
        .filter(eq =>
          (!allowedCats || allowedCats.includes(eq.category_code)) &&
          (eq.name.toLowerCase().includes(search.toLowerCase()) ||
           eq.code.toLowerCase().includes(search.toLowerCase()))
        )
        .slice(0, 8)
    : [];

  const addEquipment = (eq) => {
    if (khoItems.some(i => i.equipment_id === eq.id)) return;
    setKhoItems(prev => [...prev, { equipment_id: eq.id, eq_name: eq.name, eq_code: eq.code, unit: eq.unit, quantity: 1 }]);
    setSearch('');
  };

  const removeKhoItem = (idx) => setKhoItems(prev => prev.filter((_, i) => i !== idx));
  const updateKhoQty = (idx, qty, clamp = false) =>
    setKhoItems(prev => prev.map((it, i) => i === idx
      ? { ...it, quantity: clamp ? Math.max(1, parseInt(qty) || 1) : qty }
      : it));

  const addExtItem    = () => setExtItems(prev => [...prev, { name: '', supplier: '', quantity: 1, unit: 'Cái', rental_days: 1, notes: '' }]);
  const removeExtItem = (idx) => setExtItems(prev => prev.filter((_, i) => i !== idx));
  const updateExtItem = (idx, field, val) =>
    setExtItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));

  const handleSave = async () => {
    const validKho = khoItems.filter(i => i.equipment_id && i.quantity > 0);
    const validExt = extItems.filter(i => i.name?.trim());
    if (!validKho.length && !validExt.length) { setError('Phiếu phải có ít nhất một thiết bị'); return; }
    setSaving(true); setError('');
    try {
      await api.updatePendingItems(txId, {
        items: validKho.map(i => ({ equipment_id: i.equipment_id, quantity: Math.max(1, parseInt(i.quantity) || 1) })),
        external_items: validExt,
      });
      if (mounted.current) onSaved();
    } catch (err) { if (mounted.current) setError(err.message); }
    finally { if (mounted.current) setSaving(false); }
  };

  if (!tx) return (
    <Modal title="Chỉnh sửa phiếu" onClose={onClose}>
      <div style={{ textAlign:'center', padding:'32px', color:'#7878a0' }}>Đang tải...</div>
    </Modal>
  );

  const inputStyle = { padding:'7px 10px', borderRadius:'7px', border:'1px solid rgba(201,168,76,0.3)', background:'rgba(255,255,255,0.06)', color:'#e0e0ee', fontSize:'0.83rem', width:'100%', boxSizing:'border-box' };
  const extInputStyle = { padding:'6px 8px', borderRadius:'6px', border:'1px solid rgba(96,165,250,0.22)', background:'rgba(255,255,255,0.06)', color:'#e0e0ee', fontSize:'0.84rem', width:'100%', boxSizing:'border-box' };

  return (
    <Modal title={`Chỉnh sửa: ${tx.code}`} onClose={onClose} size="lg">
      <div className="space-y-4">

        {/* Tìm kiếm thiết bị kho */}
        <div>
          <p style={{ fontSize:'0.82rem', color:'#7878a0', marginBottom:'6px', fontWeight:600 }}>Thêm thiết bị kho</p>
          <div ref={searchWrapRef} style={{ position:'relative' }}>
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tên hoặc mã thiết bị..."
              style={inputStyle}
            />
            {filteredEq.length > 0 && (() => {
              const rect = searchWrapRef.current?.getBoundingClientRect();
              return (
                <div style={{
                  position:'fixed',
                  top: rect ? rect.bottom + 3 : 0,
                  left: rect ? rect.left : 0,
                  width: rect ? rect.width : '100%',
                  zIndex: 9999,
                  borderRadius:'8px',
                  border:'1px solid rgba(201,168,76,0.25)', background:'#1a1a2e',
                  maxHeight:'176px', overflowY:'auto',
                  boxShadow:'0 8px 24px rgba(0,0,0,0.5)',
                }}>
                  {filteredEq.map(eq => {
                    const inList = khoItems.some(i => i.equipment_id === eq.id);
                    const freeQty = eq.qty_available;
                    return (
                      <button key={eq.id} onClick={() => !inList && addEquipment(eq)} disabled={inList}
                        style={{
                          width:'100%', padding:'8px 12px', textAlign:'left',
                          background:'transparent', border:'none', cursor: inList ? 'default' : 'pointer',
                          borderBottom:'1px solid rgba(255,255,255,0.04)',
                          display:'flex', justifyContent:'space-between', alignItems:'center',
                          opacity: inList ? 0.5 : 1,
                        }}
                        onMouseEnter={e => { if (!inList) e.currentTarget.style.background='rgba(201,168,76,0.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='transparent'; }}
                      >
                        <div style={{ minWidth:0, flex:1 }}>
                          <div>
                            <span style={{ color:GOLD, fontWeight:700, fontSize:'0.83rem' }}>{eq.name}</span>
                            <span style={{ color:'#7878a0', fontSize:'0.78rem', marginLeft:'8px' }}>{eq.code}</span>
                          </div>
                          {eq.category_name && (
                            <div style={{ fontSize:'0.82rem', color:'#a0a0c0', marginTop:'1px' }}>
                              {eq.category_icon} {eq.category_name}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize:'0.84rem', whiteSpace:'nowrap', marginLeft:'8px', color: inList ? '#7878a0' : freeQty > 0 ? '#4ade80' : '#f87171' }}>
                          {inList ? '✓ Đã có' : `${freeQty} ${eq.unit}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Danh sách thiết bị kho */}
        {khoItems.length > 0 && (
          <div>
            <p style={{ fontSize:'0.82rem', fontWeight:700, color:GOLD, marginBottom:'6px' }}>Thiết bị KHO ({khoItems.length})</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
              {khoItems.map((it, idx) => {
                const eq = equipment.find(e => e.id === it.equipment_id);
                const free = eq?.qty_available ?? 0;
                const qty = parseInt(it.quantity) || 0;
                const over = qty > free;
                return (
                <div key={idx} style={{
                  display:'grid', gridTemplateColumns:'1fr auto auto',
                  gap:'8px', alignItems:'center',
                  padding:'8px 10px', borderRadius:'8px',
                  background: over ? 'rgba(248,113,113,0.06)' : 'rgba(201,168,76,0.05)',
                  border: `1px solid ${over ? 'rgba(248,113,113,0.4)' : 'rgba(201,168,76,0.15)'}`,
                }}>
                  <div>
                    <p style={{ fontWeight:700, color:GOLD, margin:0, fontSize:'0.84rem' }}>{it.eq_name}</p>
                    <p style={{ fontSize:'0.82rem', margin:'2px 0 0', color: over ? '#f87171' : '#7878a0' }}>
                      {it.eq_code}{eq ? ` · còn ${free} ${it.unit}` : ''}
                      {over && <span style={{ marginLeft:'5px' }}>⚠ vượt tồn kho</span>}
                    </p>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                    <input type="number" min="1" value={it.quantity}
                      onChange={e => updateKhoQty(idx, e.target.value, false)}
                      onBlur={e => updateKhoQty(idx, e.target.value, true)}
                      style={{ width:'60px', padding:'5px 6px', borderRadius:'6px', textAlign:'center', background:'rgba(255,255,255,0.08)', border:`1px solid ${over ? 'rgba(248,113,113,0.6)' : 'rgba(201,168,76,0.3)'}`, color: over ? '#f87171' : '#e0e0ee', fontSize:'0.92rem', fontWeight:700 }}
                    />
                    <span style={{ fontSize:'0.84rem', color:'#7878a0' }}>{it.unit}</span>
                  </div>
                  <button onClick={() => removeKhoItem(idx)}
                    style={{ padding:'5px 8px', borderRadius:'6px', border:'1px solid rgba(248,113,113,0.3)', background:'transparent', color:'#f87171', cursor:'pointer', fontSize:'0.84rem' }}>
                    ✕
                  </button>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* NCC items */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
            <p style={{ fontSize:'0.82rem', fontWeight:700, color:'#60a5fa', margin:0 }}>Thiết bị NCC ({extItems.length})</p>
            <button onClick={addExtItem}
              style={{ padding:'3px 10px', borderRadius:'6px', border:'1px solid rgba(96,165,250,0.3)', background:'transparent', color:'#60a5fa', cursor:'pointer', fontSize:'0.80rem' }}>
              + Thêm
            </button>
          </div>
          {extItems.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
              {extItems.map((it, idx) => (
                <div key={idx} style={{ padding:'8px 10px', borderRadius:'8px', background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.18)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 64px 32px', gap:'6px', alignItems:'center' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                      <input placeholder="Tên thiết bị NCC *" value={it.name}
                        onChange={e => updateExtItem(idx, 'name', e.target.value)} style={extInputStyle} />
                      <input placeholder="Nhà cung cấp" value={it.supplier}
                        onChange={e => updateExtItem(idx, 'supplier', e.target.value)}
                        style={{ ...extInputStyle, color:'#a0a0c0', fontSize:'0.80rem' }} />
                      <input placeholder="Ghi chú..." value={it.notes || ''}
                        onChange={e => updateExtItem(idx, 'notes', e.target.value)}
                        style={{ ...extInputStyle, color:'#7878a0', fontSize:'0.84rem', fontStyle:'normal' }} />
                    </div>
                    <input type="number" min="1" value={it.quantity}
                      onChange={e => updateExtItem(idx, 'quantity', e.target.value)}
                      onBlur={e => updateExtItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                      style={{ padding:'5px', borderRadius:'6px', textAlign:'center', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(96,165,250,0.2)', color:'#e0e0ee', fontSize:'0.92rem', fontWeight:700 }} />
                    <button onClick={() => removeExtItem(idx)}
                      style={{ padding:'5px 7px', borderRadius:'6px', border:'1px solid rgba(248,113,113,0.3)', background:'transparent', color:'#f87171', cursor:'pointer', fontSize:'0.84rem' }}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p style={{ color:'#f87171', fontSize:'0.82rem', textAlign:'center', margin:0 }}>{error}</p>}

        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', paddingTop:'4px' }}>
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button onClick={handleSave} disabled={saving}
            style={{
              padding:'8px 22px', borderRadius:'8px', border:'none', cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? 'rgba(201,168,76,0.4)' : 'linear-gradient(135deg,#c9a84c,#e8c97a)',
              color:'#08080e', fontWeight:700, fontSize:'0.85rem',
            }}>
            {saving ? 'Đang lưu...' : '✅ Lưu thay đổi'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Delete completed OUT with reason modal ────────────────────────────────────
function DeleteReasonModal({ tx, onClose, onDeleted }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(255,255,255,0.05)', color: '#e0e0ee', fontSize: '0.83rem', boxSizing: 'border-box', resize: 'none' };
  async function handleDelete() {
    if (!reason.trim()) { setError('Vui lòng nhập lý do xóa'); return; }
    setSaving(true); setError('');
    try {
      await api.deleteTransaction(tx.id, reason.trim());
      onDeleted();
    } catch (err) { setError(err.message); setSaving(false); }
  }
  return (
    <Modal title={`Xóa phiếu ${tx.code}`} onClose={onClose} size="sm">
      <div className="space-y-4">
        <p style={{ fontSize: '0.85rem', color: '#f87171', background: 'rgba(248,113,113,0.08)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.25)' }}>
          ⚠️ Thao tác này sẽ <strong>hoàn tác tồn kho</strong> và không thể khôi phục.
        </p>
        <div>
          <p style={{ fontSize: '0.82rem', color: '#fbbf24', fontWeight: 700, marginBottom: '6px' }}>Lý do xóa *</p>
          <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Nhập lý do (bắt buộc)..." style={inputStyle} />
        </div>
        {error && <p style={{ color: '#f87171', fontSize: '0.82rem', margin: 0 }}>⚠️ {error}</p>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button onClick={handleDelete} disabled={saving || !reason.trim()}
            style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: (saving || !reason.trim()) ? 'not-allowed' : 'pointer', background: (saving || !reason.trim()) ? 'rgba(248,113,113,0.3)' : '#f87171', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
            {saving ? 'Đang xóa...' : '🗑 Xác nhận xóa'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Edit completed OUT modal ──────────────────────────────────────────────────
function EditCompletedModal({ txId, onClose, onSaved }) {
  const [tx, setTx]               = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [khoItems, setKhoItems]   = useState([]);
  const [extItems, setExtItems]   = useState([]);
  const [reason, setReason]       = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [expandedNotes, setExpandedNotes] = useState({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    Promise.all([api.getTransactionById(txId), api.getEquipment()]).then(([txData, eqList]) => {
      if (!mounted.current) return;
      setTx(txData);
      setEquipment(eqList);
      setKhoItems((txData.items || []).map(it => ({
        equipment_id: it.equipment_id,
        eq_name: it.eq_name,
        eq_code: it.eq_code,
        unit: it.unit,
        quantity: it.quantity,
        notes: it.notes || '',
        combo: it.combo || null,
        _search: '',
      })));
      setExtItems((txData.external_items || []).map(it => ({
        supplier: it.supplier || '',
        name: it.name || '',
        quantity: it.quantity || 1,
        unit: it.unit || 'Cái',
        rental_days: it.rental_days || 1,
        notes: it.notes || '',
      })));
    }).catch(() => { if (mounted.current) setError('Không thể tải dữ liệu phiếu'); });
  }, [txId]);

  const { user: currentUser } = useAuth();
  const ROLE_CAT2 = { TECHNICAL: ['TECH'], ATAS: ['LED','MATRIX','LIGHT','AUDIO'], STAGE: ['STAGE'], CSVC: ['CSVC'] };
  const allowedCats2 = ROLE_CAT2[currentUser?.role] || null;

  const addNewRow      = () => setKhoItems(prev => [...prev, { equipment_id: null, eq_name: '', eq_code: '', unit: '', quantity: 1, notes: '', combo: null, _search: '' }]);
  const selectEq       = (idx, eq) => {
    if (khoItems.some((it, i) => i !== idx && it.equipment_id === eq.id)) return;
    setKhoItems(prev => prev.map((it, i) => i === idx ? { ...it, equipment_id: eq.id, eq_name: eq.name, eq_code: eq.code, unit: eq.unit, _search: '' } : it));
  };
  const updateRowSearch = (idx, val) => setKhoItems(prev => prev.map((it, i) => i === idx ? { ...it, _search: val } : it));
  const removeItem      = (idx) => setKhoItems(prev => prev.filter((_, i) => i !== idx));
  const updateQty       = (idx, qty, clamp = false) =>
    setKhoItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: clamp ? Math.max(1, parseInt(qty) || 1) : qty } : it));
  const updateNotes     = (idx, val) =>
    setKhoItems(prev => prev.map((it, i) => i === idx ? { ...it, notes: val } : it));
  const updateCombo     = (idx, val) =>
    setKhoItems(prev => prev.map((it, i) => i === idx ? { ...it, combo: val || null } : it));

  const addExtItem    = () => setExtItems(p => [...p, { supplier: '', name: '', quantity: 1, unit: 'Cái', rental_days: 1, notes: '' }]);
  const removeExtItem = (i) => setExtItems(p => p.filter((_, j) => j !== i));
  const updateExtItem = (i, k, v) => setExtItems(p => p.map((it, j) => j === i ? { ...it, [k]: v } : it));

  const handleSave = async () => {
    if (!reason.trim()) { setError('Vui lòng nhập lý do chỉnh sửa'); return; }
    const validItems = khoItems.filter(i => i.equipment_id && (parseInt(i.quantity) || 0) > 0);
    if (!validItems.length) { setError('Phiếu phải có ít nhất một thiết bị kho'); return; }
    setSaving(true); setError('');
    try {
      await api.editCompletedItems(txId, {
        items: validItems.map(i => ({ equipment_id: i.equipment_id, quantity: Math.max(1, parseInt(i.quantity) || 1), notes: i.notes || null, combo: i.combo || null })),
        external_items: extItems.filter(i => i.name?.trim()),
        reason: reason.trim(),
      });
      if (mounted.current) onSaved();
    } catch (err) { if (mounted.current) setError(err.message); }
    finally { if (mounted.current) setSaving(false); }
  };

  const inputStyle = { padding:'7px 10px', borderRadius:'7px', border:'1px solid rgba(201,168,76,0.3)', background:'rgba(255,255,255,0.06)', color:'#e0e0ee', fontSize:'0.83rem', width:'100%', boxSizing:'border-box' };

  if (!tx) return (
    <Modal title="Chỉnh sửa phiếu" onClose={onClose}>
      <div style={{ textAlign:'center', padding:'32px', color:'#7878a0' }}>{error || 'Đang tải...'}</div>
    </Modal>
  );

  return (
    <Modal title={`Chỉnh sửa: ${tx.code}`} onClose={onClose} size="lg">
      <div className="space-y-4">

        {/* Lý do — bắt buộc */}
        <div style={{ padding:'12px 14px', borderRadius:'10px', background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.3)' }}>
          <p style={{ fontSize:'0.82rem', color:'#fbbf24', fontWeight:700, margin:'0 0 6px' }}>⚠ Lý do chỉnh sửa *</p>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Nhập lý do (bắt buộc)..."
            rows={2}
            style={{ ...inputStyle, borderColor:'rgba(251,191,36,0.4)', resize:'none' }}
          />
        </div>

        {/* NCC section — đặt trên để luôn thấy */}
        <div style={{ padding:'10px 12px', borderRadius:'10px', background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: extItems.length ? '8px' : 0 }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#60a5fa', margin: 0 }}>🏪 Nhà cung cấp / NCC ({extItems.length})</p>
            <button onClick={addExtItem} style={{ fontSize: '0.84rem', padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.12)', color: '#60a5fa', cursor: 'pointer' }}>+ Thêm</button>
          </div>
          {extItems.map((it, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '5px', marginBottom: '5px', padding: '8px', borderRadius: '8px', background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)' }}>
              <input placeholder="Nhà cung cấp" value={it.supplier} onChange={e => updateExtItem(idx, 'supplier', e.target.value)} style={{ ...inputStyle, fontSize: '0.84rem' }} />
              <input placeholder="Tên thiết bị *" value={it.name} onChange={e => updateExtItem(idx, 'name', e.target.value)} style={{ ...inputStyle, fontSize: '0.84rem' }} />
              <button onClick={() => removeExtItem(idx)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(248,113,113,0.3)', background: 'transparent', color: '#f87171', cursor: 'pointer' }}>✕</button>
              <input placeholder="Ghi chú" value={it.notes} onChange={e => updateExtItem(idx, 'notes', e.target.value)} style={{ ...inputStyle, fontSize: '0.84rem' }} />
              <div style={{ display: 'flex', gap: '4px' }}>
                <input type="number" min="1" placeholder="SL" value={it.quantity} onChange={e => updateExtItem(idx, 'quantity', parseInt(e.target.value) || 1)} style={{ ...inputStyle, width: '60px', fontSize: '0.84rem' }} />
                <input placeholder="ĐV" value={it.unit} onChange={e => updateExtItem(idx, 'unit', e.target.value)} style={{ ...inputStyle, width: '60px', fontSize: '0.84rem' }} />
                <input type="number" min="0" placeholder="Ngày" value={it.rental_days} onChange={e => updateExtItem(idx, 'rental_days', parseInt(e.target.value) || 0)} style={{ ...inputStyle, width: '65px', fontSize: '0.84rem' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Thiết bị kho — row-based như ExportForm */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
            <p style={{ fontSize:'0.82rem', fontWeight:700, color:GOLD, margin:0 }}>Thêm thiết bị kho ({khoItems.filter(i => i.equipment_id).length})</p>
            <button type="button" onClick={addNewRow}
              style={{ fontSize:'0.82rem', padding:'3px 10px', borderRadius:'6px', border:`1px solid ${GOLD}40`, background:`${GOLD}12`, color:GOLD, cursor:'pointer' }}>+ Thêm</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {khoItems.map((it, idx) => {
              const eq = equipment.find(e => e.id === it.equipment_id);
              const notesOpen = !!expandedNotes[idx];
              const isNew = !it.equipment_id;
              const rowFiltered = isNew && (it._search || '').length >= 1
                ? equipment.filter(e =>
                    (!allowedCats2 || allowedCats2.includes(e.category_code)) &&
                    !khoItems.some((ki, ki_i) => ki_i !== idx && ki.equipment_id === e.id) &&
                    (e.name.toLowerCase().includes(it._search.toLowerCase()) || e.code.toLowerCase().includes(it._search.toLowerCase()))
                  ).slice(0, 8)
                : [];
              return (
                <div key={idx} style={{ padding:'8px 10px', borderRadius:'8px', background:'rgba(201,168,76,0.05)', border:'1px solid rgba(201,168,76,0.15)' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:'8px' }}>
                    {/* Trái: search input hoặc tên thiết bị */}
                    <div style={{ flex:1, minWidth:0, position:'relative' }}>
                      {isNew ? (
                        <>
                          <input type="text" autoFocus value={it._search || ''}
                            onChange={e => updateRowSearch(idx, e.target.value)}
                            placeholder="Tìm tên hoặc mã thiết bị..."
                            style={{ ...inputStyle, fontSize:'0.84rem' }} />
                          {rowFiltered.length > 0 && (
                            <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:999, borderRadius:'8px', border:'1px solid rgba(201,168,76,0.25)', background:'#1a1a2e', maxHeight:'176px', overflowY:'auto', boxShadow:'0 8px 24px rgba(0,0,0,0.5)', marginTop:'3px' }}>
                              {rowFiltered.map(e => (
                                <button key={e.id} type="button" onClick={() => selectEq(idx, e)}
                                  style={{ width:'100%', padding:'8px 12px', textAlign:'left', background:'transparent', border:'none', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.04)', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                                  onMouseEnter={ev => { ev.currentTarget.style.background='rgba(201,168,76,0.1)'; }}
                                  onMouseLeave={ev => { ev.currentTarget.style.background='transparent'; }}>
                                  <div style={{ minWidth:0, flex:1 }}>
                                    <span style={{ color:GOLD, fontWeight:700, fontSize:'0.83rem' }}>{e.name}</span>
                                    <span style={{ color:'#7878a0', fontSize:'0.78rem', marginLeft:'8px' }}>{e.code}</span>
                                  </div>
                                  <span style={{ fontSize:'0.82rem', whiteSpace:'nowrap', marginLeft:'8px', color: e.qty_available > 0 ? '#4ade80' : '#f87171' }}>
                                    {e.qty_available} {e.unit}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <p style={{ fontWeight:700, color:GOLD, margin:0, fontSize:'0.84rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it.eq_name}</p>
                          <p style={{ fontSize:'0.78rem', margin:'2px 0 0', color:'#7878a0' }}>{it.eq_code}{eq ? ` · tồn ${eq.qty_available} ${it.unit}` : ''}</p>
                        </>
                      )}
                    </div>
                    {/* Phải: grid [Qty][X] / [✏️][THUÊ] + FREE */}
                    <div style={{ display:'grid', gridTemplateColumns:'52px 42px', gap:'5px', flexShrink:0 }}>
                      <input type="number" min="1" value={it.quantity}
                        onChange={e => updateQty(idx, e.target.value)}
                        onBlur={e => updateQty(idx, e.target.value, true)}
                        style={{ height:'36px', padding:'0', textAlign:'center', boxSizing:'border-box', borderRadius:'8px', border:'1px solid rgba(74,222,128,0.35)', background:'rgba(74,222,128,0.08)', color:'#4ade80', fontSize:'1.05rem', fontWeight:800, outline:'none' }}
                      />
                      <button type="button" onClick={() => removeItem(idx)}
                        style={{ height:'36px', borderRadius:'8px', border:'1px solid rgba(248,113,113,0.3)', background:'transparent', color:'rgba(248,113,113,0.65)', fontSize:'1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                      <button type="button" onClick={() => setExpandedNotes(p => ({ ...p, [idx]: !p[idx] }))}
                        style={{ height:'36px', borderRadius:'8px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.95rem',
                          border: notesOpen ? '1px solid #c9a84c' : '1px solid rgba(201,168,76,0.2)',
                          background: notesOpen ? 'rgba(201,168,76,0.18)' : 'transparent',
                          color: notesOpen ? '#e8c97a' : '#4a4a6a',
                        }}>✏️</button>
                      <button type="button" onClick={addExtItem}
                        style={{ height:'36px', borderRadius:'8px', cursor:'pointer', border:'1px solid rgba(96,165,250,0.3)', background:'transparent', color:'rgba(96,165,250,0.6)', fontSize:'0.74rem', fontWeight:800, letterSpacing:'0.02em', display:'flex', alignItems:'center', justifyContent:'center' }}>THUÊ</button>
                      <button type="button" onClick={() => updateCombo(idx, it.combo === null ? '' : null)}
                        style={{ height:'36px', borderRadius:'8px', cursor:'pointer', fontSize:'0.72rem', fontWeight:800, letterSpacing:'0.08em', display:'flex', alignItems:'center', justifyContent:'center',
                          border: it.combo !== null ? '1px solid rgba(167,139,250,0.7)' : '1px solid rgba(167,139,250,0.3)',
                          color: it.combo !== null ? '#a78bfa' : 'rgba(167,139,250,0.45)',
                          background: it.combo !== null ? 'rgba(167,139,250,0.12)' : 'transparent',
                        }}>FREE</button>
                      {it.combo !== null && (
                        <input type="number" min="1" placeholder="—" value={it.combo}
                          onChange={e => updateCombo(idx, e.target.value)}
                          style={{ height:'36px', padding:'0 4px', borderRadius:'8px', border:'1px solid rgba(167,139,250,0.5)', background:'rgba(167,139,250,0.06)', color:'#a78bfa', fontSize:'1rem', fontWeight:800, outline:'none', textAlign:'center', boxSizing:'border-box' }}
                        />
                      )}
                    </div>
                  </div>
                  {notesOpen && (
                    <div style={{ marginTop:'8px', borderTop:'1px solid rgba(201,168,76,0.12)', paddingTop:'8px' }}>
                      <input type="text" placeholder="Ghi chú..." value={it.notes || ''}
                        onChange={e => updateNotes(idx, e.target.value)}
                        autoFocus
                        style={{ width:'100%', padding:'6px 10px', borderRadius:'7px', border:'1px solid rgba(201,168,76,0.25)', background:'rgba(255,255,255,0.05)', color:'#e0e0ee', fontSize:'0.84rem', boxSizing:'border-box' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && <p style={{ color:'#f87171', fontSize:'0.82rem', textAlign:'center', margin:0 }}>{error}</p>}

        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', paddingTop:'4px' }}>
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button onClick={handleSave} disabled={saving || !reason.trim()}
            style={{ padding:'8px 22px', borderRadius:'8px', border:'none', cursor: (saving || !reason.trim()) ? 'not-allowed' : 'pointer', background: (saving || !reason.trim()) ? 'rgba(201,168,76,0.35)' : 'linear-gradient(135deg,#c9a84c,#e8c97a)', color:'#08080e', fontWeight:700, fontSize:'0.85rem' }}>
            {saving ? 'Đang lưu...' : '✅ Lưu thay đổi'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const NCC_DEPTS   = ['Sản Xuất','Kế Toán','Kỹ Thuật','ATAS-LED','Sân Khấu','Cơ Sở Vật Chất'];
const DEPT_KEY    = { 'Kỹ Thuật':'TECH', 'ATAS-LED':'ATAS', 'Sân Khấu':'STAGE' };
const ROLE_TO_DEPT = { TECHNICAL:'Kỹ Thuật', ATAS:'ATAS-LED', STAGE:'Sân Khấu', PRODUCTION:'Sản Xuất', ACCOUNTING:'Kế Toán', CSVC:'Cơ Sở Vật Chất' };

// ── Trả NCC modal ─────────────────────────────────────────────────────────────
function TraNccModal({ txId, onClose }) {
  const { user }              = useAuth();
  const [tx,      setTx]      = useState(null);
  const [items,   setItems]   = useState([]);
  const [sortBy,  setSortBy]  = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    api.getTransactionById(txId).then(data => {
      setTx(data);
      setItems((data.external_items || []).map(e => ({
        name: e.name || '', supplier: e.supplier || '',
        quantity: e.quantity || 1, unit: e.unit || 'Cái', notes: e.notes || '',
      })));
    });
  }, [txId]);

  const sorted = sortBy ? [...items].sort((a, b) => {
    const va = (a[sortBy] || '').toString().toLowerCase();
    const vb = (b[sortBy] || '').toString().toLowerCase();
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  }) : items;

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  }

  function addRow() { setItems(p => [...p, { dept: ROLE_TO_DEPT[user?.role] || '', name:'', supplier:'', quantity:1, unit:'Cái', notes:'' }]); }
  function removeRow(i) { setItems(p => p.filter((_, j) => j !== i)); }
  function updateRow(i, key, val) { setItems(p => p.map((r, j) => j === i ? { ...r, [key]: val } : r)); }

  const SortArrow = ({ col }) => {
    if (sortBy !== col) return <span style={{ opacity:0.3, marginLeft:'4px' }}>↕</span>;
    return <span style={{ marginLeft:'4px', color:'#60a5fa' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const thStyle = (col) => ({
    padding:'7px 10px', textAlign:'left', fontSize:'0.84rem', fontWeight:800,
    color: sortBy === col ? '#60a5fa' : '#a0a0b8',
    cursor:'pointer', userSelect:'none', background:'rgba(255,255,255,0.03)',
    borderBottom:'1px solid rgba(255,255,255,0.08)', whiteSpace:'nowrap',
  });

  return (
    <Modal title="🏪 Trả NCC" onClose={onClose} size="lg"
      extra={
        <div style={{ display:'inline-flex', gap:'6px' }}>
          <button onClick={addRow} className="btn-secondary btn-sm">+ Thêm dòng</button>
          <button onClick={() => printNccReturn(sorted, tx || {})} className="btn-primary btn-sm"
            style={{ display:'inline-flex', alignItems:'center', gap:'5px' }}>
            <Printer size={13} /> In phiếu
          </button>
        </div>
      }>
      {!tx ? (
        <div style={{ textAlign:'center', padding:'32px', color:'#7878a0' }}>Đang tải...</div>
      ) : (
        <>
          <div style={{ fontSize:'0.84rem', color:'#7878a0', marginBottom:'12px' }}>
            <span style={{ color:'#c9a84c', fontWeight:700 }}>{tx.code}</span>
            {tx.event_name && <> · {tx.event_name}</>}
            {tx.responsible_person && <> · {tx.responsible_person}</>}
          </div>
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
              <div style={{ textAlign:'center', padding:'24px', color:'#7878a0', fontSize:'0.84rem' }}>Chưa có thiết bị NCC. Nhấn "+ Thêm dòng" để nhập.</div>
            )}
            {sorted.map((row, i) => {
              const realIdx = items.indexOf(row);
              const dKey = DEPT_KEY[row.dept];
              const rowNccs = dKey ? NCC_LIST.filter(n => NCC_DEPT[n]?.includes(dKey)) : row.dept ? [] : NCC_LIST;
              const dlId = `ncc-tx-${realIdx}`;
              const ipt = { width:'100%', background:'transparent', border:'none', outline:'none', fontSize:'0.85rem', padding:'4px 0' };
              const sep = { borderBottom:'1px solid rgba(255,255,255,0.07)', paddingBottom:'6px', marginBottom:'6px' };
              return (
                <div key={i} style={{ background:'rgba(255,255,255,0.04)', borderRadius:'8px', padding:'10px 12px', marginBottom:'8px', border:'1px solid rgba(255,255,255,0.08)' }}>
                  {/* Dòng 1: index + bộ phận + xóa */}
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', ...sep }}>
                    <span style={{ color:'#5a5a80', fontSize:'0.84rem', minWidth:'18px' }}>{i + 1}</span>
                    <select value={row.dept || ''} onChange={e => updateRow(realIdx, 'dept', e.target.value)}
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
                    <input value={row.supplier} onChange={e => updateRow(realIdx, 'supplier', e.target.value)}
                      list={dlId} placeholder="Chọn hoặc nhập NCC..."
                      style={{ ...ipt, color:'#60a5fa' }} />
                    <datalist id={dlId}>{rowNccs.map(n => <option key={n} value={n} />)}</datalist>
                  </div>
                  {/* Dòng 3: Tên thiết bị */}
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', ...sep }}>
                    <span style={{ color:'#5a5a80', fontSize:'0.78rem', width:'30px', flexShrink:0 }}>Tên</span>
                    <input value={row.name} onChange={e => updateRow(realIdx, 'name', e.target.value)}
                      placeholder="Tên thiết bị..."
                      style={{ ...ipt, color:'#e0e0f0' }} />
                  </div>
                  {/* Dòng 4: SL + ĐV + Ghi chú */}
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ color:'#5a5a80', fontSize:'0.78rem', flexShrink:0 }}>SL</span>
                    <input type="number" min={1} value={row.quantity} onChange={e => updateRow(realIdx, 'quantity', parseInt(e.target.value) || 1)}
                      style={{ width:'52px', background:'transparent', border:'none', outline:'none', color:'#fbbf24', fontWeight:700, fontSize:'0.85rem', textAlign:'center' }} />
                    <input value={row.unit} onChange={e => updateRow(realIdx, 'unit', e.target.value)} placeholder="ĐV"
                      style={{ width:'48px', background:'transparent', border:'none', outline:'none', color:'#a0a0b8', fontSize:'0.82rem' }} />
                    <input value={row.notes} onChange={e => updateRow(realIdx, 'notes', e.target.value)} placeholder="Ghi chú..."
                      style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#7878a0', fontSize:'0.84rem' }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize:'0.84rem', color:'#5a5a80', marginTop:'8px' }}>{sorted.length} dòng</p>
        </>
      )}
    </Modal>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ Icon, title, color, border, count, children, maxHeight = '292px' }) {
  const [open, setOpen] = useState(true);
  const rgb = hexToRgb(color);
  return (
    <div style={{
      borderRadius: '14px', overflow: 'hidden', marginBottom: '14px',
      border: `1px solid ${border}`,
      boxShadow: `0 4px 24px rgba(${rgb},0.10)`,
    }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
          padding: '15px 20px',
          background: `linear-gradient(135deg, rgba(${rgb},0.18) 0%, rgba(${rgb},0.05) 100%)`,
          border: 'none', cursor: 'pointer', textAlign: 'left',
          borderBottom: open ? `1px solid ${border}` : 'none',
          borderLeft: `4px solid ${color}`,
        }}
      >
        {/* Icon box */}
        <div style={{
          width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
          background: `rgba(${rgb},0.18)`,
          border: `1px solid rgba(${rgb},0.35)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} strokeWidth={1.75} style={{ color }} />
        </div>

        <span style={{ fontWeight: 800, color, fontSize: '0.92rem', flex: 1, letterSpacing: '0.01em' }}>{title}</span>

        {count != null && (
          <span style={{
            fontSize: '0.84rem', fontWeight: 800,
            color: count > 0 ? '#08080e' : color,
            background: count > 0 ? color : 'transparent',
            border: count > 0 ? 'none' : `1px solid ${border}`,
            borderRadius: '9999px', padding: '3px 11px', minWidth: '28px', textAlign: 'center',
            boxShadow: count > 0 ? `0 0 12px rgba(${rgb},0.55)` : 'none',
          }}>
            {count}
          </span>
        )}
        {open
          ? <ChevronUp size={14} style={{ color, flexShrink: 0 }} />
          : <ChevronDown size={14} style={{ color, flexShrink: 0 }} />
        }
      </button>
      {open && (
        <div style={{ padding: '14px 16px', maxHeight, overflowY: 'auto',
          scrollbarWidth: 'thin', scrollbarColor: `${color}33 transparent` }}>
          {children}
        </div>
      )}
    </div>
  );
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

function Empty({ text }) {
  return <p style={{ color:'#7878a0', fontSize:'0.84rem', padding:'12px 0', textAlign:'center' }}>{text}</p>;
}

// ── Section contents ──────────────────────────────────────────────────────────
function EventRows({ events, isSuperAdmin, onArchive }) {
  if (!events.length) return <Empty text="Chưa có sự kiện nào" />;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      {events.map(ev => {
        const cfg = STATUS_CFG[ev.status] || STATUS_CFG.planned;
        return (
          <div key={ev.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', background:'rgba(255,255,255,0.02)', borderRadius:'8px' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontWeight:600, color:'#e0e0ee', margin:0, fontSize:'0.84rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.name}</p>
              <p style={{ fontSize:'0.78rem', color:'#7878a0', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {[ev.client, ev.location].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
              {ev.start_date && <span style={{ fontSize:'0.78rem', color:cfg.color }}>{fmtDate(ev.start_date)}</span>}
              <Badge color={cfg.color} bg={cfg.bg} label={cfg.label} />
              {isSuperAdmin && (
                <button
                  onClick={() => onArchive(ev)}
                  title="Lưu sự kiện vào kho"
                  style={{
                    padding:'6px 12px', borderRadius:'6px', cursor:'pointer',
                    border:'1px solid rgba(120,120,160,0.3)', background:'transparent',
                    color:'#7878a0', fontSize:'0.78rem', fontWeight:700,
                    whiteSpace:'nowrap', transition:'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(120,120,160,0.15)'; e.currentTarget.style.color='#a0a0c0'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#7878a0'; }}>
                  Lưu
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ArchivedEventRows({ events, isSuperAdmin, onUnarchive, onDelete }) {
  if (!events.length) return <Empty text="Chưa có sự kiện nào được lưu trữ" />;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      {events.map(ev => {
        const cfg = STATUS_CFG[ev.status] || STATUS_CFG.completed;
        const archivedDate = ev.archived_at ? new Date(ev.archived_at.replace(' ','T')) : null;
        return (
          <div key={ev.id} style={{ padding:'9px 12px', background:'rgba(255,255,255,0.02)', borderRadius:'8px', border:'1px solid rgba(120,120,160,0.12)' }}>
            {/* Hàng 1: tên + badge */}
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
              <p style={{ fontWeight:600, color:'#c0c0d8', margin:0, fontSize:'0.84rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, minWidth:0 }}>{ev.name}</p>
              <Badge color={cfg.color} bg={cfg.bg} label={cfg.label} />
            </div>
            {/* Hàng 2: client/location · ngày · phiếu */}
            <p style={{ fontSize:'0.78rem', color:'#7878a0', margin:'0 0 7px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {[ev.client, ev.location].filter(Boolean).join(' · ')}
              {ev.start_date && <span> · {fmtDate(ev.start_date)}</span>}
              {ev.tx_count > 0 && <span> · {ev.tx_count} phiếu</span>}
              {archivedDate && <span style={{ color:'#5a5a80' }}> · Lưu {fmtDate(ev.archived_at)}</span>}
            </p>
            {/* Hàng 3: nút (chỉ SUPER_ADMIN) */}
            {isSuperAdmin && (
              <div style={{ display:'flex', gap:'6px' }}>
                <button onClick={() => onUnarchive(ev)}
                  style={{ padding:'5px 10px', borderRadius:'6px', cursor:'pointer', border:'1px solid rgba(96,165,250,0.35)', background:'transparent', color:'#60a5fa', fontSize:'0.78rem', fontWeight:700 }}>
                  Bỏ lưu trữ
                </button>
                <button onClick={() => onDelete(ev)}
                  style={{ padding:'5px 10px', borderRadius:'6px', cursor:'pointer', border:'1px solid rgba(248,113,113,0.35)', background:'transparent', color:'#f87171', fontSize:'0.78rem', fontWeight:700 }}>
                  Xoá vĩnh viễn
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PendingTxRows({ txs, onConfirm, onSelect, onDelete, canDeleteRow, confirming }) {
  if (!txs.length) return <Empty text="Không có phiếu xuất kho tạm nào" />;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
      {txs.map(tx => (
        <div key={tx.id} style={{
          padding:'10px 12px', borderRadius:'10px',
          background:'rgba(251,191,36,0.05)',
          border:'1px solid rgba(251,191,36,0.3)',
          borderLeft:'3px solid #fbbf24',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'2px' }}>
            <p style={{ fontSize:'0.82rem', color:PENDING_COLOR, fontWeight:700, margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0, flex:1 }}>{tx.code}</p>
            <span style={{ fontSize:'0.82rem', background:'rgba(251,191,36,0.15)', color:PENDING_COLOR, border:'1px solid rgba(251,191,36,0.4)', borderRadius:'6px', padding:'2px 7px', fontWeight:700, flexShrink:0 }}>Chờ xuất</span>
          </div>
          <p style={{ fontSize:'0.78rem', color:'#7878a0', margin:'0 0 8px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {tx.event_name || 'Nội bộ'}{tx.responsible_person ? ` · ${tx.responsible_person}` : ''} · {(tx.item_count || 0) + (tx.ext_count || 0)} loại
          </p>
          <div style={{ display:'flex', gap:'6px', marginTop:'8px' }}>
            {onConfirm && (
              <button
                onClick={() => onConfirm(tx)}
                disabled={confirming === tx.id}
                style={{
                  flex:1, padding:'6px 10px', borderRadius:'7px', cursor: confirming === tx.id ? 'not-allowed' : 'pointer', fontWeight:700, fontSize:'0.84rem',
                  background:'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(251,191,36,0.12))',
                  border:'1px solid rgba(251,191,36,0.5)', color:PENDING_COLOR,
                  opacity: confirming === tx.id ? 0.5 : 1,
                }}>
                {confirming === tx.id ? '⏳ Đang xử lý...' : '✅ Xác nhận xuất kho'}
              </button>
            )}
            <button className="btn-secondary btn-sm" onClick={() => onSelect(tx.id)}>Chi tiết</button>
            {onDelete && (!canDeleteRow || canDeleteRow(tx)) && (
              <button style={{ padding:'5px 7px', borderRadius:'6px', border:'1px solid rgba(248,113,113,0.3)', background:'transparent', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center' }}
                onClick={() => onDelete(tx)} title="Hủy phiếu tạm">🗑</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TxRows({ txs, onSelect, onDelete, onTraNcc, onTransfer }) {
  if (!txs.length) return <Empty text="Chưa có phiếu nào" />;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      {txs.map(tx => {
        const cfg = TX_CFG[tx.type] || TX_CFG.OUT;
        return (
          <div key={tx.id} style={{ padding:'9px 12px', background:'rgba(255,255,255,0.02)', borderRadius:'8px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', marginBottom:'2px' }}>
              <p style={{ fontSize:'0.82rem', color:GOLD, fontWeight:700, margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0 }}>{tx.code}</p>
              <span style={{ fontSize:'0.78rem', color:'#7878a0', flexShrink:0 }}>{fmtD(tx.transaction_date)}</span>
            </div>
            <p style={{ fontSize:'0.78rem', color:'#7878a0', margin:'0 0 7px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {tx.event_name || 'Nội bộ'}{tx.responsible_person ? ` · ${tx.responsible_person}` : ''} · {(tx.item_count || 0) + (tx.ext_count || 0)} loại{tx.ext_count > 0 ? ` (${tx.ext_count} NCC)` : ''}
            </p>
            <div className="ev-card-row">
              <button className="ev-action" onClick={() => onSelect(tx.id)}><span className="ev-ico">📋</span><span className="ev-lbl">Chi tiết</span></button>
              {onTraNcc && tx.ext_count > 0 && (
                <button className="ev-action" onClick={() => onTraNcc(tx.id)}
                  style={{ borderColor:'rgba(74,222,128,0.35)', color:'#4ade80' }}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(74,222,128,0.1)'; e.currentTarget.style.borderColor='rgba(74,222,128,0.6)'; e.currentTarget.style.boxShadow='0 0 10px rgba(74,222,128,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background=''; e.currentTarget.style.borderColor='rgba(74,222,128,0.35)'; e.currentTarget.style.boxShadow=''; }}>
                  <span className="ev-ico">🏪</span><span className="ev-lbl">Trả NCC</span>
                </button>
              )}
              <button className="ev-action ev-action-edit"
                onClick={async () => { try { const full = await api.getTransactionById(tx.id); printSlip(full); } catch { alert('Không thể tải phiếu để in'); } }}>
                <span className="ev-ico"><Printer size={14} /></span><span className="ev-lbl">In</span>
              </button>
              {onTransfer && tx.type === 'OUT' && (
                <button className="ev-action"
                  style={{ borderColor:'rgba(248,113,113,0.35)', color:'rgba(248,113,113,0.7)' }}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(248,113,113,0.1)'; e.currentTarget.style.borderColor='rgba(248,113,113,0.6)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background=''; e.currentTarget.style.borderColor='rgba(248,113,113,0.35)'; }}
                  onClick={async () => {
                    try { const full = await api.getTransactionById(tx.id); onTransfer(full); }
                    catch { alert('Không thể tải phiếu'); }
                  }}>
                  <span className="ev-ico">🔄</span><span className="ev-lbl">Chuyển</span>
                </button>
              )}
              {onDelete && (
                <button className="ev-action ev-action-danger" onClick={() => onDelete(tx)} title="Xóa phiếu"><span className="ev-ico">🗑</span></button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReportRows({ reports }) {
  if (!reports.length) return <Empty text="Chưa có báo cáo nào" />;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      {reports.map(r => (
        <div key={r.id} style={{ padding:'9px 12px', background:'rgba(255,255,255,0.02)', borderRadius:'8px', display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontWeight:600, color:'#e0e0ee', margin:'0 0 2px', fontSize:'0.84rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.event_label || 'Sự kiện'}</p>
            <p style={{ fontSize:'0.78rem', color:'#7878a0', margin:0 }}>
              {r.location && <span style={{ marginRight:'8px', display:'inline-flex', alignItems:'center', gap:'3px' }}><MapPin size={11} /> {r.location}</span>}
              {r.reporter_name && <span style={{ display:'inline-flex', alignItems:'center', gap:'3px' }}><User size={11} /> {r.reporter_name}</span>}
            </p>
          </div>
          <div style={{ textAlign:'right', fontSize:'0.78rem', flexShrink:0 }}>
            {r.report_date && <div style={{ color:'#7878a0' }}>{fmtDate(r.report_date)}</div>}
            {r.service_quality && <div style={{ color:GOLD, fontWeight:600 }}>{r.service_quality}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ViolationRows({ violations, isSuperAdmin, onDelete }) {
  if (!violations.length) return <Empty text="Chưa có vi phạm nào" />;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      {violations.map(v => (
        <div key={v.id} style={{ padding:'9px 12px', background:'rgba(248,113,113,0.04)', border:'1px solid rgba(248,113,113,0.12)', borderRadius:'8px', display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontWeight:700, color:'#f87171', margin:'0 0 2px', fontSize:'0.84rem' }}>{v.violator}</p>
            <p style={{ fontSize:'0.78rem', color:'#7878a0', margin:0 }}>
              {v.violation_type}{v.event_label ? <> · <span style={{ color:'#e8c97a' }}>{v.event_label}</span></> : ''}
            </p>
          </div>
          <div style={{ textAlign:'right', fontSize:'0.78rem', color:'#7878a0', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'4px', justifyContent:'flex-end' }}><User size={11} /> {v.reporter_name}</div>
            <div>{fmtD(v.created_at)}</div>
          </div>
          {isSuperAdmin && (
            <button onClick={() => { if (confirm('Xóa vi phạm này?')) onDelete(v.id); }}
              style={{ background:'rgba(229,62,62,0.08)', border:'1px solid rgba(229,62,62,0.2)', color:'#fc8181', borderRadius:'6px', padding:'4px 8px', cursor:'pointer', fontSize:'0.84rem', flexShrink:0 }}>
              🗑
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Transactions() {
  const { user } = useAuth();
  const [events,         setEvents]         = useState([]);
  const [archivedEvents, setArchivedEvents] = useState([]);
  const [pendingTxs,     setPendingTxs]     = useState([]);
  const [outTxs,         setOutTxs]         = useState([]);
  const [returnTxs,      setReturnTxs]      = useState([]);
  const [reports,        setReports]        = useState([]);
  const [violations,     setViolations]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selectedTx,          setSelectedTx]          = useState(null);
  const [editingTx,           setEditingTx]           = useState(null);
  const [editingCompletedTx,  setEditingCompletedTx]  = useState(null);
  const [deletingCompletedTx, setDeletingCompletedTx] = useState(null);
  const [confirming,          setConfirming]          = useState(null);
  const [traNccTx,            setTraNccTx]            = useState(null);
  const [transferTx,          setTransferTx]          = useState(null);
  const [trashedTxs,          setTrashedTxs]          = useState([]);
  const [trashLoaded,         setTrashLoaded]         = useState(false);

  const isSuperAdmin      = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  const canConfirm        = ['SUPER_ADMIN', 'DIRECTOR', 'TECHNICAL', 'ATAS', 'STAGE', 'CSVC'].includes(user?.role) || !!user?.is_truong_phong;
  const canEdit           = ['SUPER_ADMIN', 'DIRECTOR', 'TECHNICAL', 'ATAS', 'STAGE', 'CSVC'].includes(user?.role) || !!user?.is_truong_phong;
  const canEditCompleted  = ['SUPER_ADMIN', 'DIRECTOR', 'ACCOUNTING'].includes(user?.role) || !!user?.is_truong_phong;

  const load = useCallback(() => {
    if (!user) return;
    Promise.all([
      api.getEvents({ limit: 200 }),
      api.getEvents({ include_archived: 'true', limit: 500 }),
      api.getTransactions({ type: 'OUT', status: 'pending',   limit: 10, hide_archived: 'true' }),
      api.getTransactions({ type: 'OUT', status: 'completed', limit: 10, hide_archived: 'true' }),
      api.getTransactions({ type: 'RETURN',                   limit: 10, hide_archived: 'true' }),
      api.getEventReports(),
      api.getViolations(),
    ]).then(([ev, allEv, pending, out, ret, rep, vio]) => {
      setEvents(ev);
      setArchivedEvents(allEv.filter(e => !!e.archived_at));
      setPendingTxs(pending); setOutTxs(out); setReturnTxs(ret);
      setReports(rep); setViolations(vio);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  async function handleDeleteTx(tx) {
    if (tx.type === 'OUT' && tx.status === 'completed') {
      setDeletingCompletedTx(tx);
      return;
    }
    const msg = tx.status === 'pending'
      ? `Hủy phiếu xuất kho tạm ${tx.code}?\nThiết bị chưa bị trừ kho, phiếu sẽ bị xóa.`
      : `Xóa phiếu ${tx.code}?\nThao tác này sẽ hoàn tác tồn kho tương ứng.`;
    if (!confirm(msg)) return;
    try {
      await api.deleteTransaction(tx.id);
      load();
    } catch (err) { alert(err.message); }
  }

  async function loadTrash() {
    try {
      const data = await api.getTransactionTrash();
      setTrashedTxs(data);
      setTrashLoaded(true);
    } catch (err) { alert(err.message); }
  }

  async function handlePermanentDelete(tx) {
    if (!confirm(`Xóa vĩnh viễn phiếu ${tx.code}?\n\nThao tác này không thể hoàn tác.`)) return;
    try {
      await api.permanentDeleteTransaction(tx.id);
      setTrashedTxs(p => p.filter(t => t.id !== tx.id));
    } catch (err) { alert(err.message); }
  }

  async function handleUnarchiveEvent(ev) {
    if (!confirm(`Bỏ lưu trữ sự kiện "${ev.name}"?\nSự kiện sẽ hiện trở lại trong danh sách chính.`)) return;
    try { await api.unarchiveEvent(ev.id); load(); }
    catch (err) { alert(err.message); }
  }

  async function handleDeleteArchivedEvent(ev) {
    if (!confirm(`Xoá vĩnh viễn sự kiện "${ev.name}"?\n\nToàn bộ phiếu xuất/nhập và dữ liệu liên quan sẽ bị xoá không thể khôi phục!`)) return;
    try { await api.deleteArchivedEvent(ev.id); load(); }
    catch (err) { alert(err.message); }
  }

  async function handleArchiveEvent(ev) {
    if (!confirm(`Lưu sự kiện "${ev.name}" vào kho?\n\nToàn bộ phiếu xuất/nhập và báo cáo liên quan sẽ được bảo toàn, không bị xoá.`)) return;
    try {
      const res = await api.archiveEvent(ev.id);
      const lines = [`✅ Đã lưu sự kiện "${ev.name}"`, `• ${res.tx_count} phiếu xuất/nhập`, `• ${res.report_count} báo cáo`, `Tất cả dữ liệu được giữ nguyên trong hệ thống.`];
      alert(lines.join('\n'));
      load();
    } catch (err) { alert(err.message); }
  }

  async function handleConfirmPending(tx) {
    if (!confirm(`Xác nhận xuất kho phiếu ${tx.code}?\nThiết bị sẽ được trừ khỏi kho ngay bây giờ.`)) return;
    setConfirming(tx.id);
    try {
      await api.confirmPending(tx.id);
      load();
    } catch (err) { alert(err.message); }
    finally { setConfirming(null); }
  }


  return (
    <div className="p-6">
      <div style={{ marginBottom:'22px' }}>
        <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'#e8c97a', margin:0 }}>Lịch Sử Vận Hành</h1>
        <p style={{ color:'#7878a0', fontSize:'0.82rem', margin:'4px 0 0' }}>Toàn bộ hoạt động của Khôi Minh</p>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#7878a0' }}>Đang tải...</div>
      ) : (
        <>
          <Section Icon={CalendarDays} title="Trạng thái sự kiện" color="#60a5fa" border="rgba(96,165,250,0.25)" count={events.length}>
            <EventRows events={events} isSuperAdmin={user?.role === 'SUPER_ADMIN'} onArchive={handleArchiveEvent} />
          </Section>

          <Section Icon={ArrowUpFromLine} title="Xuất kho tạm (chờ xác nhận)" color={PENDING_COLOR} border="rgba(251,191,36,0.25)" count={pendingTxs.length}>
            <PendingTxRows txs={pendingTxs} onConfirm={canConfirm ? handleConfirmPending : null} onSelect={setSelectedTx} onDelete={handleDeleteTx} canDeleteRow={tx => isSuperAdmin || tx.created_by_id === user?.id} confirming={confirming} />
          </Section>

          <Section Icon={ArrowUpFromLine} title="Xuất thiết bị sự kiện" color="#f87171" border="rgba(248,113,113,0.25)" count={outTxs.length} maxHeight="585px">
            <TxRows txs={outTxs} onSelect={setSelectedTx} onDelete={isSuperAdmin ? handleDeleteTx : null} onTraNcc={user?.is_tra_ncc ? setTraNccTx : null} onTransfer={canEdit ? setTransferTx : null} />
          </Section>

          <Section Icon={ArrowDownToLine} title="Nhập thiết bị sự kiện" color="#4ade80" border="rgba(74,222,128,0.25)" count={returnTxs.length} maxHeight="585px">
            <TxRows txs={returnTxs} onSelect={setSelectedTx} onDelete={isSuperAdmin ? handleDeleteTx : null} />
          </Section>

          <Section Icon={ClipboardList} title="Báo cáo sự kiện" color={GOLD} border="rgba(201,168,76,0.25)" count={reports.length}>
            <ReportRows reports={reports} />
          </Section>

          <Section Icon={ShieldAlert} title="Vi phạm nội quy" color="#f87171" border="rgba(248,113,113,0.25)" count={violations.length}>
            <ViolationRows violations={violations} isSuperAdmin={isSuperAdmin} onDelete={id => api.deleteViolation(id).then(load).catch(e => alert(e.message))} />
          </Section>

          <Section Icon={Archive} title="Lưu Trữ" color="#94a3b8" border="rgba(148,163,184,0.25)" count={archivedEvents.length}>
            <ArchivedEventRows
              events={archivedEvents}
              isSuperAdmin={user?.role === 'SUPER_ADMIN'}
              onUnarchive={handleUnarchiveEvent}
              onDelete={handleDeleteArchivedEvent}
            />
          </Section>

          {isSuperAdmin && (
            <Section Icon={Trash2} title="Thùng Rác" color="#f87171" border="rgba(248,113,113,0.18)" count={trashLoaded ? trashedTxs.length : '?'}>
              {!trashLoaded ? (
                <div style={{ textAlign:'center', padding:'12px 0' }}>
                  <button onClick={loadTrash} style={{ padding:'7px 18px', background:'rgba(248,113,113,0.12)', border:'1px solid rgba(248,113,113,0.35)', borderRadius:'8px', color:'#f87171', fontWeight:700, fontSize:'0.82rem', cursor:'pointer' }}>
                    Tải thùng rác
                  </button>
                </div>
              ) : trashedTxs.length === 0 ? (
                <p style={{ color:'#7878a0', fontSize:'0.82rem', padding:'8px 0' }}>Thùng rác trống</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {trashedTxs.map(tx => {
                    const typeLabel = tx.type === 'OUT' ? '⬆ Xuất' : tx.type === 'RETURN' ? '⬇ Nhập' : tx.type === 'INTAKE' ? '📦 Nhập NCC' : tx.type === 'FIX' ? '🔧 Bảo trì' : tx.type;
                    const typeColor = tx.type === 'OUT' ? '#f87171' : tx.type === 'RETURN' ? '#4ade80' : '#a78bfa';
                    return (
                      <div key={tx.id} style={{ padding:'10px 12px', background:'rgba(248,113,113,0.05)', border:'1px solid rgba(248,113,113,0.15)', borderRadius:'8px', display:'flex', alignItems:'flex-start', gap:'10px' }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'3px' }}>
                            <span style={{ fontWeight:700, color:typeColor, fontSize:'0.84rem' }}>{typeLabel}</span>
                            <span style={{ fontWeight:700, color:'#e8c97a', fontSize:'0.85rem' }}>{tx.code}</span>
                            {tx.event_name && <span style={{ color:'#7878a0', fontSize:'0.82rem' }}>— {tx.event_name}</span>}
                          </div>
                          <div style={{ fontSize:'0.82rem', color:'#7878a0' }}>
                            {tx.item_count > 0 && <span>{tx.item_count} thiết bị · </span>}
                            Xóa bởi <span style={{ color:'#c0c0d8' }}>{tx.deleted_by_name}</span> lúc {fmtDT(tx.deleted_at)}
                          </div>
                          {tx.deleted_reason && (
                            <div style={{ fontSize:'0.82rem', color:'#f87171', marginTop:'2px' }}>Lý do: {tx.deleted_reason}</div>
                          )}
                        </div>
                        {user?.role === 'SUPER_ADMIN' && (
                          <button onClick={() => handlePermanentDelete(tx)} style={{ padding:'5px 10px', background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.4)', borderRadius:'6px', color:'#f87171', fontWeight:700, fontSize:'0.84rem', cursor:'pointer', flexShrink:0, whiteSpace:'nowrap' }}>
                            Xóa vĩnh viễn
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          )}
        </>
      )}

      {selectedTx && (
        <TxDetailModal
          txId={selectedTx}
          onClose={() => setSelectedTx(null)}
          canEdit={canEdit}
          onEdit={(id) => { setSelectedTx(null); setEditingTx(id); }}
          canEditCompleted={canEditCompleted}
          onEditCompleted={(id) => { setSelectedTx(null); setEditingCompletedTx(id); }}
        />
      )}
      {editingTx && (
        <EditPendingModal
          txId={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={() => { setEditingTx(null); load(); }}
        />
      )}
      {editingCompletedTx && (
        <EditCompletedModal
          txId={editingCompletedTx}
          onClose={() => setEditingCompletedTx(null)}
          onSaved={() => { setEditingCompletedTx(null); load(); }}
        />
      )}
      {deletingCompletedTx && (
        <DeleteReasonModal
          tx={deletingCompletedTx}
          onClose={() => setDeletingCompletedTx(null)}
          onDeleted={() => { setDeletingCompletedTx(null); load(); }}
        />
      )}
      {traNccTx && (
        <TraNccModal txId={traNccTx} onClose={() => setTraNccTx(null)} />
      )}
      {transferTx && (
        <TransferModal
          tx={transferTx}
          events={events}
          onClose={() => setTransferTx(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
