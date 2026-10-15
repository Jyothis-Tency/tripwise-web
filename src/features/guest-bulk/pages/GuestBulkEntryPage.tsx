import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useParams } from "react-router-dom";
import {
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Cloud,
  CloudOff,
  Copy,
  Check,
  Ban,
  RotateCcw,
  Moon,
  Sun,
  ChevronDown,
  X,
  Building2,
  Pencil,
  User,
  Users,
  KeyRound,
  PanelLeft,
  PanelRight,
  Clock,
  Search,
  ArrowUpDown,
} from "lucide-react";
import {
  approveGuestBulk,
  blockGuestLinkUser,
  clearStoredGuestUserId,
  createGuestAgency,
  fetchGuestInvite,
  guestBulkShareUrl,
  joinGuestBulk,
  loadStoredGuestUserId,
  newBlockClientId,
  revokeGuestBulkInvite,
  rotateGuestBulkInviteToken,
  storeGuestUserId,
  syncGuestBulk,
  unblockGuestLinkUser,
  unrevokeGuestBulkInvite,
  type GuestAgencyBlock,
  type GuestBulkInvite,
  type GuestLinkUser,
} from "../api";
import type { Agency, BulkTripRow, DriverGroup } from "../../bulk-entry/api";
import { formatAgencyLabel } from "../../bulk-entry/api";
import { TimePicker12h } from "../../../components/ui/TimePicker12h";
import { normalizeHHmm } from "../../../lib/timePickerUtils";
import { useTheme } from "../../../hooks/useTheme";
import { TripwiseLogo } from "../../../components/brand/TripwiseLogo";

type SyncStatus = "idle" | "saving" | "saved" | "error";
const AUTOSAVE_DELAY = 1200;

function storedGuestSessionError(msg: string) {
  return /guest session not found|enter your phone again|blocked from this link/i.test(
    msg,
  );
}

const inputCls =
  "w-full touch-manipulation rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2 py-1.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-lg sm:px-3 sm:py-2.5 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400";

const cellCls =
  "w-full min-w-0 touch-manipulation rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-1.5 py-1 text-xs text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 disabled:opacity-60 sm:px-2 sm:py-1.5 sm:text-sm dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500";

const mobileLabelCls =
  "text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500";

/** Compact tap targets on phones; normal size from `sm` up */
const btnOutlineCls =
  "inline-flex items-center gap-1 rounded-md border font-semibold min-h-8 px-2 py-1 text-[11px] shadow-xs transition sm:min-h-10 sm:gap-1.5 sm:rounded-lg sm:px-3 sm:py-2 sm:text-xs";

const btnSolidCls =
  "inline-flex items-center justify-center gap-1 rounded-md font-bold min-h-8 px-2.5 py-1 text-[11px] transition disabled:opacity-60 sm:min-h-10 sm:rounded-lg sm:gap-1.5 sm:px-3 sm:py-2 sm:text-xs";

const btnIconCls =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition sm:h-10 sm:w-10 sm:rounded-lg";

const fieldMinHCls = "min-h-8 sm:min-h-10";

const selectTriggerCls =
  "flex w-full min-w-0 touch-manipulation items-center gap-2 rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2.5 text-left text-sm outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-lg sm:px-3 dark:border-[#1e2638] dark:focus:border-indigo-400";

const comboIconBtnCls =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200";

function comboboxShowClear(
  disabled: boolean | undefined,
  open: boolean,
  query: string,
  closedLabel: string,
  storedValue?: string | null,
) {
  if (disabled) return false;
  const text = (open ? query : closedLabel).trim();
  if (text) return true;
  return Boolean(String(storedValue ?? "").trim());
}

function GuestComboboxClearButton({
  show,
  disabled,
  label,
  onClear,
}: {
  show: boolean;
  disabled?: boolean;
  label: string;
  onClear: () => void;
}) {
  if (!show) return null;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClear}
      className={comboIconBtnCls}
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

