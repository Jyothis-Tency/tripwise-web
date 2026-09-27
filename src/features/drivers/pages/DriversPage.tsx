import { useState, useEffect, useCallback } from "react";
import { Search, UserPlus, Users, ArrowLeft } from "lucide-react";
import type { Driver, DriverBlockFilter } from "../api";
import { fetchDrivers } from "../api";
import { DriverCard } from "../components/DriverCard";
import { DriverDetail } from "../components/DriverDetail";
import { AddDriverModal } from "../components/AddDriverModal";
import { EditDriverModal } from "../components/EditDriverModal";
import { EmptyState } from "../../../components/ui/EmptyState";

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [blockFilter, setBlockFilter] =
    useState<DriverBlockFilter>("unblocked");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDrivers({
        search: search || undefined,
        limit: 100,
        blockFilter,
      });
      const list = res.drivers ?? (res as any) ?? [];
      setDrivers(Array.isArray(list) ? list : []);
      setSelectedIdx(null);
    } catch {
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  }, [search, blockFilter]);

  useEffect(() => {
    const t = setTimeout(loadDrivers, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [loadDrivers, search]);

  const selectedDriver =
    selectedIdx !== null ? (drivers[selectedIdx] ?? null) : null;

  return (
    <div className="relative flex h-full gap-0 overflow-hidden p-0 md:gap-4 md:p-4 dark:bg-[#0e121d]">
      {/* Left: Driver List */}
      <div
        className={`w-full shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-all md:w-[300px] md:rounded-xl md:border lg:w-[320px] xl:w-[360px] dark:border-[#1e2638] dark:bg-[#0e121d]/80 ${
          selectedDriver ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="shrink-0 space-y-2.5 border-b border-slate-100 px-3 py-3 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300">
                <Users className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                Drivers
              </h2>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                {drivers.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 active:scale-[0.97] dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              <UserPlus className="h-3 w-3" /> Add
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search drivers…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-2 pl-8 pr-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-white/10"
            />
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100/90 p-1 text-center text-xs font-medium text-slate-500 dark:bg-white/5">
            {(
              [
                { v: "unblocked" as const, label: "Unblocked" },
                { v: "blocked" as const, label: "Blocked" },
                { v: "all" as const, label: "All" },
              ] as const
            ).map(({ v, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => setBlockFilter(v)}
                className={`rounded-md py-1.5 transition ${
                  blockFilter === v
                    ? "border border-slate-200/60 bg-white font-semibold text-indigo-700 shadow-xs dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300"
                    : "font-medium hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[72px] animate-pulse rounded-xl bg-slate-100 dark:bg-white/5"
              />
            ))
          ) : drivers.length === 0 ? (
            <EmptyState
              icon={
                <Users className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              }
              title="No drivers found"
              description="Try a different search or add a new driver"
            />
          ) : (
            drivers.map((d, i) => (
              <DriverCard
                key={d._id}
                driver={d}
                isSelected={i === selectedIdx}
                onSelect={() => setSelectedIdx(i)}
                onEdit={() => setEditingDriver(d)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: Detail Panel */}
      <div
        className={`min-w-0 flex-1 overflow-hidden transition-all ${
          selectedDriver ? "flex flex-col" : "hidden flex-col md:flex"
        }`}
      >
        {selectedDriver ? (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 md:hidden dark:border-[#1e2638] dark:bg-[#0e121d]/80">
              <button
                type="button"
                onClick={() => setSelectedIdx(null)}
                className="flex items-center gap-1 text-sm font-medium text-slate-600 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <ArrowLeft className="h-4 w-4" /> Back to list
              </button>
            </div>
            <DriverDetail
              key={selectedDriver._id}
              driver={selectedDriver}
              onBack={() => setSelectedIdx(null)}
              onBlockChange={() => loadDrivers()}
              onUpdated={() => loadDrivers()}
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center border-slate-200 bg-white md:rounded-xl md:border dark:border-[#1e2638] dark:bg-[#0e121d]/80">
            <Users className="mb-4 h-12 w-12 text-slate-200 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">
              No driver selected
            </p>
            <p className="mt-1 text-xs text-slate-300 dark:text-slate-600">
              Select a driver from the list to view details
            </p>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddDriverModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadDrivers();
          }}
        />
      )}
      {editingDriver && (
        <EditDriverModal
          driver={editingDriver}
          onClose={() => setEditingDriver(null)}
          onSuccess={() => {
            setEditingDriver(null);
            loadDrivers();
          }}
        />
      )}
    </div>
  );
}
