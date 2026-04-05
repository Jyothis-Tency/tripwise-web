import { useCallback, useEffect, useRef, useState } from 'react';
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
  CheckCircle2,
  Calculator,
  Edit2,
  Trash2,
  ArrowLeft,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import {
  fetchVehicles,
  fetchVehicleById,
  fetchVehicleHistoryDetailed,
  fetchVehicleExpenses,
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
  createVehicleExpense,
  updateVehicleExpense,
  deleteVehicleExpense,
  type Vehicle,
  type TripItem,
  type DriverItem,
  type ExpenseItem,
  type HistoryTripItem,
  type VehicleHistoryResponse,
} from '../api';

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const VEHICLE_TYPES = ['Car', 'Traveller', 'Bus', 'Van'];
const VEHICLE_STATUSES = ['Available', 'On Trip', 'Maintenance', 'Inactive'];

function statusDotCls(status?: string) {
  switch ((status ?? '').toLowerCase()) {
    case 'available': return 'bg-green-500';
    case 'on trip': case 'on_trip': return 'bg-indigo-500';
    case 'maintenance': case 'under maintenance': return 'bg-orange-400';
    case 'inactive': return 'bg-slate-400';
    default: return 'bg-slate-300';
  }
}

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

function commissionText(v: Vehicle): string {
  if (v.commission == null) return '';
  const n = v.commission;
  return `${n % 1 === 0 ? n.toFixed(0) : n}%`;
}

function formatDate(d?: string) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
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

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 shrink-0 mr-4">{label}</span>
      <span className="text-xs font-medium text-slate-800 text-right">{value ?? '—'}</span>
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
// VEHICLE CARD (Left List)
// ═══════════════════════════════════════════════════════════════════════════════

