import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FileDown,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  SlidersHorizontal,
  RotateCcw,
  CircleDot,
} from "lucide-react";
import {
  fetchTripHistory,
  fetchAllTripHistory,
  type HistoryTrip,
  type HistoryPagination,
} from "../../history/api";
import { TripReportPreviewDocument } from "../components/TripReportPreviewDocument";
import { fetchAgencies, type Agency } from "../../bulk-entry/api";
import { DatePicker } from "../../../components/ui/DatePicker";
import { todayIsoInAppTz } from "../../../lib/datePickerUtils";
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
  countSelectedFields,
  defaultReportFieldSelection,
  selectionForAllVisible,
  visibleReportFields,
  type ReportFieldSelection,
} from "../reportFieldConfig";
import { downloadTripReportCsv } from "../exportCsv";
import {
  computeTripReportTotals,
  type TripReportTotals,
} from "../entityReportTotals";

const VEHICLE_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In progress" },
  { value: "scheduled", label: "Scheduled" },
  { value: "cancelled", label: "Cancelled" },
];

const BULK_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "converted", label: "Converted" },
  { value: "cancelled", label: "Cancelled" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "all", label: "All payments" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "unpaid", label: "Unpaid" },
];

const PREVIEW_LIMIT = 20;
const LIVE_PREVIEW_DEBOUNCE_MS = 450;

const fieldCls =
  "w-full rounded-md border border-slate-200/90 bg-white px-2.5 py-2 text-[13px] font-medium text-slate-800 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-300 dark:border-[#243049] dark:bg-[#0b1220] dark:text-slate-100 dark:focus:border-slate-500";

const labelCls =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400";

/** Current YYYY-MM in app business timezone (IST). */
function getCurrentMonthValue(): string {
  return todayIsoInAppTz().slice(0, 7);
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function monthShortLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

function buildMonthOptions(count = 36): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const current = getCurrentMonthValue();
  const [y0, m0] = current.split("-").map(Number);
  let year = y0;
  let month = m0;
  for (let i = 0; i < count; i++) {
    const value = `${year}-${String(month).padStart(2, "0")}`;
    const label = new Date(year, month - 1, 1).toLocaleString("en-IN", {
      month: "long",
      year: "numeric",
    });
    opts.push({
      value,
      label: value === current ? `${label} · Current` : label,
    });
    month -= 1;
    if (month <= 0) {
      month += 12;
      year -= 1;
    }
  }
  return opts;
}

