import React from "react";
import { Milestone, CheckCircle2, XCircle, Percent } from "lucide-react";
import type { PLTrips } from "../api";

interface TripStatisticsProps {
  trips: PLTrips;
}

const stats = [
  {
    key: "total",
    label: "Total Trips",
    icon: Milestone,
    wrap: "border-indigo-50 bg-indigo-50/30 dark:border-indigo-500/15 dark:bg-indigo-500/10",
    iconWrap: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300",
    value: "text-indigo-700 dark:text-indigo-300",
  },
  {
    key: "completed",
    label: "Completed",
    icon: CheckCircle2,
    wrap: "border-emerald-50 bg-emerald-50/30 dark:border-emerald-500/15 dark:bg-emerald-500/10",
    iconWrap:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-400",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    icon: XCircle,
    wrap: "border-rose-50 bg-rose-50/30 dark:border-rose-500/15 dark:bg-rose-500/10",
    iconWrap: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400",
    value: "text-rose-700 dark:text-rose-400",
  },
  {
    key: "rate",
    label: "Completion Rate",
    icon: Percent,
    wrap: "border-amber-50 bg-amber-50/30 dark:border-amber-500/15 dark:bg-amber-500/10",
    iconWrap: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    value: "text-amber-700 dark:text-amber-400",
  },
] as const;

export const TripStatistics: React.FC<TripStatisticsProps> = ({ trips }) => {
  const values: Record<string, string | number> = {
    total: trips.total,
    completed: trips.completed,
    cancelled: trips.cancelled,
    rate: `${(trips.completionRate ?? 0).toFixed(1)}%`,
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-subtle sm:p-6 dark:border-[#1e2638] dark:bg-[#0e121d]/90 dark:backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2 sm:mb-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
          <Milestone className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg dark:text-white">
          Trip Statistics
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.key}
              className={`rounded-xl border p-3 sm:p-4 ${s.wrap}`}
            >
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${s.iconWrap}`}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-500 sm:text-xs dark:text-slate-400">
                    {s.label}
                  </p>
                  <h4
                    className={`font-mono text-base font-bold leading-tight metric-tabular sm:text-lg ${s.value}`}
                  >
                    {values[s.key]}
                  </h4>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