const guestPenBtnCls =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-[var(--bg-elevated)] text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-[#1e2638] dark:hover:border-indigo-400 dark:hover:text-indigo-300";

function GuestDriverSummary({
  name,
  phone,
  editing,
  onEdit,
  onDone,
  onNameChange,
  onPhoneChange,
}: {
  name: string;
  phone: string;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
}) {
  if (editing) {
    return (
      <div className="w-fit max-w-full space-y-1.5 rounded-md border border-slate-200/80 p-2 dark:border-[#1e2638]">
        <div className="flex flex-wrap gap-2">
          <label className="block w-[9.5rem] min-w-0">
            <span className={mobileLabelCls}>Name *</span>
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className={`mt-0.5 ${inputCls}`}
              placeholder="Driver name"
              autoFocus
            />
          </label>
          <label className="block w-[9.5rem] min-w-0">
            <span className={mobileLabelCls}>Phone</span>
            <input
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              inputMode="tel"
              className={`mt-0.5 ${inputCls} font-mono`}
              placeholder="Mobile"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300"
        >
          Done
        </button>
      </div>
    );
  }

  const primary = name.trim() || "Add driver";
  const secondary = phone.trim() || "No phone";

  return (
    <div className="inline-flex max-w-full items-center gap-2.5 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2 dark:border-[#1e2638] dark:bg-white/[0.03]">
      <User className="h-4 w-4 shrink-0 text-indigo-500/90 dark:text-indigo-400" />
      <div className="min-w-0">
        <p
          className={`truncate text-sm font-semibold ${
            name.trim()
              ? "text-slate-800 dark:text-slate-100"
              : "text-slate-400 dark:text-slate-500"
          }`}
        >
          {primary}
        </p>
        <p
          className={`truncate font-mono text-xs ${
            phone.trim()
              ? "text-slate-600 dark:text-slate-300"
              : "text-slate-400 dark:text-slate-500"
          }`}
        >
          {secondary}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className={guestPenBtnCls}
        aria-label="Edit driver"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function GuestAgencyPicker({
  agencies,
  value,
  fallbackName,
  disabled,
  onChange,
  onCreateNew,
}: {
  agencies: Agency[];
  value: string;
  fallbackName?: string;
  disabled?: boolean;
  onChange: (agencyId: string) => void;
  onCreateNew?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = agencies.find((a) => (a._id ?? a.id) === value);
  const selectedLabel = selected
    ? formatAgencyLabel(selected)
    : fallbackName?.trim() || "";

  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [selectedLabel, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setQuery(selectedLabel);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, selectedLabel]);

  const q = query.trim().toLowerCase();
  const filtered = !open
    ? agencies
    : agencies.filter((a) => {
        if (!q) return true;
        const name = (a.name || "").toLowerCase();
        const phone = (a.phone || "").toLowerCase();
        return name.includes(q) || phone.includes(q);
      });

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    const a = agencies.find((x) => (x._id ?? x.id) === id);
    setQuery(a ? formatAgencyLabel(a) : "");
  };

  const showClear = comboboxShowClear(
    disabled,
    open,
    query,
    selectedLabel,
    value || fallbackName,
  );

  const clear = () => {
    onChange("");
    setQuery("");
    setOpen(false);
    queueMicrotask(() => inputRef.current?.focus());
  };

  return (
    <div ref={rootRef} className="relative w-[13.5rem] max-w-full sm:w-[15rem]">
      <div
        className={`${selectTriggerCls} ${fieldMinHCls} gap-1.5 py-1 pl-2 pr-1 sm:py-1.5`}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
        <input
          ref={inputRef}
          value={open ? query : selectedLabel}
          disabled={disabled}
          placeholder="Search agency…"
          aria-label="Agency"
          aria-expanded={open}
          aria-autocomplete="list"
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setQuery(selectedLabel);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setQuery(selectedLabel);
            }
            if (e.key === "Enter" && filtered.length === 1) {
              e.preventDefault();
              pick(filtered[0]._id ?? filtered[0].id ?? "");
            }
          }}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-100"
        />
        <GuestComboboxClearButton
          show={showClear}
          disabled={disabled}
          label="Clear agency"
          onClear={clear}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label="Toggle agency list"
          onClick={() => {
            if (disabled) return;
            setOpen((o) => {
              const next = !o;
              if (next) {
                setQuery(selectedLabel);
                queueMicrotask(() => inputRef.current?.focus());
              } else setQuery(selectedLabel);
              return next;
            });
          }}
          className={comboIconBtnCls}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {open && !disabled && (
        <div className="absolute left-0 z-40 mt-1 w-[min(100vw-2rem,18rem)] overflow-hidden rounded-lg border border-slate-200 bg-[var(--bg-card)] shadow-lg dark:border-[#1e2638]">
          {onCreateNew ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCreateNew();
              }}
              className="flex w-full items-center gap-1.5 border-b border-slate-100 px-3 py-2 text-left text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:border-[#1e2638] dark:text-indigo-300 dark:hover:bg-indigo-500/10"
            >
              <Plus className="h-3.5 w-3.5" /> New agency
            </button>
          ) : null}
          <ul role="listbox" className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                No match
              </li>
            ) : (
              filtered.map((a) => {
                const id = a._id ?? a.id ?? "";
                const active = id === value;
                const name = a.name?.trim() || "Unnamed";
                const phone = a.phone?.trim();
                return (
                  <li key={id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(id)}
                      className={`w-full px-3 py-2 text-left transition ${
                        active
                          ? "bg-indigo-50 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                      }`}
                    >
                      <span className="block truncate text-sm font-medium">
                        {name}
                      </span>
                      {phone ? (
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {phone}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

let _rowCounter = 0;
function nextRowId() {
  return `r_${Date.now()}_${++_rowCounter}`;
}

function emptyRow(): BulkTripRow {
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

function normalizeGuestPlate(raw: string): string {
  return String(raw ?? "").trim().toUpperCase();
}

const MS_24H = 24 * 60 * 60 * 1000;
const IST = "Asia/Kolkata";

function formatGuestPillTimeline(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const age = Date.now() - d.getTime();
  if (age >= 0 && age < MS_24H) {
    return d.toLocaleTimeString("en-IN", {
      timeZone: IST,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  return d.toLocaleString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Searchable IST date/time tokens for an ISO timestamp */
function istSearchHaystack(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = [
    formatGuestPillTimeline(iso),
    d.toLocaleDateString("en-IN", {
      timeZone: IST,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    d.toLocaleDateString("en-IN", {
      timeZone: IST,
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    d.toLocaleTimeString("en-IN", {
      timeZone: IST,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  ];
  return parts.join(" ").toLowerCase();
}

function guestBlockTimelineIso(block: GuestAgencyBlock): string | null {
  if (block.status === "accepted" && block.acceptedAt) {
    return block.acceptedAt;
  }
  return block.activityAt ?? null;
}

/** Last plate on open drafts only — never reuse plates from approved (read-only) history. */
function guestSessionVehiclePlate(blocks: GuestAgencyBlock[]): string {
  let last = "";
  for (const b of blocks) {
    if (b.status === "accepted") continue;
    for (const g of b.driverGroups ?? []) {
      const p = normalizeGuestPlate(g.vehicleNumber ?? "");
      if (p) last = p;
    }
  }
  return last;
}

/** Driver’s last chosen plate wins over scanning drafts (updates when plate field changes). */
function resolveGuestSessionPlate(
  blocks: GuestAgencyBlock[],
  preferredPlate = "",
): string {
  const preferred = normalizeGuestPlate(preferredPlate);
  if (preferred) return preferred;
  return guestSessionVehiclePlate(blocks);
}

function effectiveGuestDriverName(
  group: DriverGroup,
  guestDriverName: string,
): string {
  return (
    String(group.driverName ?? "").trim() ||
    String(guestDriverName ?? "").trim()
  );
}

function plateFromBlock(block?: GuestAgencyBlock | null): string {
  if (!block) return "";
  for (const g of block.driverGroups ?? []) {
    const p = normalizeGuestPlate(g.vehicleNumber ?? "");
    if (p) return p;
  }
  return "";
}

function emptyVehicleGroup(sessionPlate = ""): DriverGroup {
  return {
    clientGroupId: `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    driverName: "",
    driverPhone: "",
    vehicleNumber: normalizeGuestPlate(sessionPlate),
    rows: [emptyRow()],
    groupCreatedAt: new Date().toISOString(),
  };
}

function ensureGroupIds(groups: DriverGroup[] | undefined): DriverGroup[] {
  const list = Array.isArray(groups) ? groups : [];
  if (list.length === 0) return [emptyVehicleGroup()];
  return list.map((g) => ({
    ...g,
    clientGroupId:
      String(g.clientGroupId || "").trim() ||
      `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    rows:
      Array.isArray(g.rows) && g.rows.length > 0
        ? g.rows.map((r) => ({
            ...emptyRow(),
            ...r,
            clientRowId: String(r.clientRowId || "").trim() || nextRowId(),
          }))
        : [emptyRow()],
  }));
}

function stampGuestDriverOnGroups(
  groups: DriverGroup[] | undefined,
  name: string,
  phone: string,
): DriverGroup[] {
  const n = String(name ?? "").trim();
  const p = String(phone ?? "").trim();
  return ensureGroupIds(groups).map((g) => ({
    ...g,
    driverName: n || String(g.driverName ?? "").trim(),
    driverPhone: p || String(g.driverPhone ?? "").trim(),
  }));
}

function stampGuestDriverOnBlocks(
  blocks: GuestAgencyBlock[],
  name: string,
  phone: string,
): GuestAgencyBlock[] {
  return blocks.map((b) =>
    b.status === "accepted"
      ? b
      : { ...b, driverGroups: stampGuestDriverOnGroups(b.driverGroups, name, phone) },
  );
}

function normalizeGuestBlocks(blocks: GuestAgencyBlock[]): GuestAgencyBlock[] {
  if (!blocks?.length) return [emptyBlock()];
  return blocks.map((b) => ({
    ...b,
    clientId: b.clientId || newBlockClientId(),
    driverGroups: ensureGroupIds(b.driverGroups),
  }));
}

function emptyBlock(sessionPlate = ""): GuestAgencyBlock {
  return {
    clientId: newBlockClientId(),
    agencyId: null,
    agencyName: "",
    driverGroups: [emptyVehicleGroup(sessionPlate)],
    status: "open",
    activityAt: new Date().toISOString(),
  };
}

function blockHasTripData(block: GuestAgencyBlock) {
  return block.driverGroups.some(
    (g) =>
      String(g.vehicleNumber ?? "").trim() ||
      (g.rows ?? []).some(
        (r) =>
          String(r.startDate ?? "").trim() ||
          String(r.endDate ?? "").trim() ||
          String(r.startKm ?? "").trim() ||
          String(r.endKm ?? "").trim() ||
          Number(r.grandTotal) > 0 ||
          String(r.notes ?? "").trim(),
      ),
  );
}

function rowReadyForGuestApprove(row: BulkTripRow): boolean {
  const dateFallback = (row as BulkTripRow & { date?: string }).date;
  const hasStart = Boolean(
    String(row.startDate ?? "").trim() || String(dateFallback ?? "").trim(),
  );
  const hasEnd = Boolean(String(row.endDate ?? "").trim());
  return hasStart && hasEnd;
}

function blockHasApproveReadyTrips(
  block: GuestAgencyBlock,
  guestDriverName: string,
  guestDriverPhone: string,
): boolean {
  if (!String(guestDriverName ?? "").trim()) return false;
  if (!String(guestDriverPhone ?? "").trim()) return false;
  return block.driverGroups.some(
    (g) =>
      normalizeGuestPlate(g.vehicleNumber ?? "") &&
      effectiveGuestDriverName(g, guestDriverName) &&
      (g.rows ?? []).some(rowReadyForGuestApprove),
  );
}

/** Open block with agency + at least one approve-ready trip — matches server. */
function blockPendingOwnerApproval(
  block: GuestAgencyBlock,
  guestDriverName: string,
  guestDriverPhone: string,
) {
  if (block.status === "accepted") return false;
  if (!block.agencyId && !String(block.agencyName ?? "").trim()) return false;
  return blockHasApproveReadyTrips(block, guestDriverName, guestDriverPhone);
}

function guestApproveBlockError(
  block: GuestAgencyBlock,
  guestDriverName: string,
  guestDriverPhone: string,
): string | null {
  if (block.status === "accepted") return null;
  if (!block.agencyId && !String(block.agencyName ?? "").trim()) {
    return "Select an agency before Approve.";
  }
  const agencyLabel = block.agencyName?.trim() || "this agency";
  if (!String(guestDriverName ?? "").trim()) {
    return "Enter driver name before Approve.";
  }
  if (!String(guestDriverPhone ?? "").trim()) {
    return "Enter driver phone before Approve.";
  }
  for (const g of block.driverGroups) {
    const ready = (g.rows ?? []).some(rowReadyForGuestApprove);
    if (ready && !normalizeGuestPlate(g.vehicleNumber ?? "")) {
      return `Enter vehicle plate before Approve (${agencyLabel}).`;
    }
  }
  if (!blockHasApproveReadyTrips(block, guestDriverName, guestDriverPhone)) {
    return `Add at least one trip with start and end dates before Approve (${agencyLabel}).`;
  }
  return null;
}

/** Approved history + open drafts (agency chosen or trip data). */
function blockShowsAgencyPill(block: GuestAgencyBlock) {
  if (!block.agencyId && !String(block.agencyName ?? "").trim()) return false;
  if (block.status === "accepted") return true;
  return blockHasTripData(block) || Boolean(block.agencyId || block.agencyName?.trim());
}

/** Keep an open block for new entry when everything else is already approved. */
function ensureEditableWorkspace(
  blocks: GuestAgencyBlock[],
): GuestAgencyBlock[] {
  if (blocks.some((b) => b.status !== "accepted")) return blocks;
  return [...blocks, emptyBlock(guestSessionVehiclePlate(blocks))];
}

function pickActiveBlockId(
  blocks: GuestAgencyBlock[],
  guestDriverName = "",
  guestDriverPhone = "",
): string {
  const open = blocks.filter((b) => b.status !== "accepted");
  const pendingApprove = open.find((b) =>
    blockPendingOwnerApproval(b, guestDriverName, guestDriverPhone),
  );
  const withAgency = open.find((b) => b.agencyId || b.agencyName?.trim());
  const withTrips = open.find((b) => blockHasTripData(b));
  const emptyOpen = open.find((b) => !blockHasTripData(b));
  return (
    pendingApprove?.clientId ??
    withAgency?.clientId ??
    withTrips?.clientId ??
    emptyOpen?.clientId ??
    open[0]?.clientId ??
    blocks[0]?.clientId ??
    ""
  );
}

/**
 * Leave the current pill and focus a blank new-entry workspace.
 * Never copy the previous pill's agency into the new entry.
 */
function focusNextEntryWorkspace(
  blocks: GuestAgencyBlock[],
  fromPill?: GuestAgencyBlock,
): { blocks: GuestAgencyBlock[]; activeId: string } {
  const excludeId = fromPill?.clientId;

  // Prefer another existing blank open draft (no agency, no trips).
  const blankOpen = blocks.find(
    (b) =>
      b.clientId !== excludeId &&
      b.status !== "accepted" &&
      !blockHasTripData(b) &&
      !b.agencyId &&
      !String(b.agencyName ?? "").trim(),
  );
  if (blankOpen) {
    return { blocks, activeId: blankOpen.clientId };
  }

  // Leaving an open draft with no trips → clear its agency and reuse as blank entry.
  // (Avoids staying stuck on e.g. "Samsung" with agency prefilled and empty rows.)
  if (
    fromPill &&
    fromPill.status !== "accepted" &&
    !blockHasTripData(fromPill)
  ) {
    const next = blocks.map((b) =>
      b.clientId === fromPill.clientId
        ? {
            ...b,
            agencyId: null,
            agencyName: "",
            activityAt: new Date().toISOString(),
          }
        : b,
    );
    return { blocks: next, activeId: fromPill.clientId };
  }

  const sessionPlate =
    guestSessionVehiclePlate(blocks) || plateFromBlock(fromPill);
  const nb = emptyBlock(sessionPlate);
  return { blocks: [...blocks, nb], activeId: nb.clientId };
}

/**
 * First click → select that agency draft / history.
 * Second click on the same active pill → blank new entry (agency cleared).
 */
function activateAgencyPill(
  blocks: GuestAgencyBlock[],
  pill: GuestAgencyBlock,
  activeClientId: string,
): { blocks: GuestAgencyBlock[]; activeId: string } {
  if (pill.clientId === activeClientId) {
    return focusNextEntryWorkspace(blocks, pill);
  }
  return { blocks, activeId: pill.clientId };
}

function quickHash(s: string) {
  if (!s) return "empty";
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return `${s.length}_${h}`;
}

/** Merge only accepted agency blocks from server (never overwrite open drafts). */
function mergeAcceptedBlocksFromServer(
  prev: GuestAgencyBlock[],
  serverBlocks: GuestAgencyBlock[],
): GuestAgencyBlock[] {
  const serverMap = new Map(
    normalizeGuestBlocks(serverBlocks).map((b) => [b.clientId, b]),
  );
  return prev.map((b) => {
    const s = serverMap.get(b.clientId);
    if (s?.status === "accepted") return s;
    if (s) {
      return {
        ...b,
        activityAt: s.activityAt ?? b.activityAt,
        acceptedAt: s.acceptedAt ?? b.acceptedAt,
      };
    }
    return b;
  });
}

function SyncBadge({ status }: { status: SyncStatus }) {
  if (status === "idle") return null;
  const cfg = {
    saving: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      text: "Saving…",
      cls: "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400",
    },
    saved: {
      icon: <Cloud className="h-4 w-4" />,
      text: "Saved",
      cls: "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400",
    },
    error: {
      icon: <CloudOff className="h-4 w-4" />,
      text: "Offline",
      cls: "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400",
    },
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold sm:gap-1.5 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-xs ${cfg.cls}`}
    >
      <span className="[&_svg]:h-3.5 [&_svg]:w-3.5 sm:[&_svg]:h-4 sm:[&_svg]:w-4">
        {cfg.icon}
      </span>
      {cfg.text}
    </span>
  );
}

function pickActiveVehicleGroupId(groups: DriverGroup[]): string {
  const withPlate = groups.find((g) => String(g.vehicleNumber ?? "").trim());
  return (
    withPlate?.clientGroupId ??
    groups[0]?.clientGroupId ??
    ""
  );
}

function VehicleGroupsEditor({
  groups,
  onChange,
  readOnly,
  toolbarStart,
  toolbarEnd,
  sessionPlate = "",
  onSessionPlateChange,
}: {
  groups: DriverGroup[];
  onChange: Dispatch<SetStateAction<DriverGroup[]>>;
  readOnly?: boolean;
  toolbarStart?: ReactNode;
  /** Rendered after plate (e.g. Approve on the right) */
  toolbarEnd?: ReactNode;
  /** Pre-fill plate from another block on the same guest link */
  sessionPlate?: string;
  onSessionPlateChange?: (plate: string) => void;
}) {
  const [activeGroupId, setActiveGroupId] = useState(() =>
    pickActiveVehicleGroupId(groups),
  );

  useEffect(() => {
    if (!groups.length) return;
    if (!groups.some((g) => g.clientGroupId === activeGroupId)) {
      setActiveGroupId(pickActiveVehicleGroupId(groups));
    }
  }, [groups, activeGroupId]);

  const gi = Math.max(
    0,
    groups.findIndex((g) => g.clientGroupId === activeGroupId),
  );
  const g = groups[gi] ?? groups[0];
  if (!g) {
    return null;
  }

  const sessionPlateNorm = normalizeGuestPlate(sessionPlate);
  const groupPlateNorm = normalizeGuestPlate(g.vehicleNumber ?? "");

  useEffect(() => {
    if (readOnly || !sessionPlateNorm || groupPlateNorm) return;
    onChange((prev) => {
      const next = [...prev];
      const idx = Math.max(
        0,
        next.findIndex((x) => x.clientGroupId === g.clientGroupId),
      );
      if (normalizeGuestPlate(next[idx]?.vehicleNumber ?? "")) return prev;
      next[idx] = { ...next[idx], vehicleNumber: sessionPlateNorm };
      return next;
    });
  }, [
    sessionPlateNorm,
    groupPlateNorm,
    g.clientGroupId,
    readOnly,
    onChange,
  ]);

  const addTripBtnCls =
    "w-full rounded-md py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10 sm:w-auto sm:rounded-lg sm:py-2";

  const addTrip = () => {
    onChange((prev) => {
      const next = [...prev];
      next[gi] = {
        ...next[gi],
        rows: [...next[gi].rows, emptyRow()],
      };
      return next;
    });
  };

  const updateRowField = (
    gi: number,
    ri: number,
    field: string,
    type: "date" | "number" | "text" | "time",
    raw: string,
  ) => {
    onChange((prev) => {
      const next = [...prev];
      const rows = [...next[gi].rows];
      let val: string | number = raw;
      if (type === "number") val = Number(raw) || 0;
      if (type === "time") val = raw ? normalizeHHmm(raw) : "";
      rows[ri] = { ...rows[ri], [field]: val };
      next[gi] = { ...next[gi], rows };
      return next;
    });
  };

  const tableFields = [
    ["startDate", "date"],
    ["endDate", "date"],
    ["startKm", "text"],
    ["endKm", "text"],
    ["startTime", "time"],
    ["endTime", "time"],
    ["toll", "number"],
    ["notes", "text"],
  ] as const;

  const tripControl = (
    gi: number,
    ri: number,
    r: BulkTripRow,
    field: keyof BulkTripRow,
    type: "date" | "number" | "text" | "time",
  ) => {
    if (type === "time") {
      return (
        <TimePicker12h
          value={String(r[field] ?? "")}
          allowEmpty
          compact
          disabled={readOnly}
          onChange={(v) => updateRowField(gi, ri, field, "time", v)}
          className="mt-0.5 w-full min-w-0"
        />
      );
    }
    return (
      <input
        disabled={readOnly}
        type={
          type === "date"
            ? "date"
            : type === "number"
              ? "number"
              : "text"
        }
        inputMode={type === "number" ? "decimal" : undefined}
        value={
          type === "number"
            ? String(r[field] || "")
            : String(r[field] ?? "")
        }
        onChange={(e) =>
          updateRowField(gi, ri, field, type, e.target.value)
        }
        className={`mt-0.5 min-w-0 ${inputCls}`}
      />
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3 sm:gap-4">
        {toolbarStart}
        <label className="min-w-0 flex-1 sm:max-w-[11rem]">
          <span className={mobileLabelCls}>Plate *</span>
          <input
            type="text"
            disabled={readOnly}
            value={groupPlateNorm}
            placeholder={
              sessionPlateNorm
                ? `Last used: ${sessionPlateNorm}`
                : "Vehicle number"
            }
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => {
              const v = normalizeGuestPlate(e.target.value);
              onSessionPlateChange?.(v);
              onChange((prev) => {
                const next = [...prev];
                next[gi] = { ...next[gi], vehicleNumber: v };
                return next;
              });
            }}
            onBlur={() => {
              if (readOnly || groupPlateNorm || !sessionPlateNorm) return;
              onSessionPlateChange?.(sessionPlateNorm);
              onChange((prev) => {
                const next = [...prev];
                const idx = Math.max(
                  0,
                  next.findIndex((x) => x.clientGroupId === g.clientGroupId),
                );
                if (normalizeGuestPlate(next[idx]?.vehicleNumber ?? "")) {
                  return prev;
                }
                next[idx] = {
                  ...next[idx],
                  vehicleNumber: sessionPlateNorm,
                };
                return next;
              });
            }}
            className={`mt-0.5 min-w-0 ${inputCls}`}
          />
        </label>
        {toolbarEnd ? (
          <div className="ml-auto flex shrink-0 items-end">{toolbarEnd}</div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-[var(--bg-card)] dark:border-[#1e2638]">
        {!readOnly && (
          <div className="border-b border-slate-100 px-2 py-2 dark:border-[#1e2638] sm:px-4 sm:py-2.5">
            <button type="button" onClick={addTrip} className={addTripBtnCls}>
              + Add trip
            </button>
          </div>
        )}
        <div className="divide-y divide-slate-200 dark:divide-[#1e2638] md:hidden">
          {g.rows.map((r, ri) => (
            <section key={r.clientRowId} className="p-2">
              <header className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[9px] font-bold uppercase tracking-wide text-indigo-500 dark:text-indigo-300">
                  Trip {ri + 1}
                </span>
                {!readOnly && g.rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      onChange((prev) => {
                        const next = [...prev];
                        next[gi] = {
                          ...next[gi],
                          rows: next[gi].rows.filter((_, i) => i !== ri),
                        };
                        return next;
                      })
                    }
                    className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                    aria-label="Remove trip"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </header>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                <label className="block min-w-0">
                  <span className={mobileLabelCls}>Start date</span>
                  {tripControl(gi, ri, r, "startDate", "date")}
                </label>
                <label className="block min-w-0">
                  <span className={mobileLabelCls}>End date</span>
                  {tripControl(gi, ri, r, "endDate", "date")}
                </label>
                <label className="block min-w-0">
                  <span className={mobileLabelCls}>Start KM</span>
                  {tripControl(gi, ri, r, "startKm", "text")}
                </label>
                <label className="block min-w-0">
                  <span className={mobileLabelCls}>End KM</span>
                  {tripControl(gi, ri, r, "endKm", "text")}
                </label>
                <label className="block min-w-0">
                  <span className={mobileLabelCls}>Start time</span>
                  {tripControl(gi, ri, r, "startTime", "time")}
                </label>
                <label className="block min-w-0">
                  <span className={mobileLabelCls}>End time</span>
                  {tripControl(gi, ri, r, "endTime", "time")}
                </label>
                <label className="block min-w-0">
                  <span className={mobileLabelCls}>Toll</span>
                  {tripControl(gi, ri, r, "toll", "number")}
                </label>
                <label className="col-span-2 block min-w-0">
                  <span className={mobileLabelCls}>Notes</span>
                  {tripControl(gi, ri, r, "notes", "text")}
                </label>
              </div>
            </section>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-[#1e2638] dark:bg-white/[0.03] dark:text-slate-400">
                  <th className="px-2 py-2.5">Start</th>
                  <th className="px-2 py-2.5">End</th>
                  <th className="px-2 py-2.5">Start KM</th>
                  <th className="px-2 py-2.5">End KM</th>
                  <th className="min-w-[160px] px-2 py-2.5">Time (Start/End)</th>
                  <th className="px-2 py-2.5">Toll</th>
                  <th className="px-2 py-2.5">Notes</th>
                  <th className="w-8 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1e2638]">
                {g.rows.map((r, ri) => (
                  <tr
                    key={r.clientRowId}
                    className="hover:bg-slate-50/50 dark:hover:bg-white/[0.03]"
                  >
                    {tableFields.map(([field, type]) => {
                      if (field === "startTime") {
                        return (
                          <td key="times" className="px-2 py-1.5">
                            <div className="flex flex-col gap-1.5">
                              <TimePicker12h
                                value={String(r.startTime ?? "")}
                                allowEmpty
                                compact
                                label="Start"
                                disabled={readOnly}
                                onChange={(v) =>
                                  updateRowField(gi, ri, "startTime", "time", v)
                                }
                              />
                              <TimePicker12h
                                value={String(r.endTime ?? "")}
                                allowEmpty
                                compact
                                label="End"
                                disabled={readOnly}
                                onChange={(v) =>
                                  updateRowField(gi, ri, "endTime", "time", v)
                                }
                              />
                            </div>
                          </td>
                        );
                      }
                      if (field === "endTime") return null;
                      return (
                        <td key={field} className="px-2 py-1.5">
                          <input
                            disabled={readOnly}
                            type={
                              type === "date"
                                ? "date"
                                : type === "number"
                                  ? "number"
                                  : "text"
                            }
                            value={
                              type === "number"
                                ? String((r as any)[field] || "")
                                : String((r as any)[field] ?? "")
                            }
                            onChange={(e) =>
                              updateRowField(
                                gi,
                                ri,
                                field,
                                type,
                                e.target.value,
                              )
                            }
                            className={cellCls}
                          />
                        </td>
                      );
                    })}
                    <td className="px-2">
                      {!readOnly && g.rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            onChange((prev) => {
                              const next = [...prev];
                              next[gi] = {
                                ...next[gi],
                                rows: next[gi].rows.filter((_, i) => i !== ri),
                              };
                              return next;
                            })
                          }
                          className="text-rose-400 hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        {!readOnly && (
          <div className="border-t border-slate-100 px-2 py-2 dark:border-[#1e2638] sm:px-4 sm:py-2.5">
            <button type="button" onClick={addTrip} className={addTripBtnCls}>
              + Add trip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function GuestBulkEntryPage() {
  const { token = "" } = useParams<{ token: string }>();
  const { theme, toggleTheme } = useTheme();
  const [invite, setInvite] = useState<GuestBulkInvite | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [preferredGuestPlate, setPreferredGuestPlate] = useState("");
  const [blocks, setBlocks] = useState<GuestAgencyBlock[]>([emptyBlock()]);
  const [activeClientId, setActiveClientId] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [guestUserId, setGuestUserId] = useState<string | null>(null);
  const [joinRequired, setJoinRequired] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joinPhone, setJoinPhone] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [agencyGuestUsers, setAgencyGuestUsers] = useState<GuestLinkUser[]>(
    [],
  );
  /** Owner overview: null = all users; else filter table to one link user */
  const [focusedGuestUserId, setFocusedGuestUserId] = useState<string | null>(
    null,
  );
  const [usersSidebarOpen, setUsersSidebarOpen] = useState(false);
  const [entriesSidebarOpen, setEntriesSidebarOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState<
    "all" | "active" | "blocked" | "pending"
  >("all");
  const [userSort, setUserSort] = useState<
    "name-asc" | "name-desc" | "pending" | "recent" | "phone"
  >("recent");
  const [entrySearch, setEntrySearch] = useState("");
  const [entryFilter, setEntryFilter] = useState<
    "all" | "open" | "approve" | "approved"
  >("all");
  const [entrySort, setEntrySort] = useState<
    "newest" | "oldest" | "name" | "status"
  >("newest");

  const [showCreateAgency, setShowCreateAgency] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [editingDriver, setEditingDriver] = useState(false);

  const lastBackendHash = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const skipNextSync = useRef(true);
  const syncPayloadRef = useRef({
    driverName: "",
    driverPhone: "",
    blocks: [] as GuestAgencyBlock[],
  });
  const syncGenerationRef = useRef(0);
  const syncInFlightRef = useRef(false);
  const pendingSyncRef = useRef(false);
  /** Owner overview: only autosave after a real local edit (avoids wipe races). */
  const ownerDraftDirtyRef = useRef(false);
  const editingDepthRef = useRef(0);
  const pendingAcceptedDraftRef = useRef<GuestAgencyBlock[] | null>(null);
  const blurFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (blurFlushTimerRef.current) clearTimeout(blurFlushTimerRef.current);
    };
  }, []);

  const applyInviteData = useCallback((data: GuestBulkInvite) => {
    setInvite(data);
    setIsOwner(Boolean(data.isOwner));
    setAgencies(data.agencies ?? []);
    setJoinRequired(Boolean(data.joinRequired) && !data.isOwner);
    setAgencyGuestUsers(data.guestUsers ?? []);
    const ownerOverview = Boolean(
      data.isOwner && (data.ownerOverview || data.scope === "agency"),
    );
    const uid = ownerOverview ? null : data.guestUserId ?? null;
    setGuestUserId(uid);
    if (uid && token) storeGuestUserId(token, uid);
    if (ownerOverview && token) clearStoredGuestUserId(token);

    setDriverName(data.driverName || "");
    setDriverPhone(data.driverPhone || "");

    if (data.joinRequired && !data.isOwner) {
      setBlocks([emptyBlock()]);
      setActiveClientId("");
      skipNextSync.current = true;
      return;
    }

    // Owner agency overview: all link users; open trips are editable + autosaved
    if (ownerOverview) {
      const raw = data.draft?.blocks ?? [];
      const loaded = raw.length
        ? normalizeGuestBlocks(raw).map((b) =>
            b.status === "accepted"
              ? b
              : {
                  ...b,
                  driverGroups: stampGuestDriverOnGroups(
                    b.driverGroups,
                    b.guestName || data.driverName || "",
                    b.guestPhone || data.driverPhone || "",
                  ),
                },
          )
        : [];
      setBlocks(loaded);
      setPreferredGuestPlate(guestSessionVehiclePlate(loaded));
      const firstOpen = loaded.find(
        (b) => b.status !== "accepted" && b.guestUserId,
      );
      setFocusedGuestUserId((prev) => {
        if (prev && data.guestUsers?.some((u) => u.id === prev)) return prev;
        return firstOpen?.guestUserId
          ? String(firstOpen.guestUserId)
          : loaded[0]?.guestUserId
            ? String(loaded[0].guestUserId)
            : null;
      });
      setActiveClientId(
        firstOpen?.clientId ||
          loaded.find((b) => b.status !== "accepted")?.clientId ||
          loaded[0]?.clientId ||
          "",
      );
      skipNextSync.current = true;
      lastBackendHash.current = "";
      ownerDraftDirtyRef.current = false;
      return;
    }

    const loaded = stampGuestDriverOnBlocks(
      ensureEditableWorkspace(
        normalizeGuestBlocks(
          data.draft?.blocks?.length ? data.draft.blocks : [emptyBlock()],
        ),
      ),
      data.driverName || "",
      data.driverPhone || "",
    );
    setBlocks(loaded);
    setPreferredGuestPlate(guestSessionVehiclePlate(loaded));
    setActiveClientId(
      pickActiveBlockId(
        loaded,
        data.driverName || "",
        data.driverPhone || "",
      ),
    );
    skipNextSync.current = true;
    lastBackendHash.current = quickHash(
      JSON.stringify({
        driverName: data.driverName || "",
        driverPhone: data.driverPhone || "",
        blocks: loaded,
      }),
    );
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoadError("Invalid invite link");
      setLoading(false);
      return;
    }
    // Drop previous link's driver/draft immediately so autosave cannot
    // write driver A onto token B while the next invite is still loading.
    skipNextSync.current = true;
    syncGenerationRef.current += 1;
    setLoading(true);
    setLoadError(null);
    setInvite(null);
    setDriverName("");
    setDriverPhone("");
    setBlocks([emptyBlock()]);
    setEditingDriver(false);
    setJoinRequired(false);
    setJoinError(null);
    setGuestUserId(loadStoredGuestUserId(token));
    setAgencyGuestUsers([]);

    let cancelled = false;
    (async () => {
      try {
        const hasOwnerSession =
          typeof localStorage !== "undefined" &&
          Boolean(localStorage.getItem("accessToken"));
        // Logged-in owners: never send stale guestUserId (backend also ignores it).
        const stored = hasOwnerSession ? null : loadStoredGuestUserId(token);
        if (hasOwnerSession && loadStoredGuestUserId(token)) {
          clearStoredGuestUserId(token);
        }
        const data = await fetchGuestInvite(token, stored);
        if (cancelled) return;
        applyInviteData(data);
      } catch (e: unknown) {
        if (!cancelled) {
          const msg =
            e instanceof Error ? e.message : "Failed to load invite";
          // Stale guest session — clear and retry as join
          if (
            storedGuestSessionError(msg) &&
            loadStoredGuestUserId(token)
          ) {
            clearStoredGuestUserId(token);
            try {
              const data = await fetchGuestInvite(token, null);
              if (!cancelled) applyInviteData(data);
              return;
            } catch (e2: unknown) {
              if (!cancelled) {
                setLoadError(
                  e2 instanceof Error ? e2.message : "Failed to load invite",
                );
              }
              return;
            }
          }
          setLoadError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, applyInviteData]);

  useEffect(() => {
    if (!activeClientId && blocks.length > 0) {
      setActiveClientId(
        pickActiveBlockId(blocks, driverName, driverPhone),
      );
      return;
    }
    if (activeClientId && !blocks.some((b) => b.clientId === activeClientId)) {
      setActiveClientId(
        pickActiveBlockId(blocks, driverName, driverPhone),
      );
    }
  }, [blocks, activeClientId, driverName, driverPhone]);

  const activeBlock = useMemo(() => {
    if (!blocks.length) return null;
    return (
      blocks.find((b) => b.clientId === activeClientId) ??
      blocks.find((b) => b.status !== "accepted") ??
      blocks[0]
    );
  }, [blocks, activeClientId]);

  const sessionVehiclePlate = useMemo(
    () => resolveGuestSessionPlate(blocks, preferredGuestPlate),
    [blocks, preferredGuestPlate],
  );

  const guestDriverName = driverName.trim();
  const guestDriverPhone = driverPhone.trim();

  const handleSessionPlateChange = useCallback((plate: string) => {
    setPreferredGuestPlate(normalizeGuestPlate(plate));
  }, []);

  const syncPayload = useMemo(
    () => ({
      driverName,
      driverPhone,
      blocks: blocks.map((b) => ({
        clientId: b.clientId,
        agencyId: b.agencyId ?? null,
        agencyName: b.agencyName,
        guestUserId: b.guestUserId ?? null,
        guestName: b.guestName,
        guestPhone: b.guestPhone,
        // Prefer per-block guest identity (owner overview has empty page name/phone)
        driverGroups: stampGuestDriverOnGroups(
          b.driverGroups,
          b.guestName || driverName,
          b.guestPhone || driverPhone,
        ),
        status: b.status,
      })),
    }),
    [driverName, driverPhone, blocks],
  );

  syncPayloadRef.current = syncPayload;

  const persistGuestDraft = useCallback(async () => {
    if (!token || !invite) return;
    if (invite.token && invite.token !== token) return;
    if (invite.joinRequired && !invite.isOwner) return;

    const ownerOverview = Boolean(
      invite.isOwner && invite.scope === "agency",
    );
    // Owner must actually edit before we push (prevents load-race wipes).
    if (ownerOverview && !ownerDraftDirtyRef.current) return;

    // Owner edits the focused guest's open draft (not the whole merged list)
    const activeGuestFromBlock =
      ownerOverview && activeClientId
        ? syncPayloadRef.current.blocks.find(
            (b) => b.clientId === activeClientId,
          )?.guestUserId
        : null;
    const editGuestUserId = ownerOverview
      ? focusedGuestUserId ||
        (activeGuestFromBlock ? String(activeGuestFromBlock) : null)
      : guestUserId ?? invite.guestUserId ?? null;
    if (ownerOverview && !editGuestUserId) return;

    const payload = syncPayloadRef.current;
    const syncKey = ownerOverview
      ? {
          guestUserId: editGuestUserId,
          blocks: payload.blocks.filter(
            (b) => String(b.guestUserId) === String(editGuestUserId),
          ),
        }
      : payload;
    const hash = quickHash(JSON.stringify(syncKey));
    if (hash === lastBackendHash.current) return;

    if (syncInFlightRef.current) {
      pendingSyncRef.current = true;
      return;
    }
    syncInFlightRef.current = true;

    const gen = ++syncGenerationRef.current;
    setSyncStatus("saving");
    try {
      do {
        pendingSyncRef.current = false;
        const latest = syncPayloadRef.current;
        const guestMeta = ownerOverview
          ? agencyGuestUsers.find(
              (u) => String(u.id) === String(editGuestUserId),
            )
          : null;
        const nameForSync =
          guestMeta?.name ||
          latest.blocks.find(
            (b) => String(b.guestUserId) === String(editGuestUserId),
          )?.guestName ||
          latest.driverName;
        const phoneForSync =
          guestMeta?.phone ||
          latest.blocks.find(
            (b) => String(b.guestUserId) === String(editGuestUserId),
          )?.guestPhone ||
          latest.driverPhone;

        const sourceBlocks = ownerOverview
          ? latest.blocks.filter(
              (b) => String(b.guestUserId) === String(editGuestUserId),
            )
          : latest.blocks;

        // Server keeps accepted history; only ship open blocks (much faster).
        const openBlocks = sourceBlocks
          .filter((b) => b.status !== "accepted")
          .map((b) => ({
            clientId: b.clientId,
            agencyId: b.agencyId,
            agencyName: b.agencyName,
            driverGroups: stampGuestDriverOnGroups(
              b.driverGroups,
              nameForSync,
              phoneForSync,
            ),
          }));

        // Never push an empty open list for a user that still has local open
        // entries — that used to wipe yesterday's unapproved trips on the server.
        if (
          openBlocks.length === 0 &&
          sourceBlocks.some((b) => b.status !== "accepted")
        ) {
          lastBackendHash.current = quickHash(JSON.stringify(syncKey));
          setSyncStatus("idle");
          return;
        }

        const data = await syncGuestBulk(token, {
          driverName: nameForSync,
          driverPhone: phoneForSync,
          guestUserId: editGuestUserId,
          blocks: openBlocks,
        });
        if (!mountedRef.current || gen !== syncGenerationRef.current) return;
        const nextKey = ownerOverview
          ? {
              guestUserId: editGuestUserId,
              blocks: syncPayloadRef.current.blocks.filter(
                (b) => String(b.guestUserId) === String(editGuestUserId),
              ),
            }
          : syncPayloadRef.current;
        lastBackendHash.current = quickHash(JSON.stringify(nextKey));
        // Clear prior autosave/network errors after a successful save
        setApproveError((prev) =>
          prev &&
          /phone number already exists|guest link with this phone|network error|autosave failed|guest session|failed to fetch|too many guest/i.test(
            prev,
          )
            ? null
            : prev,
        );
        // Guest workspace: merge server accepted history.
        // Owner overview: keep local merged list (single-user response would wipe others).
        if (data.draft?.blocks && !ownerOverview) {
          if (editingDepthRef.current > 0) {
            pendingAcceptedDraftRef.current = data.draft.blocks;
          } else {
            setBlocks((prev) =>
              mergeAcceptedBlocksFromServer(prev, data.draft!.blocks),
            );
          }
        }
      } while (
        pendingSyncRef.current &&
        quickHash(
          JSON.stringify(
            ownerOverview
              ? {
                  guestUserId: editGuestUserId,
                  blocks: syncPayloadRef.current.blocks.filter(
                    (b) => String(b.guestUserId) === String(editGuestUserId),
                  ),
                }
              : syncPayloadRef.current,
          ),
        ) !== lastBackendHash.current
      );
      if (!mountedRef.current || gen !== syncGenerationRef.current) return;
      if (ownerOverview) ownerDraftDirtyRef.current = false;
      setSyncStatus("saved");
      setTimeout(() => {
        if (mountedRef.current) setSyncStatus("idle");
      }, 2000);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setSyncStatus("error");
      const msg = e instanceof Error ? e.message : "Autosave failed";
      if (msg) {
        setApproveError(msg);
        if (
          /phone number already exists|guest link with this phone/i.test(msg)
        ) {
          // Stop retry storms until the guest changes name/phone/blocks again.
          lastBackendHash.current = quickHash(
            JSON.stringify(syncPayloadRef.current),
          );
        }
      }
    } finally {
      syncInFlightRef.current = false;
    }
  }, [
    token,
    invite,
    guestUserId,
    focusedGuestUserId,
    activeClientId,
    agencyGuestUsers,
  ]);

  const onJoin = async () => {
    if (!token) return;
    setJoining(true);
    setJoinError(null);
    try {
      const data = await joinGuestBulk(token, {
        name: joinName.trim(),
        phone: joinPhone.trim(),
      });
      applyInviteData(data);
    } catch (e: unknown) {
      setJoinError(e instanceof Error ? e.message : "Could not join");
    } finally {
      setJoining(false);
    }
  };

  const reloadOwnerOverview = async () => {
    if (!token) return;
    clearStoredGuestUserId(token);
    const data = await fetchGuestInvite(token, null);
    applyInviteData(data);
  };

  const onRotateToken = async () => {
    if (!invite?.id) return;
    if (
      !window.confirm(
        "Change URL? The old link stops working. Share the new link with drivers.",
      )
    ) {
      return;
    }
    setOwnerBusy(true);
    setApproveError(null);
    try {
      const data = await rotateGuestBulkInviteToken(invite.id);
      // New token — navigate by opening same origin path
      window.location.href = guestBulkShareUrl(data.token);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : null;
      setApproveError(
        msg || (e instanceof Error ? e.message : "Rotate failed"),
      );
    } finally {
      setOwnerBusy(false);
    }
  };

  const onToggleBlockUser = async (user: GuestLinkUser) => {
    if (!invite?.id) return;
    setOwnerBusy(true);
    setApproveError(null);
    try {
      if (user.status === "blocked") {
        await unblockGuestLinkUser(invite.id, user.id);
      } else {
        await blockGuestLinkUser(invite.id, user.id);
      }
      await reloadOwnerOverview();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : null;
      setApproveError(
        msg || (e instanceof Error ? e.message : "Update user failed"),
      );
    } finally {
      setOwnerBusy(false);
    }
  };

  const flushPendingAcceptedMerge = () => {
    const pending = pendingAcceptedDraftRef.current;
    if (!pending) return;
    pendingAcceptedDraftRef.current = null;
    setBlocks((prev) => mergeAcceptedBlocksFromServer(prev, pending));
  };

  const handleFormFocusIn = () => {
    editingDepthRef.current += 1;
    if (blurFlushTimerRef.current) {
      clearTimeout(blurFlushTimerRef.current);
      blurFlushTimerRef.current = null;
    }
  };

  const handleFormFocusOut = () => {
    editingDepthRef.current = Math.max(0, editingDepthRef.current - 1);
    if (editingDepthRef.current > 0) return;
    if (blurFlushTimerRef.current) clearTimeout(blurFlushTimerRef.current);
    blurFlushTimerRef.current = setTimeout(() => {
      if (editingDepthRef.current === 0) flushPendingAcceptedMerge();
    }, 150);
  };

  // When owner switches guest user, treat current draft as already synced
  useEffect(() => {
    if (!(invite?.isOwner && invite.scope === "agency")) return;
    if (!focusedGuestUserId) return;
    skipNextSync.current = true;
    ownerDraftDirtyRef.current = false;
    lastBackendHash.current = quickHash(
      JSON.stringify({
        guestUserId: focusedGuestUserId,
        blocks: syncPayloadRef.current.blocks.filter(
          (b) => String(b.guestUserId) === String(focusedGuestUserId),
        ),
      }),
    );
  }, [focusedGuestUserId, invite?.isOwner, invite?.scope]);

  useEffect(() => {
    if (!token || !invite || loading) return;
    if (joinRequired) return;
    if (
      invite.isOwner &&
      invite.scope === "agency" &&
      !focusedGuestUserId
    ) {
      return;
    }
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }

    const ownerOverview = Boolean(
      invite.isOwner && invite.scope === "agency",
    );
    const syncKey = ownerOverview
      ? {
          guestUserId: focusedGuestUserId,
          blocks: syncPayload.blocks.filter(
            (b) => String(b.guestUserId) === String(focusedGuestUserId),
          ),
        }
      : syncPayload;
    const hash = quickHash(JSON.stringify(syncKey));
    if (hash === lastBackendHash.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persistGuestDraft();
    }, AUTOSAVE_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    token,
    invite,
    loading,
    syncPayload,
    persistGuestDraft,
    joinRequired,
    focusedGuestUserId,
  ]);

  useEffect(() => {
    const flushOnHide = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void persistGuestDraft();
    };
    window.addEventListener("pagehide", flushOnHide);
    const onVis = () => {
      if (document.visibilityState === "hidden") flushOnHide();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flushOnHide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [persistGuestDraft]);

  const selectAgency = (agencyId: string) => {
    const agency = agencies.find((x) => (x._id ?? x.id) === agencyId);
    const agencyName = agency?.name ?? "";

    if (!agencyId) {
      setBlocks((prev) =>
        prev.map((b) =>
          b.clientId === activeClientId && b.status === "open"
            ? { ...b, agencyId: null, agencyName: "" }
            : b,
        ),
      );
      return;
    }

    setBlocks((prev) => {
      const active =
        prev.find((b) => b.clientId === activeClientId) ??
        prev.find((b) => b.status === "open");

      // Another open draft already uses this agency — switch to it
      // (don't steal trips from the current block onto a duplicate).
      const existingOpen = prev.find(
        (b) =>
          b.status === "open" &&
          b.clientId !== active?.clientId &&
          String(b.agencyId ?? "") === String(agencyId),
      );
      if (existingOpen) {
        setActiveClientId(existingOpen.clientId);
        return prev;
      }

      // Viewing approved history → start a fresh open entry with this agency.
      if (active?.status === "accepted") {
        const nb = emptyBlock(
          resolveGuestSessionPlate(prev, preferredGuestPlate),
        );
        nb.agencyId = agencyId || null;
        nb.agencyName = agencyName;
        setActiveClientId(nb.clientId);
        return [...prev, nb];
      }

      // Open draft: always set/change agency in place (even if trips exist).
      if (active && active.status === "open") {
        setActiveClientId(active.clientId);
        return prev.map((b) =>
          b.clientId === active.clientId
            ? {
                ...b,
                agencyId: agencyId || null,
                agencyName,
                activityAt: new Date().toISOString(),
              }
            : b,
        );
      }

      const nb = emptyBlock(
        resolveGuestSessionPlate(prev, preferredGuestPlate),
      );
      nb.agencyId = agencyId || null;
      nb.agencyName = agencyName;
      setActiveClientId(nb.clientId);
      return [...prev, nb];
    });
  };

  const onCreateAgency = async () => {
    if (!token) return;
    setCreating(true);
    setApproveError(null);
    try {
      const agency = await createGuestAgency(token, newName, newPhone);
      setAgencies((prev) => [...prev, agency]);
      const id = agency._id ?? agency.id ?? "";
      selectAgency(id);
      setShowCreateAgency(false);
      setNewName("");
      setNewPhone("");
    } catch (e: unknown) {
      setApproveError(
        e instanceof Error ? e.message : "Failed to create agency",
      );
    } finally {
      setCreating(false);
    }
  };

  const onApprove = async (clientId?: string) => {
    if (!token) return;
    setApproveError(null);
    const ownerOverview = Boolean(
      invite?.isOwner && invite.scope === "agency",
    );
    const pool =
      ownerOverview && focusedGuestUserId
        ? blocks.filter(
            (b) => String(b.guestUserId) === String(focusedGuestUserId),
          )
        : blocks;
    const targets = clientId
      ? pool.filter((b) => b.clientId === clientId && b.status !== "accepted")
      : pool.filter((b) => b.status !== "accepted");
    for (const b of targets) {
      const name = ownerOverview
        ? b.guestName || guestDriverName
        : guestDriverName;
      const phone = ownerOverview
        ? b.guestPhone || guestDriverPhone
        : guestDriverPhone;
      const err = guestApproveBlockError(b, name, phone);
      if (err) {
        setApproveError(err);
        return;
      }
      if (ownerOverview && !b.guestUserId) {
        setApproveError("Missing guest user on this entry.");
        return;
      }
    }
    if (!targets.length) {
      setApproveError("No open agency block to approve.");
      return;
    }
    setApproving(clientId ?? "__all__");
    try {
      if (ownerOverview) {
        if (clientId) {
          const block = targets[0];
          await approveGuestBulk(token, {
            clientId,
            guestUserId: block.guestUserId,
          });
        } else {
          const byUser = new Map<string, GuestAgencyBlock[]>();
          for (const b of targets) {
            const uid = String(b.guestUserId);
            if (!byUser.has(uid)) byUser.set(uid, []);
            byUser.get(uid)!.push(b);
          }
          for (const [uid] of byUser) {
            await approveGuestBulk(token, { all: true, guestUserId: uid });
          }
        }
        skipNextSync.current = true;
        await reloadOwnerOverview();
      } else {
        const data = await approveGuestBulk(token, {
          ...(clientId ? { clientId } : { all: true }),
          guestUserId: guestUserId ?? invite?.guestUserId,
        });
        skipNextSync.current = true;
        if (data.draft?.blocks) {
          const next = ensureEditableWorkspace(
            normalizeGuestBlocks(data.draft.blocks),
          );
          setBlocks(next);
          setActiveClientId(
            pickActiveBlockId(next, guestDriverName, guestDriverPhone),
          );
        }
        setInvite((prev) => (prev ? { ...prev, ...data } : data));
        lastBackendHash.current = quickHash(
          JSON.stringify({
            driverName: data.driverName || driverName,
            driverPhone: data.driverPhone || driverPhone,
            blocks: data.draft?.blocks ?? blocks,
          }),
        );
      }
    } catch (e: unknown) {
      setApproveError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setApproving(null);
    }
  };

  const copyShareLink = async () => {
    if (!token) return;
    const url = guestBulkShareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  const applyInviteUpdate = (data: GuestBulkInvite) => {
    setInvite((prev) => (prev ? { ...prev, ...data } : data));
  };

  const onToggleRevoke = async () => {
    if (!invite?.id) return;
    setOwnerBusy(true);
    setApproveError(null);
    try {
      const data =
        invite.status === "revoked"
          ? await unrevokeGuestBulkInvite(invite.id)
          : await revokeGuestBulkInvite(invite.id);
      applyInviteUpdate(data);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : null;
      setApproveError(
        msg || (e instanceof Error ? e.message : "Update failed"),
      );
    } finally {
      setOwnerBusy(false);
    }
  };

  const ownerOverviewMode = Boolean(isOwner && invite?.scope === "agency");
  const displayBlocks = useMemo(() => {
    if (!ownerOverviewMode || !focusedGuestUserId) return blocks;
    return blocks.filter(
      (b) => String(b.guestUserId) === String(focusedGuestUserId),
    );
  }, [blocks, ownerOverviewMode, focusedGuestUserId]);

  const displayActiveBlock = useMemo(() => {
    if (!displayBlocks.length) return null;
    return (
      displayBlocks.find((b) => b.clientId === activeClientId) ??
      displayBlocks.find((b) => b.status !== "accepted") ??
      displayBlocks[0]
    );
  }, [displayBlocks, activeClientId]);

  const openBlocks = displayBlocks.filter((b) => b.status !== "accepted");
  const canApproveAll = openBlocks.some((b) =>
    blockPendingOwnerApproval(
      b,
      ownerOverviewMode ? b.guestName || guestDriverName : guestDriverName,
      ownerOverviewMode ? b.guestPhone || guestDriverPhone : guestDriverPhone,
    ),
  );

  const filteredAgencyUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    let list = [...agencyGuestUsers];
    if (userFilter === "active") {
      list = list.filter((u) => u.status !== "blocked");
    } else if (userFilter === "blocked") {
      list = list.filter((u) => u.status === "blocked");
    } else if (userFilter === "pending") {
      list = list.filter((u) => (u.pendingSubmissions ?? 0) > 0);
    }
    if (q) {
      list = list.filter((u) => {
        const name = (u.name || "").toLowerCase();
        const phone = (u.phone || "").toLowerCase();
        const phoneDigits = phone.replace(/\D/g, "");
        const status = (u.status || "").toLowerCase();
        return (
          name.includes(q) ||
          phone.includes(q) ||
          status.includes(q) ||
          (qDigits.length > 0 && phoneDigits.includes(qDigits))
        );
      });
    }
    list.sort((a, b) => {
      if (userSort === "name-asc") {
        return (a.name || "").localeCompare(b.name || "", "en-IN");
      }
      if (userSort === "name-desc") {
        return (b.name || "").localeCompare(a.name || "", "en-IN");
      }
      if (userSort === "phone") {
        return (a.phone || "").localeCompare(b.phone || "", "en-IN");
      }
      if (userSort === "pending") {
        return (b.pendingSubmissions ?? 0) - (a.pendingSubmissions ?? 0);
      }
      // recent — lastSeenAt desc
      const at = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
      const bt = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
      return bt - at;
    });
    return list;
  }, [agencyGuestUsers, userSearch, userFilter, userSort]);

  const filteredEntryBlocks = useMemo(() => {
    const q = entrySearch.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    let list = displayBlocks.filter(blockShowsAgencyPill);
    list = list.filter((b) => {
      const name = b.guestName || guestDriverName;
      const phone = b.guestPhone || guestDriverPhone;
      const pending = blockPendingOwnerApproval(b, name, phone);
      if (entryFilter === "approved") return b.status === "accepted";
      if (entryFilter === "approve") return pending;
      if (entryFilter === "open") {
        return b.status !== "accepted" && !pending;
      }
      return true;
    });
    if (q) {
      list = list.filter((b) => {
        const name = (b.guestName || "").toLowerCase();
        const phone = (b.guestPhone || "").toLowerCase();
        const phoneDigits = phone.replace(/\D/g, "");
        const iso = guestBlockTimelineIso(b);
        const timeHay = istSearchHaystack(iso);
        const status =
          b.status === "accepted"
            ? "approved"
            : blockPendingOwnerApproval(
                  b,
                  b.guestName || guestDriverName,
                  b.guestPhone || guestDriverPhone,
                )
              ? "approve pending"
              : "open";
        return (
          name.includes(q) ||
          phone.includes(q) ||
          timeHay.includes(q) ||
          status.includes(q) ||
          (qDigits.length > 0 && phoneDigits.includes(qDigits))
        );
      });
    }
    list.sort((a, b) => {
      if (entrySort === "name") {
        return (a.guestName || "").localeCompare(b.guestName || "", "en-IN");
      }
      if (entrySort === "status") {
        const rank = (block: GuestAgencyBlock) => {
          if (block.status === "accepted") return 2;
          if (
            blockPendingOwnerApproval(
              block,
              block.guestName || guestDriverName,
              block.guestPhone || guestDriverPhone,
            )
          ) {
            return 0;
          }
          return 1;
        };
        return rank(a) - rank(b);
      }
      const at = guestBlockTimelineIso(a)
        ? new Date(guestBlockTimelineIso(a)!).getTime()
        : 0;
      const bt = guestBlockTimelineIso(b)
        ? new Date(guestBlockTimelineIso(b)!).getTime()
        : 0;
      return entrySort === "oldest" ? at - bt : bt - at;
    });
    return list;
  }, [
    displayBlocks,
    entrySearch,
    entryFilter,
    entrySort,
    guestDriverName,
    guestDriverPhone,
  ]);

  const focusGuestUser = (userId: string | null) => {
    setFocusedGuestUserId(userId);
    setUsersSidebarOpen(false);
    const pool = userId
      ? blocks.filter((b) => String(b.guestUserId) === String(userId))
      : blocks;
    const next =
      pool.find((b) => b.status !== "accepted")?.clientId ||
      pool[0]?.clientId ||
      "";
    setActiveClientId(next);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-main)]">
        <TripwiseLogo variant="auto" className="h-16 w-16" />
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (loadError || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] p-6">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-[var(--bg-card)] p-6 text-center shadow-sm dark:border-rose-500/30">
          <TripwiseLogo variant="auto" className="mx-auto mb-4 h-16 w-16" />
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
          <h1 className="text-lg font-bold text-slate-800 dark:text-white">
            Link unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {loadError}
          </p>
        </div>
      </div>
    );
  }

  if (joinRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] p-6">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-[var(--bg-card)] p-6 shadow-sm dark:border-[#1e2638]">
          <TripwiseLogo variant="auto" className="mx-auto h-16 w-16" />
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#C98200] dark:text-[#F5A300]">
              Tripwise · agency entry
            </p>
            <h1 className="mt-1 text-lg font-bold text-slate-800 dark:text-white">
              {invite.agencyName || invite.label}
            </h1>
            {invite.ownerName ? (
              <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                Owner · {invite.ownerName}
                {invite.ownerCompany ? (
                  <span className="font-normal text-slate-400">
                    {" "}
                    · {invite.ownerCompany}
                  </span>
                ) : null}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Enter your name and phone to open your private workspace. Use the
              same phone later to resume.
            </p>
          </div>
          {joinError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {joinError}
            </div>
          )}
          <input
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Your name"
            className={inputCls}
            autoComplete="name"
          />
          <input
            value={joinPhone}
            onChange={(e) => setJoinPhone(e.target.value)}
            placeholder="Phone (10 digits)"
            inputMode="tel"
            className={inputCls}
            autoComplete="tel"
          />
          <button
            type="button"
            disabled={joining || !joinName.trim() || joinPhone.trim().length < 10}
            onClick={() => void onJoin()}
            className={`${btnSolidCls} w-full bg-indigo-600 text-white dark:bg-indigo-500 sm:text-sm`}
          >
            {joining ? "Opening…" : "Continue"}
          </button>
        </div>
      </div>
    );
  }

  const isAgencyScope = invite.scope === "agency";
  const agencyLocked = isAgencyScope;
  const viewBlock = ownerOverviewMode ? displayActiveBlock : activeBlock;
  const focusedGuest = focusedGuestUserId
    ? agencyGuestUsers.find((u) => u.id === focusedGuestUserId) ?? null
    : null;

  const sidebarSelectCls =
    "w-full rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-indigo-400 dark:border-[#1e2638] dark:text-slate-200";
  const sidebarSearchCls =
    "w-full rounded-md border border-slate-200 bg-[var(--bg-elevated)] py-1.5 pl-7 pr-2 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-400 dark:border-[#1e2638] dark:text-slate-200 dark:placeholder:text-slate-500";

  const usersSidebar = ownerOverviewMode ? (
    <aside className="flex h-full w-full flex-col bg-[var(--bg-card)]">
      <div className="shrink-0 space-y-2 border-b border-slate-100 px-3 py-3 dark:border-[#1e2638]">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-500" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Link users
          </p>
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">
            {filteredAgencyUsers.length}
            {filteredAgencyUsers.length !== agencyGuestUsers.length
              ? `/${agencyGuestUsers.length}`
              : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white dark:bg-emerald-500">
            Owner
          </span>
          {invite.status === "revoked" && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
              Link blocked
            </span>
          )}
        </div>
        {(invite.ownerName || invite.ownerCompany) && (
          <div className="min-w-0">
            {invite.ownerName ? (
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {invite.ownerName}
              </p>
            ) : null}
            {invite.ownerCompany ? (
              <p className="truncate text-[11px] text-slate-400">
                {invite.ownerCompany}
              </p>
            ) : null}
          </div>
        )}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search name, phone…"
            className={sidebarSearchCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="space-y-0.5">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Filter
            </span>
            <select
              value={userFilter}
              onChange={(e) =>
                setUserFilter(
                  e.target.value as
                    | "all"
                    | "active"
                    | "blocked"
                    | "pending",
                )
              }
              className={sidebarSelectCls}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
              <option value="pending">Pending</option>
            </select>
          </label>
          <label className="space-y-0.5">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <ArrowUpDown className="h-3 w-3" />
              Sort
            </span>
            <select
              value={userSort}
              onChange={(e) =>
                setUserSort(
                  e.target.value as
                    | "name-asc"
                    | "name-desc"
                    | "pending"
                    | "recent"
                    | "phone",
                )
              }
              className={sidebarSelectCls}
            >
              <option value="recent">Recent</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="phone">Phone</option>
              <option value="pending">Pending</option>
            </select>
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <button
          type="button"
          onClick={() => focusGuestUser(null)}
          className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition ${
            !focusedGuestUserId
              ? "bg-indigo-50 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200"
              : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
          }`}
        >
          <Users className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">
            All users
          </span>
          {(invite.pendingSubmissions ?? 0) > 0 && (
            <span className="shrink-0 rounded-full bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
              {invite.pendingSubmissions}
            </span>
          )}
        </button>

        {agencyGuestUsers.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-slate-400">
            No one has joined yet — share the link
          </p>
        ) : filteredAgencyUsers.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-slate-400">
            No users match
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filteredAgencyUsers.map((u) => {
              const selected = focusedGuestUserId === u.id;
              const pending = u.pendingSubmissions ?? 0;
              return (
                <li key={u.id}>
                  <div
                    className={`group flex items-stretch gap-0.5 rounded-lg ${
                      selected
                        ? "bg-indigo-50 dark:bg-indigo-500/15"
                        : "hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => focusGuestUser(u.id)}
                      className="min-w-0 flex-1 px-2.5 py-2 text-left"
                    >
                      <p
                        className={`truncate text-xs font-semibold ${
                          selected
                            ? "text-indigo-900 dark:text-indigo-100"
                            : "text-slate-800 dark:text-slate-100"
                        }`}
                      >
                        {u.name}
                        {u.status === "blocked" ? (
                          <span className="ml-1 text-[10px] font-medium text-rose-500">
                            blocked
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate font-mono text-[10px] text-slate-400">
                        {u.phone}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-400">
                        {(u.openRowCount ?? 0) > 0
                          ? `${u.openRowCount} open`
                          : "No open rows"}
                        {pending > 0 ? ` · ${pending} pending` : ""}
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={ownerBusy}
                      title={u.status === "blocked" ? "Unblock" : "Block"}
                      onClick={(e) => {
                        e.stopPropagation();
                        void onToggleBlockUser(u);
                      }}
                      className={`m-1 shrink-0 self-center rounded-md p-1.5 opacity-70 transition hover:opacity-100 disabled:opacity-40 ${
                        u.status === "blocked"
                          ? "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                          : "text-rose-500 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                      }`}
                    >
                      {u.status === "blocked" ? (
                        <RotateCcw className="h-3.5 w-3.5" />
                      ) : (
                        <Ban className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  ) : null;

  const entriesSidebar = ownerOverviewMode ? (
    <aside className="flex h-full w-full flex-col bg-[var(--bg-card)]">
      <div className="shrink-0 space-y-2 border-b border-slate-100 px-3 py-3 dark:border-[#1e2638]">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-indigo-500" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Entries
          </p>
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">
            {filteredEntryBlocks.length}
          </span>
        </div>
        <p className="truncate text-[11px] text-slate-400">
          {focusedGuest
            ? focusedGuest.name
            : "All users · IST (India)"}
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={entrySearch}
            onChange={(e) => setEntrySearch(e.target.value)}
            placeholder="Name, phone, date, time…"
            className={sidebarSearchCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Filter
            </span>
            <select
              value={entryFilter}
              onChange={(e) =>
                setEntryFilter(
                  e.target.value as "all" | "open" | "approve" | "approved",
                )
              }
              className={sidebarSelectCls}
            >
              <option value="all">All</option>
              <option value="approve">Approve</option>
              <option value="open">Open</option>
              <option value="approved">Approved</option>
            </select>
          </label>
          <label className="space-y-0.5">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <ArrowUpDown className="h-3 w-3" />
              Sort
            </span>
            <select
              value={entrySort}
              onChange={(e) =>
                setEntrySort(
                  e.target.value as "newest" | "oldest" | "name" | "status",
                )
              }
              className={sidebarSelectCls}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filteredEntryBlocks.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-slate-400">
            {displayBlocks.some(blockShowsAgencyPill)
              ? "No entries match"
              : "No entries yet"}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filteredEntryBlocks.map((b) => {
              const pillName = b.guestName || guestDriverName;
              const pillPhone = b.guestPhone || guestDriverPhone;
              const pending = blockPendingOwnerApproval(
                b,
                pillName,
                pillPhone,
              );
              const active = viewBlock?.clientId === b.clientId;
              const timelineLabel =
                formatGuestPillTimeline(guestBlockTimelineIso(b)) || "—";
              const statusLabel =
                b.status === "accepted"
                  ? "Approved"
                  : pending
                    ? "Approve"
                    : "Open";
              return (
                <li key={`${b.guestUserId ?? ""}-${b.clientId}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveClientId(b.clientId);
                      if (b.guestUserId) {
                        setFocusedGuestUserId(String(b.guestUserId));
                      }
                      setEntriesSidebarOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                      active
                        ? b.status === "accepted"
                          ? "bg-emerald-50 dark:bg-emerald-500/15"
                          : pending
                            ? "bg-amber-50 dark:bg-amber-500/15"
                            : "bg-indigo-50 dark:bg-indigo-500/15"
                        : "hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      {!focusedGuestUserId && (
                        <p className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                          {b.guestName || "Driver"}
                        </p>
                      )}
                      {!focusedGuestUserId && b.guestPhone ? (
                        <p className="truncate font-mono text-[10px] text-slate-400">
                          {b.guestPhone}
                        </p>
                      ) : null}
                      <p
                        className={`truncate font-mono text-xs font-semibold ${
                          active
                            ? "text-slate-900 dark:text-white"
                            : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {timelineLabel}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white ${
                        b.status === "accepted"
                          ? "bg-emerald-600 dark:bg-emerald-500"
                          : pending
                            ? "bg-amber-500 dark:bg-amber-600"
                            : "bg-slate-400 dark:bg-slate-500"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  ) : null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg-main)]">
      <header className="shrink-0 border-b border-slate-200 bg-[var(--bg-card)]/95 px-2.5 py-2 shadow-sm backdrop-blur dark:border-[#1e2638] sm:px-4 sm:py-3">
        <div
          className={`mx-auto flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 ${
            ownerOverviewMode ? "max-w-[90rem]" : "max-w-5xl"
          }`}
        >
          <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
            {ownerOverviewMode && (
              <button
                type="button"
                onClick={() => setUsersSidebarOpen(true)}
                title="Link users"
                className={`${btnIconCls} mt-0.5 border-slate-200 bg-[var(--bg-elevated)] text-slate-500 hover:text-indigo-600 md:hidden dark:border-[#1e2638] dark:text-slate-400`}
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}
            <TripwiseLogo
              variant="auto"
              className="mt-0.5 h-9 w-9 shrink-0 sm:h-12 sm:w-12"
            />
            <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#C98200] dark:text-[#F5A300]">
              {isOwner
                ? "Tripwise · owner review"
                : isAgencyScope
                  ? "Tripwise · agency entry"
                  : "Tripwise · driver entry"}
            </p>
            <h1 className="truncate text-base font-bold leading-snug text-slate-800 dark:text-white sm:text-lg">
              {isAgencyScope && invite.agencyName
                ? invite.agencyName
                : invite.label}
            </h1>
            {invite.ownerName ? (
              <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500 sm:text-xs">
                Owner · {invite.ownerName}
                {invite.ownerCompany ? ` · ${invite.ownerCompany}` : ""}
              </p>
            ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <SyncBadge status={syncStatus} />
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              className={`${btnIconCls} border-slate-200 bg-[var(--bg-elevated)] text-slate-500 hover:text-indigo-600 dark:border-[#1e2638] dark:text-slate-400 dark:hover:text-indigo-300`}
            >
              {theme === "dark" ? (
                <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              ) : (
                <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={copyShareLink}
              title="Copy share link"
              className={`${btnOutlineCls} border-slate-200 bg-[var(--bg-elevated)] text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-[#1e2638] dark:text-slate-300 dark:hover:border-indigo-400 dark:hover:text-indigo-300 sm:text-sm`}
            >
              {linkCopied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="sm:hidden">
                {linkCopied ? "Copied" : "Link"}
              </span>
              <span className="hidden sm:inline">
                {linkCopied ? "Copied" : "Copy link"}
              </span>
            </button>
            {isOwner && (
              <button
                type="button"
                disabled={ownerBusy}
                onClick={onToggleRevoke}
                title={
                  invite.status === "revoked"
                    ? "Unblock link — allow guests again"
                    : "Block link — stop guest access"
                }
                className={`${btnOutlineCls} disabled:opacity-60 sm:text-sm ${
                  invite.status === "revoked"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "border-rose-200 bg-[var(--bg-elevated)] text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
                }`}
              >
                {invite.status === "revoked" ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                <span>
                  {invite.status === "revoked" ? "Unblock link" : "Block link"}
                </span>
              </button>
            )}
            {isOwner && isAgencyScope && (
              <button
                type="button"
                disabled={ownerBusy}
                onClick={() => void onRotateToken()}
                title="Change URL — old link stops working"
                className={`${btnOutlineCls} border-amber-200 bg-[var(--bg-elevated)] text-amber-700 hover:bg-amber-50 disabled:opacity-60 dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/10 sm:text-sm`}
              >
                <KeyRound className="h-4 w-4" />
                <span className="hidden sm:inline">Change URL</span>
              </button>
            )}
            {isOwner && canApproveAll && (
              <button
                type="button"
                disabled={Boolean(approving) || !canApproveAll}
                onClick={() => onApprove()}
                className={`${btnSolidCls} flex-1 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400 sm:flex-none sm:text-sm`}
              >
                {approving === "__all__"
                  ? "Approving…"
                  : focusedGuest
                    ? `Approve ${focusedGuest.name.split(" ")[0]}`
                    : "Approve all"}
              </button>
            )}
            {ownerOverviewMode && (
              <button
                type="button"
                onClick={() => setEntriesSidebarOpen(true)}
                title="Entries"
                className={`${btnIconCls} border-slate-200 bg-[var(--bg-elevated)] text-slate-500 hover:text-indigo-600 md:hidden dark:border-[#1e2638] dark:text-slate-400`}
              >
                <PanelRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {ownerOverviewMode && (
          <div className="hidden w-64 shrink-0 border-r border-slate-200 md:block dark:border-[#1e2638] lg:w-72">
            {usersSidebar}
          </div>
        )}

        {ownerOverviewMode && usersSidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              aria-label="Close users"
              className="absolute inset-0 bg-black/40"
              onClick={() => setUsersSidebarOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] border-r border-slate-200 shadow-xl dark:border-[#1e2638]">
              <button
                type="button"
                onClick={() => setUsersSidebarOpen(false)}
                className="absolute right-2 top-2.5 z-10 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              {usersSidebar}
            </div>
          </div>
        )}

      <main
        className={`mx-auto min-h-0 w-full flex-1 space-y-3 overflow-y-auto p-3 pb-28 sm:space-y-4 sm:p-6 sm:pb-24 ${
          ownerOverviewMode ? "max-w-5xl" : "max-w-5xl"
        }`}
        onFocusCapture={handleFormFocusIn}
        onBlurCapture={handleFormFocusOut}
      >
        {approveError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 sm:px-4">
            {approveError}
          </div>
        )}

        {!isOwner && (
          <div className="flex flex-wrap items-center gap-3">
            <GuestDriverSummary
              name={driverName}
              phone={driverPhone}
              editing={editingDriver && !isAgencyScope}
              onEdit={() => {
                if (!isAgencyScope) setEditingDriver(true);
              }}
              onDone={() => setEditingDriver(false)}
              onNameChange={setDriverName}
              onPhoneChange={(v) => {
                if (isAgencyScope) return;
                setDriverPhone(v);
                setApproveError((prev) =>
                  prev &&
                  /phone number already exists|guest link with this phone/i.test(
                    prev,
                  )
                    ? null
                    : prev,
                );
              }}
            />
          </div>
        )}

        {ownerOverviewMode && focusedGuest && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Showing</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200">
              <User className="h-3 w-3" />
              {focusedGuest.name}
              <button
                type="button"
                onClick={() => focusGuestUser(null)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
                aria-label="Clear filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}

        {ownerOverviewMode && displayBlocks.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-[#1e2638]">
            {focusedGuest
              ? `${focusedGuest.name} has no trip entries yet`
              : "No trip entries yet from link users"}
          </p>
        )}

        {viewBlock && (() => {
          const showNewAgency =
            invite.allowCreateAgency &&
            !agencyLocked &&
            viewBlock.status !== "accepted";
          const showApproveBtn =
            isOwner && viewBlock.status !== "accepted";
          const blockDriverName = ownerOverviewMode
            ? viewBlock.guestName || guestDriverName
            : guestDriverName;
          const blockDriverPhone = ownerOverviewMode
            ? viewBlock.guestPhone || guestDriverPhone
            : guestDriverPhone;
          const activeApproveReady = blockPendingOwnerApproval(
            viewBlock,
            blockDriverName,
            blockDriverPhone,
          );
          const activeApproveHint = guestApproveBlockError(
            viewBlock,
            blockDriverName,
            blockDriverPhone,
          );
          return (
          <section
            className={`space-y-3 rounded-xl border p-3 sm:space-y-4 sm:p-4 ${
              viewBlock.status === "accepted"
                ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                : "border-slate-200 bg-[var(--bg-card)] shadow-sm dark:border-[#1e2638]"
            }`}
          >
            {viewBlock.status === "accepted" && (
              <p className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                Approved — read-only
              </p>
            )}

            {ownerOverviewMode &&
              (viewBlock.guestName || viewBlock.guestPhone) && (
                <div className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/80 px-3 py-2 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                  <User className="h-4 w-4 text-indigo-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {viewBlock.guestName || "Driver"}
                    </p>
                    <p className="truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                      {viewBlock.guestPhone || "—"}
                    </p>
                  </div>
                </div>
              )}

            {!ownerOverviewMode &&
              displayBlocks.some(blockShowsAgencyPill) && (
              <div className="flex flex-wrap gap-1">
                {displayBlocks.filter(blockShowsAgencyPill).map((b) => {
                  const pending = blockPendingOwnerApproval(
                    b,
                    guestDriverName,
                    guestDriverPhone,
                  );
                  const active = b.clientId === viewBlock.clientId;
                  const timelineLabel = formatGuestPillTimeline(
                    guestBlockTimelineIso(b),
                  );
                  return (
                    <button
                      key={b.clientId}
                      type="button"
                      title={
                        active
                          ? "Click again for a blank new entry"
                          : b.status === "accepted"
                            ? "View approved batch"
                            : "Open this agency draft"
                      }
                      onClick={() => {
                        const { blocks: next, activeId } = activateAgencyPill(
                          blocks,
                          b,
                          activeClientId,
                        );
                        if (next !== blocks) setBlocks(next);
                        setActiveClientId(activeId);
                      }}
                      className={`inline-flex max-w-[11rem] flex-col items-start gap-0.5 rounded-xl border px-2 py-1 text-left text-[10px] font-semibold transition sm:max-w-[12.5rem] ${
                        active
                          ? b.status === "accepted"
                            ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-200"
                            : pending
                              ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100"
                              : "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200"
                          : pending
                            ? "border-amber-200/80 bg-amber-50/50 text-amber-800 hover:border-amber-300 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                            : "border-transparent bg-slate-100 text-slate-600 hover:border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:border-white/10"
                      }`}
                    >
                      <span className="flex w-full min-w-0 items-center gap-1">
                        <Building2 className="h-3 w-3 shrink-0 opacity-70" />
                        <span className="min-w-0 flex-1 truncate">
                          {b.agencyName || "Agency"}
                        </span>
                        {b.status === "accepted" ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        ) : pending ? (
                          <span className="shrink-0 rounded bg-amber-500 px-1 py-px text-[8px] font-bold uppercase text-white dark:bg-amber-600">
                            Approve
                          </span>
                        ) : null}
                      </span>
                      {timelineLabel ? (
                        <span className="w-full pl-4 text-[9px] font-normal leading-tight opacity-75">
                          {timelineLabel}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            <VehicleGroupsEditor
              groups={viewBlock.driverGroups}
              readOnly={viewBlock.status === "accepted"}
              sessionPlate={sessionVehiclePlate}
              onSessionPlateChange={handleSessionPlateChange}
              toolbarStart={
                agencyLocked ? (
                  <div className="min-w-0">
                    <span className={mobileLabelCls}>Agency</span>
                    <div
                      className={`mt-0.5 flex min-h-8 items-center gap-1.5 text-sm font-semibold text-slate-800 sm:min-h-10 dark:text-slate-100`}
                    >
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-indigo-500/80" />
                      <span className="truncate">
                        {viewBlock.agencyName ||
                          invite.agencyName ||
                          "Agency"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <label className="min-w-0">
                    <span className={mobileLabelCls}>Agency *</span>
                    <div className="mt-0.5">
                      <GuestAgencyPicker
                        agencies={agencies}
                        value={viewBlock.agencyId ?? ""}
                        fallbackName={viewBlock.agencyName}
                        disabled={viewBlock.status === "accepted"}
                        onChange={selectAgency}
                        onCreateNew={
                          showNewAgency
                            ? () => setShowCreateAgency(true)
                            : undefined
                        }
                      />
                    </div>
                  </label>
                )
              }
              toolbarEnd={
                showApproveBtn ? (
                  <button
                    type="button"
                    disabled={Boolean(approving) || !activeApproveReady}
                    title={activeApproveHint ?? undefined}
                    onClick={() => onApprove(viewBlock.clientId)}
                    className={`${btnSolidCls} shrink-0 px-3 text-white transition disabled:cursor-not-allowed dark:bg-emerald-500 ${
                      activeApproveReady
                        ? "bg-emerald-600 shadow-sm ring-2 ring-emerald-400/50 hover:bg-emerald-700 dark:ring-emerald-400/40"
                        : "bg-emerald-600/50 opacity-70"
                    }`}
                  >
                    {approving === viewBlock.clientId ? "…" : "Approve"}
                  </button>
                ) : null
              }
              onChange={(updater) => {
                if (ownerOverviewMode && viewBlock.status !== "accepted") {
                  ownerDraftDirtyRef.current = true;
                }
                setBlocks((prev) =>
                  prev.map((b) => {
                    if (b.clientId !== viewBlock.clientId) return b;
                    const nextGroups =
                      typeof updater === "function"
                        ? updater(b.driverGroups)
                        : updater;
                    if (b.status === "accepted") {
                      return { ...b, driverGroups: nextGroups };
                    }
                    return {
                      ...b,
                      driverGroups: nextGroups,
                      activityAt: new Date().toISOString(),
                    };
                  }),
                );
              }}
            />
          </section>
          );
        })()}

        <p className="pb-2 text-center text-xs text-slate-400 dark:text-slate-500">
          {isOwner
            ? "Users left · entries right · Edit open trips · Approve when ready"
            : "Autosaves as you type · no submit needed"}
          {invite.maxRows ? ` · max ${invite.maxRows} rows` : ""}
        </p>
      </main>

        {ownerOverviewMode && (
          <div className="hidden w-56 shrink-0 border-l border-slate-200 md:block dark:border-[#1e2638] lg:w-64">
            {entriesSidebar}
          </div>
        )}

        {ownerOverviewMode && entriesSidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              aria-label="Close entries"
              className="absolute inset-0 bg-black/40"
              onClick={() => setEntriesSidebarOpen(false)}
            />
            <div className="absolute inset-y-0 right-0 w-[min(18rem,85vw)] border-l border-slate-200 shadow-xl dark:border-[#1e2638]">
              <button
                type="button"
                onClick={() => setEntriesSidebarOpen(false)}
                className="absolute left-2 top-2.5 z-10 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              {entriesSidebar}
            </div>
          </div>
        )}
      </div>

      {showCreateAgency && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 dark:bg-black/60 sm:items-center sm:p-4"
          onClick={(e) =>
            e.target === e.currentTarget && setShowCreateAgency(false)
          }
        >
          <div className="w-full max-w-md space-y-4 rounded-t-2xl border border-slate-200 bg-[var(--bg-card)] p-5 shadow-xl dark:border-[#1e2638] sm:rounded-2xl sm:p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              New agency
            </h3>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Agency name"
              className={inputCls}
            />
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone (10+ digits)"
              inputMode="tel"
              className={inputCls}
            />
            <div className="flex gap-2 pb-[env(safe-area-inset-bottom)] sm:pb-0">
              <button
                type="button"
                onClick={() => setShowCreateAgency(false)}
                className={`${btnOutlineCls} flex-1 border-slate-200 bg-[var(--bg-elevated)] text-slate-600 dark:border-[#1e2638] dark:text-slate-300 sm:text-sm`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={onCreateAgency}
                className={`${btnSolidCls} flex-1 bg-indigo-600 text-white dark:bg-indigo-500 sm:text-sm`}
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