function SectionLabel({
  index,
  title,
  action,
}: {
  index: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] font-bold tabular-nums text-slate-400">
          {index}
        </span>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
          {title}
        </h3>
      </div>
      {action}
    </div>
  );
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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2 backdrop-blur dark:border-[#243049] dark:bg-[#0e1524]/80">
      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
        Page {p.page} / {p.pages} · {p.total.toLocaleString("en-IN")} records
      </span>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={!p.hasPrev}
          onClick={() => onChange(p.page - 1)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-[#243049] dark:bg-[#0b1220] dark:text-slate-300"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>
        <button
          type="button"
          disabled={!p.hasNext}
          onClick={() => onChange(p.page + 1)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-[#243049] dark:bg-[#0b1220] dark:text-slate-300"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const currentMonth = getCurrentMonthValue();
  const monthSelectOptions = useMemo(() => buildMonthOptions(36), []);

  const [entityFilter, setEntityFilter] = useState<ReportEntityFilter | null>(
    null,
  );
  const [tripStatus, setTripStatus] = useState("completed");
  const [paymentStatus, setPaymentStatus] = useState("all");
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
  const [reportTotals, setReportTotals] = useState<TripReportTotals | null>(
    null,
  );
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);

  const dateFilter: ReportDateFilter = useMemo(
    () => ({ filterMode, month, startDate, endDate }),
    [filterMode, month, startDate, endDate],
  );

  const previewRequestKey = useMemo(
    () =>
      JSON.stringify({
        entityFilter,
        tripStatus,
        paymentStatus,
        dateFilter,
        tripSource,
        previewPage,
      }),
    [
      entityFilter,
      tripStatus,
      paymentStatus,
      dateFilter,
      tripSource,
      previewPage,
    ],
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

  // Keep status valid for the active dataset (bulk ≠ vehicle lifecycle statuses)
  useEffect(() => {
    const allowed =
      tripSource === "bulk" ? BULK_STATUS_OPTIONS : VEHICLE_STATUS_OPTIONS;
    if (!allowed.some((o) => o.value === tripStatus)) {
      setTripStatus("all");
    }
  }, [tripSource, tripStatus]);

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
          status: tripStatus === "all" ? undefined : tripStatus,
          paymentStatus:
            paymentStatus === "all" ? undefined : paymentStatus,
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
  }, [tripSearchQuery, entityFilter, tripStatus, paymentStatus]);

  const loadPreview = useCallback(
    async (page: number, signal?: { cancelled: boolean }) => {
      setLoadingPreview(true);
      setPreviewError(null);
      try {
        const params = buildTripReportHistoryParams(
          entityFilter,
          tripStatus,
          dateFilter,
          {
            page,
            limit: PREVIEW_LIMIT,
            tripSource,
            paymentStatus,
          },
        );
        const result = await fetchTripHistory(params);
        if (signal?.cancelled) return;
        setPreviewTrips(result.trips);
        setPreviewPagination(result.pagination);

        const allParams = buildTripReportHistoryParams(
          entityFilter,
          tripStatus,
          dateFilter,
          { tripSource, paymentStatus },
        );
        const all = await fetchAllTripHistory(allParams);
        if (signal?.cancelled) return;
        setReportTotals(computeTripReportTotals(all.trips, tripSource));
      } catch {
        if (signal?.cancelled) return;
        setPreviewError("Failed to load report preview.");
        setPreviewTrips([]);
        setReportTotals(null);
      } finally {
        if (!signal?.cancelled) setLoadingPreview(false);
      }
    },
    [entityFilter, tripStatus, paymentStatus, dateFilter, tripSource],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    const t = setTimeout(() => {
      void loadPreview(previewPage, signal);
    }, LIVE_PREVIEW_DEBOUNCE_MS);
    return () => {
      signal.cancelled = true;
      clearTimeout(t);
    };
  }, [previewRequestKey, loadPreview, previewPage]);

  const handleGeneratePdf = async () => {
    if (countSelectedFields(fieldSelection) === 0) {
      alert("Select at least one report field to include.");
      return;
    }
    setGeneratingPdf(true);
    try {
      const params = buildTripReportHistoryParams(
        entityFilter,
        tripStatus,
        dateFilter,
        { tripSource, paymentStatus },
      );
      const result = await fetchAllTripHistory(params);
      if (!result.trips.length) {
        alert("No trips match your filters.");
        return;
      }
      if (!result.complete) {
        alert(
          "Warning: not all trips could be loaded for this report. PDF may be incomplete. Try narrowing the date range or contact support.",
        );
      }
      const subtitle = reportFilterSubtitle(entityFilter, dateFilter, {
        tripStatus,
        paymentStatus,
      });
      downloadTripReportPdf(result.trips, {
        title: "Trip History Report",
        subtitle: subtitle || undefined,
        resolveAgencyLabel,
        fieldSelection,
        tripSource,
        reportTotals: computeTripReportTotals(result.trips, tripSource),
      });
    } catch {
      alert("Failed to generate report PDF.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      if (countSelectedFields(fieldSelection) === 0) {
        alert("Select at least one report field to include.");
        return;
      }
      const params = buildTripReportHistoryParams(
        entityFilter,
        tripStatus,
        dateFilter,
        { tripSource, paymentStatus },
      );
      const result = await fetchAllTripHistory(params);
      if (!result.trips.length) {
        alert("No trips match your filters.");
        return;
      }
      downloadTripReportCsv(result.trips, fieldSelection, {
        tripSource,
        resolveAgencyLabel,
      });
    } catch {
      alert("Failed to export CSV.");
    } finally {
      setExportingCsv(false);
    }
  };

  const resetFilters = () => {
    setEntityFilter(null);
    setTripStatus("completed");
    setPaymentStatus("all");
    setMonth(currentMonth);
    setStartDate("");
    setEndDate("");
    setFilterMode("month");
    setTripSearchQuery("");
    setTripSource("vehicle");
    setFieldSelection(defaultReportFieldSelection("vehicle"));
    setReportTotals(null);
    setPreviewPage(1);
  };

  const toggleReportField = (id: keyof ReportFieldSelection) => {
    setFieldSelection((prev) => {
      if (prev[id]) {
        const wouldRemain = visibleReportFields(tripSource).filter(
          (f) => f.id !== id && prev[f.id],
        ).length;
        if (wouldRemain === 0) return prev;
      }
      return { ...prev, [id]: !prev[id] };
    });
  };

  const bumpFilters = () => {
    setPreviewPage(1);
  };

  const filterSummary = reportFilterSubtitle(entityFilter, dateFilter, {
    tripStatus,
    paymentStatus,
  });
  const visibleFields = visibleReportFields(tripSource);
  const selectedFieldCount = countSelectedFields(fieldSelection);
  const hasPreviewData = previewTrips.length > 0;
  const isBusy = loadingPreview || generatingPdf || exportingCsv;

  const criteriaChips = useMemo(() => {
    const chips: { key: string; label: string }[] = [];
    chips.push({
      key: "source",
      label: tripSource === "bulk" ? "Bulk entry" : "Vehicle trips",
    });
    if (tripStatus !== "all") {
      chips.push({
        key: "tripStatus",
        label: tripStatus.replace(/_/g, " "),
      });
    }
    if (paymentStatus !== "all") {
      chips.push({ key: "payment", label: paymentStatus });
    }
    if (entityFilter) {
      chips.push({
        key: "entity",
        label: `${entityFilter.type}: ${entityFilter.label}`,
      });
    }
    if (filterMode === "month" && month && month !== "all_time") {
      chips.push({ key: "period", label: monthShortLabel(month) });
    } else if (filterMode === "daterange" && (startDate || endDate)) {
      chips.push({
        key: "period",
        label: `${startDate || "…"} → ${endDate || "…"}`,
      });
    } else if (filterMode === "month" && month === "all_time") {
      chips.push({ key: "period", label: "All time" });
    }
    chips.push({ key: "cols", label: `${selectedFieldCount} columns` });
    return chips;
  }, [
    tripSource,
    tripStatus,
    paymentStatus,
    entityFilter,
    filterMode,
    month,
    startDate,
    endDate,
    selectedFieldCount,
  ]);

  const statusLabel = isBusy
    ? "Refreshing"
    : hasPreviewData
      ? "Ready to export"
      : "Awaiting data";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-main)]">
      <header className="shrink-0 border-b border-slate-200 bg-[var(--bg-card)] dark:border-[#1e2638]">
        <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Report studio
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  isBusy
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                    : hasPreviewData
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "border-slate-200 bg-slate-50 text-slate-500 dark:border-[#243049] dark:bg-[#0b1220] dark:text-slate-400"
                }`}
              >
                <CircleDot className="h-3 w-3" />
                {statusLabel}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {filterSummary ||
                "Configure filters and columns, then export PDF or CSV."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadPreview(previewPage)}
              disabled={loadingPreview}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#243049] dark:bg-[#0b1220] dark:text-slate-200"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingPreview ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void handleExportCsv()}
              disabled={exportingCsv || isBusy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#243049] dark:bg-[#0b1220] dark:text-slate-200"
            >
              {exportingCsv ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              CSV
            </button>
            <button
              type="button"
              onClick={() => void handleGeneratePdf()}
              disabled={generatingPdf || isBusy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              {generatingPdf ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              PDF
            </button>
          </div>
        </div>

        {criteriaChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 px-4 py-2 sm:px-5 dark:border-[#1e2638]">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active
            </span>
            {criteriaChips.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600 dark:border-[#243049] dark:bg-[#0b1220] dark:text-slate-300"
              >
                {c.label}
              </span>
            ))}
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-[var(--bg-card)] dark:border-[#1e2638] lg:w-[46%] lg:max-w-[520px] lg:border-b-0 lg:border-r xl:w-[48%] xl:max-w-[560px]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-[#1e2638]">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Builder
              </span>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-200"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>

          <div className="flex-1 space-y-3.5 overflow-y-auto p-3.5 sm:p-4">
            <section>
              <SectionLabel index="01" title="Scope" />
              <div className="space-y-3">
                <ReportEntitySearch
                  value={entityFilter}
                  onChange={(f) => {
                    setEntityFilter(f);
                    bumpFilters();
                  }}
                  onQueryChange={setTripSearchQuery}
                  drivers={drivers}
                  vehicles={vehicles}
                  agencies={agencies}
                  tripNumberSuggestions={tripNumberSuggestions}
                  loadingTrips={loadingTripSuggestions}
                />

                <div>
                  <label className={labelCls}>Dataset</label>
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-[#243049] dark:bg-[#060e20]">
                    {(["vehicle", "bulk"] as const).map((src) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => {
                          setTripSource(src);
                          setFieldSelection(defaultReportFieldSelection(src));
                          // Bulk agency trips use pending/converted — not vehicle "completed"
                          setTripStatus(
                            src === "bulk"
                              ? "all"
                              : tripStatus === "pending" ||
                                  tripStatus === "converted"
                                ? "completed"
                                : tripStatus,
                          );
                          bumpFilters();
                        }}
                        className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${
                          tripSource === src
                            ? "bg-white text-slate-900 shadow-sm dark:bg-[#131b2e] dark:text-white"
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                        }`}
                      >
                        {src === "vehicle" ? "Vehicle" : "Bulk"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Trip status</label>
                    <select
                      value={
                        (tripSource === "bulk"
                          ? BULK_STATUS_OPTIONS
                          : VEHICLE_STATUS_OPTIONS
                        ).some((o) => o.value === tripStatus)
                          ? tripStatus
                          : "all"
                      }
                      onChange={(e) => {
                        setTripStatus(e.target.value);
                        bumpFilters();
                      }}
                      className={fieldCls}
                    >
                      {(tripSource === "bulk"
                        ? BULK_STATUS_OPTIONS
                        : VEHICLE_STATUS_OPTIONS
                      ).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Payment</label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => {
                        setPaymentStatus(e.target.value);
                        bumpFilters();
                      }}
                      className={fieldCls}
                    >
                      {PAYMENT_STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <SectionLabel index="02" title="Period" />
              <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white dark:border-[#243049] dark:bg-[#0b1220]">
                <div className="grid grid-cols-2 border-b border-slate-100 dark:border-[#1e2638]">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode("month");
                      if (!month || month === "") setMonth(currentMonth);
                      setStartDate("");
                      setEndDate("");
                      bumpFilters();
                    }}
                    className={`px-3 py-2 text-[11px] font-semibold transition ${
                      filterMode === "month"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/[0.03]"
                    }`}
                  >
                    By month
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode("daterange");
                      setMonth("");
                      bumpFilters();
                    }}
                    className={`px-3 py-2 text-[11px] font-semibold transition ${
                      filterMode === "daterange"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/[0.03]"
                    }`}
                  >
                    Custom range
                  </button>
                </div>

                {filterMode === "month" ? (
                  <div className="space-y-2.5 p-3">
                    <label className="block">
                      <span className={labelCls}>Select month</span>
                      <div className="relative">
                        <select
                          value={month || currentMonth}
                          onChange={(e) => {
                            setMonth(e.target.value);
                            setFilterMode("month");
                            setStartDate("");
                            setEndDate("");
                            bumpFilters();
                          }}
                          className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-9 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white dark:border-[#2a3548] dark:bg-[#121820] dark:text-white dark:focus:border-slate-500"
                        >
                          <option value="all_time">All time</option>
                          {monthSelectOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400">
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </span>
                      </div>
                    </label>
                    {month && month !== "all_time" && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Showing trips for{" "}
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {monthLabel(month)}
                        </span>
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setMonth(currentMonth);
                          setFilterMode("month");
                          setStartDate("");
                          setEndDate("");
                          bumpFilters();
                        }}
                        className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                          month === currentMonth
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"
                        }`}
                      >
                        This month
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMonth("all_time");
                          setFilterMode("month");
                          setStartDate("");
                          setEndDate("");
                          bumpFilters();
                        }}
                        className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                          month === "all_time"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"
                        }`}
                      >
                        All time
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 p-3">
                    <div>
                      <label className={labelCls}>From</label>
                      <DatePicker
                        value={startDate}
                        onChange={(v) => {
                          setStartDate(v);
                          if (endDate && v && endDate < v) setEndDate(v);
                          setFilterMode("daterange");
                          setMonth("");
                          bumpFilters();
                        }}
                        className={`${fieldCls} font-mono text-[11px]`}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>To</label>
                      <DatePicker
                        value={endDate}
                        min={startDate || undefined}
                        onChange={(v) => {
                          setEndDate(v);
                          setFilterMode("daterange");
                          setMonth("");
                          bumpFilters();
                        }}
                        className={`${fieldCls} font-mono text-[11px]`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section>
              <SectionLabel
                index="03"
                title="Columns"
                action={
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium tabular-nums text-slate-400">
                      {selectedFieldCount}/{visibleFields.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setFieldSelection(selectionForAllVisible(tripSource))
                      }
                      className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    >
                      All
                    </button>
                  </div>
                }
              />
              <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200/90 dark:border-[#243049]">
                {visibleFields.map((f, i) => (
                  <label
                    key={f.id}
                    className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[12px] transition hover:bg-slate-50 dark:hover:bg-white/[0.03] ${
                      i % 2 === 1
                        ? "border-l border-slate-100 dark:border-[#1e2638]"
                        : ""
                    } ${
                      i >= 2
                        ? "border-t border-slate-100 dark:border-[#1e2638]"
                        : ""
                    } ${
                      fieldSelection[f.id]
                        ? "bg-slate-50/80 dark:bg-white/[0.02]"
                        : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={fieldSelection[f.id]}
                      onChange={() => toggleReportField(f.id)}
                      className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-slate-300 dark:border-white/20 dark:bg-transparent dark:text-white"
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                      {f.label}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                Columns update the preview instantly. Trip number is always
                included.
              </p>
            </section>
          </div>
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden lg:min-w-[280px]">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }}
          />

          <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="mx-auto w-full max-w-[720px] space-y-2.5 p-3 sm:p-4 xl:max-w-[820px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Document preview
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {filterSummary ||
                      "Adjust builder controls — preview refreshes live"}
                  </p>
                </div>
                {loadingPreview && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Syncing…
                  </span>
                )}
              </div>

              {previewError && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {previewError}
                </div>
              )}

              {loadingPreview && previewTrips.length === 0 && (
                <div className="flex justify-center py-20">
                  <RefreshCw className="h-7 w-7 animate-spin text-slate-400" />
                </div>
              )}

              {!loadingPreview &&
                previewTrips.length === 0 &&
                !previewError && (
                  <div className="mx-auto max-w-md rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-14 text-center backdrop-blur dark:border-[#243049] dark:bg-[#0e1524]/70">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      No matching records
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Widen the period or clear scope filters to generate a
                      report.
                    </p>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-4 text-xs font-semibold text-slate-800 underline-offset-2 hover:underline dark:text-slate-200"
                    >
                      Reset filters
                    </button>
                  </div>
                )}

              {previewTrips.length > 0 && (
                <>
                  <TripReportPreviewDocument
                    trips={previewTrips}
                    totalTrips={previewPagination.total}
                    fieldSelection={fieldSelection}
                    title="Trip History Report"
                    subtitle={filterSummary || undefined}
                    resolveAgencyLabel={resolveAgencyLabel}
                    tripIndexOffset={(previewPage - 1) * PREVIEW_LIMIT}
                    reportTotals={reportTotals}
                    pageNote={
                      previewPagination.pages > 1
                        ? `Showing page ${previewPagination.page} of ${previewPagination.pages}`
                        : undefined
                    }
                  />
                  <PaginationBar
                    p={previewPagination}
                    onChange={setPreviewPage}
                  />
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
