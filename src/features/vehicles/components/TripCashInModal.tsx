import { useEffect, useState, useRef } from "react";
import { Loader2, Wallet, X } from "lucide-react";
import { DatePicker } from "../../../components/ui/DatePicker";
import {
  fetchTripCashInPayments,
  recordTripCashIn,
  type TripCashInPayment,
} from "../api";

export const TRIP_CASH_IN_METHODS = [
  "cash",
  "bank_transfer",
  "cheque",
  "online",
  "upi",
  "other",
] as const;

export interface TripCashInModalTrip {
  _id: string;
  tripNumber?: string;
  from?: string;
  to?: string;
  pickup?: string;
  drop?: string;
  agencyName?: string;
  agencyProfit?: number | string;
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30";

function formatDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export function TripCashInModal({
  trip,
  resolveAgencyLabel,
  onClose,
  onSuccess,
}: {
  trip: TripCashInModalTrip;
  resolveAgencyLabel: (agencyName?: string) => string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const totalDue = Math.max(0, Math.round(Number(trip.agencyProfit) || 0));
  const route = [trip.from ?? trip.pickup, trip.to ?? trip.drop]
    .filter(Boolean)
    .join(" → ");
  const tripLabel = trip.tripNumber ? `Trip ${trip.tripNumber}` : "Vehicle trip";
  const defaultNotes = ["Cash in", tripLabel, route].filter(Boolean).join(" · ");

  const [amount, setAmount] = useState("");
  const [amountReady, setAmountReady] = useState(false);
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
  const [history, setHistory] = useState<TripCashInPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHistoryLoading(true);
      setAmountReady(false);
      try {
        const rows = await fetchTripCashInPayments(trip._id);
        if (cancelled) return;
        setHistory(rows);
        const paid = rows.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const remaining = Math.max(0, Math.round(totalDue - paid));
        setAmount(remaining > 0 ? String(remaining) : "");
        setAmountReady(true);
      } catch {
        if (cancelled) return;
        setHistory([]);
        setAmount(totalDue > 0 ? String(totalDue) : "");
        setAmountReady(true);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trip._id, totalDue]);

  const paidTotal = history.reduce(
    (s, p) => s + (Number(p.amount) || 0),
    0,
  );
  const remainingTotal = Math.max(0, Math.round(totalDue - paidTotal));

  const fmtInr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  const submit = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a valid amount greater than 0");
      return;
    }
    if (!String(trip.agencyName || "").trim()) {
      setError("This trip has no agency. Set an agency before marking cash in.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await recordTripCashIn(trip._id, {
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
              {tripLabel}
            </div>
            <div className="mt-1 text-slate-600 dark:text-slate-400">
              {route || "—"}
            </div>
            <div className="mt-1 text-slate-600 dark:text-slate-400">
              Agency: {resolveAgencyLabel(trip.agencyName) || trip.agencyName || "—"}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-2.5 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                Total
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {fmtInr(totalDue)}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Paid
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {historyLoading ? "…" : fmtInr(paidTotal)}
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Remaining
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {historyLoading ? "…" : fmtInr(remainingTotal)}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="trip-cashin-amount"
              className="text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Amount (₹)<span className="ml-0.5 text-red-500">*</span>
            </label>
            <input
              id="trip-cashin-amount"
              type="number"
              min={0}
              step="1"
              className={inputCls}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!amountReady}
              placeholder={historyLoading ? "Loading…" : "0"}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="trip-cashin-date"
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
              htmlFor="trip-cashin-method"
              className="text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Method
            </label>
            <select
              id="trip-cashin-method"
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
              htmlFor="trip-cashin-notes"
              className="text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Notes
            </label>
            <input
              id="trip-cashin-notes"
              className={inputCls}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cash in · trip details"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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

          <div className="border-t border-slate-100 pt-3 dark:border-white/10">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Cash in for this trip
              </span>
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                {fmtInr(paidTotal)}
              </span>
            </div>
            {historyLoading ? (
              <p className="mt-2 text-xs text-slate-400">Loading…</p>
            ) : history.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">No cash in recorded yet.</p>
            ) : (
              <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
                {history.map((p) => (
                  <li
                    key={p._id}
                    className="rounded-lg border border-slate-100 px-2.5 py-1.5 text-[11px] dark:border-white/10"
                  >
                    <div className="flex justify-between gap-2 font-medium text-slate-800 dark:text-slate-200">
                      <span>
                        ₹{Math.round(Number(p.amount) || 0).toLocaleString("en-IN")}
                      </span>
                      <span className="text-slate-500">
                        {formatDate(p.paymentDate ?? undefined)}
                      </span>
                    </div>
                    {p.notes ? (
                      <div className="mt-0.5 truncate text-slate-500">{p.notes}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
