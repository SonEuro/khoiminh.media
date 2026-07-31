import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react'; // v2
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useStaffGroups } from '../contexts/StaffGroupsContext';
import NgayPhepModal from '../components/NgayPhepModal';

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
  const endM   = toM(r.time_end);
  const isOvernight = startM !== null && endM !== null && endM < startM;
  const isAfternoon = startM !== null && startM >= 13 * 60; // bắt đầu từ 13:00 trở đi (ca chiều)
  const isSunday = new Date(r.report_date + 'T00:00:00').getDay() === 0;
  const isHoliday = !!r.is_holiday;
  let effectiveMins, congRate, otThresholdMins;
  if (isAfternoon) {
    effectiveMins = kmMins; // không trừ nghỉ trưa (đã qua trưa)
    congRate = (isSunday || isHoliday) ? 1 : 0.5;
    otThresholdMins = 4 * 60 + 30; // ca chiều 13:00-17:30 = 4.5h
  } else {
    // Ca qua đêm: endM < startM — không dùng endM để đoán nghỉ chiều
    const skipAft = r.no_afternoon_break || (!isOvernight && endM !== null && endM <= 17 * 60 + 30);
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

// Khóa chỉnh sửa sau 30 ngày kể từ ngày cuối tháng
function isMonthLocked(ym) {
  const [y, m] = ym.split('-').map(Number);
  const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const [ty, tm, td] = todayVN.split('-').map(Number);
  const lastDayOfMonth = new Date(Date.UTC(y, m, 0)); // ngày cuối tháng
  const lockDate = new Date(lastDayOfMonth.getTime() + 30 * 864e5); // +30 ngày
  const today = new Date(Date.UTC(ty, tm - 1, td));
  return today > lockDate;
}

// Per-person allowance helpers — trả 0/'' nếu chưa có entry riêng (không fallback flat)
function getPA(r, name, field) {
  const pa = r.per_person_allowances;
  if (pa && name in pa) return pa[name]?.[field] || 0;
  return 0;
}
function getPANote(r, name, noteField) {
  const pa = r.per_person_allowances;
  if (pa && name in pa) return pa[name]?.[noteField] || '';
  return '';
}
// Override công/leader per-person: null → tự tính, số → dùng override
function getPersonCong(r, name, result) {
  const pa = r.per_person_allowances;
  if (pa && name in pa) {
    const ov = pa[name]?.cong_override;
    if (ov !== null && ov !== undefined && ov !== '') return Number(ov);
  }
  return result?.congRate || 0;
}
function getPersonLeader(r, name, autoIsLeader) {
  const pa = r.per_person_allowances;
  if (pa && name in pa) {
    const ov = pa[name]?.leader_override;
    if (ov !== null && ov !== undefined && ov !== '') return Number(ov);
  }
  return autoIsLeader ? 1 : 0;
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
function personTotals(entries, name) {
  let cong = 0, ot = 0;
  for (const { report: r, result } of entries) {
    if (result) {
      cong += name ? getPersonCong(r, name, result) : result.congRate;
      ot += result.otHours;
    }
  }
  return { cong, ot };
}

export default function XacNhanCong() {
  const { user } = useAuth();
  const { kmGroups } = useStaffGroups();
  const canViewAll  = ['DIRECTOR', 'SUPER_ADMIN'].includes(user?.role) || !!user?.is_phan_lich_all;
  const canNgayPhep = user?.role === 'SUPER_ADMIN' || !!user?.is_phan_lich_all;
  const canEdit     = canViewAll;
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
  const [violByName, setViolByName]   = useState({});
  const [salaryByName, setSalaryByName] = useState({});
  const [phaseDateMap, setPhaseDateMap] = useState({});
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [filterName, setFilter]     = useState('');
  const [expanded, setExpanded]     = useState(new Set());
  const [toggling, setToggling]     = useState(new Set());
  const [isMobile, setIsMobile]     = useState(() => window.innerWidth < 768);
  const [exporting, setExporting]   = useState(false);
  const [showNgayPhep, setShowNgayPhep] = useState(false);
  const [editingRowId, setEditingRowId]         = useState(null);
  const [editingPersonName, setEditingPersonName] = useState(null);
  const [editRowData, setEditRowData]           = useState({});
  const [savingRow, setSavingRow]               = useState(false);

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
      setViolByName(data.violByName || {});
      setSalaryByName(data.salaryByName || {});
      setPhaseDateMap(data.phaseDateMap || {});
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

  function startEditRow(r, name) {
    setEditingRowId(r.id);
    setEditingPersonName(name);
    setEditRowData({
      time_present: r.time_present || '',
      time_end: r.time_end || '',
      time_onset: r.time_onset || '',
      no_lunch_break: !!r.no_lunch_break,
      no_afternoon_break: !!r.no_afternoon_break,
      is_holiday: !!r.is_holiday,
      xang_xe: getPA(r, name, 'xang_xe') || '',
      xang_xe_note: getPANote(r, name, 'xang_xe_note'),
      tien_nuoc: getPA(r, name, 'tien_nuoc') || '',
      tien_nuoc_note: getPANote(r, name, 'tien_nuoc_note'),
      giu_xe: getPA(r, name, 'giu_xe') || '',
      giu_xe_note: getPANote(r, name, 'giu_xe_note'),
      phu_cap_khac: getPA(r, name, 'phu_cap_khac') || '',
      phu_cap_khac_note: getPANote(r, name, 'phu_cap_khac_note'),
      leader_override: (() => { const pa = r.per_person_allowances; if (pa && name in pa) { const ov = pa[name]?.leader_override; return ov !== null && ov !== undefined ? String(ov) : ''; } return ''; })(),
      cong_override:   (() => { const pa = r.per_person_allowances; if (pa && name in pa) { const ov = pa[name]?.cong_override;   return ov !== null && ov !== undefined ? String(ov) : ''; } return ''; })(),
    });
  }

  async function saveEditRow(r, name) {
    setSavingRow(true);
    try {
      // Chỉ update giờ/nghỉ — dùng endpoint riêng để không ghi đè nội dung báo cáo
      const timePayload = {
        time_present: editRowData.time_present,
        time_end: editRowData.time_end,
        time_onset: editRowData.time_onset,
        no_lunch_break: editRowData.no_lunch_break ? 1 : 0,
        no_afternoon_break: editRowData.no_afternoon_break ? 1 : 0,
        is_holiday: editRowData.is_holiday ? 1 : 0,
      };
      await api.updateReportTimeFields(r.id, timePayload);

      // Save allowances per-person
      const paRes = await api.updatePersonAllowance(r.id, {
        person_name: name,
        xang_xe: parseInt(editRowData.xang_xe || '0', 10) || 0,
        xang_xe_note: editRowData.xang_xe_note || '',
        tien_nuoc: parseInt(editRowData.tien_nuoc || '0', 10) || 0,
        tien_nuoc_note: editRowData.tien_nuoc_note || '',
        giu_xe: parseInt(editRowData.giu_xe || '0', 10) || 0,
        giu_xe_note: editRowData.giu_xe_note || '',
        phu_cap_khac: parseInt(editRowData.phu_cap_khac || '0', 10) || 0,
        phu_cap_khac_note: editRowData.phu_cap_khac_note || '',
        leader_override: editRowData.leader_override,
        cong_override:   editRowData.cong_override,
      });

      setReports(prev => prev.map(rep => rep.id === r.id
        ? { ...rep, ...timePayload, per_person_allowances: paRes.per_person_allowances, confirmed_at: rep.confirmed_at }
        : rep
      ));
      setEditingRowId(null);
      setEditingPersonName(null);
    } catch (e) {
      alert('Lỗi lưu: ' + (e.message || 'Không thể cập nhật'));
    } finally {
      setSavingRow(false);
    }
  }

  const personMap = buildPersonMap(reports);

  const isPast      = isMonthLocked(month);
  const canToggleLe = !isPast && (user?.role === 'SUPER_ADMIN' || !!user?.is_phan_lich_all);
  const canSuaCong  = !isPast && (user?.role === 'SUPER_ADMIN' || !!user?.is_phan_lich_all);

  const lowerFilter = filterName.trim().toLowerCase();

  // Department totals for the month — only count members in visibleGroups (matches Excel)
  let grandCong = 0, grandOT = 0;
  const visibleMemberSet = new Set(visibleGroups.flatMap(g => g.members));
  for (const [name, es] of Object.entries(personMap)) {
    if (!visibleMemberSet.has(name)) continue;
    const t = personTotals(es, name);
    grandCong += t.cong; grandOT += t.ot;
  }

  function detectPhase(label) {
    const l = (label || '').toLowerCase();
    if (l.includes('ghi hình') || l.includes('ghi hinh')) return 'filming';
    if (l.includes('rehearsal') || l.includes('tập duyệt')) return 'rehearsal';
    if (l.includes('bắt đầu') || l.includes('bat dau') || l.includes('setup') || l.includes('dàn dựng')) return 'setup';
    if (l.includes('kết thúc') || l.includes('tháo dỡ') || l.includes('teardown')) return 'teardown';
    return null;
  }

  async function exportCongExcel() {
    setExporting(true);
    try {
      const { default: ExcelJS } = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Tổng Hợp Ngày Công');

      const [yy, mm] = month.split('-');
      const titleText = `BẢNG XÁC NHẬN NGÀY CÔNG — THÁNG ${parseInt(mm, 10)}/${yy}`;

      const border = { top: { style: 'thin', color: { argb: 'FFB0B0B0' } }, left: { style: 'thin', color: { argb: 'FFB0B0B0' } }, bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } }, right: { style: 'thin', color: { argb: 'FFB0B0B0' } } };
      const borderMedium = { top: { style: 'medium', color: { argb: 'FF888888' } }, left: { style: 'medium', color: { argb: 'FF888888' } }, bottom: { style: 'medium', color: { argb: 'FF888888' } }, right: { style: 'medium', color: { argb: 'FF888888' } } };
      const white = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

      // Title
      ws.mergeCells('A1:V1');
      const titleCell = ws.getCell('A1');
      titleCell.value = titleText;
      titleCell.font = { bold: true, size: 13 };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.fill = white;
      ws.getRow(1).height = 28;

      // Header row — 23 cột
      const hdrRow = ws.addRow(['STT', 'Bộ Phận', 'Họ Tên', 'Bậc', 'Lương Cơ Bản', 'Lương Ngày Công', 'Lương OT/h', 'Số Ngày', 'Tổng Công', 'Tổng OT (giờ)', 'Leader', 'C.Sáng', 'C.Trưa', 'C.Tối', 'C.Khuya', 'Xăng Xe', 'Tiền Nước', 'Giữ Xe', 'Phụ Cấp Khác', 'Phạt BC', 'Tổng Số Tiền', 'Ghi Chú']);
      hdrRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FF000000' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderMedium;
      });
      hdrRow.getCell(3).alignment = { horizontal: 'left' };
      hdrRow.height = 20;

      // Đơn giá phụ cấp: C.Sáng=40k, C.Trưa=30k, C.Tối(has_com_chieu)=30k, C.Khuya(has_com_toi)=40k
      const RATES = { leader: 200000, cs: 40000, ct: 30000, cc: 30000, ctoi: 40000 };
      const vndFmt = '#,##0';

      const VIOL_PENALTY = 100000;
      const daysInMonth = new Date(parseInt(yy), parseInt(mm), 0).getDate();

      let stt = 0;
      let grandCongX = 0, grandOTX = 0, grandDays = 0, grandLeader = 0;
      let grandCS = 0, grandCT = 0, grandCC = 0, grandCToi = 0;
      let grandXangXe = 0, grandTienNuoc = 0, grandGiuXe = 0, grandPhuCapKhac = 0;
      let grandPhat = 0, grandTotalTien = 0;
      const deptSubtotalRows = [];

      for (const g of kmGroups) {
        const deptMembers = g.members.filter(name => personMap[name]);
        if (!deptMembers.length) continue;

        let deptCong = 0, deptOT = 0, deptDays = 0, deptLeader = 0;
        let deptCS = 0, deptCT = 0, deptCC = 0, deptCToi = 0;
        let deptXangXe = 0, deptTienNuoc = 0, deptGiuXe = 0, deptPhuCapKhac = 0;
        let deptPhat = 0, deptTotalTien = 0;
        let firstPersonRow = null;

        for (const name of deptMembers) {
          const entries = personMap[name] || [];
          const { cong, ot } = personTotals(entries, name);
          const daysWorked = entries.filter(e => e.result).length;
          const leaderRate = g.dept === 'Sân Khấu' ? 100000 : 200000;
          const leaders = entries.reduce((sum, { report: r }) => {
            const autoLeader = (r.leaders || []).includes(name) && (() => {
              const phase = phaseDateMap[`${r.event_id}::${r.report_date}`] || detectPhase(r.event_label);
              if (g.dept === 'Sân Khấu') return phase === 'setup' || phase === 'rehearsal';
              if (g.dept === 'ATAS-LED' || g.dept === 'Kỹ Thuật') return phase === 'filming';
              return false;
            })();
            return sum + getPersonLeader(r, name, autoLeader);
          }, 0);
          const leaderAmt = leaders * leaderRate;
          const cs   = entries.filter(({ report: r }) => r.has_com_sang).length;
          const ct   = entries.filter(({ report: r }) => r.has_com_trua).length;
          const cc   = entries.filter(({ report: r }) => r.has_com_chieu).length;  // C.Tối
          const ctoi = entries.filter(({ report: r }) => r.has_com_toi).length;    // C.Khuya
          const xangXe      = entries.reduce((s, { report: r }) => s + getPA(r, name, 'xang_xe'), 0);
          const tienNuoc    = entries.reduce((s, { report: r }) => s + getPA(r, name, 'tien_nuoc'), 0);
          const giuXe       = entries.reduce((s, { report: r }) => s + getPA(r, name, 'giu_xe'), 0);
          const phuCapKhac  = entries.reduce((s, { report: r }) => s + getPA(r, name, 'phu_cap_khac'), 0);
          const violCount = violByName[name] || 0;
          const phatAmt = violCount * VIOL_PENALTY;
          const sal = salaryByName[name] || { lcb: 0, lnc: 0, lot: 0, bac: '', luong_theo_thang: 0 };
          const days = sal.luong_theo_thang ? daysInMonth : daysWorked;
          const lncBase = sal.luong_theo_thang ? daysInMonth : cong;
          const salaryPart = (sal.lcb || 0) + sal.lnc * lncBase + sal.lot * ot;
          const totalTien = salaryPart + leaderAmt + cs * RATES.cs + ct * RATES.ct + cc * RATES.cc + ctoi * RATES.ctoi + xangXe + tienNuoc + giuXe + phuCapKhac - phatAmt;
          if (!sal.luong_theo_thang && !daysWorked && !cong) continue;
          // Build ghi chú từ notes của từng ca
          const ghiChuLines = [];
          for (const { report: rep } of entries) {
            const [, rm, rd] = (rep.report_date || '').split('-');
            const dd = rd && rm ? `${rd}/${rm}` : '';
            const xzNote = getPANote(rep, name, 'xang_xe_note');
            const tnNote = getPANote(rep, name, 'tien_nuoc_note');
            const gxNote = getPANote(rep, name, 'giu_xe_note');
            const pcNote = getPANote(rep, name, 'phu_cap_khac_note');
            if (xzNote?.trim())  ghiChuLines.push(`Xăng Xe: ${xzNote.trim()} (${dd})`);
            if (tnNote?.trim())  ghiChuLines.push(`T.Nước: ${tnNote.trim()} (${dd})`);
            if (gxNote?.trim())  ghiChuLines.push(`Giữ Xe: ${gxNote.trim()} (${dd})`);
            if (pcNote?.trim())  ghiChuLines.push(`PC Khác: ${pcNote.trim()} (${dd})`);
          }
          const ghiChu = ghiChuLines.join('\n');
          stt++;
          const row = ws.addRow([
            stt, g.dept, name, sal.bac || '',
            sal.lcb || '', sal.lnc || '', sal.lot || '',
            days, parseFloat(fmtNum(cong)), parseFloat(fmtNum(ot)),
            leaderAmt || '', cs || '', ct || '', cc || '', ctoi || '',
            xangXe || '', tienNuoc || '', giuXe || '', phuCapKhac || '',
            phatAmt > 0 ? phatAmt : '',
            '',             // U: set bằng formula bên dưới
            ghiChu,         // V: ghi chú
          ]);
          const r = row.number;
          if (firstPersonRow === null) firstPersonRow = r;
          // Công thức col U: LCB + LNC×Công/Ngày + LOT×OT + Leader(₫) + phụ cấp − Phạt
          // luong_theo_thang: dùng giá trị tĩnh vì công thức Excel cần col H (Ngày) thay vì I (Công)
          row.getCell(21).value = sal.luong_theo_thang
            ? totalTien
            : {
                formula: `=N(E${r})+N(F${r})*N(I${r})+N(G${r})*N(J${r})+N(K${r})+N(L${r})*40000+N(M${r})*30000+N(N${r})*30000+N(O${r})*40000+N(P${r})+N(Q${r})+N(R${r})+N(S${r})-N(T${r})`,
                result: totalTien,
              };
          row.eachCell(cell => { cell.fill = white; cell.border = border; cell.alignment = { horizontal: 'center' }; });
          row.getCell(3).alignment = { horizontal: 'left' };
          if (sal.lcb) { row.getCell(5).numFmt = vndFmt; row.getCell(6).numFmt = vndFmt; row.getCell(7).numFmt = vndFmt; }
          if (xangXe > 0)     row.getCell(16).numFmt = vndFmt;
          if (tienNuoc > 0)   row.getCell(17).numFmt = vndFmt;
          if (giuXe > 0)      row.getCell(18).numFmt = vndFmt;
          if (phuCapKhac > 0) row.getCell(19).numFmt = vndFmt;
          if (phatAmt > 0) { row.getCell(20).numFmt = vndFmt; row.getCell(20).font = { color: { argb: 'FFCC0000' } }; }
          row.getCell(21).numFmt = vndFmt;
          if (leaderAmt > 0) row.getCell(11).numFmt = vndFmt;
          if (ghiChu) row.getCell(22).alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
          deptCong += cong; deptOT += ot; deptDays += days; deptLeader += leaderAmt;
          deptCS += cs; deptCT += ct; deptCC += cc; deptCToi += ctoi;
          deptXangXe += xangXe; deptTienNuoc += tienNuoc; deptGiuXe += giuXe; deptPhuCapKhac += phuCapKhac;
          deptPhat += phatAmt; deptTotalTien += totalTien;
        }

        const deptEndRow = ws.rowCount;
        if (firstPersonRow !== null && deptEndRow >= firstPersonRow) {
          grandCongX += deptCong; grandOTX += deptOT; grandDays += deptDays; grandLeader += deptLeader;
          grandCS += deptCS; grandCT += deptCT; grandCC += deptCC; grandCToi += deptCToi;
          grandXangXe += deptXangXe; grandTienNuoc += deptTienNuoc; grandGiuXe += deptGiuXe; grandPhuCapKhac += deptPhuCapKhac;
          grandPhat += deptPhat; grandTotalTien += deptTotalTien;
          const subRow = ws.addRow(['', `Tổng ${g.dept}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
          const sr = subRow.number;
          deptSubtotalRows.push(sr);
          // SUM formulas cho cột H(8) đến U(21)
          const sCols = ['H','I','J','K','L','M','N','O','P','Q','R','S','T','U'];
          const sVals = [deptDays, parseFloat(fmtNum(deptCong)), parseFloat(fmtNum(deptOT)), deptLeader, deptCS, deptCT, deptCC, deptCToi, deptXangXe, deptTienNuoc, deptGiuXe, deptPhuCapKhac, deptPhat, deptTotalTien];
          sCols.forEach((col, i) => {
            subRow.getCell(8 + i).value = { formula: `=SUM(${col}${firstPersonRow}:${col}${deptEndRow})`, result: sVals[i] || 0 };
          });
          subRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FF000000' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
            cell.border = border;
            cell.alignment = { horizontal: 'center' };
          });
          subRow.getCell(2).alignment = { horizontal: 'left' };
          if (deptLeader > 0)     subRow.getCell(11).numFmt = vndFmt;
          if (deptXangXe > 0)     subRow.getCell(16).numFmt = vndFmt;
          if (deptTienNuoc > 0)   subRow.getCell(17).numFmt = vndFmt;
          if (deptGiuXe > 0)      subRow.getCell(18).numFmt = vndFmt;
          if (deptPhuCapKhac > 0) subRow.getCell(19).numFmt = vndFmt;
          if (deptPhat > 0) { subRow.getCell(20).numFmt = vndFmt; subRow.getCell(20).font = { bold: true, color: { argb: 'FFCC0000' } }; }
          subRow.getCell(21).numFmt = vndFmt;
        }
      }

      // Grand total
      ws.addRow([]);
      const totalRow = ws.addRow(['', 'TỔNG CỘNG', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
      if (deptSubtotalRows.length > 0) {
        const tCols = ['H','I','J','K','L','M','N','O','P','Q','R','S','T','U'];
        const tVals = [grandDays, parseFloat(fmtNum(grandCongX)), parseFloat(fmtNum(grandOTX)), grandLeader, grandCS, grandCT, grandCC, grandCToi, grandXangXe, grandTienNuoc, grandGiuXe, grandPhuCapKhac, grandPhat, grandTotalTien];
        tCols.forEach((col, i) => {
          const formula = deptSubtotalRows.map(r => `${col}${r}`).join('+');
          totalRow.getCell(8 + i).value = { formula: `=${formula}`, result: tVals[i] || 0 };
        });
      }
      totalRow.eachCell(cell => {
        cell.font = { bold: true, size: 11, color: { argb: 'FF000000' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };
        cell.alignment = { horizontal: 'center' };
        cell.border = borderMedium;
      });
      totalRow.getCell(2).alignment = { horizontal: 'left' };
      if (grandLeader > 0)     totalRow.getCell(11).numFmt = vndFmt;
      if (grandXangXe > 0)     totalRow.getCell(16).numFmt = vndFmt;
      if (grandTienNuoc > 0)   totalRow.getCell(17).numFmt = vndFmt;
      if (grandGiuXe > 0)      totalRow.getCell(18).numFmt = vndFmt;
      if (grandPhuCapKhac > 0) totalRow.getCell(19).numFmt = vndFmt;
      if (grandPhat > 0) { totalRow.getCell(20).numFmt = vndFmt; totalRow.getCell(20).font = { bold: true, size: 11, color: { argb: 'FFCC0000' } }; }
      totalRow.getCell(21).numFmt = vndFmt;

      ws.columns = [
        { width: 6 }, { width: 18 }, { width: 24 }, { width: 10 },
        { width: 14 }, { width: 16 }, { width: 12 },
        { width: 10 }, { width: 12 }, { width: 14 }, { width: 10 },
        { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 },
        { width: 11 }, { width: 12 }, { width: 9 }, { width: 13 }, { width: 12 }, { width: 16 },
        { width: 38 },
      ];

      // ── Sheet 2: Chi Tiết ──
      const ws2 = wb.addWorksheet('Chi Tiết');
      ws2.mergeCells('A1:U1');
      const title2 = ws2.getCell('A1');
      title2.value = `CHI TIẾT NGÀY CÔNG — THÁNG ${parseInt(mm, 10)}/${yy}`;
      title2.font = { bold: true, size: 13 };
      title2.alignment = { horizontal: 'center', vertical: 'middle' };
      title2.fill = white;
      ws2.getRow(1).height = 28;

      const hdr2 = ws2.addRow(['STT', 'Họ Tên', 'Bộ Phận', 'Ngày', 'Thứ', 'Sự Kiện', 'Leader', 'Có Mặt', 'Kết Thúc', 'G.Thực', 'Công', 'OT (h)', 'C.Sáng', 'C.Trưa', 'C.Chiều', 'C.Tối', 'Nước', 'Xăng Xe', 'Tiền Nước', 'Giữ Xe', 'Phụ Cấp Khác']);
      hdr2.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FF000000' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderMedium;
      });
      hdr2.getCell(2).alignment = { horizontal: 'left' };
      hdr2.getCell(3).alignment = { horizontal: 'left' };
      hdr2.getCell(6).alignment = { horizontal: 'left' };
      hdr2.height = 20;

      let stt2 = 0;
      for (const g2 of kmGroups) {
        for (const name of g2.members) {
          const entries2 = personMap[name] || [];
          if (!entries2.length) continue;
          const sorted2 = [...entries2].sort((a, b) => a.report.report_date.localeCompare(b.report.report_date));
          for (const { report: r, result } of sorted2) {
            stt2++;
            const leaderPhase2 = phaseDateMap[`${r.event_id}::${r.report_date}`] || detectPhase(r.event_label);
            const autoIsLeader2 = (r.leaders || []).includes(name) && (
              g2.dept === 'Sân Khấu' ? (leaderPhase2 === 'setup' || leaderPhase2 === 'rehearsal') :
              (g2.dept === 'ATAS-LED' || g2.dept === 'Kỹ Thuật') ? leaderPhase2 === 'filming' :
              false
            );
            const leaderVal2 = getPersonLeader(r, name, autoIsLeader2);
            const congVal2 = result ? getPersonCong(r, name, result) : null;
            const [ry, rmx, rday] = r.report_date.split('-');
            const yesNo = v => v ? '✓' : '';
            const row2 = ws2.addRow([
              stt2, name, g2.dept,
              `${rday}/${rmx}/${ry}`, dayLabel(r.report_date),
              r.event_label || '—', leaderVal2 || '',
              r.time_present || '—', r.time_end || '—',
              result ? fmtMins(Math.max(0, result.effectiveMins)) : 'Chưa XN',
              congVal2 !== null ? parseFloat(fmtNum(congVal2)) : '',
              result?.otMins > 0 ? parseFloat((result.otMins / 60).toFixed(2)) : '',
              yesNo(r.has_com_sang), yesNo(r.has_com_trua), yesNo(r.has_com_chieu),
              yesNo(r.has_com_toi), yesNo(r.has_nuoc),
              getPA(r, name, 'xang_xe') || '', getPA(r, name, 'tien_nuoc') || '', getPA(r, name, 'giu_xe') || '', getPA(r, name, 'phu_cap_khac') || '',
            ]);
            row2.eachCell(cell => { cell.fill = white; cell.border = border; cell.alignment = { horizontal: 'center' }; });
            row2.getCell(2).alignment = { horizontal: 'left' };
            row2.getCell(3).alignment = { horizontal: 'left' };
            row2.getCell(6).alignment = { horizontal: 'left' };
            if (!result) row2.getCell(10).font = { italic: true, color: { argb: 'FF888888' } };
          }
        }
      }

      ws2.columns = [
        { width: 6 }, { width: 24 }, { width: 20 },
        { width: 14 }, { width: 8 }, { width: 28 },
        { width: 8 }, { width: 10 }, { width: 10 },
        { width: 10 }, { width: 8 }, { width: 10 },
        { width: 9 }, { width: 9 }, { width: 9 },
        { width: 8 }, { width: 8 }, { width: 11 }, { width: 12 }, { width: 9 }, { width: 13 },
      ];

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const stamp = `${pad(now.getDate())}-${pad(now.getMonth()+1)} ${pad(now.getHours())}h${pad(now.getMinutes())}`;
      a.href = url; a.download = `Bảng Lương - Tháng ${parseInt(mm, 10)}-${yy} - ${stamp}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) {
      alert('Lỗi xuất Excel: ' + (e.message || e));
    } finally {
      setExporting(false);
    }
  }

  function exportCongPDF() {
    const [yy, mm] = month.split('-');
    const RATES = { leader: 200000, cs: 40000, ct: 30000, cc: 30000, ctoi: 40000 };
    const VIOL_PENALTY = 100000;
    const daysInMonthPdf = new Date(parseInt(yy), parseInt(mm), 0).getDate();
    const fmtVND = n => n ? Math.round(n).toLocaleString('vi-VN') : '';

    let stt = 0;
    const rows = [];

    for (const g of kmGroups) {
      const deptMembers = g.members.filter(name => personMap[name]);
      if (!deptMembers.length) continue;
      let deptCong = 0, deptOT = 0, deptDays = 0, deptLeader = 0;
      let deptCS = 0, deptCT = 0, deptCC = 0, deptCToi = 0;
      let deptXangXe = 0, deptTienNuoc = 0, deptGiuXe = 0, deptPhuCapKhac = 0;
      let deptPhat = 0, deptTotalTien = 0;
      let hasDept = false;

      for (const name of deptMembers) {
        const entries = personMap[name] || [];
        const { cong, ot } = personTotals(entries, name);
        const daysWorkedPdf = entries.filter(e => e.result).length;
        const salPre = salaryByName[name] || { luong_theo_thang: 0 };
        if (!salPre.luong_theo_thang && !daysWorkedPdf && !cong) continue;
        const leaderRate = g.dept === 'Sân Khấu' ? 100000 : 200000;
        const leaders = entries.reduce((sum, { report: r }) => {
          const autoLeader = (r.leaders || []).includes(name) && (() => {
            const phase = phaseDateMap[`${r.event_id}::${r.report_date}`] || detectPhase(r.event_label);
            if (g.dept === 'Sân Khấu') return phase === 'setup' || phase === 'rehearsal';
            if (g.dept === 'ATAS-LED' || g.dept === 'Kỹ Thuật') return phase === 'filming';
            return false;
          })();
          return sum + getPersonLeader(r, name, autoLeader);
        }, 0);
        const leaderAmt = leaders * leaderRate;
        const cs       = entries.filter(({ report: r }) => r.has_com_sang).length;
        const ct       = entries.filter(({ report: r }) => r.has_com_trua).length;
        const cc       = entries.filter(({ report: r }) => r.has_com_chieu).length;
        const ctoi     = entries.filter(({ report: r }) => r.has_com_toi).length;
        const xangXe     = entries.reduce((s, { report: r }) => s + getPA(r, name, 'xang_xe'), 0);
        const tienNuoc   = entries.reduce((s, { report: r }) => s + getPA(r, name, 'tien_nuoc'), 0);
        const giuXe      = entries.reduce((s, { report: r }) => s + getPA(r, name, 'giu_xe'), 0);
        const phuCapKhac = entries.reduce((s, { report: r }) => s + getPA(r, name, 'phu_cap_khac'), 0);
        const phatAmt  = (violByName[name] || 0) * VIOL_PENALTY;
        const sal      = salaryByName[name] || { lcb: 0, lnc: 0, lot: 0, bac: '', luong_theo_thang: 0 };
        const days     = sal.luong_theo_thang ? daysInMonthPdf : daysWorkedPdf;
        const lncBasePdf = sal.luong_theo_thang ? daysInMonthPdf : cong;
        const totalTien = (sal.lcb || 0) + sal.lnc * lncBasePdf + sal.lot * ot + leaderAmt + cs * RATES.cs + ct * RATES.ct + cc * RATES.cc + ctoi * RATES.ctoi + xangXe + tienNuoc + giuXe + phuCapKhac - phatAmt;
        const ghiChuPdfLines = [];
        for (const { report: rep } of entries) {
          const [, rm, rd] = (rep.report_date || '').split('-');
          const dd = rd && rm ? `${rd}/${rm}` : '';
          const xzNote = getPANote(rep, name, 'xang_xe_note');
          const tnNote = getPANote(rep, name, 'tien_nuoc_note');
          const gxNote = getPANote(rep, name, 'giu_xe_note');
          const pcNote = getPANote(rep, name, 'phu_cap_khac_note');
          if (xzNote?.trim())  ghiChuPdfLines.push(`Xăng Xe: ${xzNote.trim()} (${dd})`);
          if (tnNote?.trim())  ghiChuPdfLines.push(`T.Nước: ${tnNote.trim()} (${dd})`);
          if (gxNote?.trim())  ghiChuPdfLines.push(`Giữ Xe: ${gxNote.trim()} (${dd})`);
          if (pcNote?.trim())  ghiChuPdfLines.push(`PC Khác: ${pcNote.trim()} (${dd})`);
        }
        const ghiChu = ghiChuPdfLines.join('<br>');
        stt++; hasDept = true;
        rows.push({ type: 'person', stt, dept: g.dept, name, sal, days, cong, ot, leaders: leaderAmt, cs, ct, cc, ctoi, xangXe, tienNuoc, giuXe, phuCapKhac, phatAmt, totalTien, ghiChu });
        deptCong += cong; deptOT += ot; deptDays += days; deptLeader += leaderAmt;
        deptCS += cs; deptCT += ct; deptCC += cc; deptCToi += ctoi;
        deptXangXe += xangXe; deptTienNuoc += tienNuoc; deptGiuXe += giuXe; deptPhuCapKhac += phuCapKhac;
        deptPhat += phatAmt; deptTotalTien += totalTien;
      }
      if (hasDept) rows.push({ type: 'sub', dept: g.dept, days: deptDays, cong: deptCong, ot: deptOT, leaders: deptLeader, cs: deptCS, ct: deptCT, cc: deptCC, ctoi: deptCToi, xangXe: deptXangXe, tienNuoc: deptTienNuoc, giuXe: deptGiuXe, phuCapKhac: deptPhuCapKhac, phat: deptPhat, total: deptTotalTien });
    }
    const grand = rows.filter(r => r.type === 'sub').reduce((acc, r) => {
      acc.days += r.days; acc.cong += r.cong; acc.ot += r.ot; acc.leaders += r.leaders;
      acc.cs += r.cs; acc.ct += r.ct; acc.cc += r.cc; acc.ctoi += r.ctoi;
      acc.xangXe += r.xangXe; acc.tienNuoc += r.tienNuoc; acc.giuXe += r.giuXe; acc.phuCapKhac += r.phuCapKhac;
      acc.phat += r.phat; acc.total += r.total; return acc;
    }, { days:0, cong:0, ot:0, leaders:0, cs:0, ct:0, cc:0, ctoi:0, xangXe:0, tienNuoc:0, giuXe:0, phuCapKhac:0, phat:0, total:0 });

    const hdr = ['STT','Bộ Phận','Họ Tên','Bậc','Lương CB','LNC/ngày','LOT/h','Ngày','Công','OT(h)','Leader','C.Sáng','C.Trưa','C.Tối','C.Khuya','Xăng Xe','T.Nước','Giữ Xe','PC Khác','Phạt BC','Tổng Lương','Ghi Chú'];
    const tdC = (v, extra='') => `<td${extra}>${v ?? ''}</td>`;
    const renderRow = r => {
      if (r.type === 'person') {
        return `<tr>${[r.stt, r.dept, r.name, r.sal.bac||'', fmtVND(r.sal.lcb), fmtVND(r.sal.lnc), fmtVND(r.sal.lot), r.days, fmtNum(r.cong), fmtNum(r.ot), fmtVND(r.leaders), r.cs||'', r.ct||'', r.cc||'', r.ctoi||'', fmtVND(r.xangXe), fmtVND(r.tienNuoc), fmtVND(r.giuXe), fmtVND(r.phuCapKhac), r.phatAmt ? '<span style="color:#c00">'+fmtVND(r.phatAmt)+'</span>' : '', fmtVND(r.totalTien), r.ghiChu||''].map((v,i) => `<td${i===2?' style="text-align:left"':i===21?' style="text-align:left;white-space:pre-line"':''}>${v??''}</td>`).join('')}</tr>`;
      }
      return `<tr class="sub">${tdC('')}${tdC('Tổng '+r.dept,' colspan="2" style="text-align:left"')}${tdC('')}${tdC('')}${tdC('')}${tdC('')}${tdC(r.days)}${tdC(fmtNum(r.cong))}${tdC(fmtNum(r.ot))}${tdC(fmtVND(r.leaders))}${tdC(r.cs||'')}${tdC(r.ct||'')}${tdC(r.cc||'')}${tdC(r.ctoi||'')}${tdC(fmtVND(r.xangXe))}${tdC(fmtVND(r.tienNuoc))}${tdC(fmtVND(r.giuXe))}${tdC(fmtVND(r.phuCapKhac))}${tdC(r.phat?'<span style="color:#c00">'+fmtVND(r.phat)+'</span>':'')}${tdC(fmtVND(r.total))}${tdC('')}</tr>`;
    };
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${yy} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Bảng Lương Tháng ${parseInt(mm,10)}-${yy}</title>
<style>
@page{size:A4 landscape;margin:8mm}
body{font-family:Arial,sans-serif;font-size:7.5pt;margin:0}
h2{text-align:center;font-size:10pt;margin:0 0 2px;text-transform:uppercase;letter-spacing:.05em}
.sub-title{text-align:center;font-size:7pt;color:#666;margin:0 0 8px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #b0b0b0;padding:2.5px 4px;text-align:center;vertical-align:middle}
th{background:#D9E1F2!important;print-color-adjust:exact;-webkit-print-color-adjust:exact;font-size:7.5pt}
tr.sub td{background:#FFF2CC!important;print-color-adjust:exact;-webkit-print-color-adjust:exact;font-weight:700}
tr.grand td{background:#BDD7EE!important;print-color-adjust:exact;-webkit-print-color-adjust:exact;font-weight:700;font-size:8pt}
</style></head><body>
<h2>Bảng Lương — Tháng ${parseInt(mm,10)}/${yy}</h2>
<p class="sub-title">Xuất lúc ${stamp}</p>
<table><thead><tr>${hdr.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>
${rows.map(renderRow).join('\n')}
<tr class="grand">${tdC('')}${tdC('TỔNG CỘNG',' colspan="2" style="text-align:left"')}${tdC('')}${tdC('')}${tdC('')}${tdC('')}${tdC(grand.days)}${tdC(fmtNum(grand.cong))}${tdC(fmtNum(grand.ot))}${tdC(fmtVND(grand.leaders))}${tdC(grand.cs||'')}${tdC(grand.ct||'')}${tdC(grand.cc||'')}${tdC(grand.ctoi||'')}${tdC(fmtVND(grand.xangXe))}${tdC(fmtVND(grand.tienNuoc))}${tdC(fmtVND(grand.giuXe))}${tdC(fmtVND(grand.phuCapKhac))}${tdC(grand.phat?'<span style="color:#c00">'+fmtVND(grand.phat)+'</span>':'')}${tdC(fmtVND(grand.total))}${tdC('')}</tr>
</tbody></table></body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Vui lòng cho phép popup để xuất PDF'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  }

  const thBase = { padding: isMobile ? '6px 8px' : '7px 12px', fontSize: isMobile ? '0.67rem' : '0.72rem', fontWeight: 700, color: '#7878a0', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' };
  const tdBase = { padding: isMobile ? '7px 8px' : '8px 12px', fontSize: isMobile ? '0.80rem' : '0.83rem', color: '#ddddf0', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' };

  return (
    <>
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
            <button onClick={() => setMonth(m => shiftMonth(m, 1))} disabled={month >= todayMonth()}
              style={{ padding: '6px 13px', border: 'none', background: 'transparent', color: month >= todayMonth() ? '#3a3a5a' : '#c8c8e0', cursor: month >= todayMonth() ? 'default' : 'pointer', fontSize: '1rem', fontWeight: 700, borderRadius: '6px' }}>›</button>
          </div>
          <input type="text" placeholder="Tìm theo tên..." value={filterName} onChange={e => setFilter(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#eeeef5', fontSize: '0.83rem', flex: 1, minWidth: '140px', outline: 'none' }} />
          {loading && <span style={{ color: '#7878a0', fontSize: '0.82rem' }}>⏳</span>}
          {error   && <span style={{ color: '#f87171', fontSize: '0.82rem' }}>⚠ {error}</span>}
          {canViewAll && (
            <>
              {canNgayPhep && (
                <button onClick={() => setShowNgayPhep(true)}
                  style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.1)', color: '#c9a84c', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', flexShrink: 0 }}>
                  📅 Ngày Phép
                </button>
              )}
              <button onClick={exportCongExcel} disabled={exporting || loading}
                style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(74,222,128,0.4)', background: exporting ? 'rgba(74,222,128,0.05)' : 'rgba(74,222,128,0.1)', color: '#4ade80', fontWeight: 700, fontSize: '0.83rem', cursor: exporting ? 'default' : 'pointer', flexShrink: 0 }}>
                {exporting ? '⏳ Đang xuất...' : '📥 Excel'}
              </button>
              <button onClick={exportCongPDF} disabled={loading}
                style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(251,146,60,0.4)', background: 'rgba(251,146,60,0.1)', color: '#fb923c', fontWeight: 700, fontSize: '0.83rem', cursor: loading ? 'default' : 'pointer', flexShrink: 0 }}>
                🖨️ PDF
              </button>
            </>
          )}
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
          const { cong, ot } = personTotals(personMap[name] || [], name);
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
                {!isMobile && <col style={{ width: '72px' }} />}
                {!isMobile && <col style={{ width: '80px' }} />}
              </colgroup>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
                  <th style={{ ...thBase }}>Tên Nhân Viên</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>Công</th>
                  <th style={{ ...thBase, textAlign: 'center' }}>{isMobile ? 'OT' : 'OT (giờ)'}</th>
                  {!isMobile && <th style={{ ...thBase, textAlign: 'center' }}>Leader</th>}
                  {!isMobile && <th style={{ ...thBase, textAlign: 'center' }}>Chi Tiết</th>}
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map(name => {
                  const entries = personMap[name] || [];
                  const { cong, ot } = personTotals(entries, name);
                  const confirmedCount = entries.filter(e => e.result).length;
                  const leaderCount = entries.reduce((sum, { report: r }) => {
                    const autoLeader = (r.leaders || []).includes(name) && (() => {
                      const phase = phaseDateMap[`${r.event_id}::${r.report_date}`] || detectPhase(r.event_label);
                      if (dept === 'Sân Khấu') return phase === 'setup' || phase === 'rehearsal';
                      if (dept === 'ATAS-LED' || dept === 'Kỹ Thuật') return phase === 'filming';
                      return false;
                    })();
                    return sum + getPersonLeader(r, name, autoLeader);
                  }, 0);
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
                              {isMobile && hasData && <div style={{ fontSize: '0.68rem', color: '#7878a0', marginTop: '1px' }}>{confirmedCount} Ngày{leaderCount > 0 ? ` · ${leaderCount} NT` : ''}</div>}
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
                          <td style={{ ...tdBase, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: leaderCount > 0 ? GOLD : '#555570' }}>
                            {leaderCount > 0 ? leaderCount : '—'}
                          </td>
                        )}
                        {!isMobile && (
                          <td style={{ ...tdBase, textAlign: 'center', color: '#7878a0', fontSize: '0.75rem' }}>
                            {hasData ? `${confirmedCount} Ngày` : '—'}
                          </td>
                        )}
                      </tr>

                      {/* Expanded detail */}
                      {isExp && (
                        <tr key={`${name}-detail`}>
                          <td colSpan={isMobile ? 3 : 5} style={{ padding: 0, background: 'rgba(255,255,255,0.012)', borderBottom: '2px solid rgba(201,168,76,0.15)' }}>
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
                                        {(() => {
                                          const mPhase = phaseDateMap[`${r.event_id}::${r.report_date}`] || detectPhase(r.event_label);
                                          const autoIsNT = (r.leaders || []).includes(name) && (
                                            dept === 'Sân Khấu' ? (mPhase === 'setup' || mPhase === 'rehearsal') :
                                            (dept === 'ATAS-LED' || dept === 'Kỹ Thuật') ? mPhase === 'filming' :
                                            false
                                          );
                                          const ntVal = getPersonLeader(r, name, autoIsNT);
                                          return ntVal > 0 ? <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(201,168,76,0.18)', color: GOLD, flexShrink: 0, border: '1px solid rgba(201,168,76,0.3)' }}>NT</span> : null;
                                        })()}
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
                                          <div style={{ marginBottom: '8px' }}>
                                            <div style={{ fontSize: '0.63rem', color: GOLD, fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Công &amp; Leader</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                              <div>
                                                <div style={{ fontSize: '0.63rem', color: '#9898b8', marginBottom: '3px' }}>Công (để trống = tự tính)</div>
                                                <input type="number" step="0.5" min="0" placeholder={preview ? String(preview.congRate) : 'Tự tính'} value={ed.cong_override} onChange={e => setEditRowData(d => ({ ...d, cong_override: e.target.value }))} style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '4px', color: '#eeeef5', padding: '3px 6px', fontSize: '0.76rem', outline: 'none', boxSizing: 'border-box' }} />
                                              </div>
                                              <div>
                                                <div style={{ fontSize: '0.63rem', color: '#9898b8', marginBottom: '3px' }}>Leader (để trống = tự tính)</div>
                                                <input type="number" min="0" placeholder="Tự tính" value={ed.leader_override} onChange={e => setEditRowData(d => ({ ...d, leader_override: e.target.value }))} style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '4px', color: '#eeeef5', padding: '3px 6px', fontSize: '0.76rem', outline: 'none', boxSizing: 'border-box' }} />
                                              </div>
                                            </div>
                                            <div style={{ fontSize: '0.63rem', color: GOLD, fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Phụ Cấp</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                              {[
                                                ['xang_xe', 'xang_xe_note', 'Xăng Xe'],
                                                ['tien_nuoc', 'tien_nuoc_note', 'Tiền Nước'],
                                                ['giu_xe', 'giu_xe_note', 'Giữ Xe'],
                                                ['phu_cap_khac', 'phu_cap_khac_note', 'Phụ Cấp Khác'],
                                              ].map(([amtKey, noteKey, label]) => (
                                                <div key={amtKey}>
                                                  <div style={{ fontSize: '0.63rem', color: '#9898b8', marginBottom: '3px' }}>{label}</div>
                                                  <input type="number" placeholder="Số tiền" value={ed[amtKey] || ''} onChange={e => setEditRowData(d => ({ ...d, [amtKey]: e.target.value }))} style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '4px', color: '#eeeef5', padding: '3px 6px', fontSize: '0.76rem', outline: 'none', boxSizing: 'border-box' }} />
                                                  <input placeholder="Ghi chú..." value={ed[noteKey] || ''} onChange={e => setEditRowData(d => ({ ...d, [noteKey]: e.target.value }))} style={{ marginTop: '3px', width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#c8c8e0', padding: '3px 6px', fontSize: '0.70rem', outline: 'none', boxSizing: 'border-box' }} />
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                          {preview && (
                                            <div style={{ fontSize: '0.76rem', color: '#a0a0c0', marginBottom: '8px' }}>
                                              Xem trước: <span style={{ color: GOLD, fontWeight: 700 }}>{fmtNum(preview.congRate)} công</span>
                                              {preview.otMins > 0 && <span style={{ color: '#60a5fa' }}> +{fmtMins(preview.otMins)} OT</span>}
                                            </div>
                                          )}
                                          <div style={{ display: 'flex', gap: '8px' }}>
                                            <button disabled={savingRow} onClick={() => saveEditRow(r, name)}
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
                                              <button onClick={e => { e.stopPropagation(); startEditRow(r, name); }}
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
                                      {['Ngày','Sự Kiện','Leader','Có Mặt','Kết Thúc','Giờ KM','N.Trưa','N.Chiều','Ngày Lễ','G.Thực','Công','OT', ...(canSuaCong ? [''] : [])].map((h, i) => (
                                        <th key={i} style={{ padding: '4px 7px', fontSize: '0.60rem', fontWeight: 700, color: '#7878a0', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: ['Leader','Có Mặt','Kết Thúc','Giờ KM','N.Trưa','N.Chiều','Ngày Lễ','G.Thực','Công','OT'].includes(h) ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sortedEntries.flatMap(({ report: r, result }) => {
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
                                      const rPhase = phaseDateMap[`${r.event_id}::${r.report_date}`] || detectPhase(r.event_label);
                                      const autoIsLeaderRow = (r.leaders || []).includes(name) && (
                                        dept === 'Sân Khấu' ? (rPhase === 'setup' || rPhase === 'rehearsal') :
                                        (dept === 'ATAS-LED' || dept === 'Kỹ Thuật') ? rPhase === 'filming' :
                                        false
                                      );
                                      const leaderRowVal = getPersonLeader(r, name, autoIsLeaderRow);
                                      const isLeaderRow = leaderRowVal > 0;
                                      const mainRow = (
                                        <tr key={r.id} style={{ background: isEditing ? 'rgba(201,168,76,0.04)' : isHol ? 'rgba(248,113,113,0.04)' : isSun ? 'rgba(96,165,250,0.04)' : undefined }}>
                                          <td style={dtd}>
                                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDate(r.report_date)}</span>
                                            <span style={{ marginLeft: '4px', fontSize: '0.68rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', background: isSun ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)', color: isSun ? '#60a5fa' : '#7878a0' }}>{dayTag}</span>
                                          </td>
                                          <td style={{ ...dtd, maxWidth: '180px' }}>
                                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px', color: '#c8c8e0', fontSize: '0.78rem' }}>{r.event_label || '—'}</span>
                                          </td>
                                          <td style={{ ...dtd, textAlign: 'center' }}>
                                            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: isLeaderRow ? GOLD : '#4a4a6a' }}>
                                              {isLeaderRow ? leaderRowVal : '—'}
                                            </span>
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
                                            {isEditing
                                              ? (ed.cong_override !== '' ? fmtNum(Number(ed.cong_override)) : (preview ? fmtNum(preview.congRate) : '—'))
                                              : (() => { const co = getPersonCong(r, name, result); return result ? fmtNum(co) : '—'; })()}
                                          </td>
                                          <td style={{ ...dtd, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: (isEditing ? preview : result)?.otHours > 0 ? '#60a5fa' : '#7878a0' }}>
                                            {(isEditing ? preview : result)?.otMins > 0 ? fmtMins((isEditing ? preview : result).otMins) : '—'}
                                          </td>
                                          {canSuaCong && (
                                            <td style={{ ...dtd, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                              {isEditing ? (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                  <button disabled={savingRow} onClick={() => saveEditRow(r, name)} style={{ padding: '2px 10px', borderRadius: '4px', border: 'none', cursor: savingRow ? 'wait' : 'pointer', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(201,168,76,0.25)', color: GOLD }}>{savingRow ? '...' : 'Lưu'}</button>
                                                  <button disabled={savingRow} onClick={() => setEditingRowId(null)} style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '0.72rem', background: 'transparent', color: '#7878a0' }}>Hủy</button>
                                                </div>
                                              ) : (
                                                <button onClick={() => startEditRow(r, name)} style={{ padding: '2px 10px', borderRadius: '4px', border: '1px solid rgba(201,168,76,0.3)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(201,168,76,0.08)', color: GOLD }}>Sửa</button>
                                              )}
                                            </td>
                                          )}
                                        </tr>
                                      );
                                      if (!isEditing) return [mainRow];
                                      const pcInpStyle = { width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '4px', color: '#eeeef5', padding: '3px 6px', fontSize: '0.73rem', outline: 'none', boxSizing: 'border-box' };
                                      const pcNoteStyle = { marginTop: '3px', width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#c8c8e0', padding: '3px 6px', fontSize: '0.70rem', outline: 'none', boxSizing: 'border-box' };
                                      return [
                                        mainRow,
                                        <tr key={`${r.id}-pc`}>
                                          <td colSpan={canSuaCong ? 13 : 12} style={{ padding: '10px 14px', background: 'rgba(201,168,76,0.03)', borderBottom: '2px solid rgba(201,168,76,0.15)' }}>
                                            <div style={{ fontSize: '0.65rem', color: GOLD, fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Công &amp; Leader</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '10px' }}>
                                              <div>
                                                <div style={{ fontSize: '0.65rem', color: '#9898b8', marginBottom: '4px' }}>Công (để trống = tự tính)</div>
                                                <input type="number" step="0.5" min="0" placeholder={preview ? String(preview.congRate) : 'Tự tính'} value={ed.cong_override} onChange={e => setEditRowData(d => ({ ...d, cong_override: e.target.value }))} style={pcInpStyle} />
                                              </div>
                                              <div>
                                                <div style={{ fontSize: '0.65rem', color: '#9898b8', marginBottom: '4px' }}>Leader (để trống = tự tính)</div>
                                                <input type="number" min="0" placeholder="Tự tính" value={ed.leader_override} onChange={e => setEditRowData(d => ({ ...d, leader_override: e.target.value }))} style={pcInpStyle} />
                                              </div>
                                            </div>
                                            <div style={{ fontSize: '0.65rem', color: GOLD, fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Phụ Cấp</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                                              {[
                                                ['xang_xe', 'xang_xe_note', 'Xăng Xe'],
                                                ['tien_nuoc', 'tien_nuoc_note', 'Tiền Nước'],
                                                ['giu_xe', 'giu_xe_note', 'Giữ Xe'],
                                                ['phu_cap_khac', 'phu_cap_khac_note', 'Phụ Cấp Khác'],
                                              ].map(([amtKey, noteKey, label]) => (
                                                <div key={amtKey}>
                                                  <div style={{ fontSize: '0.65rem', color: '#9898b8', marginBottom: '4px' }}>{label}</div>
                                                  <input type="number" placeholder="Số tiền" value={ed[amtKey] || ''} onChange={e => setEditRowData(d => ({ ...d, [amtKey]: e.target.value }))} style={pcInpStyle} />
                                                  <input placeholder="Ghi chú..." value={ed[noteKey] || ''} onChange={e => setEditRowData(d => ({ ...d, [noteKey]: e.target.value }))} style={pcNoteStyle} />
                                                </div>
                                              ))}
                                            </div>
                                          </td>
                                        </tr>,
                                      ];
                                    })}
                                  </tbody>
                                  <tfoot>
                                    <tr style={{ background: 'rgba(201,168,76,0.05)', borderTop: '1px solid rgba(201,168,76,0.12)' }}>
                                      <td colSpan={canSuaCong ? 11 : 10} style={{ padding: '5px 7px', fontSize: '0.68rem', fontWeight: 700, color: '#a08040', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Tổng · {confirmedCount} Ngày</td>
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
    {showNgayPhep && <NgayPhepModal month={month} onClose={() => setShowNgayPhep(false)} />}
    </>
  );
}
