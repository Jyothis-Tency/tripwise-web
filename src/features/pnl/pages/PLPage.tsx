import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  Calendar,
  Filter,
  X,
  RefreshCw,
  AlertCircle,
  Clock,
} from "lucide-react";
import { fetchPLData } from "../api";
import type { PLDataResponse } from "../api";
import { RevenueBreakdown } from "../components/RevenueBreakdown";
import { TripStatistics } from "../components/TripStatistics";
import { TopRoutes } from "../components/TopRoutes";

type PeriodPreset = "today" | "week" | "month" | "all" | "custom";

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

const dateInputCls =
  "w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 sm:w-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-indigo-400";

export const PLPage: React.FC = () => {
  const [data, setData] = useState<PLDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [filterText, setFilterText] = useState("All Time");
  const [preset, setPreset] = useState<PeriodPreset>("all");

  const loadData = useCallback(
    async (sd: string = startDate, ed: string = endDate, isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        setError(null);

        const period = !sd && !ed ? "all" : undefined;
        const result = await fetchPLData(period, sd, ed);
        setData(result);

        if (sd && ed) {
          setFilterText(`${sd} to ${ed}`);
        } else if (sd) {
          setFilterText(`From ${sd}`);
        } else if (ed) {
          setFilterText(`Until ${ed}`);
        } else {
          setFilterText("All Time");
        }

        setIsFilterApplied(!!(sd || ed));
      } catch (err: any) {
        setError(err.message || "Failed to load P&L data");
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate],
  );

  useEffect(() => {
    loadData("", "");
  }, []);

  const applyPreset = (p: PeriodPreset) => {
    setPreset(p);
    const today = new Date();
    if (p === "all") {
      setStartDate("");
      setEndDate("");
      loadData("", "");
      return;
    }
    if (p === "today") {
      const d = toDateInput(today);
      setStartDate(d);
      setEndDate(d);
      loadData(d, d);
      return;
    }
    if (p === "week") {
      const s = toDateInput(startOfWeek(today));
      const e = toDateInput(today);
      setStartDate(s);
      setEndDate(e);
      loadData(s, e);
      return;
    }
    if (p === "month") {
      const s = toDateInput(startOfMonth(today));
      const e = toDateInput(today);
      setStartDate(s);
      setEndDate(e);
      loadData(s, e);
    }
  };

  const handleApplyFilter = () => {
    setPreset("custom");
    loadData();
  };

  const handleClearFilter = () => {
    setPreset("all");
    setStartDate("");
    setEndDate("");
    loadData("", "");
  };

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Loading P&L data…
          </p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <AlertCircle className="mx-auto h-12 w-12 text-rose-400" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
            Failed to load P&L data
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {error}
          </p>
          <button
            type="button"
            onClick={() => loadData("", "")}
            className="mx-auto mt-6 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const presetBtn = (id: PeriodPreset, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => applyPreset(id)}
      className={`rounded-md px-2.5 py-0.5 text-xs font-medium transition ${
        preset === id
          ? "bg-white font-semibold text-indigo-600 shadow-xs dark:bg-[#1e2638] dark:text-indigo-300"
          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in">
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-subtle sm:p-6 dark:border-[#1e2638] dark:bg-[#0e121d]/90 dark:backdrop-blur-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4 sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-500/25 dark:bg-indigo-500/15 dark:text-indigo-300">
              <TrendingUp className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
                Profit &amp; Loss Statement
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Clock className="mr-1 h-3.5 w-3.5 text-slate-400" />
                  Period:
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                    isFilterApplied
                      ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300"
                      : "border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
                  }`}
                >
                  {filterText}
                </span>
                <div className="hidden items-center rounded-lg border border-slate-200/60 bg-slate-100/70 p-0.5 sm:inline-flex dark:border-white/10 dark:bg-white/5">
                  {presetBtn("today", "Today")}
                  {presetBtn("week", "This Week")}
                  {presetBtn("month", "This Month")}
                  {presetBtn("all", "All Time")}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-5 lg:border-none lg:pt-0 dark:border-white/10">
            <div className="flex w-full gap-1.5 sm:hidden">
              {(
                [
                  ["today", "Today"],
                  ["week", "Week"],
                  ["month", "Month"],
                  ["all", "All"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyPreset(id)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
                    preset === id
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300"
                      : "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-auto">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setPreset("custom");
                    setStartDate(e.target.value);
                  }}
                  className={dateInputCls}
                />
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                End Date
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setPreset("custom");
                    setEndDate(e.target.value);
                  }}
                  className={dateInputCls}
                />
              </div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <button
                type="button"
                onClick={handleApplyFilter}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 sm:flex-none dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                <Filter className="h-3.5 w-3.5" />
                Apply
              </button>
              {isFilterApplied && (
                <button
                  type="button"
                  onClick={handleClearFilter}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:flex-none dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {data && (
        <div className="space-y-6">
          <RevenueBreakdown
            revenue={data.revenue}
            summary={data.summary}
            onRefresh={() => loadData(startDate, endDate, true)}
          />
          <TripStatistics trips={data.trips} />
          <TopRoutes routes={data.topRoutes} />
        </div>
      )}
    </div>
  );
};
