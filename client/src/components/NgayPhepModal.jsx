import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const GOLD = '#c9a84c';

function fmtN(n) {
  if (!n && n !== 0) return '0';
  return n % 1 === 0 ? String(n) : parseFloat(n.toFixed(1)).toString();
}

function fmtNgay(d) {
  if (!d) return '';
  const [, m, day] = d.split('-');
  return `${day}/${m}`;
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return `Tháng ${parseInt(m, 10)}/${y}`;
}

// Phép Năm tích lũy: 1 ngày/tháng hoàn thành, cap theo quota
function tichLuy(phep_nam, ym) {
  const monthNum = parseInt(ym.split('-')[1], 10);
  return Math.min(phep_nam, monthNum - 1);
}

const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// selected: Map<dateStr, soNgay (1 | 0.5)>
function MultiDatePicker({ selected, onChange, disabledDates = new Set() }) {
  const today = new Date().toISOString().slice(0, 10);
  const [viewYM, setViewYM] = useState(() => today.slice(0, 7));

  const [y, m] = viewYM.split('-').map(Number);

  function prevMonth() {
    const d = new Date(y, m - 2, 1);
    setViewYM(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  function nextMonth() {
    const d = new Date(y, m, 1);
    setViewYM(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  function toggleDate(ds) {
    if (disabledDates.has(ds)) return;
    const next = new Map(selected);
    if (!next.has(ds))          next.set(ds, 1);    // click 1: 1 ngày
    else if (next.get(ds) === 1) next.set(ds, 0.5); // click 2: 0.5 ngày
    else                         next.delete(ds);    // click 3: bỏ chọn
    onChange(next);
  }

  const daysInMonth = new Date(y, m, 0).getDate();
  const startDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;

  const cells = Array(startDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${viewYM}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const navBtnS = { background: 'transparent', border: 'none', color: '#c8c8e0', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' };

  return (
    <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 10px 8px', display: 'inline-block', verticalAlign: 'top' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '4px' }}>
        <button onClick={prevMonth} style={navBtnS}>‹</button>
        <span style={{ fontWeight: 700, color: '#e8c97a', fontSize: '0.82rem', minWidth: '70px', textAlign: 'center' }}>T{m}/{y}</span>
        <button onClick={nextMonth} style={navBtnS}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 28px)', gap: '2px', marginBottom: '4px' }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', color: '#555570', fontWeight: 700, padding: '2px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 28px)', gap: '2px' }}>
        {cells.map((ds, i) => {
          if (!ds) return <div key={i} />;
          const isDisabled = disabledDates.has(ds);
          const soNgay = selected.get(ds);
          const isSelected = selected.has(ds);
          const isHalf = soNgay === 0.5;
          const isToday = ds === today;
          const borderC = isSelected ? (isHalf ? '#fb923c' : GOLD) : isDisabled ? 'rgba(248,113,113,0.35)' : 'transparent';
          const bgC     = isSelected ? (isHalf ? 'rgba(251,146,60,0.22)' : `${GOLD}30`) : isDisabled ? 'rgba(248,113,113,0.12)' : isToday ? 'rgba(255,255,255,0.07)' : 'transparent';
          const textC   = isSelected ? (isHalf ? '#fb923c' : '#e8c97a') : isDisabled ? '#f87171' : isToday ? '#eeeef5' : '#c0c0d8';
          return (
            <button key={i} onClick={() => toggleDate(ds)}
              title={isDisabled ? 'Đã thêm' : isHalf ? '0.5 ngày — click để bỏ' : isSelected ? '1 ngày — click để chọn 0.5' : 'Click để chọn'}
              style={{ width: '28px', height: '26px', borderRadius: '5px', padding: 0, fontSize: '0.76rem', fontWeight: isSelected || isDisabled ? 700 : 400, cursor: isDisabled ? 'not-allowed' : 'pointer', border: `1px solid ${borderC}`, background: bgC, color: textC, opacity: isDisabled ? 0.65 : 1, position: 'relative' }}>
              {parseInt(ds.slice(8), 10)}
              {isHalf && <span style={{ position: 'absolute', bottom: '1px', right: '2px', fontSize: '0.50rem', lineHeight: 1, opacity: 0.9 }}>½</span>}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: '0.60rem', color: '#3a3a5a', marginTop: '6px', textAlign: 'center' }}>
        1 click = 1ng · 2 click = ½ng · 3 click = bỏ
      </div>
    </div>
  );
}

function OverrideField({ label, currentVal, isOverride, overrideVal, onSave, onClear, saving }) {
  const [inputVal, setInputVal] = useState(overrideVal !== null && overrideVal !== undefined ? String(overrideVal) : '');

  const inS = { padding: '4px 8px', borderRadius: '6px', border: `1px solid ${isOverride ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.12)'}`, background: 'rgba(255,255,255,0.05)', color: '#eeeef5', fontSize: '0.82rem', outline: 'none', width: '72px', textAlign: 'center' };
  const btnS = (c) => ({ padding: '3px 9px', borderRadius: '5px', border: `1px solid ${c}44`, background: `${c}18`, color: c, fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '0.78rem', color: isOverride ? GOLD : '#7878a0', minWidth: '110px', fontWeight: isOverride ? 700 : 400 }}>
        {label}
      </span>
      <span style={{ fontSize: '0.75rem', color: '#555570' }}>hiện: <b style={{ color: isOverride ? GOLD : '#eeeef5' }}>{fmtN(currentVal)}</b></span>
      <input type="number" min="0" step="0.5" value={inputVal} onChange={e => setInputVal(e.target.value)}
        placeholder="nhập..." style={inS} />
      <button onClick={() => onSave(inputVal)} disabled={saving || inputVal === ''} style={btnS(GOLD)}>Lưu</button>
      {isOverride && (
        <button onClick={onClear} disabled={saving} style={btnS('#f87171')}>Xóa TT</button>
      )}
    </div>
  );
}

function EditPanel({ user, year, month, onSaved, onClose }) {
  const [phepNam, setPhepNam] = useState(String(user.phep_nam));
  const [records, setRecords] = useState([]);
  const [addDates, setAddDates] = useState(new Map());
  const [addNote, setAddNote]   = useState('');
  const [saving, setSaving]     = useState(false);

  const [phepNamOv, setPhepNamOv] = useState({ isOv: user.phep_nam_is_override, val: user.phep_nam_override });
  const [daOv, setDaOv]     = useState({ isOv: user.da_nghi_is_override, val: user.da_nghi_override_val });
  const [thangOv, setThangOv] = useState({ isOv: user.nghi_thang_is_override, val: user.nghi_thang_override_val });

  const loadRecords = useCallback(() => {
    api.getNgayPhepRecords(user.id).then(setRecords).catch(() => {});
  }, [user.id]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  async function savePhepNam() {
    setSaving(true);
    try { await api.updatePhepNam(user.id, Number(phepNam)); onSaved(); }
    finally { setSaving(false); }
  }

  async function addRecord() {
    if (addDates.size === 0) return;
    setSaving(true);
    try {
      for (const [ngay, soNgay] of [...addDates.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        await api.addNgayPhepRecord({ user_id: user.id, ngay, so_ngay: soNgay, ghi_chu: addNote });
      }
      setAddDates(new Map()); setAddNote('');
      loadRecords(); onSaved();
    } finally { setSaving(false); }
  }

  async function delRecord(id) {
    if (!window.confirm('Xoá ngày nghỉ này?')) return;
    await api.deleteNgayPhepRecord(id);
    loadRecords(); onSaved();
  }

  async function saveOverride(scope, rawVal) {
    const v = Number(rawVal);
    if (isNaN(v) || v < 0) return;
    setSaving(true);
    const monthKey = scope === 'year' ? '' : scope === 'phepnam' ? `pn_${month}` : month;
    try {
      await api.setNgayPhepOverride({ user_id: user.id, year, month: monthKey, value: v });
      if (scope === 'year')    setDaOv({ isOv: true, val: v });
      else if (scope === 'phepnam') setPhepNamOv({ isOv: true, val: v });
      else setThangOv({ isOv: true, val: v });
      onSaved();
    } finally { setSaving(false); }
  }

  async function clearOverride(scope) {
    setSaving(true);
    const monthKey = scope === 'year' ? '' : scope === 'phepnam' ? `pn_${month}` : month;
    try {
      await api.clearNgayPhepOverride({ user_id: user.id, year, month: monthKey });
      if (scope === 'year')    setDaOv({ isOv: false, val: null });
      else if (scope === 'phepnam') setPhepNamOv({ isOv: false, val: null });
      else setThangOv({ isOv: false, val: null });
      onSaved();
    } finally { setSaving(false); }
  }

  const inS = { padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#eeeef5', fontSize: '0.82rem', outline: 'none' };
  const btnS = (c) => ({ padding: '4px 10px', borderRadius: '5px', border: `1px solid ${c}44`, background: `${c}18`, color: c, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' });
  const divS = { fontSize: '0.72rem', fontWeight: 700, color: '#7878a0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', marginTop: '14px' };

  const monthNum = parseInt((month || '2026-01').split('-')[1], 10);

  const autoTl = tichLuy(user.phep_nam, month || `${year}-01`);
  const tl = phepNamOv.isOv ? (phepNamOv.val ?? autoTl) : autoTl;
  const effDaNghi  = daOv.isOv   ? (daOv.val   ?? user.da_nghi_before) : user.da_nghi_before;
  const effThang   = thangOv.isOv ? (thangOv.val ?? user.nghi_thang)   : user.nghi_thang;

  return (
    <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', padding: '14px 16px', marginTop: '4px' }}>
      {/* Header: auto Phép Năm + close */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
        <span style={{ fontSize: '0.78rem', color: '#7878a0' }}>Phép Năm T{monthNum}:</span>
        <span style={{ color: GOLD, fontWeight: 800, fontSize: '1.05rem' }}>{tl}</span>
        <span style={{ fontSize: '0.70rem', color: '#3a3a5a' }}>
          {phepNamOv.isOv ? `(thủ công · auto: ${autoTl})` : `(tự động · quota: ${user.phep_nam})`}
        </span>
        <button onClick={onClose} style={{ ...btnS('#7878a0'), marginLeft: 'auto' }}>✕ Đóng</button>
      </div>

      {/* Manual overrides */}
      <div style={divS}>Điều Chỉnh Thủ Công</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '6px' }}>
        {/* Quota gốc */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', color: '#7878a0', minWidth: '110px' }}>Quota năm</span>
          <input type="number" min="0" max="365" value={phepNam} onChange={e => setPhepNam(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#eeeef5', fontSize: '0.82rem', outline: 'none', width: '72px', textAlign: 'center' }} />
          <button onClick={savePhepNam} disabled={saving} style={btnS(GOLD)}>Lưu</button>
        </div>
        {month && (
          <OverrideField
            label={`Phép Năm T${monthNum}`}
            currentVal={autoTl}
            isOverride={phepNamOv.isOv}
            overrideVal={phepNamOv.val}
            onSave={v => saveOverride('phepnam', v)}
            onClear={() => clearOverride('phepnam')}
            saving={saving}
          />
        )}
        <OverrideField
          label="Đã Nghỉ Năm"
          currentVal={user.da_nghi_before}
          isOverride={daOv.isOv}
          overrideVal={daOv.val}
          onSave={v => saveOverride('year', v)}
          onClear={() => clearOverride('year')}
          saving={saving}
        />
        {month && (
          <OverrideField
            label={`Nghỉ T${monthNum}`}
            currentVal={user.nghi_thang}
            isOverride={thangOv.isOv}
            overrideVal={thangOv.val}
            onSave={v => saveOverride('month', v)}
            onClear={() => clearOverride('month')}
            saving={saving}
          />
        )}
        <div style={{ fontSize: '0.76rem', color: '#555570' }}>
          Còn Lại (tự động): <b style={{ color: '#4ade80' }}>{fmtN(tl - effDaNghi - effThang)}</b>
          <span style={{ marginLeft: '8px', color: '#3a3a5a' }}>(= phép năm − đã nghỉ − T{monthNum})</span>
        </div>
      </div>

      {/* Add individual day records */}
      <div style={divS}>Thêm Ngày Nghỉ</div>

      {/* Existing records as chips */}
      {records.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
          {[...records].sort((a, b) => a.ngay.localeCompare(b.ngay)).map(r => (
            <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#f97316', fontWeight: 600, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '5px', padding: '2px 4px 2px 8px' }}>
              {fmtNgay(r.ngay)}/{r.ngay.slice(0,4)}{r.so_ngay < 1 ? ` (${r.so_ngay})` : ''}
              {r.ghi_chu ? <span style={{ color: '#a08040', fontWeight: 400 }}> · {r.ghi_chu}</span> : null}
              <button onClick={() => delRecord(r.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.95rem', lineHeight: 1, padding: '0 2px', marginLeft: '2px' }}>×</button>
            </span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '0.78rem', color: '#555570', marginBottom: '10px' }}>Chưa có ngày nghỉ nào.</div>
      )}

      {/* Calendar + options */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <MultiDatePicker selected={addDates} onChange={setAddDates} disabledDates={new Set(records.map(r => r.ngay))} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
          <input type="text" placeholder="Ghi chú..." value={addNote} onChange={e => setAddNote(e.target.value)}
            style={{ ...inS, width: '160px' }} />
          {addDates.size > 0 && (() => {
            const total = [...addDates.values()].reduce((s, v) => s + v, 0);
            return <div style={{ fontSize: '0.75rem', color: '#e8c97a' }}>Đã chọn: <b>{fmtN(total)}</b> ngày</div>;
          })()}
          <button onClick={addRecord} disabled={saving || addDates.size === 0}
            style={{ ...btnS('#4ade80'), opacity: addDates.size === 0 ? 0.4 : 1 }}>
            + Thêm{addDates.size > 0 ? ` ${fmtN([...addDates.values()].reduce((s,v)=>s+v,0))} ngày` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}


export default function NgayPhepModal({ onClose, month: initMonth }) {
  const todayYM = new Date().toISOString().slice(0, 7);
  const [month, setMonth]     = useState(initMonth || todayYM);
  const year = month.slice(0, 4);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getNgayPhep(year, month);
      setUsers(data);
    } finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const byTen = n => (n || '').trim().split(/\s+/).pop() || n;
  const sorted = [...users].sort((a, b) => {
    const dc = a.dept.localeCompare(b.dept, 'vi');
    if (dc !== 0) return dc;
    const tp = (b.truong_phong || 0) - (a.truong_phong || 0);
    if (tp !== 0) return tp;
    return byTen(a.full_name).localeCompare(byTen(b.full_name), 'vi');
  });
  sorted.forEach((u, i) => { u.stt = i + 1; });

  const thS = { padding: '8px 8px', fontSize: '0.67rem', fontWeight: 700, color: '#7878a0', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap', textAlign: 'center' };
  const tdS = { padding: '8px 8px', fontSize: '0.83rem', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle', textAlign: 'center' };

  const monthNum = parseInt(month.split('-')[1], 10);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ background: '#13131f', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '12px', width: '100%', maxWidth: '980px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'linear-gradient(135deg,rgba(201,168,76,0.1) 0%,transparent 100%)', borderRadius: '12px 12px 0 0' }}>
          <span style={{ fontWeight: 800, color: GOLD, fontSize: '0.95rem', letterSpacing: '0.04em' }}>📅 NGÀY PHÉP</span>

          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
            <button onClick={() => setMonth(m => shiftMonth(m, -1))}
              style={{ background: 'transparent', border: 'none', color: '#c8c8e0', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, padding: '2px 8px', borderRadius: '5px' }}>‹</button>
            <span style={{ fontWeight: 700, color: '#e8c97a', fontSize: '0.88rem', minWidth: '110px', textAlign: 'center' }}>{monthLabel(month)}</span>
            <button onClick={() => setMonth(m => shiftMonth(m, 1))} disabled={month >= todayYM}
              style={{ background: 'transparent', border: 'none', color: month >= todayYM ? '#3a3a5a' : '#c8c8e0', cursor: month >= todayYM ? 'default' : 'pointer', fontSize: '1rem', fontWeight: 700, padding: '2px 8px', borderRadius: '5px' }}>›</button>
          </div>

          <span style={{ fontSize: '0.75rem', color: '#555570', marginLeft: 'auto' }}>
            Phép tích lũy = 1 ngày/tháng (tháng trước)
          </span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#7878a0', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px' }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#7878a0' }}>Đang tải...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ ...thS, textAlign: 'left', width: '32px' }}>STT</th>
                    <th style={{ ...thS, textAlign: 'left' }}>Họ Tên</th>
                    <th style={{ ...thS }}>Phép Năm</th>
                    <th style={thS}>Đã Nghỉ</th>
                    <th style={thS}>T{monthNum}</th>
                    <th style={thS}>Tổng Ngày Phép</th>
                    <th style={thS}>Còn Lại</th>
                    <th style={{ ...thS, textAlign: 'left', minWidth: '140px' }}>Ngày Nghỉ T{monthNum}</th>
                    <th style={{ ...thS, width: '56px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let lastDept = null;
                    return sorted.map(u => {
                    const tl = u.phep_nam_is_override ? u.phep_nam_override : tichLuy(u.phep_nam, month);
                    const conLai = tl - u.da_nghi_before - u.nghi_thang;
                    const deptHeader = u.dept !== lastDept ? (lastDept = u.dept,
                      <tr key={`dept-${u.dept}`}>
                        <td colSpan={9} style={{ padding: '8px 10px', fontSize: '0.72rem', fontWeight: 700, color: '#a08040', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'rgba(201,168,76,0.07)', borderTop: '1px solid rgba(201,168,76,0.15)', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                          {u.dept}
                        </td>
                      </tr>
                    ) : null;
                    return (
                      <>
                        {deptHeader}
                        <tr key={u.id}
                          style={{ background: editingId === u.id ? 'rgba(201,168,76,0.06)' : 'transparent' }}
                          onMouseEnter={e => { if (editingId !== u.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                          onMouseLeave={e => { if (editingId !== u.id) e.currentTarget.style.background = 'transparent'; }}>
                          <td style={{ ...tdS, color: '#555570', fontSize: '0.74rem' }}>{u.stt}</td>
                          <td style={{ ...tdS, textAlign: 'left', fontWeight: 600, color: '#eeeef5' }}>{u.full_name}</td>
                          <td style={{ ...tdS, color: GOLD, fontWeight: 700 }}>{tl}</td>
                          <td style={{ ...tdS, color: u.da_nghi_before > 0 ? '#f87171' : '#555570', fontWeight: u.da_nghi_before > 0 ? 700 : 400 }}>{fmtN(u.da_nghi_before)}</td>
                          <td style={{ ...tdS, color: u.nghi_thang > 0 ? '#fb923c' : '#555570', fontWeight: u.nghi_thang > 0 ? 700 : 400 }}>{fmtN(u.nghi_thang)}</td>
                          <td style={{ ...tdS, color: '#c8c8e0', fontWeight: 600 }}>{fmtN(u.da_nghi_before + u.nghi_thang)}</td>
                          <td style={{ ...tdS, color: conLai < 0 ? '#f87171' : conLai <= 2 ? '#fb923c' : '#4ade80', fontWeight: 700 }}>{fmtN(conLai)}</td>
                          <td style={{ ...tdS, textAlign: 'left' }}>
                            {(u.nghi_thang_dates || []).length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                {(u.nghi_thang_dates || []).map((d, i) => (
                                  <span key={i} style={{ fontSize: '0.72rem', color: '#f97316', fontWeight: 600, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '4px', padding: '1px 5px', whiteSpace: 'nowrap' }}>
                                    {fmtNgay(d.ngay)}{d.so_ngay < 1 ? ` (${d.so_ngay})` : ''}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#3a3a5a', fontSize: '0.75rem' }}>—</span>
                            )}
                          </td>
                          <td style={tdS}>
                            <button
                              onClick={() => setEditingId(editingId === u.id ? null : u.id)}
                              style={{ padding: '4px 10px', borderRadius: '5px', border: `1px solid ${editingId === u.id ? GOLD : 'rgba(255,255,255,0.1)'}44`, background: editingId === u.id ? `${GOLD}18` : 'rgba(255,255,255,0.03)', color: editingId === u.id ? GOLD : '#8888b0', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
                              {editingId === u.id ? 'Xong' : 'Sửa'}
                            </button>
                          </td>
                        </tr>
                        {editingId === u.id && (
                          <tr key={`edit-${u.id}`}>
                            <td colSpan={10} style={{ padding: '4px 10px 12px' }}>
                              <EditPanel user={u} year={year} month={month} onSaved={load} onClose={() => setEditingId(null)} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  });
                })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
