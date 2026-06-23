import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const GOLD = '#c9a84c';

const STATUS_CFG = {
  active:    { label: 'Đang diễn ra',      icon: '🟢', color: '#4ade80', border: 'rgba(74,222,128,0.3)',  bg: 'rgba(74,222,128,0.06)'  },
  planned:   { label: 'Đang lên kế hoạch', icon: '🔵', color: '#60a5fa', border: 'rgba(96,165,250,0.3)',  bg: 'rgba(96,165,250,0.06)'  },
  completed: { label: 'Đã hoàn thành',     icon: '✅', color: GOLD,      border: 'rgba(201,168,76,0.3)', bg: 'rgba(201,168,76,0.06)' },
};

function EventGroup({ status, events }) {
  const cfg = STATUS_CFG[status];
  const list = events.filter(e => e.status === status);

  return (
    <div style={{
      background: '#13131d',
      border: `1px solid rgba(255,255,255,0.07)`,
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      {/* Group header */}
      <div style={{
        padding: '10px 16px',
        background: cfg.bg,
        borderBottom: `1px solid ${cfg.border}`,
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: cfg.color, letterSpacing: '0.03em' }}>
          {cfg.icon} {cfg.label}
        </span>
        <span style={{
          fontSize: '0.68rem', fontWeight: 800,
          background: cfg.border, color: cfg.color,
          borderRadius: '9999px', padding: '1px 7px', marginLeft: 'auto',
        }}>{list.length}</span>
      </div>

      {/* List rows */}
      {list.length === 0 ? (
        <p style={{ color: '#7878a0', fontSize: '0.78rem', padding: '14px 16px', margin: 0 }}>
          Không có sự kiện
        </p>
      ) : (
        list.map((ev, i) => (
          <Link key={ev.id} to="/events"
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '11px 16px', textDecoration: 'none',
              borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              transition: 'background 0.13s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {/* Color dot */}
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />

            {/* Name + meta */}
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

            {/* Date */}
            {ev.start_date && (
              <span style={{ fontSize: '0.72rem', color: cfg.color, fontWeight: 600, flexShrink: 0 }}>
                {ev.start_date.slice(8,10)}/{ev.start_date.slice(5,7)}
              </span>
            )}
          </Link>
        ))
      )}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {['active', 'planned', 'completed'].map(s => (
              <EventGroup key={s} status={s} events={events} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