function VehicleCard({ vehicle, isSelected, onSelect, onEdit }: {
  vehicle: Vehicle; isSelected: boolean; onSelect: () => void; onEdit: () => void;
}) {
  const trip = vehicle.currentTrip && typeof vehicle.currentTrip === 'object' ? vehicle.currentTrip as any : null;
  const tripFrom = vehicle.tripFrom ?? trip?.from;
  const tripTo = vehicle.tripTo ?? trip?.to;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
      className={`w-full rounded-xl border p-3 text-left transition-all cursor-pointer ${isSelected ? 'border-indigo-400 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
          <Car className="h-5 w-5 text-indigo-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className="truncate text-sm font-semibold text-slate-900">{vehicle.vehicleNumber}</p>
            <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="shrink-0 rounded p-0.5 text-slate-400 hover:text-indigo-500" title="Edit vehicle">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusDotCls(vehicle.status)}`} />
            <span className="text-xs text-slate-500 capitalize">{vehicle.status ?? 'Unknown'}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {[vehicle.vehicleType, vehicle.vehicleModel].filter(Boolean).join(' – ')}
          </p>
          {commissionText(vehicle) && <p className="text-xs text-slate-400">Bata: {commissionText(vehicle)}</p>}
          <p className="text-xs text-slate-400">Driver: {vehicle.currentDriverName ?? 'Unassigned'}</p>
          {tripFrom && tripTo && (
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-indigo-500">
              <span className="truncate">{tripFrom}</span>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="truncate">{tripTo}</span>
            </p>
          )}
        </div>
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
    priority: trip?.priority ?? 'Medium',
    careOfName: trip?.careOf?.name ?? '',
    careOfPhone: trip?.careOf?.phone ?? '',
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
        priority: form.priority,
        careOf: (form.careOfName || form.careOfPhone) ? { name: form.careOfName, phone: form.careOfPhone } : undefined,
        agencyName: form.agencyName.trim() || undefined,
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
      <form onSubmit={submit} className="flex flex-col h-full max-h-[85vh]">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
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
            <Field label="Customer" id="tcus">
              <input id="tcus" value={form.customer} onChange={set('customer')} className={inputCls} placeholder="Customer Name" />
            </Field>

            <Field label="Priority" id="tprio">
              <select id="tprio" value={form.priority} onChange={set('priority')} className={inputCls}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </Field>
            <Field label="Agency Name (Optional)" id="tagn">
              <input id="tagn" value={form.agencyName} onChange={set('agencyName')} className={inputCls} placeholder="Agency Name" />
            </Field>
          </div>

          <fieldset className="rounded-lg border border-slate-200 p-4">
            <legend className="text-[11px] font-semibold uppercase tracking-wide px-1 -ml-1 text-indigo-500 flex items-center gap-1">
              <UserCheck className="h-3.5 w-3.5" /> Care Of Details
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-2">
              <Field label="Name" id="tcarename">
                <input id="tcarename" value={form.careOfName} onChange={set('careOfName')} className={inputCls} placeholder="Care of name" />
              </Field>
              <Field label="Phone" id="tcarephone">
                <input id="tcarephone" value={form.careOfPhone} onChange={set('careOfPhone')} className={inputCls} placeholder="Phone number" />
              </Field>
            </div>
          </fieldset>

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
          <button type="submit" disabled={saving}
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
// VEHICLE HISTORY MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function VehicleHistoryModal({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
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
    <ModalShell title={`Vehicle History — ${vehicle.vehicleNumber}`} onClose={onClose} maxWidth="max-w-2xl">
      <div className="p-4 space-y-4">
        {/* Filters (old Flutter parity) */}
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
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — BASIC INFORMATION
// ═══════════════════════════════════════════════════════════════════════════════

function BasicInfoTab({ vehicle }: { vehicle: Vehicle }) {
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Basic Information</h4>
        <InfoRow label="Registration Number" value={vehicle.vehicleNumber} />
        <InfoRow label="Type" value={vehicle.vehicleType} />
        <InfoRow label="Model" value={vehicle.vehicleModel} />
        <InfoRow label="Year" value={vehicle.vehicleYear} />
        <InfoRow label="Seats" value={vehicle.seats} />
        <InfoRow label="Driver Bata" value={commissionText(vehicle) || null} />
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — TRIP & DRIVER
// ═══════════════════════════════════════════════════════════════════════════════

interface TripDriverTabProps {
  vehicle: Vehicle;
  onStartTrip: () => void;
  onUpdateTrip: (tripId: string) => void;
  onCancelTrip: (tripId: string) => void;
  onAssignDriver: (tripId?: string) => void;
  onUnassignDriver: (tripId?: string) => void;
}

function TripDriverTab({ vehicle, onStartTrip, onUpdateTrip, onCancelTrip, onAssignDriver, onUnassignDriver }: TripDriverTabProps) {
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

  return (
    <div className="space-y-4">
      {uErr && <p className="text-xs text-red-500">{uErr}</p>}
      {/* Active Trip Card */}
      {hasActiveTrip && (
        <section className={`rounded-xl border overflow-hidden ${expandedTripId === activeTrip._id ? 'border-indigo-300 shadow-sm' : 'border-indigo-100'} bg-indigo-50`}>
          <div
            className="p-4 cursor-pointer hover:bg-indigo-100/50 transition-colors"
            onClick={() => toggleExpand(activeTrip._id)}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-400">
                  {expandedTripId === activeTrip._id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  Active Trip
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
                <EditableGridField tripId={activeTrip._id} fieldKey="startTime" label="Start Time" value={activeTrip.startTime ? (String(activeTrip.startTime).includes('T') ? new Date(activeTrip.startTime).toLocaleTimeString() : String(activeTrip.startTime)) : '—'} />
                <EditableGridField tripId={activeTrip._id} fieldKey="endTime" label="End Time" value={activeTrip.endTime ? (String(activeTrip.endTime).includes('T') ? new Date(activeTrip.endTime).toLocaleTimeString() : String(activeTrip.endTime)) : '—'} />
                {activeTrip.actualStartTime && <div><span className="text-slate-400 block mb-0.5">Actual Start</span><span>{new Date(activeTrip.actualStartTime).toLocaleString()}</span></div>}
                {activeTrip.actualEndTime && <div><span className="text-slate-400 block mb-0.5">Actual End</span><span>{new Date(activeTrip.actualEndTime).toLocaleString()}</span></div>}
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
                  <EditableGridField tripId={activeTrip._id} fieldKey={activeTrip.fare ? "fare" : "amount"} label="AMOUNT" value={activeTrip.amount || activeTrip.fare || 0} isCurrency />
                  <EditableGridField tripId={activeTrip._id} fieldKey="advance" label="ADVANCE" value={activeTrip.advance || 0} isCurrency />
                  <EditableGridField tripId={activeTrip._id} fieldKey="driver_salary" label="BATA" value={activeTrip.driver_salary || 0} isCurrency />
                  <div><span className="text-slate-400 block mb-0.5 uppercase">Personal Exp.</span><span className="font-semibold text-slate-700">₹{Number(activeTrip.totalPersonalExpense || 0).toLocaleString('en-IN')}</span></div>
                  <div><span className="text-slate-400 block mb-0.5 uppercase">Trip Exp.</span><span className="font-semibold text-slate-700">₹{Number(activeTrip.totalExpenses || 0).toLocaleString('en-IN')}</span></div>
                  <EditableGridField tripId={activeTrip._id} fieldKey="cabCost" label="CAB COST" value={activeTrip.cabCost || 0} isCurrency />
                  <div><span className="text-slate-400 block mb-0.5 uppercase text-indigo-500">Owner Profit</span><span className="font-bold text-indigo-700">₹{Number(activeTrip.ownerProfit || 0).toLocaleString('en-IN')}</span></div>
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
      )}

      {/* Scheduled / Upcoming Trips Header */}
      <div className="flex items-center justify-between pt-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Scheduled Trips</h4>
        <button type="button" onClick={onStartTrip} className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100">
          <Plus className="h-3.5 w-3.5" /> New Trip
        </button>
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
                      <EditableGridField tripId={trip._id} fieldKey="startTime" label="Start Time" value={trip.startTime ? (String(trip.startTime).includes('T') ? new Date(trip.startTime).toLocaleTimeString() : String(trip.startTime)) : '—'} />
                      <EditableGridField tripId={trip._id} fieldKey="endTime" label="End Time" value={trip.endTime ? (String(trip.endTime).includes('T') ? new Date(trip.endTime).toLocaleTimeString() : String(trip.endTime)) : '—'} />
                      {trip.actualStartTime && <div><span className="text-slate-400 block mb-0.5">Actual Start</span><span>{new Date(trip.actualStartTime).toLocaleString()}</span></div>}
                      {trip.actualEndTime && <div><span className="text-slate-400 block mb-0.5">Actual End</span><span>{new Date(trip.actualEndTime).toLocaleString()}</span></div>}
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
                        <EditableGridField tripId={trip._id} fieldKey={(trip as any).fare ? "fare" : "amount"} label="AMOUNT" value={trip.amount || (trip as any).fare || 0} isCurrency />
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
// TAB 3 — VEHICLE EXPENSES
// ═══════════════════════════════════════════════════════════════════════════════

function ExpensesTab({ vehicle }: { vehicle: Vehicle }) {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expenseModal, setExpenseModal] = useState<'add' | { edit: ExpenseItem } | null>(null);
  const [deleteModal, setDeleteModal] = useState<ExpenseItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchExpenses = useCallback(() => {
    setLoading(true);
    fetchVehicleExpenses(vehicle._id)
      .then(setExpenses)
      .catch(() => setError('Failed to load expenses'))
      .finally(() => setLoading(false));
  }, [vehicle._id]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const total = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      await deleteVehicleExpense(vehicle._id, deleteModal._id);
      fetchExpenses();
    } catch (err) {
      alert('Failed to delete expense');
    } finally {
      setDeleting(false);
      setDeleteModal(null);
    }
  };

  if (loading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-0 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Expenses</p>
            <p className="text-lg font-bold text-slate-800">₹{total.toLocaleString('en-IN')}</p>
          </div>
        </div>
        <button type="button" onClick={() => setExpenseModal('add')}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600">
          <Plus className="h-4 w-4" /> Add Expense
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {error && <p className="py-2 text-center text-xs text-red-500 bg-red-50 border-b border-red-100">{error}</p>}
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No expenses recorded</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="px-4 py-3 capitalize font-medium text-slate-700">{e.category ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{e.vendor ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{e.notes ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{e.amount != null ? `₹${e.amount.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button type="button" onClick={() => setExpenseModal({ edit: e })} className="text-indigo-500 hover:text-indigo-700 p-1" title="Edit">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setDeleteModal(e)} className="text-red-500 hover:text-red-700 p-1" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {expenseModal && (
        <ExpenseFormModal
          vehicleId={vehicle._id}
          expense={expenseModal === 'add' ? null : expenseModal.edit}
          onClose={() => setExpenseModal(null)}
          onSaved={() => { setExpenseModal(null); fetchExpenses(); }}
        />
      )}

      {deleteModal && (
        <ModalShell title="Delete Expense" onClose={() => setDeleteModal(null)} maxWidth="max-w-sm">
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Trash2 className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-900">Delete this expense?</p>
                <p className="text-xs text-slate-500 mt-1">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDeleteModal(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="rounded-lg bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function ExpenseFormModal({ vehicleId, expense, onClose, onSaved }: {
  vehicleId: string; expense?: ExpenseItem | null; onClose: () => void; onSaved: () => void;
}) {
  const isUpdate = !!expense;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    category: expense?.category ?? 'Fuel',
    amount: expense?.amount?.toString() ?? '',
    date: expense?.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0],
    vendor: expense?.vendor ?? '',
    description: expense?.description ?? expense?.notes ?? '',
  });

  const CATEGORIES = ['Fuel', 'Maintenance', 'Insurance', 'Toll', 'Parking', 'Repair', 'Food', 'Cleaning', 'Fine', 'Tax & Permit', 'Other'];

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        category: form.category.toLowerCase(), // Normalize for backend enum match
        amount: parseFloat(form.amount),
        date: form.date,
        vendor: form.vendor.trim() || undefined,
        description: form.description.trim() || '',
      };

      if (isUpdate && expense) await updateVehicleExpense(vehicleId, expense._id, payload);
      else await createVehicleExpense(vehicleId, payload);

      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={isUpdate ? 'Edit Expense' : 'Add Expense'} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={submit} className="p-6 space-y-4">
        {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        
        <Field label="Category" id="ecat">
          <select id="ecat" value={form.category} onChange={set('category')} className={inputCls} required>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        
        <Field label="Amount (₹)" id="eamt">
          <input id="eamt" type="number" step="0.01" value={form.amount} onChange={set('amount')} required className={inputCls} placeholder="0.00" />
        </Field>
        
        <Field label="Date" id="edte">
          <input id="edte" type="date" value={form.date} onChange={set('date')} required className={inputCls} />
        </Field>
        
        <Field label="Vendor (Optional)" id="even">
          <input id="even" value={form.vendor} onChange={set('vendor')} className={inputCls} placeholder="Vendor name" />
        </Field>
        
        <Field label="Description" id="edesc">
          <textarea id="edesc" rows={2} value={form.description} onChange={set('description') as any} className={`${inputCls} resize-none`} placeholder="Details about this expense..." required />
        </Field>
        
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving}
            className="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50">
            {saving ? 'Saving…' : isUpdate ? 'Update' : 'Save'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE DETAIL PANEL
// ═══════════════════════════════════════════════════════════════════════════════

type DetailModal =
  | { kind: 'startTrip' }
  | { kind: 'updateTrip'; tripId: string }
  | { kind: 'cancelTrip'; tripId: string }
  | { kind: 'assignDriver'; tripId?: string }
  | { kind: 'history' };

interface VehicleDetailPanelProps {
  vehicle: Vehicle;
  onEditClicked: () => void;
  onVehicleUpdated: (updated: Partial<Vehicle>) => void;
  onBackClicked: () => void;
}

function VehicleDetailPanel({ vehicle, onEditClicked, onVehicleUpdated, onBackClicked }: VehicleDetailPanelProps) {
  const [tab, setTab] = useState<'basic' | 'trip' | 'expenses'>('basic');
  const [detailModal, setDetailModal] = useState<DetailModal | null>(null);

  const closeDetailModal = () => setDetailModal(null);

  const getDisplayStatus = () => {
    const at = vehicle.activeTrip as any;
    if (at && typeof at === 'object' && at.status) return at.status;
    const ct = vehicle.currentTrip as any;
    if (ct && typeof ct === 'object' && ct.status) return ct.status;
    return vehicle.status;
  };

  const tabs: { key: 'basic' | 'trip' | 'expenses'; label: string }[] = [
    { key: 'basic', label: 'BASIC INFORMATION' },
    { key: 'trip', label: 'TRIP & DRIVER' },
    { key: 'expenses', label: 'VEHICLE EXPENSES' },
  ];

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
          <button type="button" onClick={() => setDetailModal({ kind: 'history' })}
            title="Vehicle History"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            <History className="h-3.5 w-3.5" />
            History
          </button>
          <button type="button" onClick={onEditClicked}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 bg-white shrink-0 overflow-x-auto hide-scrollbar">
        {tabs.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`flex-1 sm:flex-none whitespace-nowrap px-3 sm:px-5 py-3 text-[10px] sm:text-[11px] font-semibold tracking-wide transition border-b-2 ${
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
        {tab === 'basic' && <BasicInfoTab vehicle={vehicle} />}
        {tab === 'trip' && (
          <TripDriverTab
            vehicle={vehicle}
            onStartTrip={() => setDetailModal({ kind: 'startTrip' })}
            onUpdateTrip={(tripId) => setDetailModal({ kind: 'updateTrip', tripId })}
            onCancelTrip={(tripId) => setDetailModal({ kind: 'cancelTrip', tripId })}
            onAssignDriver={(tripId) => setDetailModal({ kind: 'assignDriver', tripId })}
            onUnassignDriver={(tripId) => {
              if (tripId) onVehicleUpdated({ _updatedAt: Date.now() } as any);
              else onVehicleUpdated({ currentDriverName: undefined });
            }}
          />
        )}
        {tab === 'expenses' && <ExpensesTab vehicle={vehicle} />}
      </div>

      {/* Detail-level modals */}
      {detailModal?.kind === 'startTrip' && (
        <TripFormModal vehicleId={vehicle._id} onClose={closeDetailModal}
          onSaved={() => {
            closeDetailModal();
            onVehicleUpdated({ status: 'On Trip', _updatedAt: Date.now() } as any);
          }} />
      )}
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
      {detailModal?.kind === 'history' && (
        <VehicleHistoryModal vehicle={vehicle} onClose={closeDetailModal} />
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
          <h2 className="text-sm font-semibold text-slate-900">Vehicles</h2>
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
              <VehicleCard key={v._id} vehicle={v} isSelected={i === selectedIdx}
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
            onEditClicked={() => setPageModal('edit')}
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
