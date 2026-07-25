import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtD } from '../../utils/fmt';
import { AdminSec, ARow, AEmpty, PHASE_LABEL_MAP } from './dashShared';
import DashEventCard from './DashEventCard';
import PendingReportsSection from './PendingReportsSection';
import StaffSummarySection from './StaffSummarySection';
import UpcomingScheduleSection from './UpcomingScheduleSection';
import OverdueSection from './OverdueSection';

function evDateLabel(ev) {
  if (ev.start_date && ev.end_date && ev.start_date !== ev.end_date)
    return `${fmtD(ev.start_date)} – ${fmtD(ev.end_date)}`;
  const ghDates = (ev.filming_dates || []).filter(Boolean);
  if (ghDates.length > 0) return ghDates.map(d => fmtD(d)).join(', ');
  if (ev.start_date) return fmtD(ev.start_date);
  return '';
}

export default function AdminDashboard({ dash, events, violations, lockedObs, myObs, onConfirmed, userName, user }) {
  const navigate = useNavigate();
  const [cardEv, setCardEv] = useState(null);

  const isAdmin = user && (['SUPER_ADMIN', 'DIRECTOR'].includes(user.role) || !!user.is_truong_phong || !!user.is_phan_lich_all);

  const todayEvs    = dash?.today_events    || [];
  const tomorrowEvs = dash?.tomorrow_events || [];
  const planned     = events.filter(e => e.status === 'planned');
  const topObs      = lockedObs;
  const topViols    = violations;

  const openCard = (ev) => {
    const full = events.find(e => e.id === ev.id) || ev;
    setCardEv(full);
  };

  const T = {
    name: { fontWeight:600, color:'#e0e0ee', fontSize:'0.83rem', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
    sub:  { fontSize:'0.82rem', color:'#7878a0', margin:'1px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {cardEv && <DashEventCard ev={cardEv} onClose={() => setCardEv(null)} />}

      {myObs.length > 0 && <PendingReportsSection obs={myObs} />}

      {((['SUPER_ADMIN','DIRECTOR'].includes(user?.role)) || !!user?.is_phan_lich_all || !!user?.is_giam_doc) && <StaffSummarySection />}

      {userName && <UpcomingScheduleSection userName={userName} userId={user?.id} />}

      {/* Vận hành hôm nay */}
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

      {/* Vận hành ngày mai */}
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

      {/* Đang lên kế hoạch */}
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

      {/* Tổng quan vi phạm (chỉ admin) */}
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

      {dash?.overdue?.length > 0 && <OverdueSection items={dash.overdue} />}
    </div>
  );
}
