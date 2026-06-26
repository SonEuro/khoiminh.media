import { useRef } from 'react';

// iOS Safari cannot style type="date" text — this component uses a hidden
// native date input triggered by tapping a visible styled text display.
export default function DateInput({ value, onChange, min, max, className = 'input', style = {}, placeholder = 'Chọn ngày...' }) {
  const hiddenRef = useRef(null);

  const display = value
    ? `${value.slice(8,10)}-${value.slice(5,7)}-${value.slice(2,4)}`
    : '';

  const open = () => {
    const el = hiddenRef.current;
    if (!el) return;
    el.focus();
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); } catch (_) {}
    } else {
      el.click();
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Visible styled display */}
      <div
        onClick={open}
        className={className}
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          ...style,
        }}
      >
        <span style={{ flex: 1 }}>{display || placeholder}</span>
        <span style={{ color: 'var(--gold)', fontSize: '0.9rem', flexShrink: 0 }}>📅</span>
      </div>

      {/* Hidden native date input — only used for its picker UI */}
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        min={min}
        max={max}
        tabIndex={-1}
        style={{
          position: 'absolute',
          opacity: 0,
          width: '1px',
          height: '1px',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
