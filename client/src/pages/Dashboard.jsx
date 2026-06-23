import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const GOLD = '#c9a84c';

const STATUS_CFG = {
  active:    { label: 'Đang diễn ra',      icon: '🟢', color: '#4ade80', border: 'rgba(74,222,128,0.3)',  bg: 'rgba(74,222,128,0.06)'  },
  planned:   { label: 'Đang lên kế hoạch', icon: '🔵', color: '#60a5fa', border: 'rgba(96,165,250,0.3)',  bg: 'rgba(96,165,250,0.06)'  },
  completed: { label: 'Đã hoàn thành',     icon: '✅', color: GOLD,      border: 'rgba(201,168,76,0.3)', bg: 'rgba(201,168,76,0.06)' },
};

function EventColumn({ status, events }) {
  const cfg = STATUS_CFG[status];
  const list = events.filter(e => e.status === status);

  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: '#13131d',
      border: `1px solid ${cfg.border}`,
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      {/* Column header */}
      <div style={{
        padding: '12px 16px',
        background: cfg.bg,
        borderBottom: `1px solid ${cfg.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: cfg.color, letterSpacing: '0.04em' }}>
          {cfg.icon} {cfg.label}
        </span>
        <span style={{
          fontSize: '0.7rem', fontWeight: 800,
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          color: cfg.color, borderRadius: '9999px', padding: '2px 8px',
        }}>{list.length}</span>
      </div>

      {/* Event cards */}
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '80px' }}>
        {list.length === 0 && (
          <p style={{ color: '#7878a0', fontSize: '0.78rem', textAlign: 'center', padding: '20px 0' }}>
            Không có sự kiện
          </p>
        )}
        {list.map(ev => (
          <Link key={ev.id} to="/events"
            style={{
              display: 'block', padding: '10px 12px', textDecoration: 'none',
              background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.05)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = cfg.bg}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
          >
            <p style={{ fontWeight: 600, color: '#e8e8f0', fontSize: '0.85rem', margin: '0 0 3px', lineHeight: 1.3 }}>
              {ev.name}
            </p>
            {ev.client && (
              <p style={{ fontSize: '0.72rem', color: '#7878a0', margin: '0 0 2px' }}>👤 {ev.client}</p>
            )}
            {ev.location && (
              <p style={{ fontSize: '0.72rem', color: '#7878a0', margin: 0 }}>📍 {ev.location}</p>
            )}
            {ev.start_date && (
              <p style={{ fontSize: '0.7rem', color: cfg.color, margin: '4px 0 0', fontWeight: 600 }}>
                📅 {ev.start_date.slice(8,10)}/{ev.start_date.slice(5,7)}/{ev.start_date.slice(0,4)}
              </p>
            )}
          </Link>
        ))}
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

      {/* ── Header ── */}
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e8c97a', margin: 0 }}>Trang Chủ</h1>
        <p style={{ color: '#7878a0', fontSize: '0.82rem', margin: '4px 0 0' }}>Khôi Minh Event Equipment</p>
      </div>

      {/* ── Event columns ── */}
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
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {['active', 'planned', 'completed'].map(s => (
              <EventColumn key={s} status={s} events={events} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
