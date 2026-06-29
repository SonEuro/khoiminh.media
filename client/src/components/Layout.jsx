import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import {
  CalendarDays, ArrowUpFromLine, ArrowDownToLine,
  ClipboardList, ShieldAlert, History,
  Warehouse, PackagePlus, Users, LogOut, ChevronUp, ChevronDown, Menu, KeyRound,
} from 'lucide-react';

const GOLD         = '#c9a84c';
const GOLD_DIM     = 'rgba(201,168,76,0.3)';
const GOLD_GLOW    = 'rgba(201,168,76,0.08)';
const BG_SIDEBAR   = '#08080e';
const BG_CARD      = '#13131d';
const TEXT_MUTED   = '#c8c8e0';
const TEXT_PRIMARY = '#eeeef5';

function SidebarContent({ nav, user, ROLE_LABELS, can, onNavClick, onLogout, safeLeft = false }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const leftInset = safeLeft ? 'env(safe-area-inset-left, 0px)' : '0px';

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background: BG_SIDEBAR,
      paddingLeft: leftInset }}>

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
            style={{ textDecoration:'none' }}
          >
            {({ isActive }) => (
              <div style={{
                display:'flex', alignItems:'center', gap:'12px',
                padding:'11px 20px',
                paddingLeft: isActive ? '17px' : '20px',
                fontSize:'0.875rem', fontWeight: isActive ? 700 : 400,
                color: isActive ? '#e8c97a' : TEXT_MUTED,
                background: isActive ? 'rgba(201,168,76,0.1)' : 'transparent',
                borderLeft: isActive ? `3px solid ${GOLD}` : '3px solid transparent',
                transition:'all 0.18s',
              }}>
                <item.Icon size={16} strokeWidth={1.75} style={{ flexShrink:0, color: isActive ? '#e8c97a' : GOLD }} />
                <span style={{ letterSpacing:'0.02em', lineHeight: 1.35 }}>
                  {item.label.includes('\n')
                    ? item.label.split('\n').map((line, i) => (
                        <span key={i} style={{ display:'block' }}>{line}</span>
                      ))
                    : item.label}
                </span>
              </div>
            )}
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
            <p style={{ fontSize:'0.72rem', fontWeight:600, color: TEXT_PRIMARY, margin:0, lineHeight:1.35, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user?.full_name}
            </p>
            <p style={{ fontSize:'0.65rem', color: GOLD, margin:'2px 0 0', whiteSpace:'nowrap' }}>
              {ROLE_LABELS[user?.role] || user?.role}
            </p>
          </div>
          {showUserMenu
            ? <ChevronUp size={13} style={{ color: GOLD, flexShrink: 0 }} />
            : <ChevronDown size={13} style={{ color: GOLD, flexShrink: 0 }} />
          }
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
              <LogOut size={15} />
              <span>Đăng xuất</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (next.length < 6) return setErr('Mật khẩu mới phải ít nhất 6 ký tự');
    if (next !== confirm) return setErr('Xác nhận mật khẩu không khớp');
    setLoading(true);
    try {
      await api.changePassword({ current_password: cur, new_password: next });
      setOk(true);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(3px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ background:'#13131d', border:'1px solid rgba(201,168,76,0.3)', borderRadius:'16px', padding:'28px', width:'100%', maxWidth:'380px', boxShadow:'0 20px 60px rgba(0,0,0,0.7)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px' }}>
          <KeyRound size={18} color={GOLD} />
          <h2 style={{ margin:0, fontSize:'1.05rem', fontWeight:700, color: GOLD }}>Đổi mật khẩu</h2>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:'#7878a0', cursor:'pointer', fontSize:'1.3rem', lineHeight:1 }}>×</button>
        </div>
        {ok ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:'2rem', marginBottom:'10px' }}>✅</div>
            <p style={{ color:'#4ade80', fontWeight:600, marginBottom:'16px' }}>Đổi mật khẩu thành công!</p>
            <button onClick={onClose} className="btn-primary" style={{ padding:'10px 28px' }}>Đóng</button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div>
              <label style={{ display:'block', fontSize:'0.72rem', fontWeight:700, color:GOLD, letterSpacing:'0.06em', marginBottom:'5px', textTransform:'uppercase' }}>Mật khẩu hiện tại</label>
              <input type="password" className="input" value={cur} onChange={e => setCur(e.target.value)} placeholder="••••••••" required />
            </div>
            <div>
              <label style={{ display:'block', fontSize:'0.72rem', fontWeight:700, color:GOLD, letterSpacing:'0.06em', marginBottom:'5px', textTransform:'uppercase' }}>Mật khẩu mới</label>
              <input type="password" className="input" value={next} onChange={e => setNext(e.target.value)} placeholder="Tối thiểu 6 ký tự" required />
            </div>
            <div>
              <label style={{ display:'block', fontSize:'0.72rem', fontWeight:700, color:GOLD, letterSpacing:'0.06em', marginBottom:'5px', textTransform:'uppercase' }}>Xác nhận mật khẩu mới</label>
              <input type="password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Nhập lại mật khẩu mới" required />
            </div>
            {err && <div style={{ background:'rgba(248,113,113,0.12)', border:'1px solid rgba(248,113,113,0.35)', borderRadius:'8px', padding:'10px 14px', color:'#f87171', fontSize:'0.85rem' }}>{err}</div>}
            <button type="submit" disabled={loading} className="btn-primary" style={{ padding:'12px', marginTop:'4px' }}>
              {loading ? 'Đang xử lý...' : '🔑 Đổi mật khẩu'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, can, logout, ROLE_LABELS } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [avatarMenu, setAvatarMenu] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const avatarRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const nav = [
    { to: '/events',       Icon: CalendarDays,     label: 'Sự Kiện',              always: true },
    { to: '/export',       Icon: ArrowUpFromLine,  label: 'Xuất Thiết Bị\nSự Kiện',  show: can('transact') },
    { to: '/event-return', Icon: ArrowDownToLine,  label: 'Nhập Thiết Bị\nSự Kiện',  show: can('transact') },
    { to: '/event-report', Icon: ClipboardList,    label: 'Báo Cáo Sự Kiện',       always: true },
    { to: '/violations',   Icon: ShieldAlert,      label: 'Vi Phạm Nội Quy',        always: true },
    { to: '/transactions', Icon: History,          label: 'Lịch Sử Vận Hành', always: true },
    { to: '/equipment',    Icon: Warehouse,        label: 'Tổng Kho Khôi Minh', always: true },
    { to: '/return',       Icon: PackagePlus,      label: 'Nhập Kho Thiết Bị',      show: can('transact') || can('intake') || can('confirmFix') },
    { to: '/users',        Icon: Users,            label: 'Người Dùng',           show: can('manageUsers') },
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
            position:'fixed', inset:0, zIndex:1000,
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
            position:'relative', zIndex:1001,
            width:`calc(240px + env(safe-area-inset-left, 0px))`,
            height:'100%',
            borderRight:`1px solid ${GOLD_DIM}`,
            boxShadow:'4px 0 32px rgba(0,0,0,0.7)',
            animation:'slideIn 0.2s ease',
          }}>
            <SidebarContent
              nav={nav} user={user} ROLE_LABELS={ROLE_LABELS} can={can}
              onNavClick={() => setDrawerOpen(false)}
              onLogout={handleLogout}
              safeLeft
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
            paddingLeft:`calc(env(safe-area-inset-left, 0px) + 16px)`,
            paddingRight:`calc(env(safe-area-inset-right, 0px) + 16px)`,
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
              borderRadius:'9px', padding:'9px 15px', cursor:'pointer',
              color: GOLD, lineHeight:1, display:'flex', alignItems:'center',
            }}
          >
            <Menu size={27} />
          </button>

          {/* Logo */}
          <Link to="/"><img src="/logo.png" alt="Khôi Minh" style={{ height:'42px', display:'block' }} /></Link>

          {/* User avatar right */}
          <div style={{ marginLeft:'auto', position:'relative' }} ref={avatarRef}>
            <button onClick={() => setAvatarMenu(v => !v)}
              style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center' }}>
              <div style={{
                width:'34px', height:'34px',
                background:'linear-gradient(135deg,#b8922e,#e8c97a)',
                borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'0.8rem', fontWeight:800, color:'#08080e',
                boxShadow:'0 0 8px rgba(201,168,76,0.4)',
              }}>
                {user?.full_name?.[0] || '?'}
              </div>
            </button>
            {avatarMenu && (
              <div style={{
                position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:500,
                background:'#13131d', border:'1px solid rgba(201,168,76,0.25)',
                borderRadius:'12px', boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
                minWidth:'180px', overflow:'hidden',
              }}>
                <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
                  <p style={{ margin:0, fontWeight:700, color:'#e8c97a', fontSize:'0.85rem' }}>{user?.full_name}</p>
                  <p style={{ margin:'2px 0 0', fontSize:'0.7rem', color:'#7878a0' }}>{ROLE_LABELS?.[user?.role] || user?.role}</p>
                </div>
                <button onClick={() => { setAvatarMenu(false); setShowChangePw(true); }}
                  style={{ width:'100%', textAlign:'left', padding:'11px 14px', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'9px', color:'#c9c9e8', fontSize:'0.85rem' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(201,168,76,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}>
                  <KeyRound size={15} color={GOLD} /> Đổi mật khẩu
                </button>
                <button onClick={() => { setAvatarMenu(false); handleLogout(); }}
                  style={{ width:'100%', textAlign:'left', padding:'11px 14px', background:'none', border:'none', borderTop:'1px solid rgba(255,255,255,0.06)', cursor:'pointer', display:'flex', alignItems:'center', gap:'9px', color:'#f87171', fontSize:'0.85rem' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(248,113,113,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}>
                  <LogOut size={15} /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{
          flex:1, overflowY:'auto',
          paddingLeft:'env(safe-area-inset-left, 0px)',
          paddingRight:'env(safe-area-inset-right, 0px)',
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

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  );
}
