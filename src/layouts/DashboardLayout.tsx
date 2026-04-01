import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

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
const fullHeightPaths = ['/vehicles', '/drivers', '/tracking'];

export function DashboardLayout() {
  const { pathname } = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  const title = routeTitle[pathname] ?? (user?.name || 'Dashboard');
  const isFull = fullHeightPaths.some((p) => pathname.startsWith(p));

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar - fixed and z-50 on mobile, static on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={closeMobileMenu} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base font-semibold text-slate-900 truncate">{title}</h1>
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
