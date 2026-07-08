import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { fmtD } from '../utils/fmt';
import { Zap, CalendarDays, CircleCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const GOLD = '#c9a84c';

// ── Helpers ────────────────────────────────────────────────────────────────

function Badge({ count, color = GOLD }) {
  if (!count) return null;
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 800, minWidth: '22px', textAlign: 'center',
      background: color, color: '#08080e', borderRadius: '9999px', padding: '2px 8px',
    }}>{count}</span>
  );
}

function SectionHeader({ title, color, count, colorRgb }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 16px',
      background: `linear-gradient(135deg, rgba(${colorRgb},0.16) 0%, rgba(${colorRgb},0.04) 100%)`,
      borderBottom: `1px solid rgba(${colorRgb},0.18)`,
      borderLeft: `4px solid ${color}`,
    }}>
      <span style={{ fontWeight: 700, color, fontSize: '0.85rem', flex: 1 }}>{title}</span>
      {count > 0 && <Badge count={count} color={color} />}
    </div>
  );
}

// ── Section: Hôm nay ───────────────────────────────────────────────────────

function TodaySection({ events }) {
  const navigate = useNavigate();
  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(74,222,128,0.30)' }}>
      <SectionHeader title="Sự kiện hôm nay" color="#4ade80" colorRgb="74,222,128" count={events.length} />
      <div style={{ background: '#13131d' }}>
        {events.length === 0 ? (
          <p style={{ color: '#7878a0', fontSize: '0.78rem', padding: '14px 18px', margin: 0 }}>Không có sự kiện nào hôm nay</p>
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
                <p style={{ fontSize: '0.71rem', color: '#7878a0', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[ev.client, ev.location].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {ev.filming_dates?.length > 0 && (
              <span style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>
                GH {ev.filming_dates.filter(d => d).map(d => fmtD(d)).join(', ')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Cần xác nhận ──────────────────────────────────────────────────

function ConfirmSection({ items, onConfirmed }) {
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
          <p style={{ color: '#7878a0', fontSize: '0.78rem', padding: '14px 18px', margin: 0 }}>Không có phiếu nào cần xác nhận</p>
        ) : items.map((tx, i) => (
          <div key={tx.id} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 16px',
            borderTop: i > 0 ? '1px solid rgba(251,191,36,0.08)' : 'none',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, color: '#fbbf24', fontSize: '0.83rem', margin: 0, fontFamily: 'monospace' }}>{tx.code}</p>
              <p style={{ fontSize: '0.75rem', color: '#e0e0ee', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.event_name}</p>
              <p style={{ fontSize: '0.68rem', color: '#7878a0', margin: '1px 0 0' }}>{tx.item_count} loại thiết bị</p>
            </div>
            <button
              onClick={() => confirm(tx.id)}
              disabled={confirming === tx.id}
              style={{
                padding: '6px 14px', borderRadius: '7px', cursor: 'pointer',
                border: '1px solid rgba(251,191,36,0.5)',
                background: confirming === tx.id ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.15)',
                color: '#fbbf24', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
              }}>
              {confirming === tx.id ? '...' : 'Xác nhận'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Quá hạn trả ───────────────────────────────────────────────────

function OverdueSection({ items }) {
  const navigate = useNavigate();
  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(248,113,113,0.30)' }}>
      <SectionHeader title="Quá hạn trả thiết bị" color="#f87171" colorRgb="248,113,113" count={items.length} />
      <div style={{ background: '#13131d' }}>
        {items.length === 0 ? (
          <p style={{ color: '#7878a0', fontSize: '0.78rem', padding: '14px 18px', margin: 0 }}>Không có phiếu nào quá hạn</p>
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
              <p style={{ fontWeight: 600, color: '#f87171', fontSize: '0.83rem', margin: 0, fontFamily: 'monospace' }}>{tx.code}</p>
              <p style={{ fontSize: '0.75rem', color: '#e0e0ee', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.event_name}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 700, margin: 0 }}>Hạn {fmtD(tx.expected_return_date)}</p>
              <p style={{ fontSize: '0.65rem', color: '#7878a0', margin: '2px 0 0' }}>→ Nhập kho</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section: Xung đột thiết bị ─────────────────────────────────────────────

function ConflictSection({ conflicts }) {
  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(251,113,133,0.30)' }}>
      <SectionHeader title="Xung đột thiết bị" color="#fb7185" colorRgb="251,113,133" count={conflicts.length} />
      <div style={{ background: '#13131d' }}>
        {conflicts.length === 0 ? (
          <p style={{ color: '#7878a0', fontSize: '0.78rem', padding: '14px 18px', margin: 0 }}>Không có xung đột nào</p>
        ) : conflicts.map((c, i) => {
          const total = c.events.reduce((s, e) => s + e.qty, 0);
          return (
            <div key={i} style={{
              padding: '10px 16px',
              borderTop: i > 0 ? '1px solid rgba(251,113,133,0.08)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '5px' }}>
                <span style={{ fontSize: '0.72rem', color: '#fb7185', fontWeight: 700 }}>GH {fmtD(c.date)}</span>
                <span style={{ fontSize: '0.85rem', color: '#e0e0ee', fontWeight: 700, flex: 1 }}>{c.eq_name}</span>
                <span style={{ fontSize: '0.7rem', color: '#fb7185', fontWeight: 800, flexShrink: 0 }}>
                  cần {total} / có {c.qty_available} {c.unit}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {c.events.map(ev => (
                  <span key={ev.id} style={{
                    fontSize: '0.68rem', padding: '2px 8px', borderRadius: '9999px',
                    background: 'rgba(251,113,133,0.12)', border: '1px solid rgba(251,113,133,0.3)',
                    color: '#fda4af',
                  }}>
                    {ev.name} ({ev.qty} {c.unit})
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section: Trạng thái sự kiện (giữ nguyên) ──────────────────────────────

const STATUS_CFG = {
  active:    { label: 'Đang diễn ra',      Icon: Zap,          color: '#4ade80', rgb: '74,222,128'  },
  planned:   { label: 'Đang lên kế hoạch', Icon: CalendarDays, color: '#60a5fa', rgb: '96,165,250'  },
  completed: { label: 'Đã hoàn thành',     Icon: CircleCheck,  color: GOLD,      rgb: '201,168,76'  },
};

function EventGroup({ status, events }) {
  const { label, Icon, color, rgb } = STATUS_CFG[status];
  const list = events.filter(e => e.status === status);
  return (
    <div style={{ borderRadius: '14px', overflow: 'hidden', border: `1px solid rgba(${rgb},0.30)`, boxShadow: `0 4px 24px rgba(${rgb},0.10)` }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px',
        background: `linear-gradient(135deg, rgba(${rgb},0.18) 0%, rgba(${rgb},0.05) 100%)`,
        borderBottom: `1px solid rgba(${rgb},0.20)`, borderLeft: `4px solid ${color}`,
      }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: `rgba(${rgb},0.18)`, border: `1px solid rgba(${rgb},0.35)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} strokeWidth={1.75} style={{ color }} />
        </div>
        <span style={{ fontWeight: 800, color, fontSize: '0.92rem', flex: 1, letterSpacing: '0.01em' }}>{label}</span>
        <span style={{
          fontSize: '0.72rem', fontWeight: 800,
          color: list.length > 0 ? '#08080e' : color,
          background: list.length > 0 ? color : 'transparent',
          border: list.length > 0 ? 'none' : `1px solid rgba(${rgb},0.3)`,
          borderRadius: '9999px', padding: '3px 11px', minWidth: 28, textAlign: 'center',
          boxShadow: list.length > 0 ? `0 0 12px rgba(${rgb},0.55)` : 'none',
        }}>{list.length}</span>
      </div>
      <div style={{ background: '#13131d' }}>
        {list.length === 0 ? (
          <p style={{ color: '#7878a0', fontSize: '0.78rem', padding: '14px 20px', margin: 0 }}>Không có sự kiện</p>
        ) : list.map((ev, i) => (
          <Link key={ev.id} to="/events"
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', textDecoration: 'none', borderTop: i > 0 ? `1px solid rgba(${rgb},0.08)` : 'none', transition: 'background 0.13s' }}
            onMouseEnter={e => e.currentTarget.style.background = `rgba(${rgb},0.05)`}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px rgba(${rgb},0.8)` }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, color: '#e0e0ee', fontSize: '0.87rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</p>
              <p style={{ fontSize: '0.71rem', color: '#7878a0', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[ev.client, ev.location].filter(Boolean).join(' · ')}
              </p>
            </div>
            {ev.start_date && (
              <span style={{ fontSize: '0.72rem', color, fontWeight: 700, flexShrink: 0 }}>{fmtD(ev.start_date)}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Section: Lịch làm việc sắp tới ───────────────────────────────────────────
const PHASE_LABELS = { filming: '🎬 Ghi hình', setup: '🏗 Setup', rehearsal: '🎤 Rehearsal', teardown: '📦 Tháo dỡ' };

function UpcomingScheduleSection({ userName }) {
  const [upcoming, setUpcoming] = useState([]);
  const navigate = useNavigate();
  const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const tomorrowVN = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d); })();

  useEffect(() => {
    if (!userName) return;
    api.getWorkSchedules({}).then(schedules => {
      const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
      const futureCutoff = new Date(todayVN); futureCutoff.setDate(futureCutoff.getDate() + 14);
      const pastCutoff   = new Date(todayVN); pastCutoff.setDate(pastCutoff.getDate() - 30);
      const cutoffStr  = futureCutoff.toISOString().slice(0, 10);
      const pastStr    = pastCutoff.toISOString().slice(0, 10);
      const phases = ['filming', 'setup', 'rehearsal', 'teardown'];
      const found = [];
      const seen = new Set();
      for (const s of schedules) {
        for (const p of phases) {
          const dates = s[`${p}_dates`] || (s[`${p}_date`] ? [s[`${p}_date`]] : []);
          const leads = (s[`${p}_leads`] || []).map(l => l.name);
          const staff = s[`${p}_km_staff`] || [];
          if (!leads.includes(userName) && !staff.includes(userName)) continue;
          for (const date of dates) {
            if (!date || date < pastStr || date > cutoffStr) continue;
            const key = `${s.id}-${p}-${date}`;
            if (seen.has(key)) continue;
            seen.add(key);
            found.push({ date, phase: p, eventName: s.event_name, schedId: s.id });
          }
        }
      }
      found.sort((a, b) => a.date.localeCompare(b.date));
      setUpcoming(found);
    }).catch(() => {});
  }, [userName]);

  const todayItems    = upcoming.filter(i => i.date === todayVN);
  const tomorrowItems = upcoming.filter(i => i.date === tomorrowVN);
  const upcomingItems = upcoming.filter(i => i.date > tomorrowVN);
  const pastItems     = [...upcoming.filter(i => i.date < todayVN)].reverse();
  const totalFuture   = todayItems.length + tomorrowItems.length + upcomingItems.length;

  if (upcoming.length === 0) return null;

  function ZoneDivider({ color, border, label, count }) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 16px 2px' }}>
        <div style={{ flex:1, height:'1px', background:`linear-gradient(90deg,${border},transparent)` }} />
        <span style={{ fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.08em', color, background:`${color}18`, border:`1px solid ${border}`, borderRadius:'999px', padding:'2px 10px', whiteSpace:'nowrap' }}>
          {label} <span style={{ opacity:0.7, fontWeight:600 }}>({count})</span>
        </span>
        <div style={{ flex:1, height:'1px', background:`linear-gradient(270deg,${border},transparent)` }} />
      </div>
    );
  }

  function SchedRow({ item, isPast }) {
    const isToday    = item.date === todayVN;
    const isTomorrow = item.date === tomorrowVN;
    const dotColor = isToday ? '#f87171' : isTomorrow ? '#4ade80' : isPast ? '#7878a0' : '#60a5fa';
    const dotGlow  = isToday ? 'rgba(248,113,113,0.8)' : isTomorrow ? 'rgba(74,222,128,0.8)' : isPast ? 'rgba(120,120,160,0.5)' : 'rgba(96,165,250,0.8)';
    const bgBase   = isToday ? 'rgba(248,113,113,0.05)' : isTomorrow ? 'rgba(74,222,128,0.04)' : 'transparent';
    const bgHover  = isToday ? 'rgba(248,113,113,0.1)' : isTomorrow ? 'rgba(74,222,128,0.09)' : 'rgba(96,165,250,0.05)';
    const textColor = isToday ? '#fca5a5' : isTomorrow ? '#86efac' : isPast ? '#7878a0' : '#e0e0ee';
    return (
      <div key={`${item.schedId}-${item.phase}-${item.date}`}
        onClick={() => navigate('/work-schedule', { state: { schedId: item.schedId } })}
        style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 12px', cursor:'pointer', borderTop:'1px solid rgba(255,255,255,0.04)', background:bgBase, transition:'background 0.13s', opacity: isPast ? 0.65 : 1 }}
        onMouseEnter={e => e.currentTarget.style.background = bgHover}
        onMouseLeave={e => e.currentTarget.style.background = bgBase}
      >
        <div style={{ width:7, height:7, borderRadius:'50%', background:dotColor, flexShrink:0, boxShadow:`0 0 6px ${dotGlow}` }} />
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontWeight:600, color:textColor, fontSize:'0.87rem', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {PHASE_LABELS[item.phase]} — {item.eventName}
          </p>
        </div>
        {isToday
          ? <span style={{ fontSize:'0.7rem', color:'#f87171', fontWeight:800, flexShrink:0, background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.35)', borderRadius:'6px', padding:'1px 6px', whiteSpace:'nowrap' }}>HÔM NAY</span>
          : isTomorrow
            ? <span style={{ fontSize:'0.7rem', color:'#4ade80', fontWeight:800, flexShrink:0, background:'rgba(74,222,128,0.15)', border:'1px solid rgba(74,222,128,0.35)', borderRadius:'6px', padding:'1px 6px', whiteSpace:'nowrap' }}>NGÀY MAI</span>
            : <span style={{ fontSize:'0.75rem', color: isPast ? '#7878a0' : '#60a5fa', fontWeight:700, flexShrink:0, whiteSpace:'nowrap' }}>{fmtD(item.date)}</span>
        }
      </div>
    );
  }

  return (
    <div style={{ borderRadius:'12px', overflow:'hidden', border:'1px solid rgba(74,222,128,0.35)', marginBottom:'10px' }}>
      <SectionHeader title="Lịch làm việc của bạn" color="#4ade80" colorRgb="74,222,128" count={totalFuture} />
      <div style={{ background:'#13131d' }}>
        {todayItems.length > 0 && <>
          <ZoneDivider color="#f87171" border="rgba(248,113,113,0.4)" label="HÔM NAY" count={todayItems.length} />
          {todayItems.map(item => <SchedRow key={`${item.schedId}-${item.phase}-${item.date}`} item={item} />)}
        </>}
        {tomorrowItems.length > 0 && <>
          <ZoneDivider color="#4ade80" border="rgba(74,222,128,0.35)" label="NGÀY MAI" count={tomorrowItems.length} />
          {tomorrowItems.map(item => <SchedRow key={`${item.schedId}-${item.phase}-${item.date}`} item={item} />)}
        </>}
        {upcomingItems.length > 0 && <>
          <ZoneDivider color="#60a5fa" border="rgba(96,165,250,0.3)" label="NGÀY SẮP TỚI" count={upcomingItems.length} />
          {upcomingItems.map(item => <SchedRow key={`${item.schedId}-${item.phase}-${item.date}`} item={item} />)}
        </>}
        {pastItems.length > 0 && <>
          <ZoneDivider color="#7878a0" border="rgba(120,120,160,0.25)" label="NGÀY LÀM VIỆC ĐÃ HOÀN THÀNH" count={pastItems.length} />
          {pastItems.map(item => <SchedRow key={`${item.schedId}-${item.phase}-${item.date}`} item={item} isPast />)}
        </>}
      </div>
    </div>
  );
}

// ── Admin Dashboard Components ─────────────────────────────────────────────

const PHASE_LABEL_MAP = { setup: 'Setup', teardown: 'Tháo dỡ', rehearsal: 'Rehearsal', filming: 'Ghi hình' };

function AdminSec({ title, color, rgb, count, linkTo, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius: '10px', overflow: 'hidden', border: `1px solid rgba(${rgb},0.28)` }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px',
          background: `linear-gradient(135deg,rgba(${rgb},0.14) 0%,rgba(${rgb},0.03) 100%)`,
          borderBottom: open ? `1px solid rgba(${rgb},0.16)` : 'none',
          borderLeft: `3px solid ${color}`, cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ fontWeight: 700, color, fontSize: '0.8rem', flex: 1, letterSpacing: '0.04em' }}>{title}</span>
        {count > 0 && <Badge count={count} color={color} />}
        {linkTo && (
          <Link to={linkTo} onClick={e => e.stopPropagation()} style={{ fontSize: '0.68rem', color: '#7878a0', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}>
            Xem tất cả →
          </Link>
        )}
        <span style={{ fontSize: '0.65rem', color: `rgba(${rgb},0.6)`, flexShrink: 0, marginLeft: '2px', transition: 'transform 0.18s', display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
      </div>
      {open && <div style={{ background: '#13131d' }}>{children}</div>}
    </div>
  );
}

function ARow({ i, rgb, onClick, children }) {
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', cursor: onClick ? 'pointer' : 'default', borderTop: i > 0 ? `1px solid rgba(${rgb},0.07)` : 'none', transition: 'background 0.13s' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.background = `rgba(${rgb},0.05)`)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </div>
  );
}

function AEmpty({ text }) {
  return <p style={{ color: '#7878a0', fontSize: '0.75rem', padding: '10px 14px', margin: 0 }}>{text}</p>;
}

function AdminDashboard({ dash, events, violations, lockedObs, onConfirmed }) {
  const navigate = useNavigate();

  const todayEvs   = (dash?.today_events || []).slice(0, 5);
  const planned    = events.filter(e => e.status === 'planned').slice(0, 5);
  const completed  = events.filter(e => e.status === 'completed').slice(0, 5);
  const topObs     = lockedObs.slice(0, 5);
  const topViols   = violations.slice(0, 5);

  const T = { name: { fontWeight:600, color:'#e0e0ee', fontSize:'0.83rem', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
              sub:  { fontSize:'0.68rem', color:'#7878a0', margin:'1px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' } };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* 1. Vận hành hôm nay */}
      <AdminSec title="VẬN HÀNH HÔM NAY" color="#4ade80" rgb="74,222,128" count={todayEvs.length} linkTo="/events">
        {todayEvs.length === 0
          ? <AEmpty text="Không có sự kiện nào hôm nay" />
          : todayEvs.map((ev, i) => (
            <ARow key={ev.id} i={i} rgb="74,222,128" onClick={() => navigate('/events')}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', flexShrink:0, boxShadow:'0 0 5px rgba(74,222,128,0.8)' }} />
              <div style={{ flex:1, minWidth:0 }}>
                <p style={T.name}>{ev.name}</p>
                {(ev.client || ev.location) && <p style={T.sub}>{[ev.client, ev.location].filter(Boolean).join(' · ')}</p>}
              </div>
              {ev.filming_dates?.length > 0 && (
                <span style={{ fontSize:'0.67rem', color:'#4ade80', fontWeight:700, flexShrink:0 }}>GH {ev.filming_dates.filter(Boolean).map(d => fmtD(d)).join(', ')}</span>
              )}
            </ARow>
          ))
        }
      </AdminSec>

      {/* 2. Đang lên kế hoạch */}
      <AdminSec title="ĐANG LÊN KẾ HOẠCH" color="#60a5fa" rgb="96,165,250" count={planned.length} linkTo="/events">
        {planned.length === 0
          ? <AEmpty text="Không có sự kiện đang lên kế hoạch" />
          : planned.map((ev, i) => (
            <ARow key={ev.id} i={i} rgb="96,165,250" onClick={() => navigate('/events')}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#60a5fa', flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <p style={T.name}>{ev.name}</p>
                {(ev.client || ev.location) && <p style={T.sub}>{[ev.client, ev.location].filter(Boolean).join(' · ')}</p>}
              </div>
              {ev.start_date && <span style={{ fontSize:'0.67rem', color:'#60a5fa', fontWeight:700, flexShrink:0 }}>{fmtD(ev.start_date)}</span>}
            </ARow>
          ))
        }
      </AdminSec>

      {/* 3. Báo cáo chưa nộp */}
      <AdminSec title="BÁO CÁO CHƯA NỘP" color="#f87171" rgb="248,113,113" count={topObs.length} linkTo="/event-report">
        {topObs.length === 0
          ? <AEmpty text="Không có báo cáo vi phạm" />
          : topObs.map((ob, i) => (
            <ARow key={ob.id} i={i} rgb="248,113,113" onClick={() => navigate('/event-report')}>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ ...T.name, color:'#fca5a5' }}>{ob.lead_name}</p>
                <p style={T.sub}>{ob.event_display || ob.event_name} · {PHASE_LABEL_MAP[ob.phase] || ob.phase}</p>
              </div>
              <span style={{ fontSize:'0.67rem', color:'#f87171', fontWeight:700, flexShrink:0 }}>{fmtD(ob.assigned_date)}</span>
            </ARow>
          ))
        }
      </AdminSec>

      {/* 4. Tổng quan vi phạm */}
      <AdminSec title="TỔNG QUAN VI PHẠM" color="#fb923c" rgb="251,146,60" count={topViols.length} linkTo="/violations">
        {topViols.length === 0
          ? <AEmpty text="Không có vi phạm gần đây" />
          : topViols.map((v, i) => (
            <ARow key={v.id} i={i} rgb="251,146,60" onClick={() => navigate('/violations')}>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={T.name}>{v.violator}</p>
                <p style={T.sub}>{v.violation_type}</p>
              </div>
              <span style={{ fontSize:'0.67rem', color:'#fb923c', fontWeight:700, flexShrink:0 }}>{fmtD(v.created_at?.slice(0,10))}</span>
            </ARow>
          ))
        }
      </AdminSec>

      {/* 5. Đã hoàn thành */}
      <AdminSec title="ĐÃ HOÀN THÀNH" color={GOLD} rgb="201,168,76" count={completed.length} linkTo="/events">
        {completed.length === 0
          ? <AEmpty text="Không có sự kiện đã hoàn thành" />
          : completed.map((ev, i) => (
            <ARow key={ev.id} i={i} rgb="201,168,76" onClick={() => navigate('/events')}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:GOLD, flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <p style={T.name}>{ev.name}</p>
                {(ev.client || ev.location) && <p style={T.sub}>{[ev.client, ev.location].filter(Boolean).join(' · ')}</p>}
              </div>
              {ev.end_date && <span style={{ fontSize:'0.67rem', color:GOLD, fontWeight:700, flexShrink:0 }}>{fmtD(ev.end_date)}</span>}
            </ARow>
          ))
        }
      </AdminSec>

      {/* Xuất kho + quá hạn trả (vẫn cần cho admin) */}
      {(dash?.need_confirm?.length > 0 || dash?.overdue?.length > 0 || dash?.conflicts?.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {dash.need_confirm.length > 0 && <ConfirmSection items={dash.need_confirm} onConfirmed={onConfirmed} />}
          {dash.overdue.length > 0 && <OverdueSection items={dash.overdue} />}
          {dash.conflicts.length > 0 && <ConflictSection conflicts={dash.conflicts} />}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const isFullAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  const [dash, setDash]       = useState(null);
  const [events, setEvents]   = useState([]);
  const [violations, setViolations] = useState([]);
  const [lockedObs, setLockedObs]   = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [d, evs] = await Promise.all([api.getDashboard(), api.getEvents()]);
      setDash(d);
      setEvents(evs);
    } catch { /* dash stays null, handled in render */ } finally {
      setLoading(false);
    }
    if (isFullAdmin) {
      api.getViolations().then(vs => setViolations(vs)).catch(() => {});
      api.getLeadObligations().then(obs => {
        setLockedObs(obs.filter(o => o.locked && !o.submitted));
      }).catch(() => {});
    }
  }, [isFullAdmin]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  const totalAlerts = dash
    ? (dash.today_events.length > 0 ? 1 : 0) + dash.need_confirm.length + dash.overdue.length + dash.conflicts.length
    : 0;

  const scrollToAlerts = () => document.getElementById('alerts-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="p-6 space-y-6">
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: totalAlerts > 0 && !isFullAdmin ? '8px' : 0 }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e8c97a', margin: 0 }}>Trang Chủ</h1>
        </div>
        {!loading && totalAlerts > 0 && dash && !isFullAdmin && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {dash.today_events.length > 0 && (
              <span onClick={scrollToAlerts} style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.4)', borderRadius: '9999px', padding: '3px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {dash.today_events.length} sự kiện hôm nay
              </span>
            )}
            {dash.need_confirm.length > 0 && (
              <span onClick={scrollToAlerts} style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)', borderRadius: '9999px', padding: '3px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {dash.need_confirm.length} chờ xác nhận
              </span>
            )}
            {dash.overdue.length > 0 && (
              <span onClick={scrollToAlerts} style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.4)', borderRadius: '9999px', padding: '3px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {dash.overdue.length} quá hạn trả
              </span>
            )}
            {dash.conflicts.length > 0 && (
              <span onClick={scrollToAlerts} style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(251,113,133,0.15)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.4)', borderRadius: '9999px', padding: '3px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {dash.conflicts.length} xung đột
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Đang tải...</div>
      ) : !dash ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#f87171' }}>Không thể tải dữ liệu. Vui lòng thử lại.</div>
      ) : isFullAdmin ? (
        <AdminDashboard dash={dash} events={events} violations={violations} lockedObs={lockedObs} onConfirmed={load} />
      ) : (
        <>
          {/* ── Lịch làm việc sắp tới ── */}
          <UpcomingScheduleSection userName={user?.full_name || ''} />

          {/* ── Cảnh báo vận hành ── */}
          <div id="alerts-section">
            <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a0a0b8', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Vận hành hôm nay
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <TodaySection events={dash.today_events} />
              {dash.need_confirm.length > 0 && <ConfirmSection items={dash.need_confirm} onConfirmed={load} />}
              {dash.overdue.length > 0 && <OverdueSection items={dash.overdue} />}
              {dash.conflicts.length > 0 && <ConflictSection conflicts={dash.conflicts} />}
            </div>
          </div>

          {/* ── Trạng thái sự kiện ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a0a0b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Trạng thái sự kiện
              </h2>
              <Link to="/events" style={{ fontSize: '0.78rem', color: GOLD, textDecoration: 'none', fontWeight: 600 }}>Xem tất cả →</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['active', 'planned', 'completed'].map(s => (
                <EventGroup key={s} status={s} events={events} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
