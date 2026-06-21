import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { user, can, logout, ROLE_LABELS } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const nav = [
    { to: '/',             icon: '◈', label: 'Dashboard',   always: true },
    { to: '/equipment',    icon: '◧', label: 'Thiết Bị',    always: true },
    { to: '/export',       icon: '↑', label: 'Xuất Kho',    show: can('transact') },
    { to: '/return',       icon: '↓', label: 'Nhập Kho',    show: can('transact') },
    { to: '/events',       icon: '◉', label: 'Sự Kiện',     always: true },
    { to: '/transactions', icon: '≡', label: 'Lịch Sử',     always: true },
    { to: '/reports',      icon: '↗', label: 'Báo Cáo',     always: true },
    { to: '/users',        icon: '◎', label: 'Người Dùng',  show: can('manageUsers') },
  ].filter(item => item.always || item.show);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside style={{ width: '220px', background: 'var(--bg-sidebar)', flexShrink: 0 }}
        className="flex flex-col h-full">

        {/* Logo */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(201,168,76,0.25)' }}>
          <img src="/logo.png" alt="Khôi Minh" className="w-full max-w-[150px]" />
          <div className="mt-2 flex items-center gap-2">
            <div style={{ flex:1, height:'1px', background:'linear-gradient(90deg,rgba(201,168,76,0.6),transparent)' }} />
            <p style={{ color:'#c9a84c', fontSize:'0.6rem', letterSpacing:'0.15em', fontWeight:700 }}>
              QUẢN LÝ KHO
            </p>
            <div style={{ flex:1, height:'1px', background:'linear-gradient(270deg,rgba(201,168,76,0.6),transparent)' }} />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {nav.map((item, idx) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item'}
              style={({ isActive }) => isActive ? {
                display:'flex', alignItems:'center', gap:'12px',
                padding:'10px 20px', fontSize:'0.85rem', fontWeight:700,
                color:'#e8c97a',
                background:'rgba(201,168,76,0.12)',
                borderLeft:'3px solid #c9a84c',
                transition:'all 0.2s',
              } : {
                display:'flex', alignItems:'center', gap:'12px',
                padding:'10px 20px', paddingLeft:'23px', fontSize:'0.85rem',
                color:'#7878a0',
                borderLeft:'3px solid transparent',
                transition:'all 0.2s',
              }}
              onMouseEnter={e => { if (!e.currentTarget.className.includes('active')) { e.currentTarget.style.color='#c9a84c'; e.currentTarget.style.background='rgba(201,168,76,0.06)'; }}}
              onMouseLeave={e => { if (!e.currentTarget.style.borderLeft.includes('#c9a84c')) { e.currentTarget.style.color='#7878a0'; e.currentTarget.style.background='transparent'; }}}
            >
              <span style={{ fontSize:'1rem', fontWeight:400, letterSpacing:0 }}>{item.icon}</span>
              <span style={{ letterSpacing:'0.03em' }}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Gold divider */}
        <div style={{ height:'1px', margin:'0 20px', background:'linear-gradient(90deg,transparent,rgba(201,168,76,0.5),transparent)' }} />

        {/* User section */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className="w-full flex items-center gap-3 text-left transition-all"
            style={{ padding:'12px 20px' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(201,168,76,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            <div style={{
              width:'32px', height:'32px',
              background:'linear-gradient(135deg,#b8922e,#e8c97a)',
              borderRadius:'50%',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'0.8rem', fontWeight:800, color:'#08080e',
              flexShrink:0,
              boxShadow:'0 0 10px rgba(201,168,76,0.4)',
            }}>
              {user?.full_name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize:'0.8rem', fontWeight:600, color:'#eeeef5' }} className="truncate">
                {user?.full_name}
              </p>
              <p style={{ fontSize:'0.7rem', color:'#c9a84c' }} className="truncate">
                {ROLE_LABELS[user?.role] || user?.role}
              </p>
            </div>
            <span style={{ color:'#c9a84c', fontSize:'0.65rem' }}>{showUserMenu ? '▲' : '▼'}</span>
          </button>

          {showUserMenu && (
            <div style={{
              position:'absolute', bottom:'100%', left:0, right:0,
              background:'#13131d',
              border:'1px solid rgba(201,168,76,0.35)',
              borderRadius:'0.5rem 0.5rem 0 0',
              overflow:'hidden',
              boxShadow:'0 -8px 24px rgba(0,0,0,0.5)',
            }}>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 transition-all"
                style={{ padding:'12px 20px', fontSize:'0.85rem', color:'#f87171' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(220,50,50,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
              >
                <span>⬡</span>
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto" style={{ background:'var(--bg-main)' }}>
        <Outlet />
      </main>
    </div>
  );
}
