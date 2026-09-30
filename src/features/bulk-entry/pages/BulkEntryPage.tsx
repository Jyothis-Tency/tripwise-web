import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from "react";
import {
  Plus,
  Trash2,
  // ArrowLeft, // used by disabled Payout UI
  ChevronDown,
  FileSpreadsheet,
  Building2,
  X,
  RefreshCw,
  Loader2,
  Cloud,
  CloudOff,
  Copy,
  CheckCircle,
  // Wallet, // used by disabled Payout UI
  FileDown,
  ListChecks,
  Search,
  FileText,
  Settings2,
} from "lucide-react";
import jsPDF from "jspdf";
import { useAuth } from "../../../hooks/useAuth";
import { authApi } from "../../auth/api";
import { TimePicker12h } from "../../../components/ui/TimePicker12h";
import { normalizeHHmm } from "../../../lib/timePickerUtils";
import { CreateAgencyModal } from "../../../components/AgencyNameCombobox";
import { DriverNameCombobox } from "../../../components/DriverNameCombobox";
import { driverDisplayName } from "../../../lib/driverDisplay";
import type { Driver } from "../../drivers/api";
import {
  fetchAllAgencies,
  formatAgencyLabel,
  fetchAllBulkEntryTrips,
  fetchAllNormalEntryTrips,
  deleteBulkEntryTrip,
  deleteNormalEntryTrip,
  syncBulkEntry,
  syncNormalEntry,
  fetchAgencyPayoutSummary,
  addAgencyPayoutPayment,
  deletePayoutPayment,
  fetchDriverPayoutSummary,
  addDriverPayoutPayment,
  type Agency,
  type DriverGroup,
  type BulkTripRow,
  type NormalEntryRow,
  type AgencyTrip,
  type AgencyPayoutSummary,
  type DriverPayoutSummary,
  type PayoutPayment,
} from "../api";
import {
  GuestInvitesPanel,
  GuestLinkButton,
} from "../../guest-bulk/components/GuestInvitesPanel";
import { fetchGuestBulkInvites } from "../../guest-bulk/api";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

let _rowCounter = 0;
function nextRowId() {
  return `r_${Date.now()}_${++_rowCounter}`;
}

function nextGroupId() {
  return `g_${Date.now()}_${++_rowCounter}`;
}

function emptyBulkRow(): BulkTripRow {
  return {
    clientRowId: nextRowId(),
    startDate: "",
    endDate: "",
    startKm: "",
    endKm: "",
    startTime: "",
    endTime: "",
    distance: 0,
    hours: 0,
    toll: 0,
    advancePaid: 0,
    grandTotal: 0,
    notes: "",
  };
}

function emptyDriverGroup(): DriverGroup {
  return {
    clientGroupId: nextGroupId(),
    driverName: "",
    vehicleNumber: "",
    rows: [emptyBulkRow()],
    groupCreatedAt: new Date().toISOString(),
  };
}

function objectIdTimeMs(id?: string): number {
  if (!id || String(id).length < 8) return 0;
  try {
    return parseInt(String(id).slice(0, 8), 16) * 1000;
  } catch {
    return 0;
  }
}

/** When a driver/vehicle group was created (for page-level newest/oldest sort). */
function groupCreatedAtMs(g: DriverGroup): number {
  if (g.groupCreatedAt) {
    const t = new Date(g.groupCreatedAt).getTime();
    if (Number.isFinite(t)) return t;
  }
  let earliest = Number.POSITIVE_INFINITY;
  for (const r of g.rows) {
    const fromRow = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
    const t = Number.isFinite(fromRow) && fromRow > 0 ? fromRow : objectIdTimeMs(r._id);
    if (t > 0 && t < earliest) earliest = t;
  }
  return earliest === Number.POSITIVE_INFINITY ? 0 : earliest;
}

/** True if a bulk row has anything worth keeping/syncing (not a blank placeholder). */
function bulkRowHasData(r: Partial<BulkTripRow> | null | undefined): boolean {
  if (!r) return false;
  return !!(
    r._id ||
    String(r.startDate ?? "").trim() ||
    String(r.endDate ?? "").trim() ||
    String(r.startKm ?? "").trim() ||
    String(r.endKm ?? "").trim() ||
    String(r.startTime ?? "").trim() ||
    String(r.endTime ?? "").trim() ||
    Number(r.grandTotal) ||
    Number(r.advancePaid) ||
    Number(r.toll) ||
    String(r.notes ?? "").trim()
  );
}

type EntryFilterStatus = "all" | "pending" | "completed";
type EntrySortDir = "desc" | "asc";

const entryFilterFieldCls =
  "rounded-[10px] border border-slate-200 bg-[var(--bg-card)] px-2.5 py-2 text-xs text-slate-800 outline-none dark:border-[#252c4d] dark:bg-[#151b34] dark:text-[#eef0ff]";

