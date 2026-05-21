import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileDown,
  Play,
  RefreshCw,
  Save,
  Trash2,
  Search,
  Columns3,
  Filter,
  AlertCircle,
  Bookmark,
} from "lucide-react";
import {
  fetchReportsCatalog,
  runReport,
  type ReportCatalog,
  type ReportColumnDef,
  type ReportFilters,
  type ReportPreset,
  type ReportRunConfig,
  type ReportRunResult,
} from "../api";
import { downloadReportCsv } from "../exportCsv";
import {
  loadSavedReports,
  upsertSavedReport,
  deleteSavedReport,
  type SavedReport,
} from "../reportStorage";
import { fetchAgencies, type Agency } from "../../bulk-entry/api";
import { fetchDrivers, type Driver } from "../../drivers/api";
import { fetchVehicles, type Vehicle } from "../../vehicles/api";

function fmtCurrency(v: number): string {
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatCell(
  value: unknown,
  type: "text" | "date" | "currency" | "number",
): string {
  if (value == null || value === "") return "—";
  if (type === "currency") {
    const n = Number(value);
    return Number.isFinite(n) ? fmtCurrency(n) : String(value);
  }
  if (type === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString("en-IN") : String(value);
  }
  if (type === "date" && typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }
  return String(value);
}

function monthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [
    { value: "", label: "No month filter" },
  ];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-IN", { month: "long", year: "numeric" });
    opts.push({ value, label });
  }
  return opts;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In progress" },
  { value: "scheduled", label: "Scheduled" },
  { value: "cancelled", label: "Cancelled" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "unpaid", label: "Unpaid" },
];

const PAYMENT_TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "agency_receipt", label: "Agency receipt (bulk)" },
  { value: "agency_receipt_main", label: "Agency receipt (main trip)" },
  { value: "agency_profit_payout", label: "Agency profit payout" },
  { value: "driver_payout", label: "Driver payout" },
  { value: "trip_payment", label: "Trip payment" },
];

const SALARY_TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "salary", label: "Salary (bata)" },
  { value: "advance", label: "Advance" },
];

function defaultColumns(defs: ReportColumnDef[]): string[] {
  return defs.filter((c) => c.default).map((c) => c.id);
}

function defaultSortForSource(sourceId: string): string {
  const map: Record<string, string> = {
    vehicle_trips: "tripDate",
    bulk_trips: "tripDate",
    payments: "paymentDate",
    driver_salary: "date",
    trip_expenses: "tripDate",
    standalone_expenses: "date",
  };
  return map[sourceId] ?? "tripDate";
}

