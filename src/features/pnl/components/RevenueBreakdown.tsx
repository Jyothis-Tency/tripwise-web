import React, { useCallback, useEffect, useState } from "react";
import {
  Wallet,
  Briefcase,
  Truck,
  Plus,
  History,
  Loader2,
  X,
  BadgePercent,
} from "lucide-react";
import type { PLRevenue, PLSummary, ExtraCommissionEntry } from "../api";
import { addExtraCommission, fetchExtraCommissions } from "../api";

interface RevenueBreakdownProps {
  revenue: PLRevenue;
  summary?: PLSummary;
  onRefresh?: () => void | Promise<void>;
}

function fmtCurrency(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  return x.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ModalShell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
          <h3 className="text-sm font-bold text-slate-900 sm:text-base">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

export const RevenueBreakdown: React.FC<RevenueBreakdownProps> = ({
  revenue,
  summary,
  onRefresh,
}) => {
  const commission =
    revenue.commission ||
    revenue.commissionRevenue ||
    revenue.ownerRevenue ||
    0;
  const tripRevenue = revenue.tripRevenue ?? revenue.billedRevenue ?? 0;
  const extraCommission = Number(revenue.extraCommission) || 0;

  const [modal, setModal] = useState<"add" | "history" | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [history, setHistory] = useState<ExtraCommissionEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const rows = await fetchExtraCommissions();
      setHistory(rows);
    } catch {
      setHistory([]);
      setHistoryError("Could not load extra commission history.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (modal === "history") loadHistory();
  }, [modal, loadHistory]);

  const openAdd = () => {
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setSaveError(null);
    setModal("add");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setSaveError("Enter an amount greater than 0.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await addExtraCommission({
        amount: n,
        paymentDate: date || undefined,
        notes: notes.trim() || undefined,
      });
      setModal(null);
      await onRefresh?.();
    } catch (err: any) {
      setSaveError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to add extra commission.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue Card */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-blue-100 bg-blue-600 p-5 shadow-md sm:p-6 md:col-span-2 lg:col-span-1">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-blue-500/50 blur-2xl" />

          <div className="relative z-10 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/20 text-white shadow-inner backdrop-blur-sm sm:h-14 sm:w-14">
              <Wallet className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div>
              <p className="text-xs font-medium text-blue-100 sm:text-sm">
                Total Revenue
              </p>
              <h3 className="mt-0.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {fmtCurrency(revenue.total)}
              </h3>
              <p className="mt-1 text-[11px] text-blue-200 sm:text-xs">
                Combined revenue from all sources
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-6 border-t border-white/20 pt-4">
            <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/60 sm:text-[11px]">
              Additional Metrics
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-200 sm:text-[11px]">
                  Driver Salary
                </p>
                <p className="mt-0.5 text-sm font-bold text-white sm:text-base">
                  {fmtCurrency(revenue.driverSalary || 0)}
                </p>
              </div>
              {summary && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-200 sm:text-[11px]">
                    Avg / Trip
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-white sm:text-base">
                    {fmtCurrency(summary.avgRevenuePerTrip || 0)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Commission Profit */}
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm transition-all hover:shadow-md sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:h-12 sm:w-12">
              <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 sm:text-sm">
                Commission Profit
              </p>
              <h3 className="text-lg font-bold text-slate-900 sm:text-xl">
                {fmtCurrency(commission)}
              </h3>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Bulk entries &amp; agencies
            {extraCommission > 0
              ? ` · includes ${fmtCurrency(extraCommission)} extra`
              : ""}
          </p>
        </div>

        {/* Trip Revenue */}
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition-all hover:shadow-md sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 sm:h-12 sm:w-12">
              <Truck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 sm:text-sm">
                Trip Revenue
              </p>
              <h3 className="text-lg font-bold text-slate-900 sm:text-xl">
                {fmtCurrency(tripRevenue)}
              </h3>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400">From owner&apos;s own trips</p>
        </div>

        {/* Extra Commission */}
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm transition-all hover:shadow-md sm:p-6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 sm:h-12 sm:w-12">
                <BadgePercent className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 sm:text-sm">
                  Extra Commission
                </p>
                <h3 className="text-lg font-bold text-slate-900 sm:text-xl">
                  {fmtCurrency(extraCommission)}
                </h3>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={openAdd}
                title="Add extra commission"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 text-white hover:bg-amber-700"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setModal("history")}
                title="Extra commission history"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <History className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Manual add-ins · included in Commission Profit &amp; Total Revenue
          </p>
        </div>
      </div>

      {modal === "add" && (
        <ModalShell title="Add Extra Commission" onClose={() => setModal(null)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Amount (₹)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                placeholder="0"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                placeholder="Reason for extra commission…"
              />
            </div>
            {saveError && (
              <p className="text-xs font-medium text-rose-600">{saveError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Add
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal === "history" && (
        <ModalShell
          title="Extra Commission History"
          onClose={() => setModal(null)}
          wide
        >
          {historyLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : historyError ? (
            <p className="py-6 text-center text-sm text-rose-600">
              {historyError}
            </p>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No extra commission add-ins yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Notes</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((row) => (
                    <tr key={row._id} className="bg-white">
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        {formatDate(row.paymentDate)}
                      </td>
                      <td className="max-w-[280px] truncate px-3 py-2.5 text-slate-500">
                        {row.notes || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                        {fmtCurrency(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ModalShell>
      )}
    </div>
  );
};
