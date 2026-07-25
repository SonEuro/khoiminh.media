import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KM_STAFF_GROUPS } from '../../constants/staff';
import { api } from '../../api';
import { fmtD } from '../../utils/fmt';
import { useAuth } from '../../contexts/AuthContext';
import { useStaffGroups } from '../../contexts/StaffGroupsContext';
import Modal from '../Modal';
import { SectionHeader, GOLD } from './dashShared';

const PHASE_LABEL_MAP = { filming: '🎬 Ghi hình', setup: '🏗 Setup', rehearsal: '🎤 Rehearsal', teardown: '📦 Tháo dỡ' };
const PHASE_ORDER = ['setup', 'rehearsal', 'filming', 'teardown'];
const PHASE_ICON  = { setup:'🏗', rehearsal:'🎤', filming:'🎬', teardown:'📦' };
const PHASES_ORDER = ['setup', 'rehearsal', 'filming', 'teardown'];
const DEPT_COLORS = { 'Sân Khấu':'#a78bfa', 'ATAS-LED':'#60a5fa', 'Cơ Sở Vật Chất':'#4ade80', 'Kỹ Thuật':'#fb923c', 'Kinh Doanh':'#f472b6', 'Kế Toán':'#facc15' };

export default function UpcomingScheduleSection({ userName, userId }) {
  const [upcoming, setUpcoming]       = useState([]);
  const [detailSched, setDetailSched] = useState(null);
  const navigate = useNavigate();
  const { can } = useAuth();
  const { kmGroups: liveKmGroups } = useStaffGroups();
  const todayVN    = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const tomorrowVN = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d); })();

  useEffect(() => {
    if (!userName) return;
    api.getWorkSchedules({}).then(schedules => {
      const todayVN    = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
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
          const dates     = s[`${p}_dates`] || (s[`${p}_date`] ? [s[`${p}_date`]] : []);
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
      <div
        onClick={() => api.getWorkScheduleById(group.schedId).then(setDetailSched).catch(() => {})}
        style={{ border:`1px solid rgba(255,255,255,0.07)`, borderLeft:`3px solid ${accentColor}`, borderRadius:'10px', cursor:'pointer', overflow:'hidden', transition:'filter 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.12)'}
        onMouseLeave={e => e.currentTarget.style.filter = ''}
      >
        <p style={{ margin:0, fontWeight:700, color:nameColor, fontSize:'0.87rem', padding:'10px 14px 9px', background:'rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>{group.eventName}</p>
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

  const getDeptColor = d => DEPT_COLORS[d] || '#a0a0b8';

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
        const todayEntries = [];
        for (const p of PHASES_ORDER) {
          const dates = (detailSched[`${p}_dates`] || (detailSched[`${p}_date`] ? [detailSched[`${p}_date`]] : [])).filter(d => d === todayVN);
          for (const date of dates) {
            const leadsMap = detailSched[`${p}_leads_map`];
            const leads = leadsMap ? (leadsMap[date] || []) : (detailSched[`${p}_leads`] || []);
            const staffMap = detailSched[`${p}_km_staff_map`];
            const staff = staffMap ? (staffMap[date] || []) : (detailSched[`${p}_km_staff`] || []);
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
            {(() => {
              const myName = userName;
              if (!myName) return null;
              const pastDates = [];
              const phases = ['setup','rehearsal','filming','teardown'];
              for (const p of phases) {
                const dates = (detailSched[`${p}_dates`] || (detailSched[`${p}_date`] ? [detailSched[`${p}_date`]] : [])).filter(d => d <= todayVN);
                for (const date of dates) {
                  const userDept = liveKmGroups.find(g => g.members.includes(myName))?.dept;
                  if (!userDept) continue;
                  const supportMapPhase = detailSched[`${p}_km_support`] || {};
                  if (Object.prototype.hasOwnProperty.call(supportMapPhase[date] || {}, myName)) continue;
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
