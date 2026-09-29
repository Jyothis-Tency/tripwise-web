import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Wallet,
  X,
} from "lucide-react";
import {
  fetchAgencies,
  fetchDrivers,
  fetchCashInCashOutAgencyDetail,
  fetchCashInCashOutDriverDetail,
  type Agency,
  type AgencyCashInCashOutDetail,
  type Driver,
  type DriverCashInCashOutDetail,
} from "../api";
import {
  loadCashInCashOutUi,
  saveCashInCashOutUi,
  type CashInCashOutDetailTabId,
  type CashInCashOutTabId,
} from "../../cash-in-cash-out/cashInCashOutUiStorage";
import { formatAgencyLabel } from "../../../lib/agencyDisplay";

type EntityTab = CashInCashOutTabId;
type DetailTabId = CashInCashOutDetailTabId;
type SortDir = "desc" | "asc";
type DirectionFilter = "all" | "Cash in" | "Cash out";

type TxRow = {
  id: string;
  date: string | null;
  amount: number;
  direction: "Cash in" | "Cash out";
  method: string;
  notes: string;
  sortTime: number;
};

const AVATAR_COLORS = [
  "#4f46e5",
  "#0ea5a4",
  "#e5484d",
  "#f59e0b",
  "#7c3aed",
  "#0891b2",
  "#db2777",
];

function fmtCurrency(n: number) {
  return `₹${Math.abs(n).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function fmtSignedCurrency(n: number) {
  const sign = n < 0 ? "−" : n > 0 ? "+" : "";
  return `${sign}${fmtCurrency(n)}`;
}

/** Still to collect from agency against net grand total (not bulk-entry balance after advances). */
function agencyCollectRemaining(grandTotal: number, received: number): number {
  return grandTotal - received;
}

function mongoIdTime(id?: string) {
  if (!id || !/^[a-f0-9]{24}$/i.test(id)) return 0;
  return parseInt(id.slice(0, 8), 16) * 1000;
}

function sortTime(date?: string | null, id?: string) {
  if (date) {
    const t = new Date(date).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return mongoIdTime(id);
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  return x.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(d?: string | null) {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  return x.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMonth(d?: string | null) {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "—";
  return x.toLocaleString("en-IN", { month: "short", year: "numeric" });
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

function driverName(d: Driver) {
  const full = (d as { fullName?: string }).fullName?.trim();
  if (full) return full;
  return `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || "Driver";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function avatarColor(index: number) {
  return AVATAR_COLORS[Math.abs(index) % AVATAR_COLORS.length];
}

function buildAgencyTxRows(detail: AgencyCashInCashOutDetail): TxRow[] {
  const tables = detail?.tables;
  if (!tables) return [];

  const receipts = (tables.bulkReceiptPayments ?? []).map((r) => ({
    id: `in-${r._id}`,
    date: r.paymentDate,
    amount: r.amount,
    direction: "Cash in" as const,
    method: r.paymentMethod || "—",
    notes: r.notes || "",
    sortTime: sortTime(r.paymentDate, r._id),
  }));

  const profitTrips = (tables.vehicleTripsAgencyProfit ?? [])
    .filter(
      (t) =>
        String(t.status || "").toLowerCase() === "completed" &&
        Number(t.agencyProfit) > 0,
    )
    .map((t) => {
      const route = [t.from, t.to].filter(Boolean).join(" → ");
      const tripLabel = t.tripNumber ? `Trip ${t.tripNumber}` : "Vehicle trip";
      return {
        id: `profit-${t._id}`,
        date: t.date,
        amount: Number(t.agencyProfit) || 0,
        direction: "Cash out" as const,
        method: "—",
        notes: [tripLabel, route, "Agency profit"].filter(Boolean).join(" · "),
        sortTime: sortTime(t.date, t._id),
      };
    });

  const payouts = (tables.agencyProfitPayoutPayments ?? []).map((r) => ({
    id: `out-${r._id}`,
    date: r.paymentDate,
    amount: r.amount,
    direction: "Cash out" as const,
    method: r.paymentMethod || "—",
    notes: r.notes || "Profit payout",
    sortTime: sortTime(r.paymentDate, r._id),
  }));

  return [...receipts, ...profitTrips, ...payouts];
}

function buildDriverTxRows(detail: DriverCashInCashOutDetail): TxRow[] {
  const tables = detail?.tables;
  if (!tables) return [];

  const bata = (tables.salaryPayments ?? []).map((r) => ({
    id: `salary-${r._id}`,
    date: r.date,
    amount: r.amount,
    direction: "Cash out" as const,
    method: "—",
    notes: r.notes || "Salary / bata",
    sortTime: sortTime(r.date, r._id),
  }));
  const advances = (tables.advanceLedger ?? []).map((r) => ({
    id: `adv-${r._id}`,
    date: r.date,
    amount: r.amount,
    direction: "Cash in" as const,
    method: "—",
    notes: r.notes || "Advance",
    sortTime: sortTime(r.date, r._id),
  }));
  const bulk = (tables.bulkAdvancePayouts ?? []).map((r) => ({
    id: `bulk-${r._id}`,
    date: r.paymentDate,
    amount: r.amount,
    direction: "Cash out" as const,
    method: r.paymentMethod || "—",
    notes: r.notes || "Advance payout",
    sortTime: sortTime(r.paymentDate, r._id),
  }));
  return [...bata, ...advances, ...bulk];
}

function apiErrMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const ax = err as {
    code?: string;
    name?: string;
    response?: { status?: number; data?: { message?: string } };
    message?: string;
  };
  if (ax.code === "ERR_CANCELED" || ax.name === "CanceledError") return "";
  const status = ax.response?.status;
  const msg = ax.response?.data?.message?.trim();
  if (status === 404) return msg || "Record not found.";
  if (status === 403) return msg || "You don’t have access to this record.";
  if (msg) return msg;
  return fallback;
}

