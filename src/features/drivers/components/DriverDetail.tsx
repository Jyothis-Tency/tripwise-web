import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone,
  Pencil,
  Ban,
  ShieldCheck,
  Eye,
  EyeOff,
  Trash2,
  Wallet,
  MapPin,
  DollarSign,
  ArrowRightLeft,
  Search,
  Calendar,
  User,
  Mail,
  Copy,
  Lock,
} from "lucide-react";
import type {
  Driver,
  DriverSalaryData,
} from "../api";
import {
  blockDriver,
  unblockDriver,
  fetchDriverSalary,
  deleteSalaryTransaction,
} from "../api";
import {
  fetchCashInCashOutDriverDetail,
  type DriverCashInCashOutDetail,
} from "../../cash-in-cash-out/api";
import { deletePayoutPayment } from "../../bulk-entry/api";
import {
  driverAvatarColor,
  driverDisplayName,
  driverInitials,
} from "./DriverCard";
import { useAuth } from "../../../hooks/useAuth";
import { DatePicker } from "../../../components/ui/DatePicker";

function fmtCurrency(v: number | undefined | null): string {
  const n = v ?? 0;
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function monthOptions() {
  const opts = [{ value: "all_time", label: "All time" }];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-IN", { month: "long", year: "numeric" }),
    });
  }
  return opts;
}

const MONTH_OPTIONS = monthOptions();

function txInMonth(date: string | null | undefined, month: string) {
  if (!month || month === "all_time") return true;
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return key === month;
}

function txInPeriod(
  date: string | null | undefined,
  period: string,
  dateFrom: string,
  dateTo: string,
) {
  if (!period || period === "all_time") return true;
  if (period === "custom") {
    if (!dateFrom && !dateTo) return true;
    if (!date) return false;
    const t = new Date(date).getTime();
    if (Number.isNaN(t)) return false;
    if (dateFrom) {
      const start = new Date(`${dateFrom}T00:00:00`).getTime();
      if (!Number.isNaN(start) && t < start) return false;
    }
    if (dateTo) {
      const end = new Date(`${dateTo}T23:59:59`).getTime();
      if (!Number.isNaN(end) && t > end) return false;
    }
    return true;
  }
  return txInMonth(date, period);
}

function formatPeriodButtonLabel(
  period: string,
  dateFrom: string,
  dateTo: string,
): string {
  if (!period || period === "all_time") return "All time";
  if (period === "custom") {
    const fmt = (iso: string) => {
      const d = new Date(`${iso}T00:00:00`);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    };
    if (dateFrom && dateTo) return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
    if (dateFrom) return `From ${fmt(dateFrom)}`;
    if (dateTo) return `Until ${fmt(dateTo)}`;
    return "Custom range";
  }
  const opt = MONTH_OPTIONS.find((o) => o.value === period);
  return opt?.label ?? period;
}

