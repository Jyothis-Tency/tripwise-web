import React, { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  Plus,
  History,
  Loader2,
  X,
  BadgePercent,
  Coins,
} from "lucide-react";
import type { PLRevenue, ExtraCommissionEntry } from "../api";
import { addExtraCommission, fetchExtraCommissions } from "../api";
import { DatePicker } from "../../../components/ui/DatePicker";
import { fetchAllAgencies } from "../../bulk-entry/api";
import { fetchCashInCashOutAgencyDetail } from "../../cash-in-cash-out/api";
import {
  aggregateAgencyLedgerFromSummaries,
  type AggregatedAgencyLedger,
  type AgencyCashInSummary,
  type AgencyCashOutSummary,
} from "../../transactions/agencyLedgerMetrics";
import { sumVehicleAgencyCost } from "../../transactions/vehicleAgencyLedgerMargin";

interface RevenueBreakdownProps {
  revenue: PLRevenue;
  onRefresh?: () => void | Promise<void>;
}

function fmtCurrency(n: number) {
  return `₹${Math.abs(n).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function fmtSignedCurrency(n: number) {
  const sign = n < 0 ? "−" : n > 0 ? "+" : "";
  return `${sign}${fmtCurrency(n)}`;
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4 dark:bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl dark:border-[#1e2638] dark:bg-[#0e121d] ${
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 dark:border-white/10">
          <h3 className="text-sm font-bold text-slate-900 sm:text-base dark:text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
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

const cardBase =
  "rounded-2xl border bg-white p-5 shadow-subtle transition-all hover:shadow-float sm:p-6 dark:bg-[#0e121d]/80 dark:backdrop-blur-xl";

export const RevenueBreakdown: React.FC<RevenueBreakdownProps> = ({
  revenue,
  onRefresh,
}) => {
  const extraCommission = Number(revenue.extraCommission) || 0;
  const commissionRevenue =
    revenue.commissionFromBulk ??
    Math.max(
      0,
      (revenue.commission ||
        revenue.commissionRevenue ||
        revenue.ownerRevenue ||
        0) - extraCommission,
    );
  const totalCommission = commissionRevenue + extraCommission;

  const [agencyLedger, setAgencyLedger] =
    useState<AggregatedAgencyLedger | null>(null);
  const [agencyLedgerLoading, setAgencyLedgerLoading] = useState(true);

  const [modal, setModal] = useState<"add" | "history" | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [history, setHistory] = useState<ExtraCommissionEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadAgencyLedger = useCallback(async () => {
    setAgencyLedgerLoading(true);
    try {
      const { agencies } = await fetchAllAgencies();
      const details = await Promise.all(
        agencies.map(async (a) => {
          const id = a._id ?? a.id;
          if (!id) return null;
          try {
            const detail = await fetchCashInCashOutAgencyDetail(id, "all_time");
            // Match Transaction History: vehicle portion = agency cost, not profit.
            const vehicleAgencyCost =
              Number(detail.summary.agencyCostFromVehicleTrips) ||
              sumVehicleAgencyCost(
                detail.tables?.vehicleTripsAgencyProfit ?? [],
              );
            return {
              ...detail.summary,
              vehicleAgencyCostFromTrips: vehicleAgencyCost,
            };
          } catch {
            return null;
          }
        }),
      );
      const summaries = details.filter(Boolean) as {
        cashInBulk?: AgencyCashInSummary;
        cashOutAgencyProfit?: AgencyCashOutSummary;
        vehicleAgencyCostFromTrips?: number;
      }[];
      setAgencyLedger(aggregateAgencyLedgerFromSummaries(summaries));
    } catch {
      setAgencyLedger(null);
    } finally {
      setAgencyLedgerLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAgencyLedger();
  }, [loadAgencyLedger, revenue]);

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
      await loadAgencyLedger();
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

  const receivedPct =
    agencyLedger && agencyLedger.grandTotal
      ? Math.min(
          100,
          Math.round(
            (agencyLedger.received / Math.abs(agencyLedger.grandTotal)) * 100,
          ),
        )
      : 0;

  const fieldCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100";

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Row 1 — agency ledger (matches Transaction History agency KPIs, all agencies) */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="rounded-[18px] bg-gradient-to-br from-indigo-900 to-violet-700 px-5 py-[18px] text-white">
          <span className="block text-[13px] font-bold">Grand total</span>
          <small className="text-xs text-white/75">
            {agencyLedgerLoading
              ? "Loading agencies…"
              : agencyLedger
                ? `All time · ${agencyLedger.agencyCount} agencies · Bulk +${fmtCurrency(agencyLedger.bulkTotal)}${
                    agencyLedger.ownerProfitFromVehicles > 0
                      ? ` · Vehicle +${fmtCurrency(agencyLedger.ownerProfitFromVehicles)}`
                      : ""
                  }`
                : "All time · Could not load agency totals"}
          </small>
          <b className="mt-2 block text-[28px] font-extrabold tracking-tight">
            {agencyLedgerLoading ? (
              <Loader2 className="h-7 w-7 animate-spin opacity-80" />
            ) : agencyLedger ? (
              fmtSignedCurrency(agencyLedger.grandTotal)
            ) : (
              "—"
            )}
          </b>
        </div>

        <div className="rounded-[18px] border border-slate-200 bg-[var(--bg-card)] px-5 py-[18px] dark:border-[#252c4d]">
          <span className="block text-[13px] font-bold text-slate-800 dark:text-[#eef0ff]">
            Total paid
          </span>
          <small className="text-xs text-slate-500 dark:text-[#8d94b8]">
            All time · Cash in from agencies
          </small>
          <b className="mt-2 block text-[28px] font-extrabold tracking-tight text-emerald-600 dark:text-[#34d399]">
            {agencyLedgerLoading ? (
              <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
            ) : agencyLedger ? (
              fmtCurrency(agencyLedger.received)
            ) : (
              "—"
            )}
          </b>
          {!agencyLedgerLoading && agencyLedger && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-[#252c4d]">
              <div
                className="h-full min-w-[3px] rounded-full bg-emerald-500"
                style={{ width: `${receivedPct}%` }}
              />
            </div>
          )}
        </div>

        <div className="rounded-[18px] border border-slate-200 bg-[var(--bg-card)] px-5 py-[18px] dark:border-[#252c4d]">
          <span className="block text-[13px] font-bold text-slate-800 dark:text-[#eef0ff]">
            Total remaining
          </span>
          <small className="text-xs text-slate-500 dark:text-[#8d94b8]">
            All time · Still to settle (can be negative)
          </small>
          <b className="mt-2 block text-[28px] font-extrabold tracking-tight text-indigo-600 dark:text-[#a5b4fc]">
            {agencyLedgerLoading ? (
              <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
            ) : agencyLedger ? (
              fmtSignedCurrency(agencyLedger.remaining)
            ) : (
              "—"
            )}
          </b>
        </div>
      </div>

      {/* Row 2 — commission */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          className={`${cardBase} border-indigo-100 dark:border-indigo-500/25`}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:h-12 sm:w-12 dark:bg-indigo-500/15 dark:text-indigo-300">
              <Coins className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">
                Total commission
              </p>
              <h3 className="font-mono text-lg font-bold text-indigo-700 metric-tabular sm:text-xl dark:text-indigo-300">
                {fmtCurrency(totalCommission)}
              </h3>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Commission revenue + extra commission
          </p>
        </div>

        <div
          className={`${cardBase} border-emerald-100 dark:border-emerald-500/20`}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:h-12 sm:w-12 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">
                Commission revenue
              </p>
              <h3 className="font-mono text-lg font-bold text-slate-900 metric-tabular sm:text-xl dark:text-white">
                {fmtCurrency(commissionRevenue)}
              </h3>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Bulk entry commission (all time)
          </p>
        </div>

        <div
          className={`${cardBase} border-amber-100 dark:border-amber-500/20`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 sm:h-12 sm:w-12 dark:bg-amber-500/15 dark:text-amber-400">
                <BadgePercent className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">
                  Extra commission
                </p>
                <h3 className="font-mono text-lg font-bold text-slate-900 metric-tabular sm:text-xl dark:text-white">
                  {fmtCurrency(extraCommission)}
                </h3>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={openAdd}
                title="Add extra commission"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setModal("history")}
                title="Extra commission history"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <History className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Manual add-ins (all time)
          </p>
        </div>
      </div>

      {modal === "add" && (
        <ModalShell title="Add Extra Commission" onClose={() => setModal(null)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Amount (₹)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={fieldCls}
                placeholder="0"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Date
              </label>
              <DatePicker
                value={date}
                onChange={setDate}
                className={fieldCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={`${fieldCls} resize-none`}
                placeholder="Reason for extra commission…"
              />
            </div>
            {saveError && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {saveError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
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
            <p className="py-6 text-center text-sm text-rose-600 dark:text-rose-400">
              {historyError}
            </p>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No extra commission add-ins yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Notes</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {history.map((row) => (
                    <tr
                      key={row._id}
                      className="bg-white dark:bg-transparent"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700 dark:text-slate-300">
                        {formatDate(row.paymentDate)}
                      </td>
                      <td className="max-w-[280px] truncate px-3 py-2.5 text-slate-500 dark:text-slate-400">
                        {row.notes || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-white">
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
