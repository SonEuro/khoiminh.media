import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';
import { printSlip } from '../utils/printSlip';

const TYPE_CONFIG = {
  OUT:    { label: 'Xuất',  icon: '⬆️', bg: 'rgba(248,113,113,0.15)', color: '#f87171', border: 'rgba(248,113,113,0.35)' },
  RETURN: { label: 'Nhập',  icon: '⬇️', bg: 'rgba(74,222,128,0.15)',  color: '#4ade80', border: 'rgba(74,222,128,0.35)' },
  FIX:    { label: 'Sửa',   icon: '🔧', bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa', border: 'rgba(96,165,250,0.35)' },
};

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || { label: type, icon: '📋', bg: 'rgba(120,120,160,0.15)', color: '#7878a0', border: 'rgba(120,120,160,0.3)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap',
      fontSize: '0.72rem', fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function TxDetailModal({ txId, onClose }) {
  const [tx, setTx] = useState(null);
  useEffect(() => { api.getTransactionById(txId).then(setTx); }, [txId]);

  if (!tx) return (
    <Modal title="Phiếu" onClose={onClose}>
      <div style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)' }}>Đang tải...</div>
    </Modal>
  );

  const condLabel = { good:'Tốt', damaged:'Hỏng', maintenance:'Cần sửa', lost:'Mất' };
  const condColor = { good:'#4ade80', damaged:'#f87171', maintenance:'#fbbf24', lost:'#94a3b8' };

  return (
    <Modal title={`${tx.code}`} onClose={onClose} size="lg"
      extra={
        <button onClick={() => printSlip(tx)} className="btn-secondary btn-sm">
          🖨️ In phiếu
        </button>
      }
    >
      <div className="space-y-4">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', fontSize:'0.85rem' }}>
          <div>
            <span style={{ color:'var(--text-muted)', fontSize:'0.72rem' }}>LOẠI</span>
            <div style={{ marginTop:'3px' }}><TypeBadge type={tx.type} /></div>
          </div>
          <div>
            <span style={{ color:'var(--text-muted)', fontSize:'0.72rem' }}>NGÀY</span>
            <p style={{ color:'var(--text-primary)', fontWeight:600, marginTop:'3px' }}>{tx.transaction_date?.slice(0,16)}</p>
          </div>
          <div>
            <span style={{ color:'var(--text-muted)', fontSize:'0.72rem' }}>SỰ KIỆN</span>
            <p style={{ color:'var(--gold)', fontWeight:600, marginTop:'3px' }}>{tx.event_name || 'Nội bộ'}</p>
          </div>
          <div>
            <span style={{ color:'var(--text-muted)', fontSize:'0.72rem' }}>PHỤ TRÁCH</span>
            <p style={{ color:'var(--text-primary)', fontWeight:600, marginTop:'3px' }}>{tx.responsible_person || '—'}</p>
          </div>
          {tx.expected_return_date && (
            <div>
              <span style={{ color:'var(--text-muted)', fontSize:'0.72rem' }}>DỰ KIẾN TRẢ</span>
              <p style={{ color:'var(--text-primary)', fontWeight:600, marginTop:'3px' }}>{tx.expected_return_date}</p>
            </div>
          )}
        </div>

        {tx.notes && (
          <p style={{ fontSize:'0.85rem', background:'rgba(255,255,255,0.04)', padding:'10px 12px', borderRadius:'8px', color:'var(--text-muted)', border:'1px solid var(--gold-dim)' }}>
            {tx.notes}
          </p>
        )}

        <div>
          <h3 style={{ fontWeight:700, color:'var(--gold)', marginBottom:'10px', fontSize:'0.85rem' }}>
            Danh sách thiết bị · {tx.items.length} loại
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th style={{ textAlign:'left', paddingBottom:'8px' }}>Thiết bị</th>
                <th style={{ textAlign:'right', paddingBottom:'8px' }}>SL</th>
                <th style={{ textAlign:'center', paddingBottom:'8px' }}>Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {tx.items.map(it => (
                <tr key={it.id} style={{ borderTop:'1px solid rgba(201,168,76,0.1)' }}>
                  <td style={{ padding:'8px 0' }}>
                    <p style={{ fontWeight:600, color:'var(--gold)', fontSize:'0.85rem' }}>{it.eq_name}</p>
                    <p style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{it.eq_code} · {it.category}</p>
                  </td>
                  <td style={{ textAlign:'right', fontWeight:700, color:'#4ade80', padding:'8px 0 8px 8px' }}>{it.quantity} {it.unit}</td>
                  <td style={{ textAlign:'center', padding:'8px 0 8px 8px' }}>
                    <span style={{ fontSize:'0.7rem', fontWeight:700, color: condColor[it.condition] || '#7878a0' }}>
                      {condLabel[it.condition] || it.condition}
                    </span>
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

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [typeFilter, setTypeFilter]     = useState('');
  const [selectedTx, setSelectedTx]     = useState(null);
  const [loading, setLoading]           = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit: 100 };
    if (typeFilter) params.type = typeFilter;
    api.getTransactions(params).then(setTransactions).finally(() => setLoading(false));
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  const filterBtns = [
    { v:'',       l:'Tất cả' },
    { v:'OUT',    l:'⬆️ Xuất' },
    { v:'RETURN', l:'⬇️ Nhập' },
    { v:'FIX',    l:'🔧 Sửa' },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Lịch Sử Giao Dịch</h1>
          <p style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>{transactions.length} phiếu</p>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px' }}>
        {filterBtns.map(({ v, l }) => (
          <button key={v} onClick={() => setTypeFilter(v)}
            style={{
              padding:'7px 16px', borderRadius:'9999px', fontSize:'0.82rem', fontWeight:600,
              border: typeFilter === v ? '1px solid #c9a84c' : '1px solid rgba(201,168,76,0.25)',
              background: typeFilter === v ? '#c9a84c' : 'transparent',
              color: typeFilter === v ? '#08080e' : '#c9a84c',
              cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap',
            }}>
            {l}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="table-wrap">
          <table className="w-full text-sm" style={{ minWidth:'560px' }}>
            <thead>
              <tr>
                <th className="text-left px-4 py-3">Phiếu</th>
                <th className="text-left px-3 py-3">Loại</th>
                <th className="text-left px-3 py-3">Sự kiện</th>
                <th className="text-left px-3 py-3">Phụ trách</th>
                <th className="text-center px-3 py-3">TB</th>
                <th className="text-left px-3 py-3">Ngày</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)' }}>Đang tải...</td></tr>}
              {!loading && transactions.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)' }}>Chưa có phiếu nào</td></tr>
              )}
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td className="px-4 py-3" style={{ fontFamily:'monospace', fontSize:'0.78rem', fontWeight:600, color:'var(--gold)' }}>
                    {tx.code}
                  </td>
                  <td className="px-3 py-3">
                    <TypeBadge type={tx.type} />
                  </td>
                  <td className="px-3 py-3" style={{ color:'var(--text-muted)', fontSize:'0.82rem' }}>
                    {tx.event_name || 'Nội bộ'}
                  </td>
                  <td className="px-3 py-3" style={{ color:'var(--text-primary)', fontSize:'0.82rem' }}>
                    {tx.responsible_person || '—'}
                  </td>
                  <td className="px-3 py-3" style={{ textAlign:'center', color:'#60a5fa', fontWeight:700 }}>
                    {tx.item_count}
                  </td>
                  <td className="px-3 py-3" style={{ color:'var(--text-muted)', fontSize:'0.78rem', whiteSpace:'nowrap' }}>
                    {tx.transaction_date?.slice(0, 16)}
                  </td>
                  <td className="px-3 py-3">
                    <div style={{ display:'flex', gap:'6px' }}>
                      <button className="btn-secondary btn-sm" onClick={() => setSelectedTx(tx.id)}>Chi tiết</button>
                      <button className="btn-sm" title="In phiếu"
                        style={{ padding:'7px 10px', borderRadius:'7px', border:'1px solid rgba(201,168,76,0.3)', background:'transparent', color:'var(--gold)', cursor:'pointer', fontSize:'0.85rem' }}
                        onClick={async () => { const full = await api.getTransactionById(tx.id); printSlip(full); }}>
                        🖨️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTx && <TxDetailModal txId={selectedTx} onClose={() => setSelectedTx(null)} />}
    </div>
  );
}
