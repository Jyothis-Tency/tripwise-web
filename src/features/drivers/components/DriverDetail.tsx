import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone,
  History,
  Pencil,
  Ban,
  ShieldCheck,
  Eye,
  EyeOff,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Banknote,
  MapPin,
  DollarSign,
  ArrowRightLeft,
} from "lucide-react";
import type {
  Driver,
  DriverSalaryData,
  SalaryTransaction,
  DriverTrip,
} from "../api";
import {
  blockDriver,
  unblockDriver,
  fetchDriverSalary,
  fetchDriverTrips,
  fetchDriverSalaryLedger,
  deleteSalaryTransaction,
} from "../api";
import { DriverHistoryModal } from "./DriverHistoryModal";
import {
  driverAvatarColor,
  driverDisplayName,
  driverInitials,
} from "./DriverCard";

function fmtCurrency(v: number | undefined | null): string {
  const n = v ?? 0;
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTripStatusLabel(status?: string): string {
  const s = String(status ?? "").trim();
  if (!s) return "—";
  return s.replaceAll("_", " ");
}

function tripStatusBadgeCls(status?: string): string {
  switch ((status ?? "").toLowerCase()) {
    case "scheduled":
      return "bg-indigo-50 text-indigo-700 dark:bg-[#242a57] dark:text-[#a5b4fc]";
    case "in_progress":
    case "in progress":
      return "bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300";
    case "completed":
      return "bg-emerald-50 text-emerald-800 dark:bg-[#0d3325] dark:text-[#34d399]";
    case "cancelled":
      return "bg-rose-50 text-rose-800 dark:bg-[#3a1a1e] dark:text-[#fda4af]";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400";
  }
}

function monthInputToIsoRange(
  month: string,
): { startDate: string; endDate: string } | undefined {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return undefined;
  const [y, mo] = month.split("-").map(Number);
  const start = new Date(y, mo - 1, 1);
  const end = new Date(y, mo, 0, 23, 59, 59, 999);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const base = month || currentMonthValue();
  const [y, m] = base.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  if (!month) return "All time";
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function copyText(text: string) {
  if (!text) return;
  void navigator.clipboard?.writeText(text).catch(() => undefined);
}

function KvRow({
  label,
  value,
  copyable,
}: {
  label: string;
  value?: string | null;
  copyable?: boolean;
}) {
  const empty = !value?.trim();
  return (
    <div className="grid grid-cols-[100px_1fr_auto] items-center gap-x-3 border-b border-dashed border-slate-200 px-[18px] py-2 last:border-0 sm:grid-cols-[120px_1fr_auto] dark:border-[#252c4d]">
      <span className="text-xs text-slate-500 dark:text-[#8d94b8]">{label}</span>
      <span
        className={`min-w-0 truncate text-sm ${
          empty
            ? "italic text-slate-400 dark:text-[#8d94b8]"
            : "font-medium text-slate-800 dark:text-[#eef0ff]"
        }`}
      >
        {empty ? "Not added" : value}
      </span>
      {copyable && !empty ? (
        <button
          type="button"
          onClick={() => copyText(value!)}
          className="rounded-lg px-2.5 py-1 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 dark:text-[#a5b4fc] dark:hover:bg-[#242a57]"
        >
          Copy
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function Section({
  title,
  action,
  children,
  padded = false,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-[#252c4d]">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-[var(--bg-main)] px-[18px] py-3 dark:border-[#252c4d]">
        <h3 className="text-[13px] font-bold text-slate-800 dark:text-[#eef0ff]">
          {title}
        </h3>
        {action}
      </div>
      <div className={padded ? "p-[18px]" : ""}>{children}</div>
    </div>
  );
}

interface DriverDetailProps {
  driver: Driver;
  avatarIndex?: number;
  initialTab?: "details" | "salary";
  onBack?: () => void;
  onEdit?: () => void;
  onBlockChange: () => void;
  onUpdated: () => void;
}

export function DriverDetail({
  driver,
  avatarIndex = 0,
  initialTab = "details",
  onEdit,
  onBlockChange,
}: DriverDetailProps) {
  const [tab, setTab] = useState<"details" | "salary">(initialTab);
  const [blockBusy, setBlockBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, driver._id]);

  const name = driverDisplayName(driver);
  const isBlocked = !!driver.isBlocked;
  const color = driverAvatarColor(avatarIndex);

  const toggleBlock = async () => {
    const action = isBlocked ? "unblock" : "block";
    if (
      !confirm(
        `${action === "block" ? "Block" : "Unblock"} driver ${name}?`,
      )
    )
      return;
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Hero */}
      <div className="flex shrink-0 flex-wrap items-center gap-4 rounded-t-2xl bg-[radial-gradient(circle_at_90%_0,rgba(245,165,36,0.35),transparent_45%),linear-gradient(120deg,#312e81,#5b21b6)] px-5 py-6 text-white sm:px-7">
        {driver.profileImg ? (
          <img
            src={driver.profileImg}
            alt=""
            className="h-[72px] w-[72px] rounded-full border-[3px] border-white/50 object-cover"
          />
        ) : (
          <div
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-white/50 text-2xl font-extrabold text-white"
            style={{ background: color }}
          >
            {driverInitials(driver)}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-extrabold tracking-tight">
            {name}
          </h2>
          <span className="mt-1 inline-flex rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">
            {isBlocked ? "● Blocked" : "● Active"}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {driver.phone ? (
            <a
              href={`tel:${driver.phone}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-xs font-bold backdrop-blur-sm transition hover:bg-white/30"
            >
              <Phone className="h-3.5 w-3.5" /> Call
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-xs font-bold backdrop-blur-sm transition hover:bg-white/30"
          >
            <History className="h-3.5 w-3.5" /> History
          </button>
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-xs font-bold backdrop-blur-sm transition hover:bg-white/30"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggleBlock}
            disabled={blockBusy}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition disabled:opacity-50 ${
              isBlocked
                ? "bg-white/15 hover:bg-white/30"
                : "bg-rose-500/85 hover:bg-rose-500"
            }`}
          >
            {isBlocked ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5" /> Unblock
              </>
            ) : (
              <>
                <Ban className="h-3.5 w-3.5" /> Block
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 gap-1 border-b border-slate-200 px-4 sm:px-5 dark:border-[#252c4d]">
        {(["details", "salary"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-3.5 text-sm font-bold capitalize transition ${
              tab === t
                ? "border-b-[3px] border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-[#a5b4fc]"
                : "border-b-[3px] border-transparent text-slate-500 hover:text-slate-800 dark:text-[#8d94b8] dark:hover:text-[#eef0ff]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
        {tab === "details" ? (
          <DetailsTab driver={driver} />
        ) : (
          <SalaryTab driver={driver} />
        )}
      </div>

      {historyOpen && (
        <DriverHistoryModal
          driver={driver}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}

function DetailsTab({ driver }: { driver: Driver }) {
  const [showPassword, setShowPassword] = useState(false);
  const profilePct = driver.phone ? (driver.email ? "80%" : "60%") : "20%";

  return (
    <div className="grid gap-[18px]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Trips this month", value: "—" },
          { label: "Earnings", value: "—" },
          { label: "Profile complete", value: profilePct },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-[14px] border border-slate-200 bg-[var(--bg-main)] p-3.5 dark:border-[#252c4d]"
          >
            <small className="text-xs text-slate-500 dark:text-[#8d94b8]">
              {s.label}
            </small>
            <b className="mt-0.5 block text-[22px] font-extrabold text-slate-900 dark:text-[#eef0ff]">
              {s.value}
            </b>
          </div>
        ))}
      </div>

      <Section title="Driver profile">
        <KvRow label="Name" value={driverDisplayName(driver)} />
        <KvRow label="Phone" value={driver.phone} copyable />
        <KvRow label="Email" value={driver.email} copyable />
        <KvRow label="Place" value={driver.place} />
      </Section>

      <Section title="Login credentials">
        <KvRow label="Phone" value={driver.phone} copyable />
        <div className="grid grid-cols-[100px_1fr_auto] items-center gap-x-3 px-[18px] py-2 sm:grid-cols-[120px_1fr_auto]">
          <span className="text-xs text-slate-500 dark:text-[#8d94b8]">
            Password
          </span>
          <span className="font-medium text-slate-800 dark:text-[#eef0ff]">
            {showPassword ? (driver.password ?? "—") : "••••••••"}
          </span>
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 dark:text-[#a5b4fc] dark:hover:bg-[#242a57]"
          >
            {showPassword ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </Section>

      {/* Documents section hidden for now
      <Section title="Documents" padded>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <DocDrop
            title="Profile photo"
            present={!!driver.profileImg}
            href={driver.profileImg}
          />
          <DocDrop
            title="Driving licence"
            present={!!driver.licenseImg}
            href={driver.licenseImg}
          />
        </div>
      </Section>
      */}
    </div>
  );
}

function formatTxDisplayDate(tx: SalaryTransaction): string {
  if (tx.date) {
    if (/^\d{2}-\d{2}-\d{4}$/.test(tx.date)) return tx.date;
    const d = new Date(tx.date);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-IN");
  }
  if (tx.createdAt) {
    const d = new Date(tx.createdAt);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-IN");
  }
  return "—";
}

function txRowKey(tx: SalaryTransaction): string {
  return tx._id || tx.id || `${tx.type}-${tx.amount}-${tx.date}`;
}

function SalaryTab({ driver }: { driver: Driver }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [salaryData, setSalaryData] = useState<DriverSalaryData | null>(null);
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [ledger, setLedger] = useState<SalaryTransaction[]>([]);
  const [error, setError] = useState("");
  const [monthFilter, setMonthFilter] = useState(currentMonthValue);

  const driverId = driver._id ?? (driver as { id?: string }).id;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData();
  }, [driverId, monthFilter]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const range = monthFilter ? monthInputToIsoRange(monthFilter) : undefined;
      const [salaryRes, tripsRes, ledgerRes] = await Promise.all([
        fetchDriverSalary(driverId!, monthFilter || undefined).catch(() => null),
        fetchDriverTrips(driverId!, {
          limit: 20,
          month: monthFilter || undefined,
        }).catch(() => ({ trips: [] })),
        fetchDriverSalaryLedger(driverId!, {
          page: 1,
          limit: 50,
          startDate: range?.startDate,
          endDate: range?.endDate,
        }).catch(() => ({ transactions: [], pagination: null })),
      ]);
      if (salaryRes) setSalaryData(salaryRes);
      setTrips((tripsRes as { trips?: DriverTrip[] })?.trips ?? []);
      setLedger(ledgerRes.transactions ?? []);
    } catch {
      setError("Failed to load salary data");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!confirm("Delete this transaction?")) return;
    try {
      await deleteSalaryTransaction(txId);
      loadData();
    } catch {
      alert("Failed to delete transaction");
    }
  };

  const goSalaryAdvance = () => {
    if (!driverId) return;
    const returnTo = `/drivers?driver=${encodeURIComponent(driverId)}&tab=salary`;
    navigate(
      `/transaction?entity=driver&id=${encodeURIComponent(driverId)}&returnTo=${encodeURIComponent(returnTo)}`,
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-8 text-center text-sm text-rose-500 dark:text-rose-400">
        {error}
      </p>
    );
  }

  const paid = salaryData?.salaryPaid ?? 0;
  const pending = salaryData?.pendingTripSalary ?? 0;
  const paidPct =
    pending || paid ? Math.round((paid / (paid + pending)) * 100) : 0;
  const tripCount = salaryData?.totalTrips ?? trips.length;
  const totalKm = salaryData?.totalKm ?? 0;
  const avgKm = tripCount ? Math.round((totalKm / tripCount) * 10) / 10 : 0;

  const tiles = [
    {
      label: "Trip bata",
      value: fmtCurrency(salaryData?.totalEarnings),
      bg: "bg-emerald-50 dark:bg-[#0d3325]",
      icon: <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
    },
    {
      label: "Advances paid",
      value: fmtCurrency(salaryData?.totalAdvance),
      bg: "bg-indigo-50 dark:bg-[#242a57]",
      icon: <Wallet className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />,
    },
    {
      label: "Salary paid",
      value: fmtCurrency(paid),
      bg: "bg-sky-50 dark:bg-sky-500/15",
      icon: <Banknote className="h-4 w-4 text-sky-600 dark:text-sky-300" />,
    },
    {
      label: "Total km",
      value: `${totalKm} km`,
      bg: "bg-orange-50 dark:bg-orange-500/15",
      icon: <MapPin className="h-4 w-4 text-orange-600 dark:text-orange-300" />,
    },
  ];

  return (
    <div className="grid gap-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-extrabold text-slate-900 dark:text-[#eef0ff]">
            Financial summary
          </h3>
          <p className="mt-0.5 max-w-md text-xs text-slate-500 dark:text-[#8d94b8]">
            Trip bata, advances, salary paid and pending payout for the month
            you pick.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-[var(--bg-main)] p-1 dark:border-[#252c4d]">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonthFilter((m) => shiftMonth(m, -1))}
              className="flex h-8 w-8 items-center justify-center rounded-[9px] text-slate-600 transition hover:bg-[var(--bg-card)] dark:text-[#8d94b8]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <b className="min-w-[130px] text-center text-sm font-bold text-slate-800 dark:text-[#eef0ff]">
              {monthLabel(monthFilter)}
            </b>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonthFilter((m) => shiftMonth(m, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-[9px] text-slate-600 transition hover:bg-[var(--bg-card)] dark:text-[#8d94b8]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={goSalaryAdvance}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_6px_16px_-6px_#4f46e5] transition hover:-translate-y-px active:scale-[0.98]"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Salary/Advance
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl bg-gradient-to-br from-teal-700 to-teal-500 px-5 py-[18px] text-white">
          <small className="text-xs opacity-85">Pending payout</small>
          <b className="my-1 block text-[30px] font-extrabold leading-none">
            {fmtCurrency(pending)}
          </b>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/28">
            <i
              className="block h-full rounded-full bg-white not-italic"
              style={{ width: `${paidPct}%` }}
            />
          </div>
          <small className="mt-2 block text-xs opacity-85">
            {fmtCurrency(paid)} paid so far this month
          </small>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="flex items-center gap-3 rounded-[14px] border border-slate-200 px-3.5 py-3 dark:border-[#252c4d]"
            >
              <div
                className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] ${t.bg}`}
              >
                {t.icon}
              </div>
              <div className="min-w-0">
                <small className="block text-xs text-slate-500 dark:text-[#8d94b8]">
                  {t.label}
                </small>
                <b className="block truncate text-[17px] font-extrabold text-slate-900 dark:text-[#eef0ff]">
                  {t.value}
                </b>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[14px] border border-slate-200 bg-[var(--bg-main)] p-3.5 dark:border-[#252c4d]">
          <small className="text-xs text-slate-500 dark:text-[#8d94b8]">
            Trips this month
          </small>
          <b className="mt-0.5 block text-[22px] font-extrabold dark:text-[#eef0ff]">
            {tripCount}
          </b>
        </div>
        <div className="rounded-[14px] border border-slate-200 bg-[var(--bg-main)] p-3.5 dark:border-[#252c4d]">
          <small className="text-xs text-slate-500 dark:text-[#8d94b8]">
            Avg km per trip
          </small>
          <b className="mt-0.5 block text-[22px] font-extrabold dark:text-[#eef0ff]">
            {avgKm} km
          </b>
        </div>
      </div>

      <Section title="Advance payments" padded>
        {(salaryData?.advancePayments ?? []).length === 0 ? (
          <EmptyMsg icon="👛" text="No advances this month." />
        ) : (
          <div className="space-y-1">
            {(salaryData?.advancePayments ?? []).map((tx) => (
              <div
                key={txRowKey(tx)}
                className="group flex items-center gap-2 py-1.5 text-sm"
              >
                <span className="w-[100px] shrink-0 text-slate-500 dark:text-[#8d94b8]">
                  {formatTxDisplayDate(tx)}
                </span>
                <span className="flex-1 font-semibold text-slate-800 dark:text-[#eef0ff]">
                  {fmtCurrency(tx.amount)}
                </span>
                <span className="max-w-[120px] truncate text-xs text-slate-400">
                  {tx.notes ?? tx.description ?? tx.type}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleDeleteTransaction(tx._id || tx.id || "")
                  }
                  className="text-rose-400 opacity-0 transition group-hover:opacity-100 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Salary & payment history" padded>
        {ledger.length === 0 ? (
          <EmptyMsg icon="🧾" text="No transactions for this period." />
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-[#8d94b8]">
                  <th className="px-2 py-2 font-semibold">Date</th>
                  <th className="px-2 py-2 font-semibold">Type</th>
                  <th className="px-2 py-2 font-semibold">Amount</th>
                  <th className="px-2 py-2 font-semibold">Note</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {ledger.map((tx) => (
                  <tr
                    key={txRowKey(tx)}
                    className="border-t border-slate-100 dark:border-[#252c4d]"
                  >
                    <td className="whitespace-nowrap px-2 py-3 text-slate-600 dark:text-[#8d94b8]">
                      {formatTxDisplayDate(tx)}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          tx.type === "salary"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-[#0d3325] dark:text-[#34d399]"
                            : "bg-indigo-50 text-indigo-700 dark:bg-[#242a57] dark:text-[#a5b4fc]"
                        }`}
                      >
                        {tx.type === "salary" ? "Salary paid" : "Advance"}
                      </span>
                    </td>
                    <td className="px-2 py-3 font-semibold dark:text-[#eef0ff]">
                      {fmtCurrency(tx.amount)}
                    </td>
                    <td className="max-w-[140px] truncate px-2 py-3 text-slate-500 dark:text-[#8d94b8]">
                      {tx.notes ?? "—"}
                    </td>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteTransaction(tx._id || tx.id || "")
                        }
                        className="text-rose-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Recent trips" padded>
        {trips.length === 0 ? (
          <EmptyMsg icon="🚐" text="No trips in this month." />
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-[#8d94b8]">
                  <th className="px-2 py-2 font-semibold">Date</th>
                  <th className="px-2 py-2 font-semibold">Route</th>
                  <th className="px-2 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {trips.slice(0, 10).map((trip) => (
                  <tr
                    key={trip._id}
                    className="border-t border-slate-100 dark:border-[#252c4d]"
                  >
                    <td className="whitespace-nowrap px-2 py-3 text-slate-600 dark:text-[#8d94b8]">
                      {trip.startDate
                        ? new Date(trip.startDate).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td className="px-2 py-3 dark:text-[#eef0ff]">
                      {trip.from ?? "—"}
                      <span className="mx-1.5 text-indigo-500">→</span>
                      {trip.to ?? "—"}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${tripStatusBadgeCls(trip.status)}`}
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
      </Section>
    </div>
  );
}

function EmptyMsg({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="px-2 py-6 text-center text-slate-500 dark:text-[#8d94b8]">
      <span className="mb-1 block text-[22px]">{icon}</span>
      {text}
    </div>
  );
}
