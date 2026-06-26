import { useState } from 'react';

const MONTH_NAMES = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const DAY_NAMES   = ['CN','T2','T3','T4','T5','T6','T7'];

export default function MultiDatePicker({ value = [], onChange, error = false }) {
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen]           = useState(false);
  const [viewYear, setViewYear]   = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  const toStr = (d) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const toggle = (d) => {
    const s = toStr(d);
    const next = value.includes(s) ? value.filter(v => v !== s) : [...value, s].sort();
    onChange(next);
  };

  // Build grid cells
  const firstDow   = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMon  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMon }, (_, i) => i + 1)];

  // Display text
  const displayText = value.length > 0
    ? value.map(d => { const [y,m,day] = d.split('-'); return `${day}-${m}`; }).join('  ·  ')
    : 'Chọn ngày ghi hình...';

  return (
    <div style={{ position:'relative' }}>
      {/* Trigger */}
      <div onClick={() => setOpen(o => !o)} className="input"
        style={{ cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', userSelect:'none', border: error ? '1px solid #f87171' : undefined }}>
        <span style={{ flex:1, color: value.length ? '#a78bfa' : 'var(--text-muted)', fontWeight: value.length ? 700 : 400, fontSize: value.length ? '0.95rem' : undefined, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {displayText}
        </span>
        <span style={{ color:'var(--gold)', fontSize:'0.9rem', flexShrink:0 }}>📅</span>
      </div>

      {open && (
        <>
          {/* Backdrop */}
          <div style={{ position:'fixed', inset:0, zIndex:299 }} onClick={() => setOpen(false)} />

          {/* Calendar panel */}
          <div style={{
            position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:300,
            background:'#0e0e1a', border:'1px solid rgba(167,139,250,0.45)',
            borderRadius:'14px', padding:'14px 12px 10px',
            boxShadow:'0 20px 60px rgba(0,0,0,0.95)',
            minWidth:'270px',
          }}>
            {/* Month navigation */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
              <button type="button" onClick={prevMonth}
                style={{ background:'rgba(167,139,250,0.12)', border:'none', color:'#a78bfa', cursor:'pointer', borderRadius:'6px', width:'28px', height:'28px', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
              <span style={{ fontWeight:700, color:'#e0e0ee', fontSize:'0.88rem' }}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button type="button" onClick={nextMonth}
                style={{ background:'rgba(167,139,250,0.12)', border:'none', color:'#a78bfa', cursor:'pointer', borderRadius:'6px', width:'28px', height:'28px', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
            </div>

            {/* Day-of-week headers */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:'4px' }}>
              {DAY_NAMES.map(d => (
                <div key={d} style={{ textAlign:'center', fontSize:'0.6rem', color:'#555570', fontWeight:700, padding:'2px 0' }}>{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const s = toStr(d);
                const sel = value.includes(s);
                const isToday = s === today;
                return (
                  <button key={i} type="button" onClick={() => toggle(d)}
                    style={{
                      width:'100%', aspectRatio:'1', borderRadius:'7px', border: isToday && !sel ? '1px solid rgba(167,139,250,0.5)' : 'none',
                      cursor:'pointer', fontWeight: sel ? 800 : 400, fontSize:'0.8rem',
                      background: sel ? '#a78bfa' : isToday ? 'rgba(167,139,250,0.13)' : 'transparent',
                      color: sel ? '#fff' : isToday ? '#c4b5fd' : '#c0c0d8',
                      transition:'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!sel) e.currentTarget.style.background='rgba(167,139,250,0.22)'; }}
                    onMouseLeave={e => { if (!sel) e.currentTarget.style.background = isToday ? 'rgba(167,139,250,0.13)' : 'transparent'; }}
                  >{d}</button>
                );
              })}
            </div>

            {/* Selected tags */}
            {value.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginTop:'10px', paddingTop:'8px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                {value.map(d => {
                  const [,m,day] = d.split('-');
                  return (
                    <span key={d} style={{ fontSize:'0.68rem', background:'rgba(167,139,250,0.18)', border:'1px solid rgba(167,139,250,0.35)', color:'#c4b5fd', borderRadius:'20px', padding:'2px 8px', cursor:'pointer' }}
                      onClick={() => onChange(value.filter(v => v !== d))}>
                      {day}/{m} ×
                    </span>
                  );
                })}
              </div>
            )}

            {/* Footer actions */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'8px' }}>
              <button type="button" onClick={() => onChange([])}
                style={{ fontSize:'0.7rem', color:'#f87171', background:'none', border:'none', cursor:'pointer', opacity: value.length ? 1 : 0.3 }}
                disabled={!value.length}>
                Xóa tất cả
              </button>
              <button type="button" onClick={() => setOpen(false)}
                style={{ fontSize:'0.72rem', color:'#4ade80', background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'6px', padding:'3px 14px', cursor:'pointer', fontWeight:700 }}>
                Xong ✓
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
