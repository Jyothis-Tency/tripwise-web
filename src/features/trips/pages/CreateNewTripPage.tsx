import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, Car, Users, CheckCircle2, X } from 'lucide-react';
import { AgencyNameCombobox } from '../../../components/AgencyNameCombobox';
import {
  createTrip,
  fetchDriversList,
  fetchVehicles,
  type DriverItem,
  type TripItem,
  type Vehicle,
} from '../../vehicles/api';

/** Comfortable tap/read size; fits more in view via layout, not shrinking type */
const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200';

function Field({
  label,
  id,
  required,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function driverLabel(d: DriverItem): string {
  const name =
    d.name?.trim() ||
    `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim() ||
    d.fullName?.trim() ||
    'Driver';
  return d.phone ? `${name} · ${d.phone}` : name;
}

export function CreateNewTripPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState<string | null>(null);

  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');

  const [form, setForm] = useState({
    from: '',
    to: '',
    startDate: '',
    expectedEndDate: '',
    distance: '',
    customer: '',
    agencyName: '',
    agencyCost: '',
    cabCost: '',
    advance: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTrip, setCreatedTrip] = useState<TripItem | null>(null);

  useEffect(() => {
    let active = true;
    setListsLoading(true);
    setListsError(null);
    Promise.all([fetchVehicles({ page: 1, limit: 500 }), fetchDriversList()])
      .then(([vRes, dList]) => {
        if (!active) return;
        setVehicles(vRes.items ?? []);
        setDrivers(dList);
      })
      .catch(() => {
        if (!active) return;
        setListsError('Could not load vehicles or drivers. Refresh and try again.');
      })
      .finally(() => {
        if (active) setListsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const profit = (parseFloat(form.agencyCost || '0') - parseFloat(form.cabCost || '0')).toFixed(2);

  const resetFormFields = useCallback(() => {
    setForm({
      from: '',
      to: '',
      startDate: '',
      expectedEndDate: '',
      distance: '',
      customer: '',
      agencyName: '',
      agencyCost: '',
      cabCost: '',
      advance: '',
      notes: '',
    });
    setDriverId('');
    setVehicleId('');
    setError(null);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!vehicleId) {
      setError('Select a vehicle.');
      return;
    }
    if (!form.from.trim() || !form.to.trim()) {
      setError('From and To locations are required');
      return;
    }
    if (!form.agencyName.trim()) {
      setError('Agency name is required');
      return;
    }
    setSaving(true);
    setError(null);
    setCreatedTrip(null);
    try {
      const payload = {
        from: form.from.trim(),
        to: form.to.trim(),
        startDate: form.startDate || undefined,
        expectedEndDate: form.expectedEndDate || undefined,
        departureDate: form.startDate || undefined,
        distance: form.distance ? parseFloat(form.distance) : undefined,
        customer: form.customer.trim() || undefined,
        agencyName: form.agencyName.trim(),
        agencyCost: form.agencyCost ? parseFloat(form.agencyCost) : undefined,
        cabCost: form.cabCost ? parseFloat(form.cabCost) : undefined,
        advance: form.advance ? parseFloat(form.advance) : undefined,
        ownerProfit: profit,
        amount: form.agencyCost ? parseFloat(form.agencyCost) : undefined,
        notes: form.notes.trim() || undefined,
      };
      const saved = await createTrip({
        vehicleId,
        driverId: driverId || undefined,
        ...payload,
      });
      setCreatedTrip(saved);
      resetFormFields();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create trip');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100/80">
      {/* Top strip — stays in view */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5 lg:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Create New Trip</h1>
            <p className="mt-0.5 text-sm text-slate-600">
              Changes to existing trips:{' '}
              <Link to="/vehicles" className="font-semibold text-indigo-600 underline-offset-2 hover:underline">
                Trip Details
              </Link>{' '}
              → Trip &amp; Driver
            </p>
          </div>
          {createdTrip && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 sm:max-w-md">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <span className="min-w-0 font-medium leading-snug">
                {createdTrip.tripNumber ? `Trip #${createdTrip.tripNumber}` : 'Trip saved'}. Add another below.
              </span>
              <button
                type="button"
                onClick={() => setCreatedTrip(null)}
                className="shrink-0 rounded-lg p-1 text-emerald-800 hover:bg-emerald-100"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden px-3 py-3 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
        {listsLoading && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-600 shadow-sm">
            Loading vehicles and drivers…
          </p>
        )}
        {listsError && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800">{listsError}</p>
        )}

        {!listsLoading && !listsError && (
          <form
            onSubmit={submit}
            className="mx-auto flex h-full min-h-0 max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md"
          >
            {/* Single scroll region only if content exceeds viewport (e.g. small laptop height) */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
              <div className="grid grid-cols-1 gap-6 p-4 sm:p-5 lg:grid-cols-2 lg:gap-x-10 lg:gap-y-4 lg:p-6 xl:gap-x-12">
                {error && (
                  <div className="lg:col-span-2">
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Column 1 — who & where */}
                <div className="flex min-h-0 flex-col gap-3 sm:gap-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Vehicle &amp; route</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <Field label="Vehicle" id="c-vehicle" required>
                      <div className="relative">
                        <Car className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <select
                          id="c-vehicle"
                          required
                          value={vehicleId}
                          onChange={(e) => setVehicleId(e.target.value)}
                          className={`${inputCls} pl-11`}
                        >
                          <option value="">Select vehicle…</option>
                          {vehicles.map((v) => (
                            <option key={v._id} value={v._id}>
                              {v.vehicleNumber}
                              {v.vehicleModel ? ` — ${v.vehicleModel}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </Field>
                    <Field label="Driver (optional)" id="c-driver">
                      <div className="relative">
                        <Users className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <select
                          id="c-driver"
                          value={driverId}
                          onChange={(e) => setDriverId(e.target.value)}
                          className={`${inputCls} pl-11`}
                        >
                          <option value="">Assign later</option>
                          {drivers.map((d) => (
                            <option key={d._id} value={d._id}>
                              {driverLabel(d)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <Field label="From" id="c-from" required>
                      <input
                        id="c-from"
                        value={form.from}
                        onChange={set('from')}
                        required
                        className={inputCls}
                        placeholder="Origin"
                      />
                    </Field>
                    <Field label="To" id="c-to" required>
                      <input
                        id="c-to"
                        value={form.to}
                        onChange={set('to')}
                        required
                        className={inputCls}
                        placeholder="Destination"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <Field label="Start date" id="c-startdate">
                      <input id="c-startdate" type="date" value={form.startDate} onChange={set('startDate')} className={inputCls} />
                    </Field>
                    <Field label="Expected end date" id="c-enddate">
                      <input
                        id="c-enddate"
                        type="date"
                        value={form.expectedEndDate}
                        onChange={set('expectedEndDate')}
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <Field label="Distance (km)" id="c-dist">
                      <input id="c-dist" type="number" value={form.distance} onChange={set('distance')} className={inputCls} placeholder="0" />
                    </Field>
                    <Field label="Customer (optional)" id="c-cus">
                      <input id="c-cus" value={form.customer} onChange={set('customer')} className={inputCls} placeholder="Name" />
                    </Field>
                  </div>
                </div>

                {/* Column 2 — agency & money */}
                <div className="flex min-h-0 flex-col gap-3 sm:gap-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Agency &amp; amounts</p>
                  <Field label="Agency name" id="c-agn" required>
                    <AgencyNameCombobox
                      id="c-agn"
                      required
                      value={form.agencyName}
                      onChange={(agencyName) =>
                        setForm((prev) => ({ ...prev, agencyName }))
                      }
                      inputClassName={inputCls}
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                    <Field label="Agency cost (₹)" id="c-agencyC">
                      <input
                        id="c-agencyC"
                        type="number"
                        step="0.01"
                        value={form.agencyCost}
                        onChange={set('agencyCost')}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Cab cost (₹)" id="c-cabC">
                      <input id="c-cabC" type="number" step="0.01" value={form.cabCost} onChange={set('cabCost')} className={inputCls} />
                    </Field>
                    <Field label="Advance (₹)" id="c-advance">
                      <input id="c-advance" type="number" step="0.01" value={form.advance} onChange={set('advance')} className={inputCls} />
                    </Field>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                    <Calculator className="h-6 w-6 shrink-0 text-indigo-600" />
                    <span className="text-base font-bold text-indigo-900">Owner profit: ₹{profit}</span>
                  </div>

                  <Field label="Notes (optional)" id="c-notes">
                    <textarea
                      id="c-notes"
                      value={form.notes}
                      onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                      className={`${inputCls} min-h-18 resize-y`}
                      rows={2}
                      placeholder="Anything the driver or office should know…"
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5 lg:px-6">
              <Link
                to="/vehicles"
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Trip Details
              </Link>
              <button
                type="submit"
                disabled={saving || !vehicleId || !form.agencyName.trim()}
                className="rounded-xl bg-indigo-600 px-8 py-2.5 text-base font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create trip'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
