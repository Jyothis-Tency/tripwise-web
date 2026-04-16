import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import {
  fetchMainTripPayoutAgencies,
  fetchHistoryAgencyPayoutSummary,
  fetchMainTripPayoutAgencyTrips,
  addHistoryAgencyPayoutPayment,
  deleteHistoryPayoutPayment,
  type HistoryPayoutAgency,
  type HistoryAgencyPayoutSummary,
  type HistoryPayoutAgencyTrip,
} from '../api';

function fmtCurrency(v: number): string {
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function AgencyPayoutManager({ agency }: { agency: HistoryPayoutAgency }) {
  const [data, setData] = useState<HistoryAgencyPayoutSummary | null>(null);
  const [trips, setTrips] = useState<HistoryPayoutAgencyTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, agencyTrips] = await Promise.all([
        fetchHistoryAgencyPayoutSummary(agency._id),
        fetchMainTripPayoutAgencyTrips(agency._id),
      ]);
      setData(summary);
      setTrips(agencyTrips);
    } catch {
      setData(null);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [agency._id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addHistoryAgencyPayoutPayment(agency._id, {
        amount: amt,
        paymentDate,
        paymentMethod,
        notes,
      });
      setAmount('');
      setNotes('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to add payment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (paymentId: string) => {
    if (!confirm('Delete this payment record?')) return;
    try {
      await deleteHistoryPayoutPayment(paymentId);
      await load();
    } catch {
      alert('Failed to delete payment');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
      </div>
    );
  }

  const gt = data?.grandTotal ?? 0;
  const received = data?.totalReceived ?? 0;
  const remaining = data?.remaining ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase text-slate-400">Grand Total</div>
          <div className="text-base font-bold text-slate-800">{fmtCurrency(gt)}</div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase text-slate-400">Received</div>
          <div className="text-base font-bold text-emerald-700">{fmtCurrency(received)}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase text-slate-400">Remaining</div>
          <div className="text-base font-bold text-amber-700">{fmtCurrency(remaining)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white"
          />
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white"
          />
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white"
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
            <option value="online">Online</option>
            <option value="other">Other</option>
          </select>
          <input
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {saving ? 'Adding…' : 'Add Payment'}
        </button>
      </div>

      <div className="space-y-2">
        {(data?.payments ?? []).length === 0 ? (
          <p className="text-sm text-slate-400 py-2">No payments recorded yet</p>
        ) : (
          data!.payments.map((p) => (
            <div key={p._id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-emerald-600">{fmtCurrency(p.amount)}</div>
                <div className="text-xs text-slate-400">
                  {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : '—'}
                  {p.notes ? ` · ${p.notes}` : ''}
                </div>
              </div>
              <button onClick={() => handleDelete(p._id)} className="text-red-400 hover:text-red-600 p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">Agency Trips</h4>
        {trips.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">No trips found for this agency.</p>
        ) : (
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-auto max-h-72">
              <table className="min-w-[860px] w-full text-xs">
                <thead className="bg-slate-50 text-slate-600 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Trip No</th>
                    <th className="px-3 py-2 text-left">Driver</th>
                    <th className="px-3 py-2 text-left">From</th>
                    <th className="px-3 py-2 text-left">To</th>
                    <th className="px-3 py-2 text-left">Start Date</th>
                    <th className="px-3 py-2 text-right">Agency Cost</th>
                    <th className="px-3 py-2 text-right">Cab Cost</th>
                    <th className="px-3 py-2 text-right">Advance</th>
                    <th className="px-3 py-2 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((t) => (
                    <tr key={t._id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-700">{t.tripNumber || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{t.driverName || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{t.from || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{t.to || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{t.startDate || '—'}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{fmtCurrency(t.agencyCost || 0)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{fmtCurrency(t.cabCost || 0)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{fmtCurrency(t.advance || 0)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-indigo-700">{fmtCurrency(t.ownerProfit || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function HistoryPayoutPage() {
  const navigate = useNavigate();
  const [agencies, setAgencies] = useState<HistoryPayoutAgency[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAgencyId, setSelectedAgencyId] = useState('');
  const [agencySearch, setAgencySearch] = useState('');

  const loadAgencies = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchMainTripPayoutAgencies();
      setAgencies(list);
      setSelectedAgencyId((prev) => {
        if (prev && list.some((a) => (a._id ?? a.id) === prev)) return prev;
        return (list[0]?._id ?? list[0]?.id ?? '');
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgencies();
  }, [loadAgencies]);

  const filteredAgencies = agencies.filter((a) => {
    const q = agencySearch.trim().toLowerCase();
    if (!q) return true;
    return (a.name || '').toLowerCase().includes(q);
  });

  const selectedAgency = agencies.find(
    (a) => (a._id ?? a.id) === selectedAgencyId,
  );

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* LEFT: agency list panel */}
      <div
        className={`flex w-full lg:w-72 xl:w-80 shrink-0 flex-col border-r border-slate-200 bg-white transition-all ${
          selectedAgencyId ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Agency Payout</h2>
          <button
            type="button"
            onClick={loadAgencies}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg bg-indigo-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="relative border-b border-slate-100 px-3 py-2">
          <Search className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={agencySearch}
            onChange={(e) => setAgencySearch(e.target.value)}
            placeholder="Search agencies..."
            className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-3 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))
          ) : agencies.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-400">No agencies found in main trips yet.</p>
          ) : filteredAgencies.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-400">No agencies match your search.</p>
          ) : (
            filteredAgencies.map((a) => {
              const id = (a._id ?? a.id) as string;
              const active = id === selectedAgencyId;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedAgencyId(id)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                    active
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className={`text-sm font-semibold ${active ? 'text-indigo-700' : 'text-slate-700'}`}>
                    {a.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Tap to view payout details</div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: detail panel */}
      <div
        className={`flex-1 overflow-hidden transition-all ${
          selectedAgencyId ? 'flex flex-col' : 'hidden lg:flex flex-col'
        }`}
      >
        {selectedAgency ? (
          <div className="h-full overflow-y-auto p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-slate-800 truncate">
                  {selectedAgency.name}
                </h3>
                <p className="text-xs text-slate-500">Main trip agency payout details</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAgencyId('')}
                  className="lg:hidden flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/history')}
                  className="hidden lg:flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  History
                </button>
              </div>
            </div>
            <AgencyPayoutManager agency={selectedAgency} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center px-6">
              <p className="text-sm font-medium text-slate-500">No agency selected</p>
              <p className="mt-1 text-xs text-slate-400">
                Select an agency from the list to view payout details
              </p>
              <button
                type="button"
                onClick={() => navigate('/history')}
                className="mt-4 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to History
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

