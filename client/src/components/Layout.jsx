import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const GOLD         = '#c9a84c';
const GOLD_DIM     = 'rgba(201,168,76,0.3)';
const GOLD_GLOW    = 'rgba(201,168,76,0.08)';
const BG_SIDEBAR   = '#08080e';
const BG_CARD      = '#13131d';
const TEXT_MUTED   = '#7878a0';
const TEXT_PRIMARY = '#eeeef5';

function SidebarContent({ nav, user, ROLE_LABELS, can, onNavClick, onLogout }) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background: BG_SIDEBAR }}>

      {/* Logo */}
      <div style={{ padding:'16px 20px', borderBottom:`1px solid ${GOLD_DIM}` }}>
        <Link to="/" onClick={onNavClick}>
          <img src="/logo.png" alt="Khôi Minh" style={{ width:'100%', maxWidth:'150px', display:'block' }} />
        </Link>
        <div style={{ marginTop:'8px', display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ flex:1, height:'1px', background:`linear-gradient(90deg,${GOLD},transparent)` }} />
          <span style={{ color: GOLD, fontSize:'0.55rem', letterSpacing:'0.15em', fontWeight:700 }}>QUẢN LÝ NỘI BỘ</span>
          <div style={{ flex:1, height:'1px', background:`linear-gradient(270deg,${GOLD},transparent)` }} />
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex:1, padding:'8px 0', overflowY:'auto' }}>
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavClick}
            style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:'12px',
              padding:'11px 20px',
              paddingLeft: isActive ? '17px' : '20px',
              fontSize:'0.875rem', fontWeight: isActive ? 700 : 400,
              color: isActive ? '#e8c97a' : TEXT_MUTED,
              background: isActive ? 'rgba(201,168,76,0.1)' : 'transparent',
              borderLeft: isActive ? `3px solid ${GOLD}` : '3px solid transparent',
              transition:'all 0.18s',
              textDecoration:'none',
            })}
          >
            <span style={{ fontSize:'1.05rem', minWidth:'18px', textAlign:'center' }}>{item.icon}</span>
            <span style={{ letterSpacing:'0.02em' }}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Gold divider */}
      <div style={{ height:'1px', margin:'0 20px', background:`linear-gradient(90deg,transparent,${GOLD},transparent)`, opacity:0.5 }} />

      {/* User section */}
      <div style={{ position:'relative' }}>
        <button
          onClick={() => setShowUserMenu(v => !v)}
          style={{
            width:'100%', display:'flex', alignItems:'center', gap:'12px',
            padding:'12px 20px', background:'transparent', border:'none',
            cursor:'pointer', textAlign:'left', transition:'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background=GOLD_GLOW}
          onMouseLeave={e => e.currentTarget.style.background='transparent'}
        >
          <div style={{
            width:'32px', height:'32px', flexShrink:0,
            background:'linear-gradient(135deg,#b8922e,#e8c97a)',
            borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'0.8rem', fontWeight:800, color:'#08080e',
            boxShadow:'0 0 10px rgba(201,168,76,0.4)',
          }}>
            {user?.full_name?.[0] || '?'}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:'0.8rem', fontWeight:600, color: TEXT_PRIMARY, margin:0,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user?.full_name}
            </p>
            <p style={{ fontSize:'0.7rem', color: GOLD, margin:0,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {ROLE_LABELS[user?.role] || user?.role}
            </p>
          </div>
          <span style={{ color: GOLD, fontSize:'0.6rem' }}>{showUserMenu ? '▲' : '▼'}</span>
        </button>

        {showUserMenu && (
          <div style={{
            position:'absolute', bottom:'100%', left:0, right:0,
            background: BG_CARD,
            border:`1px solid ${GOLD_DIM}`,
            borderRadius:'8px 8px 0 0',
            overflow:'hidden',
            boxShadow:'0 -8px 24px rgba(0,0,0,0.5)',
          }}>
            <button
              onClick={() => { setShowUserMenu(false); onLogout(); }}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:'12px',
                padding:'12px 20px', background:'transparent', border:'none',
                cursor:'pointer', fontSize:'0.875rem', color:'#f87171',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(220,50,50,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}
            >
              <span>⎋</span>
              <span>Đăng xuất</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, can, logout, ROLE_LABELS } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const nav = [
    { to: '/events',       icon: '◉', label: 'Sự Kiện',              always: true },
    { to: '/export',       icon: '↑', label: 'Xuất Thiết Bị Sự Kiện',  show: can('transact') },
    { to: '/event-return', icon: '↓', label: 'Nhập Thiết Bị Sự Kiện',  show: can('transact') },
    { to: '/event-report', icon: '📋', label: 'Báo Cáo Sự Kiện',       always: true },
    { to: '/violations',   icon: '⚠', label: 'Vi Phạm Nội Quy',        always: true },
    { to: '/transactions', icon: '≡', label: 'Lịch Sử Vận Hành', show: ['SUPER_ADMIN','PRODUCTION'].includes(user?.role) },
    { to: '/equipment',    icon: '◧', label: 'Tổng Thiết Bị Khôi Minh', always: true },
    { to: '/return',       icon: '⟳', label: 'Nhập Kho Thiết Bị',      show: can('transact') },
    { to: '/users',        icon: '◎', label: 'Người Dùng',           show: can('manageUsers') },
  ].filter(item => item.always || item.show);

  // Close drawer on resize to desktop
  useEffect(() => {
    const fn = () => { if (window.innerWidth >= 1024) setDrawerOpen(false); };
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg-main)' }}>

      {/* ── Desktop sidebar (lg+) ─────────────────── */}
      <aside
        className="hidden lg:flex"
        style={{ width:'220px', flexShrink:0, flexDirection:'column' }}
      >
        <SidebarContent
          nav={nav} user={user} ROLE_LABELS={ROLE_LABELS} can={can}
          onNavClick={() => {}}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile drawer overlay ─────────────────── */}
      {drawerOpen && (
        <div
          className="lg:hidden"
          style={{
            position:'fixed', inset:0, zIndex:50,
            display:'flex',
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(2px)' }}
          />
          {/* Drawer panel */}
          <div style={{
            position:'relative', zIndex:51,
            width:'240px', height:'100%',
            borderRight:`1px solid ${GOLD_DIM}`,
            boxShadow:'4px 0 32px rgba(0,0,0,0.7)',
            animation:'slideIn 0.2s ease',
          }}>
            <SidebarContent
              nav={nav} user={user} ROLE_LABELS={ROLE_LABELS} can={can}
              onNavClick={() => setDrawerOpen(false)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* ── Main area ─────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Mobile top bar */}
        <header
          className="lg:hidden"
          style={{
            display:'flex', alignItems:'center', gap:'12px',
            paddingTop:`calc(env(safe-area-inset-top, 0px) + 10px)`,
            paddingBottom:'10px',
            paddingLeft:'16px',
            paddingRight:'16px',
            background: BG_SIDEBAR,
            borderBottom:`1px solid ${GOLD_DIM}`,
            flexShrink:0,
          }}
        >
          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              background:'transparent', border:`1px solid ${GOLD_DIM}`,
              borderRadius:'6px', padding:'6px 10px', cursor:'pointer',
              color: GOLD, fontSize:'1rem', lineHeight:1,
            }}
          >
            ☰
          </button>

          {/* Logo */}
          <Link to="/"><img src="/logo.png" alt="Khôi Minh" style={{ height:'28px', display:'block' }} /></Link>

          {/* User avatar right */}
          <div style={{ marginLeft:'auto' }}>
            <div style={{
              width:'30px', height:'30px',
              background:'linear-gradient(135deg,#b8922e,#e8c97a)',
              borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'0.75rem', fontWeight:800, color:'#08080e',
              boxShadow:'0 0 8px rgba(201,168,76,0.4)',
            }}>
              {user?.full_name?.[0] || '?'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{
          flex:1, overflowY:'auto',
          paddingBottom:'env(safe-area-inset-bottom, 0px)',
        }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
        /* Tablet / medium phone */
        @media (max-width: 1023px) {
          .card { padding: 1rem !important; }
          table { font-size: 0.8rem !important; }
          table th, table td { padding: 8px 10px !important; }
          h1 { font-size: 1.3rem !important; }
          .p-6 { padding: 1rem !important; }
        }
        /* Remove tap highlight on mobile */
        * { -webkit-tap-highlight-color: transparent; }
        /* Smooth scrolling */
        main { -webkit-overflow-scrolling: touch; }
      `}</style>
    </div>
  );
}
