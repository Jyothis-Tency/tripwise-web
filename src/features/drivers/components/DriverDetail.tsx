import { useState, useEffect } from 'react';
import {
  User, Mail, MapPin, Eye, EyeOff, Trash2, Plus,
  Briefcase, DollarSign, TrendingUp, Calendar,
} from 'lucide-react';
import type { Driver, DriverSalaryData, SalaryTransaction, DriverTrip } from '../api';
import { deleteDriver, fetchDriverSalary, fetchDriverTrips, createSalaryTransaction, deleteSalaryTransaction } from '../api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function driverName(d: Driver): string {
  if (d.firstName && d.lastName) return `${d.firstName} ${d.lastName}`.trim();
  return (d as any).name ?? '—';
}

function statusBadge(d: Driver): { label: string; color: string; bg: string } {
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
  onDeleted: () => void;
  onUpdated: () => void;
}

export function DriverDetail({ driver, onDeleted }: DriverDetailProps) {
  const [tab, setTab] = useState<'details' | 'salary'>('details');
  const [deleting, setDeleting] = useState(false);

  const badge = statusBadge(driver);

  const handleDelete = async () => {
    if (!confirm(`Delete driver ${driverName(driver)}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteDriver(driver._id);
      onDeleted();
    } catch {
      alert('Failed to delete driver.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        {driver.profileImg ? (
          <img src={driver.profileImg} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <div className="h-11 w-11 rounded-full bg-indigo-100 flex items-center justify-center">
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
          onClick={handleDelete}
          disabled={deleting}
          className="text-red-400 hover:text-red-600 transition disabled:opacity-40 p-1"
          title="Delete driver"
        >
          <Trash2 className="h-4 w-4" />
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

function SalaryTab({ driver }: { driver: Driver }) {
  const [loading, setLoading] = useState(true);
  const [salaryData, setSalaryData] = useState<DriverSalaryData | null>(null);
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [error, setError] = useState('');
  const [showAddAdvance, setShowAddAdvance] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDesc, setAdvanceDesc] = useState('');
  const [addingSalary, setAddingSalary] = useState(false);

  const driverId = driver._id ?? (driver as any).id;

  useEffect(() => {
    loadData();
  }, [driverId]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [salaryRes, tripsRes] = await Promise.all([
        fetchDriverSalary(driverId).catch(() => null),
        fetchDriverTrips(driverId, { limit: 20 }).catch(() => ({ trips: [] })),
      ]);
      if (salaryRes) setSalaryData(salaryRes);
      setTrips((tripsRes as any)?.trips ?? []);
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
        description: advanceDesc.trim() || 'Advance payment',
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
        <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-500 text-sm py-8">{error}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={<DollarSign className="h-4 w-4 text-emerald-500" />} label="Total Earnings" value={fmtCurrency(salaryData?.totalEarnings)} />
        <StatCard icon={<TrendingUp className="h-4 w-4 text-blue-500" />} label="Total Trips" value={String(salaryData?.totalTrips ?? 0)} />
        <StatCard icon={<MapPin className="h-4 w-4 text-indigo-500" />} label="Total KM" value={`${salaryData?.totalKm ?? 0} km`} />
        <StatCard icon={<DollarSign className="h-4 w-4 text-amber-500" />} label="Net Salary" value={fmtCurrency(salaryData?.netSalary)} />
      </div>

      {/* Advance Payments */}
      <Card
        title="Advance Payments"
        icon={<DollarSign className="h-3.5 w-3.5" />}
        action={
          <button onClick={() => setShowAddAdvance(s => !s)} className="text-indigo-500 hover:text-indigo-700">
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
            <button onClick={handleAddAdvance} disabled={addingSalary}
              className="px-2 py-1 bg-indigo-600 text-white rounded text-xs font-semibold disabled:opacity-50">
              {addingSalary ? '…' : 'Add'}
            </button>
          </div>
        )}
        {(salaryData?.advancePayments ?? []).length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">No advance payments</p>
        ) : (
          (salaryData?.advancePayments ?? []).map((tx: SalaryTransaction) => (
            <div key={tx._id} className="flex items-center py-[3px] group">
              <span className="w-[110px] shrink-0 text-[11px] text-slate-500">
                {tx.date ? new Date(tx.date).toLocaleDateString() : (tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : '—')}
              </span>
              <span className="text-[11px] font-medium text-slate-800 flex-1">{fmtCurrency(tx.amount)}</span>
              <span className="text-[10px] text-slate-400 mr-2">{tx.description ?? tx.type}</span>
              <button onClick={() => handleDeleteTransaction(tx._id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600">
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          ))
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
