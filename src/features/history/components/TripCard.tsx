import { useState, useEffect, type MouseEvent } from "react";
import { DatePicker } from "../../../components/ui/DatePicker";
import { todayIsoInAppTz } from "../../../lib/datePickerUtils";
import {
  Trash2,
  Car,
  User,
  Calendar,
  Clock,
  Pencil,
  Check,
  X,
  ArrowRight,
  Route,
  Maximize2,
  Building2,
  Wallet,
} from "lucide-react";
import type { HistoryTrip, RecordPaymentTripSummary } from "../api";
import {
  deleteTrip,
  fetchHistoryTripById,
  recordPayment,
  updateTripFields,
} from "../api";
import {
  fmtTimeAmPm,
  isoToTimeInputInTz,
  fmtTripDuration,
} from "../historyTimeUtils";
import { TimePicker12h } from "../../../components/ui/TimePicker12h";
import { normalizeHHmm } from "../../../lib/timePickerUtils";
import {
  computeDriverSalaryBreakdown,
  getHistoryTripExpenseBreakdown,
  resolveTripAgencyProfitDisplay,
} from "../tripExpenseBreakdown";
import { TripCashInModal } from "../../vehicles/components/TripCashInModal";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function fmtCurrency(v: unknown): string {
  const n = parseFloat(String(v ?? 0));
  if (isNaN(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(v: unknown): string {
  if (!v) return "—";
  return String(v).split("T")[0];
}

function driverName(d: HistoryTrip["driver"]): string {
  if (!d) return "—";
  if (typeof d === "string") return d;
  return `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || "—";
}

function vehicleNum(v: HistoryTrip["vehicle"]): string {
  if (!v) return "—";
  if (typeof v === "string") return v;
  return v.vehicleNumber ?? "—";
}

function getTripStatusStyle(status: string): string {
  switch (status?.toLowerCase()) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:text-emerald-300";
    case "cancelled":
      return "bg-rose-500/15 text-rose-700 border border-rose-500/30 dark:text-rose-300";
    case "in_progress":
      return "bg-indigo-500/15 text-indigo-700 border border-indigo-500/40 dark:text-indigo-300";
    case "scheduled":
      return "bg-indigo-500/15 text-indigo-700 border border-indigo-500/40 dark:text-indigo-300";
    default:
      return "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-[#1e2638]";
  }
}

function tripStatusDotClass(status: string): string {
  switch (status?.toLowerCase()) {
    case "completed":
      return "bg-emerald-500";
    case "cancelled":
      return "bg-rose-500";
    case "in_progress":
    case "scheduled":
      return "bg-indigo-500 animate-pulse";
    default:
      return "bg-slate-400";
  }
}

function paymentAccentClass(
  status: "paid" | "partial" | "unpaid",
  remaining: number,
): string {
  if (status === "paid" || remaining <= 1e-6) {
    return "from-emerald-500 to-emerald-400";
  }
  if (status === "partial") return "from-amber-500 to-amber-400";
  return "from-rose-500 to-rose-400";
}

function cashInStatusLabel(status: "paid" | "partial" | "unpaid"): string {
  if (status === "paid") return "Fully Paid";
  if (status === "partial") return "Partially Paid";
  return "Payment Pending";
}

function cashInStatusBadgeClass(status: "paid" | "partial" | "unpaid"): string {
  if (status === "paid") {
    return "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:text-emerald-300";
  }
  if (status === "partial") {
    return "bg-amber-500/15 text-amber-800 border border-amber-500/30 dark:text-amber-300";
  }
  return "bg-rose-500/15 text-rose-700 border border-rose-500/30 dark:text-rose-300";
}

function resolveCashInSummary(trip: HistoryTrip): {
  due: number;
  paid: number;
  remaining: number;
  status: "paid" | "partial" | "unpaid";
} {
  if (trip.cashInSummary) {
    return {
      due: Number(trip.cashInSummary.due) || 0,
      paid: Number(trip.cashInSummary.paid) || 0,
      remaining: Number(trip.cashInSummary.remaining) || 0,
      status: trip.cashInSummary.status,
    };
  }
  const cost = Number(trip.agencyCost);
  const due =
    Number.isFinite(cost) && cost > 0
      ? cost
      : resolveTripAgencyProfitDisplay(trip);
  return { due, paid: 0, remaining: due, status: "unpaid" };
}

const NUMBER_FIELDS = new Set([
  "distance",
  "agencyCost",
  "cabCost",
  "driver_salary",
  "advance",
  "startKilometers",
  "endKilometers",
]);

const DATE_FIELDS = new Set(["startDate", "expectedEndDate"]);
const TIME_FIELDS = new Set(["startTime", "endTime"]);

/** Merge PATCH response into local trip (date/driver/vehicle rules match expanded card). */
function mergeTripAfterInlineSave(
  prev: HistoryTrip,
  savedFieldKey: string,
  updatedTrip: HistoryTrip,
): HistoryTrip {
  const next: HistoryTrip = { ...prev, ...updatedTrip };

  const dateLikeKeys = new Set([
    "startDate",
    "expectedEndDate",
    "actualStartTime",
    "actualEndTime",
    "startTime",
    "endTime",
  ]);
  if (!dateLikeKeys.has(savedFieldKey)) {
    next.startDate = prev.startDate;
    next.expectedEndDate = prev.expectedEndDate;
    (next as any).actualStartTime = (prev as any).actualStartTime;
    (next as any).actualEndTime = (prev as any).actualEndTime;
    next.startTime = prev.startTime;
    next.endTime = prev.endTime;
  }

  if (
    updatedTrip.driver &&
    typeof updatedTrip.driver === "string" &&
    prev.driver &&
    typeof prev.driver !== "string"
  ) {
    next.driver = prev.driver;
  }
  if (
    updatedTrip.vehicle &&
    typeof updatedTrip.vehicle === "string" &&
    prev.vehicle &&
    typeof prev.vehicle !== "string"
  ) {
    next.vehicle = prev.vehicle;
  }

  return next;
}

const valueEmphasisClass = (highlight?: boolean) =>
  `text-base sm:text-lg font-bold tabular-nums tracking-tight ${highlight ? "text-indigo-700 dark:text-indigo-300" : "text-slate-900 dark:text-slate-100"}`;

// ─── Compact Detail Row ──────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  highlight,
  emphasizeValue,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  emphasizeValue?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 py-1.5">
      <span className="w-[130px] sm:w-[150px] shrink-0 text-sm sm:text-[15px] text-slate-600">
        {label}
      </span>
      <span
        className={
          emphasizeValue
            ? valueEmphasisClass(highlight)
            : `text-sm sm:text-[15px] font-medium ${highlight ? "text-indigo-600 dark:text-indigo-300" : "text-slate-800 dark:text-slate-100"}`
        }
      >
        {value}
      </span>
    </div>
  );
}

// ─── Editable Detail Row ─────────────────────────────────────────────────────

function EditableRow({
  label,
  value,
  highlight,
  fieldKey,
  tripId,
  onSaved,
  timeEditSeed,
  readOnly,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  fieldKey: string;
  tripId: string;
  onSaved: (fieldKey: string, updatedTrip: HistoryTrip) => void;
  /** For `type="time"` rows: HH:mm seed from ISO (not the AM/PM display string). */
  timeEditSeed?: string;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const [editValue, setEditValue] = useState(value === "—" ? "" : value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDisplayValue(value);
  }, [value, editing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let val: string | number = editValue;
      if (NUMBER_FIELDS.has(fieldKey)) {
        const parsed = Number(editValue);
        if (editValue.trim() === "" || !Number.isFinite(parsed)) {
          throw new Error("Enter a valid number");
        }
        if (parsed < 0) {
          throw new Error("Negative values are not allowed");
        }
        val = parsed;
      }
      if (TIME_FIELDS.has(fieldKey) && typeof val === "string") {
        val = val ? normalizeHHmm(val) : "";
      }
      const updatedTrip = await updateTripFields(tripId, {
        [fieldKey]: val,
      } as any);
      // Update locally — no full page reload
      const newDisplay = NUMBER_FIELDS.has(fieldKey)
        ? fieldKey === "agencyCost" ||
          fieldKey === "cabCost" ||
          fieldKey === "driver_salary"
          ? fmtCurrency(val)
          : String(val)
        : editValue || "—";
      setDisplayValue(newDisplay);
      setEditing(false);
      onSaved(fieldKey, updatedTrip);
    } catch (err: any) {
      alert(
        err?.message ||
          err?.response?.data?.message ||
          "Failed to update field",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(displayValue === "—" ? "" : displayValue);
    setEditing(false);
  };

  const emphasizeDisplay =
    NUMBER_FIELDS.has(fieldKey) ||
    DATE_FIELDS.has(fieldKey) ||
    TIME_FIELDS.has(fieldKey);

  if (readOnly) {
    return (
      <DetailRow
        label={label}
        value={displayValue}
        highlight={highlight}
        emphasizeValue={emphasizeDisplay}
      />
    );
  }

  if (editing) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-2 py-1 sm:flex-row sm:items-center sm:gap-2">
        <span className="w-full shrink-0 text-sm sm:text-[15px] text-slate-600 sm:w-[130px] sm:max-w-[150px]">
          {label}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {TIME_FIELDS.has(fieldKey) ? (
            <TimePicker12h
              value={normalizeHHmm(editValue) || editValue}
              allowEmpty
              disabled={saving}
              onChange={(v) => setEditValue(v)}
              className="min-w-0 flex-1"
            />
          ) : (
            <input
              autoFocus
              type={NUMBER_FIELDS.has(fieldKey) ? "number" : "text"}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
              className={`min-h-[32px] min-w-0 flex-1 basis-[6rem] rounded-md border border-indigo-300 bg-[var(--bg-elevated)] dark:border-indigo-500/50 px-2 py-1.5 leading-tight outline-none focus:ring-2 focus:ring-indigo-200 sm:basis-[8rem] ${NUMBER_FIELDS.has(fieldKey) || DATE_FIELDS.has(fieldKey) ? "text-base sm:text-lg font-semibold tabular-nums" : "text-sm"}`}
              disabled={saving}
            />
          )}
          <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-slate-200/80 bg-[var(--bg-elevated)]/80 dark:border-[#1e2638] p-0.5 shadow-sm">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded p-1 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40"
              aria-label="Save"
            >
              {saving ? (
                <div className="h-4 w-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex min-w-0 items-baseline gap-2 py-1.5">
      <span className="w-[130px] sm:w-[150px] shrink-0 text-sm sm:text-[15px] text-slate-600">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span
          className={`min-w-0 wrap-break-word ${emphasizeDisplay ? valueEmphasisClass(highlight) : `text-sm sm:text-[15px] font-medium ${highlight ? "text-indigo-600 dark:text-indigo-300" : "text-slate-800 dark:text-slate-100"}`}`}
        >
          {displayValue}
        </span>
        <button
          type="button"
          onClick={() => {
            const isTime = fieldKey.toLowerCase().includes("time");
            let seed =
              displayValue === "—"
                ? ""
                : displayValue.replace(/^₹/, "").replace(/,/g, "");
            if (isTime && timeEditSeed !== undefined) seed = timeEditSeed;
            setEditValue(seed);
            setEditing(true);
          }}
          className="shrink-0 rounded-md p-1 text-slate-600 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-100 active:bg-slate-200 transition-opacity dark:hover:bg-white/5"
          title={`Edit ${label}`}
          aria-label={`Edit ${label}`}
        >
          <Pencil className="h-4 w-4 stroke-[2.25]" />
        </button>
      </div>
    </div>
  );
}

// ─── Record Payment Modal (hidden — kept for future payout UI) ─────────────────

export function RecordPaymentModal({
  trip,
  onClose,
  onSuccess,
}: {
  trip: HistoryTrip;
  onClose: () => void;
  onSuccess: (summary: RecordPaymentTripSummary) => void;
}) {
  const remaining = trip.paymentSummary?.remainingBalance ?? 0;
  const balanceCleared = remaining <= 1e-6;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => todayIsoInAppTz());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const summary = await recordPayment(trip._id, {
        amount: amt,
        paymentMethod: method,
        referenceNumber: reference || undefined,
        notes: notes || undefined,
        paymentDate: date,
      });
      onSuccess(summary);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to record payment. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const amtPreview = parseFloat(amount);
  const showOverpayNote =
    Number.isFinite(amtPreview) &&
    amtPreview > 0 &&
    remaining > 1e-6 &&
    amtPreview > remaining + 1e-6;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1e2638] w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#1e2638]">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Record Payment</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/30 px-3 py-2.5 text-sm sm:text-base text-indigo-900 dark:text-indigo-200">
            <span className="font-semibold">{fmt(trip.tripNumber)}</span>
            <span className="text-indigo-700 dark:text-indigo-300"> · Remaining: </span>
            <span className="font-bold tabular-nums text-base sm:text-lg">
              {fmtCurrency(remaining)}
            </span>
          </div>
          {balanceCleared && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm font-medium text-emerald-900">
              Balance is cleared. You can still record more payments here
              (overpayment, correction, or extra receipt).
            </p>
          )}
          {showOverpayNote && (
            <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm font-medium text-amber-950">
              This amount is above the remaining balance. It will be saved;
              remaining may show as negative (overpaid) until you adjust the
              trip.
            </p>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Amount *
            </label>
            <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200 dark:border-[#1e2638]">
              <span className="border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-base font-semibold text-slate-600 dark:border-[#1e2638] dark:bg-white/[0.03]">
                ₹
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="flex-1 bg-[var(--bg-elevated)] px-3 py-2.5 text-base font-bold tabular-nums text-slate-800 outline-none dark:text-slate-100 sm:text-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Payment Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2.5 text-base text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100"
            >
              {[
                { v: "cash", l: "Cash" },
                { v: "bank_transfer", l: "Bank Transfer" },
                { v: "upi", l: "UPI" },
                { v: "cheque", l: "Cheque" },
                { v: "online", l: "Online" },
                { v: "other", l: "Other" },
              ].map((m) => (
                <option key={m.v} value={m.v}>
                  {m.l}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Date
            </label>
            <DatePicker
              value={date}
              onChange={setDate}
              className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2.5 text-base font-semibold tabular-nums text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Reference Number
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2.5 text-base text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2.5 text-base text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-[#1e2638] dark:text-slate-100"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm font-semibold">{error}</p>
          )}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-base font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-[#1e2638] dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-base font-bold transition disabled:opacity-60"
          >
            {saving ? "Saving…" : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Trip Card ────────────────────────────────────────────────────────────────

interface TripCardProps {
  trip: HistoryTrip;
  readOnly?: boolean;
  /** @deprecated Details open in a modal; kept for call-site compatibility. */
  defaultExpanded?: boolean;
  onDeleted?: () => void;
  /** After Cash-in success; parent patches list with refreshed trip. */
  onPaymentRecorded?: (tripId: string, updated: HistoryTrip) => void;
  /** After inline field save: merged trip so parent list order stays stable without refetch. */
  onTripUpdated?: (trip: HistoryTrip) => void;
  resolveAgencyLabel?: (agencyName?: string) => string;
}

export function TripCard({
  trip: initialTrip,
  readOnly = false,
  defaultExpanded = false,
  onDeleted,
  onPaymentRecorded,
  onTripUpdated,
  resolveAgencyLabel,
}: TripCardProps) {
  const [trip, setTrip] = useState<HistoryTrip>(initialTrip);

  useEffect(() => {
    setTrip(initialTrip);
  }, [initialTrip]);

  const expenseBreakdown = getHistoryTripExpenseBreakdown(trip);
  const salaryBreakdown = computeDriverSalaryBreakdown(trip);
  const agencyProfit = resolveTripAgencyProfitDisplay(trip);
  const cashIn = resolveCashInSummary(trip);

  const [detailOpen, setDetailOpen] = useState(defaultExpanded);
  const [payOpen, setPayOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!detailOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [detailOpen]);

  const travelledKm =
    trip.startKilometers != null && trip.endKilometers != null
      ? trip.endKilometers - trip.startKilometers
      : null;

  const routeFrom = trip.from ?? trip.pickup;
  const routeTo = trip.to ?? trip.drop;
  const durationLabel = fmtTripDuration(trip.startTime, trip.endTime);
  const plate = vehicleNum(trip.vehicle);
  const agencyLabel = (
    resolveAgencyLabel
      ? resolveAgencyLabel(trip.agencyName)
      : trip.agencyName || ""
  ).trim();

  const openPayments = (e?: MouseEvent) => {
    e?.stopPropagation();
    setPayOpen(true);
  };

  const handleCashInSuccess = async () => {
    setPayOpen(false);
    try {
      const refreshed = await fetchHistoryTripById(trip._id);
      setTrip(refreshed);
      onPaymentRecorded?.(trip._id, refreshed);
      onTripUpdated?.(refreshed);
    } catch {
      onDeleted?.();
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this trip? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteTrip(trip._id);
      onDeleted?.();
    } catch {
      alert("Failed to delete trip.");
    } finally {
      setDeleting(false);
    }
  };

  // Shorthand for editable rows
  const E = (
    label: string,
    value: string,
    fieldKey: string,
    hl?: boolean,
    timeEditSeed?: string,
  ) => (
    <EditableRow
      label={label}
      value={value}
      fieldKey={fieldKey}
      tripId={trip._id}
      readOnly={readOnly}
      onSaved={(savedFieldKey, updatedTrip) => {
        setTrip((prev) => {
          const next = mergeTripAfterInlineSave(
            prev,
            savedFieldKey,
            updatedTrip,
          );
          queueMicrotask(() => onTripUpdated?.(next));
          return next;
        });
      }}
      highlight={hl}
      timeEditSeed={timeEditSeed}
    />
  );

  const detailBody = (
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
      <section className="min-w-0 lg:col-span-7">
        <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-[#1e2638]">
          <span className="h-4 w-1 rounded-full bg-indigo-500" />
          <h4 className="text-xs font-bold tracking-wider text-indigo-500 uppercase dark:text-indigo-400">
            Trip Details
          </h4>
        </div>
        <div className="space-y-0.5 rounded-lg border border-slate-100 bg-slate-50/40 px-3 py-2 dark:border-[#1e2638] dark:bg-white/[0.03] sm:px-4 sm:py-3">
          <DetailRow
            label="Trip Number"
            value={fmt(trip.tripNumber)}
            emphasizeValue
          />
          <DetailRow
            label="Status"
            value={(trip.status ?? "—").replace(/_/g, " ")}
          />
          {E(
            "Start Date",
            fmtDate(trip.startDate ?? trip.date),
            "startDate",
          )}
          {trip.endDate &&
            E("End Date", fmtDate(trip.endDate), "expectedEndDate")}
          {E(
            "Start Time",
            fmtTimeAmPm(trip.startTime),
            "startTime",
            undefined,
            isoToTimeInputInTz(trip.startTime),
          )}
          {E(
            "End Time",
            fmtTimeAmPm(trip.endTime),
            "endTime",
            undefined,
            isoToTimeInputInTz(trip.endTime),
          )}
          <DetailRow
            label="Trip duration"
            value={durationLabel}
            highlight
            emphasizeValue
          />
          <DetailRow label="Driver" value={driverName(trip.driver)} />
          {typeof trip.driver !== "string" && trip.driver?.phone && (
            <DetailRow
              label="Driver Phone"
              value={fmt(trip.driver.phone)}
              emphasizeValue
            />
          )}
          <DetailRow label="Vehicle" value={plate} />
          {typeof trip.vehicle !== "string" && trip.vehicle?.vehicleType && (
            <DetailRow
              label="Vehicle Type"
              value={fmt(trip.vehicle.vehicleType)}
            />
          )}
          {E("From", fmt(trip.from ?? trip.pickup ?? ""), "from")}
          {E("To", fmt(trip.to ?? trip.drop ?? ""), "to")}
          {E("Distance", fmt(trip.distance || ""), "distance")}
          {E(
            "Start KM",
            trip.startKilometers != null ? `${trip.startKilometers}` : "—",
            "startKilometers",
          )}
          {E(
            "End KM",
            trip.endKilometers != null ? `${trip.endKilometers}` : "—",
            "endKilometers",
          )}
          {travelledKm != null && (
            <DetailRow
              label="KM Travelled"
              value={`${travelledKm} km`}
              highlight
              emphasizeValue
            />
          )}
          {E("Customer", fmt(trip.customer || ""), "customer")}
          {E(
            "Agency",
            fmt(
              resolveAgencyLabel
                ? resolveAgencyLabel(trip.agencyName)
                : trip.agencyName || "",
            ),
            "agencyName",
          )}
          {trip.careOf?.name && (
            <DetailRow label="Care Of" value={fmt(trip.careOf.name)} />
          )}
          {E(
            "Notes",
            fmt(trip.notes ?? trip.completionNote ?? ""),
            "notes",
          )}
        </div>

        {(routeFrom || routeTo || travelledKm != null) && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-[var(--bg-elevated)] p-3 dark:border-[#1e2638]">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300">
                <Route className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {routeFrom && routeTo
                    ? `${routeFrom} → ${routeTo}`
                    : "Trip route"}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {[
                    travelledKm != null ? `${travelledKm} km travelled` : null,
                    durationLabel !== "—" ? durationLabel : null,
                    plate !== "—" ? plate : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Route summary"}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="min-w-0 space-y-6 lg:col-span-5 lg:border-l lg:border-slate-100 lg:pl-8 dark:lg:border-[#1e2638]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-[#1e2638]">
            <span className="h-4 w-1 rounded-full bg-emerald-500" />
            <h4 className="text-xs font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
              Financial Details
            </h4>
          </div>
          <div className="min-w-0 space-y-1 overflow-x-auto">
            {E("Agency Cost", fmtCurrency(trip.agencyCost), "agencyCost")}
            {E("Cab Cost", fmtCurrency(trip.cabCost), "cabCost")}
            <DetailRow
              label="Fuel expense"
              value={fmtCurrency(expenseBreakdown.fuelExpense)}
              emphasizeValue
            />
            <DetailRow
              label="Extra Expenses"
              value={fmtCurrency(expenseBreakdown.extraExpenses)}
              emphasizeValue
            />
            <div className="my-1.5 flex items-baseline justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-[#1e2638] dark:bg-white/[0.04]">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Total Cab Cost
              </span>
              <span className="text-base font-bold tabular-nums text-indigo-600 dark:text-indigo-300">
                {fmtCurrency(expenseBreakdown.totalCabCost)}
              </span>
            </div>
            {E(
              "Driver Bata",
              fmtCurrency(salaryBreakdown.driverBata),
              "driver_salary",
            )}
            <DetailRow
              label="Extra personal expenses"
              value={fmtCurrency(salaryBreakdown.personalExpenses)}
              emphasizeValue
            />
            <div className="my-1.5 flex flex-col gap-0.5 rounded-lg border border-indigo-200/80 bg-indigo-50/50 px-2.5 py-2 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                  Total Salary
                </span>
                <span className="text-base font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                  {fmtCurrency(salaryBreakdown.totalSalary)}
                </span>
              </div>
              <span className="text-[11px] font-medium text-indigo-600/80 dark:text-indigo-400">
                {salaryBreakdown.bracketText}
              </span>
            </div>
            {E("Advance", fmtCurrency(trip.advance), "advance")}
            <div className="my-1.5 flex items-baseline justify-between gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-2 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Owner profit
              </span>
              <span className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {fmtCurrency(resolveTripAgencyProfitDisplay(trip))}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={() => setDetailOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDetailOpen(true);
          }
        }}
        className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[var(--bg-card)] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-[#1e2638] dark:hover:border-indigo-500/40"
      >
        <div
          className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${paymentAccentClass(cashIn.status, cashIn.remaining)}`}
          aria-hidden
        />

        <div className="flex flex-1 flex-col gap-3 p-4 pl-5 sm:p-4 sm:pl-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate font-mono text-sm font-bold tracking-tight text-slate-900 tabular-nums dark:text-slate-100">
                  {trip.tripNumber ?? trip._id}
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${getTripStatusStyle(trip.status)}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${tripStatusDotClass(trip.status)}`}
                  />
                  {trip.status?.replace(/_/g, " ")}
                </span>
                <span
                  className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${cashInStatusBadgeClass(cashIn.status)}`}
                >
                  {cashInStatusLabel(cashIn.status)}
                </span>
              </div>

              {routeFrom && routeTo ? (
                <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <span className="truncate">{routeFrom}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                  <span className="truncate">{routeTo}</span>
                </p>
              ) : (
                <p className="text-sm text-slate-400">No route set</p>
              )}
              {agencyLabel && agencyLabel !== "—" && (
                <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="truncate">{agencyLabel}</span>
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  disabled={deleting}
                  className="rounded-lg p-1.5 text-slate-400 opacity-70 transition hover:bg-rose-50 hover:text-rose-500 hover:opacity-100 disabled:opacity-40 group-hover:opacity-100 dark:hover:bg-rose-500/10"
                  aria-label="Delete trip"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <span
                className="rounded-lg p-1.5 text-slate-400 transition group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:group-hover:bg-indigo-500/15 dark:group-hover:text-indigo-300"
                aria-hidden
              >
                <Maximize2 className="h-4 w-4" />
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-100 bg-slate-50/80 p-2 dark:border-[#1e2638] dark:bg-white/[0.03]">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                Agency cost
              </p>
              <p className="truncate text-xs font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {fmtCurrency(trip.agencyCost)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                Cab cost
              </p>
              <p className="truncate text-xs font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {fmtCurrency(trip.cabCost)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-600/80 dark:text-emerald-400/80">
                Agency profit
              </p>
              <p className="truncate text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {fmtCurrency(agencyProfit)}
              </p>
            </div>
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={openPayments}
              className="inline-flex w-fit items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
            >
              <Wallet className="h-3 w-3" />
              Payments
            </button>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 text-[11px] dark:border-[#1e2638]">
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-semibold tabular-nums text-slate-700 dark:border-[#1e2638] dark:bg-white/[0.04] dark:text-slate-200">
              <Calendar className="h-3 w-3 text-slate-400" />
              {fmtDate(trip.startDate ?? trip.date)}
            </span>
            {durationLabel && durationLabel !== "—" && (
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600 dark:border-[#1e2638] dark:bg-white/[0.04] dark:text-slate-300">
                <Clock className="h-3 w-3" />
                {durationLabel}
              </span>
            )}
            <span className="inline-flex max-w-[46%] items-center gap-1 truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-700 dark:border-[#1e2638] dark:bg-white/[0.04] dark:text-slate-200">
              <User className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="truncate">{driverName(trip.driver)}</span>
            </span>
            {plate !== "—" && (
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] font-semibold tracking-wide text-slate-700 dark:border-[#1e2638] dark:bg-white/[0.04] dark:text-slate-200">
                <Car className="h-3 w-3 text-slate-400" />
                {plate}
              </span>
            )}
            {travelledKm != null && (
              <span className="ml-auto font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {travelledKm} km
              </span>
            )}
          </div>
        </div>
      </article>

      {detailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4 dark:bg-black/60"
          onClick={() => setDetailOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Trip ${trip.tripNumber ?? trip._id}`}
            className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-[var(--bg-card)] shadow-2xl sm:max-w-4xl sm:rounded-2xl dark:border-[#1e2638]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5 dark:border-[#1e2638]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-mono text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                    {trip.tripNumber ?? trip._id}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${getTripStatusStyle(trip.status)}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${tripStatusDotClass(trip.status)}`}
                    />
                    {trip.status?.replace(/_/g, " ")}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${cashInStatusBadgeClass(cashIn.status)}`}
                  >
                    {cashInStatusLabel(cashIn.status)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {[
                    routeFrom && routeTo ? `${routeFrom} → ${routeTo}` : null,
                    fmtDate(trip.startDate ?? trip.date),
                    driverName(trip.driver) !== "—"
                      ? driverName(trip.driver)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setPayOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Payments
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDetailOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              {detailBody}
            </div>
          </div>
        </div>
      )}

      {payOpen && (
        <TripCashInModal
          trip={{
            _id: trip._id,
            tripNumber: trip.tripNumber,
            from: trip.from,
            to: trip.to,
            pickup: trip.pickup,
            drop: trip.drop,
            agencyName: trip.agencyName,
            agencyCost: trip.agencyCost,
            agencyProfit,
            cashInSummary: trip.cashInSummary,
          }}
          resolveAgencyLabel={
            resolveAgencyLabel ?? ((n) => n?.trim() || "—")
          }
          onClose={() => setPayOpen(false)}
          onSuccess={() => {
            void handleCashInSuccess();
          }}
        />
      )}
    </>
  );
}
