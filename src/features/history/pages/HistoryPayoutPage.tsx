import { Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, RefreshCw, Search, Wallet, AlertCircle, ChevronDown, ChevronUp, History, Building2 } from 'lucide-react';
import {
  fetchMainTripPayoutAgencies,
  fetchHistoryAgencyPayoutSummary,
  fetchMainTripPayoutAgencyTrips,
  recordPayment,
  fetchPaymentHistory,
  type HistoryPayoutAgency,
  type HistoryAgencyPayoutSummary,
  type HistoryPayoutAgencyTrip,
  type TripPayment,
} from '../api';

function fmtCurrency(v: number): string {
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function AgencyPayoutManager({
  agency,
  onPayoutSaved,
}: {
  agency: HistoryPayoutAgency;
  onPayoutSaved?: () => Promise<void> | void;
}) {
  const [data, setData] = useState<HistoryAgencyPayoutSummary | null>(null);
  const [trips, setTrips] = useState<HistoryPayoutAgencyTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tripPayAmount, setTripPayAmount] = useState<Record<string, string>>({});
  const [savingTripId, setSavingTripId] = useState<string | null>(null);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [loadingHistoryTripId, setLoadingHistoryTripId] = useState<string | null>(null);
  const [paymentHistoryByTrip, setPaymentHistoryByTrip] = useState<
    Record<string, { payments: TripPayment[]; summary: { totalAmount: number; totalPaid: number; remainingBalance: number; paymentStatus: string } }>
  >({});

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

  const handleTripPayout = async (trip: HistoryPayoutAgencyTrip) => {
    const tripId = trip.tripId ?? trip._id;
    const amt = Number(tripPayAmount[tripId] || '');
    const remaining = Number(trip.remainingAmount) || 0;
    if (!amt || amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (remaining > 0 && amt > remaining) {
      setError('Amount cannot be greater than remaining');
      return;
    }
    setSavingTripId(tripId);
    setError(null);
    try {
      await recordPayment(tripId, {
        amount: amt,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'cash',
      });
      setTripPayAmount((prev) => ({ ...prev, [tripId]: '' }));
      await load();
      await onPayoutSaved?.();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to record payout');
    } finally {
      setSavingTripId(null);
    }
  };

  const handleToggleTripHistory = async (trip: HistoryPayoutAgencyTrip) => {
    const tripId = trip.tripId ?? trip._id;
    if (expandedTripId === tripId) {
      setExpandedTripId(null);
      return;
    }

    setExpandedTripId(tripId);
    if (paymentHistoryByTrip[tripId]) return;

    setLoadingHistoryTripId(tripId);
    try {
      const history = await fetchPaymentHistory(tripId);
      setPaymentHistoryByTrip((prev) => ({
        ...prev,
        [tripId]: {
          payments: history.payments || [],
          summary: {
            totalAmount: Number(history.summary?.totalAmount) || 0,
            totalPaid: Number(history.summary?.totalPaid) || 0,
            remainingBalance: Number(history.summary?.remainingBalance) || 0,
            paymentStatus: history.summary?.paymentStatus || 'unpaid',
          },
        },
      }));
    } catch {
      setError('Failed to load trip payout history');
    } finally {
      setLoadingHistoryTripId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const gt = data?.grandTotal ?? 0;
  const received = data?.totalReceived ?? 0;
  const remaining = data?.remaining ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative z-10 flex flex-col justify-between h-full">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grand Total</span>
            <span className="mt-1 text-xl flex items-baseline font-bold text-slate-800">
              {fmtCurrency(gt)}
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-emerald-50 p-4 shadow-sm">
          <div className="relative z-10 flex flex-col justify-between h-full">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Total Received</span>
            <span className="mt-1 text-xl flex items-baseline font-bold text-emerald-700">
              {fmtCurrency(received)}
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-amber-50 p-4 shadow-sm">
          <div className="relative z-10 flex flex-col justify-between h-full">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Amount Remaining</span>
            <span className="mt-1 text-xl flex items-baseline font-bold text-amber-700">
              {fmtCurrency(remaining)}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-sm animate-pulse">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Trips Table */}
      <div className="space-y-3">
        <h4 className="flex items-center text-sm font-semibold text-slate-700">
          <History className="mr-2 h-4 w-4 text-indigo-500" />
          Agency Trips (Trip-wise Payout)
        </h4>

        {trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
            <Building2 className="h-8 w-8 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">No trips found for this agency.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold text-slate-600">Trip Info</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-600">Route & Date</th>
                    <th className="px-2 py-2.5 font-semibold text-right text-slate-600">Ag. Cost</th>
                    <th className="px-2 py-2.5 font-semibold text-right text-slate-600">Cab Cost</th>
                    <th className="px-2 py-2.5 font-semibold text-right text-slate-600">Adv/Paid</th>
                    <th className="px-2 py-2.5 font-semibold text-right text-slate-600">Remaining</th>
                    <th className="px-2 py-2.5 font-semibold text-center text-slate-600">Status</th>
                    <th className="px-2 py-2.5 font-semibold text-right text-slate-600">Profit</th>
                    <th className="px-3 py-2.5 font-semibold text-center text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trips.map((t) => {
                    const tripId = t.tripId ?? t._id;
                    const history = paymentHistoryByTrip[tripId];
                    const isExpanded = expandedTripId === tripId;
                    const totalPaidSoFar = (t.advance || 0) + (t.paidAmount || 0);
                    
                    return (
                      <Fragment key={tripId}>
                        <tr className="group transition-colors hover:bg-slate-50">
                          {/* Trip Info */}
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-slate-800">{t.tripNumber || '—'}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{t.driverName || 'No Driver'}</div>
                          </td>
                          {/* Route & Date */}
                          <td className="px-3 py-2.5 min-w-[140px] whitespace-normal">
                            <div className="font-medium text-slate-700 flex items-center gap-1 leading-tight">
                              <span>{t.from || '—'}</span>
                              <ArrowLeft className="h-3 w-3 rotate-180 text-slate-400 shrink-0" />
                              <span>{t.to || '—'}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{t.startDate || '—'}</div>
                          </td>
                          
                          <td className="px-2 py-2.5 text-right font-medium text-slate-700">{fmtCurrency(t.agencyCost || 0)}</td>
                          <td className="px-2 py-2.5 text-right font-medium text-slate-700">{fmtCurrency(t.cabCost || 0)}</td>
                          <td className="px-2 py-2.5 text-right font-semibold text-emerald-600">{fmtCurrency(totalPaidSoFar)}</td>
                          <td className="px-2 py-2.5 text-right font-semibold text-amber-700">{fmtCurrency(t.remainingAmount || 0)}</td>
                          
                          {/* Status Pill */}
                          <td className="px-2 py-2.5 text-center">
                            <span
                              className={`inline-flex rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                                t.paymentStatus === 'paid'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : t.paymentStatus === 'partial'
                                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                                    : 'border-slate-200 bg-slate-50 text-slate-600'
                              }`}
                            >
                              {t.paymentStatus || 'unpaid'}
                            </span>
                          </td>
                          
                          <td className="px-2 py-2.5 text-right font-bold text-indigo-600">{fmtCurrency(t.ownerProfit || 0)}</td>
                          
                          {/* Actions */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Pay Input & Button */}
                              <div className="flex items-center rounded border border-slate-300 bg-white p-0.5 transition-all focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400">
                                <span className="pl-1.5 pr-0.5 text-slate-400 text-[10px] font-medium">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Amt"
                                  value={tripPayAmount[tripId] ?? ''}
                                  onChange={(e) =>
                                    setTripPayAmount((prev) => ({
                                      ...prev,
                                      [tripId]: e.target.value,
                                    }))
                                  }
                                  className="w-16 bg-transparent py-0.5 text-[11px] font-medium text-slate-800 outline-none placeholder:text-slate-300"
                                />
                                <button
                                  type="button"
                                  disabled={(t.remainingAmount || 0) <= 0 || savingTripId === tripId}
                                  onClick={() => handleTripPayout(t)}
                                  className="ml-0.5 rounded-sm bg-indigo-500 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors disabled:pointer-events-none"
                                >
                                  {savingTripId === tripId ? '...' : 'Pay'}
                                </button>
                              </div>
                              
                              {/* Expand History Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleTripHistory(t)}
                                className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors h-[22px] ${
                                  isExpanded 
                                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Nested History Row Area */}
                        {isExpanded && (
                          <tr className="bg-slate-50/50 shadow-inner">
                            <td colSpan={9} className="p-0 border-b border-slate-200">
                              <div className="m-3 mt-0 bg-white rounded-md shadow-sm border border-slate-200 p-3">
                                <h5 className="font-semibold text-slate-700 flex items-center mb-3 text-xs">
                                  <History className="h-3.5 w-3.5 mr-1.5 text-slate-400" /> Payment Timeline
                                </h5>
                                
                                {loadingHistoryTripId === tripId ? (
                                  <div className="flex items-center gap-2 text-xs text-indigo-600">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading timeline...
                                  </div>
                                ) : !history || history.payments.length === 0 ? (
                                  <div className="text-[11px] italic text-slate-400">No payment records exist for this trip.</div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    
                                    {/* Stats Mini Cards for the Trip */}
                                    <div className="md:col-span-1 space-y-1.5">
                                      <div className="rounded bg-slate-50 px-2.5 py-1.5 border border-slate-100 flex justify-between items-center text-[11px]">
                                        <span className="font-medium text-slate-500">Trip Total</span>
                                        <span className="font-bold text-slate-800">{fmtCurrency(history.summary.totalAmount || 0)}</span>
                                      </div>
                                      <div className="rounded bg-emerald-50 px-2.5 py-1.5 border border-emerald-100 flex justify-between items-center text-[11px]">
                                        <span className="font-medium text-emerald-600">Total Paid</span>
                                        <span className="font-bold text-emerald-700">{fmtCurrency(history.summary.totalPaid || 0)}</span>
                                      </div>
                                      <div className="rounded bg-amber-50 px-2.5 py-1.5 border border-amber-100 flex justify-between items-center text-[11px]">
                                        <span className="font-medium text-amber-600">Trip Balance</span>
                                        <span className="font-bold text-amber-700">{fmtCurrency(history.summary.remainingBalance || 0)}</span>
                                      </div>
                                    </div>

                                    {/* Timeline Feed */}
                                    <div className="md:col-span-2 space-y-1.5">
                                      {history.payments.map((p) => (
                                        <div
                                          key={p._id}
                                          className="flex items-center justify-between rounded border border-slate-100 bg-white px-2.5 py-1.5 transition-shadow hover:shadow-sm"
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                              <Wallet className="h-2.5 w-2.5" />
                                            </div>
                                            <div>
                                              <div className="text-[11px] font-semibold text-slate-700">Payment Received</div>
                                              <div className="text-[9px] text-slate-500">
                                                {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : '—'} 
                                                <span className="mx-1">•</span> 
                                                <span className="uppercase">{(p.paymentMethod || 'cash').replace('_', ' ')}</span>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="text-xs font-bold text-emerald-600">
                                            +{fmtCurrency(p.amount || 0)}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
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
        className={`flex w-full lg:w-72 shrink-0 flex-col border-r border-slate-200 bg-white transition-all ${
          selectedAgencyId ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 shrink-0">
          <h2 className="text-sm font-semibold text-slate-900">Agency Payouts</h2>
          <button
            type="button"
            onClick={loadAgencies}
            disabled={loading}
            className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>

        <div className="relative border-b border-slate-100 px-3 py-2 bg-slate-50/50 shrink-0">
          <Search className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={agencySearch}
            onChange={(e) => setAgencySearch(e.target.value)}
            placeholder="Search agencies..."
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 shadow-sm outline-none transition-all focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1.5">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
              ))
            ) : agencies.length === 0 ? (
              <div className="mt-10 flex flex-col items-center justify-center text-center px-4">
                <Building2 className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No agencies found</p>
              </div>
            ) : filteredAgencies.length === 0 ? (
              <div className="mt-10 text-center">
                 <p className="text-xs font-medium text-slate-500">No agencies match your search</p>
              </div>
            ) : (
              filteredAgencies.map((a) => {
                const id = (a._id ?? a.id) as string;
                const active = id === selectedAgencyId;
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedAgencyId(id)}
                    className={`block w-full rounded-lg border px-3 py-2.5 text-left transition-all ${
                      active
                        ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50 hover:shadow-sm'
                    }`}
                  >
                    <div className={`text-[13px] font-semibold ${active ? 'text-indigo-800' : 'text-slate-700'} truncate`}>
                      {a.name}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] font-medium">
                      <span className="text-slate-500">Balance:</span>
                      <span className={`rounded-sm px-1.5 py-0.5 ${
                          (a.remainingAmount || 0) > 0 
                          ? 'bg-rose-50 text-rose-600' 
                          : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {fmtCurrency(a.remainingAmount || 0)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: detail panel */}
      <div
        className={`flex-1 overflow-hidden transition-all ${
          selectedAgencyId ? 'flex flex-col' : 'hidden lg:flex flex-col'
        }`}
      >
        {selectedAgency ? (
          <div className="h-full overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 z-10 shrink-0">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight text-slate-800 truncate">
                  {selectedAgency.name}
                </h3>
                <p className="text-[11px] text-slate-500">Main trip payouts and history</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAgencyId('')}
                  className="lg:hidden flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/history')}
                  className="hidden lg:flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All History
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-50/30">
              <div className="max-w-6xl mx-auto">
                <AgencyPayoutManager agency={selectedAgency} onPayoutSaved={loadAgencies} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-slate-50 p-6">
            <div className="flex max-w-sm flex-col items-center text-center p-6 border border-slate-200 bg-white rounded-lg shadow-sm">
              <Building2 className="h-8 w-8 text-slate-300 mb-3" />
              <h3 className="text-sm font-semibold text-slate-800">Select an Agency</h3>
              <p className="mt-2 text-xs text-slate-500">
                Choose an agency from the sidebar to view their payout history and manage payments.
              </p>
              <button
                type="button"
                onClick={() => navigate('/history')}
                className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-md bg-white border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Go back to History
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

