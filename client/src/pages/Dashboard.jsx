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
      fontSize: '0.78rem', fontWeight: 800, minWidth: '22px', textAlign: 'center',
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

// ── Section: Quá hạn trả ───────────────────────────────────────────────────

function OverdueSection({ items }) {
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

// ── Section: Xung đột thiết bị ─────────────────────────────────────────────

function ConflictSection({ conflicts }) {
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
          fontSize: '0.84rem', fontWeight: 800,
          color: list.length > 0 ? '#08080e' : color,
          background: list.length > 0 ? color : 'transparent',
          border: list.length > 0 ? 'none' : `1px solid rgba(${rgb},0.3)`,
          borderRadius: '9999px', padding: '3px 11px', minWidth: 28, textAlign: 'center',
          boxShadow: list.length > 0 ? `0 0 12px rgba(${rgb},0.55)` : 'none',
        }}>{list.length}</span>
      </div>
      <div style={{ background: '#13131d' }}>
        {list.length === 0 ? (
          <p style={{ color: '#7878a0', fontSize: '0.84rem', padding: '14px 20px', margin: 0 }}>Không có sự kiện</p>
        ) : list.map((ev, i) => (
          <Link key={ev.id} to="/events"
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', textDecoration: 'none', borderTop: i > 0 ? `1px solid rgba(${rgb},0.08)` : 'none', transition: 'background 0.13s' }}
            onMouseEnter={e => e.currentTarget.style.background = `rgba(${rgb},0.05)`}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px rgba(${rgb},0.8)` }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, color: '#e0e0ee', fontSize: '0.87rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</p>
              <p style={{ fontSize: '0.84rem', color: '#7878a0', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[ev.client, ev.location].filter(Boolean).join(' · ')}
              </p>
            </div>
            {ev.start_date && (
              <span style={{ fontSize: '0.84rem', color, fontWeight: 700, flexShrink: 0 }}>{fmtD(ev.start_date)}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Section: Tổng hợp nhân sự hôm nay / ngày mai ─────────────────────────────
function StaffSummarySection() {
  const [summary, setSummary] = useState(null);
  const COLOR = '#fbbf24'; const RGB = '251,191,36';
  const PHASES = ['setup', 'teardown', 'rehearsal', 'filming'];

  useEffect(() => {
    const todayVN    = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const dTmr = new Date(); dTmr.setDate(dTmr.getDate() + 1);
    const tomorrowVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(dTmr);

    api.getWorkSchedules({}).then(schedules => {
      const countDay = (targetDate) => {
        const kmNames = new Set();
        let freeTotal = 0;
        for (const s of schedules) {
          for (const p of PHASES) {
            const dates = s[`${p}_dates`] || (s[`${p}_date`] ? [s[`${p}_date`]] : []);
            if (!dates.includes(targetDate)) continue;
            const lMap = s[`${p}_leads_map`]; const lFlat = s[`${p}_leads`] || [];
            (lMap ? (lMap[targetDate] ?? []) : lFlat).forEach(l => kmNames.add(l?.name ?? l));
            const sMap = s[`${p}_km_staff_map`]; const sFlat = s[`${p}_km_staff`] || [];
            (sMap ? (sMap[targetDate] ?? []) : sFlat).forEach(n => kmNames.add(n?.name ?? n));
            const fMap = s[`${p}_freelancers_map`]; const fFlat = s[`${p}_freelancers`] || '';
            if (fMap && fMap[targetDate]) {
              Object.values(fMap[targetDate]).forEach(v =>
                (v || '').split(',').forEach(x => { if (x.trim()) freeTotal++; })
              );
            } else if (fFlat) {
              fFlat.split(',').forEach(x => { if (x.trim()) freeTotal++; });
            }
          }
        }
        kmNames.delete(''); kmNames.delete(undefined);
        return { km: kmNames.size, free: freeTotal, total: kmNames.size + freeTotal };
      };
      setSummary({ today: countDay(todayVN), tomorrow: countDay(tomorrowVN) });
    }).catch(() => {});
  }, []);

  if (!summary) return null;
  const { today, tomorrow } = summary;
  if (today.total === 0 && tomorrow.total === 0) return null;

  const totalAll = today.total + tomorrow.total;

  return (
    <AdminSec title="TỔNG HỢP NHÂN SỰ" color={COLOR} rgb={RGB}>
      {today.total > 0 && (
        <ARow i={0} rgb={RGB}>
          <span style={{ fontSize:'0.83rem', fontWeight:600, color:'#e0e0ee', flex:1 }}>Hôm nay</span>
          <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
            <span style={{ fontSize:'0.83rem', color:'#e0e0ee' }}>
              <span style={{ fontWeight:800, color:'#60a5fa' }}>{today.km}</span>
              <span style={{ color:'#7878a0', marginLeft:'3px', fontSize:'0.78rem' }}>KM</span>
            </span>
            <span style={{ color:'#444460', fontSize:'0.78rem' }}>+</span>
            <span style={{ fontSize:'0.83rem', color:'#e0e0ee' }}>
              <span style={{ fontWeight:800, color:COLOR }}>{today.free}</span>
              <span style={{ color:'#7878a0', marginLeft:'3px', fontSize:'0.78rem' }}>Freelancer</span>
            </span>
            <span style={{ fontSize:'0.78rem', fontWeight:800, color:COLOR }}>= {today.total}</span>
          </div>
        </ARow>
      )}
      {tomorrow.total > 0 && (
        <ARow i={today.total > 0 ? 1 : 0} rgb={RGB}>
          <span style={{ fontSize:'0.83rem', fontWeight:600, color:'#e0e0ee', flex:1 }}>Ngày mai</span>
          <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
            <span style={{ fontSize:'0.83rem', color:'#e0e0ee' }}>
              <span style={{ fontWeight:800, color:'#60a5fa' }}>{tomorrow.km}</span>
              <span style={{ color:'#7878a0', marginLeft:'3px', fontSize:'0.78rem' }}>KM</span>
            </span>
            <span style={{ color:'#444460', fontSize:'0.78rem' }}>+</span>
            <span style={{ fontSize:'0.83rem', color:'#e0e0ee' }}>
              <span style={{ fontWeight:800, color:COLOR }}>{tomorrow.free}</span>
              <span style={{ color:'#7878a0', marginLeft:'3px', fontSize:'0.78rem' }}>Freelancer</span>
            </span>
            <span style={{ fontSize:'0.78rem', fontWeight:800, color:COLOR }}>= {tomorrow.total}</span>
          </div>
        </ARow>
      )}
    </AdminSec>
  );
}

// ── Section: Lịch làm việc sắp tới ───────────────────────────────────────────
const PHASE_LABELS = { filming: '🎬 Ghi hình', setup: '🏗 Setup', rehearsal: '🎤 Rehearsal', teardown: '📦 Tháo dỡ' };

function UpcomingScheduleSection({ userName, userId }) {
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
        const isScheduler = userId && s.scheduler_user_id === userId;
        for (const p of phases) {
          const dates = s[`${p}_dates`] || (s[`${p}_date`] ? [s[`${p}_date`]] : []);
          const leadsFlat = (s[`${p}_leads`] || []).map(l => l.name);
          const leadsMap  = s[`${p}_leads_map`];
          const staffFlat = s[`${p}_km_staff`] || [];
          const staffMap  = s[`${p}_km_staff_map`];
          const freeFlat  = (s[`${p}_freelancers`] || '').split(',').map(x => x.trim()).filter(Boolean);
          const freeMap   = s[`${p}_freelancers_map`];
          for (const date of dates) {
            if (!date || date < pastStr || date > cutoffStr) continue;
            if (!isScheduler) {
              const dateLeads = leadsMap ? (leadsMap[date] ?? []).map(l => l.name) : leadsFlat;
              const dateStaff = staffMap ? (staffMap[date] ?? []) : staffFlat;
              const dateFree  = freeMap
                ? (freeMap[date] != null ? Object.values(freeMap[date]).join(',').split(',').map(x => x.trim()).filter(Boolean) : [])
                : freeFlat;
              if (!dateLeads.includes(userName) && !dateStaff.includes(userName) && !dateFree.includes(userName)) continue;
            }
            const key = `${s.id}-${p}-${date}`;
            if (seen.has(key)) continue;
            seen.add(key);
            found.push({ date, phase: p, eventName: s.event_name, schedId: s.id, location: s.location });
          }
        }
      }
      found.sort((a, b) => a.date.localeCompare(b.date));
setUpcoming(found);
    }).catch(() => {});
  }, [userName, userId]);

  // Group items by (schedId × zone) — event đa ngày hiện ở từng zone tương ứng
  const PHASE_ORDER = ['setup', 'rehearsal', 'filming', 'teardown'];
  const PHASE_ICON  = { setup:'🏗', rehearsal:'🎤', filming:'🎬', teardown:'📦' };

  const zoneOf = (date) => {
    if (date === todayVN)    return 'today';
    if (date === tomorrowVN) return 'tomorrow';
    if (date > tomorrowVN)   return 'upcoming';
    return 'past';
  };

  const groupMap = {};
  for (const item of upcoming) {
    const zone = zoneOf(item.date);
    const key  = `${item.schedId}::${zone}`;
    if (!groupMap[key]) groupMap[key] = { schedId: item.schedId, eventName: item.eventName, location: item.location, dates: {}, zone };
    const g = groupMap[key];
    if (!g.dates[item.phase]) g.dates[item.phase] = [];
    if (!g.dates[item.phase].includes(item.date)) g.dates[item.phase].push(item.date);
  }
  const allGroups   = Object.values(groupMap);
  const todayEvs    = allGroups.filter(g => g.zone === 'today');
  const tomorrowEvs = allGroups.filter(g => g.zone === 'tomorrow');
  const upcomingEvs = allGroups.filter(g => g.zone === 'upcoming');
  const totalFuture = todayEvs.length + tomorrowEvs.length + upcomingEvs.length;

  if (totalFuture === 0) return null;

  function ZoneDivider({ color, border, label, count }) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 16px 2px' }}>
        <div style={{ flex:1, height:'1px', background:`linear-gradient(90deg,${border},transparent)` }} />
        <span style={{ fontSize:'0.80rem', fontWeight:800, letterSpacing:'0.08em', color, background:`${color}18`, border:`1px solid ${border}`, borderRadius:'999px', padding:'2px 10px', whiteSpace:'nowrap' }}>
          {label} <span style={{ opacity:0.7, fontWeight:600 }}>({count})</span>
        </span>
        <div style={{ flex:1, height:'1px', background:`linear-gradient(270deg,${border},transparent)` }} />
      </div>
    );
  }

  function EventCard({ group }) {
    const allDates   = Object.values(group.dates).flat();
    const isToday    = allDates.includes(todayVN);
    const isTomorrow = allDates.includes(tomorrowVN);
    const accentColor = isToday ? '#f87171' : isTomorrow ? '#4ade80' : '#c9a84c';
    const nameColor   = isToday ? '#fca5a5' : isTomorrow ? '#86efac' : '#c9a84c';
    return (
      <div className="ev-card-flat"
        onClick={() => navigate('/work-schedule', { state: { schedId: group.schedId } })}
        style={{ border:`1px solid rgba(255,255,255,0.07)`, borderLeft:`3px solid ${accentColor}`, borderRadius:'10px', cursor:'pointer', overflow:'hidden', transition:'filter 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.12)'}
        onMouseLeave={e => e.currentTarget.style.filter = ''}
      >
        {/* Hàng 1: tên — band nổi */}
        <p style={{ margin:0, fontWeight:700, color:nameColor, fontSize:'0.87rem', padding:'10px 14px 9px', background:'rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{group.eventName}</p>
        {/* Hàng 2: location + dates */}
        <div style={{ padding:'8px 14px 10px', display:'flex', flexDirection:'column', gap:'5px' }}>
          {group.location && <p style={{ margin:0, fontSize:'0.80rem', color:'#7878a0' }}>📍 {group.location}</p>}
          <div style={{ overflowX:'auto', paddingBottom:'2px' }}>
            <div style={{ display:'inline-flex', gap:'10px', alignItems:'center', whiteSpace:'nowrap', fontSize:'0.80rem' }}>
              {PHASE_ORDER.filter(p => group.dates[p]?.length).map(p => {
                const sorted = [...group.dates[p]].sort();
                return (
                  <span key={p} style={{ display:'inline-flex', alignItems:'center', gap:'3px' }}>
                    <span>{PHASE_ICON[p]}</span>
                    {sorted.map((d, i) => (
                      <span key={d} style={{ color: d === todayVN ? '#f87171' : d === tomorrowVN ? '#4ade80' : '#a0a0b8', fontWeight: (d === todayVN || d === tomorrowVN) ? 700 : 400 }}>
                        {i > 0 && <span style={{ color:'#555570' }}> · </span>}{fmtD(d)}
                      </span>
                    ))}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ borderRadius:'12px', overflow:'hidden', border:'1px solid rgba(74,222,128,0.35)', marginBottom:'10px' }}>
      <SectionHeader title="Lịch làm việc của bạn" color="#4ade80" colorRgb="74,222,128" count={totalFuture} />
      <div style={{ background:'#13131d', padding:'10px 12px', display:'flex', flexDirection:'column', gap:'6px' }}>
        {todayEvs.length > 0 && <>
          <ZoneDivider color="#f87171" border="rgba(248,113,113,0.4)" label="HÔM NAY" count={todayEvs.length} />
          {todayEvs.map(g => <EventCard key={`${g.schedId}::today`} group={g} />)}
        </>}
        {tomorrowEvs.length > 0 && <>
          <ZoneDivider color="#4ade80" border="rgba(74,222,128,0.35)" label="NGÀY MAI" count={tomorrowEvs.length} />
          {tomorrowEvs.map(g => <EventCard key={`${g.schedId}::tomorrow`} group={g} />)}
        </>}
        {upcomingEvs.length > 0 && <>
          <ZoneDivider color="#60a5fa" border="rgba(96,165,250,0.3)" label="NGÀY SẮP TỚI" count={upcomingEvs.length} />
          {upcomingEvs.map(g => <EventCard key={`${g.schedId}::upcoming`} group={g} />)}
        </>}
      </div>
    </div>
  );
}

// ── Event Card Popup (Dashboard) ───────────────────────────────────────────

const EV_STATUS = {
  active:    { label: 'Đang diễn ra',      color: '#4ade80', bg: 'rgba(74,222,128,0.15)',  border: 'rgba(74,222,128,0.4)'  },
  planned:   { label: 'Đang lên kế hoạch', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  border: 'rgba(96,165,250,0.4)'  },
  completed: { label: 'Đã hoàn thành',     color: GOLD,      bg: 'rgba(201,168,76,0.15)',  border: 'rgba(201,168,76,0.4)'  },
};

function DashEventCard({ ev, onClose }) {
  const navigate = useNavigate();
  if (!ev) return null;

  const todayStr  = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const s         = EV_STATUS[ev.status] || EV_STATUS.planned;

  const parseArr  = (raw, single) => { try { const p = JSON.parse(raw || '[]'); if (Array.isArray(p)) return p; } catch {} return single ? [single] : []; };
  const filmDates = parseArr(ev.filming_dates, ev.filming_date);
  const startDates= parseArr(ev.start_dates,   ev.start_date);
  const endDates  = parseArr(ev.end_dates,     ev.end_date);
  const isToday   = [...startDates, ...endDates, ...filmDates].includes(todayStr);

  const Pill = ({ color, bg, border, children }) => (
    <span style={{ fontSize:'0.80rem', fontWeight:800, color, background:bg, border:`1px solid ${border}`, borderRadius:'999px', padding:'2px 9px', whiteSpace:'nowrap' }}>{children}</span>
  );
  const Info = ({ icon, text, color }) => text ? (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', fontSize:'0.82rem', color: color || '#a0a0b8', whiteSpace:'nowrap' }}>{icon} {text}</span>
  ) : null;

  const go = (openModal) => { onClose(); navigate('/events', { state: { openEventId: ev.id, openModal } }); };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:'#15151f', border:`2px solid ${s.border}`, borderRadius:'14px', overflow:'hidden', width:'100%', maxWidth:'380px', boxShadow:`0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px ${s.border}`, borderLeft:`6px solid ${s.color}` }}>

        {/* Header */}
        <div style={{ padding:'12px 14px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap', marginBottom:'7px' }}>
            <span style={{ fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace", fontSize:'0.82rem', color:'#7878a0' }}>{ev.code}</span>
            <Pill color={s.color} bg={s.bg} border={s.border}>{s.label}</Pill>
            {isToday && <Pill color='#f87171' bg='rgba(248,113,113,0.15)' border='rgba(248,113,113,0.45)'>HÔM NAY</Pill>}
          </div>
          <h3 style={{ fontWeight:700, fontSize:'1.05rem', color:'#eeeef5', margin:0, lineHeight:1.35 }}>{ev.name}</h3>
        </div>

        {/* Info rows */}
        <div style={{ padding:'10px 14px 12px', display:'flex', flexDirection:'column', gap:'5px' }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 12px' }}>
            <Info icon="👤" text={ev.client} />
            <Info icon="📍" text={ev.location} />
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 12px' }}>
            {startDates.length > 0 && <Info icon="📅" text={startDates.map(d => fmtD(d)).join(', ')} />}
            {filmDates.length > 0 && (
              <Info icon="🎬" text={filmDates.map(d => fmtD(d)).join(', ')}
                color={filmDates.includes(todayStr) ? '#f87171' : '#fb923c'} />
            )}
            {endDates.length > 0 && <Info icon="🏁" text={endDates.map(d => fmtD(d)).join(', ')} />}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display:'flex', gap:'0', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={() => go('detail')}
            style={{ flex:1, padding:'12px', border:'none', borderRight:'1px solid rgba(255,255,255,0.07)', background:'rgba(248,113,113,0.1)', color:'#f87171', fontWeight:700, fontSize:'0.85rem', cursor:'pointer', transition:'background 0.13s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(248,113,113,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(248,113,113,0.1)'}>
            🗂 Thiết bị
          </button>
          <button onClick={() => go('staff')}
            style={{ flex:1, padding:'12px', border:'none', background:'rgba(96,165,250,0.1)', color:'#60a5fa', fontWeight:700, fontSize:'0.85rem', cursor:'pointer', transition:'background 0.13s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(96,165,250,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(96,165,250,0.1)'}>
            👥 Nhân sự
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section: Báo cáo cần nộp (regular users) ──────────────────────────────

const PHASE_LABEL_MAP = { setup: 'Setup', teardown: 'Tháo dỡ', rehearsal: 'Rehearsal', filming: 'Ghi hình' };

function PendingReportsSection({ obs }) {
  const navigate = useNavigate();
  const sorted = [...obs].sort((a, b) => {
    if (a.overdue && !b.overdue) return -1;
    if (!a.overdue && b.overdue) return 1;
    return (a.deadline || '').localeCompare(b.deadline || '');
  });
  return (
    <AdminSec title="BÁO CÁO CẦN NỘP" color="#fb923c" rgb="251,146,60" count={obs.length} linkTo="/event-report">
      {sorted.map((ob, i) => (
        <ARow key={ob.id} i={i} rgb="251,146,60">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <p style={{ fontWeight: 600, color: ob.overdue ? '#fca5a5' : '#fbbf24', fontSize: '0.83rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ob.event_display || ob.event_name || 'Sự kiện'}
              </p>
              {ob.overdue && (
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f87171', background: 'rgba(248,113,113,0.15)', borderRadius: '4px', padding: '1px 5px', flexShrink: 0 }}>Quá hạn</span>
              )}
            </div>
            <p style={{ fontSize: '0.82rem', color: '#a0a0c0', margin: '1px 0 0', fontWeight: 600 }}>
              {ob.lead_name}
            </p>
            <p style={{ fontSize: '0.80rem', color: '#7878a0', margin: '1px 0 0' }}>
              {PHASE_LABEL_MAP[ob.phase] || ob.phase} · {fmtD(ob.assigned_date)} · <span style={{ color: ob.overdue ? '#f87171' : '#fb923c', fontWeight: 700 }}>Hạn {fmtD(ob.deadline?.slice(0, 10))}</span>
            </p>
          </div>
          <button
            onClick={() => navigate('/event-report', { state: { prefill: { event_id: ob.event_id, event_label: ob.event_display || ob.event_name, report_date: ob.assigned_date } } })}
            style={{
              flexShrink: 0, padding: '5px 12px', borderRadius: '7px', cursor: 'pointer', border: 'none',
              background: ob.overdue ? 'rgba(248,113,113,0.2)' : 'rgba(251,146,60,0.2)',
              color: ob.overdue ? '#f87171' : '#fb923c',
              fontSize: '0.80rem', fontWeight: 700,
            }}
          >
            Nộp báo cáo
          </button>
        </ARow>
      ))}
    </AdminSec>
  );
}

// ── Admin Dashboard Components ─────────────────────────────────────────────

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
        <span style={{ fontWeight: 700, color, fontSize: '0.84rem', flex: 1, letterSpacing: '0.04em' }}>{title}</span>
        {count > 0 && <Badge count={count} color={color} />}
        {linkTo && (
          <Link to={linkTo} onClick={e => e.stopPropagation()} style={{ fontSize: '0.82rem', color: '#7878a0', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}>
            Xem tất cả →
          </Link>
        )}
        <span style={{ fontSize: '0.80rem', color: `rgba(${rgb},0.6)`, flexShrink: 0, marginLeft: '2px', transition: 'transform 0.18s', display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
      </div>
      {open && <div style={{ background: '#13131d', maxHeight: '292px', overflowY: 'auto' }}>{children}</div>}
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
  return <p style={{ color: '#7878a0', fontSize: '0.82rem', padding: '10px 14px', margin: 0 }}>{text}</p>;
}

function evDateLabel(ev) {
  if (ev.start_date && ev.end_date && ev.start_date !== ev.end_date)
    return `${fmtD(ev.start_date)} – ${fmtD(ev.end_date)}`;
  const ghDates = (ev.filming_dates || []).filter(Boolean);
  if (ghDates.length > 0) return ghDates.map(d => fmtD(d)).join(', ');
  if (ev.start_date) return fmtD(ev.start_date);
  return '';
}

function AdminDashboard({ dash, events, violations, lockedObs, myObs, onConfirmed, userName, user }) {
  const navigate = useNavigate();
  const [cardEv, setCardEv] = useState(null);

  const isAdmin = user && (['SUPER_ADMIN', 'DIRECTOR'].includes(user.role) || !!user.is_truong_phong || !!user.is_phan_lich_all);

  const todayEvs    = dash?.today_events    || [];
  const tomorrowEvs = dash?.tomorrow_events || [];
  const planned    = events.filter(e => e.status === 'planned');
  const completed  = events.filter(e => e.status === 'completed');
  const topObs     = lockedObs;
  const topViols   = violations;

  const openCard = (ev) => {
    const full = events.find(e => e.id === ev.id) || ev;
    setCardEv(full);
  };

  const T = { name: { fontWeight:600, color:'#e0e0ee', fontSize:'0.83rem', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
              sub:  { fontSize:'0.82rem', color:'#7878a0', margin:'1px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' } };
  const EV_STATUS_COLOR = { planned:'#fbbf24', active:'#4ade80', completed:'#94a3b8', cancelled:'#f87171' };
  const EV_STATUS_LABEL = { planned:'Kế hoạch', active:'Đang diễn', completed:'Hoàn thành', cancelled:'Đã hủy' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {cardEv && <DashEventCard ev={cardEv} onClose={() => setCardEv(null)} />}

      {/* Báo cáo cần nộp - tất cả user */}
      {myObs.length > 0 && <PendingReportsSection obs={myObs} />}

      {/* Tổng hợp nhân sự hôm nay / ngày mai — chỉ user phân lịch tất cả */}
      {((['SUPER_ADMIN','DIRECTOR'].includes(user?.role)) || !!user?.is_phan_lich_all || !!user?.is_giam_doc) && <StaffSummarySection />}

      {/* Lịch làm việc cá nhân */}
      {userName && <UpcomingScheduleSection userName={userName} userId={user?.id} />}

      {/* 1. Vận hành hôm nay */}
      <AdminSec title="VẬN HÀNH HÔM NAY" color="#f87171" rgb="248,113,113" count={todayEvs.length} linkTo="/events">
        {todayEvs.length === 0
          ? <AEmpty text="Không có sự kiện nào hôm nay" />
          : todayEvs.map((ev, i) => (
            <ARow key={ev.id} i={i} rgb="248,113,113" onClick={() => openCard(ev)}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#f87171', flexShrink:0, boxShadow:'0 0 5px rgba(248,113,113,0.8)' }} />
              <div style={{ flex:1, minWidth:0 }}>
                <p style={T.name}>{ev.name}</p>
                {(ev.client || ev.location) && <p style={T.sub}>{[ev.client, ev.location].filter(Boolean).join(' · ')}</p>}
              </div>
              <span style={{ fontSize:'0.80rem', color:'#f87171', fontWeight:700, flexShrink:0 }}>{evDateLabel(ev)}</span>
            </ARow>
          ))
        }
      </AdminSec>

      {/* 1b. Vận hành ngày mai */}
      {tomorrowEvs.length > 0 && (
        <AdminSec title="VẬN HÀNH NGÀY MAI" color="#4ade80" rgb="74,222,128" count={tomorrowEvs.length} linkTo="/events">
          {tomorrowEvs.map((ev, i) => (
            <ARow key={ev.id} i={i} rgb="74,222,128" onClick={() => openCard(ev)}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', flexShrink:0, boxShadow:'0 0 5px rgba(74,222,128,0.8)' }} />
              <div style={{ flex:1, minWidth:0 }}>
                <p style={T.name}>{ev.name}</p>
                {(ev.client || ev.location) && <p style={T.sub}>{[ev.client, ev.location].filter(Boolean).join(' · ')}</p>}
              </div>
              <span style={{ fontSize:'0.80rem', color:'#4ade80', fontWeight:700, flexShrink:0 }}>{evDateLabel(ev)}</span>
            </ARow>
          ))}
        </AdminSec>
      )}

      {/* 2. Đang lên kế hoạch */}
      <AdminSec title="ĐANG LÊN KẾ HOẠCH" color="#60a5fa" rgb="96,165,250" count={planned.length} linkTo="/events">
        {planned.length === 0
          ? <AEmpty text="Không có sự kiện đang lên kế hoạch" />
          : planned.map((ev, i) => (
            <ARow key={ev.id} i={i} rgb="96,165,250" onClick={() => openCard(ev)}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#60a5fa', flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <p style={T.name}>{ev.name}</p>
                {(ev.client || ev.location) && <p style={T.sub}>{[ev.client, ev.location].filter(Boolean).join(' · ')}</p>}
              </div>
              {ev.start_date && <span style={{ fontSize:'0.80rem', color:'#60a5fa', fontWeight:700, flexShrink:0 }}>{fmtD(ev.start_date)}</span>}
            </ARow>
          ))
        }
      </AdminSec>

      {/* 3+4. Tổng quan vi phạm (chỉ admin) */}
      {isAdmin && <AdminSec title="TỔNG QUAN VI PHẠM" color="#fb923c" rgb="251,146,60" count={topObs.length + topViols.length} linkTo="/violations">
        {topObs.length === 0 && topViols.length === 0
          ? <AEmpty text="Không có vi phạm gần đây" />
          : <>
            {(() => {
              const groups = [];
              const seen = new Map();
              for (const ob of topObs) {
                const key = ob.event_id ?? `__${ob.event_display ?? ob.event_name ?? 'noname'}`;
                const name = ob.event_display || ob.event_name || 'Nội bộ';
                if (!seen.has(key)) { seen.set(key, []); groups.push({ key, name, items: [] }); }
                seen.get(key).push(ob);
              }
              for (const g of groups) g.items = seen.get(g.key);
              return groups.map(({ key, name, items }) => (
                <div key={key} style={{ marginBottom:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'3px 14px', marginBottom:'5px', minWidth:0 }}>
                    <span style={{ fontSize:'0.78rem', fontWeight:800, color:'#c9a84c', letterSpacing:'0.06em', whiteSpace:'nowrap', textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', flex:1, minWidth:0 }}>{name}</span>
                    <span style={{ fontSize:'0.72rem', color:'#555570', flexShrink:0 }}>{items.length} phiếu</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', borderLeft:'2px solid rgba(201,168,76,0.18)', marginLeft:'14px' }}>
                    {items.map((ob, i) => (
                      <ARow key={`ob-${ob.id}`} i={i} rgb="248,113,113" onClick={() => navigate('/event-report')}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                            <p style={{ ...T.name, color:'#fca5a5', margin:0 }}>{ob.lead_name}</p>
                            <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#f87171', background:'rgba(248,113,113,0.15)', borderRadius:'4px', padding:'1px 5px', flexShrink:0 }}>Chưa nộp BC</span>
                          </div>
                          <p style={T.sub}>{PHASE_LABEL_MAP[ob.phase] || ob.phase}</p>
                        </div>
                        <span style={{ fontSize:'0.80rem', color:'#f87171', fontWeight:700, flexShrink:0 }}>{fmtD(ob.assigned_date)}</span>
                      </ARow>
                    ))}
                  </div>
                </div>
              ));
            })()}
            {(() => {
              const groups = [];
              const seen = new Map();
              for (const v of topViols) {
                const key = v.event_id ?? `__${v.event_name ?? v.event_label ?? 'noname'}`;
                const name = v.event_name || v.event_label || 'Nội bộ';
                if (!seen.has(key)) { seen.set(key, []); groups.push({ key, name, items: [] }); }
                seen.get(key).push(v);
              }
              for (const g of groups) g.items = seen.get(g.key);
              return groups.map(({ key, name, items }) => (
                <div key={key} style={{ marginBottom:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'3px 14px', marginBottom:'5px', minWidth:0 }}>
                    <span style={{ fontSize:'0.78rem', fontWeight:800, color:'#c9a84c', letterSpacing:'0.06em', whiteSpace:'nowrap', textTransform:'uppercase', overflow:'hidden', textOverflow:'ellipsis', flex:1, minWidth:0 }}>{name}</span>
                    <span style={{ fontSize:'0.72rem', color:'#555570', flexShrink:0 }}>{items.length} vi phạm</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', borderLeft:'2px solid rgba(201,168,76,0.18)', marginLeft:'14px' }}>
                    {items.map((v, i) => (
                      <ARow key={`v-${v.id}`} i={i} rgb="251,146,60" onClick={() => navigate('/violations')}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={T.name}>{v.violator}</p>
                          <p style={T.sub}>{v.violation_type}</p>
                        </div>
                        <span style={{ fontSize:'0.80rem', color:'#fb923c', fontWeight:700, flexShrink:0 }}>{fmtD(v.created_at?.slice(0,10))}</span>
                      </ARow>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </>
        }
      </AdminSec>}


      {/* Xuất kho + quá hạn trả (vẫn cần cho admin) */}
      {(dash?.need_confirm?.length > 0 || dash?.overdue?.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {dash.need_confirm.length > 0 && <ConfirmSection items={dash.need_confirm} onConfirmed={onConfirmed} />}
          {dash.overdue.length > 0 && <OverdueSection items={dash.overdue} />}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const [dash, setDash]       = useState(null);
  const [events, setEvents]   = useState([]);
  const [violations, setViolations] = useState([]);
  const [lockedObs, setLockedObs]   = useState([]);
  const [myObs, setMyObs]           = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [d, evs] = await Promise.all([api.getDashboard(), api.getEvents()]);
      setDash(d);
      setEvents(evs);
    } catch { /* dash stays null, handled in render */ } finally {
      setLoading(false);
    }
    api.getViolations().then(vs => setViolations(vs)).catch(() => {});
    api.getLeadObligations().then(obs => {
      setLockedObs(obs.filter(o => o.locked && !o.submitted));
      const yesterdayVN = (() => {
        const d = new Date(Date.now() + 7 * 3600 * 1000);
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().slice(0, 10);
      })();
      setMyObs(obs.filter(o => !o.submitted && !o.locked && o.assigned_date === yesterdayVN));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e8c97a', margin: 0 }}>Trang Chủ</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Đang tải...</div>
      ) : !dash ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#f87171' }}>Không thể tải dữ liệu. Vui lòng thử lại.</div>
      ) : (
        <AdminDashboard dash={dash} events={events} violations={violations} lockedObs={lockedObs} myObs={myObs} onConfirmed={load} userName={user?.full_name || ''} user={user} />
      )}
    </div>
  );
}
