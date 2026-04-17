import { useState, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, Trash2, Car, User, Calendar,
  DollarSign, Clock, Pencil, Check, X,
} from 'lucide-react';
import type { HistoryTrip, TripPayment } from '../api';
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

// ─── Compact Detail Row ──────────────────────────────────────────────────────

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline py-1">
      <span className="w-[130px] sm:w-[150px] shrink-0 text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-indigo-600' : 'text-slate-800'}`}>{value}</span>
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

  if (editing) {
    return (
      <div className="flex items-center py-0.5 gap-1.5">
        <span className="w-[130px] sm:w-[150px] shrink-0 text-sm text-slate-500">{label}</span>
        <input
          autoFocus
          type={NUMBER_FIELDS.has(fieldKey) ? 'number' : fieldKey.toLowerCase().includes('time') ? 'time' : 'text'}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
          className="w-[140px] sm:w-[180px] max-w-[50%] border border-indigo-300 rounded-md px-2 py-1 text-sm leading-tight outline-none focus:ring-1 focus:ring-indigo-200 bg-white h-[28px]"
          disabled={saving}
        />
        <button onClick={handleSave} disabled={saving} className="p-1 text-emerald-600 hover:text-emerald-700 disabled:opacity-40">
          {saving ? <div className="h-4 w-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /> : <Check className="h-4 w-4" />}
        </button>
        <button onClick={handleCancel} className="p-1 text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-baseline py-1">
      <span className="w-[130px] sm:w-[150px] shrink-0 text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-indigo-600' : 'text-slate-800'}`}>{displayValue}</span>
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
  onSuccess: () => void;
}) {
  const remaining = trip.paymentSummary?.remainingBalance ?? 0;
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
      await recordPayment(trip._id, { amount: amt, paymentMethod: method, referenceNumber: reference || undefined, notes: notes || undefined, paymentDate: date });
      onSuccess();
    } catch {
      setError('Failed to record payment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Record Payment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-700">
            {fmt(trip.tripNumber)} · Remaining: {fmtCurrency(remaining)}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Amount *</label>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-200">
              <span className="px-3 text-sm text-slate-500 bg-slate-50 border-r border-slate-200 py-2">₹</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount"
                className="flex-1 px-3 py-2 text-sm outline-none bg-white" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200">
              {[{v:'cash',l:'Cash'},{v:'bank_transfer',l:'Bank Transfer'},{v:'upi',l:'UPI'},{v:'cheque',l:'Cheque'},{v:'online',l:'Online'},{v:'other',l:'Other'}].map(m => (
                <option key={m.v} value={m.v}>{m.l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Reference Number</label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none" />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-60">
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
  onPaymentRecorded: () => void;
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
  const totalAmount = trip.paymentSummary?.totalAmount ?? trip.agencyCost ?? 0;
  const paidAmount = trip.paymentSummary?.paidAmount ?? trip.paidAmount ?? 0;
  const remaining = trip.paymentSummary?.remainingBalance ?? (totalAmount - paidAmount);
  const progress = totalAmount > 0 ? Math.min((paidAmount / totalAmount) * 100, 100) : 0;

  const travelledKm = (trip.startKilometers != null && trip.endKilometers != null)
    ? (trip.endKilometers - trip.startKilometers)
    : null;

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
        setTrip(prev => ({ ...prev, ...updatedTrip }));
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

          {/* Status badge */}
          <span className={`shrink-0 mt-1 rounded-full px-3 py-1 text-[11px] sm:text-xs font-bold uppercase tracking-wide ${getTripStatusStyle(trip.status)}`}>
            {trip.status}
          </span>

          {/* Trip info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base sm:text-base font-semibold text-slate-800 truncate">
                {trip.tripNumber ?? trip._id}
              </span>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold ${paymentBadge.bg} ${paymentBadge.color}`}>
                {paymentBadge.label}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-500">
              {(trip.from || trip.pickup) && (trip.to || trip.drop) && (
                <span className="truncate">{trip.from ?? trip.pickup} → {trip.to ?? trip.drop}</span>
              )}
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{fmtDate(trip.startDate ?? trip.date)}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-slate-500">
              <span className="flex items-center gap-1"><User className="h-4 w-4" />{driverName(trip.driver)}</span>
              <span className="flex items-center gap-1"><Car className="h-4 w-4" />{vehicleNum(trip.vehicle)}{travelledKm != null ? ` · ${travelledKm} km` : ''}</span>
            </div>
          </div>

          {/* Right side */}
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <button onClick={e => { e.stopPropagation(); handleDelete(); }} disabled={deleting}
              className="text-red-400 hover:text-red-600 transition disabled:opacity-40 p-1">
              <Trash2 className="h-4 w-4" />
            </button>
            {expanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-slate-100 px-4 sm:px-5 py-4 sm:py-5">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-6">
            {/* Trip Details */}
            <section className="xl:col-span-2">
              <h4 className="text-sm font-bold text-indigo-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-indigo-400 rounded-full"></span>
                Trip Details
              </h4>
              <div className="bg-slate-50/50 rounded-lg px-4 sm:px-5 py-3 sm:py-4">
                <DetailRow label="Trip Number" value={fmt(trip.tripNumber)} />
                <DetailRow label="Status" value={fmt(trip.status)} />
                {E('Start Date', fmtDate(trip.startDate ?? trip.date), 'startDate')}
                {trip.endDate && E('End Date', fmtDate(trip.endDate), 'expectedEndDate')}
                {E('Start Time', fmtTimeAmPm(trip.startTime), 'startTime', undefined, isoToTimeInputInTz(trip.startTime))}
                {E('End Time', fmtTimeAmPm(trip.endTime), 'endTime', undefined, isoToTimeInputInTz(trip.endTime))}
                <DetailRow label="Trip duration" value={fmtTripDuration(trip.startTime, trip.endTime)} highlight />
                <DetailRow label="Driver" value={driverName(trip.driver)} />
                {typeof trip.driver !== 'string' && trip.driver?.phone && (
                  <DetailRow label="Driver Phone" value={fmt(trip.driver.phone)} />
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
                {travelledKm != null && <DetailRow label="KM Travelled" value={`${travelledKm} km`} highlight />}
                {E('Customer', fmt(trip.customer || ''), 'customer')}
                {E('Agency', fmt(trip.agencyName || ''), 'agencyName')}
                {trip.careOf?.name && <DetailRow label="Care Of" value={fmt(trip.careOf.name)} />}
                {E('Notes', fmt(trip.notes ?? trip.completionNote ?? ''), 'notes')}
              </div>
            </section>

            <div className="xl:col-span-1 space-y-5 sm:space-y-6">
              {/* Financial Details */}
              <section>
                <h4 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-1 h-4 bg-emerald-400 rounded-full"></span>
                  Financial Details
                </h4>
                <div className="bg-emerald-50/30 rounded-lg px-4 sm:px-5 py-3 sm:py-4">
                  {E('Agency Cost', fmtCurrency(trip.agencyCost), 'agencyCost')}
                  {E('Cab Cost', fmtCurrency(trip.cabCost), 'cabCost')}
                  {E('Driver Salary', fmtCurrency(trip.driver_salary), 'driver_salary')}
                  {E('Advance', fmtCurrency(trip.advance), 'advance')}
                  <DetailRow label="Total Expenses" value={fmtCurrency(trip.totalExpenses)} />
                  <DetailRow label="Owner Profit" value={fmtCurrency(trip.ownerProfit)} highlight />
                </div>
              </section>

              {/* Payment Status */}
              <section>
                <h4 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-1 h-4 bg-amber-400 rounded-full"></span>
                  Payment Status
                </h4>
                {/* Progress bar */}
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3 shadow-inner">
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
                  <DetailRow label="Total Amount" value={fmtCurrency(totalAmount)} />
                  <DetailRow label="Paid Amount" value={fmtCurrency(paidAmount)} highlight={paidAmount > 0} />
                  <DetailRow label="Remaining" value={fmtCurrency(remaining)} highlight={remaining > 0} />
                </div>
                <div className="flex flex-col sm:flex-row xl:flex-col gap-2.5">
                  <button onClick={() => setShowPaymentModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 rounded-lg py-3 sm:py-2.5 text-sm font-semibold transition">
                    <DollarSign className="h-4.5 w-4.5" /> Record Payment
                  </button>
                  <button onClick={handleOpenHistory} disabled={loadingHistory}
                    className="flex-1 flex items-center justify-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg py-3 sm:py-2.5 text-sm font-semibold transition disabled:opacity-50">
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
          onSuccess={() => { setShowPaymentModal(false); onPaymentRecorded(); }}
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