function inDateRange(date: string | null, from: string, to: string) {
  if (!from && !to) return true;
  if (!date) return false;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  if (from) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    if (t < start.getTime()) return false;
  }
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (t > end.getTime()) return false;
  }
  return true;
}

const fieldCls =
  "w-full rounded-[10px] border border-slate-200 bg-[var(--bg-card)] px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 dark:border-[#252c4d] dark:text-[#eef0ff]";

export function TransactionHistoryPage() {
  const savedUi = useMemo(() => loadCashInCashOutUi(), []);
  const prevAgencyIdRef = useRef<string | null>(savedUi.selectedAgencyId);
  const prevDriverIdRef = useRef<string | null>(savedUi.selectedDriverId);
  const agencyReqSeq = useRef(0);
  const driverReqSeq = useRef(0);

  const [tab, setTab] = useState<EntityTab>(savedUi.tab);
  const [listSearch, setListSearch] = useState(savedUi.listSearch);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(
    savedUi.selectedAgencyId,
  );
  const [agencyDetailTab, setAgencyDetailTab] = useState<DetailTabId>(
    savedUi.agencyDetailTab,
  );
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(
    savedUi.selectedDriverId,
  );
  const [driverDetailTab, setDriverDetailTab] = useState<DetailTabId>(
    savedUi.driverDetailTab,
  );

  const [agencyDetail, setAgencyDetail] =
    useState<AgencyCashInCashOutDetail | null>(null);
  const [driverDetail, setDriverDetail] =
    useState<DriverCashInCashOutDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMonth, setDetailMonth] = useState(savedUi.detailMonth);
  const [error, setError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [directionFilter, setDirectionFilter] =
    useState<DirectionFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadAgencies = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const { agencies: list } = await fetchAgencies(1, 300);
      setAgencies(list);
    } catch {
      setAgencies([]);
      setError("Failed to load agencies.");
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadDrivers = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const { drivers: list } = await fetchDrivers({ page: 1, limit: 300 });
      setDrivers(list ?? []);
    } catch {
      setDrivers([]);
      setError("Failed to load drivers.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "agencies") loadAgencies();
    else loadDrivers();
  }, [tab, loadAgencies, loadDrivers]);

  useEffect(() => {
    saveCashInCashOutUi({
      tab,
      selectedAgencyId,
      selectedDriverId,
      agencyDetailTab,
      driverDetailTab,
      detailMonth,
      listSearch,
    });
  }, [
    tab,
    selectedAgencyId,
    selectedDriverId,
    agencyDetailTab,
    driverDetailTab,
    detailMonth,
    listSearch,
  ]);

  useEffect(() => {
    if (listLoading || tab !== "agencies" || !selectedAgencyId) return;
    const exists = agencies.some(
      (a) => (a._id ?? a.id ?? "") === selectedAgencyId,
    );
    if (!exists) {
      setSelectedAgencyId(null);
      setAgencyDetail(null);
      setError(null);
    }
  }, [agencies, listLoading, tab, selectedAgencyId]);

  useEffect(() => {
    if (listLoading || tab !== "drivers" || !selectedDriverId) return;
    const exists = drivers.some(
      (d) => (d._id ?? d.id ?? "") === selectedDriverId,
    );
    if (!exists) {
      setSelectedDriverId(null);
      setDriverDetail(null);
      setError(null);
    }
  }, [drivers, listLoading, tab, selectedDriverId]);

  const loadAgencyDetail = useCallback(
    async (agencyId: string, month: string) => {
      const seq = ++agencyReqSeq.current;
      setDetailLoading(true);
      setError(null);
      try {
        const detail = await fetchCashInCashOutAgencyDetail(agencyId, month);
        if (seq !== agencyReqSeq.current) return;
        setAgencyDetail(detail);
      } catch (err) {
        if (seq !== agencyReqSeq.current) return;
        const msg = apiErrMessage(err, "Failed to load agency transactions.");
        if (!msg) return;
        setAgencyDetail(null);
        setError(msg);
      } finally {
        if (seq === agencyReqSeq.current) setDetailLoading(false);
      }
    },
    [],
  );

  const loadDriverDetail = useCallback(
    async (driverId: string, month: string) => {
      const seq = ++driverReqSeq.current;
      setDetailLoading(true);
      setError(null);
      try {
        const detail = await fetchCashInCashOutDriverDetail(driverId, month);
        if (seq !== driverReqSeq.current) return;
        setDriverDetail(detail);
      } catch (err) {
        if (seq !== driverReqSeq.current) return;
        const msg = apiErrMessage(err, "Failed to load driver transactions.");
        if (!msg) return;
        setDriverDetail(null);
        setError(msg);
      } finally {
        if (seq === driverReqSeq.current) setDetailLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      prevAgencyIdRef.current !== null &&
      prevAgencyIdRef.current !== selectedAgencyId
    ) {
      setAgencyDetailTab("trips");
      setError(null);
    }
    prevAgencyIdRef.current = selectedAgencyId;
  }, [selectedAgencyId]);

  useEffect(() => {
    if (
      prevDriverIdRef.current !== null &&
      prevDriverIdRef.current !== selectedDriverId
    ) {
      setDriverDetailTab("trips");
      setError(null);
    }
    prevDriverIdRef.current = selectedDriverId;
  }, [selectedDriverId]);

  // Wait until the sidebar list is loaded + selection is valid before fetching
  // detail — avoids 404/403 flashes from stale localStorage ids.
  useEffect(() => {
    if (tab !== "agencies") return;
    if (listLoading) return;
    if (!selectedAgencyId) {
      agencyReqSeq.current += 1;
      setAgencyDetail(null);
      setDetailLoading(false);
      return;
    }
    const exists = agencies.some(
      (a) => (a._id ?? a.id ?? "") === selectedAgencyId,
    );
    if (!exists) return;
    loadAgencyDetail(selectedAgencyId, detailMonth);
  }, [
    tab,
    selectedAgencyId,
    detailMonth,
    listLoading,
    agencies,
    loadAgencyDetail,
  ]);

  useEffect(() => {
    if (tab !== "drivers") return;
    if (listLoading) return;
    if (!selectedDriverId) {
      driverReqSeq.current += 1;
      setDriverDetail(null);
      setDetailLoading(false);
      return;
    }
    const exists = drivers.some(
      (d) => (d._id ?? d.id ?? "") === selectedDriverId,
    );
    if (!exists) return;
    loadDriverDetail(selectedDriverId, detailMonth);
  }, [
    tab,
    selectedDriverId,
    detailMonth,
    listLoading,
    drivers,
    loadDriverDetail,
  ]);

  const filteredAgencies = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return agencies;
    return agencies.filter((a) =>
      formatAgencyLabel(a).toLowerCase().includes(q),
    );
  }, [agencies, listSearch]);

  const filteredDrivers = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) => {
      const name = driverName(d).toLowerCase();
      const phone = String(d.phone ?? "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [drivers, listSearch]);

  const agencyCards = useMemo(() => {
    if (!agencyDetail?.summary) return null;
    const bulk = agencyDetail.summary.cashInBulk;
    const profit = agencyDetail.summary.cashOutAgencyProfit;
    if (!bulk || !profit) return null;
    const bulkTotal = Number(bulk.fromTrips) || 0;
    const vehicleOut = Number(profit.fromTrips) || 0;
    const grandTotal = bulkTotal - vehicleOut;
    const received = Number(bulk.received) || 0;
    const remaining = agencyCollectRemaining(grandTotal, received);
    return { grandTotal, received, remaining, bulkTotal, vehicleOut };
  }, [agencyDetail]);

  const driverCards = useMemo(() => {
    if (!driverDetail?.summary) return null;
    const bata = driverDetail.summary.vehicleBata;
    const bulk = driverDetail.summary.bulkAdvance;
    if (!bata || !bulk) return null;
    const bulkTrips = Number(bulk.fromTrips) || 0;
    const vehicleTrips = Number(bata.fromTrips) || 0;
    const grandTotal = bulkTrips + vehicleTrips;
    const paid = (Number(bata.paid) || 0) + (Number(bulk.paid) || 0);
    return {
      grandTotal,
      paid,
      toPay: grandTotal - paid,
    };
  }, [driverDetail]);

  const rawTxCount = useMemo(() => {
    if (tab === "agencies") {
      return agencyDetail ? buildAgencyTxRows(agencyDetail).length : 0;
    }
    return driverDetail ? buildDriverTxRows(driverDetail).length : 0;
  }, [tab, agencyDetail, driverDetail]);

  const txRows = useMemo(() => {
    const raw =
      tab === "agencies"
        ? agencyDetail
          ? buildAgencyTxRows(agencyDetail)
          : []
        : driverDetail
          ? buildDriverTxRows(driverDetail)
          : [];

    const q = tableSearch.trim().toLowerCase();
    let rows = raw.filter((r) => inDateRange(r.date, dateFrom, dateTo));
    if (directionFilter !== "all") {
      rows = rows.filter((r) => r.direction === directionFilter);
    }
    if (q) {
      rows = rows.filter((r) => {
        const hay = [
          r.amount.toString(),
          r.direction,
          r.method,
          r.notes,
          formatDate(r.date),
          formatTime(r.date),
          formatMonth(r.date),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    rows = [...rows].sort((a, b) =>
      sortDir === "desc" ? b.sortTime - a.sortTime : a.sortTime - b.sortTime,
    );
    return rows;
  }, [
    tab,
    agencyDetail,
    driverDetail,
    dateFrom,
    dateTo,
    tableSearch,
    sortDir,
    directionFilter,
  ]);

  const filterBadgeCount =
    (detailMonth !== "all_time" ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (directionFilter !== "all" ? 1 : 0);

  const hasActiveFilters =
    filterBadgeCount > 0 || !!tableSearch.trim() || sortDir !== "desc";

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setTableSearch("");
    setDirectionFilter("all");
    setDetailMonth("all_time");
    setSortDir("desc");
  };

  const hasSelection =
    tab === "agencies" ? !!selectedAgencyId : !!selectedDriverId;

  const selectedTitle =
    tab === "agencies"
      ? (() => {
          const a = agencies.find((x) => (x._id ?? x.id) === selectedAgencyId);
          return a
            ? formatAgencyLabel(a)
            : (agencyDetail?.agency.name ?? "Agency");
        })()
      : (() => {
          const d = drivers.find((x) => (x._id ?? x.id) === selectedDriverId);
          return d
            ? driverName(d)
            : (driverDetail?.driver.displayName ?? "Driver");
        })();

  const selectedSubtitle =
    tab === "agencies"
      ? agencies.find((x) => (x._id ?? x.id) === selectedAgencyId)?.phone ||
        "Agency"
      : drivers.find((x) => (x._id ?? x.id) === selectedDriverId)?.phone ||
        "Driver";

  const clearDetail = () => {
    if (tab === "agencies") setSelectedAgencyId(null);
    else setSelectedDriverId(null);
  };

  const refreshAll = () => {
    if (tab === "agencies") {
      loadAgencies();
      if (selectedAgencyId) loadAgencyDetail(selectedAgencyId, detailMonth);
    } else {
      loadDrivers();
      if (selectedDriverId) loadDriverDetail(selectedDriverId, detailMonth);
    }
  };

  const switchTab = (next: EntityTab) => {
    setTab(next);
    setListSearch("");
    setFiltersOpen(false);
    setDateFrom("");
    setDateTo("");
    setTableSearch("");
    setDirectionFilter("all");
    setSortDir("desc");
    setError(null);
    agencyReqSeq.current += 1;
    driverReqSeq.current += 1;
    setAgencyDetail(null);
    setDriverDetail(null);
  };

  const receivedPct =
    tab === "agencies" && agencyCards && agencyCards.grandTotal
      ? Math.min(
          100,
          Math.round(
            (agencyCards.received / Math.abs(agencyCards.grandTotal)) * 100,
          ),
        )
      : tab === "drivers" && driverCards && driverCards.grandTotal
        ? Math.min(
            100,
            Math.round((driverCards.paid / driverCards.grandTotal) * 100),
          )
        : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-main)]">
      {/* Top bar */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[var(--bg-card)] px-4 py-3.5 sm:px-7 dark:border-[#252c4d]">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-[#eef0ff]">
            Transaction history
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#8d94b8]">
            Every payment in and out, by agency or driver
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/transaction"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_6px_16px_-6px_#4f46e5] transition hover:-translate-y-px"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New transaction</span>
            <span className="sm:hidden">New</span>
          </Link>
          <button
            type="button"
            onClick={refreshAll}
            aria-label="Refresh"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-slate-200 bg-[var(--bg-card)] text-slate-600 transition hover:bg-indigo-50 dark:border-[#252c4d] dark:text-[#8d94b8] dark:hover:bg-[#242a57]"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-center justify-between gap-3 border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 rounded-md px-2 py-0.5 font-bold hover:bg-rose-100 dark:hover:bg-rose-500/20"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-0 p-0 sm:gap-5 sm:p-5">
        {/* Entity list */}
        <section
          className={`flex w-full shrink-0 flex-col overflow-hidden border-slate-200 bg-[var(--bg-card)] sm:w-[300px] sm:rounded-2xl sm:border lg:w-[320px] dark:border-[#252c4d] ${
            hasSelection ? "hidden sm:flex" : "flex"
          }`}
        >
          <div className="shrink-0 space-y-3 border-b border-slate-100 p-3.5 dark:border-[#252c4d]">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--bg-main)] p-1">
              {(
                [
                  ["agencies", "🏢 Agencies"],
                  ["drivers", "👤 Drivers"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchTab(id)}
                  className={`rounded-[9px] py-2 text-xs font-bold transition ${
                    tab === id
                      ? "bg-[var(--bg-card)] text-indigo-600 shadow-sm dark:text-[#a5b4fc]"
                      : "text-slate-500 hover:text-slate-800 dark:text-[#8d94b8]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-[var(--bg-main)] px-3 transition focus-within:border-indigo-500 dark:border-[#252c4d]">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder={
                  tab === "agencies" ? "Search agencies…" : "Search drivers…"
                }
                className="w-full border-0 bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400 dark:text-[#eef0ff] dark:placeholder:text-[#8d94b8]"
              />
            </label>
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
            {listLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[60px] animate-pulse rounded-[14px] bg-slate-100 dark:bg-white/5"
                />
              ))
            ) : tab === "agencies" ? (
              filteredAgencies.length === 0 ? (
                <EmptyList label="No match" hint="Try a different name." />
              ) : (
                filteredAgencies.map((a, i) => {
                  const id = a._id ?? a.id ?? "";
                  const name = formatAgencyLabel(a);
                  const phone = a.phone || "";
                  const sel = id === selectedAgencyId;
                  return (
                    <EntityRow
                      key={id}
                      name={name}
                      phone={phone}
                      kind="Agency"
                      color={avatarColor(i)}
                      selected={sel}
                      onClick={() => setSelectedAgencyId(id)}
                    />
                  );
                })
              )
            ) : filteredDrivers.length === 0 ? (
              <EmptyList label="No match" hint="Try a different name." />
            ) : (
              filteredDrivers.map((d, i) => {
                const name = driverName(d);
                const sel = d._id === selectedDriverId;
                return (
                  <EntityRow
                    key={d._id}
                    name={name}
                    phone={d.phone || ""}
                    kind="Driver"
                    color={avatarColor(i)}
                    selected={sel}
                    onClick={() => setSelectedDriverId(d._id)}
                  />
                );
              })
            )}
          </div>
        </section>

        {/* Detail pane */}
        <section
          className={`min-h-0 min-w-0 flex-1 overflow-hidden ${
            hasSelection ? "flex flex-col" : "hidden sm:flex sm:flex-col"
          }`}
        >
          {!hasSelection ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-[var(--bg-card)] p-8 text-center dark:border-[#252c4d]">
              <Wallet className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-[15px] font-bold text-slate-800 dark:text-[#eef0ff]">
                Select an {tab === "agencies" ? "agency" : "driver"}
              </p>
              <p className="max-w-xs text-xs text-slate-500 dark:text-[#8d94b8]">
                View money summary and full transaction history with filters.
              </p>
            </div>
          ) : detailLoading && !agencyDetail && !driverDetail ? (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-[var(--bg-card)] dark:border-[#252c4d]">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto sm:pr-0.5">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  className="mt-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 sm:hidden dark:hover:bg-white/5"
                  onClick={clearDetail}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <h2 className="truncate text-[22px] font-extrabold tracking-tight text-slate-900 dark:text-[#eef0ff]">
                    {selectedTitle}
                    {selectedSubtitle &&
                    selectedSubtitle !== "Agency" &&
                    selectedSubtitle !== "Driver"
                      ? ` · ${selectedSubtitle}`
                      : ""}
                  </h2>
                  <p className="text-[13px] text-slate-500 dark:text-[#8d94b8]">
                    Transaction history
                    {detailLoading ? " · Updating…" : ""}
                  </p>
                </div>
              </div>

              {/* KPIs */}
              {tab === "agencies" && agencyCards && (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <div className="rounded-[18px] bg-gradient-to-br from-indigo-900 to-violet-700 px-5 py-[18px] text-white">
                    <span className="block text-[13px] font-bold">
                      Grand total
                    </span>
                    <small className="text-xs text-white/75">
                      Bulk +{fmtCurrency(agencyCards.bulkTotal)} · Vehicle −
                      {fmtCurrency(agencyCards.vehicleOut)}
                    </small>
                    <b className="mt-2 block text-[28px] font-extrabold tracking-tight">
                      {fmtSignedCurrency(agencyCards.grandTotal)}
                    </b>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-[var(--bg-card)] px-5 py-[18px] dark:border-[#252c4d]">
                    <span className="block text-[13px] font-bold text-slate-800 dark:text-[#eef0ff]">
                      Received
                    </span>
                    <small className="text-xs text-slate-500 dark:text-[#8d94b8]">
                      Cash in
                    </small>
                    <b className="mt-2 block text-[28px] font-extrabold tracking-tight text-emerald-600 dark:text-[#34d399]">
                      {fmtCurrency(agencyCards.received)}
                    </b>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-[#252c4d]">
                      <div
                        className="h-full min-w-[3px] rounded-full bg-emerald-500"
                        style={{ width: `${receivedPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-[var(--bg-card)] px-5 py-[18px] dark:border-[#252c4d]">
                    <span className="block text-[13px] font-bold text-slate-800 dark:text-[#eef0ff]">
                      Remaining
                    </span>
                    <small className="text-xs text-slate-500 dark:text-[#8d94b8]">
                      Still to collect (grand total − received)
                    </small>
                    <b className="mt-2 block text-[28px] font-extrabold tracking-tight text-indigo-600 dark:text-[#a5b4fc]">
                      {fmtSignedCurrency(agencyCards.remaining)}
                    </b>
                  </div>
                </div>
              )}

              {tab === "drivers" && driverCards && (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <div className="rounded-[18px] bg-gradient-to-br from-indigo-900 to-violet-700 px-5 py-[18px] text-white">
                    <span className="block text-[13px] font-bold">
                      Grand total
                    </span>
                    <small className="text-xs text-white/75">
                      Bata + bulk advances from trips
                    </small>
                    <b className="mt-2 block text-[28px] font-extrabold tracking-tight">
                      {fmtCurrency(driverCards.grandTotal)}
                    </b>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-[var(--bg-card)] px-5 py-[18px] dark:border-[#252c4d]">
                    <span className="block text-[13px] font-bold dark:text-[#eef0ff]">
                      Paid
                    </span>
                    <small className="text-xs text-slate-500 dark:text-[#8d94b8]">
                      Cash out so far
                    </small>
                    <b className="mt-2 block text-[28px] font-extrabold text-emerald-600 dark:text-[#34d399]">
                      {fmtCurrency(driverCards.paid)}
                    </b>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-[#252c4d]">
                      <div
                        className="h-full min-w-[3px] rounded-full bg-emerald-500"
                        style={{ width: `${receivedPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-[var(--bg-card)] px-5 py-[18px] dark:border-[#252c4d]">
                    <span className="block text-[13px] font-bold dark:text-[#eef0ff]">
                      To pay
                    </span>
                    <small className="text-xs text-slate-500 dark:text-[#8d94b8]">
                      Still owed to driver
                    </small>
                    <b className="mt-2 block text-[28px] font-extrabold text-indigo-600 dark:text-[#a5b4fc]">
                      {fmtCurrency(driverCards.toPay)}
                    </b>
                  </div>
                </div>
              )}

              {/* Transactions card */}
              <div
                className={`overflow-hidden rounded-2xl border border-slate-200 bg-[var(--bg-card)] dark:border-[#252c4d] ${
                  detailLoading ? "opacity-70" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-2.5 px-4 py-3.5">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-[#eef0ff]">
                    Transactions
                  </h3>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-600 dark:bg-[#242a57] dark:text-[#a5b4fc]">
                    {txRows.length}
                  </span>
                  <label className="flex w-40 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-[var(--bg-main)] px-2.5 sm:w-44 dark:border-[#252c4d]">
                    <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <input
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Search…"
                      className="w-full min-w-0 border-0 bg-transparent py-2 text-sm outline-none dark:text-[#eef0ff]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setSortDir((s) => (s === "desc" ? "asc" : "desc"))
                    }
                    className="rounded-[10px] border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-[var(--bg-main)] dark:border-[#252c4d] dark:text-[#8d94b8]"
                    title="Change sort order"
                  >
                    {sortDir === "desc" ? "↓ Newest" : "↑ Oldest"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((o) => !o)}
                    aria-expanded={filtersOpen}
                    className={`inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-xs font-semibold transition ${
                      filtersOpen || filterBadgeCount
                        ? "border-indigo-500 bg-indigo-50 text-indigo-600 dark:border-indigo-400 dark:bg-[#242a57] dark:text-[#a5b4fc]"
                        : "border-slate-200 text-slate-500 hover:bg-[var(--bg-main)] dark:border-[#252c4d] dark:text-[#8d94b8]"
                    }`}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Filters
                    {filterBadgeCount > 0 && (
                      <em className="not-italic rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white">
                        {filterBadgeCount}
                      </em>
                    )}
                  </button>
                </div>

                {!filtersOpen && filterBadgeCount > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5">
                    {detailMonth !== "all_time" && (
                      <ActivePill
                        label={
                          MONTH_OPTIONS.find((o) => o.value === detailMonth)
                            ?.label || detailMonth
                        }
                        onClear={() => setDetailMonth("all_time")}
                      />
                    )}
                    {(dateFrom || dateTo) && (
                      <ActivePill
                        label={`${dateFrom || "…"} → ${dateTo || "…"}`}
                        onClear={() => {
                          setDateFrom("");
                          setDateTo("");
                        }}
                      />
                    )}
                    {directionFilter !== "all" && (
                      <ActivePill
                        label={directionFilter}
                        onClear={() => setDirectionFilter("all")}
                      />
                    )}
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="ml-1 text-xs font-bold text-indigo-600 dark:text-[#a5b4fc]"
                    >
                      Clear all
                    </button>
                  </div>
                )}

                {filtersOpen && (
                  <div className="flex flex-wrap items-center gap-2.5 border-y border-slate-200 bg-[var(--bg-main)] px-4 py-2.5 dark:border-[#252c4d]">
                    <select
                      value={detailMonth}
                      onChange={(e) => setDetailMonth(e.target.value)}
                      aria-label="Month"
                      className={fieldCls + " max-w-[180px]"}
                    >
                      {MONTH_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        aria-label="From date"
                        className={fieldCls}
                      />
                      <span>→</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        aria-label="To date"
                        className={fieldCls}
                      />
                    </div>
                    <div className="flex gap-1 rounded-xl border border-slate-200 bg-[var(--bg-card)] p-1 dark:border-[#252c4d]">
                      {(
                        [
                          ["all", "All"],
                          ["Cash in", "Cash in"],
                          ["Cash out", "Cash out"],
                        ] as const
                      ).map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setDirectionFilter(k)}
                          className={`rounded-[9px] px-3 py-1.5 text-xs font-semibold transition ${
                            directionFilter === k
                              ? "bg-[var(--bg-main)] text-indigo-600 shadow-sm dark:text-[#a5b4fc]"
                              : "text-slate-500 dark:text-[#8d94b8]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="ml-auto text-xs font-bold text-indigo-600 dark:text-[#a5b4fc]"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}

                {txRows.length === 0 ? (
                  <div className="px-4 py-11 text-center text-slate-500 dark:text-[#8d94b8]">
                    <b className="mb-1 block text-[15px] text-slate-800 dark:text-[#eef0ff]">
                      {rawTxCount
                        ? "Nothing matches these filters"
                        : "No transactions yet"}
                    </b>
                    {rawTxCount
                      ? "Clear the filters to see all entries."
                      : `Record a payment for ${selectedTitle} to see it here.`}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                      <thead>
                        <tr className="bg-[var(--bg-main)] text-left text-xs font-semibold text-slate-500 dark:text-[#8d94b8]">
                          <th className="px-[18px] py-2.5">Date</th>
                          <th className="px-[18px] py-2.5">Time</th>
                          <th className="px-[18px] py-2.5">Month</th>
                          <th className="px-[18px] py-2.5">Type</th>
                          <th className="px-[18px] py-2.5">Method</th>
                          <th className="px-[18px] py-2.5">Notes</th>
                          <th className="px-[18px] py-2.5 text-right">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {txRows.map((r) => {
                          const isIn = r.direction === "Cash in";
                          return (
                            <tr
                              key={r.id}
                              className="border-t border-slate-100 hover:bg-[var(--bg-main)] dark:border-[#252c4d]"
                            >
                              <td className="whitespace-nowrap px-[18px] py-3.5 font-medium text-slate-800 dark:text-[#eef0ff]">
                                {formatDate(r.date)}
                              </td>
                              <td className="whitespace-nowrap px-[18px] py-3.5 font-mono tabular-nums text-slate-500 dark:text-[#8d94b8]">
                                {formatTime(r.date)}
                              </td>
                              <td className="whitespace-nowrap px-[18px] py-3.5 text-slate-600 dark:text-[#8d94b8]">
                                {formatMonth(r.date)}
                              </td>
                              <td className="px-[18px] py-3.5">
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                    isIn
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-[#0d3325] dark:text-[#34d399]"
                                      : "bg-rose-50 text-rose-600 dark:bg-[#3a1a1e] dark:text-[#fda4af]"
                                  }`}
                                >
                                  {r.direction}
                                </span>
                              </td>
                              <td className="px-[18px] py-3.5 capitalize text-slate-600 dark:text-[#8d94b8]">
                                {String(r.method).replace(/_/g, " ")}
                              </td>
                              <td className="max-w-[200px] truncate px-[18px] py-3.5 text-slate-500 dark:text-[#8d94b8]">
                                {r.notes || "—"}
                              </td>
                              <td
                                className={`whitespace-nowrap px-[18px] py-3.5 text-right font-extrabold tabular-nums ${
                                  isIn
                                    ? "text-emerald-600 dark:text-[#34d399]"
                                    : "text-rose-600 dark:text-[#fda4af]"
                                }`}
                              >
                                {isIn ? "+" : "−"}
                                {fmtCurrency(r.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EntityRow({
  name,
  phone,
  kind,
  color,
  selected,
  onClick,
}: {
  name: string;
  phone: string;
  kind: string;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[14px] border p-2.5 text-left transition ${
        selected
          ? "border-indigo-500 bg-indigo-50/80 dark:border-indigo-400 dark:bg-[#242a57]"
          : "border-transparent hover:bg-[var(--bg-main)] dark:hover:bg-white/[0.04]"
      }`}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
        style={{ background: color }}
      >
        {initials(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-slate-900 dark:text-[#eef0ff]">
          {name}
          {phone ? ` · ${phone}` : ""}
        </span>
        <span className="block truncate text-xs text-slate-500 dark:text-[#8d94b8]">
          {phone || kind}
        </span>
      </span>
    </button>
  );
}

function EmptyList({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="px-4 py-10 text-center text-slate-500 dark:text-[#8d94b8]">
      <b className="mb-1 block text-[15px] text-slate-800 dark:text-[#eef0ff]">
        {label}
      </b>
      {hint}
    </div>
  );
}

function ActivePill({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-[#242a57] dark:text-[#a5b4fc]"
    >
      {label}
      <X className="h-3 w-3" />
    </button>
  );
}
