import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Car,
  Users,
  Navigation,
  ListChecks,
  Receipt,
  Bell,
  History,
  TrendingUp,
} from 'lucide-react';

const menuItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'P&L', path: '/pl', icon: TrendingUp },
  { label: 'Vehicles', path: '/vehicles', icon: Car },
  { label: 'Tracking', path: '/tracking', icon: Navigation },
  { label: 'Drivers', path: '/drivers', icon: Users },
  { label: 'Expenses', path: '/expenses', icon: Receipt },
  { label: 'Reminders', path: '/reminders', icon: Bell },
  { label: 'Bulk Entry', path: '/bulk-entry', icon: ListChecks },
  { label: 'History', path: '/history', icon: History },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white xl:w-60">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-100 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white">
          <Car className="h-4 w-4" />
        </span>
        <span className="text-sm font-bold text-slate-900">Tripwise</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`}
                  />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
