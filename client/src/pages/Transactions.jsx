import { useState, useEffect } from 'react';
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
function TxDetailModal({ txId, onClose }) {
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
  return (
    <Modal title={tx.code} onClose={onClose} size="lg"
      extra={<button onClick={() => printSlip(tx)} className="btn-secondary btn-sm" style={{ display:'inline-flex', alignItems:'center', gap:'5px' }}><Printer size={13} /> In phiếu</button>}
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
        {tx.notes && <p style={{ fontSize:'0.82rem', background:'rgba(255,255,255,0.04)', padding:'10px 12px', borderRadius:'8px', color:'#a0a0b8', border:'1px solid rgba(201,168,76,0.2)' }}>{tx.notes}</p>}
        {((tx.items?.length || 0) + (tx.external_items?.length || 0)) > 0 && (
          <div>
            <h3 style={{ fontWeight:700, color:'#e0e0ee', marginBottom:'10px', fontSize:'0.85rem' }}>
              Danh sách thiết bị &nbsp;
              <span style={{ color:GOLD }}>{tx.items?.length || 0} kho</span>
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
                  </div>
                  <span style={{ fontSize:'0.7rem', color:'#7878a0', whiteSpace:'nowrap' }}>thuê</span>
                  <span style={{ fontWeight:800, color:'#60a5fa', fontSize:'0.9rem', whiteSpace:'nowrap', minWidth:'52px', textAlign:'right' }}>
                    {it.quantity}
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
      {open && <div style={{ padding: '14px 16px' }}>{children}</div>}
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
function EventRows({ events }) {
  if (!events.length) return <Empty text="Chưa có sự kiện nào" />;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      {events.map(ev => {
        const cfg = STATUS_CFG[ev.status] || STATUS_CFG.planned;
        return (
          <div key={ev.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'9px 12px', background:'rgba(255,255,255,0.02)', borderRadius:'8px' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontWeight:600, color:'#e0e0ee', margin:0, fontSize:'0.84rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.name}</p>
              <p style={{ fontSize:'0.7rem', color:'#7878a0', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {[ev.client, ev.location].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
              {ev.start_date && <span style={{ fontSize:'0.7rem', color:cfg.color }}>{fmtDate(ev.start_date)}</span>}
              <Badge color={cfg.color} bg={cfg.bg} label={cfg.label} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PendingTxRows({ txs, onConfirm, onSelect, onDelete }) {
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
            <button
              onClick={() => onConfirm(tx)}
              style={{
                flex:1, padding:'6px 10px', borderRadius:'7px', cursor:'pointer', fontWeight:700, fontSize:'0.78rem',
                background:'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(251,191,36,0.12))',
                border:'1px solid rgba(251,191,36,0.5)', color:PENDING_COLOR,
              }}>
              ✅ Xác nhận xuất kho
            </button>
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
  const [confirming, setConfirming] = useState(null);

  const isSuperAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);

  function load() {
    if (!user) return;
    Promise.all([
      api.getEvents({ limit: 5 }),
      api.getTransactions({ type: 'OUT', status: 'pending', limit: 5 }),
      api.getTransactions({ type: 'OUT', status: 'completed', limit: 5 }),
      api.getTransactions({ type: 'RETURN', limit: 5 }),
      api.getEventReports(),
      api.getViolations(),
    ]).then(([ev, pending, out, ret, rep, vio]) => {
      setEvents(ev); setPendingTxs(pending); setOutTxs(out); setReturnTxs(ret);
      setReports(rep.slice(0, 5)); setViolations(vio.slice(0, 5));
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [user]);

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
            <EventRows events={events} />
          </Section>

          <Section Icon={ArrowUpFromLine} title="Xuất kho tạm (chờ xác nhận)" color={PENDING_COLOR} border="rgba(251,191,36,0.25)" count={pendingTxs.length}>
            <PendingTxRows txs={pendingTxs} onConfirm={handleConfirmPending} onSelect={setSelectedTx} onDelete={isSuperAdmin ? handleDeleteTx : null} />
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

      {selectedTx && <TxDetailModal txId={selectedTx} onClose={() => setSelectedTx(null)} />}
    </div>
  );
}
