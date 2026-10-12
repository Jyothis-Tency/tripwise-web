import React, { useState } from "react";
import {
  Car,
  User,
  Calendar,
  Route,
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  Fuel,
  Coins,
  Utensils,
  Wrench,
  AlertTriangle,
  FileText,
  Tag,
  Building2,
  Receipt,
  ExternalLink,
  Wallet,
  X,
  ArrowRight,
} from "lucide-react";
import type { TripWithExpenses, TripExpense, AddTripExpensePayload } from "../api";
import { deleteTripExpense, addTripExpense, updateTripExpense } from "../api";
import { DatePicker } from "../../../components/ui/DatePicker";

function fmtCurrency(v: unknown): string {
  const n = parseFloat(String(v ?? 0));
  if (isNaN(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
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

function getTripStatusStyle(status?: string): string {
  switch (status?.toLowerCase()) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:text-emerald-300";
    case "cancelled":
      return "bg-rose-500/15 text-rose-700 border border-rose-500/30 dark:text-rose-300";
    case "in_progress":
    case "in progress":
      return "bg-indigo-500/15 text-indigo-700 border border-indigo-500/40 dark:text-indigo-300";
    case "scheduled":
      return "bg-sky-500/15 text-sky-700 border border-sky-500/30 dark:text-sky-300";
    default:
      return "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-[#1e2638]";
  }
}

function categoryToType(label: string) {
  return label.trim().toLowerCase();
}

interface Props {
  trip: TripWithExpenses;
  onRefresh: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export const TripExpenseCard: React.FC<Props> = ({
  trip,
  onRefresh,
  expanded: controlledExpanded,
  onToggleExpand,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const toggleExpanded = () => {
    if (onToggleExpand) onToggleExpand();
    else setInternalExpanded((prev) => !prev);
  };

  const [adding, setAdding] = useState(false);
  const [newExp, setNewExp] = useState<{
    description: string;
    amount: string;
    category: string;
    paidBy: "Company" | "Personal";
    date: string;
  }>({
    description: "",
    amount: "",
    category: "Fuel",
    paidBy: "Company",
    date: new Date().toISOString().split("T")[0],
  });

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editExp, setEditExp] = useState<{
    description: string;
    amount: string;
    category: string;
    paidBy: "Company" | "Personal";
    date: string;
  }>({
    description: "",
    amount: "",
    category: "Fuel",
    paidBy: "Company",
    date: "",
  });

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const tripId = trip._id || (trip as any).id || "";
  const expenses = trip.expenses ?? [];

  // Financial calculations
  const isFuelType = (type?: string) => {
    const t = String(type ?? "").toLowerCase().trim();
    return t === "fuel" || t === "petrol" || t === "diesel";
  };

  const fuelTotal = expenses.reduce((sum, e) => (isFuelType(e.type || e.category) ? sum + (Number(e.amount) || 0) : sum), 0);
  const opsTotal = expenses.reduce((sum, e) => (!isFuelType(e.type || e.category) ? sum + (Number(e.amount) || 0) : sum), 0);
  const totalCombined = fuelTotal + opsTotal;

  // Breakdown by Paid By
  const personalTotal = expenses.reduce((sum, e) => (e.paidBy === "Personal" ? sum + (Number(e.amount) || 0) : sum), 0);
  const companyTotal = expenses.reduce((sum, e) => (e.paidBy !== "Personal" ? sum + (Number(e.amount) || 0) : sum), 0);

  const handleDeleteExp = async (expId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      await deleteTripExpense(tripId, expId);
      onRefresh();
    } catch (e) {
      console.error(e);
      alert("Failed to delete expense");
    }
  };

  const handleAddExp = async () => {
    setFormError(null);
    const amt = Number(newExp.amount);
    if (!newExp.amount || !Number.isFinite(amt) || amt <= 0) {
      setFormError("Enter a valid amount greater than 0.");
      return;
    }
    if (!tripId) {
      setFormError("Missing trip id. Refresh and try again.");
      return;
    }
    setSaving(true);
    try {
      const payload: AddTripExpensePayload = {
        description: newExp.description.trim() || newExp.category,
        amount: amt,
        type: categoryToType(newExp.category),
        paidBy: newExp.paidBy,
        date: newExp.date || new Date().toISOString(),
      };
      await addTripExpense(tripId, payload);
      setNewExp({
        description: "",
        amount: "",
        category: "Fuel",
        paidBy: "Company",
        date: new Date().toISOString().split("T")[0],
      });
      setAdding(false);
      onRefresh();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Could not add expense";
      setFormError(msg);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleEditExp = async () => {
    setFormError(null);
    if (!editExp.amount || !editingId) return;
    const amt = Number(editExp.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFormError("Enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<AddTripExpensePayload> = {
        description: editExp.description.trim() || editExp.category,
        amount: amt,
        type: categoryToType(editExp.category),
        paidBy: editExp.paidBy,
        date: editExp.date || new Date().toISOString(),
      };
      await updateTripExpense(tripId, editingId, payload);
      setEditingId(null);
      onRefresh();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Could not update expense";
      setFormError(msg);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (exp: TripExpense) => {
    setEditingId(exp._id);
    const catFormatted =
      TRIP_EXPENSE_CATEGORIES.find(
        (c) =>
          c.toLowerCase() === exp.category?.toLowerCase() ||
          c.toLowerCase() === exp.type?.toLowerCase(),
      ) || "Other";
    setEditExp({
      description: exp.description || "",
      amount: String(exp.amount || ""),
      category: catFormatted,
      paidBy: exp.paidBy === "Personal" ? "Personal" : "Company",
      date: exp.date ? exp.date.split("T")[0] : new Date().toISOString().split("T")[0],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormError(null);
  };

  const driverObj = trip.driver;
  const driverFullName = driverObj
    ? `${driverObj.firstName ?? ""} ${driverObj.lastName ?? ""}`.trim()
    : null;
  const driverPhone = driverObj?.phone;

  const vehicleObj = trip.vehicle;
  const vehicleNumber = vehicleObj?.vehicleNumber;
  const vehicleModel = [vehicleObj?.vehicleModel, vehicleObj?.vehicleType].filter(Boolean).join(" · ");

  // Accent class based on personal expenses vs company expenses
  const accentClass =
    personalTotal > 0
      ? "from-amber-500 to-amber-400"
      : totalCombined > 0
        ? "from-indigo-600 to-violet-500"
        : "from-slate-300 to-slate-200 dark:from-slate-700 dark:to-slate-600";

  return (
    <div
      className={`group relative mb-3 overflow-hidden rounded-2xl border bg-[var(--bg-card)] shadow-xs transition-all duration-200 dark:border-[#1e2638] ${
        isExpanded
          ? "border-indigo-400/50 shadow-md ring-1 ring-indigo-500/10 dark:border-indigo-500/40"
          : "border-slate-200 hover:border-slate-300 hover:shadow-md dark:hover:border-slate-700"
      }`}
    >
      {/* Left colored stripe */}
      <div
        className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${accentClass}`}
        aria-hidden
      />

      {/* Header bar */}
      <div
        onClick={toggleExpanded}
        className="flex cursor-pointer flex-col gap-3.5 p-4 sm:p-5 transition hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
      >
        {/* Row 1: Badges, Status & Total Outflow */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Monospace trip number badge */}
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-bold text-slate-800 shadow-2xs dark:border-[#252c4d] dark:bg-[#151a30] dark:text-[#eef0ff]">
              <Route className="h-3.5 w-3.5 text-indigo-500" />
              {trip.tripNumber || (tripId ? tripId.slice(-6).toUpperCase() : "TRIP")}
            </span>

            {/* Trip status badge */}
            {trip.status && (
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold capitalize ${getTripStatusStyle(
                  trip.status,
                )}`}
              >
                {trip.status}
              </span>
            )}

            {/* Date badge */}
            {trip.startDate && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {fmtDate(trip.startDate)}
              </span>
            )}

            {/* Customer name */}
            {trip.customer && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300">
                <Building2 className="h-3 w-3 text-slate-400" />
                {trip.customer}
              </span>
            )}
          </div>

          {/* Right side: Total Amount and item count */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-1.5">
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Total</span>
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  {fmtCurrency(totalCombined)}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                <span>{expenses.length} {expenses.length === 1 ? "expense" : "expenses"}</span>
                {personalTotal > 0 && (
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    · {fmtCurrency(personalTotal)} reimbursable
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-500 shadow-2xs transition group-hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Route, Driver & Vehicle information */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/5">
          {/* Route */}
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            <span className="rounded-md bg-indigo-50/80 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
              {trip.fromLocation || "Origin"}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="rounded-md bg-emerald-50/80 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              {trip.toLocation || "Destination"}
            </span>
          </div>

          {/* Driver & Vehicle pills */}
          <div className="flex flex-wrap items-center gap-2">
            {driverFullName ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-[#1e2638] dark:text-slate-200">
                <User className="h-3.5 w-3.5 text-indigo-500" />
                <span>{driverFullName}</span>
                {driverPhone && (
                  <span className="text-slate-400 dark:text-slate-500">({driverPhone})</span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-200 px-2.5 py-1 text-xs text-slate-400 dark:border-white/10">
                <User className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                No driver
              </span>
            )}

            {vehicleNumber ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-[#1e2638] dark:text-slate-200">
                <Car className="h-3.5 w-3.5 text-violet-500" />
                <span className="font-mono font-semibold">{vehicleNumber}</span>
                {vehicleModel && (
                  <span className="text-slate-400 dark:text-slate-500">· {vehicleModel}</span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-200 px-2.5 py-1 text-xs text-slate-400 dark:border-white/10">
                <Car className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                No vehicle
              </span>
            )}
          </div>
        </div>

        {/* Breakdown chips summary bar */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Fuel className="h-3 w-3" />
            Fuel: {fmtCurrency(fuelTotal)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
            <Coins className="h-3 w-3" />
            Operational / Extra: {fmtCurrency(opsTotal)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
            <Building2 className="h-3 w-3" />
            Company Paid: {fmtCurrency(companyTotal)}
          </span>
          {personalTotal > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300">
              <Wallet className="h-3 w-3" />
              Driver Paid (Reimbursable): {fmtCurrency(personalTotal)}
            </span>
          )}
        </div>
      </div>

      {/* Expanded Expense Details */}
      {isExpanded && (
        <div className="border-t border-slate-200/80 bg-slate-50/40 p-4 sm:p-5 dark:border-[#1e2638] dark:bg-black/10">
          {/* Header row in expanded body */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Itemized Expenses Breakdown
              </h4>
              <span className="rounded-full bg-slate-200/80 px-2 py-0.2 text-[11px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                {expenses.length}
              </span>
            </div>

            {!adding && !editingId && (
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setAdding(true);
                  setEditingId(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:opacity-95 active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Expense
              </button>
            )}
          </div>

          {/* Form error notification */}
          {formError && (adding || editingId) && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{formError}</span>
            </div>
          )}

          {/* Add Expense Inline Panel */}
          {adding && !editingId && (
            <div className="mb-4 rounded-2xl border border-indigo-200/80 bg-white p-4 shadow-sm dark:border-indigo-500/30 dark:bg-[#151a30]">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  <Plus className="h-3.5 w-3.5" />
                  New Expense for {trip.tripNumber || "Trip"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setFormError(null);
                  }}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Category */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Category *
                  </label>
                  <select
                    value={newExp.category}
                    onChange={(e) => setNewExp((p) => ({ ...p, category: e.target.value }))}
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
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Amount (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={newExp.amount}
                      onChange={(e) => setNewExp((p) => ({ ...p, amount: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-[var(--bg-main)] py-2 pl-7 pr-3 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Paid By Toggle */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Paid By *
                  </label>
                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-white/5">
                    <button
                      type="button"
                      onClick={() => setNewExp((p) => ({ ...p, paidBy: "Company" }))}
                      className={`flex items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-bold transition ${
                        newExp.paidBy === "Company"
                          ? "bg-white text-indigo-700 shadow-2xs dark:bg-indigo-600 dark:text-white"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                      }`}
                    >
                      <Building2 className="h-3 w-3" />
                      Company
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewExp((p) => ({ ...p, paidBy: "Personal" }))}
                      className={`flex items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-bold transition ${
                        newExp.paidBy === "Personal"
                          ? "bg-amber-500 text-white shadow-2xs dark:bg-amber-500 dark:text-slate-950"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                      }`}
                    >
                      <Wallet className="h-3 w-3" />
                      Driver Paid
                    </button>
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Expense Date
                  </label>
                  <DatePicker
                    value={newExp.date}
                    onChange={(d) => setNewExp((p) => ({ ...p, date: d }))}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-[var(--bg-main)] px-3 text-xs font-semibold text-slate-800 dark:border-white/10 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Description row */}
              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Description / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. FASTag auto toll debit, Diesel top-up, Parking ticket"
                  value={newExp.description}
                  onChange={(e) => setNewExp((p) => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-[var(--bg-main)] px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:text-slate-100"
                />
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setFormError(null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddExp}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Expense"}
                </button>
              </div>
            </div>
          )}

          {/* Expenses List */}
          {expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/50 py-8 text-center dark:border-white/10 dark:bg-white/[0.02]">
              <div className="mb-2 rounded-full bg-slate-100 p-2.5 dark:bg-white/5">
                <Receipt className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                No expenses logged for this trip yet
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                Record toll, fuel, parking, or driver expenses to track profitability.
              </p>
              {!adding && (
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setAdding(true);
                  }}
                  className="mt-3 inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add First Expense
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map((exp, idx) => {
                const isEditingThis = editingId === exp._id;

                if (isEditingThis) {
                  return (
                    <div
                      key={exp._id || idx}
                      className="rounded-2xl border border-indigo-300 bg-white p-3.5 shadow-sm dark:border-indigo-500/40 dark:bg-[#151a30]"
                    >
                      <div className="mb-2.5 flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                          Edit Expense
                        </span>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            Category
                          </label>
                          <select
                            value={editExp.category}
                            onChange={(e) => setEditExp((p) => ({ ...p, category: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-[var(--bg-main)] px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-white/10 dark:text-slate-100"
                          >
                            {TRIP_EXPENSE_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            Amount (₹)
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={editExp.amount}
                            onChange={(e) => setEditExp((p) => ({ ...p, amount: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-[var(--bg-main)] px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 dark:border-white/10 dark:text-slate-100"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            Paid By
                          </label>
                          <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-white/5">
                            <button
                              type="button"
                              onClick={() => setEditExp((p) => ({ ...p, paidBy: "Company" }))}
                              className={`rounded-lg py-1 text-[11px] font-bold transition ${
                                editExp.paidBy === "Company"
                                  ? "bg-white text-indigo-700 shadow-2xs dark:bg-indigo-600 dark:text-white"
                                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                              }`}
                            >
                              Company
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditExp((p) => ({ ...p, paidBy: "Personal" }))}
                              className={`rounded-lg py-1 text-[11px] font-bold transition ${
                                editExp.paidBy === "Personal"
                                  ? "bg-amber-500 text-white shadow-2xs dark:bg-amber-500 dark:text-slate-950"
                                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                              }`}
                            >
                              Driver Paid
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            Date
                          </label>
                          <DatePicker
                            value={editExp.date}
                            onChange={(d) => setEditExp((p) => ({ ...p, date: d }))}
                            className="h-8 w-full rounded-xl border border-slate-200 bg-[var(--bg-main)] px-2.5 text-xs font-semibold text-slate-800 dark:border-white/10 dark:text-slate-100"
                          />
                        </div>
                      </div>

                      <div className="mt-2.5">
                        <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Description
                        </label>
                        <input
                          type="text"
                          value={editExp.description}
                          onChange={(e) => setEditExp((p) => ({ ...p, description: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500 dark:border-white/10 dark:text-slate-100"
                        />
                      </div>

                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleEditExp}
                          disabled={saving}
                          className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {saving ? "Saving…" : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  );
                }

                // Normal View Mode Row
                const categoryLabel = exp.category || exp.type || "Expense";
                const isPersonal = exp.paidBy === "Personal";

                return (
                  <div
                    key={exp._id || idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white p-3.5 shadow-2xs transition hover:border-slate-300 hover:shadow-xs dark:border-[#1e2638] dark:bg-[var(--bg-card)] dark:hover:border-slate-700"
                  >
                    {/* Left: Category Icon, Badge, Description, Details */}
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Icon container */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5">
                        {getCategoryIcon(exp.category, exp.type)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold capitalize ${getCategoryBadgeClass(
                              exp.category,
                              exp.type,
                            )}`}
                          >
                            {categoryLabel}
                          </span>

                          {/* Paid By Pill */}
                          {isPersonal ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
                              <Wallet className="h-3 w-3" />
                              Driver Paid (Reimbursable)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                              <Building2 className="h-3 w-3" />
                              Paid by Company
                            </span>
                          )}

                          {/* Date */}
                          {exp.date && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                              <Calendar className="h-3 w-3" />
                              {fmtDate(exp.date)}
                            </span>
                          )}

                          {/* Receipt button if receiptPath is available */}
                          {exp.receiptPath && (
                            <a
                              href={exp.receiptPath}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
                            >
                              <ExternalLink className="h-2.5 w-2.5" />
                              Receipt
                            </a>
                          )}
                        </div>

                        {/* Description */}
                        {exp.description && (
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            {exp.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Amount and Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-white/5">
                      <div className="text-right">
                        <span
                          className={`text-base font-extrabold tracking-tight tabular-nums ${
                            isPersonal
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {fmtCurrency(exp.amount)}
                        </span>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          {isPersonal ? "Owed to driver" : "Company operational"}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setFormError(null);
                            startEdit(exp);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-300"
                          title="Edit Expense"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExp(exp._id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-400"
                          title="Delete Expense"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TripExpenseCard;
