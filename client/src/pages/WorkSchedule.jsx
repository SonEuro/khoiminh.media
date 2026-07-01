import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import MultiDatePicker from '../components/MultiDatePicker';
import FreelancerPicker from '../components/FreelancerPicker';
import { DEPARTMENTS, KM_STAFF_GROUPS, FREELANCER_GROUPS } from '../constants/staff';
import { fmtD } from '../utils/fmt';

const GOLD = '#c9a84c';

const labelStyle = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  color: GOLD, letterSpacing: '0.06em', marginBottom: '5px',
  textTransform: 'uppercase',
};

const sectionStyle = {
  background: '#13131d', border: '1px solid rgba(201,168,76,0.15)',
  borderRadius: '12px', padding: '16px', marginBottom: '14px',
};

const PHASES = [
  { key: 'filming',   label: '🎬 Ngày Ghi Hình',            eventField: 'filming_date' },
  { key: 'setup',     label: '🏗 Ngày Bắt Đầu / Setup',     eventField: 'start_date' },
  { key: 'rehearsal', label: '🎤 Ngày Rehearsal',           eventField: 'show_date' },
  { key: 'teardown',  label: '📦 Ngày Kết Thúc / Tháo Dỡ',  eventField: 'end_date' },
];

const ROLE_DEPT_MAP = {
  TECHNICAL:  'Kỹ Thuật',
  ATAS:       'Âm Thanh Ánh Sáng',
  STAGE:      'Sân Khấu',
  CSVC:       'Cơ Sở Vật Chất',
  ACCOUNTING: 'Kế Toán',
  PRODUCTION: 'Kinh Doanh',
};

function getUserDept(fullName) {
  return KM_STAFF_GROUPS.find(g => g.members.includes(fullName || ''))?.dept || null;
}

function getTruongPhongDept(user) {
  if (!user?.is_truong_phong || ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role)) return null;
  return getUserDept(user?.full_name) || ROLE_DEPT_MAP[user?.role] || null;
}

function groupFreelancersByDept(commaStr) {
  const names = (commaStr || '').split(',').map(s => s.trim()).filter(Boolean);
  const groups = {};
  for (const name of names) {
    const dept = FREELANCER_GROUPS.find(g => g.members.includes(name))?.dept || 'Khác';
    if (!groups[dept]) groups[dept] = [];
    groups[dept].push(name);
  }
  return Object.entries(groups);
}

const EMPTY_FORM = {
  event_id: null, event_name: '', manualEvent: false,
  client: '', location: '',
  setup_date: [], teardown_date: [], rehearsal_date: [], filming_date: [],
  setup_leads: [], setup_km_staff: [], setup_freelancers: '',
  teardown_leads: [], teardown_km_staff: [], teardown_freelancers: '',
  rehearsal_leads: [], rehearsal_km_staff: [], rehearsal_freelancers: '',
  filming_leads: [], filming_km_staff: [], filming_freelancers: '',
};

