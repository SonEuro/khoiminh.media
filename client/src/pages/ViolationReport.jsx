import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { fmtD } from '../utils/fmt';

// ── Danh sách vi phạm ──────────────────────────────────────────────────────
const VIOLATION_TYPES = [
  'Đi trễ / Về sớm',
  'Vắng mặt không phép',
  'Vi phạm trang phục',
  'Không hoàn thành nhiệm vụ đúng hạn',
  'Gây mất trật tự / mất đoàn kết',
  'Vi phạm quy định an toàn',
  'Sử dụng điện thoại không đúng lúc',
  'Thái độ không chuyên nghiệp',
];

// ── Danh sách nhân sự theo bộ phận ────────────────────────────────────────
const VIOLATOR_GROUPS = [
  { dept: 'Cơ Sở Vật Chất', members: [
    'Đào Chí Hải', 'Ngô Văn Hào',
  ]},
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
  { dept: 'Kinh Doanh', members: [
    'Nguyễn Thế Sơn', 'Lâm Tấn Nhân', 'Đào Nguyên Sơn',
  ]},
];

// ── Resize ảnh về max 1000px để giảm dung lượng ───────────────────────────
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

const GOLD = '#c9a84c';

const cardStyle = {
  background: '#13131d',
  border: '1px solid rgba(201,168,76,0.15)',
  borderRadius: '12px',
  padding: '20px',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 700,
  color: GOLD,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: '6px',
};

