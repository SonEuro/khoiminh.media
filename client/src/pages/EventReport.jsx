import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { KM_STAFF_GROUPS } from '../constants/staff';
import FreelancerPicker from '../components/FreelancerPicker';

const GOLD = '#c9a84c';

const DEPT_COLORS = {
  'ATAS-LED': '#a78bfa',
  'Sân Khấu':          '#fb923c',
  'Kỹ Thuật':          '#38bdf8',
  'Cơ Sở Vật Chất':   '#4ade80',
  'Kế Toán':           '#fbbf24',
  'Kinh Doanh':        '#f472b6',
  'Quay Phim':         '#e879f9',
  'Sản Xuất':          '#34d399',
};
function getDeptColor(dept) { return DEPT_COLORS[dept] || '#7878a0'; }

// Hiển thị dept nhất quán với Users.jsx ROLES array
const ROLE_DEPT_LABEL = {
  DIRECTOR:    'Tổng Giám Đốc',
  SUPER_ADMIN: 'Giám Đốc Sản Xuất',
  PRODUCTION:  'Bộ Phận Sản Xuất',
  ACCOUNTING:  'Kế Toán',
  TECHNICAL:   'Kỹ Thuật',
  ATAS:        'ATAS-LED',
  STAGE:       'Sân Khấu',
  CSVC:        'Cơ Sở Vật Chất',
};

// Mapping role → tên dept trong KM_STAFF_GROUPS (dùng để filter nhân sự khi auto-load)
const ROLE_TO_KM_DEPT = {
  ATAS:       'ATAS-LED',
  STAGE:      'Sân Khấu',
  TECHNICAL:  'Kỹ Thuật',
  CSVC:       'Cơ Sở Vật Chất',
  ACCOUNTING: 'Kế Toán',
  PRODUCTION: 'Kinh Doanh',
};

function getUserKmDept(user) {
  return KM_STAFF_GROUPS.find(g => g.members.includes(user?.full_name || ''))?.dept
    || ROLE_TO_KM_DEPT[user?.role]
    || '—';
}

// Cho phép report_date = ngày làm việc HOẶC ngày hôm sau (±1 ngày)
function dateMatchesSched(schedDate, reportDate) {
  if (schedDate === reportDate) return true;
  const [y, m, d] = schedDate.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  return nextStr === reportDate;
}

const PROGRESS_CHIPS   = ['Đúng tiến độ', 'Trễ tiến độ'];
const COMPLETED_CHIPS  = ['Hoàn thành', 'Chưa hoàn thành'];
const QUALITY_CHIPS    = ['Xuất sắc', 'Cần cải thiện'];

// Hỗ trợ cả format cũ (string URL) và mới ({url, thumb})
function imgUrl(src)   { return (src && typeof src === 'object') ? src.url   : src; }
function imgThumb(src) { return (src && typeof src === 'object') ? src.thumb : src; }

function resizeImage(file, maxPx = 1000) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width: w, height: h } = img;
      if (w > maxPx || h > maxPx) {
        if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else       { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.src = url;
  });
}

// ── Chip suggestions ─────────────────────────────────────────────────────────
function ChipInput({ label, value, onChange, chips, placeholder }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        className="input"
        placeholder={placeholder || 'Nhập hoặc chọn bên dưới...'}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginTop:'6px' }}>
        {chips.map(c => (
          <button key={c} type="button"
            onClick={() => onChange(c)}
            style={{
              padding:'4px 10px', borderRadius:'9999px', fontSize:'0.84rem', fontWeight:600,
              border: value === c ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.12)',
              background: value === c ? GOLD : 'rgba(255,255,255,0.05)',
              color: value === c ? '#08080e' : '#a0a0b8',
              cursor:'pointer', transition:'all 0.15s',
            }}
          >{c}</button>
        ))}
      </div>
    </div>
  );
}

