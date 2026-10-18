import { useState, useRef, type FormEvent, type ReactNode } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Fuel,
  Coins,
  Wallet,
  Building2,
  Receipt,
  FileText,
  AlertTriangle,
  Tag,
  Car,
  Utensils,
  Wrench,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import type { TripWithExpenses, TripExpense, AddTripExpensePayload } from "../api";
import { addTripExpense, updateTripExpense, deleteTripExpense } from "../api";
import { DatePicker } from "../../../components/ui/DatePicker";
import { isFuelExpenseType } from "../../history/tripExpenseBreakdown";

function fmtCurrency(v: number | string | undefined): string {
  const n = Number(v) || 0;
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

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

const TRIP_EXPENSE_CATEGORIES = [
  "Fuel",
  "Toll",
  "Tax & Permit",
  "Parking",
  "Maintenance",
  "Repair",
  "Food",
  "Cleaning",
  "Fine",
  "Other",
] as const;

function getCategoryIcon(category?: string, type?: string) {
  const cat = String(category || type || "").toLowerCase().trim();
  switch (cat) {
    case "fuel":
    case "petrol":
    case "diesel":
      return <Fuel className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    case "toll":
    case "tolls":
      return <Coins className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
    case "parking":
      return <Car className="h-4 w-4 text-violet-600 dark:text-violet-400" />;
    case "food":
      return <Utensils className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    case "maintenance":
    case "repair":
      return <Wrench className="h-4 w-4 text-rose-600 dark:text-rose-400" />;
    case "tax & permit":
      return <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />;
    case "fine":
      return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    default:
      return <Tag className="h-4 w-4 text-slate-600 dark:text-slate-400" />;
  }
}

function getCategoryBadgeClass(category?: string, type?: string) {
  const cat = String(category || type || "").toLowerCase().trim();
  switch (cat) {
    case "fuel":
    case "petrol":
    case "diesel":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20";
    case "toll":
    case "tolls":
      return "bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20";
    case "parking":
      return "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20";
    case "food":
      return "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20";
    case "maintenance":
    case "repair":
      return "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20";
    case "tax & permit":
      return "bg-sky-50 text-sky-700 border-sky-200/60 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20";
    case "fine":
      return "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10";
  }
}

function ModalShell({
  title,
  onClose,
  children,
  maxWidth = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div
        className={`flex max-h-[90vh] w-full ${maxWidth} flex-col rounded-2xl border border-slate-200 bg-[var(--bg-card)] shadow-2xl dark:border-[#1e2638]`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function TripExpenseFormModal({
  tripId,
  expense,
  onClose,
  onSaved,
}: {
  tripId: string;
  expense?: TripExpense | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isUpdate = !!expense;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    category: expense?.category || expense?.type || "Fuel",
    amount: expense?.amount?.toString() ?? "",
    date: expense?.date
      ? expense.date.split("T")[0]
      : new Date().toISOString().split("T")[0],
    paidBy: (expense?.paidBy === "Personal" ? "Personal" : "Company") as
      | "Company"
      | "Personal",
    description: expense?.description ?? "",
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = Number(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }
    setSaving(true);
    try {
      const payload: AddTripExpensePayload = {
        amount: amt,
        category: form.category,
        type: form.category.toLowerCase(),
        paidBy: form.paidBy,
        date: form.date,
        description: form.description.trim() || form.category,
      };
      if (isUpdate && expense?._id) {
        await updateTripExpense(tripId, expense._id, payload);
      } else {
        await addTripExpense(tripId, payload);
      }
      onSaved();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to save expense"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={isUpdate ? "Edit Trip Expense" : "Add Trip Expense"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Category */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, category: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-[var(--bg-main)] px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:text-slate-100"
            >
              {TRIP_EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={form.amount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, amount: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-[var(--bg-main)] py-2 pl-7 pr-3 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Paid By */}
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Paid By <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, paidBy: "Company" }))
                }
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                  form.paidBy === "Company"
                    ? "bg-white text-indigo-700 shadow-2xs dark:bg-indigo-600 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                🏢 Company Paid
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, paidBy: "Personal" }))
                }
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                  form.paidBy === "Personal"
                    ? "bg-amber-500 text-white shadow-2xs dark:bg-amber-500 dark:text-slate-950"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                <Wallet className="h-3.5 w-3.5" />
                👤 Driver paid
              </button>
            </div>
            {form.paidBy === "Personal" && (
              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                This amount will be reimbursed to the driver and added to their
                salary payout calculation.
              </p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Expense Date
            </label>
            <DatePicker
              value={form.date}
              onChange={(d) => setForm((prev) => ({ ...prev, date: d }))}
              className="h-10 w-full rounded-xl border border-slate-200 bg-[var(--bg-main)] px-3 text-xs font-semibold text-slate-800 dark:border-white/10 dark:text-slate-100"
            />
          </div>

          {/* Description */}
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Description / Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Toll booth cash slip, Diesel fuel bill, parking slip"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-[var(--bg-main)] px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            {saving ? "Saving…" : isUpdate ? "Update Expense" : "Save Expense"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function TripExpensesPane({
  trip,
  onRefresh,
}: {
  trip: TripWithExpenses;
  onRefresh: () => void;
}) {
  const tripId = trip._id || (trip as any).id || "";
  const expenses = trip.expenses ?? [];

  const [expenseModal, setExpenseModal] = useState<
    "add" | { edit: TripExpense } | null
  >(null);
  const [deleteModal, setDeleteModal] = useState<TripExpense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fuelTotal = expenses.reduce(
    (sum, e) =>
      isFuelExpenseType(e.type) || isFuelExpenseType(e.category)
        ? sum + (Number(e.amount) || 0)
        : sum,
    0,
  );
  const opsTotal = expenses.reduce(
    (sum, e) =>
      !(isFuelExpenseType(e.type) || isFuelExpenseType(e.category))
        ? sum + (Number(e.amount) || 0)
        : sum,
    0,
  );
  const totalCombined = fuelTotal + opsTotal;
  const personalTotal = expenses.reduce(
    (sum, e) => (e.paidBy === "Personal" ? sum + (Number(e.amount) || 0) : sum),
    0
  );
  const companyTotal = expenses.reduce(
    (sum, e) => (e.paidBy !== "Personal" ? sum + (Number(e.amount) || 0) : sum),
    0
  );

  const handleDelete = async () => {
    if (!deleteModal || !tripId) return;
    setDeleting(true);
    try {
      await deleteTripExpense(tripId, deleteModal._id);
      onRefresh();
    } catch {
      alert("Failed to delete expense");
    } finally {
      setDeleting(false);
      setDeleteModal(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards Row for this specific trip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Total Outflow */}
        <div className="rounded-xl border border-slate-200/90 bg-[var(--bg-card)] p-3.5 shadow-2xs dark:border-[#1e2638]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Outflow
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
              <Receipt className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <p className="mt-1.5 text-lg font-black tracking-tight text-slate-900 dark:text-white">
            {fmtCurrency(totalCombined)}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {expenses.length} itemized {expenses.length === 1 ? "entry" : "entries"}
          </p>
        </div>

        {/* Fuel Expense */}
        <div className="rounded-xl border border-slate-200/90 bg-[var(--bg-card)] p-3.5 shadow-2xs dark:border-[#1e2638]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Fuel
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
              <Fuel className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="mt-1.5 text-lg font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {fmtCurrency(fuelTotal)}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Diesel & petrol top-ups
          </p>
        </div>

        {/* Toll & Ops */}
        <div className="rounded-xl border border-slate-200/90 bg-[var(--bg-card)] p-3.5 shadow-2xs dark:border-[#1e2638]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Toll & Ops
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-500/10">
              <Coins className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <p className="mt-1.5 text-lg font-black tracking-tight text-slate-900 dark:text-white">
            {fmtCurrency(opsTotal)}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Tolls, permits & maintenance
          </p>
        </div>

        {/* Driver paid (Personal) */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3.5 shadow-2xs dark:border-amber-500/30 dark:bg-amber-500/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Driver paid
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/20">
              <Wallet className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="mt-1.5 text-lg font-black tracking-tight text-amber-700 dark:text-amber-300">
            {fmtCurrency(personalTotal)}
          </p>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80">
            Added to salary payout
          </p>
        </div>

        {/* Company Outflow */}
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200/90 bg-[var(--bg-card)] p-3.5 shadow-2xs dark:border-[#1e2638]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Company Paid
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
              <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="mt-1.5 text-lg font-black tracking-tight text-slate-900 dark:text-white">
            {fmtCurrency(companyTotal)}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Direct / FASTag outlays
          </p>
        </div>
      </div>

      {/* Toolbar / Actions Header: Total expenses banner + Add expense button */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-[var(--bg-card)] p-4 dark:border-[#1e2638] sm:flex-row sm:items-center sm:gap-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Trip expenses breakdown
            </p>
            <p className="text-lg font-bold text-slate-800 dark:text-white">
              {fmtCurrency(totalCombined)}{" "}
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
                ({expenses.length} {expenses.length === 1 ? "expense" : "expenses"})
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpenseModal("add")}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 active:scale-[0.98] dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          <Plus className="h-4 w-4" /> Add expense
        </button>
      </div>

      {/* Itemized Expenses Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-[var(--bg-card)] shadow-2xs dark:border-[#1e2638]">
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-slate-300 dark:text-slate-500" />
            <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              No expenses recorded for this trip
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Click &ldquo;Add expense&rdquo; above to record fuel, tolls, food or driver personal expenses.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Paid By</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr
                    key={e._id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:border-white/5 dark:text-slate-300 dark:hover:bg-white/[0.04]"
                  >
                    {/* Date */}
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                      {formatDate(e.date)}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize ${getCategoryBadgeClass(
                          e.category,
                          e.type
                        )}`}
                      >
                        {getCategoryIcon(e.category, e.type)}
                        {e.category || e.type || "Other"}
                      </span>
                    </td>

                    {/* Description / Notes */}
                    <td className="max-w-xs truncate px-4 py-3 text-slate-600 dark:text-slate-300">
                      {e.description || "—"}
                    </td>

                    {/* Paid By */}
                    <td className="whitespace-nowrap px-4 py-3">
                      {e.paidBy === "Personal" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300">
                          <Wallet className="h-3 w-3" />
                          Driver Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-white/5 dark:text-slate-400">
                          <Building2 className="h-3 w-3" />
                          Company
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                      {fmtCurrency(e.amount)}
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {e.receiptPath && (
                          <a
                            href={e.receiptPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            title="View receipt"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpenseModal({ edit: e })}
                          className="p-1 text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                          title="Edit expense"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModal(e)}
                          className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                          title="Delete expense"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add / Edit Expense Modal */}
      {expenseModal && (
        <TripExpenseFormModal
          tripId={tripId}
          expense={expenseModal === "add" ? null : expenseModal.edit}
          onClose={() => setExpenseModal(null)}
          onSaved={() => {
            setExpenseModal(null);
            onRefresh();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <ModalShell
          title="Delete Trip Expense"
          onClose={() => setDeleteModal(null)}
          maxWidth="max-w-sm"
        >
          <div className="space-y-4 p-6">
            <div className="flex items-start gap-3">
              <Trash2 className="mt-0.5 h-6 w-6 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Delete this {deleteModal.category || deleteModal.type || "trip"} expense?
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Amount: {fmtCurrency(deleteModal.amount)}. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-500 px-5 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
