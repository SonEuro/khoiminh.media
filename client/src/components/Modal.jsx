import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ title, onClose, children, size = 'md', extra }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    // Prevent body scroll while modal open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const desktopWidths = { sm: '420px', md: '540px', lg: '720px', xl: '900px' };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        // mobile: bottom sheet / desktop: centered
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      {/* Desktop centering wrapper */}
      <style>{`
        @media (min-width: 768px) {
          .modal-positioner { align-self: center !important; border-radius: 1rem !important; max-height: 90vh !important; }
        }
        @media (max-width: 767px) {
          .modal-positioner { border-radius: 1rem 1rem 0 0 !important; max-height: 92dvh !important; }
        }
      `}</style>
      <div
        className="modal-positioner"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: desktopWidths[size],
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card)',
          border: '1px solid var(--gold-dim)',
          boxShadow: '0 0 60px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}
      >
        {/* Drag handle on mobile */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }} className="md:hidden">
          <div style={{ width: '36px', height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.18)' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
          padding: '12px 20px 12px',
          borderBottom: '1px solid var(--gold-dim)',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gold)', margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {extra}
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.4rem', lineHeight: 1, padding: '2px 6px' }}
            >&times;</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px', WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>

        {/* iOS safe area bottom */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)', flexShrink: 0 }} />
      </div>
    </div>,
    document.body
  );
}
