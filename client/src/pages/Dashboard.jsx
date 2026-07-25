import { useState, useEffect, useCallback } from 'react';
import { KM_STAFF_GROUPS } from '../constants/staff';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { fmtD } from '../utils/fmt';
import { Zap, CalendarDays, CircleCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStaffGroups } from '../contexts/StaffGroupsContext';
import Modal from '../components/Modal';

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
const DEPT_COLORS_DASH = {
  'ATAS-LED': '#a78bfa', 'Sân Khấu': '#fb923c', 'Kỹ Thuật': '#38bdf8',
  'Cơ Sở Vật Chất': '#4ade80', 'Kế Toán': '#fbbf24', 'Kinh Doanh': '#f472b6',
};


function StaffSummarySection() {
  const [summary, setSummary]           = useState(null);
  const [vanPhongSet, setVanPhongSet]   = useState(new Set());
  const [expandToday, setExpandToday]   = useState(false);
  const [expandTomorrow, setExpandTomorrow] = useState(false);
  const COLOR = '#fbbf24'; const RGB = '251,191,36';
  const PHASES = ['setup', 'teardown', 'rehearsal', 'filming'];

  const loadFlags = useCallback(() =>
    api.getStaffFlags().then(d => setVanPhongSet(new Set(d.vanPhong))).catch(() => {}),
  []);

  useEffect(() => { loadFlags(); }, [loadFlags]);


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
        return { km: kmNames.size, free: freeTotal, total: kmNames.size + freeTotal, busyKm: kmNames };
      };
      setSummary({ today: countDay(todayVN), tomorrow: countDay(tomorrowVN) });
    }).catch(() => {});
  }, []);

  if (!summary) return null;
  const { today, tomorrow } = summary;
  if (today.total === 0 && tomorrow.total === 0) return null;

  const buildFree = (busyKm) => KM_STAFF_GROUPS
    .map(g => ({ dept: g.dept, members: g.members.filter(n => !busyKm.has(n) && !vanPhongSet.has(n)) }))
    .filter(g => g.members.length > 0);

