import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { GOLD } from './dashShared';
import { useStaffGroups } from '../../contexts/StaffGroupsContext';

const ROLE_TO_KM_DEPT_DASH = {
  ATAS: 'ATAS-LED', STAGE: 'Sân Khấu', TECHNICAL: 'Kỹ Thuật',
  CSVC: 'Cơ Sở Vật Chất', ACCOUNTING: 'Kế Toán', PRODUCTION: 'Kinh Doanh',
};

function toMD(t) { if (!t) return null; const [h, m] = t.split(':').map(Number); return isNaN(h) ? null : h * 60 + m; }

function calcCongDash(r) {
  if (!r.confirmed_at) return null;
  const s = toMD(r.time_present), e = toMD(r.time_end);
  if (s === null || e === null) return null;
  const isOvernight = e < s;
  let diff = e - s; if (diff < 0) diff += 1440;
  const isAft = s >= 780; // 13:00 = 780 phút
  const isSun = new Date(r.report_date + 'T00:00:00').getDay() === 0;
  const isHol = !!r.is_holiday;
  const skipAft = r.no_afternoon_break || (!isOvernight && e <= 17 * 60 + 30);
  const effMins = isAft ? diff : diff - (r.no_lunch_break ? 0 : 60) - (skipAft ? 0 : 90);
  const thresh = isAft ? 270 : 480; // ca chiều 13:00-17:30 = 4.5h = 270 min
  const congRate = isAft ? ((isSun || isHol) ? 1 : 0.5) : isHol ? 2 : isSun ? 1.5 : 1;
  return { congRate, otHours: Math.max(0, effMins - thresh) / 60 };
}

function fmtNumD(n) { return n % 1 === 0 ? String(n) : parseFloat(n.toFixed(2)).toString(); }

