import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

const GOLD = '#c9a84c';

const KM_STAFF_GROUPS = [
  { dept: 'Cơ Sở Vật Chất', members: ['Đào Chí Hải', 'Ngô Văn Hào'] },
  { dept: 'Âm Thanh Ánh Sáng', members: [
    'Hà Minh Tâm', 'Trần Nhật Duy', 'Lê Trần Hoài Vĩ',
    'Huỳnh Sự', 'Trương Lê Trung Tín', 'Lê Trọng Đức',
  ]},
  { dept: 'Sân Khấu', members: [
    'Trần Duy Hùng', 'Nguyễn Trường Chinh', 'Hứa Khắc Cần',
    'Phạm Đăng Sinh', 'Nguyễn Ngọc Ly', 'Phạm Hữu Phúc Khang',
  ]},
  { dept: 'Kỹ Thuật', members: [
    'Nguyễn Văn Linh', 'Nguyễn Trí Tài', 'Võ Chí Thiện',
    'Lê Anh Kiệt', 'Nguyễn Thanh Sang', 'Phan Khắc Luyện',
    'Vũ Đức Tài', 'Đỗ Quý Vượng', 'Nguyễn Thành Trung',
    'Phan Ngọc Mạnh', 'Trần Đình Cương', 'Hồ Văn Toàn',
    'Hồ Bảo Trường', 'Trần Triệu Vĩ', 'Hoàng Văn Tuân',
  ]},
  { dept: 'Kế Toán', members: [
    'Đào Thái Hiền', 'Vũ Thị Hà', 'Lâm Kiều Duyên',
    'Nguyễn Thị Anh Thư', 'Nguyễn Kim Huệ',
  ]},
  { dept: 'Kinh Doanh', members: ['Nguyễn Thế Sơn', 'Lâm Tấn Nhân', 'Đào Nguyên Sơn'] },
];

