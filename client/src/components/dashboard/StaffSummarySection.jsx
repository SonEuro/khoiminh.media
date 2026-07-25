import { useState, useEffect, useCallback } from 'react';
import { KM_STAFF_GROUPS } from '../../constants/staff';
import { api } from '../../api';
import { AdminSec, ARow } from './dashShared';

const DEPT_COLORS_DASH = {
  'ATAS-LED': '#a78bfa', 'Sân Khấu': '#fb923c', 'Kỹ Thuật': '#38bdf8',
  'Cơ Sở Vật Chất': '#4ade80', 'Kế Toán': '#fbbf24', 'Kinh Doanh': '#f472b6',
};

const COLOR = '#fbbf24';
const RGB = '251,191,36';
const PHASES = ['setup', 'teardown', 'rehearsal', 'filming'];

export default function StaffSummarySection() {
  const [summary, setSummary]               = useState(null);
  const [vanPhongSet, setVanPhongSet]       = useState(new Set());
  const [expandToday, setExpandToday]       = useState(false);
  const [expandTomorrow, setExpandTomorrow] = useState(false);

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
