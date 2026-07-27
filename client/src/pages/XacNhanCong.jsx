import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useStaffGroups } from '../contexts/StaffGroupsContext';

const GOLD = '#c9a84c';

const ROLE_TO_KM_DEPT = {
  ATAS: 'ATAS-LED', STAGE: 'Sân Khấu', TECHNICAL: 'Kỹ Thuật',
  CSVC: 'Cơ Sở Vật Chất', ACCOUNTING: 'Kế Toán', PRODUCTION: 'Kinh Doanh',
};

function toM(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return isNaN(h) || isNaN(m) ? null : h * 60 + m;
}

function calcKmMins(r) {
  const startM = toM(r.time_present), endM = toM(r.time_end);
  if (startM === null || endM === null) return null;
  let diff = endM - startM;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function calcCong(r) {
  if (!r.confirmed_at) return null; // chưa xác nhận → không tính công
  const kmMins = calcKmMins(r);
  if (kmMins === null) return null;
  const startM = toM(r.time_present);
  const isAfternoon = startM !== null && startM >= 12 * 60; // bắt đầu từ 12:00 trở đi
  const isSunday = new Date(r.report_date + 'T00:00:00').getDay() === 0;
  const isHoliday = !!r.is_holiday;
  let effectiveMins, congRate, otThresholdMins;
  if (isAfternoon) {
    effectiveMins = kmMins; // không trừ nghỉ trưa (đã qua trưa)
    congRate = 0.5;
    otThresholdMins = 4 * 60;
  } else {
    const endM = toM(r.time_end);
    const skipAft = r.no_afternoon_break || (endM !== null && endM <= 17 * 60 + 30);
    effectiveMins = kmMins - (r.no_lunch_break ? 0 : 60) - (skipAft ? 0 : 90);
    congRate = isHoliday ? 2 : isSunday ? 1.5 : 1;
    otThresholdMins = 8 * 60;
  }
  const effectiveHours = Math.max(0, effectiveMins) / 60;
  const otMins = Math.max(0, effectiveMins - otThresholdMins);
  const otHours = otMins / 60;
  return { kmMins, effectiveMins, effectiveHours, congRate, otHours, otMins, isSunday, isHoliday, isAfternoon };
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
    const raw = Array.isArray(r.km_staff) ? r.km_staff : [];
    const staff = [...new Set(raw)]; // dedupe names within same report
    const result = calcCong(r);
    for (const name of staff) {
      if (!map[name]) map[name] = [];
      map[name].push({ report: r, result });
    }
  }
  return map;
}

