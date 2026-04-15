import { useState, useEffect } from 'react';
import {
  User, Mail, MapPin, Eye, EyeOff, Ban, ShieldCheck, Plus, ArrowLeft,
  Briefcase, DollarSign, TrendingUp, Calendar, Trash2, History, Wallet, Banknote,
} from 'lucide-react';
import type { Driver, DriverSalaryData, SalaryTransaction, DriverTrip } from '../api';
import {
  blockDriver, unblockDriver, fetchDriverSalary, fetchDriverTrips, fetchDriverSalaryLedger,
  createSalaryTransaction, deleteSalaryTransaction,
} from '../api';
import { DriverHistoryModal } from './DriverHistoryModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function driverName(d: Driver): string {
  if (d.firstName && d.lastName) return `${d.firstName} ${d.lastName}`.trim();
  return (d as any).name ?? '—';
}

function statusBadge(d: Driver): { label: string; color: string; bg: string } {
  if (d.isBlocked) {
    return { label: 'Blocked', color: 'text-rose-800', bg: 'bg-rose-50 border-rose-200' };
  }
  const statusVal = d.status || (d.isActive !== false ? 'Active' : 'Inactive');
  const s = String(statusVal).toLowerCase();
  if (s === 'active') return { label: 'Active', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (s === 'on leave') return { label: 'On Leave', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  return { label: 'Inactive', color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200' };
}

function fmtCurrency(v: number | undefined | null): string {
  const n = v ?? 0;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Month input value `YYYY-MM` → ISO range for ledger API */
function monthInputToIsoRange(month: string): { startDate: string; endDate: string } | undefined {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return undefined;
  const [y, mo] = month.split('-').map(Number);
  const start = new Date(y, mo - 1, 1);
  const end = new Date(y, mo, 0, 23, 59, 59, 999);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline py-[3px]">
      <span className="w-[110px] shrink-0 text-[11px] text-slate-500">{label}</span>
      <span className="text-[11px] font-medium text-slate-800">{value || '—'}</span>
    </div>
  );
}

// ─── Detail Component ────────────────────────────────────────────────────────

interface DriverDetailProps {
  driver: Driver;
  onBack?: () => void;
  onBlockChange: () => void;
  onUpdated: () => void;
}

export function DriverDetail({ driver, onBack, onBlockChange }: DriverDetailProps) {
  const [tab, setTab] = useState<'details' | 'salary'>('details');
  const [blockBusy, setBlockBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const badge = statusBadge(driver);
  const isBlocked = !!driver.isBlocked;

  const toggleBlock = async () => {
    const action = isBlocked ? 'unblock' : 'block';
    if (!confirm(`${action === 'block' ? 'Block' : 'Unblock'} driver ${driverName(driver)}?`)) return;
    setBlockBusy(true);
    try {
      if (isBlocked) await unblockDriver(driver._id);
      else await blockDriver(driver._id);
      onBlockChange();
    } catch {
      alert(`Failed to ${action} driver.`);
    } finally {
      setBlockBusy(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
        {onBack && (
          <button type="button" onClick={onBack}
            className="lg:hidden flex h-10 w-10 items-center justify-center -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        {driver.profileImg ? (
          <img src={driver.profileImg} alt="" className="h-11 w-11 rounded-full object-cover shrink-0" />
        ) : (
          <div className="h-11 w-11 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <User className="h-6 w-6 text-indigo-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-800 truncate">{driverName(driver)}</h2>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.bg} ${badge.color}`}>
            {badge.label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition shrink-0"
          title="Driver trip history"
        >
          <History className="h-3.5 w-3.5" />
          History
        </button>
        <button
          type="button"
          onClick={toggleBlock}
          disabled={blockBusy}
          className={`transition disabled:opacity-40 p-1 rounded-md ${
            isBlocked
              ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
              : 'text-rose-500 hover:text-rose-600 hover:bg-rose-50'
          }`}
          title={isBlocked ? 'Unblock driver' : 'Block driver'}
        >
          {isBlocked ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        {(['details', 'salary'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-semibold capitalize transition
              ${tab === t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'details' ? (
          <DetailsTab driver={driver} />
        ) : (
          <SalaryTab driver={driver} />
        )}
      </div>

      {historyOpen && (
        <DriverHistoryModal driver={driver} onClose={() => setHistoryOpen(false)} />
      )}
    </div>
  );
}

// ─── Details Tab ─────────────────────────────────────────────────────────────

function DetailsTab({ driver }: { driver: Driver }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-4">
      {/* Profile Card */}
      <Card title="Driver Profile" icon={<User className="h-3.5 w-3.5" />}>
        <InfoRow label="Name" value={driverName(driver)} />
        <InfoRow label="Phone" value={driver.phone ?? ''} />
        <InfoRow label="Email" value={driver.email ?? ''} />
        <InfoRow label="Place" value={driver.place ?? ''} />
      </Card>

      {/* Credentials Card */}
      <Card title="Login Credentials" icon={<Mail className="h-3.5 w-3.5" />}>
        <InfoRow label="Phone" value={driver.phone ?? ''} />
        <div className="flex items-baseline py-[3px]">
          <span className="w-[110px] shrink-0 text-[11px] text-slate-500">Password</span>
          <span className="text-[11px] font-medium text-slate-800">
            {showPassword ? (driver.password ?? '—') : '••••••••'}
          </span>
          <button onClick={() => setShowPassword(p => !p)} className="ml-1 text-slate-400 hover:text-slate-600">
            {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        </div>
      </Card>

      {/* Media Card */}
      <Card title="Media" icon={<MapPin className="h-3.5 w-3.5" />}>
        <InfoRow label="Profile Image" value={driver.profileImg ? 'Uploaded' : 'N/A'} />
        <InfoRow label="License Image" value={driver.licenseImg ? 'Uploaded' : 'N/A'} />
      </Card>

      {/* Documents */}
      {driver.documents && driver.documents.length > 0 && (
        <Card title="Documents" icon={<Briefcase className="h-3.5 w-3.5" />}>
          {driver.documents.map((doc, i) => (
            <InfoRow key={i} label={`Doc ${i + 1}`} value={doc} />
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── Salary Tab ──────────────────────────────────────────────────────────────

function formatTxDisplayDate(tx: SalaryTransaction): string {
  if (tx.date) {
    if (/^\d{2}-\d{2}-\d{4}$/.test(tx.date)) return tx.date;
    const d = new Date(tx.date);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('en-IN');
  }
  if (tx.createdAt) {
    const d = new Date(tx.createdAt);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('en-IN');
  }
  return '—';
}

function txRowKey(tx: SalaryTransaction): string {
  return tx._id || tx.id || `${tx.type}-${tx.amount}-${tx.date}`;
}

function SalaryTab({ driver }: { driver: Driver }) {
  const [loading, setLoading] = useState(true);
  const [salaryData, setSalaryData] = useState<DriverSalaryData | null>(null);
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [ledger, setLedger] = useState<SalaryTransaction[]>([]);
  const [error, setError] = useState('');
  const [showAddAdvance, setShowAddAdvance] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDesc, setAdvanceDesc] = useState('');
  const [addingSalary, setAddingSalary] = useState(false);
  const [monthFilter, setMonthFilter] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  const driverId = driver._id ?? (driver as any).id;

  useEffect(() => {
    loadData();
  }, [driverId, monthFilter]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const range = monthFilter ? monthInputToIsoRange(monthFilter) : undefined;
      const [salaryRes, tripsRes, ledgerRes] = await Promise.all([
        fetchDriverSalary(driverId, monthFilter || undefined).catch(() => null),
        fetchDriverTrips(driverId, { limit: 20, month: monthFilter || undefined }).catch(() => ({ trips: [] })),
        fetchDriverSalaryLedger(driverId, {
          page: 1,
          limit: 50,
          startDate: range?.startDate,
          endDate: range?.endDate,
        }).catch(() => ({ transactions: [], pagination: null })),
      ]);
      if (salaryRes) setSalaryData(salaryRes);
      setTrips((tripsRes as any)?.trips ?? []);
      setLedger(ledgerRes.transactions ?? []);
    } catch {
      setError('Failed to load salary data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdvance = async () => {
    const amt = parseFloat(advanceAmount);
    if (!amt || amt <= 0) return;
    setAddingSalary(true);
    try {
      await createSalaryTransaction(driverId, {
        amount: amt,
        type: 'advance',
        notes: advanceDesc.trim() || 'Advance payment',
      });
      setShowAddAdvance(false);
      setAdvanceAmount('');
      setAdvanceDesc('');
      loadData();
    } catch {
      alert('Failed to add advance payment');
    } finally {
      setAddingSalary(false);
    }
  };

  const handleRecordSalaryPayment = async () => {
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) return;
    setRecordingPayment(true);
    try {
      await createSalaryTransaction(driverId, {
        amount: amt,
        type: 'salary',
        notes: paymentNote.trim() || 'Salary payment',
      });
      setPaymentAmount('');
      setPaymentNote('');
      loadData();
    } catch {
      alert('Failed to record salary payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  const handlePayFullPending = () => {
    const pending = salaryData?.pendingTripSalary ?? 0;
    if (pending <= 0) return;
    setPaymentAmount(String(pending));
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!confirm('Delete this transaction?')) return;
    try {
      await deleteSalaryTransaction(txId);
      loadData();
    } catch {
      alert('Failed to delete transaction');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-500 text-sm py-8">{error}</p>;
  }

  const pending = salaryData?.pendingTripSalary ?? 0;

  return (
    <div className="space-y-4">
      {/* Header and Filter */}
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-800">Financial Summary</h4>
        <input
          type="month"
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <p className="text-[10px] text-slate-500 -mt-2">
        Month filter applies to trip Bata totals, advances, salary paid, pending, and the ledger below.
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={<DollarSign className="h-4 w-4 text-emerald-500" />} label="Trip Bata (earned)" value={fmtCurrency(salaryData?.totalEarnings)} />
        <StatCard icon={<Wallet className="h-4 w-4 text-violet-500" />} label="Advances paid" value={fmtCurrency(salaryData?.totalAdvance)} />
        <StatCard icon={<Banknote className="h-4 w-4 text-sky-600" />} label="Salary paid" value={fmtCurrency(salaryData?.salaryPaid)} />
        <StatCard icon={<DollarSign className="h-4 w-4 text-amber-600" />} label="Pending payout" value={fmtCurrency(salaryData?.pendingTripSalary)} />
        <StatCard icon={<TrendingUp className="h-4 w-4 text-blue-500" />} label="Trips" value={String(salaryData?.totalTrips ?? 0)} />
        <StatCard icon={<MapPin className="h-4 w-4 text-indigo-500" />} label="Total KM" value={`${salaryData?.totalKm ?? 0} km`} />
      </div>

      {/* Record salary payment */}
      <Card title="Manage salary — mark as paid" icon={<Banknote className="h-3.5 w-3.5" />}>
        <p className="text-[10px] text-slate-500 mb-2">
          Record a payout toward trip Bata for this period. Pending = trip Bata − advances − salary payments already logged.
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <input
            type="number"
            value={paymentAmount}
            onChange={e => setPaymentAmount(e.target.value)}
            placeholder="Amount paying now"
            className="w-28 border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-indigo-300"
          />
          <input
            type="text"
            value={paymentNote}
            onChange={e => setPaymentNote(e.target.value)}
            placeholder="Note (e.g. UPI ref, cash)"
            className="flex-1 min-w-[120px] border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-indigo-300"
          />
          <button
            type="button"
            onClick={handlePayFullPending}
            disabled={pending <= 0}
            className="px-2 py-1.5 rounded border border-slate-200 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Use full pending
          </button>
          <button
            type="button"
            onClick={handleRecordSalaryPayment}
            disabled={recordingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded text-[11px] font-semibold disabled:opacity-50"
          >
            {recordingPayment ? 'Saving…' : 'Record payment'}
          </button>
        </div>
      </Card>

      {/* Advance Payments */}
      <Card
        title="Advance Payments"
        icon={<DollarSign className="h-3.5 w-3.5" />}
        action={
          <button type="button" onClick={() => setShowAddAdvance(s => !s)} className="text-indigo-500 hover:text-indigo-700">
            <Plus className="h-3.5 w-3.5" />
          </button>
        }
      >
        {showAddAdvance && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 rounded-lg">
            <input
              type="number"
              value={advanceAmount}
              onChange={e => setAdvanceAmount(e.target.value)}
              placeholder="Amount"
              className="w-20 border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-indigo-300"
            />
            <input
              type="text"
              value={advanceDesc}
              onChange={e => setAdvanceDesc(e.target.value)}
              placeholder="Description"
              className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-indigo-300"
            />
            <button type="button" onClick={handleAddAdvance} disabled={addingSalary}
              className="px-2 py-1 bg-indigo-600 text-white rounded text-xs font-semibold disabled:opacity-50">
              {addingSalary ? '…' : 'Add'}
            </button>
          </div>
        )}
        {(salaryData?.advancePayments ?? []).length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">No advance payments</p>
        ) : (
          (salaryData?.advancePayments ?? []).map((tx: SalaryTransaction) => (
            <div key={txRowKey(tx)} className="flex items-center py-[3px] group">
              <span className="w-[110px] shrink-0 text-[11px] text-slate-500">
                {formatTxDisplayDate(tx)}
              </span>
              <span className="text-[11px] font-medium text-slate-800 flex-1">{fmtCurrency(tx.amount)}</span>
              <span className="text-[10px] text-slate-400 mr-2 truncate max-w-[100px]">{tx.notes ?? tx.description ?? tx.type}</span>
              <button type="button" onClick={() => handleDeleteTransaction(tx._id || tx.id || '')} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600">
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          ))
        )}
      </Card>

      {/* Salary & advance history (ledger) */}
      <Card title="Salary & payment history" icon={<History className="h-3.5 w-3.5" />}>
        {ledger.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">No transactions for this period</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-1.5 pr-2 font-medium">Date</th>
                  <th className="py-1.5 pr-2 font-medium">Type</th>
                  <th className="py-1.5 pr-2 font-medium">Amount</th>
                  <th className="py-1.5 pr-2 font-medium">Note</th>
                  <th className="py-1.5 w-8" />
                </tr>
              </thead>
              <tbody>
                {ledger.map(tx => (
                  <tr key={txRowKey(tx)} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 pr-2 text-slate-600 whitespace-nowrap">{formatTxDisplayDate(tx)}</td>
                    <td className="py-1.5 pr-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        tx.type === 'salary' ? 'bg-emerald-100 text-emerald-800' : 'bg-violet-100 text-violet-800'
                      }`}>
                        {tx.type === 'salary' ? 'Salary paid' : 'Advance'}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 font-medium text-slate-800">{fmtCurrency(tx.amount)}</td>
                    <td className="py-1.5 pr-2 text-slate-500 truncate max-w-[140px]">{tx.notes ?? '—'}</td>
                    <td className="py-1.5">
                      <button
                        type="button"
                        onClick={() => handleDeleteTransaction(tx._id || tx.id || '')}
                        className="text-red-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent Trip History */}
      <Card title="Recent Trip History" icon={<Calendar className="h-3.5 w-3.5" />}>
        {trips.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">No trips found</p>
        ) : (
          trips.slice(0, 10).map(trip => (
            <div key={trip._id} className="flex items-baseline py-[3px]">
              <span className="w-[80px] shrink-0 text-[10px] text-slate-400">
                {trip.startDate ? new Date(trip.startDate).toLocaleDateString() : '—'}
              </span>
              <span className="text-[11px] text-slate-700 flex-1 truncate">
                {trip.from ?? '—'} → {trip.to ?? '—'}
              </span>
              <span className="text-[11px] font-medium text-indigo-600 ml-2">
                {trip.driver_salary ? fmtCurrency(trip.driver_salary) : '—'}
              </span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

// ─── Shared Sub-Components ───────────────────────────────────────────────────

function Card({ title, icon, children, action }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50/70 border-b border-slate-100">
        <span className="text-slate-400">{icon}</span>
        <h4 className="text-xs font-bold text-slate-600 flex-1">{title}</h4>
        {action}
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-slate-800 truncate">{value}</p>
      </div>
    </div>
  );
}