export default function ViolationReport() {
  const { user } = useAuth();
  const isSuperAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);

  const [events,     setEvents]     = useState([]);
  const [violations, setViolations] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);

  const emptyForm = () => ({
    event_id: '', event_label: 'Nội bộ',
    violator: '', violatorCustom: '',
    violation_type: '', violationCustom: '',
    description: '', images: [],
  });
  const [form, setForm] = useState(emptyForm);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.getEvents().then(setEvents).catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  function load() {
    api.getViolations().then(setViolations).catch(() => {});
  }

  async function handleImages(e) {
    const files = Array.from(e.target.files);
    const resized = await Promise.all(files.map(f => resizeImage(f)));
    set('images', [...form.images, ...resized]);
    e.target.value = '';
  }

  async function submit(e) {
    e.preventDefault();
    const violator = form.violator === '__custom__'
      ? form.violatorCustom.trim()
      : form.violator.trim();
    const violation_type = form.violation_type === '__custom__'
      ? form.violationCustom.trim()
      : form.violation_type.trim();

    if (!violator)       return alert('Vui lòng nhập người vi phạm');
    if (!violation_type) return alert('Vui lòng chọn nội dung vi phạm');

    setSubmitting(true);
    try {
      await api.createViolation({
        event_id:       form.event_id || null,
        event_label:    form.event_id ? null : form.event_label,
        violator,
        violation_type,
        description:    form.description,
        images:         form.images,
      });
      setForm(emptyForm());
      setDone(true);
      setTimeout(() => setDone(false), 3500);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Báo Cáo Vi Phạm Nội Quy</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginTop: '2px' }}>
          Thông tin báo cáo được bảo mật — chỉ Tổng Giám Đốc và Giám Đốc Sản Xuất mới thấy tên người báo cáo
        </p>
      </div>

      {/* ── FORM ── */}
      <div style={cardStyle} className="mb-6">
        <h2 style={{ color: GOLD, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '16px' }}>
          Tạo báo cáo mới
        </h2>
        <form onSubmit={submit} className="space-y-4">

          {/* Sự kiện */}
          <div>
            <label style={labelStyle}>Sự kiện</label>
            <select className="input" value={form.event_id}
              onChange={e => {
                set('event_id', e.target.value);
                if (!e.target.value) set('event_label', 'Nội bộ');
              }}>
              <option value="">— Nội bộ (không có sự kiện) —</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.name} · {ev.code}</option>
              ))}
            </select>
          </div>

          {/* Người báo cáo */}
          <div>
            <label style={labelStyle}>Người báo cáo</label>
            <input className="input" value={user?.full_name || ''} readOnly
              style={{ opacity: 0.55, cursor: 'default' }} />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Tên này chỉ hiển thị với Tổng Giám Đốc và Giám Đốc Sản Xuất
            </p>
          </div>

          {/* Người vi phạm */}
          <div>
            <label style={labelStyle}>Người vi phạm *</label>
            <>
              <select className="input" value={form.violator}
                onChange={e => set('violator', e.target.value)}>
                <option value="">— Chọn người vi phạm —</option>
                {VIOLATOR_GROUPS.map(g => (
                  <optgroup key={g.dept} label={`── ${g.dept} ──`}>
                    {g.members.map(n => <option key={n} value={n}>{n}</option>)}
                  </optgroup>
                ))}
                <option value="__custom__">✏️ Nhập thủ công...</option>
              </select>
              {form.violator === '__custom__' && (
                <input className="input mt-2" placeholder="Nhập tên người vi phạm..."
                  value={form.violatorCustom}
                  onChange={e => set('violatorCustom', e.target.value)} />
              )}
            </>
          </div>

          {/* Nội dung vi phạm */}
          <div>
            <label style={labelStyle}>Nội dung vi phạm *</label>
            <select className="input" value={form.violation_type}
              onChange={e => set('violation_type', e.target.value)}>
              <option value="">— Chọn loại vi phạm —</option>
              {VIOLATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              <option value="__custom__">✏️ Nhập thủ công...</option>
            </select>
            {form.violation_type === '__custom__' && (
              <input className="input mt-2" placeholder="Mô tả nội dung vi phạm..."
                value={form.violationCustom}
                onChange={e => set('violationCustom', e.target.value)} />
            )}
          </div>

          {/* Mô tả thêm */}
          <div>
            <label style={labelStyle}>Mô tả chi tiết</label>
            <textarea className="input" rows={3}
              placeholder="Mô tả thêm về sự việc..."
              value={form.description}
              onChange={e => set('description', e.target.value)} />
          </div>

          {/* Hình ảnh */}
          <div>
            <label style={labelStyle}>Hình ảnh đính kèm</label>
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              border: '2px dashed rgba(201,168,76,0.25)',
              borderRadius: '8px', padding: '14px',
              cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem',
              transition: 'border-color 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.25)'}
            >
              <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImages} />
              <span style={{ fontSize: '1.1rem' }}>📎</span>
              <span>Chọn ảnh (có thể chọn nhiều)</span>
            </label>

            {form.images.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {form.images.map((src, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={src} alt="" style={{
                      width: '76px', height: '76px', objectFit: 'cover',
                      borderRadius: '7px', border: '1px solid rgba(201,168,76,0.25)',
                    }} />
                    <button type="button"
                      onClick={() => set('images', form.images.filter((_, j) => j !== i))}
                      style={{
                        position: 'absolute', top: '-7px', right: '-7px',
                        background: '#e53e3e', color: '#fff', border: 'none',
                        borderRadius: '50%', width: '20px', height: '20px',
                        fontSize: '0.65rem', cursor: 'pointer', lineHeight: '20px',
                        textAlign: 'center',
                      }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ paddingTop: '4px' }}>
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? 'Đang gửi...' : '📋 Gửi báo cáo'}
            </button>
          </div>

          {done && (
            <p style={{ textAlign: 'center', color: '#4ade80', fontSize: '0.85rem', fontWeight: 600 }}>
              ✅ Đã gửi báo cáo thành công!
            </p>
          )}
        </form>
      </div>

      {/* ── DANH SÁCH ── */}
      <div>
        <h2 style={{ color: GOLD, fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>
          Lịch sử báo cáo ({violations.length})
        </h2>

        {violations.length === 0 && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
            Chưa có báo cáo nào
          </div>
        )}

        <div className="space-y-3">
          {violations.map(v => (
            <ViolationCard key={v.id} v={v} isSuperAdmin={isSuperAdmin}
              onDelete={() => {
                if (!confirm('Xóa báo cáo này?')) return;
                api.deleteViolation(v.id).then(load).catch(e => alert(e.message));
              }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ViolationCard({ v, isSuperAdmin, onDelete }) {
  const [open, setOpen] = useState(false);
  const hasDetail = v.description || v.images?.length > 0;

  return (
    <div style={{
      background: '#13131d',
      border: '1px solid rgba(201,168,76,0.1)',
      borderLeft: '3px solid #e53e3e',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      {/* Row chính */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badge loại + sự kiện */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <span style={{
              background: 'rgba(229,62,62,0.15)', color: '#fc8181',
              fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
            }}>
              {v.violation_type}
            </span>
            <span style={{
              background: 'rgba(201,168,76,0.08)', color: GOLD,
              fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px',
            }}>
              {v.event_name || v.event_label || 'Nội bộ'}
            </span>
          </div>

          <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '3px' }}>
            👤 {v.violator}
          </p>

          {isSuperAdmin && v.reporter_name && (
            <p style={{ fontSize: '0.75rem', color: GOLD, marginBottom: '2px' }}>
              Báo cáo bởi: {v.reporter_name}
            </p>
          )}

          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{fmtD(v.created_at)}</p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {hasDetail && (
            <button onClick={() => setOpen(x => !x)} style={{
              background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
              color: GOLD, borderRadius: '6px', padding: '4px 10px',
              cursor: 'pointer', fontSize: '0.72rem',
            }}>
              {open ? '▲' : '▼'}
            </button>
          )}
          {isSuperAdmin && (
            <button onClick={onDelete} style={{
              background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.2)',
              color: '#fc8181', borderRadius: '6px', padding: '4px 8px',
              cursor: 'pointer', fontSize: '0.72rem',
            }}>🗑</button>
          )}
        </div>
      </div>

      {/* Chi tiết mở rộng */}
      {open && (
        <div style={{
          padding: '12px 16px 14px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.15)',
        }}>
          {v.description && (
            <p style={{
              fontSize: '0.85rem', color: 'var(--text-main)',
              whiteSpace: 'pre-wrap', lineHeight: '1.6', marginBottom: v.images?.length ? '12px' : 0,
            }}>{v.description}</p>
          )}
          {v.images?.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {v.images.map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noreferrer">
                  <img src={src} alt="" style={{
                    width: '80px', height: '80px', objectFit: 'cover',
                    borderRadius: '6px', border: '1px solid rgba(201,168,76,0.2)',
                    cursor: 'pointer',
                  }} />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
