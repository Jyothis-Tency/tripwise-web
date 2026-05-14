import { useEffect, useState } from 'react';
import type { DashboardData, TripSummary } from '../api';
import { fetchDashboardData } from '../api';
import { useAuth } from '../../../hooks/useAuth';
import { StatCard } from '../../../components/ui/StatCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';

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
          setError(e?.response?.data?.message || 'Failed to load dashboard');
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

  const renderTripsTable = (title: string, trips: TripSummary[] | any) => {
    const list: TripSummary[] = Array.isArray(trips) ? trips : [];

    return (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden animate-fade-in">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <span className="bg-slate-100 text-slate-500 text-[11px] font-semibold px-2.5 py-1 rounded-full">
            {list.length} Trips
          </span>
        </div>
        {list.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <p className="text-sm">No trips to display</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-600 whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                  <th className="px-5 py-3.5">Trip No.</th>
                  <th className="px-5 py-3.5">Route</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, 5).map((t) => (
                  <tr key={t._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-slate-800">{t.tripNumber ?? '-'}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <span className="truncate max-w-[120px] sm:max-w-[180px] inline-block">{t.from ?? '-'}</span>
                        <span className="text-slate-300">→</span>
                        <span className="truncate max-w-[120px] sm:max-w-[180px] inline-block">{t.to ?? '-'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={t.status ?? '-'} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  if (loading && !data) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-5 w-32 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-10">
      {/* Clean page header — no gradient banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
            Welcome back{user?.name ? `, ${user.name}` : ''}!
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Here&apos;s what&apos;s happening with your fleet today.
          </p>
        </div>
        <div className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-lg self-start sm:self-auto">
          {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {error && <p className="text-xs text-red-600 animate-fade-in">{error}</p>}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 stagger-children">
        <StatCard
          label="Total Drivers"
          value={Number(drivers.total ?? 0)}
          subtitle={`${drivers.active ?? 0} Active • ${drivers.inactive ?? 0} Inactive`}
          icon="👨‍✈️"
        />
        <StatCard
          label="Total Vehicles"
          value={Number(vehicles.total ?? 0)}
          subtitle={`${vehicles.available ?? 0} Available • ${vehicles.onTrip ?? 0} On Trip`}
          icon="🚛"
        />
        <StatCard
          label="Ongoing Trips"
          value={Number(trips.ongoing ?? 0)}
          subtitle={`${trips.completedToday ?? 0} Completed Today`}
          icon="🛣️"
        />
        <StatCard
          label="Upcoming Trips"
          value={Number(trips.upcoming ?? 0)}
          subtitle="Scheduled for today / tomorrow"
          icon="📅"
        />
      </div>

      {/* Main Grid */}
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-3 items-start">
        <div className="space-y-5 sm:space-y-6 lg:col-span-2">
          {renderTripsTable('Ongoing Trips', data?.ongoingTrips ?? [])}
          {renderTripsTable('Upcoming Trips', data?.upcomingTrips ?? [])}
        </div>

        {/* Right Column */}
        <div className="space-y-5 sm:space-y-6 lg:col-span-1">
          {/* Earnings */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 animate-fade-in">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="text-base">💰</span>
              <h3 className="text-sm font-semibold text-slate-800">Earnings Summary</h3>
            </div>
            <div className="flex flex-col gap-3">
              <EarningCard label="Today" amount={Number(earnings.today ?? 0)} highlight />
              <div className="grid grid-cols-2 gap-3">
                <EarningCard label="This Week" amount={Number(earnings.thisWeek ?? 0)} />
                <EarningCard label="This Month" amount={Number(earnings.thisMonth ?? 0)} />
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 animate-fade-in">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="text-base">🚨</span>
              <h3 className="text-sm font-semibold text-slate-800">Alerts</h3>
              <span className="ml-auto bg-red-50 text-red-500 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                {(data?.alerts ?? []).length}
              </span>
            </div>
            {(data?.alerts ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No active alerts</p>
            ) : (
              <ul className="space-y-2">
                {(data?.alerts ?? []).slice(0, 5).map((a: any) => (
                  <li key={a._id ?? a.id} className="flex gap-3 items-start p-3 rounded-lg bg-red-50/50 border border-red-100/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-slate-700 leading-tight mb-0.5">{a.title ?? 'Alert'}</div>
                      <div className="text-xs text-slate-500">{a.message ?? a.description ?? ''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface EarningCardProps {
  label: string;
  amount: number;
  highlight?: boolean;
}

function EarningCard({ label, amount, highlight }: EarningCardProps) {
  if (highlight) {
    return (
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">{label}</p>
        <p className="mt-1.5 text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
          ₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-base sm:text-lg font-bold text-slate-800 tabular-nums">
        ₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}
