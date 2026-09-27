import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
  FileBarChart,
  Wallet,
  ScrollText,
  X,
  LogOut,
  CirclePlus,
  FileCheck2,
  ChevronsLeft,
  ChevronsRight,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { TripwiseLogo } from "../components/brand/TripwiseLogo";

type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Dispatch & Trips",
    items: [
      { label: "Dashboard", path: "/", icon: LayoutDashboard },
      { label: "Create Trip", path: "/create-trip", icon: CirclePlus },
      { label: "Trip Confirmation", path: "/trip-confirmation", icon: FileCheck2 },
      { label: "Trip Details", path: "/vehicles", icon: Car },
      { label: "Tracking", path: "/tracking", icon: Navigation },
    ],
  },
  {
    title: "Financial & Ledger",
    items: [
      { label: "P&L", path: "/pl", icon: TrendingUp },
      { label: "Expenses", path: "/expenses", icon: Receipt },
      { label: "Transaction", path: "/transaction", icon: Wallet },
      {
        label: "Transaction History",
        path: "/transaction-history",
        icon: ScrollText,
      },
    ],
  },
  {
    title: "Fleet Management",
    items: [
      { label: "Drivers", path: "/drivers", icon: Users },
      { label: "Bulk Entry", path: "/bulk-entry", icon: ListChecks },
      { label: "Reminders", path: "/reminders", icon: Bell },
      { label: "Reports", path: "/reports", icon: FileBarChart },
      { label: "History", path: "/history", icon: History },
    ],
  },
];

interface SidebarProps {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

function isNavActive(pathname: string, path: string) {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function Sidebar({
  onClose,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [navQuery, setNavQuery] = useState("");

  const userName = user?.name || "Owner";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const goProfile = () => {
    navigate("/profile");
    onClose?.();
  };

  const filteredSections = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return navSections;
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          item.label.toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [navQuery]);

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-slate-200 bg-[var(--bg-card)] transition-all duration-200 dark:border-[#1e2638] dark:bg-[#0b1120] ${collapsed ? "w-16" : "w-64"}`}
    >
      {/* Brand */}
      <div
        className={`flex shrink-0 items-center border-b border-slate-100 dark:border-[#1e2638] ${collapsed ? "h-14 justify-center px-2" : "gap-3 px-3.5 py-3.5"}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <TripwiseLogo
            className="h-11 w-11 shrink-0 drop-shadow-[0_0_14px_rgba(99,102,241,0.4)]"
          />
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                Tripwise
              </div>
              <p className="truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">
                Fleet operations
              </p>
            </div>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 lg:hidden dark:hover:bg-white/5 dark:hover:text-slate-200"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav filter — real filter only, no fake ⌘K chrome */}
      {!collapsed && (
        <div className="shrink-0 px-3 pt-3 pb-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Search navigation..."
              className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] py-1.5 pr-3 pl-8 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-[#1e2638] dark:bg-slate-900/60 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500/60 dark:focus:ring-indigo-500/30"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-2">
        {filteredSections.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-400">
            No matching pages
          </p>
        ) : (
          filteredSections.map((section) => (
            <div key={section.title} className="space-y-0.5">
              {!collapsed && (
                <p className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(location.pathname, item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/" || item.path === "/transaction"}
                    className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors duration-150 ${
                      active
                        ? "border border-indigo-500/25 bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-600/10 dark:text-indigo-300"
                        : "border border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white"
                    } ${collapsed ? "justify-center px-0" : ""}`}
                    onClick={onClose}
                    title={collapsed ? item.label : undefined}
                  >
                    {active && !collapsed && (
                      <span
                        className="absolute top-1 bottom-1 left-0 w-1 rounded-r bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.45)]"
                        aria-hidden
                      />
                    )}
                    <Icon
                      className={`h-[18px] w-[18px] shrink-0 ${
                        active
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-slate-400 group-hover:text-indigo-500 dark:text-slate-500 dark:group-hover:text-indigo-400"
                      }`}
                    />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))
        )}
      </nav>

      {/* Collapse — desktop only */}
      {onToggleCollapse && (
        <div className="hidden shrink-0 border-t border-slate-100 px-2 py-2 lg:flex dark:border-[#1e2638]">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600 dark:hover:border-slate-700/60 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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

      {/* User footer */}
      <div className="shrink-0 border-t border-slate-200 p-2.5 dark:border-[#1e2638] dark:bg-slate-900/40">
        {!collapsed ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/60 p-2 dark:border-[#1e2638] dark:from-slate-900 dark:to-indigo-950/40">
            <button
              type="button"
              onClick={goProfile}
              title="View profile"
              className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-0.5 text-left transition-colors ${
                location.pathname === "/profile"
                  ? "ring-1 ring-indigo-400/50"
                  : "hover:opacity-90"
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-500 text-xs font-bold text-white">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {userName}
                </div>
                {user?.email && (
                  <div className="truncate text-[11px] text-slate-400">
                    {user.email}
                  </div>
                )}
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                onClose?.();
              }}
              title="Sign out"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={goProfile}
              title="View profile"
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                location.pathname === "/profile"
                  ? "bg-indigo-600 text-white"
                  : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
              }`}
            >
              {initials}
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                onClose?.();
              }}
              title="Sign out"
              className="flex items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
