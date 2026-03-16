import { useEffect, useState } from 'react';
import type { DashboardData, TripSummary } from '../api';
import { fetchDashboardData } from '../api';
import { useAuth } from '../../../hooks/useAuth';

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
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      {list.length === 0 ? (
        <p className="text-xs text-slate-500">No trips</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs text-slate-700">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-2 py-1.5">Trip</th>
                <th className="px-2 py-1.5">From</th>
                <th className="px-2 py-1.5">To</th>
                <th className="px-2 py-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 5).map((t) => (
                <tr key={t._id} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1.5 text-[11px]">{t.tripNumber ?? '-'}</td>
                  <td className="px-2 py-1.5 text-[11px]">{t.from ?? '-'}</td>
                  <td className="px-2 py-1.5 text-[11px]">{t.to ?? '-'}</td>
                  <td className="px-2 py-1.5 text-[11px] capitalize">{t.status ?? '-'}</td>
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
      <div className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-48 animate-pulse rounded-xl bg-slate-100 md:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
            <span className="text-xl text-indigo-500">📊</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Welcome back{user?.name ? `, ${user.name}` : ''}!
            </h2>
            <p className="text-xs text-slate-500">
              Here&apos;s what&apos;s happening with your fleet today.
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          {new Date().toLocaleString()}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Total Drivers"
          value={Number(drivers.total ?? 0)}
          subtitle={`${drivers.active ?? 0} Active • ${drivers.inactive ?? 0} Inactive`}
        />
        <StatCard
          label="Total Vehicles"
          value={Number(vehicles.total ?? 0)}
          subtitle={`${vehicles.available ?? 0} Available • ${vehicles.onTrip ?? 0} On Trip`}
        />
        <StatCard
          label="Ongoing Trips"
          value={Number(trips.ongoing ?? 0)}
          subtitle={`${trips.completedToday ?? 0} Completed Today`}
        />
        <StatCard
          label="Upcoming Trips"
          value={Number(trips.upcoming ?? 0)}
          subtitle="Scheduled for today / tomorrow"
        />
      </div>

      {/* Earnings summary + trips + alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Earnings summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">Earnings Summary</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <EarningCard label="Today" amount={Number(earnings.today ?? 0)} />
            <EarningCard label="This Week" amount={Number(earnings.thisWeek ?? 0)} />
            <EarningCard label="This Month" amount={Number(earnings.thisMonth ?? 0)} />
          </div>
        </div>

        {/* Trips */}
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            {renderTripsTable('Ongoing Trips', data?.ongoingTrips ?? [])}
            {renderTripsTable('Upcoming Trips', data?.upcomingTrips ?? [])}
          </div>

          {/* Alerts */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Alerts</h3>
            {(data?.alerts ?? []).length === 0 ? (
              <p className="text-xs text-slate-500">No alerts</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-slate-700">
                {(data?.alerts ?? []).slice(0, 5).map((a: any) => (
                  <li key={a._id ?? a.id}>
                    <span className="font-medium">{a.title ?? 'Alert'}: </span>
                    <span className="text-slate-600">{a.message ?? a.description ?? ''}</span>
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

interface StatCardProps {
  label: string;
  value: number;
  subtitle?: string;
}

function StatCard({ label, value, subtitle }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-900">
        {value.toLocaleString()}
      </p>
      {subtitle && (
        <p className="mt-1 text-[11px] text-slate-500">
          {subtitle}
        </p>
      )}
    </div>
  );
}

interface EarningCardProps {
  label: string;
  amount: number;
}

function EarningCard({ label, amount }: EarningCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        ₹{amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}
