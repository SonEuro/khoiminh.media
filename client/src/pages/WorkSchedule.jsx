import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import MultiDatePicker from '../components/MultiDatePicker';
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
  { key: 'filming',   label: '🎬 Ngày Ghi Hình',            eventField: 'filming_date', orange: true },
  { key: 'setup',     label: '🏗 Ngày Bắt Đầu / Setup',     eventField: 'start_date' },
  { key: 'rehearsal', label: '🎤 Ngày Rehearsal',           eventField: 'show_date' },
  { key: 'teardown',  label: '📦 Ngày Kết Thúc / Tháo Dỡ',  eventField: 'end_date' },
];

const FREELANCER_DEPT_LIST = FREELANCER_GROUPS.map(g => g.dept);

const ROLE_DEPT_MAP = {
  TECHNICAL:  'Kỹ Thuật',
  ATAS:       'Âm Thanh Ánh Sáng',
  STAGE:      'Sân Khấu',
  CSVC:       'Cơ Sở Vật Chất',
  ACCOUNTING: 'Kế Toán',
  PRODUCTION: 'Kinh Doanh',
};

const DEPT_COLORS = {
  'Âm Thanh Ánh Sáng': { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.22)' },
  'Sân Khấu':          { color: '#fb923c', bg: 'rgba(251,146,60,0.08)',   border: 'rgba(251,146,60,0.22)' },
  'Kỹ Thuật':          { color: '#38bdf8', bg: 'rgba(56,189,248,0.08)',   border: 'rgba(56,189,248,0.22)' },
  'Cơ Sở Vật Chất':   { color: '#4ade80', bg: 'rgba(74,222,128,0.08)',   border: 'rgba(74,222,128,0.22)' },
  'Kế Toán':           { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',   border: 'rgba(251,191,36,0.22)' },
  'Kinh Doanh':        { color: '#f472b6', bg: 'rgba(244,114,182,0.08)',  border: 'rgba(244,114,182,0.22)' },
  'Quay Phim':         { color: '#e879f9', bg: 'rgba(232,121,249,0.08)',  border: 'rgba(232,121,249,0.22)' },
  'Sản Xuất':          { color: '#34d399', bg: 'rgba(52,211,153,0.08)',   border: 'rgba(52,211,153,0.22)' },
};
function getDeptColor(dept) {
  return DEPT_COLORS[dept] || { color: '#7878a0', bg: 'rgba(120,120,160,0.06)', border: 'rgba(120,120,160,0.18)' };
}
const KM_DEPT_DISPLAY = { 'Âm Thanh Ánh Sáng': 'ATAS – LED', 'Kinh Doanh': 'Bộ Phận Sản Xuất' };
function getDeptDisplay(dept) { return KM_DEPT_DISPLAY[dept] || dept; }

function getUserDept(fullName) {
  return KM_STAFF_GROUPS.find(g => g.members.includes(fullName || ''))?.dept || null;
}

function getTruongPhongDept(user) {
  if (!user?.is_truong_phong || ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role) || user?.is_phan_lich_all) return null;
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
  setup_leads: {}, setup_km_staff: {}, setup_freelancers: {}, setup_notes: {}, setup_start_times: {},
  teardown_leads: {}, teardown_km_staff: {}, teardown_freelancers: {}, teardown_notes: {}, teardown_start_times: {},
  rehearsal_leads: {}, rehearsal_km_staff: {}, rehearsal_freelancers: {}, rehearsal_notes: {}, rehearsal_start_times: {},
  filming_leads: {}, filming_km_staff: {}, filming_freelancers: {}, filming_notes: {}, filming_start_times: {},
};