export function ReportsPage() {
  const [catalog, setCatalog] = useState<ReportCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [dataSource, setDataSource] = useState("vehicle_trips");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<ReportFilters>({ status: "all" });
  const [sortBy, setSortBy] = useState("tripDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [result, setResult] = useState<ReportRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const [saved, setSaved] = useState<SavedReport[]>(() => loadSavedReports());
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const columnDefs = catalog?.columns[dataSource] ?? [];
  const sourceMeta = catalog?.sources.find((s) => s.id === dataSource);

  const loadCatalog = useCallback(async () => {
    try {
      setLoadingCatalog(true);
      setCatalogError(null);
      const cat = await fetchReportsCatalog();
      setCatalog(cat);
      const first = cat.sources[0]?.id ?? "vehicle_trips";
      setDataSource(first);
      const defs = cat.columns[first] ?? [];
      setSelectedColumns(defaultColumns(defs));
      setSortBy(defaultSortForSource(first));
    } catch (e: unknown) {
      setCatalogError(
        e instanceof Error ? e.message : "Failed to load report catalog",
      );
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
    fetchAgencies(1, 300)
      .then(({ agencies: list }) => setAgencies(list))
      .catch(() => {});
    fetchDrivers({ page: 1, limit: 300 })
      .then(({ drivers: list }) => setDrivers(list))
      .catch(() => {});
    fetchVehicles({ page: 1, limit: 300 })
      .then((res) => setVehicles(res.items ?? []))
      .catch(() => {});
  }, [loadCatalog]);

  const applyConfig = useCallback(
    (cfg: ReportRunConfig) => {
      setDataSource(cfg.dataSource);
      const defs = catalog?.columns[cfg.dataSource] ?? [];
      setSelectedColumns(
        cfg.columns?.length ? cfg.columns : defaultColumns(defs),
      );
      setFilters(cfg.filters ?? {});
      setSortBy(cfg.sortBy ?? defaultSortForSource(cfg.dataSource));
      setSortOrder(cfg.sortOrder ?? "desc");
      setResult(null);
      setRunError(null);
    },
    [catalog],
  );

  const handleSourceChange = (id: string) => {
    setDataSource(id);
    const defs = catalog?.columns[id] ?? [];
    setSelectedColumns(defaultColumns(defs));
    setSortBy(defaultSortForSource(id));
    setFilters({ status: "all" });
    setResult(null);
  };

  const toggleColumn = (id: string) => {
    setSelectedColumns((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const buildConfig = (): ReportRunConfig => {
    const cleanFilters: ReportFilters = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v != null && String(v).trim() !== "" && v !== "all") {
        (cleanFilters as Record<string, string>)[k] = String(v);
      }
    }
    return {
      dataSource,
      columns: selectedColumns.length ? selectedColumns : undefined,
      filters: cleanFilters,
      sortBy,
      sortOrder,
    };
  };

  const handleRun = async () => {
    if (selectedColumns.length === 0) {
      setRunError("Select at least one column.");
      return;
    }
    try {
      setRunning(true);
      setRunError(null);
      const data = await runReport(buildConfig());
      setResult(data);
    } catch (e: unknown) {
      setRunError(e instanceof Error ? e.message : "Failed to run report");
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  const handlePreset = (preset: ReportPreset) => {
    applyConfig({
      dataSource: preset.dataSource,
      columns: preset.columns,
      filters: preset.filters,
      sortBy: defaultSortForSource(preset.dataSource),
      sortOrder: "desc",
    });
  };

  const handleSave = () => {
    const name = saveName.trim() || `${sourceMeta?.label ?? dataSource} report`;
    const next = upsertSavedReport(name, buildConfig());
    setSaved(next);
    setSaveName("");
    setShowSaveInput(false);
  };

  const filterPatch = (patch: Partial<ReportFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
  };

  const showStatus =
    dataSource === "vehicle_trips" || dataSource === "bulk_trips";
  const showVehicle = dataSource === "vehicle_trips";
  const showDriverId =
    dataSource === "vehicle_trips" || dataSource === "driver_salary";
  const showAgencyId =
    dataSource === "bulk_trips" || dataSource === "payments";
  const showAgencyName = dataSource === "vehicle_trips";
  const showDriverName = dataSource === "bulk_trips";
  const showPaymentType = dataSource === "payments";
  const showSalaryType = dataSource === "driver_salary";

  const sortOptions = useMemo(() => {
    if (result?.headers?.length) {
      return result.headers.map((h) => ({ value: h.id, label: h.label }));
    }
    return columnDefs
      .filter((c) => selectedColumns.includes(c.id))
      .map((c) => ({ value: c.id, label: c.label }));
  }, [result, columnDefs, selectedColumns]);

  if (loadingCatalog && !catalog) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm text-slate-500">Loading reports…</p>
        </div>
      </div>
    );
  }

  if (catalogError && !catalog) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
          <p className="mt-3 text-sm text-slate-600">{catalogError}</p>
          <button
            type="button"
            onClick={loadCatalog}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {running ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run report
          </button>
          <button
            type="button"
            onClick={() => result && downloadReportCsv(result)}
            disabled={!result?.rows.length}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            Export CSV
          </button>
          {!showSaveInput ? (
            <button
              type="button"
              onClick={() => setShowSaveInput(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Save className="h-4 w-4" />
              Save layout
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Report name"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm w-40 sm:w-52"
              />
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowSaveInput(false)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          )}
          {result && (
            <span className="ml-auto text-xs text-slate-500 tabular-nums">
              {result.meta.rowCount.toLocaleString("en-IN")} rows
              {result.meta.truncated &&
                ` (of ${result.meta.totalMatched.toLocaleString("en-IN")}, capped at ${catalog?.limits.maxRows.toLocaleString("en-IN")})`}
            </span>
          )}
        </div>
        {runError && (
          <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {runError}
          </p>
        )}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Presets & saved */}
        <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white overflow-y-auto">
          <div className="p-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              <Bookmark className="h-3.5 w-3.5" />
              Presets
            </div>
          </div>
          <ul className="p-2 space-y-0.5">
            {(catalog?.presets ?? []).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => handlePreset(p)}
                  className="w-full text-left rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
          {saved.length > 0 && (
            <>
              <div className="p-3 border-t border-b border-slate-100 mt-1">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Saved
                </div>
              </div>
              <ul className="p-2 space-y-0.5">
                {saved.map((s) => (
                  <li key={s.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => applyConfig(s.config)}
                      className="flex-1 min-w-0 text-left rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 truncate"
                      title={s.name}
                    >
                      {s.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaved(deleteSavedReport(s.id))}
                      className="p-1.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>

        {/* Config */}
        <section className="w-full lg:w-80 shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Data source
              </label>
              <select
                value={dataSource}
                onChange={(e) => handleSourceChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {(catalog?.sources ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              {sourceMeta?.description && (
                <p className="mt-1 text-xs text-slate-500">{sourceMeta.description}</p>
              )}
            </div>

            <div className="rounded-lg border border-slate-100 p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                <Filter className="h-3.5 w-3.5" />
                Filters
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-[11px] text-slate-500">Month</label>
                  <select
                    value={filters.month ?? ""}
                    onChange={(e) =>
                      filterPatch({ month: e.target.value || undefined })
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    {monthOptions().map((o) => (
                      <option key={o.value || "none"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500">From</label>
                  <input
                    type="date"
                    value={filters.startDate ?? ""}
                    onChange={(e) =>
                      filterPatch({ startDate: e.target.value || undefined })
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500">To</label>
                  <input
                    type="date"
                    value={filters.endDate ?? ""}
                    onChange={(e) =>
                      filterPatch({ endDate: e.target.value || undefined })
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Search in rows</label>
                <div className="relative mt-0.5">
                  <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={filters.search ?? ""}
                    onChange={(e) =>
                      filterPatch({ search: e.target.value || undefined })
                    }
                    placeholder="Text match…"
                    className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              {showStatus && (
                <div>
                  <label className="text-[11px] text-slate-500">Status</label>
                  <select
                    value={filters.status ?? "all"}
                    onChange={(e) => filterPatch({ status: e.target.value })}
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {showPaymentType && (
                <div>
                  <label className="text-[11px] text-slate-500">Payment type</label>
                  <select
                    value={filters.paymentType ?? "all"}
                    onChange={(e) => filterPatch({ paymentType: e.target.value })}
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    {PAYMENT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {showSalaryType && (
                <div>
                  <label className="text-[11px] text-slate-500">Transaction type</label>
                  <select
                    value={filters.salaryType ?? "all"}
                    onChange={(e) => filterPatch({ salaryType: e.target.value })}
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    {SALARY_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {showAgencyId && (
                <div>
                  <label className="text-[11px] text-slate-500">Agency</label>
                  <select
                    value={filters.agencyId ?? ""}
                    onChange={(e) =>
                      filterPatch({ agencyId: e.target.value || undefined })
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">All agencies</option>
                    {agencies.map((a) => (
                      <option key={a._id ?? a.id} value={a._id ?? a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {showAgencyName && (
                <div>
                  <label className="text-[11px] text-slate-500">Agency name contains</label>
                  <input
                    type="text"
                    value={filters.agencyName ?? ""}
                    onChange={(e) =>
                      filterPatch({ agencyName: e.target.value || undefined })
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </div>
              )}
              {showDriverId && (
                <div>
                  <label className="text-[11px] text-slate-500">Driver</label>
                  <select
                    value={filters.driverId ?? ""}
                    onChange={(e) =>
                      filterPatch({ driverId: e.target.value || undefined })
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">All drivers</option>
                    {drivers.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.firstName} {d.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {showDriverName && (
                <div>
                  <label className="text-[11px] text-slate-500">Driver name contains</label>
                  <input
                    type="text"
                    value={filters.driverName ?? ""}
                    onChange={(e) =>
                      filterPatch({ driverName: e.target.value || undefined })
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </div>
              )}
              {showVehicle && (
                <div>
                  <label className="text-[11px] text-slate-500">Vehicle</label>
                  <select
                    value={filters.vehicleId ?? ""}
                    onChange={(e) =>
                      filterPatch({ vehicleId: e.target.value || undefined })
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">All vehicles</option>
                    {vehicles.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.vehicleNumber}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[11px] text-slate-500">Sort by</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    {sortOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500">Order</label>
                  <select
                    value={sortOrder}
                    onChange={(e) =>
                      setSortOrder(e.target.value as "asc" | "desc")
                    }
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <option value="desc">Newest first</option>
                    <option value="asc">Oldest first</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                  <Columns3 className="h-3.5 w-3.5" />
                  Columns
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedColumns(defaultColumns(columnDefs))}
                  className="text-[11px] text-blue-600 hover:underline"
                >
                  Defaults
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {columnDefs.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(c.id)}
                      onChange={() => toggleColumn(c.id)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span className="truncate">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Mobile presets */}
            <div className="lg:hidden">
              <label className="text-xs font-semibold text-slate-500 uppercase">
                Quick preset
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const p = catalog?.presets.find((x) => x.id === id);
                  if (p) handlePreset(p);
                  e.target.value = "";
                }}
              >
                <option value="">Choose preset…</option>
                {(catalog?.presets ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Preview table */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
          {!result ? (
            <div className="flex flex-1 items-center justify-center text-center p-8">
              <div>
                <Columns3 className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm text-slate-500">
                  Configure filters and columns, then run the report to preview data.
                </p>
              </div>
            </div>
          ) : result.rows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              No rows match your filters.
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
                  <tr>
                    {result.headers.map((h) => (
                      <th
                        key={h.id}
                        className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap"
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/80">
                      {result.headers.map((h) => (
                        <td
                          key={h.id}
                          className={`px-3 py-2 whitespace-nowrap text-slate-800 ${
                            h.type === "currency" || h.type === "number"
                              ? "tabular-nums text-right"
                              : ""
                          }`}
                        >
                          {formatCell(row[h.id], h.type)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {Object.keys(result.totals).length > 0 && (
                  <tfoot className="sticky bottom-0 bg-blue-50 border-t-2 border-blue-200 font-semibold">
                    <tr>
                      {result.headers.map((h, idx) => (
                        <td
                          key={h.id}
                          className={`px-3 py-2.5 whitespace-nowrap ${
                            h.type === "currency" || h.type === "number"
                              ? "tabular-nums text-right text-blue-900"
                              : "text-blue-900"
                          }`}
                        >
                          {idx === 0 && result.totals[h.id] == null
                            ? "TOTAL"
                            : result.totals[h.id] != null
                              ? formatCell(result.totals[h.id], h.type)
                              : ""}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
