import { useNavigate } from 'react-router-dom';
import { fmtD } from '../../utils/fmt';
import { SectionHeader } from './dashShared';

export default function TodaySection({ events }) {
  const navigate = useNavigate();
  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(74,222,128,0.30)' }}>
      <SectionHeader title="Sự kiện hôm nay" color="#4ade80" colorRgb="74,222,128" count={events.length} />
      <div style={{ background: '#13131d' }}>
        {events.length === 0 ? (
          <p style={{ color: '#7878a0', fontSize: '0.84rem', padding: '14px 18px', margin: 0 }}>Không có sự kiện nào hôm nay</p>
        ) : events.map((ev, i) => (
          <div key={ev.id}
            onClick={() => navigate('/events')}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '11px 18px', cursor: 'pointer',
              borderTop: i > 0 ? '1px solid rgba(74,222,128,0.08)' : 'none',
              transition: 'background 0.13s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,222,128,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', flexShrink: 0, boxShadow: '0 0 6px rgba(74,222,128,0.8)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, color: '#e0e0ee', fontSize: '0.87rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</p>
              {(ev.client || ev.location) && (
                <p style={{ fontSize: '0.84rem', color: '#7878a0', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[ev.client, ev.location].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {ev.filming_dates?.length > 0 && (
              <span style={{ fontSize: '0.78rem', color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>
                GH {ev.filming_dates.filter(d => d).map(d => fmtD(d)).join(', ')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
