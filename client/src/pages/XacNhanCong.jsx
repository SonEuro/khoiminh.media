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
    congRate = (isSunday || isHoliday) ? 1 : 0.5;
    otThresholdMins = 4 * 60 + 30; // ca chiều 13:00-17:30 = 4.5h
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
  const [violByName, setViolByName]   = useState({});
  const [salaryByName, setSalaryByName] = useState({});
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [filterName, setFilter]     = useState('');
  const [expanded, setExpanded]     = useState(new Set());
  const [toggling, setToggling]     = useState(new Set());
  const [isMobile, setIsMobile]     = useState(() => window.innerWidth < 768);
  const [exporting, setExporting]   = useState(false);
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
      setViolByName(data.violByName || {});
      setSalaryByName(data.salaryByName || {});
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
      ws.mergeCells('A1:R1');
      const titleCell = ws.getCell('A1');
      titleCell.value = titleText;
      titleCell.font = { bold: true, size: 13 };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.fill = white;
      ws.getRow(1).height = 28;

      // Header row — 18 cột
      const hdrRow = ws.addRow(['STT', 'Bộ Phận', 'Họ Tên', 'Lương Cơ Bản', 'Lương Ngày Công', 'Lương OT/h', 'Số Ngày', 'Tổng Công', 'Tổng OT (giờ)', 'Leader', 'C.Sáng', 'C.Trưa', 'C.Tối', 'C.Khuya', 'Nước', 'Xăng', 'Phạt BC', 'Tổng Số Tiền']);
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

      let stt = 0;
      let grandCongX = 0, grandOTX = 0, grandDays = 0, grandLeader = 0;
      let grandCS = 0, grandCT = 0, grandCC = 0, grandCToi = 0, grandNuoc = 0, grandTaxiAmt = 0;
      let grandPhat = 0, grandTotalTien = 0;
      const deptSubtotalRows = [];

      for (const g of kmGroups) {
        const deptMembers = g.members.filter(name => personMap[name]);
        if (!deptMembers.length) continue;

        let deptCong = 0, deptOT = 0, deptDays = 0, deptLeader = 0;
        let deptCS = 0, deptCT = 0, deptCC = 0, deptCToi = 0, deptNuoc = 0, deptTaxiAmt = 0;
        let deptPhat = 0, deptTotalTien = 0;
        let firstPersonRow = null;

        for (const name of deptMembers) {
          const entries = personMap[name] || [];
          const { cong, ot } = personTotals(entries);
          const days = entries.filter(e => e.result).length;
          const leaders = entries.filter(({ report }) => (report.leaders || []).includes(name)).length;
          const cs   = entries.filter(({ report: r }) => r.has_com_sang).length;
          const ct   = entries.filter(({ report: r }) => r.has_com_trua).length;
          const cc   = entries.filter(({ report: r }) => r.has_com_chieu).length;  // C.Tối
          const ctoi = entries.filter(({ report: r }) => r.has_com_toi).length;    // C.Khuya
          const nuoc = entries.filter(({ report: r }) => r.has_nuoc && (r.leaders || []).includes(name)).length;
          const taxiAmt = entries.reduce((sum, { report: r }) => {
            if (!r.has_taxi) return sum;
            const v = parseFloat(r.taxi_amount || '0');
            return sum + (isNaN(v) ? 0 : v);
          }, 0);
          const violCount = violByName[name] || 0;
          const phatAmt = violCount * VIOL_PENALTY;
          const sal = salaryByName[name] || { lcb: 0, lnc: 0, lot: 0 };
          const salaryPart = (sal.lcb || 0) + sal.lnc * cong + sal.lot * ot;
          const totalTien = salaryPart + leaders * RATES.leader + cs * RATES.cs + ct * RATES.ct + cc * RATES.cc + ctoi * RATES.ctoi + taxiAmt - phatAmt;
          if (!days && !cong) continue;
          stt++;
          const row = ws.addRow([
            stt, g.dept, name,
            sal.lcb || '', sal.lnc || '', sal.lot || '',
            days, parseFloat(fmtNum(cong)), parseFloat(fmtNum(ot)),
            leaders || '', cs || '', ct || '', cc || '', ctoi || '', nuoc || '',
            taxiAmt || '',  // P: số tiền xăng (để công thức R dùng được)
            phatAmt > 0 ? phatAmt : '',
            '',             // R: set bằng formula bên dưới
          ]);
          const r = row.number;
          if (firstPersonRow === null) firstPersonRow = r;
          // Công thức: LCB + LNC×Công + LOT×OT + Leader×200k + CS×40k + CT×30k + CC×30k + CKhuya×40k + Xăng − Phạt
          row.getCell(18).value = {
            formula: `=D${r}+E${r}*H${r}+F${r}*I${r}+J${r}*200000+K${r}*40000+L${r}*30000+M${r}*30000+N${r}*40000+P${r}-Q${r}`,
            result: totalTien,
          };
          row.eachCell(cell => { cell.fill = white; cell.border = border; cell.alignment = { horizontal: 'center' }; });
          row.getCell(3).alignment = { horizontal: 'left' };
          if (sal.lcb) { row.getCell(4).numFmt = vndFmt; row.getCell(5).numFmt = vndFmt; row.getCell(6).numFmt = vndFmt; }
          if (taxiAmt > 0) row.getCell(16).numFmt = vndFmt;
          if (phatAmt > 0) { row.getCell(17).numFmt = vndFmt; row.getCell(17).font = { color: { argb: 'FFCC0000' } }; }
          row.getCell(18).numFmt = vndFmt;
          deptCong += cong; deptOT += ot; deptDays += days; deptLeader += leaders;
          deptCS += cs; deptCT += ct; deptCC += cc; deptCToi += ctoi; deptNuoc += nuoc; deptTaxiAmt += taxiAmt;
          deptPhat += phatAmt; deptTotalTien += totalTien;
        }

        const deptEndRow = ws.rowCount;
        if (firstPersonRow !== null && deptEndRow >= firstPersonRow) {
          grandCongX += deptCong; grandOTX += deptOT; grandDays += deptDays; grandLeader += deptLeader;
          grandCS += deptCS; grandCT += deptCT; grandCC += deptCC; grandCToi += deptCToi; grandNuoc += deptNuoc; grandTaxiAmt += deptTaxiAmt;
          grandPhat += deptPhat; grandTotalTien += deptTotalTien;
          const subRow = ws.addRow(['', `Tổng ${g.dept}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
          const sr = subRow.number;
          deptSubtotalRows.push(sr);
          // SUM formulas cho cột G(7) đến R(18)
          const sCols = ['G','H','I','J','K','L','M','N','O','P','Q','R'];
          const sVals = [deptDays, parseFloat(fmtNum(deptCong)), parseFloat(fmtNum(deptOT)), deptLeader, deptCS, deptCT, deptCC, deptCToi, deptNuoc, deptTaxiAmt, deptPhat, deptTotalTien];
          sCols.forEach((col, i) => {
            subRow.getCell(7 + i).value = { formula: `=SUM(${col}${firstPersonRow}:${col}${deptEndRow})`, result: sVals[i] || 0 };
          });
          subRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FF000000' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
            cell.border = border;
            cell.alignment = { horizontal: 'center' };
          });
          subRow.getCell(2).alignment = { horizontal: 'left' };
          if (deptTaxiAmt > 0) subRow.getCell(16).numFmt = vndFmt;
          if (deptPhat > 0) { subRow.getCell(17).numFmt = vndFmt; subRow.getCell(17).font = { bold: true, color: { argb: 'FFCC0000' } }; }
          subRow.getCell(18).numFmt = vndFmt;
        }
      }

      // Grand total
      ws.addRow([]);
      const totalRow = ws.addRow(['', 'TỔNG CỘNG', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
      if (deptSubtotalRows.length > 0) {
        const tCols = ['G','H','I','J','K','L','M','N','O','P','Q','R'];
        const tVals = [grandDays, parseFloat(fmtNum(grandCongX)), parseFloat(fmtNum(grandOTX)), grandLeader, grandCS, grandCT, grandCC, grandCToi, grandNuoc, grandTaxiAmt, grandPhat, grandTotalTien];
        tCols.forEach((col, i) => {
          const formula = deptSubtotalRows.map(r => `${col}${r}`).join('+');
          totalRow.getCell(7 + i).value = { formula: `=${formula}`, result: tVals[i] || 0 };
        });
      }
      totalRow.eachCell(cell => {
        cell.font = { bold: true, size: 11, color: { argb: 'FF000000' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };
        cell.alignment = { horizontal: 'center' };
        cell.border = borderMedium;
      });
      totalRow.getCell(2).alignment = { horizontal: 'left' };
      if (grandTaxiAmt > 0) totalRow.getCell(16).numFmt = vndFmt;
      if (grandPhat > 0) { totalRow.getCell(17).numFmt = vndFmt; totalRow.getCell(17).font = { bold: true, size: 11, color: { argb: 'FFCC0000' } }; }
      totalRow.getCell(18).numFmt = vndFmt;

      ws.columns = [
        { width: 6 }, { width: 18 }, { width: 24 },
        { width: 14 }, { width: 16 }, { width: 12 },
        { width: 10 }, { width: 12 }, { width: 14 }, { width: 10 },
        { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 8 }, { width: 10 }, { width: 12 }, { width: 16 },
      ];

      // ── Sheet 2: Chi Tiết ──
      const ws2 = wb.addWorksheet('Chi Tiết');
      ws2.mergeCells('A1:R1');
      const title2 = ws2.getCell('A1');
      title2.value = `CHI TIẾT NGÀY CÔNG — THÁNG ${parseInt(mm, 10)}/${yy}`;
      title2.font = { bold: true, size: 13 };
      title2.alignment = { horizontal: 'center', vertical: 'middle' };
      title2.fill = white;
      ws2.getRow(1).height = 28;

      const hdr2 = ws2.addRow(['STT', 'Họ Tên', 'Bộ Phận', 'Ngày', 'Thứ', 'Sự Kiện', 'Leader', 'Có Mặt', 'Kết Thúc', 'G.Thực', 'Công', 'OT (h)', 'C.Sáng', 'C.Trưa', 'C.Chiều', 'C.Tối', 'Nước', 'Taxi/Xăng']);
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
            const isLeaderVal = (r.leaders || []).includes(name) ? 1 : '';
            const [ry, rmx, rday] = r.report_date.split('-');
            const yesNo = v => v ? '✓' : '';
            const row2 = ws2.addRow([
              stt2, name, g2.dept,
              `${rday}/${rmx}/${ry}`, dayLabel(r.report_date),
              r.event_label || '—', isLeaderVal,
              r.time_present || '—', r.time_end || '—',
              result ? fmtMins(Math.max(0, result.effectiveMins)) : 'Chưa XN',
              result ? parseFloat(fmtNum(result.congRate)) : '',
              result?.otMins > 0 ? parseFloat((result.otMins / 60).toFixed(2)) : '',
              yesNo(r.has_com_sang), yesNo(r.has_com_trua), yesNo(r.has_com_chieu),
              yesNo(r.has_com_toi), yesNo(r.has_nuoc),
              r.has_taxi ? (r.taxi_amount || '✓') : '',
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
        { width: 8 }, { width: 8 }, { width: 10 },
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
    const fmtVND = n => n ? Math.round(n).toLocaleString('vi-VN') : '';

    let stt = 0;
    const rows = [];

    for (const g of kmGroups) {
      const deptMembers = g.members.filter(name => personMap[name]);
      if (!deptMembers.length) continue;
      let deptCong = 0, deptOT = 0, deptDays = 0, deptLeader = 0;
      let deptCS = 0, deptCT = 0, deptCC = 0, deptCToi = 0, deptNuoc = 0, deptTaxiAmt = 0;
      let deptPhat = 0, deptTotalTien = 0;
      let hasDept = false;

      for (const name of deptMembers) {
        const entries = personMap[name] || [];
        const { cong, ot } = personTotals(entries);
        const days = entries.filter(e => e.result).length;
        if (!days && !cong) continue;
        const leaders  = entries.filter(({ report: r }) => (r.leaders || []).includes(name)).length;
        const cs       = entries.filter(({ report: r }) => r.has_com_sang).length;
        const ct       = entries.filter(({ report: r }) => r.has_com_trua).length;
        const cc       = entries.filter(({ report: r }) => r.has_com_chieu).length;
        const ctoi     = entries.filter(({ report: r }) => r.has_com_toi).length;
        const nuoc     = entries.filter(({ report: r }) => r.has_nuoc && (r.leaders || []).includes(name)).length;
        const taxiAmt  = entries.reduce((s, { report: r }) => { if (!r.has_taxi) return s; const v = parseFloat(r.taxi_amount || '0'); return s + (isNaN(v) ? 0 : v); }, 0);
        const phatAmt  = (violByName[name] || 0) * VIOL_PENALTY;
        const sal      = salaryByName[name] || { lcb: 0, lnc: 0, lot: 0 };
        const totalTien = (sal.lcb || 0) + sal.lnc * cong + sal.lot * ot + leaders * RATES.leader + cs * RATES.cs + ct * RATES.ct + cc * RATES.cc + ctoi * RATES.ctoi + taxiAmt - phatAmt;
        stt++; hasDept = true;
        rows.push({ type: 'person', stt, dept: g.dept, name, sal, days, cong, ot, leaders, cs, ct, cc, ctoi, nuoc, taxiAmt, phatAmt, totalTien });
        deptCong += cong; deptOT += ot; deptDays += days; deptLeader += leaders;
        deptCS += cs; deptCT += ct; deptCC += cc; deptCToi += ctoi; deptNuoc += nuoc; deptTaxiAmt += taxiAmt;
        deptPhat += phatAmt; deptTotalTien += totalTien;
      }
      if (hasDept) rows.push({ type: 'sub', dept: g.dept, days: deptDays, cong: deptCong, ot: deptOT, leaders: deptLeader, cs: deptCS, ct: deptCT, cc: deptCC, ctoi: deptCToi, nuoc: deptNuoc, taxiAmt: deptTaxiAmt, phat: deptPhat, total: deptTotalTien });
    }
    const grand = rows.filter(r => r.type === 'sub').reduce((acc, r) => {
      acc.days += r.days; acc.cong += r.cong; acc.ot += r.ot; acc.leaders += r.leaders;
      acc.cs += r.cs; acc.ct += r.ct; acc.cc += r.cc; acc.ctoi += r.ctoi; acc.nuoc += r.nuoc;
      acc.taxiAmt += r.taxiAmt; acc.phat += r.phat; acc.total += r.total; return acc;
    }, { days:0, cong:0, ot:0, leaders:0, cs:0, ct:0, cc:0, ctoi:0, nuoc:0, taxiAmt:0, phat:0, total:0 });

    const hdr = ['STT','Bộ Phận','Họ Tên','Lương CB','LNC/ngày','LOT/h','Ngày','Công','OT(h)','Leader','C.Sáng','C.Trưa','C.Tối','C.Khuya','Nước','Xăng Xe','Phạt BC','Tổng Lương'];
    const tdC = (v, extra='') => `<td${extra}>${v ?? ''}</td>`;
    const renderRow = r => {
      if (r.type === 'person') {
        return `<tr>${[r.stt, r.dept, r.name, fmtVND(r.sal.lcb), fmtVND(r.sal.lnc), fmtVND(r.sal.lot), r.days, fmtNum(r.cong), fmtNum(r.ot), r.leaders||'', r.cs||'', r.ct||'', r.cc||'', r.ctoi||'', r.nuoc||'', fmtVND(r.taxiAmt), r.phatAmt ? '<span style="color:#c00">'+fmtVND(r.phatAmt)+'</span>' : '', fmtVND(r.totalTien)].map((v,i) => `<td${i===2?' style="text-align:left"':''}>${v??''}</td>`).join('')}</tr>`;
      }
      return `<tr class="sub">${tdC('')}${tdC('Tổng '+r.dept,' colspan="2" style="text-align:left"')}${tdC('')}${tdC('')}${tdC('')}${tdC(r.days)}${tdC(fmtNum(r.cong))}${tdC(fmtNum(r.ot))}${tdC(r.leaders||'')}${tdC(r.cs||'')}${tdC(r.ct||'')}${tdC(r.cc||'')}${tdC(r.ctoi||'')}${tdC(r.nuoc||'')}${tdC(fmtVND(r.taxiAmt))}${tdC(r.phat?'<span style="color:#c00">'+fmtVND(r.phat)+'</span>':'')}${tdC(fmtVND(r.total))}</tr>`;
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
<tr class="grand">${tdC('')}${tdC('TỔNG CỘNG',' colspan="2" style="text-align:left"')}${tdC('')}${tdC('')}${tdC('')}${tdC(grand.days)}${tdC(fmtNum(grand.cong))}${tdC(fmtNum(grand.ot))}${tdC(grand.leaders||'')}${tdC(grand.cs||'')}${tdC(grand.ct||'')}${tdC(grand.cc||'')}${tdC(grand.ctoi||'')}${tdC(grand.nuoc||'')}${tdC(fmtVND(grand.taxiAmt))}${tdC(grand.phat?'<span style="color:#c00">'+fmtVND(grand.phat)+'</span>':'')}${tdC(fmtVND(grand.total))}</tr>
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
          {canViewAll && (
            <>
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
                  const { cong, ot } = personTotals(entries);
                  const confirmedCount = entries.filter(e => e.result).length;
                  const leaderCount = entries.filter(({ report }) => (report.leaders || []).includes(name)).length;
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
                                        {(r.leaders || []).includes(name) && (
                                          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(201,168,76,0.18)', color: GOLD, flexShrink: 0, border: '1px solid rgba(201,168,76,0.3)' }}>NT</span>
                                        )}
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
                                      {['Ngày','Sự Kiện','Leader','Có Mặt','Kết Thúc','Giờ KM','N.Trưa','N.Chiều','Ngày Lễ','G.Thực','Công','OT', ...(canSuaCong ? [''] : [])].map((h, i) => (
                                        <th key={i} style={{ padding: '4px 7px', fontSize: '0.60rem', fontWeight: 700, color: '#7878a0', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: ['Leader','Có Mặt','Kết Thúc','Giờ KM','N.Trưa','N.Chiều','Ngày Lễ','G.Thực','Công','OT'].includes(h) ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
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
                                            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: (r.leaders || []).includes(name) ? GOLD : '#555570' }}>
                                              {(r.leaders || []).includes(name) ? '1' : '—'}
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
  );
}
