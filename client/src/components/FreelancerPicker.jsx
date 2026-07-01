import { useState, useEffect, useRef } from 'react';
import { FREELANCER_GROUPS } from '../constants/staff';

const GOLD = '#c9a84c';
const KNOWN_FREELANCERS = new Set(FREELANCER_GROUPS.flatMap(g => g.members));

function parseList(str) {
  return (str || '').split(',').map(s => s.trim()).filter(Boolean);
}

// Chọn freelancer từ danh sách có sẵn (ưu tiên theo bộ phận) + cho thêm tên thủ công.
// Lưu trữ dưới dạng chuỗi text phân tách bằng dấu phẩy (tương thích với freelancer_staff cũ).
export default function FreelancerPicker({ value, onChange, priorityDepts = [], restrictDepts = null }) {
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const ref = useRef(null);
  const selected = parseList(value);

  useEffect(() => {
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function setSelected(arr) { onChange(arr.join(', ')); }
  function toggle(name) {
    setSelected(selected.includes(name) ? selected.filter(s => s !== name) : [...selected, name]);
  }
  function addCustom() {
    const name = customInput.trim();
    if (!name || selected.includes(name)) { setCustomInput(''); return; }
    setSelected([...selected, name]);
    setCustomInput('');
  }

  const sortedGroups = [...FREELANCER_GROUPS]
    .filter(g => !restrictDepts || restrictDepts.includes(g.dept))
    .sort((a, b) => {
      const aP = priorityDepts.includes(a.dept) ? 0 : 1;
      const bP = priorityDepts.includes(b.dept) ? 0 : 1;
      return aP - bP;
    });

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', textAlign: 'left', padding: '9px 12px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.3)',
          borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: selected.length ? '#e8c97a' : '#7878a0',
        }}>
        <span>{selected.length === 0 ? 'Chọn freelancer...' : `Đã chọn ${selected.length} người`}</span>
        <span style={{ color: GOLD, fontSize: '0.75rem' }}>{open ? '▲' : '▼'}</span>
      </button>

      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px' }}>
          {selected.map(s => (
            <span key={s} style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '3px 8px', borderRadius: '9999px',
              background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.35)',
              color: '#60a5fa', fontSize: '0.72rem', fontWeight: 600,
            }}>
              {!KNOWN_FREELANCERS.has(s) && '✏️ '}{s}
              <button type="button" onClick={() => toggle(s)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: '0.8rem', lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
          background: '#13131d', border: '1px solid rgba(201,168,76,0.3)',
          borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
          maxHeight: '320px', overflowY: 'auto',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(201,168,76,0.15)', display: 'flex', gap: '6px' }}>
            <input
              value={customInput} onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
              placeholder="Thêm tên khác không có trong danh sách..."
              className="input" style={{ fontSize: '0.8rem', height: '32px', flex: 1 }}
            />
            <button type="button" onClick={addCustom}
              style={{ padding: '0 12px', borderRadius: '7px', fontSize: '0.78rem', fontWeight: 700,
                background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.4)', color: '#60a5fa', cursor: 'pointer' }}>
              + Thêm
            </button>
          </div>
          {sortedGroups.map((g, gi) => (
            <div key={g.dept} style={{ borderBottom: gi < sortedGroups.length - 1 ? '1px solid rgba(201,168,76,0.08)' : 'none' }}>
              <div style={{
                padding: '6px 14px', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em',
                color: priorityDepts.includes(g.dept) ? '#60a5fa' : GOLD,
                background: 'rgba(201,168,76,0.04)',
              }}>
                {priorityDepts.includes(g.dept) ? '⭐ ' : ''}{g.dept.toUpperCase()}
              </div>
              {g.members.map(m => {
                const active = selected.includes(m);
                return (
                  <label key={m} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '7px 14px', cursor: 'pointer',
                    background: active ? 'rgba(96,165,250,0.08)' : 'transparent',
                  }}>
                    <input type="checkbox" checked={active} onChange={() => toggle(m)}
                      style={{ accentColor: '#60a5fa', width: '15px', height: '15px', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.83rem', color: active ? '#60a5fa' : '#a0a0b8' }}>{m}</span>
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
