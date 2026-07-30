import { fmtD } from '../../utils/fmt';

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function dayLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAY_NAMES[d.getDay()]}, ${fmtD(dateStr)}`;
}

function NameChip({ name, variant }) {
  const isKm = variant === 'km';
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: '20px',
      fontSize: '0.78rem',
      fontWeight: 600,
      background: isKm ? 'rgba(96,165,250,0.12)' : 'rgba(167,139,250,0.10)',
      color: isKm ? '#93c5fd' : '#c4b5fd',
      border: `1px solid ${isKm ? 'rgba(96,165,250,0.25)' : 'rgba(167,139,250,0.22)'}`,
      whiteSpace: 'nowrap',
    }}>
      {name}
    </span>
  );
}

function EventStaffCard({ ev, color }) {
  const kmStaff    = ev.km_staff    || [];
  const freelancers = ev.freelancers || [];
  const total = kmStaff.length + freelancers.length;

  return (
    <div style={{
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(255,255,255,0.025)',
      padding: '12px 14px',
      marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: total > 0 ? '10px' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', minWidth: 0, flex: 1 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5, boxShadow: `0 0 5px ${color}88` }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#e0e0ee', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
            <div style={{ fontSize: '0.72rem', color: '#555570', marginTop: '2px' }}>{ev.code}{ev.client ? ` · ${ev.client}` : ''}</div>
          </div>
        </div>
        {total > 0 && (
          <span style={{ fontSize: '0.75rem', color: '#7878a0', flexShrink: 0, marginLeft: '12px', marginTop: '3px' }}>
            {total} người
          </span>
        )}
      </div>

      {kmStaff.length > 0 && (
        <div style={{ marginBottom: freelancers.length > 0 ? '8px' : 0 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#5b8bb5', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>
            Khôi Minh · {kmStaff.length} người
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {kmStaff.map(n => <NameChip key={n} name={n} variant="km" />)}
          </div>
        </div>
      )}

      {freelancers.length > 0 && (
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7c6fa0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>
            Freelancer · {freelancers.length} người
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {freelancers.map(n => <NameChip key={n} name={n} variant="free" />)}
          </div>
        </div>
      )}

      {total === 0 && (
        <div style={{ fontSize: '0.80rem', color: '#555570', paddingLeft: '14px' }}>
          Chưa có nhân sự được phân lịch
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
      {events.map(ev => <EventStaffCard key={ev.id} ev={ev} color={color} />)}
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
