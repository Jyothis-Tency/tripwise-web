import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ScrollText, Users } from "lucide-react";
import {
  fetchAdminAuditLogStats,
  fetchAdminDashboardStats,
  fetchAdminDrivers,
  fetchAdminOwners,
} from "../api";

export function AdminOverviewPage() {
  const [stats, setStats] = useState({
    owners: 0,
    drivers: 0,
    vehicles: 0,
    trips: 0,
    auditLogs: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [dash, owners, drivers, audit] = await Promise.all([
          fetchAdminDashboardStats(),
          fetchAdminOwners({ page: 1, limit: 1 }),
          fetchAdminDrivers({ page: 1, limit: 1 }),
          fetchAdminAuditLogStats().catch(() => null),
        ]);
        if (cancelled) return;
        setStats({
          owners:
            Number(dash.totalOwners) ||
            owners.pagination.total ||
            0,
          drivers:
            Number(dash.totalDrivers) ||
            drivers.pagination.total ||
            0,
          vehicles: Number(dash.totalVehicles) || 0,
          trips: Number(dash.totalTrips) || 0,
          auditLogs: audit ? audit.totalActions : 0,
        });
      } catch {
        if (!cancelled) setStats({ owners: 0, drivers: 0, vehicles: 0, trips: 0, auditLogs: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    {
      label: "Owners",
      value: stats.owners,
      to: "/admin/owners",
      icon: Building2,
    },
    {
      label: "Drivers",
      value: stats.drivers,
      to: "/admin/drivers",
      icon: Users,
    },
    {
      label: "Audit Logs",
      value: stats.auditLogs,
      to: "/admin/audit-logs",
      icon: ScrollText,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 sm:p-8">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
          Overview
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage owner and driver accounts across TripWise.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, to, icon: Icon }) => (
          <Link
            key={label}
            to={to}
            className="rounded-2xl border border-slate-200 bg-[var(--bg-card)] p-5 shadow-sm transition hover:border-indigo-300 dark:border-[#1e2638] dark:hover:border-indigo-500/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {label}
                </p>
                <p className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                  {loading ? "…" : value}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {(stats.vehicles > 0 || stats.trips > 0) && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Fleet snapshot: {stats.vehicles} vehicles · {stats.trips} trips
        </p>
      )}
    </div>
  );
}
