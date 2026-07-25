import { useNavigate } from 'react-router-dom';
import { fmtD } from '../../utils/fmt';
import { AdminSec, ARow, PHASE_LABEL_MAP } from './dashShared';

export default function PendingReportsSection({ obs }) {
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
            <p style={{ fontSize: '0.82rem', color: '#a0a0c0', margin: '1px 0 0', fontWeight: 600 }}>{ob.lead_name}</p>
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
