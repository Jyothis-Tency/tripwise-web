import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileDown,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import {
  fetchTripHistory,
  type HistoryTrip,
  type HistoryPagination,
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
      <span className="text-xs text-slate-500">
        Page {p.page}/{p.pages} · {p.total} trips
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!p.hasPrev}
          onClick={() => onChange(p.page - 1)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <button
          type="button"
          disabled={!p.hasNext}
          onClick={() => onChange(p.page + 1)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
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

  // Trip number suggestions for search dropdown
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
        setPreviewLoaded(true);
      } catch {
        setPreviewError("Failed to load report preview.");
        setPreviewTrips([]);
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

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Trip Reports</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Filter trips, preview the PDF layout, then export
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={loadingPreview}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
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
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
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

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Filters — left */}
        <aside className="w-full shrink-0 border-b border-slate-200 bg-white lg:w-[320px] xl:w-[360px] lg:border-b-0 lg:border-r overflow-y-auto">
          <div className="space-y-4 p-4 sm:p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Report filters
            </h2>

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
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Trip Source
                </label>
                <div className="flex rounded-lg border border-slate-200 bg-slate-50/50 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTripSource("vehicle");
                      setFieldSelection(defaultReportFieldSelection("vehicle"));
                      setPreviewLoaded(false);
                    }}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      tripSource === "vehicle"
                        ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50"
                        : "text-slate-600 hover:text-slate-900"
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
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      tripSource === "bulk"
                        ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Bulk Entry
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPreviewLoaded(false);
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Month
                </label>
                <select
                  value={filterMode === "month" ? month : ""}
                  onChange={(e) => {
                    setMonth(e.target.value || currentMonth);
                    setFilterMode("month");
                    setStartDate("");
                    setEndDate("");
                    setPreviewLoaded(false);
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-400"
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
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setFilterMode("daterange");
                      setMonth("");
                      setPreviewLoaded(false);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    End date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setFilterMode("daterange");
                      setMonth("");
                      setPreviewLoaded(false);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Select a driver, vehicle, agency, or trip number from search to
              narrow the report. Leave empty for all trips in the date range.
            </p>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold text-slate-700">
                  Report fields
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFieldSelection(defaultReportFieldSelection());
                      setPreviewLoaded(false);
                    }}
                    className="text-xs font-medium text-slate-600 hover:text-blue-600"
                  >
                    Reset defaults
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const all = {} as ReportFieldSelection;
                      const bulkOnlyFields = ["advance", "balance", "toll", "notes", "vehicleType", "mobileNumber"];
                      const vehicleOnlyFields = ["from", "to", "customer", "startKilometers", "startTime", "totalKm", "totalTime"];
                      for (const f of REPORT_FIELD_DEFS) {
                        if (tripSource === "bulk" && vehicleOnlyFields.includes(f.id)) continue;
                        if (tripSource === "vehicle" && bulkOnlyFields.includes(f.id)) continue;
                        all[f.id] = true;
                      }
                      setFieldSelection(all);
                      setPreviewLoaded(false);
                    }}
                    className="text-xs font-medium text-slate-600 hover:text-blue-600"
                  >
                    Select all
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {REPORT_FIELD_DEFS.filter(f => {
                  const bulkOnlyFields = ["advance", "balance", "toll", "notes", "vehicleType", "mobileNumber"];
                  const vehicleOnlyFields = ["from", "to", "customer", "startKilometers", "startTime", "totalKm", "totalTime"];
                  if (tripSource === "bulk" && vehicleOnlyFields.includes(f.id)) return false;
                  if (tripSource === "vehicle" && bulkOnlyFields.includes(f.id)) return false;
                  return true;
                }).map((f) => (
                  <label
                    key={f.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-sm text-slate-700 cursor-pointer hover:border-blue-200 hover:bg-blue-50/50 has-checked:border-blue-300 has-checked:bg-blue-50"
                  >
                    <input
                      type="checkbox"
                      checked={fieldSelection[f.id]}
                      onChange={() => toggleReportField(f.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                    />
                    <span className="truncate">{f.label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Checked fields appear in the preview and PDF. Trip number is
                always shown on each card.
              </p>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Clear all filters
            </button>
          </div>
        </aside>

        {/* Preview — right */}
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-slate-100/80">
          <div className="space-y-3 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Report preview
              </h2>
              {previewLoaded && (
                <span className="text-xs text-slate-500 tabular-nums">
                  {previewPagination.total} trip
                  {previewPagination.total === 1 ? "" : "s"}
                  {filterSummary ? ` · ${filterSummary}` : ""}
                </span>
              )}
            </div>

            {!previewLoaded && !loadingPreview && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
                <Eye className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-600">
                  No preview yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Set filters and click &quot;Preview report&quot; to see trips
                  here before exporting PDF.
                </p>
              </div>
            )}

            {loadingPreview && (
              <div className="flex justify-center py-16">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            )}

            {previewError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {previewError}
              </div>
            )}

            {previewLoaded && !loadingPreview && previewTrips.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-sm text-slate-600">No trips match these filters.</p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 text-sm font-medium text-blue-600 hover:underline"
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
