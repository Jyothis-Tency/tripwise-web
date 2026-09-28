import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  History,
  Loader2,
  User,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import {
  fetchAgencies,
  fetchDrivers,
  fetchCashInCashOutAgencyDetail,
  fetchCashInCashOutDriverDetail,
  addAgencyPayoutPayment,
  addDriverPayoutPayment,
  recordAgencyProfitPayout,
  createSalaryTransaction,
  type Agency,
  type Driver,
  type DriverCashInCashOutDetail,
} from "../api";
import { FilterLabel, SearchInput } from "../components/FilterControls";

type EntityType = "agency" | "driver";
type CashKind = "cash_in" | "cash_out";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "online", label: "Online" },
  { value: "upi", label: "UPI" },
  { value: "other", label: "Other" },
] as const;

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000] as const;

const LS_RECENT_AGENCIES = "tripwise_tx_recent_agencies";
const LS_RECENT_DRIVERS = "tripwise_tx_recent_drivers";
const RECENT_PARTY_LIMIT = 3;

function loadRecentIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && !!id);
  } catch {
    return [];
  }
}

function pushRecentId(key: string, id: string): string[] {
  if (!id) return loadRecentIds(key);
  const next = [id, ...loadRecentIds(key).filter((x) => x !== id)].slice(
    0,
    RECENT_PARTY_LIMIT,
  );
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

const fieldCls =
  "w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400";

function driverDisplayName(d: Driver) {
  const full = (d as { fullName?: string }).fullName?.trim();
  if (full) return full;
  return `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || "Driver";
}

function fmtCurrency(n: number) {
  return `₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;
}

function fmtSignedCurrency(n: number) {
  if (n < 0) return `−${fmtCurrency(n)}`;
  if (n > 0) return `+${fmtCurrency(n)}`;
  return fmtCurrency(n);
}

function pickAgencyIdForDriverBulkPayout(
  detail: DriverCashInCashOutDetail,
  agencies: Agency[],
): string | null {
  const fromTrips = detail.tables.bulkTripsAdvance.find((t) => t.agencyId);
  if (fromTrips?.agencyId) return fromTrips.agencyId;
  const fromPay = detail.tables.bulkAdvancePayouts.find((t) => t.agencyId);
  if (fromPay?.agencyId) return fromPay.agencyId;
  return agencies[0]?._id ?? agencies[0]?.id ?? null;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <FilterLabel>{children}</FilterLabel>;
}

function BalanceStat({
  label,
  value,
  loading,
  tone = "neutral",
}: {
  label: string;
  value: number | null;
  loading: boolean;
  tone?: "neutral" | "remaining";
}) {
  const positive = (value ?? 0) >= 0;
  const valueCls =
    tone === "remaining"
      ? positive
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-amber-600 dark:text-amber-400"
      : "text-slate-800 dark:text-slate-100";

  return (
    <div className="text-right">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </p>
      {loading || value == null ? (
        <div className="mt-0.5 flex h-5 items-center justify-end">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
        </div>
      ) : (
        <p
          className={`mt-0.5 text-sm font-bold tabular-nums leading-none ${valueCls}`}
        >
          {tone === "remaining" ? fmtSignedCurrency(value) : fmtCurrency(value)}
        </p>
      )}
    </div>
  );
}

function isoDateOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function TransactionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillEntity = searchParams.get("entity");
  const prefillId = searchParams.get("id")?.trim() || "";
  const returnTo = searchParams.get("returnTo")?.trim() || "";
  const skipEntityClearRef = useRef(
    Boolean(prefillId && (prefillEntity === "driver" || prefillEntity === "agency")),
  );

  const [entityType, setEntityType] = useState<EntityType>(
    prefillEntity === "driver" ? "driver" : "agency",
  );
  const [nameQuery, setNameQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [cashKind, setCashKind] = useState<CashKind>(
    prefillEntity === "driver" ? "cash_out" : "cash_in",
  );
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [grandTotal, setGrandTotal] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [recentAgencyIds, setRecentAgencyIds] = useState<string[]>(() =>
    loadRecentIds(LS_RECENT_AGENCIES),
  );
  const [recentDriverIds, setRecentDriverIds] = useState<string[]>(() =>
    loadRecentIds(LS_RECENT_DRIVERS),
  );
  const [returnPromptOpen, setReturnPromptOpen] = useState(false);

  const recentIds =
    entityType === "agency" ? recentAgencyIds : recentDriverIds;

  const selectParty = useCallback(
    (id: string) => {
      if (!id) return;
      setSelectedId(id);
      if (entityType === "agency") {
        setRecentAgencyIds(pushRecentId(LS_RECENT_AGENCIES, id));
      } else {
        setRecentDriverIds(pushRecentId(LS_RECENT_DRIVERS, id));
      }
    },
    [entityType],
  );

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const [a, d] = await Promise.all([
        fetchAgencies(1, 200),
        fetchDrivers({ page: 1, limit: 200, blockFilter: "unblocked" }),
      ]);
      setAgencies(a.agencies);
      setDrivers(d.drivers);
    } catch {
      setMessage("Failed to load agencies / drivers.");
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (skipEntityClearRef.current) {
      skipEntityClearRef.current = false;
      setCashKind(entityType === "driver" ? "cash_out" : "cash_in");
      return;
    }
    setSelectedId("");
    setNameQuery("");
    setMessage(null);
    setSuccess(false);
    setGrandTotal(null);
    setRemaining(null);
    setCashKind(entityType === "driver" ? "cash_out" : "cash_in");
  }, [entityType]);

  // Prefill party from Drivers → Salary/Advance deep link.
  useEffect(() => {
    if (loadingLists || !prefillId) return;
    if (entityType === "driver") {
      const exists = drivers.some((d) => d._id === prefillId);
      if (exists) {
        setSelectedId(prefillId);
        setRecentDriverIds(pushRecentId(LS_RECENT_DRIVERS, prefillId));
      }
    } else {
      const exists = agencies.some(
        (a) => (a._id ?? a.id ?? "") === prefillId,
      );
      if (exists) {
        setSelectedId(prefillId);
        setRecentAgencyIds(pushRecentId(LS_RECENT_AGENCIES, prefillId));
      }
    }
  }, [loadingLists, prefillId, entityType, drivers, agencies]);

  useEffect(() => {
    if (!returnPromptOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReturnPromptOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [returnPromptOpen]);

  const loadBalance = useCallback(
    async (id: string, type: EntityType) => {
      if (!id) {
        setGrandTotal(null);
        setRemaining(null);
        return;
      }
      setBalanceLoading(true);
      try {
        if (type === "agency") {
          const detail = await fetchCashInCashOutAgencyDetail(id, "all_time");
          const bulk = Number(detail.summary.cashInBulk.fromTrips) || 0;
          const vehicle =
            Number(detail.summary.cashOutAgencyProfit.fromTrips) || 0;
          setGrandTotal(bulk - vehicle);
          setRemaining(
            detail.summary.cashInBulk.remaining -
              detail.summary.cashOutAgencyProfit.remaining,
          );
        } else {
          const detail = await fetchCashInCashOutDriverDetail(id, "all_time");
          setGrandTotal(
            (Number(detail.summary.bulkAdvance.fromTrips) || 0) +
              (Number(detail.summary.vehicleBata.fromTrips) || 0),
          );
          setRemaining(
            detail.summary.vehicleBata.remaining +
              detail.summary.bulkAdvance.remaining,
          );
        }
      } catch {
        setGrandTotal(null);
        setRemaining(null);
      } finally {
        setBalanceLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedId) {
      setGrandTotal(null);
      setRemaining(null);
      return;
    }
    loadBalance(selectedId, entityType);
  }, [selectedId, entityType, loadBalance]);

  const nameOptions = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    const base =
      entityType === "agency"
        ? agencies
            .map((a) => ({
              id: a._id ?? a.id ?? "",
              label: a.name,
              sub: a.phone || "Agency",
            }))
            .filter((o) => o.id && (!q || o.label.toLowerCase().includes(q)))
        : drivers
            .map((d) => ({
              id: d._id,
              label: driverDisplayName(d),
              sub: d.phone || "Driver",
            }))
            .filter(
              (o) =>
                o.id &&
                (!q ||
                  o.label.toLowerCase().includes(q) ||
                  o.sub.toLowerCase().includes(q)),
            );

    // Empty search: pin up to 3 recently selected parties at the top.
    if (q || recentIds.length === 0) {
      return base.map((o) => ({ ...o, recent: false }));
    }

    const byId = new Map(base.map((o) => [o.id, o]));
    const recentOpts = recentIds
      .map((id) => byId.get(id))
      .filter((o): o is (typeof base)[number] => !!o)
      .map((o) => ({ ...o, recent: true }));
    const recentSet = new Set(recentOpts.map((o) => o.id));
    const rest = base
      .filter((o) => !recentSet.has(o.id))
      .map((o) => ({ ...o, recent: false }));
    return [...recentOpts, ...rest];
  }, [entityType, agencies, drivers, nameQuery, recentIds]);

  const selected = useMemo(() => {
    if (!selectedId) return undefined;
    if (entityType === "agency") {
      const a = agencies.find((x) => (x._id ?? x.id) === selectedId);
      return a
        ? { id: selectedId, label: a.name, sub: a.phone || "Agency" }
        : nameOptions.find((o) => o.id === selectedId);
    }
    const d = drivers.find((x) => x._id === selectedId);
    return d
      ? {
          id: selectedId,
          label: driverDisplayName(d),
          sub: d.phone || "Driver",
        }
      : nameOptions.find((o) => o.id === selectedId);
  }, [selectedId, entityType, agencies, drivers, nameOptions]);

  const directionHint =
    entityType === "agency"
      ? cashKind === "cash_in"
        ? "Money received from agency"
        : "Money paid to agency"
      : cashKind === "cash_in"
        ? "Advance given to driver"
        : "Salary / bata payment to driver";

  const addQuickAmount = (n: number) => {
    const cur = Number(amount) || 0;
    setAmount(String(cur + n));
  };

  const setFullDue = () => {
    if (remaining == null) return;
    const due = Math.abs(remaining);
    if (due > 0) setAmount(String(due));
  };

  const submit = async () => {
    setMessage(null);
    setSuccess(false);
    const amt = Number(amount);
    if (!selectedId) {
      setMessage(
        `Select ${entityType === "agency" ? "an agency" : "a driver"}.`,
      );
      return;
    }
    if (!amt || amt <= 0) {
      setMessage("Enter a valid amount.");
      return;
    }

    setSaving(true);
    try {
      if (entityType === "agency") {
        if (cashKind === "cash_in") {
          await addAgencyPayoutPayment(selectedId, {
            amount: amt,
            paymentDate: date,
            paymentMethod: method,
            notes,
          });
        } else {
          await recordAgencyProfitPayout(selectedId, {
            amount: amt,
            paymentDate: date,
            paymentMethod: method,
            notes,
          });
        }
      } else if (cashKind === "cash_in") {
        await createSalaryTransaction(selectedId, {
          type: "advance",
          amount: amt,
          date,
          notes: notes.trim() || "Advance",
        });
      } else {
        const detail = await fetchCashInCashOutDriverDetail(selectedId);
        let left = amt;
        const bataRemaining = detail.summary.vehicleBata.remaining;
        const bulkRemaining = detail.summary.bulkAdvance.remaining;
        const maxPayable = bataRemaining + bulkRemaining;

        if (amt > maxPayable + 0.01) {
          throw new Error(
            `Amount exceeds payable balance (₹${maxPayable.toLocaleString("en-IN")}). Bata ₹${bataRemaining.toLocaleString("en-IN")} + bulk advance ₹${bulkRemaining.toLocaleString("en-IN")}.`,
          );
        }

        if (left > 0 && bataRemaining > 0) {
          const pay = Math.min(left, bataRemaining);
          await createSalaryTransaction(selectedId, {
            type: "salary",
            amount: pay,
            date,
            notes,
          });
          left -= pay;
        }

        if (left > 0 && bulkRemaining > 0) {
          const agencyId = pickAgencyIdForDriverBulkPayout(detail, agencies);
          if (!agencyId) {
            throw new Error(
              "Could not record advance payout: no agency linked. Link a trip to an agency first.",
            );
          }
          const pay = Math.min(left, bulkRemaining);
          await addDriverPayoutPayment(agencyId, {
            driverName: detail.driver.displayName,
            amount: pay,
            paymentDate: date,
            paymentMethod: method,
            notes,
          });
          left -= pay;
        }
      }

      setSuccess(true);
      setAmount("");
      setNotes("");
      setMessage("Transaction recorded successfully.");
      if (selectedId) loadBalance(selectedId, entityType);

      if (returnTo) {
        setReturnPromptOpen(true);
      }
    } catch (e: unknown) {
      const msg =
        (e as { message?: string })?.message ||
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
        "Failed to record transaction.";
      setMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-main)]">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 py-4 sm:px-6 sm:py-5">
        <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Transaction
              </h1>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Record cash in or cash out for an agency or driver.
              </p>
            </div>
          </div>
          <Link
            to="/transaction-history"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-[#1e2638] dark:text-slate-300 dark:hover:bg-white/5 sm:text-sm"
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">History</span>
          </Link>
        </div>

        {loadingLists ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-[var(--bg-card)] dark:border-[#1e2638]">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
          </div>
        ) : (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[var(--bg-card)] shadow-sm dark:border-[#1e2638]">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-[#1e2638] sm:px-5">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Payment &amp; settlement
                </h2>
                <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                  {selected
                    ? `Party: ${selected.label}`
                    : "Choose a party, then enter payment details"}
                </p>
              </div>
              {selectedId && remaining != null && !balanceLoading && (
                <div className="hidden shrink-0 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 sm:flex">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Remaining
                  </span>
                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${
                      remaining >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-500 dark:text-rose-400"
                    }`}
                  >
                    {fmtSignedCurrency(remaining)}
                  </span>
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-12 lg:gap-5">
                {/* Party */}
                <div className="flex min-h-0 flex-col gap-4 lg:col-span-5">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      1. Select party
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      Filter agency or driver account
                    </p>
                  </div>

                  <div
                    className="grid shrink-0 grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-[#1e2638] dark:bg-[#060e20]"
                    role="tablist"
                  >
                    {(
                      [
                        ["agency", "Agency", Building2],
                        ["driver", "Driver", User],
                      ] as const
                    ).map(([id, label, Icon]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={entityType === id}
                        onClick={() => setEntityType(id)}
                        className={`flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${
                          entityType === id
                            ? "border border-indigo-500/40 bg-[var(--bg-card)] text-indigo-600 shadow-xs dark:bg-[#131b2e] dark:text-indigo-300"
                            : "bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="shrink-0">
                    <FieldLabel>
                      Search {entityType === "agency" ? "agency" : "driver"}
                    </FieldLabel>
                    <SearchInput
                      value={nameQuery}
                      onChange={setNameQuery}
                      placeholder="Search by name or phone…"
                      resultCount={nameOptions.length}
                    />
                  </div>

                  <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/70 p-1.5 dark:border-[#1e2638] dark:bg-white/[0.03] md:max-h-none md:min-h-[16rem] md:flex-1">
                    {nameOptions.length === 0 ? (
                      <p className="px-3 py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                        No matches
                      </p>
                    ) : (
                      nameOptions.map((o, idx) => {
                        const sel = o.id === selectedId;
                        const showRecentHeader =
                          !nameQuery.trim() &&
                          o.recent &&
                          (idx === 0 || !nameOptions[idx - 1]?.recent);
                        const showRestHeader =
                          !nameQuery.trim() &&
                          !o.recent &&
                          idx > 0 &&
                          nameOptions[idx - 1]?.recent;
                        return (
                          <div key={o.id}>
                            {showRecentHeader && (
                              <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                Recent
                              </p>
                            )}
                            {showRestHeader && (
                              <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                All {entityType === "agency" ? "agencies" : "drivers"}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => selectParty(o.id)}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                                sel
                                  ? "border-2 border-indigo-500/80 bg-indigo-50 shadow-sm dark:bg-indigo-500/10 dark:border-indigo-500/70"
                                  : "border border-transparent bg-[var(--bg-card)] hover:border-slate-200 dark:hover:border-white/10 dark:hover:bg-white/[0.04]"
                              }`}
                            >
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                  sel
                                    ? "border border-indigo-500/40 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"
                                    : entityType === "agency"
                                      ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                                      : "bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"
                                }`}
                              >
                                {entityType === "agency" ? (
                                  <Building2 className="h-4 w-4" />
                                ) : (
                                  <User className="h-4 w-4" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {o.label}
                                  </p>
                                  {o.recent && !nameQuery.trim() && (
                                    <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                                      Recent
                                    </span>
                                  )}
                                </div>
                                <p className="truncate font-mono text-xs text-slate-400 dark:text-slate-500">
                                  {o.sub}
                                </p>
                              </div>
                              {sel && (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Payment */}
                <div className="flex flex-col gap-4 border-t border-slate-100 pt-6 dark:border-[#1e2638] lg:col-span-7 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        2. Transaction details
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                        {selected
                          ? `For ${selected.label}`
                          : "Select a party first"}
                      </p>
                    </div>
                    {selectedId && (
                      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                        <BalanceStat
                          label="Grand Total"
                          value={grandTotal}
                          loading={balanceLoading}
                        />
                        <div
                          className="h-8 w-px bg-slate-200 dark:bg-white/10"
                          aria-hidden
                        />
                        <BalanceStat
                          label="Remaining"
                          value={remaining}
                          loading={balanceLoading}
                          tone="remaining"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <FieldLabel>Cash flow direction</FieldLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {entityType === "agency" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setCashKind("cash_in")}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                              cashKind === "cash_in"
                                ? "border-emerald-500/80 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                : "border-slate-200 bg-[var(--bg-elevated)] text-slate-500 hover:border-emerald-500/40 hover:text-emerald-600 dark:border-[#1e2638] dark:text-slate-400 dark:hover:bg-emerald-950/10"
                            }`}
                          >
                            <ArrowDownLeft className="h-4 w-4" />
                            Cash In
                          </button>
                          <button
                            type="button"
                            onClick={() => setCashKind("cash_out")}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                              cashKind === "cash_out"
                                ? "border-rose-500/80 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                                : "border-slate-200 bg-[var(--bg-elevated)] text-slate-500 hover:border-rose-500/40 hover:text-rose-500 dark:border-[#1e2638] dark:text-slate-400 dark:hover:bg-rose-950/10"
                            }`}
                          >
                            <ArrowUpRight className="h-4 w-4" />
                            Cash Out
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setCashKind("cash_out")}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                              cashKind === "cash_out"
                                ? "border-rose-500/80 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                                : "border-slate-200 bg-[var(--bg-elevated)] text-slate-500 hover:border-rose-500/40 hover:text-rose-500 dark:border-[#1e2638] dark:text-slate-400 dark:hover:bg-rose-950/10"
                            }`}
                          >
                            <ArrowUpRight className="h-4 w-4" />
                            Cash Out
                          </button>
                          <button
                            type="button"
                            onClick={() => setCashKind("cash_in")}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                              cashKind === "cash_in"
                                ? "border-sky-500/80 bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400"
                                : "border-slate-200 bg-[var(--bg-elevated)] text-slate-500 hover:border-sky-500/40 hover:text-sky-600 dark:border-[#1e2638] dark:text-slate-400 dark:hover:bg-sky-950/10"
                            }`}
                          >
                            <Wallet className="h-4 w-4" />
                            Advance
                          </button>
                        </>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                      {directionHint}
                    </p>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Amount (₹)
                      </span>
                      {remaining != null && !balanceLoading && (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          Outstanding:{" "}
                          <strong className="text-slate-700 dark:text-slate-200">
                            {fmtSignedCurrency(remaining)}
                          </strong>
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className={`${fieldCls} py-3 pl-9 font-mono text-xl font-bold tracking-wide`}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {QUICK_AMOUNTS.map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => addQuickAmount(n)}
                          className="rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2.5 py-1 font-mono text-xs text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-[#1e2638] dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
                        >
                          +₹{n.toLocaleString("en-IN")}
                        </button>
                      ))}
                      {remaining != null && Math.abs(remaining) > 0 && (
                        <button
                          type="button"
                          onClick={setFullDue}
                          className="ml-auto rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs font-medium text-emerald-600 transition hover:bg-emerald-500/20 dark:text-emerald-400"
                        >
                          Clear full due
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Posting date
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] font-medium">
                          <button
                            type="button"
                            onClick={() => setDate(isoDateOffset(0))}
                            className="text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            Today
                          </button>
                          <span className="text-slate-300 dark:text-slate-600">
                            ·
                          </span>
                          <button
                            type="button"
                            onClick={() => setDate(isoDateOffset(-1))}
                            className="text-slate-500 hover:underline dark:text-slate-400"
                          >
                            Yesterday
                          </button>
                        </div>
                      </div>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className={`${fieldCls} font-mono`}
                      />
                    </div>
                    <div>
                      <FieldLabel>Payment method</FieldLabel>
                      <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className={fieldCls}
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Notes</FieldLabel>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Optional note…"
                      className={`${fieldCls} resize-none`}
                    />
                  </div>

                  {message && (
                    <div
                      className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${
                        success
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                      }`}
                    >
                      {success && (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <span>{message}</span>
                    </div>
                  )}

                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={saving || !selectedId}
                      onClick={submit}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        "Save Transaction"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {returnPromptOpen && returnTo && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-[2px] sm:items-center dark:bg-black/55"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReturnPromptOpen(false);
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tx-success-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-[var(--bg-card)] shadow-2xl dark:border-[#252c4d]"
          >
            <div className="relative px-6 pb-2 pt-6 text-center">
              <button
                type="button"
                onClick={() => setReturnPromptOpen(false)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">
                <CheckCircle2 className="h-7 w-7" strokeWidth={2} />
              </div>
              <h3
                id="tx-success-title"
                className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-[#eef0ff]"
              >
                Transaction saved
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-[#8d94b8]">
                All set. You can keep recording here, or optionally jump back to
                the driver&apos;s salary view.
              </p>
            </div>

            <div className="flex flex-col gap-2 px-6 pb-6 pt-4">
              <button
                type="button"
                onClick={() => setReturnPromptOpen(false)}
                className="flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-[0_6px_16px_-6px_#4f46e5] transition hover:bg-indigo-500"
              >
                Stay here
              </button>
              <button
                type="button"
                onClick={() => {
                  setReturnPromptOpen(false);
                  navigate(returnTo);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-[#252c4d] dark:text-[#aab0d0] dark:hover:bg-white/[0.04]"
              >
                <UserRound className="h-4 w-4" />
                Back to driver
                <span className="text-xs font-medium text-slate-400 dark:text-[#6b7191]">
                  optional
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
