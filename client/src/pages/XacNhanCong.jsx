import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useStaffGroups } from '../contexts/StaffGroupsContext';

const GOLD = '#c9a84c';

function toM(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return isNaN(h) || isNaN(m) ? null : h * 60 + m;
}

function calcKmMins(r) {
  const startM = toM(r.time_present), endM = toM(r.time_end);
  if (startM === null || endM === null) return null;
  const onsetM = toM(r.time_onset), offM = toM(r.time_off);
  const crossNight = onsetM !== null && offM !== null && offM < onsetM;
  let diff = endM - startM;
  if (diff < 0) diff += 24 * 60;
  else if (crossNight) diff += 24 * 60;
  return diff;
}

function calcCong(r) {
  const kmMins = calcKmMins(r);
  if (kmMins === null) return null;
  const effectiveMins = kmMins - (r.no_lunch_break ? 0 : 60);
  const effectiveHours = Math.max(0, effectiveMins) / 60;
  const isSunday = new Date(r.report_date + 'T00:00:00').getDay() === 0;
  const isHoliday = !!r.is_holiday;
  let congRate = 1;
  if (isHoliday) congRate = 2;
  else if (isSunday) congRate = 1.5;
  const otHours = Math.max(0, effectiveHours - 8);
  return { kmMins, effectiveMins, effectiveHours, congRate, otHours, isSunday, isHoliday };
}

