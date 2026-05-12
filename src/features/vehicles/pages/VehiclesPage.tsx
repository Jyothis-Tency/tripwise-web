import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Car,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  History,
  Pencil,
  Plus,
  Search,
  UserCheck,
  UserPlus,
  AlertTriangle,
  Calculator,
  ArrowLeft,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { AgencyNameCombobox } from '../../../components/AgencyNameCombobox';
import {
  fetchVehicles,
  fetchVehicleById,
  fetchVehicleHistoryDetailed,
  fetchDriversList,
  createVehicle,
  updateVehicle,
  assignDriverToVehicle,
  unassignDriverFromVehicle,
  assignDriverToTrip,
  unassignDriverFromTripApi,
  createTrip,
  updateTrip,
  fetchTripById,
  cancelTrip,
  type Vehicle,
  type TripItem,
  type DriverItem,
  type HistoryTripItem,
  type VehicleHistoryResponse,
} from '../api';
import { VehicleListCard } from '../components/VehicleListCard';

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const VEHICLE_TYPES = ['Car', 'Traveller', 'Bus', 'Van'];
const VEHICLE_STATUSES = ['Available', 'On Trip', 'Maintenance', 'Inactive'];

function statusBadgeCls(status?: string) {
  switch ((status ?? '').toLowerCase()) {
    case 'available': return 'bg-green-100 text-green-700 border-green-200';
    case 'on trip': case 'on_trip': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case 'maintenance': case 'under maintenance': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'inactive': return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'scheduled': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'in_progress': case 'in progress': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case 'completed': return 'bg-green-100 text-green-700 border-green-200';
    case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function formatDate(d?: string) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function formatTimeIst(v?: string | Date | null) {
  if (!v) return '—';
  try {
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(v);
  }
}

function driverDisplayName(d: DriverItem) {
  return (d.fullName ?? d.name ?? `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim()) || 'Unknown';
}

function tripDriverName(t: TripItem) {
  const dr = t.driver;
  if (!dr) return null;
  return (dr.fullName ?? dr.name ?? `${dr.firstName ?? ''} ${dr.lastName ?? ''}`.trim()) || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UI
// ═══════════════════════════════════════════════════════════════════════════════

const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

function Field({ label, id, required, children }: { label: string; id: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-600">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</label>
      {children}
    </div>
  );
}

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}
function ModalShell({ title, onClose, children, maxWidth = 'max-w-lg' }: ModalShellProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
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

const NUMBER_FIELDS = new Set([
  'distance', 'agencyCost', 'cabCost', 'driver_salary', 'advance',
  'startKilometers', 'endKilometers', 'amount', 'fare', 'ownerProfit', 'totalPersonalExpense', 'totalExpenses'
]);

function EditableGridField({
  label, value, fieldKey, tripId, highlight, isCurrency
}: {
  label: string; value: string | number; fieldKey: string; tripId: string; highlight?: boolean; isCurrency?: boolean;
}) {
  const initialValue = value == null || value === '' ? '—' : String(value);
  const [editing, setEditing] = useState(false);
  const [displayValue, setDisplayValue] = useState(initialValue);
  const [editValue, setEditValue] = useState(initialValue === '—' ? '' : initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const v = value == null || value === '' ? '—' : String(value);
    setDisplayValue(v);
    setEditValue(v === '—' ? '' : v);
  }, [value]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let val: string | number = editValue;
      if (NUMBER_FIELDS.has(fieldKey)) {
        const parsed = Number(editValue);
        if (editValue.trim() === '' || !Number.isFinite(parsed)) throw new Error('Enter a valid number');
        if (parsed < 0) throw new Error('Negative values are not allowed');
        val = parsed;
      }
      await updateTrip(tripId, { [fieldKey]: val });
      setDisplayValue(NUMBER_FIELDS.has(fieldKey) ? String(val) : (editValue || '—'));
      setEditing(false);
    } catch (err: any) {
      alert(err?.message || err?.response?.data?.message || 'Failed to update field');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => { setEditValue(displayValue === '—' ? '' : displayValue); setEditing(false); };

  if (editing) {
    return (
      <div className="col-span-1">
        <span className="text-slate-400 block mb-0.5 uppercase tracking-wide text-[10px] sm:text-[11px]">{label}</span>
        <div className="flex items-center gap-1 mt-0.5">
          <input autoFocus type={NUMBER_FIELDS.has(fieldKey) ? 'number' : fieldKey.toLowerCase().includes('time') ? 'time' : 'text'}
            value={editValue} onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') cancel(); }}
            className="w-full min-w-[70px] border border-indigo-300 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-indigo-200 bg-white" disabled={saving}/>
          <button type="button" onClick={handleSave} disabled={saving} className="text-emerald-600 p-0.5 hover:text-emerald-700">{saving ? '...' : <Check className="h-3.5 w-3.5"/>}</button>
          <button type="button" onClick={cancel} className="text-slate-400 p-0.5 hover:text-slate-600"><X className="h-3.5 w-3.5"/></button>
        </div>
      </div>
    );
  }
  return (
    <div className="group col-span-1">
      <span className="text-slate-400 block mb-0.5">{label}</span>
      <div className="flex items-center gap-1">
        <span className={`${highlight ? 'font-bold text-indigo-700' : 'font-medium text-slate-700'} truncate`}>
          {isCurrency && displayValue !== '—' && !isNaN(Number(displayValue)) ? `₹${Number(displayValue).toLocaleString('en-IN')}` : displayValue}
        </span>
        <button type="button" onClick={() => { setEditValue(displayValue === '—' ? '' : String(displayValue).replace(/^₹/, '').replace(/,/g, '')); setEditing(true); }}
          className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-slate-400 hover:text-indigo-500 transition-opacity p-0.5" title="Edit inline">
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD / EDIT VEHICLE MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function VehicleModal({ vehicle, onClose, onSaved }: { vehicle?: Vehicle | null; onClose: () => void; onSaved: (v: Vehicle) => void }) {
  const isEdit = !!vehicle;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    vehicleNumber: vehicle?.vehicleNumber ?? '',
    vehicleType: vehicle?.vehicleType ?? '',
    vehicleModel: vehicle?.vehicleModel ?? '',
    vehicleYear: vehicle?.vehicleYear ?? '',
    seats: vehicle?.seats?.toString() ?? '',
    commission: vehicle?.commission?.toString() ?? '',
    status: vehicle?.status ?? 'Available',
  });

  const set = (k: keyof typeof form, upper?: boolean) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: upper ? e.target.value.toUpperCase() : e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicleNumber.trim()) { setError('Vehicle number is required'); return; }
    if (!form.vehicleType) { setError('Vehicle type is required'); return; }
    if (!form.vehicleModel.trim()) { setError('Vehicle name is required'); return; }
    if (!form.vehicleYear.trim()) { setError('Year is required'); return; }
    if (!form.commission.trim()) { setError('Driver Bata is required'); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        vehicleNumber: form.vehicleNumber.trim(),
        vehicleType: form.vehicleType,
        vehicleModel: form.vehicleModel.trim(),
        vehicleYear: form.vehicleYear ? parseInt(form.vehicleYear) : undefined,
        seats: form.seats ? parseInt(form.seats) : undefined,
        commission: form.commission ? parseFloat(form.commission) : undefined,
        ...(isEdit ? { status: form.status } : {}),
      };
      const saved = isEdit && vehicle ? await updateVehicle(vehicle._id, payload) : await createVehicle(payload as any);
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save vehicle');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title={isEdit ? 'Edit Vehicle' : 'Add New Vehicle'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 p-4 sm:p-6">
        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field label="Vehicle Number" id="vnum" required>
            <input id="vnum" value={form.vehicleNumber} onChange={set('vehicleNumber', true)} required
              className={inputCls} placeholder="e.g. KL01AB1234" style={{ textTransform: 'uppercase' }} />
          </Field>
          <Field label="Vehicle Type" id="vtype" required>
            <select id="vtype" value={form.vehicleType} onChange={set('vehicleType')} className={inputCls}>
              <option value="">Select type...</option>
              {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
          </Field>
          <Field label="Vehicle Name" id="vmodel" required>
            <input id="vmodel" value={form.vehicleModel} onChange={set('vehicleModel', true)} required
              className={inputCls} placeholder="e.g. INNOVA" style={{ textTransform: 'uppercase' }} />
          </Field>
          <Field label="Year" id="vyear" required>
            <input id="vyear" value={form.vehicleYear} onChange={set('vehicleYear')} type="number" required
              className={inputCls} placeholder="e.g. 2022" />
          </Field>
          <Field label="Seats (optional)" id="vseats">
            <input id="vseats" value={form.seats} onChange={set('seats')} type="number"
              className={inputCls} placeholder="e.g. 7" />
          </Field>
          <Field label="Driver Bata (%)" id="vcomm" required>
            <input id="vcomm" value={form.commission} onChange={set('commission')} type="number" step="0.1" required
              className={inputCls} placeholder="e.g. 10" />
          </Field>
          {isEdit && (
            <Field label="Status" id="vstatus">
              <select id="vstatus" value={form.status} onChange={set('status')} className={inputCls}>
                {VEHICLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving}
            className="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIP FORM MODAL (Start / Update)
// ═══════════════════════════════════════════════════════════════════════════════

function UpdateTripWrapper({ vehicleId, tripId, onClose, onSaved }: {
  vehicleId: string; tripId: string; onClose: () => void; onSaved: (t: TripItem) => void;
}) {
  const [trip, setTrip] = useState<TripItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTripById(tripId)
      .then(setTrip)
      .catch((err: any) => setError(err?.response?.data?.message ?? 'Failed to load trip details'));
  }, [tripId]);

  if (error) {
    return (
      <ModalShell title="Error" onClose={onClose} maxWidth="max-w-md">
        <div className="p-6 text-center text-red-600">{error}</div>
      </ModalShell>
    );
  }
  if (!trip) {
    return (
      <ModalShell title="Loading..." onClose={onClose} maxWidth="max-w-md">
        <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
      </ModalShell>
    );
  }

  return <TripFormModal vehicleId={vehicleId} trip={trip} onClose={onClose} onSaved={onSaved} />;
}

export function TripFormModal({ vehicleId, trip, onClose, onSaved }: {
  vehicleId: string; trip?: TripItem | null; onClose: () => void;
  onSaved: (t: TripItem) => void;
}) {
  const isUpdate = !!trip;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    from: trip?.from ?? '',
    to: trip?.to ?? '',
    startDate: trip?.startDate ?? (trip?.departureDate ? trip.departureDate.split('T')[0] : ''),
    expectedEndDate: trip?.expectedEndDate ?? '',
    distance: trip?.distance?.toString() ?? '',
    customer: trip?.customer ?? '',
    agencyName: trip?.agencyName ?? '',
    agencyCost: trip?.agencyCost?.toString() ?? trip?.amount?.toString() ?? '',
    cabCost: trip?.cabCost?.toString() ?? '',
    advance: trip?.advance?.toString() ?? '',
    notes: trip?.notes ?? '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const profit = (parseFloat(form.agencyCost || '0') - parseFloat(form.cabCost || '0')).toFixed(2);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.from.trim() || !form.to.trim()) { setError('From and To locations are required'); return; }
    if (!form.agencyName.trim()) { setError('Agency name is required'); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        from: form.from.trim(),
        to: form.to.trim(),
        startDate: form.startDate || undefined,
        expectedEndDate: form.expectedEndDate || undefined,
        departureDate: form.startDate || undefined, // Fallback for old fields
        distance: form.distance ? parseFloat(form.distance) : undefined,
        customer: form.customer.trim() || undefined,
        agencyName: form.agencyName.trim(),
        agencyCost: form.agencyCost ? parseFloat(form.agencyCost) : undefined,
        cabCost: form.cabCost ? parseFloat(form.cabCost) : undefined,
        advance: form.advance ? parseFloat(form.advance) : undefined,
        ownerProfit: profit,
        amount: form.agencyCost ? parseFloat(form.agencyCost) : undefined, // Fallback
        notes: form.notes.trim() || undefined,
      };
      const saved = isUpdate && trip
        ? await updateTrip(trip._id, payload)
        : await createTrip({ vehicleId, ...payload });
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save trip');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title={isUpdate ? 'Update Trip Details' : 'Start New Trip'} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={submit} className="flex flex-col">
        <div className="p-4 sm:p-6 space-y-4">
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="From" id="tfrom" required>
              <input id="tfrom" value={form.from} onChange={set('from')} required className={inputCls} placeholder="Origin city" />
            </Field>
            <Field label="To" id="tto" required>
              <input id="tto" value={form.to} onChange={set('to')} required className={inputCls} placeholder="Destination city" />
            </Field>

            <Field label="Start Date" id="tstartdate">
              <input id="tstartdate" type="date" value={form.startDate} onChange={set('startDate')} className={inputCls} />
            </Field>
            <Field label="Expected End Date" id="tenddate">
              <input id="tenddate" type="date" value={form.expectedEndDate} onChange={set('expectedEndDate')} className={inputCls} />
            </Field>

            <Field label="Distance (km)" id="tdist">
              <input id="tdist" type="number" value={form.distance} onChange={set('distance')} className={inputCls} placeholder="0" />
            </Field>
            <Field label="Customer (Optional)" id="tcus">
              <input id="tcus" value={form.customer} onChange={set('customer')} className={inputCls} placeholder="Customer Name (Optional)" />
            </Field>

            <Field label="Agency Name" id="tagn" required>
              <AgencyNameCombobox
                id="tagn"
                required
                value={form.agencyName}
                onChange={(agencyName) =>
                  setForm((prev) => ({ ...prev, agencyName }))
                }
                inputClassName={inputCls}
                extraSuggestionNames={
                  trip?.agencyName?.trim() ? [trip.agencyName.trim()] : []
                }
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Field label="Agency Cost (₹)" id="tagenC">
              <input id="tagenC" type="number" step="0.01" value={form.agencyCost} onChange={set('agencyCost')} className={inputCls} placeholder="0.00" />
            </Field>
            <Field label="Cab Cost (₹)" id="tcabC">
              <input id="tcabC" type="number" step="0.01" value={form.cabCost} onChange={set('cabCost')} className={inputCls} placeholder="0.00" />
            </Field>
            <Field label="Advance (₹)" id="tadvance">
              <input id="tadvance" type="number" step="0.01" value={form.advance} onChange={set('advance')} className={inputCls} placeholder="0.00" />
            </Field>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-indigo-700">
            <Calculator className="h-5 w-5 shrink-0" />
            <span className="text-sm font-semibold">Owner Profit: ₹{profit}</span>
          </div>

          <Field label="Notes (optional)" id="tnotes">
            <textarea id="tnotes" value={form.notes} onChange={set('notes') as any}
              className={`${inputCls} resize-none`} rows={2} placeholder="Additional details..." />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 p-4 shrink-0 bg-slate-50 rounded-b-xl">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
          <button type="submit" disabled={saving || !form.agencyName.trim()}
            className="rounded-lg bg-indigo-500 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50">
            {saving ? 'Saving…' : isUpdate ? 'Update Trip' : 'Start Trip'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// CANCEL TRIP CONFIRM
// ═══════════════════════════════════════════════════════════════════════════════

function CancelTripModal({ tripId, onClose, onCancelled }: {
  tripId: string; onClose: () => void; onCancelled: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setLoading(true); setError(null);
    try {
      await cancelTrip(tripId);
      onCancelled();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to cancel trip');
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Cancel Trip" onClose={onClose} maxWidth="max-w-sm">
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-900">Are you sure?</p>
            <p className="text-xs text-slate-500 mt-1">This will cancel the trip. This action cannot be undone.</p>
          </div>
        </div>
        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Keep Trip</button>
          <button type="button" onClick={confirm} disabled={loading}
            className="rounded-lg bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
            {loading ? 'Cancelling…' : 'Cancel Trip'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER ASSIGNMENT MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function DriverAssignModal({ vehicleId, tripId, currentDriverName, onClose, onAssigned }: {
  vehicleId: string; tripId?: string; currentDriverName?: string;
  onClose: () => void; onAssigned: (name: string) => void;
}) {
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDriversList().then(setDrivers).catch(() => setError('Failed to load drivers')).finally(() => setLoading(false));
  }, []);

  const filtered = drivers.filter(d => {
    const n = driverDisplayName(d).toLowerCase();
    return n.includes(search.toLowerCase());
  });

  const assign = async (driver: DriverItem) => {
    setAssigning(driver._id); setError(null);
    try {
      if (tripId) {
        await assignDriverToTrip(tripId, driver._id);
      } else {
        await assignDriverToVehicle(vehicleId, driver._id);
      }
      onAssigned(driverDisplayName(driver));
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to assign driver');
      setAssigning(null);
    }
  };

  const hasDriver = currentDriverName && currentDriverName.toLowerCase() !== 'unassigned' && currentDriverName.trim() !== '';

  return (
    <ModalShell title={hasDriver ? 'Change Driver' : 'Assign Driver'} onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col" style={{ maxHeight: '60vh' }}>
        <div className="px-4 pt-4 pb-2">
          {hasDriver && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-700">
              <UserCheck className="h-4 w-4 shrink-0" />
              <span>Current driver: <strong>{currentDriverName}</strong></span>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search drivers..." className={`${inputCls} pl-8`} />
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))
          ) : filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">No drivers found</p>
          ) : (
            filtered.map(driver => {
              const name = driverDisplayName(driver);
              const isCurrent = name === currentDriverName;
              return (
                <button key={driver._id} type="button" onClick={() => assign(driver)} disabled={!!assigning}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition hover:bg-slate-50 disabled:opacity-60 ${
                    isCurrent ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'
                  }`}>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{name}</p>
                    {driver.phone && <p className="text-xs text-slate-400">{driver.phone}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {isCurrent && <span className="text-xs text-indigo-500">Current</span>}
                    {assigning === driver._id
                      ? <span className="text-xs text-slate-400">Assigning…</span>
                      : <UserPlus className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE HISTORY (inline tab)
// ═══════════════════════════════════════════════════════════════════════════════

function VehicleHistoryTab({ vehicle }: { vehicle: Vehicle }) {
  const STATUS_OPTIONS = ['all', 'completed', 'in_progress', 'scheduled', 'cancelled'] as const;

  const [selectedStatus, setSelectedStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all');
  const [startDate, setStartDate] = useState<string>(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState<string>(''); // YYYY-MM-DD

  const [page, setPage] = useState<number>(1);
  const limit = 10;

  const [historyData, setHistoryData] = useState<VehicleHistoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchVehicleHistoryDetailed({
        vehicleId: vehicle._id,
        page,
        limit,
        status: selectedStatus,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setHistoryData(res);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [vehicle._id, page, limit, selectedStatus, startDate, endDate]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const trips = historyData?.trips ?? [];
  const pagination = historyData?.pagination;
  const tripStats = historyData?.tripStats;
  const financialStats = historyData?.financialStats;

  const formatMoney0 = (v: any) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  };

  const resolveDriverName = (t: HistoryTripItem) => {
    if (typeof t.driverName === 'string' && t.driverName.trim()) return t.driverName;
    const dr = t.driver;
    if (!dr) return '—';
    if (typeof dr === 'string') return dr;
    const first = dr.firstName ?? '';
    const last = dr.lastName ?? '';
    const nm = `${first} ${last}`.trim();
    return nm || '—';
  };

  const kmTravelledText = (t: HistoryTripItem) => {
    const s = Number(t.startKilometers);
    const e = Number(t.endKilometers);
    const hasS = Number.isFinite(s);
    const hasE = Number.isFinite(e);
    if (hasS && hasE) return `${Math.max(e - s, 0)} km travelled`;
    if (hasS) return `Start: ${s} km`;
    if (hasE) return `End: ${e} km`;
    return '—';
  };

  const canPrev = (pagination?.current ?? 1) > 1;
  const canNext = pagination?.pages != null ? (pagination.current ?? 1) < pagination.pages : false;

  return (
    <div className="space-y-4">
        {/* Filters: sticky within tab scroll so list/stats scroll underneath */}
        <div className="sticky top-0 z-10 -mx-4 border-b border-slate-200 bg-slate-50 px-4 pb-3 pt-0">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="w-full sm:w-40">
                <label className="text-xs font-medium text-slate-600">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value as any);
                    setPage(1);
                  }}
                  className={inputCls}
                  style={{ paddingTop: 8, paddingBottom: 8 }}
                >
                  <option value="all">All</option>
                  <option value="completed">Completed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="w-full sm:flex-1">
                <label className="text-xs font-medium text-slate-600">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStartDate(v);
                    setPage(1);
                    if (v && endDate && new Date(endDate) < new Date(v)) setEndDate('');
                  }}
                  className={inputCls}
                />
              </div>

              <div className="w-full sm:flex-1">
                <label className="text-xs font-medium text-slate-600">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEndDate(v);
                    setPage(1);
                    if (v && startDate && new Date(v) < new Date(startDate)) setStartDate('');
                  }}
                  className={inputCls}
                />
              </div>
            </div>

            {tripStats?.completed != null && (
              <p className="text-xs text-slate-500">
                {tripStats?.completed ?? 0} completed trips
              </p>
            )}
          </div>
        </div>

        {/* Statistics banner */}
        {financialStats && (
          <section className="rounded-xl border border-slate-200 bg-indigo-50 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-indigo-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Total Revenue</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{formatMoney0(financialStats.totalRevenue)}</div>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Driver Salary</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{formatMoney0(financialStats.totalDriverSalary)}</div>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Owner Revenue</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{formatMoney0(financialStats.ownerRevenue)}</div>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-white p-3 sm:col-span-2 lg:col-span-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Trip Expense</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{formatMoney0(financialStats.totalExpenses)}</div>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-white p-3 sm:col-span-2 lg:col-span-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Vehicle Expenses</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{formatMoney0(financialStats.vehicleExpenses ?? 0)}</div>
              </div>
            </div>
          </section>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
                <div className="h-4 bg-slate-100 rounded w-1/2" />
                <div className="h-3 bg-slate-100 rounded w-2/3 mt-3" />
                <div className="h-3 bg-slate-100 rounded w-1/3 mt-3" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="py-6 text-center text-xs text-red-500">{error}</p>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <History className="h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No trip history found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((t, idx) => {
              const currentPage = pagination?.current ?? page;
              const offset = (currentPage - 1) * limit;
              const rowNumber = offset + idx + 1;
              const status = (t.status ?? '—').toString();
              return (
                <section key={t._id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[11px] font-bold text-indigo-700 shrink-0">
                          {rowNumber}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {t.tripNumber ?? '—'}
                          </div>
                          <div className="mt-0.5 text-[12px] text-slate-500">
                            {t.from && t.to ? `${t.from} → ${t.to}` : '—'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <span className={`rounded-full border px-2 py-0.5 capitalize text-[11px] ${statusBadgeCls(status)}`}>
                      {status.replaceAll('_', ' ')}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="text-xs text-slate-600">
                      <div>Distance: {t.distance ?? '—'}</div>
                      <div className="text-indigo-700 font-medium mt-1">{kmTravelledText(t)}</div>
                    </div>
                    <div className="text-xs text-slate-600">
                      <div>Date: {formatDate(t.startDate ?? t.departureDate)}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-slate-400" />
                        <span className="truncate">Driver: {resolveDriverName(t)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                      <div className="text-[11px] font-semibold text-emerald-800">Driver Salary</div>
                      <div className="text-sm font-bold text-slate-900 mt-1">{formatMoney0(t.driver_salary)}</div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                      <div className="text-[11px] font-semibold text-amber-800">Trip Expense</div>
                      <div className="text-sm font-bold text-slate-900 mt-1">{formatMoney0(t.totalExpenses)}</div>
                    </div>
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2">
                      <div className="text-[11px] font-semibold text-indigo-800">Owner Profit</div>
                      <div className="text-sm font-bold text-slate-900 mt-1">{formatMoney0(t.ownerProfit)}</div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination && (pagination.pages ?? 1) > 1 && (
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => canPrev && setPage((p) => Math.max(1, p - 1))}
              disabled={!canPrev}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Prev
            </button>
            <div className="text-xs text-slate-500">
              Page {pagination.current ?? page} of {pagination.pages ?? 1}
            </div>
            <button
              type="button"
              onClick={() => canNext && setPage((p) => p + 1)}
              disabled={!canNext}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABS — LIVE TRIP / UPCOMING TRIPS
// ═══════════════════════════════════════════════════════════════════════════════

interface TripDriverTabProps {
  mode: 'live' | 'upcoming';
  vehicle: Vehicle;
  onUpdateTrip: (tripId: string) => void;
  onCancelTrip: (tripId: string) => void;
  onAssignDriver: (tripId?: string) => void;
  onUnassignDriver: (tripId?: string) => void;
}

function TripDriverTab({ mode, vehicle, onUpdateTrip, onCancelTrip, onAssignDriver, onUnassignDriver }: TripDriverTabProps) {
  const [unassigning, setUnassigning] = useState(false);
  const [uErr, setUErr] = useState<string | null>(null);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const toggleExpand = (id: string) => setExpandedTripId(p => p === id ? null : id);

  const allTrips: TripItem[] = Array.isArray(vehicle.trips) ? vehicle.trips : [];

  // Derive active trip on the client by preferring the most recent in_progress trip,
  // then fall back to server-provided activeTrip/currentTrip for backward compatibility.
  const inProgressTrips = allTrips
    .filter(t => (t.status ?? '').toLowerCase() === 'in_progress')
    .sort((a, b) => {
      const da = a.departureDate ? new Date(a.departureDate).getTime() : 0;
      const db = b.departureDate ? new Date(b.departureDate).getTime() : 0;
      return db - da;
    });

  const derivedActive: any = inProgressTrips[0] ?? null;
  const activeTrip: any = derivedActive ?? vehicle.activeTrip ?? vehicle.currentTrip ?? null;
  const hasActiveTrip =
    activeTrip &&
    typeof activeTrip === 'object' &&
    !['cancelled', 'completed'].includes((activeTrip.status ?? '').toLowerCase());

  const scheduledTrips: TripItem[] = allTrips.filter(t =>
    !['cancelled', 'completed'].includes((t.status ?? '').toLowerCase())
  );

  const handleUnassign = async (tripId?: string) => {
    setUnassigning(true); setUErr(null);
    try {
      if (tripId) {
        await unassignDriverFromTripApi(tripId);
      } else {
        await unassignDriverFromVehicle(vehicle._id);
      }
      onUnassignDriver(tripId);
    } catch (err: any) {
      setUErr(err?.response?.data?.message ?? 'Failed to unassign driver');
    } finally { setUnassigning(false); }
  };

  const upcomingTrips = scheduledTrips.filter(t => t._id !== activeTrip?._id);
  const activeTripDriver = activeTrip ? tripDriverName(activeTrip as TripItem) : null;

  if (mode === 'live') {
    return (
    <div className="space-y-4">
      {uErr && <p className="text-xs text-red-500">{uErr}</p>}
      {hasActiveTrip ? (
        <section className={`rounded-xl border overflow-hidden ${expandedTripId === activeTrip._id ? 'border-indigo-300 shadow-sm' : 'border-indigo-100'} bg-indigo-50`}>
          <div
            className="p-4 cursor-pointer hover:bg-indigo-100/50 transition-colors"
            onClick={() => toggleExpand(activeTrip._id)}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-400">
                  {expandedTripId === activeTrip._id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  Live trip
                </p>
                {activeTrip.tripNumber && <p className="text-sm font-bold text-slate-800 mt-0.5">Trip #{activeTrip.tripNumber}</p>}
              </div>
              <span className={`text-xs rounded-full border px-2 py-0.5 capitalize ${statusBadgeCls(activeTrip.status)}`}>
                {activeTrip.status ?? '—'}
              </span>
            </div>
            <div className="space-y-1 text-xs text-slate-600">
              {activeTrip.from && activeTrip.to && (
                <p className="flex items-center gap-1 font-medium">
                  <span>{activeTrip.from}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
                  <span>{activeTrip.to}</span>
                </p>
              )}
              {activeTrip.departureDate && <p>📅 {formatDate(activeTrip.departureDate)}</p>}
              <p>👤 Driver: {activeTripDriver ?? 'Unassigned'}</p>
            </div>
          </div>

          {expandedTripId === activeTrip._id && (
            <div className="px-4 pb-4 pt-1 border-t border-indigo-100/50">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 mb-3 text-xs text-slate-600 pt-3">
                <EditableGridField tripId={activeTrip._id} fieldKey="customer" label="Customer" value={activeTrip.customer || '—'} />
                <EditableGridField tripId={activeTrip._id} fieldKey="agencyName" label="Agency" value={activeTrip.agencyName || '—'} />
                <EditableGridField tripId={activeTrip._id} fieldKey="distance" label="Distance" value={activeTrip.distance ? String(activeTrip.distance) : '—'} />
                <EditableGridField tripId={activeTrip._id} fieldKey="startDate" label="Start Date" value={activeTrip.startDate || '—'} />
                <EditableGridField tripId={activeTrip._id} fieldKey="expectedEndDate" label="End Date" value={activeTrip.expectedEndDate || '—'} />
                <EditableGridField tripId={activeTrip._id} fieldKey="startTime" label="Start Time" value={formatTimeIst(activeTrip.startTime ?? null)} />
                <EditableGridField tripId={activeTrip._id} fieldKey="endTime" label="End Time" value={formatTimeIst(activeTrip.endTime ?? null)} />
                {activeTrip.actualStartTime && <div><span className="text-slate-400 block mb-0.5">Actual Start</span><span>{formatTimeIst(activeTrip.actualStartTime)}</span></div>}
                {activeTrip.actualEndTime && <div><span className="text-slate-400 block mb-0.5">Actual End</span><span>{formatTimeIst(activeTrip.actualEndTime)}</span></div>}
                <EditableGridField tripId={activeTrip._id} fieldKey="startKilometers" label="Start KM" value={activeTrip.startKilometers != null ? String(activeTrip.startKilometers) : '—'} />
                <EditableGridField tripId={activeTrip._id} fieldKey="endKilometers" label="End KM" value={activeTrip.endKilometers != null ? String(activeTrip.endKilometers) : '—'} />
                {activeTrip.careOf?.name && <div><span className="text-slate-400 block mb-0.5">Care Of</span>{activeTrip.careOf.name} {activeTrip.careOf.phone ? `(${activeTrip.careOf.phone})` : ''}</div>}
                <EditableGridField tripId={activeTrip._id} fieldKey="priority" label="Priority" value={activeTrip.priority || '—'} />
                <div className="col-span-2 sm:col-span-3">
                  <EditableGridField tripId={activeTrip._id} fieldKey="notes" label="Notes" value={activeTrip.notes || '—'} />
                </div>
                {activeTrip.startingNote && <div className="col-span-2 sm:col-span-3"><span className="text-slate-400 block mb-0.5">Starting Note</span><p className="whitespace-pre-wrap">{activeTrip.startingNote}</p></div>}
                {activeTrip.completionNote && <div className="col-span-2 sm:col-span-3"><span className="text-slate-400 block mb-0.5">Completion Note</span><p className="whitespace-pre-wrap">{activeTrip.completionNote}</p></div>}
                <div className="col-span-2 sm:col-span-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mt-2 border-t border-indigo-100/30 pt-3 text-[11px]">
                  <EditableGridField
                    tripId={activeTrip._id}
                    fieldKey="agencyCost"
                    label="AGENCY COST"
                    value={activeTrip.agencyCost ?? activeTrip.amount ?? activeTrip.fare ?? 0}
                    isCurrency
                  />
                  <EditableGridField tripId={activeTrip._id} fieldKey="advance" label="ADVANCE" value={activeTrip.advance || 0} isCurrency />
                  <EditableGridField tripId={activeTrip._id} fieldKey="driver_salary" label="BATA" value={activeTrip.driver_salary || 0} isCurrency />
                  <div><span className="text-slate-400 block mb-0.5 uppercase">Personal Exp.</span><span className="font-semibold text-slate-700">₹{Number(activeTrip.totalPersonalExpense || 0).toLocaleString('en-IN')}</span></div>
                  <div><span className="text-slate-400 block mb-0.5 uppercase">Trip Exp.</span><span className="font-semibold text-slate-700">₹{Number(activeTrip.totalExpenses || 0).toLocaleString('en-IN')}</span></div>
                  <EditableGridField tripId={activeTrip._id} fieldKey="cabCost" label="CAB COST" value={activeTrip.cabCost || 0} isCurrency />
                  <div><span className="block mb-0.5 uppercase text-indigo-500">Owner Profit</span><span className="font-bold text-indigo-700">₹{Number(activeTrip.ownerProfit || 0).toLocaleString('en-IN')}</span></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-indigo-100/50">
                <button type="button" onClick={() => onUpdateTrip(activeTrip._id ?? activeTrip.id ?? activeTrip.tripId)}
                  className="flex-1 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
                  Update
                </button>
                <button type="button" onClick={() => onCancelTrip(activeTrip._id ?? activeTrip.id ?? activeTrip.tripId)}
                  className="flex-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                  Cancel Trip
                </button>
                {activeTripDriver ? (
                  <button
                    type="button"
                    onClick={() => handleUnassign(activeTrip._id ?? activeTrip.id ?? activeTrip.tripId)}
                    disabled={unassigning}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Unassign Driver
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAssignDriver(activeTrip._id ?? activeTrip.id ?? activeTrip.tripId)}
                    className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                  >
                    Assign Driver
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
          <p className="text-sm text-slate-500">No live trip on this vehicle</p>
          <p className="mt-1 text-xs text-slate-400">When a trip is in progress, it will show here.</p>
        </div>
      )}
    </div>
    );
  }

  return (
    <div className="space-y-4">
      {uErr && <p className="text-xs text-red-500">{uErr}</p>}
      <div className="flex items-center justify-between pt-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Upcoming trips</h4>
        <Link
          to="/create-trip"
          className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100"
        >
          <Plus className="h-3.5 w-3.5" /> Create New Trip
        </Link>
      </div>

      {upcomingTrips.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">No scheduled trips</p>
      ) : (
        <div className="space-y-3">
          {upcomingTrips.map(trip => {
            const drName = tripDriverName(trip);
            return (
              <section key={trip._id} className={`rounded-xl border overflow-hidden transition-all ${expandedTripId === trip._id ? 'border-slate-300 shadow-sm' : 'border-slate-200'} bg-white`}>
                <div
                  className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpand(trip._id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-2">
                      {expandedTripId === trip._id ? <ChevronUp className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />}
                      <div>
                        {trip.tripNumber && <p className="text-sm font-bold text-slate-800">Trip #{trip.tripNumber}</p>}
                        {trip.from && trip.to && (
                          <p className="flex items-center gap-1 text-xs text-slate-600 mt-0.5">
                            <span>{trip.from}</span>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span>{trip.to}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs rounded-full border px-2 py-0.5 capitalize ${statusBadgeCls(trip.status)} whitespace-nowrap ml-2`}>
                      {trip.status ?? '—'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5 pl-6">
                    {trip.departureDate && <p>📅 {formatDate(trip.departureDate)}</p>}
                    <p>👤 {drName ?? 'Unassigned'}</p>
                  </div>
                </div>
                
                {expandedTripId === trip._id && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 mb-3 text-xs text-slate-600 pt-3 pl-2">
                      <EditableGridField tripId={trip._id} fieldKey="customer" label="Customer" value={trip.customer || '—'} />
                      <EditableGridField tripId={trip._id} fieldKey="agencyName" label="Agency" value={trip.agencyName || '—'} />
                      <EditableGridField tripId={trip._id} fieldKey="distance" label="Distance" value={trip.distance ? String(trip.distance) : '—'} />
                      <EditableGridField tripId={trip._id} fieldKey="startDate" label="Start Date" value={trip.startDate || '—'} />
                      <EditableGridField tripId={trip._id} fieldKey="expectedEndDate" label="End Date" value={trip.expectedEndDate || '—'} />
                      <EditableGridField tripId={trip._id} fieldKey="startTime" label="Start Time" value={formatTimeIst(trip.startTime ?? null)} />
                      <EditableGridField tripId={trip._id} fieldKey="endTime" label="End Time" value={formatTimeIst(trip.endTime ?? null)} />
                      {trip.actualStartTime && <div><span className="text-slate-400 block mb-0.5">Actual Start</span><span>{formatTimeIst(trip.actualStartTime)}</span></div>}
                      {trip.actualEndTime && <div><span className="text-slate-400 block mb-0.5">Actual End</span><span>{formatTimeIst(trip.actualEndTime)}</span></div>}
                      <EditableGridField tripId={trip._id} fieldKey="startKilometers" label="Start KM" value={trip.startKilometers != null ? String(trip.startKilometers) : '—'} />
                      <EditableGridField tripId={trip._id} fieldKey="endKilometers" label="End KM" value={trip.endKilometers != null ? String(trip.endKilometers) : '—'} />
                      {trip.careOf?.name && <div><span className="text-slate-400 block mb-0.5">Care Of</span>{trip.careOf.name} {trip.careOf.phone ? `(${trip.careOf.phone})` : ''}</div>}
                      <EditableGridField tripId={trip._id} fieldKey="priority" label="Priority" value={trip.priority || '—'} />
                      <div className="col-span-2 sm:col-span-3">
                        <EditableGridField tripId={trip._id} fieldKey="notes" label="Notes" value={trip.notes || '—'} />
                      </div>
                      {trip.startingNote && <div className="col-span-2 sm:col-span-3"><span className="text-slate-400 block mb-0.5">Starting Note</span><p className="whitespace-pre-wrap">{trip.startingNote}</p></div>}
                      {trip.completionNote && <div className="col-span-2 sm:col-span-3"><span className="text-slate-400 block mb-0.5">Completion Note</span><p className="whitespace-pre-wrap">{trip.completionNote}</p></div>}
                      <div className="col-span-2 sm:col-span-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mt-2 border-t border-slate-100 pt-3">
                        <EditableGridField
                          tripId={trip._id}
                          fieldKey="agencyCost"
                          label="AGENCY COST"
                          value={trip.agencyCost ?? trip.amount ?? (trip as any).fare ?? 0}
                          isCurrency
                        />
                        <EditableGridField tripId={trip._id} fieldKey="advance" label="ADVANCE" value={trip.advance || 0} isCurrency />
                        <EditableGridField tripId={trip._id} fieldKey="driver_salary" label="BATA" value={trip.driver_salary || 0} isCurrency />
                        <div><span className="text-slate-400 block mb-0.5 text-[10px] uppercase">Personal Exp.</span><span className="font-semibold text-slate-700">₹{Number(trip.totalPersonalExpense || 0).toLocaleString('en-IN')}</span></div>
                        <div><span className="text-slate-400 block mb-0.5 text-[10px] uppercase">Trip Exp.</span><span className="font-semibold text-slate-700">₹{Number(trip.totalExpenses || 0).toLocaleString('en-IN')}</span></div>
                        <EditableGridField tripId={trip._id} fieldKey="cabCost" label="CAB COST" value={trip.cabCost || 0} isCurrency />
                        <div><span className="text-slate-400 block mb-0.5 text-[10px] uppercase">Profit</span><span className="font-bold text-slate-800">₹{Number(trip.ownerProfit || 0).toLocaleString('en-IN')}</span></div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 pl-2 mt-3">
                      <button type="button" onClick={() => onUpdateTrip(trip._id)}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50">Update</button>
                      <button type="button" onClick={() => onCancelTrip(trip._id)}
                        className="flex-1 rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50">Cancel</button>
                      {drName ? (
                        <button type="button" onClick={() => handleUnassign(trip._id)} disabled={unassigning}
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Unassign Driver</button>
                      ) : (
                        <button type="button" onClick={() => onAssignDriver(trip._id)}
                          className="flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800">Assign Driver</button>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE DETAIL PANEL
// ═══════════════════════════════════════════════════════════════════════════════

type DetailModal =
  | { kind: 'updateTrip'; tripId: string }
  | { kind: 'cancelTrip'; tripId: string }
  | { kind: 'assignDriver'; tripId?: string };

interface VehicleDetailPanelProps {
  vehicle: Vehicle;
  onVehicleUpdated: (updated: Partial<Vehicle>) => void;
  onBackClicked: () => void;
}

function VehicleDetailPanel({ vehicle, onVehicleUpdated, onBackClicked }: VehicleDetailPanelProps) {
  const [tab, setTab] = useState<'upcoming' | 'live' | 'history'>('live');
  const [detailModal, setDetailModal] = useState<DetailModal | null>(null);

  const closeDetailModal = () => setDetailModal(null);

  const getDisplayStatus = () => {
    const at = vehicle.activeTrip as any;
    if (at && typeof at === 'object' && at.status) return at.status;
    const ct = vehicle.currentTrip as any;
    if (ct && typeof ct === 'object' && ct.status) return ct.status;
    return vehicle.status;
  };

  const tabs: { key: 'upcoming' | 'live' | 'history'; label: string }[] = [
    { key: 'live', label: 'Live Trip' },
    { key: 'upcoming', label: 'Upcoming Trips' },
    { key: 'history', label: 'History' },
  ];

  const tripCallbacks = {
    onUpdateTrip: (tripId: string) => setDetailModal({ kind: 'updateTrip', tripId }),
    onCancelTrip: (tripId: string) => setDetailModal({ kind: 'cancelTrip', tripId }),
    onAssignDriver: (tripId?: string) => setDetailModal({ kind: 'assignDriver', tripId }),
    onUnassignDriver: (tripId?: string) => {
      if (tripId) onVehicleUpdated({ _updatedAt: Date.now() } as any);
      else onVehicleUpdated({ currentDriverName: undefined });
    },
  };

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBackClicked} className="lg:hidden p-1.5 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h3 className="text-xl font-bold text-slate-900">{vehicle.vehicleNumber}</h3>
            <p className="text-sm text-slate-500">
              {[vehicle.vehicleType, vehicle.vehicleModel].filter(Boolean).join(' – ')}
              {vehicle.vehicleYear ? ` (${vehicle.vehicleYear})` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold capitalize ${statusBadgeCls(getDisplayStatus())}`}>
            {getDisplayStatus() ?? 'Unknown'}
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 bg-white shrink-0 overflow-x-auto hide-scrollbar">
        {tabs.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`flex-1 sm:flex-none whitespace-nowrap px-3 sm:px-5 py-3 text-xs sm:text-sm font-semibold normal-case tracking-normal transition border-b-2 ${
              tab === t.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'live' && (
          <TripDriverTab mode="live" vehicle={vehicle} {...tripCallbacks} />
        )}
        {tab === 'upcoming' && (
          <TripDriverTab mode="upcoming" vehicle={vehicle} {...tripCallbacks} />
        )}
        {tab === 'history' && <VehicleHistoryTab vehicle={vehicle} />}
      </div>

      {/* Detail-level modals */}
      {detailModal?.kind === 'updateTrip' && (
        <UpdateTripWrapper vehicleId={vehicle._id} tripId={detailModal.tripId} onClose={closeDetailModal}
          onSaved={() => {
            closeDetailModal();
            // Trigger a minor update to force a re-fetch of the vehicle data
            onVehicleUpdated({ _updatedAt: Date.now() } as any);
          }} />
      )}
      {detailModal?.kind === 'cancelTrip' && (
        <CancelTripModal tripId={detailModal.tripId} onClose={closeDetailModal}
          onCancelled={() => onVehicleUpdated({ status: 'Available', _updatedAt: Date.now() } as any)} />
      )}
      {detailModal?.kind === 'assignDriver' && (
        <DriverAssignModal
          vehicleId={vehicle._id}
          tripId={detailModal.tripId}
          currentDriverName={vehicle.currentDriverName}
          onClose={closeDetailModal}
          onAssigned={(name) => {
            if (detailModal.tripId) {
              // Assigned to a specific trip -> full refresh
              onVehicleUpdated({ _updatedAt: Date.now() } as any);
            } else {
              // Assigned to the vehicle -> partial update
              onVehicleUpdated({ currentDriverName: name });
            }
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

type PageModal = 'add' | 'edit' | null;

export function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [pageModal, setPageModal] = useState<PageModal>(null);

  const selectedVehicle = selectedIdx !== null ? vehicles[selectedIdx] ?? null : null;

  const load = useCallback(async (q: string) => {
    setLoading(true); setError(null);
    try {
      const data = await fetchVehicles({ page: 1, limit: 50, search: q });
      setVehicles(data.items);
      setSelectedIdx(null);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load vehicles');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const handleSaved = (saved: Vehicle) => {
    setVehicles(prev => {
      const idx = prev.findIndex(v => v._id === saved._id);
      if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n; }
      return [saved, ...prev];
    });
  };

  const handleVehicleUpdated = async (updated: Partial<Vehicle>) => {
    if (!selectedVehicle) return;
    if ('_updatedAt' in updated) {
      try {
        const fullVehicle = await fetchVehicleById(selectedVehicle._id);
        setVehicles(prev => prev.map((v, i) => i === selectedIdx ? fullVehicle : v));
      } catch (e) {
        console.error('Failed to refetch vehicle after update', e);
      }
    } else {
      setVehicles(prev => prev.map((v, i) => i === selectedIdx ? { ...v, ...updated } : v));
    }
  };

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* LEFT: vehicle list panel */}
      <div className={`flex w-full lg:w-72 xl:w-80 shrink-0 flex-col border-r border-slate-200 bg-white transition-all ${selectedIdx !== null ? 'hidden lg:flex' : 'flex'}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Trip Details</h2>
          <button type="button" onClick={() => setPageModal('add')}
            className="flex items-center gap-1 rounded-lg bg-indigo-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600">
            <Plus className="h-3.5 w-3.5" />Add
          </button>
        </div>

        {/* Search */}
        <div className="relative border-b border-slate-100 px-3 py-2">
          <Search className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search vehicles..."
            className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-3 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400" />
        </div>

        {/* List */}
        <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)
          ) : error ? (
            <p className="p-4 text-center text-xs text-red-500">{error}</p>
          ) : vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Car className="h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-400">No vehicles found</p>
              <button type="button" onClick={() => setPageModal('add')} className="text-xs text-indigo-500 underline">
                Add your first vehicle
              </button>
            </div>
          ) : (
            vehicles.map((v, i) => (
              <VehicleListCard key={v._id} vehicle={v} isSelected={i === selectedIdx}
                onSelect={() => setSelectedIdx(i)}
                onEdit={() => { setSelectedIdx(i); setPageModal('edit'); }} />
            ))
          )}
        </div>
      </div>

      {/* RIGHT: detail panel */}
      <div className={`flex-1 overflow-hidden transition-all ${selectedIdx !== null ? 'flex flex-col' : 'hidden lg:flex flex-col'}`}>
        {selectedVehicle ? (
          <VehicleDetailPanel
            vehicle={selectedVehicle}
            onVehicleUpdated={handleVehicleUpdated}
            onBackClicked={() => setSelectedIdx(null)}
          />
        ) : !loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Car className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-500">No vehicle selected</p>
              <p className="mt-1 text-xs text-slate-400">Select a vehicle from the list to view details</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Page-level modals */}
      {pageModal === 'add' && (
        <VehicleModal onClose={() => setPageModal(null)} onSaved={handleSaved} />
      )}
      {pageModal === 'edit' && selectedVehicle && (
        <VehicleModal vehicle={selectedVehicle} onClose={() => setPageModal(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
