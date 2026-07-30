import { fmtD } from '../../utils/fmt';

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function dayLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAY_NAMES[d.getDay()]}, ${fmtD(dateStr)}`;
}

function NameList({ names, color }) {
  const safeNames = names.filter(n => typeof n === 'string' && n);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
      {safeNames.map((n, i) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderBottom: i < names.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: color, flexShrink: 0, opacity: 0.7 }} />
          <span style={{ fontSize: '0.83rem', color: '#ddddf0', fontWeight: 500 }}>{n}</span>
        </div>
      ))}
    </div>
  );
}

function EventStaffCard({ ev, color, date }) {
  const kmStaff     = ev.km_staff    || [];
  const freelancers = ev.freelancers || [];
  const total = kmStaff.length + freelancers.length;

  return (
    <div style={{
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(255,255,255,0.025)',
      marginBottom: '8px',
      overflow: 'hidden',
    }}>
      {/* Header sự kiện — tên màu vàng */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 5px ${color}88` }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#e8c97a', fontSize: '0.90rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
            <div style={{ fontSize: '0.70rem', color: '#7878a0', marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '0 6px' }}>
              {date && <span>{fmtD(date)}</span>}
              {typeof ev.start_time === 'string' && ev.start_time && <span>🕐 {ev.start_time}</span>}
              {typeof ev.location === 'string' && ev.location && <span>📍 {ev.location}</span>}
              {typeof ev.client === 'string' && ev.client && <span>👤 {ev.client}</span>}
            </div>
          </div>
        </div>
        {total > 0 && (
          <span style={{ fontSize: '0.75rem', color: '#7878a0', flexShrink: 0, marginLeft: '12px' }}>{total} người</span>
        )}
      </div>

      {total === 0 ? (
        <div style={{ padding: '10px 14px', fontSize: '0.80rem', color: '#555570' }}>Chưa có nhân sự được phân lịch</div>
      ) : (
        <div style={{ padding: '10px 14px' }}>
          {kmStaff.length > 0 && (
            <div style={{ marginBottom: freelancers.length > 0 ? '12px' : 0 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#5b8bb5', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Khôi Minh · {kmStaff.length}
              </div>
              <NameList names={kmStaff} color="#93c5fd" />
            </div>
          )}
          {freelancers.length > 0 && (
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7c6fa0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Freelancer · {freelancers.length}
              </div>
              <NameList names={freelancers} color="#c4b5fd" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DaySection({ title, date, events, color }) {
  const totalPeople = events.reduce((s, ev) => s + (ev.km_staff?.length || 0) + (ev.freelancers?.length || 0), 0);
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', padding: '8px 0 6px', borderBottom: `1px solid ${color}22` }}>
        <div style={{ width: 3, height: 22, borderRadius: 2, background: color, flexShrink: 0 }} />
        <span style={{ fontWeight: 800, color, fontSize: '0.86rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {title}
        </span>
        <span style={{ fontSize: '0.78rem', color: '#7878a0' }}>— {dayLabel(date)}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#555570' }}>
          {events.length} sự kiện · {totalPeople} người
        </span>
      </div>
      {events.map(ev => <EventStaffCard key={ev.id} ev={ev} color={color} date={date} />)}
    </div>
  );
}

export default function StaffTodayWidget({ dash }) {
  const today    = dash?.today    || '';
  const tomorrow = dash?.tomorrow || '';
  const todayEvs    = dash?.today_events_staff    || [];
  const tomorrowEvs = dash?.tomorrow_events_staff || [];

  if (todayEvs.length === 0 && tomorrowEvs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px', color: '#7878a0', fontSize: '0.88rem' }}>
        Không có sự kiện nào hôm nay và ngày mai
      </div>
    );
  }

  return (
    <div>
      {todayEvs.length > 0 && (
        <DaySection title="Hôm Nay" date={today} events={todayEvs} color="#f87171" />
      )}
      {tomorrowEvs.length > 0 && (
        <DaySection title="Ngày Mai" date={tomorrow} events={tomorrowEvs} color="#4ade80" />
      )}
    </div>
  );
}