function initPerDateMap(map, flat, dates, isString) {
  if (map && typeof map === 'object' && !Array.isArray(map)) return map;
  const val = isString ? (typeof flat === 'string' ? flat : '') : (Array.isArray(flat) ? flat : []);
  const hasVal = isString ? !!val : val.length > 0;
  if (!hasVal || dates.length === 0) return {};
  const result = {};
  for (const d of dates) result[d] = isString ? val : [...val];
  return result;
}

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
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '7px 8px', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: '8px' }}>
              {!restrictDept && (
                <select className="input" value={row.department} onChange={e => updateRow(i, 'department', e.target.value)} style={{ fontSize: '0.82rem', height: '46px' }}>
                  {deptOptions.map(d => <option key={d} value={d}>{getDeptDisplay(d)}</option>)}
                </select>
              )}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <select className="input" value={row.name} onChange={e => updateRow(i, 'name', e.target.value)} style={{ flex: 1, fontSize: '0.82rem', height: '46px' }}>
                  <option value="">-- Chọn nhóm trưởng --</option>
                  {members.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button type="button" onClick={() => removeRow(i)}
                  style={{ width: '32px', height: '46px', flexShrink: 0, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '7px', color: '#f87171', cursor: 'pointer' }}>×</button>
              </div>
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

// ── Autocomplete input cho freelancer (single name mode) ────────────────────────
function FreelancerDeptInput({ dept, value, onChange }) {
  const members = FREELANCER_GROUPS.find(g => g.dept === dept)?.members || [];
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const currentWord = value.trim().toLowerCase();
  const suggestions = members.filter(m =>
    currentWord.length === 0 || m.toLowerCase().includes(currentWord)
  );

  function pick(name) {
    onChange(name);
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={value}
        placeholder="Tìm tên freelancer..."
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ width:'100%', height:'30px', padding:'0 8px', boxSizing:'border-box', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', color:'#c0c0d8', fontSize:'0.8rem', outline:'none' }}
      />
      {open && suggestions.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300, background:'#1a1a2e', border:'1px solid rgba(167,139,250,0.3)', borderRadius:'8px', maxHeight:'160px', overflowY:'auto', marginTop:'2px', boxShadow:'0 8px 24px rgba(0,0,0,0.6)' }}>
          {suggestions.map(name => (
            <div key={name} onMouseDown={() => pick(name)}
              style={{ padding:'6px 12px', cursor:'pointer', fontSize:'0.82rem', color:'#c0c0d8' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Thêm nhân sự freelancer thủ công (chọn bộ phận + nhập tên) ─────────────────
function AddFreelancerRow({ availableDepts, onAdd, onCancel }) {
  const [dept, setDept] = useState(availableDepts[0] || '');
  const [name, setName] = useState('');

  function handleAdd() {
    const trimmed = name.trim().replace(/,\s*$/, '');
    if (!trimmed || !dept) return;
    onAdd(dept, trimmed);
    setName('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', padding: '8px', background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '8px' }}>
      {availableDepts.length > 1 ? (
        <select value={dept} onChange={e => setDept(e.target.value)}
          style={{ width: '100%', height: '44px', padding: '0 8px', background: '#161628', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '6px', color: '#c0c0d8', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}>
          {availableDepts.map(d => <option key={d} value={d}>{getDeptDisplay(d)}</option>)}
        </select>
      ) : (
        <span style={{ fontSize: '0.72rem', color: '#a78bfa', fontWeight: 700, padding: '0 2px' }}>{getDeptDisplay(dept)}</span>
      )}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FreelancerDeptInput dept={dept} value={name} onChange={setName} />
        </div>
        <button
          onMouseDown={e => { e.preventDefault(); handleAdd(); }}
          style={{ height: '42px', padding: '0 10px', background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '6px', color: '#4ade80', fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0, fontWeight: 700 }}>
          + Thêm
        </button>
        <button
          onMouseDown={e => { e.preventDefault(); onCancel(); }}
          style={{ height: '42px', padding: '0 7px', background: 'none', border: 'none', color: '#7878a0', cursor: 'pointer', fontSize: '1rem', flexShrink: 0 }}>
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Thêm nhân sự KM (chọn bộ phận + tên, 1 người/lần) ──────────────────────────
function AddKMStaffRow({ availableDepts, excluded = [], onAdd, onCancel }) {
  const kmDepts = availableDepts.length ? availableDepts : KM_STAFF_GROUPS.map(g => g.dept);
  const [dept, setDept] = useState(kmDepts[0] || '');
  const [name, setName] = useState('');
  const members = (KM_STAFF_GROUPS.find(g => g.dept === dept)?.members || []).filter(m => !excluded.includes(m));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', padding: '8px', background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '8px' }}>
      {kmDepts.length > 1 ? (
        <select value={dept} onChange={e => { setDept(e.target.value); setName(''); }}
          style={{ width: '100%', height: '44px', padding: '0 8px', background: '#161628', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '6px', color: '#c0c0d8', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}>
          {kmDepts.map(d => <option key={d} value={d}>{getDeptDisplay(d)}</option>)}
        </select>
      ) : (
        <span style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: 700, padding: '0 2px' }}>{getDeptDisplay(dept)}</span>
      )}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <select value={name} onChange={e => setName(e.target.value)}
          style={{ flex: 1, height: '42px', padding: '0 6px', background: '#161628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#c0c0d8', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}>
          <option value="">-- Chọn nhân sự --</option>
          {members.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <button
          onMouseDown={e => { e.preventDefault(); if (!name) return; onAdd(name); setName(''); }}
          style={{ height: '42px', padding: '0 10px', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '6px', color: '#60a5fa', fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0, fontWeight: 700 }}>
          + Thêm
        </button>
        <button
          onMouseDown={e => { e.preventDefault(); onCancel(); }}
          style={{ height: '42px', padding: '0 7px', background: 'none', border: 'none', color: '#7878a0', cursor: 'pointer', fontSize: '1rem', flexShrink: 0 }}>
          ✕
        </button>
      </div>
    </div>
  );
}

// ── 1 khối ngày (setup/teardown/rehearsal/filming) ─────────────────────────────
function PhaseBlock({ phase, form, setForm, userDept = null, isPhanLichAll = false }) {
  const leadsMap        = form[`${phase.key}_leads`]        || {};
  const kmMap           = form[`${phase.key}_km_staff`]     || {};
  const freelancersMap  = form[`${phase.key}_freelancers`]  || {};
  const notesMap        = form[`${phase.key}_notes`]        || {};
  const startTimesMap   = form[`${phase.key}_start_times`]  || {};
  const dates           = form[`${phase.key}_date`]         || [];
  const todayStr        = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const [showAddRow, setShowAddRow]       = useState({});
  const [kmDeptFilter, setKMDeptFilter]   = useState({});
  const [noteDeptFilter, setNoteDeptFilter] = useState({});
  const multiDate      = dates.length > 1;
  const singleKey      = dates[0] || '_all';
  const allLeads       = Object.values(leadsMap).flat();
  const priorityDepts  = [...new Set(allLeads.map(l => l.department).filter(Boolean))];

  // Depts visible to this user (restricted if Trưởng phòng)
  const visibleFreeDepts  = userDept ? FREELANCER_DEPT_LIST.filter(d => d === userDept) : FREELANCER_DEPT_LIST;
  const visibleNoteDepts  = userDept ? DEPARTMENTS.filter(d => d === userDept) : DEPARTMENTS;

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  const subLabel  = { ...labelStyle, fontSize: '0.62rem', color: '#a0a0b8', marginBottom: '4px' };
  const deptLbl   = { fontSize: '0.6rem', color: '#6b7280', fontWeight: 700, display: 'block', marginBottom: '2px', letterSpacing: '0.04em' };
  const deptInput = { width: '100%', height: '42px', padding: '0 8px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#c0c0d8', fontSize: '0.8rem', outline: 'none' };

  function setFree(dateKey, dept, val) {
    const cur = typeof freelancersMap[dateKey] === 'object' ? (freelancersMap[dateKey] || {}) : {};
    set(`${phase.key}_freelancers`, { ...freelancersMap, [dateKey]: { ...cur, [dept]: val } });
  }
  function setNote(dateKey, dept, val) {
    const cur = typeof notesMap[dateKey] === 'object' ? (notesMap[dateKey] || {}) : {};
    set(`${phase.key}_notes`, { ...notesMap, [dateKey]: { ...cur, [dept]: val } });
  }
  function setStartTime(dateKey, dept, val) {
    const cur = startTimesMap[dateKey] || {};
    set(`${phase.key}_start_times`, { ...startTimesMap, [dateKey]: { ...cur, [dept]: val } });
  }
  const START_TIME_DEPTS = DEPARTMENTS.filter(d => d !== 'Kế Toán' && d !== 'Kinh Doanh');
  function renderStartTimes(dateKey) {
    const timesObj = startTimesMap[dateKey] || {};
    const visibleDepts = userDept
      ? START_TIME_DEPTS.filter(d => d === userDept)
      : START_TIME_DEPTS;
    if (!visibleDepts.length) return null;
    return (
      <div style={{ marginBottom: '10px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#60a5fa', letterSpacing: '0.06em' }}>⏰ GIỜ BẮT ĐẦU</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(96,165,250,0.2)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '6px 12px' }}>
          {visibleDepts.map(dept => {
            const dc = getDeptColor(dept);
            return (
              <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, background: dc.bg, border: `1px solid ${dc.border}`, borderRadius: '7px', padding: '8px 10px' }}>
                <span style={{ fontSize: '0.75rem', color: dc.color, fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getDeptDisplay(dept)}</span>
                <input
                  type="time"
                  value={timesObj[dept] ?? ''}
                  onChange={e => setStartTime(dateKey, dept, e.target.value)}
                  style={{ width: '88px', height: '38px', padding: '0 6px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${dc.border}`, borderRadius: '6px', color: '#e8c97a', fontSize: '0.82rem', fontWeight: 700, outline: 'none', flexShrink: 0 }}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderFreelancerNotes(dateKey) {
    const freeDeptObj  = (typeof freelancersMap[dateKey] === 'object' ? freelancersMap[dateKey] : {}) || {};
    const notesDeptObj = (typeof notesMap[dateKey] === 'object'       ? notesMap[dateKey]       : {}) || {};

    // Flatten to individual name entries
    const nameEntries = visibleFreeDepts.flatMap(dept =>
      (freeDeptObj[dept] || '').split(',').map(n => n.trim()).filter(Boolean).map(name => ({ dept, name }))
    );
    function removeName(dept, nameToRemove) {
      const names = (freeDeptObj[dept] || '').split(',').map(n => n.trim()).filter(n => n && n !== nameToRemove);
      setFree(dateKey, dept, names.join(', '));
    }

    return (
      <>
        {visibleFreeDepts.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <label style={subLabel}>Freelancer (theo bộ phận)</label>
            {isPhanLichAll ? (
              <>
                {nameEntries.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '5px' }}>
                    {nameEntries.map(({ dept, name }) => {
                      const dc = getDeptColor(dept);
                      return (
                        <div key={`${dept}-${name}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', background: dc.bg, border: `1px solid ${dc.border}`, borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.72rem', color: dc.color, fontWeight: 700, flexShrink: 0 }}>{getDeptDisplay(dept)}</span>
                          <span style={{ fontSize: '0.82rem', color: '#e0e0ee', flex: 1 }}>{name}</span>
                          <button
                            onMouseDown={e => { e.preventDefault(); removeName(dept, name); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: dc.color, fontSize: '0.9rem', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {showAddRow[dateKey] ? (
                  <AddFreelancerRow
                    availableDepts={visibleFreeDepts}
                    onAdd={(dept, name) => {
                      const existing = (freeDeptObj[dept] || '').trim().replace(/,\s*$/, '');
                      setFree(dateKey, dept, existing ? `${existing}, ${name}` : name);
                      setShowAddRow(p => ({ ...p, [dateKey]: false }));
                    }}
                    onCancel={() => setShowAddRow(p => ({ ...p, [dateKey]: false }))}
                  />
                ) : (
                  <button
                    onClick={() => setShowAddRow(p => ({ ...p, [dateKey]: true }))}
                    style={{ marginTop: '2px', width: '100%', padding: '5px 0', background: 'rgba(167,139,250,0.05)', border: '1px dashed rgba(167,139,250,0.25)', borderRadius: '6px', color: '#a78bfa', fontSize: '0.75rem', cursor: 'pointer' }}>
                    + Thêm nhân sự freelancer
                  </button>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {visibleFreeDepts.map(dept => (
                  <div key={dept}>
                    <span style={deptLbl}>{getDeptDisplay(dept)}</span>
                    <FreelancerDeptInput
                      dept={dept}
                      value={freeDeptObj[dept] || ''}
                      onChange={val => setFree(dateKey, dept, val)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {visibleNoteDepts.length > 0 && (() => {
          const filledNotes = visibleNoteDepts.filter(d => notesDeptObj[d]?.trim());
          const activeNoteDept = noteDeptFilter[dateKey] || visibleNoteDepts[0] || '';
          return (
            <div>
              <label style={subLabel}>Ghi chú (theo bộ phận)</label>
              {filledNotes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '6px' }}>
                  {filledNotes.map(dept => {
                    const dc = getDeptColor(dept);
                    return (
                      <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', background: dc.bg, border: `1px solid ${dc.border}`, borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.72rem', color: dc.color, fontWeight: 700, flexShrink: 0 }}>{getDeptDisplay(dept)}</span>
                        <span style={{ fontSize: '0.8rem', color: '#d4c8a0', flex: 1, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notesDeptObj[dept]}</span>
                        <button
                          onMouseDown={e => { e.preventDefault(); setNote(dateKey, dept, ''); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: dc.color, fontSize: '0.9rem', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
                      </div>
                    );
                  })}
                </div>
              )}
              <select
                value={activeNoteDept}
                onChange={e => setNoteDeptFilter(p => ({ ...p, [dateKey]: e.target.value }))}
                style={{ width: '100%', height: '42px', padding: '0 8px', marginBottom: '5px', background: '#161628', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '6px', color: '#c9b98a', fontSize: '0.78rem', outline: 'none', cursor: 'pointer' }}>
                {visibleNoteDepts.map(d => <option key={d} value={d}>{getDeptDisplay(d)}</option>)}
              </select>
              <input
                placeholder="Ghi chú... (không bắt buộc)"
                value={notesDeptObj[activeNoteDept] || ''}
                onChange={e => setNote(dateKey, activeNoteDept, e.target.value)}
                style={{ ...deptInput, color: '#c9b98a', fontStyle: 'italic' }}
              />
            </div>
          );
        })()}
      </>
    );
  }

  const kmDeptList = userDept
    ? KM_STAFF_GROUPS.filter(g => g.dept === userDept).map(g => g.dept)
    : KM_STAFF_GROUPS.map(g => g.dept);

  function renderKMStaff(dateKey) {
    const selected = kmMap[dateKey] || [];
    const dayLeads = leadsMap[dateKey] || [];
    const excluded = dayLeads.map(l => l.name).filter(Boolean);

    if (!isPhanLichAll) {
      return (
        <div style={{ marginBottom: '8px' }}>
          <label style={subLabel}>Nhân sự Khôi Minh</label>
          <StaffMultiSelect
            selected={selected}
            onChange={v => set(`${phase.key}_km_staff`, { ...kmMap, [dateKey]: v })}
            priorityDepts={priorityDepts} excluded={excluded} restrictDept={userDept}
          />
        </div>
      );
    }

    const deptList = userDept
      ? KM_STAFF_GROUPS.filter(g => g.dept === userDept).map(g => g.dept)
      : KM_STAFF_GROUPS.map(g => g.dept);
    const activeDept = kmDeptFilter[dateKey] || deptList[0] || '';
    return (
      <div style={{ marginBottom: '8px' }}>
        <label style={subLabel}>Nhân sự Khôi Minh</label>
        {(() => {
          const displayRows = userDept
            ? selected.filter(name => KM_STAFF_GROUPS.find(g => g.dept === userDept && g.members.includes(name)))
            : selected;
          return displayRows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '6px' }}>
              {displayRows.map(name => {
                const dept = KM_STAFF_GROUPS.find(g => g.members.includes(name))?.dept || '';
                const dc = getDeptColor(dept);
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', background: dc.bg, border: `1px solid ${dc.border}`, borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.6rem', color: dc.color, fontWeight: 700, flexShrink: 0 }}>{getDeptDisplay(dept)}</span>
                    <span style={{ fontSize: '0.82rem', color: '#e0e0ee', flex: 1 }}>{name}</span>
                    <button
                      onMouseDown={e => { e.preventDefault(); set(`${phase.key}_km_staff`, { ...kmMap, [dateKey]: selected.filter(n => n !== name) }); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: dc.color, fontSize: '0.9rem', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
                  </div>
                );
              })}
            </div>
          );
        })()}
        <select
          value={activeDept}
          onChange={e => setKMDeptFilter(p => ({ ...p, [dateKey]: e.target.value }))}
          style={{ width: '100%', height: '42px', padding: '0 8px', marginBottom: '5px', background: '#161628', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '6px', color: '#93c5fd', fontSize: '0.78rem', outline: 'none', cursor: 'pointer' }}>
          {deptList.map(d => <option key={d} value={d}>{getDeptDisplay(d)}</option>)}
        </select>
        <StaffMultiSelect
          selected={selected}
          onChange={v => set(`${phase.key}_km_staff`, { ...kmMap, [dateKey]: v })}
          priorityDepts={priorityDepts} excluded={excluded} restrictDept={activeDept}
        />
      </div>
    );
  }

  function renderDateSection(dateKey) {
    const dayLeads    = leadsMap[dateKey] || [];
    const dayExcluded = dayLeads.map(l => l.name).filter(Boolean);
    return (
      <>
        {renderStartTimes(dateKey)}
        <div style={{ marginBottom: '8px' }}>
          <label style={subLabel}>Nhóm trưởng</label>
          <LeadsEditor leads={dayLeads} onChange={v => set(`${phase.key}_leads`, { ...leadsMap, [dateKey]: v })} restrictDept={userDept} />
        </div>
        {renderKMStaff(dateKey)}
        {renderFreelancerNotes(dateKey)}
      </>
    );
  }

  return (
    <div style={sectionStyle}>
      <div style={{ marginBottom: '12px' }}>
        <label style={labelStyle}>{phase.label}</label>
        <MultiDatePicker value={dates} onChange={v => set(`${phase.key}_date`, v)} placeholder="Chọn ngày..." />
      </div>

      {multiDate ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {dates.map(d => {
            const isPastLocked = d < todayStr && !isPhanLichAll;
            return (
              <div key={d} style={{ padding: '10px 12px', borderRadius: '8px', background: isPastLocked ? 'rgba(120,120,160,0.04)' : 'rgba(251,191,36,0.04)', border: `1px solid ${isPastLocked ? 'rgba(120,120,160,0.15)' : 'rgba(251,191,36,0.12)'}` }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: isPastLocked ? '#7878a0' : '#fbbf24', marginBottom: '10px', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📅 {fmtD(d)}
                  {isPastLocked && <span style={{ fontSize: '0.65rem', color: '#555570' }}>🔒 Ngày đã qua</span>}
                </div>
                <div style={isPastLocked ? { pointerEvents: 'none', opacity: 0.45, userSelect: 'none' } : {}}>
                  {renderDateSection(d)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {renderStartTimes(singleKey)}
          <div style={{ marginBottom: '10px' }}>
            <label style={labelStyle}>Nhóm trưởng (theo bộ phận)</label>
            <LeadsEditor leads={leadsMap[singleKey] || []} onChange={v => set(`${phase.key}_leads`, { ...leadsMap, [singleKey]: v })} restrictDept={userDept} />
          </div>
          {renderKMStaff(singleKey)}
          {renderFreelancerNotes(singleKey)}
        </>
      )}
    </div>
  );
}

// ── Form tạo / sửa lịch ─────────────────────────────────────────────────────────
function ScheduleForm({ initial, events, schedules = [], onSaved, onClose, onSwitchToEdit }) {
  const { user } = useAuth();
  const isPhanLich = !!user?.is_phan_lich && !user?.is_phan_lich_all && !['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  const userDept = getTruongPhongDept(user) ||
    (isPhanLich ? getUserDept(user?.full_name) || ROLE_DEPT_MAP[user?.role] || null : null);
  const [form, setForm] = useState(() => initial ? {
    ...EMPTY_FORM, ...initial,
    setup_date:    initial.setup_dates    || [],
    teardown_date: initial.teardown_dates || [],
    rehearsal_date:initial.rehearsal_dates|| [],
    filming_date:  initial.filming_dates  || [],
    manualEvent: !initial.event_id,
    ...Object.fromEntries(PHASES.flatMap(p => [
      [`${p.key}_km_staff`,    initPerDateMap(initial[`${p.key}_km_staff_map`],    initial[`${p.key}_km_staff`],    initial[`${p.key}_dates`] || [], false)],
      [`${p.key}_leads`,       initPerDateMap(initial[`${p.key}_leads_map`],       initial[`${p.key}_leads`],       initial[`${p.key}_dates`] || [], false)],
      [`${p.key}_freelancers`,  (() => { const m = initial[`${p.key}_freelancers_map`]; if (!m) return {}; const vals = Object.values(m); return (vals.length && vals[0] && typeof vals[0] === 'object') ? m : {}; })()],
      [`${p.key}_notes`,        initial[`${p.key}_notes`]       || {}],
      [`${p.key}_start_times`,  initial[`${p.key}_start_times`] || {}],
    ])),
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Phát hiện sự kiện đã có lịch (chỉ check khi tạo mới)
  const existingForEvent = useMemo(() => {
    if (initial?.id || !form.event_id) return null;
    return schedules.find(s => s.event_id === form.event_id) || null;
  }, [form.event_id, schedules, initial?.id]);

  const isDeptAssignedInExisting = useMemo(() => {
    if (!existingForEvent || !userDept) return false;
    return PHASES.some(p => {
      const km = existingForEvent[`${p.key}_km_staff`] || [];
      if (km.some(name => KM_STAFF_GROUPS.find(g => g.dept === userDept && g.members.includes(name)))) return true;
      const leads = existingForEvent[`${p.key}_leads`] || [];
      if (leads.some(l => l.department === userDept)) return true;
      return false;
    });
  }, [existingForEvent, userDept]);

  // Có cần chặn tạo mới không? — luôn chặn nếu event đã có lịch
  const blockCreate = !!existingForEvent;

  // Phát hiện trùng lịch: (tên nhân sự, ngày) đã có trong lịch khác
  const conflicts = useMemo(() => {
    if (!schedules.length) return [];
    const seen = new Map();
    for (const phase of PHASES) {
      const dates = form[`${phase.key}_date`] || [];
      const kmMap  = form[`${phase.key}_km_staff`]    || {};
      const ldsMap = form[`${phase.key}_leads`]        || {};
      const freMap = form[`${phase.key}_freelancers`]  || {};
      for (const date of dates) {
        const kmNames   = Array.isArray(kmMap[date]) ? kmMap[date] : [];
        const ldNames   = (ldsMap[date] || []).map(l => l.name).filter(Boolean);
        const freRaw    = freMap[date];
        const freNames  = freRaw && typeof freRaw === 'object'
          ? Object.values(freRaw).flatMap(v => (v||'').split(',').map(n=>n.trim())).filter(Boolean)
          : typeof freRaw === 'string' ? freRaw.split(',').map(n=>n.trim()).filter(Boolean) : [];
        const allNames  = [...new Set([...kmNames, ...ldNames, ...freNames])];
        if (!allNames.length) continue;
        for (const other of schedules) {
          if (other.id === initial?.id) continue;
          for (const op of PHASES) {
            if (!(other[`${op.key}_dates`] || []).includes(date)) continue;
            const oKmMap = other[`${op.key}_km_staff_map`] || {};
            const oKm    = Array.isArray(oKmMap[date]) ? oKmMap[date] : (Array.isArray(other[`${op.key}_km_staff`]) ? other[`${op.key}_km_staff`] : []);
            const oLdMap = other[`${op.key}_leads_map`] || {};
            const oLd    = (Array.isArray(oLdMap[date]) ? oLdMap[date] : (other[`${op.key}_leads`] || [])).map(l=>l.name).filter(Boolean);
            const oFrM   = other[`${op.key}_freelancers_map`];
            const oFrRaw = oFrM ? (oFrM[date] || {}) : {};
            const oFr    = oFrRaw && typeof oFrRaw === 'object'
              ? Object.values(oFrRaw).flatMap(v=>(v||'').split(',').map(n=>n.trim())).filter(Boolean)
              : typeof oFrRaw === 'string' ? oFrRaw.split(',').map(n=>n.trim()).filter(Boolean) : [];
            const oSet   = new Set([...oKm, ...oLd, ...oFr]);
            for (const name of allNames) {
              if (!oSet.has(name)) continue;
              const key = `${name}|${date}|${other.id}`;
              if (!seen.has(key)) seen.set(key, { name, date, otherEvent: other.event_name });
            }
          }
        }
      }
    }
    return [...seen.values()];
  }, [form, schedules, initial?.id]);

  function applyEvent(ev) {
    if (!ev) { setForm(f => ({ ...f, event_id: null, event_name: '' })); return; }
    function evDates(multiKey, singleKey) {
      if (ev[multiKey]) { try { const p = JSON.parse(ev[multiKey]); if (Array.isArray(p) && p.length) return p; } catch {} }
      return ev[singleKey] ? [ev[singleKey]] : null;
    }
    const filmDates = evDates('filming_dates', 'filming_date');
    setForm(f => ({
      ...f,
      event_id: ev.id, event_name: ev.name,
      client: ev.client || f.client, location: ev.location || f.location,
      setup_date:    evDates('start_dates', 'start_date') || f.setup_date,
      teardown_date: evDates('end_dates',   'end_date')   || f.teardown_date,
      rehearsal_date:evDates('show_dates',  'show_date')  || f.rehearsal_date,
      filming_date:  filmDates                            || f.filming_date,
    }));
  }

  async function submit() {
    if (!form.event_id) { setError('Vui lòng chọn sự kiện trước khi tạo lịch'); return; }
    if (blockCreate) { setError('Sự kiện này đã có lịch làm việc. Vui lòng chuyển sang chỉnh sửa.'); return; }
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
          <div style={{ marginBottom: '10px' }}>
            <label style={labelStyle}>Sự kiện</label>
            <select className="input" value={form.event_id || ''}
              onChange={e => {
                const val = e.target.value;
                if (!val) { setForm(f => ({ ...f, event_id: null, event_name: '' })); return; }
                const ev = events.find(ev => ev.id === +val);
                if (ev) applyEvent(ev);
              }}>
              <option value="">-- Chọn sự kiện --</option>
              {form.event_id && !events.some(ev => ev.id === form.event_id) && (
                <option value={form.event_id}>{form.event_name}</option>
              )}
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </div>

          {existingForEvent && (
            <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${isDeptAssignedInExisting || !userDept ? 'rgba(248,113,113,0.4)' : 'rgba(251,191,36,0.4)'}`, background: isDeptAssignedInExisting || !userDept ? 'rgba(248,113,113,0.07)' : 'rgba(251,191,36,0.06)' }}>
              <p style={{ fontSize: '0.82rem', color: isDeptAssignedInExisting || !userDept ? '#f87171' : '#fbbf24', marginBottom: '8px', fontWeight: 600 }}>
                {isDeptAssignedInExisting && userDept
                  ? `⚠️ Sự kiện đã có lịch, bộ phận ${userDept} đã được phân công. Vui lòng chỉnh sửa thay vì tạo mới.`
                  : userDept
                    ? `ℹ️ Sự kiện đã có lịch làm việc, bộ phận ${userDept} chưa được phân công — chuyển sang chỉnh sửa để bổ sung.`
                    : '⚠️ Sự kiện này đã có lịch làm việc. Vui lòng chỉnh sửa thay vì tạo mới.'}
              </p>
              {onSwitchToEdit && (
                <button
                  type="button"
                  onClick={() => onSwitchToEdit(existingForEvent)}
                  style={{ padding: '6px 14px', borderRadius: '7px', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                  ✏️ Chuyển sang chỉnh sửa
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ marginTop: '12px' }}>
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

        {PHASES.map(phase => <PhaseBlock key={phase.key} phase={phase} form={form} setForm={setForm} userDept={userDept} isPhanLichAll={!!user?.is_phan_lich_all || ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role)} />)}

        {conflicts.length > 0 && (
          <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: '10px', padding: '12px 14px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.06em' }}>
              ⚠️ CẢNH BÁO TRÙNG LỊCH — chỉ để tham khảo, vẫn có thể lưu
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {conflicts.map((c, i) => (
                <p key={i} style={{ margin: 0, fontSize: '0.8rem', color: '#fde68a' }}>
                  • <strong>{c.name}</strong> đã có lịch ngày <strong>{fmtD(c.date)}</strong> trong "<em>{c.otherEvent}</em>"
                </p>
              ))}
            </div>
          </div>
        )}

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
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d); })();
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
          {[['🏗', s.setup_dates, false], ['📦', s.teardown_dates, false], ['🎤', s.rehearsal_dates, false], ['🎬', s.filming_dates, true]]
            .filter(([, d]) => d?.length > 0)
            .sort(([, a], [, b]) => ([...a].sort()[0] || '').localeCompare([...b].sort()[0] || ''))
            .map(([icon, dates, isFilming]) => (
              <span key={icon} style={isFilming ? { color:'#fb923c', fontWeight:700, fontSize:'0.78rem' } : undefined}>
                {icon} {dates.map((d, i) => (
                  <span key={d} style={
                    d === today    ? { color: '#f87171', fontWeight: 800 } :
                    d === tomorrow ? { color: '#4ade80', fontWeight: 800 } :
                    isFilming      ? { color: '#fb923c' } : undefined
                  }>
                    {i > 0 && ' · '}{fmtD(d)}
                  </span>
                ))}
              </span>
            ))
          }
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
          <p style={{ margin: '0 0 6px', fontSize: '0.65rem', fontWeight: 800, color: '#f87171', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
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
  const navigate = useNavigate();
  const location = useLocation();
  const canPhanLich = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role) || !!user?.is_phan_lich || !!user?.is_phan_lich_all;

  const [schedules, setSchedules] = useState([]);
  const [events, setEvents] = useState([]);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [scheduleHistory, setScheduleHistory] = useState([]);
  const [obligations, setObligations] = useState([]);

  const load = useCallback(() => {
    api.getWorkSchedules().then(setSchedules).catch(() => {});
    api.getLeadObligations().then(setObligations).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    api.getEvents().then(data => {
      setEvents(data.filter(e => e.status !== 'cancelled' && (!e.start_date || e.start_date >= today)));
    }).catch(() => {});
  }, [load]);

  // Tự mở modal chi tiết khi navigate từ Dashboard
  useEffect(() => {
    const targetId = location.state?.schedId;
    if (!targetId || !schedules.length) return;
    const s = schedules.find(x => x.id === targetId);
    if (!s) return;
    setSelected(s);
    setModal('detail');
    setScheduleHistory([]);
    api.getWorkScheduleHistory(s.id).then(setScheduleHistory).catch(() => {});
  }, [schedules, location.state?.schedId]);

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const tomorrowStr = (() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
  })();

  function nearestUpcoming(s) {
    const all = PHASES.flatMap(p => s[`${p.key}_dates`] || []).sort();
    return all.find(d => d >= todayStr) || null;
  }

  function isPastSchedule(s) {
    const allDates = PHASES.flatMap(p => {
      const arr = s[`${p.key}_dates`];
      if (Array.isArray(arr) && arr.length > 0) return arr;
      const single = s[`${p.key}_date`];
      return single ? [single] : [];
    });
    return allDates.length > 0 && allDates.every(d => d < todayStr);
  }

  function canEdit(s) {
    if (['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role)) return true;
    if (!!user?.is_phan_lich_all) return true;
    if (isPastSchedule(s)) return false;
    if (!!user?.is_truong_phong) return true;
    if (s.status === 'draft') return !!user?.is_phan_lich;
    return s.scheduler_user_id === user?.id;
  }

  function canDelete(s) {
    if (s.status !== 'draft') return user?.role === 'SUPER_ADMIN';
    if (['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role)) return true;
    if (!!user?.is_phan_lich_all) return true;
    if (!!user?.is_truong_phong) return !isPastSchedule(s);
    return !!user?.is_phan_lich || s.scheduler_user_id === user?.id;
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

      {/* ── Thông báo báo cáo chưa nộp hôm nay — dành cho admin/phân lịch ──── */}
      {(['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role) || !!user?.is_phan_lich || !!user?.is_phan_lich_all) && (() => {
        const phaseIcon  = { setup:'🏗', teardown:'📦', rehearsal:'🎤', filming:'🎬' };
        const phaseLabel = { setup:'Setup', teardown:'Tháo dỡ', rehearsal:'Rehearsal', filming:'Ghi hình' };
        const todayUnsubmitted = obligations.filter(o => o.assigned_date === todayStr && !o.submitted);
        if (!todayUnsubmitted.length) return null;
        return (
          <div style={{ marginBottom: '20px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
              <span style={{ fontSize:'1rem' }}>🔔</span>
              <span style={{ fontSize:'0.82rem', fontWeight:800, color:'#f87171', letterSpacing:'0.05em' }}>BÁO CÁO CHƯA NỘP HÔM NAY</span>
              <span style={{ background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.4)', borderRadius:'9999px', padding:'1px 8px', fontSize:'0.7rem', fontWeight:700, color:'#f87171' }}>
                {todayUnsubmitted.length} người
              </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {todayUnsubmitted.map(ob => (
                <div key={ob.id} style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap', background:'rgba(248,113,113,0.05)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:'8px', padding:'8px 12px' }}>
                  <span style={{ fontSize:'0.85rem' }}>{phaseIcon[ob.phase]}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'0.88rem', fontWeight:700, color:'#eeeef5', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {ob.lead_name}
                    </div>
                    <div style={{ fontSize:'0.75rem', color:'#a0a0b8' }}>
                      {ob.event_display || ob.event_name} · {phaseLabel[ob.phase]}
                      {ob.overdue && <span style={{ color:'#f87171', marginLeft:'6px', fontWeight:700 }}>⚠ Quá hạn</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Báo cáo cần nộp — chỉ nhân viên thường (không phải admin/TP/phân lịch) */}
      {obligations.length > 0
        && !['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role)
        && !user?.is_phan_lich_all
        && !user?.is_truong_phong
        && !user?.is_phan_lich
        && (() => {
        const pastObs  = obligations.filter(o => o.assigned_date < todayStr);
        const pending  = pastObs.filter(o => !o.submitted && !o.overdue);
        const overdue  = pastObs.filter(o => o.overdue);
        const done     = pastObs.filter(o => o.submitted);
        if (!pending.length && !overdue.length && !done.length) return null;
        const phaseIcon = { setup:'🏗', teardown:'📦', rehearsal:'🎤', filming:'🎬' };
        const phaseLabel = { setup:'Setup', teardown:'Tháo dỡ', rehearsal:'Rehearsal', filming:'Ghi hình' };
        return (
          <div style={{ marginBottom: '20px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
              <span style={{ fontSize:'1rem' }}>📋</span>
              <span style={{ fontSize:'0.82rem', fontWeight:800, color: GOLD, letterSpacing:'0.05em' }}>BÁO CÁO CẦN NỘP</span>
              {overdue.length > 0 && (
                <span style={{ background:'rgba(248,113,113,0.2)', border:'1px solid rgba(248,113,113,0.4)', borderRadius:'9999px', padding:'1px 8px', fontSize:'0.7rem', fontWeight:700, color:'#f87171' }}>
                  {overdue.length} quá hạn
                </span>
              )}
              {pending.length > 0 && (
                <span style={{ background:'rgba(251,191,36,0.15)', border:'1px solid rgba(251,191,36,0.35)', borderRadius:'9999px', padding:'1px 8px', fontSize:'0.7rem', fontWeight:700, color:'#fbbf24' }}>
                  {pending.length} chờ nộp
                </span>
              )}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {[...overdue, ...pending, ...done].map(ob => {
                const isOver = ob.overdue;
                const isDone = ob.submitted;
                return (
                  <div key={ob.id} style={{
                    display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap',
                    background: isOver ? 'rgba(248,113,113,0.06)' : isDone ? 'rgba(74,222,128,0.04)' : 'rgba(251,191,36,0.04)',
                    border: `1px solid ${isOver ? 'rgba(248,113,113,0.25)' : isDone ? 'rgba(74,222,128,0.2)' : 'rgba(251,191,36,0.15)'}`,
                    borderRadius:'8px', padding:'8px 12px',
                  }}>
                    <span style={{ fontSize:'0.85rem' }}>{phaseIcon[ob.phase]}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'0.88rem', fontWeight:700, color:'#eeeef5', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {ob.event_display || ob.event_name || 'Sự kiện'}
                      </div>
                      <div style={{ fontSize:'0.75rem', color:'#a0a0b8' }}>
                        {phaseLabel[ob.phase]} · {fmtD(ob.assigned_date)}
                        {isOver && <span style={{ color:'#f87171', marginLeft:'6px', fontWeight:700 }}>⚠ Quá hạn</span>}
                        {!isDone && !isOver && <span style={{ color:'#fbbf24', marginLeft:'6px' }}>Hạn: trưa {fmtD(ob.deadline.slice(0,10))}</span>}
                      </div>
                    </div>
                    {isDone
                      ? <span style={{ fontSize:'0.75rem', color:'#4ade80', fontWeight:700 }}>✓ Đã nộp</span>
                      : (
                        <button
                          onClick={() => navigate('/event-report', { state: { prefill: { event_id: ob.event_id, event_label: ob.event_display || ob.event_name, report_date: ob.assigned_date } } })}
                          style={{ background: isOver ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.15)', border:`1px solid ${isOver ? 'rgba(248,113,113,0.5)' : 'rgba(251,191,36,0.4)'}`, borderRadius:'6px', padding:'4px 12px', fontSize:'0.75rem', fontWeight:700, color: isOver ? '#f87171' : '#fbbf24', cursor:'pointer', whiteSpace:'nowrap' }}
                        >
                          Nộp báo cáo →
                        </button>
                      )
                    }
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <MySchedulesSection
        schedules={schedules}
        user={user}
        onSelect={(s) => { setSelected(s); setModal('detail'); setScheduleHistory([]); api.getWorkScheduleHistory(s.id).then(setScheduleHistory).catch(() => {}); }}
      />

      {(() => {
        const phaseIcons = { filming: '🎬', setup: '🏗', rehearsal: '🎤', teardown: '📦' };
        function renderDates(key, datesArr) {
          if (!datesArr?.length) return null;
          const isFilming = key === 'filming';
          return (
            <span key={key} style={isFilming ? { color:'#fb923c', fontWeight:700, fontSize:'0.82rem' } : undefined}>
              {phaseIcons[key]} {datesArr.map((d, i) => (
                <span key={d} style={
                  d === todayStr    ? { color: '#f87171', fontWeight: 800 } :
                  d === tomorrowStr ? { color: '#4ade80', fontWeight: 800 } :
                  isFilming         ? { color: '#fb923c' } : undefined
                }>{i > 0 && ' · '}{fmtD(d)}</span>
              ))}
            </span>
          );
        }
        function renderCard(s, zone) {
          const isToday    = zone === 'today';
          const isTomorrow = zone === 'tomorrow';
          const isPast     = zone === 'past';
          return (
            <div key={s.id} style={{
              background: isToday ? 'rgba(248,113,113,0.04)' : isTomorrow ? 'rgba(74,222,128,0.03)' : 'var(--bg-card)',
              border: isToday ? '1px solid rgba(248,113,113,0.45)' : isTomorrow ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px', padding: '16px',
              boxShadow: isToday ? '0 0 18px rgba(248,113,113,0.1)' : isTomorrow ? '0 0 14px rgba(74,222,128,0.07)' : 'none',
              opacity: isPast ? 0.5 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontWeight: 700, color: GOLD, fontSize: '1rem' }}>{s.event_name}</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#7878a0' }}>
                    👤 {s.scheduler_name} {s.client ? `· 🏢 ${s.client}` : ''} {s.location ? `· 📍 ${s.location}` : ''}
                  </p>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0,
                  background: s.status === 'confirmed' ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)',
                  color: s.status === 'confirmed' ? '#4ade80' : '#fbbf24',
                  border: `1px solid ${s.status === 'confirmed' ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)'}`,
                }}>
                  {s.status === 'confirmed' ? '✓ Đã xác nhận' : '📝 Nháp'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '10px', fontSize: '0.75rem', color: '#a0a0b8' }}>
                {[['filming', s.filming_dates], ['setup', s.setup_dates], ['rehearsal', s.rehearsal_dates], ['teardown', s.teardown_dates]]
                  .filter(([, d]) => d?.length)
                  .sort(([, a], [, b]) => ([...a].sort()[0] || '').localeCompare([...b].sort()[0] || ''))
                  .map(([key, dates]) => renderDates(key, dates))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button className="btn-secondary btn-sm" onClick={() => { setSelected(s); setModal('detail'); setScheduleHistory([]); api.getWorkScheduleHistory(s.id).then(setScheduleHistory).catch(() => {}); }}>Chi tiết</button>
                {canEdit(s) && <button className="btn-secondary btn-sm" onClick={() => { setSelected(s); setModal('form'); }}>✏️ Sửa</button>}
                {s.status === 'draft' && canPhanLich && <button className="btn-primary btn-sm" onClick={() => handleConfirm(s)}>✓ Xác nhận lên lịch</button>}
                {canDelete(s) && <button className="btn-danger btn-sm" onClick={() => handleDelete(s)}>🗑</button>}
              </div>
            </div>
          );
        }
        function ZoneHeader({ color, bg, border, label, count }) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '6px 0 4px' }}>
              <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${border}, transparent)` }} />
              <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', color, background: bg, border: `1px solid ${border}`, borderRadius: '999px', padding: '3px 12px', whiteSpace: 'nowrap', maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {label} <span style={{ opacity: 0.7, fontWeight: 600 }}>({count})</span>
              </span>
              <div style={{ flex: 1, height: '1px', background: `linear-gradient(270deg, ${border}, transparent)` }} />
            </div>
          );
        }

        const sorted = [...schedules].sort((a, b) => {
          const na = nearestUpcoming(a), nb = nearestUpcoming(b);
          if (!na && !nb) return 0;
          if (!na) return 1;
          if (!nb) return -1;
          return na.localeCompare(nb);
        });

        const zones = {
          today:    sorted.filter(s => PHASES.some(p => (s[`${p.key}_dates`] || []).includes(todayStr))),
          tomorrow: sorted.filter(s => !PHASES.some(p => (s[`${p.key}_dates`] || []).includes(todayStr)) && PHASES.some(p => (s[`${p.key}_dates`] || []).includes(tomorrowStr))),
          upcoming: sorted.filter(s => { const n = nearestUpcoming(s); return n && n > tomorrowStr; }),
          past:     sorted.filter(s => nearestUpcoming(s) === null),
        };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {schedules.length === 0 && <p style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Chưa có lịch làm việc nào</p>}

            {zones.today.length > 0 && <>
              <ZoneHeader color="#f87171" bg="rgba(248,113,113,0.1)" border="rgba(248,113,113,0.4)" label={`HÔM NAY — ${fmtD(todayStr)}`} count={zones.today.length} />
              {zones.today.map(s => renderCard(s, 'today'))}
            </>}

            {zones.tomorrow.length > 0 && <>
              <ZoneHeader color="#4ade80" bg="rgba(74,222,128,0.1)" border="rgba(74,222,128,0.35)" label={`NGÀY MAI — ${fmtD(tomorrowStr)}`} count={zones.tomorrow.length} />
              {zones.tomorrow.map(s => renderCard(s, 'tomorrow'))}
            </>}

            {zones.upcoming.length > 0 && <>
              <ZoneHeader color="#fbbf24" bg="rgba(251,191,36,0.08)" border="rgba(251,191,36,0.3)" label="NGÀY SẮP TỚI" count={zones.upcoming.length} />
              {zones.upcoming.map(s => renderCard(s, 'upcoming'))}
            </>}

            {zones.past.length > 0 && <>
              <ZoneHeader color="#7878a0" bg="rgba(120,120,160,0.08)" border="rgba(120,120,160,0.2)" label="NGÀY LÀM VIỆC ĐÃ HOÀN THÀNH" count={zones.past.length} />
              {zones.past.map(s => renderCard(s, 'past'))}
            </>}
          </div>
        );
      })()}

      {modal === 'form' && (
        <ScheduleForm
          key={selected?.id ?? 'new'}
          initial={selected}
          events={events}
          schedules={schedules}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
          onSwitchToEdit={s => setSelected(s)}
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
              const sortedPhases = [...PHASES].sort((a, b) => {
                const aMin = [...(selected[`${a.key}_dates`] || [])].sort()[0] || '9999';
                const bMin = [...(selected[`${b.key}_dates`] || [])].sort()[0] || '9999';
                return aMin.localeCompare(bMin);
              });
              return sortedPhases.map(phase => {
                const flatLeads = (selected[`${phase.key}_leads`] || [])
                  .filter(l => !viewerDept || l.department === viewerDept);
                const staff = (selected[`${phase.key}_km_staff`] || [])
                  .filter(n => !viewerDept || KM_STAFF_GROUPS.find(g => g.dept === viewerDept && g.members.includes(n)));
                const dates = (selected[`${phase.key}_dates`] || (selected[`${phase.key}_date`] ? [selected[`${phase.key}_date`]] : [])).slice().sort((a, b) => {
                  const af = a >= todayStr, bf = b >= todayStr;
                  if (af && !bf) return -1;
                  if (!af && bf) return 1;
                  return a.localeCompare(b);
                });
                const freeMapD   = selected[`${phase.key}_freelancers_map`];
                const isNewFree  = freeMapD && Object.values(freeMapD).some(v => v && typeof v === 'object');
                // Old format fallback
                const freeStr    = selected[`${phase.key}_freelancers`] || '';
                const freeNames  = freeStr.split(',').map(s => s.trim()).filter(Boolean);
                const filteredFree = (!isNewFree && viewerDept)
                  ? freeNames.filter(n => FREELANCER_GROUPS.find(g => g.dept === viewerDept && g.members.includes(n)))
                  : isNewFree ? [] : freeNames;
                // New format: check if any dept has data (filtered by viewerDept)
                const hasNewFree = isNewFree && Object.values(freeMapD || {}).some(dateVal => {
                  if (!dateVal || typeof dateVal !== 'object') return false;
                  return viewerDept ? !!dateVal[viewerDept]?.trim() : Object.values(dateVal).some(v => v?.trim());
                });
                const notesMapD     = selected[`${phase.key}_notes`]       || {};
                const startTimesMapD = selected[`${phase.key}_start_times`] || {};
                const isNewNotes = Object.values(notesMapD).some(v => v && typeof v === 'object');
                const hasNotes   = Object.values(notesMapD).some(v => {
                  if (typeof v === 'string') return v.trim();
                  if (v && typeof v === 'object') return viewerDept ? !!v[viewerDept]?.trim() : Object.values(v).some(n => n?.trim());
                  return false;
                });
                const hasStartTimes = Object.values(startTimesMapD).some(v =>
                  v && typeof v === 'object' ? Object.values(v).some(t => t?.trim()) : false
                );
                if (!flatLeads.length && !staff.length && !filteredFree.length && !hasNewFree && !hasNotes && !hasStartTimes) return null;
                const freelancerGroups = groupFreelancersByDept(filteredFree.join(', '));
                const leadsMapD  = selected[`${phase.key}_leads_map`];
                const kmMapD     = selected[`${phase.key}_km_staff_map`];
                const perDate    = dates.length > 1;
                const itemStyle      = { fontSize: '0.92rem', color: '#a0a0b8', padding: '2px 0 2px 10px' };
                const kmItemStyle   = { ...itemStyle, color: '#60a5fa' };
                const freeItemStyle = { ...itemStyle, color: '#f87171' };
                function renderDateHdr(d) {
                  const isT = d === todayStr, isM = d === tomorrowStr;
                  const color  = isT ? '#f87171' : isM ? '#4ade80' : '#fbbf24';
                  const border = isT ? 'rgba(248,113,113,0.4)' : isM ? 'rgba(74,222,128,0.35)' : 'rgba(251,191,36,0.28)';
                  const bg     = isT ? 'rgba(248,113,113,0.1)' : isM ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.07)';
                  const extra  = isT ? ' · HÔM NAY' : isM ? ' · NGÀY MAI' : '';
                  return (
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', margin:'10px 0 5px' }}>
                      <div style={{ flex:1, height:'1px', background:`linear-gradient(90deg,${border},transparent)` }} />
                      <span style={{ fontSize:'0.78rem', fontWeight:800, letterSpacing:'0.05em', color, background:bg, border:`1px solid ${border}`, borderRadius:'999px', padding:'4px 14px', whiteSpace:'nowrap' }}>
                        📅 {fmtD(d)}{extra}
                      </span>
                      <div style={{ flex:1, height:'1px', background:`linear-gradient(270deg,${border},transparent)` }} />
                    </div>
                  );
                }

                return (
                  <div key={phase.key} style={sectionStyle}>
                    {/* Phase header */}
                    <div style={{ marginBottom:'8px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                        <p style={{ fontWeight:700, color:GOLD, margin:0, flexShrink:0 }}>{phase.label}</p>
                        {dates.length > 0 && (
                          <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'2px 0' }}>
                            {dates.map((d, i) => (
                              <span key={d} style={{ display:'inline-block', whiteSpace:'nowrap', fontWeight:700, color: d === todayStr ? '#f87171' : d === tomorrowStr ? '#4ade80' : GOLD }}>
                                {i > 0 && <span style={{ color:'#7878a0', margin:'0 4px' }}>·</span>}{fmtD(d)}
                              </span>
                            ))}
                          </div>
                        )}
                        {dates.some(d => d === todayStr) && <span style={{ flexShrink:0, fontSize:'0.75rem', fontWeight:800, background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.45)', borderRadius:'999px', padding:'2px 10px', color:'#f87171', letterSpacing:'0.06em' }}>📅 {fmtD(todayStr)} · HÔM NAY</span>}
                        {!dates.some(d => d === todayStr) && dates.some(d => d === tomorrowStr) && <span style={{ flexShrink:0, fontSize:'0.75rem', fontWeight:800, background:'rgba(74,222,128,0.15)', border:'1px solid rgba(74,222,128,0.4)', borderRadius:'999px', padding:'2px 10px', color:'#4ade80', letterSpacing:'0.06em' }}>📅 {fmtD(tomorrowStr)} · NGÀY MAI</span>}
                      </div>
                    </div>

                    {perDate ? dates.map(date => {
                      /* Nhóm trưởng theo ngày */
                      const dLeads = (leadsMapD ? (leadsMapD[date] || []) : flatLeads)
                        .filter(l => !viewerDept || l.department === viewerDept);
                      /* KM staff theo ngày */
                      const dayStaff = (kmMapD ? (kmMapD[date] || []) : staff)
                        .filter(n => !viewerDept || KM_STAFF_GROUPS.find(g => g.dept === viewerDept && g.members.includes(n)));
                      const byDeptKM = dayStaff.reduce((acc, n) => {
                        const d = KM_STAFF_GROUPS.find(g => g.members.includes(n))?.dept || 'Khác';
                        (acc[d] = acc[d] || []).push(n); return acc;
                      }, {});
                      /* Freelancer theo ngày */
                      let freeDepts = [];
                      if (isNewFree && freeMapD) {
                        const dateVal = freeMapD[date] || {};
                        freeDepts = Object.entries(dateVal)
                          .filter(([d, v]) => v?.trim() && (!viewerDept || d === viewerDept))
                          .map(([dept, names]) => [dept, names.split(',').map(n => n.trim()).filter(Boolean)])
                          .filter(([, ns]) => ns.length > 0);
                      }
                      /* Ghi chú theo ngày */
                      const noteVal = notesMapD[date];
                      const noteDepts = (noteVal && typeof noteVal === 'object')
                        ? Object.entries(noteVal).filter(([d, v]) => v?.trim() && (!viewerDept || d === viewerDept))
                        : [];
                      const noteStr = (noteVal && typeof noteVal === 'string') ? noteVal.trim() : '';
                      const hasNote = noteDepts.length > 0 || noteStr;
                      /* Giờ bắt đầu theo ngày */
                      const dayTimes = startTimesMapD[date] || {};
                      const timeDepts = Object.entries(dayTimes)
                        .filter(([d, t]) => t?.trim() && (!viewerDept || d === viewerDept));
                      if (!dLeads.length && !dayStaff.length && !freeDepts.length && !hasNote && !timeDepts.length) return null;
                      return (
                        <div key={date}>
                          {renderDateHdr(date)}
                          {timeDepts.length > 0 && (
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'6px', marginBottom:'8px' }} className="time-badge-wrap">
                              {timeDepts.map(([dept, time]) => {
                                const dc = getDeptColor(dept);
                                return (
                                  <div key={dept} style={{ background: dc.bg, border:`1px solid ${dc.border}`, borderRadius:'8px', padding:'9px 14px', textAlign:'center' }}>
                                    <div style={{ fontSize:'0.72rem', color: dc.color, fontWeight:700, letterSpacing:'0.03em' }}>⏰ {getDeptDisplay(dept)}</div>
                                    <div style={{ fontSize:'0.95rem', color:'#fbbf24', fontWeight:800 }}>{time}</div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {dLeads.map((l, i) => {
                            const dc = getDeptColor(l.department);
                            return (
                              <div key={i} style={{ ...itemStyle, color: '#e8c97a' }}>👑 {l.name} <span style={{ color: dc.color, fontWeight:700, fontSize:'0.82rem' }}>({getDeptDisplay(l.department)})</span></div>
                            );
                          })}
                          {dayStaff.length > 0 && (
                            <div style={{ marginTop: '4px' }}>
                              <p style={{ fontSize: '0.82rem', fontWeight: 800, color: '#60a5fa', margin: '4px 0 2px', letterSpacing:'0.06em' }}>NHÂN SỰ KHÔI MINH</p>
                              {Object.entries(byDeptKM).map(([dept, members]) => {
                                const dc = getDeptColor(dept);
                                return (
                                  <div key={dept} style={{ marginBottom: '3px', paddingLeft:'8px', borderLeft:`2px solid ${dc.border}` }}>
                                    <span style={{ color: dc.color, fontWeight:700, fontSize:'0.85rem', display:'block' }}>{getDeptDisplay(dept)}</span>
                                    {members.map(n => <div key={n} style={{ ...kmItemStyle, color: '#c0c8e0' }}>• {n}</div>)}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {freeDepts.length > 0 && (
                            <div style={{ marginTop: '4px' }}>
                              <p style={{ fontSize: '0.82rem', fontWeight: 800, color: '#93c5fd', margin: '4px 0 2px', letterSpacing:'0.06em' }}>FREELANCER</p>
                              {freeDepts.map(([dept, nameList]) => {
                                const dc = getDeptColor(dept);
                                return (
                                  <div key={dept} style={{ marginBottom: '3px', paddingLeft:'8px', borderLeft:`2px solid ${dc.border}` }}>
                                    <span style={{ color: dc.color, fontWeight:700, fontSize:'0.85rem', display:'block' }}>{getDeptDisplay(dept)}</span>
                                    {nameList.map(n => <div key={n} style={{ ...freeItemStyle, color: '#c0c8e0' }}>• {n}</div>)}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {hasNote && (
                            <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                              <p style={{ fontSize: '0.82rem', fontWeight: 800, color: '#c9b98a', margin: '0 0 2px', letterSpacing:'0.06em' }}>GHI CHÚ</p>
                              {noteDepts.map(([dept, note]) => {
                                const dc = getDeptColor(dept);
                                return (
                                  <div key={dept} style={{ marginBottom:'3px', paddingLeft:'8px', borderLeft:`2px solid ${dc.border}` }}>
                                    <span style={{ color: dc.color, fontWeight:700, fontSize:'0.85rem', display:'block' }}>{getDeptDisplay(dept)}</span>
                                    <p style={{ ...itemStyle, fontStyle:'italic', color:'#c9b98a', paddingLeft:'8px' }}>{note}</p>
                                  </div>
                                );
                              })}
                              {noteStr && <p style={{ ...itemStyle, fontStyle:'italic', color:'#c9b98a' }}>{noteStr}</p>}
                            </div>
                          )}
                        </div>
                      );
                    }) : (
                      /* Một ngày: hiển thị flat không có date header */
                      <>
                        {(() => {
                          const singleTimeDepts = dates.flatMap(date =>
                            Object.entries(startTimesMapD[date] || {})
                              .filter(([d, t]) => t?.trim() && (!viewerDept || d === viewerDept))
                          );
                          return singleTimeDepts.length > 0 && (
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'6px', marginBottom:'8px' }} className="time-badge-wrap">
                              {singleTimeDepts.map(([dept, time]) => {
                                const dc = getDeptColor(dept);
                                return (
                                  <div key={dept} style={{ background: dc.bg, border:`1px solid ${dc.border}`, borderRadius:'8px', padding:'9px 14px', textAlign:'center' }}>
                                    <div style={{ fontSize:'0.72rem', color: dc.color, fontWeight:700, letterSpacing:'0.03em' }}>⏰ {getDeptDisplay(dept)}</div>
                                    <div style={{ fontSize:'0.95rem', color:'#fbbf24', fontWeight:800 }}>{time}</div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                        {flatLeads.length > 0 && flatLeads.map((l, i) => {
                          const dc = getDeptColor(l.department);
                          return (
                            <div key={i} style={{ ...itemStyle, color: '#e8c97a' }}>👑 {l.name} <span style={{ color: dc.color, fontWeight:700, fontSize:'0.82rem' }}>({l.department})</span></div>
                          );
                        })}
                        {staff.length > 0 && (
                          <div style={{ marginBottom: '8px', marginTop: flatLeads.length ? '4px' : 0 }}>
                            <p style={{ fontSize: '0.82rem', fontWeight: 800, color: '#60a5fa', margin: '0 0 4px', letterSpacing:'0.06em' }}>NHÂN SỰ KHÔI MINH</p>
                            {Object.entries(staff.reduce((acc, n) => {
                              const d = KM_STAFF_GROUPS.find(g => g.members.includes(n))?.dept || 'Khác';
                              (acc[d] = acc[d] || []).push(n); return acc;
                            }, {})).map(([dept, members]) => {
                              const dc = getDeptColor(dept);
                              return (
                                <div key={dept} style={{ marginBottom: '3px', paddingLeft:'8px', borderLeft:`2px solid ${dc.border}` }}>
                                  <span style={{ color: dc.color, fontWeight:700, fontSize:'0.85rem', display:'block' }}>{getDeptDisplay(dept)}</span>
                                  {members.map(n => <div key={n} style={{ ...kmItemStyle, color: '#c0c8e0' }}>• {n}</div>)}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {(hasNewFree || filteredFree.length > 0) && (
                          <div style={{ marginBottom: '8px' }}>
                            <p style={{ fontSize: '0.82rem', fontWeight: 800, color: '#93c5fd', margin: '0 0 4px', letterSpacing:'0.06em' }}>FREELANCER</p>
                            {isNewFree ? dates.map(date => {
                              const dateVal = freeMapD[date] || {};
                              return Object.entries(dateVal)
                                .filter(([d, v]) => v?.trim() && (!viewerDept || d === viewerDept))
                                .map(([dept, names]) => {
                                  const nameList = names.split(',').map(n => n.trim()).filter(Boolean);
                                  const dc = getDeptColor(dept);
                                  return nameList.length ? (
                                    <div key={dept} style={{ marginBottom: '3px', paddingLeft:'8px', borderLeft:`2px solid ${dc.border}` }}>
                                      <span style={{ color: dc.color, fontWeight:700, fontSize:'0.85rem', display:'block' }}>{getDeptDisplay(dept)}</span>
                                      {nameList.map(n => <div key={n} style={{ ...freeItemStyle, color: '#c0c8e0' }}>• {n}</div>)}
                                    </div>
                                  ) : null;
                                });
                            }) : freelancerGroups.map(([dept, members]) => {
                              const dc = getDeptColor(dept);
                              return (
                                <div key={dept} style={{ marginBottom: '3px', paddingLeft:'8px', borderLeft:`2px solid ${dc.border}` }}>
                                  <span style={{ color: dc.color, fontWeight:700, fontSize:'0.85rem', display:'block' }}>{getDeptDisplay(dept)}</span>
                                  {members.map(n => <div key={n} style={{ ...freeItemStyle, color: '#c0c8e0' }}>• {n}</div>)}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {hasNotes && (
                          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <p style={{ fontSize: '0.82rem', fontWeight: 800, color: '#c9b98a', margin: '0 0 4px', letterSpacing:'0.06em' }}>GHI CHÚ</p>
                            {dates.map(date => {
                              const val = notesMapD[date];
                              if (!val) return null;
                              if (typeof val === 'object') {
                                const depts = Object.entries(val).filter(([d, v]) => v?.trim() && (!viewerDept || d === viewerDept));
                                return depts.map(([dept, note]) => {
                                  const dc = getDeptColor(dept);
                                  return (
                                    <div key={dept} style={{ marginBottom:'3px', paddingLeft:'8px', borderLeft:`2px solid ${dc.border}` }}>
                                      <span style={{ color: dc.color, fontWeight:700, fontSize:'0.85rem', display:'block' }}>{getDeptDisplay(dept)}</span>
                                      <p style={{ ...itemStyle, fontStyle:'italic', color:'#c9b98a', paddingLeft:'8px' }}>{note}</p>
                                    </div>
                                  );
                                });
                              }
                              return val?.trim() ? <p key={date} style={{ ...itemStyle, fontStyle:'italic', color:'#c9b98a' }}>{val}</p> : null;
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              });
            })()}
            {scheduleHistory.length > 0 && (
              <div style={{ marginTop: '4px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 800, color: '#7878a0', letterSpacing: '0.08em', margin: '0 0 6px', textTransform: 'uppercase' }}>📋 Lịch sử chỉnh sửa</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {scheduleHistory.map((h, i) => {
                    const actionLabel = h.action === 'confirm' ? '✅ Xác nhận lịch' : '✏️ Chỉnh sửa';
                    const actionColor = h.action === 'confirm' ? '#4ade80' : '#a78bfa';
                    const dt = new Date(h.edited_at);
                    const dtStr = `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                        <span style={{ color: actionColor, fontWeight: 700, flexShrink: 0 }}>{actionLabel}</span>
                        <span style={{ color: '#c0c0d8' }}>{h.edited_by_name}</span>
                        <span style={{ color: '#555570', marginLeft: 'auto', flexShrink: 0, fontFamily: 'monospace', fontSize: '0.7rem' }}>{dtStr}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
