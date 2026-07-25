import { useNavigate } from 'react-router-dom';
import { fmtD } from '../../utils/fmt';
import { SectionHeader } from './dashShared';

export default function OverdueSection({ items }) {
  const navigate = useNavigate();
  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(248,113,113,0.30)' }}>
      <SectionHeader title="Quá hạn trả thiết bị" color="#f87171" colorRgb="248,113,113" count={items.length} />
      <div style={{ background: '#13131d' }}>
        {items.length === 0 ? (
          <p style={{ color: '#7878a0', fontSize: '0.84rem', padding: '14px 18px', margin: 0 }}>Không có phiếu nào quá hạn</p>
        ) : items.map((tx, i) => (
          <div key={tx.id}
            onClick={() => navigate('/event-return')}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 16px', cursor: 'pointer',
              borderTop: i > 0 ? '1px solid rgba(248,113,113,0.08)' : 'none',
              transition: 'background 0.13s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, color: '#f87171', fontSize: '0.83rem', margin: 0, fontFamily: "'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace" }}>{tx.code}</p>
              <p style={{ fontSize: '0.82rem', color: '#e0e0ee', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.event_name}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: '0.78rem', color: '#f87171', fontWeight: 700, margin: 0 }}>Hạn {fmtD(tx.expected_return_date)}</p>
              <p style={{ fontSize: '0.80rem', color: '#7878a0', margin: '2px 0 0' }}>→ Nhập kho</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
