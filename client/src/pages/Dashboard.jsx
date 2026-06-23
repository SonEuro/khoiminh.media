import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import StatCard from '../components/StatCard';

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
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(isSuperAdmin);

  useEffect(() => {
    api.getEvents().then(setEvents).finally(() => setLoadingEvents(false));
    if (isSuperAdmin) {
      api.getSummary().then(setSummary).finally(() => setLoadingSummary(false));
    }
  }, [isSuperAdmin]);

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

      {/* ── Super Admin: Stats ── */}
      {isSuperAdmin && (
        <div>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a0a0b8', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Tổng quan kho
          </h2>

          {loadingSummary ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#7878a0' }}>Đang tải...</div>
          ) : summary && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4" style={{ marginBottom: '20px' }}>
                <StatCard icon="📦" label="Tổng tồn kho" value={summary.totals.total_items} color="blue" />
                <StatCard icon="✅" label="Có sẵn"        value={summary.totals.available}   color="green" />
                <StatCard icon="🚀" label="Đang dùng"     value={summary.totals.in_use}      color="blue" />
                <StatCard icon="🔧" label="Đang sửa"      value={summary.totals.maintenance} color="yellow" />
                <StatCard icon="❌" label="Hư / Mất"      value={(summary.totals.damaged || 0) + (summary.totals.lost || 0)} color="red" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* By Category */}
                <div className="card lg:col-span-2">
                  <h3 style={{ fontWeight: 700, color: GOLD, fontSize: '0.85rem', margin: '0 0 14px' }}>Tồn kho theo danh mục</h3>
                  <div className="space-y-3">
                    {summary.by_category.map(cat => {
                      const pct = cat.total > 0 ? Math.round((cat.available / cat.total) * 100) : 0;
                      return (
                        <div key={cat.code}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, color: '#c0c0d4' }}>{cat.icon} {cat.name}</span>
                            <span style={{ color: '#7878a0' }}>{cat.available}/{cat.total}</span>
                          </div>
                          <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', height: '6px' }}>
                            <div style={{
                              height: '6px', borderRadius: '9999px', width: `${pct}%`,
                              background: pct > 50 ? '#4ade80' : pct > 20 ? '#fbbf24' : '#f87171',
                              transition: 'width 0.5s ease',
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="card">
                  <h3 style={{ fontWeight: 700, color: GOLD, fontSize: '0.85rem', margin: '0 0 14px' }}>Giao dịch gần đây</h3>
                  <div className="space-y-3">
                    {summary.recent_tx.length === 0 && <p style={{ fontSize: '0.8rem', color: '#7878a0' }}>Chưa có giao dịch</p>}
                    {summary.recent_tx.map(tx => (
                      <div key={tx.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <div>
                          <p style={{ fontWeight: 600, color: tx.type === 'OUT' ? '#f87171' : tx.type === 'RETURN' ? '#4ade80' : '#60a5fa', margin: '0 0 2px' }}>
                            {tx.type === 'OUT' ? '↑ Xuất' : tx.type === 'RETURN' ? '↓ Nhập' : '🔧 Sửa'} · {tx.code}
                          </p>
                          <p style={{ color: '#7878a0', fontSize: '0.7rem', margin: 0 }}>{tx.event_name || 'Nội bộ'} · {tx.item_count} loại</p>
                        </div>
                        <span style={{ color: '#7878a0', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                          {tx.transaction_date?.slice(8,10)}/{tx.transaction_date?.slice(5,7)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {(summary.low_stock.length > 0 || summary.damaged_list.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ marginTop: '20px' }}>
                  {summary.low_stock.length > 0 && (
                    <div className="card" style={{ borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.04)' }}>
                      <h3 style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.85rem', margin: '0 0 12px' }}>⚠️ Tồn kho thấp</h3>
                      <div className="space-y-1">
                        {summary.low_stock.map(eq => (
                          <div key={eq.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#d0b060' }}>
                            <span>{eq.name}</span>
                            <span style={{ fontWeight: 700 }}>{eq.qty_available} {eq.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {summary.damaged_list.length > 0 && (
                    <div className="card" style={{ borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.04)' }}>
                      <h3 style={{ fontWeight: 700, color: '#f87171', fontSize: '0.85rem', margin: '0 0 12px' }}>❌ Thiết bị hư / mất</h3>
                      <div className="space-y-1">
                        {summary.damaged_list.map(eq => (
                          <div key={eq.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#e07070' }}>
                            <span>{eq.name}</span>
                            <span>
                              {eq.qty_damaged > 0 && <span style={{ fontWeight: 700 }}>{eq.qty_damaged} hư </span>}
                              {eq.qty_lost   > 0 && <span style={{ fontWeight: 700 }}>{eq.qty_lost} mất</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

    </div>
  );
}
