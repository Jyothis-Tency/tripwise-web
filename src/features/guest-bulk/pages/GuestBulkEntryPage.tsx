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
} from "lucide-react";
import {
  approveGuestBulk,
  createGuestAgency,
  fetchGuestInvite,
  guestBulkShareUrl,
  newBlockClientId,
  revokeGuestBulkInvite,
  syncGuestBulk,
  unrevokeGuestBulkInvite,
  updateGuestBulkInvite,
  type GuestAgencyBlock,
  type GuestBulkInvite,
} from "../api";
import type { Agency, BulkTripRow, DriverGroup } from "../../bulk-entry/api";
import { formatAgencyLabel } from "../../bulk-entry/api";
import { DateTimePicker } from "../../../components/ui/DateTimePicker";
import { TimePicker12h } from "../../../components/ui/TimePicker12h";
import { normalizeHHmm } from "../../../lib/timePickerUtils";
import { useTheme } from "../../../hooks/useTheme";
import { TripwiseLogo } from "../../../components/brand/TripwiseLogo";

type SyncStatus = "idle" | "saving" | "saved" | "error";
const AUTOSAVE_DELAY = 800;

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

function formatGuestPillTimeline(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const format12h = (date: Date) => {
    let h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${pad(m)} ${ampm}`;
  };
  const age = Date.now() - d.getTime();
  if (age >= 0 && age < MS_24H) {
    return format12h(d);
  }
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy} ${format12h(d)}`;
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

function guestAgencyBlockKey(block: GuestAgencyBlock): string {
  if (block.agencyId) return `id:${block.agencyId}`;
  const name = String(block.agencyName ?? "").trim().toLowerCase();
  return name ? `name:${name}` : "";
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

/** After closing an approved view, focus an open block ready for new trips. */
function focusNextEntryWorkspace(
  blocks: GuestAgencyBlock[],
  fromApproved?: GuestAgencyBlock,
): { blocks: GuestAgencyBlock[]; activeId: string } {
  const key = fromApproved ? guestAgencyBlockKey(fromApproved) : "";
  if (key) {
    const sameAgencyOpen = blocks.find(
      (b) => b.status !== "accepted" && guestAgencyBlockKey(b) === key,
    );
    if (sameAgencyOpen) {
      return { blocks, activeId: sameAgencyOpen.clientId };
    }
  }

  const emptyOpen = blocks.find(
    (b) => b.status !== "accepted" && !blockHasTripData(b),
  );
  if (emptyOpen) {
    if (
      fromApproved &&
      !emptyOpen.agencyId &&
      !String(emptyOpen.agencyName ?? "").trim()
    ) {
      const next = blocks.map((b) =>
        b.clientId === emptyOpen.clientId
          ? {
              ...b,
              agencyId: fromApproved.agencyId ?? null,
              agencyName: fromApproved.agencyName ?? "",
            }
          : b,
      );
      return { blocks: next, activeId: emptyOpen.clientId };
    }
    return { blocks, activeId: emptyOpen.clientId };
  }

  const sessionPlate =
    guestSessionVehiclePlate(blocks) || plateFromBlock(fromApproved);
  const nb = emptyBlock(sessionPlate); // preferred plate applied at page level for new blocks
  if (fromApproved) {
    nb.agencyId = fromApproved.agencyId ?? null;
    nb.agencyName = fromApproved.agencyName ?? "";
  }
  return { blocks: [...blocks, nb], activeId: nb.clientId };
}

/**
 * Open pills → select that draft.
 * Approved pills → first click shows read-only history; second click (same pill) closes and opens entry.
 */
function activateAgencyPill(
  blocks: GuestAgencyBlock[],
  pill: GuestAgencyBlock,
  activeClientId: string,
): { blocks: GuestAgencyBlock[]; activeId: string } {
  if (pill.status !== "accepted") {
    return { blocks, activeId: pill.clientId };
  }
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
  sessionPlate = "",
  onSessionPlateChange,
}: {
  groups: DriverGroup[];
  onChange: Dispatch<SetStateAction<DriverGroup[]>>;
  readOnly?: boolean;
  toolbarStart?: ReactNode;
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

    let cancelled = false;
    (async () => {
      try {
        const data = await fetchGuestInvite(token);
        if (cancelled) return;
        setInvite(data);
        setIsOwner(Boolean(data.isOwner));
        setAgencies(data.agencies ?? []);
        setDriverName(data.driverName || "");
        setDriverPhone(data.driverPhone || "");
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
      } catch (e: unknown) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Failed to load invite",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
        driverGroups: stampGuestDriverOnGroups(
          b.driverGroups,
          driverName,
          driverPhone,
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
    const payload = syncPayloadRef.current;
    const hash = quickHash(JSON.stringify(payload));
    if (hash === lastBackendHash.current) return;

    const gen = ++syncGenerationRef.current;
    setSyncStatus("saving");
    try {
      const openBlocks = payload.blocks
        .filter((b) => b.status !== "accepted")
        .map((b) => ({
          clientId: b.clientId,
          agencyId: b.agencyId,
          agencyName: b.agencyName,
          driverGroups: b.driverGroups,
        }));
      const accepted = payload.blocks.filter((b) => b.status === "accepted");
      const data = await syncGuestBulk(token, {
        driverName: payload.driverName,
        driverPhone: payload.driverPhone,
        blocks: [
          ...openBlocks,
          ...accepted.map((b) => ({
            clientId: b.clientId,
            agencyId: b.agencyId,
            agencyName: b.agencyName,
            driverGroups: b.driverGroups,
          })),
        ],
      });
      if (!mountedRef.current || gen !== syncGenerationRef.current) return;
      lastBackendHash.current = quickHash(JSON.stringify(syncPayloadRef.current));
      setSyncStatus("saved");
      if (data.draft?.blocks) {
        if (editingDepthRef.current > 0) {
          pendingAcceptedDraftRef.current = data.draft.blocks;
        } else {
          setBlocks((prev) =>
            mergeAcceptedBlocksFromServer(prev, data.draft!.blocks),
          );
        }
      }
      setTimeout(() => {
        if (mountedRef.current) setSyncStatus("idle");
      }, 2000);
    } catch {
      if (mountedRef.current) setSyncStatus("error");
    }
  }, [token, invite]);

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

  useEffect(() => {
    if (!token || !invite || loading) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }

    const json = JSON.stringify(syncPayload);
    const hash = quickHash(json);
    if (hash === lastBackendHash.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persistGuestDraft();
    }, AUTOSAVE_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [token, invite, loading, syncPayload, persistGuestDraft]);

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
      const existingOpen = prev.find(
        (b) =>
          b.status === "open" &&
          agencyId &&
          String(b.agencyId ?? "") === String(agencyId),
      );
      if (existingOpen) {
        setActiveClientId(existingOpen.clientId);
        return prev;
      }

      const active =
        prev.find((b) => b.clientId === activeClientId) ??
        prev.find((b) => b.status === "open");

      if (active?.status === "accepted") {
        const nb = emptyBlock(
          resolveGuestSessionPlate(prev, preferredGuestPlate),
        );
        nb.agencyId = agencyId || null;
        nb.agencyName = agencyName;
        setActiveClientId(nb.clientId);
        return [...prev, nb];
      }

      if (active && !blockHasTripData(active)) {
        setActiveClientId(active.clientId);
        return prev.map((b) =>
          b.clientId === active.clientId
            ? {
                ...b,
                agencyId: agencyId || null,
                agencyName,
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
    const targets = clientId
      ? blocks.filter((b) => b.clientId === clientId && b.status !== "accepted")
      : blocks.filter((b) => b.status !== "accepted");
    for (const b of targets) {
      const err = guestApproveBlockError(
        b,
        guestDriverName,
        guestDriverPhone,
      );
      if (err) {
        setApproveError(err);
        return;
      }
    }
    if (!targets.length) {
      setApproveError("No open agency block to approve.");
      return;
    }
    setApproving(clientId ?? "__all__");
    try {
      const data = await approveGuestBulk(
        token,
        clientId ? { clientId } : { all: true },
      );
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

  const onOwnerExpiryChange = async (localValue: string) => {
    if (!invite?.id) return;
    setOwnerBusy(true);
    setApproveError(null);
    try {
      const data = await updateGuestBulkInvite(
        invite.id,
        localValue
          ? { expiresAt: new Date(localValue).toISOString() }
          : { expiresAt: null },
      );
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

  const toLocalInputValue = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openBlocks = blocks.filter((b) => b.status !== "accepted");
  const canApproveAll = openBlocks.some((b) =>
    blockPendingOwnerApproval(b, guestDriverName, guestDriverPhone),
  );

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-main)]">
        <TripwiseLogo className="h-16 w-16 drop-shadow-md" />
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (loadError || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] p-6">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-[var(--bg-card)] p-6 text-center shadow-sm dark:border-rose-500/30">
          <TripwiseLogo className="mx-auto mb-4 h-16 w-16" />
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

  const expiresLabel = invite.expiresAt
    ? new Date(invite.expiresAt).toLocaleString()
    : "";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg-main)]">
      <header className="shrink-0 border-b border-slate-200 bg-[var(--bg-card)]/95 px-2.5 py-2 shadow-sm backdrop-blur dark:border-[#1e2638] sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
            <TripwiseLogo className="mt-0.5 h-9 w-9 shrink-0 sm:h-12 sm:w-12" />
            <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {isOwner
                ? "Tripwise · owner review"
                : "Tripwise · driver entry"}
            </p>
            <h1 className="truncate text-base font-bold leading-snug text-slate-800 dark:text-white sm:text-lg">
              {invite.label}
            </h1>
            {expiresLabel && (
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 sm:text-xs">
                Expires {expiresLabel}
              </p>
            )}
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
                    ? "Unrevoke — allow drivers"
                    : "Revoke — block drivers"
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
                  {invite.status === "revoked" ? "Unrevoke" : "Revoke"}
                </span>
              </button>
            )}
            {isOwner && canApproveAll && (
              <button
                type="button"
                disabled={Boolean(approving) || !canApproveAll}
                onClick={() => onApprove()}
                className={`${btnSolidCls} flex-1 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400 sm:flex-none sm:text-sm`}
              >
                {approving === "__all__" ? "Approving…" : "Approve all"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main
        className="mx-auto min-h-0 w-full max-w-5xl flex-1 space-y-3 overflow-y-auto p-3 pb-28 sm:space-y-4 sm:p-6 sm:pb-24"
        onFocusCapture={handleFormFocusIn}
        onBlurCapture={handleFormFocusOut}
      >
        {approveError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 sm:px-4">
            {approveError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {isOwner && (
            <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white dark:bg-emerald-500">
                Owner
              </span>
              {(invite.status === "revoked" || invite.expired) && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                  {invite.status === "revoked" ? "Revoked" : "Expired"}
                </span>
              )}
              <label className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-900 dark:text-emerald-200">
                <span>Exp</span>
                <DateTimePicker
                  compact
                  disabled={ownerBusy}
                  value={toLocalInputValue(invite.expiresAt)}
                  onChange={(next) => {
                    const prev = toLocalInputValue(invite.expiresAt);
                    if (next !== prev) void onOwnerExpiryChange(next);
                  }}
                  className="w-[10.75rem] rounded border border-emerald-200 bg-[var(--bg-elevated)] px-1 py-0.5 text-[11px] text-slate-700 dark:border-emerald-500/30 dark:text-slate-200"
                />
              </label>
            </div>
          )}
          <GuestDriverSummary
            name={driverName}
            phone={driverPhone}
            editing={editingDriver}
            onEdit={() => setEditingDriver(true)}
            onDone={() => setEditingDriver(false)}
            onNameChange={setDriverName}
            onPhoneChange={setDriverPhone}
          />
        </div>

        {activeBlock && (() => {
          const showNewAgency =
            invite.allowCreateAgency && activeBlock.status !== "accepted";
          const showApproveBtn =
            isOwner && activeBlock.status !== "accepted";
          const activeApproveReady = blockPendingOwnerApproval(
            activeBlock,
            guestDriverName,
            guestDriverPhone,
          );
          const activeApproveHint = guestApproveBlockError(
            activeBlock,
            guestDriverName,
            guestDriverPhone,
          );
          return (
          <section
            className={`space-y-3 rounded-xl border p-3 sm:space-y-4 sm:p-4 ${
              activeBlock.status === "accepted"
                ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                : "border-slate-200 bg-[var(--bg-card)] shadow-sm dark:border-[#1e2638]"
            }`}
          >
            {activeBlock.status === "accepted" && (
              <p className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                Approved — read-only
              </p>
            )}

            {blocks.some(blockShowsAgencyPill) && (
              <div className="flex flex-wrap gap-1">
                {blocks.filter(blockShowsAgencyPill).map((b) => {
                  const pending = blockPendingOwnerApproval(
                    b,
                    guestDriverName,
                    guestDriverPhone,
                  );
                  const active = b.clientId === activeBlock.clientId;
                  const timelineLabel = formatGuestPillTimeline(
                    guestBlockTimelineIso(b),
                  );
                  return (
                    <button
                      key={b.clientId}
                      type="button"
                      title={
                        b.status === "accepted"
                          ? active
                            ? "Click again to enter new trips"
                            : "View approved batch"
                          : undefined
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
                        <span
                          className="w-full pl-4 text-[9px] font-normal leading-tight opacity-75"
                        >
                          {timelineLabel}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            <VehicleGroupsEditor
              groups={activeBlock.driverGroups}
              readOnly={activeBlock.status === "accepted"}
              sessionPlate={sessionVehiclePlate}
              onSessionPlateChange={handleSessionPlateChange}
              toolbarStart={
                <>
                  <label className="min-w-0">
                    <span className={mobileLabelCls}>Agency *</span>
                    <div className="mt-0.5">
                      <GuestAgencyPicker
                        agencies={agencies}
                        value={activeBlock.agencyId ?? ""}
                        fallbackName={activeBlock.agencyName}
                        disabled={activeBlock.status === "accepted"}
                        onChange={selectAgency}
                        onCreateNew={
                          showNewAgency
                            ? () => setShowCreateAgency(true)
                            : undefined
                        }
                      />
                    </div>
                  </label>
                  {showApproveBtn && (
                    <button
                      type="button"
                      disabled={Boolean(approving) || !activeApproveReady}
                      title={activeApproveHint ?? undefined}
                      onClick={() => onApprove(activeBlock.clientId)}
                      className={`${btnSolidCls} shrink-0 self-end px-2.5 text-white transition disabled:cursor-not-allowed dark:bg-emerald-500 ${
                        activeApproveReady
                          ? "bg-emerald-600 shadow-sm ring-2 ring-emerald-400/50 hover:bg-emerald-700 dark:ring-emerald-400/40"
                          : "bg-emerald-600/50 opacity-70"
                      }`}
                    >
                      {approving === activeBlock.clientId ? "…" : "Approve"}
                    </button>
                  )}
                </>
              }
              onChange={(updater) => {
                setBlocks((prev) =>
                  prev.map((b) => {
                    if (b.clientId !== activeBlock.clientId) return b;
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
          Autosaves as you type · no submit needed
          {invite.maxRows ? ` · max ${invite.maxRows} rows` : ""}
        </p>
      </main>

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
