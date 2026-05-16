import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Car,
  Users,
  Navigation,
  ListChecks,
  Receipt,
  Bell,
  History,
  ArrowRightLeft,
  TrendingUp,
  X,
  LogOut,
  CirclePlus,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const menuItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Create Trip', path: '/create-trip', icon: CirclePlus },
  { label: 'P&L', path: '/pl', icon: TrendingUp },
  { label: 'Trip Details', path: '/vehicles', icon: Car },
  { label: 'Tracking', path: '/tracking', icon: Navigation },
  { label: 'Drivers', path: '/drivers', icon: Users },
  { label: 'Expenses', path: '/expenses', icon: Receipt },
  { label: 'Reminders', path: '/reminders', icon: Bell },
  { label: 'Bulk Entry', path: '/bulk-entry', icon: ListChecks },
  { label: 'Cash In / Cash Out', path: '/cash-in-cash-out', icon: ArrowRightLeft },
  { label: 'History', path: '/history', icon: History },
];

interface SidebarProps {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const userName = user?.name || 'Owner';
  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  
  return (
    <aside className={`flex h-full shrink-0 flex-col bg-white border-r border-slate-200 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
      {/* Logo Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-100 px-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Car className="h-4 w-4" />
          </span>
          {!collapsed && (
            <span className="text-sm font-bold text-slate-900 truncate">Tripwise</span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === '/' 
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={`group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              } ${collapsed ? 'justify-center px-0' : ''}`}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 ${
                  isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500'
                }`}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse Toggle — desktop only */}
      {onToggleCollapse && (
        <div className="hidden lg:flex border-t border-slate-100 px-2 py-2 shrink-0">
          <button
            onClick={onToggleCollapse}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* User Footer */}
      <div className="border-t border-slate-200 p-2 shrink-0">
        <div className={`flex items-center gap-2.5 rounded-lg p-2 ${collapsed ? 'justify-center' : ''}`}>
          {!collapsed ? (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-xs font-bold">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-700">{userName}</div>
                {user?.email && (
                  <div className="truncate text-[11px] text-slate-400">{user.email}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => { logout(); onClose?.(); }}
                title="Sign out"
                className="flex shrink-0 items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { logout(); onClose?.(); }}
              title="Sign out"
              className="flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