function entryDateInRange(
  dateStr: string | undefined,
  from: string,
  to: string,
): boolean {
  if (!from && !to) return true;
  const d = String(dateStr ?? "").trim();
  // Keep undated drafts visible while filtering
  if (!d) return true;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function entryStatusHidden(
  isCompleted: boolean | undefined,
  status: EntryFilterStatus,
): boolean {
  if (status === "pending") return !!isCompleted;
  if (status === "completed") return !isCompleted;
  return false;
}

function EntryActivePill({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-[#242a57] dark:text-[#a5b4fc]"
    >
      {label}
      <X className="h-3 w-3" />
    </button>
  );
}

/** Transaction History–style search + filters bar for Bulk / Normal entry. */
function EntryFiltersBar({
  title,
  count,
  search,
  onSearchChange,
  searchPlaceholder,
  sortDir,
  onSortDirChange,
  filtersOpen,
  onFiltersOpenChange,
  filterStatus,
  onFilterStatusChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  compact = false,
  showDateFilters = true,
  sortNewestLabel = "↓ Newest",
  sortOldestLabel = "↑ Oldest",
  defaultSortDir = "desc",
  endAction,
}: {
  title: string;
  count: number;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  sortDir: EntrySortDir;
  onSortDirChange: (v: EntrySortDir) => void;
  filtersOpen: boolean;
  onFiltersOpenChange: (v: boolean) => void;
  filterStatus: EntryFilterStatus;
  onFilterStatusChange: (v: EntryFilterStatus) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  /** Nested under a driver card — flatter chrome. */
  compact?: boolean;
  /** Page-level driver bar can hide date range (dates live on per-driver filters). */
  showDateFilters?: boolean;
  sortNewestLabel?: string;
  sortOldestLabel?: string;
  /** Neutral sort direction for “Clear” / active-filter detection. */
  defaultSortDir?: EntrySortDir;
  /** Right-side action (e.g. Download PDF) inside the bar. */
  endAction?: ReactNode;
}) {
  const filterBadgeCount =
    (filterStatus !== "all" ? 1 : 0) +
    (showDateFilters && (dateFrom || dateTo) ? 1 : 0);
  const hasActiveFilters =
    filterBadgeCount > 0 ||
    !!search.trim() ||
    sortDir !== defaultSortDir;

  const clearFilters = () => {
    onFilterStatusChange("all");
    if (showDateFilters) {
      onDateFromChange("");
      onDateToChange("");
    }
    onSearchChange("");
    onSortDirChange(defaultSortDir);
  };

  return (
    <div
      className={
        compact
          ? "border-b border-slate-100 bg-[var(--bg-card)] dark:border-[#1e2638]"
          : "overflow-hidden rounded-2xl border border-slate-200 bg-[var(--bg-card)] dark:border-[#252c4d]"
      }
    >
      <div
        className={`flex flex-wrap items-center gap-2 ${
          compact ? "px-3 py-2.5 sm:px-4" : "gap-2.5 px-4 py-3.5"
        }`}
      >
        <h3
          className={`font-extrabold text-slate-900 dark:text-[#eef0ff] ${
            compact ? "text-sm" : "text-base"
          }`}
        >
          {title}
        </h3>
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-600 dark:bg-[#242a57] dark:text-[#a5b4fc]">
          {count}
        </span>
        <label className="flex w-36 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-[var(--bg-main)] px-2.5 sm:w-44 dark:border-[#252c4d]">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder ?? "Search…"}
            className="w-full min-w-0 border-0 bg-transparent py-1.5 text-sm outline-none dark:text-[#eef0ff]"
          />
          {search.trim() ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
        <button
          type="button"
          onClick={() =>
            onSortDirChange(sortDir === "desc" ? "asc" : "desc")
          }
          className="rounded-[10px] border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-[var(--bg-main)] dark:border-[#252c4d] dark:text-[#8d94b8]"
          title="Change sort order"
        >
          {sortDir === "desc" ? sortNewestLabel : sortOldestLabel}
        </button>
        <button
          type="button"
          onClick={() => onFiltersOpenChange(!filtersOpen)}
          aria-expanded={filtersOpen}
          className={`inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-xs font-semibold transition ${
            filtersOpen || filterBadgeCount
              ? "border-indigo-500 bg-indigo-50 text-indigo-600 dark:border-indigo-400 dark:bg-[#242a57] dark:text-[#a5b4fc]"
              : "border-slate-200 text-slate-500 hover:bg-[var(--bg-main)] dark:border-[#252c4d] dark:text-[#8d94b8]"
          }`}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Filters
          {filterBadgeCount > 0 && (
            <em className="not-italic rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white">
              {filterBadgeCount}
            </em>
          )}
        </button>
        {endAction ? (
          <div className="ml-auto flex shrink-0 items-center">{endAction}</div>
        ) : null}
      </div>

      {!filtersOpen && filterBadgeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2 sm:px-4">
          {filterStatus !== "all" && (
            <EntryActivePill
              label={
                filterStatus === "pending" ? "Pending" : "Completed"
              }
              onClear={() => onFilterStatusChange("all")}
            />
          )}
          {showDateFilters && (dateFrom || dateTo) && (
            <EntryActivePill
              label={`${dateFrom || "…"} → ${dateTo || "…"}`}
              onClear={() => {
                onDateFromChange("");
                onDateToChange("");
              }}
            />
          )}
          <button
            type="button"
            onClick={clearFilters}
            className="ml-1 text-xs font-bold text-indigo-600 dark:text-[#a5b4fc]"
          >
            Clear all
          </button>
        </div>
      )}

      {filtersOpen && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-[var(--bg-main)] px-3 py-2 sm:px-4 dark:border-[#252c4d]">
          {showDateFilters && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                aria-label="From date"
                className={entryFilterFieldCls}
              />
              <span>→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                aria-label="To date"
                className={entryFilterFieldCls}
              />
            </div>
          )}
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-[var(--bg-card)] p-1 dark:border-[#252c4d]">
            {(
              [
                ["all", "All"],
                ["pending", "Pending"],
                ["completed", "Done"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => onFilterStatusChange(k)}
                className={`rounded-[9px] px-3 py-1.5 text-xs font-semibold transition ${
                  filterStatus === k
                    ? k === "pending"
                      ? "bg-[var(--bg-main)] text-amber-600 shadow-sm dark:text-amber-400"
                      : k === "completed"
                        ? "bg-[var(--bg-main)] text-emerald-600 shadow-sm dark:text-emerald-400"
                        : "bg-[var(--bg-main)] text-indigo-600 shadow-sm dark:text-[#a5b4fc]"
                    : "text-slate-500 dark:text-[#8d94b8]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto text-xs font-bold text-indigo-600 dark:text-[#a5b4fc]"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type GroupLocalFilter = {
  search: string;
  filtersOpen: boolean;
  filterStatus: EntryFilterStatus;
  dateFrom: string;
  dateTo: string;
  sortDir: EntrySortDir;
};

function defaultGroupLocalFilter(): GroupLocalFilter {
  return {
    search: "",
    filtersOpen: false,
    filterStatus: "all",
    dateFrom: "",
    dateTo: "",
    // Trips in a driver card: oldest start date first
    sortDir: "asc",
  };
}

function groupFilterStorageKey(g: DriverGroup, gi: number): string {
  if (g.clientGroupId) return `cg:${g.clientGroupId}`;
  const driver = (g.driverName || "").trim().toLowerCase();
  const vehicle = (g.vehicleNumber || "").trim().toUpperCase();
  if (driver || vehicle) return `${driver}|||${vehicle}`;
  return `gi:${gi}`;
}

function rowMatchesLocalSearch(r: BulkTripRow, q: string): boolean {
  if (!q) return true;
  const hay = [
    r.notes,
    r.startDate,
    r.endDate,
    r.startTime,
    r.endTime,
    String(r.startKm ?? ""),
    String(r.endKm ?? ""),
    String(r.distance ?? ""),
    String(r.hours ?? ""),
    String(r.grandTotal ?? ""),
    String(r.advancePaid ?? ""),
    String(r.toll ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/** Day segment for bulk advance rules (matches backend `bulkEntryGroupKey`). */
function bulkRowDayKey(startDate: string): string {
  const raw = String(startDate ?? "").trim();
  if (!raw) return "";
  const t = new Date(`${raw}T00:00:00`).getTime();
  if (!Number.isFinite(t)) return raw;
  return new Date(t).toISOString().slice(0, 10);
}

function bulkRowDateMs(startDate: string): number {
  const key = bulkRowDayKey(startDate);
  if (!key) return Number.POSITIVE_INFINITY;
  const t = new Date(`${key}T00:00:00`).getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

/** Oldest start date first; blank dates last. Same date: lower start KM first. */
function sortBulkRowsByDate(rows: BulkTripRow[]): BulkTripRow[] {
  return [...rows].sort((a, b) => {
    const da = bulkRowDateMs(a.startDate ?? "");
    const db = bulkRowDateMs(b.startDate ?? "");
    if (da !== db) return da - db;
    const ka = Number(a.startKm) || 0;
    const kb = Number(b.startKm) || 0;
    if (ka !== kb) return ka - kb;
    return String(a.clientRowId ?? "").localeCompare(
      String(b.clientRowId ?? ""),
    );
  });
}

/** Advance is editable only on the first row for each calendar day in a driver group. */
function isAdvanceEditableRow(rows: BulkTripRow[], ri: number): boolean {
  if (ri < 0 || ri >= rows.length) return false;
  const dayKey = bulkRowDayKey(rows[ri].startDate ?? "");
  const firstForDay = rows.findIndex(
    (r) => bulkRowDayKey(r.startDate ?? "") === dayKey,
  );
  return firstForDay === ri;
}

function advanceFieldTitle(
  rows: BulkTripRow[],
  ri: number,
): string | undefined {
  if (isAdvanceEditableRow(rows, ri)) return undefined;
  const dayKey = bulkRowDayKey(rows[ri]?.startDate ?? "");
  if (!dayKey) {
    return "Enter advance on the first row in this group (or set a start date on this row)";
  }
  return "Advance is on the first trip row for this date — one advance per day";
}

function normalizeBulkGroups(groups: any[]): DriverGroup[] {
  return (groups || []).map((group) => {
    const fallbackAdvance = Number(group?.advancePaid) || 0;
    const rows = Array.isArray(group?.rows) ? group.rows : [];
    const mappedRows = rows.length
      ? rows.map((row: any, idx: number) => ({
          ...emptyBulkRow(),
          ...row,
          // Always keep a non-empty clientRowId (empty string breaks React keys)
          clientRowId: String(row?.clientRowId || "").trim() || nextRowId(),
          advancePaid:
            row?.advancePaid !== undefined
              ? Number(row.advancePaid) || 0
              : idx === 0
                ? fallbackAdvance
                : 0,
        }))
      : [emptyBulkRow()];
    return {
      clientGroupId: String(group?.clientGroupId || "").trim() || nextGroupId(),
      driverName: group?.driverName || "",
      driverId: group?.driverId,
      driverPhone: group?.driverPhone,
      vehicleNumber: group?.vehicleNumber || "",
      rows: sortBulkRowsByDate(mappedRows),
      groupCreatedAt:
        group?.groupCreatedAt ||
        (mappedRows.some((r: BulkTripRow) => r._id || r.createdAt)
          ? new Date(
              groupCreatedAtMs({
                driverName: "",
                vehicleNumber: "",
                rows: mappedRows,
              }) || Date.now(),
            ).toISOString()
          : new Date().toISOString()),
    };
  });
}

function emptyNormalRow(): NormalEntryRow {
  return {
    clientRowId: nextRowId(),
    date: "",
    driverName: "",
    mobileNumber: "",
    vehicleNumber: "",
    vehicleType: "",
    notes: "",
  };
}

const VEHICLE_TYPE_OPTIONS = [
  "Sedan",
  "SUV",
  "Hatchback",
  "Van",
  "Truck / Van",
  "Other",
] as const;

const plateInputCls =
  "font-mono font-semibold uppercase tracking-wider !text-amber-700 dark:!text-amber-300";

const actionBtnCls =
  "flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-[var(--bg-elevated)] text-slate-400 transition hover:border-slate-300 dark:border-[#1e2638] dark:hover:border-white/15";

function VehicleTypeSelect({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const known = (VEHICLE_TYPE_OPTIONS as readonly string[]).includes(value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full appearance-none rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2.5 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100 ${className}`}
    >
      <option value="">Select</option>
      {!known && value ? <option value={value}>{value}</option> : null}
      {VEHICLE_TYPE_OPTIONS.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOSAVE ENGINE — Excel-like dual-layer persistence
// ═══════════════════════════════════════════════════════════════════════════════

type SyncStatus = "idle" | "saving" | "saved" | "error";

const LS_BULK_PREFIX = "tripwise_bulk_";
const LS_NORMAL_PREFIX = "tripwise_normal_";
const LS_SELECTED_AGENCY = "tripwise_bulk_selected_agency";
const LS_ENTRY_MODE = "tripwise_bulk_entry_mode"; // 'bulk' | 'normal'
const AUTOSAVE_DELAY = 800; // ms after last keystroke

// Mirror of backend AgencyTrip.calculateBalance (non-negative balance)
function calculateBalanceAmount(
  grandTotal: number,
  advancePaid: number,
): number {
  const gt =
    typeof grandTotal === "number"
      ? grandTotal
      : parseFloat(String(grandTotal)) || 0;
  const adv =
    typeof advancePaid === "number"
      ? advancePaid
      : parseFloat(String(advancePaid)) || 0;
  return Math.max(gt - adv, 0);
}

/** Simple hash for fast equality check */
function quickHash(s: string): string {
  if (!s) return "empty";
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return `${s.length}_${h}`;
}

function useAutosave<T>(
  key: string | null,
  data: T,
  serialize: (d: T) => string,
  onBackendSync: (d: T) => Promise<void>,
) {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const lastLocalHash = useRef<string>("");
  const lastBackendHash = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset hashes when key changes
  useEffect(() => {
    lastLocalHash.current = "";
    lastBackendHash.current = "";
    setStatus("idle");
  }, [key]);

  // Main autosave effect
  useEffect(() => {
    if (!key) return;

    const json = serialize(data);
    const hash = quickHash(json);

    // 1. Instant localStorage persistence
    if (hash !== lastLocalHash.current) {
      try {
        localStorage.setItem(key, json);
      } catch {
        /* quota exceeded */
      }
      lastLocalHash.current = hash;
    }

    // 2. Debounced backend sync
    if (timerRef.current) clearTimeout(timerRef.current);

    if (hash !== lastBackendHash.current) {
      timerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        setStatus("saving");
        try {
          await onBackendSync(dataRef.current);
          if (mountedRef.current) {
            lastBackendHash.current = quickHash(serialize(dataRef.current));
            setStatus("saved");
            // Fade back to idle after 2s
            setTimeout(() => {
              if (mountedRef.current) setStatus("idle");
            }, 2000);
          }
        } catch {
          if (mountedRef.current) {
            setStatus("error");
            // Retry on next edit by not updating backend hash
          }
        }
      }, AUTOSAVE_DELAY);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key, data, serialize, onBackendSync]);

  return status;
}

function loadFromLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* corrupted */
  }
  return fallback;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

function SyncBadge({ status }: { status: SyncStatus }) {
  if (status === "idle") return null;
  const cfg = {
    saving: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      text: "Saving…",
      cls: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20",
    },
    saved: {
      icon: <Cloud className="h-4 w-4" />,
      text: "Saved",
      cls: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20",
    },
    error: {
      icon: <CloudOff className="h-4 w-4" />,
      text: "Offline",
      cls: "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20",
    },
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold transition-all sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs ${cfg.cls}`}
    >
      <span className="[&_svg]:h-3.5 [&_svg]:w-3.5 sm:[&_svg]:h-4 sm:[&_svg]:w-4">
        {cfg.icon}
      </span>
      {cfg.text}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL SHELL
// ═══════════════════════════════════════════════════════════════════════════════

function ModalShell({
  title,
  onClose,
  children,
  maxWidth = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onClick={(e) => e.target === ref.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 dark:bg-black/60"
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl border border-slate-200 bg-[var(--bg-card)] shadow-2xl flex flex-col max-h-[90vh] dark:border-[#1e2638]`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0 dark:border-[#1e2638]">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PDF REPORT GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

const INR = (v: number) => `Rs. ${v.toLocaleString("en-IN")}`;
const fmtDate = (d: string | Date | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

function drawPDFHeader(
  doc: jsPDF,
  title: string,
  ownerName: string,
  y: number,
  opts?: { metaLabel?: string; metaLineMatchAgency?: boolean },
): number {
  const pw = doc.internal.pageSize.getWidth();

  // Generation Date
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Generated: ${fmtDate(new Date())}`, pw - 20, 20, {
    align: "right",
  });

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(title, 20, y + 35);

  const metaLabel = opts?.metaLabel ?? "Owner";
  if (opts?.metaLineMatchAgency) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(49, 46, 129);
    doc.text(`${metaLabel}: ${ownerName}`, 20, y + 43);
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`${metaLabel}: ${ownerName}`, 20, y + 43);
  }

  return y + 53;
}

function drawSummaryRow(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  bold = false,
) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85); // slate-700
  doc.text(label, 20, y);
  doc.setFont("helvetica", "bold");
  doc.text(value, pw - 20, y, { align: "right" });
  return y + 8;
}

function drawPaymentTable(
  doc: jsPDF,
  payments: PayoutPayment[],
  y: number,
): number {
  const pw = doc.internal.pageSize.getWidth();
  if (payments.length === 0) return y;

  // Table header
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(20, y - 5, pw - 40, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("#", 25, y + 2);
  doc.text("DATE", 38, y + 2);
  doc.text("METHOD", 95, y + 2);
  doc.text("NOTES", 135, y + 2);
  doc.text("AMOUNT", pw - 25, y + 2, { align: "right" });
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  payments.forEach((p, i) => {
    // Page break if near bottom
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 20;
    }
    // Alternate row bg
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(20, y - 5, pw - 40, 9, "F");
    }
    doc.setTextColor(51, 65, 85);
    doc.text(String(i + 1), 25, y + 1);
    doc.text(fmtDate(p.paymentDate), 38, y + 1);
    doc.text((p.paymentMethod || "cash").replace("_", " "), 95, y + 1);
    doc.text((p.notes || "—").substring(0, 25), 135, y + 1);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text(INR(p.amount), pw - 25, y + 1, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 9;
  });

  return y;
}

function drawFooter(doc: jsPDF) {
  const ph = doc.internal.pageSize.getHeight();
  const pw = doc.internal.pageSize.getWidth();
  doc.setDrawColor(226, 232, 240);
  doc.line(20, ph - 18, pw - 20, ph - 18);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "This is a computer-generated document. No signature required.",
    pw / 2,
    ph - 10,
    { align: "center" },
  );
}

function generateAgencyPayoutPDF(
  ownerName: string,
  agencyName: string,
  data: AgencyPayoutSummary,
) {
  const doc = new jsPDF("p", "mm", "a4");
  let y = drawPDFHeader(doc, `Agency Payout Report`, ownerName, 0);

  // Agency name + period (must match on-screen filter)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(49, 46, 129);
  doc.text(`Agency: ${agencyName}`, 20, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Period: ${data.monthLabel || "All time"}`, 20, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 20, y);
  y += 10;

  // Separator
  const pw = doc.internal.pageSize.getWidth();
  doc.setDrawColor(226, 232, 240);
  doc.line(20, y - 4, pw - 20, y - 4);

  const advance = data.totalAdvance ?? 0;
  const received = data.totalReceived ?? 0;
  const applied = data.totalApplied ?? advance + received;
  const remaining = data.remaining ?? 0;
  const overpaid = data.overpaid ?? 0;

  // Summary — same ledger as payout screen
  y = drawSummaryRow(doc, "Grand Total", INR(data.grandTotal), y, true);
  y = drawSummaryRow(doc, "Total Advance", INR(advance), y);
  y = drawSummaryRow(doc, "Payments Received", INR(received), y);
  y = drawSummaryRow(
    doc,
    "Balance (Grand Total − Payments)",
    INR(Math.abs((data.grandTotal ?? 0) - received)),
    y,
  );
  y = drawSummaryRow(
    doc,
    "Total Applied (Advance + Payments)",
    INR(applied),
    y,
  );
  y = drawSummaryRow(doc, "Remaining Balance", INR(remaining), y, true);
  if (overpaid > 0) {
    y = drawSummaryRow(doc, "Surplus / Overpaid", INR(overpaid), y);
  }
  y += 6;

  // Status
  const status =
    remaining <= 0
      ? overpaid > 0
        ? "OVERPAID"
        : "FULLY PAID"
      : applied > 0
        ? "PARTIALLY PAID"
        : "UNPAID";
  const statusColor: [number, number, number] =
    remaining <= 0
      ? [16, 185, 129]
      : applied > 0
        ? [245, 158, 11]
        : [239, 68, 68];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...statusColor);
  doc.text(`Status: ${status}`, 20, y);
  y += 14;

  // Payments table
  if (data.payments.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("Payment History", 20, y);
    y += 8;
    y = drawPaymentTable(doc, data.payments, y);
  }

  drawFooter(doc);
  const periodTag = (data.month || "all_time").replace(/\s+/g, "_");
  doc.save(
    `Payout_${agencyName.replace(/\s+/g, "_")}_${periodTag}_${new Date().toISOString().split("T")[0]}.pdf`,
  );
}

function generateDriverPayoutPDF(
  ownerName: string,
  agencyName: string,
  driverName: string,
  data: DriverPayoutSummary,
) {
  const doc = new jsPDF("p", "mm", "a4");
  let y = drawPDFHeader(doc, `Driver Payout Report`, ownerName, 0);

  // Agency + Driver
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(49, 46, 129);
  doc.text(`Agency: ${agencyName}`, 20, y);
  y += 8;
  doc.setTextColor(30, 41, 59);
  doc.text(`Driver: ${driverName}`, 20, y);
  y += 14;

  const pw = doc.internal.pageSize.getWidth();
  doc.setDrawColor(226, 232, 240);
  doc.line(20, y - 4, pw - 20, y - 4);

  // Summary
  y = drawSummaryRow(
    doc,
    "Total Driver Salary (Advance)",
    INR(data.totalAdvance),
    y,
    true,
  );
  y = drawSummaryRow(doc, "Total Paid", INR(data.totalPaid), y);
  y = drawSummaryRow(doc, "Remaining to Pay", INR(data.remaining), y, true);
  y += 6;

  const status =
    data.remaining <= 0
      ? "FULLY PAID"
      : data.totalPaid > 0
        ? "PARTIALLY PAID"
        : "UNPAID";
  const statusColor: [number, number, number] =
    data.remaining <= 0
      ? [16, 185, 129]
      : data.totalPaid > 0
        ? [245, 158, 11]
        : [239, 68, 68];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...statusColor);
  doc.text(`Status: ${status}`, 20, y);
  y += 14;

  if (data.payments.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("Payment History", 20, y);
    y += 8;
    y = drawPaymentTable(doc, data.payments, y);
  }

  drawFooter(doc);
  doc.save(
    `DriverPayout_${driverName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`,
  );
}

function generateBulkTripsPDF(
  ownerName: string,
  agencyName: string,
  fileName: string,
  groups: DriverGroup[],
) {
  const doc = new jsPDF("l", "mm", "a4"); // 'l' for landscape
  const pw = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const validGroups = groups.filter((g) => g.rows.length > 0);
  const reportGrandTotal = validGroups.reduce(
    (sum, g) =>
      sum + g.rows.reduce((s, r) => s + (Number(r.grandTotal) || 0), 0),
    0,
  );

  let y = drawPDFHeader(doc, `Trip Report`, ownerName, 0, {
    metaLabel: "From",
    metaLineMatchAgency: true,
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(49, 46, 129);
  doc.text(`To: ${agencyName}`, 20, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const grandLabel = "Grand Total: ";
  doc.setTextColor(30, 41, 59);
  doc.text(grandLabel, 20, y);
  doc.setTextColor(16, 185, 129);
  doc.text(INR(reportGrandTotal), 20 + doc.getTextWidth(grandLabel), y);
  y += 14;

  if (validGroups.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text("No trips recorded.", 20, y);
    drawFooter(doc);
    doc.save(fileName);
    return;
  }

  const NOTE_X = 195;
  const totalColReserveMm = 32;
  const maxNotesW = Math.max(24, pw - 20 - totalColReserveMm - NOTE_X);
  const noteLineMm = 4;

  validGroups.forEach((g, driverIdx) => {
    if (y > pageH - 40) {
      doc.addPage();
      y = 20;
    }

    const slNo = driverIdx + 1;
    doc.setFillColor(241, 245, 249);
    doc.rect(20, y - 5, pw - 40, 10, "F");

    const badgeR = slNo >= 100 ? 5.2 : slNo >= 10 ? 4.6 : 4.2;
    const cx = 20 + badgeR + 3;
    const cy = y;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.25);
    doc.circle(cx, cy, badgeR, "FD");

    doc.setFont("helvetica", "bold");
    const badgeFont = slNo >= 100 ? 7 : slNo >= 10 ? 8 : 9;
    doc.setFontSize(badgeFont);
    doc.setTextColor(30, 41, 59);
    const badgeDy = slNo >= 100 ? 1 : slNo >= 10 ? 1.15 : 1.25;
    doc.text(String(slNo), cx, cy + badgeDy, { align: "center" });

    doc.setFontSize(10);
    doc.text(
      `Driver: ${g.driverName || "Unknown"}  |  Vehicle: ${g.vehicleNumber || "Unknown"}`,
      cx + badgeR + 4,
      y + 2,
    );

    y += 12;

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.text("START DATE", 22, y);
    doc.text("START TIME", 45, y);
    doc.text("END DATE", 68, y);
    doc.text("END TIME", 90, y);
    doc.text("START KM", 110, y);
    doc.text("END KM", 130, y);
    doc.text("DIST", 150, y);
    doc.text("HOURS", 165, y);
    doc.text("TOLL", 180, y);
    doc.text("NOTES", 195, y);
    doc.text("TOTAL", pw - 20, y, { align: "right" });
    y += 6;

    let groupGrandTotal = 0;

    g.rows.forEach((r) => {
      groupGrandTotal += r.grandTotal || 0;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const rawNotes = (r.notes || "").trim();
      const noteLines =
        rawNotes.length > 0 ? doc.splitTextToSize(rawNotes, maxNotesW) : ["—"];
      const rowH = Math.max(8, noteLines.length * noteLineMm + 2);

      if (y + rowH > pageH - 25) {
        doc.addPage();
        y = 20;
      }

      doc.setTextColor(51, 65, 85);

      doc.text(fmtDate(r.startDate), 22, y);
      doc.text(r.startTime || "—", 45, y);
      doc.text(fmtDate(r.endDate), 68, y);
      doc.text(r.endTime || "—", 90, y);

      doc.text(String(r.startKm || "—"), 110, y);
      doc.text(String(r.endKm || "—"), 130, y);
      doc.text(`${r.distance || 0} km`, 150, y);
      doc.text(`${r.hours || 0} hr`, 165, y);
      doc.text(INR(r.toll || 0), 180, y);

      let noteY = y;
      for (let li = 0; li < noteLines.length; li++) {
        doc.text(noteLines[li], NOTE_X, noteY);
        noteY += noteLineMm;
      }

      // Total column
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129);
      doc.text(INR(r.grandTotal || 0), pw - 20, y, { align: "right" });

      y += rowH;
    });

    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total: ${INR(groupGrandTotal)}`, pw - 20, y, { align: "right" });

    y += 18;
  });

  drawFooter(doc);
  doc.save(fileName);
}

function generateNormalTripsPDF(
  ownerName: string,
  agencyName: string,
  fileName: string,
  entries: NormalEntryRow[],
) {
  const doc = new jsPDF("l", "mm", "a4"); // landscape
  let y = drawPDFHeader(doc, `Normal Trips Report`, ownerName, 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(49, 46, 129);
  doc.text(`Agency: ${agencyName}`, 20, y);
  y += 14;

  const pw = doc.internal.pageSize.getWidth();

  if (entries.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("No entries recorded.", 20, y);
    drawFooter(doc);
    doc.save(fileName);
    return;
  }

  doc.setFillColor(241, 245, 249);
  doc.rect(20, y - 5, pw - 40, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);

  doc.text("DATE", 25, y + 2);
  doc.text("DRIVER", 50, y + 2);
  doc.text("MOBILE", 90, y + 2);
  doc.text("VEHICLE", 125, y + 2);
  doc.text("TYPE", 155, y + 2);
  doc.text("NOTES", 185, y + 2);

  y += 12;

  entries.forEach((r, i) => {
    if (y > doc.internal.pageSize.getHeight() - 25) {
      doc.addPage();
      y = 20;
    }

    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(20, y - 5, pw - 40, 9, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    doc.text(fmtDate(r.date), 25, y);
    doc.text((r.driverName || "—").substring(0, 20), 50, y);
    doc.text(r.mobileNumber || "—", 90, y);
    doc.text((r.vehicleNumber || "—").substring(0, 15), 125, y);
    doc.text((r.vehicleType || "—").substring(0, 15), 155, y);
    doc.text((r.notes || "").substring(0, 45), 185, y);

    y += 9;
  });

  drawFooter(doc);
  doc.save(fileName);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENCY PAYOUT TAB
// ═══════════════════════════════════════════════════════════════════════════════

function payoutMonthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [
    { value: "all_time", label: "All time" },
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

const PAYOUT_MONTH_OPTIONS = payoutMonthOptions();

/** Kept for when Payout UI is re-enabled */
export function AgencyPayoutTab({
  agencyId,
  agencyName,
}: {
  agencyId: string;
  agencyName: string;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<AgencyPayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [month, setMonth] = useState("all_time");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchAgencyPayoutSummary(agencyId, month));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [agencyId, month]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setErr("Enter a valid amount");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await addAgencyPayoutPayment(agencyId, {
        amount: amt,
        paymentDate,
        paymentMethod,
        notes,
      });
      setAmount("");
      setNotes("");
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Failed to add payment");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (paymentId: string) => {
    if (!confirm("Delete this payment record?")) return;
    try {
      await deletePayoutPayment(paymentId);
      await load();
    } catch {
      alert("Failed to delete");
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );

  const gt = data?.grandTotal ?? 0;
  const advance = data?.totalAdvance ?? 0;
  const received = data?.totalReceived ?? 0;
  const applied = data?.totalApplied ?? advance + received;
  const overpaid = data?.overpaid ?? 0;
  /** Balance vs cash receipts only (does not subtract trip advances). */
  const balanceVsPayments = gt - received;
  const pct = gt > 0 ? Math.min((applied / gt) * 100, 100) : 0;

  return (
    <div className="space-y-5">
      {/* Month Filter */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Filter Month:
        </span>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="min-h-[36px] rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 sm:text-sm dark:border-[#1e2638] dark:text-slate-100"
        >
          {PAYOUT_MONTH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            key: "gt",
            label: "Grand Total",
            hint: "Trip fare total",
            value: gt,
            color: "text-slate-800 dark:text-slate-100",
            bg: "bg-slate-50 border-slate-200 dark:bg-white/5 dark:border-[#1e2638]",
            signed: false,
          },
          {
            key: "adv",
            label: "Advance",
            hint: "On trip rows",
            value: advance,
            color: "text-sky-700 dark:text-sky-400",
            bg: "bg-sky-50 border-sky-200 dark:bg-sky-500/10 dark:border-sky-500/20",
            signed: false,
          },
          {
            key: "pay",
            label: "Payments",
            hint: "Cash receipts",
            value: received,
            color: "text-emerald-700 dark:text-emerald-400",
            bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20",
            signed: false,
          },
          {
            key: "balance",
            label: "Balance",
            hint: "Grand Total − Payments",
            value: balanceVsPayments,
            color:
              balanceVsPayments > 0
                ? "text-amber-700 dark:text-amber-400"
                : balanceVsPayments < 0
                  ? "text-violet-700 dark:text-violet-400"
                  : "text-slate-500 dark:text-slate-400",
            bg:
              balanceVsPayments > 0
                ? "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20"
                : balanceVsPayments < 0
                  ? "bg-violet-50 border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/20"
                  : "bg-slate-50 border-slate-200 dark:bg-white/5 dark:border-[#1e2638]",
            signed: true,
          },
        ].map((c) => (
          <div
            key={c.key}
            className={`rounded-xl border px-3 py-3 sm:px-4 ${c.bg}`}
          >
            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {c.label}
            </div>
            {c.hint && (
              <div className="mb-1 text-[9px] font-medium text-slate-400">
                {c.hint}
              </div>
            )}
            <div
              className={`text-base font-bold tabular-nums sm:text-lg ${c.color}`}
            >
              {c.signed && c.value < 0 ? "−" : ""}₹
              {Math.abs(c.value).toLocaleString("en-IN")}
            </div>
          </div>
        ))}
      </div>

      {overpaid > 0 && month !== "all_time" && (
        <p className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-700">
          Payments in this month exceed this month’s trip total by ₹
          {overpaid.toLocaleString("en-IN")}. Extra cash is applied to earlier
          dues. Agency overall remaining: ₹
          {(data?.agencyRemainingAllTime ?? 0).toLocaleString("en-IN")}.
        </p>
      )}

      {/* Progress bar */}
      {gt > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Payment Progress (Advance + Payments)</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Add payment form */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
        <h4 className="text-sm font-semibold text-slate-700">
          Record Payment Received
        </h4>
        {err && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
            {err}
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">
              Amount (₹) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">
              Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">
              Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500"
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">
              Notes
            </label>
            <input
              placeholder="Optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          <Plus className="h-4 w-4" />
          {saving ? "Adding…" : "Add Payment"}
        </button>
      </div>

      {/* Payment history */}
      <div>
        <h4 className="text-sm font-semibold text-slate-600 mb-2">
          Payment History ({data?.payments?.length ?? 0})
        </h4>
        {!data?.payments?.length ? (
          <p className="text-sm text-slate-400 text-center py-6">
            No payments recorded yet
          </p>
        ) : (
          <div className="space-y-2">
            {data.payments.map((p) => (
              <div
                key={p._id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-[var(--bg-card)] px-4 py-3 shadow-sm dark:border-[#1e2638]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-600 text-sm">
                      ₹{p.amount.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded capitalize">
                      {p.paymentMethod?.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {p.paymentDate
                      ? new Date(p.paymentDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                    {p.notes && <span className="ml-2 italic">{p.notes}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(p._id)}
                  className="text-red-400 hover:text-red-600 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Download PDF */}
      {data && (
        <button
          onClick={() =>
            generateAgencyPayoutPDF(user?.name || "Owner", agencyName, data)
          }
          className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition w-full justify-center dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
        >
          <FileDown className="h-4 w-4" /> Download Agency Report (PDF)
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER PAYOUT PANEL (inside each DriverGroup card)
// ═══════════════════════════════════════════════════════════════════════════════

/** Kept for when Payout UI is re-enabled */
export function DriverPayoutPanel({
  agencyId,
  driverName,
  agencyName,
}: {
  agencyId: string;
  driverName: string;
  agencyName: string;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<DriverPayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [month, setMonth] = useState("all_time");

  const load = useCallback(async () => {
    if (!driverName.trim()) return;
    setLoading(true);
    try {
      setData(await fetchDriverPayoutSummary(agencyId, driverName, month));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [agencyId, driverName, month]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setErr("Enter a valid amount");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await addDriverPayoutPayment(agencyId, {
        driverName,
        amount: amt,
        paymentDate,
        paymentMethod,
        notes,
      });
      setAmount("");
      setNotes("");
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (paymentId: string) => {
    if (!confirm("Delete this payment?")) return;
    try {
      await deletePayoutPayment(paymentId);
      await load();
    } catch {
      alert("Failed to delete");
    }
  };

  if (!driverName.trim())
    return (
      <p className="text-xs text-slate-400 px-4 py-3">
        Enter driver name first
      </p>
    );
  if (loading)
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
      </div>
    );

  const total = data?.totalAdvance ?? 0;
  const paid = data?.totalPaid ?? 0;
  const remaining = data?.remaining ?? 0;

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Month Filter */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
          Filter:
        </span>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="min-h-[30px] rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2 py-1 text-[11px] font-medium text-slate-800 outline-none focus:border-indigo-400 dark:border-[#1e2638] dark:text-slate-100"
        >
          {PAYOUT_MONTH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Advance Owed", val: total, cls: "text-slate-700" },
          { label: "Paid", val: paid, cls: "text-emerald-700" },
          {
            label: "Remaining",
            val: remaining,
            cls: remaining > 0 ? "text-amber-700" : "text-slate-400",
          },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 dark:bg-white/5 dark:border-[#1e2638]"
          >
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {c.label}
            </div>
            <div className={`text-sm font-bold ${c.cls}`}>
              ₹{c.val.toLocaleString("en-IN")}
            </div>
          </div>
        ))}
      </div>

      {/* Add payment */}
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 min-w-[80px] rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400 dark:border-[#1e2638] dark:text-slate-100"
        />
        <input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          className="rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400 dark:border-[#1e2638] dark:text-slate-100"
        />
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-2 py-1.5 text-xs outline-none focus:border-indigo-400 dark:border-[#1e2638] dark:text-slate-100"
        >
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="online">Online</option>
          <option value="other">Other</option>
        </select>
        <input
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="flex-1 min-w-[80px] rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400 dark:border-[#1e2638] dark:text-slate-100"
        />
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          {saving ? "…" : "Pay"}
        </button>
      </div>

      {/* History */}
      {(data?.payments?.length ?? 0) > 0 && (
        <div className="space-y-1.5">
          {data!.payments.map((p) => (
            <div
              key={p._id}
              className="flex items-center gap-2 rounded-lg border border-slate-100 bg-[var(--bg-card)] px-3 py-2 dark:border-[#1e2638]"
            >
              <span className="font-semibold text-emerald-600 text-xs">
                ₹{p.amount.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400 flex-1">
                {p.paymentDate
                  ? new Date(p.paymentDate).toLocaleDateString("en-IN")
                  : ""}
                {p.notes && ` · ${p.notes}`}
              </span>
              <button
                onClick={() => handleDelete(p._id)}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Download PDF */}
      {data && total > 0 && (
        <button
          onClick={() =>
            generateDriverPayoutPDF(
              user?.name || "Owner",
              agencyName,
              driverName,
              data,
            )
          }
          className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition w-full justify-center dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
        >
          <FileDown className="h-3.5 w-3.5" /> Download Report
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CELL INPUT — Memoised to prevent re-rendering sibling cells
// ═══════════════════════════════════════════════════════════════════════════════

const CellInput = memo(function CellInput({
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
  disabled = false,
  title,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const [localVal, setLocalVal] = useState(value);
  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  if (type === "time") {
    const timeVal = String(localVal ?? "");
    return (
      <TimePicker12h
        value={timeVal}
        allowEmpty
        compact
        label={title}
        disabled={disabled}
        onChange={(v) => {
          if (disabled) return;
          const normalized = v ? normalizeHHmm(v) : "";
          setLocalVal(normalized);
          onChange(normalized);
        }}
        className={`w-full ${className}`}
      />
    );
  }

  return (
    <input
      value={localVal}
      disabled={disabled}
      title={title}
      onChange={(e) => {
        if (disabled) return;
        setLocalVal(e.target.value);
        onChange(e.target.value);
      }}
      type={type}
      placeholder={placeholder}
      className={`w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none
        focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-[var(--bg-elevated)] dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500 transition disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:disabled:bg-white/5 dark:disabled:text-slate-500 ${
          type === "number"
            ? "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            : ""
        } ${className}`}
    />
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// BULK ENTRY TABLE
// ═══════════════════════════════════════════════════════════════════════════════

export type BulkEntryTableHandle = {
  openExport: () => void;
};

const BulkEntryTable = forwardRef<
  BulkEntryTableHandle,
  {
    groups: DriverGroup[];
    onChange: Dispatch<SetStateAction<DriverGroup[]>>;
    onDeleteTrip: (id: string) => Promise<void> | void;
    onDeleteTrips?: (ids: string[]) => Promise<void> | void;
    agencyId?: string;
    agencyName?: string;
    filterStatus?: EntryFilterStatus;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    sortDir?: EntrySortDir;
  }
>(function BulkEntryTable(
  {
    groups,
    onChange,
    onDeleteTrip,
    onDeleteTrips,
    agencyId: _agencyId,
    agencyName,
    filterStatus = "all",
    search = "",
    dateFrom: _dateFrom = "",
    dateTo: _dateTo = "",
    sortDir = "desc",
  },
  ref,
) {
  void _agencyId;
  void _dateFrom;
  void _dateTo;
  // Page-level filter is status only (pending/done). Date filters live per-driver.
  const isRowHidden = (r: BulkTripRow) =>
    entryStatusHidden(r.isCompleted, filterStatus);

  const q = search.trim().toLowerCase();
  // Page search: driver name + vehicle only
  const groupMatchesSearch = (g: DriverGroup) => {
    if (!q) return true;
    return [g.driverName, g.vehicleNumber]
      .join(" ")
      .toLowerCase()
      .includes(q);
  };

  const visibleGroupIndexes = useMemo(() => {
    const scored: { gi: number; sortKey: number }[] = [];
    groups.forEach((g, gi) => {
      if (!groupMatchesSearch(g)) return;

      const isBlankShell =
        !g.driverName.trim() &&
        !g.vehicleNumber.trim() &&
        g.rows.every((r) => !bulkRowHasData(r));

      const statusVisibleRows = g.rows.filter((r) => !isRowHidden(r));
      if (
        !isBlankShell &&
        statusVisibleRows.length === 0 &&
        (filterStatus !== "all" || q)
      ) {
        return;
      }
      if (
        !isBlankShell &&
        statusVisibleRows.length === 0 &&
        g.rows.some((r) => bulkRowHasData(r) || r._id)
      ) {
        return;
      }

      // Sort drivers by when the group was created (not trip dates)
      scored.push({ gi, sortKey: groupCreatedAtMs(g) });
    });
    scored.sort((a, b) =>
      sortDir === "desc" ? b.sortKey - a.sortKey : a.sortKey - b.sortKey,
    );
    return scored.map((s) => s.gi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, q, filterStatus, sortDir]);
  const { user } = useAuth();
  // const [expandedPayoutGi, setExpandedPayoutGi] = useState<number | null>(null); // Driver Payout UI disabled
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exportFileName, setExportFileName] = useState("");
  const [exportFromName, setExportFromName] = useState("");
  const [exportOwnerPhone, setExportOwnerPhone] = useState("");
  const [exportShowPhone, setExportShowPhone] = useState(true);
  const [exportProfileLoading, setExportProfileLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [groupLocalFilters, setGroupLocalFilters] = useState<
    Record<string, GroupLocalFilter>
  >({});
  const [mobileDriverOpen, setMobileDriverOpen] = useState<
    Record<string, boolean>
  >({});

  const getGroupLocalFilter = useCallback(
    (key: string): GroupLocalFilter =>
      groupLocalFilters[key] ?? defaultGroupLocalFilter(),
    [groupLocalFilters],
  );

  const patchGroupLocalFilter = useCallback(
    (key: string, patch: Partial<GroupLocalFilter>) => {
      setGroupLocalFilters((prev) => ({
        ...prev,
        [key]: { ...defaultGroupLocalFilter(), ...prev[key], ...patch },
      }));
    },
    [],
  );

  const getVisibleRowIndexes = useCallback(
    (g: DriverGroup, gi: number): number[] => {
      const gf = getGroupLocalFilter(groupFilterStorageKey(g, gi));
      const lq = gf.search.trim().toLowerCase();
      const scored: { ri: number; sortKey: number; startKm: number }[] = [];
      g.rows.forEach((r, ri) => {
        if (isRowHidden(r)) return;
        if (entryStatusHidden(r.isCompleted, gf.filterStatus)) return;
        if (!entryDateInRange(r.startDate, gf.dateFrom, gf.dateTo)) return;
        if (!rowMatchesLocalSearch(r, lq)) return;
        // Always sort by starting date
        scored.push({
          ri,
          sortKey: bulkRowDateMs(r.startDate),
          startKm: Number(r.startKm) || 0,
        });
      });
      scored.sort((a, b) => {
        const aBlank = a.sortKey === Number.POSITIVE_INFINITY;
        const bBlank = b.sortKey === Number.POSITIVE_INFINITY;
        // Rows without a start date always sink to the bottom
        if (aBlank !== bBlank) return aBlank ? 1 : -1;
        if (a.sortKey !== b.sortKey) {
          return gf.sortDir === "desc"
            ? b.sortKey - a.sortKey
            : a.sortKey - b.sortKey;
        }
        if (a.startKm !== b.startKm) return a.startKm - b.startKm;
        return a.ri - b.ri;
      });
      return scored.map((s) => s.ri);
    },
    // Page-level dates are unused for bulk rows (per-driver filters handle dates).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getGroupLocalFilter, filterStatus, search],
  );

  const ownerDisplayBase = useCallback(() => {
    const company = String(user?.company ?? "").trim();
    const name = String(user?.name ?? "").trim();
    return company || name || "Owner";
  }, [user?.company, user?.name]);

  const buildExportFromLine = useCallback(
    (baseName: string, showPhone: boolean, phoneValue: string) => {
      const base = baseName.trim() || ownerDisplayBase();
      const phone = phoneValue.trim();
      if (showPhone && phone) return `${base} - ${phone}`;
      return base;
    },
    [ownerDisplayBase],
  );

  const buildDefaultBulkPdfFileName = useCallback(
    (start: string, end: string) => {
      const today = new Date().toISOString().split("T")[0];
      const agencyPart = (agencyName || "Agency").replace(/\s+/g, "_");
      const rangePart =
        start || end ? `${start || "from"}_${end || "to"}` : "all";
      return `BulkTrips_${agencyPart}_${rangePart}_${today}.pdf`;
    },
    [agencyName],
  );

  const openBulkExportModal = useCallback(async () => {
    setExportError(null);
    setExportFileName(
      buildDefaultBulkPdfFileName(exportStartDate, exportEndDate),
    );
    setExportFromName(ownerDisplayBase());
    setExportOwnerPhone(String(user?.phone ?? "").trim());
    setExportShowPhone(true);
    setExportOpen(true);
    setExportProfileLoading(true);
    try {
      const profile = await authApi.getOwnerProfile();
      const company = String(profile.company ?? "").trim();
      const name = String(profile.name ?? "").trim();
      const phone = String(profile.phone ?? "").trim();
      setExportFromName(company || name || ownerDisplayBase());
      setExportOwnerPhone(phone);
      try {
        const raw = localStorage.getItem("userData");
        const prev = raw ? JSON.parse(raw) : {};
        const next = {
          ...prev,
          id: profile.id || prev.id || prev._id || "",
          name: name || prev.name || "",
          email: profile.email || prev.email || "",
          company,
          phone,
          role: prev.role || "owner",
        };
        localStorage.setItem("userData", JSON.stringify(next));
      } catch {
        // ignore localStorage sync errors
      }
    } catch {
      // Keep fallback values from auth user if profile fetch fails
    } finally {
      setExportProfileLoading(false);
    }
  }, [
    buildDefaultBulkPdfFileName,
    exportEndDate,
    exportStartDate,
    ownerDisplayBase,
    user?.phone,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      openExport: () => {
        void openBulkExportModal();
      },
    }),
    [openBulkExportModal],
  );

  const buildBulkExportGroups = useCallback(
    (start: string, end: string) => {
      const startMs = start ? new Date(`${start}T00:00:00`).getTime() : null;
      const endMs = end ? new Date(`${end}T23:59:59`).getTime() : null;

      const dateOk = (rowStartDate: string) => {
        if (!startMs && !endMs) return true;
        if (!rowStartDate) return false;
        const t = new Date(`${rowStartDate}T00:00:00`).getTime();
        if (!Number.isFinite(t)) return false;
        if (startMs && t < startMs) return false;
        if (endMs && t > endMs) return false;
        return true;
      };

      return groups
        .map((g) => ({
          ...g,
          rows: sortBulkRowsByDate(
            (g.rows ?? []).filter(
              (r) =>
                !entryStatusHidden(r.isCompleted, filterStatus) &&
                dateOk(r.startDate),
            ),
          ),
        }))
        .filter((g) => (g.rows ?? []).length > 0);
    },
    [groups, filterStatus],
  );

  const runBulkExport = useCallback(() => {
    const start = exportStartDate.trim();
    const end = exportEndDate.trim();

    if (start && end) {
      const s = new Date(`${start}T00:00:00`).getTime();
      const e = new Date(`${end}T00:00:00`).getTime();
      if (Number.isFinite(s) && Number.isFinite(e) && s > e) {
        setExportError("Start date cannot be after end date");
        return;
      }
    }

    const reportGroups = buildBulkExportGroups(start, end);
    const rowCount = reportGroups.reduce(
      (s, g) => s + (g.rows?.length ?? 0),
      0,
    );
    if (rowCount === 0) {
      setExportError("No trips found for the selected filter/date range.");
      return;
    }

    const trimmedName = exportFileName.trim();
    if (!trimmedName) {
      setExportError("Please enter a PDF file name.");
      return;
    }
    const safeBase = trimmedName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
    const fileName = /\.pdf$/i.test(safeBase) ? safeBase : `${safeBase}.pdf`;

    generateBulkTripsPDF(
      buildExportFromLine(exportFromName, exportShowPhone, exportOwnerPhone),
      agencyName || "Agency",
      fileName,
      reportGroups,
    );
    setExportOpen(false);
    setExportError(null);
  }, [
    agencyName,
    buildBulkExportGroups,
    buildExportFromLine,
    exportEndDate,
    exportFileName,
    exportFromName,
    exportOwnerPhone,
    exportShowPhone,
    exportStartDate,
  ]);
  const updateGroupField = useCallback(
    (gi: number, field: keyof DriverGroup, val: any) => {
      onChange((prev) => {
        const next = [...prev];
        next[gi] = { ...next[gi], [field]: val };
        return next;
      });
    },
    [onChange],
  );

  const toggleComplete = useCallback(
    (gi: number, ri: number) => {
      onChange((prev) => {
        const next = [...prev];
        next[gi] = { ...next[gi], rows: [...next[gi].rows] };
        next[gi].rows[ri] = {
          ...next[gi].rows[ri],
          isCompleted: !next[gi].rows[ri].isCompleted,
        };
        return next;
      });
    },
    [onChange],
  );

  const updateRow = useCallback(
    (gi: number, ri: number, field: keyof BulkTripRow, val: any) => {
      onChange((prev) => {
        const next = [...prev];
        next[gi] = { ...next[gi], rows: [...next[gi].rows] };
        const row = { ...next[gi].rows[ri], [field]: val };

        // Auto-calculate distance
        if (field === "startKm" || field === "endKm") {
          const skm = Number(row.startKm) || 0;
          const ekm = Number(row.endKm) || 0;
          row.distance = ekm > skm ? ekm - skm : 0;
        }

        // Auto-calculate hours
        if (field === "startTime" || field === "endTime") {
          const [sh, sm] = (row.startTime || "00:00").split(":").map(Number);
          const [eh, em] = (row.endTime || "00:00").split(":").map(Number);
          if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
            let mins = eh * 60 + em - (sh * 60 + sm);
            if (mins < 0) mins += 24 * 60; // handle overnight trips
            row.hours = Number((mins / 60).toFixed(2));
          } else {
            row.hours = 0;
          }
        }

        next[gi].rows[ri] = row;

        if (field === "startDate") {
          next[gi].rows = sortBulkRowsByDate(next[gi].rows);
        }

        // One advance per driver/vehicle/day — clear stray values on non-first rows
        if (field === "startDate" || field === "advancePaid") {
          next[gi].rows = next[gi].rows.map((r, idx) => {
            if (isAdvanceEditableRow(next[gi].rows, idx))
              return next[gi].rows[idx];
            if ((r.advancePaid || 0) > 0) {
              return { ...r, advancePaid: 0 };
            }
            return r;
          });
        }

        return next;
      });
    },
    [onChange],
  );

  const addRow = useCallback(
    (gi: number) => {
      onChange((prev) => {
        const next = [...prev];
        next[gi] = { ...next[gi], rows: [...next[gi].rows, emptyBulkRow()] };
        return next;
      });
    },
    [onChange],
  );

  const removeRow = useCallback(
    (gi: number, rowId: string) => {
      onChange((prev) => {
        const next = [...prev];
        if (next[gi].rows.length <= 1) {
          next[gi] = { ...next[gi], rows: [emptyBulkRow()] };
          return next;
        }
        next[gi] = {
          ...next[gi],
          rows: next[gi].rows.filter((r) => r.clientRowId !== rowId),
        };
        return next;
      });
    },
    [onChange],
  );

  const deleteServerRow = useCallback(
    async (_gi: number, rowId: string, serverId: string) => {
      if (!serverId) return;
      try {
        await onDeleteTrip(serverId);
        // Purge by id/clientRowId (not group index — index can shift after delete/reload).
        onChange((prev) => {
          const next = prev
            .map((g) => ({
              ...g,
              rows: g.rows.filter(
                (r) =>
                  String(r._id ?? "") !== String(serverId) &&
                  r.clientRowId !== rowId,
              ),
            }))
            .filter((g) => g.rows.length > 0);
          return next.length > 0 ? next : [emptyDriverGroup()];
        });
      } catch {
        // cancelled or failed — keep row
      }
    },
    [onDeleteTrip, onChange],
  );

  const addGroup = useCallback(() => {
    // Always append a brand-new empty card — never clone an existing group.
    onChange((prev) => [...prev, emptyDriverGroup()]);
  }, [onChange]);

  const removeGroup = useCallback(
    (gi: number, groupId?: string) => {
      onChange((prev) => {
        const next = prev.filter((g, i) =>
          groupId ? g.clientGroupId !== groupId : i !== gi,
        );
        return next.length > 0 ? next : [emptyDriverGroup()];
      });
    },
    [onChange],
  );

  const deleteServerGroup = useCallback(
    async (gi: number) => {
      const group = groups[gi];
      if (!group) return;

      // Scope delete to THIS card only (clientGroupId) — never by driver/vehicle name,
      // or deleting one card would wipe another with the same driver/vehicle.
      const groupId = group.clientGroupId;
      const ids = (group.rows ?? [])
        .map((r) => r._id)
        .filter(Boolean) as string[];

      if (ids.length === 0) {
        removeGroup(gi, groupId);
        return;
      }
      try {
        if (onDeleteTrips) {
          await onDeleteTrips(ids.map(String));
        } else {
          for (const id of ids) await Promise.resolve(onDeleteTrip(String(id)));
        }
        // Drop only this card. performDeleteTrips may already have purged server ids.
        removeGroup(gi, groupId);
      } catch {
        // Silent: cancellation or failure means we keep local group.
      }
    },
    [groups, onDeleteTrip, removeGroup, onDeleteTrips],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
      {exportOpen && (
        <ModalShell
          title="Export Bulk Trips (PDF)"
          onClose={() => {
            setExportOpen(false);
            setExportError(null);
          }}
          maxWidth="max-w-md"
        >
          <div className="p-5 sm:p-6 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-[#1e2638] dark:bg-white/5 dark:text-slate-200">
              <span className="font-semibold">{agencyName || "Agency"}</span>
              <span className="text-slate-500 dark:text-slate-400">
                {" "}
                • Filter:{" "}
                <span className="font-semibold capitalize">{filterStatus}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 dark:text-slate-400">
                  Start Date (optional)
                </label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 dark:text-slate-400">
                  End Date (optional)
                </label>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 dark:text-slate-400">
                From
              </label>
              <input
                type="text"
                value={exportFromName}
                onChange={(e) => setExportFromName(e.target.value)}
                placeholder="Company or owner name"
                className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exportShowPhone}
                  onChange={(e) => setExportShowPhone(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                />
                Show phone number after From name
              </label>
              {exportShowPhone && (
                <div className="mt-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 dark:text-slate-400">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={exportOwnerPhone}
                    onChange={(e) => setExportOwnerPhone(e.target.value)}
                    placeholder={
                      exportProfileLoading
                        ? "Loading phone…"
                        : "Owner phone number"
                    }
                    className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-slate-500">
                PDF will show:{" "}
                <span className="font-semibold text-slate-700">
                  From:{" "}
                  {buildExportFromLine(
                    exportFromName,
                    exportShowPhone,
                    exportOwnerPhone,
                  )}
                </span>
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 dark:text-slate-400">
                PDF File Name
              </label>
              <input
                type="text"
                value={exportFileName}
                onChange={(e) => setExportFileName(e.target.value)}
                placeholder="e.g. BulkTrips_Agency_all_2026-09-07.pdf"
                className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Change the download name if needed. `.pdf` is added
                automatically when missing.
              </p>
            </div>

            {exportError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {exportError}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setExportStartDate("");
                  setExportEndDate("");
                  setExportFileName(buildDefaultBulkPdfFileName("", ""));
                  setExportFromName(ownerDisplayBase());
                  setExportOwnerPhone(String(user?.phone ?? "").trim());
                  setExportShowPhone(true);
                  setExportError(null);
                }}
                className="flex-1 rounded-xl border border-slate-200 bg-[var(--bg-elevated)] py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#1e2638] dark:text-slate-200 dark:hover:bg-white/10"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={runBulkExport}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                Export PDF
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* All groups are editable — server trips are merged into groups[] */}
      {visibleGroupIndexes.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-[var(--bg-card)] px-4 py-11 text-center text-slate-500 dark:border-[#252c4d] dark:text-[#8d94b8]">
          <b className="mb-1 block text-[15px] text-slate-800 dark:text-[#eef0ff]">
            {groups.length > 0
              ? "Nothing matches these filters"
              : "No bulk entries yet"}
          </b>
          {groups.length > 0
            ? "Clear the filters to see all entries."
            : "Add a driver group to get started."}
        </div>
      ) : (
        visibleGroupIndexes.map((gi, displayIdx) => {
          const g = groups[gi];
          if (!g) return null;
          return (
        <div
          key={g.clientGroupId || `g-${gi}`}
          className="rounded-xl border border-slate-200 bg-[var(--bg-card)] shadow-sm overflow-hidden dark:border-[#1e2638]"
        >
          {/* Group header — desktop */}
          <div className="hidden flex-col gap-2.5 border-b border-slate-100 bg-indigo-50/50 px-4 py-3 dark:border-[#1e2638] dark:bg-indigo-500/10 md:flex md:flex-row md:flex-wrap md:items-center md:gap-3 md:px-5 md:py-3.5">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-indigo-100 text-xs sm:text-sm font-bold text-indigo-600 shrink-0 dark:bg-indigo-500/20 dark:text-indigo-300">
                {displayIdx + 1}
              </span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xs sm:text-sm font-semibold text-slate-600 shrink-0 dark:text-slate-300">
                  Driver:
                </span>
                <DriverNameCombobox
                  value={g.driverName}
                  selectedDriverId={g.driverId}
                  inlineCreate
                  seedPhone={g.driverPhone}
                  onChange={(v) => {
                    onChange((prev) => {
                      const next = [...prev];
                      next[gi] = {
                        ...next[gi],
                        driverName: v,
                        driverId: undefined,
                        driverPhone: undefined,
                      };
                      return next;
                    });
                  }}
                  onDriverSelect={(d: Driver) => {
                    const digits = String(d.phone ?? "").replace(/\D/g, "");
                    onChange((prev) => {
                      const next = [...prev];
                      next[gi] = {
                        ...next[gi],
                        driverName: driverDisplayName(d),
                        driverId: d._id ?? d.id,
                        driverPhone: digits || undefined,
                      };
                      return next;
                    });
                  }}
                  placeholder="Select or type driver"
                  className="min-w-0 flex-1 sm:w-[180px]"
                />
              </div>
              <button
                type="button"
                onClick={() => deleteServerGroup(gi)}
                className="text-red-400 hover:text-red-600 p-1 shrink-0 sm:hidden"
              >
                <Trash2 className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex items-center gap-2 flex-1 sm:flex-none">
                <span className="text-xs sm:text-sm font-semibold text-slate-600 shrink-0 dark:text-slate-300">
                  Vehicle:
                </span>
                <CellInput
                  value={g.vehicleNumber}
                  onChange={(v) =>
                    updateGroupField(gi, "vehicleNumber", v.toUpperCase())
                  }
                  placeholder="KL01..."
                  className="min-w-0 flex-1 sm:w-[140px]"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => deleteServerGroup(gi)}
              className="text-red-400 hover:text-red-600 p-1 shrink-0 hidden sm:block"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>
          </div>

          {(() => {
            const gKey = groupFilterStorageKey(g, gi);
            const gf = getGroupLocalFilter(gKey);
            const visibleRowIndexes = getVisibleRowIndexes(g, gi);
            const collapseKey = g.clientGroupId || `g-${gi}`;
            const mobileExpanded =
              mobileDriverOpen[collapseKey] ?? displayIdx === 0;
            const mobileGrandTotal = visibleRowIndexes.reduce(
              (sum, ri) => sum + (g.rows[ri]?.grandTotal || 0),
              0,
            );
            const toggleMobileDriver = () => {
              setMobileDriverOpen((prev) => ({
                ...prev,
                [collapseKey]: !(prev[collapseKey] ?? displayIdx === 0),
              }));
            };
            return (
              <>
          <button
            type="button"
            onClick={toggleMobileDriver}
            className="flex w-full items-center gap-2 border-b border-slate-100 bg-indigo-50/70 px-3 py-2.5 text-left dark:border-[#1e2638] dark:bg-indigo-500/10 md:hidden"
            aria-expanded={mobileExpanded}
          >
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-indigo-500 transition-transform ${mobileExpanded ? "rotate-180" : ""}`}
            />
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
              {displayIdx + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {g.driverName.trim() || "Driver"}
            </span>
            <span className="shrink-0 truncate font-mono text-[11px] font-medium text-amber-700 dark:text-amber-300">
              {g.vehicleNumber.trim() || "—"}
            </span>
            <span className="shrink-0 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {visibleRowIndexes.length} trip
              {visibleRowIndexes.length === 1 ? "" : "s"}
              {mobileGrandTotal > 0
                ? ` · ₹${mobileGrandTotal.toLocaleString("en-IN")}`
                : ""}
            </span>
          </button>

          <div
            className={`${mobileExpanded ? "block" : "hidden"} md:hidden`}
          >
          {/* Mobile driver / vehicle (compact) */}
          <div className="space-y-2 border-b border-slate-100 px-3 py-2.5 dark:border-[#1e2638]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                Driver
              </span>
              <DriverNameCombobox
                value={g.driverName}
                selectedDriverId={g.driverId}
                inlineCreate
                seedPhone={g.driverPhone}
                onChange={(v) => {
                  onChange((prev) => {
                    const next = [...prev];
                    next[gi] = {
                      ...next[gi],
                      driverName: v,
                      driverId: undefined,
                      driverPhone: undefined,
                    };
                    return next;
                  });
                }}
                onDriverSelect={(d: Driver) => {
                  const digits = String(d.phone ?? "").replace(/\D/g, "");
                  onChange((prev) => {
                    const next = [...prev];
                    next[gi] = {
                      ...next[gi],
                      driverName: driverDisplayName(d),
                      driverId: d._id ?? d.id,
                      driverPhone: digits || undefined,
                    };
                    return next;
                  });
                }}
                placeholder="Driver"
                className="min-w-0 flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-slate-500 shrink-0 dark:text-slate-400">
                Vehicle
              </span>
              <CellInput
                value={g.vehicleNumber}
                onChange={(v) =>
                  updateGroupField(gi, "vehicleNumber", v.toUpperCase())
                }
                placeholder="KL01…"
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={() => deleteServerGroup(gi)}
                className="shrink-0 p-1 text-red-400 hover:text-red-600"
                aria-label="Remove driver"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Trip rows — MOBILE CARD VIEW (below md) */}
          <div className="divide-y divide-slate-100 dark:divide-[#1e2638]">
            {visibleRowIndexes.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-[#8d94b8]">
                {g.rows.some((r) => !isRowHidden(r))
                  ? "Nothing matches this driver’s filters"
                  : "No trips for this driver"}
              </div>
            ) : (
              visibleRowIndexes.map((ri, displayRi) => {
                const r = g.rows[ri];
                if (!r) return null;
                return (
              <div
                key={r.clientRowId}
                className="space-y-2 p-2.5 sm:p-4 sm:space-y-3"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase text-indigo-500 dark:text-indigo-300">
                    Trip {displayRi + 1}
                  </span>
                  <div className="flex items-center gap-2.5">
                    {r.distance > 0 && (
                      <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        {r.distance} km
                      </span>
                    )}
                    {r.hours > 0 && (
                      <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        {r.hours} hrs
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleComplete(gi, ri)}
                      title={
                        r.isCompleted ? "Mark as pending" : "Mark as completed"
                      }
                      className={`p-1 transition ${r.isCompleted ? "text-emerald-500 hover:text-emerald-600" : "text-slate-300 hover:text-slate-400"}`}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                    {r._id ? (
                      <button
                        type="button"
                        onClick={() =>
                          deleteServerRow(gi, r.clientRowId, String(r._id))
                        }
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : g.rows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeRow(gi, r.clientRowId)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                      Start
                    </label>
                    <CellInput
                      value={r.startDate}
                      onChange={(v) => updateRow(gi, ri, "startDate", v)}
                      type="date"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                      End
                    </label>
                    <CellInput
                      value={r.endDate}
                      onChange={(v) => updateRow(gi, ri, "endDate", v)}
                      type="date"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                      St KM
                    </label>
                    <CellInput
                      value={r.startKm}
                      onChange={(v) => updateRow(gi, ri, "startKm", v)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                      En KM
                    </label>
                    <CellInput
                      value={r.endKm}
                      onChange={(v) => updateRow(gi, ri, "endKm", v)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                      St time
                    </label>
                    <CellInput
                      value={r.startTime}
                      onChange={(v) => updateRow(gi, ri, "startTime", v)}
                      type="time"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                      En time
                    </label>
                    <CellInput
                      value={r.endTime}
                      onChange={(v) => updateRow(gi, ri, "endTime", v)}
                      type="time"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                      Toll
                    </label>
                    <CellInput
                      value={r.toll === 0 ? "" : r.toll}
                      onChange={(v) =>
                        updateRow(gi, ri, "toll", Number(v) || 0)
                      }
                      type="number"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                      Adv
                    </label>
                    <CellInput
                      value={r.advancePaid === 0 ? "" : r.advancePaid}
                      onChange={(v) =>
                        updateRow(gi, ri, "advancePaid", Number(v) || 0)
                      }
                      type="number"
                      disabled={!isAdvanceEditableRow(g.rows, ri)}
                      title={advanceFieldTitle(g.rows, ri)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                      Total
                    </label>
                    <CellInput
                      value={r.grandTotal === 0 ? "" : r.grandTotal}
                      onChange={(v) =>
                        updateRow(gi, ri, "grandTotal", Number(v) || 0)
                      }
                      type="number"
                    />
                  </div>
                </div>
                <div className="col-span-2 space-y-0.5">
                  <label className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                    Notes
                  </label>
                  <textarea
                    value={r.notes}
                    onChange={(e) => updateRow(gi, ri, "notes", e.target.value)}
                    placeholder="Note…"
                    rows={2}
                    className="w-full rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition resize-y dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
                );
              })
            )}
          </div>

          {/* Mobile group footer */}
          <div className="flex flex-col justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-3 py-2.5 dark:border-[#1e2638] dark:bg-white/[0.03]">
            <button
              type="button"
              onClick={() => addRow(gi)}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
            >
              <Plus className="h-3.5 w-3.5" /> Add trip
            </button>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
              {(() => {
                const rowsForTotals = visibleRowIndexes
                  .map((ri) => g.rows[ri])
                  .filter(Boolean) as BulkTripRow[];
                const totalGrand = rowsForTotals.reduce(
                  (s, r) => s + (r.grandTotal || 0),
                  0,
                );
                const advance = rowsForTotals.reduce(
                  (s, r) => s + (r.advancePaid || 0),
                  0,
                );
                const balance = rowsForTotals.reduce(
                  (s, r) =>
                    s +
                    calculateBalanceAmount(
                      r.grandTotal || 0,
                      r.advancePaid || 0,
                    ),
                  0,
                );
                return (
                  <>
                    <span className="text-slate-500 dark:text-slate-400">
                      Tot{" "}
                      <strong className="text-slate-800 dark:text-slate-100">
                        ₹{totalGrand.toLocaleString("en-IN")}
                      </strong>
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Adv{" "}
                      <strong className="text-slate-800 dark:text-slate-100">
                        ₹{advance.toLocaleString("en-IN")}
                      </strong>
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Bal{" "}
                      <strong className="text-emerald-600">
                        ₹{balance.toLocaleString("en-IN")}
                      </strong>
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
          </div>

          <div className={`${mobileExpanded ? "block" : "hidden"} md:block`}>
          <EntryFiltersBar
            compact
            title="Trips"
            count={visibleRowIndexes.length}
            search={gf.search}
            onSearchChange={(v) => patchGroupLocalFilter(gKey, { search: v })}
            searchPlaceholder="Search notes, dates, times, toll, total…"
            sortDir={gf.sortDir}
            onSortDirChange={(v) =>
              patchGroupLocalFilter(gKey, { sortDir: v })
            }
            filtersOpen={gf.filtersOpen}
            onFiltersOpenChange={(v) =>
              patchGroupLocalFilter(gKey, { filtersOpen: v })
            }
            filterStatus={gf.filterStatus}
            onFilterStatusChange={(v) =>
              patchGroupLocalFilter(gKey, { filterStatus: v })
            }
            dateFrom={gf.dateFrom}
            dateTo={gf.dateTo}
            onDateFromChange={(v) =>
              patchGroupLocalFilter(gKey, { dateFrom: v })
            }
            onDateToChange={(v) => patchGroupLocalFilter(gKey, { dateTo: v })}
            sortNewestLabel="↓ Newest start"
            sortOldestLabel="↑ Oldest start"
            defaultSortDir="asc"
          />
          </div>

          {/* Trip rows — DESKTOP TABLE VIEW (md and above) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500 font-semibold dark:bg-white/[0.03] dark:text-slate-400">
                  <th className="px-2 py-2 w-8">#</th>
                  <th className="px-2 py-2 w-8" title="Completed">
                    ✓
                  </th>
                  <th className="px-2 py-2 min-w-[120px]">Date (Start/End)</th>
                  <th className="px-2 py-2">Start KM</th>
                  <th className="px-2 py-2">End KM</th>
                  <th className="px-2 py-2">Dist.</th>
                  <th className="px-2 py-2 min-w-[200px]">Time (Start/End)</th>
                  <th className="px-2 py-2">Hrs.</th>
                  <th className="px-2 py-2">Toll</th>
                  <th className="px-2 py-2">Advance</th>
                  <th className="px-2 py-2">Grand Total</th>
                  <th className="px-2 py-2 min-w-[130px]">Notes</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {visibleRowIndexes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={13}
                      className="px-4 py-8 text-center text-sm text-slate-500 dark:text-[#8d94b8]"
                    >
                      {g.rows.some((r) => !isRowHidden(r))
                        ? "Nothing matches this driver’s filters"
                        : "No trips for this driver"}
                    </td>
                  </tr>
                ) : (
                  visibleRowIndexes.map((ri, displayRi) => {
                    const r = g.rows[ri];
                    if (!r) return null;
                    return (
                  <tr
                    key={r.clientRowId}
                    className="border-t border-slate-50 hover:bg-slate-50/30 dark:border-[#1e2638] dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-2 py-1.5 text-slate-400 font-medium">
                      {displayRi + 1}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => toggleComplete(gi, ri)}
                        title={
                          r.isCompleted
                            ? "Mark as pending"
                            : "Mark as completed"
                        }
                        className={`p-1.5 rounded-lg transition-all ${r.isCompleted ? "text-emerald-500 bg-emerald-50 hover:bg-emerald-100" : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"}`}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-col gap-1">
                        <CellInput
                          value={r.startDate}
                          onChange={(v) => updateRow(gi, ri, "startDate", v)}
                          type="date"
                        />
                        <CellInput
                          value={r.endDate}
                          onChange={(v) => updateRow(gi, ri, "endDate", v)}
                          type="date"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={r.startKm}
                        onChange={(v) => updateRow(gi, ri, "startKm", v)}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={r.endKm}
                        onChange={(v) => updateRow(gi, ri, "endKm", v)}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1.5 font-medium text-slate-700">
                      {r.distance}
                    </td>
                    <td className="px-2 py-1.5 min-w-[200px]">
                      <div className="flex flex-col gap-1.5">
                        <CellInput
                          value={r.startTime}
                          onChange={(v) => updateRow(gi, ri, "startTime", v)}
                          type="time"
                          title="Start"
                        />
                        <CellInput
                          value={r.endTime}
                          onChange={(v) => updateRow(gi, ri, "endTime", v)}
                          type="time"
                          title="End"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 font-medium text-slate-700">
                      {r.hours}
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={r.toll === 0 ? "" : r.toll}
                        onChange={(v) =>
                          updateRow(gi, ri, "toll", Number(v) || 0)
                        }
                        type="number"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={r.advancePaid === 0 ? "" : r.advancePaid}
                        onChange={(v) =>
                          updateRow(gi, ri, "advancePaid", Number(v) || 0)
                        }
                        type="number"
                        disabled={!isAdvanceEditableRow(g.rows, ri)}
                        title={advanceFieldTitle(g.rows, ri)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={r.grandTotal === 0 ? "" : r.grandTotal}
                        onChange={(v) =>
                          updateRow(gi, ri, "grandTotal", Number(v) || 0)
                        }
                        type="number"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <textarea
                        value={r.notes}
                        onChange={(e) =>
                          updateRow(gi, ri, "notes", e.target.value)
                        }
                        placeholder="Add note…"
                        rows={3}
                        className="w-full min-w-[130px] rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2 py-1.5 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition resize-y dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-col gap-1 items-center">
                        {r._id ? (
                          <button
                            type="button"
                            onClick={() =>
                              deleteServerRow(gi, r.clientRowId!, String(r._id))
                            }
                            title="Delete saved trip"
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : g.rows.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeRow(gi, r.clientRowId!)}
                            title="Remove row"
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Group footer — desktop */}
          <div className="hidden flex-col justify-between gap-2.5 border-t border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-[#1e2638] dark:bg-white/[0.03] sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-5 sm:py-3.5 md:flex">
            <button
              type="button"
              onClick={() => addRow(gi)}
              className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
            >
              <Plus className="h-4 w-4" /> Add Trip
            </button>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              {(() => {
                const rowsForTotals = visibleRowIndexes
                  .map((ri) => g.rows[ri])
                  .filter(Boolean) as BulkTripRow[];
                const totalGrand = rowsForTotals.reduce(
                  (s, r) => s + (r.grandTotal || 0),
                  0,
                );
                const advance = rowsForTotals.reduce(
                  (s, r) => s + (r.advancePaid || 0),
                  0,
                );
                const balance = rowsForTotals.reduce(
                  (s, r) =>
                    s +
                    calculateBalanceAmount(
                      r.grandTotal || 0,
                      r.advancePaid || 0,
                    ),
                  0,
                );
                return (
                  <>
                    <span className="text-slate-500 dark:text-slate-400">
                      Total:{" "}
                      <strong className="text-slate-800 dark:text-slate-100">
                        ₹{totalGrand.toLocaleString("en-IN")}
                      </strong>
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Advance:{" "}
                      <strong className="text-slate-800 dark:text-slate-100">
                        ₹{advance.toLocaleString("en-IN")}
                      </strong>
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Balance:{" "}
                      <strong className="text-emerald-600">
                        ₹{balance.toLocaleString("en-IN")}
                      </strong>
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
              </>
            );
          })()}

          {/* Driver Payout — temporarily disabled
          {agencyId && g.driverName.trim() && (
            <div className="border-t border-slate-100">
              <button
                type="button"
                onClick={() =>
                  setExpandedPayoutGi(expandedPayoutGi === gi ? null : gi)
                }
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50/50 transition"
              >
                <Wallet className="h-3.5 w-3.5" />
                {expandedPayoutGi === gi ? "▾" : "▸"} Driver Payout
              </button>
              {expandedPayoutGi === gi && (
                <DriverPayoutPanel
                  agencyId={agencyId}
                  agencyName={agencyName || ""}
                  driverName={g.driverName}
                />
              )}
            </div>
          )}
          */}
        </div>
          );
        })
      )}

      </div>

      <div className="shrink-0 border-t border-slate-200 bg-[var(--bg-main)]/95 pt-3 backdrop-blur-sm dark:border-[#1e2638]">
        <button
          type="button"
          onClick={addGroup}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-indigo-300 px-3 py-2.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50/50 hover:text-indigo-700 sm:gap-2 sm:rounded-xl sm:px-4 sm:py-3.5 sm:text-sm dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
        >
          <Plus className="h-4 w-4 sm:h-5 sm:w-5" /> Add Driver / Vehicle
        </button>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// COPY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatSingleNormalEntry(e: NormalEntryRow | AgencyTrip): string {
  const driver = (e as any).driverName ?? "—";
  const mobile = (e as any).mobileNumber ?? "—";
  const vehicle = (e as any).vehicleNumber ?? "—";
  const type = (e as any).vehicleType ?? "";
  return [
    `Driver: ${driver}`,
    `Mobile: ${mobile}`,
    `Vehicle: ${vehicle}`,
    type ? `Type: ${type}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

async function copySingleEntry(e: NormalEntryRow | AgencyTrip) {
  const msg = [
    "Vehicle Details",
    "─────────────────",
    formatSingleNormalEntry(e),
    "─────────────────",
  ].join("\n");
  await copyToClipboard(msg);
}

async function copyAllEntries(
  entries: (NormalEntryRow | AgencyTrip)[],
  agencyName?: string,
) {
  const filled = entries.filter((e) => (e as any).driverName?.trim());
  if (filled.length === 0) return;
  const header = agencyName
    ? `${agencyName} — Vehicle Summary`
    : "Vehicle Summary";
  const msg = [
    header,
    `Total Vehicles: ${filled.length}`,
    "─────────────────",
    ...filled.map((e) => formatSingleNormalEntry(e) + "\n─────────────────"),
  ].join("\n");
  await copyToClipboard(msg);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NORMAL ENTRY TABLE
// ═══════════════════════════════════════════════════════════════════════════════

function NormalEntryTable({
  entries,
  onChange,
  onDeleteTrip,
  agencyName,
  filterStatus = "all",
  search = "",
  dateFrom = "",
  dateTo = "",
  sortDir = "desc",
  onSendDriverToBulk,
}: {
  filterStatus?: EntryFilterStatus;
  entries: NormalEntryRow[];
  onChange: Dispatch<SetStateAction<NormalEntryRow[]>>;
  onDeleteTrip: (id: string) => Promise<void> | void;
  agencyName?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortDir?: EntrySortDir;
  /** Copy one Normal row's driver into Bulk Entry (one click = one driver). */
  onSendDriverToBulk?: (entry: NormalEntryRow) => void;
}) {
  const { user } = useAuth();

  const isRowHidden = (e: NormalEntryRow) => {
    if (entryStatusHidden(e.isCompleted, filterStatus)) return true;
    if (!entryDateInRange(e.date, dateFrom, dateTo)) return true;
    return false;
  };

  const matchesSearch = (e: NormalEntryRow) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [e.driverName, e.mobileNumber, e.vehicleNumber, e.vehicleType, e.notes]
      .join(" ")
      .toLowerCase()
      .includes(q);
  };

  const visibleIndexes = useMemo(() => {
    const scored: { i: number; sortKey: number }[] = [];
    entries.forEach((e, i) => {
      if (isRowHidden(e) || !matchesSearch(e)) return;
      const sortKey = bulkRowDateMs(e.date);
      scored.push({ i, sortKey });
    });
    scored.sort((a, b) =>
      sortDir === "desc" ? b.sortKey - a.sortKey : a.sortKey - b.sortKey,
    );
    return scored.map((s) => s.i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, search, filterStatus, dateFrom, dateTo, sortDir]);

  const toggleComplete = (i: number) => {
    onChange((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], isCompleted: !next[i].isCompleted };
      return next;
    });
  };

  const update = useCallback(
    (idx: number, field: keyof NormalEntryRow, val: string) => {
      onChange((prev) => {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          [field]: field === "vehicleNumber" ? val.toUpperCase() : val,
        };
        return next;
      });
    },
    [onChange],
  );

  const addEntry = useCallback(() => {
    onChange((prev) => [...prev, emptyNormalRow()]);
  }, [onChange]);

  const removeEntry = useCallback(
    (idx: number) => {
      onChange((prev) => {
        if (prev.length <= 1) return [emptyNormalRow()];
        return prev.filter((_: NormalEntryRow, i: number) => i !== idx);
      });
    },
    [onChange],
  );

  const deleteServerEntry = useCallback(
    async (_idx: number, id: string) => {
      if (!id) return;
      try {
        await onDeleteTrip(id);
        onChange((prev) => {
          const next = prev.filter((e) => String(e._id ?? "") !== String(id));
          return next.length > 0 ? next : [emptyNormalRow()];
        });
      } catch {
        // cancelled or failed — keep row
      }
    },
    [onDeleteTrip, onChange],
  );

  const filledCount = entries.filter(
    (e) => e.driverName || e.vehicleNumber || e.mobileNumber,
  ).length;

  const visibleCount = visibleIndexes.length;

  const rowActions = (e: NormalEntryRow, i: number, compact = false) => (
    <div className={`flex items-center ${compact ? "gap-1" : "gap-1.5"}`}>
      <button
        type="button"
        onClick={() => toggleComplete(i)}
        title={e.isCompleted ? "Mark as pending" : "Mark as completed"}
        className={`${actionBtnCls} ${
          e.isCompleted
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"
            : "hover:text-emerald-500"
        }`}
      >
        <CheckCircle className="h-3.5 w-3.5" />
      </button>
      {e.driverName?.trim() ? (
        <button
          type="button"
          onClick={() => copySingleEntry(e)}
          title="Copy this entry"
          className={`${actionBtnCls} hover:text-indigo-500 dark:hover:text-indigo-300`}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {e.driverName?.trim() && onSendDriverToBulk ? (
        <button
          type="button"
          onClick={() => onSendDriverToBulk(e)}
          title="Add this driver to Bulk Entry"
          className={`${actionBtnCls} hover:text-amber-500 dark:hover:text-amber-300`}
        >
          <ListChecks className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {(e as any)._id ? (
        <button
          type="button"
          onClick={() => deleteServerEntry(i, String((e as any)._id))}
          title="Delete saved entry"
          className={`${actionBtnCls} hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => removeEntry(i)}
          title={entries.length > 1 ? "Remove row" : "Clear row"}
          className={`${actionBtnCls} hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
      {/* Context bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-[var(--bg-card)] p-3 shadow-sm dark:border-[#1e2638] sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              Daily Fleet Dispatch Register
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {visibleCount} shown
              {filledCount > 0 ? ` · ${filledCount} with data` : ""}
              {agencyName ? ` · ${agencyName}` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="space-y-3 md:hidden">
        {visibleIndexes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-[var(--bg-card)] px-4 py-11 text-center text-slate-500 dark:border-[#252c4d] dark:text-[#8d94b8]">
            <b className="mb-1 block text-[15px] text-slate-800 dark:text-[#eef0ff]">
              {entries.some((e) => e.driverName || e.vehicleNumber)
                ? "Nothing matches these filters"
                : "No entries yet"}
            </b>
            {entries.some((e) => e.driverName || e.vehicleNumber)
              ? "Clear the filters to see all entries."
              : "Add a row to get started."}
          </div>
        ) : (
          visibleIndexes.map((i, displayIdx) => {
            const e = entries[i];
            if (!e) return null;
            return (
            <div
              key={String(e.clientRowId || "").trim() || `n-${i}`}
              className={`overflow-hidden rounded-2xl border bg-[var(--bg-card)] shadow-sm dark:border-[#1e2638] ${
                e.isCompleted
                  ? "border-emerald-300/60 dark:border-emerald-500/30"
                  : "border-slate-200"
              }`}
            >
              <div
                className={`h-1 ${
                  e.isCompleted
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                    : "bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-600"
                }`}
              />
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2.5 dark:border-[#1e2638]">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-indigo-500/40 bg-indigo-500/15 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
                    {displayIdx + 1}
                  </span>
                  <span className="truncate text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                    {e.driverName?.trim() || `Entry ${displayIdx + 1}`}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      e.isCompleted
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {e.isCompleted ? "Done" : "Pending"}
                  </span>
                </div>
                {rowActions(e, i, true)}
              </div>
              <div className="space-y-3 p-3.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Date
                    </label>
                    <CellInput
                      value={e.date}
                      onChange={(v) => update(i, "date", v)}
                      type="date"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Vehicle Type
                    </label>
                    <VehicleTypeSelect
                      value={e.vehicleType}
                      onChange={(v) => update(i, "vehicleType", v)}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Driver Name
                    </label>
                    <DriverNameCombobox
                      value={e.driverName}
                      selectedDriverId={e.driverId}
                      onChange={(v) => {
                        onChange((prev) => {
                          const next = [...prev];
                          next[i] = {
                            ...next[i],
                            driverName: v,
                            driverId: undefined,
                          };
                          return next;
                        });
                      }}
                      onDriverSelect={(d: Driver) => {
                        const digits = String(d.phone ?? "").replace(/\D/g, "");
                        onChange((prev) => {
                          const next = [...prev];
                          next[i] = {
                            ...next[i],
                            driverName: driverDisplayName(d),
                            driverId: d._id ?? d.id,
                            mobileNumber: digits || next[i].mobileNumber,
                          };
                          return next;
                        });
                      }}
                      placeholder="Driver name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Mobile
                    </label>
                    <CellInput
                      value={e.mobileNumber}
                      onChange={(v) => {
                        onChange((prev) => {
                          const next = [...prev];
                          next[i] = {
                            ...next[i],
                            mobileNumber: v,
                            driverId: undefined,
                          };
                          return next;
                        });
                      }}
                      placeholder="9876543210"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Vehicle No.
                    </label>
                    <CellInput
                      value={e.vehicleNumber}
                      onChange={(v) => update(i, "vehicleNumber", v)}
                      placeholder="KL07XX1234"
                      className={plateInputCls}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Notes
                  </label>
                  <input
                    value={e.notes}
                    onChange={(ev) => update(i, "notes", ev.target.value)}
                    placeholder="Add note…"
                    className="w-full rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2.5 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>
          );
          })
        )}
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-[var(--bg-card)] shadow-sm dark:border-[#1e2638] md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-[#1e2638] dark:bg-white/[0.03] dark:text-slate-400">
                <th className="w-10 px-3 py-2.5 text-center font-mono">#</th>
                <th className="px-2 py-2.5">Date</th>
                <th className="px-2 py-2.5">Driver Name</th>
                <th className="px-2 py-2.5">Mobile</th>
                <th className="px-2 py-2.5">Vehicle Number</th>
                <th className="px-2 py-2.5">Type</th>
                <th className="min-w-[120px] px-2 py-2.5">Notes</th>
                <th className="w-28 px-2 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e2638]">
              {visibleIndexes.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-11 text-center text-slate-500 dark:text-[#8d94b8]"
                  >
                    <b className="mb-1 block text-[15px] text-slate-800 dark:text-[#eef0ff]">
                      {entries.some((e) => e.driverName || e.vehicleNumber)
                        ? "Nothing matches these filters"
                        : "No entries yet"}
                    </b>
                    {entries.some((e) => e.driverName || e.vehicleNumber)
                      ? "Clear the filters to see all entries."
                      : "Add a row to get started."}
                  </td>
                </tr>
              ) : (
                visibleIndexes.map((i, displayIdx) => {
                  const e = entries[i];
                  if (!e) return null;
                const isDraft =
                  !e.driverName?.trim() &&
                  !e.vehicleNumber?.trim() &&
                  !e.mobileNumber?.trim();
                return (
                  <tr
                    key={String(e.clientRowId || "").trim() || `n-${i}`}
                    className={`group transition hover:bg-slate-50/50 dark:hover:bg-white/[0.03] ${
                      e.isCompleted
                        ? "bg-emerald-50/40 dark:bg-emerald-500/[0.04]"
                        : isDraft
                          ? "opacity-90"
                          : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded font-mono text-[11px] font-medium ${
                          e.isCompleted
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                        }`}
                      >
                        {displayIdx + 1}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={e.date}
                        onChange={(v) => update(i, "date", v)}
                        type="date"
                        className="font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <DriverNameCombobox
                        value={e.driverName}
                        selectedDriverId={e.driverId}
                        onChange={(v) => {
                          onChange((prev) => {
                            const next = [...prev];
                            next[i] = {
                              ...next[i],
                              driverName: v,
                              driverId: undefined,
                            };
                            return next;
                          });
                        }}
                        onDriverSelect={(d: Driver) => {
                          const digits = String(d.phone ?? "").replace(
                            /\D/g,
                            "",
                          );
                          onChange((prev) => {
                            const next = [...prev];
                            next[i] = {
                              ...next[i],
                              driverName: driverDisplayName(d),
                              driverId: d._id ?? d.id,
                              mobileNumber: digits || next[i].mobileNumber,
                            };
                            return next;
                          });
                        }}
                        placeholder="Driver name"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={e.mobileNumber}
                        onChange={(v) => {
                          onChange((prev) => {
                            const next = [...prev];
                            next[i] = {
                              ...next[i],
                              mobileNumber: v,
                              driverId: undefined,
                            };
                            return next;
                          });
                        }}
                        placeholder="9876543210"
                        className="font-mono"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <CellInput
                        value={e.vehicleNumber}
                        onChange={(v) => update(i, "vehicleNumber", v)}
                        placeholder="KL07XX1234"
                        className={plateInputCls}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <VehicleTypeSelect
                        value={e.vehicleType}
                        onChange={(v) => update(i, "vehicleType", v)}
                        className="py-1.5 text-xs"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={e.notes}
                        onChange={(ev) => update(i, "notes", ev.target.value)}
                        placeholder="Add note…"
                        className="w-full min-w-[120px] rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2 py-1.5 text-xs outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex justify-end">{rowActions(e, i, true)}</div>
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-[var(--bg-main)]/95 pt-3 backdrop-blur-sm dark:border-[#1e2638]">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={addEntry}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-indigo-600 transition hover:border-indigo-500 hover:bg-indigo-50/50 dark:border-[#334155] dark:text-indigo-300 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10"
        >
          <Plus className="h-4 w-4" /> Add Entry
        </button>
        {filledCount > 0 && (
          <button
            type="button"
            onClick={() => {
              const defaultName = `NormalTrips_${(agencyName || "Agency").replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
              const fileName = window.prompt(
                "Enter file name for Report:",
                defaultName,
              );
              if (fileName) {
                const reportEntries = entries
                  .filter(
                    (e) => e.driverName || e.vehicleNumber || e.mobileNumber,
                  )
                  .filter((e) => !isRowHidden(e) && matchesSearch(e));
                generateNormalTripsPDF(
                  user?.name || "Owner",
                  agencyName || "Agency",
                  fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`,
                  reportEntries,
                );
              }
            }}
            title="Download Normal Trips Report"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-[var(--bg-elevated)] px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-[#1e2638] dark:text-slate-200 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
          >
            <FileDown className="h-4 w-4 text-rose-400" /> Report (PDF)
          </button>
        )}
        <button
          type="button"
          onClick={() => copyAllEntries(entries, agencyName)}
          title="Copy all entries"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-[var(--bg-elevated)] px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-[#1e2638] dark:text-slate-200 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
        >
          <Copy className="h-4 w-4 text-indigo-400" /> Copy All
        </button>
      </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function BulkEntryPage() {
  // State — agencies
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agencyLoading, setAgencyLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showGuestPanel, setShowGuestPanel] = useState(false);
  const [guestPendingCount, setGuestPendingCount] = useState(0);
  const [tripLoadNotice, setTripLoadNotice] = useState<string | null>(null);

  // Delete confirmations (prevents rapid double-deletes & gives server time)
  type PendingDelete = { ids: string[]; title: string; message: string };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const deletePromiseRef = useRef<{
    resolve: () => void;
    reject: (err?: any) => void;
  } | null>(null);

  // State — mode
  const [activeTab, setActiveTab] = useState<"bulk" | "normal" | "payout">(
    () => {
      try {
        const v = localStorage.getItem(LS_ENTRY_MODE) as any;
        // Payout UI temporarily disabled — fall back to bulk
        // if (v === "normal" || v === "payout") return v;
        if (v === "normal") return v;
        return "bulk";
      } catch {
        return "bulk";
      }
    },
  );

  // State — bulk data (functional updater pattern for perf)
  const [filterStatus, setFilterStatus] = useState<EntryFilterStatus>("pending");
  const [tableSearch, setTableSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortDir, setSortDir] = useState<EntrySortDir>("desc");
  const bulkTableRef = useRef<BulkEntryTableHandle>(null);

  // State — bulk data (functional updater pattern for perf)
  const [bulkGroups, setBulkGroupsRaw] = useState<DriverGroup[]>([
    emptyDriverGroup(),
  ]);

  // State — normal data
  const [normalEntries, setNormalEntriesRaw] = useState<NormalEntryRow[]>([
    emptyNormalRow(),
  ]);

  // Functional updater wrappers — allow children to pass updater functions
  const setBulkGroups = useCallback(
    (updater: DriverGroup[] | ((prev: DriverGroup[]) => DriverGroup[])) => {
      setBulkGroupsRaw((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        return (next || []).map((g) => ({
          ...g,
          rows: sortBulkRowsByDate(g.rows?.length ? g.rows : [emptyBulkRow()]),
        }));
      });
    },
    [],
  );

  const setNormalEntries = useCallback(
    (
      updater:
        | NormalEntryRow[]
        | ((prev: NormalEntryRow[]) => NormalEntryRow[]),
    ) => {
      setNormalEntriesRaw(
        typeof updater === "function" ? updater : () => updater,
      );
    },
    [],
  );

  // No manual submit — MS Office style autosync only

  const selectedAgency =
    agencies.find((a) => (a._id ?? a.id) === selectedId) ?? null;

  // ── Serializers (stable refs) ──
  const serializeBulk = useCallback(
    (groups: DriverGroup[]) => JSON.stringify(groups),
    [],
  );
  const serializeNormal = useCallback(
    (entries: NormalEntryRow[]) => JSON.stringify(entries),
    [],
  );

  // derive isBulkMode from activeTab
  const isBulkMode = activeTab === "bulk";

  // ── Backend sync callbacks (stable refs) ──
  const syncBulkToBackend = useCallback(
    async (groups: DriverGroup[]) => {
      if (!selectedAgency) return;
      // Persist named driver/vehicle groups even with no trip fields yet
      // (one draft placeholder row). Skip completely blank shells.
      const validGroups = groups
        .map((g) => {
          const driverName = g.driverName.trim();
          const vehicleNumber = g.vehicleNumber.trim();
          if (!driverName || !vehicleNumber) return null;

          const dataRows = g.rows.filter((r) => bulkRowHasData(r));
          if (dataRows.length > 0) {
            return { ...g, driverName, vehicleNumber, rows: dataRows };
          }

          // Driver-only: keep first row (or a fresh placeholder) so autosync
          // can create a draft AgencyTrip and survive navigation/reload.
          const shell = g.rows[0] ? { ...g.rows[0] } : emptyBulkRow();
          return {
            ...g,
            driverName,
            vehicleNumber,
            rows: [shell],
          };
        })
        .filter(Boolean) as DriverGroup[];

      if (validGroups.length === 0) return;
      const res = await syncBulkEntry({
        agencyId: selectedAgency._id ?? selectedAgency.id,
        agencyName: selectedAgency.name,
        driverGroups: validGroups,
      });

      // Patch returned _id mappings back into state so refresh doesn't duplicate server rows.
      const mappings = (res.rows ?? []).filter(
        (r) => r.clientRowId && r._id,
      ) as Array<{ clientRowId: string; _id: string }>;
      if (mappings.length === 0) return;
      const map = new Map(mappings.map((m) => [m.clientRowId, m._id]));

      setBulkGroupsRaw((prev) =>
        prev.map((g) => ({
          ...g,
          rows: g.rows.map((r) => {
            if (r._id) return r;
            const id = map.get(r.clientRowId);
            return id ? { ...r, _id: id } : r;
          }),
        })),
      );
    },
    [selectedAgency],
  );

  const syncNormalToBackend = useCallback(
    async (entries: NormalEntryRow[]) => {
      if (!selectedAgency) return;
      const validEntries = entries.filter(
        (e) => e.driverName.trim() && e.vehicleNumber.trim(),
      );
      if (validEntries.length === 0) return;
      const res = await syncNormalEntry({
        agencyId: selectedAgency._id ?? selectedAgency.id,
        agencyName: selectedAgency.name,
        entries: validEntries,
      });

      const mappings = (res.rows ?? []).filter(
        (r) => r.clientRowId && r._id,
      ) as Array<{ clientRowId: string; _id: string }>;
      if (mappings.length === 0) return;
      const map = new Map(mappings.map((m) => [m.clientRowId, m._id]));
      setNormalEntriesRaw((prev) =>
        prev.map((e) => {
          if (e._id) return e;
          const id = map.get(e.clientRowId || "");
          return id ? { ...e, _id: id } : e;
        }),
      );
    },
    [selectedAgency],
  );

  // ── Autosave hooks ──
  const bulkLsKey =
    selectedId && isBulkMode ? `${LS_BULK_PREFIX}${selectedId}` : null;
  const normalLsKey =
    selectedId && !isBulkMode ? `${LS_NORMAL_PREFIX}${selectedId}` : null;

  const bulkSyncStatus = useAutosave(
    bulkLsKey,
    bulkGroups,
    serializeBulk,
    syncBulkToBackend,
  );
  const normalSyncStatus = useAutosave(
    normalLsKey,
    normalEntries,
    serializeNormal,
    syncNormalToBackend,
  );

  const currentSyncStatus = isBulkMode ? bulkSyncStatus : normalSyncStatus;

  // ── Calculate selected agency total balance ──
  const agencyTotalBalance = useMemo(() => {
    if (!isBulkMode) return 0;

    let totalBalance = 0;

    for (const group of bulkGroups) {
      if (
        !group.driverName.trim() &&
        !group.vehicleNumber.trim() &&
        group.rows.every(
          (r) => !r.startDate && !r.startKm && !r.grandTotal && !r.advancePaid,
        )
      ) {
        continue;
      }

      group.rows.forEach((row) => {
        const gt = row.grandTotal || 0;
        const rowAdvance = row.advancePaid || 0;
        totalBalance += calculateBalanceAmount(gt, rowAdvance);
      });
    }

    return totalBalance;
  }, [bulkGroups, isBulkMode]);

  // ── Load agencies ──
  const loadAgencies = useCallback(async () => {
    setAgencyLoading(true);
    try {
      const data = await fetchAllAgencies();
      setAgencies(data.agencies);
      if (!data.complete) {
        setTripLoadNotice(
          "Could not load every agency from the server. Refresh or contact support.",
        );
      }
      if (data.agencies.length > 0) {
        // Restore last selected agency if it still exists, else fallback to first.
        let preferredId: string | null = null;
        try {
          preferredId = localStorage.getItem(LS_SELECTED_AGENCY);
        } catch {
          /* ignore */
        }
        const resolvedPreferred = preferredId
          ? (data.agencies.find((a) => (a._id ?? a.id) === preferredId)?._id ??
            data.agencies.find((a) => (a._id ?? a.id) === preferredId)?.id)
          : null;

        const initialId = (resolvedPreferred ??
          selectedId ??
          data.agencies[0]._id ??
          data.agencies[0].id ??
          null) as string | null;
        if (initialId && initialId !== selectedId) {
          setSelectedId(initialId);
        }

        // Restore draft state for the chosen agency (bulk + normal), if present.
        if (initialId) {
          const savedBulk = loadFromLocalStorage<DriverGroup[]>(
            `${LS_BULK_PREFIX}${initialId}`,
            [],
          );
          if (savedBulk.length > 0) {
            setBulkGroupsRaw(normalizeBulkGroups(savedBulk));
          }
          const savedNormal = loadFromLocalStorage<NormalEntryRow[]>(
            `${LS_NORMAL_PREFIX}${initialId}`,
            [],
          );
          if (savedNormal.length > 0) setNormalEntriesRaw(savedNormal);
        }
      }
    } catch {
      /* silent */
    } finally {
      setAgencyLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadAgencies();
  }, [loadAgencies]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const inv = await fetchGuestBulkInvites();
        if (!cancelled) {
          setGuestPendingCount(
            inv.reduce((n, i) => n + (i.pendingSubmissions ?? 0), 0),
          );
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showGuestPanel]);

  // ── Load trips when agency/mode changes ──
  const loadTrips = useCallback(async () => {
    if (!selectedId || !selectedAgency) return;
    setTripLoadNotice(null);
    try {
      if (isBulkMode) {
        const { trips, complete, loadedCount, expectedTotal } =
          await fetchAllBulkEntryTrips(selectedId);
        if (!complete) {
          setTripLoadNotice(
            expectedTotal != null
              ? `Only ${loadedCount.toLocaleString("en-IN")} of ${expectedTotal.toLocaleString("en-IN")} trips loaded. Contact support — list may be incomplete.`
              : `Only ${loadedCount.toLocaleString("en-IN")} trips loaded. Contact support — list may be incomplete.`,
          );
        }
        // Convert server trips into editable DriverGroup[] format
        const grouped: Record<string, typeof trips> = {};
        for (const t of trips) {
          const key = `${(t.driverName || "").trim()}|||${(t.vehicleNumber || "").trim().toUpperCase()}`;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(t);
        }
        const serverGroups: DriverGroup[] = Object.values(grouped).map(
          (grp) => {
            const first = grp[0];
            const rows = sortBulkRowsByDate(
              grp.map((t) => ({
                // Preserve server clientRowId so refresh can dedupe against local drafts
                clientRowId:
                  String((t as any).clientRowId || "").trim() || nextRowId(),
                _id: t._id ?? t.id,
                startDate: t.startDate ? t.startDate.split("T")[0] : "",
                endDate: t.endDate ? t.endDate.split("T")[0] : "",
                startKm: String(t.startKm ?? ""),
                endKm: String(t.endKm ?? ""),
                startTime: t.startTime || "",
                endTime: t.endTime || "",
                distance: Number(t.distance ?? 0),
                hours: Number(t.hours ?? 0),
                toll: Number(t.toll ?? 0),
                advancePaid: Number(t.advancePaid ?? 0),
                grandTotal: Number(t.grandTotal ?? 0),
                notes: t.notes || "",
                isCompleted: !!t.isCompleted,
                createdAt: (t as any).createdAt
                  ? String((t as any).createdAt)
                  : undefined,
              })),
            );
            const createdMs = rows
              .map((r) =>
                groupCreatedAtMs({
                  driverName: "",
                  vehicleNumber: "",
                  rows: [r],
                }),
              )
              .filter((n) => n > 0);
            const groupCreatedAt =
              createdMs.length > 0
                ? new Date(Math.min(...createdMs)).toISOString()
                : undefined;
            return {
              clientGroupId: nextGroupId(),
              driverName: first.driverName || "",
              vehicleNumber: first.vehicleNumber || "",
              rows,
              groupCreatedAt,
            };
          },
        );
        setBulkGroupsRaw((prev) => {
          // Canonical merge: one group per (driverName, vehicleNumber) for named cards.
          // Blank local shells keep their own clientGroupId so "+ Add Driver / Vehicle"
          // cards never collapse into (or clone) another card.
          const keyOf = (
            g: Pick<DriverGroup, "driverName" | "vehicleNumber">,
          ) =>
            `${(g.driverName || "").trim().toLowerCase()}|||${(g.vehicleNumber || "").trim().toUpperCase()}`;

          const rowKey = (r: any) =>
            r?._id
              ? `id:${String(r._id)}`
              : `cr:${String(r.clientRowId || "")}`;

          const prevByKey = new Map<string, DriverGroup>();
          for (const lg of prev) {
            const k = keyOf(lg);
            if (
              (lg.driverName || "").trim() ||
              (lg.vehicleNumber || "").trim()
            ) {
              if (!prevByKey.has(k)) prevByKey.set(k, lg);
            }
          }

          const outByKey = new Map<string, DriverGroup>();
          for (const sg of serverGroups) {
            const k = keyOf(sg);
            const localMatch = prevByKey.get(k);
            outByKey.set(k, {
              ...sg,
              clientGroupId:
                localMatch?.clientGroupId || sg.clientGroupId || nextGroupId(),
              driverId: localMatch?.driverId ?? sg.driverId,
              driverPhone: localMatch?.driverPhone ?? sg.driverPhone,
              rows: [...sg.rows],
            });
          }

          const existingRowKeysByGroup = new Map<string, Set<string>>();
          for (const [k, g] of outByKey.entries()) {
            existingRowKeysByGroup.set(
              k,
              new Set(g.rows.map(rowKey).filter(Boolean)),
            );
          }

          const blankShells: DriverGroup[] = [];
          const seenBlankIds = new Set<string>();

          // Keep unsaved local drafts (no _id) with trip data.
          // Also keep local-only driver/vehicle shells and brand-new blank cards.
          for (const lg of prev) {
            const k = keyOf(lg);
            const hasIdentity =
              !!(lg.driverName || "").trim() ||
              !!(lg.vehicleNumber || "").trim();

            if (!hasIdentity) {
              const gid =
                String(lg.clientGroupId || "").trim() || nextGroupId();
              if (seenBlankIds.has(gid)) continue;
              seenBlankIds.add(gid);
              // Brand-new empty cards (or unnamed local drafts) stay as their own
              // card — never merge into another driver/vehicle group via key "|||".
              blankShells.push({
                ...lg,
                clientGroupId: gid,
                rows:
                  lg.rows.length > 0
                    ? lg.rows.map((r) => ({
                        ...emptyBulkRow(),
                        ...r,
                        clientRowId:
                          String(r.clientRowId || "").trim() || nextRowId(),
                      }))
                    : [emptyBulkRow()],
              });
              continue;
            }

            const target = outByKey.get(k) ?? {
              clientGroupId: lg.clientGroupId || nextGroupId(),
              driverName: lg.driverName,
              vehicleNumber: lg.vehicleNumber,
              rows: [],
              groupCreatedAt: lg.groupCreatedAt,
              driverId: lg.driverId,
              driverPhone: lg.driverPhone,
            };

            const seen = existingRowKeysByGroup.get(k) ?? new Set<string>();
            for (const r of lg.rows) {
              if (r?._id) continue;
              if (!bulkRowHasData(r)) continue;
              const rk = rowKey(r);
              if (!rk) continue;
              if (!seen.has(rk)) {
                target.rows.push({
                  ...emptyBulkRow(),
                  ...r,
                  clientRowId:
                    String(r.clientRowId || "").trim() || nextRowId(),
                  advancePaid: Number((r as any).advancePaid ?? 0) || 0,
                });
                seen.add(rk);
              }
            }

            const alreadyOnServer = outByKey.has(k);

            if (target.rows.length > 0 || alreadyOnServer) {
              if (!target.groupCreatedAt && lg.groupCreatedAt) {
                target.groupCreatedAt = lg.groupCreatedAt;
              }
              if (!target.clientGroupId && lg.clientGroupId) {
                target.clientGroupId = lg.clientGroupId;
              }
              outByKey.set(k, target);
              existingRowKeysByGroup.set(k, seen);
            } else if (hasIdentity) {
              // Driver-only local shell (no trip fields yet)
              target.rows =
                lg.rows.length > 0
                  ? lg.rows.map((r) => ({
                      ...emptyBulkRow(),
                      ...r,
                      clientRowId:
                        String(r.clientRowId || "").trim() || nextRowId(),
                    }))
                  : [emptyBulkRow()];
              outByKey.set(k, target);
              existingRowKeysByGroup.set(k, seen);
            }
          }

          const merged = [
            ...Array.from(outByKey.values()),
            ...blankShells,
          ]
            .map((g) => ({
              ...g,
              clientGroupId: g.clientGroupId || nextGroupId(),
              rows: sortBulkRowsByDate(
                g.rows.length > 0 ? g.rows : [emptyBulkRow()],
              ),
            }))
            .filter(
              (g) =>
                g.rows.length > 0 ||
                g.driverName.trim() ||
                g.vehicleNumber.trim() ||
                !!g.clientGroupId,
            );

          return merged.length > 0 ? merged : [emptyDriverGroup()];
        });
      } else {
        const { trips, complete, loadedCount, expectedTotal } =
          await fetchAllNormalEntryTrips(selectedId);
        if (!complete) {
          setTripLoadNotice(
            expectedTotal != null
              ? `Only ${loadedCount.toLocaleString("en-IN")} of ${expectedTotal.toLocaleString("en-IN")} entries loaded. Contact support.`
              : `Only ${loadedCount.toLocaleString("en-IN")} entries loaded. Contact support.`,
          );
        }
        const serverEntries: NormalEntryRow[] = trips.map((t) => ({
          _id: t._id ?? t.id,
          clientRowId:
            String((t as any).clientRowId || "").trim() || nextRowId(),
          date: t.date ? t.date.split("T")[0] : "",
          driverName: t.driverName || "",
          mobileNumber: t.mobileNumber || "",
          vehicleNumber: t.vehicleNumber || "",
          vehicleType: t.vehicleType || "",
          notes: t.notes || "",
          isCompleted: !!t.isCompleted,
        }));
        setNormalEntriesRaw((prev) => {
          // Prefer server entries. Keep only local drafts that never had a server _id.
          const key = (e: any) =>
            e?._id
              ? `id:${String(e._id)}`
              : `local:${String(e.clientRowId || "")}|${String(e.driverName || "")}|${String(e.vehicleNumber || "")}|${String(e.date || "")}`;
          const seen = new Set<string>();
          const out: NormalEntryRow[] = [];

          for (const se of serverEntries) {
            const k = key(se);
            if (!seen.has(k)) {
              out.push(se);
              seen.add(k);
            }
          }
          for (const le of prev) {
            if (le._id) continue;
            // Ensure every local draft has a stable clientRowId (never share keys)
            const row: NormalEntryRow = {
              ...le,
              clientRowId:
                String(le.clientRowId || "").trim() || nextRowId(),
            };
            const k = key(row);
            if (!seen.has(k)) {
              out.push(row);
              seen.add(k);
            }
          }

          const hasAny = out.some(
            (e) => e.driverName.trim() || e.vehicleNumber.trim(),
          );
          return hasAny ? out : [emptyNormalRow()];
        });
      }
    } catch {
      /* silent */
    }
  }, [selectedId, isBulkMode, selectedAgency]);

  const performDeleteTrips = useCallback(
    async (ids: string[]) => {
      const uniq = Array.from(new Set((ids ?? []).map(String).filter(Boolean)));
      for (const id of uniq) {
        if (isBulkMode) await deleteBulkEntryTrip(id);
        else await deleteNormalEntryTrip(id);
      }

      // Drop deleted rows from local state immediately so autosave/localStorage
      // cannot resurrect them before (or after) the reload merge.
      const idSet = new Set(uniq);
      if (isBulkMode) {
        setBulkGroupsRaw((prev) => {
          const next = prev
            .map((g) => ({
              ...g,
              rows: g.rows.filter((r) => !r._id || !idSet.has(String(r._id))),
            }))
            .filter((g) => g.rows.length > 0);
          return next.length > 0 ? next : [emptyDriverGroup()];
        });
      } else {
        setNormalEntriesRaw((prev) => {
          const next = prev.filter(
            (e) => !e._id || !idSet.has(String(e._id)),
          );
          return next.length > 0 ? next : [emptyNormalRow()];
        });
      }

      await loadTrips();
    },
    [isBulkMode, loadTrips],
  );

  const requestDeleteTrips = useCallback(
    (ids: string[], title: string, message: string) => {
      const cleanIds = Array.from(
        new Set((ids ?? []).map(String).filter(Boolean)),
      );
      if (cleanIds.length === 0)
        return Promise.reject(new Error("No items to delete"));
      if (deleteInFlight || deletePromiseRef.current) {
        return Promise.reject(new Error("Deletion already in progress"));
      }
      return new Promise<void>((resolve, reject) => {
        deletePromiseRef.current = { resolve, reject };
        setPendingDelete({ ids: cleanIds, title, message });
      });
    },
    [deleteInFlight],
  );

  const confirmDelete = useCallback(async () => {
    const req = pendingDelete;
    const pending = deletePromiseRef.current;
    if (!req || !pending) return;
    setDeleteInFlight(true);
    try {
      await performDeleteTrips(req.ids);
      pending.resolve();
    } catch (e: any) {
      if (e?.response?.status === 404) {
        // If it's already deleted in the backend (ghost row), treat it as a success
        pending.resolve();
      } else {
        pending.reject(e);
        const msg =
          e?.response?.data?.message ?? e?.message ?? "Failed to delete";
        alert(msg);
      }
    } finally {
      deletePromiseRef.current = null;
      setDeleteInFlight(false);
      setPendingDelete(null);
    }
  }, [pendingDelete, performDeleteTrips]);

  const cancelDelete = useCallback(() => {
    const pending = deletePromiseRef.current;
    deletePromiseRef.current = null;
    setDeleteInFlight(false);
    setPendingDelete(null);
    pending?.reject(new Error("cancelled"));
  }, []);

  const handleDeleteTrip = useCallback(
    (id: string) =>
      requestDeleteTrips(
        [id],
        "Delete saved trip",
        "Delete this trip? This cannot be undone.",
      ),
    [requestDeleteTrips],
  );

  const handleDeleteTrips = useCallback(
    (ids: string[]) =>
      requestDeleteTrips(
        ids,
        "Delete saved trips",
        `Delete ${ids.length} trip(s)? This cannot be undone.`,
      ),
    [requestDeleteTrips],
  );

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  // ── Agency selection ──
  const selectAgency = useCallback((id: string) => {
    setSelectedId(id);
    setShowDropdown(false);
    try {
      localStorage.setItem(LS_SELECTED_AGENCY, id);
    } catch {}
    // Restore from localStorage
    const savedBulk = loadFromLocalStorage<DriverGroup[]>(
      `${LS_BULK_PREFIX}${id}`,
      [],
    );
    setBulkGroupsRaw(
      savedBulk.length > 0
        ? normalizeBulkGroups(savedBulk)
        : [emptyDriverGroup()],
    );
    const savedNormal = loadFromLocalStorage<NormalEntryRow[]>(
      `${LS_NORMAL_PREFIX}${id}`,
      [],
    );
    setNormalEntriesRaw(
      savedNormal.length > 0 ? savedNormal : [emptyNormalRow()],
    );
  }, []);

  // ── Mode toggle ──
  const toggleMode = useCallback((tab: "bulk" | "normal" | "payout") => {
    setActiveTab(tab);
    try {
      localStorage.setItem(LS_ENTRY_MODE, tab);
    } catch {}
  }, []);

  /** One Normal row → one new Bulk driver group (not all rows at once). */
  const sendNormalDriverToBulk = useCallback(
    (entry: NormalEntryRow) => {
      const driverName = String(entry.driverName ?? "").trim();
      if (!driverName) {
        window.alert("Enter a driver name first.");
        return;
      }

      const vehicleNumber = String(entry.vehicleNumber ?? "")
        .trim()
        .toUpperCase();
      const digits = String(entry.mobileNumber ?? "").replace(/\D/g, "");
      // Only keep DB id when this row is already linked to a registered driver
      const driverId = entry.driverId || undefined;
      const isRegistered = Boolean(driverId);

      const already = bulkGroups.some(
        (g) =>
          String(g.driverName ?? "")
            .trim()
            .toLowerCase() === driverName.toLowerCase() &&
          String(g.vehicleNumber ?? "")
            .trim()
            .toUpperCase() === vehicleNumber,
      );
      if (already) {
        toggleMode("bulk");
        window.alert(
          `"${driverName}"${vehicleNumber ? ` / ${vehicleNumber}` : ""} is already in Bulk.`,
        );
        return;
      }

      const group: DriverGroup = {
        ...emptyDriverGroup(),
        driverName,
        vehicleNumber,
        // New / unregistered → no id so Bulk shows the phone field
        driverId: isRegistered ? driverId : undefined,
        driverPhone: digits || undefined,
      };

      setBulkGroups((prev) => {
        const onlyEmpty =
          prev.length === 1 &&
          !String(prev[0].driverName ?? "").trim() &&
          !String(prev[0].vehicleNumber ?? "").trim() &&
          !(prev[0].rows ?? []).some(
            (r) =>
              r.startDate ||
              r.endDate ||
              r.grandTotal ||
              r.advancePaid ||
              r.notes ||
              r._id,
          );
        return onlyEmpty ? [group] : [...prev, group];
      });

      toggleMode("bulk");
    },
    [bulkGroups, setBulkGroups, toggleMode],
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const close = () => setShowDropdown(false);
    document.addEventListener("click", close, { once: true });
    return () => document.removeEventListener("click", close);
  }, [showDropdown]);

  // No manual submit handlers — autosync only

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-full flex-col bg-[var(--bg-main)] overflow-hidden">
      {/* ─── HEADER BAR ─── */}
      <div className="sticky top-0 z-20 flex flex-col justify-between gap-2 border-b border-slate-200 bg-[var(--bg-card)]/90 px-2.5 py-2 shadow-sm backdrop-blur-md shrink-0 dark:border-[#1e2638] sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-6 sm:py-3.5">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <FileSpreadsheet className="h-6 w-6 text-indigo-500 shrink-0 hidden sm:block" />
          <h1 className="text-sm sm:text-base font-bold text-slate-800 uppercase tracking-wider hidden md:block dark:text-white">
            {isBulkMode ? "Bulk Entry" : "Normal Entry"}
          </h1>

          {/* Agency picker */}
          <div className="relative flex-1 sm:flex-none min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2 py-1.5 text-xs transition hover:border-indigo-300 w-full sm:min-w-[180px] sm:gap-2 sm:rounded-lg sm:px-3 sm:py-2.5 sm:text-sm dark:border-[#1e2638] dark:hover:border-indigo-400"
            >
              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0 sm:h-4.5 sm:w-4.5" />
              <span className="truncate text-slate-700 font-medium dark:text-slate-200">
                {selectedAgency
                  ? formatAgencyLabel(selectedAgency)
                  : "Select Agency"}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400 ml-auto shrink-0" />
            </button>

            {showDropdown && (
              <div
                className="absolute left-0 top-full mt-1 w-full sm:w-72 rounded-xl border border-slate-200 bg-[var(--bg-card)] shadow-lg z-30 py-1 max-h-60 overflow-y-auto dark:border-[#1e2638]"
                onClick={(e) => e.stopPropagation()}
              >
                {agencyLoading ? (
                  <div className="px-4 py-3 text-sm text-slate-400 text-center">
                    Loading…
                  </div>
                ) : agencies.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-400 text-center">
                    No agencies created yet
                  </div>
                ) : (
                  agencies.map((a) => (
                    <button
                      key={a._id ?? a.id}
                      type="button"
                      onClick={() => selectAgency(a._id ?? a.id ?? "")}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition ${
                        (a._id ?? a.id) === selectedId
                          ? "bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-500/15 dark:text-indigo-300"
                          : "text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      <span className="block font-medium truncate">
                        {formatAgencyLabel(a)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-indigo-700 shrink-0 sm:gap-1.5 sm:rounded-lg sm:px-3 sm:py-2.5 sm:text-xs dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{" "}
            <span className="hidden sm:inline">Agency</span>
            <span className="sm:hidden">New</span>
          </button>

          {isBulkMode && (
            <GuestLinkButton
              pendingCount={guestPendingCount}
              onClick={() => setShowGuestPanel(true)}
            />
          )}

          {/* Payout — temporarily disabled
          {selectedAgency && (
            <button
              type="button"
              onClick={() => toggleMode("payout")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-semibold transition shadow-sm shrink-0 border ${
                activeTab === "payout"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                  : "bg-[var(--bg-elevated)] text-emerald-600 border-emerald-100 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500/20 dark:hover:bg-emerald-500/10"
              }`}
            >
              <Wallet className="h-4 w-4" />{" "}
              <span className="hidden sm:inline">Payout</span>
            </button>
          )}
          */}

          {/* Agency Total Balance Display */}
          {selectedAgency && isBulkMode && (
            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 border border-emerald-100 shadow-sm transition-all hover:shadow hover:bg-emerald-100/60 sm:ml-auto dark:bg-emerald-500/10 dark:border-emerald-500/20">
              <span className="text-xs sm:text-sm font-bold text-emerald-600 uppercase tracking-wider">
                Balance:
              </span>
              <span
                className={`text-sm sm:text-base font-bold ${agencyTotalBalance < 0 ? "text-red-600" : "text-emerald-700"}`}
              >
                ₹{agencyTotalBalance.toLocaleString("en-IN")}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Mobile total balance */}
          {selectedAgency && isBulkMode && (
            <div className="sm:hidden flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-1 border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20">
              <span className="text-[10px] font-bold text-emerald-600 uppercase">
                Bal:
              </span>
              <span
                className={`text-xs font-bold ${agencyTotalBalance < 0 ? "text-red-600" : "text-emerald-700"}`}
              >
                ₹{agencyTotalBalance.toLocaleString("en-IN")}
              </span>
            </div>
          )}

          {/* Sync status */}
          <SyncBadge status={currentSyncStatus} />

          {/* Mode toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-[#1e2638] dark:bg-white/5">
            <button
              type="button"
              onClick={() => toggleMode("bulk")}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                activeTab === "bulk"
                  ? "bg-indigo-600 text-white shadow-sm dark:bg-indigo-500"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Bulk
            </button>
            <button
              type="button"
              onClick={() => toggleMode("normal")}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                activeTab === "normal"
                  ? "bg-indigo-600 text-white shadow-sm dark:bg-indigo-500"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Normal
            </button>
          </div>

          <button
            type="button"
            onClick={loadTrips}
            className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full transition active:rotate-180 shrink-0 dark:text-slate-400 dark:hover:bg-white/10"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          {/* No manual submit (autosync only) */}
        </div>
      </div>

      {tripLoadNotice && (
        <div
          className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 sm:px-6"
          role="status"
        >
          {tripLoadNotice}
        </div>
      )}

      {/* ─── CONTENT ─── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2.5 sm:p-5 lg:p-6">
        {!selectedAgency ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
            <Building2 className="h-16 w-16 text-slate-200" />
            <p className="text-base font-medium text-slate-500 dark:text-slate-400">
              Select an agency to get started
            </p>
            <p className="text-sm text-slate-400">
              Choose from the dropdown above, or create a new agency.
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <EntryFiltersBar
              title={isBulkMode ? "Drivers" : "Normal entries"}
              count={
                isBulkMode
                  ? bulkGroups.filter(
                      (g) =>
                        g.driverName.trim() ||
                        g.vehicleNumber.trim() ||
                        g.rows.some((r) => bulkRowHasData(r) || r._id),
                    ).length
                  : normalEntries.length
              }
              search={tableSearch}
              onSearchChange={setTableSearch}
              searchPlaceholder={
                isBulkMode
                  ? "Search driver or vehicle…"
                  : "Search driver, vehicle, phone…"
              }
              sortDir={sortDir}
              onSortDirChange={setSortDir}
              filtersOpen={filtersOpen}
              onFiltersOpenChange={setFiltersOpen}
              filterStatus={filterStatus}
              onFilterStatusChange={setFilterStatus}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              showDateFilters={!isBulkMode}
              sortNewestLabel={
                isBulkMode ? "↓ Newest driver" : "↓ Newest"
              }
              sortOldestLabel={
                isBulkMode ? "↑ Oldest driver" : "↑ Oldest"
              }
              endAction={
                isBulkMode ? (
                  <button
                    type="button"
                    onClick={() => bulkTableRef.current?.openExport()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">
                      Download Bulk Trips Report (PDF)
                    </span>
                    <span className="sm:hidden">PDF</span>
                  </button>
                ) : null
              }
            />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {activeTab === "bulk" ? (
                <BulkEntryTable
                  ref={bulkTableRef}
                  groups={bulkGroups}
                  onChange={setBulkGroups}
                  filterStatus={filterStatus}
                  search={tableSearch}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  sortDir={sortDir}
                  onDeleteTrip={handleDeleteTrip}
                  onDeleteTrips={handleDeleteTrips}
                  agencyId={selectedAgency._id ?? selectedAgency.id ?? ""}
                  agencyName={formatAgencyLabel(selectedAgency)}
                />
              ) : (
                <NormalEntryTable
                  entries={normalEntries}
                  onChange={setNormalEntries}
                  filterStatus={filterStatus}
                  search={tableSearch}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  sortDir={sortDir}
                  onDeleteTrip={handleDeleteTrip}
                  agencyName={formatAgencyLabel(selectedAgency)}
                  onSendDriverToBulk={sendNormalDriverToBulk}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── MODALS ─── */}
      {showCreateModal && (
        <CreateAgencyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(a) => {
            setShowCreateModal(false);
            setAgencies((prev) => [...prev, a]);
            selectAgency(a._id ?? a.id ?? "");
          }}
        />
      )}
      {pendingDelete && (
        <ModalShell
          title={pendingDelete.title}
          onClose={cancelDelete}
          maxWidth="max-w-sm"
        >
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-200">{pendingDelete.message}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={cancelDelete}
                disabled={deleteInFlight}
                className="rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-[#1e2638] dark:text-slate-200 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteInFlight}
                className="rounded-lg bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleteInFlight ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      <GuestInvitesPanel
        open={showGuestPanel}
        onClose={() => setShowGuestPanel(false)}
      />
    </div>
  );
}
