import { useEffect, useState, type ReactNode } from "react";
import {
  Users,
  Truck,
  Map,
  Clock,
  Calendar,
  IndianRupee,
  Bell,
} from "lucide-react";
import type { DashboardData, TripSummary } from "../api";
import { fetchDashboardData } from "../api";
import { useAuth } from "../../../hooks/useAuth";
import { StatusBadge } from "../../../components/ui/StatusBadge";

type Accent = "indigo" | "emerald" | "sky" | "amber" | "rose";

const accentBar: Record<Accent, string> = {
  indigo: "bg-indigo-600",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  amber: "bg-amber-500",
  rose: "bg-rose-400",
};

const accentIconWrap: Record<Accent, string> = {
  indigo:
    "bg-indigo-50/80 border-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-500/25 dark:text-indigo-400",
  emerald:
    "bg-emerald-50/80 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/25 dark:text-emerald-400",
  sky: "bg-sky-50/80 border-sky-100 text-sky-600 dark:bg-sky-500/10 dark:border-sky-500/25 dark:text-sky-400",
  amber:
    "bg-amber-50/80 border-amber-100 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/25 dark:text-amber-400",
  rose: "bg-rose-50 border-rose-100 text-rose-500 dark:bg-rose-500/10 dark:border-rose-500/25 dark:text-rose-400",
};

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const result = await fetchDashboardData();
        if (mounted) {
          setData(result);
          setError(null);
        }
      } catch (e: any) {
        if (mounted) {
          setError(e?.response?.data?.message || "Failed to load dashboard");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const overview: any = data?.overview ?? {};
  const drivers = (overview.drivers ?? {}) as any;
  const vehicles = (overview.vehicles ?? {}) as any;
  const trips = (overview.trips ?? {}) as any;
  const earnings = (overview.earnings ?? {}) as any;

  const todayAmt = Number(earnings.today ?? 0);
  const weekAmt = Number(earnings.thisWeek ?? 0);
  const monthAmt = Number(earnings.thisMonth ?? 0);
  const alerts = data?.alerts ?? [];

  const dateLabel = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (loading && !data) {
    return (
      <div className="-m-4 min-h-full space-y-5 p-4 sm:-m-6 sm:space-y-6 sm:p-6 dashboard-dot-bg animate-fade-in">
        <div className="h-16 w-full max-w-md animate-pulse rounded-xl bg-slate-200/70 dark:bg-white/5" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-white/5"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 min-h-full space-y-6 p-4 pb-12 sm:-m-6 sm:space-y-7 sm:p-6 dashboard-dot-bg selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-500/30 dark:selection:text-white">
      <header className="flex flex-col gap-4 border-b border-slate-200/60 pb-4 md:flex-row md:items-end md:justify-between animate-fade-in dark:border-white/[0.06]">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Welcome back
            {user?.name ? (
              <>
                ,{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-indigo-700 bg-clip-text text-transparent dark:from-indigo-300 dark:via-indigo-200 dark:to-sky-300">
                  {user.name}
                </span>
                !
              </>
            ) : (
              "!"
            )}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Here&apos;s what&apos;s happening with your fleet today.
          </p>
        </div>

        <div className="inline-flex items-center gap-2.5 self-start rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-subtle dark:border-white/10 dark:bg-white/5 dark:text-slate-300 md:self-auto">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-mono-metric">{dateLabel}</span>
        </div>
      </header>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 animate-fade-in">
          {error}
        </p>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5 stagger-children">
        <KpiCard
          accent="indigo"
          label="Total Drivers"
          value={Number(drivers.total ?? 0)}
          icon={<Users className="h-4 w-4" />}
          footer={
            <>
              <span className="font-mono-metric text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {drivers.active ?? 0} Active
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-mono-metric text-[11px] text-slate-400">
                {drivers.inactive ?? 0} Inactive
              </span>
            </>
          }
        />
        <KpiCard
          accent="emerald"
          label="Total Vehicles"
          value={Number(vehicles.total ?? 0)}
          icon={<Truck className="h-4 w-4" />}
          footer={
            <>
              <span className="font-mono-metric text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {vehicles.available ?? 0} Available
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-mono-metric text-[11px] text-slate-400">
                {vehicles.onTrip ?? 0} On Trip
              </span>
            </>
          }
        />
        <KpiCard
          accent="sky"
          label="Ongoing Trips"
          value={Number(trips.ongoing ?? 0)}
          icon={<Map className="h-4 w-4" />}
          footer={
            <span className="font-mono-metric text-[11px] text-slate-400">
              {trips.completedToday ?? 0} Completed Today
            </span>
          }
        />
        <KpiCard
          accent="amber"
          label="Upcoming Trips"
          value={Number(trips.upcoming ?? 0)}
          icon={<Clock className="h-4 w-4" />}
          footer={
            <span className="font-mono-metric text-[11px] text-slate-400">
              {trips.upcoming ?? 0} Scheduled
            </span>
          }
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <TripsPanel
            title="Ongoing Trips"
            dotClass="bg-sky-500"
            trips={data?.ongoingTrips ?? []}
          />
          <TripsPanel
            title="Upcoming Trips"
            dotClass="bg-amber-500"
            trips={data?.upcomingTrips ?? []}
          />
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-subtle animate-fade-in dark:border-white/10 dark:bg-[#0e111a]/72 dark:backdrop-blur-xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-amber-500" />
            <div className="mb-5 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200/60 bg-amber-50 text-amber-600 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400">
                <IndianRupee className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Earnings Summary
              </h2>
            </div>

            <div className="mb-3.5 rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-white p-4 dark:border-white/10 dark:from-white/5 dark:to-transparent">
              <span className="font-mono-metric text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Today
              </span>
              <div className="mt-1 font-sans text-3xl font-extrabold text-slate-900 metric-tabular dark:text-white">
                ₹{todayAmt.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <EarnMini label="This Week" amount={weekAmt} />
              <EarnMini label="This Month" amount={monthAmt} />
            </div>
          </section>

          <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-subtle animate-fade-in dark:border-white/10 dark:bg-[#0e111a]/72 dark:backdrop-blur-xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-rose-400" />
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-400">
                  <Bell className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  Alerts
                </h2>
              </div>
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border border-rose-200/70 bg-rose-50 px-1.5 font-mono-metric text-[11px] font-bold text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                {alerts.length}
              </span>
            </div>

            {alerts.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                No active alerts
              </p>
            ) : (
              <ul className="space-y-2">
                {alerts.slice(0, 5).map((a: any) => (
                  <li
                    key={a._id ?? a.id}
                    className="flex items-start gap-3 rounded-xl border border-rose-100/60 bg-rose-50/40 p-3 dark:border-rose-500/20 dark:bg-rose-500/10"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                    <div>
                      <div className="mb-0.5 text-sm font-medium leading-tight text-slate-700 dark:text-slate-200">
                        {a.title ?? "Alert"}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {a.message ?? a.description ?? ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function KpiCard({
  accent,
  label,
  value,
  icon,
  footer,
}: {
  accent: Accent;
  label: string;
  value: number;
  icon: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-subtle transition-all duration-300 hover:-translate-y-0.5 hover:shadow-float dark:border-white/10 dark:bg-[#0e111a]/65 dark:backdrop-blur-xl dark:hover:border-white/15 dark:hover:bg-[#141826]/85">
      <div className={`absolute inset-x-0 top-0 h-1 ${accentBar[accent]}`} />
      <div className="mb-3.5 flex items-center justify-between">
        <span className="font-mono-metric text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-transform duration-300 group-hover:scale-105 ${accentIconWrap[accent]}`}
        >
          {icon}
        </div>
      </div>
      <div className="font-sans text-3xl font-extrabold tracking-tight text-slate-900 metric-tabular dark:text-white">
        {value.toLocaleString()}
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-slate-100/90 pt-3 text-xs font-medium text-slate-500 dark:border-white/10">
        {footer}
      </div>
    </div>
  );
}

function EarnMini({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-white/10 dark:bg-white/5">
      <span className="font-mono-metric text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <div className="mt-1 font-sans text-xl font-bold text-slate-800 metric-tabular dark:text-slate-100">
        ₹{amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
      </div>
    </div>
  );
}

function TripsPanel({
  title,
  dotClass,
  trips,
}: {
  title: string;
  dotClass: string;
  trips: TripSummary[] | any;
}) {
  const list: TripSummary[] = Array.isArray(trips) ? trips : [];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-subtle animate-fade-in dark:border-white/10 dark:bg-[#0e111a]/72 dark:backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6 dark:border-white/10 dark:bg-transparent">
        <div className="flex items-center gap-2.5">
          <div className={`h-2 w-2 rounded-full ${dotClass}`} />
          <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
        </div>
        <span className="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 font-mono-metric text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          {list.length}
        </span>
      </div>

      {list.length === 0 ? (
        <p className="px-6 py-14 text-center text-sm text-slate-400">
          No trips to display
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full whitespace-nowrap text-left text-sm text-slate-600 dark:text-slate-300">
            <thead>
              <tr className="border-b border-slate-100 font-mono-metric text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:border-white/10">
                <th className="px-5 py-3.5 sm:px-6">Trip No.</th>
                <th className="px-5 py-3.5 sm:px-6">Route</th>
                <th className="px-5 py-3.5 sm:px-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 5).map((t) => (
                <tr
                  key={t._id}
                  className="border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/60 dark:border-white/5 dark:hover:bg-white/5"
                >
                  <td className="px-5 py-4 font-semibold text-slate-800 sm:px-6 dark:text-slate-100">
                    {t.tripNumber ?? "-"}
                  </td>
                  <td className="px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <span className="inline-block max-w-[120px] truncate sm:max-w-[180px]">
                        {t.from ?? "-"}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">
                        →
                      </span>
                      <span className="inline-block max-w-[120px] truncate sm:max-w-[180px]">
                        {t.to ?? "-"}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 sm:px-6">
                    <StatusBadge status={t.status ?? "-"} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
