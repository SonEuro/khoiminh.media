import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { user, can, logout, ROLE_LABELS } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const nav = [
    { to: '/',             icon: '📊', label: 'Dashboard',  always: true },
    { to: '/equipment',    icon: '📦', label: 'Thiết Bị',   always: true },
    { to: '/export',       icon: '⬆️',  label: 'Xuất Kho',  show: can('transact') },
    { to: '/return',       icon: '⬇️',  label: 'Nhập Kho',  show: can('transact') },
    { to: '/events',       icon: '🎭',  label: 'Sự Kiện',   always: true },
    { to: '/transactions', icon: '📋',  label: 'Lịch Sử',   always: true },
    { to: '/reports',      icon: '📈',  label: 'Báo Cáo',   always: true },
    { to: '/users',        icon: '👥',  label: 'Người Dùng', show: can('manageUsers') },
  ].filter(item => item.always || item.show);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-white flex flex-col flex-shrink-0">
        <div className="px-4 py-3 border-b border-gray-700">
          <img src="/logo.png" alt="Khôi Minh" className="w-full max-w-[160px]" />
          <p className="text-xs text-gray-400 mt-1">Quản Lý Kho</p>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-gray-700 relative">
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors text-left"
          >
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              {user?.full_name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-400 truncate">{ROLE_LABELS[user?.role] || user?.role}</p>
            </div>
            <span className="text-gray-500 text-xs">{showUserMenu ? '▲' : '▼'}</span>
          </button>

          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 bg-gray-800 border border-gray-700 rounded-t-lg overflow-hidden shadow-lg">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-gray-700 transition-colors"
              >
                <span>🚪</span>
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
