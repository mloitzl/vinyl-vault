import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { useNotificationCount } from '../hooks/useNotificationCount.js';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    path: '/',
    label: 'Home',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    path: '/scan',
    label: 'Scan',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h2m14 0h2M4 4h4m12 0h2M4 20h4m12 0h2M8 8h.01M16 8h.01M8 16h.01M16 16h.01"
        />
      </svg>
    ),
  },
  {
    path: '/browse',
    label: 'Browse',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 6h16M4 10h16M4 14h16M4 18h16"
        />
      </svg>
    ),
  },
  {
    path: '/search',
    label: 'Search',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    ),
  },
  {
    path: '/social',
    label: 'Friends',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
];

interface DesktopNavigationProps {
  recordCount: number;
  artistCount: number;
}

export function DesktopNavigation({ recordCount, artistCount }: DesktopNavigationProps) {
  const location = useLocation();
  const { activeTenant } = useAuth();
  const notificationCount = useNotificationCount();
  const canMutate = !!activeTenant && activeTenant.role !== 'VIEWER';
  const visibleItems = canMutate ? navItems : navItems.filter((i) => i.path !== '/scan');

  return (
    <aside className="hidden md:flex md:flex-col md:w-56 lg:w-64 border-r border-gray-200 bg-white">
      <nav className="flex-1 p-4 space-y-1">
        {visibleItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);
          const isFriends = item.path === '/social';
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                isActive ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="relative w-5 h-5">
                {item.icon}
                {isFriends && notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </span>
              <span className="font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop sidebar footer with stats */}
      <div className="p-4 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-gray-50 rounded-lg py-2">
            <div className="text-lg font-semibold text-gray-900">{recordCount}</div>
            <div className="text-xs text-gray-500">Records</div>
          </div>
          <div className="bg-gray-50 rounded-lg py-2">
            <div className="text-lg font-semibold text-gray-900">{artistCount}</div>
            <div className="text-xs text-gray-500">Artists</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileNavigation() {
  const location = useLocation();
  const { activeTenant } = useAuth();
  const notificationCount = useNotificationCount();
  const canMutate = !!activeTenant && activeTenant.role !== 'VIEWER';
  const visibleItems = canMutate ? navItems : navItems.filter((i) => i.path !== '/scan');

  return (
    <nav className="sticky bottom-0 bg-white border-t border-gray-200 md:hidden">
      <div className="flex justify-around">
        {visibleItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);
          const isFriends = item.path === '/social';
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex-1 flex flex-col items-center py-2 px-3 ${
                isActive ? 'text-emerald-600' : 'text-gray-400'
              }`}
            >
              <span className="relative">
                {item.icon}
                {isFriends && notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </span>
              <span className="text-xs mt-1">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
