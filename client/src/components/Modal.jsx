import { useEffect } from 'react';

export default function Modal({ title, onClose, children, size = 'md', extra }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className={`w-full ${widths[size]} max-h-[90vh] flex flex-col`}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--gold-dim)',
          borderRadius: '1rem',
          boxShadow: '0 0 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.08) inset',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid var(--gold-dim)',
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold)', margin: 0 }}>{title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {extra}
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.4rem', lineHeight: 1, padding: '2px 6px' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >&times;</button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>{children}</div>
      </div>
    </div>
  );
}