const freeToday    = buildFree(today.busyKm);
  const freeTomorrow = buildFree(tomorrow.busyKm);
  const freeCountToday    = freeToday.reduce((s, g) => s + g.members.length, 0);
  const freeCountTomorrow = freeTomorrow.reduce((s, g) => s + g.members.length, 0);

  const DayBlock = ({ day, freeByDept, expanded, setExpanded, rowIdx }) => {
    const freeCount = freeByDept.reduce((s, g) => s + g.members.length, 0);
    return (
      <>
        <ARow i={rowIdx} rgb={RGB} onClick={() => setExpanded(o => !o)}>
          <span style={{ fontSize:'0.83rem', fontWeight:600, color:'#e0e0ee', flex:1 }}>{day}</span>
          <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
            <span style={{ fontSize:'0.83rem', color:'#e0e0ee' }}>
              <span style={{ fontWeight:800, color:'#60a5fa' }}>{day === 'Hôm nay' ? today.km : tomorrow.km}</span>
              <span style={{ color:'#7878a0', marginLeft:'3px', fontSize:'0.78rem' }}>Khôi Minh</span>
            </span>
            <span style={{ color:'#444460', fontSize:'0.78rem' }}>+</span>
            <span style={{ fontSize:'0.83rem', color:'#e0e0ee' }}>
              <span style={{ fontWeight:800, color:COLOR }}>{day === 'Hôm nay' ? today.free : tomorrow.free}</span>
              <span style={{ color:'#7878a0', marginLeft:'3px', fontSize:'0.78rem' }}>Freelancer</span>
            </span>
            {freeCount > 0 && <span style={{ fontSize:'0.72rem', fontWeight:700, color:'rgba(251,191,36,0.6)', marginLeft:'4px' }}>{freeCount} Trống</span>}
            <span style={{ fontSize:'0.78rem', color:`rgba(${RGB},0.5)`, transition:'transform 0.15s', display:'inline-block', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
          </div>
        </ARow>
        {expanded && (
          <div style={{ padding:'8px 14px 10px', display:'flex', flexDirection:'column', gap:'8px' }}>
            {freeByDept.length === 0
              ? <div style={{ fontSize:'0.78rem', color:'#7878a0' }}>Tất cả đã có lịch</div>
              : freeByDept.map(({ dept, members }) => (
                <div key={dept}>
                  <div style={{ fontSize:'0.72rem', fontWeight:700, color: DEPT_COLORS_DASH[dept] || '#7878a0', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'3px' }}>{dept}</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                    {members.map(name => (
                      <span key={name} style={{ fontSize:'0.76rem', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'1px 7px', color:'#b0b0cc' }}>
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </>
    );
  };

  return (
    <AdminSec title="TỔNG HỢP NHÂN SỰ" color={COLOR} rgb={RGB}>
      {today.total > 0 && <DayBlock day="Hôm nay" freeByDept={freeToday} expanded={expandToday} setExpanded={setExpandToday} rowIdx={0} />}
      {tomorrow.total > 0 && <DayBlock day="Ngày mai" freeByDept={freeTomorrow} expanded={expandTomorrow} setExpanded={setExpandTomorrow} rowIdx={today.total > 0 ? 1 : 0} />}
    </AdminSec>
  );
}

// ── Section: Lịch làm việc sắp tới ───────────────────────────────────────────
const PHASE_LABELS = { filming: '🎬 Ghi hình', setup: '🏗 Setup', rehearsal: '🎤 Rehearsal', teardown: '📦 Tháo dỡ' };

function UpcomingScheduleSection({ userName, userId }) {
  const [upcoming, setUpcoming] = useState([]);
  const [detailSched, setDetailSched] = useState(null);
  const navigate = useNavigate();
  const { can } = useAuth();
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
        onClick={() => api.getWorkScheduleById(group.schedId).then(setDetailSched).catch(() => {})}
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

  const PHASES_ORDER = ['setup', 'rehearsal', 'filming', 'teardown'];
  const PHASE_LABEL_MAP = { filming: '🎬 Ghi hình', setup: '🏗 Setup', rehearsal: '🎤 Rehearsal', teardown: '📦 Tháo dỡ' };

  return (
    <>
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

    {detailSched && (() => {
      const DEPT_COLORS = { 'Sân Khấu':'#a78bfa', 'ATAS-LED':'#60a5fa', 'Cơ Sở Vật Chất':'#4ade80', 'Kỹ Thuật':'#fb923c', 'Kinh Doanh':'#f472b6', 'Kế Toán':'#facc15' };
      const getDeptColor = d => DEPT_COLORS[d] || '#a0a0b8';
      // Chỉ lấy entries của hôm nay
      const todayEntries = [];
      for (const p of PHASES_ORDER) {
        const dates = (detailSched[`${p}_dates`] || (detailSched[`${p}_date`] ? [detailSched[`${p}_date`]] : [])).filter(d => d === todayVN);
        for (const date of dates) {
          const leadsMap = detailSched[`${p}_leads_map`];
          const leads = leadsMap ? (leadsMap[date] || []) : (detailSched[`${p}_leads`] || []);
          const staffMap = detailSched[`${p}_km_staff_map`];
          const staff = staffMap ? (staffMap[date] || []) : (detailSched[`${p}_km_staff`] || []);
          // group staff by dept
          const byDept = {};
          for (const n of staff) {
            const dept = KM_STAFF_GROUPS.find(g => g.members.includes(n))?.dept || 'Khác';
            (byDept[dept] = byDept[dept] || []).push(n);
          }
          const freeMap = detailSched[`${p}_freelancers_map`];
          const freeFlat = (detailSched[`${p}_freelancers`] || '').split(',').map(x => x.trim()).filter(Boolean);
          const freeDepts = freeMap && freeMap[date]
            ? Object.entries(freeMap[date]).filter(([, v]) => v?.trim()).map(([dept, names]) => [dept, names.split(',').map(n => n.trim()).filter(Boolean)]).filter(([, ns]) => ns.length)
            : freeFlat.length ? [['', freeFlat]] : [];
          if (!leads.length && !staff.length && !freeDepts.length) continue;
          todayEntries.push({ p, date, leads, byDept, freeDepts });
        }
      }
      return (
        <Modal title={`Nhân Sự — ${detailSched.event_name}`} onClose={() => setDetailSched(null)} size="xl">
          <p style={{ fontSize:'0.85rem', color:'#a0a0b8', marginBottom:'12px' }}>
            👤 Người phân lịch: <strong style={{ color: GOLD }}>{detailSched.scheduler_name}</strong>
          </p>
          {todayEntries.length === 0
            ? <p style={{ color:'#7878a0', fontSize:'0.85rem' }}>Không có lịch hôm nay.</p>
            : todayEntries.map(({ p, date, leads, byDept, freeDepts }) => (
              <div key={`${p}-${date}`}>
                <div style={{ fontSize:'0.87rem', fontWeight:700, color: GOLD, marginBottom:'6px' }}>{PHASE_LABEL_MAP[p]} <span style={{ color:'#f87171' }}>{fmtD(date)}</span></div>
                {leads.map(l => (
                  <div key={l.name||l} style={{ fontSize:'0.92rem', color:'#a0a0b8', padding:'2px 0 2px 10px' }}>
                    👑 {l.name||l}{l.department ? <span style={{ color:'#fbbf24', marginLeft:'6px', fontSize:'0.82rem' }}>({l.department})</span> : null}
                  </div>
                ))}
                {Object.keys(byDept).length > 0 && (
                  <div style={{ marginTop:'6px' }}>
                    <div style={{ fontSize:'0.75rem', fontWeight:800, color:'#c9a84c', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'4px' }}>Nhân Sự Khôi Minh</div>
                    {Object.entries(byDept).map(([dept, members]) => (
                      <div key={dept} style={{ marginBottom:'4px' }}>
                        <div style={{ fontSize:'0.80rem', fontWeight:700, color: getDeptColor(dept), paddingLeft:'8px' }}>{dept}</div>
                        {members.map(n => <div key={n} style={{ fontSize:'0.92rem', color:'#eeeef5', padding:'1px 0 1px 18px' }}>• {n}</div>)}
                      </div>
                    ))}
                  </div>
                )}
                {freeDepts.length > 0 && (
                  <div style={{ marginTop:'6px' }}>
                    <div style={{ fontSize:'0.75rem', fontWeight:800, color:'#f87171', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'4px' }}>Freelancer</div>
                    {freeDepts.map(([dept, names]) => (
                      <div key={dept} style={{ marginBottom:'4px' }}>
                        {dept && <div style={{ fontSize:'0.80rem', fontWeight:700, color: getDeptColor(dept), paddingLeft:'8px' }}>{dept}</div>}
                        {names.map(n => <div key={n} style={{ fontSize:'0.92rem', color:'#fca5a5', padding:'1px 0 1px 18px' }}>• {n}</div>)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          }
          {/* Section nộp báo cáo cho ngày đã qua mà user được phân công */}
          {(() => {
            const myName = userName;
            if (!myName) return null;
            const pastDates = [];
            const phases = ['setup','rehearsal','filming','teardown'];
            for (const p of phases) {
              const dates = (detailSched[`${p}_dates`] || (detailSched[`${p}_date`] ? [detailSched[`${p}_date`]] : [])).filter(d => d <= todayVN);
              for (const date of dates) {
                const userDept = liveKmGroups.find(g => g.members.includes(myName))?.dept;
                if (!userDept) continue; // không phải nhân sự KM → không nộp
                const supportMapPhase = detailSched[`${p}_km_support`] || {};
                if (Object.prototype.hasOwnProperty.call(supportMapPhase[date] || {}, myName)) continue; // đang hỗ trợ bộ phận khác
                const leadsAll = detailSched[`${p}_leads_map`]
                  ? (detailSched[`${p}_leads_map`][date] || [])
                  : (detailSched[`${p}_leads`] || []);
                const staffAll = detailSched[`${p}_km_staff_map`]
                  ? (detailSched[`${p}_km_staff_map`][date] || [])
                  : (detailSched[`${p}_km_staff`] || []);
                const deptLeads = leadsAll.filter(l => l.department === userDept).map(l => l.name || l);
                const deptStaff = staffAll.filter(n => liveKmGroups.find(g => g.dept === userDept && g.members.includes(n)));
                if (deptLeads.length === 0 && deptStaff.length === 0) continue;
                const isResponsible = deptLeads.length > 0
                  ? deptLeads.includes(myName)
                  : deptStaff[0] === myName;
                if (isResponsible) {
                  pastDates.push({ p, date, label: PHASE_LABEL_MAP[p] });
                }
              }
            }
            if (!pastDates.length) return null;
            return (
              <div style={{ marginTop:'12px', padding:'12px 14px', background:'rgba(201,168,76,0.06)', border:'1px solid rgba(201,168,76,0.25)', borderRadius:'10px' }}>
                <p style={{ margin:'0 0 8px', fontSize:'0.80rem', fontWeight:800, color: GOLD, letterSpacing:'0.06em', textTransform:'uppercase' }}>📋 Nộp Báo Cáo</p>
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {pastDates.map(({ p, date, label }) => (
                    <button key={`${p}-${date}`}
                      onClick={() => { setDetailSched(null); navigate('/event-report', { state: { prefill: { event_id: detailSched.event_id, event_label: detailSched.event_name, report_date: date } } }); }}
                      style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 12px', borderRadius:'7px', border:'1px solid rgba(201,168,76,0.3)', background:'rgba(201,168,76,0.08)', color: GOLD, cursor:'pointer', fontSize:'0.83rem', fontWeight:600, textAlign:'left' }}>
                      <span>{label}</span>
                      <span style={{ color:'#c8c8e0' }}>{fmtD(date)}</span>
                      <span style={{ marginLeft:'auto', fontSize:'0.75rem', color:'#7878a0' }}>Nộp →</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
          {can('viewWorkSchedule') && (
            <button onClick={() => { setDetailSched(null); navigate('/work-schedule', { state: { schedId: detailSched.id } }); }}
              style={{ marginTop:'12px', padding:'8px 16px', borderRadius:'8px', border:'1px solid rgba(201,168,76,0.4)', background:'rgba(201,168,76,0.1)', color: GOLD, cursor:'pointer', fontSize:'0.85rem', fontWeight:600 }}>
              Xem đầy đủ trên trang Lịch làm việc →
            </button>
          )}
        </Modal>
      );
    })()}
    </>
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


      {/* Quá hạn trả (vẫn cần cho admin) */}
      {dash?.overdue?.length > 0 && <OverdueSection items={dash.overdue} />}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

const ROLE_TO_KM_DEPT_DASH = {
  ATAS: 'ATAS-LED', STAGE: 'Sân Khấu', TECHNICAL: 'Kỹ Thuật',
  CSVC: 'Cơ Sở Vật Chất', ACCOUNTING: 'Kế Toán', PRODUCTION: 'Kinh Doanh',
};

function toMD(t) { if (!t) return null; const [h, m] = t.split(':').map(Number); return isNaN(h) ? null : h * 60 + m; }
function calcCongDash(r) {
  const s = toMD(r.time_present), e = toMD(r.time_end);
  if (s === null || e === null) return null;
  let diff = e - s; if (diff < 0) diff += 1440;
  const isAft = s >= 720;
  const isSun = new Date(r.report_date + 'T00:00:00').getDay() === 0;
  const isHol = !!r.is_holiday;
  const effMins = isAft ? diff : diff - (r.no_lunch_break ? 0 : 60);
  const thresh = isAft ? 240 : 480;
  const congRate = isAft ? 0.5 : isHol ? 2 : isSun ? 1.5 : 1;
  return { congRate, otHours: Math.max(0, effMins - thresh) / 60 };
}
function fmtNumD(n) { return n % 1 === 0 ? String(n) : parseFloat(n.toFixed(2)).toString(); }

function CongDashWidget({ user, kmStaffGroups }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const currentMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);

  useEffect(() => {
    api.getXacNhanCong(currentMonth).then(rows => setData(rows)).catch(() => {});
  }, [currentMonth]);

  if (!data) return null;

  const canViewAll = ['DIRECTOR', 'SUPER_ADMIN'].includes(user?.role) || !!user?.is_phan_lich_all;
  if (canViewAll) return null; // admin đã có trang riêng đầy đủ

  const myName = user?.full_name || '';
  const myDept = kmStaffGroups?.find(g => g.members?.includes(myName))?.dept || ROLE_TO_KM_DEPT_DASH[user?.role];

  // Compute summaries
  const isTruong = !!user?.is_truong_phong;
  let totalCong = 0, totalOT = 0, memberSet = new Set();

  for (const r of data) {
    const staff = Array.isArray(r.km_staff) ? r.km_staff : [];
    const res = calcCongDash(r);
    if (!res) continue;
    for (const name of staff) {
      const belongsToMe = isTruong
        ? (myDept && (kmStaffGroups?.find(g => g.dept === myDept)?.members || []).includes(name))
        : name === myName;
      if (!belongsToMe) continue;
      memberSet.add(name);
      totalCong += res.congRate;
      totalOT += res.otHours;
    }
  }

  const [mm, yy] = currentMonth.split('-');
  const label = `Tháng ${parseInt(mm, 10)}/${yy}`;

  // Build per-person summary for table
  const personSummary = {};
  for (const r of data) {
    const staff = Array.isArray(r.km_staff) ? r.km_staff : [];
    const res = calcCongDash(r);
    if (!res) continue;
    for (const name of staff) {
      const belongsToMe = isTruong
        ? (myDept && (kmStaffGroups?.find(g => g.dept === myDept)?.members || []).includes(name))
        : name === myName;
      if (!belongsToMe) continue;
      if (!personSummary[name]) personSummary[name] = { cong: 0, ot: 0, buoi: 0 };
      personSummary[name].cong += res.congRate;
      personSummary[name].ot  += res.otHours;
      personSummary[name].buoi++;
    }
  }
  const personRows = Object.entries(personSummary).sort((a, b) => b[1].cong - a[1].cong);

  const thS = { padding: '6px 10px', fontSize: '0.70rem', fontWeight: 700, color: '#7878a0', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap', textAlign: 'center' };
  const tdS = { padding: '7px 10px', fontSize: '0.82rem', color: '#ddddf0', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' };

  return (
    <div style={{ borderRadius: '10px', border: '1px solid rgba(201,168,76,0.25)', background: 'rgba(201,168,76,0.04)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', background: 'linear-gradient(135deg,rgba(201,168,76,0.12) 0%,rgba(201,168,76,0.02) 100%)', borderLeft: '3px solid #c9a84c', borderBottom: '1px solid rgba(201,168,76,0.14)' }}>
        <span style={{ fontWeight: 700, color: GOLD, fontSize: '0.84rem', flex: 1, letterSpacing: '0.04em' }}>
          {isTruong ? `CÔNG BỘ PHẬN — ${label}` : `CÔNG CỦA TÔI — ${label}`}
        </span>
        {isTruong && <span style={{ fontSize: '0.76rem', color: '#7878a0' }}>{memberSet.size} người · {fmtNumD(totalCong)} công{totalOT > 0 ? ` · +${fmtNumD(totalOT)}h OT` : ''}</span>}
        <span onClick={() => navigate('/xac-nhan-cong')} style={{ fontSize: '0.82rem', color: '#7878a0', cursor: 'pointer', flexShrink: 0 }}>Xem chi tiết →</span>
      </div>

      {personRows.length === 0 ? (
        <div style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#7878a0' }}>Chưa có dữ liệu tháng này</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col />
            <col style={{ width: '100px' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '85px' }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
              <th style={{ ...thS, textAlign: 'left' }}>Tên Nhân Viên</th>
              <th style={thS}>Ngày Công</th>
              <th style={thS}>OT (giờ)</th>
              <th style={thS}>Chi Tiết</th>
            </tr>
          </thead>
          <tbody>
            {personRows.map(([name, { cong, ot, buoi }]) => (
              <tr key={name} onClick={() => navigate('/xac-nhan-cong')} style={{ cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ ...tdS, fontWeight: 600, color: '#eeeef5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</td>
                <td style={{ ...tdS, textAlign: 'center', fontWeight: 700, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{fmtNumD(cong)}</td>
                <td style={{ ...tdS, textAlign: 'center', fontWeight: 700, color: ot > 0 ? '#60a5fa' : '#7878a0', fontVariantNumeric: 'tabular-nums' }}>{ot > 0 ? `${fmtNumD(ot)}h` : '—'}</td>
                <td style={{ ...tdS, textAlign: 'center', color: '#7878a0', fontSize: '0.75rem' }}>{buoi} Ngày</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { kmGroups: liveKmGroups } = useStaffGroups();
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
      <CongDashWidget user={user} kmStaffGroups={KM_STAFF_GROUPS} />
    </div>
  );
}