const PROGRESS_CHIPS   = ['Đúng tiến độ', 'Hoàn thành sớm', 'Chậm tiến độ', 'Trễ tiến độ'];
const COMPLETED_CHIPS  = ['Hoàn thành tất cả hạng mục', 'Hoàn thành với điều chỉnh nhỏ', 'Hoàn thành một phần', 'Chưa hoàn thành'];
const QUALITY_CHIPS    = ['Xuất sắc', 'Tốt', 'Đạt yêu cầu', 'Cần cải thiện'];

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
              padding:'4px 10px', borderRadius:'9999px', fontSize:'0.72rem', fontWeight:600,
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
        <span style={{ color: GOLD, fontSize:'0.75rem' }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Selected pills (always visible below trigger) */}
      {selected.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:'5px', marginTop:'6px' }}>
          {selected.map(s => (
            <span key={s} style={{
              display:'inline-flex', alignItems:'center', gap:'4px',
              padding:'3px 8px', borderRadius:'9999px',
              background:'rgba(201,168,76,0.12)', border:'1px solid rgba(201,168,76,0.35)',
              color: GOLD, fontSize:'0.72rem', fontWeight:600,
            }}>
              {s}
              <button type="button" onClick={() => toggle(s)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#f87171', fontSize:'0.8rem', lineHeight:1, padding:0 }}>
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
                padding:'6px 14px', fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.1em',
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
                  style={{ fontSize:'0.65rem', color:'#7878a0', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
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
  display:'block', fontSize:'0.72rem', fontWeight:700,
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
    // Cap hh ≤ 24
    if (r.length >= 2 && parseInt(r.slice(0,2), 10) > 24) r = '24' + r.slice(2);
    // Cap mm ≤ 60
    if (r.length >= 4 && parseInt(r.slice(2,4), 10) > 60) r = r.slice(0,2) + '60';
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

// ── Report detail modal ───────────────────────────────────────────────────────
function ReportCard({ report, onDelete, isSuperAdmin }) {
  const [expanded, setExpanded] = useState(false);
  const [imgIdx, setImgIdx] = useState(null);

  const fmtDate = (d) => {
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0].slice(2,4)}`;
    return d;
  };

  return (
    <div style={{
      background:'#13131d', border:'1px solid rgba(201,168,76,0.2)',
      borderRadius:'12px', overflow:'hidden', marginBottom:'12px',
    }}>
      {/* Header row */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          padding:'14px 18px', cursor:'pointer', display:'flex', alignItems:'center', gap:'12px',
          borderBottom: expanded ? '1px solid rgba(201,168,76,0.15)' : 'none',
        }}
      >
        <div style={{ flex:1 }}>
          <p style={{ fontWeight:700, color:'#e8c97a', fontSize:'0.95rem', margin:0 }}>
            {report.event_label || 'Sự kiện không rõ'}
          </p>
          <p style={{ fontSize:'0.72rem', color:'#7878a0', margin:'3px 0 0' }}>
            {report.location && <span style={{ marginRight:'10px' }}>📍 {report.location}</span>}
            {report.report_date && <span>📅 {fmtDate(report.report_date)}</span>}
            {report.reporter_name && <span style={{ marginLeft:'10px' }}>👤 {report.reporter_name}</span>}
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {report.images?.length > 0 && (
            <span style={{ fontSize:'0.72rem', color:'#7878a0' }}>🖼 {report.images.length}</span>
          )}
          {report.km_staff?.length > 0 && (
            <span style={{ fontSize:'0.72rem', color:'#7878a0' }}>👥 {report.km_staff.length}</span>
          )}
          <span style={{ color: GOLD, fontSize:'0.8rem' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding:'16px 18px' }}>
          {/* Timeline row */}
          {(report.time_present || report.time_onset || report.time_off || report.time_end) && (
            <div className="time-grid-4" style={{
              display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px',
              background:'rgba(255,255,255,0.02)', borderRadius:'8px', padding:'12px', marginBottom:'14px',
            }}>
              {[
                ['Có mặt', report.time_present],
                ['Onset', report.time_onset],
                ['Off máy', report.time_off],
                ['Kết thúc', report.time_end],
              ].map(([l, v]) => v && (
                <div key={l} style={{ textAlign:'center' }}>
                  <p style={{ fontSize:'0.65rem', color:'#7878a0', margin:'0 0 3px', textTransform:'uppercase' }}>{l}</p>
                  <p style={{ fontSize:'0.9rem', fontWeight:700, color:GOLD, margin:0 }}>{v}</p>
                </div>
              ))}
            </div>
          )}

          {/* Staff */}
          {report.km_staff?.length > 0 && (
            <div style={{ marginBottom:'12px' }}>
              <p style={{ ...labelStyle, marginBottom:'6px' }}>Nhân sự Khôi Minh</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
                {report.km_staff.map(s => (
                  <span key={s} style={{
                    padding:'3px 9px', borderRadius:'9999px',
                    background:'rgba(201,168,76,0.12)', border:'1px solid rgba(201,168,76,0.3)',
                    color:GOLD, fontSize:'0.75rem', fontWeight:600,
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
          {report.images?.length > 0 && (
            <div style={{ marginBottom:'12px' }}>
              <p style={{ ...labelStyle, marginBottom:'8px' }}>Hình ảnh đính kèm ({report.images.length})</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                {report.images.map((src, i) => (
                  <img key={i} src={src} alt=""
                    onClick={() => setImgIdx(i)}
                    style={{ width:'80px', height:'80px', objectFit:'cover', borderRadius:'6px',
                      border:`1px solid rgba(201,168,76,0.3)`, cursor:'pointer' }} />
                ))}
              </div>
            </div>
          )}

          {isSuperAdmin && (
            <button type="button" onClick={() => { if (confirm('Xoá báo cáo này?')) onDelete(report.id); }}
              style={{
                marginTop:'6px', padding:'6px 14px', borderRadius:'6px', fontSize:'0.75rem',
                background:'rgba(220,50,50,0.12)', border:'1px solid rgba(220,50,50,0.3)',
                color:'#f87171', cursor:'pointer',
              }}>
              🗑 Xoá báo cáo
            </button>
          )}
        </div>
      )}

      {/* Lightbox */}
      {imgIdx !== null && (
        <div
          onClick={() => setImgIdx(null)}
          style={{
            position:'fixed', inset:0, zIndex:999,
            background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center',
          }}
        >
          <img src={report.images[imgIdx]} alt=""
            style={{ maxWidth:'90vw', maxHeight:'90vh', borderRadius:'8px', boxShadow:'0 0 40px rgba(0,0,0,0.8)' }} />
          <div style={{ position:'absolute', top:'20px', right:'20px', color:'white', fontSize:'1.5rem', cursor:'pointer' }}
            onClick={() => setImgIdx(null)}>✕</div>
          {report.images.length > 1 && (
            <>
              <button type="button" onClick={e => { e.stopPropagation(); setImgIdx((imgIdx - 1 + report.images.length) % report.images.length); }}
                style={{ position:'absolute', left:'20px', background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'50%', width:'40px', height:'40px', color:'white', fontSize:'1.2rem', cursor:'pointer' }}>‹</button>
              <button type="button" onClick={e => { e.stopPropagation(); setImgIdx((imgIdx + 1) % report.images.length); }}
                style={{ position:'absolute', right:'60px', background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'50%', width:'40px', height:'40px', color:'white', fontSize:'1.2rem', cursor:'pointer' }}>›</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const makeEmptyForm = () => ({
  event_id: '', event_label: '', location: '',
  report_date: new Date().toISOString().slice(0, 10),
  km_staff: [], freelancer_staff: '',
  time_present: '', time_onset: '', time_off: '', time_end: '',
  incomplete: '', incidents: '',
  progress: '', completed_work: '', service_quality: '',
  images: [],
});

export default function EventReport() {
  const { user } = useAuth();
  const isFullAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  // TRUONG_PHONG chỉ xóa báo cáo của nhân viên cùng phòng
  const canDeleteReport = (report) => {
    if (isFullAdmin) return true;
    if (!user?.is_truong_phong) return false;
    if (!report.reporter_role) return true; // báo cáo cũ chưa có reporter_user_id
    return report.reporter_role === user?.role;
  };

  const [view, setView] = useState('list'); // 'list' | 'form'
  const [reports, setReports] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState(makeEmptyForm);
  const [errors, setErrors] = useState({});
  const [evSearch, setEvSearch] = useState('');
  const [showEvDrop, setShowEvDrop] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    Promise.all([api.getEventReports(), api.getEvents()])
      .then(([r, e]) => { setReports(r); setEvents(e); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => { if (!e[key]) return e; const n = { ...e }; delete n[key]; return n; });
  }

  function selectEvent(ev) {
    setForm(f => ({ ...f, event_id: ev.id, event_label: ev.name, location: ev.location || '' }));
    setEvSearch(ev.name);
    setShowEvDrop(false);
  }

  const evSuggestions = showEvDrop
    ? (evSearch.trim()
        ? events.filter(e => e.name.toLowerCase().includes(evSearch.toLowerCase())).slice(0, 8)
        : events.slice(0, 8))
    : [];

  async function handleImageFiles(files) {
    setUploadingImg(true);
    try {
      const results = await Promise.all(Array.from(files).map(f => resizeImage(f)));
      setField('images', [...form.images, ...results]);
    } finally {
      setUploadingImg(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.event_id)                       errs.event_id       = 'Vui lòng chọn sự kiện';
    if (!form.km_staff?.length)               errs.km_staff       = 'Bắt buộc chọn ít nhất 1 nhân sự Khôi Minh';
    const validTime = v => { const [h, m] = (v || '').split(':'); return h?.length > 0 && m?.length > 0; };
    if (!validTime(form.time_present))        errs.time_present   = 'Bắt buộc nhập';
    if (!validTime(form.time_onset))          errs.time_onset     = 'Bắt buộc nhập';
    if (!validTime(form.time_off))            errs.time_off       = 'Bắt buộc nhập';
    if (!validTime(form.time_end))            errs.time_end       = 'Bắt buộc nhập';
    if (!form.progress?.trim())               errs.progress       = 'Bắt buộc chọn';
    if (!form.completed_work?.trim())         errs.completed_work = 'Bắt buộc chọn';
    if (!form.service_quality?.trim())        errs.service_quality= 'Bắt buộc chọn';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await api.createEventReport({ ...form, reporter_name: user?.full_name || '' });
      const updated = await api.getEventReports();
      setReports(updated);
      setForm(makeEmptyForm());
      setEvSearch('');
      setView('list');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    await api.deleteEventReport(id);
    setReports(r => r.filter(x => x.id !== id));
  }

  // ── List view ───────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="p-6 max-w-3xl">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
          <div>
            <h1 style={{ fontSize:'1.5rem', fontWeight:800, color:'#e8c97a', margin:0 }}>Báo Cáo Thực Hiện Sự Kiện</h1>
            <p style={{ color:'#7878a0', fontSize:'0.82rem', margin:'4px 0 0' }}>Nhân viên Khôi Minh báo cáo sau mỗi sự kiện</p>
          </div>
          <button onClick={() => setView('form')} className="btn-primary" style={{ whiteSpace:'nowrap' }}>
            + Tạo báo cáo
          </button>
        </div>

        {loading && <div className="card text-center py-10" style={{ color:'#7878a0' }}>Đang tải...</div>}

        {!loading && reports.length === 0 && (
          <div className="card text-center py-14">
            <p style={{ fontSize:'2.5rem', marginBottom:'8px' }}>📋</p>
            <p style={{ color:'#7878a0', fontWeight:600 }}>Chưa có báo cáo nào</p>
            <p style={{ color:'#7878a0', fontSize:'0.8rem', marginTop:'4px' }}>Nhấn "+ Tạo báo cáo" để tạo báo cáo đầu tiên</p>
          </div>
        )}

        {!loading && reports.map(r => (
          <ReportCard key={r.id} report={r} onDelete={handleDelete} isSuperAdmin={canDeleteReport(r)} />
        ))}
      </div>
    );
  }

  // ── Form view ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-2xl">
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
        <button onClick={() => setView('list')} style={{ background:'none', border:'none', color:'#7878a0', fontSize:'1.3rem', cursor:'pointer' }}>←</button>
        <div>
          <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'#e8c97a', margin:0 }}>Tạo Báo Cáo Sự Kiện</h1>
          <p style={{ color:'#7878a0', fontSize:'0.8rem', margin:0 }}>Điền đầy đủ thông tin sau sự kiện</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── Sự kiện & Địa điểm ── */}
        <div style={sectionStyle}>
          <h3 style={{ color: GOLD, fontSize:'0.78rem', fontWeight:800, letterSpacing:'0.1em', margin:'0 0 16px', textTransform:'uppercase' }}>
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
              <p style={{ fontSize:'0.72rem', color:'#4ade80', marginTop:'4px' }}>✅ {form.event_label}</p>
            )}
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
                    <span style={{ fontFamily:'monospace', fontSize:'0.68rem', color:'#7878a0', flexShrink:0 }}>{ev.code}</span>
                    <span style={{ flex:1, color:'#c9a84c', fontWeight:600, fontSize:'0.85rem' }}>{ev.name}</span>
                    {ev.location && <span style={{ fontSize:'0.68rem', color:'#60a5fa', flexShrink:0 }}>📍 {ev.location}</span>}
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
                onChange={e => setField('report_date', e.target.value)} required />
            </div>
          </div>

          <div style={{ marginTop:'14px' }}>
            <label style={labelStyle}>Nhân sự báo cáo</label>
            <input className="input" readOnly value={user?.full_name || ''}
              style={{ opacity:0.7, cursor:'not-allowed', color: GOLD, fontWeight:600 }} />
          </div>
        </div>

        {/* ── Nhân sự ── */}
        <div style={sectionStyle}>
          <h3 style={{ color: GOLD, fontSize:'0.78rem', fontWeight:800, letterSpacing:'0.1em', margin:'0 0 16px', textTransform:'uppercase' }}>
            Nhân Sự Tham Gia
          </h3>
          <div style={{ marginBottom:'14px' }}>
            <StaffSelect selected={form.km_staff} onChange={v => setField('km_staff', v)} />
            {errors.km_staff && <p style={{ color:'#f87171', fontSize:'0.73rem', marginTop:'4px' }}>⚠ {errors.km_staff}</p>}
          </div>
          <div>
            <label style={labelStyle}>Nhân sự Freelancer</label>
            <input className="input" placeholder="Tên nhân sự freelancer (nếu có)..."
              value={form.freelancer_staff} onChange={e => setField('freelancer_staff', e.target.value)} />
          </div>
        </div>

        {/* ── Thời gian ── */}
        <div style={sectionStyle}>
          <h3 style={{ color: GOLD, fontSize:'0.78rem', fontWeight:800, letterSpacing:'0.1em', margin:'0 0 16px', textTransform:'uppercase' }}>
            Mốc Thời Gian
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Thời gian có mặt', 'time_present'],
              ['Thời gian Onset', 'time_onset'],
              ['Thời gian Off máy', 'time_off'],
              ['Thời gian kết thúc', 'time_end'],
            ].map(([label, key]) => (
              <div key={key}>
                <label style={labelStyle}>{label} <span style={{ color:'#f87171' }}>*</span></label>
                <TimeInput value={form[key]} onChange={v => setField(key, v)} hasError={!!errors[key]} />
                {errors[key] && <p style={{ color:'#f87171', fontSize:'0.73rem', marginTop:'3px' }}>⚠ {errors[key]}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* ── Đánh giá ── */}
        <div style={sectionStyle}>
          <h3 style={{ color: GOLD, fontSize:'0.78rem', fontWeight:800, letterSpacing:'0.1em', margin:'0 0 16px', textTransform:'uppercase' }}>
            Đánh Giá & Kết Quả
          </h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div>
              <ChipInput label={<>Tiến độ công việc <span style={{ color:'#f87171' }}>*</span></>} value={form.progress}
                onChange={v => setField('progress', v)} chips={PROGRESS_CHIPS} />
              {errors.progress && <p style={{ color:'#f87171', fontSize:'0.73rem', marginTop:'3px' }}>⚠ {errors.progress}</p>}
            </div>
            <div>
              <ChipInput label={<>Công việc hoàn thành <span style={{ color:'#f87171' }}>*</span></>} value={form.completed_work}
                onChange={v => setField('completed_work', v)} chips={COMPLETED_CHIPS} />
              {errors.completed_work && <p style={{ color:'#f87171', fontSize:'0.73rem', marginTop:'3px' }}>⚠ {errors.completed_work}</p>}
            </div>
            <div>
              <ChipInput label={<>Chất lượng dịch vụ <span style={{ color:'#f87171' }}>*</span></>} value={form.service_quality}
                onChange={v => setField('service_quality', v)} chips={QUALITY_CHIPS} />
              {errors.service_quality && <p style={{ color:'#f87171', fontSize:'0.73rem', marginTop:'3px' }}>⚠ {errors.service_quality}</p>}
            </div>
          </div>
        </div>

        {/* ── Vấn đề ── */}
        <div style={sectionStyle}>
          <h3 style={{ color: GOLD, fontSize:'0.78rem', fontWeight:800, letterSpacing:'0.1em', margin:'0 0 16px', textTransform:'uppercase' }}>
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
          <h3 style={{ color: GOLD, fontSize:'0.78rem', fontWeight:800, letterSpacing:'0.1em', margin:'0 0 16px', textTransform:'uppercase' }}>
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
                  <img src={src} alt="" style={{ width:'72px', height:'72px', objectFit:'cover', borderRadius:'6px', border:'1px solid rgba(201,168,76,0.3)' }} />
                  <button type="button" onClick={() => setField('images', form.images.filter((_, j) => j !== i))}
                    style={{
                      position:'absolute', top:'-6px', right:'-6px',
                      background:'#f87171', border:'none', borderRadius:'50%',
                      width:'18px', height:'18px', cursor:'pointer', color:'white', fontSize:'0.65rem', lineHeight:1,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Submit ── */}
        <div style={{ display:'flex', gap:'12px', marginTop:'8px' }}>
          <button type="submit" disabled={submitting || !form.event_id} className="btn-primary"
            style={{ flex:1, padding:'13px', fontSize:'1rem' }}>
            {submitting ? 'Đang lưu...' : '✅ Lưu báo cáo'}
          </button>
          <button type="button" onClick={() => { setView('list'); setForm(makeEmptyForm()); setEvSearch(''); }}
            className="btn-secondary" style={{ padding:'13px 20px' }}>
            Huỷ
          </button>
        </div>

      </form>
    </div>
  );
}