export default function CongDashWidget({ user }) {
  const { kmGroupsRaw: kmStaffGroups } = useStaffGroups();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [phaseDateMap, setPhaseDateMap] = useState({});
  const [leaveMap, setLeaveMap] = useState({});
  const [phatNQByName, setPhatNQByName] = useState({});
  // 15 ngày đầu tháng mới vẫn hiện dữ liệu tháng trước
  const currentMonth = (() => {
    const vnStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    let [y, m, d] = vnStr.split('-').map(Number);
    if (d <= 15) { m -= 1; if (m === 0) { m = 12; y -= 1; } }
    return `${y}-${String(m).padStart(2, '0')}`;
  })();

  useEffect(() => {
    api.getXacNhanCong(currentMonth).then(res => {
      setData(res.reports || res);
      setPhaseDateMap(res.phaseDateMap || {});
      setLeaveMap(res.leaveConLaiByName || {});
      setPhatNQByName(res.phatNQByName || {});
    }).catch(() => {});
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
      const paOv = r.per_person_allowances?.[name]?.cong_override;
      const effCong = (paOv != null && paOv !== '') ? Number(paOv) : res.congRate;
      totalCong += effCong;
      totalOT += res.otHours;
    }
  }

  const [yy, mm] = currentMonth.split('-');
  const label = `Tháng ${parseInt(mm, 10)}/${yy}`;
  const mmInt = parseInt(mm, 10);
  const myLeave = leaveMap[myName] || null;
  const phepNamNet = myLeave?.tichLuy != null ? myLeave.tichLuy - (myLeave.daNghi ?? 0) : null;

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
      if (!personSummary[name]) personSummary[name] = { cong: 0, ot: 0, buoi: 0, leader: 0, phatNQManual: 0 };
      const paOv2 = r.per_person_allowances?.[name]?.cong_override;
      personSummary[name].cong += (paOv2 != null && paOv2 !== '') ? Number(paOv2) : res.congRate;
      personSummary[name].ot  += res.otHours;
      personSummary[name].buoi++;
      personSummary[name].phatNQManual += parseInt(r.per_person_allowances?.[name]?.phat_noi_quy || 0, 10) || 0;
      const isLeader = (() => {
        if (!(r.leaders || []).includes(name)) return false;
        const phase = phaseDateMap[`${r.event_id}::${r.report_date}`];
        if (myDept === 'Sân Khấu') return phase === 'setup' || phase === 'rehearsal';
        if (myDept === 'ATAS-LED' || myDept === 'Kỹ Thuật') return phase === 'filming';
        return false;
      })();
      personSummary[name].leader += isLeader ? 1 : 0;
    }
  }
  const personRows = Object.entries(personSummary).sort((a, b) => b[1].cong - a[1].cong);

  const thS = { padding: '5px 6px', fontSize: '0.62rem', fontWeight: 700, color: '#7878a0', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap', textAlign: 'center' };
  const tdS = { padding: '6px 6px', fontSize: '0.80rem', color: '#ddddf0', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' };

  return (
    <div style={{ borderRadius: '10px', border: '1px solid rgba(201,168,76,0.25)', background: 'rgba(201,168,76,0.04)', overflow: 'hidden' }}>
      <div style={{ padding: '9px 14px', background: 'linear-gradient(135deg,rgba(201,168,76,0.12) 0%,rgba(201,168,76,0.02) 100%)', borderLeft: '3px solid #c9a84c', borderBottom: '1px solid rgba(201,168,76,0.14)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, color: GOLD, fontSize: '0.84rem', flex: 1, letterSpacing: '0.04em' }}>
            {isTruong ? `CÔNG BỘ PHẬN — ${label}` : `CÔNG CỦA TÔI — ${label}`}
          </span>
          <span onClick={() => navigate('/xac-nhan-cong')} style={{ fontSize: '0.82rem', color: '#7878a0', cursor: 'pointer', flexShrink: 0 }}>Xem chi tiết →</span>
        </div>
        {isTruong && (
          <div style={{ fontSize: '0.74rem', color: '#7878a0', marginTop: '3px' }}>
            {memberSet.size} người · <span style={{ color: GOLD, fontWeight: 700 }}>{fmtNumD(totalCong)}</span> công{totalOT > 0 ? <> · <span style={{ color: '#60a5fa', fontWeight: 700 }}>+{fmtNumD(totalOT)}h</span> OT</> : ''}
          </div>
        )}
      </div>

      {personRows.length === 0 ? (
        <div style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#7878a0' }}>Chưa có dữ liệu tháng này</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col />
            <col style={{ width: '72px' }} />
            <col style={{ width: '64px' }} />
            <col style={{ width: '48px' }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
              <th style={{ ...thS, textAlign: 'left' }}>Họ Tên</th>
              <th style={thS}>Công</th>
              <th style={thS}>OT</th>
              <th style={thS}>NT</th>
            </tr>
          </thead>
          <tbody>
            {personRows.map(([name, { cong, ot, leader, phatNQManual }]) => {
              const phatNQ = (phatNQByName[name] || 0) + (phatNQManual || 0);
              return [
                <tr key={name} onClick={() => navigate('/xac-nhan-cong')} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ ...tdS, fontWeight: 600, color: '#eeeef5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</td>
                  <td style={{ ...tdS, textAlign: 'center', fontWeight: 700, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{fmtNumD(cong)}</td>
                  <td style={{ ...tdS, textAlign: 'center', fontWeight: 700, color: ot > 0 ? '#60a5fa' : '#7878a0', fontVariantNumeric: 'tabular-nums' }}>{ot > 0 ? `${fmtNumD(ot)}h` : '—'}</td>
                  <td style={{ ...tdS, textAlign: 'center', fontWeight: 700, color: leader > 0 ? GOLD : '#555570', fontVariantNumeric: 'tabular-nums' }}>{leader > 0 ? leader : '—'}</td>
                </tr>,
                phatNQ > 0 && (
                  <tr key={`${name}-phat`} onClick={() => navigate('/xac-nhan-cong')} style={{ cursor: 'pointer', background: 'rgba(229,62,62,0.06)' }}>
                    <td colSpan={4} style={{ padding: '3px 8px 4px', borderBottom: '1px solid rgba(229,62,62,0.12)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(229,62,62,0.2)', color: '#fc8181', border: '1px solid rgba(229,62,62,0.4)', flexShrink: 0 }}>Phạt</span>
                        <span style={{ fontSize: '0.73rem', fontWeight: 700, color: '#fc8181', fontVariantNumeric: 'tabular-nums' }}>{phatNQ.toLocaleString('vi-VN')}đ</span>
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      )}
      {phepNamNet != null && (
        <div style={{ display: 'flex', gap: '6px', padding: '7px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.76rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#7878a0' }}>Phép Năm:</span>
          <span style={{ color: '#ddddf0', fontWeight: 700 }}>{phepNamNet}</span>
          <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 2px' }}>·</span>
          <span style={{ color: '#7878a0' }}>T.{mmInt}:</span>
          <span style={{ color: '#ddddf0', fontWeight: 700 }}>{myLeave.nghiThang ?? 0}</span>
          <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 2px' }}>·</span>
          <span style={{ color: '#7878a0' }}>Còn Lại:</span>
          <span style={{ color: myLeave.conLai < 0 ? '#f87171' : myLeave.conLai === 0 ? '#9898b0' : '#4ade80', fontWeight: 700 }}>{myLeave.conLai}</span>
        </div>
      )}
    </div>
  );
}
