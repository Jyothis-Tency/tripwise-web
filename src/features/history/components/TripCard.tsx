import { useState, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, Trash2, Car, User, Calendar,
  DollarSign, Clock, Pencil, Check, X,
} from 'lucide-react';
import type { HistoryTrip, TripPayment, RecordPaymentTripSummary } from '../api';
import { recordPayment, deleteTrip, fetchPaymentHistory, updateTripFields } from '../api';
import { PaymentHistoryModal } from './PaymentHistoryModal';
import { fmtTimeAmPm, isoToTimeInputInTz, fmtTripDuration } from '../historyTimeUtils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

function fmtCurrency(v: unknown): string {
  const n = parseFloat(String(v ?? 0));
  if (isNaN(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(v: unknown): string {
  if (!v) return '—';
  return String(v).split('T')[0];
}

function driverName(d: HistoryTrip['driver']): string {
  if (!d) return '—';
  if (typeof d === 'string') return d;
  return `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim() || '—';
}

function vehicleNum(v: HistoryTrip['vehicle']): string {
  if (!v) return '—';
  if (typeof v === 'string') return v;
  return v.vehicleNumber ?? '—';
}

function getPaymentStatus(trip: HistoryTrip): { label: string; color: string; bg: string } {
  const ps = trip.paymentSummary?.paymentStatus;
  if (ps === 'paid') return { label: 'Paid', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (ps === 'partial') return { label: 'Partial', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  return { label: 'Unpaid', color: 'text-red-700', bg: 'bg-red-50 border-red-200' };
}

function getTripStatusStyle(status: string): string {
  switch (status?.toLowerCase()) {
    case 'completed': return 'bg-emerald-500 text-white';
    case 'cancelled': return 'bg-red-500 text-white';
    case 'in_progress': return 'bg-blue-500 text-white';
    case 'scheduled': return 'bg-indigo-500 text-white';
    default: return 'bg-slate-400 text-white';
  }
}

const NUMBER_FIELDS = new Set([
  'distance', 'agencyCost', 'cabCost', 'driver_salary', 'advance',
  'startKilometers', 'endKilometers',
]);

const DATE_FIELDS = new Set(['startDate', 'expectedEndDate']);
const TIME_FIELDS = new Set(['startTime', 'endTime']);

const valueEmphasisClass = (highlight?: boolean) =>
  `text-base sm:text-lg font-bold tabular-nums tracking-tight ${highlight ? 'text-indigo-700' : 'text-slate-900'}`;

// ─── Compact Detail Row ──────────────────────────────────────────────────────

function DetailRow({ label, value, highlight, emphasizeValue }: { label: string; value: string; highlight?: boolean; emphasizeValue?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 py-1.5">
      <span className="w-[130px] sm:w-[150px] shrink-0 text-sm sm:text-[15px] text-slate-600">{label}</span>
      <span className={emphasizeValue ? valueEmphasisClass(highlight) : `text-sm sm:text-[15px] font-medium ${highlight ? 'text-indigo-600' : 'text-slate-800'}`}>{value}</span>
    </div>
  );
}

// ─── Editable Detail Row ─────────────────────────────────────────────────────

function EditableRow({
  label, value, highlight, fieldKey, tripId, onSaved, timeEditSeed,
}: {
  label: string; value: string; highlight?: boolean;
  fieldKey: string; tripId: string; onSaved: (updatedTrip: HistoryTrip) => void;
  /** For `type="time"` rows: HH:mm seed from ISO (not the AM/PM display string). */
  timeEditSeed?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const [editValue, setEditValue] = useState(value === '—' ? '' : value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDisplayValue(value);
  }, [value, editing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let val: string | number = editValue;
      if (NUMBER_FIELDS.has(fieldKey)) {
        const parsed = Number(editValue);
        if (editValue.trim() === '' || !Number.isFinite(parsed)) {
          throw new Error('Enter a valid number');
        }
        if (parsed < 0) {
          throw new Error('Negative values are not allowed');
        }
        val = parsed;
      }
      const updatedTrip = await updateTripFields(tripId, { [fieldKey]: val } as any);
      // Update locally — no full page reload
      const newDisplay = NUMBER_FIELDS.has(fieldKey)
        ? (fieldKey === 'agencyCost' || fieldKey === 'cabCost' || fieldKey === 'driver_salary'
            ? fmtCurrency(val)
            : String(val))
        : editValue || '—';
      setDisplayValue(newDisplay);
      setEditing(false);
      onSaved(updatedTrip);
    } catch (err: any) {
      alert(err?.message || err?.response?.data?.message || 'Failed to update field');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(displayValue === '—' ? '' : displayValue);
    setEditing(false);
  };

  const emphasizeDisplay =
    NUMBER_FIELDS.has(fieldKey) || DATE_FIELDS.has(fieldKey) || TIME_FIELDS.has(fieldKey);

  if (editing) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-2 py-1 sm:flex-row sm:items-center sm:gap-2">
        <span className="w-full shrink-0 text-sm sm:text-[15px] text-slate-600 sm:w-[130px] sm:max-w-[150px]">{label}</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <input
            autoFocus
            type={NUMBER_FIELDS.has(fieldKey) ? 'number' : fieldKey.toLowerCase().includes('time') ? 'time' : 'text'}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
            className={`min-h-[32px] min-w-0 flex-1 basis-[6rem] rounded-md border border-indigo-300 bg-white px-2 py-1.5 leading-tight outline-none focus:ring-2 focus:ring-indigo-200 sm:basis-[8rem] ${NUMBER_FIELDS.has(fieldKey) || DATE_FIELDS.has(fieldKey) || TIME_FIELDS.has(fieldKey) ? 'text-base sm:text-lg font-semibold tabular-nums' : 'text-sm'}`}
            disabled={saving}
          />
          <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-slate-200/80 bg-white/80 p-0.5 shadow-sm">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded p-1 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40"
              aria-label="Save"
            >
              {saving ? <div className="h-4 w-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex min-w-0 items-baseline gap-2 py-1.5">
      <span className="w-[130px] sm:w-[150px] shrink-0 text-sm sm:text-[15px] text-slate-600">{label}</span>
      <span className={`min-w-0 flex-1 wrap-break-word ${emphasizeDisplay ? valueEmphasisClass(highlight) : `text-sm sm:text-[15px] font-medium ${highlight ? 'text-indigo-600' : 'text-slate-800'}`}`}>{displayValue}</span>
      <button
        onClick={() => {
          const isTime = fieldKey.toLowerCase().includes('time');
          let seed = displayValue === '—' ? '' : displayValue.replace(/^₹/, '').replace(/,/g, '');
          if (isTime && timeEditSeed !== undefined) seed = timeEditSeed;
          setEditValue(seed);
          setEditing(true);
        }}
        className="ml-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-indigo-500 transition-opacity p-0.5"
        title={`Edit ${label}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({ trip, onClose, onSuccess }: {
  trip: HistoryTrip;
  onClose: () => void;
  onSuccess: (summary: RecordPaymentTripSummary) => void;
}) {
  const remaining = trip.paymentSummary?.remainingBalance ?? 0;
  const balanceCleared = remaining <= 1e-6;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Please enter a valid amount.'); return; }
    setSaving(true);
    setError('');
    try {
      const summary = await recordPayment(trip._id, { amount: amt, paymentMethod: method, referenceNumber: reference || undefined, notes: notes || undefined, paymentDate: date });
      onSuccess(summary);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to record payment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const amtPreview = parseFloat(amount);
  const showOverpayNote =
    Number.isFinite(amtPreview) &&
    amtPreview > 0 &&
    remaining > 1e-6 &&
    amtPreview > remaining + 1e-6;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Record Payment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2.5 text-sm sm:text-base text-indigo-900">
            <span className="font-semibold">{fmt(trip.tripNumber)}</span>
            <span className="text-indigo-700"> · Remaining: </span>
            <span className="font-bold tabular-nums text-base sm:text-lg">{fmtCurrency(remaining)}</span>
          </div>
          {balanceCleared && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm font-medium text-emerald-900">
              Balance is cleared. You can still record more payments here (overpayment, correction, or extra receipt).
            </p>
          )}
          {showOverpayNote && (
            <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm font-medium text-amber-950">
              This amount is above the remaining balance. It will be saved; remaining may show as negative (overpaid) until you adjust the trip.
            </p>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Amount *</label>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200">
              <span className="px-3 text-base font-semibold text-slate-600 bg-slate-50 border-r border-slate-200 py-2.5">₹</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount"
                className="flex-1 px-3 py-2.5 text-base sm:text-lg font-bold tabular-nums outline-none bg-white" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-base outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200">
              {[{v:'cash',l:'Cash'},{v:'bank_transfer',l:'Bank Transfer'},{v:'upi',l:'UPI'},{v:'cheque',l:'Cheque'},{v:'online',l:'Online'},{v:'other',l:'Other'}].map(m => (
                <option key={m.v} value={m.v}>{m.l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-base font-semibold tabular-nums outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Reference Number</label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-base outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-base outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 resize-none" />
          </div>

          {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-3 text-base font-semibold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-base font-bold transition disabled:opacity-60">
            {saving ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Trip Card ────────────────────────────────────────────────────────────────

interface TripCardProps {
  trip: HistoryTrip;
  onDeleted: () => void;
  /** Called with server summary after a payment; parent can patch list without refetching. */
  onPaymentRecorded: (tripId: string, summary: RecordPaymentTripSummary) => void;
}

export function TripCard({ trip: initialTrip, onDeleted, onPaymentRecorded }: TripCardProps) {
  const [trip, setTrip] = useState<HistoryTrip>(initialTrip);

  useEffect(() => {
    setTrip(initialTrip);
  }, [initialTrip]);

  const [expanded, setExpanded] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [payments, setPayments] = useState<TripPayment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const paymentBadge = getPaymentStatus(trip);
  const expensePart = Number(trip.totalExpenses) || 0;
  const totalAmount =
    trip.paymentSummary?.totalAmount ??
    (Number(trip.agencyCost) || 0) + expensePart;
  const paidAmount = trip.paymentSummary?.paidAmount ?? trip.paidAmount ?? 0;
  const remaining = trip.paymentSummary?.remainingBalance ?? (totalAmount - paidAmount);
  const progress = totalAmount > 0 ? Math.min((paidAmount / totalAmount) * 100, 100) : 0;

  const travelledKm = (trip.startKilometers != null && trip.endKilometers != null)
    ? (trip.endKilometers - trip.startKilometers)
    : null;

  const remainingHeaderShort =
    remaining < -1e-6 ? 'Overpaid' : 'Remaining';

  const handleDelete = async () => {
    if (!confirm('Delete this trip? This cannot be undone.')) return;
    setDeleting(true);
    try { await deleteTrip(trip._id); onDeleted(); }
    catch { alert('Failed to delete trip.'); }
    finally { setDeleting(false); }
  };

  const handleOpenHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await fetchPaymentHistory(trip._id);
      setPayments(data.payments);
      setShowHistoryModal(true);
    } catch {
      alert('Failed to load payment history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Shorthand for editable rows
  const E = (label: string, value: string, fieldKey: string, hl?: boolean, timeEditSeed?: string) => (
    <EditableRow
      label={label}
      value={value}
      fieldKey={fieldKey}
      tripId={trip._id}
      onSaved={(updatedTrip) => {
        setTrip((prev) => {
          const next: HistoryTrip = { ...prev, ...updatedTrip };

          // `patchTripFields` may return relation fields as raw IDs.
          // Keep already-populated objects so UI doesn't regress to ObjectId text.
          if (
            updatedTrip.driver &&
            typeof updatedTrip.driver === 'string' &&
            prev.driver &&
            typeof prev.driver !== 'string'
          ) {
            next.driver = prev.driver;
          }
          if (
            updatedTrip.vehicle &&
            typeof updatedTrip.vehicle === 'string' &&
            prev.vehicle &&
            typeof prev.vehicle !== 'string'
          ) {
            next.vehicle = prev.vehicle;
          }

          return next;
        });
      }}
      highlight={hl}
      timeEditSeed={timeEditSeed}
    />
  );

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        {/* Header row */}
        <div className="flex items-start gap-3 px-4 sm:px-5 py-3.5 sm:py-4 cursor-pointer hover:bg-slate-50/60 transition"
          onClick={() => setExpanded(e => !e)}>

          {/* Trip info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg sm:text-xl font-bold text-slate-900 truncate tabular-nums tracking-tight">
                {trip.tripNumber ?? trip._id}
              </span>
              <span
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs sm:text-sm font-bold uppercase tracking-wide ${getTripStatusStyle(trip.status)}`}
              >
                {trip.status?.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:text-[15px] text-slate-600">
              {(trip.from || trip.pickup) && (trip.to || trip.drop) && (
                <span className="truncate font-medium">{trip.from ?? trip.pickup} → {trip.to ?? trip.drop}</span>
              )}
              <span className="flex items-center gap-1.5 font-bold text-slate-900 tabular-nums text-base sm:text-lg">
                <Calendar className="h-5 w-5 shrink-0 text-slate-600" aria-hidden />
                {fmtDate(trip.startDate ?? trip.date)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:text-[15px] text-slate-600">
              <span className="flex items-center gap-1.5"><User className="h-4 w-4 shrink-0" />{driverName(trip.driver)}</span>
              <span className="flex items-center gap-1.5 tabular-nums">
                <Car className="h-4 w-4 shrink-0" />
                {vehicleNum(trip.vehicle)}
                {travelledKm != null && (
                  <span className="font-bold text-slate-900 text-base sm:text-[17px]"> · {travelledKm} km</span>
                )}
              </span>
            </div>
          </div>

          {/* Right: payment summary + actions */}
          <div className="shrink-0 flex items-start gap-2 sm:gap-3">
            <div className="flex flex-col items-end gap-1 text-right min-w-0 max-w-[11rem] sm:max-w-[13rem]">
              <div className="flex flex-col items-end gap-0.5 w-full">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] sm:text-xs font-bold ${paymentBadge.bg} ${paymentBadge.color}`}
                >
                  {paymentBadge.label}
                </span>
                <span
                  className={`text-xs sm:text-sm font-bold tabular-nums leading-tight ${
                    remaining < -1e-6
                      ? 'text-indigo-700'
                      : remaining > 1e-6
                        ? 'text-amber-800'
                        : 'text-emerald-800'
                  }`}
                >
                  {remainingHeaderShort}: {fmtCurrency(remaining)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                disabled={deleting}
                className="text-red-400 hover:text-red-600 transition disabled:opacity-40 p-1"
                aria-label="Delete trip"
              >
                <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <button
                type="button"
                className="p-0.5 text-slate-400 hover:text-slate-600"
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse trip' : 'Expand trip'}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((x) => !x);
                }}
              >
                {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-slate-100 px-4 sm:px-5 py-4 sm:py-5">
            <div className="grid min-w-0 grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-3">
            {/* Trip Details */}
            <section className="xl:col-span-2">
              <h4 className="text-sm font-bold text-indigo-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-indigo-400 rounded-full"></span>
                Trip Details
              </h4>
              <div className="bg-slate-50/50 rounded-lg px-4 sm:px-5 py-3 sm:py-4">
                <DetailRow label="Trip Number" value={fmt(trip.tripNumber)} emphasizeValue />
                <DetailRow label="Status" value={fmt(trip.status)} />
                {E('Start Date', fmtDate(trip.startDate ?? trip.date), 'startDate')}
                {trip.endDate && E('End Date', fmtDate(trip.endDate), 'expectedEndDate')}
                {E('Start Time', fmtTimeAmPm(trip.startTime), 'startTime', undefined, isoToTimeInputInTz(trip.startTime))}
                {E('End Time', fmtTimeAmPm(trip.endTime), 'endTime', undefined, isoToTimeInputInTz(trip.endTime))}
                <DetailRow label="Trip duration" value={fmtTripDuration(trip.startTime, trip.endTime)} highlight emphasizeValue />
                <DetailRow label="Driver" value={driverName(trip.driver)} />
                {typeof trip.driver !== 'string' && trip.driver?.phone && (
                  <DetailRow label="Driver Phone" value={fmt(trip.driver.phone)} emphasizeValue />
                )}
                <DetailRow label="Vehicle" value={vehicleNum(trip.vehicle)} />
                {typeof trip.vehicle !== 'string' && trip.vehicle?.vehicleType && (
                  <DetailRow label="Vehicle Type" value={fmt(trip.vehicle.vehicleType)} />
                )}
                {E('From', fmt(trip.from ?? trip.pickup ?? ''), 'from')}
                {E('To', fmt(trip.to ?? trip.drop ?? ''), 'to')}
                {E('Distance', fmt(trip.distance || ''), 'distance')}
                {E('Start KM', trip.startKilometers != null ? `${trip.startKilometers}` : '—', 'startKilometers')}
                {E('End KM', trip.endKilometers != null ? `${trip.endKilometers}` : '—', 'endKilometers')}
                {travelledKm != null && <DetailRow label="KM Travelled" value={`${travelledKm} km`} highlight emphasizeValue />}
                {E('Customer', fmt(trip.customer || ''), 'customer')}
                {E('Agency', fmt(trip.agencyName || ''), 'agencyName')}
                {trip.careOf?.name && <DetailRow label="Care Of" value={fmt(trip.careOf.name)} />}
                {E('Notes', fmt(trip.notes ?? trip.completionNote ?? ''), 'notes')}
              </div>
            </section>

            <div className="min-w-0 space-y-5 sm:space-y-6 xl:col-span-1">
              {/* Financial Details */}
              <section className="min-w-0">
                <h4 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-1 h-4 bg-emerald-400 rounded-full"></span>
                  Financial Details
                </h4>
                <div className="min-w-0 overflow-x-auto rounded-lg bg-emerald-50/30 px-4 py-3 sm:px-5 sm:py-4">
                  {E('Agency Cost', fmtCurrency(trip.agencyCost), 'agencyCost')}
                  {E('Cab Cost', fmtCurrency(trip.cabCost), 'cabCost')}
                  {E('Driver Salary', fmtCurrency(trip.driver_salary), 'driver_salary')}
                  {E('Advance', fmtCurrency(trip.advance), 'advance')}
                  <DetailRow label="Total Expenses" value={fmtCurrency(trip.totalExpenses)} emphasizeValue />
                  <DetailRow label="Owner Profit" value={fmtCurrency(trip.ownerProfit)} highlight emphasizeValue />
                </div>
              </section>

              {/* Payment Status */}
              <section>
                <h4 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="flex items-center gap-2">
                    <span className="w-1 h-4 bg-amber-400 rounded-full shrink-0" />
                    Payment Status
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-amber-50/90 px-2 py-0.5 text-xs sm:text-sm font-bold normal-case tracking-normal text-amber-950 tabular-nums">
                    <span className={`rounded-full border px-1.5 py-0 text-[10px] font-bold ${paymentBadge.bg} ${paymentBadge.color}`}>
                      {paymentBadge.label}
                    </span>
                    <span className="text-slate-700 font-semibold">{remainingHeaderShort}:</span>
                    {fmtCurrency(remaining)}
                  </span>
                </h4>
                {/* Progress bar */}
                <div className="h-3 sm:h-3.5 bg-slate-100 rounded-full overflow-hidden mb-3 shadow-inner">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progress}%`,
                      background: progress >= 100
                        ? 'linear-gradient(90deg, #10b981, #059669)'
                        : progress > 0
                          ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                          : '#ef4444',
                    }} />
                </div>
                <div className="mb-3 bg-slate-50/50 rounded-lg px-4 sm:px-5 py-3 sm:py-4">
                  <DetailRow label="Total Amount" value={fmtCurrency(totalAmount)} emphasizeValue />
                  <DetailRow label="Paid Amount" value={fmtCurrency(paidAmount)} highlight={paidAmount > 0} emphasizeValue />
                  <DetailRow
                    label={remaining < -1e-6 ? 'Overpaid (credit)' : 'Remaining'}
                    value={fmtCurrency(remaining)}
                    highlight={remaining > 1e-6 || remaining < -1e-6}
                    emphasizeValue
                  />
                </div>
                <div className="flex flex-col sm:flex-row xl:flex-col gap-2.5">
                  <button onClick={() => setShowPaymentModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 rounded-lg py-3 sm:py-3 text-base font-bold transition">
                    <DollarSign className="h-5 w-5" /> Record Payment
                  </button>
                  <button onClick={handleOpenHistory} disabled={loadingHistory}
                    className="flex-1 flex items-center justify-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg py-3 sm:py-3 text-base font-bold transition disabled:opacity-50">
                    {loadingHistory ? <div className="h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Clock className="h-4.5 w-4.5" />}
                    History
                  </button>
                </div>
              </section>
            </div>
            </div>
          </div>
        )}
      </div>

      {showPaymentModal && (
        <RecordPaymentModal
          trip={trip}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={(summary) => {
            setShowPaymentModal(false);
            const ps = summary.paymentStatus;
            const paymentStatus =
              ps === 'paid' || ps === 'partial' || ps === 'unpaid' ? ps : 'unpaid';
            setTrip((prev) => ({
              ...prev,
              paidAmount: summary.paidAmount,
              paymentSummary: {
                ...prev.paymentSummary,
                totalAmount: summary.totalAmount,
                paidAmount: summary.paidAmount,
                remainingBalance: summary.remainingBalance,
                paymentStatus,
              },
            }));
            onPaymentRecorded(trip._id, summary);
          }}
        />
      )}

      {showHistoryModal && (
        <PaymentHistoryModal
          tripNumber={trip.tripNumber || trip._id}
          payments={payments}
          summary={{
            totalAmount: trip.paymentSummary?.totalAmount ?? 0,
            totalPaid: trip.paymentSummary?.paidAmount ?? 0,
            remainingBalance: trip.paymentSummary?.remainingBalance ?? 0,
            paymentStatus: trip.paymentSummary?.paymentStatus ?? 'unpaid'
          }}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </>
  );
}
