import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  Loader2,
  Plus,
  RefreshCw,
  User,
  Wallet,
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
  ActiveFilterPill,
  FilterChip,
  FilterLabel,
  SearchInput,
  SearchSortBar,
  filterControlCls,
} from "../components/FilterControls";

type EntityTab = "agencies" | "drivers";
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

function fmtCurrency(n: number) {
  return `₹${Math.abs(n).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function fmtSignedCurrency(n: number) {
  const sign = n < 0 ? "−" : n > 0 ? "+" : "";
  return `${sign}${fmtCurrency(n)}`;
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
    day: "2-digit",
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

function buildAgencyTxRows(detail: AgencyCashInCashOutDetail): TxRow[] {
  const receipts = detail.tables.bulkReceiptPayments.map((r) => ({
    id: `in-${r._id}`,
    date: r.paymentDate,
    amount: r.amount,
    direction: "Cash in" as const,
    method: r.paymentMethod || "—",
    notes: r.notes || "",
    sortTime: sortTime(r.paymentDate, r._id),
  }));

  // Vehicle-trip agency/owner profit → Cash Out only after trip is completed.
  const profitTrips = (detail.tables.vehicleTripsAgencyProfit || [])
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
        notes: [tripLabel, route, "Agency profit"]
          .filter(Boolean)
          .join(" · "),
        sortTime: sortTime(t.date, t._id),
      };
    });

  // Actual profit payouts recorded by owner.
  const payouts = detail.tables.agencyProfitPayoutPayments.map((r) => ({
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
  const bata = detail.tables.salaryPayments.map((r) => ({
    id: `salary-${r._id}`,
    date: r.date,
    amount: r.amount,
    direction: "Cash out" as const,
    method: "—",
    notes: r.notes || "Salary / bata",
    sortTime: sortTime(r.date, r._id),
  }));
  // Advances are recorded as Cash in on Transaction page (money advanced to driver).
  const advances = detail.tables.advanceLedger.map((r) => ({
    id: `adv-${r._id}`,
    date: r.date,
    amount: r.amount,
    direction: "Cash in" as const,
    method: "—",
    notes: r.notes || "Advance",
    sortTime: sortTime(r.date, r._id),
  }));
  const bulk = detail.tables.bulkAdvancePayouts.map((r) => ({
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

function SummaryCard({
  label,
  value,
  hint,
  tone = "neutral",
  signed,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "neutral" | "receive" | "pay" | "remaining";
  signed?: boolean;
}) {
  const tones = {
    neutral: "border-slate-200 bg-white",
    receive: "border-emerald-200 bg-emerald-50/70",
    pay: "border-amber-200 bg-amber-50/70",
    remaining: "border-blue-300 bg-blue-50/80 ring-1 ring-blue-100",
  };
  const valueCls =
    tone === "remaining"
      ? value >= 0
        ? "text-emerald-700"
        : "text-amber-700"
      : tone === "receive"
        ? "text-emerald-700"
        : tone === "pay"
          ? "text-amber-700"
          : "text-slate-900";

  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {hint && (
        <p className="mt-0.5 text-[10px] font-medium text-slate-400">{hint}</p>
      )}
      <p className={`mt-2 text-xl font-bold tabular-nums sm:text-2xl ${valueCls}`}>
        {signed ? fmtSignedCurrency(value) : fmtCurrency(value)}
      </p>
    </div>
  );
}

export function TransactionHistoryPage() {
  const [tab, setTab] = useState<EntityTab>("agencies");
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listSearch, setListSearch] = useState("");
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [agencyDetail, setAgencyDetail] =
    useState<AgencyCashInCashOutDetail | null>(null);
  const [driverDetail, setDriverDetail] =
    useState<DriverCashInCashOutDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [month, setMonth] = useState("all_time");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [directionFilter, setDirectionFilter] =
    useState<DirectionFilter>("all");
  const [error, setError] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const [a, d] = await Promise.all([
        fetchAgencies(1, 200),
        fetchDrivers({ page: 1, limit: 200, blockFilter: "unblocked" }),
      ]);
      setAgencies(a.agencies);
      setDrivers(d.drivers);
    } catch {
      setError("Failed to load list.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const loadAgencyDetail = useCallback(async (id: string, m: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await fetchCashInCashOutAgencyDetail(
        id,
        m === "all_time" ? undefined : m,
      );
      setAgencyDetail(detail);
    } catch {
      setAgencyDetail(null);
      setError("Failed to load agency transactions.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadDriverDetail = useCallback(async (id: string, m: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await fetchCashInCashOutDriverDetail(
        id,
        m === "all_time" ? undefined : m,
      );
      setDriverDetail(detail);
    } catch {
      setDriverDetail(null);
      setError("Failed to load driver transactions.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "agencies" && selectedAgencyId) {
      loadAgencyDetail(selectedAgencyId, month);
    }
  }, [tab, selectedAgencyId, month, loadAgencyDetail]);

  useEffect(() => {
    if (tab === "drivers" && selectedDriverId) {
      loadDriverDetail(selectedDriverId, month);
    }
  }, [tab, selectedDriverId, month, loadDriverDetail]);

  const filteredAgencies = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return agencies;
    return agencies.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        String(a.phone ?? "")
          .toLowerCase()
          .includes(q),
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
    if (!agencyDetail) return null;
    // Bulk: Grand Total (not Balance / not GT−Advance).
    // Remaining = Grand Total − Received − vehicle profit still to pay.
    //   Cash In lowers Remaining; vehicle agency profit also lowers Remaining.
    const bulk = agencyDetail.summary.cashInBulk;
    const profit = agencyDetail.summary.cashOutAgencyProfit;
    const grandTotal = Math.max(Number(bulk.totalOwed) || 0, 0);
    const received = Math.max(Number(bulk.received) || 0, 0);
    const profitStillToPay = Math.max(Number(profit.remaining) || 0, 0);
    const remaining = grandTotal - received - profitStillToPay;
    return {
      grandTotal,
      received,
      remaining,
    };
  }, [agencyDetail]);

  const driverCards = useMemo(() => {
    if (!driverDetail) return null;
    const grandTotal =
      driverDetail.summary.vehicleBata.totalOwed +
      driverDetail.summary.bulkAdvance.totalOwed;
    const toPay =
      driverDetail.summary.vehicleBata.remaining +
      driverDetail.summary.bulkAdvance.remaining;
    return { grandTotal, toPay };
  }, [driverDetail]);

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

  const hasActiveFilters =
    !!dateFrom ||
    !!dateTo ||
    !!tableSearch.trim() ||
    directionFilter !== "all" ||
    month !== "all_time";

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setTableSearch("");
    setDirectionFilter("all");
    setMonth("all_time");
    setSortDir("desc");
  };

  const hasSelection =
    tab === "agencies" ? !!selectedAgencyId : !!selectedDriverId;

  const selectedTitle =
    tab === "agencies"
      ? agencies.find((a) => (a._id ?? a.id) === selectedAgencyId)?.name ??
        agencyDetail?.agency.name ??
        "Agency"
      : (() => {
          const d = drivers.find((x) => x._id === selectedDriverId);
          return d
            ? driverName(d)
            : driverDetail?.driver.displayName ?? "Driver";
        })();

  const clearDetail = () => {
    setSelectedAgencyId(null);
    setSelectedDriverId(null);
    setAgencyDetail(null);
    setDriverDetail(null);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      {/* Top bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4">
        <div
          className="grid h-10 w-full min-w-0 flex-1 grid-cols-2 rounded-full border border-slate-200 bg-slate-100 p-1 sm:max-w-sm"
          role="tablist"
        >
          {(
            [
              ["agencies", "Agencies", Building2],
              ["drivers", "Drivers", User],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`flex h-full min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-semibold transition sm:text-sm ${
                tab === id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-transparent text-slate-500 hover:text-slate-700"
              }`}
              onClick={() => {
                setTab(id);
                clearDetail();
              }}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/transaction"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 sm:h-9 sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Transaction</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              loadLists();
              if (selectedAgencyId) loadAgencyDetail(selectedAgencyId, month);
              if (selectedDriverId) loadDriverDetail(selectedDriverId, month);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 sm:h-9 sm:w-9"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar list */}
        <div
          className={`flex w-full shrink-0 flex-col border-r border-slate-200 bg-white sm:w-64 md:w-72 lg:w-80 ${
            hasSelection ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="border-b border-slate-100 px-3 py-3 sm:px-4">
            <SearchInput
              value={listSearch}
              onChange={setListSearch}
              placeholder={
                tab === "agencies"
                  ? "Search agencies…"
                  : "Search drivers…"
              }
              resultCount={
                tab === "agencies"
                  ? filteredAgencies.length
                  : filteredDrivers.length
              }
              size="sm"
            />
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
            {listLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[4.5rem] animate-pulse rounded-xl bg-slate-100"
                />
              ))
            ) : tab === "agencies" ? (
              filteredAgencies.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-400">
                  No agencies
                </p>
              ) : (
                filteredAgencies.map((a) => {
                  const id = a._id ?? a.id ?? "";
                  const sel = id === selectedAgencyId;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setSelectedAgencyId(id);
                        setSelectedDriverId(null);
                        setDriverDetail(null);
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        sel
                          ? "border-blue-400 bg-blue-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {a.name}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {a.phone || "Agency"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )
            ) : filteredDrivers.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">No drivers</p>
            ) : (
              filteredDrivers.map((d) => {
                const sel = d._id === selectedDriverId;
                return (
                  <button
                    key={d._id}
                    type="button"
                    onClick={() => {
                      setSelectedDriverId(d._id);
                      setSelectedAgencyId(null);
                      setAgencyDetail(null);
                    }}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      sel
                        ? "border-blue-400 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                        <User className="h-5 w-5 text-violet-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {driverName(d)}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {d.phone || "Driver"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail pane */}
        <div
          className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
            hasSelection ? "flex" : "hidden md:flex"
          }`}
        >
          {!hasSelection ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Wallet className="h-7 w-7" />
              </div>
              <p className="text-sm font-medium text-slate-600">
                Select an {tab === "agencies" ? "agency" : "driver"}
              </p>
              <p className="max-w-xs text-xs text-slate-400">
                View money summary and full transaction history with filters.
              </p>
            </div>
          ) : detailLoading && !agencyDetail && !driverDetail ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {/* Header + summary */}
              <div className="shrink-0 space-y-3 border-b border-slate-200 bg-white px-3 py-3 sm:px-4 sm:py-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
                    onClick={clearDetail}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                      {selectedTitle}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Transaction history
                      {detailLoading ? " · Updating…" : ""}
                    </p>
                  </div>
                </div>

                {tab === "agencies" && agencyCards && (
                  <div className="grid grid-cols-3 gap-2">
                    <SummaryCard
                      label="Grand Total"
                      value={agencyCards.grandTotal}
                      hint="Bulk trips"
                    />
                    <SummaryCard
                      label="Received"
                      value={agencyCards.received}
                      hint="Cash In"
                      tone="receive"
                    />
                    <SummaryCard
                      label="Remaining"
                      value={agencyCards.remaining}
                      hint="Grand Total − Received − vehicle profit due"
                      tone="remaining"
                      signed
                    />
                  </div>
                )}

                {tab === "drivers" && driverCards && (
                  <div className="grid grid-cols-2 gap-2 sm:max-w-md">
                    <SummaryCard
                      label="Grand Total"
                      value={driverCards.grandTotal}
                    />
                    <SummaryCard
                      label="To Pay"
                      value={driverCards.toPay}
                      hint="Still to pay driver"
                      tone="remaining"
                    />
                  </div>
                )}

                {/* Filters */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3">
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      <CalendarRange className="h-3.5 w-3.5" />
                      Search & filters
                    </div>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Reset all
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <SearchSortBar
                      search={tableSearch}
                      onSearchChange={setTableSearch}
                      searchPlaceholder="Search amount, date, month, notes…"
                      resultCount={txRows.length}
                      sort={sortDir}
                      onSortChange={setSortDir}
                    />

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div>
                        <FilterLabel>Month</FilterLabel>
                        <select
                          value={month}
                          onChange={(e) => setMonth(e.target.value)}
                          className={filterControlCls}
                        >
                          {MONTH_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <FilterLabel>From date</FilterLabel>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className={filterControlCls}
                        />
                      </div>
                      <div>
                        <FilterLabel>To date</FilterLabel>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className={filterControlCls}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Type
                      </span>
                      <FilterChip
                        active={directionFilter === "all"}
                        onClick={() => setDirectionFilter("all")}
                      >
                        All
                      </FilterChip>
                      <FilterChip
                        active={directionFilter === "Cash in"}
                        onClick={() => setDirectionFilter("Cash in")}
                        tone="in"
                      >
                        Cash In
                      </FilterChip>
                      <FilterChip
                        active={directionFilter === "Cash out"}
                        onClick={() => setDirectionFilter("Cash out")}
                        tone="out"
                      >
                        Cash Out
                      </FilterChip>
                    </div>

                    {hasActiveFilters && (
                      <div className="flex flex-wrap gap-1.5 border-t border-slate-200/80 pt-2.5">
                        {month !== "all_time" && (
                          <ActiveFilterPill
                            label={
                              MONTH_OPTIONS.find((o) => o.value === month)
                                ?.label || month
                            }
                            onClear={() => setMonth("all_time")}
                          />
                        )}
                        {dateFrom && (
                          <ActiveFilterPill
                            label={`From ${dateFrom}`}
                            onClear={() => setDateFrom("")}
                          />
                        )}
                        {dateTo && (
                          <ActiveFilterPill
                            label={`To ${dateTo}`}
                            onClear={() => setDateTo("")}
                          />
                        )}
                        {directionFilter !== "all" && (
                          <ActiveFilterPill
                            label={directionFilter}
                            onClear={() => setDirectionFilter("all")}
                          />
                        )}
                        {tableSearch.trim() && (
                          <ActiveFilterPill
                            label={`“${tableSearch.trim()}”`}
                            onClear={() => setTableSearch("")}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div
                className={`min-h-0 flex-1 overflow-auto p-3 sm:p-4 ${
                  detailLoading ? "opacity-60" : ""
                }`}
              >
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2.5 sm:px-4">
                    <h4 className="text-xs font-semibold text-slate-800 sm:text-sm">
                      Transactions
                    </h4>
                    <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {txRows.length}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-xs">
                      <thead className="border-b border-slate-100 bg-white text-[10px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2.5 font-semibold sm:px-4">
                            Date
                          </th>
                          <th className="px-3 py-2.5 font-semibold">Time</th>
                          <th className="px-3 py-2.5 font-semibold">Month</th>
                          <th className="px-3 py-2.5 font-semibold">Type</th>
                          <th className="px-3 py-2.5 font-semibold">Method</th>
                          <th className="px-3 py-2.5 font-semibold">Notes</th>
                          <th className="px-3 py-2.5 text-right font-semibold sm:px-4">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {txRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-3 py-12 text-center text-slate-400"
                            >
                              No transactions for these filters
                            </td>
                          </tr>
                        ) : (
                          txRows.map((r) => (
                            <tr
                              key={r.id}
                              className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                            >
                              <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-700 sm:px-4">
                                {formatDate(r.date)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                                {formatTime(r.date)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                                {formatMonth(r.date)}
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    r.direction === "Cash in"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {r.direction}
                                </span>
                              </td>
                              <td className="px-3 py-3 capitalize text-slate-600">
                                {String(r.method).replace(/_/g, " ")}
                              </td>
                              <td className="max-w-[200px] truncate px-3 py-3 text-slate-500">
                                {r.notes || "—"}
                              </td>
                              <td
                                className={`whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums sm:px-4 ${
                                  r.direction === "Cash in"
                                    ? "text-emerald-700"
                                    : "text-amber-700"
                                }`}
                              >
                                {fmtCurrency(r.amount)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
