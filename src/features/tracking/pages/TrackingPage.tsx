import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Car,
  ChevronRight,
  User,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  X,
  AlertTriangle,
  Info,
  Navigation,
  RefreshCw,
} from 'lucide-react';
import { fetchTrackingVehicles, completeTrip, type TrackingVehicle } from '../api';

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function statusBadgeCls(status?: string) {
  switch ((status ?? '').toLowerCase()) {
    case 'in_progress': return 'border-green-200 bg-green-50 text-green-700';
    case 'scheduled': return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    case 'completed': return 'border-slate-200 bg-slate-50 text-slate-600';
    default: return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function statusLabel(status?: string) {
  switch ((status ?? '').toLowerCase()) {
    case 'in_progress': return 'In Progress';
    case 'scheduled': return 'Scheduled';
    case 'completed': return 'Completed';
    default: return status ?? 'Unknown';
  }
}

function formatDate(d?: string) {
  if (!d) return '—';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function driverName(driver: TrackingVehicle['driver']): string {
  if (!driver) return 'No Driver';
  if (driver.fullName) return driver.fullName;
  if (driver.firstName && driver.lastName) return `${driver.firstName} ${driver.lastName}`;
  return 'No Driver';
}


// ═══════════════════════════════════════════════════════════════════════════════
// MODAL SHELL
// ═══════════════════════════════════════════════════════════════════════════════

function ModalShell({ title, onClose, children, maxWidth = 'max-w-md' }: {
  title: string; onClose: () => void; children: React.ReactNode; maxWidth?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} onClick={e => e.target === ref.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`w-full ${maxWidth} rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INFO DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h4 className="text-base font-semibold text-slate-800 mb-3">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, valueColor }: { label: string; value?: string | number | null; valueColor?: string }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500 shrink-0 mr-4">{label}</span>
      <span className={`text-sm font-medium text-right ${valueColor ?? 'text-slate-800'}`}>{value ?? '—'}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKING CARD (Left List)
// ═══════════════════════════════════════════════════════════════════════════════

function TrackingCardSkeleton() {
  return (
    <div className="w-full rounded-xl border border-slate-100 p-4 animate-pulse bg-white">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-50" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-28 rounded bg-slate-50" />
          <div className="h-4 w-20 rounded bg-slate-50" />
        </div>
      </div>
      <div className="h-4 w-2/3 mt-3 rounded bg-slate-50" />
      <div className="h-4 w-1/2 mt-1.5 rounded bg-slate-50" />
    </div>
  );
}

function TrackingCard({ item, isSelected, onSelect }: {
  item: TrackingVehicle; isSelected: boolean; onSelect: () => void;
}) {
  const v = item.vehicle;
  const trip = item.activeTrip;
  const drv = item.driver;
  const tripStatus = (trip?.status ?? 'scheduled').toLowerCase();

  return (
    <button type="button" onClick={onSelect}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        isSelected
          ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}>

      {/* Top row: icon + vehicle number + status */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
          <Car className="h-6 w-6 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-slate-800 truncate">{v.vehicleNumber ?? 'N/A'}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`h-2.5 w-2.5 rounded-full ${tripStatus === 'in_progress' ? 'bg-green-500' : 'bg-indigo-400'}`} />
            <span className={`text-sm font-medium ${tripStatus === 'in_progress' ? 'text-green-600' : 'text-indigo-500'}`}>
              {statusLabel(trip?.status)}
            </span>
          </div>
        </div>
      </div>

      {/* Driver */}
      <div className="flex items-center gap-2 mt-3 text-slate-600">
        <User className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="text-sm truncate font-medium">{driverName(drv)}</span>
      </div>

      {/* Route */}
      {trip?.from && trip?.to && (
        <div className="flex items-center gap-2 mt-1.5 text-slate-500">
          <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="text-sm truncate">{trip.from} → {trip.to}</span>
        </div>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL TABS
// ═══════════════════════════════════════════════════════════════════════════════

function TripInfoTab({ item, onComplete }: { item: TrackingVehicle; onComplete: () => void }) {
  const trip = item.activeTrip;
  if (!trip) return <p className="py-8 text-center text-sm text-slate-400">No active trip data</p>;

  const tripId = trip._id ?? trip.id ?? '';
  const isInProgress = (trip.status ?? '').toLowerCase() === 'in_progress';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <InfoCard title="Trip Overview">
          <InfoRow label="Trip Number" value={trip.tripNumber} />
          <InfoRow label="Status" value={statusLabel(trip.status)} />
          <InfoRow label="Priority" value={trip.priority ?? 'Normal'} />
        </InfoCard>
      </div>

      <InfoCard title="Route Information">
        <InfoRow label="From" value={trip.from} />
        <InfoRow label="To" value={trip.to} />
        <InfoRow label="Distance" value={trip.distance != null ? `${trip.distance}` : undefined} />
      </InfoCard>

      <InfoCard title="Schedule">
        <InfoRow label="Start Date" value={formatDate(trip.startDate)} />
        <InfoRow label="Expected End" value={formatDate(trip.expectedEndDate)} />
      </InfoCard>

      <div className="md:col-span-2">
        <InfoCard title="Customer Information">
          <InfoRow label="Customer" value={trip.customer} />
          <InfoRow label="Care Of Name" value={trip.careOf?.name} />
          <InfoRow label="Care Of Phone" value={trip.careOf?.phone} />
        </InfoCard>
      </div>

      {isInProgress && tripId && (
        <div className="md:col-span-2">
          <InfoCard title="Trip Actions">
            <button type="button" onClick={onComplete}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3.5 text-base font-semibold text-white hover:bg-emerald-600 transition shadow-sm hover:shadow-md">
              <CheckCircle2 className="h-5 w-5" />
              Complete Trip
            </button>
            <div className="flex items-start gap-2 mt-3 px-4 py-3 rounded-lg bg-indigo-50 text-xs text-slate-600">
              <Info className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
              <span>This will mark the trip as completed. The vehicle will be available for new trips.</span>
            </div>
          </InfoCard>
        </div>
      )}
    </div>
  );
}

function DriverInfoTab({ item }: { item: TrackingVehicle }) {
  const drv = item.driver;
  const v = item.vehicle;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <InfoCard title="Driver Profile">
        <InfoRow label="Name" value={driverName(drv)} />
        <InfoRow label="Phone" value={drv?.phone} />
        <InfoRow label="Email" value={drv?.email} />
        <InfoRow label="Driver ID" value={drv?._id ?? drv?.id} />
      </InfoCard>

      <InfoCard title="Vehicle Information">
        <InfoRow label="Vehicle Number" value={v.vehicleNumber} />
        <InfoRow label="Vehicle Type" value={v.vehicleType} />
        <InfoRow label="Vehicle Model" value={v.vehicleModel} />
        <InfoRow label="Vehicle Year" value={v.vehicleYear != null ? String(v.vehicleYear) : undefined} />
      </InfoCard>
    </div>
  );
}

function ExpenseInfoTab({ item }: { item: TrackingVehicle }) {
  const trip = item.activeTrip;
  if (!trip) return <p className ="py-8 text-center text-sm text-slate-400">No trip data</p>;

  const agencyCost = trip.agencyCost != null ? Number(trip.agencyCost) : 0;
  const cabCost = trip.cabCost != null ? Number(trip.cabCost) : 0;
  const ownerProfit = trip.ownerProfit != null ? Number(trip.ownerProfit) : 0;
  const expenses = trip.expenses ?? [];

  // Categorise expenses
  let fuel = 0, toll = 0, taxPermit = 0, parking = 0, other = 0;
  expenses.forEach(e => {
    const amt = Number(e.amount ?? 0);
    switch ((e.type ?? '').toLowerCase()) {
      case 'fuel': fuel += amt; break;
      case 'toll': toll += amt; break;
      case 'tax': case 'permit': taxPermit += amt; break;
      case 'parking': parking += amt; break;
      default: other += amt;
    }
  });
  const totalExpenses = fuel + toll + taxPermit + parking + other;

  return (
    <div className="space-y-4">
      <InfoCard title="Cost Summary">
        <InfoRow label="Agency Name" value={trip.agencyName} />
        <InfoRow label="Agency Cost" value={`₹${agencyCost.toLocaleString('en-IN')}`} />
        <InfoRow label="Cab Cost" value={`₹${cabCost.toLocaleString('en-IN')}`} />
        <div className="border-t border-slate-100 my-1" />
        <InfoRow label="Owner Profit" value={`₹${ownerProfit.toLocaleString('en-IN')}`} valueColor="text-emerald-600 font-bold" />
        <InfoRow label="Advance" value={`₹${(trip.advance != null ? Number(trip.advance) : 0).toLocaleString('en-IN')}`} />
      </InfoCard>

      <InfoCard title="Cab Expenses Breakdown">
        <ExpenseRow icon="⛽" label="Petrol / Diesel" amount={fuel} />
        <ExpenseRow icon="🛣️" label="Toll Charges" amount={toll} />
        <ExpenseRow icon="📋" label="Tax & Permit" amount={taxPermit} />
        <ExpenseRow icon="🅿️" label="Parking" amount={parking} />
        <ExpenseRow icon="📦" label="Other" amount={other} />
        <div className="border-t border-slate-100 my-1" />
        <InfoRow label="Total Cab Expenses" value={`₹${totalExpenses.toLocaleString('en-IN')}`} valueColor="text-orange-600 font-bold" />
      </InfoCard>
    </div>
  );
}

function ExpenseRow({ icon, label, amount }: { icon: string; label: string; amount: number }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 text-base">{icon}</span>
      <span className="flex-1 text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800">₹{amount.toLocaleString('en-IN')}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETE TRIP MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function CompleteTripModal({ tripId, startKm, onClose, onCompleted }: {
  tripId: string; startKm?: number; onClose: () => void; onCompleted: () => void;
}) {
  const [endKm, setEndKm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const parsed = parseFloat(endKm.trim());
    if (!endKm.trim()) { setErr('Ending KM is required'); return; }
    if (isNaN(parsed)) { setErr('Please enter a valid number'); return; }
    if (parsed < 0) { setErr('KM cannot be negative'); return; }
    if (startKm != null && parsed < startKm) { setErr('Ending KM must be ≥ starting KM'); return; }

    setSubmitting(true);
    try {
      await completeTrip(tripId, parsed);
      onCompleted();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Failed to complete trip');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Complete Trip" onClose={onClose} maxWidth="max-w-sm">
      <div className="p-6 space-y-4">
        {startKm != null && (
          <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-slate-700">
            <Info className="h-4 w-4 text-indigo-400 shrink-0" />
            <span>Starting KM: <strong>{startKm}</strong></span>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="endKm" className="text-xs font-medium text-slate-600">Ending KM <span className="text-red-500">*</span></label>
          <input id="endKm" type="number" value={endKm} onChange={e => { setEndKm(e.target.value); setErr(null); }}
            placeholder="Enter ending odometer reading"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>

        <p className="text-xs text-slate-400">
          Please enter the ending odometer reading to complete the trip.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
            {submitting ? 'Completing…' : 'Complete Trip'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function DetailPanel({ item, onBack, onRefresh }: {
  item: TrackingVehicle; onBack: () => void; onRefresh: () => void;
}) {
  const [tab, setTab] = useState<'trip' | 'driver' | 'expense'>('trip');
  const [showComplete, setShowComplete] = useState(false);

  const v = item.vehicle;
  const trip = item.activeTrip;
  const tripStatus = trip?.status ?? 'scheduled';

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'trip', label: 'TRIP INFO' },
    { key: 'driver', label: 'DRIVER INFO' },
    { key: 'expense', label: 'EXPENSE INFO' },
  ];

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 lg:px-6 py-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} 
            className="lg:hidden flex h-10 w-10 items-center justify-center -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 leading-tight">{v.vehicleNumber}</h3>
            {trip?.from && trip?.to && (
              <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                {trip.from} <ChevronRight className="h-3.5 w-3.5" /> {trip.to}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full border px-3.5 py-1.5 text-xs uppercase tracking-wider font-bold ${statusBadgeCls(tripStatus)}`}>
            {statusLabel(tripStatus)}
          </span>
          <button type="button" onClick={onRefresh} 
            className="flex h-10 w-10 items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full transition-colors active:rotate-180">
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="sticky top-[73px] z-10 flex border-b border-slate-200 bg-white/90 backdrop-blur-md shrink-0 overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`whitespace-nowrap px-6 py-4 text-xs font-bold tracking-widest transition-all border-b-2 relative ${
              tab === t.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}>
            {t.label}
            {tab === t.key && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-500 rounded-t-full shadow-[0_-1px_4px_rgba(99,102,241,0.3)]" />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {tab === 'trip' && <TripInfoTab item={item} onComplete={() => setShowComplete(true)} />}
        {tab === 'driver' && <DriverInfoTab item={item} />}
        {tab === 'expense' && <ExpenseInfoTab item={item} />}
      </div>

      {/* Complete trip modal */}
      {showComplete && trip && (
        <CompleteTripModal
          tripId={trip._id ?? trip.id ?? ''}
          startKm={trip.startKilometers}
          onClose={() => setShowComplete(false)}
          onCompleted={() => { setShowComplete(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function TrackingPage() {
  const [vehicles, setVehicles] = useState<TrackingVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const selected = selectedIdx !== null ? vehicles[selectedIdx] ?? null : null;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchTrackingVehicles();
      setVehicles(data);
      setSelectedIdx(null);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load tracking data');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* LEFT: list panel */}
      <div className={`flex w-full lg:w-80 xl:w-96 shrink-0 flex-col border-r border-slate-200 bg-white transition-all ${
        selectedIdx !== null ? 'hidden lg:flex' : 'flex'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Active Trips</h2>
          </div>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={load} 
              className="flex h-9 w-9 items-center justify-center text-indigo-500 hover:bg-indigo-50 rounded-full transition-all active:scale-95 active:rotate-180"
              title="Refresh tracking data">
              <RefreshCw className="h-5 w-5" />
            </button>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-600">
              {vehicles.length}
            </span>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TrackingCardSkeleton key={i} />
            ))
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <AlertTriangle className="h-12 w-12 text-red-300" />
              <p className="text-base text-red-500">{error}</p>
              <button type="button" onClick={load} className="text-sm text-indigo-500 underline">Retry</button>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <Navigation className="h-14 w-14 text-slate-300" />
              <p className="text-base font-medium text-slate-500">No active trips</p>
              <p className="text-sm text-slate-400">Vehicles with in-progress or scheduled trips will appear here</p>
            </div>
          ) : (
            vehicles.map((v, i) => (
              <TrackingCard key={v.vehicle.id ?? v.vehicle._id ?? i} item={v} isSelected={i === selectedIdx}
                onSelect={() => setSelectedIdx(i)} />
            ))
          )}
        </div>
      </div>

      {/* RIGHT: detail panel */}
      <div className={`flex-1 overflow-hidden transition-all ${
        selectedIdx !== null ? 'flex flex-col' : 'hidden lg:flex flex-col'
      }`}>
        {selected ? (
          <DetailPanel item={selected} onBack={() => setSelectedIdx(null)} onRefresh={load} />
        ) : !loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Navigation className="mx-auto h-16 w-16 text-slate-300" />
              <p className="mt-4 text-base font-medium text-slate-500">No vehicle selected</p>
              <p className="mt-1.5 text-sm text-slate-400">Select a vehicle from the list to view tracking details</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