function fmtMins(mins) {
  if (mins === null || mins === undefined) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

function fmtNum(n) {
  if (n === null || n === undefined) return '—';
  return n % 1 === 0 ? String(n) : parseFloat(n.toFixed(2)).toString();
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}`;
}

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
function dayLabel(dateStr) {
  if (!dateStr) return '';
  return DAY_NAMES[new Date(dateStr + 'T00:00:00').getDay()] || '';
}

function fmtMonth(ym) {
  const [y, m] = ym.split('-');
  return `Tháng ${parseInt(m, 10)}/${y}`;
}

function todayMonth() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' })
    .format(new Date()).slice(0, 7);
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Build map: personName → [{ report, result }]
function buildPersonMap(reports) {
  const map = {};
  for (const r of reports) {
    const staff = Array.isArray(r.km_staff) ? r.km_staff : [];
    const result = calcCong(r);
    for (const name of staff) {
      if (!map[name]) map[name] = [];
      map[name].push({ report: r, result });
    }
  }
  return map;
}

// Aggregate totals for a person
function personTotals(entries) {
  let cong = 0, ot = 0;
  for (const { result } of entries) {
    if (result) { cong += result.congRate; ot += result.otHours; }
  }
  return { cong, ot };
}

export default function XacNhanCong() {
  const { user } = useAuth();
  const { kmGroups } = useStaffGroups();
  const canEdit = ['DIRECTOR', 'SUPER_ADMIN'].includes(user?.role) || !!user?.is_phan_lich_all;

  const [month, setMonth]       = useState(todayMonth);
  const [reports, setReports]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [filterName, setFilter] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [toggling, setToggling] = useState(new Set());

  const load = useCallback(async (m) => {
    setLoading(true); setError('');
    try { setReports(await api.getXacNhanCong(m)); }
    catch (e) { setError(e.message || 'Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  function toggleExpand(name) {
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(name) ? s.delete(name) : s.add(name);
      return s;
    });
  }

  async function toggleHoliday(reportId, current) {
    if (toggling.has(reportId)) return;
    setToggling(prev => new Set([...prev, reportId]));
    try {
      await api.setReportHoliday(reportId, !current);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, is_holiday: current ? 0 : 1 } : r));
    } catch (e) {
      alert('Lỗi: ' + (e.message || 'Không thể cập nhật'));
    } finally {
      setToggling(prev => { const s = new Set(prev); s.delete(reportId); return s; });
    }
  }

  const personMap = buildPersonMap(reports);

  const lowerFilter = filterName.trim().toLowerCase();

  // Department totals for the month
  const grandCong = Object.values(personMap).flat().reduce((s, { result }) => s + (result?.congRate || 0), 0);
  const grandOT   = Object.values(personMap).flat().reduce((s, { result }) => s + (result?.otHours || 0), 0);

  const thBase = { padding: '7px 12px', fontSize: '0.72rem', fontWeight: 700, color: '#7878a0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' };
  const tdBase = { padding: '8px 12px', fontSize: '0.83rem', color: '#ddddf0', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' };

  return (
    <div style={{ padding: '16px', maxWidth: '960px', margin: '0 auto' }}>
      {/* Title */}
      <div style={{ marginBottom: '18px' }}>
        <h1 style={{ color: GOLD, fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 3px' }}>
          Bảng Xác Nhận Công
        </h1>
        <p style={{ color: '#7878a0', fontSize: '0.76rem', margin: 0 }}>Tổng hợp ngày công &amp; OT nhân sự Khôi Minh theo tháng</p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '2px' }}>
          <button onClick={() => setMonth(m => shiftMonth(m, -1))}
            style={{ padding: '6px 13px', border: 'none', background: 'transparent', color: '#c8c8e0', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, borderRadius: '6px' }}>‹</button>
          <span style={{ padding: '6px 10px', color: GOLD, fontWeight: 700, fontSize: '0.88rem', minWidth: '120px', textAlign: 'center' }}>{fmtMonth(month)}</span>
          <button onClick={() => setMonth(m => shiftMonth(m, 1))}
            style={{ padding: '6px 13px', border: 'none', background: 'transparent', color: '#c8c8e0', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, borderRadius: '6px' }}>›</button>
        </div>

        {/* Search */}
        <input type="text" placeholder="Tìm theo tên..." value={filterName} onChange={e => setFilter(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#eeeef5', fontSize: '0.83rem', width: '180px', outline: 'none' }} />

        {loading && <span style={{ color: '#7878a0', fontSize: '0.82rem' }}>⏳ Đang tải...</span>}
        {error   && <span style={{ color: '#f87171', fontSize: '0.82rem' }}>⚠ {error}</span>}

        {/* Grand totals */}
        {!loading && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', padding: '6px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.68rem', color: '#a08040', margin: '0 0 1px', textTransform: 'uppercase' }}>Tổng Công</p>
              <p style={{ fontSize: '1rem', fontWeight: 800, color: GOLD, margin: 0 }}>{fmtNum(grandCong)}</p>
            </div>
            <div style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '8px', padding: '6px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.68rem', color: '#4a7fcb', margin: '0 0 1px', textTransform: 'uppercase' }}>Tổng OT</p>
              <p style={{ fontSize: '1rem', fontWeight: 800, color: '#60a5fa', margin: 0 }}>{fmtNum(grandOT)}h</p>
            </div>
          </div>
        )}
      </div>

      {/* Department sections */}
      {kmGroups.map(({ dept, members }) => {
        // Filter by search (dept matches OR any member matches)
        const filteredMembers = lowerFilter
          ? members.filter(n => n.toLowerCase().includes(lowerFilter))
          : members;
        if (filteredMembers.length === 0) return null;

        // Dept totals
        let deptCong = 0, deptOT = 0;
        for (const name of members) {
          const { cong, ot } = personTotals(personMap[name] || []);
          deptCong += cong; deptOT += ot;
        }

        return (
          <div key={dept} style={{ marginBottom: '20px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
            {/* Dept header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: 'rgba(201,168,76,0.07)', borderBottom: '1px solid rgba(201,168,76,0.14)' }}>
              <span style={{ fontWeight: 800, color: GOLD, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{dept}</span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontSize: '0.78rem', color: '#7878a0' }}>{members.length} người</span>
                {deptCong > 0 && <span style={{ fontSize: '0.78rem', fontWeight: 700, color: GOLD }}>{fmtNum(deptCong)} công</span>}
                {deptOT   > 0 && <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa' }}>+{fmtNum(deptOT)}h OT</span>}
              </div>
            </div>

            {/* Summary table */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
                  <th style={{ ...thBase, width: '40%' }}>Tên Nhân Viên</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>Ngày Công</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>OT (giờ)</th>
                  <th style={{ ...thBase, textAlign: 'center', width: '60px' }}>Chi Tiết</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map(name => {
                  const entries = personMap[name] || [];
                  const { cong, ot } = personTotals(entries);
                  const isExp = expanded.has(name);
                  const hasData = entries.length > 0;

                  return (
                    <>
                      {/* Person summary row */}
                      <tr key={name}
                        onClick={() => hasData && toggleExpand(name)}
                        style={{ cursor: hasData ? 'pointer' : 'default', background: isExp ? 'rgba(201,168,76,0.04)' : undefined, transition: 'background 0.15s' }}>
                        <td style={tdBase}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {hasData
                              ? (isExp ? <ChevronDown size={13} color={GOLD} /> : <ChevronRight size={13} color="#7878a0" />)
                              : <span style={{ width: 13 }} />}
                            <span style={{ fontWeight: hasData ? 600 : 400, color: hasData ? '#eeeef5' : '#7878a0' }}>{name}</span>
                          </div>
                        </td>
                        <td style={{ ...tdBase, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: cong > 0 ? GOLD : '#7878a0' }}>
                          {cong > 0 ? fmtNum(cong) : '—'}
                        </td>
                        <td style={{ ...tdBase, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: ot > 0 ? '#60a5fa' : '#7878a0' }}>
                          {ot > 0 ? fmtNum(ot) + 'h' : '—'}
                        </td>
                        <td style={{ ...tdBase, textAlign: 'center', color: '#7878a0', fontSize: '0.75rem' }}>
                          {hasData ? `${entries.length} buổi` : '—'}
                        </td>
                      </tr>

                      {/* Expanded detail rows */}
                      {isExp && entries.map(({ report: r, result }) => {
                        const isHol = !!r.is_holiday;
                        const isSun = result?.isSunday;
                        const togBusy = toggling.has(r.id);
                        const dayTag = dayLabel(r.report_date);
                        return (
                          <tr key={`${name}-${r.id}`} style={{ background: isHol ? 'rgba(248,113,113,0.03)' : isSun ? 'rgba(96,165,250,0.03)' : 'rgba(255,255,255,0.015)' }}>
                            <td style={{ ...tdBase, paddingLeft: '36px' }}>
                              <span style={{ fontVariantNumeric: 'tabular-nums', color: '#c8c8e0', fontSize: '0.8rem' }}>{fmtDate(r.report_date)}</span>
                              <span style={{
                                marginLeft: '5px', fontSize: '0.68rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px',
                                background: isSun ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)',
                                color: isSun ? '#60a5fa' : '#7878a0',
                              }}>{dayTag}</span>
                              <span style={{ marginLeft: '8px', fontSize: '0.78rem', color: '#7878a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px', display: 'inline-block', verticalAlign: 'middle' }}>
                                {r.event_label || '—'}
                              </span>
                            </td>
                            <td style={{ ...tdBase, textAlign: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span style={{ fontSize: '0.8rem', color: GOLD, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                  {result ? fmtNum(result.congRate) : '—'}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: '#7878a0' }}>
                                  {result ? fmtMins(result.kmMins) : ''}
                                  {r.no_lunch_break ? ' · KN Trưa' : ''}
                                </span>
                              </div>
                            </td>
                            <td style={{ ...tdBase, textAlign: 'center', fontSize: '0.8rem', color: result?.otHours > 0 ? '#60a5fa' : '#7878a0', fontVariantNumeric: 'tabular-nums' }}>
                              {result?.otHours > 0 ? fmtNum(result.otHours) + 'h' : '—'}
                            </td>
                            <td style={{ ...tdBase, textAlign: 'center' }}>
                              {canEdit ? (
                                <button disabled={togBusy}
                                  onClick={e => { e.stopPropagation(); toggleHoliday(r.id, isHol); }}
                                  style={{
                                    padding: '2px 9px', borderRadius: '5px', border: 'none', cursor: togBusy ? 'wait' : 'pointer',
                                    fontSize: '0.72rem', fontWeight: 700,
                                    background: isHol ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.05)',
                                    color: isHol ? '#f87171' : '#7878a0',
                                  }}>
                                  {isHol ? 'Lễ ✕' : 'Lễ'}
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.72rem', color: isHol ? '#f87171' : '#7878a0' }}>{isHol ? 'Lễ' : '—'}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {kmGroups.length === 0 && !loading && (
        <p style={{ color: '#7878a0', textAlign: 'center', padding: '40px 0' }}>Không có dữ liệu nhân sự.</p>
      )}
    </div>
  );
}
