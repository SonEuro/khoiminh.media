import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

const GOLD = '#c9a84c';

// Parse "HH:MM" → minutes-since-midnight, or null
function toM(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return isNaN(h) || isNaN(m) ? null : h * 60 + m;
}

// Returns total KM minutes (with midnight-crossing support)
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

function fmtMins(mins) {
  if (mins === null) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

function fmtNum(n, dec = 2) {
  if (n === null || n === undefined) return '—';
  return n % 1 === 0 ? String(n) : n.toFixed(dec).replace(/\.?0+$/, '');
}

// Compute công and OT for a single report entry
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

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function dayLabel(dateStr) {
  if (!dateStr) return '';
  return DAY_NAMES[new Date(dateStr + 'T00:00:00').getDay()] || '';
}

// VN month label
function fmtMonth(ym) {
  const [y, m] = ym.split('-');
  return `Tháng ${parseInt(m, 10)}/${y}`;
}

// Get YYYY-MM for today in VN timezone
function todayMonth() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' })
    .format(new Date()).slice(0, 7);
}

function prevMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Expand reports → one row per (person, report)
function buildRows(reports) {
  const rows = [];
  for (const r of reports) {
    const staffList = Array.isArray(r.km_staff) ? r.km_staff : [];
    if (!staffList.length) continue;
    const result = calcCong(r);
    for (const name of staffList) {
      rows.push({ name, report: r, result });
    }
  }
  return rows;
}

// Group rows by person name, sorted alphabetically
function groupByPerson(rows) {
  const map = {};
  for (const row of rows) {
    if (!map[row.name]) map[row.name] = [];
    map[row.name].push(row);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'vi'));
}

