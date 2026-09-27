import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileDown,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import {
  fetchTripHistory,
  type HistoryTrip,
  type HistoryPagination,
  type HistoryPaymentSummary,
} from "../../history/api";
import { TripReportPreviewDocument } from "../components/TripReportPreviewDocument";
import { fetchAgencies, type Agency } from "../../bulk-entry/api";
import { resolveAgencyLabelFromName } from "../../../lib/agencyDisplay";
import { fetchDrivers, type Driver } from "../../drivers/api";
import { fetchVehicles, type Vehicle } from "../../vehicles/api";
import {
  ReportEntitySearch,
  type ReportEntityFilter,
} from "../components/ReportEntitySearch";
import {
  buildTripReportHistoryParams,
  reportFilterSubtitle,
  type ReportDateFilter,
} from "../buildReportParams";
import { downloadTripReportPdf } from "../tripReportPdf";
import {
  REPORT_FIELD_DEFS,
  countSelectedFields,
  defaultReportFieldSelection,
  type ReportFieldSelection,
} from "../reportFieldConfig";

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In Progress" },
  { value: "scheduled", label: "Scheduled" },
  { value: "cancelled", label: "Cancelled" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "unpaid", label: "Unpaid" },
];

const PREVIEW_LIMIT = 20;
const PDF_LIMIT = 10000;

const fieldCls =
  "w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100 dark:focus:border-indigo-400";

const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

function getCurrentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [
    { value: "all_time", label: "All Time" },
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

function PaginationBar({
  p,
  onChange,
}: {
  p: HistoryPagination;
  onChange: (page: number) => void;
}) {
  if (p.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        Page {p.page}/{p.pages} · {p.total} trips
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!p.hasPrev}
          onClick={() => onChange(p.page - 1)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-[#1e2638] dark:text-slate-300 dark:hover:bg-white/5"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <button
          type="button"
          disabled={!p.hasNext}
          onClick={() => onChange(p.page + 1)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-[#1e2638] dark:text-slate-300 dark:hover:bg-white/5"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const currentMonth = getCurrentMonthValue();

  const [entityFilter, setEntityFilter] = useState<ReportEntityFilter | null>(
    null,
  );
  const [status, setStatus] = useState("completed");
  const [month, setMonth] = useState(currentMonth);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterMode, setFilterMode] =
    useState<ReportDateFilter["filterMode"]>("month");
  const [tripSource, setTripSource] = useState<"vehicle" | "bulk">("vehicle");
  const [fieldSelection, setFieldSelection] = useState<ReportFieldSelection>(
    () => defaultReportFieldSelection("vehicle"),
  );

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);

  const [tripSearchQuery, setTripSearchQuery] = useState("");
  const [tripNumberSuggestions, setTripNumberSuggestions] = useState<string[]>(
    [],
  );
  const [loadingTripSuggestions, setLoadingTripSuggestions] = useState(false);
  const tripSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [previewTrips, setPreviewTrips] = useState<HistoryTrip[]>([]);
  const [previewPagination, setPreviewPagination] = useState<HistoryPagination>({
    page: 1,
    limit: PREVIEW_LIMIT,
    total: 0,
    pages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [previewPaymentSummary, setPreviewPaymentSummary] =
    useState<HistoryPaymentSummary | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const dateFilter: ReportDateFilter = useMemo(
    () => ({ filterMode, month, startDate, endDate }),
    [filterMode, month, startDate, endDate],
  );

  useEffect(() => {
    fetchDrivers({ page: 1, limit: 500 })
      .then((r) => setDrivers(r.drivers))
      .catch(() => {});
    fetchVehicles({ page: 1, limit: 500 })
      .then((r) => setVehicles(r.items ?? []))
      .catch(() => {});
    fetchAgencies(1, 500)
      .then((r) => setAgencies(r.agencies))
      .catch(() => {});
  }, []);

  const resolveAgencyLabel = useCallback(
    (agencyName?: string) =>
      resolveAgencyLabelFromName(agencyName, agencies),
    [agencies],
  );

  useEffect(() => {
    const q = tripSearchQuery.trim();
    if (!q || entityFilter) {
      setTripNumberSuggestions([]);
      return;
    }
    if (tripSearchDebounce.current) clearTimeout(tripSearchDebounce.current);
    tripSearchDebounce.current = setTimeout(async () => {
      setLoadingTripSuggestions(true);
      try {
        const res = await fetchTripHistory({
          search: q,
          page: 1,
          limit: 15,
          status: status === "all" ? undefined : status,
        });
        const nums = res.trips
          .map((t) => t.tripNumber)
          .filter((n): n is string => !!n?.trim());
        setTripNumberSuggestions([...new Set(nums)]);
      } catch {
        setTripNumberSuggestions([]);
      } finally {
        setLoadingTripSuggestions(false);
      }
    }, 400);
    return () => {
      if (tripSearchDebounce.current) clearTimeout(tripSearchDebounce.current);
    };
  }, [tripSearchQuery, entityFilter, status]);

  const loadPreview = useCallback(
    async (page = 1) => {
      setLoadingPreview(true);
      setPreviewError(null);
      try {
        const params = buildTripReportHistoryParams(
          entityFilter,
          status,
          dateFilter,
          { page, limit: PREVIEW_LIMIT, tripSource },
        );
        const result = await fetchTripHistory(params);
        setPreviewTrips(result.trips);
        setPreviewPagination(result.pagination);
        setPreviewPaymentSummary(result.paymentSummary || null);
        setPreviewLoaded(true);
      } catch {
        setPreviewError("Failed to load report preview.");
        setPreviewTrips([]);
        setPreviewPaymentSummary(null);
        setPreviewLoaded(false);
      } finally {
        setLoadingPreview(false);
      }
    },
    [entityFilter, status, dateFilter, tripSource],
  );

  const handlePreview = () => {
    if (countSelectedFields(fieldSelection) === 0) {
      alert("Select at least one report field to include.");
      return;
    }
    void loadPreview(1);
  };

  const handleGeneratePdf = async () => {
    if (countSelectedFields(fieldSelection) === 0) {
      alert("Select at least one report field to include.");
      return;
    }
    setGeneratingPdf(true);
    try {
      const params = buildTripReportHistoryParams(
        entityFilter,
        status,
        dateFilter,
        { page: 1, limit: PDF_LIMIT, tripSource },
      );
      const result = await fetchTripHistory(params);
      if (!result.trips.length) {
        alert("No trips match your filters.");
        return;
      }
      const subtitle = reportFilterSubtitle(entityFilter, dateFilter);
      downloadTripReportPdf(result.trips, {
        title: "Trip History Report",
        subtitle: subtitle || undefined,
        resolveAgencyLabel,
        fieldSelection,
        tripSource,
        paymentSummary: result.paymentSummary,
      });
    } catch {
      alert("Failed to generate report PDF.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const resetFilters = () => {
    setEntityFilter(null);
    setStatus("completed");
    setMonth(currentMonth);
    setStartDate("");
    setEndDate("");
    setFilterMode("month");
    setPreviewLoaded(false);
    setPreviewTrips([]);
    setPreviewPaymentSummary(null);
    setTripSearchQuery("");
    setTripSource("vehicle");
    setFieldSelection(defaultReportFieldSelection("vehicle"));
  };

  const toggleReportField = (id: (typeof REPORT_FIELD_DEFS)[number]["id"]) => {
    setFieldSelection((prev) => {
      if (prev[id]) {
        const wouldRemain = REPORT_FIELD_DEFS.filter(
          (f) => f.id !== id && prev[f.id],
        ).length;
        if (wouldRemain === 0) return prev;
      }
      return { ...prev, [id]: !prev[id] };
    });
    setPreviewLoaded(false);
  };

  const filterSummary = reportFilterSubtitle(entityFilter, dateFilter);

  const visibleFields = REPORT_FIELD_DEFS.filter((f) => {
    const bulkOnlyFields = [
      "advance",
      "balance",
      "toll",
      "notes",
      "vehicleType",
      "mobileNumber",
    ];
    const vehicleOnlyFields = [
      "from",
      "to",
      "customer",
      "startKilometers",
      "startTime",
      "totalKm",
      "totalTime",
    ];
    if (tripSource === "bulk" && vehicleOnlyFields.includes(f.id)) return false;
    if (tripSource === "vehicle" && bulkOnlyFields.includes(f.id)) return false;
    return true;
  });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-main)]">
      <div className="shrink-0 border-b border-slate-200 bg-[var(--bg-card)] px-4 py-4 dark:border-[#1e2638] sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">
                Trip Reports
              </h1>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Filter trips, preview the PDF layout, then export
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={loadingPreview}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
            >
              {loadingPreview ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Preview report
            </button>
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={generatingPdf || !previewLoaded}
              title={
                previewLoaded
                  ? "Download PDF for all matching trips"
                  : "Load preview first"
              }
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              {generatingPdf ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              Generate PDF
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="w-full shrink-0 overflow-y-auto border-b border-slate-200 bg-[var(--bg-card)] dark:border-[#1e2638] lg:w-[320px] lg:border-b-0 lg:border-r xl:w-[360px]">
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-[#1e2638]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Report filters
                </h2>
              </div>
              <span className="rounded border border-slate-200 bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:border-[#1e2638] dark:text-slate-500">
                Config
              </span>
            </div>

            <ReportEntitySearch
              value={entityFilter}
              onChange={(f) => {
                setEntityFilter(f);
                setPreviewLoaded(false);
              }}
              onQueryChange={setTripSearchQuery}
              drivers={drivers}
              vehicles={vehicles}
              agencies={agencies}
              tripNumberSuggestions={tripNumberSuggestions}
              loadingTrips={loadingTripSuggestions}
            />

            <div className="space-y-3">
              <div>
                <label className={labelCls}>Trip Source</label>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-[#1e2638] dark:bg-[#060e20]">
                  <button
                    type="button"
                    onClick={() => {
                      setTripSource("vehicle");
                      setFieldSelection(defaultReportFieldSelection("vehicle"));
                      setPreviewLoaded(false);
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      tripSource === "vehicle"
                        ? "border border-indigo-500/40 bg-[var(--bg-card)] text-indigo-600 shadow-xs dark:bg-[#131b2e] dark:text-indigo-300"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    Vehicle Trips
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTripSource("bulk");
                      setFieldSelection(defaultReportFieldSelection("bulk"));
                      setPreviewLoaded(false);
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      tripSource === "bulk"
                        ? "border border-indigo-500/40 bg-[var(--bg-card)] text-indigo-600 shadow-xs dark:bg-[#131b2e] dark:text-indigo-300"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    Bulk Entry
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPreviewLoaded(false);
                  }}
                  className={fieldCls}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Month</label>
                <select
                  value={filterMode === "month" ? month : ""}
                  onChange={(e) => {
                    setMonth(e.target.value || currentMonth);
                    setFilterMode("month");
                    setStartDate("");
                    setEndDate("");
                    setPreviewLoaded(false);
                  }}
                  className={fieldCls}
                >
                  {monthOptions().map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setFilterMode("daterange");
                      setMonth("");
                      setPreviewLoaded(false);
                    }}
                    className={`${fieldCls} font-mono text-xs`}
                  />
                </div>
                <div>
                  <label className={labelCls}>End date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setFilterMode("daterange");
                      setMonth("");
                      setPreviewLoaded(false);
                    }}
                    className={`${fieldCls} font-mono text-xs`}
                  />
                </div>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-500">
              Select a driver, vehicle, agency, or trip number from search to
              narrow the report. Leave empty for all trips in the date range.
            </p>

            <div className="border-t border-slate-100 pt-4 dark:border-[#1e2638]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Report fields
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFieldSelection(defaultReportFieldSelection());
                      setPreviewLoaded(false);
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"
                  >
                    Reset defaults
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const all = {} as ReportFieldSelection;
                      const bulkOnlyFields = [
                        "advance",
                        "balance",
                        "toll",
                        "notes",
                        "vehicleType",
                        "mobileNumber",
                      ];
                      const vehicleOnlyFields = [
                        "from",
                        "to",
                        "customer",
                        "startKilometers",
                        "startTime",
                        "totalKm",
                        "totalTime",
                      ];
                      for (const f of REPORT_FIELD_DEFS) {
                        if (
                          tripSource === "bulk" &&
                          vehicleOnlyFields.includes(f.id)
                        )
                          continue;
                        if (
                          tripSource === "vehicle" &&
                          bulkOnlyFields.includes(f.id)
                        )
                          continue;
                        all[f.id] = true;
                      }
                      setFieldSelection(all);
                      setPreviewLoaded(false);
                    }}
                    className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Select all
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleFields.map((f) => (
                  <label
                    key={f.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-2.5 py-2 text-sm text-slate-700 transition hover:border-indigo-300 has-checked:border-indigo-400 has-checked:bg-indigo-50 dark:border-[#1e2638] dark:text-slate-200 dark:hover:border-indigo-500/40 dark:has-checked:border-indigo-500/50 dark:has-checked:bg-indigo-500/15"
                  >
                    <input
                      type="checkbox"
                      checked={fieldSelection[f.id]}
                      onChange={() => toggleReportField(f.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200 dark:border-white/20 dark:bg-transparent"
                    />
                    <span className="truncate">{f.label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                Checked fields appear in the preview and PDF. Trip number is
                always shown on each card.
              </p>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-[#1e2638] dark:text-slate-300 dark:hover:bg-white/5"
            >
              Clear all filters
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--bg-main)]">
          <div className="space-y-3 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[var(--bg-card)] px-4 py-3 dark:border-[#1e2638]">
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    previewLoaded
                      ? "bg-emerald-400 shadow-sm shadow-emerald-400/40"
                      : "bg-slate-300 dark:bg-slate-600"
                  }`}
                />
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100">
                    Report preview
                  </h2>
                  {previewLoaded ? (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {previewPagination.total} trip
                      {previewPagination.total === 1 ? "" : "s"}
                      {filterSummary ? ` · ${filterSummary}` : ""}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Configure filters, then preview before PDF export
                    </p>
                  )}
                </div>
              </div>
              {previewLoaded && (
                <span className="rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-slate-600 dark:border-[#1e2638] dark:text-slate-300">
                  {previewPagination.total} trips
                </span>
              )}
            </div>

            {!previewLoaded && !loadingPreview && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-[var(--bg-card)] px-6 py-14 text-center dark:border-[#1e2638]">
                <Eye className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                  No preview yet
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                  Set filters and click &quot;Preview report&quot; to see trips
                  here before exporting PDF.
                </p>
              </div>
            )}

            {loadingPreview && (
              <div className="flex justify-center py-16">
                <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
              </div>
            )}

            {previewError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {previewError}
              </div>
            )}

            {previewLoaded && !loadingPreview && previewTrips.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-[var(--bg-card)] px-6 py-12 text-center dark:border-[#1e2638]">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  No trips match these filters.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Clear filters
                </button>
              </div>
            )}

            {previewLoaded && !loadingPreview && previewTrips.length > 0 && (
              <>
                <TripReportPreviewDocument
                  trips={previewTrips}
                  totalTrips={previewPagination.total}
                  fieldSelection={fieldSelection}
                  tripIndexOffset={(previewPagination.page - 1) * PREVIEW_LIMIT}
                  title="Trip History Report"
                  subtitle={filterSummary || undefined}
                  resolveAgencyLabel={resolveAgencyLabel}
                  paymentSummary={
                    tripSource === "bulk" ? previewPaymentSummary : undefined
                  }
                  pageNote={
                    previewPagination.pages > 1
                      ? `Showing page ${previewPagination.page} of ${previewPagination.pages} (${previewTrips.length} trips on this page). PDF export includes all ${previewPagination.total} trips.`
                      : undefined
                  }
                />
                <PaginationBar
                  p={previewPagination}
                  onChange={(p) => void loadPreview(p)}
                />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