// Aggregate totals for a person (each session counted independently)
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
  const canViewAll  = ['DIRECTOR', 'SUPER_ADMIN'].includes(user?.role) || !!user?.is_phan_lich_all;
  const canEdit     = canViewAll;
  const canToggleLe = user?.role === 'SUPER_ADMIN' || !!user?.is_phan_lich_all;
  const canSuaCong  = user?.role === 'SUPER_ADMIN' || !!user?.is_phan_lich_all;
  const isTruongPhong = !!user?.is_truong_phong && !canViewAll;

  // Tính bộ phận của user (cho truong_phong và nhân viên thường)
  const userDept = !canViewAll
    ? (kmGroups.find(g => g.members.includes(user?.full_name || ''))?.dept || ROLE_TO_KM_DEPT[user?.role] || null)
    : null;

  // Visible groups: admin = tất cả, truong_phong = chỉ bộ phận mình, nhân viên = chỉ tên mình
  const visibleGroups = canViewAll
    ? kmGroups
    : isTruongPhong
      ? kmGroups.filter(g => g.dept === userDept)
      : (() => {
          const myName = user?.full_name || '';
          if (!myName) return [];
          const myDept = kmGroups.find(g => g.members.includes(myName))?.dept || 'Của Tôi';
          return [{ dept: myDept, members: [myName] }];
        })();

  const [month, setMonth]           = useState(todayMonth);
  const [reports, setReports]       = useState([]);
  const [supportByDate, setSupportByDate] = useState({});
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [filterName, setFilter]     = useState('');
  const [expanded, setExpanded]     = useState(new Set());
  const [toggling, setToggling]     = useState(new Set());
  const [isMobile, setIsMobile]     = useState(() => window.innerWidth < 768);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editRowData, setEditRowData]   = useState({});
  const [savingRow, setSavingRow]       = useState(false);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const load = useCallback(async (m) => {
    setLoading(true); setError('');
    try {
      const data = await api.getXacNhanCong(m);
      setReports(data.reports || []);
      setSupportByDate(data.supportByDate || {});
    }
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

  function startEditRow(r) {
    setEditingRowId(r.id);
    setEditRowData({
      time_present: r.time_present || '',
      time_end: r.time_end || '',
      time_onset: r.time_onset || '',
      no_lunch_break: !!r.no_lunch_break,
      no_afternoon_break: !!r.no_afternoon_break,
      is_holiday: !!r.is_holiday,
    });
  }

  async function saveEditRow(r) {
    setSavingRow(true);
    try {
      const payload = {
        ...r,
        km_staff: Array.isArray(r.km_staff) ? r.km_staff : [],
        images: Array.isArray(r.images) ? r.images : [],
        timeline: Array.isArray(r.timeline) ? r.timeline : [],
        time_present: editRowData.time_present,
        time_end: editRowData.time_end,
        time_onset: editRowData.time_onset,
        no_lunch_break: editRowData.no_lunch_break ? 1 : 0,
        no_afternoon_break: editRowData.no_afternoon_break ? 1 : 0,
        is_holiday: editRowData.is_holiday ? 1 : 0,
      };
      await api.updateEventReport(r.id, payload);
      setReports(prev => prev.map(rep => rep.id === r.id
        ? { ...rep, ...payload }
        : rep
      ));
      setEditingRowId(null);
    } catch (e) {
      alert('Lỗi lưu: ' + (e.message || 'Không thể cập nhật'));
    } finally {
      setSavingRow(false);
    }
  }

  const personMap = buildPersonMap(reports);

  const lowerFilter = filterName.trim().toLowerCase();

  // Department totals for the month
  let grandCong = 0, grandOT = 0;
  const visibleMemberSet = new Set(visibleGroups.flatMap(g => g.members));
  for (const [name, es] of Object.entries(personMap)) {
    if (!canViewAll && !visibleMemberSet.has(name)) continue;
    const t = personTotals(es);
    grandCong += t.cong; grandOT += t.ot;
  }

  const thBase = { padding: isMobile ? '6px 8px' : '7px 12px', fontSize: isMobile ? '0.67rem' : '0.72rem', fontWeight: 700, color: '#7878a0', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' };
  const tdBase = { padding: isMobile ? '7px 8px' : '8px 12px', fontSize: isMobile ? '0.80rem' : '0.83rem', color: '#ddddf0', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' };

  return (
    <div style={{ padding: '16px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Title */}
      <div style={{ marginBottom: '18px' }}>
        <h1 style={{ color: GOLD, fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 3px' }}>
          Bảng Xác Nhận Ngày Công
        </h1>
        <p style={{ color: '#7878a0', fontSize: '0.76rem', margin: 0 }}>Tổng hợp ngày công &amp; OT nhân sự Khôi Minh theo tháng</p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
        {/* Row 1: month nav + search */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '2px' }}>
            <button onClick={() => setMonth(m => shiftMonth(m, -1))}
              style={{ padding: '6px 13px', border: 'none', background: 'transparent', color: '#c8c8e0', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, borderRadius: '6px' }}>‹</button>
            <span style={{ padding: '6px 10px', color: GOLD, fontWeight: 700, fontSize: '0.88rem', minWidth: '120px', textAlign: 'center' }}>{fmtMonth(month)}</span>
            <button onClick={() => setMonth(m => shiftMonth(m, 1))}
              style={{ padding: '6px 13px', border: 'none', background: 'transparent', color: '#c8c8e0', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, borderRadius: '6px' }}>›</button>
          </div>
          <input type="text" placeholder="Tìm theo tên..." value={filterName} onChange={e => setFilter(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#eeeef5', fontSize: '0.83rem', flex: 1, minWidth: '140px', outline: 'none' }} />
          {loading && <span style={{ color: '#7878a0', fontSize: '0.82rem' }}>⏳</span>}
          {error   && <span style={{ color: '#f87171', fontSize: '0.82rem' }}>⚠ {error}</span>}
        </div>
        {/* Row 2: grand totals — admin/director/phân lịch all + trưởng phòng (theo dept) */}
        {!loading && (canViewAll || isTruongPhong) && grandCong > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', padding: '7px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.66rem', color: '#a08040', margin: '0 0 1px', textTransform: 'uppercase' }}>{isTruongPhong ? `Công ${userDept}` : 'Tổng Công'}</p>
              <p style={{ fontSize: '1rem', fontWeight: 800, color: GOLD, margin: 0 }}>{fmtNum(grandCong)}</p>
            </div>
            <div style={{ flex: 1, background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '8px', padding: '7px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.66rem', color: '#4a7fcb', margin: '0 0 1px', textTransform: 'uppercase' }}>{isTruongPhong ? `OT ${userDept}` : 'Tổng OT'}</p>
              <p style={{ fontSize: '1rem', fontWeight: 800, color: '#60a5fa', margin: 0 }}>{fmtNum(grandOT)}h</p>
            </div>
          </div>
        )}
      </div>

      {/* Department sections */}
      {visibleGroups.map(({ dept, members }) => {
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
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col />
                <col style={{ width: isMobile ? '76px' : '88px' }} />
                <col style={{ width: isMobile ? '76px' : '96px' }} />
                {!isMobile && <col style={{ width: '85px' }} />}
              </colgroup>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
                  <th style={{ ...thBase }}>Tên Nhân Viên</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>Công</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>{isMobile ? 'OT' : 'OT (giờ)'}</th>
                  {!isMobile && <th style={{ ...thBase, textAlign: 'center' }}>Chi Tiết</th>}
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map(name => {
                  const entries = personMap[name] || [];
                  const { cong, ot } = personTotals(entries);
                  const confirmedCount = entries.filter(e => e.result).length;
                  const isExp = expanded.has(name);
                  const hasData = entries.length > 0;
                  const sortedEntries = [...entries].sort((a, b) => b.report.report_date.localeCompare(a.report.report_date));

                  return (
                    <>
                      {/* Person summary row */}
                      <tr key={name}
                        onClick={() => hasData && toggleExpand(name)}
                        style={{ cursor: hasData ? 'pointer' : 'default', background: isExp ? 'rgba(201,168,76,0.04)' : undefined, transition: 'background 0.15s' }}>
                        <td style={{ ...tdBase, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            {hasData
                              ? (isExp ? <ChevronDown size={13} color={GOLD} style={{ flexShrink: 0 }} /> : <ChevronRight size={13} color="#7878a0" style={{ flexShrink: 0 }} />)
                              : <span style={{ width: 13, flexShrink: 0 }} />}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: hasData ? 600 : 400, color: hasData ? '#eeeef5' : '#7878a0', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{name}</div>
                              {isMobile && hasData && <div style={{ fontSize: '0.68rem', color: '#7878a0', marginTop: '1px' }}>{confirmedCount} Ngày</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ ...tdBase, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: cong > 0 ? GOLD : '#7878a0' }}>
                          {cong > 0 ? fmtNum(cong) : '—'}
                        </td>
                        <td style={{ ...tdBase, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: ot > 0 ? '#60a5fa' : '#7878a0' }}>
                          {ot > 0 ? fmtMins(Math.round(ot * 60)) : '—'}
                        </td>
                        {!isMobile && (
                          <td style={{ ...tdBase, textAlign: 'center', color: '#7878a0', fontSize: '0.75rem' }}>
                            {hasData ? `${confirmedCount} Ngày` : '—'}
                          </td>
                        )}
                      </tr>

                      {/* Expanded detail */}
                      {isExp && (
                        <tr key={`${name}-detail`}>
                          <td colSpan={isMobile ? 3 : 4} style={{ padding: 0, background: 'rgba(255,255,255,0.012)', borderBottom: '2px solid rgba(201,168,76,0.15)' }}>
                            {isMobile ? (
                              /* ── Mobile: card layout ── */
                              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {sortedEntries.map(({ report: r, result }) => {
                                  const isHol = !!r.is_holiday;
                                  const isSun = result?.isSunday;
                                  const isAft = result?.isAfternoon;
                                  const togBusy = toggling.has(r.id);
                                  const dayTag = dayLabel(r.report_date);
                                  const isEditing = editingRowId === r.id;
                                  const ed = editRowData;
                                  const preview = isEditing ? calcCong({ ...r, ...ed, no_lunch_break: ed.no_lunch_break ? 1 : 0, no_afternoon_break: ed.no_afternoon_break ? 1 : 0, is_holiday: ed.is_holiday ? 1 : 0 }) : null;
                                  const inpStyle = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: '5px', color: '#eeeef5', padding: '3px 6px', fontSize: '0.80rem', width: '108px', outline: 'none' };
                                  return (
                                    <div key={r.id} style={{ borderRadius: '8px', padding: '10px 12px', background: isHol ? 'rgba(248,113,113,0.06)' : isSun ? 'rgba(96,165,250,0.06)' : 'rgba(255,255,255,0.03)', border: isEditing ? '1px solid rgba(201,168,76,0.4)' : '1px solid rgba(255,255,255,0.07)' }}>
                                      {/* Row 1: date + day + event */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#eeeef5', fontSize: '0.83rem', flexShrink: 0 }}>{fmtDate(r.report_date)}</span>
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', flexShrink: 0, background: isSun ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.07)', color: isSun ? '#60a5fa' : '#7878a0' }}>{dayTag}</span>
                                        <span style={{ fontSize: '0.78rem', color: '#9898b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.event_label || '—'}</span>
                                      </div>

                                      {isEditing ? (
                                        <>
                                          {/* Edit fields */}
                                          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '8px', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                              <span style={{ fontSize: '0.65rem', color: '#7878a0' }}>Có Mặt</span>
                                              <input type="time" value={ed.time_present} onChange={e => setEditRowData(d => ({ ...d, time_present: e.target.value }))} style={inpStyle} />
                                            </div>
                                            <span style={{ color: '#7878a0', paddingBottom: '4px' }}>→</span>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                              <span style={{ fontSize: '0.65rem', color: '#7878a0' }}>Kết Thúc</span>
                                              <input type="time" value={ed.time_end} onChange={e => setEditRowData(d => ({ ...d, time_end: e.target.value }))} style={inpStyle} />
                                            </div>
                                          </div>
                                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                                            {[
                                              { key: 'no_lunch_break', label: 'N.Trưa' },
                                              { key: 'no_afternoon_break', label: 'N.Chiều' },
                                              ...(canToggleLe ? [{ key: 'is_holiday', label: 'Lễ' }] : []),
                                            ].map(({ key, label }) => (
                                              <button key={key} onClick={() => setEditRowData(d => ({ ...d, [key]: !d[key] }))}
                                                style={{ padding: '2px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, background: ed[key] ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.1)', color: ed[key] ? '#f87171' : '#4ade80' }}>
                                                {label}: {ed[key] ? '✕' : '✓'}
                                              </button>
                                            ))}
                                          </div>
                                          {preview && (
                                            <div style={{ fontSize: '0.76rem', color: '#a0a0c0', marginBottom: '8px' }}>
                                              Xem trước: <span style={{ color: GOLD, fontWeight: 700 }}>{fmtNum(preview.congRate)} công</span>
                                              {preview.otMins > 0 && <span style={{ color: '#60a5fa' }}> +{fmtMins(preview.otMins)} OT</span>}
                                            </div>
                                          )}
                                          <div style={{ display: 'flex', gap: '8px' }}>
                                            <button disabled={savingRow} onClick={() => saveEditRow(r)}
                                              style={{ padding: '4px 16px', borderRadius: '6px', border: 'none', cursor: savingRow ? 'wait' : 'pointer', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(201,168,76,0.25)', color: GOLD }}>
                                              {savingRow ? 'Đang lưu...' : 'Lưu'}
                                            </button>
                                            <button disabled={savingRow} onClick={() => setEditingRowId(null)}
                                              style={{ padding: '4px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontSize: '0.78rem', background: 'transparent', color: '#7878a0' }}>
                                              Hủy
                                            </button>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          {/* Row 2: times + N.Trưa + N.Chiều */}
                                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.78rem', color: '#c8c8e0', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                              {r.time_present || '—'} → {r.time_end || '—'}
                                            </span>
                                            <span style={{ fontSize: '0.72rem', color: r.no_lunch_break ? '#f87171' : '#4ade80', flexShrink: 0 }}>N.Trưa: {r.no_lunch_break ? '✕' : '✓'}</span>
                                            <span style={{ fontSize: '0.72rem', color: r.no_afternoon_break ? '#f87171' : '#4ade80', flexShrink: 0 }}>N.Chiều: {r.no_afternoon_break ? '✕' : '✓'}</span>
                                          </div>
                                          {/* Row 3: tổng giờ làm việc */}
                                          <div style={{ marginBottom: '6px' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#7878a0' }}>
                                              Tổng giờ làm việc: <span style={{ color: GOLD, fontWeight: 700 }}>{result ? fmtMins(Math.max(0, result.effectiveMins)) : '—'}</span>
                                            </span>
                                          </div>
                                          {/* Row 4: công + OT + Lễ (độc lập) + Sửa Công */}
                                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            {!r.confirmed_at && (
                                              <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#7878a0', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '1px 7px' }}>Chưa xác nhận</span>
                                            )}
                                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: isHol ? '#f87171' : isSun ? '#60a5fa' : isAft ? '#9898b8' : GOLD }}>
                                              {result ? fmtNum(result.congRate) + ' công' : '—'}
                                            </span>
                                            {result?.otMins > 0 && (
                                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa' }}>+{fmtMins(result.otMins)} OT</span>
                                            )}
                                            {canToggleLe && (
                                              <button disabled={togBusy} onClick={e => { e.stopPropagation(); toggleHoliday(r.id, isHol); }}
                                                style={{ padding: '1px 8px', borderRadius: '5px', border: 'none', cursor: togBusy ? 'wait' : 'pointer', fontSize: '0.70rem', fontWeight: 700, background: isHol ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.06)', color: isHol ? '#f87171' : '#7878a0', flexShrink: 0 }}>
                                                Lễ: {isHol ? 'Có' : 'Không'}
                                              </button>
                                            )}
                                            {canSuaCong && (
                                              <button onClick={e => { e.stopPropagation(); startEditRow(r); }}
                                                style={{ marginLeft: 'auto', padding: '1px 10px', borderRadius: '5px', border: '1px solid rgba(201,168,76,0.3)', cursor: 'pointer', fontSize: '0.70rem', fontWeight: 700, background: 'rgba(201,168,76,0.08)', color: GOLD, flexShrink: 0 }}>
                                                Sửa Công
                                              </button>
                                            )}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                                {/* Mobile footer total */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '6px 4px', borderTop: '1px solid rgba(201,168,76,0.15)' }}>
                                  <span style={{ fontSize: '0.75rem', color: '#a08040' }}>{confirmedCount} Ngày</span>
                                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: GOLD }}>{fmtNum(cong)} công</span>
                                  {ot > 0 && <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa' }}>+{fmtMins(Math.round(ot * 60))} OT</span>}
                                </div>
                              </div>
                            ) : (
                              /* ── Desktop: full table ── */
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                      {['Ngày','Sự Kiện','Có Mặt','Kết Thúc','Giờ KM','N.Trưa','N.Chiều','Ngày Lễ','G.Thực','Công','OT', ...(canSuaCong ? [''] : [])].map((h, i) => (
                                        <th key={i} style={{ padding: '4px 7px', fontSize: '0.60rem', fontWeight: 700, color: '#7878a0', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: ['Có Mặt','Kết Thúc','Giờ KM','N.Trưa','N.Chiều','Ngày Lễ','G.Thực','Công','OT'].includes(h) ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sortedEntries.map(({ report: r, result }) => {
                                      const isHol = !!r.is_holiday;
                                      const isSun = result?.isSunday;
                                      const isAft = result?.isAfternoon;
                                      const togBusy = toggling.has(r.id);
                                      const dayTag = dayLabel(r.report_date);
                                      const isEditing = editingRowId === r.id;
                                      const ed = editRowData;
                                      const preview = isEditing ? calcCong({ ...r, ...ed, no_lunch_break: ed.no_lunch_break ? 1 : 0, no_afternoon_break: ed.no_afternoon_break ? 1 : 0, is_holiday: ed.is_holiday ? 1 : 0 }) : null;
                                      const dtd = { padding: '5px 7px', fontSize: '0.75rem', color: '#ddddf0', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' };
                                      const dtInp = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: '4px', color: '#eeeef5', padding: '2px 4px', fontSize: '0.73rem', width: '90px', outline: 'none' };
                                      return (
                                        <tr key={r.id} style={{ background: isEditing ? 'rgba(201,168,76,0.04)' : isHol ? 'rgba(248,113,113,0.04)' : isSun ? 'rgba(96,165,250,0.04)' : undefined }}>
                                          <td style={dtd}>
                                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDate(r.report_date)}</span>
                                            <span style={{ marginLeft: '4px', fontSize: '0.68rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', background: isSun ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)', color: isSun ? '#60a5fa' : '#7878a0' }}>{dayTag}</span>
                                          </td>
                                          <td style={{ ...dtd, maxWidth: '180px' }}>
                                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px', color: '#c8c8e0', fontSize: '0.78rem' }}>{r.event_label || '—'}</span>
                                          </td>
                                          <td style={{ ...dtd, textAlign: 'center' }}>
                                            {isEditing
                                              ? <input type="time" value={ed.time_present} onChange={e => setEditRowData(d => ({ ...d, time_present: e.target.value }))} style={dtInp} />
                                              : <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.time_present || '—'}</span>}
                                          </td>
                                          <td style={{ ...dtd, textAlign: 'center' }}>
                                            {isEditing
                                              ? <input type="time" value={ed.time_end} onChange={e => setEditRowData(d => ({ ...d, time_end: e.target.value }))} style={dtInp} />
                                              : <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.time_end || '—'}</span>}
                                          </td>
                                          <td style={{ ...dtd, textAlign: 'center', fontWeight: 700, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
                                            {(isEditing ? preview : result) ? fmtMins((isEditing ? preview : result).kmMins) : '—'}
                                          </td>
                                          <td style={{ ...dtd, textAlign: 'center' }}>
                                            {isEditing
                                              ? <button onClick={() => setEditRowData(d => ({ ...d, no_lunch_break: !d.no_lunch_break }))} style={{ padding: '1px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, background: ed.no_lunch_break ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.1)', color: ed.no_lunch_break ? '#f87171' : '#4ade80' }}>{ed.no_lunch_break ? '✕' : '✓'}</button>
                                              : r.no_lunch_break ? <span style={{ color: '#f87171', fontWeight: 700 }}>✕</span> : <span style={{ color: '#4ade80' }}>✓</span>}
                                          </td>
                                          <td style={{ ...dtd, textAlign: 'center' }}>
                                            {isEditing
                                              ? <button onClick={() => setEditRowData(d => ({ ...d, no_afternoon_break: !d.no_afternoon_break }))} style={{ padding: '1px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, background: ed.no_afternoon_break ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.1)', color: ed.no_afternoon_break ? '#f87171' : '#4ade80' }}>{ed.no_afternoon_break ? '✕' : '✓'}</button>
                                              : r.no_afternoon_break ? <span style={{ color: '#f87171', fontWeight: 700 }}>✕</span> : <span style={{ color: '#4ade80' }}>✓</span>}
                                          </td>
                                          <td style={{ ...dtd, textAlign: 'center' }}>
                                            {isEditing && canToggleLe
                                              ? <button onClick={() => setEditRowData(d => ({ ...d, is_holiday: !d.is_holiday }))} style={{ padding: '1px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, background: ed.is_holiday ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.05)', color: ed.is_holiday ? '#f87171' : '#7878a0' }}>{ed.is_holiday ? 'Có' : 'Không'}</button>
                                              : canToggleLe && !isEditing
                                                ? <button disabled={togBusy} onClick={e => { e.stopPropagation(); toggleHoliday(r.id, isHol); }} style={{ padding: '2px 8px', borderRadius: '5px', border: 'none', cursor: togBusy ? 'wait' : 'pointer', fontSize: '0.72rem', fontWeight: 700, background: isHol ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.05)', color: isHol ? '#f87171' : '#7878a0' }}>{isHol ? 'Có' : 'Không'}</button>
                                                : <span style={{ fontSize: '0.75rem', color: isHol ? '#f87171' : '#7878a0' }}>{isHol ? 'Có' : '—'}</span>}
                                          </td>
                                          <td style={{ ...dtd, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                                            {(isEditing ? preview : result) ? fmtMins(Math.max(0, (isEditing ? preview : result).effectiveMins)) : '—'}
                                          </td>
                                          <td style={{ ...dtd, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: (isEditing ? preview?.isHoliday : isHol) ? '#f87171' : (isEditing ? preview?.isSunday : isSun) ? '#60a5fa' : (isEditing ? preview?.isAfternoon : isAft) ? '#9898b8' : GOLD }}>
                                            {(isEditing ? preview : result) ? fmtNum((isEditing ? preview : result).congRate) : '—'}
                                          </td>
                                          <td style={{ ...dtd, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: (isEditing ? preview : result)?.otHours > 0 ? '#60a5fa' : '#7878a0' }}>
                                            {(isEditing ? preview : result)?.otMins > 0 ? fmtMins((isEditing ? preview : result).otMins) : '—'}
                                          </td>
                                          {canSuaCong && (
                                            <td style={{ ...dtd, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                              {isEditing ? (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                  <button disabled={savingRow} onClick={() => saveEditRow(r)} style={{ padding: '2px 10px', borderRadius: '4px', border: 'none', cursor: savingRow ? 'wait' : 'pointer', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(201,168,76,0.25)', color: GOLD }}>{savingRow ? '...' : 'Lưu'}</button>
                                                  <button disabled={savingRow} onClick={() => setEditingRowId(null)} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '0.72rem', background: 'transparent', color: '#7878a0' }}>Hủy</button>
                                                </div>
                                              ) : (
                                                <button onClick={() => startEditRow(r)} style={{ padding: '2px 10px', borderRadius: '4px', border: '1px solid rgba(201,168,76,0.3)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(201,168,76,0.08)', color: GOLD }}>Sửa</button>
                                              )}
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot>
                                    <tr style={{ background: 'rgba(201,168,76,0.05)', borderTop: '1px solid rgba(201,168,76,0.12)' }}>
                                      <td colSpan={canSuaCong ? 10 : 9} style={{ padding: '5px 7px', fontSize: '0.68rem', fontWeight: 700, color: '#a08040', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Tổng · {confirmedCount} Ngày</td>
                                      <td style={{ padding: '5px 7px', textAlign: 'center', fontWeight: 800, color: GOLD, fontVariantNumeric: 'tabular-nums', fontSize: '0.78rem' }}>{fmtNum(cong)}</td>
                                      <td style={{ padding: '5px 7px', textAlign: 'center', fontWeight: 700, color: ot > 0 ? '#60a5fa' : '#7878a0', fontVariantNumeric: 'tabular-nums', fontSize: '0.78rem' }}>{ot > 0 ? fmtMins(Math.round(ot * 60)) : '—'}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
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

      {/* Kiểm Tra Ngày Công — chỉ SUPER_ADMIN và phân lịch all */}
      {canViewAll && !loading && (() => {
        const overlaps = [];
        for (const [name, entries] of Object.entries(personMap)) {
          const byDate = {};
          for (const { report } of entries) {
            const d = report.report_date;
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(report);
          }
          for (const [date, reps] of Object.entries(byDate)) {
            if (reps.length > 1) {
              // Bỏ qua nếu người này được gắn nhãn hỗ trợ (km_support) ngày đó
              if ((supportByDate[date] || []).includes(name)) continue;
              overlaps.push({ name, date, reps });
            }
          }
        }
        if (!overlaps.length) return null;
        overlaps.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
        return (
          <div style={{ marginTop: '24px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(251,146,60,0.3)' }}>
            <div style={{ padding: '10px 14px', background: 'rgba(251,146,60,0.08)', borderBottom: '1px solid rgba(251,146,60,0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fb923c', letterSpacing: '0.07em', textTransform: 'uppercase' }}>⚠ Kiểm Tra Ngày Công</span>
              <span style={{ fontSize: '0.75rem', color: '#fb923c', background: 'rgba(251,146,60,0.15)', borderRadius: '10px', padding: '1px 8px', fontWeight: 700 }}>{overlaps.length} trùng</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ padding: '7px 12px', textAlign: 'left', color: '#7878a0', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>Nhân viên</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', color: '#7878a0', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>Ngày</th>
                    <th style={{ padding: '7px 12px', textAlign: 'left', color: '#7878a0', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Sự kiện trùng</th>
                  </tr>
                </thead>
                <tbody>
                  {overlaps.map(({ name, date, reps }, i) => (
                    <tr key={`${name}-${date}`} style={{ borderBottom: i < overlaps.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                      <td style={{ padding: '8px 12px', color: '#eeeef5', fontWeight: 600, whiteSpace: 'nowrap' }}>{name}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: '#fb923c', fontWeight: 700 }}>{fmtDate(date)}</span>
                        <span style={{ color: '#7878a0', fontSize: '0.75rem', marginLeft: '4px' }}>{dayLabel(date)}</span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {reps.map(r => (
                            <span key={r.id} style={{ padding: '2px 8px', borderRadius: '5px', background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.25)', color: '#fdba74', fontSize: '0.78rem', fontWeight: 600 }}>
                              {r.event_label || '—'}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
