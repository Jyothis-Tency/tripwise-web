import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import { LogOut, User } from 'lucide-react';

const routeTitle: Record<string, string> = {
  '/': 'Dashboard',
  '/vehicles': 'Vehicles',
  '/drivers': 'Drivers',
  '/trips': 'Trips',
  '/bulk-entry': 'Bulk Entry',
  '/expenses': 'Expenses',
  '/history': 'History',
  '/analytics': 'Analytics',
  '/pl': 'P&L',
  '/reminders': 'Reminders',
  '/credit-debit': 'Credit / Debit',
  '/tracking': 'Tracking',
  '/admin': 'Admin',
};

// Pages that should fill the viewport without padding (two-pane layouts etc.)
const fullHeightPaths = ['/vehicles', '/drivers'];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const title = routeTitle[pathname] ?? 'Tripwise';
  const isFull = fullHeightPaths.some((p) => pathname.startsWith(p));

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <h1 className="text-base font-semibold text-slate-900">{title}</h1>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <User className="h-4 w-4" />
              </span>
              <span className="hidden sm:block">{user?.name ?? user?.email ?? 'Owner'}</span>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              title="Sign out"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:block">Sign out</span>
            </button>
          </div>
        </header>

        {/* Content area */}
        <main className={`flex-1 overflow-hidden ${isFull ? '' : 'overflow-y-auto p-6'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
