import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Car,
  User,
  Calendar,
  DollarSign,
  Clock,
  Pencil,
  Check,
  X,
  ArrowRight,
  Route,
} from "lucide-react";
import type {
  HistoryTrip,
  TripPayment,
  RecordPaymentTripSummary,
} from "../api";
import {
  recordPayment,
  deleteTrip,
  fetchPaymentHistory,
  updateTripFields,
} from "../api";
import { PaymentHistoryModal } from "./PaymentHistoryModal";
import {
  fmtTimeAmPm,
  isoToTimeInputInTz,
  fmtTripDuration,
} from "../historyTimeUtils";
import { TimePicker12h } from "../../../components/ui/TimePicker12h";
import { normalizeHHmm } from "../../../lib/timePickerUtils";
import {
  getHistoryTripExpenseBreakdown,
  resolveTripAgencyProfitDisplay,
} from "../tripExpenseBreakdown";

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

function getPaymentStatus(trip: HistoryTrip): {
  label: string;
  color: string;
  bg: string;
} {
  const ps = trip.paymentSummary?.paymentStatus;
  if (ps === "paid")
    return {
      label: "Paid",
      color: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/15 dark:border-emerald-500/30",
    };
  if (ps === "partial")
    return {
      label: "Partial",
      color: "text-amber-700 dark:text-amber-300",
      bg: "bg-amber-50 border-amber-200 dark:bg-amber-500/15 dark:border-amber-500/30",
    };
  return {
    label: "Unpaid",
    color: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 border-rose-200 dark:bg-rose-500/15 dark:border-rose-500/30",
  };
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

function paymentAccentClass(remaining: number, paid: boolean): string {
  if (paid || remaining <= 1e-6) return "from-emerald-500 to-emerald-400";
  if (remaining < -1e-6) return "from-indigo-500 to-indigo-400";
  return "from-amber-500 to-amber-400";
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

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({
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
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
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
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
  defaultExpanded?: boolean;
  onDeleted?: () => void;
  /** Called with server summary after a payment; parent can patch list without refetching. */
  onPaymentRecorded?: (
    tripId: string,
    summary: RecordPaymentTripSummary,
  ) => void;
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

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [payments, setPayments] = useState<TripPayment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const paymentBadge = getPaymentStatus(trip);
  const totalAmount =
    trip.paymentSummary?.totalAmount ?? (Number(trip.agencyCost) || 0);
  const paidAmount = trip.paymentSummary?.paidAmount ?? trip.paidAmount ?? 0;
  const remaining =
    trip.paymentSummary?.remainingBalance ?? totalAmount - paidAmount;
  const progress =
    totalAmount > 0 ? Math.min((paidAmount / totalAmount) * 100, 100) : 0;

  const travelledKm =
    trip.startKilometers != null && trip.endKilometers != null
      ? trip.endKilometers - trip.startKilometers
      : null;

  const remainingHeaderShort = remaining < -1e-6 ? "Overpaid" : "Remaining";
  const isPaidSettled = remaining <= 1e-6 && remaining >= -1e-6 && paidAmount > 0;
  const routeFrom = trip.from ?? trip.pickup;
  const routeTo = trip.to ?? trip.drop;
  const durationLabel = fmtTripDuration(trip.startTime, trip.endTime);
  const plate = vehicleNum(trip.vehicle);

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

  const handleOpenHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await fetchPaymentHistory(trip._id);
      setPayments(data.payments);
      setShowHistoryModal(true);
    } catch {
      alert("Failed to load payment history");
    } finally {
      setLoadingHistory(false);
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

  return (
    <>
      <div
        className={`group relative overflow-hidden rounded-xl border bg-[var(--bg-card)] shadow-sm transition-all duration-200 dark:border-[#1e2638] ${
          expanded
            ? "border-indigo-400/50 shadow-md dark:border-indigo-500/40"
            : "border-slate-200 hover:border-slate-300 hover:shadow-md dark:hover:border-slate-600"
        }`}
      >
        <div
          className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${paymentAccentClass(remaining, isPaidSettled)}`}
          aria-hidden
        />

        {/* Header */}
        <div
          className="flex cursor-pointer items-start gap-3 px-4 py-3.5 transition hover:bg-slate-50/70 sm:gap-4 sm:px-5 sm:py-4 dark:hover:bg-white/[0.03]"
          onClick={() => setExpanded((e) => !e)}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-mono text-base font-bold tracking-tight text-slate-900 tabular-nums sm:text-lg dark:text-slate-100">
                {trip.tripNumber ?? trip._id}
              </span>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase sm:text-[11px] ${getTripStatusStyle(trip.status)}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${tripStatusDotClass(trip.status)}`}
                />
                {trip.status?.replace(/_/g, " ")}
              </span>
              {durationLabel && durationLabel !== "—" && (
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-[#1e2638] dark:bg-white/[0.04] dark:text-slate-300">
                  <Clock className="h-3 w-3" />
                  {durationLabel}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-600 dark:text-slate-400">
              {routeFrom && routeTo && (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                  <span className="truncate">{routeFrom}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                  <span className="truncate">{routeTo}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                {fmtDate(trip.startDate ?? trip.date)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {driverName(trip.driver)}
                </span>
              </span>
              {plate !== "—" && (
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-slate-700 dark:border-[#1e2638] dark:bg-white/[0.04] dark:text-slate-200">
                  <Car className="h-3 w-3 text-slate-400" />
                  {plate}
                </span>
              )}
              {travelledKm != null && (
                <span className="font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  {travelledKm} km
                </span>
              )}
            </div>

            {/* Compact payment progress — beyond Stitch */}
            <div className="flex max-w-xs items-center gap-2 pt-0.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background:
                      progress >= 100
                        ? "linear-gradient(90deg, #10b981, #059669)"
                        : progress > 0
                          ? "linear-gradient(90deg, #f59e0b, #d97706)"
                          : "#f43f5e",
                  }}
                />
              </div>
              <span className="shrink-0 text-[10px] font-semibold tabular-nums text-slate-400">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-2 sm:gap-3">
            <div className="hidden min-w-0 flex-col items-end gap-1 sm:flex">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 dark:border-[#1e2638] dark:bg-white/[0.04]">
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${paymentBadge.bg} ${paymentBadge.color}`}
                >
                  {paymentBadge.label}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {remainingHeaderShort}
                </span>
                <span
                  className={`text-xs font-bold tabular-nums ${
                    remaining < -1e-6
                      ? "text-indigo-600 dark:text-indigo-300"
                      : remaining > 1e-6
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {fmtCurrency(remaining)}
                </span>
              </div>
            </div>

            {/* Mobile payment chip */}
            <div className="flex flex-col items-end gap-1 sm:hidden">
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${paymentBadge.bg} ${paymentBadge.color}`}
              >
                {paymentBadge.label}
              </span>
              <span
                className={`text-[11px] font-bold tabular-nums ${
                  remaining > 1e-6
                    ? "text-amber-700 dark:text-amber-300"
                    : remaining < -1e-6
                      ? "text-indigo-600 dark:text-indigo-300"
                      : "text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {fmtCurrency(remaining)}
              </span>
            </div>

            <div className="flex flex-col items-end gap-1">
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  disabled={deleting}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40 dark:hover:bg-rose-500/10"
                  aria-label="Delete trip"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
                aria-expanded={expanded}
                aria-label={expanded ? "Collapse trip" : "Expand trip"}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((x) => !x);
                }}
              >
                {expanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-slate-100 px-4 py-4 sm:px-5 sm:py-5 dark:border-[#1e2638]">
            <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-12 xl:gap-8">
              {/* Trip Details */}
              <section className="min-w-0 xl:col-span-7">
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
                  {typeof trip.vehicle !== "string" &&
                    trip.vehicle?.vehicleType && (
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
                    trip.startKilometers != null
                      ? `${trip.startKilometers}`
                      : "—",
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

              <div className="min-w-0 space-y-6 xl:col-span-5 xl:border-l xl:border-slate-100 xl:pl-8 dark:xl:border-[#1e2638]">
                {/* Financial */}
                <section className="min-w-0">
                  <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-[#1e2638]">
                    <span className="h-4 w-1 rounded-full bg-emerald-500" />
                    <h4 className="text-xs font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                      Financial Details
                    </h4>
                  </div>
                  <div className="min-w-0 space-y-1 overflow-x-auto">
                    {E(
                      "Agency Cost",
                      fmtCurrency(trip.agencyCost),
                      "agencyCost",
                    )}
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
                      "Driver Salary",
                      fmtCurrency(trip.driver_salary),
                      "driver_salary",
                    )}
                    {E("Advance", fmtCurrency(trip.advance), "advance")}
                    <div className="my-1.5 flex items-baseline justify-between gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-2 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        Agency profit
                      </span>
                      <span className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {fmtCurrency(resolveTripAgencyProfitDisplay(trip))}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Payment */}
                <section>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-[#1e2638]">
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-1 rounded-full bg-amber-500" />
                      <h4 className="text-xs font-bold tracking-wider text-amber-600 uppercase dark:text-amber-400">
                        Payment Status
                      </h4>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 dark:border-[#1e2638] dark:bg-white/[0.04]">
                      <span
                        className={`rounded border px-1.5 py-0 text-[10px] font-bold ${paymentBadge.bg} ${paymentBadge.color}`}
                      >
                        {paymentBadge.label}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {remainingHeaderShort}:
                      </span>
                      <span
                        className={`text-xs font-bold tabular-nums ${
                          remaining > 1e-6
                            ? "text-amber-700 dark:text-amber-300"
                            : remaining < -1e-6
                              ? "text-indigo-600 dark:text-indigo-300"
                              : "text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {fmtCurrency(remaining)}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                        background:
                          progress >= 100
                            ? "linear-gradient(90deg, #10b981, #059669)"
                            : progress > 0
                              ? "linear-gradient(90deg, #f59e0b, #d97706)"
                              : "#f43f5e",
                      }}
                    />
                  </div>

                  <div className="mb-3 space-y-2 rounded-lg border border-slate-200 bg-[var(--bg-elevated)] p-3.5 dark:border-[#1e2638]">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Total Amount
                      </span>
                      <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                        {fmtCurrency(totalAmount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Paid Amount
                      </span>
                      <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {fmtCurrency(paidAmount)}
                      </span>
                    </div>
                    <div className="my-1 h-px bg-slate-200 dark:bg-[#1e2638]" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {remaining < -1e-6 ? "Overpaid (credit)" : "Remaining"}
                      </span>
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          remaining > 1e-6
                            ? "text-amber-700 dark:text-amber-300"
                            : remaining < -1e-6
                              ? "text-indigo-600 dark:text-indigo-300"
                              : "text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {fmtCurrency(remaining)}
                      </span>
                    </div>
                  </div>

                  {!readOnly && (
                    <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(true)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] dark:bg-indigo-500 dark:hover:bg-indigo-400"
                      >
                        <DollarSign className="h-4 w-4" /> Record Payment
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenHistory}
                        disabled={loadingHistory}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-[var(--bg-elevated)] py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#1e2638] dark:text-slate-200 dark:hover:bg-white/5"
                      >
                        {loadingHistory ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                        ) : (
                          <Clock className="h-4 w-4 text-slate-400" />
                        )}
                        Payment History
                      </button>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}
      </div>

      {!readOnly && showPaymentModal && (
        <RecordPaymentModal
          trip={trip}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={(summary) => {
            setShowPaymentModal(false);
            const ps = summary.paymentStatus;
            const paymentStatus =
              ps === "paid" || ps === "partial" || ps === "unpaid"
                ? ps
                : "unpaid";
            setTrip((prev) => ({
              ...prev,
              paidAmount: summary.paidAmount,
              paymentSummary: {
                ...prev.paymentSummary,
                totalAmount: summary.totalAmount,
                paidAmount: summary.paidAmount,
                remainingBalance: summary.remainingBalance,
                paymentStatus,
              },
            }));
            onPaymentRecorded?.(trip._id, summary);
          }}
        />
      )}

      {!readOnly && showHistoryModal && (
        <PaymentHistoryModal
          tripNumber={trip.tripNumber || trip._id}
          payments={payments}
          summary={{
            totalAmount: trip.paymentSummary?.totalAmount ?? 0,
            totalPaid: trip.paymentSummary?.paidAmount ?? 0,
            remainingBalance: trip.paymentSummary?.remainingBalance ?? 0,
            paymentStatus: trip.paymentSummary?.paymentStatus ?? "unpaid",
          }}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </>
  );
}
