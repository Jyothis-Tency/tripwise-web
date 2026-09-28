import { useState, useEffect, useCallback, useRef } from "react";
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
  const selectedIdRef = useRef<string | null>(null);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDrivers({
        search: search || undefined,
        limit: 100,
        blockFilter,
      });
      const list = res.drivers ?? (res as any) ?? [];
      const next = Array.isArray(list) ? list : [];
      setDrivers(next);
      const keepId = selectedIdRef.current;
      if (keepId) {
        const idx = next.findIndex((d) => d._id === keepId);
        setSelectedIdx(idx >= 0 ? idx : null);
        if (idx < 0) selectedIdRef.current = null;
      } else {
        setSelectedIdx(null);
      }
    } catch {
      setDrivers([]);
      setSelectedIdx(null);
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

  const selectDriver = (i: number) => {
    setSelectedIdx(i);
    selectedIdRef.current = drivers[i]?._id ?? null;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-main)]">
      {/* Page header — Stitch top */}
      <div className="hidden shrink-0 items-end justify-between border-b border-slate-200/80 px-5 py-4 sm:flex sm:px-7 dark:border-[#1e2638]">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-[#eef0ff]">
            Drivers
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-[#8d94b8]">
            Manage your team, logins and documents
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-0 p-0 sm:gap-5 sm:p-5 sm:pt-4">
        {/* Left: Driver list card */}
        <section
          className={`flex w-full shrink-0 flex-col overflow-hidden border-slate-200 bg-[var(--bg-card)] transition-all sm:w-[340px] sm:rounded-2xl sm:border lg:w-[360px] dark:border-[#252c4d] ${
            selectedDriver ? "hidden sm:flex" : "flex"
          }`}
        >
          <div className="shrink-0 space-y-3 border-b border-slate-100 px-4 pb-3 pt-4 dark:border-[#252c4d]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-[#eef0ff]">
                Drivers
                <span className="ml-1.5 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-600 dark:bg-[#242a57] dark:text-[#a5b4fc]">
                  {drivers.length}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-bold text-white shadow-[0_6px_16px_-6px_#4f46e5] transition hover:-translate-y-px active:scale-[0.98]"
              >
                <UserPlus className="h-3.5 w-3.5" /> Add driver
              </button>
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-[var(--bg-main)] px-3 transition focus-within:border-indigo-500 dark:border-[#252c4d]">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone…"
                className="w-full border-0 bg-transparent py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-[#eef0ff] dark:placeholder:text-[#8d94b8]"
              />
            </label>

            <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--bg-main)] p-1">
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
                  className={`rounded-[9px] py-1.5 text-xs font-semibold transition ${
                    blockFilter === v
                      ? "bg-[var(--bg-card)] font-bold text-indigo-600 shadow-sm dark:text-[#a5b4fc]"
                      : "text-slate-500 hover:text-slate-800 dark:text-[#8d94b8] dark:hover:text-[#eef0ff]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[64px] animate-pulse rounded-[14px] bg-slate-100 dark:bg-white/5"
                />
              ))
            ) : drivers.length === 0 ? (
              <EmptyState
                icon={
                  <Users className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                }
                title="No drivers found"
                description="Try another name or switch the filter above."
              />
            ) : (
              drivers.map((d, i) => (
                <DriverCard
                  key={d._id}
                  driver={d}
                  index={i}
                  isSelected={i === selectedIdx}
                  onSelect={() => selectDriver(i)}
                />
              ))
            )}
          </div>
        </section>

        {/* Right: Detail panel */}
        <section
          className={`min-w-0 flex-1 overflow-hidden border-slate-200 bg-[var(--bg-card)] transition-all sm:rounded-2xl sm:border dark:border-[#252c4d] ${
            selectedDriver ? "flex flex-col" : "hidden flex-col sm:flex"
          }`}
        >
          {selectedDriver ? (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-2 sm:hidden dark:border-[#252c4d]">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIdx(null);
                    selectedIdRef.current = null;
                  }}
                  className="flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-[#8d94b8]"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              </div>
              <DriverDetail
                key={selectedDriver._id}
                driver={selectedDriver}
                avatarIndex={selectedIdx ?? 0}
                onBack={() => {
                  setSelectedIdx(null);
                  selectedIdRef.current = null;
                }}
                onEdit={() => setEditingDriver(selectedDriver)}
                onBlockChange={() => loadDrivers()}
                onUpdated={() => loadDrivers()}
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <Users className="mb-3 h-10 w-10 text-slate-200 dark:text-slate-600" />
              <p className="text-[15px] font-bold text-slate-800 dark:text-[#eef0ff]">
                Select a driver
              </p>
              <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-[#8d94b8]">
                Pick someone from the list to see their profile.
              </p>
            </div>
          )}
        </section>
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
