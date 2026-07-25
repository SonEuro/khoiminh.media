import { useState } from 'react';
import { api } from '../../api';
import { SectionHeader } from './dashShared';

export default function ConfirmSection({ items, onConfirmed }) {
  const [confirming, setConfirming] = useState(null);

  const confirm = async (id) => {
    setConfirming(id);
    try {
      await api.confirmPending(id);
      onConfirmed();
    } catch (err) {
      alert(err.message);
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(251,191,36,0.30)' }}>
      <SectionHeader title="Xuất kho tạm — cần xác nhận" color="#fbbf24" colorRgb="251,191,36" count={items.length} />
      <div style={{ background: '#13131d' }}>
        {items.length === 0 ? (
          <p style={{ color: '#7878a0', fontSize: '0.84rem', padding: '14px 18px', margin: 0 }}>Không có phiếu nào cần xác nhận</p>
        ) : items.map((tx, i) => (
          <div key={tx.id} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 16px',
            borderTop: i > 0 ? '1px solid rgba(251,191,36,0.08)' : 'none',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, color: '#fbbf24', fontSize: '0.83rem', margin: 0, fontFamily: "'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace" }}>{tx.code}</p>
              <p style={{ fontSize: '0.82rem', color: '#e0e0ee', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.event_name}</p>
              <p style={{ fontSize: '0.82rem', color: '#7878a0', margin: '1px 0 0' }}>{tx.item_count} loại thiết bị</p>
            </div>
            <button
              onClick={() => confirm(tx.id)}
              disabled={confirming === tx.id}
              style={{
                padding: '6px 14px', borderRadius: '7px', cursor: 'pointer',
                border: '1px solid rgba(251,191,36,0.5)',
                background: confirming === tx.id ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.15)',
                color: '#fbbf24', fontSize: '0.82rem', fontWeight: 700, flexShrink: 0,
              }}>
              {confirming === tx.id ? '...' : 'Xác nhận'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
