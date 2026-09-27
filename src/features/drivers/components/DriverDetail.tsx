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

function statusBadge(d: Driver): { label: string; color: string; bg: string; dot: string } {
  if (d.isBlocked) {
    return {
      label: 'Blocked',
      color: 'text-rose-700 dark:text-rose-400',
      bg: 'bg-rose-50 border-rose-200 dark:bg-rose-500/15 dark:border-rose-500/30',
      dot: 'bg-rose-500',
    };
  }
  const statusVal = d.status || (d.isActive !== false ? 'Active' : 'Inactive');
  const s = String(statusVal).toLowerCase();
  if (s === 'active') {
    return {
      label: 'Active',
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/15 dark:border-emerald-500/30',
      dot: 'bg-emerald-500',
    };
  }
  if (s === 'on leave') {
    return {
      label: 'On Leave',
      color: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 border-amber-200 dark:bg-amber-500/15 dark:border-amber-500/30',
      dot: 'bg-amber-500',
    };
  }
  return {
    label: 'Inactive',
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 border-slate-200 dark:bg-white/5 dark:border-white/10',
    dot: 'bg-slate-400',
  };
}

function fmtCurrency(v: number | undefined | null): string {
  const n = v ?? 0;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTripStatusLabel(status?: string): string {
  const s = String(status ?? '').trim();
  if (!s) return '—';
  return s.replaceAll('_', ' ');
}

function tripStatusBadgeCls(status?: string): string {
  switch ((status ?? '').toLowerCase()) {
    case 'scheduled':
      return 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30';
    case 'in_progress':
    case 'in progress':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30';
    case 'completed':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30';
    case 'cancelled':
      return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10';
  }
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
      <span className="w-[110px] shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200">{value || '—'}</span>
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
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#1e2638] dark:bg-[#0e121d]/80">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 active:scale-95 md:hidden dark:text-slate-400 dark:hover:bg-white/5"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="relative shrink-0">
          {driver.profileImg ? (
            <img src={driver.profileImg} alt="" className="h-11 w-11 rounded-full object-cover" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-indigo-50 dark:border-white/10 dark:bg-indigo-500/15">
              <User className="h-6 w-6 text-indigo-500 dark:text-indigo-300" />
            </div>
          )}
          <span
            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-[#0e121d] ${badge.dot}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white">
            {driverName(driver)}
          </h2>
          <span
            className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.bg} ${badge.color}`}
          >
            {badge.label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
          title="Driver trip history"
        >
          <History className="h-3.5 w-3.5" />
          History
        </button>
        <button
          type="button"
          onClick={toggleBlock}
          disabled={blockBusy}
          className={`rounded-lg p-1.5 transition disabled:opacity-40 ${
            isBlocked
              ? 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-500/15'
              : 'text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:text-rose-400 dark:hover:bg-rose-500/15'
          }`}
          title={isBlocked ? 'Unblock driver' : 'Block driver'}
        >
          {isBlocked ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 dark:border-white/10">
        {(['details', 'salary'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-semibold capitalize transition ${
              tab === t
                ? 'border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300'
                : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
            }`}
          >
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
      <Card title="Driver Profile" icon={<User className="h-3.5 w-3.5" />}>
        <InfoRow label="Name" value={driverName(driver)} />
        <InfoRow label="Phone" value={driver.phone ?? ''} />
        <InfoRow label="Email" value={driver.email ?? ''} />
        <InfoRow label="Place" value={driver.place ?? ''} />
      </Card>

      <Card title="Login Credentials" icon={<Mail className="h-3.5 w-3.5" />}>
        <InfoRow label="Phone" value={driver.phone ?? ''} />
        <div className="flex items-baseline py-[3px]">
          <span className="w-[110px] shrink-0 text-[11px] text-slate-500 dark:text-slate-400">Password</span>
          <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200">
            {showPassword ? (driver.password ?? '—') : '••••••••'}
          </span>
          <button
            type="button"
            onClick={() => setShowPassword(p => !p)}
            className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        </div>
      </Card>

      <Card title="Media" icon={<MapPin className="h-3.5 w-3.5" />}>
        <InfoRow label="Profile Image" value={driver.profileImg ? 'Uploaded' : 'N/A'} />
        <InfoRow label="License Image" value={driver.licenseImg ? 'Uploaded' : 'N/A'} />
      </Card>

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

  const driverId = driver._id ?? (driver as any).id;

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className="py-8 text-center text-sm text-red-500 dark:text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Financial Summary</h4>
        <input
          type="month"
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:focus:border-indigo-400"
        />
      </div>
      <p className="-mt-2 text-[10px] text-slate-500 dark:text-slate-400">
        Month filter applies to trip Bata totals, advances, salary paid, pending, and the ledger below.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <StatCard
          iconWrap="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          icon={<DollarSign className="h-4 w-4" />}
          label="Trip Bata"
          value={fmtCurrency(salaryData?.totalEarnings)}
        />
        <StatCard
          iconWrap="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
          icon={<Wallet className="h-4 w-4" />}
          label="Advances paid"
          value={fmtCurrency(salaryData?.totalAdvance)}
        />
        <StatCard
          iconWrap="bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400"
          icon={<Banknote className="h-4 w-4" />}
          label="Salary paid"
          value={fmtCurrency(salaryData?.salaryPaid)}
        />
        <StatCard
          iconWrap="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
          icon={<DollarSign className="h-4 w-4" />}
          label="Pending payout"
          value={fmtCurrency(salaryData?.pendingTripSalary)}
        />
        <StatCard
          iconWrap="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
          icon={<TrendingUp className="h-4 w-4" />}
          label="Trips"
          value={String(salaryData?.totalTrips ?? 0)}
        />
        <StatCard
          iconWrap="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
          icon={<MapPin className="h-4 w-4" />}
          label="Total KM"
          value={`${salaryData?.totalKm ?? 0} km`}
        />
      </div>

      <Card
        title="Advance Payments"
        icon={<DollarSign className="h-3.5 w-3.5" />}
        action={
          <button
            type="button"
            onClick={() => setShowAddAdvance(s => !s)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/15"
          >
            <Plus className="h-3.5 w-3.5" />
            Record Advance
          </button>
        }
      >
        {showAddAdvance && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-white/5">
            <input
              type="number"
              value={advanceAmount}
              onChange={e => setAdvanceAmount(e.target.value)}
              placeholder="Amount"
              className="w-20 rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            />
            <input
              type="text"
              value={advanceDesc}
              onChange={e => setAdvanceDesc(e.target.value)}
              placeholder="Description"
              className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            />
            <button
              type="button"
              onClick={handleAddAdvance}
              disabled={addingSalary}
              className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50 dark:bg-indigo-500"
            >
              {addingSalary ? '…' : 'Add'}
            </button>
          </div>
        )}
        {(salaryData?.advancePayments ?? []).length === 0 ? (
          <p className="py-2 text-[11px] text-slate-400 dark:text-slate-500">No advance payments</p>
        ) : (
          (salaryData?.advancePayments ?? []).map((tx: SalaryTransaction) => (
            <div key={txRowKey(tx)} className="group flex items-center py-[3px]">
              <span className="w-[110px] shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                {formatTxDisplayDate(tx)}
              </span>
              <span className="flex-1 text-[11px] font-medium text-slate-800 dark:text-slate-200">
                {fmtCurrency(tx.amount)}
              </span>
              <span className="mr-2 max-w-[100px] truncate text-[10px] text-slate-400">
                {tx.notes ?? tx.description ?? tx.type}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteTransaction(tx._id || tx.id || '')}
                className="text-red-400 opacity-0 hover:text-red-600 group-hover:opacity-100 dark:text-red-400 dark:hover:text-red-300"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          ))
        )}
      </Card>

      <Card title="Salary & Payment History" icon={<History className="h-3.5 w-3.5" />}>
        {ledger.length === 0 ? (
          <p className="py-2 text-[11px] text-slate-400 dark:text-slate-500">No transactions for this period</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-400 dark:border-white/10 dark:text-slate-500">
                  <th className="py-1.5 pr-2 font-medium">Date</th>
                  <th className="py-1.5 pr-2 font-medium">Type</th>
                  <th className="py-1.5 pr-2 font-medium">Amount</th>
                  <th className="py-1.5 pr-2 font-medium">Note</th>
                  <th className="w-8 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {ledger.map(tx => (
                  <tr key={txRowKey(tx)} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="whitespace-nowrap py-1.5 pr-2 text-slate-600 dark:text-slate-400">
                      {formatTxDisplayDate(tx)}
                    </td>
                    <td className="py-1.5 pr-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          tx.type === 'salary'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300'
                        }`}
                      >
                        {tx.type === 'salary' ? 'Salary paid' : 'Advance'}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 font-medium text-slate-800 dark:text-slate-200">
                      {fmtCurrency(tx.amount)}
                    </td>
                    <td className="max-w-[140px] truncate py-1.5 pr-2 text-slate-500 dark:text-slate-400">
                      {tx.notes ?? '—'}
                    </td>
                    <td className="py-1.5">
                      <button
                        type="button"
                        onClick={() => handleDeleteTransaction(tx._id || tx.id || '')}
                        className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
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

      <Card title="Recent Trip History" icon={<Calendar className="h-3.5 w-3.5" />}>
        {trips.length === 0 ? (
          <p className="py-2 text-[11px] text-slate-400 dark:text-slate-500">No trips found</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-400 dark:border-white/10 dark:text-slate-500">
                  <th className="py-1.5 pr-2 font-medium">Date</th>
                  <th className="py-1.5 pr-2 font-medium">Route</th>
                  <th className="py-1.5 pr-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {trips.slice(0, 10).map(trip => (
                  <tr key={trip._id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="whitespace-nowrap py-1.5 pr-2 text-slate-600 dark:text-slate-400">
                      {trip.startDate
                        ? new Date(trip.startDate).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="max-w-[160px] truncate py-1.5 pr-2 text-slate-700 dark:text-slate-300">
                      {trip.from ?? '—'} → {trip.to ?? '—'}
                    </td>
                    <td className="py-1.5 pr-2">
                      <span
                        className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold capitalize ${tripStatusBadgeCls(trip.status)}`}
                      >
                        {formatTripStatusLabel(trip.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#1e2638] dark:bg-[#0e121d]/60">
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
        <span className="text-slate-400 dark:text-slate-500">{icon}</span>
        <h4 className="flex-1 text-xs font-bold text-slate-600 dark:text-slate-300">{title}</h4>
        {action}
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

function StatCard({
  icon,
  iconWrap,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconWrap: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-[#0e121d]/60">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconWrap}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
        <p className="truncate text-sm font-bold text-slate-800 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
