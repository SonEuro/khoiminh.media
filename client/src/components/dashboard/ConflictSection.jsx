import { fmtD } from '../../utils/fmt';
import { SectionHeader } from './dashShared';

export default function ConflictSection({ conflicts }) {
  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(251,113,133,0.30)' }}>
      <SectionHeader title="Xung đột thiết bị" color="#fb7185" colorRgb="251,113,133" count={conflicts.length} />
      <div style={{ background: '#13131d', maxHeight: '360px', overflowY: 'auto' }}>
        {conflicts.length === 0 ? (
          <p style={{ color: '#7878a0', fontSize: '0.84rem', padding: '14px 18px', margin: 0 }}>Không có xung đột nào</p>
        ) : conflicts.map((c, i) => {
          const total = c.events.reduce((s, e) => s + e.qty, 0);
          const avail = c.effective_available ?? c.qty_available;
          return (
            <div key={i} style={{
              padding: '10px 16px',
              borderTop: i > 0 ? '1px solid rgba(251,113,133,0.08)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '5px' }}>
                <span style={{ fontSize: '0.84rem', color: '#fb7185', fontWeight: 700 }}>GH {fmtD(c.date)}</span>
                <span style={{ fontSize: '0.85rem', color: '#e0e0ee', fontWeight: 700, flex: 1 }}>{c.eq_name}</span>
                <span style={{ fontSize: '0.78rem', color: '#fb7185', fontWeight: 800, flexShrink: 0 }}>
                  cần {total} / có {avail} {c.unit}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {c.events.map(ev => (
                  <span key={ev.id} style={{
                    fontSize: '0.82rem', padding: '2px 8px', borderRadius: '9999px',
                    background: 'rgba(251,113,133,0.12)', border: '1px solid rgba(251,113,133,0.3)',
                    color: '#fda4af',
                  }}>
                    {ev.name} ({ev.qty} {c.unit})
                  </span>
                ))}
                {c.held_by_others > 0 && (
                  <span style={{
                    fontSize: '0.78rem', padding: '2px 8px', borderRadius: '9999px',
                    background: 'rgba(251,146,60,0.10)', border: '1px solid rgba(251,146,60,0.3)',
                    color: '#fb923c',
                  }}>
                    +{c.held_by_others} {c.unit} event khác đang giữ
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
