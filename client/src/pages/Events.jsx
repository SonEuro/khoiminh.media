import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import Modal from '../components/Modal';
import EventDetailModal from '../components/EventDetailModal';
import MultiDatePicker from '../components/MultiDatePicker';
import { useAuth } from '../contexts/AuthContext';
import { useStaffGroups } from '../contexts/StaffGroupsContext';

import { fmtD } from '../utils/fmt';

const GOLD = '#c9a84c';
const PHASES = [
  { key: 'setup',     label: '🏗 Setup' },
  { key: 'teardown',  label: '📦 Tháo dỡ' },
  { key: 'rehearsal', label: '🎤 Rehearsal' },
  { key: 'filming',   label: '🎬 Ghi hình' },
];

const DEPT_COLORS = {
  'ATAS-LED': { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.22)' },
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
const ALL_EVENT_DEPTS = ['ATAS-LED', 'Sân Khấu', 'Kỹ Thuật', 'Cơ Sở Vật Chất'];

function groupByDept(names, groups) {
  const map = {};
  for (const name of (names || [])) {
    const dept = groups.find(g => g.members.includes(name))?.dept || 'Khác';
    (map[dept] = map[dept] || []).push(name);
  }
  return Object.entries(map);
}

function aggregateFreelancerMap(freeMap) {
  const map = {};
  for (const dateVal of Object.values(freeMap || {})) {
    if (typeof dateVal !== 'object') continue;
    for (const [dept, namesStr] of Object.entries(dateVal)) {
      const names = (namesStr || '').split(',').map(n => n.trim()).filter(Boolean);
      for (const n of names) {
        if (!(map[dept] = map[dept] || new Set()).has(n)) map[dept].add(n);
      }
    }
  }
  return Object.entries(map).map(([dept, set]) => [dept, [...set]]);
}

const itemStyle = { fontSize: '0.92rem', color: '#a0a0b8', padding: '2px 0 2px 10px' };

function StaffScheduleModal({ event, onClose }) {
  const { kmGroups } = useStaffGroups();
  const [schedules, setSchedules] = useState(null);
  useEffect(() => { api.getWorkSchedules({ event_id: event.id }).then(setSchedules).catch(() => setSchedules([])); }, [event.id]);

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d); })();

  function ZoneHdr({ color, bg, border, label, count }) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'10px', margin:'10px 0 4px' }}>
        <div style={{ flex:1, height:'1px', background:`linear-gradient(90deg,${border},transparent)` }} />
        <span style={{ fontSize:'0.78rem', fontWeight:800, letterSpacing:'0.08em', color, background:bg, border:`1px solid ${border}`, borderRadius:'999px', padding:'3px 12px', whiteSpace:'nowrap' }}>
          {label} <span style={{ opacity:0.7, fontWeight:600 }}>({count})</span>
        </span>
        <div style={{ flex:1, height:'1px', background:`linear-gradient(270deg,${border},transparent)` }} />
      </div>
    );
  }

  function renderEntry({ phase, date, dLeads, byDeptKM, freeDepts, noteDepts, noteStr, hasNote, daySupport = {} }) {
    const isPast = date < todayStr;
    const dateColor = date === todayStr ? '#f87171' : date === tomorrowStr ? '#4ade80' : isPast ? '#7878a0' : '#60a5fa';
    return (
      <div key={`${phase.key}-${date}`} style={{ marginBottom:'6px', padding:'10px 12px', background: isPast ? 'rgba(120,120,160,0.04)' : 'rgba(201,168,76,0.04)', border:`1px solid ${isPast ? 'rgba(120,120,160,0.15)' : 'rgba(201,168,76,0.12)'}`, borderRadius:'8px', opacity: isPast ? 0.65 : 1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'6px', flexWrap:'wrap' }}>
          <span style={{ fontWeight:700, color:GOLD, fontSize:'0.82rem' }}>{phase.label}</span>
          <span style={{ fontSize:'0.82rem', color: dateColor, fontWeight:700 }}>{fmtD(date)}</span>
        </div>
        {dLeads.map((l, i) => {
          const dc = getDeptColor(l.department);
          return <div key={i} style={{ ...itemStyle, color:'#e8c97a' }}>👑 {l.name} <span style={{ color:dc.color, fontWeight:700, fontSize:'0.82rem' }}>({l.department})</span></div>;
        })}
        {Object.keys(byDeptKM).length > 0 && (
          <div style={{ marginTop:'4px' }}>
            <p style={{ fontSize:'0.82rem', fontWeight:800, color:'#60a5fa', margin:'4px 0 2px', letterSpacing:'0.06em' }}>NHÂN SỰ KHÔI MINH</p>
            {Object.entries(byDeptKM).map(([dept, members]) => {
              const dc = getDeptColor(dept);
              return (
                <div key={dept} style={{ marginBottom:'3px', paddingLeft:'8px', borderLeft:`2px solid ${dc.border}` }}>
                  <span style={{ color:dc.color, fontWeight:700, fontSize:'0.85rem', display:'block' }}>{dept}</span>
                  {members.map(n => (
                    <div key={n} style={{ ...itemStyle, color:'#eeeef5', display:'flex', alignItems:'center', gap:'5px' }}>
                      <span>• {n}</span>
                      {daySupport[n] && <span style={{ fontSize:'0.72rem', background:'rgba(96,165,250,0.15)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.35)', borderRadius:'4px', padding:'1px 4px', flexShrink:0 }}>
                        {kmGroups.find(g => g.members.includes(n))?.dept || ''} - HT
                      </span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        {freeDepts.length > 0 && (
          <div style={{ marginTop:'4px' }}>
            <p style={{ fontSize:'0.82rem', fontWeight:800, color:'#93c5fd', margin:'4px 0 2px', letterSpacing:'0.06em' }}>FREELANCER</p>
            {freeDepts.map(([dept, nameList]) => {
              const dc = getDeptColor(dept);
              return (
                <div key={dept} style={{ marginBottom:'3px', paddingLeft:'8px', borderLeft:`2px solid ${dc.border}` }}>
                  <span style={{ color:dc.color, fontWeight:700, fontSize:'0.85rem', display:'block' }}>{dept}</span>
                  {nameList.map(n => <div key={n} style={{ ...itemStyle, color:'#c0c8e0' }}>• {n}</div>)}
                </div>
              );
            })}
          </div>
        )}
        {hasNote && (
          <div style={{ marginTop:'4px', paddingTop:'4px', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
            <p style={{ fontSize:'0.82rem', fontWeight:800, color:'#c9b98a', margin:'0 0 2px', letterSpacing:'0.06em' }}>GHI CHÚ</p>
            {noteDepts.map(([dept, note]) => {
              const dc = getDeptColor(dept);
              return (
                <div key={dept} style={{ marginBottom:'3px', paddingLeft:'8px', borderLeft:`2px solid ${dc.border}` }}>
                  <span style={{ color:dc.color, fontWeight:700, fontSize:'0.85rem', display:'block' }}>{dept}</span>
                  <p style={{ ...itemStyle, fontStyle:'italic', color:'#c9b98a', paddingLeft:'8px' }}>{note}</p>
                </div>
              );
            })}
            {noteStr && <p style={{ ...itemStyle, fontStyle:'italic', color:'#c9b98a' }}>{noteStr}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <Modal title={`Nhân sự làm việc — ${event.name}`} onClose={onClose} size="lg">
      {schedules === null && <p style={{ textAlign:'center', color:'#7878a0', padding:'20px' }}>Đang tải...</p>}
      {schedules?.length === 0 && <p style={{ textAlign:'center', color:'#7878a0', padding:'20px' }}>Chưa có lịch làm việc cho sự kiện này</p>}
      {schedules?.map(s => {
        const allEntries = [];
        for (const phase of PHASES) {
          const dates    = s[`${phase.key}_dates`] || (s[`${phase.key}_date`] ? [s[`${phase.key}_date`]] : []);
          if (!dates.length) continue;
          const leadsMap  = s[`${phase.key}_leads_map`];
          const kmMap     = s[`${phase.key}_km_staff_map`];
          const freeMap   = s[`${phase.key}_freelancers_map`];
          const notesMap  = s[`${phase.key}_notes`] || {};
          const leadsFlat = s[`${phase.key}_leads`] || [];
          const kmFlat    = s[`${phase.key}_km_staff`] || [];
          const isNewFree = freeMap && Object.values(freeMap).some(v => v && typeof v === 'object');

          const kmSupportMap = s[`${phase.key}_km_support`] || {};
          for (const date of dates) {
            const daySupport = kmSupportMap[date] || {};
            const dLeads   = leadsMap ? (leadsMap[date] || []) : leadsFlat;
            const dKm      = kmMap    ? (kmMap[date]    || []) : kmFlat;
            const byDeptKM = dKm.reduce((acc, n) => {
              const d = daySupport[n] || kmGroups.find(g => g.members.includes(n))?.dept || 'Khác';
              (acc[d] = acc[d] || []).push(n); return acc;
            }, {});

            let freeDepts = [];
            if (isNewFree && freeMap) {
              const dateVal = freeMap[date] || {};
              freeDepts = Object.entries(dateVal)
                .filter(([, v]) => v?.trim())
                .map(([dept, names]) => [dept, names.split(',').map(n => n.trim()).filter(Boolean)])
                .filter(([, ns]) => ns.length > 0);
            }

            const noteVal   = notesMap[date];
            const noteDepts = (noteVal && typeof noteVal === 'object')
              ? Object.entries(noteVal).filter(([, v]) => v?.trim())
              : [];
            const noteStr   = (noteVal && typeof noteVal === 'string') ? noteVal.trim() : '';
            const hasNote   = noteDepts.length > 0 || !!noteStr;

            if (!dLeads.length && !Object.keys(byDeptKM).length && !freeDepts.length && !hasNote) continue;
            allEntries.push({ phase, date, dLeads, byDeptKM, freeDepts, noteDepts, noteStr, hasNote, daySupport });
          }
        }

        allEntries.sort((a, b) => a.date.localeCompare(b.date) || PHASES.findIndex(p => p.key === a.phase.key) - PHASES.findIndex(p => p.key === b.phase.key));

        const zones = {
          today:    allEntries.filter(e => e.date === todayStr),
          tomorrow: allEntries.filter(e => e.date === tomorrowStr),
          upcoming: allEntries.filter(e => e.date > tomorrowStr),
          past:     allEntries.filter(e => e.date < todayStr).reverse(),
        };

        return (
          <div key={s.id} style={{ marginBottom:'16px', paddingBottom:'16px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize:'0.84rem', color:'#7878a0', marginBottom:'8px' }}>
              👤 Người phân lịch: <strong style={{ color:GOLD }}>{s.scheduler_name}</strong> ·{' '}
              <span style={{ color: s.status === 'confirmed' ? '#4ade80' : '#fbbf24' }}>
                {s.status === 'confirmed' ? '✓ Đã xác nhận' : '📝 Nháp'}
              </span>
            </p>
            {allEntries.length === 0
              ? <p style={{ color:'#7878a0', fontSize:'0.85rem', textAlign:'center', padding:'10px 0' }}>Không có dữ liệu nhân sự</p>
              : <div>
                  {zones.today.length > 0 && <>
                    <ZoneHdr color="#f87171" bg="rgba(248,113,113,0.1)" border="rgba(248,113,113,0.4)" label={`HÔM NAY — ${fmtD(todayStr)}`} count={zones.today.length} />
                    {zones.today.map(e => renderEntry(e))}
                  </>}
                  {zones.tomorrow.length > 0 && <>
                    <ZoneHdr color="#4ade80" bg="rgba(74,222,128,0.1)" border="rgba(74,222,128,0.35)" label={`NGÀY MAI — ${fmtD(tomorrowStr)}`} count={zones.tomorrow.length} />
                    {zones.tomorrow.map(e => renderEntry(e))}
                  </>}
                  {zones.upcoming.length > 0 && <>
                    <ZoneHdr color="#60a5fa" bg="rgba(96,165,250,0.08)" border="rgba(96,165,250,0.3)" label="NGÀY SẮP TỚI" count={zones.upcoming.length} />
                    {zones.upcoming.map(e => renderEntry(e))}
                  </>}
                  {zones.past.length > 0 && <>
                    <ZoneHdr color="#7878a0" bg="rgba(120,120,160,0.08)" border="rgba(120,120,160,0.2)" label="NGÀY ĐÃ QUA" count={zones.past.length} />
                    {zones.past.map(e => renderEntry(e))}
                  </>}
                </div>
            }
          </div>
        );
      })}
    </Modal>
  );
}

const STATUS_MAP = {
  planned:   { label: 'Lên kế hoạch', cls: 'badge-maintenance' },
  active:    { label: 'Đang diễn ra', cls: 'badge-available' },
  completed: { label: 'Hoàn thành',   cls: 'badge-available' },
  cancelled: { label: 'Đã hủy',       cls: 'badge-lost' },
};

function parseFilmingDates(ev) {
  if (!ev) return [];
  if (ev.filming_dates) { try { return JSON.parse(ev.filming_dates); } catch {} }
  return ev.filming_date ? [ev.filming_date] : [];
}
function parseDatesField(ev, multiKey, singleKey) {
  if (!ev) return [];
  if (ev[multiKey]) { try { const p = JSON.parse(ev[multiKey]); if (Array.isArray(p)) return p; } catch {} }
  return ev[singleKey] ? [ev[singleKey]] : [];
}
function parseDepts(ev) {
  try { return JSON.parse(ev?.departments || '[]') || []; } catch { return []; }
}


function EventForm({ initial, onSave, onCancel, allEvents = [], statusOnly = false, creatorName = '' }) {
  const [form, setForm] = useState(() => {
    const base = initial || { name: '', client: '', location: '', status: 'planned', notes: '' };
    return {
      ...base,
      start_dates: parseDatesField(initial, 'start_dates', 'start_date'),
      end_dates:   parseDatesField(initial, 'end_dates',   'end_date'),
      show_dates:  parseDatesField(initial, 'show_dates',  'show_date'),
      filming_dates: parseFilmingDates(initial),
      departments: parseDepts(initial),
    };
  });
  const [showSuggest, setShowSuggest] = useState(false);
  const [dateError, setDateError]     = useState(false);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (k === 'filming_dates') setDateError(false); };

  const suggestions = form.name.trim().length >= 1
    ? allEvents.filter(ev =>
        (!initial || ev.id !== initial.id) &&
        ev.name.toLowerCase().includes(form.name.toLowerCase())
      ).slice(0, 6)
    : [];

  if (statusOnly) return (
    <form onSubmit={async e => { e.preventDefault(); await onSave(form); }} className="space-y-4">
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Bạn chỉ có quyền cập nhật trạng thái sự kiện.</p>
      <div>
        <label className="label">Trạng thái</label>
        <select className="input" style={{ color:'#f87171', fontWeight:700 }} value={form.status} onChange={e => set('status', e.target.value)}>
          {Object.entries(STATUS_MAP).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1">Cập nhật trạng thái</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Hủy</button>
      </div>
    </form>
  );

  return (
    <form onSubmit={async e => {
      e.preventDefault();
      const datesArr = (form.filming_dates || []).filter(Boolean).sort();
      if (!initial && datesArr.length === 0) { setDateError(true); return; }
      const data = {
        ...form,
        filming_dates: datesArr,
        start_dates: (form.start_dates || []).filter(Boolean).sort(),
        end_dates:   (form.end_dates   || []).filter(Boolean).sort(),
        show_dates:  (form.show_dates  || []).filter(Boolean).sort(),
      };
      await onSave(data);
    }} className="space-y-4">
      <div style={{ position: 'relative' }}>
        <label className="label">Tên sự kiện *</label>
        <input
          className="input eq-search bold-input"
          required
          value={form.name}
          placeholder=""
          onChange={e => { set('name', e.target.value); setShowSuggest(true); }}
          onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
          onFocus={() => setShowSuggest(true)}
          autoComplete="off"
        />
        {showSuggest && suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: '#13131d', border: '1px solid rgba(201,168,76,0.3)',
            borderRadius: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            marginTop: '4px', overflow: 'hidden',
          }}>
            <p style={{ padding: '6px 12px', fontSize: '0.78rem', color: '#7878a0', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
              Sự kiện đã có — click để dùng tên này
            </p>
            {suggestions.map(ev => (
              <button
                key={ev.id}
                type="button"
                onMouseDown={() => { set('name', ev.name); setShowSuggest(false); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 12px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid rgba(201,168,76,0.08)',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontFamily: "'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace", fontSize: '0.78rem', color: '#7878a0', flexShrink: 0 }}>{ev.code}</span>
                <span style={{ color: '#c9a84c', fontWeight: 600, fontSize: '0.92rem' }}>{ev.name}</span>
                {ev.start_date && <span style={{ fontSize: '0.84rem', color: '#7878a0', marginLeft: 'auto' }}>{fmtD(ev.start_date)}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="label">Bộ phận thực hiện</label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginTop:'6px' }}>
          {['ATAS-LED', 'Sân Khấu', 'Kỹ Thuật', 'Cơ Sở Vật Chất'].map(dept => {
            const dc = getDeptColor(dept);
            const selected = (form.departments || []).includes(dept);
            return (
              <button key={dept} type="button"
                onClick={() => {
                  const curr = form.departments || [];
                  set('departments', selected ? curr.filter(d => d !== dept) : [...curr, dept]);
                }}
                style={{
                  padding:'4px 12px', borderRadius:'20px', fontSize:'0.82rem', fontWeight:700,
                  cursor:'pointer', transition:'all 0.15s',
                  border: `1px solid ${selected ? dc.border : 'rgba(255,255,255,0.1)'}`,
                  background: selected ? dc.bg : 'transparent',
                  color: selected ? dc.color : '#7878a0',
                }}>
                {dept}
              </button>
            );
          })}
        </div>
      </div>

      {!initial && creatorName && (
        <div>
          <label className="label">Người tạo sự kiện</label>
          <input className="input" value={creatorName} readOnly
            style={{ opacity: 0.6, cursor: 'default' }} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Khách hàng</label>
          <input className="input bold-input" value={form.client || ''} onChange={e => set('client', e.target.value)} />
        </div>
        <div>
          <label className="label">Địa điểm</label>
          <input className="input bold-input" value={form.location || ''} onChange={e => set('location', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Ngày bắt đầu</label>
          <MultiDatePicker value={form.start_dates || []} onChange={v => set('start_dates', v)} placeholder="Chọn ngày bắt đầu..." />
        </div>
        <div>
          <label className="label">Ngày Rehearsal</label>
          <MultiDatePicker value={form.show_dates || []} onChange={v => set('show_dates', v)} placeholder="Chọn ngày rehearsal..." />
        </div>
        <div>
          <label className="label" style={{ color:'#fb923c' }}>Ngày ghi hình {!initial && <span style={{ color:'#f87171' }}>*</span>}</label>
          <MultiDatePicker value={form.filming_dates || []} onChange={v => set('filming_dates', v)} error={dateError} placeholder="Chọn ngày ghi hình..." />
          {dateError && <p style={{ color:'#f87171', fontSize:'0.82rem', marginTop:'4px' }}>Vui lòng chọn ít nhất một ngày ghi hình</p>}
        </div>
        <div>
          <label className="label">Ngày kết thúc</label>
          <MultiDatePicker value={form.end_dates || []} onChange={v => set('end_dates', v)} placeholder="Chọn ngày kết thúc..." />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Trạng thái</label>
          <select className="input" style={{ color:'#f87171', fontWeight:700 }} value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(STATUS_MAP).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Ghi chú</label>
        <textarea className="input bold-input" rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary flex-1">{initial ? 'Cập nhật' : 'Tạo sự kiện'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Hủy</button>
      </div>
    </form>
  );
}

function _EventDetailModalLEGACY_DO_NOT_USE({ eventId, onClose }) {
  // Moved to components/EventDetailModal.jsx
  return null; /* dead code below kept for diff reference only */
  return (
    <Modal title={``} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div style={{ display:'flex', flexDirection:'column', gap:'6px', fontSize:'0.88rem' }}>
          <div style={{ display:'flex', gap:'6px', alignItems:'baseline' }}><span style={{ color:'#7878a0', flexShrink:0, whiteSpace:'nowrap' }}>Khách hàng:</span><strong>{ev.client || '—'}</strong></div>
          <div style={{ display:'flex', gap:'6px', alignItems:'baseline' }}><span style={{ color:'#7878a0', flexShrink:0, whiteSpace:'nowrap' }}>Địa điểm:</span><strong>{ev.location || '—'}</strong></div>
          {(() => {
            const startDates = parseDatesField(ev, 'start_dates', 'start_date');
            return startDates.length > 0 ? (
              <div style={{ display:'flex', gap:'6px', alignItems:'baseline', flexWrap:'wrap' }}>
                <span style={{ color:'#7878a0', flexShrink:0, whiteSpace:'nowrap' }}>Ngày bắt đầu:</span>
                <span>{startDates.map((d, i) => <strong key={i} style={{ color:'#f87171', marginRight:'8px' }}>📅 {fmtD(d)}</strong>)}</span>
              </div>
            ) : null;
          })()}
          {(() => {
            const showDates = parseDatesField(ev, 'show_dates', 'show_date');
            return showDates.length > 0 ? (
              <div style={{ display:'flex', gap:'6px', alignItems:'baseline', flexWrap:'wrap' }}>
                <span style={{ color:'#7878a0', flexShrink:0, whiteSpace:'nowrap' }}>Ngày Rehearsal:</span>
                <span>{showDates.map((d, i) => <strong key={i} style={{ color:'#34d399', marginRight:'8px' }}>🎪 {fmtD(d)}</strong>)}</span>
              </div>
            ) : null;
          })()}
          {(() => {
            const dates = parseFilmingDates(ev);
            return dates.length > 0 ? (
              <div style={{ display:'flex', gap:'6px', alignItems:'baseline', flexWrap:'wrap' }}>
                <span style={{ color:'#fb923c', fontWeight:700, flexShrink:0, whiteSpace:'nowrap' }}>🎬 Ngày ghi hình:</span>
                <span>{dates.map((d, i) => <strong key={i} style={{ color:'#fb923c', marginRight:'8px' }}>{fmtD(d)}</strong>)}</span>
              </div>
            ) : null;
          })()}
          {(() => {
            const endDates = parseDatesField(ev, 'end_dates', 'end_date');
            return endDates.length > 0 ? (
              <div style={{ display:'flex', gap:'6px', alignItems:'baseline', flexWrap:'wrap' }}>
                <span style={{ color:'#7878a0', flexShrink:0, whiteSpace:'nowrap' }}>Ngày kết thúc:</span>
                <span>{endDates.map((d, i) => <strong key={i} style={{ color:'#fb923c', marginRight:'8px' }}>🏁 {fmtD(d)}</strong>)}</span>
              </div>
            ) : null;
          })()}
          {ev.created_by && (
            <div style={{ display:'flex', gap:'6px', alignItems:'baseline' }}>
              <span style={{ color:'#7878a0', flexShrink:0, whiteSpace:'nowrap' }}>Người tạo:</span>
              <strong>{ev.created_by}</strong>
            </div>
          )}
        </div>
        {ev.notes && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(201,168,76,0.07) 0%, rgba(201,168,76,0.03) 100%)',
            border: '1px solid rgba(201,168,76,0.3)',
            borderLeft: '3px solid #c9a84c',
            borderRadius: '0 8px 8px 0',
            padding: '14px 16px',
            minHeight: '80px',
            maxHeight: '280px',
            overflowY: 'auto',
            position: 'relative',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              marginBottom: '10px',
              paddingBottom: '8px',
              borderBottom: '1px solid rgba(201,168,76,0.15)',
            }}>
              <span style={{ fontSize: '0.92rem' }}>📋</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c9a84c', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Ghi chú
              </span>
            </div>
            <p style={{
              fontSize: '0.87rem',
              lineHeight: '1.75',
              color: 'var(--text-main)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
            }}>{ev.notes}</p>
          </div>
        )}

        {/* Thiết bị trong kho */}
        <div>
          <h3 className="font-semibold mb-2" style={{ color: '#e0e0ee' }}>Thiết bị xuất kho</h3>
          {ev.items.length === 0 ? (
            <p className="text-gray-400 text-sm">Chưa có thiết bị nào được xuất</p>
          ) : (
            <div className="table-wrap">
              <table className="w-full text-sm" style={{ minWidth: '360px' }}>
                <thead><tr className="border-b text-gray-500 text-left">
                  <th className="pb-2">Mã</th><th className="pb-2">Thiết bị</th>
                  <th className="pb-2 text-right">Xuất</th><th className="pb-2 text-right">Đã trả</th><th className="pb-2 text-right">Còn nợ</th>
                </tr></thead>
                <tbody>
                  {(() => {
                    const CAT_COLORS = {
                      TECH:   '#fb923c', AUDIO:  '#60a5fa', LIGHT:  '#fbbf24',
                      LED:    '#4ade80', STAGE:  '#f472b6', CSVC:   '#94a3b8',
                      MATRIX: '#c084fc',
                    };
                    const rows = [];
                    let lastCat = null;
                    const sorted = [...ev.items].sort((a, b) => (a.eq_code || '').localeCompare(b.eq_code || ''));
                    sorted.forEach(it => {
                      const cat = (it.eq_code || '').split('-')[0];
                      if (cat !== lastCat) {
                        const color = CAT_COLORS[cat] || '#c9a84c';
                        rows.push(
                          <tr key={`cat-${cat}`}>
                            <td colSpan={5} style={{ padding:'8px 0 4px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                <div style={{ height:'1px', flex:1, background:`linear-gradient(to right, ${color}, transparent)`, opacity:0.5 }} />
                                <span style={{ fontSize:'0.80rem', fontWeight:800, color, letterSpacing:'0.1em', whiteSpace:'nowrap' }}>{cat}</span>
                                <div style={{ height:'1px', flex:1, background:`linear-gradient(to left, ${color}, transparent)`, opacity:0.5 }} />
                              </div>
                            </td>
                          </tr>
                        );
                        lastCat = cat;
                      }
                      rows.push(
                        <tr key={it.equipment_id} className="border-b last:border-0">
                          <td className="py-1.5 font-mono text-xs text-gray-500">{it.eq_code}</td>
                          <td className="py-1.5">{it.eq_name}</td>
                          <td className="py-1.5 text-right text-red-600 font-medium">{it.qty_out}</td>
                          <td className="py-1.5 text-right text-green-600">{it.qty_returned || 0}</td>
                          <td className={`py-1.5 text-right font-bold ${(it.qty_out - (it.qty_returned || 0)) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                            {it.qty_out - (it.qty_returned || 0)}
                          </td>
                        </tr>
                      );
                    });
                    return rows;
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Thiết bị mượn từ nhà cung cấp */}
        {ev.external_items?.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2" style={{ color: '#e0e0ee' }}>
              Thiết bị thuê từ nhà cung cấp
            </h3>
            <div className="table-wrap">
              <table className="w-full text-sm" style={{ minWidth: '320px' }}>
                <thead><tr className="border-b text-gray-500 text-left">
                  <th className="pb-2">Nhà cung cấp</th>
                  <th className="pb-2">Tên thiết bị</th>
                  <th className="pb-2 text-right">SL</th>
                  <th className="pb-2">Ghi chú</th>
                </tr></thead>
                <tbody>
                  {ev.external_items.map((it, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 font-medium" style={{ color: '#c9a84c' }}>{it.supplier || '—'}</td>
                      <td className="py-1.5" style={{ color: '#e0e0ee' }}>{it.name}</td>
                      <td className="py-1.5 text-right font-bold" style={{ color: '#60a5fa' }}>{it.quantity}</td>
                      <td className="py-1.5 text-gray-500 text-xs">
                        {[it.rental_days > 0 ? `Thuê ${it.rental_days} ngày` : '', it.notes || ''].filter(Boolean).join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function TrashView({ onClose, canPermanentDelete, user }) {
  const [trash, setTrash] = useState([]);
  const load = () => api.getTrashEvents().then(setTrash);
  useEffect(() => { load(); }, []);

  const isFullAdmin = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  const canRestoreEvent = (ev) => {
    if (isFullAdmin) return true;
    if (!user?.is_truong_phong) return false;
    if (!ev.created_by_id || !ev.created_by_role) return true;
    return ev.created_by_role === user?.role;
  };

  const handleRestore = async (ev) => {
    if (!confirm(`Khôi phục sự kiện "${ev.name}"?`)) return;
    try { await api.restoreEvent(ev.id); load(); }
    catch (e) { alert(e.message); }
  };

  const handlePermanent = async (ev) => {
    if (!confirm(`Xóa VĨNH VIỄN "${ev.name}"? Không thể khôi phục!`)) return;
    try { await api.permanentDeleteEvent(ev.id); load(); }
    catch (e) { alert(e.message); }
  };

  return (
    <Modal title="🗑 Thùng Rác Sự Kiện" onClose={onClose} size="lg">
      {trash.length === 0 ? (
        <p style={{ textAlign:'center', color:'var(--text-muted)', padding:'32px' }}>Thùng rác trống</p>
      ) : (
        <div className="space-y-3">
          <p style={{ fontSize:'0.84rem', color:'var(--text-muted)', marginBottom:'8px' }}>
            Sự kiện bị xóa sẽ tự động xóa vĩnh viễn sau 30 ngày.
          </p>
          {trash.map(ev => (
            <div key={ev.id} style={{
              background:'var(--bg-card)', border:'1px solid rgba(248,113,113,0.25)',
              borderRadius:'10px', padding:'14px 16px',
              display:'flex', flexDirection:'column', gap:'10px',
            }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
                    <span style={{ fontFamily:"'ui-monospace', 'SFMono-Regular', Menlo, Consolas, monospace", fontSize:'0.84rem', color:'var(--text-muted)' }}>{ev.code}</span>
                    <span style={{
                      fontSize:'0.78rem', fontWeight:700, padding:'2px 8px', borderRadius:'20px',
                      background: ev.days_left <= 5 ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.15)',
                      color: ev.days_left <= 5 ? '#f87171' : '#fbbf24',
                      border: `1px solid ${ev.days_left <= 5 ? 'rgba(248,113,113,0.4)' : 'rgba(251,191,36,0.3)'}`,
                      whiteSpace: 'nowrap',
                    }}>
                      còn {ev.days_left} ngày
                    </span>
                  </div>
                  <p style={{ fontWeight:700, color:'var(--text-primary)', margin:'0 0 2px', wordBreak:'break-word' }}>{ev.name}</p>
                  <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', margin:0 }}>
                    Xóa lúc: {ev.deleted_at?.slice(0, 16)}
                  </p>
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {canRestoreEvent(ev) && (
                  <button className="btn-secondary btn-sm" onClick={() => handleRestore(ev)}>↩ Khôi phục</button>
                )}
                {canPermanentDelete && (
                  <button className="btn-danger btn-sm" onClick={() => handlePermanent(ev)}>🗑 Xóa vĩnh viễn</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ZoneHeader({ color, bg, border, label, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '6px 0 4px' }}>
      <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${border}, transparent)` }} />
      <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', color, background: bg, border: `1px solid ${border}`, borderRadius: '999px', padding: '3px 12px', whiteSpace: 'nowrap', maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label} <span style={{ opacity: 0.7, fontWeight: 600 }}>({count})</span>
      </span>
      <div style={{ flex: 1, height: '1px', background: `linear-gradient(270deg, ${border}, transparent)` }} />
    </div>
  );
}

export default function Events() {
  const { user, can } = useAuth();
  const canManage   = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  const canFullEdit = ['SUPER_ADMIN', 'DIRECTOR'].includes(user?.role);
  const isFullAdmin = canFullEdit;

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const tomorrowStr = (() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
  })();

  function getAllDates(ev) {
    return [
      ...parseDatesField(ev, 'start_dates', 'start_date'),
      ...parseDatesField(ev, 'end_dates', 'end_date'),
      ...parseDatesField(ev, 'filming_dates', 'filming_date'),
      ...parseDatesField(ev, 'show_dates', 'show_date'),
    ].filter(Boolean);
  }
  function isEventOnDate(ev, d) {
    const dates = getAllDates(ev);
    if (dates.includes(d)) return true;
    const starts = parseDatesField(ev, 'start_dates', 'start_date').sort();
    const ends   = parseDatesField(ev, 'end_dates', 'end_date').sort();
    if (starts.length && ends.length && starts[0] <= d && d <= ends[ends.length - 1]) return true;
    return false;
  }
  function nearestUpcomingEvent(ev) {
    const all = getAllDates(ev).sort();
    return all.find(d => d >= todayStr) || null;
  }

  // TRUONG_PHONG chỉ hủy/khôi phục sự kiện do người cùng phòng tạo
  const canManageEvent = (ev) => {
    if (isFullAdmin) return true;
    if (!user?.is_truong_phong) return false;
    if (!ev.created_by_id || !ev.created_by_role) return true; // sự kiện cũ chưa có created_by_id
    return ev.created_by_role === user?.role;
  };
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showTrash, setShowTrash] = useState(false);
  const handledNavId = useRef(null);

  const load = useCallback(() => {
    const params = statusFilter ? { status: statusFilter } : {};
    if (showArchived) params.include_archived = 1;
    api.getEvents(params).then(data => {
      if (showArchived) setEvents(data.filter(e => e.archived_at));
      else setEvents(data);
    });
  }, [statusFilter, showArchived]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  // Mở modal khi navigate từ Dashboard với openEventId + openModal
  useEffect(() => {
    const { openEventId, openModal } = location.state || {};
    if (!openEventId || !events.length || handledNavId.current === openEventId) return;
    const ev = events.find(e => e.id === openEventId);
    if (!ev) return;
    handledNavId.current = openEventId;
    setSelected(ev);
    if (openModal === 'staff') setModal('staff');
    else setModal('detail');
  }, [events, location.state]);

  const handleSave = async (form) => {
    try {
      if (selected) await api.updateEvent(selected.id, form);
      else await api.createEvent(form);
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const handleCancel = async (ev) => {
    if (!confirm(`Hủy sự kiện "${ev.name}"?`)) return;
    try { await api.cancelEvent(ev.id); load(); }
    catch (e) { alert(e.message); }
  };

  const handleDelete = async (ev) => {
    if (ev.status !== 'cancelled') { alert('Chỉ có thể xóa sự kiện đã hủy.'); return; }
    if (!confirm(`Chuyển "${ev.name}" vào thùng rác?\nSẽ tự động xóa vĩnh viễn sau 30 ngày.`)) return;
    try { await api.deleteEvent(ev.id); load(); }
    catch (e) { alert(e.message); }
  };

  const handleArchive = async (ev) => {
    if (!confirm(`Lưu trữ sự kiện "${ev.name}"?\nSự kiện sẽ biến mất khỏi danh sách sau 24 giờ.`)) return;
    try { await api.archiveEvent(ev.id); load(); }
    catch (e) { alert(e.message); }
  };

  const handleUnarchive = async (ev) => {
    if (!confirm(`Bỏ lưu trữ sự kiện "${ev.name}"?\nSự kiện sẽ xuất hiện lại trong danh sách.`)) return;
    try { await api.unarchiveEvent(ev.id); load(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="p-6">
      {showTrash && <TrashView onClose={() => { setShowTrash(false); load(); }} canPermanentDelete={user?.role === 'SUPER_ADMIN'} user={user} />}
      <div style={{ marginBottom:'12px' }}>
        <h1 className="text-2xl font-bold">Sự Kiện / Dự Án</h1>
        <p className="text-gray-500 text-sm">{events.length} sự kiện</p>
      </div>

      {/* Desktop: 1 hàng [Tạo] [Tất cả] [Đã lưu trữ] [Đã hủy] [Thùng Rác]
          Mobile:  hàng 1 = [Tạo][Thùng Rác] · hàng 2 = [Tất cả][Đã lưu trữ][Đã hủy] */}
      <div className="ev-top-controls">
        {can('createEvent') && (
          <button className="btn-primary btn-sm ev-btn-create" onClick={() => { setSelected(null); setModal('form'); }}>+ Tạo sự kiện</button>
        )}
        <button
          className={`btn btn-sm ev-btn-tatca ${!showArchived && statusFilter === '' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setShowArchived(false); setStatusFilter(''); }}>
          Tất cả
        </button>
        {user?.role === 'SUPER_ADMIN' ? (
          <button
            className={`btn btn-sm ev-btn-filter ${showArchived ? 'btn-primary' : 'btn-secondary'}`}
            style={showArchived ? { background:'#7c3aed', borderColor:'#7c3aed' } : { borderColor:'rgba(167,139,250,0.4)', color:'#a78bfa' }}
            onClick={() => { setShowArchived(v => !v); setStatusFilter(''); }}>
            📦 Đã lưu trữ
          </button>
        ) : null}
        <button
          className={`btn btn-sm ev-btn-filter ${!showArchived && statusFilter === 'cancelled' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setShowArchived(false); setStatusFilter('cancelled'); }}>
          Đã hủy
        </button>
        {canManage && (
          <button className="btn-secondary btn-sm ev-btn-trash" onClick={() => setShowTrash(true)}>🗑 Thùng Rác</button>
        )}
      </div>

      {(() => {
        if (events.length === 0) return (
          <div className="card text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">🎭</p>
            <p>Chưa có sự kiện nào</p>
          </div>
        );

        function renderCard(ev, zone) {
          const s = STATUS_MAP[ev.status] || { label: ev.status, cls: '' };
          const isToday    = zone === 'today';
          const isTomorrow = zone === 'tomorrow';
          const isPast     = zone === 'past';
          const cardStyle = isToday
            ? { borderColor: 'rgba(248,113,113,0.45)', background: 'rgba(248,113,113,0.04)', boxShadow: '0 0 18px rgba(248,113,113,0.08)' }
            : isTomorrow
            ? { borderColor: 'rgba(74,222,128,0.35)', background: 'rgba(74,222,128,0.03)', boxShadow: '0 0 14px rgba(74,222,128,0.06)' }
            : isPast ? { opacity: 0.55 } : {};
          const startDates  = parseDatesField(ev, 'start_dates',   'start_date');
          const endDates    = parseDatesField(ev, 'end_dates',     'end_date');
          const filmDates   = parseDatesField(ev, 'filming_dates', 'filming_date');
          function dateColor(d) { return d === todayStr ? '#f87171' : d === tomorrowStr ? '#4ade80' : undefined; }
          function renderDateSpan(d) { return <span key={d} style={dateColor(d) ? { color: dateColor(d), fontWeight: 800 } : undefined}>{fmtD(d)}</span>; }
          return (
            <div key={ev.id} id={`ev-card-${ev.id}`} className="card" style={cardStyle}>
              <div style={{ marginBottom:'6px' }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-xs text-gray-400">{ev.code}</span>
                  <span className="text-sm text-gray-400 flex-shrink-0">{ev.tx_count} phiếu</span>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', alignItems:'center' }}>
                  <span className={s.cls}>{s.label}</span>
                  {isToday    && <span className="badge-maintenance" style={{ color:'#f87171', background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.4)' }}>HÔM NAY</span>}
                  {isTomorrow && <span className="badge-maintenance" style={{ color:'#4ade80', background:'rgba(74,222,128,0.15)', border:'1px solid rgba(74,222,128,0.35)' }}>NGÀY MAI</span>}
                  {ev.archived_at && <span className="badge-maintenance" style={{ color:'#a78bfa', background:'rgba(167,139,250,0.12)', border:'1px solid rgba(167,139,250,0.3)' }}>📦 Lưu trữ</span>}
                </div>
              </div>
              <h3 className="font-semibold text-lg mb-1">{ev.name}</h3>
              {(() => { const depts = parseDepts(ev); if (!depts.length) return null; const isAll = ALL_EVENT_DEPTS.every(d => depts.includes(d)); return (
                <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'6px' }}>
                  {isAll ? <span style={{ fontSize:'0.75rem', fontWeight:700, padding:'2px 9px', borderRadius:'20px', color:'#fcd34d', background:'rgba(252,211,77,0.08)', border:'1px solid rgba(252,211,77,0.25)' }}>Tất cả bộ phận</span>
                  : depts.map(dept => { const dc = getDeptColor(dept); return (
                    <span key={dept} style={{ fontSize:'0.75rem', fontWeight:700, padding:'2px 9px', borderRadius:'20px', color:dc.color, background:dc.bg, border:`1px solid ${dc.border}` }}>{dept}</span>
                  );})}
                </div>
              );})()}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mb-3">
                {ev.client   && <span>👤 {ev.client}</span>}
                {ev.location && <span>📍 {ev.location}</span>}
                {startDates.length > 0 && (
                  <span>📅 {startDates.map((d, i) => <span key={d}>{i > 0 && ' · '}{renderDateSpan(d)}</span>)}
                    {endDates.length > 0 && endDates[0] !== startDates[0] && <> → {endDates.map((d, i) => <span key={d}>{i > 0 && ' · '}{renderDateSpan(d)}</span>)}</>}
                  </span>
                )}
                {filmDates.length > 0 && (
                  <span style={{ color:'#fb923c', fontWeight:700, fontSize:'0.85rem' }}>🎬 {filmDates.map((d, i) => <span key={d}>{i > 0 && ' · '}{renderDateSpan(d)}</span>)}</span>
                )}
              </div>
              {(() => {
                const showEdit     = ev.status === 'completed' ? (user?.role === 'SUPER_ADMIN' || !!user?.is_truong_phong) : (canFullEdit || !!user?.is_truong_phong);
                const showCancel   = canManage && ev.status !== 'cancelled' && canManageEvent(ev) && (ev.status !== 'completed' || user?.role === 'SUPER_ADMIN');
                const showArchive  = user?.role === 'SUPER_ADMIN' && ev.status === 'completed' && !ev.archived_at;
                const showUnarch   = user?.role === 'SUPER_ADMIN' && !!ev.archived_at;
                const showDelete   = user?.role === 'SUPER_ADMIN' && ev.status === 'cancelled';
                const hasSecondary = showCancel || showArchive || showDelete;
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                    <div className="ev-card-row">
                      <button className="btn-secondary btn-sm ev-card-btn" onClick={() => { setSelected(ev); setModal('detail'); }}>
                        <span className="ev-ico">📋</span><span className="ev-lbl">Thiết bị</span>
                      </button>
                      <button className="btn-secondary btn-sm ev-card-btn" onClick={() => { setSelected(ev); setModal('staff'); }}>
                        <span className="ev-ico">👥</span><span className="ev-lbl">Nhân sự</span>
                      </button>
                      {showEdit && (
                        <button className="btn-secondary btn-sm ev-card-btn" onClick={() => { setSelected(ev); setModal('form'); }}>
                          <span className="ev-ico">✏️</span><span className="ev-lbl">Sửa</span>
                        </button>
                      )}
                      {showCancel && (
                        <button className="btn-danger btn-sm ev-card-btn" onClick={() => handleCancel(ev)}>
                          <span className="ev-ico">🚫</span><span className="ev-lbl">Hủy</span>
                        </button>
                      )}
                    </div>
                    {(showArchive || showDelete) && (
                      <div className="ev-card-row">
                        {showArchive && <button className="btn-secondary btn-sm ev-card-btn" onClick={() => handleArchive(ev)}><span className="ev-ico">💾</span><span className="ev-lbl">Lưu trữ</span></button>}
                        {showDelete  && <button className="btn-danger btn-sm ev-card-btn"    onClick={() => handleDelete(ev)}><span className="ev-ico">🗑</span><span className="ev-lbl">Xóa</span></button>}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        }

        const sorted = [...events].sort((a, b) => {
          const na = nearestUpcomingEvent(a), nb = nearestUpcomingEvent(b);
          if (!na && !nb) return 0;
          if (!na) return 1;
          if (!nb) return -1;
          return na.localeCompare(nb);
        });

        const todayZone    = sorted.filter(ev => ev.status !== 'cancelled' && isEventOnDate(ev, todayStr));
        const tomorrowZone = sorted.filter(ev => ev.status !== 'cancelled' && !isEventOnDate(ev, todayStr) && isEventOnDate(ev, tomorrowStr));
        const upcomingZone = sorted.filter(ev => { const n = nearestUpcomingEvent(ev); return n && n > tomorrowStr && ev.status !== 'cancelled'; });
        const pastZone     = sorted.filter(ev => nearestUpcomingEvent(ev) === null || ev.status === 'cancelled' || ev.status === 'completed');

        return (
          <div className="grid gap-4">
            {todayZone.length > 0 && <>
              <ZoneHeader color="#f87171" bg="rgba(248,113,113,0.1)" border="rgba(248,113,113,0.4)" label={`HÔM NAY — ${fmtD(todayStr)}`} count={todayZone.length} />
              {todayZone.map(ev => renderCard(ev, 'today'))}
            </>}
            {tomorrowZone.length > 0 && <>
              <ZoneHeader color="#4ade80" bg="rgba(74,222,128,0.1)" border="rgba(74,222,128,0.35)" label={`NGÀY MAI — ${fmtD(tomorrowStr)}`} count={tomorrowZone.length} />
              {tomorrowZone.map(ev => renderCard(ev, 'tomorrow'))}
            </>}
            {upcomingZone.length > 0 && <>
              <ZoneHeader color="#fbbf24" bg="rgba(251,191,36,0.08)" border="rgba(251,191,36,0.3)" label="SẮP TỚI" count={upcomingZone.length} />
              {upcomingZone.map(ev => renderCard(ev, 'upcoming'))}
            </>}
            {pastZone.length > 0 && <>
              {/* Section header rõ cho ĐÃ QUA / HỦY */}
              <div style={{ margin:'10px 0 6px', display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ height:'1px', flex:1, background:'linear-gradient(90deg,rgba(120,120,160,0.35),transparent)' }} />
                <span style={{ fontSize:'0.75rem', fontWeight:800, letterSpacing:'0.1em', color:'#7878a0', whiteSpace:'nowrap' }}>
                  ĐÃ QUA / HỦY ({pastZone.length})
                </span>
                <div style={{ height:'1px', flex:1, background:'linear-gradient(270deg,rgba(120,120,160,0.35),transparent)' }} />
              </div>
              <div style={{ maxHeight:'585px', overflowY:'auto', borderRadius:'8px', border:'1px solid rgba(120,120,160,0.15)', background:'rgba(120,120,160,0.03)', padding:'6px 8px' }}>
                {pastZone.map(ev => {
                  const s = STATUS_MAP[ev.status] || { label: ev.status, cls: '' };
                  const isCancelled = ev.status === 'cancelled';
                  const accent    = isCancelled ? '#f87171' : '#7878a0';
                  const accentRgb = isCancelled ? '248,113,113' : '120,120,160';
                  const startDates = parseDatesField(ev, 'start_dates', 'start_date');
                  const endDates   = parseDatesField(ev, 'end_dates',   'end_date');
                  const filmDates  = parseDatesField(ev, 'filming_dates', 'filming_date');
                  const showEdit   = ev.status === 'completed' ? (user?.role === 'SUPER_ADMIN' || !!user?.is_truong_phong) : (canFullEdit || !!user?.is_truong_phong);
                  const showCancel  = canManage && ev.status !== 'cancelled' && canManageEvent(ev) && (ev.status !== 'completed' || user?.role === 'SUPER_ADMIN');
                  const showArchive = user?.role === 'SUPER_ADMIN' && ev.status === 'completed' && !ev.archived_at;
                  const showUnarch  = user?.role === 'SUPER_ADMIN' && !!ev.archived_at;
                  const showDelete  = user?.role === 'SUPER_ADMIN' && ev.status === 'cancelled';
                  const pastBtn = {
                    display:'inline-flex', alignItems:'center', gap:'6px',
                    fontSize:'0.82rem', fontWeight:700, cursor:'pointer',
                    padding:'9px 14px', borderRadius:'8px',
                    background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)',
                    color:'#9090a8', opacity:0.9,
                  };
                  const pastBtnDanger = { ...pastBtn, color:'#f87171', border:'1px solid rgba(248,113,113,0.25)', background:'rgba(248,113,113,0.06)' };
                  return (
                    <div key={ev.id} id={`ev-card-${ev.id}`} style={{
                      background: `rgba(${accentRgb},0.03)`,
                      border: `1px solid rgba(${accentRgb},0.15)`,
                      borderLeft: `3px solid ${accent}`,
                      borderRadius: '8px',
                      padding: '9px 12px',
                      marginBottom: '6px',
                    }}>
                      {/* Hàng 1: status + tên + code + phiếu */}
                      <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'7px', flexWrap:'wrap' }}>
                        <span className={s.cls} style={{ flexShrink:0 }}>{s.label}</span>
                        {ev.archived_at && <span style={{ fontSize:'0.72rem', color:'#a78bfa', background:'rgba(167,139,250,0.1)', border:'1px solid rgba(167,139,250,0.25)', borderRadius:'4px', padding:'1px 5px', flexShrink:0 }}>📦 Lưu trữ</span>}
                        <span style={{ fontWeight:700, fontSize:'0.93rem', color: isCancelled ? 'rgba(248,113,113,0.6)' : '#a0a0b8', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.name}</span>
                        <span style={{ fontSize:'0.72rem', color:'#44445a', flexShrink:0 }}>{ev.code}</span>
                        {ev.tx_count > 0 && (
                          <span style={{ fontSize:'0.73rem', color:'#888860', background:'rgba(201,168,76,0.08)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:'9999px', padding:'1px 7px', flexShrink:0 }}>{ev.tx_count} phiếu</span>
                        )}
                      </div>
                      {/* Dept badges */}
                      {(() => { const depts = parseDepts(ev); if (!depts.length) return null; const isAll = ALL_EVENT_DEPTS.every(d => depts.includes(d)); return (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'6px' }}>
                          {isAll ? <span style={{ fontSize:'0.74rem', fontWeight:700, padding:'2px 8px', borderRadius:'20px', color:'#fcd34d', background:'rgba(252,211,77,0.08)', border:'1px solid rgba(252,211,77,0.25)' }}>Tất cả bộ phận</span>
                          : depts.map(dept => { const dc = getDeptColor(dept); return (
                            <span key={dept} style={{ fontSize:'0.74rem', fontWeight:700, padding:'2px 8px', borderRadius:'20px', color:dc.color, background:dc.bg, border:`1px solid ${dc.border}` }}>{dept}</span>
                          );})}
                        </div>
                      );})()}
                      {/* Hàng 2: ô thông tin */}
                      {(ev.client || ev.location || startDates.length > 0 || filmDates.length > 0) && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'7px' }}>
                          {ev.client && (
                            <span style={{ fontSize:'0.76rem', color:'#7878a0', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'5px', padding:'2px 7px' }}>👤 {ev.client}</span>
                          )}
                          {ev.location && (
                            <span style={{ fontSize:'0.76rem', color:'#5080a0', background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:'5px', padding:'2px 7px' }}>📍 {ev.location}</span>
                          )}
                          {startDates.length > 0 && (
                            <span style={{ fontSize:'0.76rem', color:'#7878a0', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'5px', padding:'2px 7px' }}>
                              📅 {startDates.map((d,i) => <span key={d}>{i>0&&' · '}{fmtD(d)}</span>)}
                              {endDates.length>0 && endDates[0]!==startDates[0] && <> → {endDates.map((d,i) => <span key={d}>{i>0&&' · '}{fmtD(d)}</span>)}</>}
                            </span>
                          )}
                          {filmDates.length > 0 && (
                            <span style={{ fontSize:'0.76rem', color:'#b06030', background:'rgba(251,146,60,0.06)', border:'1px solid rgba(251,146,60,0.2)', borderRadius:'5px', padding:'2px 7px' }}>
                              🎬 {filmDates.map((d,i) => <span key={d}>{i>0&&' · '}{fmtD(d)}</span>)}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Hàng 3: nút hành động — muted style, không đỏ */}
                      <div className="ev-card-row">
                        <button style={pastBtn} onClick={() => { setSelected(ev); setModal('detail'); }}>📋 Thiết bị</button>
                        <button style={pastBtn} onClick={() => { setSelected(ev); setModal('staff'); }}>👥 Nhân sự</button>
                        {showEdit    && <button style={pastBtn} onClick={() => { setSelected(ev); setModal('form'); }}>✏️ Sửa</button>}
                        {showCancel  && <button style={pastBtnDanger} onClick={() => handleCancel(ev)}>🚫 Hủy</button>}
                        {showArchive && <button style={pastBtn} onClick={() => handleArchive(ev)}>💾 Lưu trữ</button>}
                        {showUnarch  && <button style={pastBtn} onClick={() => handleUnarchive(ev)}>↩ Bỏ lưu trữ</button>}
                        {showDelete  && <button style={pastBtnDanger} onClick={() => handleDelete(ev)}>🗑 Xóa</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>}
          </div>
        );
      })()}

      {modal === 'staff' && selected && (
        <StaffScheduleModal event={selected} onClose={() => setModal(null)} />
      )}

      {modal === 'form' && (
        <Modal title={selected ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'} onClose={() => setModal(null)} size="lg">
          <EventForm
            initial={selected}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            allEvents={events}
            statusOnly={!canFullEdit && !!selected}
            creatorName={user?.full_name || ''}
          />
        </Modal>
      )}

      {modal === 'detail' && selected && (
        <EventDetailModal eventId={selected.id} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
