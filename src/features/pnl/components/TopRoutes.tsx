import React from "react";
import { Route as RouteIcon, Trophy } from "lucide-react";
import type { PLRoute } from "../api";

interface TopRoutesProps {
  routes: PLRoute[];
}

export const TopRoutes: React.FC<TopRoutesProps> = ({ routes }) => {
  if (routes.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-subtle sm:p-6 dark:border-[#1e2638] dark:bg-[#0e121d]/90 dark:backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2 sm:mb-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
          <RouteIcon className="h-4 w-4" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg dark:text-white">
          Top Revenue Routes
        </h2>
      </div>

      <div className="space-y-3 sm:space-y-3.5">
        {routes.map((route, index) => (
          <div
            key={route.route}
            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50 sm:gap-4 sm:p-4 dark:border-white/5 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm sm:h-10 sm:w-10 sm:text-base ${
                index === 0
                  ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                  : index === 1
                    ? "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                    : index === 2
                      ? "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400"
                      : "border border-slate-200 bg-white text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-500"
              }`}
            >
              {index === 0 ? (
                <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                index + 1
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="truncate text-xs font-semibold text-slate-900 sm:text-sm dark:text-slate-100">
                {route.route}
              </h4>
              <p className="mb-0.5 truncate text-[10px] font-medium text-indigo-600 sm:text-[11px] dark:text-indigo-400">
                {route.driverName || "Driver N/A"} ·{" "}
                {route.vehicleName || "Vehicle N/A"}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:text-xs dark:text-slate-400">
                {route.trips} {route.trips === 1 ? "trip" : "trips"}
                <span className="hidden sm:inline">
                  {" "}
                  · Avg agency cost: ₹
                  {Math.round(route.avgRevenue).toLocaleString("en-IN")}
                </span>
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="font-mono text-sm font-bold text-emerald-600 metric-tabular sm:text-base dark:text-emerald-400">
                ₹{Math.round(route.profit ?? 0).toLocaleString("en-IN")}
              </p>
              <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400 sm:text-[10px]">
                Profit
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