// ── KM Staff multi-select (ưu tiên bộ phận đã chọn nhóm trưởng) ────────────────
function StaffMultiSelect({ selected, onChange, priorityDepts = [], excluded = [], restrictDept = null }) {
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

  const sortedGroups = [...KM_STAFF_GROUPS]
    .filter(g => !restrictDept || g.dept === restrictDept)
    .sort((a, b) => {
      const aP = priorityDepts.includes(a.dept) ? 0 : 1;
      const bP = priorityDepts.includes(b.dept) ? 0 : 1;
      return aP - bP;
    });

  // Chỉ hiện chips của bộ phận được phép — bộ phận khác giữ trong state nhưng ẩn
  const visibleSelected = restrictDept
    ? selected.filter(s => KM_STAFF_GROUPS.some(g => g.dept === restrictDept && g.members.includes(s)))
    : selected;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', textAlign: 'left', padding: '9px 12px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.3)',
          borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: visibleSelected.length ? '#e8c97a' : '#7878a0',
        }}>
        <span>{visibleSelected.length === 0 ? 'Chọn nhân sự Khôi Minh...' : `Đã chọn ${visibleSelected.length} người`}</span>
        <span style={{ color: GOLD, fontSize: '0.75rem' }}>{open ? '▲' : '▼'}</span>
      </button>

      {visibleSelected.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
          {visibleSelected.map(s => (
            <div key={s} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '5px 10px', borderRadius: '7px',
              background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.18)',
            }}>
              <span style={{ fontSize: '0.82rem', color: '#e8c97a' }}>{s}</span>
              <button type="button" onClick={() => toggle(s)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '0.9rem', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
          background: '#13131d', border: '1px solid rgba(201,168,76,0.3)',
          borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
          maxHeight: '280px', overflowY: 'auto',
        }}>
          {sortedGroups.map((g, gi) => (
            <div key={g.dept} style={{ borderBottom: gi < sortedGroups.length - 1 ? '1px solid rgba(201,168,76,0.08)' : 'none' }}>
              <div style={{
                padding: '6px 14px', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em',
                color: priorityDepts.includes(g.dept) ? '#60a5fa' : GOLD,
                background: 'rgba(201,168,76,0.04)',
              }}>
                {priorityDepts.includes(g.dept) ? '⭐ ' : ''}{g.dept.toUpperCase()}
              </div>
              {g.members.filter(m => !excluded.includes(m)).map(m => {
                const active = selected.includes(m);
                return (
                  <label key={m} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '7px 14px', cursor: 'pointer',
                    background: active ? 'rgba(201,168,76,0.08)' : 'transparent',
                  }}>
                    <input type="checkbox" checked={active} onChange={() => toggle(m)}
                      style={{ accentColor: GOLD, width: '15px', height: '15px', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.83rem', color: active ? '#e8c97a' : '#a0a0b8' }}>{m}</span>
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

// ── Khối nhóm trưởng (mỗi dòng = 1 bộ phận + 1 người) ──────────────────────────
function LeadsEditor({ leads, onChange, restrictDept = null }) {
  const deptOptions = restrictDept ? DEPARTMENTS.filter(d => d === restrictDept) : DEPARTMENTS;
  function addRow() { onChange([...leads, { department: restrictDept || DEPARTMENTS[0], name: '' }]); }
  function updateRow(i, k, v) { onChange(leads.map((r, j) => j === i ? { ...r, [k]: v, ...(k === 'department' ? { name: '' } : {}) } : r)); }
  function removeRow(i) { onChange(leads.filter((_, j) => j !== i)); }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {leads.map((row, i) => {
          if (restrictDept && row.department !== restrictDept) return null;
          const members = KM_STAFF_GROUPS.find(g => g.dept === row.department)?.members || [];
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: restrictDept ? '1fr 32px' : '1fr 1fr 32px', gap: '6px' }}>
              {!restrictDept && (
              <select className="input" value={row.department} onChange={e => updateRow(i, 'department', e.target.value)} style={{ fontSize: '0.82rem', height: '36px' }}>
                {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              )}
              <select className="input" value={row.name} onChange={e => updateRow(i, 'name', e.target.value)} style={{ fontSize: '0.82rem', height: '36px' }}>
                <option value="">-- Chọn nhóm trưởng --</option>
                {members.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button type="button" onClick={() => removeRow(i)}
                style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '7px', color: '#f87171', cursor: 'pointer' }}>×</button>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={addRow}
        style={{ marginTop: '6px', padding: '5px 12px', borderRadius: '7px', fontSize: '0.76rem', fontWeight: 700,
          background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', color: GOLD, cursor: 'pointer' }}>
        + Thêm nhóm trưởng
      </button>
    </div>
  );
}

// ── 1 khối ngày (setup/teardown/rehearsal/filming) ─────────────────────────────
function PhaseBlock({ phase, form, setForm, userDept = null }) {
  const leads = form[`${phase.key}_leads`];
  const kmStaff = form[`${phase.key}_km_staff`];
  const freelancers = form[`${phase.key}_freelancers`];
  const priorityDepts = [...new Set(leads.map(l => l.department).filter(Boolean))];
  const leadNames = leads.map(l => l.name).filter(Boolean);
  const freelancerDeptRestrict = userDept ? [userDept] : null;

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  return (
    <div style={sectionStyle}>
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>{phase.label}</label>
        <MultiDatePicker value={form[`${phase.key}_date`] || []} onChange={v => set(`${phase.key}_date`, v)} />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Nhóm trưởng (theo bộ phận)</label>
        <LeadsEditor leads={leads} onChange={v => set(`${phase.key}_leads`, v)} restrictDept={userDept} />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Nhân sự Khôi Minh</label>
        <StaffMultiSelect selected={kmStaff} onChange={v => set(`${phase.key}_km_staff`, v)} priorityDepts={priorityDepts} excluded={leadNames} restrictDept={userDept} />
      </div>

      <div>
        <label style={labelStyle}>Nhân sự Freelancer</label>
        <FreelancerPicker value={freelancers} onChange={v => set(`${phase.key}_freelancers`, v)} priorityDepts={priorityDepts} restrictDepts={freelancerDeptRestrict} />
      </div>
    </div>
  );
}

// ── Form tạo / sửa lịch ─────────────────────────────────────────────────────────
function ScheduleForm({ initial, events, onSaved, onClose }) {
  const { user } = useAuth();
  // Trưởng phòng chỉ được chỉnh sửa nhân sự bộ phận của mình
  const userDept = getTruongPhongDept(user);
  const [form, setForm] = useState(() => initial ? {
    ...EMPTY_FORM, ...initial,
    setup_date:    initial.setup_dates    || [],
    teardown_date: initial.teardown_dates || [],
    rehearsal_date:initial.rehearsal_dates|| [],
    filming_date:  initial.filming_dates  || [],
    manualEvent: !initial.event_id,
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function applyEvent(ev) {
    if (!ev) { setForm(f => ({ ...f, event_id: null, event_name: '' })); return; }
    let filming = ev.filming_date || '';
    if (!filming) { try { filming = (JSON.parse(ev.filming_dates || '[]'))[0] || ''; } catch { filming = ''; } }
    setForm(f => ({
      ...f,
      event_id: ev.id, event_name: ev.name,
      client: ev.client || f.client, location: ev.location || f.location,
      setup_date:    ev.start_date ? [ev.start_date] : f.setup_date,
      teardown_date: ev.end_date   ? [ev.end_date]   : f.teardown_date,
      rehearsal_date:ev.show_date  ? [ev.show_date]  : f.rehearsal_date,
      filming_date:  filming       ? [filming]        : f.filming_date,
    }));
  }

  async function submit() {
    if (!form.event_name?.trim()) { setError('Vui lòng chọn hoặc nhập tên sự kiện'); return; }
    setSaving(true); setError('');
    try {
      if (initial?.id) await api.updateWorkSchedule(initial.id, form);
      else await api.createWorkSchedule(form);
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial?.id ? `Chỉnh sửa lịch — ${initial.event_name}` : 'Tạo lịch làm việc mới'} onClose={onClose} size="xl">
      <div className="space-y-4">
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Sự kiện</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', color: '#7878a0' }}>
              <input type="checkbox" checked={form.manualEvent}
                onChange={e => setForm(f => ({ ...f, manualEvent: e.target.checked, event_id: e.target.checked ? null : f.event_id }))} />
              Nhập thủ công
            </label>
          </div>
          {form.manualEvent ? (
            <input className="input" placeholder="Nhập tên sự kiện..."
              value={form.event_name} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))} />
          ) : (
            <select className="input" value={form.event_id || ''}
              onChange={e => {
                const val = e.target.value;
                if (!val) { setForm(f => ({ ...f, event_id: null, event_name: '' })); return; }
                const ev = events.find(ev => ev.id === +val);
                if (ev) applyEvent(ev);
              }}>
              <option value="">-- Chọn sự kiện --</option>
              {form.event_id && !events.some(ev => ev.id === form.event_id) && (
                <option value={form.event_id}>{form.event_name} (sự kiện cũ, không còn trong danh sách)</option>
              )}
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} {ev.start_date ? `(${fmtD(ev.start_date)})` : ''}</option>)}
            </select>
          )}

          <div className="grid grid-cols-2 gap-3" style={{ marginTop: '12px' }}>
            <div>
              <label style={labelStyle}>Người phân lịch</label>
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.22)', color: '#e8c97a', fontWeight: 700, fontSize: '0.88rem' }}>
                {user?.full_name || '—'}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Khách hàng</label>
              <input className="input" value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="Nhập thủ công..." />
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <label style={labelStyle}>Địa điểm</label>
            <input className="input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Nhập thủ công..." />
          </div>
        </div>

        {PHASES.map(phase => <PhaseBlock key={phase.key} phase={phase} form={form} setForm={setForm} userDept={userDept} />)}

        {error && (
          <p style={{ color: '#f87171', fontSize: '0.85rem', background: 'rgba(248,113,113,0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)' }}>
            ⚠️ {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={submit} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Đang lưu...' : '💾 Lưu lịch (nháp)'}
          </button>
          <button onClick={onClose} className="btn-secondary">Hủy</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Section: Lịch của tôi (đang diễn ra + sắp tới) ─────────────────────────────
function MySchedulesSection({ schedules, user, onSelect }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const userName = user?.full_name || '';
  const userId = user?.id;

  function isMySchedule(s) {
    if (s.scheduler_user_id === userId) return true;
    for (const phase of PHASES) {
      const leads = s[`${phase.key}_leads`] || [];
      if (leads.some(l => l.name === userName)) return true;
      const km = s[`${phase.key}_km_staff`] || [];
      if (km.includes(userName)) return true;
      const free = (s[`${phase.key}_freelancers`] || '').split(',').map(x => x.trim()).filter(Boolean);
      if (free.includes(userName)) return true;
    }
    return false;
  }

  function nearestDate(s) {
    const dates = PHASES.flatMap(p => s[`${p.key}_dates`] || (s[`${p.key}_date`] ? [s[`${p.key}_date`]] : [])).sort();
    return dates.find(d => d >= today) || null;
  }

  function isOngoing(s) {
    return PHASES.some(p => (s[`${p.key}_dates`] || (s[`${p.key}_date`] ? [s[`${p.key}_date`]] : [])).includes(today));
  }

  const mine = schedules.filter(s => isMySchedule(s));
  const ongoing = mine.filter(s => isOngoing(s));
  const upcoming = mine
    .filter(s => !isOngoing(s) && nearestDate(s) !== null)
    .sort((a, b) => (nearestDate(a) || '').localeCompare(nearestDate(b) || ''));

  if (!ongoing.length && !upcoming.length) return null;

  function MiniCard({ s }) {
    const near = nearestDate(s);
    return (
      <div onClick={() => onSelect(s)}
        style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px', padding: '12px 14px', cursor: 'pointer',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.08)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
      >
        <p style={{ margin: '0 0 3px', fontWeight: 700, color: GOLD, fontSize: '0.88rem' }}>{s.event_name}</p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px', fontSize: '0.72rem', color: '#a0a0b8' }}>
          {s.setup_dates?.length > 0 && <span>🏗 {s.setup_dates.map(d => fmtD(d)).join(' · ')}</span>}
          {s.teardown_dates?.length > 0 && <span>📦 {s.teardown_dates.map(d => fmtD(d)).join(' · ')}</span>}
          {s.rehearsal_dates?.length > 0 && <span>🎤 {s.rehearsal_dates.map(d => fmtD(d)).join(' · ')}</span>}
          {s.filming_dates?.length > 0 && <span>🎬 {s.filming_dates.map(d => fmtD(d)).join(' · ')}</span>}
          {s.location && <span>📍 {s.location}</span>}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(96,165,250,0.04) 100%)',
      border: '1px solid rgba(167,139,250,0.25)', borderRadius: '14px',
      padding: '16px', marginBottom: '20px',
    }}>
      <h2 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 800, color: '#a78bfa', letterSpacing: '0.04em' }}>
        📅 Lịch làm việc của bạn
      </h2>
      {ongoing.length > 0 && (
        <div style={{ marginBottom: upcoming.length ? '14px' : 0 }}>
          <p style={{ margin: '0 0 6px', fontSize: '0.65rem', fontWeight: 800, color: '#4ade80', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            ● Đang diễn ra hôm nay
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {ongoing.map(s => <MiniCard key={s.id} s={s} />)}
          </div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: '0.65rem', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            ● Sắp tới
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {upcoming.map(s => <MiniCard key={s.id} s={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Trang chính ──────────────────────────────────────────────────────────────────
export default function WorkSchedule() {
  const { user } = useAuth();
  const canPhanLich = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role) || !!user?.is_phan_lich;

  const [schedules, setSchedules] = useState([]);
  const [events, setEvents] = useState([]);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    api.getWorkSchedules().then(setSchedules).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    api.getEvents().then(data => {
      setEvents(data.filter(e => e.status !== 'cancelled' && (!e.start_date || e.start_date >= today)));
    }).catch(() => {});
  }, [load]);

  function canEdit(s) {
    if (['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role)) return true;
    if (!!user?.is_truong_phong) return true;
    if (s.status === 'draft') return !!user?.is_phan_lich;
    return s.scheduler_user_id === user?.id;
  }

  function canDelete(s) {
    if (['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role)) return true;
    if (!!user?.is_truong_phong) return s.status === 'draft'; // Trưởng phòng chỉ xóa lịch nháp
    if (s.status === 'draft') return !!user?.is_phan_lich;
    return s.scheduler_user_id === user?.id;
  }

  async function handleConfirm(s) {
    if (!confirm(`Xác nhận lên lịch cho "${s.event_name}"? Sau khi xác nhận chỉ admin/người tạo mới sửa được.`)) return;
    try { await api.confirmWorkSchedule(s.id); load(); }
    catch (e) { alert(e.message); }
  }

  async function handleDelete(s) {
    if (!confirm(`Xóa lịch làm việc "${s.event_name}"?`)) return;
    try { await api.deleteWorkSchedule(s.id); load(); }
    catch (e) { alert(e.message); }
  }

  return (
    <div className="p-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: GOLD, margin: 0 }}>🗓 Lịch Làm Việc</h1>
          <p style={{ color: '#7878a0', fontSize: '0.85rem', margin: '4px 0 0' }}>Phân lịch nhân sự cho sự kiện</p>
        </div>
        {canPhanLich && (
          <button className="btn-primary" onClick={() => { setSelected(null); setModal('form'); }}>+ Tạo lịch mới</button>
        )}
      </div>

      {!canPhanLich && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '10px', padding: '11px 16px', marginBottom: '16px' }}>
          <span>🔒</span>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#60a5fa' }}>Bạn chỉ có thể xem lịch làm việc, không có quyền tạo/sửa.</p>
        </div>
      )}

      <MySchedulesSection
        schedules={schedules}
        user={user}
        onSelect={(s) => { setSelected(s); setModal('detail'); }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {schedules.map(s => (
          <div key={s.id} style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 700, color: GOLD, fontSize: '1rem' }}>{s.event_name}</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#7878a0' }}>
                  👤 {s.scheduler_name} {s.client ? `· 🏢 ${s.client}` : ''} {s.location ? `· 📍 ${s.location}` : ''}
                </p>
              </div>
              <span style={{
                padding: '3px 10px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700,
                background: s.status === 'confirmed' ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)',
                color: s.status === 'confirmed' ? '#4ade80' : '#fbbf24',
                border: `1px solid ${s.status === 'confirmed' ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)'}`,
              }}>
                {s.status === 'confirmed' ? '✓ Đã xác nhận' : '📝 Nháp'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '10px', fontSize: '0.75rem', color: '#a0a0b8' }}>
              {s.setup_dates?.length > 0 && <span>🏗 {s.setup_dates.map(d => fmtD(d)).join(' · ')}</span>}
              {s.teardown_dates?.length > 0 && <span>📦 {s.teardown_dates.map(d => fmtD(d)).join(' · ')}</span>}
              {s.rehearsal_dates?.length > 0 && <span>🎤 {s.rehearsal_dates.map(d => fmtD(d)).join(' · ')}</span>}
              {s.filming_dates?.length > 0 && <span>🎬 {s.filming_dates.map(d => fmtD(d)).join(' · ')}</span>}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              <button className="btn-secondary btn-sm" onClick={() => { setSelected(s); setModal('detail'); }}>Chi tiết</button>
              {canEdit(s) && (
                <button className="btn-secondary btn-sm" onClick={() => { setSelected(s); setModal('form'); }}>✏️ Sửa</button>
              )}
              {s.status === 'draft' && (!!user?.is_phan_lich || ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role)) && (
                <button className="btn-primary btn-sm" onClick={() => handleConfirm(s)}>✓ Xác nhận lên lịch</button>
              )}
              {canDelete(s) && (
                <button className="btn-danger btn-sm" onClick={() => handleDelete(s)}>🗑</button>
              )}
            </div>
          </div>
        ))}
        {schedules.length === 0 && (
          <p style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Chưa có lịch làm việc nào</p>
        )}
      </div>

      {modal === 'form' && (
        <ScheduleForm
          initial={selected}
          events={events}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      {modal === 'detail' && selected && (
        <Modal title={selected.event_name} onClose={() => setModal(null)} size="xl">
          <div className="space-y-3">
            <p style={{ fontSize: '0.85rem', color: '#a0a0b8' }}>
              👤 Người phân lịch: <strong style={{ color: GOLD }}>{selected.scheduler_name}</strong><br />
              🏢 Khách hàng: {selected.client || '—'}<br />
              📍 Địa điểm: {selected.location || '—'}
            </p>
            {(() => {
              const viewerDept = getTruongPhongDept(user);
              return PHASES.map(phase => {
                const leads = (selected[`${phase.key}_leads`] || [])
                  .filter(l => !viewerDept || l.department === viewerDept);
                let staff = (selected[`${phase.key}_km_staff`] || [])
                  .filter(n => !viewerDept || KM_STAFF_GROUPS.find(g => g.dept === viewerDept && g.members.includes(n)));
                const dates = selected[`${phase.key}_dates`] || (selected[`${phase.key}_date`] ? [selected[`${phase.key}_date`]] : []);
                const freeStr = selected[`${phase.key}_freelancers`] || '';
                const freeNames = freeStr.split(',').map(s => s.trim()).filter(Boolean);
                const filteredFree = viewerDept
                  ? freeNames.filter(n => FREELANCER_GROUPS.find(g => g.dept === viewerDept && g.members.includes(n)))
                  : freeNames;
                // Logic 2: ẩn phase nếu không có nhân sự (dù có ngày hay không)
                if (!leads.length && !staff.length && !filteredFree.length) return null;
                const freelancerGroups = groupFreelancersByDept(filteredFree.join(', '));
                return (
                  <div key={phase.key} style={sectionStyle}>
                    <p style={{ fontWeight: 700, color: GOLD, marginBottom: '6px' }}>{phase.label}{dates.length ? ` — ${dates.map(d => fmtD(d)).join(' · ')}` : ''}</p>
                    {leads.length > 0 && (
                      <div style={{ marginBottom: '6px' }}>
                        {leads.map((l, i) => (
                          <p key={i} style={{ fontSize: '0.82rem', color: '#e8c97a', margin: '1px 0' }}>👑 {l.name} <span style={{ color:'#7878a0' }}>({l.department})</span></p>
                        ))}
                      </div>
                    )}
                    {staff.length > 0 && (
                      <div style={{ marginBottom: '6px' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#60a5fa', margin: '0 0 3px', letterSpacing:'0.06em' }}>NHÂN SỰ KHÔI MINH</p>
                        {Object.entries(staff.reduce((acc, n) => {
                          const d = KM_STAFF_GROUPS.find(g => g.members.includes(n))?.dept || 'Khác';
                          (acc[d] = acc[d] || []).push(n); return acc;
                        }, {})).map(([dept, members]) => (
                          <p key={dept} style={{ fontSize: '0.82rem', color: '#a0a0b8', margin: '1px 0' }}>
                            <span style={{ color:'#7878a0', fontWeight:700, fontSize:'0.7rem' }}>{dept}:</span> {members.join(', ')}
                          </p>
                        ))}
                      </div>
                    )}
                    {freelancerGroups.length > 0 && (
                      <div>
                        <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#93c5fd', margin: '0 0 3px', letterSpacing:'0.06em' }}>FREELANCER</p>
                        {freelancerGroups.map(([dept, members]) => (
                          <p key={dept} style={{ fontSize: '0.82rem', color: '#a0a0b8', margin: '1px 0' }}>
                            <span style={{ color:'#7878a0', fontWeight:700, fontSize:'0.7rem' }}>{dept}:</span> {members.join(', ')}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </Modal>
      )}
    </div>
  );
}
