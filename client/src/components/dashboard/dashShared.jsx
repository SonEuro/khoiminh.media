import { useState } from 'react';
import { Link } from 'react-router-dom';

export const GOLD = '#c9a84c';

export const PHASE_LABEL_MAP = { setup: 'Setup', teardown: 'Tháo dỡ', rehearsal: 'Rehearsal', filming: 'Ghi hình' };

export function Badge({ count, color = GOLD }) {
  if (!count) return null;
  return (
    <span style={{
      fontSize: '0.78rem', fontWeight: 800, minWidth: '22px', textAlign: 'center',
      background: color, color: '#08080e', borderRadius: '9999px', padding: '2px 8px',
    }}>{count}</span>
  );
}

export function SectionHeader({ title, color, count, colorRgb }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 16px',
      background: `linear-gradient(135deg, rgba(${colorRgb},0.16) 0%, rgba(${colorRgb},0.04) 100%)`,
      borderBottom: `1px solid rgba(${colorRgb},0.18)`,
      borderLeft: `4px solid ${color}`,
    }}>
      <span style={{ fontWeight: 700, color, fontSize: '0.85rem', flex: 1 }}>{title}</span>
      {count > 0 && <Badge count={count} color={color} />}
    </div>
  );
}

export function AdminSec({ title, color, rgb, count, linkTo, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius: '10px', overflow: 'hidden', border: `1px solid rgba(${rgb},0.28)` }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px',
          background: `linear-gradient(135deg,rgba(${rgb},0.14) 0%,rgba(${rgb},0.03) 100%)`,
          borderBottom: open ? `1px solid rgba(${rgb},0.16)` : 'none',
          borderLeft: `3px solid ${color}`, cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ fontWeight: 700, color, fontSize: '0.84rem', flex: 1, letterSpacing: '0.04em' }}>{title}</span>
        {count > 0 && <Badge count={count} color={color} />}
        {linkTo && (
          <Link to={linkTo} onClick={e => e.stopPropagation()} style={{ fontSize: '0.82rem', color: '#7878a0', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}>
            Xem tất cả →
          </Link>
        )}
        <span style={{ fontSize: '0.80rem', color: `rgba(${rgb},0.6)`, flexShrink: 0, marginLeft: '2px', transition: 'transform 0.18s', display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
      </div>
      {open && <div style={{ background: '#13131d', maxHeight: '292px', overflowY: 'auto' }}>{children}</div>}
    </div>
  );
}

export function ARow({ i, rgb, onClick, children }) {
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', cursor: onClick ? 'pointer' : 'default', borderTop: i > 0 ? `1px solid rgba(${rgb},0.07)` : 'none', transition: 'background 0.13s' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.background = `rgba(${rgb},0.05)`)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </div>
  );
}

export function AEmpty({ text }) {
  return <p style={{ color: '#7878a0', fontSize: '0.82rem', padding: '10px 14px', margin: 0 }}>{text}</p>;
}
