import { NavLink, Outlet } from 'react-router-dom';

const nav = [
  { to: '/',            icon: '📊', label: 'Dashboard' },
  { to: '/equipment',   icon: '📦', label: 'Thiết Bị' },
  { to: '/export',      icon: '⬆️',  label: 'Xuất Kho' },
  { to: '/return',      icon: '⬇️',  label: 'Nhập Kho' },
  { to: '/events',      icon: '🎭',  label: 'Sự Kiện' },
  { to: '/transactions',icon: '📋',  label: 'Lịch Sử' },
  { to: '/reports',     icon: '📈',  label: 'Báo Cáo' },
];

export default function Layout() {
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
        <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
          v1.0.0 · 2025
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
