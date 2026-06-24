import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Zap, CalendarDays, CircleCheck } from 'lucide-react';
import { fmtD } from '../utils/fmt';

const GOLD = '#c9a84c';

const STATUS_CFG = {
  active:    { label: 'Đang diễn ra',      Icon: Zap,          color: '#4ade80', rgb: '74,222,128'  },
  planned:   { label: 'Đang lên kế hoạch', Icon: CalendarDays, color: '#60a5fa', rgb: '96,165,250'  },
  completed: { label: 'Đã hoàn thành',     Icon: CircleCheck,  color: GOLD,      rgb: '201,168,76'  },
};

function EventGroup({ status, events }) {
  const { label, Icon, color, rgb } = STATUS_CFG[status];
  const list = events.filter(e => e.status === status);

  return (
    <div style={{
      borderRadius: '14px', overflow: 'hidden',
      border: `1px solid rgba(${rgb},0.30)`,
      boxShadow: `0 4px 24px rgba(${rgb},0.10)`,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 18px',
        background: `linear-gradient(135deg, rgba(${rgb},0.18) 0%, rgba(${rgb},0.05) 100%)`,
        borderBottom: `1px solid rgba(${rgb},0.20)`,
        borderLeft: `4px solid ${color}`,
      }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
          background: `rgba(${rgb},0.18)`, border: `1px solid rgba(${rgb},0.35)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} strokeWidth={1.75} style={{ color }} />
        </div>
        <span style={{ fontWeight: 800, color, fontSize: '0.92rem', flex: 1, letterSpacing: '0.01em' }}>
          {label}
        </span>
        <span style={{
          fontSize: '0.72rem', fontWeight: 800,
          color: list.length > 0 ? '#08080e' : color,
          background: list.length > 0 ? color : 'transparent',
          border: list.length > 0 ? 'none' : `1px solid rgba(${rgb},0.3)`,
          borderRadius: '9999px', padding: '3px 11px', minWidth: '28px', textAlign: 'center',
          boxShadow: list.length > 0 ? `0 0 12px rgba(${rgb},0.55)` : 'none',
        }}>{list.length}</span>
      </div>

      {/* Body */}
      <div style={{ background: '#13131d' }}>
        {list.length === 0 ? (
          <p style={{ color: '#7878a0', fontSize: '0.78rem', padding: '14px 20px', margin: 0 }}>
            Không có sự kiện
          </p>
        ) : (
          list.map((ev, i) => (
            <Link key={ev.id} to="/events"
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 20px', textDecoration: 'none',
                borderTop: i > 0 ? `1px solid rgba(${rgb},0.08)` : 'none',
                transition: 'background 0.13s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = `rgba(${rgb},0.05)`}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: color, flexShrink: 0,
                boxShadow: `0 0 6px rgba(${rgb},0.8)`,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, color: '#e0e0ee', fontSize: '0.87rem', margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.name}
                </p>
                <p style={{ fontSize: '0.71rem', color: '#7878a0', margin: '2px 0 0',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[ev.client, ev.location].filter(Boolean).join(' · ')}
                </p>
              </div>
              {ev.start_date && (
                <span style={{ fontSize: '0.72rem', color, fontWeight: 700, flexShrink: 0 }}>
                  {fmtD(ev.start_date)}
                </span>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    api.getEvents().then(setEvents).finally(() => setLoadingEvents(false));
  }, []);

  return (
    <div className="p-6 space-y-6">

      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e8c97a', margin: 0 }}>Trang Chủ</h1>
        <p style={{ color: '#7878a0', fontSize: '0.82rem', margin: '4px 0 0' }}>Khôi Minh Event Equipment</p>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a0a0b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Trạng thái sự kiện
          </h2>
          <Link to="/events" style={{ fontSize: '0.78rem', color: GOLD, textDecoration: 'none', fontWeight: 600 }}>
            Xem tất cả →
          </Link>
        </div>

        {loadingEvents ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Đang tải...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {['active', 'planned', 'completed'].map(s => (
              <EventGroup key={s} status={s} events={events} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
