import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { TripWithExpenses } from "../api";
import { fetchTripsWithExpenses } from "../api";
import { TripExpensesPane } from "../components/TripExpensesPane";
import { TripListCard } from "../components/TripListCard";
import { VehicleExpensesPane } from "../components/VehicleExpensesPane";
import { fetchVehicles, type Vehicle } from "../../vehicles/api";
import { VehicleListCard } from "../../vehicles/components/VehicleListCard";
import {
  loadExpensesUi,
  saveExpensesUi,
  type ExpensesModeId,
  type ExpensesPayerFilter,
} from "../expensesUiStorage";
import {
  Car,
  Search,
  ChevronLeft,
  Route,
  RefreshCw,
  X,
  ArrowRight,
} from "lucide-react";

type ExpensesMode = ExpensesModeId;

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
    </div>
  );
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

const ExpensesPage: React.FC = () => {
  const savedUi = useMemo(() => loadExpensesUi(), []);

  const [mode, setMode] = useState<ExpensesMode>(savedUi.mode);

  // Trip Expenses State
  const [search, setSearch] = useState(savedUi.tripSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(savedUi.tripSearch);
  const [trips, setTrips] = useState<TripWithExpenses[]>([]);
  const [tripLoading, setTripLoading] = useState(true);
  const [payerFilter, setPayerFilter] = useState<ExpensesPayerFilter>(
    savedUi.payerFilter,
  );
  const [selectedTripId, setSelectedTripId] = useState<string | null>(
    savedUi.selectedTripId,
  );

  // Vehicle Expenses State
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleSearch, setVehicleSearch] = useState(savedUi.vehicleSearch);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    savedUi.selectedVehicleId,
  );

  // Debounce trip search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    saveExpensesUi({
      mode,
      tripSearch: search,
      payerFilter,
      selectedTripId,
      vehicleSearch,
      selectedVehicleId,
    });
  }, [
    mode,
    search,
    payerFilter,
    selectedTripId,
    vehicleSearch,
    selectedVehicleId,
  ]);

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

  useEffect(() => {
    if (mode !== "trip") return;
    setSelectedTripId((prev) => {
      if (prev && trips.some((t) => t._id === prev)) return prev;
      // Desktop only: auto-select first when nothing is remembered
      if (
        !prev &&
        typeof window !== "undefined" &&
        window.innerWidth >= 768 &&
        trips.length > 0
      ) {
        return trips[0]._id;
      }
      return null;
    });
  }, [mode, trips]);

  // Filtered trips for display in sidebar
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

      return true;
    });
  }, [trips, payerFilter]);

  const selectedVehicle =
    selectedVehicleId != null
      ? vehicles.find((v) => v._id === selectedVehicleId) ?? null
      : null;

  const selectedTrip =
    selectedTripId != null
      ? trips.find((t) => t._id === selectedTripId) ?? null
      : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--bg-main)]">
      {/* Page Header */}
      <div className="shrink-0 border-b border-slate-200/80 px-5 py-4 sm:px-7 dark:border-[#1e2638]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-[#eef0ff]">
              Expenses
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-[#8d94b8]">
              Audit trip outlays, fuel disbursements, and driver personal expenses
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ModeTabsBar mode={mode} setMode={setMode} />
          </div>
        </div>
      </div>

      {mode === "trip" ? (
        /* TRIP EXPENSES VIEW — Structured with Sidebar matching Vehicle Expenses */
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Trip Sidebar */}
          <div
            className={`flex w-full shrink-0 flex-col border-r border-slate-200 bg-[var(--bg-card)] transition-all dark:border-[#1e2638] md:w-64 lg:w-72 xl:w-80 ${
              selectedTripId ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Search & Payer Filter Header */}
            <div className="border-b border-slate-100 p-3 space-y-2.5 dark:border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search trips, route, driver, agency, vehicle…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-8 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Quick filter pills in sidebar */}
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-white/10 dark:bg-white/5">
                  <button
                    type="button"
                    onClick={() => setPayerFilter("all")}
                    className={`rounded px-2 py-0.5 font-semibold transition ${
                      payerFilter === "all"
                        ? "bg-white text-indigo-700 shadow-2xs dark:bg-indigo-600 dark:text-white"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayerFilter("company")}
                    className={`rounded px-2 py-0.5 font-semibold transition ${
                      payerFilter === "company"
                        ? "bg-white text-indigo-700 shadow-2xs dark:bg-indigo-600 dark:text-white"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    }`}
                  >
                    Company
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayerFilter("personal")}
                    className={`rounded px-2 py-0.5 font-semibold transition ${
                      payerFilter === "personal"
                        ? "bg-amber-500 text-white shadow-2xs dark:bg-amber-500 dark:text-slate-950"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    }`}
                  >
                    Driver
                  </button>
                </div>

                <button
                  type="button"
                  onClick={loadTrips}
                  disabled={tripLoading}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-white/10 dark:text-slate-400"
                  title="Refresh trips"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${tripLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* List of Trip Tiles */}
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {tripLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5"
                  />
                ))
              ) : filteredTrips.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Route className="h-10 w-10 text-slate-300 dark:text-slate-500" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">No trips found</p>
                </div>
              ) : (
                filteredTrips.map((t) => (
                  <TripListCard
                    key={t._id}
                    trip={t}
                    isSelected={t._id === selectedTripId}
                    onSelect={() => setSelectedTripId(t._id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Trip Detail Pane */}
          <div
            className={`min-h-0 flex-1 overflow-y-auto bg-[var(--bg-main)] p-4 sm:p-6 ${
              selectedTripId ? "flex flex-col" : "hidden md:flex"
            }`}
          >
            {selectedTrip ? (
              <>
                {/* Mobile back button & header */}
                <div className="mb-4 flex items-center gap-2 md:hidden">
                  <button
                    type="button"
                    onClick={() => setSelectedTripId(null)}
                    className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                    aria-label="Back to trip list"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Trip
                    </p>
                    <p className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                      {selectedTrip.tripNumber || selectedTrip._id.slice(-6).toUpperCase()}
                    </p>
                  </div>
                </div>

                {/* Desktop Detail Header */}
                <div className="hidden border-b border-slate-200 pb-3 dark:border-[#1e2638] md:block">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          Trip expenses
                        </p>
                        {selectedTrip.status && (
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold capitalize ${getTripStatusStyle(
                              selectedTrip.status
                            )}`}
                          >
                            {selectedTrip.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                        {selectedTrip.tripNumber || selectedTrip._id.slice(-6).toUpperCase()}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {selectedTrip.fromLocation || "Origin"}
                        </span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {selectedTrip.toLocation || "Destination"}
                        </span>
                        <span>•</span>
                        <span>
                          Driver:{" "}
                          <strong className="text-slate-700 dark:text-slate-300">
                            {selectedTrip.driver
                              ? `${selectedTrip.driver.firstName ?? ""} ${selectedTrip.driver.lastName ?? ""}`.trim() ||
                                selectedTrip.driver.email ||
                                "Driver"
                              : "Unassigned"}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Agency:{" "}
                          <strong className="text-slate-700 dark:text-slate-300">
                            {selectedTrip.agencyName || selectedTrip.customer || "Direct / No Agency"}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Vehicle:{" "}
                          <strong className="font-mono text-slate-700 dark:text-slate-300">
                            {selectedTrip.vehicle?.vehicleNumber || "Unassigned"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 min-h-0 flex-1">
                  <TripExpensesPane trip={selectedTrip} onRefresh={loadTrips} />
                </div>
              </>
            ) : (
              !tripLoading && (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
                  <Route className="h-12 w-12 text-slate-300 dark:text-slate-500" />
                  <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                    No trip selected
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Select a trip from the left sidebar to manage its operational and driver personal expenses
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
};

export default ExpensesPage;
