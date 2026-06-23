import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import { printSlip } from '../utils/printSlip';

const GOLD = '#c9a84c';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'PRODUCTION'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  planned:   { label: 'Lên kế hoạch', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  active:    { label: 'Đang diễn ra', color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  completed: { label: 'Hoàn thành',   color: GOLD,      bg: 'rgba(201,168,76,0.12)'  },
  cancelled: { label: 'Đã huỷ',       color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

const TX_CFG = {
  OUT:    { label: '↑ Xuất',  color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)' },
  RETURN: { label: '↓ Nhập',  color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)'  },
  FIX:    { label: '🔧 Sửa',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.35)'  },
  INTAKE: { label: '📦 Mới',  color: GOLD,      bg: 'rgba(201,168,76,0.12)',  border: 'rgba(201,168,76,0.35)'  },
};

function Badge({ cfg, label }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: '6px',
      fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap',
      background: cfg?.bg, color: cfg?.color, border: `1px solid ${cfg?.border || cfg?.color + '50'}`,
    }}>{label || cfg?.label}</span>
  );
}

function fmtDate(d) {
  if (!d) return '';
  return d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);
}

// ── Transaction detail modal ──────────────────────────────────────────────────
function TxDetailModal({ txId, onClose }) {
  const [tx, setTx] = useState(null);
  useEffect(() => { api.getTransactionById(txId).then(setTx); }, [txId]);
  if (!tx) return <Modal title="Phiếu" onClose={onClose}><div style={{ textAlign: 'center', padding: '32px', color: '#7878a0' }}>Đang tải...</div></Modal>;
  const condLabel = { good: 'Tốt', damaged: 'Hỏng', maintenance: 'Cần sửa', lost: 'Mất' };
  const condColor = { good: '#4ade80', damaged: '#f87171', maintenance: '#fbbf24', lost: '#94a3b8' };
  return (
    <Modal title={tx.code} onClose={onClose} size="lg"
      extra={<button onClick={() => printSlip(tx)} className="btn-secondary btn-sm">🖨️ In phiếu</button>}
    >
      <div className="space-y-4">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
          {[
            ['LOẠI', <Badge cfg={TX_CFG[tx.type] || {label:tx.type,color:'#7878a0',bg:'rgba(120,120,160,0.12)'}} />],
            ['NGÀY', tx.transaction_date?.slice(0, 16)],
            ['SỰ KIỆN', tx.event_name || 'Nội bộ'],
            ['PHỤ TRÁCH', tx.responsible_person || '—'],
          ].map(([lbl, val]) => (
            <div key={lbl}>
              <span style={{ color: '#7878a0', fontSize: '0.7rem' }}>{lbl}</span>
              <p style={{ color: '#e0e0ee', fontWeight: 600, marginTop: '3px' }}>{val}</p>
            </div>
          ))}
        </div>
        {tx.notes && <p style={{ fontSize: '0.82rem', background: 'rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '8px', color: '#a0a0b8', border: '1px solid rgba(201,168,76,0.2)' }}>{tx.notes}</p>}
        <div>
          <h3 style={{ fontWeight: 700, color: GOLD, marginBottom: '10px', fontSize: '0.85rem' }}>Danh sách thiết bị · {tx.items?.length} loại</h3>
          <table style={{ width: '100%', fontSize: '0.82rem' }}>
            <thead><tr>
              <th style={{ textAlign: 'left', paddingBottom: '8px', color: '#7878a0', fontWeight: 600 }}>Thiết bị</th>
              <th style={{ textAlign: 'right', paddingBottom: '8px', color: '#7878a0', fontWeight: 600 }}>SL</th>
              <th style={{ textAlign: 'center', paddingBottom: '8px', color: '#7878a0', fontWeight: 600 }}>Tình trạng</th>
            </tr></thead>
            <tbody>
              {tx.items?.map(it => (
                <tr key={it.id} style={{ borderTop: '1px solid rgba(201,168,76,0.1)' }}>
                  <td style={{ padding: '8px 0' }}>
                    <p style={{ fontWeight: 600, color: GOLD }}>{it.eq_name}</p>
                    <p style={{ fontSize: '0.7rem', color: '#7878a0' }}>{it.eq_code} · {it.category}</p>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#4ade80', padding: '8px 0 8px 8px' }}>{it.quantity} {it.unit}</td>
                  <td style={{ textAlign: 'center', padding: '8px 0 8px 8px', fontSize: '0.7rem', fontWeight: 700, color: condColor[it.condition] || '#7878a0' }}>
                    {condLabel[it.condition] || it.condition}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

// ── Tab: Trạng thái sự kiện ───────────────────────────────────────────────────
function EventsTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.getEvents({ limit: 200 }).then(setEvents).finally(() => setLoading(false)); }, []);
  if (loading) return <Loading />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {events.length === 0 && <Empty text="Chưa có sự kiện nào" />}
      {events.map(ev => {
        const cfg = STATUS_CFG[ev.status] || STATUS_CFG.planned;
        return (
          <div key={ev.id} style={{ background: '#13131d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, color: '#e0e0ee', margin: '0 0 3px', fontSize: '0.88rem' }}>{ev.name}</p>
              <p style={{ fontSize: '0.72rem', color: '#7878a0', margin: 0 }}>
                {[ev.client, ev.location].filter(Boolean).join(' · ')}
                {ev.start_date && <span style={{ marginLeft: '10px' }}>📅 {fmtDate(ev.start_date)}</span>}
              </p>
            </div>
            <Badge cfg={cfg} label={cfg.label} />
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: Transactions (OUT or RETURN) ─────────────────────────────────────────
function TxTab({ type }) {
  const [txs, setTxs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.getTransactions({ type, limit: 200 }).then(setTxs).finally(() => setLoading(false)); }, [type]);
  if (loading) return <Loading />;
  const cfg = TX_CFG[type];
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {txs.length === 0 && <Empty text="Chưa có phiếu nào" />}
        {txs.map(tx => (
          <div key={tx.id} style={{ background: '#13131d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: GOLD, fontWeight: 700 }}>{tx.code}</span>
                <Badge cfg={cfg} label={cfg.label} />
              </div>
              <p style={{ fontSize: '0.72rem', color: '#7878a0', margin: 0 }}>
                {tx.event_name || 'Nội bộ'}
                {tx.responsible_person && <span style={{ marginLeft: '8px' }}>· {tx.responsible_person}</span>}
                <span style={{ marginLeft: '8px' }}>· {tx.item_count} loại</span>
              </p>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#7878a0', whiteSpace: 'nowrap' }}>
              {tx.transaction_date?.slice(8,10)}/{tx.transaction_date?.slice(5,7)}
            </span>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button className="btn-secondary btn-sm" onClick={() => setSelected(tx.id)}>Chi tiết</button>
              <button
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(201,168,76,0.3)', background: 'transparent', color: GOLD, cursor: 'pointer', fontSize: '0.8rem' }}
                onClick={async () => { const full = await api.getTransactionById(tx.id); printSlip(full); }}>🖨️</button>
            </div>
          </div>
        ))}
      </div>
      {selected && <TxDetailModal txId={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

// ── Tab: Báo cáo sự kiện ─────────────────────────────────────────────────────
function EventReportsTab() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.getEventReports().then(setReports).finally(() => setLoading(false)); }, []);
  if (loading) return <Loading />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {reports.length === 0 && <Empty text="Chưa có báo cáo nào" />}
      {reports.map(r => (
        <div key={r.id} style={{ background: '#13131d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, color: '#e0e0ee', margin: '0 0 3px', fontSize: '0.88rem' }}>{r.event_label || 'Sự kiện'}</p>
              <p style={{ fontSize: '0.72rem', color: '#7878a0', margin: 0 }}>
                {r.location && <span style={{ marginRight: '10px' }}>📍 {r.location}</span>}
                {r.report_date && <span style={{ marginRight: '10px' }}>📅 {fmtDate(r.report_date)}</span>}
                {r.reporter_name && <span>👤 {r.reporter_name}</span>}
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#7878a0' }}>
              {r.km_staff?.length > 0 && <div>👥 {r.km_staff.length} người</div>}
              {r.service_quality && <div style={{ color: GOLD, fontWeight: 600 }}>{r.service_quality}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Vi phạm nội quy ─────────────────────────────────────────────────────
function ViolationsTab() {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.getViolations().then(setViolations).finally(() => setLoading(false)); }, []);
  if (loading) return <Loading />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {violations.length === 0 && <Empty text="Chưa có vi phạm nào" />}
      {violations.map(v => (
        <div key={v.id} style={{ background: '#13131d', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, color: '#f87171', margin: '0 0 3px', fontSize: '0.88rem' }}>{v.violator}</p>
            <p style={{ fontSize: '0.72rem', color: '#7878a0', margin: 0 }}>
              {v.violation_type && <span style={{ marginRight: '8px' }}>{v.violation_type}</span>}
              {v.event_label && <span>· {v.event_label}</span>}
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#7878a0' }}>
            <div>👤 {v.reporter_name}</div>
            <div>{v.created_at?.slice(8,10)}/{v.created_at?.slice(5,7)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Loading() {
  return <div style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Đang tải...</div>;
}
function Empty({ text }) {
  return <div style={{ textAlign: 'center', padding: '40px', color: '#7878a0', background: '#13131d', borderRadius: '10px' }}>{text}</div>;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'events',    label: '◉ Trạng thái sự kiện' },
  { key: 'out',       label: '↑ Xuất thiết bị sự kiện' },
  { key: 'return',    label: '↓ Nhập thiết bị sự kiện' },
  { key: 'reports',   label: '📋 Báo cáo sự kiện' },
  { key: 'violations',label: '⚠ Vi phạm nội quy' },
];

export default function Transactions() {
  const { user } = useAuth();
  const [tab, setTab] = useState('events');

  if (!ALLOWED_ROLES.includes(user?.role)) {
    return (
      <div className="p-6" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <p style={{ fontSize: '3rem', marginBottom: '12px' }}>🔒</p>
        <p style={{ color: '#f87171', fontWeight: 700, fontSize: '1rem' }}>Bạn không có quyền truy cập trang này</p>
        <p style={{ color: '#7878a0', fontSize: '0.82rem', marginTop: '6px' }}>Chỉ Super Admin và Giám đốc sản xuất được phép xem lịch sử vận hành</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e8c97a', margin: 0 }}>Lịch Sử Vận Hành</h1>
        <p style={{ color: '#7878a0', fontSize: '0.82rem', margin: '4px 0 0' }}>Toàn bộ hoạt động của Khôi Minh</p>
      </div>

      {/* Tab bar — scrollable on mobile */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{
              padding: '8px 14px', borderRadius: '9999px', fontWeight: 600,
              fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap',
              border: tab === t.key ? `1px solid ${GOLD}` : '1px solid rgba(201,168,76,0.2)',
              background: tab === t.key ? GOLD : 'transparent',
              color: tab === t.key ? '#08080e' : '#a0a0b8',
              transition: 'all 0.15s', flexShrink: 0,
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'events'     && <EventsTab />}
      {tab === 'out'        && <TxTab type="OUT" />}
      {tab === 'return'     && <TxTab type="RETURN" />}
      {tab === 'reports'    && <EventReportsTab />}
      {tab === 'violations' && <ViolationsTab />}
    </div>
  );
}
