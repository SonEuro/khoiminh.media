import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ title, onClose, children, size = 'md', extra }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
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
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        /* safe area padding: tránh Dynamic Island và home indicator mọi hướng */
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <style>{`
        /* Portrait mobile: bottom sheet với margin ngang */
        @media (max-width: 767px) and (orientation: portrait) {
          .modal-overlay {
            padding-left: 14px !important;
            padding-right: 14px !important;
            padding-bottom: env(safe-area-inset-bottom, 0px) !important;
          }
          .modal-positioner {
            border-radius: 1rem !important;
            max-height: 92dvh !important;
            margin-bottom: 14px;
          }
        }
        /* Landscape mobile (phone): centered sheet với safe area
           Dùng max-height thay max-width để catch cả iPhone Pro Max landscape (~932px wide) */
        @media (orientation: landscape) and (max-height: 500px) {
          .modal-overlay {
            align-items: center !important;
            padding: env(safe-area-inset-top, 8px) calc(env(safe-area-inset-right, 0px) + 12px) env(safe-area-inset-bottom, 8px) calc(env(safe-area-inset-left, 0px) + 12px) !important;
          }
          .modal-positioner {
            border-radius: 1rem !important;
            max-height: 88dvh !important;
          }
          .modal-drag-handle { display: none !important; }
        }
        /* Desktop / tablet: centered */
        @media (min-width: 768px) and (orientation: portrait),
               (orientation: landscape) and (min-height: 501px) {
          .modal-overlay { align-items: center !important; padding: 16px !important; }
          .modal-positioner {
            border-radius: 1rem !important;
            max-height: 90dvh !important;
          }
          .modal-drag-handle { display: none !important; }
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
        {/* Drag handle — portrait mobile only */}
        <div className="modal-drag-handle" style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.18)' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 16px',
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

        {/* Safe area bottom (portrait) */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)', flexShrink: 0 }} />
      </div>
    </div>,
    document.body
  );
}
