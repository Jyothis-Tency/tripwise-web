import React from "react";
import { Route as RouteIcon } from "lucide-react";
import type { PLRoute } from "../api";

interface RecentRoutesTableProps {
  routes: PLRoute[];
}

function fmtCurrency(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function formatTripDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export const RecentRoutesTable: React.FC<RecentRoutesTableProps> = ({
  routes,
}) => {
  const rows = routes ?? [];

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-subtle sm:p-6 dark:border-[#1e2638] dark:bg-[#0e121d]/90 dark:backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2 sm:mb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
          <RouteIcon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg dark:text-white">
            Recent routes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Completed vehicle trips (all time)
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          No trips in this period.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400">
              <tr>
                <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">Date</th>
                <th className="min-w-[10rem] px-3 py-2.5 sm:px-4">Route</th>
                <th className="hidden px-3 py-2.5 md:table-cell sm:px-4">
                  Trip
                </th>
                <th className="hidden px-3 py-2.5 sm:table-cell sm:px-4">
                  Driver
                </th>
                <th className="hidden px-3 py-2.5 lg:table-cell sm:px-4">
                  Vehicle
                </th>
                <th className="hidden px-3 py-2.5 lg:table-cell sm:px-4">
                  Agency
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right sm:px-4">
                  Agency cost
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right sm:px-4">
                  Profit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {rows.map((row) => (
                <tr
                  key={row.id || `${row.route}-${row.tripDate}`}
                  className="bg-white transition-colors hover:bg-slate-50/80 dark:bg-transparent dark:hover:bg-white/[0.03]"
                >
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-600 sm:px-4 dark:text-slate-300">
                    {formatTripDate(row.tripDate)}
                  </td>
                  <td className="max-w-[14rem] px-3 py-3 sm:max-w-none sm:px-4">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {row.route}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500 sm:hidden dark:text-slate-400">
                      {row.driverName || "—"}
                      {row.vehicleName ? ` · ${row.vehicleName}` : ""}
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-600 md:table-cell sm:px-4 dark:text-slate-400">
                    {row.tripNumber || "—"}
                  </td>
                  <td className="hidden max-w-[8rem] truncate px-3 py-3 text-slate-700 sm:table-cell sm:px-4 dark:text-slate-300">
                    {row.driverName || "—"}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-600 lg:table-cell sm:px-4 dark:text-slate-400">
                    {row.vehicleName || "—"}
                  </td>
                  <td className="hidden max-w-[8rem] truncate px-3 py-3 text-slate-600 lg:table-cell sm:px-4 dark:text-slate-400">
                    {row.agencyName || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-slate-800 sm:px-4 dark:text-slate-100">
                    {fmtCurrency(row.revenue)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-emerald-600 sm:px-4 dark:text-emerald-400">
                    {fmtCurrency(row.profit ?? 0)}
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
