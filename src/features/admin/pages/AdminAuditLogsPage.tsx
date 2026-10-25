import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Building2,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Link2,
  Loader2,
  Receipt,
  RefreshCw,
  Search,
  Shield,
  User,
  Users,
  X,
} from "lucide-react";
import {
  fetchAdminAuditLogs,
  fetchAdminAuditLogStats,
  type AdminAuditLog,
  type AdminAuditLogStats,
} from "../api";

// Category display mapping with icons and badges
const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  all: { label: "All Categories", icon: FileText, color: "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300" },
  trips: { label: "Trips", icon: Car, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40" },
  agency_trips: { label: "Agency Trips", icon: Building2, color: "text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-400 border border-violet-200/50 dark:border-violet-800/40" },
  expenses: { label: "Expenses", icon: Receipt, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40" },
  payments: { label: "Payments", icon: CreditCard, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40" },
  vehicles: { label: "Vehicles", icon: Car, color: "text-sky-600 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200/50 dark:border-sky-800/40" },
  drivers: { label: "Drivers", icon: Users, color: "text-teal-600 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-400 border border-teal-200/50 dark:border-teal-800/40" },
  agencies: { label: "Agencies", icon: Building2, color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 dark:text-cyan-400 border border-cyan-200/50 dark:border-cyan-800/40" },
  reminders: { label: "Reminders", icon: Bell, color: "text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/50 dark:border-orange-800/40" },
  guest_bulk: { label: "Guest Bulk", icon: Link2, color: "text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/40 dark:text-fuchsia-400 border border-fuchsia-200/50 dark:border-fuchsia-800/40" },
  auth: { label: "Auth & Security", icon: Shield, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40" },
};

function formatRelativeTime(dateString: string): string {
  const d = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function formatExactDateTime(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function AdminAuditLogsPage() {
  // State
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [stats, setStats] = useState<AdminAuditLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [actorType, setActorType] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [datePreset, setDatePreset] = useState("all");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal / Drawer inspection
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Compute date range based on preset
  const dateRange = useMemo(() => {
    const now = new Date();
    if (datePreset === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      return { from: start, to: now.toISOString() };
    }
    if (datePreset === "yesterday") {
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
      const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, -1).toISOString();
      return { from: yesterdayStart, to: yesterdayEnd };
    }
    if (datePreset === "7days") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      return { from: sevenDaysAgo, to: now.toISOString() };
    }
    if (datePreset === "30days") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      return { from: thirtyDaysAgo, to: now.toISOString() };
    }
    return { from: undefined, to: undefined };
  }, [datePreset]);

  // Load stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetchAdminAuditLogStats();
      setStats(res);
    } catch (e: unknown) {
      console.error("Failed to load audit stats:", e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load logs
  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminAuditLogs({
        page,
        limit,
        search: debouncedSearch || undefined,
        category: category !== "all" ? category : undefined,
        actorType: actorType !== "all" ? actorType : undefined,
        severity: severity !== "all" ? severity : undefined,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
      });
      setLogs(res.actions);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.pages);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, category, actorType, severity, dateRange]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  // Export full filtered audit trail to JSON
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `tripwise_audit_logs_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
  };

  // Export full filtered audit trail to CSV
  const handleExportCSV = () => {
    if (!logs.length) return;
    const headers = [
      "ID",
      "Timestamp (ISO)",
      "Timestamp (Local)",
      "Actor Type",
      "Actor Name",
      "Actor Company",
      "Actor Email",
      "Category",
      "Action Type",
      "Severity",
      "Summary",
      "Explanation",
    ];

    const csvRows = [
      headers.join(","),
      ...logs.map((l) =>
        [
          `"${l.id}"`,
          `"${l.timestamp}"`,
          `"${formatExactDateTime(l.timestamp)}"`,
          `"${l.actor.type}"`,
          `"${(l.actor.name || "").replace(/"/g, '""')}"`,
          `"${(l.actor.company || "").replace(/"/g, '""')}"`,
          `"${(l.actor.email || "").replace(/"/g, '""')}"`,
          `"${l.category}"`,
          `"${l.actionType}"`,
          `"${l.severity}"`,
          `"${(l.summary || "").replace(/"/g, '""')}"`,
          `"${(l.explanation || "").replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tripwise_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
    link.click();
  };

  return (
    <div className="min-h-full space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Page Title & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                System Audit Log
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Complete, immutable audit trail of every single action performed by Owners and Drivers
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void loadStats();
              void loadLogs();
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-600/25 transition hover:bg-indigo-500 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Actions</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
            {statsLoading ? "—" : stats?.totalActions.toLocaleString() || "0"}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <Clock className="h-3 w-3" />
            All registered actions
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Actions Today</p>
          <p className="mt-1 text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {statsLoading ? "—" : stats?.actionsToday.toLocaleString() || "0"}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-indigo-600/80 dark:text-indigo-400/80">
            <CheckCircle2 className="h-3 w-3" />
            Last 24 hours
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Owner Actions</p>
          <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {statsLoading ? "—" : stats?.ownerActions.toLocaleString() || "0"}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <Building2 className="h-3 w-3" />
            By business owners
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Driver Actions</p>
          <p className="mt-1 text-2xl font-black text-teal-600 dark:text-teal-400">
            {statsLoading ? "—" : stats?.driverActions.toLocaleString() || "0"}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <Users className="h-3 w-3" />
            By fleet drivers
          </div>
        </div>

        <div className="col-span-2 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:col-span-4 lg:col-span-1 dark:border-slate-800/80 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Latest Event</p>
          <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white">
            {stats?.latestActionTime ? formatRelativeTime(stats.latestActionTime) : "—"}
          </p>
          <p className="mt-1 truncate text-[11px] font-medium text-slate-500">
            {stats?.latestActionTime ? formatExactDateTime(stats.latestActionTime) : "No events recorded"}
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by keywords, owner name, company, driver, vehicle plate, trip #, etc..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-8 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-900"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Secondary Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Actor Type */}
            <select
              value={actorType}
              onChange={(e) => {
                setActorType(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Actors</option>
              <option value="owner">Owners Only</option>
              <option value="driver">Drivers Only</option>
              <option value="admin">Admin / System</option>
            </select>

            {/* Severity */}
            <select
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="danger">Critical / Danger</option>
            </select>

            {/* Date Preset */}
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Category Horizontal Scroll Pills */}
        <div className="mt-3.5 flex items-center gap-1.5 overflow-x-auto border-t border-slate-100 pt-3 dark:border-slate-800/80">
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-400">Category:</span>
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const count = key === "all" ? stats?.totalActions : stats?.categoryBreakdown[key] || 0;
            const isActive = category === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setCategory(key);
                  setPage(1);
                }}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cfg.label}</span>
                {count !== undefined && (
                  <span
                    className={`ml-0.5 rounded-md px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive ? "bg-white/25 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Audit Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="flex h-96 flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Loading synthesized system audit logs...
            </p>
          </div>
        ) : error ? (
          <div className="flex h-96 flex-col items-center justify-center gap-2 text-center p-6">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">Unable to retrieve audit trail</p>
            <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
            <button
              type="button"
              onClick={() => void loadLogs()}
              className="mt-2 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Try Again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex h-96 flex-col items-center justify-center gap-2 text-center p-6">
            <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">No audit records found</p>
            <p className="max-w-md text-xs text-slate-500">
              No system actions matched your current search filters. Try clearing search keywords or choosing "All Categories".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Time</th>
                  <th className="px-4 py-3.5">Actor</th>
                  <th className="px-4 py-3.5">Category & Action</th>
                  <th className="px-4 py-3.5 min-w-[280px]">Summary & Explanation</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {logs.map((log) => {
                  const catCfg = CATEGORY_CONFIG[log.category] || CATEGORY_CONFIG.all;
                  const CatIcon = catCfg.icon;
                  const isOwner = log.actor.type === "owner";
                  const isDriver = log.actor.type === "driver";

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="cursor-pointer transition hover:bg-indigo-50/40 dark:hover:bg-slate-800/50"
                    >
                      {/* Timestamp */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {formatExactDateTime(log.timestamp)}
                        </div>
                        <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(log.timestamp)}
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                              isOwner
                                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                                : isDriver
                                  ? "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                                  : "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                            }`}
                          >
                            {isOwner ? "OW" : isDriver ? "DR" : "AD"}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-bold text-slate-900 dark:text-white">
                                {log.actor.name}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wide ${
                                  isOwner
                                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200/50 dark:bg-indigo-900/30 dark:text-indigo-300"
                                    : isDriver
                                      ? "bg-teal-50 text-teal-700 border border-teal-200/50 dark:bg-teal-900/30 dark:text-teal-300"
                                      : "bg-purple-50 text-purple-700 border border-purple-200/50 dark:bg-purple-900/30 dark:text-purple-300"
                                }`}
                              >
                                {log.actor.type}
                              </span>
                            </div>
                            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {log.actor.company || log.actor.phone || log.actor.email || "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category & Action Type */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1 w-fit rounded-md px-2 py-0.5 text-[10px] font-semibold ${catCfg.color}`}
                          >
                            <CatIcon className="h-3 w-3" />
                            {catCfg.label}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-400">
                            {log.actionType}
                          </span>
                        </div>
                      </td>

                      {/* Summary & Explanation */}
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {log.summary}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                          {log.explanation}
                        </p>
                      </td>

                      {/* Status / Severity */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            log.severity === "success"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : log.severity === "warning"
                                ? "bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300"
                                : log.severity === "danger"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300"
                                  : "bg-sky-50 text-sky-700 border border-sky-200/60 dark:bg-sky-950/40 dark:text-sky-300"
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {log.severity}
                        </span>
                      </td>

                      {/* View Action Details */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && logs.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>
                Showing <strong className="text-slate-900 dark:text-white">{(page - 1) * limit + 1}</strong> to{" "}
                <strong className="text-slate-900 dark:text-white">{Math.min(page * limit, total)}</strong> of{" "}
                <strong className="text-slate-900 dark:text-white">{total.toLocaleString()}</strong> events
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <label className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>

              <span className="px-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold ${
                    selectedLog.severity === "success"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      : selectedLog.severity === "danger"
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                        : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400"
                  }`}
                >
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Audit Action Inspection
                  </h3>
                  <p className="font-mono text-[11px] text-slate-400">
                    ID: {selectedLog.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {/* Summary Banner */}
              <div
                className={`rounded-xl border p-4 ${
                  selectedLog.severity === "success"
                    ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                    : selectedLog.severity === "danger"
                      ? "border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20"
                      : "border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black uppercase text-indigo-700 dark:text-indigo-400">
                    {selectedLog.actionType}
                  </span>
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase shadow-sm dark:bg-slate-800">
                    {selectedLog.severity}
                  </span>
                </div>
                <h4 className="mt-1 text-base font-black text-slate-900 dark:text-white">
                  {selectedLog.summary}
                </h4>
                <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-700 dark:text-slate-300">
                  {selectedLog.explanation}
                </p>
              </div>

              {/* Actor & Time Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Actor Profile</p>
                  <div className="mt-1 flex items-center gap-2">
                    <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-bold text-slate-900 dark:text-white">{selectedLog.actor.name}</span>
                    <span className="rounded bg-indigo-100 px-1 text-[9px] font-bold uppercase text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {selectedLog.actor.type}
                    </span>
                  </div>
                  {selectedLog.actor.company && (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      Company: <strong>{selectedLog.actor.company}</strong>
                    </p>
                  )}
                  {selectedLog.actor.phone && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Phone: <strong>{selectedLog.actor.phone}</strong>
                    </p>
                  )}
                  {selectedLog.actor.email && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Email: <strong>{selectedLog.actor.email}</strong>
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timestamp</p>
                  <p className="mt-1 text-xs font-bold text-slate-900 dark:text-white">
                    {formatExactDateTime(selectedLog.timestamp)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Relative: {formatRelativeTime(selectedLog.timestamp)}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-slate-400 break-all">
                    UTC: {selectedLog.timestamp}
                  </p>
                </div>
              </div>

              {/* Target Resource */}
              {selectedLog.targetId && (
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Entity</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-900 dark:text-white">
                        {selectedLog.targetType || "Resource"}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-slate-500">
                      {selectedLog.targetId}
                    </span>
                  </div>
                </div>
              )}

              {/* Granular Properties Table */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Action Properties & Snapshot
                </p>
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {Object.entries(selectedLog.details || {}).map(([k, v]) => (
                        <tr key={k} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="w-1/3 bg-slate-50/50 px-3.5 py-2 font-mono text-[11px] font-bold text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                            {k}
                          </td>
                          <td className="px-3.5 py-2 text-slate-900 dark:text-slate-100 break-all">
                            {v === null || v === undefined
                              ? "—"
                              : typeof v === "object"
                                ? JSON.stringify(v)
                                : String(v)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 px-6 py-3.5 text-right dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
