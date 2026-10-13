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
  Table2,
  RotateCcw,
  Check,
  CircleDot,
} from "lucide-react";
import {
  fetchTripHistory,
  fetchAllTripHistory,
  type HistoryTrip,
  type HistoryPagination,
  type HistoryPaymentSummary,
} from "../../history/api";
import { TripReportPreviewDocument } from "../components/TripReportPreviewDocument";
import { fetchAgencies, type Agency } from "../../bulk-entry/api";
import { DatePicker } from "../../../components/ui/DatePicker";
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
import {
  fetchReportsCatalog,
  runReport,
  type ReportCatalog,
  type ReportPreset,
  type ReportRunResult,
} from "../api";
import { downloadReportCsv, downloadTripReportCsv } from "../exportCsv";
import {
  TRIP_REPORT_UI_PRESETS,
  type TripReportUiPreset,
} from "../tripReportPresets";

const TRIP_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In progress" },
  { value: "scheduled", label: "Scheduled" },
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

function getCurrentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const CUSTOM_DATE_VALUE = "custom_date";

function monthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [
    { value: "all_time", label: "All time" },
    { value: CUSTOM_DATE_VALUE, label: "Custom date" },
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

function MetricTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn";
}) {
  const valueCls =
    tone === "good"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-300"
        : "text-slate-900 dark:text-white";
  return (
    <div className="min-w-0 rounded-md border border-slate-200/80 bg-white px-2.5 py-1.5 dark:border-[#243049] dark:bg-[#0e1524]">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-bold tabular-nums tracking-tight ${valueCls}`}>
        {value}
      </p>
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

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

type ReportMode = "trip_cards" | "tabular";

export function ReportsPage() {
  const currentMonth = getCurrentMonthValue();

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
  const [activeTripPresetId, setActiveTripPresetId] = useState<string | null>(
    null,
  );
  const [activeCatalogPresetId, setActiveCatalogPresetId] = useState<
    string | null
  >(null);
  const [reportMode, setReportMode] = useState<ReportMode>("trip_cards");

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [catalog, setCatalog] = useState<ReportCatalog | null>(null);

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
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);

  const [tabularResult, setTabularResult] = useState<ReportRunResult | null>(
    null,
  );
  const [loadingTabular, setLoadingTabular] = useState(false);
  const [tabularError, setTabularError] = useState<string | null>(null);

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
    fetchReportsCatalog()
      .then(setCatalog)
      .catch(() => setCatalog(null));
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
        setPreviewPaymentSummary(result.paymentSummary || null);
      } catch {
        if (signal?.cancelled) return;
        setPreviewError("Failed to load report preview.");
        setPreviewTrips([]);
        setPreviewPaymentSummary(null);
      } finally {
        if (!signal?.cancelled) setLoadingPreview(false);
      }
    },
    [entityFilter, tripStatus, paymentStatus, dateFilter, tripSource],
  );

  useEffect(() => {
    if (reportMode !== "trip_cards") return;
    const signal = { cancelled: false };
    const t = setTimeout(() => {
      void loadPreview(previewPage, signal);
    }, LIVE_PREVIEW_DEBOUNCE_MS);
    return () => {
      signal.cancelled = true;
      clearTimeout(t);
    };
  }, [previewRequestKey, reportMode, loadPreview, previewPage]);

  const loadTabularFromPreset = useCallback(
    async (preset: ReportPreset) => {
      setReportMode("tabular");
      setActiveCatalogPresetId(preset.id);
      setActiveTripPresetId(null);
      setLoadingTabular(true);
      setTabularError(null);
      try {
        const filters: Record<string, string> = { ...(preset.filters || {}) };
        if (dateFilter.filterMode === "month" && dateFilter.month !== "all_time") {
          filters.month = dateFilter.month;
        } else if (dateFilter.filterMode === "daterange") {
          if (dateFilter.startDate) filters.startDate = dateFilter.startDate;
          if (dateFilter.endDate) filters.endDate = dateFilter.endDate;
        }
        if (entityFilter?.type === "driver") filters.driverId = entityFilter.id;
        if (entityFilter?.type === "vehicle")
          filters.vehicleId = entityFilter.id;
        if (entityFilter?.type === "agency")
          filters.agencyName = entityFilter.name;
        if (entityFilter?.type === "trip")
          filters.search = entityFilter.tripNumber;

        const result = await runReport({
          dataSource: preset.dataSource,
          columns: preset.columns,
          filters,
        });
        setTabularResult(result);
      } catch {
        setTabularError("Failed to run catalog report.");
        setTabularResult(null);
      } finally {
        setLoadingTabular(false);
      }
    },
    [dateFilter, entityFilter],
  );

  const applyTripPreset = (preset: TripReportUiPreset) => {
    setReportMode("trip_cards");
    setActiveTripPresetId(preset.id);
    setActiveCatalogPresetId(null);
    setTabularResult(null);
    setTripSource(preset.tripSource);
    setFieldSelection(preset.fieldSelection);
    if (["paid", "partial", "unpaid"].includes(preset.status)) {
      setPaymentStatus(preset.status);
      setTripStatus("all");
    } else {
      setTripStatus(preset.status);
      setPaymentStatus("all");
    }
    setPreviewPage(1);
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
        paymentSummary: result.paymentSummary,
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
      if (reportMode === "tabular" && tabularResult) {
        downloadReportCsv(tabularResult);
        return;
      }
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
    setActiveTripPresetId(null);
    setActiveCatalogPresetId(null);
    setReportMode("trip_cards");
    setTabularResult(null);
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
    setActiveTripPresetId(null);
  };

  const bumpFilters = () => {
    setPreviewPage(1);
    setActiveTripPresetId(null);
    setActiveCatalogPresetId(null);
    if (reportMode === "tabular") {
      setReportMode("trip_cards");
      setTabularResult(null);
    }
  };

  const filterSummary = reportFilterSubtitle(entityFilter, dateFilter, {
    tripStatus,
    paymentStatus,
  });
  const visibleFields = visibleReportFields(tripSource);
  const selectedFieldCount = countSelectedFields(fieldSelection);
  const hasPreviewData =
    reportMode === "trip_cards"
      ? previewTrips.length > 0
      : Boolean(tabularResult?.rows.length);
  const isBusy = loadingPreview || loadingTabular || generatingPdf || exportingCsv;

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
      const [y, m] = month.split("-");
      const d = new Date(Number(y), Number(m) - 1, 1);
      chips.push({
        key: "period",
        label: d.toLocaleString("en-IN", { month: "short", year: "numeric" }),
      });
    } else if (filterMode === "daterange" && (startDate || endDate)) {
      chips.push({
        key: "period",
        label: `${startDate || "…"} → ${endDate || "…"}`,
      });
    }
    if (reportMode === "trip_cards") {
      chips.push({ key: "cols", label: `${selectedFieldCount} columns` });
    }
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
    reportMode,
    selectedFieldCount,
  ]);

  const statusLabel = isBusy
    ? "Refreshing"
    : hasPreviewData
      ? "Ready to export"
      : "Awaiting data";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-main)]">
      {/* Command bar */}
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
              Configure scope · live document preview · export PDF or CSV
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={
                exportingCsv ||
                (reportMode === "trip_cards"
                  ? loadingPreview && !hasPreviewData
                  : loadingTabular || !tabularResult)
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#243049] dark:bg-[#0e1524] dark:text-slate-200 dark:hover:bg-white/5"
            >
              {exportingCsv ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Table2 className="h-3.5 w-3.5" />
              )}
              CSV
            </button>

            {reportMode === "trip_cards" && (
              <button
                type="button"
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                {generatingPdf ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5" />
                )}
                Export PDF
              </button>
            )}
          </div>
        </div>

        {criteriaChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 px-4 py-2 sm:px-5 dark:border-[#1e2638]">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
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
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Builder rail */}
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
              <SectionLabel index="01" title="Templates" />
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {TRIP_REPORT_UI_PRESETS.map((p) => {
                  const active = activeTripPresetId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyTripPreset(p)}
                      className={`flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                          : "border-slate-200/90 bg-white hover:border-slate-300 dark:border-[#243049] dark:bg-[#0b1220] dark:hover:border-slate-600"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          active
                            ? "border-white/40 bg-white/10 dark:border-slate-900/30 dark:bg-slate-900/5"
                            : "border-slate-200 dark:border-[#243049]"
                        }`}
                      >
                        {active && <Check className="h-2.5 w-2.5" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12px] font-semibold leading-tight">
                          {p.name}
                        </span>
                        <span
                          className={`mt-0.5 block text-[10px] leading-snug ${
                            active
                              ? "text-white/70 dark:text-slate-600"
                              : "text-slate-400"
                          }`}
                        >
                          {p.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {catalog?.presets.map((p) => {
                  const active = activeCatalogPresetId === p.id;
                  return (
                    <button
                      key={`cat-${p.id}`}
                      type="button"
                      onClick={() => void loadTabularFromPreset(p)}
                      className={`flex w-full items-start gap-2.5 rounded-lg border border-dashed px-2.5 py-2 text-left transition ${
                        active
                          ? "border-slate-700 bg-slate-800 text-white dark:border-slate-300 dark:bg-slate-200 dark:text-slate-900"
                          : "border-slate-300 bg-transparent hover:border-slate-400 dark:border-[#2a3448]"
                      }`}
                    >
                      <Table2
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                          active ? "opacity-80" : "text-slate-400"
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="block text-[12px] font-semibold leading-tight">
                          {p.name}
                        </span>
                        <span
                          className={`mt-0.5 block font-mono text-[10px] ${
                            active
                              ? "text-white/60 dark:text-slate-600"
                              : "text-slate-400"
                          }`}
                        >
                          {p.dataSource}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <SectionLabel index="02" title="Scope" />
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
                      value={tripStatus}
                      onChange={(e) => {
                        setTripStatus(e.target.value);
                        bumpFilters();
                      }}
                      className={fieldCls}
                    >
                      {TRIP_STATUS_OPTIONS.map((o) => (
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
              <SectionLabel index="03" title="Period" />
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Month</label>
                  <select
                    value={
                      filterMode === "daterange" ? CUSTOM_DATE_VALUE : month
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === CUSTOM_DATE_VALUE) {
                        setFilterMode("daterange");
                        setMonth("");
                        bumpFilters();
                        return;
                      }
                      setMonth(v || currentMonth);
                      setFilterMode("month");
                      setStartDate("");
                      setEndDate("");
                      bumpFilters();
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
                {filterMode === "daterange" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>From</label>
                      <DatePicker
                        value={startDate}
                        onChange={(v) => {
                          setStartDate(v);
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

            {reportMode === "trip_cards" && (
              <section>
                <SectionLabel
                  index="04"
                  title="Columns"
                  action={
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFieldSelection(
                            defaultReportFieldSelection(tripSource),
                          );
                          setActiveTripPresetId(null);
                        }}
                        className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        Defaults
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFieldSelection(selectionForAllVisible(tripSource));
                          setActiveTripPresetId(null);
                        }}
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
            )}
          </div>
        </aside>

        {/* Preview stage */}
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
            <div
              className={`w-full space-y-2.5 p-3 sm:p-4 ${
                reportMode === "trip_cards"
                  ? "mx-auto max-w-[720px] xl:max-w-[820px]"
                  : "max-w-full"
              }`}
            >
              {/* KPI strip */}
              {reportMode === "trip_cards" && previewPaymentSummary && (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <MetricTile
                    label="Records"
                    value={previewPagination.total.toLocaleString("en-IN")}
                  />
                  <MetricTile
                    label="Billed"
                    value={fmtMoney(previewPaymentSummary.totalAmount)}
                  />
                  <MetricTile
                    label="Collected"
                    value={fmtMoney(previewPaymentSummary.totalPaid)}
                    tone="good"
                  />
                  <MetricTile
                    label="Outstanding"
                    value={fmtMoney(previewPaymentSummary.totalOutstanding)}
                    tone="warn"
                  />
                </div>
              )}

              {reportMode === "tabular" && tabularResult && (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  <MetricTile
                    label="Rows"
                    value={tabularResult.meta.rowCount.toLocaleString("en-IN")}
                  />
                  <MetricTile
                    label="Matched"
                    value={tabularResult.meta.totalMatched.toLocaleString(
                      "en-IN",
                    )}
                  />
                  <MetricTile
                    label="Source"
                    value={tabularResult.dataSource.replace(/_/g, " ")}
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {reportMode === "tabular"
                      ? "Data grid output"
                      : "Document preview"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {reportMode === "tabular" && tabularResult
                      ? `${tabularResult.meta.rowCount} rows · ${tabularResult.dataSource}`
                      : filterSummary ||
                        "Adjust builder controls — preview refreshes live"}
                  </p>
                </div>
                {(loadingPreview || loadingTabular) && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Syncing…
                  </span>
                )}
              </div>

              {previewError && reportMode === "trip_cards" && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {previewError}
                </div>
              )}
              {tabularError && reportMode === "tabular" && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {tabularError}
                </div>
              )}

              {reportMode === "trip_cards" &&
                loadingPreview &&
                previewTrips.length === 0 && (
                  <div className="flex justify-center py-20">
                    <RefreshCw className="h-7 w-7 animate-spin text-slate-400" />
                  </div>
                )}

              {reportMode === "trip_cards" &&
                !loadingPreview &&
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
                      Reset builder
                    </button>
                  </div>
                )}

              {reportMode === "trip_cards" && previewTrips.length > 0 && (
                <div className="space-y-3">
                  <div
                    className={`transition-opacity ${
                      loadingPreview ? "opacity-55" : "opacity-100"
                    }`}
                  >
                    <TripReportPreviewDocument
                      trips={previewTrips}
                      totalTrips={previewPagination.total}
                      fieldSelection={fieldSelection}
                      tripIndexOffset={
                        (previewPagination.page - 1) * PREVIEW_LIMIT
                      }
                      title="Trip History Report"
                      subtitle={filterSummary || undefined}
                      resolveAgencyLabel={resolveAgencyLabel}
                      paymentSummary={
                        tripSource === "bulk"
                          ? previewPaymentSummary
                          : undefined
                      }
                      pageNote={
                        previewPagination.pages > 1
                          ? `Preview page ${previewPagination.page} of ${previewPagination.pages}. PDF export includes all ${previewPagination.total} trips.`
                          : undefined
                      }
                    />
                  </div>
                  <PaginationBar
                    p={previewPagination}
                    onChange={(p) => setPreviewPage(p)}
                  />
                </div>
              )}

              {reportMode === "tabular" && loadingTabular && (
                <div className="flex justify-center py-20">
                  <RefreshCw className="h-7 w-7 animate-spin text-slate-400" />
                </div>
              )}

              {reportMode === "tabular" &&
                !loadingTabular &&
                tabularResult &&
                tabularResult.rows.length === 0 && (
                  <div className="mx-auto max-w-md rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-14 text-center dark:border-[#243049] dark:bg-[#0e1524]/70">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      No rows for this template
                    </p>
                  </div>
                )}

              {reportMode === "tabular" &&
                !loadingTabular &&
                tabularResult &&
                tabularResult.rows.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_20px_40px_-20px_rgba(15,23,42,0.35)] dark:border-[#243049] dark:bg-[#0e1524]">
                    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-[#1e2638]">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
                        Grid · {tabularResult.headers.length} cols
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {new Date(
                          tabularResult.meta.generatedAt,
                        ).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-[13px]">
                        <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:border-[#1e2638] dark:bg-[#0b1220] dark:text-slate-400">
                          <tr>
                            {tabularResult.headers.map((h) => (
                              <th
                                key={h.id}
                                className="whitespace-nowrap px-3 py-2.5"
                              >
                                {h.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tabularResult.rows.map((row, i) => (
                            <tr
                              key={i}
                              className="border-b border-slate-100 text-slate-700 odd:bg-white even:bg-slate-50/50 dark:border-[#1e2638] dark:text-slate-200 dark:odd:bg-transparent dark:even:bg-white/[0.02]"
                            >
                              {tabularResult.headers.map((h) => (
                                <td
                                  key={h.id}
                                  className="whitespace-nowrap px-3 py-2 tabular-nums"
                                >
                                  {h.type === "currency"
                                    ? fmtMoney(Number(row[h.id]) || 0)
                                    : String(row[h.id] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                        {Object.keys(tabularResult.totals).length > 0 && (
                          <tfoot>
                            <tr className="bg-slate-900 text-[12px] font-semibold text-white dark:bg-white dark:text-slate-900">
                              {tabularResult.headers.map((h, idx) => (
                                <td
                                  key={h.id}
                                  className="px-3 py-2.5 tabular-nums"
                                >
                                  {tabularResult.totals[h.id] != null
                                    ? h.type === "currency"
                                      ? fmtMoney(tabularResult.totals[h.id])
                                      : tabularResult.totals[h.id]
                                    : idx === 0
                                      ? "TOTAL"
                                      : ""}
                                </td>
                              ))}
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                    {tabularResult.meta.truncated && (
                      <p className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                        Truncated to {tabularResult.meta.rowCount} of{" "}
                        {tabularResult.meta.totalMatched} matched rows.
                      </p>
                    )}
                  </div>
                )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