// ── Staff dropdown ────────────────────────────────────────────────────────────
function StaffSelect({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function toggle(name) {
    onChange(selected.includes(name) ? selected.filter(s => s !== name) : [...selected, name]);
  }

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <label style={labelStyle}>Nhân Sự Khôi Minh</label>

      {/* Trigger button */}
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{
          width:'100%', textAlign:'left', padding:'9px 12px',
          background:'rgba(255,255,255,0.04)', border:'1px solid rgba(201,168,76,0.3)',
          borderRadius:'8px', fontSize:'0.875rem', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          color: selected.length ? '#e8c97a' : '#7878a0',
        }}
      >
        <span>
          {selected.length === 0 ? 'Chọn nhân sự...' : `Đã chọn ${selected.length} người`}
        </span>
        <span style={{ color: GOLD, fontSize:'0.82rem' }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Selected pills (always visible below trigger) */}
      {selected.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:'5px', marginTop:'6px' }}>
          {selected.map(s => (
            <span key={s} style={{
              display:'inline-flex', alignItems:'center', gap:'4px',
              padding:'3px 8px', borderRadius:'9999px',
              background:'rgba(201,168,76,0.12)', border:'1px solid rgba(201,168,76,0.35)',
              color: GOLD, fontSize:'0.84rem', fontWeight:600,
            }}>
              {s}
              <button type="button" onClick={() => toggle(s)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#f87171', fontSize:'0.84rem', lineHeight:1, padding:0 }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:300,
          background:'#13131d', border:'1px solid rgba(201,168,76,0.3)',
          borderRadius:'10px', boxShadow:'0 10px 30px rgba(0,0,0,0.7)',
          maxHeight:'300px', overflowY:'auto',
        }}>
          {KM_STAFF_GROUPS.map((g, gi) => (
            <div key={g.dept} style={{ borderBottom: gi < KM_STAFF_GROUPS.length - 1 ? '1px solid rgba(201,168,76,0.08)' : 'none' }}>
              <div style={{
                padding:'6px 14px', fontSize:'0.80rem', fontWeight:800, letterSpacing:'0.1em',
                color: GOLD, background:'rgba(201,168,76,0.04)',
                display:'flex', alignItems:'center', justifyContent:'space-between',
              }}>
                <span>{g.dept.toUpperCase()}</span>
                <button type="button"
                  onClick={() => {
                    const allIn = g.members.every(m => selected.includes(m));
                    if (allIn) onChange(selected.filter(s => !g.members.includes(s)));
                    else onChange([...new Set([...selected, ...g.members])]);
                  }}
                  style={{ fontSize:'0.80rem', color:'#7878a0', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                  {g.members.every(m => selected.includes(m)) ? 'Bỏ tất cả' : 'Chọn tất cả'}
                </button>
              </div>
              {g.members.map(m => {
                const active = selected.includes(m);
                return (
                  <label key={m} style={{
                    display:'flex', alignItems:'center', gap:'10px',
                    padding:'8px 14px', cursor:'pointer',
                    background: active ? 'rgba(201,168,76,0.08)' : 'transparent',
                    transition:'background 0.1s',
                  }}>
                    <input type="checkbox" checked={active} onChange={() => toggle(m)}
                      style={{ accentColor: GOLD, width:'15px', height:'15px', flexShrink:0 }} />
                    <span style={{ fontSize:'0.83rem', color: active ? '#e8c97a' : '#a0a0b8', fontWeight: active ? 600 : 400 }}>
                      {m}
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const labelStyle = {
  display:'block', fontSize:'0.84rem', fontWeight:700,
  color: GOLD, letterSpacing:'0.06em', marginBottom:'5px',
  textTransform:'uppercase',
};

const sectionStyle = {
  background:'#13131d', border:'1px solid rgba(201,168,76,0.15)',
  borderRadius:'12px', padding:'20px', marginBottom:'16px',
};

// ── Time input: gõ liên tục 4 số → tự format HH:MM ──────────────────────────
function TimeInput({ value, onChange, hasError }) {
  const [raw, setRaw] = useState(() => (value || '').replace(/\D/g, '').slice(0, 4));

  useEffect(() => {
    setRaw((value || '').replace(/\D/g, '').slice(0, 4));
  }, [value]);

  // Hiển thị: chèn ':' sau 2 chữ số đầu
  const display = raw.length > 2 ? `${raw.slice(0,2)}:${raw.slice(2)}` : raw;

  function apply(r) {
    // Cap hh ≤ 23
    if (r.length >= 2 && parseInt(r.slice(0,2), 10) > 23) r = '23' + r.slice(2);
    // Cap mm ≤ 59
    if (r.length >= 4 && parseInt(r.slice(2,4), 10) > 59) r = r.slice(0,2) + '59';
    if (r.length > 4) r = r.slice(0,4);
    setRaw(r);
    onChange(r ? `${r.slice(0,2)}:${r.slice(2,4)}` : '');
  }

  function onKeyDown(e) {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      if (raw.length < 4) apply(raw + e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      apply(raw.slice(0, -1));
    } else if (!['Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
      e.preventDefault();
    }
  }

  return (
    <input
      type="text" inputMode="numeric" className="input"
      value={display} placeholder="hh:mm"
      onKeyDown={onKeyDown}
      onChange={() => {}}
      onFocus={e => setTimeout(() => e.target.select(), 0)}
      style={hasError ? { border:'1px solid #f87171' } : {}}
    />
  );
}

// ── Shared helper ────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0].slice(2,4)}`;
  return d;
};

// lateness: đúng hẹn nếu nộp trước 12:00 hôm sau, trễ nếu 12:00–23:59, quá hạn nếu sau 23:59
function getReportLateness(reportDate, createdAt, obligationDeadline) {
  if (!obligationDeadline || !createdAt) return null;
  const sub = createdAt.slice(0, 16);
  const [y, m, d] = reportDate.split('-').map(Number);
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
  const hardDeadline = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDay.getUTCDate()).padStart(2, '0')} 23:59`;
  if (sub > hardDeadline) return 'qua_han';
  if (sub > obligationDeadline) return 'nop_tre';
  return null;
}

// Cho phép chỉnh sửa đến report_date + 1 ngày 21:00 VN
function withinEditDeadline(reportDate) {
  if (!reportDate) return false;
  const [y, m, d] = reportDate.split('-').map(Number);
  const deadlineUTC = new Date(Date.UTC(y, m - 1, d + 1, 14, 0, 0)); // 21:00 VN = 14:00 UTC
  return Date.now() <= deadlineUTC.getTime();
}

// ── Report detail card ────────────────────────────────────────────────────────
function ReportCard({ report, onDelete, onEdit, onConfirm, isSuperAdmin, hideEventName = false, hideDateRow = false, highlightId }) {
  const isHighlight = highlightId && String(report.id) === String(highlightId);
  const [expanded, setExpanded] = useState(isHighlight);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!isHighlight || !cardRef.current) return;
    const t = setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 500);
    return () => clearTimeout(t);
  }, [isHighlight]);
  const [fullData, setFullData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [imgIdx, setImgIdx] = useState(null);
  const [imgScale, setImgScale] = useState(1);
  const [imgTranslate, setImgTranslate] = useState({ x: 0, y: 0 });
  const [confirming, setConfirming] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState(report.confirmed_at || null);
  const { user: currentUser } = useAuth();
  const lightboxImgRef = useRef(null);
  const lightboxRef    = useRef(null);
  const imgScaleRef    = useRef(1);
  const imgTranslateRef = useRef({ x: 0, y: 0 });
  const wasDraggingRef  = useRef(false);

  const detail = fullData || report;

  const reporterDept = KM_STAFF_GROUPS.find(g => g.members.includes(report.reporter_name))?.dept;
  const lateness = getReportLateness(report.report_date, report.created_at, report.obligation_deadline);
  const canViewAllDepts = ['SUPER_ADMIN', 'DIRECTOR'].includes(currentUser?.role) || !!currentUser?.is_phan_lich_all;

  async function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && !fullData && !loadingDetail) {
      setLoadingDetail(true);
      try { setFullData(await api.getEventReport(report.id)); }
      catch { /* dùng slim data làm fallback */ }
      finally { setLoadingDetail(false); }
    }
  }

  // Reset zoom + pan khi chuyển ảnh
  useEffect(() => {
    imgScaleRef.current = 1;
    imgTranslateRef.current = { x: 0, y: 0 };
    setImgScale(1);
    setImgTranslate({ x: 0, y: 0 });
  }, [imgIdx]);

  // Pinch-to-zoom + single-finger pan (touch) + wheel zoom + mouse drag (desktop)
  useEffect(() => {
    const el  = lightboxImgRef.current;
    const box = lightboxRef.current;
    if (!el || !box || imgIdx === null) return;

    // ── TOUCH ──────────────────────────────────────────────────────────
    let startDist = null, startScale = 1;
    let panStart = null, panTx = 0, panTy = 0;

    function onTouchStart(e) {
      if (e.touches.length === 2) {
        startDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        startScale = imgScaleRef.current;
        panStart = null;
      } else if (e.touches.length === 1 && imgScaleRef.current > 1) {
        panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        panTx = imgTranslateRef.current.x;
        panTy = imgTranslateRef.current.y;
      }
    }
    function onTouchMove(e) {
      if (e.touches.length === 2 && startDist) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const s = Math.min(8, Math.max(1, startScale * (dist / startDist)));
        imgScaleRef.current = s;
        setImgScale(s);
      } else if (e.touches.length === 1 && panStart) {
        e.preventDefault();
        const tx = panTx + e.touches[0].clientX - panStart.x;
        const ty = panTy + e.touches[0].clientY - panStart.y;
        imgTranslateRef.current = { x: tx, y: ty };
        setImgTranslate({ x: tx, y: ty });
      }
    }
    function onTouchEnd() { startDist = null; panStart = null; }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });

    // ── MOUSE WHEEL zoom ───────────────────────────────────────────────
    function onWheel(e) {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top  + rect.height / 2);
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newScale = Math.min(8, Math.max(1, imgScaleRef.current * factor));
      const ratio = newScale / imgScaleRef.current;
      const tx = imgTranslateRef.current.x + cx * (1 - ratio);
      const ty = imgTranslateRef.current.y + cy * (1 - ratio);
      imgScaleRef.current = newScale;
      imgTranslateRef.current = { x: tx, y: ty };
      setImgScale(newScale);
      setImgTranslate({ x: tx, y: ty });
      if (newScale === 1) { imgTranslateRef.current = { x: 0, y: 0 }; setImgTranslate({ x: 0, y: 0 }); }
    }
    box.addEventListener('wheel', onWheel, { passive: false });

    // ── MOUSE DRAG pan ─────────────────────────────────────────────────
    let dragging = false, mStartX = 0, mStartY = 0, mTx = 0, mTy = 0;

    function onMouseDown(e) {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      wasDraggingRef.current = false;
      mStartX = e.clientX; mStartY = e.clientY;
      mTx = imgTranslateRef.current.x; mTy = imgTranslateRef.current.y;
      el.style.cursor = 'grabbing';
    }
    function onMouseMove(e) {
      if (!dragging) return;
      const dx = e.clientX - mStartX, dy = e.clientY - mStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDraggingRef.current = true;
      const tx = mTx + dx, ty = mTy + dy;
      imgTranslateRef.current = { x: tx, y: ty };
      setImgTranslate({ x: tx, y: ty });
    }
    function onMouseUp() {
      dragging = false;
      el.style.cursor = imgScaleRef.current > 1 ? 'grab' : 'default';
    }

    el.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
      box.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };
  }, [imgIdx]);

  async function handleConfirm(e) {
    e.stopPropagation();
    setConfirming(true);
    try {
      const res = await api.confirmEventReport(report.id);
      setConfirmedAt(res.confirmed_at || new Date().toISOString());
    } catch (err) {
      alert('Lỗi xác nhận: ' + (err.message || err));
    } finally { setConfirming(false); }
  }

  return (
    <div ref={cardRef} style={{
      background: hideEventName ? 'rgba(255,255,255,0.03)' : '#13131d',
      border: isHighlight ? '2px solid #c9a84c' : hideEventName ? '1px solid rgba(201,168,76,0.28)' : '1px solid rgba(201,168,76,0.42)',
      borderRadius: hideEventName ? '10px' : '12px',
      overflow:'hidden',
      marginBottom: hideEventName ? '8px' : '12px',
      boxShadow: isHighlight ? '0 0 16px rgba(201,168,76,0.35)' : 'none',
    }}>
      {/* Header */}
      <div
        onClick={handleExpand}
        style={{
          padding:'12px 16px', cursor:'pointer',
          borderBottom: expanded ? '1px solid rgba(201,168,76,0.15)' : 'none',
        }}
      >
        {!hideEventName && (
          <p style={{ fontWeight:700, color:'#e8c97a', fontSize:'1.0rem', margin:'0 0 6px' }}>
            {report.event_label || 'Sự kiện không rõ'}
          </p>
        )}
        {(report.location || (!hideDateRow && report.report_date)) && (
          <div style={{ fontSize:'0.80rem', marginBottom:'6px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
            {report.location && <span style={{ color:'#60a5fa', fontWeight:600 }}>📍 {report.location}</span>}
            {!hideDateRow && report.report_date && <span style={{ color:'#7878a0' }}>📅 {fmtDate(report.report_date)}</span>}
          </div>
        )}
        {/* Hàng 1: tên + bộ phận + nhãn trễ */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
          {report.reporter_name && (
            <span style={{ fontWeight:700, color:'#e8c97a', fontSize:'0.88rem' }}>{report.reporter_name}</span>
          )}
          {reporterDept && (
            <span style={{ fontSize:'0.80rem', fontWeight:600, color: getDeptColor(reporterDept) }}>{reporterDept}</span>
          )}
          {lateness === 'qua_han' && (
            <span style={{ fontSize:'0.76rem', fontWeight:700, color:'#f87171', background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.4)', borderRadius:'5px', padding:'1px 7px' }}>Quá hạn</span>
          )}
          {lateness === 'nop_tre' && (
            <span style={{ fontSize:'0.76rem', fontWeight:700, color:'#fb923c', background:'rgba(251,146,60,0.15)', border:'1px solid rgba(251,146,60,0.4)', borderRadius:'5px', padding:'1px 7px' }}>Nộp trễ</span>
          )}
        </div>
        {/* Hàng 2: nộp lúc + xác nhận + icons + expand */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'5px' }}>
          {canViewAllDepts && confirmedAt && (
            <span style={{ fontSize:'0.76rem', fontWeight:700, color:'#4ade80', background:'rgba(74,222,128,0.12)', border:'1px solid rgba(74,222,128,0.35)', borderRadius:'5px', padding:'1px 7px', flexShrink:0 }}>✓ Xác nhận</span>
          )}
          {canViewAllDepts && !confirmedAt && (
            <button type="button" onClick={handleConfirm} disabled={confirming}
              style={{ fontSize:'0.76rem', fontWeight:700, color:'#7878a0', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'5px', padding:'1px 7px', cursor:'pointer', flexShrink:0, opacity: confirming ? 0.5 : 1 }}>
              {confirming ? '...' : 'Xác nhận'}
            </button>
          )}
          {report.created_at && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:'4px',
              background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.2)',
              borderRadius:'6px', padding:'2px 7px', flexShrink:0 }}>
              <span style={{ fontSize:'0.76rem', color:'#7878a0' }}>Nộp lúc</span>
              <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#60a5fa', fontVariantNumeric:'tabular-nums' }}>
                {(() => {
                  const dt = report.created_at;
                  if (!dt) return '';
                  const [datePart, timePart] = dt.split(' ');
                  const [y, m, d] = (datePart || '').split('-');
                  const time = (timePart || '').slice(0, 5);
                  return `${time} ${d}/${m}/${y?.slice(2)}`;
                })()}
              </span>
            </div>
          )}
          <div style={{ flex:1 }} />
          {(report.image_count ?? report.images?.length) > 0 && (
            <span style={{ fontSize:'0.78rem', color:'#7878a0' }}>🖼 {report.image_count ?? report.images?.length}</span>
          )}
          <span style={{ color: GOLD, fontSize:'0.82rem' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding:'16px 18px' }}>
          {loadingDetail && (
            <div style={{ textAlign:'center', color:'#7878a0', fontSize:'0.82rem', padding:'8px 0 4px' }}>⏳ Đang tải...</div>
          )}
          {/* Timeline row */}
          {(report.time_present || report.time_onset || report.time_off || report.time_end) && (() => {
            function calcDuration(start, end) {
              if (!start || !end) return null;
              const [sh, sm] = start.split(':').map(Number);
              const [eh, em] = end.split(':').map(Number);
              if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;
              let startMins = sh * 60 + sm;
              let endMins   = eh * 60 + em;
              if (endMins < startMins) endMins += 24 * 60;
              const diff  = endMins - startMins;
              const hours = Math.floor(diff / 60);
              const mins  = diff % 60;
              return mins === 0 ? `${hours}h` : `${hours}h${String(mins).padStart(2, '0')}`;
            }
            const kmDur = calcDuration(report.time_present, report.time_end);
            const khDur = calcDuration(report.time_onset,   report.time_off);
            return (
              <>
                <div className="time-grid-4" style={{
                  display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(80px, 1fr))', gap:'8px',
                  background:'rgba(255,255,255,0.02)', borderRadius:'8px', padding:'12px', marginBottom: (kmDur || khDur) ? '8px' : '14px',
                }}>
                  {[
                    ['Có mặt', report.time_present],
                    ['Onset', report.time_onset],
                    ['Off máy', report.time_off],
                    ['Kết thúc', report.time_end],
                  ].map(([l, v]) => v && v !== '00:00' && (
                    <div key={l} style={{ textAlign:'center' }}>
                      <p style={{ fontSize:'0.80rem', color:'#7878a0', margin:'0 0 3px', textTransform:'uppercase' }}>{l}</p>
                      <p style={{ fontSize:'0.92rem', fontWeight:700, color:GOLD, margin:0 }}>{v}</p>
                    </div>
                  ))}
                </div>
                {(kmDur || khDur) && (
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'14px' }}>
                    {kmDur && (
                      <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'rgba(201,168,76,0.12)', border:'1px solid rgba(201,168,76,0.4)', borderRadius:'999px', padding:'5px 14px' }}>
                        <span style={{ fontSize:'0.75rem', fontWeight:800, color:'#c9a84c', letterSpacing:'0.06em' }}>TIME KHÔI MINH</span>
                        <span style={{ fontSize:'0.95rem', fontWeight:800, color:'#fde68a', fontVariantNumeric:'tabular-nums' }}>{kmDur}</span>
                      </div>
                    )}
                    {khDur && (
                      <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.4)', borderRadius:'999px', padding:'5px 14px' }}>
                        <span style={{ fontSize:'0.75rem', fontWeight:800, color:'#60a5fa', letterSpacing:'0.06em' }}>TIME KHÁCH HÀNG</span>
                        <span style={{ fontSize:'0.95rem', fontWeight:800, color:'#93c5fd', fontVariantNumeric:'tabular-nums' }}>{khDur}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}

          {/* Staff */}
          {report.km_staff?.length > 0 && (
            <div style={{ marginBottom:'12px' }}>
              <p style={{ ...labelStyle, marginBottom:'6px' }}>Nhân sự Khôi Minh</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
                {report.km_staff.map(s => (
                  <span key={s} style={{
                    padding:'3px 9px', borderRadius:'9999px',
                    background:'rgba(201,168,76,0.12)', border:'1px solid rgba(201,168,76,0.3)',
                    color:GOLD, fontSize:'0.82rem', fontWeight:600,
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}
          {report.freelancer_staff && (
            <div style={{ marginBottom:'12px' }}>
              <p style={{ ...labelStyle, marginBottom:'4px' }}>Nhân sự Freelancer</p>
              <p style={{ color:'#c0c0d4', fontSize:'0.85rem', margin:0 }}>{report.freelancer_staff}</p>
            </div>
          )}

          {/* Text fields */}
          {[
            ['Nội dung công việc', report.job_content],
            ['Tiến độ công việc', report.progress],
            ['Công việc hoàn thành', report.completed_work],
            ['Chất lượng dịch vụ', report.service_quality],
            ['Chưa hoàn thành', report.incomplete],
            ['Sự cố phát sinh', report.incidents],
          ].filter(([, v]) => v).map(([l, v]) => (
            <div key={l} style={{ marginBottom:'10px' }}>
              <p style={{ ...labelStyle, marginBottom:'3px' }}>{l}</p>
              <p style={{ color:'#c0c0d4', fontSize:'0.85rem', margin:0, whiteSpace:'pre-wrap' }}>{v}</p>
            </div>
          ))}

          {/* Images */}
          {detail.images?.length > 0 && (
            <div style={{ marginBottom:'12px' }}>
              <p style={{ ...labelStyle, marginBottom:'8px' }}>Hình ảnh đính kèm ({detail.images.length})</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                {detail.images.map((src, i) => (
                  <img key={i} src={imgThumb(src)} alt="" loading="lazy"
                    onClick={() => setImgIdx(i)}
                    style={{ width:'80px', height:'80px', objectFit:'cover', borderRadius:'6px',
                      border:`1px solid rgba(201,168,76,0.3)`, cursor:'pointer' }} />
                ))}
              </div>
            </div>
          )}

          {/* Lịch sử chỉnh sửa */}
          {detail.edit_history?.length > 0 && (
            <div style={{ marginTop:'10px', paddingTop:'8px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
              {detail.edit_history.map((h, i) => (
                <div key={i} style={{ fontSize:'0.75rem', color:'#6060a0', display:'flex', alignItems:'center', gap:'6px', marginTop: i > 0 ? '3px' : 0 }}>
                  <span style={{ color:'#a78bfa', fontWeight:600 }}>✏️</span>
                  <span>Sửa bởi <strong style={{ color:'#9090c0' }}>{h.name}</strong> lúc {h.at}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display:'flex', gap:'8px', marginTop:'6px', flexWrap:'wrap' }}>
            {/* Nút Sửa — chỉ hiện cho chủ báo cáo hoặc admin, trong deadline */}
            {(['SUPER_ADMIN','DIRECTOR'].includes(currentUser?.role) ||
              (currentUser?.id === report.reporter_user_id && withinEditDeadline(report.report_date))) && (
              <button type="button" onClick={() => onEdit(detail)}
                style={{
                  padding:'6px 14px', borderRadius:'6px', fontSize:'0.82rem',
                  background:'rgba(96,165,250,0.12)', border:'1px solid rgba(96,165,250,0.3)',
                  color:'#60a5fa', cursor:'pointer',
                }}>
                ✏️ Sửa báo cáo
              </button>
            )}
            {isSuperAdmin && (
              <button type="button" onClick={() => { if (confirm('Xoá báo cáo này?')) onDelete(report.id); }}
                style={{
                  padding:'6px 14px', borderRadius:'6px', fontSize:'0.82rem',
                  background:'rgba(220,50,50,0.12)', border:'1px solid rgba(220,50,50,0.3)',
                  color:'#f87171', cursor:'pointer',
                }}>
                🗑 Xoá báo cáo
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {imgIdx !== null && (
        <div
          ref={lightboxRef}
          onClick={() => { if (!wasDraggingRef.current) setImgIdx(null); wasDraggingRef.current = false; }}
          style={{
            position:'fixed', inset:0, zIndex:999,
            background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center',
            overflow:'hidden',
          }}
        >
          <img ref={lightboxImgRef} src={imgUrl(detail.images?.[imgIdx])} alt=""
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth:'90vw', maxHeight:'90dvh', borderRadius:'8px',
              boxShadow:'0 0 40px rgba(0,0,0,0.8)',
              transform: `translate(${imgTranslate.x}px, ${imgTranslate.y}px) scale(${imgScale})`,
              transformOrigin: 'center',
              transition: imgScale === 1 && imgTranslate.x === 0 && imgTranslate.y === 0 ? 'transform 0.2s' : 'none',
              touchAction: 'none',
              cursor: imgScale > 1 ? 'grab' : 'default',
              userSelect: 'none',
            }} />
          <div style={{ position:'absolute', top:'max(env(safe-area-inset-top, 0px), 20px)', right:'max(env(safe-area-inset-right, 0px), 20px)', color:'white', fontSize:'1.5rem', cursor:'pointer', lineHeight:1, padding:'4px' }}
            onClick={() => setImgIdx(null)}>✕</div>
          {detail.images?.length > 1 && (
            <>
              <button type="button" onClick={e => { e.stopPropagation(); setImgIdx((imgIdx - 1 + detail.images.length) % detail.images.length); }}
                style={{ position:'absolute', left:'max(env(safe-area-inset-left, 0px), 12px)', background:'rgba(0,0,0,0.6)', border:'2px solid rgba(255,255,255,0.5)', borderRadius:'50%', width:'52px', height:'52px', color:'white', fontSize:'1.8rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>‹</button>
              <button type="button" onClick={e => { e.stopPropagation(); setImgIdx((imgIdx + 1) % detail.images.length); }}
                style={{ position:'absolute', right:'max(env(safe-area-inset-right, 0px), 12px)', background:'rgba(0,0,0,0.6)', border:'2px solid rgba(255,255,255,0.5)', borderRadius:'50%', width:'52px', height:'52px', color:'white', fontSize:'1.8rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>›</button>
              <div style={{ position:'absolute', bottom:'20px', left:'50%', transform:'translateX(-50%)', color:'rgba(255,255,255,0.7)', fontSize:'0.84rem', fontWeight:600, background:'rgba(0,0,0,0.5)', padding:'3px 10px', borderRadius:'999px' }}>
                {imgIdx + 1} / {detail.images.length}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dept section: nhóm báo cáo theo bộ phận ──────────────────────────────────
function DeptSection({ dept, color, reports, onDelete, onEdit, onConfirm, canDeleteReport, highlightId }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ background:'#13131d', border:`1px solid ${color}33`, borderRadius:'14px', overflow:'hidden', marginBottom:'14px' }}>
      <div onClick={() => setOpen(v => !v)}
        style={{ padding:'12px 18px', cursor:'pointer', display:'flex', alignItems:'center', gap:'12px' }}>
        <div style={{ width:'10px', height:'10px', borderRadius:'50%', background: color, flexShrink:0 }} />
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontWeight:700, color, fontSize:'1.0rem', margin:0 }}>{dept}</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
          <span style={{
            fontSize:'0.81rem', background:`${color}22`,
            color, padding:'2px 9px', borderRadius:'9999px', fontWeight:700,
          }}>{reports.length}</span>
          <span style={{ color, fontSize:'0.88rem' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div style={{ borderTop:`1px solid ${color}22`, padding:'8px 10px 10px' }}>
          {reports.map(r => (
            <ReportCard key={r.id} report={r} onDelete={onDelete} onEdit={onEdit} onConfirm={onConfirm} isSuperAdmin={canDeleteReport(r)} highlightId={highlightId} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Date zone: nhóm tất cả báo cáo cùng ngày ────────────────────────────────
function DateZone({ date, reports, onDelete, onEdit, onConfirm, canDeleteReport, highlightId }) {
  const [open, setOpen] = useState(true);
  const totalImages = reports.reduce((sum, r) => sum + (r.image_count ?? r.images?.length ?? 0), 0);

  const dateLabel = (() => {
    if (date === '__') return { day: '??', month: '??', year: '??' };
    const [y, m, d] = date.split('-');
    return { day: d, month: m, year: y };
  })();

  return (
    <div style={{ marginBottom: '28px' }}>
      {/* Header: ngày nổi bật */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          cursor: 'pointer', marginBottom: open ? '10px' : 0,
          padding: '10px 14px',
          background: 'rgba(201,168,76,0.1)',
          border: '1px solid rgba(201,168,76,0.45)',
          borderRadius: '12px',
        }}
      >
        {/* Calendar badge */}
        <div style={{
          flexShrink: 0, width: '52px', textAlign: 'center',
          background: 'rgba(201,168,76,0.2)', border: '1px solid rgba(201,168,76,0.55)',
          borderRadius: '10px', padding: '6px 0',
        }}>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: GOLD, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {dateLabel.day}
          </div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a0906a', letterSpacing: '0.04em', marginTop: '2px' }}>
            TH{dateLabel.month}
          </div>
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: GOLD, fontSize: '0.95rem' }}>
            {date === '__' ? 'Không rõ ngày' : `${dateLabel.day} tháng ${dateLabel.month}, ${dateLabel.year}`}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#7878a0', marginTop: '2px', display: 'flex', gap: '10px' }}>
            <span>{reports.length} báo cáo</span>
            {totalImages > 0 && <span>🖼 {totalImages}</span>}
          </div>
        </div>
        <span style={{ color: GOLD, fontSize: '0.88rem', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Cards — ẩn ngày vì zone đã hiện rồi */}
      {open && (
        <div style={{ paddingLeft: '8px', borderLeft: '2px solid rgba(201,168,76,0.4)' }}>
          {reports.map(r => (
            <ReportCard key={r.id} report={r} onDelete={onDelete} onEdit={onEdit} onConfirm={onConfirm} isSuperAdmin={canDeleteReport(r)} hideDateRow highlightId={highlightId} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Event zone: nhóm tất cả báo cáo cùng sự kiện ────────────────────────────
function EventZone({ group, onDelete, onEdit, onConfirm, canDeleteReport, highlightId }) {
  const [open, setOpen] = useState(true);
  const totalImages = group.reports.reduce((sum, r) => sum + (r.image_count ?? r.images?.length ?? 0), 0);
  const allDates    = [...new Set(group.reports.map(r => r.report_date).filter(Boolean))].sort();

  return (
    <div style={{ background:'#13131d', border:'1px solid rgba(201,168,76,0.5)', borderRadius:'14px', overflow:'hidden', marginBottom:'14px' }}>
      {/* Zone header */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{ padding:'14px 18px', cursor:'pointer' }}
      >
        {/* Row 1: tên + icons */}
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <p style={{ fontWeight:700, color:'#e8c97a', fontSize:'1.05rem', margin:0, flex:1, minWidth:0 }}>{group.event_label}</p>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
            {totalImages > 0 && <span style={{ fontSize:'0.81rem', color:'#7878a0' }}>🖼 {totalImages}</span>}
            <span style={{
              fontSize:'0.81rem', background:'rgba(201,168,76,0.12)',
              color: GOLD, padding:'2px 9px', borderRadius:'9999px', fontWeight:700,
            }}>{group.reports.length}</span>
            <span style={{ color: GOLD, fontSize:'0.88rem' }}>{open ? '▲' : '▼'}</span>
          </div>
        </div>
        {/* Row 2: địa điểm */}
        {group.location && (
          <p style={{ fontSize:'0.81rem', color:'#60a5fa', fontWeight:600, margin:'5px 0 0' }}>📍 {group.location}</p>
        )}
        {/* Row 3: ngày */}
        {allDates.length > 0 && (
          <p style={{ fontSize:'0.81rem', color:'#7878a0', margin:'3px 0 0', display:'flex', flexWrap:'wrap', gap:'3px', alignItems:'center' }}>
            <span>📅</span>
            {allDates.map((d, i) => (
              <span key={d}>{i > 0 && <span style={{ color:'#555570' }}> · </span>}{fmtDate(d)}</span>
            ))}
          </p>
        )}
      </div>

      {/* Reports inside — grouped by date */}
      {open && (() => {
        const byDate = {};
        for (const r of group.reports) {
          const d = r.report_date || '__';
          if (!byDate[d]) byDate[d] = [];
          byDate[d].push(r);
        }
        const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
        const multiDate = dates.length > 1;
        return (
          <div style={{ borderTop:'1px solid rgba(201,168,76,0.3)', padding:'10px 10px 10px' }}>
            {dates.map(d => {
              const [y, m, day] = d !== '__' ? d.split('-') : ['??','??','??'];
              return (
                <div key={d} style={{ marginBottom: multiDate ? '16px' : 0 }}>
                  {multiDate && (
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                      <div style={{
                        flexShrink:0, width:'44px', textAlign:'center',
                        background:'rgba(201,168,76,0.18)', border:'1px solid rgba(201,168,76,0.5)',
                        borderRadius:'8px', padding:'4px 0',
                      }}>
                        <div style={{ fontSize:'1.1rem', fontWeight:800, color:GOLD, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>{day}</div>
                        <div style={{ fontSize:'0.65rem', fontWeight:700, color:'#c8a85a', marginTop:'1px' }}>TH{m}</div>
                      </div>
                      <span style={{ fontSize:'0.85rem', fontWeight:700, color:'#d0c090' }}>
                        {d === '__' ? 'Không rõ ngày' : `${day} tháng ${m}`}
                      </span>
                      <span style={{ fontSize:'0.75rem', color:'#a0906a', background:'rgba(201,168,76,0.12)', border:'1px solid rgba(201,168,76,0.25)', borderRadius:'9999px', padding:'1px 8px', fontWeight:600 }}>
                        {byDate[d].length} báo cáo
                      </span>
                      <div style={{ flex:1, height:'1px', background:'rgba(201,168,76,0.25)' }} />
                    </div>
                  )}
                  <div style={multiDate ? { paddingLeft:'8px', borderLeft:'2px solid rgba(201,168,76,0.35)' } : {}}>
                    {byDate[d].map(r => (
                      <ReportCard key={r.id} report={r} onDelete={onDelete} onEdit={onEdit} onConfirm={onConfirm} isSuperAdmin={canDeleteReport(r)} hideEventName hideDateRow={multiDate} highlightId={highlightId} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const todayVN = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

const makeEmptyForm = () => ({
  event_id: '', event_label: '', location: '',
  report_date: todayVN(),
  km_staff: [], freelancer_staff: '',
  job_content: '',
  time_present: '', time_onset: '', time_off: '', time_end: '',
  timeline: [],
  incomplete: '', incidents: '',
  progress: '', completed_work: '', service_quality: '',
  images: [],
});

export default function EventReport() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('id');
  const isFullAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  const canViewAllDepts = isFullAdmin || !!user?.is_phan_lich_all;
  // TRUONG_PHONG chỉ xóa báo cáo của nhân viên cùng phòng
  const canDeleteReport = (report) => {
    if (isFullAdmin) return true;
    if (!user?.is_truong_phong) return false;
    if (!report.reporter_role) return true; // báo cáo cũ chưa có reporter_user_id
    return report.reporter_role === user?.role;
  };

  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editingId, setEditingId] = useState(null); // id báo cáo đang edit
  const [listMode, setListMode] = useState('event'); // 'event' | 'dept'
  const [reports, setReports] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lockedObs, setLockedObs] = useState([]);

  const [form, setForm] = useState(makeEmptyForm);
  const [errors, setErrors] = useState({});
  const [evSearch, setEvSearch] = useState('');
  const [showEvDrop, setShowEvDrop] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [isAloneInDept, setIsAloneInDept] = useState(false);
  const [notInSchedule, setNotInSchedule] = useState(false);
  const [allowedEventIds, setAllowedEventIds] = useState(null); // null = show all (admin), Set = filtered
  const [dateLocked, setDateLocked] = useState(false);

  const fileInputRef = useRef(null);

  // Build danh sách event_id mà user có lịch làm việc VÀ còn trong deadline báo cáo
  const load = useCallback(() => {
    Promise.all([api.getEventReports(), api.getEvents()])
      .then(([r, e]) => { setReports(r); setEvents(e); })
      .finally(() => setLoading(false));
    // Lấy các obligation đã bị khóa (vi phạm không nộp)
    api.getLeadObligations()
      .then(obs => {
        const locked = obs.filter(o => o.locked && !o.submitted);
        const isAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role) || !!user?.is_phan_lich_all;
        if (isAdmin) {
          setLockedObs(locked);
        } else {
          const myName = user?.full_name || '';
          if (user?.is_truong_phong) {
            const dept = getUserKmDept(user);
            const deptMembers = new Set(KM_STAFF_GROUPS.find(g => g.dept === dept)?.members || []);
            setLockedObs(locked.filter(o => deptMembers.has(o.lead_name) || o.lead_name === myName || o.user_id === user?.id));
          } else {
            setLockedObs(locked.filter(o => o.lead_name === myName || o.user_id === user?.id));
          }
        }
      })
      .catch(() => {});
    // Tính allowedEventIds từ lịch làm việc — refresh cùng interval để cập nhật khi lịch thay đổi
    const isAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role) || !!user?.is_phan_lich_all;
    if (isAdmin || !user?.full_name) { setAllowedEventIds(null); return; }
    const myName = user.full_name;
    const phaseKeys = ['setup', 'teardown', 'rehearsal', 'filming'];
    api.getWorkSchedules({}).then(scheds => {
      const ids = new Set();
      for (const s of scheds) {
        if (!s.event_id) continue;
        let found = false;
        for (const key of phaseKeys) {
          const leads = s[`${key}_leads`] || [];
          if (leads.some(l => (typeof l === 'string' ? l : l?.name) === myName)) { found = true; break; }
          const km = s[`${key}_km_staff`] || [];
          if (km.includes(myName)) { found = true; break; }
          const leadsMap = s[`${key}_leads_map`] || {};
          if (Object.values(leadsMap).some(arr => arr?.some(l => (typeof l === 'string' ? l : l?.name) === myName))) { found = true; break; }
          const kmMap = s[`${key}_km_staff_map`] || {};
          if (Object.values(kmMap).some(arr => arr?.includes(myName))) { found = true; break; }
          const kmSupport = s[`${key}_km_support`] || {};
          if (Object.values(kmSupport).some(dateObj => dateObj && myName in dateObj)) { found = true; break; }
        }
        if (!found) continue;
        let hasOpenDeadline = false;
        for (const key of phaseKeys) {
          const dates = s[`${key}_dates`] || (s[`${key}_date`] ? [s[`${key}_date`]] : []);
          if (dates.some(d => withinEditDeadline(d))) { hasOpenDeadline = true; break; }
        }
        if (hasOpenDeadline) ids.add(String(s.event_id));
      }
      setAllowedEventIds(ids);
    }).catch(() => setAllowedEventIds(null));
  }, [user?.full_name, user?.id, user?.role, user?.is_phan_lich_all, user?.is_truong_phong]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  // Pre-fill form nếu được navigate từ trang Lịch Làm Việc (nghĩa vụ báo cáo)
  useEffect(() => {
    const prefill = location.state?.prefill;
    if (!prefill) return;
    setView('form');
    setForm(f => ({
      ...f,
      event_id:    prefill.event_id    || f.event_id,
      event_label: prefill.event_label || f.event_label,
      report_date: prefill.report_date || f.report_date,
    }));
    if (prefill.event_label) setEvSearch(prefill.event_label);
    if (prefill.report_date) setDateLocked(true);
  }, [location.state]);

  // Tự điền location khi event_id được set nhưng location chưa có (vd: prefill từ WorkSchedule)
  useEffect(() => {
    if (!form.event_id || form.location) return;
    const ev = events.find(e => String(e.id) === String(form.event_id));
    if (ev?.location) setForm(f => ({ ...f, location: ev.location }));
  }, [form.event_id, events]);

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => { if (!e[key]) return e; const n = { ...e }; delete n[key]; return n; });
  }

  function selectEvent(ev) {
    // Auto-detect report_date từ ngày sự kiện: ưu tiên hôm nay → hôm qua → giữ nguyên
    let bestDate = null;
    if (!dateLocked) {
      const today = todayVN();
      const d = new Date(Date.now() + 7 * 3600 * 1000);
      d.setUTCDate(d.getUTCDate() - 1);
      const yesterday = d.toISOString().slice(0, 10);
      const allDates = [];
      for (const f of ['filming_date', 'start_date', 'show_date']) {
        if (ev[f]) allDates.push(ev[f]);
      }
      for (const f of ['filming_dates', 'start_dates', 'show_dates']) {
        try { allDates.push(...JSON.parse(ev[f] || '[]')); } catch (_) {}
      }
      const valid = allDates.filter(d => d === today || d === yesterday);
      bestDate = valid.sort().reverse()[0] || null;
    }
    setForm(f => ({
      ...f,
      event_id: ev.id,
      event_label: ev.name,
      location: ev.location || '',
      km_staff: [],
      freelancer_staff: '',
      ...(bestDate ? { report_date: bestDate } : {}),
    }));
    setEvSearch(ev.name);
    setShowEvDrop(false);
  }

  // Gợi ý nhân sự đã lên lịch làm việc cho ngày báo cáo đã chọn (vẫn cho sửa thủ công)
  // Nhóm trưởng dùng useEffect riêng bên dưới (load toàn bộ lịch theo ngày)
  useEffect(() => {
    if (!form.event_id || !form.report_date) return;
    if (user?.is_truong_phong) return;
    const myName = user?.full_name || '';
    const userKmDept = getUserKmDept(user);
    const userGroup = KM_STAFF_GROUPS.find(g => g.dept === userKmDept);
    const deptFilter = userGroup ? new Set(userGroup.members) : null;
    api.getWorkSchedules({ event_id: form.event_id }).then(scheds => {
      const phaseKeys = ['setup', 'teardown', 'rehearsal', 'filming'];
      const names = new Set();
      const freeParts = [];
      const validDept = userKmDept && userKmDept !== '—';
      let schedLocation = '';
      for (const s of scheds) {
        for (const key of phaseKeys) {
          const dates = s[`${key}_dates`] || (s[`${key}_date`] ? [s[`${key}_date`]] : []);
          const matchDate = dates.find(d => d === form.report_date) || dates.find(d => dateMatchesSched(d, form.report_date));
          // Có dates nhưng không khớp ngày → bỏ qua phase này
          if (dates.length > 0 && !matchDate) continue;
          // KM staff chỉ auto-fill khi có ngày khớp cụ thể
          if (matchDate) {
            if (!schedLocation && s.location) schedLocation = s.location;
            const leadsForDate = s[`${key}_leads_map`]?.[matchDate] || s[`${key}_leads`] || [];
            leadsForDate.forEach(l => {
              const n = typeof l === 'string' ? l : l?.name;
              if (n && (!deptFilter || deptFilter.has(n) || n === myName)) names.add(n);
            });
            const kmForDate = s[`${key}_km_staff_map`]?.[matchDate] || s[`${key}_km_staff`] || [];
            kmForDate.forEach(n => {
              if (!deptFilter || deptFilter.has(n) || n === myName) names.add(n);
            });
            // Nhân sự hỗ trợ (HT): người từ bộ phận khác được giao hỗ trợ bộ phận của user
            const supportForDate = (s[`${key}_km_support`] || {})[matchDate] || {};
            Object.entries(supportForDate).forEach(([name, forDept]) => {
              if (!deptFilter || forDept === userKmDept) names.add(name);
            });
          }
          // Freelancer: dùng matchDate, nếu không có thì fallback về '_all'
          const freeKey = matchDate || '_all';
          const freeMap = s[`${key}_freelancers_map`];
          if (freeMap) {
            const dateEntry = freeMap[freeKey] ?? freeMap['_all'];
            if (dateEntry && typeof dateEntry === 'object') {
              const txt = validDept ? (dateEntry[userKmDept] || '') : Object.values(dateEntry).filter(Boolean).join(', ');
              if (txt) freeParts.push(txt);
            } else if (typeof dateEntry === 'string' && dateEntry) {
              freeParts.push(dateEntry);
            }
          } else if (validDept) {
            const flat = s[`${key}_freelancers`] || '';
            if (flat) freeParts.push(flat);
          }
        }
      }
      if (names.size > 0) setForm(f => ({ ...f, km_staff: [...new Set([...f.km_staff, ...names])] }));
      const freelancerText = [...new Set(freeParts.flatMap(t => t.split(',').map(s => s.trim())).filter(Boolean))].join(', ');
      if (freelancerText) setForm(f => ({ ...f, freelancer_staff: f.freelancer_staff?.trim() ? f.freelancer_staff : freelancerText }));
      if (schedLocation) setForm(f => ({ ...f, location: schedLocation }));
    }).catch(() => {});
  }, [form.event_id, form.report_date, user?.is_truong_phong, user?.full_name]);

  // Auto-load nhân sự theo dept khi nhóm trưởng chọn ngày báo cáo
  // + kiểm tra user có phải nhân viên duy nhất trong dept hôm đó không
  useEffect(() => {
    if (!form.report_date) return;
    const userDept = getUserKmDept(user);
    const userGroup = KM_STAFF_GROUPS.find(g => g.dept === userDept);
    if (!userGroup) { setIsAloneInDept(false); return; }
    const deptMembers = new Set(userGroup.members);
    const myName = user?.full_name || '';
    api.getWorkSchedules({}).then(scheds => {
      const phaseKeys = ['setup', 'teardown', 'rehearsal', 'filming'];
      const staffNames   = new Set(); // leads + km_staff (để auto-fill nhóm trưởng)
      const leadNames    = new Set(); // chỉ leads (để kiểm tra isAloneInDept)
      const freeTextParts = [];       // freelancer text theo dept
      let isLeadThisDate = false;
      let schedLocation = '';
      for (const s of scheds) {
        for (const key of phaseKeys) {
          const dates = s[`${key}_dates`] || (s[`${key}_date`] ? [s[`${key}_date`]] : []);
          const matchDate = dates.find(d => d === form.report_date) || dates.find(d => dateMatchesSched(d, form.report_date));
          if (!matchDate) continue;
          if (!schedLocation && s.location && String(s.event_id) === String(form.event_id)) schedLocation = s.location;
          const leadsForDate = s[`${key}_leads_map`]?.[matchDate] || s[`${key}_leads`] || [];
          leadsForDate.forEach(l => {
            const n = typeof l === 'string' ? l : l?.name;
            if (!n) return;
            if (n === myName) isLeadThisDate = true;
            // Tính vào leadNames nếu cùng dept hoặc chính là user hiện tại
            if (deptMembers.has(n) || n === myName) leadNames.add(n);
            if (deptMembers.has(n) || n === myName) staffNames.add(n);
          });
          const kmMap = s[`${key}_km_staff_map`] || {};
          (kmMap[matchDate] || []).forEach(n => {
            if (deptMembers.has(n) || n === myName) staffNames.add(n);
          });
          // Nhân sự hỗ trợ (HT): người từ bộ phận khác hỗ trợ bộ phận này
          const supportForDate = (s[`${key}_km_support`] || {})[matchDate] || {};
          Object.entries(supportForDate).forEach(([name, forDept]) => {
            if (forDept === userDept) staffNames.add(name);
          });
          // Freelancer theo dept + ngày cho nhóm trưởng
          if (user?.is_truong_phong) {
            const freeMap = s[`${key}_freelancers_map`];
            if (freeMap) {
              const dateEntry = freeMap[matchDate] ?? freeMap['_all'];
              if (dateEntry && typeof dateEntry === 'object') {
                freeTextParts.push(dateEntry[userDept] || '');
              } else if (typeof dateEntry === 'string') {
                freeTextParts.push(dateEntry);
              }
            }
          }
        }
      }
      // Chỉ nhóm trưởng mới tự động điền danh sách nhân sự
      if (user?.is_truong_phong && staffNames.size > 0) {
        setForm(f => ({ ...f, km_staff: [...new Set([...f.km_staff, ...staffNames])] }));
      }
      if (user?.is_truong_phong) {
        const freelancerText = [...new Set(freeTextParts.flatMap(t => t.split(',').map(s => s.trim())).filter(Boolean))].join(', ');
        if (freelancerText) setForm(f => ({ ...f, freelancer_staff: f.freelancer_staff?.trim() ? f.freelancer_staff : freelancerText }));
        if (schedLocation) setForm(f => ({ ...f, location: schedLocation }));
      }
      // isAloneInDept: user phải là lead ngày đó VÀ là lead duy nhất trong dept
      // → khớp với obligation system (chỉ tạo vi phạm cho leads)
      setIsAloneInDept(isLeadThisDate && leadNames.size === 1 && leadNames.has(myName));
    }).catch(() => { setIsAloneInDept(false); });
  }, [form.report_date, form.event_id, user?.is_truong_phong, user?.full_name]);

  // Kiểm tra người báo cáo có trong lịch làm việc của sự kiện không (áp dụng cho tất cả)
  // Chỉ block khi còn trong deadline — quá hạn vẫn cho nộp (ghi nhận nộp trễ)
  useEffect(() => {
    if (editingId) return;
    if (!form.event_id || !form.report_date) { setNotInSchedule(false); return; }
    if (!withinEditDeadline(form.report_date)) { setNotInSchedule(false); return; }
    const isAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role) || !!user?.is_phan_lich_all;
    if (isAdmin) { setNotInSchedule(false); return; }
    const myName = user?.full_name || '';
    api.getWorkSchedules({ event_id: form.event_id }).then(scheds => {
      if (scheds.length === 0) { setNotInSchedule(false); return; }
      const phaseKeys = ['setup', 'teardown', 'rehearsal', 'filming'];
      let inSched = false;
      outer: for (const s of scheds) {
        for (const key of phaseKeys) {
          const dates = s[`${key}_dates`] || (s[`${key}_date`] ? [s[`${key}_date`]] : []);
          const matchDate = dates.find(d => d === form.report_date) || dates.find(d => dateMatchesSched(d, form.report_date));
          if (!matchDate) continue;
          const leads = s[`${key}_leads_map`]?.[matchDate] || s[`${key}_leads`] || [];
          if (leads.some(l => (typeof l === 'string' ? l : l?.name) === myName)) { inSched = true; break outer; }
          const km = s[`${key}_km_staff_map`]?.[matchDate] || s[`${key}_km_staff`] || [];
          if (km.includes(myName)) { inSched = true; break outer; }
          const support = (s[`${key}_km_support`] || {})[matchDate] || {};
          if (myName in support) { inSched = true; break outer; }
        }
      }
      setNotInSchedule(!inSched);
    }).catch(() => setNotInSchedule(false));
  }, [form.event_id, form.report_date, user?.full_name]);

  const recentEvents = (() => {
    const vnNow = new Date(Date.now() + 7 * 3600 * 1000);
    const yesterday = new Date(vnNow); yesterday.setUTCDate(vnNow.getUTCDate() - 1);
    const tomorrow  = new Date(vnNow); tomorrow.setUTCDate(vnNow.getUTCDate() + 1);
    const yStr = yesterday.toISOString().slice(0, 10);
    const tStr = tomorrow.toISOString().slice(0, 10);
    return events.filter(ev => {
      if (ev.status === 'cancelled') return false;
      const start = ev.start_date || '';
      const end   = ev.end_date   || ev.start_date || '';
      return start <= tStr && end >= yStr;
    });
  })();

  const scheduledEvents = allowedEventIds !== null
    ? events.filter(ev => ev.status !== 'cancelled' && allowedEventIds.has(String(ev.id)))
    : recentEvents;

  const evSuggestions = showEvDrop
    ? (evSearch.trim()
        ? scheduledEvents.filter(e => e.name.toLowerCase().includes(evSearch.toLowerCase())).slice(0, 8)
        : scheduledEvents.slice(0, 8))
    : [];

  async function handleImageFiles(files) {
    setUploadingImg(true);
    try {
      const token = localStorage.getItem('km_token');
      const results = await Promise.all(Array.from(files).map(async f => {
        try {
          const fd = new FormData();
          fd.append('image', f);
          const res = await fetch('/api/upload-image', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          if (!res.ok) throw new Error('Upload thất bại');
          const { url } = await res.json();
          return url;
        } catch {
          return resizeImage(f);
        }
      }));
      setField('images', [...form.images, ...results]);
    } finally {
      setUploadingImg(false);
    }
  }

  function handleEdit(report) {
    setEditingId(report.id);
    setForm({
      event_id:        report.event_id   || '',
      event_label:     report.event_label|| '',
      location:        report.location   || '',
      report_date:     report.report_date|| '',
      km_staff:        report.km_staff   || [],
      freelancer_staff:report.freelancer_staff || '',
      time_present:    report.time_present || '',
      time_onset:      report.time_onset   || '',
      time_off:        report.time_off     || '',
      time_end:        report.time_end     || '',
      incomplete:      report.incomplete   || '',
      incidents:       report.incidents    || '',
      progress:        report.progress     || '',
      completed_work:  report.completed_work || '',
      service_quality: report.service_quality || '',
      images:          report.images || [],
      job_content:     report.job_content || '',
      timeline:        report.timeline || [],
    });
    setEvSearch(report.event_label || '');
    setDateLocked(true);
    setView('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.event_id)                       errs.event_id       = 'Vui lòng chọn sự kiện';
    if (!form.report_date)                    errs.report_date    = 'Vui lòng chọn ngày báo cáo';
    if (!form.km_staff?.length)               errs.km_staff       = 'Bắt buộc chọn ít nhất 1 nhân sự Khôi Minh';
    const validTime = v => { const [h, m] = (v || '').split(':'); return h?.length > 0 && m?.length > 0; };
    if (!validTime(form.time_present))        errs.time_present   = 'Bắt buộc nhập';
    if (!validTime(form.time_end))            errs.time_end       = 'Bắt buộc nhập';
    if (!form.progress?.trim())               errs.progress       = 'Bắt buộc chọn';
    if (!form.completed_work?.trim())         errs.completed_work = 'Bắt buộc chọn';
    if (!form.service_quality?.trim())        errs.service_quality= 'Bắt buộc chọn';
    if (!editingId && notInSchedule) errs.event_id = 'Bạn không có trong lịch làm việc của sự kiện này vào ngày đã chọn';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      if (editingId) {
        await api.updateEventReport(editingId, form);
      } else {
        await api.createEventReport({ ...form, reporter_name: user?.full_name || '' });
      }
      const updated = await api.getEventReports();
      setReports(updated);
      setForm(makeEmptyForm());
      setEvSearch('');
      setEditingId(null);
      setDateLocked(false);
      setView('list');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteEventReport(id);
      setReports(r => r.filter(x => x.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  function handleConfirm() {
    load();
  }

  // ── List view ───────────────────────────────────────────────────────────────
  if (view === 'list') {
    // Tách báo cáo: sự kiện < 48h (mới) và >= 48h (đã xác nhận)
    const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const [ty, tm, td] = todayVN.split('-').map(Number);
    const threshDate = new Date(Date.UTC(ty, tm - 1, td - 2));
    const confirmedThresh = `${threshDate.getUTCFullYear()}-${String(threshDate.getUTCMonth()+1).padStart(2,'0')}-${String(threshDate.getUTCDate()).padStart(2,'0')}`;
    const recentReports   = reports.filter(r => !r.report_date || r.report_date > confirmedThresh);
    const confirmedReports = reports.filter(r => r.report_date && r.report_date <= confirmedThresh);

    // Dept-grouped view
    const deptGroups = (() => {
      const order = [];
      const map = {};
      recentReports.forEach(r => {
        const dept = KM_STAFF_GROUPS.find(g => g.members.includes(r.reporter_name))?.dept || 'Khác';
        if (!map[dept]) { map[dept] = []; order.push(dept); }
        map[dept].push(r);
      });
      return { order, map };
    })();

    return (
      <div className="p-6">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'12px' }}>
          <div style={{ minWidth:0 }}>
            <h1 style={{ fontSize:'1.5rem', fontWeight:800, color:'#e8c97a', margin:0 }}>Báo Cáo Thực Hiện Sự Kiện</h1>
            <p style={{ color:'#7878a0', fontSize:'0.82rem', margin:'4px 0 0' }}>Nhân viên Khôi Minh báo cáo sau mỗi sự kiện</p>
          </div>
          <button onClick={() => setView('form')} className="btn-primary btn-sm" style={{ whiteSpace:'nowrap', flexShrink:0 }}>
            + Tạo báo cáo
          </button>
        </div>

        {/* Tab toggle – only for admins + is_phan_lich_all */}
        {canViewAllDepts && (
          <div style={{ display:'flex', gap:'6px', marginBottom:'20px' }}>
            {[['event', 'Theo sự kiện'], ['date', 'Theo ngày'], ['dept', 'Theo bộ phận']].map(([mode, label]) => (
              <button key={mode} type="button" onClick={() => setListMode(mode)}
                style={{
                  padding:'6px 16px', borderRadius:'9999px', fontSize:'0.84rem', fontWeight:700, cursor:'pointer',
                  border: listMode === mode ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.12)',
                  background: listMode === mode ? GOLD : 'rgba(255,255,255,0.04)',
                  color: listMode === mode ? '#08080e' : '#a0a0b8',
                  transition:'all 0.15s',
                }}
              >{label}</button>
            ))}
          </div>
        )}

        {loading && <div className="card text-center py-10" style={{ color:'#7878a0' }}>Đang tải...</div>}

        {!loading && recentReports.length === 0 && lockedObs.length === 0 && confirmedReports.length === 0 && (
          <div className="card text-center py-14">
            <p style={{ fontSize:'2.5rem', marginBottom:'8px' }}>📋</p>
            <p style={{ color:'#7878a0', fontWeight:600 }}>Chưa có báo cáo nào</p>
            <p style={{ color:'#7878a0', fontSize:'0.84rem', marginTop:'4px' }}>Nhấn "+ Tạo báo cáo" để tạo báo cáo đầu tiên</p>
          </div>
        )}

        {/* Theo sự kiện */}
        {!loading && listMode === 'event' && (() => {
          const order = [];
          const map = {};
          recentReports.forEach(r => {
            const key = r.event_id ? String(r.event_id) : `_${r.id}`;
            if (!map[key]) {
              map[key] = { event_label: r.event_label || 'Sự kiện không rõ', location: r.location, reports: [] };
              order.push(key);
            }
            map[key].reports.push(r);
          });
          order.sort((a, b) => {
            const latestA = map[a].reports.map(r => r.report_date).filter(Boolean).sort().at(-1) || '';
            const latestB = map[b].reports.map(r => r.report_date).filter(Boolean).sort().at(-1) || '';
            return latestB.localeCompare(latestA);
          });
          return order.map(k => (
            <EventZone key={k} group={map[k]} onDelete={handleDelete} onEdit={handleEdit} onConfirm={handleConfirm} canDeleteReport={canDeleteReport} highlightId={highlightId} />
          ));
        })()}

        {/* Theo ngày */}
        {!loading && listMode === 'date' && (() => {
          const map = {};
          const order = [];
          recentReports.forEach(r => {
            const d = r.report_date || '__';
            if (!map[d]) { map[d] = []; order.push(d); }
            map[d].push(r);
          });
          order.sort((a, b) => b.localeCompare(a)); // mới nhất lên trên
          return order.map(d => (
            <DateZone key={d} date={d} reports={map[d]} onDelete={handleDelete} onEdit={handleEdit} onConfirm={handleConfirm} canDeleteReport={canDeleteReport} highlightId={highlightId} />
          ));
        })()}

        {/* Theo bộ phận – chỉ hiện khi canViewAllDepts */}
        {!loading && listMode === 'dept' && canViewAllDepts && (
          deptGroups.order.length === 0
            ? null
            : deptGroups.order.map(dept => (
                <DeptSection key={dept} dept={dept} color={getDeptColor(dept)} reports={deptGroups.map[dept]}
                  onDelete={handleDelete} onEdit={handleEdit} onConfirm={handleConfirm} canDeleteReport={canDeleteReport} highlightId={highlightId} />
              ))
        )}

        {/* Đã Xác Nhận – sự kiện đã qua 48h */}
        {!loading && confirmedReports.length > 0 && (() => {
          const sorted = [...confirmedReports].sort((a, b) => (b.report_date || '').localeCompare(a.report_date || ''));
          const order = [], map = {};
          sorted.forEach(r => {
            const key = r.event_id ? String(r.event_id) : `_${r.id}`;
            if (!map[key]) { map[key] = { event_label: r.event_label || 'Sự kiện không rõ', location: r.location, reports: [] }; order.push(key); }
            map[key].reports.push(r);
          });
          return (
            <div style={{ marginTop:'8px', borderRadius:'10px', overflow:'hidden', border:'1px solid rgba(74,222,128,0.28)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 14px', background:'linear-gradient(135deg,rgba(74,222,128,0.14) 0%,rgba(74,222,128,0.03) 100%)', borderLeft:'3px solid #4ade80', borderBottom:'1px solid rgba(74,222,128,0.16)' }}>
                <span style={{ fontWeight:700, color:'#4ade80', fontSize:'0.84rem', flex:1, letterSpacing:'0.04em' }}>✅ ĐÃ XÁC NHẬN</span>
                <span style={{ background:'rgba(74,222,128,0.2)', border:'1px solid rgba(74,222,128,0.4)', borderRadius:'9999px', padding:'1px 8px', fontSize:'0.78rem', fontWeight:700, color:'#4ade80' }}>
                  {confirmedReports.length} báo cáo
                </span>
              </div>
              <div style={{ background:'#13131d', maxHeight:'585px', overflowY:'auto', padding:'8px 12px' }}>
                {order.map(k => (
                  <EventZone key={k} group={map[k]} onDelete={handleDelete} onEdit={handleEdit} onConfirm={handleConfirm} canDeleteReport={canDeleteReport} highlightId={highlightId} />
                ))}
              </div>
            </div>
          );
        })()}

        {/* Vi phạm báo cáo – obligations đã bị khóa, hiển thị cuối trang */}
        {!loading && lockedObs.length > 0 && (() => {
          const phaseLabel = { setup:'Setup', teardown:'Tháo dỡ', rehearsal:'Rehearsal', filming:'Ghi hình' };
          // Group by event
          const order = [], groupMap = {};
          lockedObs.forEach(ob => {
            const key = ob.event_id ? String(ob.event_id) : `_${ob.id}`;
            if (!groupMap[key]) {
              groupMap[key] = { label: ob.event_display || ob.event_name || 'Sự kiện không rõ', items: [] };
              order.push(key);
            }
            groupMap[key].items.push(ob);
          });
          return (
            <div style={{ marginTop:'8px', borderRadius:'10px', overflow:'hidden', border:'1px solid rgba(248,113,113,0.28)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 14px', background:'linear-gradient(135deg,rgba(248,113,113,0.14) 0%,rgba(248,113,113,0.03) 100%)', borderLeft:'3px solid #f87171', borderBottom:'1px solid rgba(248,113,113,0.16)' }}>
                <span style={{ fontWeight:700, color:'#f87171', fontSize:'0.84rem', flex:1, letterSpacing:'0.04em' }}>🚫 VI PHẠM BÁO CÁO</span>
                <span style={{ background:'rgba(248,113,113,0.2)', border:'1px solid rgba(248,113,113,0.4)', borderRadius:'9999px', padding:'1px 8px', fontSize:'0.78rem', fontWeight:700, color:'#f87171' }}>
                  {lockedObs.length} mục
                </span>
              </div>
              <div style={{ background:'#13131d', maxHeight:'360px', overflowY:'auto', padding:'8px 12px' }}>
                {order.map((key, gi) => {
                  const grp = groupMap[key];
                  return (
                    <div key={key} style={{ marginTop: gi > 0 ? '10px' : '0' }}>
                      {/* Event zone header */}
                      <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'5px 8px', background:'rgba(248,113,113,0.07)', borderRadius:'6px', borderLeft:'2px solid rgba(248,113,113,0.5)', marginBottom:'4px' }}>
                        <span style={{ fontSize:'0.83rem', fontWeight:700, color: GOLD, flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{grp.label}</span>
                        <span style={{ fontSize:'0.75rem', color:'#f87171', background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:'9999px', padding:'1px 6px', whiteSpace:'nowrap', fontWeight:600 }}>
                          {grp.items.length} vi phạm
                        </span>
                      </div>
                      {grp.items.map((ob, i) => {
                        const obDept = KM_STAFF_GROUPS.find(g => g.members.includes(ob.lead_name))?.dept;
                        const deptC = obDept ? getDeptColor(obDept) : null;
                        const canDismiss = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
                        return (
                          <div key={ob.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', borderTop: i > 0 ? '1px solid rgba(248,113,113,0.07)' : 'none' }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                                <span style={{ fontSize:'0.85rem', fontWeight:700, color:'#eeeef5' }}>{ob.lead_name}</span>
                                {deptC && <span style={{ fontSize:'0.78rem', fontWeight:600, color: deptC, background:`${deptC}22`, border:`1px solid ${deptC}55`, borderRadius:'4px', padding:'1px 6px', whiteSpace:'nowrap' }}>{obDept}</span>}
                              </div>
                              <div style={{ fontSize:'0.82rem', color:'#a0a0b8' }}>
                                {phaseLabel[ob.phase] || ob.phase} · {fmtDate(ob.assigned_date)}
                                <span style={{ color:'#f87171', marginLeft:'6px', fontWeight:700 }}>Không nộp báo cáo</span>
                              </div>
                            </div>
                            {canDismiss && (
                              <button
                                onClick={() => {
                                  if (!window.confirm(`Bỏ qua vi phạm của ${ob.lead_name}?`)) return;
                                  api.dismissLeadObligation(ob.id).then(load).catch(e => alert(e.message));
                                }}
                                style={{ background:'none', border:'1px solid rgba(248,113,113,0.35)', borderRadius:'6px', color:'#f87171', fontSize:'0.78rem', padding:'3px 8px', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}
                                title="Bỏ qua vi phạm này"
                              >Bỏ qua</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // ── Form view ───────────────────────────────────────────────────────────────
  const vnNow = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
  let reportDeadline = null;
  let deadlineDisplay = '';
  if (form.report_date) {
    const [y, m, d] = form.report_date.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const nd = String(next.getUTCDate()).padStart(2, '0');
    const nm = String(next.getUTCMonth() + 1).padStart(2, '0');
    const ny = next.getUTCFullYear();
    reportDeadline = `${ny}-${nm}-${nd} 23:59`;
    deadlineDisplay = `${nd}/${nm} 21:00`;
  }
  const isOverdue = (!!user?.is_truong_phong || isAloneInDept) && !!reportDeadline && vnNow > reportDeadline;

  return (
    <div className="p-6">
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
        <button onClick={() => { setView('list'); setForm(makeEmptyForm()); setEvSearch(''); setEditingId(null); setDateLocked(false); }} style={{ background:'none', border:'none', color:'#7878a0', fontSize:'1.3rem', cursor:'pointer' }}>←</button>
        <div>
          <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'#e8c97a', margin:0 }}>{editingId ? 'Chỉnh Sửa Báo Cáo' : 'Tạo Báo Cáo Sự Kiện'}</h1>
          <p style={{ color:'#7878a0', fontSize:'0.84rem', margin:0 }}>{editingId ? 'Cập nhật thông tin báo cáo' : 'Điền đầy đủ thông tin sau sự kiện'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── Sự kiện & Địa điểm ── */}
        <div style={sectionStyle}>
          <h3 style={{ color: GOLD, fontSize:'0.84rem', fontWeight:800, letterSpacing:'0.1em', margin:'0 0 16px', textTransform:'uppercase' }}>
            Thông Tin Sự Kiện
          </h3>

          {/* Event search */}
          <div style={{ position:'relative', zIndex:100, marginBottom:'14px' }}>
            <label style={labelStyle}>Tên sự kiện *</label>
            <input
              className="input"
              placeholder="Tìm hoặc chọn sự kiện..."
              value={evSearch}
              autoComplete="off"
              onChange={e => { setEvSearch(e.target.value); setField('event_id', ''); setField('event_label', ''); setShowEvDrop(true); }}
              onFocus={() => setShowEvDrop(true)}
              onBlur={() => setTimeout(() => setShowEvDrop(false), 150)}
            />
            {form.event_id && (
              <p style={{ fontSize:'0.84rem', color:'#4ade80', marginTop:'4px' }}>✅ {form.event_label}</p>
            )}
            {errors.event_id && <p style={{ color:'#f87171', fontSize:'0.80rem', marginTop:'4px' }}>⚠ {errors.event_id}</p>}
            {showEvDrop && evSuggestions.length > 0 && (
              <div style={{
                position:'absolute', top:'100%', left:0, right:0, zIndex:200, marginTop:'4px',
                background:'#13131d', border:'1px solid rgba(201,168,76,0.3)',
                borderRadius:'8px', boxShadow:'0 8px 24px rgba(0,0,0,0.6)',
              }}>
                {evSuggestions.map(ev => (
                  <button key={ev.id} type="button"
                    onMouseDown={() => selectEvent(ev)}
                    style={{
                      width:'100%', textAlign:'left', padding:'9px 13px', display:'flex', alignItems:'center', gap:'10px',
                      background:'transparent', border:'none', cursor:'pointer',
                      borderBottom:'1px solid rgba(201,168,76,0.08)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(201,168,76,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}
                  >
                    <span style={{ fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace", fontSize:'0.82rem', color:'#7878a0', flexShrink:0 }}>{ev.code}</span>
                    <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:'2px' }}>
                      <span style={{ color:'#c9a84c', fontWeight:600, fontSize:'0.85rem' }}>{ev.name}</span>
                      {ev.location && <span style={{ fontSize:'0.82rem', color:'#60a5fa' }}>📍 {ev.location}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Địa điểm</label>
              <input className="input" placeholder="Tự động khi chọn sự kiện..."
                value={form.location} onChange={e => setField('location', e.target.value)}
                style={form.location ? { color:'#60a5fa', fontWeight:600 } : {}} />
            </div>
            <div>
              <label style={labelStyle}>Ngày báo cáo *</label>
              <input type="date" className="input" value={form.report_date}
                min={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() - 2 * 86400000))}
                max={todayVN()}
                readOnly={dateLocked}
                onChange={dateLocked ? undefined : e => setField('report_date', e.target.value)}
                style={dateLocked ? { opacity: 0.7, cursor: 'not-allowed', color: '#fb923c', fontWeight: 600 } : {}}
                required />
            </div>
          </div>

          {isOverdue && (
            <div style={{
              background: 'rgba(251,146,60,0.1)',
              border: '1px solid rgba(251,146,60,0.35)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginTop: '12px',
              color: '#fb923c',
              fontSize: '0.82rem',
              lineHeight: 1.5,
            }}>
              ⚠️ <strong>Đã quá hạn nộp báo cáo</strong> — Hạn chót: {deadlineDisplay}. Báo cáo trễ vẫn được ghi nhận nhưng sẽ bị đánh dấu vi phạm.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4" style={{ marginTop:'14px' }}>
            <div>
              <label style={labelStyle}>Nhân sự báo cáo</label>
              <input className="input" readOnly value={user?.full_name || ''}
                style={{ opacity:0.7, cursor:'not-allowed', color: GOLD, fontWeight:600 }} />
            </div>
            <div>
              <label style={labelStyle}>Bộ phận</label>
              <input className="input" readOnly
                value={ROLE_DEPT_LABEL[user?.role] || user?.position || '—'}
                style={{ opacity:0.7, cursor:'not-allowed', color:'#93c5fd', fontWeight:600 }} />
            </div>
          </div>
        </div>

        {/* ── Nhân sự ── */}
        <div style={sectionStyle}>
          <h3 style={{ color: GOLD, fontSize:'0.84rem', fontWeight:800, letterSpacing:'0.1em', margin:'0 0 16px', textTransform:'uppercase' }}>
            Nhân Sự Tham Gia
          </h3>
          <div style={{ marginBottom:'14px' }}>
            <StaffSelect selected={form.km_staff} onChange={v => setField('km_staff', v)} />
            {errors.km_staff && <p style={{ color:'#f87171', fontSize:'0.80rem', marginTop:'4px' }}>⚠ {errors.km_staff}</p>}
          </div>
          <div>
            <label style={labelStyle}>Nhân sự Freelancer</label>
            <FreelancerPicker value={form.freelancer_staff} onChange={v => setField('freelancer_staff', v)}
              priorityDepts={KM_STAFF_GROUPS.filter(g => g.members.some(m => form.km_staff.includes(m))).map(g => g.dept)} />
          </div>
        </div>

        {/* ── Thời gian ── */}
        <div style={sectionStyle}>
          <h3 style={{ color: GOLD, fontSize:'0.84rem', fontWeight:800, letterSpacing:'0.1em', margin:'0 0 16px', textTransform:'uppercase' }}>
            Mốc Thời Gian
          </h3>
          <div className="grid grid-cols-2 gap-4 time-grid-keep-2">
            {[
              ['Thời gian có mặt', 'time_present', true],
              ['Thời gian Onset', 'time_onset', false],
              ['Thời gian Off máy', 'time_off', false],
              ['Thời gian kết thúc', 'time_end', true],
            ].map(([label, key, required]) => (
              <div key={key}>
                <label style={labelStyle}>{label} {required && <span style={{ color:'#f87171' }}>*</span>}</label>
                <TimeInput value={form[key]} onChange={v => setField(key, v)} hasError={!!errors[key]} />
                {errors[key] && <p style={{ color:'#f87171', fontSize:'0.80rem', marginTop:'3px' }}>⚠ {errors[key]}</p>}
              </div>
            ))}
          </div>
          {(() => {
            function calcDuration(start, end) {
              if (!start || !end) return null;
              const [sh, sm] = start.split(':').map(Number);
              const [eh, em] = end.split(':').map(Number);
              if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;
              let startMins = sh * 60 + sm;
              let endMins   = eh * 60 + em;
              if (endMins < startMins) endMins += 24 * 60;
              const diff  = endMins - startMins;
              const hours = Math.floor(diff / 60);
              const mins  = diff % 60;
              return mins === 0 ? `${hours}h` : `${hours}h${String(mins).padStart(2, '0')}`;
            }
            const kmDur  = calcDuration(form.time_present, form.time_end);
            const khDur  = calcDuration(form.time_onset,   form.time_off);
            if (!kmDur && !khDur) return null;
            return (
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'10px' }}>
                {kmDur && (
                  <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'rgba(201,168,76,0.12)', border:'1px solid rgba(201,168,76,0.4)', borderRadius:'999px', padding:'5px 14px' }}>
                    <span style={{ fontSize:'0.75rem', fontWeight:800, color:'#c9a84c', letterSpacing:'0.06em' }}>TIME KHÔI MINH</span>
                    <span style={{ fontSize:'0.95rem', fontWeight:800, color:'#fde68a', fontVariantNumeric:'tabular-nums' }}>{kmDur}</span>
                  </div>
                )}
                {khDur && (
                  <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.4)', borderRadius:'999px', padding:'5px 14px' }}>
                    <span style={{ fontSize:'0.75rem', fontWeight:800, color:'#60a5fa', letterSpacing:'0.06em' }}>TIME KHÁCH HÀNG</span>
                    <span style={{ fontSize:'0.95rem', fontWeight:800, color:'#93c5fd', fontVariantNumeric:'tabular-nums' }}>{khDur}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* ── Đánh giá ── */}
        <div style={sectionStyle}>
          <h3 style={{ color: GOLD, fontSize:'0.84rem', fontWeight:800, letterSpacing:'0.1em', margin:'0 0 16px', textTransform:'uppercase' }}>
            Đánh Giá & Kết Quả
          </h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div>
              <label style={labelStyle}>Nội dung công việc</label>
              <textarea className="input" rows={3} placeholder="Mô tả nội dung công việc đã thực hiện..."
                value={form.job_content} onChange={e => setField('job_content', e.target.value)}
                style={{ resize:'vertical', minHeight:'70px' }} />
            </div>
            <div>
              <ChipInput label={<>Tiến độ công việc <span style={{ color:'#f87171' }}>*</span></>} value={form.progress}
                onChange={v => setField('progress', v)} chips={PROGRESS_CHIPS} />
              {errors.progress && <p style={{ color:'#f87171', fontSize:'0.80rem', marginTop:'3px' }}>⚠ {errors.progress}</p>}
            </div>
            <div>
              <ChipInput label={<>Công việc hoàn thành <span style={{ color:'#f87171' }}>*</span></>} value={form.completed_work}
                onChange={v => setField('completed_work', v)} chips={COMPLETED_CHIPS} />
              {errors.completed_work && <p style={{ color:'#f87171', fontSize:'0.80rem', marginTop:'3px' }}>⚠ {errors.completed_work}</p>}
            </div>
            <div>
              <ChipInput label={<>Chất lượng dịch vụ <span style={{ color:'#f87171' }}>*</span></>} value={form.service_quality}
                onChange={v => setField('service_quality', v)} chips={QUALITY_CHIPS} />
              {errors.service_quality && <p style={{ color:'#f87171', fontSize:'0.80rem', marginTop:'3px' }}>⚠ {errors.service_quality}</p>}
            </div>
          </div>
        </div>

        {/* ── Vấn đề ── */}
        <div style={sectionStyle}>
          <h3 style={{ color: GOLD, fontSize:'0.84rem', fontWeight:800, letterSpacing:'0.1em', margin:'0 0 16px', textTransform:'uppercase' }}>
            Tồn Đọng & Sự Cố
          </h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div>
              <label style={labelStyle}>Chưa hoàn thành</label>
              <textarea className="input" rows={3} placeholder="Các hạng mục chưa hoàn thành..."
                value={form.incomplete} onChange={e => setField('incomplete', e.target.value)}
                style={{ resize:'vertical', minHeight:'70px' }} />
            </div>
            <div>
              <label style={labelStyle}>Sự cố phát sinh</label>
              <textarea className="input" rows={3} placeholder="Mô tả sự cố xảy ra trong sự kiện..."
                value={form.incidents} onChange={e => setField('incidents', e.target.value)}
                style={{ resize:'vertical', minHeight:'70px' }} />
            </div>
          </div>
        </div>

        {/* ── Hình ảnh ── */}
        <div style={sectionStyle}>
          <h3 style={{ color: GOLD, fontSize:'0.84rem', fontWeight:800, letterSpacing:'0.1em', margin:'0 0 16px', textTransform:'uppercase' }}>
            Hình Ảnh Đính Kèm
          </h3>
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display:'none' }}
            onChange={e => handleImageFiles(e.target.files)} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImg}
            style={{
              padding:'8px 16px', borderRadius:'8px', fontSize:'0.82rem',
              background:'rgba(201,168,76,0.08)', border:'1px solid rgba(201,168,76,0.3)',
              color: GOLD, cursor: uploadingImg ? 'not-allowed' : 'pointer',
            }}>
            {uploadingImg ? '⏳ Đang xử lý...' : '📷 Thêm ảnh'}
          </button>
          {form.images.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginTop:'12px' }}>
              {form.images.map((src, i) => (
                <div key={i} style={{ position:'relative' }}>
                  <img src={imgThumb(src)} alt="" style={{ width:'72px', height:'72px', objectFit:'cover', borderRadius:'6px', border:'1px solid rgba(201,168,76,0.3)' }} />
                  <button type="button" onClick={() => setField('images', form.images.filter((_, j) => j !== i))}
                    style={{
                      position:'absolute', top:'-6px', right:'-6px',
                      background:'#f87171', border:'none', borderRadius:'50%',
                      width:'18px', height:'18px', cursor:'pointer', color:'white', fontSize:'0.80rem', lineHeight:1,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Submit ── */}
        <div style={{ display:'flex', gap:'12px', marginTop:'8px' }}>
          <button type="submit" disabled={submitting || !form.event_id || (!editingId && notInSchedule)} className="btn-primary"
            style={{ flex:1, padding:'13px', fontSize:'1rem' }}>
            {submitting ? 'Đang lưu...' : editingId ? '✅ Cập nhật báo cáo' : '✅ Lưu báo cáo'}
          </button>
          <button type="button" onClick={() => { setView('list'); setForm(makeEmptyForm()); setEvSearch(''); setEditingId(null); setDateLocked(false); }}
            className="btn-secondary" style={{ padding:'13px 20px' }}>
            Huỷ
          </button>
        </div>

      </form>
    </div>
  );
}