export default function XacNhanCong() {
  const { user } = useAuth();
  const isFullAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  const canEdit = isFullAdmin || !!user?.is_phan_lich_all;

  const [month, setMonth] = useState(todayMonth);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(new Set());
  const [filterName, setFilterName] = useState('');

  const load = useCallback(async (m) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getXacNhanCong(m);
      setReports(data);
    } catch (e) {
      setError(e.message || 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(month); }, [month, load]);

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

  const allRows = buildRows(reports);
  const filteredRows = filterName.trim()
    ? allRows.filter(r => r.name.toLowerCase().includes(filterName.toLowerCase()))
    : allRows;
  const groups = groupByPerson(filteredRows);

  // Summary totals per person
  const personTotals = groups.map(([name, rows]) => {
    let totalCong = 0, totalOT = 0;
    for (const { result } of rows) {
      if (result) { totalCong += result.congRate; totalOT += result.otHours; }
    }
    return { name, totalCong, totalOT, count: rows.length };
  });

  const grandCong = personTotals.reduce((s, p) => s + p.totalCong, 0);
  const grandOT   = personTotals.reduce((s, p) => s + p.totalOT,   0);

  const thStyle = { padding: '7px 10px', textAlign: 'left', fontSize: '0.73rem', fontWeight: 700, color: '#7878a0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '7px 10px', fontSize: '0.82rem', color: '#ddddf0', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' };

  return (
    <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ color: GOLD, fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>
          Bảng Xác Nhận Công
        </h1>
        <p style={{ color: '#7878a0', fontSize: '0.78rem', margin: 0 }}>
          Tổng hợp giờ làm và công cho nhân sự Khôi Minh theo tháng
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '2px' }}>
          <button onClick={() => setMonth(prevMonth(month))}
            style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#c8c8e0', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700 }}>‹</button>
          <span style={{ padding: '6px 10px', color: GOLD, fontWeight: 700, fontSize: '0.88rem', minWidth: '120px', textAlign: 'center' }}>
            {fmtMonth(month)}
          </span>
          <button onClick={() => setMonth(nextMonth(month))}
            style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#c8c8e0', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700 }}>›</button>
        </div>

        {/* Name filter */}
        <input
          type="text" placeholder="Lọc theo tên..."
          value={filterName} onChange={e => setFilterName(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#eeeef5', fontSize: '0.83rem', width: '180px', outline: 'none' }} />

        {loading && <span style={{ color: '#7878a0', fontSize: '0.82rem' }}>⏳ Đang tải...</span>}
        {error && <span style={{ color: '#f87171', fontSize: '0.82rem' }}>⚠ {error}</span>}
      </div>

      {/* Summary totals strip */}
      {!loading && reports.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', padding: '10px 18px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.72rem', color: '#a08040', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tổng Công</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: GOLD, margin: 0 }}>{fmtNum(grandCong)}</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 18px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.72rem', color: '#7878a0', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tổng OT</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#60a5fa', margin: 0 }}>{fmtNum(grandOT)}h</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 18px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.72rem', color: '#7878a0', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nhân Sự</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#eeeef5', margin: 0 }}>{groups.length}</p>
          </div>
        </div>
      )}

      {/* No data */}
      {!loading && reports.length === 0 && !error && (
        <div style={{ textAlign: 'center', color: '#7878a0', padding: '60px 20px', fontSize: '0.9rem' }}>
          Không có báo cáo nào trong {fmtMonth(month)}
        </div>
      )}

      {/* Per-person sections */}
      {groups.map(([name, rows]) => {
        const { totalCong, totalOT } = personTotals.find(p => p.name === name) || {};
        return (
          <div key={name} style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Person header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(201,168,76,0.06)', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
              <span style={{ fontWeight: 700, color: '#eeeef5', fontSize: '0.88rem' }}>{name}</span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: '#7878a0' }}>{rows.length} buổi</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: GOLD }}>
                  {fmtNum(totalCong)} công
                </span>
                {totalOT > 0 && (
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#60a5fa' }}>
                    +{fmtNum(totalOT)}h OT
                  </span>
                )}
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Ngày</th>
                    <th style={thStyle}>Sự Kiện</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Có Mặt</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Kết Thúc</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Giờ KM</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Nghỉ Trưa</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Nghỉ Chiều</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Ngày Lễ</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Giờ Thực</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Công</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>OT (h)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ report: r, result }) => {
                    const isHol = !!r.is_holiday;
                    const isSun = result?.isSunday;
                    const dayTag = dayLabel(r.report_date);
                    const togBusy = toggling.has(r.id);
                    return (
                      <tr key={`${r.id}`} style={{ background: isHol ? 'rgba(248,113,113,0.04)' : isSun ? 'rgba(96,165,250,0.04)' : undefined }}>
                        {/* Date */}
                        <td style={tdStyle}>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDate(r.report_date)}</span>
                          <span style={{
                            marginLeft: '5px', fontSize: '0.70rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px',
                            background: isSun ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)',
                            color: isSun ? '#60a5fa' : '#7878a0',
                          }}>{dayTag}</span>
                        </td>

                        {/* Event */}
                        <td style={{ ...tdStyle, maxWidth: '200px' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '200px' }}>
                            {r.event_label || '—'}
                          </span>
                        </td>

                        {/* Times */}
                        <td style={{ ...tdStyle, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{r.time_present || '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{r.time_end || '—'}</td>

                        {/* KM hours */}
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
                          {result ? fmtMins(result.kmMins) : '—'}
                        </td>

                        {/* Break flags */}
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {r.no_lunch_break ? <span style={{ color: '#f87171', fontWeight: 700, fontSize: '0.78rem' }}>✕</span> : <span style={{ color: '#4ade80', fontSize: '0.78rem' }}>✓</span>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {r.no_afternoon_break ? <span style={{ color: '#f87171', fontWeight: 700, fontSize: '0.78rem' }}>✕</span> : <span style={{ color: '#4ade80', fontSize: '0.78rem' }}>✓</span>}
                        </td>

                        {/* Holiday toggle */}
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {canEdit ? (
                            <button
                              disabled={togBusy}
                              onClick={() => toggleHoliday(r.id, isHol)}
                              style={{
                                padding: '2px 8px', borderRadius: '5px', border: 'none', cursor: togBusy ? 'wait' : 'pointer',
                                fontSize: '0.75rem', fontWeight: 700,
                                background: isHol ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.05)',
                                color: isHol ? '#f87171' : '#7878a0',
                              }}>
                              {isHol ? 'Có' : 'Không'}
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: isHol ? '#f87171' : '#7878a0' }}>{isHol ? 'Có' : '—'}</span>
                          )}
                        </td>

                        {/* Effective hours */}
                        <td style={{ ...tdStyle, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                          {result ? fmtMins(Math.max(0, result.effectiveMins)) : '—'}
                        </td>

                        {/* Công */}
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: isHol ? '#f87171' : isSun ? '#60a5fa' : GOLD }}>
                          {result ? fmtNum(result.congRate) : '—'}
                        </td>

                        {/* OT */}
                        <td style={{ ...tdStyle, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: result?.otHours > 0 ? '#60a5fa' : '#7878a0' }}>
                          {result ? (result.otHours > 0 ? fmtNum(result.otHours) : '—') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Person total row */}
                <tfoot>
                  <tr style={{ background: 'rgba(201,168,76,0.05)', borderTop: '1px solid rgba(201,168,76,0.15)' }}>
                    <td colSpan={9} style={{ ...tdStyle, fontWeight: 700, color: '#a08040', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Tổng · {rows.length} buổi
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: GOLD, fontSize: '0.92rem' }}>{fmtNum(totalCong)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: totalOT > 0 ? '#60a5fa' : '#7878a0', fontSize: '0.88rem' }}>
                      {totalOT > 0 ? fmtNum(totalOT) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}

      {/* Grand summary table at bottom */}
      {groups.length > 1 && !loading && (
        <div style={{ marginTop: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontWeight: 700, color: GOLD, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Tổng Kết · {fmtMonth(month)}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Nhân Sự</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Số Buổi</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Tổng Công</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Tổng OT (h)</th>
                </tr>
              </thead>
              <tbody>
                {personTotals.map(({ name, totalCong: tc, totalOT: tot, count }) => (
                  <tr key={name}>
                    <td style={tdStyle}>{name}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#7878a0' }}>{count}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: GOLD }}>{fmtNum(tc)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: tot > 0 ? '#60a5fa' : '#7878a0' }}>{tot > 0 ? fmtNum(tot) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(201,168,76,0.06)', borderTop: '1px solid rgba(201,168,76,0.15)' }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: GOLD }}>Tổng Cộng</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#7878a0' }}>{filteredRows.length} buổi</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: GOLD, fontSize: '0.92rem' }}>{fmtNum(grandCong)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: grandOT > 0 ? '#60a5fa' : '#7878a0' }}>{grandOT > 0 ? fmtNum(grandOT) : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