function txSortTime(tx: { date?: string | null; createdAt?: string | null }) {
  const raw = tx.date || tx.createdAt;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

type SortDir = "desc" | "asc";
type TxTypeFilter = "all" | "advance" | "salary";

type PaymentRow = {
  id: string;
  rawId: string;
  amount: number;
  /** advance = cash-in or bulk advance payout; salary = bata cash-out */
  kind: "advance" | "salary";
  notes?: string;
  date?: string | null;
  /** Underlying source for delete API */
  source: "driver_salary" | "bulk_payout";
};

function formatTxDisplayDate(date?: string | null): string {
  if (!date) return "—";
  if (/^\d{2}-\d{2}-\d{4}$/.test(date)) return date;
  const d = new Date(date);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-IN");
  return "—";
}

/** Same sources as Transaction History driver table. Types: Salary | Advance. */
function buildDriverPaymentRows(
  detail: DriverCashInCashOutDetail | null,
): PaymentRow[] {
  const tables = detail?.tables;
  if (!tables) return [];

  const salary = (tables.salaryPayments ?? []).map((r) => ({
    id: `salary-${r._id}`,
    rawId: r._id,
    amount: Number(r.amount) || 0,
    kind: "salary" as const,
    notes: r.notes || "Salary / bata",
    date: r.date,
    source: "driver_salary" as const,
  }));
  const advances = (tables.advanceLedger ?? []).map((r) => ({
    id: `adv-${r._id}`,
    rawId: r._id,
    amount: Number(r.amount) || 0,
    kind: "advance" as const,
    notes: r.notes || "Advance",
    date: r.date,
    source: "driver_salary" as const,
  }));
  // Bulk trip salary payouts (Transaction → Salary when bata is settled).
  const bulk = (tables.bulkAdvancePayouts ?? []).map((r) => ({
    id: `bulk-${r._id}`,
    rawId: r._id,
    amount: Number(r.amount) || 0,
    kind: "salary" as const,
    notes: r.notes?.trim() || "Salary",
    date: r.paymentDate,
    source: "bulk_payout" as const,
  }));

  return [...salary, ...advances, ...bulk];
}

function paymentKindLabel(kind: PaymentRow["kind"]): string {
  return kind === "salary" ? "Salary" : "Advance";
}

function SalaryTableToolbar({
  search,
  onSearch,
  sortDir,
  onSortDir,
  typeFilter,
  onTypeFilter,
}: {
  search: string;
  onSearch: (v: string) => void;
  sortDir: SortDir;
  onSortDir: (d: SortDir) => void;
  typeFilter: TxTypeFilter;
  onTypeFilter: (v: TxTypeFilter) => void;
}) {
  const sortRef = useRef<HTMLDivElement>(null);
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!sortRef.current?.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <label
        className="flex w-full max-w-[11rem] items-center gap-2 rounded-xl border border-slate-200 bg-[var(--bg-main)] px-2.5 dark:border-[#252c4d] sm:max-w-[12.5rem]"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search…"
          className="w-full min-w-0 border-0 bg-transparent py-2 text-sm outline-none dark:text-[#eef0ff]"
        />
      </label>
      <select
        value={typeFilter}
        onChange={(e) => onTypeFilter(e.target.value as TxTypeFilter)}
        aria-label="Transaction type"
        className="rounded-[10px] border border-slate-200 bg-[var(--bg-main)] px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none dark:border-[#252c4d] dark:text-[#eef0ff]"
      >
        <option value="all">All types</option>
        <option value="salary">Salary</option>
        <option value="advance">Advance</option>
      </select>
      <div ref={sortRef} className="relative">
        <button
          type="button"
          onClick={() => setSortOpen((o) => !o)}
          className={`rounded-[10px] border px-3 py-2 text-xs font-semibold transition ${
            sortOpen
              ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-[#242a57] dark:text-[#a5b4fc]"
              : "border-slate-200 text-slate-500 hover:bg-[var(--bg-main)] dark:border-[#252c4d] dark:text-[#8d94b8]"
          }`}
        >
          {sortDir === "desc" ? "↓ Newest" : "↑ Oldest"}
        </button>
        {sortOpen && (
          <div
            className="absolute left-0 top-full z-30 mt-1 min-w-[9.5rem] overflow-hidden rounded-xl border border-slate-200 bg-[var(--bg-card)] py-1 shadow-lg dark:border-[#252c4d]"
          >
            <button
              type="button"
              onClick={() => {
                onSortDir("desc");
                setSortOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--bg-main)] ${
                sortDir === "desc"
                  ? "text-indigo-600 dark:text-[#a5b4fc]"
                  : "text-slate-600 dark:text-[#8d94b8]"
              }`}
            >
              ↓ Newest first
            </button>
            <button
              type="button"
              onClick={() => {
                onSortDir("asc");
                setSortOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--bg-main)] ${
                sortDir === "asc"
                  ? "text-indigo-600 dark:text-[#a5b4fc]"
                  : "text-slate-600 dark:text-[#8d94b8]"
              }`}
            >
              ↑ Oldest first
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SalaryPeriodMenu({
  period,
  onPeriod,
  dateFrom,
  dateTo,
  onDateFrom,
  onDateTo,
  menuOpen,
  onMenuOpen,
}: {
  period: string;
  onPeriod: (v: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  menuOpen: boolean;
  onMenuOpen: (open: boolean) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [draftFrom, setDraftFrom] = useState(dateFrom);
  const [draftTo, setDraftTo] = useState(dateTo);

  useEffect(() => {
    if (menuOpen) {
      setDraftFrom(dateFrom);
      setDraftTo(dateTo);
    }
  }, [menuOpen, dateFrom, dateTo]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onMenuOpen]);

  const label = formatPeriodButtonLabel(period, dateFrom, dateTo);
  const periodActive = period !== "all_time";

  return (
    <div ref={wrapRef} className="relative max-w-[min(100%,16rem)]">
      <button
        type="button"
        onClick={() => onMenuOpen(!menuOpen)}
        className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-[10px] border px-3 py-2 text-xs font-semibold transition ${
          menuOpen || periodActive
            ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-[#242a57] dark:text-[#a5b4fc]"
            : "border-slate-200 text-slate-600 hover:bg-[var(--bg-main)] dark:border-[#252c4d] dark:text-[#8d94b8]"
        }`}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 opacity-80" />
        <span className="truncate">{label}</span>
      </button>
      {menuOpen && (
        <div
          className="absolute right-0 top-full z-30 mt-1 flex w-[min(100vw-2rem,17rem)] max-h-[min(70vh,22rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-[var(--bg-card)] shadow-lg dark:border-[#252c4d]"
        >
          <div className="overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => {
                onPeriod("all_time");
                onDateFrom("");
                onDateTo("");
                onMenuOpen(false);
              }}
              className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--bg-main)] ${
                period === "all_time"
                  ? "text-indigo-600 dark:text-[#a5b4fc]"
                  : "text-slate-700 dark:text-[#eef0ff]"
              }`}
            >
              All time
            </button>
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Month
            </p>
            {MONTH_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onPeriod(o.value);
                  onDateFrom("");
                  onDateTo("");
                  onMenuOpen(false);
                }}
                className={`w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--bg-main)] ${
                  period === o.value
                    ? "text-indigo-600 dark:text-[#a5b4fc]"
                    : "text-slate-700 dark:text-[#eef0ff]"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-200 p-3 dark:border-[#252c4d]">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Custom range
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-500">
                From
                <DatePicker
              value={draftFrom}
              onChange={setDraftFrom}
              className="rounded-[10px] border border-slate-200 bg-[var(--bg-main)] px-2 py-1.5 text-xs text-slate-800 dark:border-[#252c4d] dark:text-[#eef0ff]"
            />
              </label>
              <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-500">
                To
                <DatePicker
              value={draftTo}
              onChange={setDraftTo}
              className="rounded-[10px] border border-slate-200 bg-[var(--bg-main)] px-2 py-1.5 text-xs text-slate-800 dark:border-[#252c4d] dark:text-[#eef0ff]"
            />
              </label>
              <button
                type="button"
                onClick={() => {
                  onPeriod("custom");
                  onDateFrom(draftFrom);
                  onDateTo(draftTo);
                  onMenuOpen(false);
                }}
                className="rounded-[10px] bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-700 dark:bg-indigo-500"
              >
                Apply range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function copyText(text: string) {
  if (!text) return;
  void navigator.clipboard?.writeText(text).catch(() => undefined);
}

/** Digits only; prefix 91 for 10-digit Indian mobiles when opening WhatsApp. */
function whatsappPhoneDigits(phone?: string | null): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function buildDriverCredentialsWhatsAppMessage(opts: {
  ownerName: string;
  ownerCompany?: string;
  driverName: string;
  driverPhone: string;
  loginId: string;
  password: string;
}): string {
  const lines = [
    "*Tripwise — Driver login*",
    "",
    `*Owner:* ${opts.ownerName || "—"}`,
  ];
  if (opts.ownerCompany?.trim()) {
    lines.push(`*Company:* ${opts.ownerCompany.trim()}`);
  }
  lines.push(
    "",
    `*Driver:* ${opts.driverName || "—"}`,
    `*Driver number:* ${opts.driverPhone || "—"}`,
    "",
    "*Login credentials*",
    `Phone / Email: ${opts.loginId || "—"}`,
    `Password: ${opts.password || "—"}`,
  );
  return lines.join("\n");
}

function openDriverCredentialsWhatsApp(opts: {
  ownerName: string;
  ownerCompany?: string;
  driverName: string;
  driverPhone: string;
  loginId: string;
  password: string;
}) {
  const text = buildDriverCredentialsWhatsAppMessage(opts);
  const phone = whatsappPhoneDigits(opts.driverPhone);
  if (!phone) {
    alert("Add a driver phone number before sharing on WhatsApp.");
    return;
  }
  if (!opts.password?.trim()) {
    alert("Driver password is not available to share.");
    return;
  }
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
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
  const { user } = useAuth();
  const [tab, setTab] = useState<"details" | "salary">(initialTab);
  const [blockBusy, setBlockBusy] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, driver._id]);

  const name = driverDisplayName(driver);
  const isBlocked = !!driver.isBlocked;
  const color = driverAvatarColor(avatarIndex);

  const shareOnWhatsApp = () => {
    openDriverCredentialsWhatsApp({
      ownerName: user?.name?.trim() || user?.company?.trim() || "Owner",
      ownerCompany: user?.company,
      driverName: name,
      driverPhone: driver.phone || "",
      loginId: driver.phone || driver.email || "",
      password: driver.password || "",
    });
  };

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
            onClick={shareOnWhatsApp}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366]/90 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#25D366]"
            title="Share login credentials on WhatsApp"
          >
            <WhatsAppIcon className="h-3.5 w-3.5" /> Share credentials
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
          <DetailsTab driver={driver} onWhatsAppShare={shareOnWhatsApp} />
        ) : (
          <SalaryTab driver={driver} />
        )}
      </div>

    </div>
  );
}

function DetailsTab({
  driver,
  onWhatsAppShare,
}: {
  driver: Driver;
  onWhatsAppShare: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const name = driverDisplayName(driver);
  const phone = driver.phone?.trim() || "";
  const email = driver.email?.trim() || "";
  const place = driver.place?.trim() || "";

  const handleCopy = (key: string, value: string) => {
    copyText(value);
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((cur) => (cur === key ? null : cur));
    }, 1400);
  };

  const profileFields = [
    {
      key: "name",
      label: "Name",
      value: name,
      icon: <User className="h-4 w-4" />,
      accent: "from-indigo-500 to-violet-500",
      chip: "bg-indigo-50 text-indigo-600 dark:bg-[#242a57] dark:text-[#a5b4fc]",
    },
    {
      key: "phone",
      label: "Phone",
      value: phone,
      icon: <Phone className="h-4 w-4" />,
      accent: "from-emerald-500 to-teal-500",
      chip: "bg-emerald-50 text-emerald-600 dark:bg-[#0d3325] dark:text-[#34d399]",
      copyable: true,
    },
    {
      key: "email",
      label: "Email",
      value: email,
      icon: <Mail className="h-4 w-4" />,
      accent: "from-sky-500 to-cyan-500",
      chip: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
      copyable: true,
    },
    {
      key: "place",
      label: "Place",
      value: place,
      icon: <MapPin className="h-4 w-4" />,
      accent: "from-amber-500 to-orange-500",
      chip: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    },
  ];

  return (
    <div className="relative mx-auto max-w-5xl">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-2 h-40 rounded-3xl bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_60%)]"
      />

      <div className="relative grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Profile */}
        <section className="overflow-hidden rounded-3xl border border-slate-200/70 bg-[var(--bg-card)] shadow-[0_20px_50px_-28px_rgba(79,70,229,0.45)] dark:border-[#252c4d]">
          <div className="relative overflow-hidden border-b border-slate-100 px-5 py-4 dark:border-[#252c4d]">
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-violet-50/40 to-transparent dark:from-[#1a1f3d]/80 dark:via-[#1a1f3d]/30 dark:to-transparent"
            />
            <div className="relative flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
                <User className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-[#eef0ff]">
                  Driver profile
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#8d94b8]">
                  Contact and location
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            {profileFields.map((f) => {
              const empty = !f.value;
              const copied = copiedKey === f.key;
              return (
                <div
                  key={f.key}
                  className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-[var(--bg-main)] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200/80 hover:shadow-[0_12px_28px_-18px_rgba(79,70,229,0.55)] dark:border-[#252c4d] dark:hover:border-indigo-500/35"
                >
                  <div
                    aria-hidden
                    className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${f.accent} opacity-80`}
                  />
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${f.chip}`}
                      >
                        {f.icon}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-[#8d94b8]">
                        {f.label}
                      </span>
                    </div>
                    {f.copyable && !empty ? (
                      <button
                        type="button"
                        onClick={() => handleCopy(f.key, f.value)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                          copied
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "text-indigo-600 opacity-70 hover:bg-indigo-50 hover:opacity-100 dark:text-[#a5b4fc] dark:hover:bg-[#242a57]"
                        }`}
                      >
                        <Copy className="h-3 w-3" />
                        {copied ? "Copied" : "Copy"}
                      </button>
                    ) : null}
                  </div>
                  <p
                    className={`break-all text-[15px] font-semibold leading-snug ${
                      empty
                        ? "italic text-slate-400 dark:text-[#8d94b8]"
                        : "text-slate-900 dark:text-[#eef0ff]"
                    }`}
                  >
                    {empty ? "Not added" : f.value}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Credentials */}
        <section className="flex flex-col overflow-hidden rounded-3xl border border-emerald-200/50 bg-[var(--bg-card)] shadow-[0_20px_50px_-28px_rgba(37,211,102,0.4)] dark:border-emerald-500/20">
          <div className="relative overflow-hidden border-b border-emerald-100/80 px-5 py-4 dark:border-emerald-500/15">
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-transparent dark:from-emerald-500/15 dark:via-emerald-500/5 dark:to-transparent"
            />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#25D366] to-teal-500 text-white shadow-lg shadow-emerald-500/30">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-[#eef0ff]">
                    Login credentials
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#8d94b8]">
                    App phone & password
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onWhatsAppShare}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 py-2 text-xs font-bold text-white shadow-[0_8px_20px_-8px_#25D366] transition hover:-translate-y-0.5 hover:bg-[#20bd5a] active:scale-[0.98]"
              >
                <WhatsAppIcon className="h-3.5 w-3.5" />
                Share credentials
              </button>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
            <div className="rounded-2xl border border-slate-100 bg-[var(--bg-main)] p-4 dark:border-[#252c4d]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-[#0d3325] dark:text-[#34d399]">
                    <Phone className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-[#8d94b8]">
                    Login phone
                  </span>
                </div>
                {phone ? (
                  <button
                    type="button"
                    onClick={() => handleCopy("login-phone", phone)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                      copiedKey === "login-phone"
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "text-indigo-600 hover:bg-indigo-50 dark:text-[#a5b4fc] dark:hover:bg-[#242a57]"
                    }`}
                  >
                    <Copy className="h-3 w-3" />
                    {copiedKey === "login-phone" ? "Copied" : "Copy"}
                  </button>
                ) : null}
              </div>
              <p className="font-mono text-[15px] font-semibold tracking-wide text-slate-900 dark:text-[#eef0ff]">
                {phone || "—"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-[var(--bg-main)] p-4 dark:border-[#252c4d]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-[#242a57] dark:text-[#a5b4fc]">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-[#8d94b8]">
                    Password
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {showPassword && driver.password ? (
                    <button
                      type="button"
                      onClick={() => handleCopy("password", driver.password!)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                        copiedKey === "password"
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "text-indigo-600 hover:bg-indigo-50 dark:text-[#a5b4fc] dark:hover:bg-[#242a57]"
                      }`}
                    >
                      <Copy className="h-3 w-3" />
                      {copiedKey === "password" ? "Copied" : "Copy"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-indigo-600 transition hover:bg-indigo-50 dark:text-[#a5b4fc] dark:hover:bg-[#242a57]"
                  >
                    {showPassword ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <p className="font-mono text-[15px] font-semibold tracking-[0.14em] text-slate-900 dark:text-[#eef0ff]">
                {showPassword ? driver.password || "—" : "••••••••"}
              </p>
            </div>

            <div className="mt-auto rounded-2xl border border-dashed border-emerald-200/70 bg-emerald-50/50 px-3.5 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/5">
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-[#8d94b8]">
                Share sends owner name, driver name, phone, and login details to
                the driver’s WhatsApp.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SalaryTab({ driver }: { driver: Driver }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [salaryData, setSalaryData] = useState<DriverSalaryData | null>(null);
  const [error, setError] = useState("");
  /** All-time CICO detail — same source as Transaction History. */
  const [cicoDetail, setCicoDetail] =
    useState<DriverCashInCashOutDetail | null>(null);

  const [ledSearch, setLedSearch] = useState("");
  const [ledSort, setLedSort] = useState<SortDir>("desc");
  const [ledPeriod, setLedPeriod] = useState("all_time");
  const [ledDateFrom, setLedDateFrom] = useState("");
  const [ledDateTo, setLedDateTo] = useState("");
  const [ledType, setLedType] = useState<TxTypeFilter>("all");
  const [ledPeriodMenuOpen, setLedPeriodMenuOpen] = useState(false);

  const driverId = driver._id ?? (driver as { id?: string }).id;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData();
  }, [driverId]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [salaryRes, cicoRes] = await Promise.all([
        fetchDriverSalary(driverId!).catch(() => null),
        fetchCashInCashOutDriverDetail(driverId!, "all_time").catch(() => null),
      ]);
      if (salaryRes) setSalaryData(salaryRes);
      setCicoDetail(cicoRes);
    } catch {
      setError("Failed to load salary data");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = async (row: PaymentRow) => {
    if (!confirm("Delete this transaction?")) return;
    try {
      if (row.source === "bulk_payout") {
        await deletePayoutPayment(row.rawId);
      } else {
        await deleteSalaryTransaction(row.rawId);
      }
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

  const ledger = useMemo(
    () => buildDriverPaymentRows(cicoDetail),
    [cicoDetail],
  );

  const ledgerForCards = useMemo(() => {
    let rows = ledger.filter((tx) =>
      txInPeriod(tx.date, ledPeriod, ledDateFrom, ledDateTo),
    );
    if (ledType !== "all") {
      rows = rows.filter((tx) => tx.kind === ledType);
    }
    return rows;
  }, [ledger, ledPeriod, ledDateFrom, ledDateTo, ledType]);

  const ledgerRows = useMemo(() => {
    const q = ledSearch.trim().toLowerCase();
    let rows = [...ledgerForCards];
    if (q) {
      rows = rows.filter((tx) => {
        const hay = [
          String(tx.amount ?? ""),
          tx.notes ?? "",
          paymentKindLabel(tx.kind),
          formatTxDisplayDate(tx.date),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return [...rows].sort((a, b) => {
      const d = txSortTime(a) - txSortTime(b);
      return ledSort === "desc" ? -d : d;
    });
  }, [ledgerForCards, ledSearch, ledSort]);

  const filteredSalarySum = useMemo(
    () =>
      ledgerForCards
        .filter((tx) => tx.kind === "salary")
        .reduce((s, tx) => s + (Number(tx.amount) || 0), 0),
    [ledgerForCards],
  );
  const filteredAdvanceSum = useMemo(
    () =>
      ledgerForCards
        .filter((tx) => tx.kind === "advance")
        .reduce((s, tx) => s + (Number(tx.amount) || 0), 0),
    [ledgerForCards],
  );

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

  // Align with Transaction History (all-time).
  const bulkFromTrips = Number(cicoDetail?.summary?.bulkAdvance?.fromTrips) || 0;
  const bataFromTrips =
    Number(cicoDetail?.summary?.vehicleBata?.fromTrips) ||
    salaryData?.totalEarnings ||
    0;
  const grandTotal = bulkFromTrips + bataFromTrips;
  const paidCombined =
    (Number(cicoDetail?.summary?.bulkAdvance?.paid) || 0) +
    (Number(cicoDetail?.summary?.vehicleBata?.paid) ||
      salaryData?.salaryPaid ||
      0);
  const pendingPayout = grandTotal - paidCombined;

  /** Advances given via Transaction (driver cash-in → DriverSalary type=advance). */
  const advancePaid = salaryData?.totalAdvance ?? 0;
  const tripBata = salaryData?.totalEarnings ?? bataFromTrips;
  const totalKm = salaryData?.totalKm ?? 0;
  const paidPct =
    grandTotal > 0
      ? Math.min(100, Math.round((paidCombined / grandTotal) * 100))
      : 0;

  const hasLedgerFilters = ledPeriod !== "all_time" || ledType !== "all";

  const tiles = hasLedgerFilters
    ? [
        {
          label: "Salary",
          hint: "Salary / bata payouts in this view",
          value: fmtCurrency(filteredSalarySum),
          bg: "bg-emerald-50 dark:bg-[#0d3325]",
          icon: (
            <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ),
        },
        {
          label: "Advance",
          hint: "Advances in this view",
          value: fmtCurrency(filteredAdvanceSum),
          bg: "bg-indigo-50 dark:bg-[#242a57]",
          icon: (
            <Wallet className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
          ),
        },
        {
          label: "Transactions",
          hint: "Rows matching month & type",
          value: String(ledgerForCards.length),
          bg: "bg-violet-50 dark:bg-violet-500/15",
          icon: (
            <Wallet className="h-4 w-4 text-violet-600 dark:text-violet-300" />
          ),
        },
        {
          label: "Total km",
          hint: "All-time trip distance",
          value: `${totalKm} km`,
          bg: "bg-orange-50 dark:bg-orange-500/15",
          icon: (
            <MapPin className="h-4 w-4 text-orange-600 dark:text-orange-300" />
          ),
        },
      ]
    : [
        {
          label: "Pending payout",
          hint: "Trip bata + bulk − cash-outs paid",
          value: fmtCurrency(pendingPayout),
          sub: `${paidPct}% settled · paid ${fmtCurrency(paidCombined)}`,
          bg: "bg-teal-50 dark:bg-teal-500/15",
          icon: (
            <Wallet className="h-4 w-4 text-teal-700 dark:text-teal-300" />
          ),
          accent: true as const,
        },
        {
          label: "Trip bata",
          hint: "Earnings from completed vehicle trips",
          value: fmtCurrency(tripBata),
          bg: "bg-emerald-50 dark:bg-[#0d3325]",
          icon: (
            <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ),
        },
        {
          label: "Bulk trip salary",
          hint: "Advances owed from Bulk Entry trips",
          value: fmtCurrency(bulkFromTrips),
          bg: "bg-violet-50 dark:bg-violet-500/15",
          icon: (
            <Wallet className="h-4 w-4 text-violet-600 dark:text-violet-300" />
          ),
        },
        {
          label: "Advance paid",
          hint: "Advances given on Transaction",
          value: fmtCurrency(advancePaid),
          bg: "bg-indigo-50 dark:bg-[#242a57]",
          icon: (
            <Wallet className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
          ),
        },
        {
          label: "Total km",
          hint: "All-time trip distance",
          value: `${totalKm} km`,
          bg: "bg-orange-50 dark:bg-orange-500/15",
          icon: (
            <MapPin className="h-4 w-4 text-orange-600 dark:text-orange-300" />
          ),
        },
      ];


  return (
    <div className="grid gap-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-extrabold text-slate-900 dark:text-[#eef0ff]">
            Financial summary
          </h3>
          <p className="mt-0.5 max-w-lg text-xs text-slate-500 dark:text-[#8d94b8]">
            Summary cards follow the period and type filters. Search and sort
            apply to the table only.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SalaryPeriodMenu
            period={ledPeriod}
            onPeriod={setLedPeriod}
            dateFrom={ledDateFrom}
            dateTo={ledDateTo}
            onDateFrom={setLedDateFrom}
            onDateTo={setLedDateTo}
            menuOpen={ledPeriodMenuOpen}
            onMenuOpen={setLedPeriodMenuOpen}
          />
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={`rounded-[14px] border px-4 py-3.5 dark:border-[#252c4d] ${
              "accent" in t && t.accent
                ? "border-teal-200 bg-gradient-to-br from-teal-700 to-teal-500 text-white dark:border-teal-600/40"
                : "border-slate-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${
                  "accent" in t && t.accent ? "bg-white/20" : t.bg
                }`}
              >
                {"accent" in t && t.accent ? (
                  <Wallet className="h-4 w-4 text-white" />
                ) : (
                  t.icon
                )}
              </div>
              <div className="min-w-0 flex-1">
                <small
                  className={`block text-xs font-semibold ${
                    "accent" in t && t.accent
                      ? "text-white/85"
                      : "text-slate-500 dark:text-[#8d94b8]"
                  }`}
                >
                  {t.label}
                </small>
                <b
                  className={`mt-0.5 block break-all text-[20px] font-extrabold leading-snug tabular-nums ${
                    "accent" in t && t.accent
                      ? "text-white"
                      : "text-slate-900 dark:text-[#eef0ff]"
                  }`}
                >
                  {t.value}
                </b>
                <span
                  className={`mt-1 block text-[11px] leading-snug ${
                    "accent" in t && t.accent
                      ? "text-white/75"
                      : "text-slate-400 dark:text-[#8d94b8]"
                  }`}
                >
                  {"sub" in t && t.sub ? t.sub : t.hint}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Section title="Salary & payment history" padded>
        <SalaryTableToolbar
          search={ledSearch}
          onSearch={setLedSearch}
          sortDir={ledSort}
          onSortDir={setLedSort}
          typeFilter={ledType}
          onTypeFilter={setLedType}
        />
        {ledgerRows.length === 0 ? (
          <EmptyMsg
            icon="🧾"
            text={
              ledger.length === 0
                ? "No payments recorded yet."
                : "No transactions match these filters."
            }
          />
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
                {ledgerRows.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-t border-slate-100 dark:border-[#252c4d]"
                  >
                    <td className="whitespace-nowrap px-2 py-3 text-slate-600 dark:text-[#8d94b8]">
                      {formatTxDisplayDate(tx.date)}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          tx.kind === "salary"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-[#0d3325] dark:text-[#34d399]"
                            : "bg-indigo-50 text-indigo-700 dark:bg-[#242a57] dark:text-[#a5b4fc]"
                        }`}
                      >
                        {paymentKindLabel(tx.kind)}
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
                        onClick={() => handleDeleteTransaction(tx)}
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
