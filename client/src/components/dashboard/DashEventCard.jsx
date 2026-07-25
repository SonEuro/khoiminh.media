import { useNavigate } from 'react-router-dom';
import { fmtD } from '../../utils/fmt';
import { GOLD } from './dashShared';

const EV_STATUS = {
  active:    { label: 'Đang diễn ra',      color: '#4ade80', bg: 'rgba(74,222,128,0.15)',  border: 'rgba(74,222,128,0.4)'  },
  planned:   { label: 'Đang lên kế hoạch', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  border: 'rgba(96,165,250,0.4)'  },
  completed: { label: 'Đã hoàn thành',     color: GOLD,      bg: 'rgba(201,168,76,0.15)',  border: 'rgba(201,168,76,0.4)'  },
};

export default function DashEventCard({ ev, onClose }) {
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
        <div style={{ padding:'12px 14px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap', marginBottom:'7px' }}>
            <span style={{ fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace", fontSize:'0.82rem', color:'#7878a0' }}>{ev.code}</span>
            <Pill color={s.color} bg={s.bg} border={s.border}>{s.label}</Pill>
            {isToday && <Pill color='#f87171' bg='rgba(248,113,113,0.15)' border='rgba(248,113,113,0.45)'>HÔM NAY</Pill>}
          </div>
          <h3 style={{ fontWeight:700, fontSize:'1.05rem', color:'#eeeef5', margin:0, lineHeight:1.35 }}>{ev.name}</h3>
        </div>
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
