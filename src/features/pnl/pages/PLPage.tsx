import React, { useState, useEffect, useCallback } from "react";
import { TrendingUp, RefreshCw, AlertCircle } from "lucide-react";
import { fetchPLData } from "../api";
import type { PLDataResponse } from "../api";
import { RevenueBreakdown } from "../components/RevenueBreakdown";
import { TripStatistics } from "../components/TripStatistics";

export const PLPage: React.FC = () => {
  const [data, setData] = useState<PLDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const result = await fetchPLData("all");
      setData(result);
    } catch (err: any) {
      setError(err.message || "Failed to load P&L data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
            onClick={() => loadData()}
            className="mx-auto mt-6 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in">
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-subtle sm:p-6 dark:border-[#1e2638] dark:bg-[#0e121d]/90 dark:backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-500/25 dark:bg-indigo-500/15 dark:text-indigo-300">
              <TrendingUp className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
                Profit &amp; Loss Statement
              </h1>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                All-time overview
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </section>

      {data && (
        <div className="space-y-6">
          <RevenueBreakdown
            revenue={data.revenue}
            onRefresh={() => loadData(true)}
          />
          <TripStatistics trips={data.trips} />
        </div>
      )}
    </div>
  );
};
