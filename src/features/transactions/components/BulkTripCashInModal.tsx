import { useState, useRef } from "react";
import { Loader2, Wallet, X } from "lucide-react";
import { DatePicker } from "../../../components/ui/DatePicker";
import { recordAgencyProfitPayout } from "../../cash-in-cash-out/api";
import type { AgencyTrip } from "../../bulk-entry/api";
import { TRIP_CASH_IN_METHODS } from "../../vehicles/components/TripCashInModal";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30";

const fmtInr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function BulkTripCashInModal({
  agencyId,
  agencyName,
  bulkTrips,
  targetTrip,
  resolveAgencyLabel,
  onClose,
  onSuccess,
}: {
  agencyId: string;
  agencyName?: string;
  bulkTrips: AgencyTrip[];
  targetTrip?: AgencyTrip | null;
  resolveAgencyLabel?: (agencyName?: string) => string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);

  const tripsToCalculate = targetTrip ? [targetTrip] : bulkTrips;
  const totalGrand = tripsToCalculate.reduce(
    (s, t) => s + (Number(t.grandTotal) || 0),
    0,
  );
  // In the payments section of bulk trips of an agency, we only treat grand total.
  // Advance is driver advance, not collected payment from the agency.
  const paidTotal = 0;
  const remainingTotal = Math.max(0, Math.round(totalGrand - paidTotal));

  const first = tripsToCalculate[0];
  const driverName = first?.driverName?.trim() || "Driver";
  const vehicleNumber = first?.vehicleNumber?.trim() || "Vehicle";
  const label = targetTrip
    ? `Bulk Trip · ${driverName} (${vehicleNumber})`
    : `Bulk Entry · ${driverName} (${vehicleNumber}) · ${bulkTrips.length} trip${bulkTrips.length > 1 ? "s" : ""}`;

  const resolvedAgencyText =
    resolveAgencyLabel?.(agencyName) || agencyName || "";

  const defaultNotes = [
    "Cash in",
    label,
    resolvedAgencyText ? `Agency: ${resolvedAgencyText}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const [amount, setAmount] = useState(
    remainingTotal > 0 ? String(remainingTotal) : "",
  );
  const [paymentDate, setPaymentDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof TRIP_CASH_IN_METHODS)[number]>("cash");
  const [notes, setNotes] = useState(defaultNotes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a valid amount greater than 0");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Record agency cash-in payment so it reflects in the agency ledger
      await recordAgencyProfitPayout(agencyId, {
        amount: n,
        paymentDate: paymentDate || undefined,
        paymentMethod,
        notes: notes.trim() || defaultNotes,
      });

      onSuccess();
    } catch (e: any) {
      setError(
        e?.response?.data?.message ?? e?.message ?? "Failed to mark cash in",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 dark:bg-black/60"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md flex max-h-[90vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#1e2638] dark:bg-[#0e121d]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/10">
          <h2 className="text-base font-semibold text-slate-800 dark:text-white">
            Payments · Cash in
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 px-6 py-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-white/10 dark:bg-white/5">
            <div className="font-semibold text-slate-900 dark:text-white">
              {label}
            </div>
            {resolvedAgencyText ? (
              <div className="mt-1 text-slate-600 dark:text-slate-400">
                Agency: {resolvedAgencyText}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-2.5 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                Total
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {fmtInr(totalGrand)}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Paid
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {fmtInr(paidTotal)}
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Remaining
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {fmtInr(remainingTotal)}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="bulk-cashin-amount"
              className="text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Amount (₹)<span className="ml-0.5 text-red-500">*</span>
            </label>
            <input
              id="bulk-cashin-amount"
              type="number"
              min={0}
              step="1"
              className={inputCls}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="bulk-cashin-date"
              className="text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Date
            </label>
            <DatePicker
              value={paymentDate}
              onChange={setPaymentDate}
              className={inputCls}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="bulk-cashin-method"
              className="text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Method
            </label>
            <select
              id="bulk-cashin-method"
              className={inputCls}
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(
                  e.target.value as (typeof TRIP_CASH_IN_METHODS)[number],
                )
              }
            >
              {TRIP_CASH_IN_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="bulk-cashin-notes"
              className="text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Notes
            </label>
            <input
              id="bulk-cashin-notes"
              className={inputCls}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cash in · trip details"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              Mark cash in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
