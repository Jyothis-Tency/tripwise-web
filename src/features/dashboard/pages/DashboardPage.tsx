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
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          <span className="bg-white border border-slate-200 text-slate-600 text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
            {list.length} Trips
          </span>
        </div>
        {list.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <p className="text-sm font-medium">No trips to display</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs text-slate-700 whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="px-4 py-3">Trip No.</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, 5).map((t) => {
                  const status = (t.status || '').toLowerCase();
                  let statusColor = 'bg-slate-100 text-slate-600';
                  if (status === 'ongoing' || status === 'active') statusColor = 'bg-blue-100 text-blue-700';
                  if (status === 'upcoming' || status === 'scheduled') statusColor = 'bg-purple-100 text-purple-700';
                  if (status === 'completed' || status === 'done') statusColor = 'bg-emerald-100 text-emerald-700';
                  
                  return (
                    <tr key={t._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-slate-800">{t.tripNumber ?? '-'}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-medium text-slate-600">
                          <span className="truncate max-w-[100px] sm:max-w-[150px] inline-block">{t.from ?? '-'}</span>
                          <span className="text-slate-300">→</span>
                          <span className="truncate max-w-[100px] sm:max-w-[150px] inline-block">{t.to ?? '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold capitalize tracking-wide ${statusColor}`}>
                          {t.status ?? '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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
    <div className="space-y-6 sm:space-y-8 pb-10">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-800 px-6 py-8 sm:px-8 sm:py-10 shadow-lg relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="flex items-center gap-5 relative z-10">
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner border border-white/10">
            <span className="text-2xl sm:text-3xl">👋</span>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Welcome back{user?.name ? `, ${user.name}` : ''}!
            </h2>
            <p className="text-sm text-indigo-100 mt-1 font-medium">
              Here&apos;s what&apos;s happening with your fleet today.
            </p>
          </div>
        </div>
        <div className="text-xs sm:text-sm text-indigo-800 font-bold bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl self-start sm:self-auto shadow-sm relative z-10">
          {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Drivers"
          value={Number(drivers.total ?? 0)}
          subtitle={`${drivers.active ?? 0} Active • ${drivers.inactive ?? 0} Inactive`}
          icon="👨‍✈️"
          colorTheme="indigo"
        />
        <StatCard
          label="Total Vehicles"
          value={Number(vehicles.total ?? 0)}
          subtitle={`${vehicles.available ?? 0} Available • ${vehicles.onTrip ?? 0} On Trip`}
          icon="🚛"
          colorTheme="emerald"
        />
        <StatCard
          label="Ongoing Trips"
          value={Number(trips.ongoing ?? 0)}
          subtitle={`${trips.completedToday ?? 0} Completed Today`}
          icon="🛣️"
          colorTheme="amber"
        />
        <StatCard
          label="Upcoming Trips"
          value={Number(trips.upcoming ?? 0)}
          subtitle="Scheduled for today / tomorrow"
          icon="📅"
          colorTheme="purple"
        />
      </div>

      {/* Main Grid: Trips (Left) and Earnings/Alerts (Right) */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Left Column: Trips */}
        <div className="space-y-6 lg:col-span-2">
          {renderTripsTable('Ongoing Trips', data?.ongoingTrips ?? [])}
          {renderTripsTable('Upcoming Trips', data?.upcomingTrips ?? [])}
        </div>

        {/* Right Column: Earnings & Alerts */}
        <div className="space-y-6 lg:col-span-1">
          {/* Earnings summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 text-sm">💰</span>
              <h3 className="text-base font-bold text-slate-800">Earnings Summary</h3>
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
          <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
            <div className="mb-4 flex items-center gap-2.5 relative z-10">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-100 text-rose-600 text-sm animate-pulse">🚨</span>
              <h3 className="text-base font-bold text-slate-800">Alerts</h3>
              <span className="ml-auto bg-rose-100 text-rose-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {(data?.alerts ?? []).length}
              </span>
            </div>
            {(data?.alerts ?? []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No active alerts</p>
            ) : (
              <ul className="space-y-2.5 relative z-10">
                {(data?.alerts ?? []).slice(0, 5).map((a: any) => (
                  <li key={a._id ?? a.id} className="flex gap-3 items-start p-3 rounded-xl bg-rose-50 border border-rose-100/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-slate-800 leading-tight mb-0.5">{a.title ?? 'Alert'}</div>
                      <div className="text-xs text-rose-600 font-medium">{a.message ?? a.description ?? ''}</div>
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

interface StatCardProps {
  label: string;
  value: number;
  subtitle?: string;
  icon: string;
  colorTheme: 'indigo' | 'emerald' | 'amber' | 'purple';
}

function StatCard({ label, value, subtitle, icon, colorTheme }: StatCardProps) {
  const themeStyles = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 group">
      <div className="flex justify-between items-start mb-3 sm:mb-4">
        <p className="text-xs sm:text-sm font-bold text-slate-500">
          {label}
        </p>
        <span className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-[15px] sm:text-lg transition-transform group-hover:scale-110 ${themeStyles[colorTheme]}`}>
          {icon}
        </span>
      </div>
      <p className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
        {value.toLocaleString()}
      </p>
      {subtitle && (
        <p className="mt-1.5 text-xs font-semibold text-slate-400">
          {subtitle}
        </p>
      )}
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
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 bottom-0 text-6xl opacity-10 translate-x-2 translate-y-2 pointer-events-none">₹</div>
        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">{label}</p>
        <p className="mt-1.5 text-2xl font-black text-emerald-900">
          ₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
      <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-base sm:text-lg font-bold text-slate-800">
        ₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}
