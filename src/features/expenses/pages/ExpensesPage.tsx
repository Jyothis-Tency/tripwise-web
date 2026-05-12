import React, { useCallback, useEffect, useState } from "react";
import type { TripWithExpenses } from "../api";
import { fetchTripsWithExpenses } from "../api";
import TripExpenseCard from "../components/TripExpenseCard";
import { VehicleExpensesPane } from "../components/VehicleExpensesPane";
import { fetchVehicles, type Vehicle } from "../../vehicles/api";
import { VehicleListCard } from "../../vehicles/components/VehicleListCard";
import { Car, Search, ChevronLeft } from "lucide-react";

type ExpensesMode = "trip" | "vehicle";

function ModeTabsBar({
  mode,
  setMode,
}: {
  mode: ExpensesMode;
  setMode: (m: ExpensesMode) => void;
}) {
  const tabBtn =
    "flex min-h-0 min-w-0 items-center justify-center rounded-lg px-1.5 py-2 text-center text-xs font-semibold leading-tight sm:px-2";

  return (
    <div
      className="grid h-10 w-[min(100%,17.5rem)] shrink-0 grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
      role="tablist"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "vehicle"}
        className={`${tabBtn} ${
          mode === "vehicle"
            ? "bg-indigo-500 text-white shadow-sm"
            : "bg-transparent text-slate-500 hover:text-slate-700"
        }`}
        onClick={() => setMode("vehicle")}
      >
        Vehicle expenses
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "trip"}
        className={`${tabBtn} ${
          mode === "trip"
            ? "bg-indigo-500 text-white shadow-sm"
            : "bg-transparent text-slate-500 hover:text-slate-700"
        }`}
        onClick={() => setMode("trip")}
      >
        Trip expense
      </button>
    </div>
  );
}

const ExpensesPage: React.FC = () => {
  const [mode, setMode] = useState<ExpensesMode>("vehicle");

  const [search, setSearch] = useState("");
  const [trips, setTrips] = useState<TripWithExpenses[]>([]);
  const [tripLoading, setTripLoading] = useState(true);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null,
  );

  const loadTrips = useCallback(async () => {
    setTripLoading(true);
    try {
      const res = await fetchTripsWithExpenses({
        limit: 100,
        search: search || undefined,
      });
      setTrips(res.trips);
    } catch {
      setTrips([]);
    } finally {
      setTripLoading(false);
    }
  }, [search]);

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

  const selectedVehicle =
    selectedVehicleId != null
      ? vehicles.find((v) => v._id === selectedVehicleId) ?? null
      : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      {mode === "vehicle" ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            className={`flex w-full shrink-0 flex-col border-r border-slate-200 bg-white transition-all lg:w-72 xl:w-80 ${
              selectedVehicleId ? "hidden lg:flex" : "flex"
            }`}
          >
            <div className="flex justify-end border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
              <ModeTabsBar mode={mode} setMode={setMode} />
            </div>
            <div className="relative border-b border-slate-100 px-3 py-2">
              <Search className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
                placeholder="Search vehicles..."
                className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-3 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
              {vehicleLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-xl bg-slate-100"
                  />
                ))
              ) : vehicles.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Car className="h-10 w-10 text-slate-300" />
                  <p className="text-sm text-slate-400">No vehicles found</p>
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
            className={`min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 ${
              selectedVehicleId ? "flex flex-col" : "hidden lg:flex"
            }`}
          >
            <div className="mb-4 flex shrink-0 justify-end">
              <ModeTabsBar mode={mode} setMode={setMode} />
            </div>
            {selectedVehicle ? (
              <>
                <div className="mb-4 flex items-center gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setSelectedVehicleId(null)}
                    className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                    aria-label="Back to vehicle list"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Vehicle
                    </p>
                    <p className="text-lg font-bold text-slate-900">
                      {selectedVehicle.vehicleNumber}
                    </p>
                  </div>
                </div>
                <div className="hidden border-b border-slate-200 pb-3 lg:block">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Vehicle expenses
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {selectedVehicle.vehicleNumber}
                  </p>
                  <p className="text-sm text-slate-500">
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
                  <Car className="h-12 w-12 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-500">
                    No vehicle selected
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Select a vehicle from the list to manage its expenses
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-24 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              placeholder="Search trips…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 sm:max-w-md"
            />
            <div className="flex justify-end sm:shrink-0">
              <ModeTabsBar mode={mode} setMode={setMode} />
            </div>
          </div>
          {tripLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="mb-2.5 h-16 animate-pulse rounded-xl bg-slate-200"
              />
            ))
          ) : trips.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <div className="mb-2 text-5xl">📦</div>
              <p className="text-sm">
                No trips found. Try another search or create a trip first.
              </p>
            </div>
          ) : (
            trips.map((t, i) => (
              <TripExpenseCard
                key={t._id || (t as { id?: string }).id || i}
                trip={t}
                onRefresh={loadTrips}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ExpensesPage;
