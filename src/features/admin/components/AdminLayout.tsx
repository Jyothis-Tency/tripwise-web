import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
  Users,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { useTheme } from "../../../hooks/useTheme";
import { TripwiseLogo } from "../../../components/brand/TripwiseLogo";

const nav = [
  { to: "/admin", end: true, label: "Overview", icon: LayoutDashboard },
  { to: "/admin/owners", end: false, label: "Owners", icon: Building2 },
  { to: "/admin/drivers", end: false, label: "Drivers", icon: Users },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-main)]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-[var(--bg-card)] dark:border-[#1e2638]">
        <div className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-4 dark:border-[#1e2638]">
          <TripwiseLogo variant="auto" className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
              TripWise
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              Control
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 p-2">
          {nav.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3 dark:border-[#1e2638]">
          <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
            {user?.name || "Admin"}
          </p>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {user?.email}
          </p>
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-8 flex-1 items-center justify-center rounded-lg border border-slate-200 text-slate-500 dark:border-[#1e2638] dark:text-slate-400"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 text-xs font-semibold text-rose-600 dark:border-[#1e2638] dark:text-rose-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              Out
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
