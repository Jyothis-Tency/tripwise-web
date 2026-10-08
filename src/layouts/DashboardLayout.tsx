import { Outlet, useLocation, Link } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Menu, ChevronRight, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";

const routeTitle: Record<string, string> = {
  "/": "Dashboard",
  "/profile": "Owner Profile",
  "/vehicles": "Trip Details",
  "/create-trip": "Create New Trip",
  "/trips": "Create New Trip",
  "/trip-confirmation": "Trip Confirmation",
  "/trip-confirmation/template": "Confirmation Template",
  "/drivers": "Drivers",
  "/bulk-entry": "Bulk Entry",
  "/expenses": "Expenses",
  "/history": "History",
  "/history/payout": "Agency Payout",
  "/cash-in-cash-out": "Cash In / Cash Out",
  "/transaction": "Transaction",
  "/transaction-history": "Transaction History",
  "/reports": "Reports",
  "/analytics": "Analytics",
  "/pl": "P&L",
  "/reminders": "Reminders",
  "/credit-debit": "Credit / Debit",
  "/tracking": "Tracking",
  "/admin": "Admin",
};

const routeBreadcrumbs: Record<string, { label: string; to?: string }[]> = {
  "/history/payout": [
    { label: "History", to: "/history" },
    { label: "Agency Payout" },
  ],
  "/trip-confirmation/template": [
    { label: "Trip Confirmation", to: "/trip-confirmation" },
    { label: "Template" },
  ],
};

const fullHeightPaths = [
  "/vehicles",
  "/drivers",
  "/tracking",
  "/create-trip",
  "/expenses",
  "/reminders",
  "/bulk-entry",
  "/cash-in-cash-out",
  "/transaction",
  "/transaction-history",
  "/reports",
];

export function DashboardLayout() {
  const { pathname } = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const title = routeTitle[pathname] ?? (user?.name || "Dashboard");
  const isFull = fullHeightPaths.some((p) => pathname.startsWith(p));
  const breadcrumbs = routeBreadcrumbs[pathname];

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const userName = user?.name || "Owner";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative flex h-screen overflow-hidden bg-slate-50 dark:bg-[#07090e]">
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm animate-fade-in lg:hidden dark:bg-black/60"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar — mobile: fixed drawer, desktop: static with collapse */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform bg-[var(--bg-card)] transition-transform duration-200 ease-out dark:bg-[#0b1120] lg:static lg:translate-x-0 ${
          isMobileMenuOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
        }`}
      >
        <Sidebar
          onClose={closeMobileMenu}
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((c) => !c)}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6 dark:border-white/10 dark:bg-[#0c0e15]">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 active:scale-95 lg:hidden dark:text-slate-400 dark:hover:bg-white/5"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              {breadcrumbs ? (
                <nav className="flex items-center gap-1 text-sm">
                  {breadcrumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" />
                      )}
                      {crumb.to ? (
                        <Link
                          to={crumb.to}
                          className="font-medium text-slate-400 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {crumb.label}
                        </span>
                      )}
                    </span>
                  ))}
                </nav>
              ) : (
                <h1 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {title}
                </h1>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <div className="hidden items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 sm:flex dark:border-white/10 dark:bg-white/5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                {initials}
              </span>
              <span className="max-w-[120px] truncate text-sm font-medium text-slate-600 dark:text-slate-300">
                {userName}
              </span>
            </div>
          </div>
        </header>

        {/* Content area */}
        <main
          className={`min-h-0 flex-1 overflow-hidden bg-[var(--bg-main)] ${isFull ? "flex flex-col" : "overflow-y-auto p-4 sm:p-6"}`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
