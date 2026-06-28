import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import { printSlip } from '../utils/printSlip';
import { fmtD, fmtDT } from '../utils/fmt';
import {
  CalendarDays, ArrowUpFromLine, ArrowDownToLine,
  ClipboardList, ShieldAlert, ChevronUp, ChevronDown,
  Printer, MapPin, User,
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
      fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap',
      background: bg, color, border: `1px solid ${border || color + '55'}`,
    }}>{label}</span>
  );
}

const fmtDate = fmtD;

// ── TX detail modal ───────────────────────────────────────────────────────────
function TxDetailModal({ txId, onClose, canEdit, onEdit }) {
  const [tx, setTx] = useState(null);
  useEffect(() => { api.getTransactionById(txId).then(setTx); }, [txId]);
  if (!tx) return (
    <Modal title="Phiếu" onClose={onClose}>
      <div style={{ textAlign:'center', padding:'32px', color:'#7878a0' }}>Đang tải...</div>
    </Modal>
  );
  const condLabel = { good:'Tốt', damaged:'Hỏng', maintenance:'Cần sửa', lost:'Mất' };
  const condColor = { good:'#4ade80', damaged:'#f87171', maintenance:'#fbbf24', lost:'#94a3b8' };
  const cfg = TX_CFG[tx.type] || { label: tx.type, color: GOLD, bg: 'rgba(201,168,76,0.12)', border: 'rgba(201,168,76,0.3)' };
  const isPending = tx.status === 'pending';
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
              <span style={{ color:'#7878a0', fontSize:'0.7rem' }}>{lbl}</span>
              <p style={{ color:'#e0e0ee', fontWeight:600, marginTop:'3px' }}>{val}</p>
            </div>
          ))}
        </div>
        {tx.notes && <p style={{ fontSize:'0.84rem', background:'rgba(255,255,255,0.04)', padding:'10px 12px', borderRadius:'8px', color:'#c9b98a', border:'1px solid rgba(201,168,76,0.22)', fontStyle:'italic' }}>{tx.notes}</p>}
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
                    <p style={{ fontSize:'0.68rem', color:'#7878a0', margin:'2px 0 0' }}>{it.eq_code}{it.category ? ` · ${it.category}` : ''}</p>
                  </div>
                  <span style={{ fontSize:'0.7rem', fontWeight:700, color: condColor[it.condition] || '#7878a0', whiteSpace:'nowrap' }}>
                    {condLabel[it.condition] || it.condition}
                  </span>
                  <span style={{ fontWeight:800, color:'#4ade80', fontSize:'0.9rem', whiteSpace:'nowrap', minWidth:'52px', textAlign:'right' }}>
                    {it.quantity} {it.unit}
                  </span>
                </div>
              ))}

              {/* Divider if both exist */}
              {tx.items?.length > 0 && tx.external_items?.length > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'2px 0' }}>
                  <div style={{ flex:1, height:'1px', background:'rgba(96,165,250,0.2)' }} />
                  <span style={{ fontSize:'0.65rem', color:'#60a5fa', fontWeight:700 }}>NCC</span>
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
                    <p style={{ fontSize:'0.68rem', color:'#7878a0', margin:'2px 0 0' }}>{it.supplier || 'Không rõ NCC'}</p>
                    {(it.rental_days > 0 || it.notes) && (
                      <p style={{ fontSize:'0.68rem', color:'#e8c97a', margin:'3px 0 0' }}>
                        {[it.rental_days > 0 ? `Thuê ${it.rental_days} ngày` : '', it.notes || ''].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize:'0.7rem', color:'#f87171', fontWeight:700, whiteSpace:'nowrap' }}>Thuê</span>
                  <span style={{ fontWeight:800, color:'#60a5fa', fontSize:'0.9rem', whiteSpace:'nowrap', minWidth:'52px', textAlign:'right' }}>
                    {it.quantity} {it.unit || 'Cái'}
                  </span>
                </div>
              ))}
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
    });
  }, [txId]);

  const filteredEq = search.length >= 1
    ? equipment
        .filter(eq =>
          eq.name.toLowerCase().includes(search.toLowerCase()) ||
          eq.code.toLowerCase().includes(search.toLowerCase())
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

  const addExtItem    = () => setExtItems(prev => [...prev, { name: '', supplier: '', quantity: 1, unit: 'Cái', rental_days: 1 }]);
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
  const extInputStyle = { padding:'6px 8px', borderRadius:'6px', border:'1px solid rgba(96,165,250,0.22)', background:'rgba(255,255,255,0.06)', color:'#e0e0ee', fontSize:'0.8rem', width:'100%', boxSizing:'border-box' };

  return (
    <Modal title={`Chỉnh sửa: ${tx.code}`} onClose={onClose} size="lg">
      <div className="space-y-4">

        {/* Tìm kiếm thiết bị kho */}
        <div>
          <p style={{ fontSize:'0.75rem', color:'#7878a0', marginBottom:'6px', fontWeight:600 }}>Thêm thiết bị kho</p>
          <div style={{ position:'relative' }}>
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tên hoặc mã thiết bị..."
              style={inputStyle}
            />
            {filteredEq.length > 0 && (
              <div style={{
                position:'absolute', top:'100%', left:0, right:0, zIndex:50,
                marginTop:'3px', borderRadius:'8px',
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
                      <div>
                        <span style={{ color:GOLD, fontWeight:700, fontSize:'0.83rem' }}>{eq.name}</span>
                        <span style={{ color:'#7878a0', fontSize:'0.7rem', marginLeft:'8px' }}>{eq.code}</span>
                      </div>
                      <span style={{ fontSize:'0.72rem', whiteSpace:'nowrap', color: inList ? '#7878a0' : freeQty > 0 ? '#4ade80' : '#f87171' }}>
                        {inList ? '✓ Đã có' : `${freeQty} ${eq.unit}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Danh sách thiết bị kho */}
        {khoItems.length > 0 && (
          <div>
            <p style={{ fontSize:'0.75rem', fontWeight:700, color:GOLD, marginBottom:'6px' }}>Thiết bị KHO ({khoItems.length})</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
              {khoItems.map((it, idx) => (
                <div key={idx} style={{
                  display:'grid', gridTemplateColumns:'1fr auto auto',
                  gap:'8px', alignItems:'center',
                  padding:'8px 10px', borderRadius:'8px',
                  background:'rgba(201,168,76,0.05)', border:'1px solid rgba(201,168,76,0.15)',
                }}>
                  <div>
                    <p style={{ fontWeight:700, color:GOLD, margin:0, fontSize:'0.84rem' }}>{it.eq_name}</p>
                    <p style={{ fontSize:'0.68rem', color:'#7878a0', margin:'2px 0 0' }}>{it.eq_code}</p>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                    <input type="number" min="1" value={it.quantity}
                      onChange={e => updateKhoQty(idx, e.target.value, false)}
                      onBlur={e => updateKhoQty(idx, e.target.value, true)}
                      style={{ width:'60px', padding:'5px 6px', borderRadius:'6px', textAlign:'center', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(201,168,76,0.3)', color:'#e0e0ee', fontSize:'0.9rem', fontWeight:700 }}
                    />
                    <span style={{ fontSize:'0.72rem', color:'#7878a0' }}>{it.unit}</span>
                  </div>
                  <button onClick={() => removeKhoItem(idx)}
                    style={{ padding:'5px 8px', borderRadius:'6px', border:'1px solid rgba(248,113,113,0.3)', background:'transparent', color:'#f87171', cursor:'pointer', fontSize:'0.8rem' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NCC items */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
            <p style={{ fontSize:'0.75rem', fontWeight:700, color:'#60a5fa', margin:0 }}>Thiết bị NCC ({extItems.length})</p>
            <button onClick={addExtItem}
              style={{ padding:'3px 10px', borderRadius:'6px', border:'1px solid rgba(96,165,250,0.3)', background:'transparent', color:'#60a5fa', cursor:'pointer', fontSize:'0.74rem' }}>
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
                        style={{ ...extInputStyle, color:'#a0a0c0', fontSize:'0.73rem' }} />
                    </div>
                    <input type="number" min="1" value={it.quantity}
                      onChange={e => updateExtItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                      style={{ padding:'5px', borderRadius:'6px', textAlign:'center', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(96,165,250,0.2)', color:'#e0e0ee', fontSize:'0.9rem', fontWeight:700 }} />
                    <button onClick={() => removeExtItem(idx)}
                      style={{ padding:'5px 7px', borderRadius:'6px', border:'1px solid rgba(248,113,113,0.3)', background:'transparent', color:'#f87171', cursor:'pointer', fontSize:'0.8rem' }}>
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

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ Icon, title, color, border, count, children }) {
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
            fontSize: '0.72rem', fontWeight: 800,
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
        <div style={{ padding: '14px 16px', maxHeight: '292px', overflowY: 'auto',
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
  return <p style={{ color:'#7878a0', fontSize:'0.8rem', padding:'12px 0', textAlign:'center' }}>{text}</p>;
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
              <p style={{ fontSize:'0.7rem', color:'#7878a0', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {[ev.client, ev.location].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
              {ev.start_date && <span style={{ fontSize:'0.7rem', color:cfg.color }}>{fmtDate(ev.start_date)}</span>}
              <Badge color={cfg.color} bg={cfg.bg} label={cfg.label} />
              {isSuperAdmin && (
                <button
                  onClick={() => onArchive(ev)}
                  title="Lưu sự kiện vào kho"
                  style={{
                    padding:'6px 12px', borderRadius:'6px', cursor:'pointer',
                    border:'1px solid rgba(120,120,160,0.3)', background:'transparent',
                    color:'#7878a0', fontSize:'0.7rem', fontWeight:700,
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

function PendingTxRows({ txs, onConfirm, onSelect, onDelete, confirming }) {
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
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontFamily:'monospace', fontSize:'0.75rem', color:PENDING_COLOR, fontWeight:700, margin:'0 0 2px' }}>{tx.code}</p>
              <p style={{ fontSize:'0.7rem', color:'#7878a0', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {tx.event_name || 'Nội bộ'}{tx.responsible_person ? ` · ${tx.responsible_person}` : ''} · {(tx.item_count || 0) + (tx.ext_count || 0)} loại
              </p>
            </div>
            <span style={{ fontSize:'0.68rem', background:'rgba(251,191,36,0.15)', color:PENDING_COLOR, border:'1px solid rgba(251,191,36,0.4)', borderRadius:'6px', padding:'2px 7px', fontWeight:700, flexShrink:0 }}>
              Chờ xuất
            </span>
          </div>
          <div style={{ display:'flex', gap:'6px', marginTop:'8px' }}>
            {onConfirm && (
              <button
                onClick={() => onConfirm(tx)}
                disabled={confirming === tx.id}
                style={{
                  flex:1, padding:'6px 10px', borderRadius:'7px', cursor: confirming === tx.id ? 'not-allowed' : 'pointer', fontWeight:700, fontSize:'0.78rem',
                  background:'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(251,191,36,0.12))',
                  border:'1px solid rgba(251,191,36,0.5)', color:PENDING_COLOR,
                  opacity: confirming === tx.id ? 0.5 : 1,
                }}>
                {confirming === tx.id ? '⏳ Đang xử lý...' : '✅ Xác nhận xuất kho'}
              </button>
            )}
            <button className="btn-secondary btn-sm" onClick={() => onSelect(tx.id)}>Chi tiết</button>
            {onDelete && (
              <button style={{ padding:'5px 7px', borderRadius:'6px', border:'1px solid rgba(248,113,113,0.3)', background:'transparent', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center' }}
                onClick={() => onDelete(tx)} title="Hủy phiếu tạm">🗑</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TxRows({ txs, onSelect, onDelete }) {
  if (!txs.length) return <Empty text="Chưa có phiếu nào" />;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      {txs.map(tx => {
        const cfg = TX_CFG[tx.type] || TX_CFG.OUT;
        return (
          <div key={tx.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'9px 12px', background:'rgba(255,255,255,0.02)', borderRadius:'8px' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontFamily:'monospace', fontSize:'0.75rem', color:GOLD, fontWeight:700, margin:'0 0 2px' }}>{tx.code}</p>
              <p style={{ fontSize:'0.7rem', color:'#7878a0', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {tx.event_name || 'Nội bộ'}{tx.responsible_person ? ` · ${tx.responsible_person}` : ''} · {(tx.item_count || 0) + (tx.ext_count || 0)} loại{tx.ext_count > 0 ? ` (${tx.ext_count} NCC)` : ''}
              </p>
            </div>
            <span style={{ fontSize:'0.7rem', color:'#7878a0', flexShrink:0 }}>
              {fmtD(tx.transaction_date)}
            </span>
            <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
              <button className="btn-secondary btn-sm" onClick={() => onSelect(tx.id)}>Chi tiết</button>
              <button style={{ padding:'5px 7px', borderRadius:'6px', border:'1px solid rgba(201,168,76,0.3)', background:'transparent', color:GOLD, cursor:'pointer', display:'flex', alignItems:'center' }}
                onClick={async () => { const full = await api.getTransactionById(tx.id); printSlip(full); }}><Printer size={14} /></button>
              {onDelete && (
                <button style={{ padding:'5px 7px', borderRadius:'6px', border:'1px solid rgba(248,113,113,0.3)', background:'transparent', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center' }}
                  onClick={() => onDelete(tx)} title="Xóa phiếu">🗑</button>
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
            <p style={{ fontSize:'0.7rem', color:'#7878a0', margin:0 }}>
              {r.location && <span style={{ marginRight:'8px', display:'inline-flex', alignItems:'center', gap:'3px' }}><MapPin size={11} /> {r.location}</span>}
              {r.reporter_name && <span style={{ display:'inline-flex', alignItems:'center', gap:'3px' }}><User size={11} /> {r.reporter_name}</span>}
            </p>
          </div>
          <div style={{ textAlign:'right', fontSize:'0.7rem', flexShrink:0 }}>
            {r.report_date && <div style={{ color:'#7878a0' }}>{fmtDate(r.report_date)}</div>}
            {r.service_quality && <div style={{ color:GOLD, fontWeight:600 }}>{r.service_quality}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ViolationRows({ violations }) {
  if (!violations.length) return <Empty text="Chưa có vi phạm nào" />;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      {violations.map(v => (
        <div key={v.id} style={{ padding:'9px 12px', background:'rgba(248,113,113,0.04)', border:'1px solid rgba(248,113,113,0.12)', borderRadius:'8px', display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontWeight:700, color:'#f87171', margin:'0 0 2px', fontSize:'0.84rem' }}>{v.violator}</p>
            <p style={{ fontSize:'0.7rem', color:'#7878a0', margin:0 }}>
              {v.violation_type}{v.event_label ? ` · ${v.event_label}` : ''}
            </p>
          </div>
          <div style={{ textAlign:'right', fontSize:'0.7rem', color:'#7878a0', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'4px', justifyContent:'flex-end' }}><User size={11} /> {v.reporter_name}</div>
            <div>{fmtD(v.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Transactions() {
  const { user } = useAuth();
  const [events,     setEvents]     = useState([]);
  const [pendingTxs, setPendingTxs] = useState([]);
  const [outTxs,     setOutTxs]     = useState([]);
  const [returnTxs,  setReturnTxs]  = useState([]);
  const [reports,    setReports]    = useState([]);
  const [violations, setViolations] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);
  const [editingTx,  setEditingTx]  = useState(null);
  const [confirming, setConfirming] = useState(null);

  const isSuperAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  const canConfirm   = ['SUPER_ADMIN', 'DIRECTOR', 'TECHNICAL', 'ATAS', 'STAGE', 'CSVC'].includes(user?.role);
  const canEdit      = ['SUPER_ADMIN', 'DIRECTOR', 'TECHNICAL', 'ATAS', 'STAGE', 'CSVC'].includes(user?.role);

  const load = useCallback(() => {
    if (!user) return;
    Promise.all([
      api.getEvents({ limit: 200 }),
      api.getTransactions({ type: 'OUT', status: 'pending',   limit: 200, hide_archived: 'true' }),
      api.getTransactions({ type: 'OUT', status: 'completed', limit: 200, hide_archived: 'true' }),
      api.getTransactions({ type: 'RETURN',                   limit: 200, hide_archived: 'true' }),
      api.getEventReports(),
      api.getViolations(),
    ]).then(([ev, pending, out, ret, rep, vio]) => {
      setEvents(ev); setPendingTxs(pending); setOutTxs(out); setReturnTxs(ret);
      setReports(rep); setViolations(vio);
    }).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  async function handleDeleteTx(tx) {
    const msg = tx.status === 'pending'
      ? `Hủy phiếu xuất kho tạm ${tx.code}?\nThiết bị chưa bị trừ kho, phiếu sẽ bị xóa.`
      : `Xóa phiếu ${tx.code}?\nThao tác này sẽ hoàn tác tồn kho tương ứng.`;
    if (!confirm(msg)) return;
    try {
      await api.deleteTransaction(tx.id);
      load();
    } catch (err) { alert(err.message); }
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
    <div className="p-6 max-w-3xl">
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
            <PendingTxRows txs={pendingTxs} onConfirm={canConfirm ? handleConfirmPending : null} onSelect={setSelectedTx} onDelete={isSuperAdmin ? handleDeleteTx : null} confirming={confirming} />
          </Section>

          <Section Icon={ArrowUpFromLine} title="Xuất thiết bị sự kiện" color="#f87171" border="rgba(248,113,113,0.25)" count={outTxs.length}>
            <TxRows txs={outTxs} onSelect={setSelectedTx} onDelete={isSuperAdmin ? handleDeleteTx : null} />
          </Section>

          <Section Icon={ArrowDownToLine} title="Nhập thiết bị sự kiện" color="#4ade80" border="rgba(74,222,128,0.25)" count={returnTxs.length}>
            <TxRows txs={returnTxs} onSelect={setSelectedTx} onDelete={isSuperAdmin ? handleDeleteTx : null} />
          </Section>

          <Section Icon={ClipboardList} title="Báo cáo sự kiện" color={GOLD} border="rgba(201,168,76,0.25)" count={reports.length}>
            <ReportRows reports={reports} />
          </Section>

          <Section Icon={ShieldAlert} title="Vi phạm nội quy" color="#f87171" border="rgba(248,113,113,0.25)" count={violations.length}>
            <ViolationRows violations={violations} />
          </Section>
        </>
      )}

      {selectedTx && (
        <TxDetailModal
          txId={selectedTx}
          onClose={() => setSelectedTx(null)}
          canEdit={canEdit}
          onEdit={(id) => { setSelectedTx(null); setEditingTx(id); }}
        />
      )}
      {editingTx && (
        <EditPendingModal
          txId={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={() => { setEditingTx(null); load(); }}
        />
      )}
    </div>
  );
}
