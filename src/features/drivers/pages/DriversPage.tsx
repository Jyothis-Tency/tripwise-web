import { useState, useEffect, useCallback } from 'react';
import { Search, UserPlus, Users } from 'lucide-react';
import type { Driver } from '../api';
import { fetchDrivers } from '../api';
import { DriverCard } from '../components/DriverCard';
import { DriverDetail } from '../components/DriverDetail';
import { AddDriverModal } from '../components/AddDriverModal';
import { EditDriverModal } from '../components/EditDriverModal';

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDrivers({ search: search || undefined, limit: 100 });
      const list = res.drivers ?? (res as any) ?? [];
      setDrivers(Array.isArray(list) ? list : []);
      setSelectedIdx(null);
    } catch {
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(loadDrivers, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [loadDrivers, search]);

  const selectedDriver = selectedIdx !== null ? (drivers[selectedIdx] ?? null) : null;

  return (
    <div className="flex h-full gap-4 p-4 overflow-hidden relative">
      {/* Left: Driver List */}
      <div className={`w-full lg:w-[320px] xl:w-[360px] shrink-0 flex-col bg-white rounded-xl border border-slate-200 overflow-hidden transition-all ${
        selectedDriver ? 'hidden lg:flex' : 'flex'
      }`}>
        {/* Search + Add */}
        <div className="px-3 py-3 border-b border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-800">Drivers</h2>
              <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">{drivers.length}</span>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition"
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
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
            />
          </div>
        </div>

        {/* Driver List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[72px] rounded-xl bg-slate-100 animate-pulse" />
            ))
          ) : drivers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-500">No drivers found</p>
              <p className="text-xs text-slate-400 mt-1">Try a different search or add a new driver</p>
            </div>
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
        selectedDriver ? 'flex flex-col' : 'hidden lg:flex flex-col'
      }`}>
        {selectedDriver ? (
          <DriverDetail
            key={selectedDriver._id}
            driver={selectedDriver}
            onBack={() => setSelectedIdx(null)}
            onDeleted={() => loadDrivers()}
            onUpdated={() => loadDrivers()}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200">
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
