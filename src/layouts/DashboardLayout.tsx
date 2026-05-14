import { Outlet, useLocation, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Menu, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const routeTitle: Record<string, string> = {
  '/': 'Dashboard',
  '/vehicles': 'Trip Details',
  '/create-trip': 'Create New Trip',
  '/trips': 'Create New Trip',
  '/drivers': 'Drivers',
  '/bulk-entry': 'Bulk Entry',
  '/expenses': 'Expenses',
  '/history': 'History',
  '/history/payout': 'Agency Payout',
  '/analytics': 'Analytics',
  '/pl': 'P&L',
  '/reminders': 'Reminders',
  '/credit-debit': 'Credit / Debit',
  '/tracking': 'Tracking',
  '/admin': 'Admin',
};

const routeBreadcrumbs: Record<string, { label: string; to?: string }[]> = {
  '/history/payout': [
    { label: 'History', to: '/history' },
    { label: 'Agency Payout' },
  ],
};

const fullHeightPaths = ['/vehicles', '/drivers', '/tracking', '/create-trip', '/expenses'];

export function DashboardLayout() {
  const { pathname } = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { user } = useAuth();

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const title = routeTitle[pathname] ?? (user?.name || 'Dashboard');
  const isFull = fullHeightPaths.some((p) => pathname.startsWith(p));
  const breadcrumbs = routeBreadcrumbs[pathname];

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const userName = user?.name || 'Owner';
  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar — mobile: fixed drawer, desktop: static with collapse */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform bg-white transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        }`}
      >
        <Sidebar
          onClose={closeMobileMenu}
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(c => !c)}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden flex items-center justify-center h-9 w-9 -ml-1 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors active:scale-95"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            <div className="min-w-0">
              {breadcrumbs ? (
                <nav className="flex items-center gap-1 text-sm">
                  {breadcrumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />}
                      {crumb.to ? (
                        <Link to={crumb.to} className="text-slate-400 hover:text-blue-600 font-medium transition-colors">
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="text-slate-800 font-semibold">{crumb.label}</span>
                      )}
                    </span>
                  ))}
                </nav>
              ) : (
                <h1 className="text-sm font-semibold text-slate-800 truncate">{title}</h1>
              )}
            </div>
          </div>

          {/* Right side: User */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-[11px] font-bold">
                {initials}
              </span>
              <span className="text-sm font-medium text-slate-600 max-w-[120px] truncate">
                {userName}
              </span>
            </div>
          </div>
        </header>

        {/* Content area */}
        <main className={`flex-1 overflow-hidden ${isFull ? '' : 'overflow-y-auto p-4 sm:p-6'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
