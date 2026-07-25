import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { GOLD } from './dashShared';

const ROLE_TO_KM_DEPT_DASH = {
  ATAS: 'ATAS-LED', STAGE: 'Sân Khấu', TECHNICAL: 'Kỹ Thuật',
  CSVC: 'Cơ Sở Vật Chất', ACCOUNTING: 'Kế Toán', PRODUCTION: 'Kinh Doanh',
};

function toMD(t) { if (!t) return null; const [h, m] = t.split(':').map(Number); return isNaN(h) ? null : h * 60 + m; }

function calcCongDash(r) {
  if (!r.confirmed_at) return null;
  const s = toMD(r.time_present), e = toMD(r.time_end);
  if (s === null || e === null) return null;
  let diff = e - s; if (diff < 0) diff += 1440;
  const isAft = s >= 720;
  const isSun = new Date(r.report_date + 'T00:00:00').getDay() === 0;
  const isHol = !!r.is_holiday;
  const effMins = isAft ? diff : diff - (r.no_lunch_break ? 0 : 60) - (r.no_afternoon_break ? 0 : 60);
  const thresh = isAft ? 240 : 480;
  const congRate = isAft ? 0.5 : isHol ? 2 : isSun ? 1.5 : 1;
  return { congRate, otHours: Math.max(0, effMins - thresh) / 60 };
}

function fmtNumD(n) { return n % 1 === 0 ? String(n) : parseFloat(n.toFixed(2)).toString(); }

export default function CongDashWidget({ user, kmStaffGroups }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const currentMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);

  useEffect(() => {
    api.getXacNhanCong(currentMonth).then(res => setData(res.reports || res)).catch(() => {});
  }, [currentMonth]);

  if (!data) return null;

  const canViewAll = ['DIRECTOR', 'SUPER_ADMIN'].includes(user?.role) || !!user?.is_phan_lich_all;
  if (canViewAll) return null;

  const myName = user?.full_name || '';
  const myDept = kmStaffGroups?.find(g => g.members?.includes(myName))?.dept || ROLE_TO_KM_DEPT_DASH[user?.role];

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
