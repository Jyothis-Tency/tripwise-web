import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { TripWithExpenses } from "../api";
import { fetchTripsWithExpenses } from "../api";
import { TripExpenseCard } from "../components/TripExpenseCard";
import { VehicleExpensesPane } from "../components/VehicleExpensesPane";
import { fetchVehicles, type Vehicle } from "../../vehicles/api";
import { VehicleListCard } from "../../vehicles/components/VehicleListCard";
import {
  Car,
  Search,
  ChevronLeft,
  Fuel,
  Coins,
  Wallet,
  Route,
  Receipt,
  RefreshCw,
  X,
  ChevronsDown,
  ChevronsUp,
  Building2,
} from "lucide-react";

type ExpensesMode = "trip" | "vehicle";

function ModeTabsBar({
  mode,
  setMode,
}: {
  mode: ExpensesMode;
  setMode: (m: ExpensesMode) => void;
}) {
  const tabBtn =
    "flex min-h-0 min-w-0 items-center justify-center rounded-lg px-2.5 py-2 text-center text-xs font-bold leading-tight transition-all sm:px-3";

  return (
    <div
      className="grid h-10 w-[min(100%,19rem)] shrink-0 grid-cols-2 gap-1 rounded-xl border border-slate-200/90 bg-slate-100 p-1 dark:border-white/10 dark:bg-white/5"
      role="tablist"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "vehicle"}
        className={`${tabBtn} ${
          mode === "vehicle"
            ? "bg-white text-indigo-700 shadow-xs dark:bg-indigo-600 dark:text-white"
            : "bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
        onClick={() => setMode("vehicle")}
      >
        <Car className="mr-1.5 h-3.5 w-3.5" />
        Vehicle expenses
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "trip"}
        className={`${tabBtn} ${
          mode === "trip"
            ? "bg-white text-indigo-700 shadow-xs dark:bg-indigo-600 dark:text-white"
            : "bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
        onClick={() => setMode("trip")}
      >
        <Route className="mr-1.5 h-3.5 w-3.5" />
        Trip expenses
      </button>
    </div>
  );
}

function fmtCurrency(v: number): string {
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const CATEGORY_FILTER_OPTIONS = [
  "All",
  "Fuel",
  "Toll",
  "Parking",
  "Food",
  "Maintenance",
  "Tax & Permit",
  "Fine",
  "Other",
] as const;

const ExpensesPage: React.FC = () => {
  const [mode, setMode] = useState<ExpensesMode>("trip");

  // Trip Expenses State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [trips, setTrips] = useState<TripWithExpenses[]>([]);
  const [tripLoading, setTripLoading] = useState(true);
  const [payerFilter, setPayerFilter] = useState<"all" | "company" | "personal">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [expandedTripIds, setExpandedTripIds] = useState<Set<string>>(new Set());

  // Vehicle Expenses State
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadTrips = useCallback(async () => {
    setTripLoading(true);
    try {
      const res = await fetchTripsWithExpenses({
        limit: 100,
        search: debouncedSearch || undefined,
      });
      setTrips(res.trips);
    } catch {
      setTrips([]);
    } finally {
      setTripLoading(false);
    }
  }, [debouncedSearch]);

  const loadVehicles = useCallback(async (q: string) => {
    setVehicleLoading(true);
    try {
      const res = await fetchVehicles({
        page: 1,
        limit: 80,
        search: q || undefined,
      });
      setVehicles(res.items ?? []);
    } catch {
      setVehicles([]);
    } finally {
      setVehicleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== "trip") return;
    void loadTrips();
  }, [mode, loadTrips]);

  useEffect(() => {
    if (mode !== "vehicle") return;
    const t = setTimeout(() => void loadVehicles(vehicleSearch), 300);
    return () => clearTimeout(t);
  }, [mode, vehicleSearch, loadVehicles]);

  useEffect(() => {
    if (mode !== "vehicle") return;
    setSelectedVehicleId((prev) => {
      if (!prev) return null;
      if (vehicles.some((v) => v._id === prev)) return prev;
      return null;
    });
  }, [mode, vehicles]);

  // Overall Financial Stats across all loaded trips
  const stats = useMemo(() => {
    let totalExpense = 0;
    let fuelExpense = 0;
    let opsExpense = 0;
    let personalExpense = 0;
    let companyExpense = 0;
    let tripsWithExpenses = 0;

    trips.forEach((t) => {
      const exps = t.expenses ?? [];
      if (exps.length > 0) tripsWithExpenses++;

      exps.forEach((e) => {
        const amt = Number(e.amount) || 0;
        totalExpense += amt;

        const cat = String(e.category || e.type || "").toLowerCase().trim();
        if (cat === "fuel" || cat === "petrol" || cat === "diesel") {
          fuelExpense += amt;
        } else {
          opsExpense += amt;
        }

        if (e.paidBy === "Personal") {
          personalExpense += amt;
        } else {
          companyExpense += amt;
        }
      });
    });

    return {
      totalExpense,
      fuelExpense,
      opsExpense,
      personalExpense,
      companyExpense,
      tripsWithExpenses,
      totalTrips: trips.length,
    };
  }, [trips]);

  // Filtered trips for display
  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      const exps = t.expenses ?? [];

      // Filter by Payer
      if (payerFilter === "personal") {
        const hasPersonal = exps.some((e) => e.paidBy === "Personal");
        if (!hasPersonal) return false;
      } else if (payerFilter === "company") {
        const hasCompany = exps.some((e) => e.paidBy !== "Personal");
        if (!hasCompany && exps.length > 0) return false;
      }

      // Filter by Category
      if (categoryFilter !== "All") {
        const target = categoryFilter.toLowerCase();
        const hasCategory = exps.some((e) => {
          const c = String(e.category || e.type || "").toLowerCase();
          return c === target;
        });
        if (!hasCategory) return false;
      }

      return true;
    });
  }, [trips, payerFilter, categoryFilter]);

  // Toggle individual expansion
  const toggleExpandTrip = (id: string) => {
    setExpandedTripIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Expand all / Collapse all
  const expandAll = () => {
    const allIds = new Set(filteredTrips.map((t) => t._id));
    setExpandedTripIds(allIds);
  };

  const collapseAll = () => {
    setExpandedTripIds(new Set());
  };

  const selectedVehicle =
    selectedVehicleId != null
      ? vehicles.find((v) => v._id === selectedVehicleId) ?? null
      : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--bg-main)]">
      {/* Page Header — Consistent with Driver & Trip Details pages */}
      <div className="shrink-0 border-b border-slate-200/80 px-5 py-4 sm:px-7 dark:border-[#1e2638]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-[#eef0ff]">
              Expenses & Disbursements
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-[#8d94b8]">
              Audit trip outlays, fuel disbursements, and driver personal expense reimbursements
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ModeTabsBar mode={mode} setMode={setMode} />
          </div>
        </div>
      </div>

      {mode === "vehicle" ? (
        /* VEHICLE EXPENSES VIEW */
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            className={`flex w-full shrink-0 flex-col border-r border-slate-200 bg-[var(--bg-card)] transition-all dark:border-[#1e2638] md:w-64 lg:w-72 xl:w-80 ${
              selectedVehicleId ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="relative border-b border-slate-100 px-3 py-2.5 dark:border-white/10">
              <Search className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
                placeholder="Search vehicles…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30"
              />
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
              {vehicleLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5"
                  />
                ))
              ) : vehicles.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Car className="h-10 w-10 text-slate-300 dark:text-slate-500" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">No vehicles found</p>
                </div>
              ) : (
                vehicles.map((v) => (
                  <VehicleListCard
                    key={v._id}
                    vehicle={v}
                    isSelected={v._id === selectedVehicleId}
                    onSelect={() => setSelectedVehicleId(v._id)}
                    showEditButton={false}
                  />
                ))
              )}
            </div>
          </div>

          <div
            className={`min-h-0 flex-1 overflow-y-auto bg-[var(--bg-main)] p-4 sm:p-6 ${
              selectedVehicleId ? "flex flex-col" : "hidden md:flex"
            }`}
          >
            {selectedVehicle ? (
              <>
                <div className="mb-4 flex items-center gap-2 md:hidden">
                  <button
                    type="button"
                    onClick={() => setSelectedVehicleId(null)}
                    className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                    aria-label="Back to vehicle list"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Vehicle
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {selectedVehicle.vehicleNumber}
                    </p>
                  </div>
                </div>
                <div className="hidden border-b border-slate-200 pb-3 dark:border-[#1e2638] md:block">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Vehicle expenses
                  </p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {selectedVehicle.vehicleNumber}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {[selectedVehicle.vehicleType, selectedVehicle.vehicleModel]
                      .filter(Boolean)
                      .join(" – ")}
                  </p>
                </div>
                <div className="mt-4 min-h-0 flex-1">
                  <VehicleExpensesPane vehicle={selectedVehicle} />
                </div>
              </>
            ) : (
              !vehicleLoading && (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                  <Car className="h-12 w-12 text-slate-300 dark:text-slate-500" />
                  <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                    No vehicle selected
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Select a vehicle from the left pane to manage its operational expenses
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        /* TRIP EXPENSES VIEW */
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-24 sm:p-6 lg:p-7">
          {/* Top KPI Metric Summary Cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* 1. Total Trip Outflow */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-[var(--bg-card)] p-4 shadow-2xs dark:border-[#1e2638]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Outflow
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
                  <Receipt className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              <p className="mt-2 text-xl font-black tracking-tight text-slate-900 dark:text-white">
                {fmtCurrency(stats.totalExpense)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Across {stats.tripsWithExpenses} active trips
              </p>
            </div>

            {/* 2. Fuel Outflow */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-[var(--bg-card)] p-4 shadow-2xs dark:border-[#1e2638]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Fuel Expense
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                  <Fuel className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="mt-2 text-xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                {fmtCurrency(stats.fuelExpense)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Diesel & petrol top-ups
              </p>
            </div>

            {/* 3. Operational / Extra Expenses */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-[var(--bg-card)] p-4 shadow-2xs dark:border-[#1e2638]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Toll & Operations
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-500/10">
                  <Coins className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
              <p className="mt-2 text-xl font-black tracking-tight text-slate-900 dark:text-white">
                {fmtCurrency(stats.opsExpense)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Tolls, parking, repairs, permits
              </p>
            </div>

            {/* 4. Driver Reimbursable (Personal) */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-2xs dark:border-amber-500/30 dark:bg-amber-500/5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Driver Reimbursable
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20">
                  <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <p className="mt-2 text-xl font-black tracking-tight text-amber-700 dark:text-amber-300">
                {fmtCurrency(stats.personalExpense)}
              </p>
              <p className="mt-1 text-[11px] text-amber-600/80 dark:text-amber-400/80">
                Paid by driver · Added to salary payout
              </p>
            </div>

            {/* 5. Company Paid Total */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-[var(--bg-card)] p-4 shadow-2xs dark:border-[#1e2638]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Company Outflow
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
                  <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="mt-2 text-xl font-black tracking-tight text-slate-900 dark:text-white">
                {fmtCurrency(stats.companyExpense)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Paid directly by company / FASTag
              </p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="mb-4 space-y-3 rounded-2xl border border-slate-200/90 bg-[var(--bg-card)] p-4 shadow-2xs dark:border-[#1e2638]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by trip #, route, driver, customer, or vehicle plate…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-[var(--bg-main)] py-2.5 pl-9 pr-9 text-xs sm:text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-white/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Action Buttons: Expand/Collapse All and Refresh */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={expandAll}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.98] dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                  title="Expand all trip cards"
                >
                  <ChevronsDown className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Expand All</span>
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.98] dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                  title="Collapse all trip cards"
                >
                  <ChevronsUp className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Collapse</span>
                </button>
                <button
                  type="button"
                  onClick={loadTrips}
                  disabled={tripLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                  title="Refresh trips"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${tripLoading ? "animate-spin" : ""}`} />
                  <span className="hidden xs:inline">Refresh</span>
                </button>
              </div>
            </div>

            {/* Filter Pills row: Payer filter & Category filter */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-3 dark:border-white/5">
              {/* Payer Filter Toggle Group */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Paid By:
                </span>
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-white/10 dark:bg-white/5">
                  <button
                    type="button"
                    onClick={() => setPayerFilter("all")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      payerFilter === "all"
                        ? "bg-white text-indigo-700 shadow-2xs dark:bg-indigo-600 dark:text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    All Payers
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayerFilter("company")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      payerFilter === "company"
                        ? "bg-white text-indigo-700 shadow-2xs dark:bg-indigo-600 dark:text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    🏢 Company Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayerFilter("personal")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      payerFilter === "personal"
                        ? "bg-amber-500 text-white shadow-2xs dark:bg-amber-500 dark:text-slate-950"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    👤 Driver Paid
                  </button>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Category:
                </span>
                {CATEGORY_FILTER_OPTIONS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                      categoryFilter === cat
                        ? "bg-indigo-50 font-bold text-indigo-700 ring-1 ring-indigo-500/30 dark:bg-indigo-500/20 dark:text-indigo-300"
                        : "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Trips List */}
          {tripLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100 dark:border-white/5 dark:bg-white/5"
                />
              ))}
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-[var(--bg-card)] py-16 text-center dark:border-[#1e2638]">
              <div className="mb-3 rounded-full bg-slate-100 p-4 dark:bg-white/5">
                <Search className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                No trips matching criteria
              </h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                {search || payerFilter !== "all" || categoryFilter !== "All"
                  ? "Try resetting your search query or filters to view all trips and logged expenses."
                  : "No trips found in the system. Create a trip to start recording expenses."}
              </p>
              {(search || payerFilter !== "all" || categoryFilter !== "All") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPayerFilter("all");
                    setCategoryFilter("All");
                  }}
                  className="mt-4 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTrips.map((t) => (
                <TripExpenseCard
                  key={t._id}
                  trip={t}
                  onRefresh={loadTrips}
                  expanded={expandedTripIds.has(t._id)}
                  onToggleExpand={() => toggleExpandTrip(t._id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpensesPage;
