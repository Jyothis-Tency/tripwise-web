import { useState, useEffect, useCallback } from 'react';
import { Search, UserPlus, Users, ArrowLeft } from 'lucide-react';
import type { Driver, DriverBlockFilter } from '../api';
import { fetchDrivers } from '../api';
import { DriverCard } from '../components/DriverCard';
import { DriverDetail } from '../components/DriverDetail';
import { AddDriverModal } from '../components/AddDriverModal';
import { EditDriverModal } from '../components/EditDriverModal';
import { EmptyState } from '../../../components/ui/EmptyState';

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [blockFilter, setBlockFilter] = useState<DriverBlockFilter>('unblocked');
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

  const selectedDriver = selectedIdx !== null ? (drivers[selectedIdx] ?? null) : null;

  return (
    <div className="flex h-full gap-0 md:gap-4 p-0 md:p-4 overflow-hidden relative">
      {/* Left: Driver List */}
      <div className={`w-full md:w-[300px] lg:w-[320px] xl:w-[360px] shrink-0 flex-col bg-white md:rounded-xl border-r md:border border-slate-200 overflow-hidden transition-all ${
        selectedDriver ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Search + Add */}
        <div className="px-3 py-3 border-b border-slate-100 space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-blue-500" />
              <h2 className="text-sm font-bold text-slate-800">Drivers</h2>
              <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">{drivers.length}</span>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-2.5 py-2 rounded-lg transition active:scale-[0.97]"
            >
              <UserPlus className="h-3 w-3" /> Add
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search drivers…"
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 transition-colors"
            />
          </div>
          <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            {([
              { v: 'unblocked' as const, label: 'Unblocked' },
              { v: 'blocked' as const, label: 'Blocked' },
              { v: 'all' as const, label: 'All' },
            ]).map(({ v, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => setBlockFilter(v)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                  blockFilter === v
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Driver List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[72px] rounded-xl bg-slate-100 animate-pulse" />
            ))
          ) : drivers.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8 text-slate-300" />}
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
      <div className={`flex-1 min-w-0 overflow-hidden transition-all ${
        selectedDriver ? 'flex flex-col' : 'hidden md:flex flex-col'
      }`}>
        {selectedDriver ? (
          <>
            {/* Mobile back button */}
            <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-white shrink-0">
              <button
                onClick={() => setSelectedIdx(null)}
                className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
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
          <div className="h-full flex flex-col items-center justify-center bg-white md:rounded-xl md:border border-slate-200">
            <Users className="h-12 w-12 text-slate-200 mb-4" />
            <p className="text-sm font-semibold text-slate-400">No driver selected</p>
            <p className="text-xs text-slate-300 mt-1">Select a driver from the list to view details</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddDriverModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); loadDrivers(); }}
        />
      )}
      {editingDriver && (
        <EditDriverModal
          driver={editingDriver}
          onClose={() => setEditingDriver(null)}
          onSuccess={() => { setEditingDriver(null); loadDrivers(); }}
        />
      )}
    </div>
  );
}
