import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2,
  RefreshCw,
  Building2,
  Users,
  Search,
  ArrowLeft,
  X,
  UserCircle,
} from "lucide-react";
import {
  fetchCashInCashOutAgencyDetail,
  fetchCashInCashOutDriverDetail,
  recordAgencyProfitPayout,
  type AgencyCashInCashOutDetail,
  type DriverCashInCashOutDetail,
} from "../api";
import { fetchAgencies, addAgencyPayoutPayment, addDriverPayoutPayment, type Agency } from "../../bulk-entry/api";
import { formatAgencyLabel, resolveAgencyLabelFromName } from "../../../lib/agencyDisplay";
import { fetchDrivers, createSalaryTransaction, type Driver } from "../../drivers/api";
import {
  loadCashInCashOutUi,
  saveCashInCashOutUi,
  type CashInCashOutDetailTabId,
  type CashInCashOutTabId,
} from "../cashInCashOutUiStorage";

function fmtCurrency(v: number): string {
  return `₹${Math.abs(v).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtSignedCurrency(v: number): string {
  if (v < 0) return `-${fmtCurrency(v)}`;
  return fmtCurrency(v);
}

const MONEY_EPS = 0.01;

function moneyEq(a: number, b: number): boolean {
  return Math.abs(a - b) < MONEY_EPS;
}

function sumMoney(values: number[]): number {
  const n = values.reduce((s, v) => s + (Number(v) || 0), 0);
  return Math.round(n * 100) / 100;
}

/** Client-side checks: summary cards must match filtered table totals. */
function verifyAgencyCashMath(detail: AgencyCashInCashOutDetail): string[] {
  const issues: string[] = [];
  const bulkTable = sumMoney(
    detail.tables.bulkTripsCashIn.map((r) => r.grandTotal),
  );
  const vehicleTable = sumMoney(
    detail.tables.vehicleTripsAgencyProfit.map((r) => r.agencyProfit),
  );
  const receiptsTable = sumMoney(
    detail.tables.bulkReceiptPayments.map((r) => r.amount),
  );
  const payoutsTable = sumMoney(
    detail.tables.agencyProfitPayoutPayments.map((r) => r.amount),
  );

  if (!moneyEq(bulkTable, detail.summary.cashInBulk.fromTrips)) {
    issues.push(
      `Bulk card (₹${detail.summary.cashInBulk.fromTrips}) ≠ sum of bulk trip Cash in column (₹${bulkTable}).`,
    );
  }
  if (!moneyEq(vehicleTable, detail.summary.cashOutAgencyProfit.fromTrips)) {
    issues.push(
      `Vehicle card (₹${detail.summary.cashOutAgencyProfit.fromTrips}) ≠ sum of vehicle trip Cash out column (₹${vehicleTable}).`,
    );
  }
  if (!moneyEq(receiptsTable, detail.summary.cashInBulk.received)) {
    issues.push("Cash in received does not match cash history receipts total.");
  }
  if (!moneyEq(payoutsTable, detail.summary.cashOutAgencyProfit.paid)) {
    issues.push("Cash out paid does not match cash history payouts total.");
  }
  const bulkRemainingCalc = sumMoney([
    detail.summary.cashInBulk.totalOwed,
    -detail.summary.cashInBulk.received,
  ]);
  if (!moneyEq(bulkRemainingCalc, detail.summary.cashInBulk.remaining)) {
    issues.push("Bulk remaining ≠ total owed − received.");
  }
  const vehicleRemainingCalc = sumMoney([
    detail.summary.cashOutAgencyProfit.totalOwed,
    -detail.summary.cashOutAgencyProfit.paid,
  ]);
  if (!moneyEq(vehicleRemainingCalc, detail.summary.cashOutAgencyProfit.remaining)) {
    issues.push("Vehicle remaining ≠ total owed − paid.");
  }
  const netCard = agencyTotalRemaining(detail);
  const netCalc = sumMoney([
    detail.summary.cashInBulk.remaining,
    -detail.summary.cashOutAgencyProfit.remaining,
  ]);
  if (!moneyEq(netCard, netCalc)) {
    issues.push("Net remaining card does not match bulk remaining − vehicle remaining.");
  }
  return issues;
}

function verifyDriverCashMath(detail: DriverCashInCashOutDetail): string[] {
  const issues: string[] = [];
  const vehicleTable = sumMoney(
    detail.tables.vehicleTrips.map((r) => r.driverSalary),
  );
  const bulkTable = sumMoney(
    detail.tables.bulkTripsAdvance.map((r) => r.advancePaid),
  );
  const salaryTable = sumMoney(
    detail.tables.salaryPayments.map((r) => r.amount),
  );
  const advanceTable = sumMoney(
    detail.tables.advanceLedger.map((r) => r.amount),
  );
  const bulkPayTable = sumMoney(
    detail.tables.bulkAdvancePayouts.map((r) => r.amount),
  );

  if (!moneyEq(vehicleTable, detail.summary.vehicleBata.fromTrips)) {
    issues.push(
      `Vehicle card (₹${detail.summary.vehicleBata.fromTrips}) ≠ sum of vehicle trip Cash out column (₹${vehicleTable}).`,
    );
  }
  if (!moneyEq(bulkTable, detail.summary.bulkAdvance.fromTrips)) {
    issues.push(
      `Bulk card (₹${detail.summary.bulkAdvance.fromTrips}) ≠ sum of bulk trip Cash out column (₹${bulkTable}).`,
    );
  }
  if (!moneyEq(salaryTable, detail.summary.vehicleBata.paid)) {
    issues.push("Bata paid does not match salary payment rows.");
  }
  if (!moneyEq(bulkPayTable, detail.summary.bulkAdvance.paid)) {
    issues.push("Bulk advance paid does not match bulk payout rows.");
  }
  const bataRemainingCalc = sumMoney([
    detail.summary.vehicleBata.totalOwed,
    -advanceTable,
    -detail.summary.vehicleBata.paid,
  ]);
  const bataRemainingClamped = Math.max(bataRemainingCalc, 0);
  if (!moneyEq(bataRemainingClamped, detail.summary.vehicleBata.remaining)) {
    issues.push(
      "Bata remaining ≠ trip bata + manual extra − advances − salary paid (clamped at 0).",
    );
  }
  const bulkRemainingCalc = sumMoney([
    detail.summary.bulkAdvance.totalOwed,
    -detail.summary.bulkAdvance.paid,
  ]);
  const bulkRemainingClamped = Math.max(bulkRemainingCalc, 0);
  if (!moneyEq(bulkRemainingClamped, detail.summary.bulkAdvance.remaining)) {
    issues.push("Bulk advance remaining ≠ total owed − paid (clamped at 0).");
  }
  const totalRemainingCalc = sumMoney([
    detail.summary.vehicleBata.remaining,
    detail.summary.bulkAdvance.remaining,
  ]);
  if (!moneyEq(totalRemainingCalc, driverTotalRemaining(detail))) {
    issues.push(
      "Total remaining to pay ≠ bata remaining + bulk advance remaining.",
    );
  }
  return issues;
}

/** Bulk remaining (to receive) minus vehicle remaining (to pay). */
function agencyTotalRemaining(detail: AgencyCashInCashOutDetail): number {
  return (
    detail.summary.cashInBulk.remaining -
    detail.summary.cashOutAgencyProfit.remaining
  );
}

/** Trip bata + bulk advance still owed to the driver (cash out). */
function driverTotalRemaining(detail: DriverCashInCashOutDetail): number {
  return (
    detail.summary.vehicleBata.remaining +
    detail.summary.bulkAdvance.remaining
  );
}

type EntitySummaryMetrics = {
  moneyGiven: number;
  moneyGot: number;
  bulkTrips: number;
  vehicleTrips: number;
  remainingToGet: number;
};

function buildAgencySummaryMetrics(
  detail: AgencyCashInCashOutDetail,
): EntitySummaryMetrics {
  return {
    moneyGiven: 0,
    moneyGot: 0,
    bulkTrips: detail.summary.cashInBulk.fromTrips,
    vehicleTrips: detail.summary.cashOutAgencyProfit.fromTrips,
    remainingToGet: agencyTotalRemaining(detail),
  };
}

function buildDriverSummaryMetrics(
  detail: DriverCashInCashOutDetail,
): EntitySummaryMetrics {
  return {
    moneyGiven:
      detail.summary.vehicleBata.paid + detail.summary.bulkAdvance.paid,
    moneyGot: 0,
    bulkTrips: detail.summary.bulkAdvance.fromTrips,
    vehicleTrips: detail.summary.vehicleBata.fromTrips,
    remainingToGet: driverTotalRemaining(detail),
  };
}

function EntitySummaryCards({
  metrics,
  entity = "agency",
}: {
  metrics: EntitySummaryMetrics;
  entity?: "agency" | "driver";
}) {
  const cards: { label: string; value: number; highlight?: boolean }[] =
    entity === "driver"
      ? [
          { label: "Total from bulk trips", value: metrics.bulkTrips },
          { label: "Total from vehicle trips", value: metrics.vehicleTrips },
          {
            label: "Total remaining to pay",
            value: metrics.remainingToGet,
            highlight: true,
          },
        ]
      : [
          { label: "Total from bulk trips", value: metrics.bulkTrips },
          { label: "Total from vehicle trips", value: metrics.vehicleTrips },
          {
            label: "Total remaining to get",
            value: metrics.remainingToGet,
            highlight: true,
          },
        ];

  const gridCls =
    entity === "driver"
      ? "mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-2 lg:grid-cols-3 xl:grid-cols-3"
      : "mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-2 lg:grid-cols-3 xl:grid-cols-3";

  return (
    <div className={gridCls}>
      {cards.map((c) => {
        const isRemaining = c.highlight;
        const remainingPositive = c.value >= 0;
        const valueCls = isRemaining
          ? remainingPositive
            ? "text-emerald-700"
            : "text-amber-700"
          : "text-slate-900";
        const displayAmount = isRemaining
          ? fmtSignedCurrency(c.value)
          : fmtCurrency(c.value);

        return (
          <div
            key={c.label}
            className={`rounded-xl border p-3 text-xs sm:p-4 sm:text-sm ${
              isRemaining
                ? "border-blue-300 bg-blue-50/80 ring-1 ring-blue-100"
                : "border-slate-200 bg-slate-50/80"
            }`}
          >
            <p className="min-w-0 font-semibold leading-snug text-slate-900">
              {c.label}
            </p>
            {isRemaining && (
              <p className="mt-0.5 text-[10px] font-medium text-slate-500 sm:text-xs">
                {entity === "driver"
                  ? remainingPositive
                    ? "Still to pay driver"
                    : "Driver owes (net)"
                  : remainingPositive
                    ? "Net to collect"
                    : "Net to pay"}
              </p>
            )}
            <p
              className={`mt-2 text-xl font-bold tabular-nums sm:text-2xl ${valueCls}`}
            >
              {displayAmount}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function pickAgencyIdForDriverBulkPayout(
  detail: DriverCashInCashOutDetail,
  agencies: Agency[],
): string {
  const rows = detail.tables.bulkTripsAdvance.filter((r) => r.agencyId);
  if (rows.length > 0) {
    const counts = new Map<string, number>();
    for (const r of rows) {
      counts.set(r.agencyId, (counts.get(r.agencyId) ?? 0) + 1);
    }
    let best = rows[0].agencyId;
    let max = 0;
    for (const [id, c] of counts) {
      if (c > max) {
        max = c;
        best = id;
      }
    }
    return best;
  }
  const first = agencies[0];
  return first?._id ?? first?.id ?? "";
}

function formatDate(d?: string | Date | null): string {
  if (d == null || d === "") return "—";
  try {
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return "—";
    return x.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function cashInCashOutMonthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [
    { value: "all_time", label: "All time" },
  ];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-IN", { month: "long", year: "numeric" });
    opts.push({ value, label });
  }
  return opts;
}

const MONTH_OPTIONS = cashInCashOutMonthOptions();

function DetailMonthFilter({
  month,
  setMonth,
  monthLabel,
}: {
  month: string;
  setMonth: (m: string) => void;
  monthLabel?: string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="cash-detail-month">
        Month
      </label>
      <select
        id="cash-detail-month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="min-h-[36px] max-w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 sm:text-sm"
      >
        {MONTH_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {monthLabel && month !== "all_time" && (
        <span className="text-[11px] text-slate-500 sm:text-xs">{monthLabel}</span>
      )}
    </div>
  );
}

type TabId = CashInCashOutTabId;
type DetailTabId = CashInCashOutDetailTabId;

function mongoObjectIdSortTime(id?: string): number {
  if (!id || !/^[a-f0-9]{24}$/i.test(id)) return 0;
  return parseInt(id.slice(0, 8), 16) * 1000;
}

/** Latest-first sort key: row date, else Mongo record time from _id. */
function cashInCashOutSortTime(
  date?: string | Date | null,
  recordId?: string,
): number {
  if (date != null && date !== "") {
    const t = new Date(date).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return mongoObjectIdSortTime(recordId);
}

function compareCashInCashOutLatestFirst(
  a: { sortDate: number; sortId: string },
  b: { sortDate: number; sortId: string },
): number {
  if (b.sortDate !== a.sortDate) return b.sortDate - a.sortDate;
  return b.sortId.localeCompare(a.sortId);
}

type AgencyUnifiedTripRow = {
  id: string;
  source: "Bulk" | "Vehicle";
  date: string | null;
  reference: string;
  details: string;
  cashIn: number | null;
  cashOut: number | null;
  advance: number | null;
  status: string;
};

type CashDirection = "Cash in" | "Cash out";

type AgencyUnifiedCashRow = {
  id: string;
  direction: CashDirection;
  date: string | null;
  amount: number;
  method: string;
  notes: string;
};

function buildAgencyUnifiedTrips(
  detail: AgencyCashInCashOutDetail,
): AgencyUnifiedTripRow[] {
  const bulk: Array<AgencyUnifiedTripRow & { sortDate: number; sortId: string }> =
    detail.tables.bulkTripsCashIn.map((r) => ({
    id: `bulk-${r._id}`,
    source: "Bulk" as const,
    date: r.date,
    reference: r.vehicleNumber || "—",
    details: r.driverName || "—",
    cashIn: r.grandTotal,
    cashOut: null,
    advance: r.advancePaid,
    status: r.status,
    sortDate: cashInCashOutSortTime(r.date, r._id),
    sortId: r._id,
  }));
  const vehicle: Array<AgencyUnifiedTripRow & { sortDate: number; sortId: string }> =
    detail.tables.vehicleTripsAgencyProfit.map((r) => ({
    id: `vehicle-${r._id}`,
    source: "Vehicle" as const,
    date: r.date,
    reference: r.tripNumber || "—",
    details: [r.from, r.to].filter(Boolean).join(" → ") || "—",
    cashIn: null,
    cashOut: r.agencyProfit,
    advance: null,
    status: r.status,
    sortDate: cashInCashOutSortTime(r.date, r._id),
    sortId: r._id,
  }));
  return [...bulk, ...vehicle]
    .sort(compareCashInCashOutLatestFirst)
    .map(({ sortDate: _s, sortId: _id, ...row }) => row);
}

function buildAgencyUnifiedCashHistory(
  detail: AgencyCashInCashOutDetail,
): AgencyUnifiedCashRow[] {
  const receipts = detail.tables.bulkReceiptPayments.map((r) => ({
    id: `in-${r._id}`,
    direction: "Cash in" as const,
    date: r.paymentDate,
    amount: r.amount,
    method: r.paymentMethod,
    notes: r.notes,
    sortDate: cashInCashOutSortTime(r.paymentDate, r._id),
    sortId: r._id,
  }));
  const payouts = detail.tables.agencyProfitPayoutPayments.map((r) => ({
    id: `out-${r._id}`,
    direction: "Cash out" as const,
    date: r.paymentDate,
    amount: r.amount,
    method: r.paymentMethod,
    notes: r.notes,
    sortDate: cashInCashOutSortTime(r.paymentDate, r._id),
    sortId: r._id,
  }));

  return [...receipts, ...payouts]
    .sort(compareCashInCashOutLatestFirst)
    .map(({ sortDate: _s, sortId: _id, ...row }) => row);
}

function sourceBadgeCls(source: "Bulk" | "Vehicle") {
  return source === "Bulk"
    ? "bg-emerald-100 text-emerald-800"
    : "bg-blue-100 text-blue-800";
}

function directionBadgeCls(direction: CashDirection) {
  return direction === "Cash in"
    ? "bg-emerald-100 text-emerald-800"
    : "bg-amber-100 text-amber-800";
}

function cashAmountCls(direction: CashDirection) {
  return direction === "Cash in" ? "text-emerald-700" : "text-amber-700";
}

type DriverUnifiedTripRow = {
  id: string;
  source: "Bulk" | "Vehicle";
  date: string | null;
  reference: string;
  details: string;
  cashOut: number;
  grandTotal: number | null;
  status: string;
};

type DriverUnifiedCashRow = {
  id: string;
  direction: CashDirection;
  kind: string;
  date: string | null;
  amount: number;
  method: string;
  notes: string;
};

function driverCashKindBadgeCls(kind: string) {
  if (kind === "Advance") return "bg-violet-100 text-violet-800";
  if (kind === "Bulk advance") return "bg-amber-100 text-amber-800";
  return "bg-amber-100 text-amber-800";
}

function buildDriverUnifiedTrips(
  detail: DriverCashInCashOutDetail,
  resolveAgencyLabel?: (agencyName?: string) => string,
): DriverUnifiedTripRow[] {
  const vehicle: Array<DriverUnifiedTripRow & { sortDate: number; sortId: string }> =
    detail.tables.vehicleTrips.map((r) => ({
    id: `vehicle-${r._id}`,
    source: "Vehicle" as const,
    date: r.date,
    reference: r.tripNumber || "—",
    details: [r.from, r.to].filter(Boolean).join(" → ") || "—",
    cashOut: r.driverSalary,
    grandTotal: null,
    status: r.status,
    sortDate: cashInCashOutSortTime(r.date, r._id),
    sortId: r._id,
  }));
  const bulk: Array<DriverUnifiedTripRow & { sortDate: number; sortId: string }> =
    detail.tables.bulkTripsAdvance.map((r) => ({
    id: `bulk-${r._id}`,
    source: "Bulk" as const,
    date: r.date,
    reference: r.vehicleNumber || "—",
    details: resolveAgencyLabel
      ? resolveAgencyLabel(r.agencyName)
      : r.agencyName || "—",
    cashOut: r.advancePaid,
    grandTotal: r.grandTotal,
    status: r.status,
    sortDate: cashInCashOutSortTime(r.date, r._id),
    sortId: r._id,
  }));
  return [...vehicle, ...bulk]
    .sort(compareCashInCashOutLatestFirst)
    .map(({ sortDate: _s, sortId: _id, ...row }) => row);
}

function buildDriverUnifiedCashHistory(
  detail: DriverCashInCashOutDetail,
): DriverUnifiedCashRow[] {
  const bata = detail.tables.salaryPayments.map((r) => ({
    id: `salary-${r._id}`,
    direction: "Cash out" as const,
    kind: "Bata (salary)",
    date: r.date,
    amount: r.amount,
    method: "—",
    notes: r.notes,
    sortDate: cashInCashOutSortTime(r.date, r._id),
    sortId: r._id,
  }));
  const advances = detail.tables.advanceLedger.map((r) => ({
    id: `advance-${r._id}`,
    direction: "Cash out" as const,
    kind: "Advance",
    date: r.date,
    amount: r.amount,
    method: "—",
    notes: r.notes,
    sortDate: cashInCashOutSortTime(r.date, r._id),
    sortId: r._id,
  }));
  const bulkPayouts = detail.tables.bulkAdvancePayouts.map((r) => ({
    id: `bulkpay-${r._id}`,
    direction: "Cash out" as const,
    kind: "Bulk advance",
    date: r.paymentDate,
    amount: r.amount,
    method: r.paymentMethod,
    notes: r.notes,
    sortDate: cashInCashOutSortTime(r.paymentDate, r._id),
    sortId: r._id,
  }));

  return [...advances, ...bata, ...bulkPayouts]
    .sort(compareCashInCashOutLatestFirst)
    .map(({ sortDate: _s, sortId: _id, ...row }) => row);
}

const PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "cheque",
  "online",
  "upi",
  "other",
] as const;

function TabBar({ tab, setTab }: { tab: TabId; setTab: (t: TabId) => void }) {
  const tabBtn =
    "flex min-h-[40px] min-w-0 flex-1 touch-manipulation items-center justify-center rounded-lg px-2 py-2.5 text-center text-xs font-semibold sm:min-h-0 sm:py-2 sm:text-sm";

  return (
    <div
      className="flex h-11 w-full min-w-0 flex-1 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 sm:h-10 sm:max-w-md"
      role="tablist"
    >
      <button
        type="button"
        role="tab"
        aria-selected={tab === "agencies"}
        className={`${tabBtn} ${
          tab === "agencies"
            ? "bg-blue-500 text-white shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
        onClick={() => setTab("agencies")}
      >
        <span className="inline-flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          Agencies
        </span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "drivers"}
        className={`${tabBtn} ${
          tab === "drivers"
            ? "bg-blue-500 text-white shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
        onClick={() => setTab("drivers")}
      >
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 shrink-0" />
          Drivers
        </span>
      </button>
    </div>
  );
}

function EntityDetailTabBar({
  tab,
  setTab,
}: {
  tab: DetailTabId;
  setTab: (t: DetailTabId) => void;
}) {
  const tabBtn =
    "flex min-h-[40px] min-w-0 flex-1 touch-manipulation items-center justify-center rounded-lg px-2 py-2.5 text-center text-xs font-semibold sm:min-h-0 sm:py-2 sm:text-sm";

  return (
    <div
      className="grid h-11 w-full min-w-0 shrink-0 grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 sm:h-10 sm:w-full sm:max-w-sm"
      role="tablist"
    >
      <button
        type="button"
        role="tab"
        aria-selected={tab === "trips"}
        className={`${tabBtn} ${
          tab === "trips"
            ? "bg-blue-500 text-white shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
        onClick={() => setTab("trips")}
      >
        Trips
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "cashHistory"}
        className={`${tabBtn} ${
          tab === "cashHistory"
            ? "bg-blue-500 text-white shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
        onClick={() => setTab("cashHistory")}
      >
        Cash History
      </button>
    </div>
  );
}

function TableShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white sm:mb-4">
      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2.5 sm:px-4 sm:py-2">
        <h4 className="text-xs font-semibold text-slate-800 sm:text-sm">{title}</h4>
      </div>
      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        {children}
      </div>
    </div>
  );
}

function EmptyTableRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-3 py-6 text-center text-xs text-slate-400"
      >
        {message}
      </td>
    </tr>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className="flex max-h-[min(92dvh,100%)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="pr-2 text-sm font-semibold leading-snug text-slate-900 sm:text-base">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function driverListName(d: Driver): string {
  const fn = (d as { fullName?: string }).fullName?.trim();
  if (fn) return fn;
  const n = `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim();
  return n || "Driver";
}

export function CashInCashOutPage() {
  const savedUi = useMemo(() => loadCashInCashOutUi(), []);
  const prevAgencyIdRef = useRef<string | null>(savedUi.selectedAgencyId);
  const prevDriverIdRef = useRef<string | null>(savedUi.selectedDriverId);

  const [tab, setTab] = useState<TabId>(savedUi.tab);
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

  const [agencyDetail, setAgencyDetail] = useState<AgencyCashInCashOutDetail | null>(null);
  const [driverDetail, setDriverDetail] = useState<DriverCashInCashOutDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailMonth, setDetailMonth] = useState(savedUi.detailMonth);

  const [modal, setModal] = useState<"agencyMarkPayment" | "driverMarkPayment" | null>(
    null,
  );
  const [agencyPaymentKind, setAgencyPaymentKind] = useState<
    "cash_in" | "cash_out"
  >("cash_in");
  const [driverPaymentKind, setDriverPaymentKind] = useState<
    "cash_out" | "advance"
  >("cash_out");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod] = useState<string>("cash");
  const [payNotes, setPayNotes] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [payMessage, setPayMessage] = useState<string | null>(null);

  const loadAgencies = useCallback(async () => {
    setListLoading(true);
    try {
      const { agencies: list } = await fetchAgencies(1, 300);
      setAgencies(list);
    } catch {
      setAgencies([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadDrivers = useCallback(async () => {
    setListLoading(true);
    try {
      const { drivers: list } = await fetchDrivers({ page: 1, limit: 300 });
      setDrivers(list ?? []);
    } catch {
      setDrivers([]);
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
    const exists = agencies.some((a) => (a._id ?? a.id ?? "") === selectedAgencyId);
    if (!exists) setSelectedAgencyId(null);
  }, [agencies, listLoading, tab, selectedAgencyId]);

  useEffect(() => {
    if (listLoading || tab !== "drivers" || !selectedDriverId) return;
    const exists = drivers.some((d) => (d._id ?? d.id ?? "") === selectedDriverId);
    if (!exists) setSelectedDriverId(null);
  }, [drivers, listLoading, tab, selectedDriverId]);

  const loadAgencyDetail = useCallback(
    async (agencyId: string, month: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const d = await fetchCashInCashOutAgencyDetail(agencyId, month);
        setAgencyDetail(d);
      } catch {
        setAgencyDetail(null);
        setDetailError("Could not load agency details.");
      } finally {
        setDetailLoading(false);
      }
    },
    [],
  );

  const loadDriverDetail = useCallback(
    async (driverId: string, month: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const d = await fetchCashInCashOutDriverDetail(driverId, month);
        setDriverDetail(d);
      } catch {
        setDriverDetail(null);
        setDetailError("Could not load driver details.");
      } finally {
        setDetailLoading(false);
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
    }
    prevAgencyIdRef.current = selectedAgencyId;
  }, [selectedAgencyId]);

  useEffect(() => {
    if (
      prevDriverIdRef.current !== null &&
      prevDriverIdRef.current !== selectedDriverId
    ) {
      setDriverDetailTab("trips");
    }
    prevDriverIdRef.current = selectedDriverId;
  }, [selectedDriverId]);

  useEffect(() => {
    if (tab === "agencies" && selectedAgencyId) {
      loadAgencyDetail(selectedAgencyId, detailMonth);
    } else {
      setAgencyDetail(null);
    }
  }, [tab, selectedAgencyId, detailMonth, loadAgencyDetail]);

  useEffect(() => {
    if (tab === "drivers" && selectedDriverId) {
      loadDriverDetail(selectedDriverId, detailMonth);
    } else {
      setDriverDetail(null);
    }
  }, [tab, selectedDriverId, detailMonth, loadDriverDetail]);

  const resolveAgencyLabel = useCallback(
    (agencyName?: string) => resolveAgencyLabelFromName(agencyName, agencies),
    [agencies],
  );

  const selectedAgencyMeta = useMemo(
    () => agencies.find((a) => (a._id ?? a.id ?? "") === selectedAgencyId),
    [agencies, selectedAgencyId],
  );

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
      const n = driverListName(d).toLowerCase();
      const phone = (d.phone || "").toLowerCase();
      return n.includes(q) || phone.includes(q);
    });
  }, [drivers, listSearch]);

  const agencyUnifiedTrips = useMemo(
    () => (agencyDetail ? buildAgencyUnifiedTrips(agencyDetail) : []),
    [agencyDetail],
  );

  const agencyUnifiedCashHistory = useMemo(
    () => (agencyDetail ? buildAgencyUnifiedCashHistory(agencyDetail) : []),
    [agencyDetail],
  );

  const agencySummaryMetrics = useMemo(
    () => (agencyDetail ? buildAgencySummaryMetrics(agencyDetail) : null),
    [agencyDetail],
  );

  const driverUnifiedTrips = useMemo(
    () =>
      driverDetail
        ? buildDriverUnifiedTrips(driverDetail, resolveAgencyLabel)
        : [],
    [driverDetail, resolveAgencyLabel],
  );

  const driverUnifiedCashHistory = useMemo(
    () => (driverDetail ? buildDriverUnifiedCashHistory(driverDetail) : []),
    [driverDetail],
  );

  const driverSummaryMetrics = useMemo(
    () => (driverDetail ? buildDriverSummaryMetrics(driverDetail) : null),
    [driverDetail],
  );

  const agencyMathIssues = useMemo(
    () => (agencyDetail ? verifyAgencyCashMath(agencyDetail) : []),
    [agencyDetail],
  );

  const driverMathIssues = useMemo(
    () => (driverDetail ? verifyDriverCashMath(driverDetail) : []),
    [driverDetail],
  );

  const openDriverMarkPaymentModal = () => {
    setPayMessage(null);
    setPayAmount("");
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayMethod("cash");
    setPayNotes("");
    setDriverPaymentKind("cash_out");
    setModal("driverMarkPayment");
  };

  const openAgencyMarkPaymentModal = () => {
    setPayMessage(null);
    setPayAmount("");
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayMethod("cash");
    setPayNotes("");
    setAgencyPaymentKind("cash_in");
    setModal("agencyMarkPayment");
  };

  const submitAgencyCashIn = async () => {
    if (!selectedAgencyId) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      setPayMessage("Enter a valid amount.");
      return;
    }
    setPaySaving(true);
    setPayMessage(null);
    try {
      await addAgencyPayoutPayment(selectedAgencyId, {
        amount: amt,
        paymentDate: payDate,
        paymentMethod: payMethod,
        notes: payNotes,
      });
      setModal(null);
      await loadAgencyDetail(selectedAgencyId, detailMonth);
    } catch (e: unknown) {
      setPayMessage(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to record.",
      );
    } finally {
      setPaySaving(false);
    }
  };

  const submitAgencyCashOut = async () => {
    if (!selectedAgencyId) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      setPayMessage("Enter a valid amount.");
      return;
    }
    setPaySaving(true);
    setPayMessage(null);
    try {
      await recordAgencyProfitPayout(selectedAgencyId, {
        amount: amt,
        paymentDate: payDate,
        paymentMethod: payMethod,
        notes: payNotes,
      });
      setModal(null);
      await loadAgencyDetail(selectedAgencyId, detailMonth);
    } catch (e: unknown) {
      setPayMessage(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to record.",
      );
    } finally {
      setPaySaving(false);
    }
  };

  const submitAgencyMarkPayment = async () => {
    if (agencyPaymentKind === "cash_in") {
      await submitAgencyCashIn();
    } else {
      await submitAgencyCashOut();
    }
  };

  const submitDriverAdvance = async () => {
    if (!selectedDriverId) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      setPayMessage("Enter a valid amount.");
      return;
    }
    setPaySaving(true);
    setPayMessage(null);
    try {
      await createSalaryTransaction(selectedDriverId, {
        type: "advance",
        amount: amt,
        date: payDate,
        notes: payNotes.trim() || "Advance payment",
      });
      setModal(null);
      await loadDriverDetail(selectedDriverId, detailMonth);
    } catch (e: unknown) {
      setPayMessage(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to record advance.",
      );
    } finally {
      setPaySaving(false);
    }
  };

  const submitDriverCashOut = async () => {
    if (!selectedDriverId || !driverDetail) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      setPayMessage("Enter a valid amount.");
      return;
    }

    const bataRemaining = driverDetail.summary.vehicleBata.remaining;
    const bulkRemaining = driverDetail.summary.bulkAdvance.remaining;

    setPaySaving(true);
    setPayMessage(null);
    try {
      let left = amt;

      if (left > 0 && bataRemaining > 0) {
        const pay = Math.min(left, bataRemaining);
        await createSalaryTransaction(selectedDriverId, {
          type: "salary",
          amount: pay,
          date: payDate,
          notes: payNotes,
        });
        left -= pay;
      }

      if (left > 0 && bulkRemaining > 0) {
        const agencyId = pickAgencyIdForDriverBulkPayout(driverDetail, agencies);
        if (!agencyId) {
          setPayMessage(
            "Could not record bulk advance: no agency available. Link a bulk trip to an agency first.",
          );
          return;
        }
        const pay = Math.min(left, bulkRemaining);
        await addDriverPayoutPayment(agencyId, {
          driverName: driverDetail.driver.displayName,
          amount: pay,
          paymentDate: payDate,
          paymentMethod: payMethod,
          notes: payNotes,
        });
        left -= pay;
      }

      if (left > 0) {
        await createSalaryTransaction(selectedDriverId, {
          type: "salary",
          amount: left,
          date: payDate,
          notes: payNotes,
        });
      }

      setModal(null);
      await loadDriverDetail(selectedDriverId, detailMonth);
    } catch (e: unknown) {
      setPayMessage(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to record.",
      );
    } finally {
      setPaySaving(false);
    }
  };

  const submitDriverMarkPayment = async () => {
    if (driverPaymentKind === "advance") {
      await submitDriverAdvance();
    } else {
      await submitDriverCashOut();
    }
  };

  const hasSelection =
    tab === "agencies" ? selectedAgencyId != null : selectedDriverId != null;

  const refreshList = () => {
    if (tab === "agencies") loadAgencies();
    else loadDrivers();
    if (selectedAgencyId) loadAgencyDetail(selectedAgencyId, detailMonth);
    if (selectedDriverId) loadDriverDetail(selectedDriverId, detailMonth);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4">
        <TabBar tab={tab} setTab={setTab} />
        <button
          type="button"
          onClick={refreshList}
          className="inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 sm:h-9 sm:w-9"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar list */}
        <div
          className={`flex w-full shrink-0 flex-col border-r border-slate-200 bg-white sm:w-64 md:w-72 lg:w-80 ${
            hasSelection ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="relative border-b border-slate-100 px-3 py-2.5 sm:px-4">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-5 sm:h-3.5 sm:w-3.5" />
            <input
              type="search"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder={tab === "agencies" ? "Search agencies…" : "Search drivers…"}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-8 pr-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 sm:rounded-md sm:py-1.5 sm:pl-7 sm:pr-2 sm:text-xs"
            />
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-2 sm:space-y-1.5">
            {listLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ))
            ) : tab === "agencies" ? (
              filteredAgencies.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-400">No agencies</p>
              ) : (
                filteredAgencies.map((a) => {
                  const id = a._id ?? a.id ?? "";
                  const sel = id === selectedAgencyId;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedAgencyId(id)}
                      className={`w-full touch-manipulation rounded-xl border p-3 text-left transition-all sm:p-3.5 ${
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
                          {a.phone ? (
                            <p className="truncate text-xs text-slate-400">
                              {a.phone}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400">Agency</p>
                          )}
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
                const id = d._id;
                const sel = id === selectedDriverId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedDriverId(id)}
                    className={`w-full touch-manipulation rounded-xl border p-3 text-left transition-all sm:p-3.5 ${
                      sel
                        ? "border-blue-400 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                        <UserCircle className="h-5 w-5 text-violet-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {driverListName(d)}
                        </p>
                        {d.phone ? (
                          <p className="truncate text-xs text-slate-400">{d.phone}</p>
                        ) : (
                          <p className="text-xs text-slate-400">Driver</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail */}
        <div
          className={`flex min-w-0 flex-1 flex-col overflow-hidden ${
            hasSelection ? "flex" : "hidden md:flex"
          }`}
        >
          {tab === "agencies" && selectedAgencyId && (
            <>
              <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 bg-white px-3 py-3 lg:px-4">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedAgencyId(null)}
                    className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="min-w-0 truncate text-base font-bold text-slate-900 sm:text-lg">
                    {selectedAgencyMeta
                      ? formatAgencyLabel(selectedAgencyMeta)
                      : agencyDetail?.agency.name ?? "…"}
                  </h2>
                  <div className="ml-auto flex shrink-0">
                    <button
                      type="button"
                      onClick={openAgencyMarkPaymentModal}
                      disabled={!agencyDetail || detailLoading}
                      className="touch-manipulation rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
                    >
                      Mark Payment
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <DetailMonthFilter
                    month={detailMonth}
                    setMonth={setDetailMonth}
                    monthLabel={agencyDetail?.filter?.monthLabel}
                  />
                  <EntityDetailTabBar
                    tab={agencyDetailTab}
                    setTab={setAgencyDetailTab}
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
                {detailLoading && !agencyDetail ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : detailError ? (
                  <p className="text-sm text-red-600">{detailError}</p>
                ) : agencyDetail ? (
                  <div
                    className={`relative ${detailLoading ? "pointer-events-none opacity-60" : ""}`}
                  >
                    {detailLoading && (
                      <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-6">
                        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
                      </div>
                    )}
                    {agencySummaryMetrics && (
                      <EntitySummaryCards metrics={agencySummaryMetrics} />
                    )}
                    {agencyMathIssues.length > 0 && (
                      <div
                        role="alert"
                        className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                      >
                        <p className="font-semibold">Totals check</p>
                        <ul className="mt-1 list-inside list-disc">
                          {agencyMathIssues.map((msg) => (
                            <li key={msg}>{msg}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {agencyDetailTab === "trips" && (
                      <TableShell title="Trips (bulk & vehicle)">
                      <div>
                        <table className="min-w-[36rem] w-full text-left text-xs sm:min-w-full">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-500">
                              <th className="px-3 py-2 font-medium">Source</th>
                              <th className="px-3 py-2 font-medium">Date</th>
                              <th className="px-3 py-2 font-medium">Trip / vehicle</th>
                              <th className="px-3 py-2 font-medium">Details</th>
                              <th className="px-3 py-2 text-right font-medium">Cash in</th>
                              <th className="px-3 py-2 text-right font-medium">Cash out</th>
                              <th className="px-3 py-2 text-right font-medium">Advance</th>
                              <th className="px-3 py-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {agencyUnifiedTrips.length === 0 ? (
                              <EmptyTableRow colSpan={8} message="No trips." />
                            ) : (
                              agencyUnifiedTrips.map((r) => (
                                <tr
                                  key={r.id}
                                  className="border-b border-slate-50 text-slate-800"
                                >
                                  <td className="whitespace-nowrap px-3 py-2">
                                    <span
                                      className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${sourceBadgeCls(r.source)}`}
                                    >
                                      {r.source}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2">
                                    {formatDate(r.date)}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                                    {r.reference}
                                  </td>
                                  <td className="max-w-[140px] truncate px-3 py-2">
                                    {r.details}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                                    {r.cashIn != null ? fmtCurrency(r.cashIn) : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                                    {r.cashOut != null ? fmtCurrency(r.cashOut) : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                                    {r.advance != null ? fmtCurrency(r.advance) : "—"}
                                  </td>
                                  <td className="px-3 py-2 capitalize text-slate-500">
                                    {r.status}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </TableShell>
                    )}

                    {agencyDetailTab === "cashHistory" && (
                      <>
                    <TableShell title="Cash history (bulk & vehicle)">
                      <div>
                        <table className="min-w-[36rem] w-full text-left text-xs sm:min-w-full">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-500">
                              <th className="px-3 py-2 font-medium">Type</th>
                              <th className="px-3 py-2 font-medium">Date</th>
                              <th className="px-3 py-2 text-right font-medium">Amount</th>
                              <th className="px-3 py-2 font-medium">Method</th>
                              <th className="px-3 py-2 font-medium">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {agencyUnifiedCashHistory.length === 0 ? (
                              <EmptyTableRow colSpan={5} message="No cash history yet." />
                            ) : (
                              agencyUnifiedCashHistory.map((r) => (
                                <tr
                                  key={r.id}
                                  className="border-b border-slate-50 text-slate-800"
                                >
                                  <td className="whitespace-nowrap px-3 py-2">
                                    <span
                                      className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${directionBadgeCls(r.direction)}`}
                                    >
                                      {r.direction}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2">
                                    {formatDate(r.date)}
                                  </td>
                                  <td
                                    className={`px-3 py-2 text-right font-medium tabular-nums ${cashAmountCls(r.direction)}`}
                                  >
                                    {fmtCurrency(r.amount)}
                                  </td>
                                  <td className="px-3 py-2">{r.method}</td>
                                  <td className="max-w-[200px] truncate px-3 py-2 text-slate-500">
                                    {r.notes || "—"}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </TableShell>

                    <p className="px-1 text-center text-[11px] leading-relaxed text-slate-400 sm:px-0">
                      Main-trip agency receipts:{" "}
                      <Link to="/history/payout" className="text-blue-600 hover:underline">
                        History → Agency payout
                      </Link>
                    </p>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </>
          )}

          {tab === "drivers" && selectedDriverId && (
            <>
              <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 bg-white px-3 py-3 lg:px-4">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedDriverId(null)}
                    className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="min-w-0 truncate text-base font-bold text-slate-900 sm:text-lg">
                    {driverDetail?.driver.displayName ?? "…"}
                  </h2>
                  <div className="ml-auto flex shrink-0">
                    <button
                      type="button"
                      onClick={openDriverMarkPaymentModal}
                      disabled={!driverDetail || detailLoading}
                      className="touch-manipulation rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
                    >
                      Cash out
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <DetailMonthFilter
                    month={detailMonth}
                    setMonth={setDetailMonth}
                    monthLabel={driverDetail?.filter?.monthLabel}
                  />
                  <EntityDetailTabBar
                    tab={driverDetailTab}
                    setTab={setDriverDetailTab}
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
                {detailLoading && !driverDetail ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : detailError ? (
                  <p className="text-sm text-red-600">{detailError}</p>
                ) : driverDetail ? (
                  <div
                    className={`relative ${detailLoading ? "pointer-events-none opacity-60" : ""}`}
                  >
                    {detailLoading && (
                      <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-6">
                        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
                      </div>
                    )}
                    {driverSummaryMetrics && (
                      <EntitySummaryCards
                        metrics={driverSummaryMetrics}
                        entity="driver"
                      />
                    )}
                    {driverMathIssues.length > 0 && (
                      <div
                        role="alert"
                        className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                      >
                        <p className="font-semibold">Totals check</p>
                        <ul className="mt-1 list-inside list-disc">
                          {driverMathIssues.map((msg) => (
                            <li key={msg}>{msg}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {driverDetailTab === "trips" && (
                      <TableShell title="Trips (bulk & vehicle)">
                      <div>
                        <table className="min-w-[36rem] w-full text-left text-xs sm:min-w-full">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-500">
                              <th className="px-3 py-2 font-medium">Source</th>
                              <th className="px-3 py-2 font-medium">Date</th>
                              <th className="px-3 py-2 font-medium">Trip / vehicle</th>
                              <th className="px-3 py-2 font-medium">Details</th>
                              <th className="px-3 py-2 text-right font-medium">Cash out</th>
                              <th className="px-3 py-2 text-right font-medium">Grand total</th>
                              <th className="px-3 py-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {driverUnifiedTrips.length === 0 ? (
                              <EmptyTableRow colSpan={7} message="No trips." />
                            ) : (
                              driverUnifiedTrips.map((r) => (
                                <tr
                                  key={r.id}
                                  className="border-b border-slate-50 text-slate-800"
                                >
                                  <td className="whitespace-nowrap px-3 py-2">
                                    <span
                                      className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${sourceBadgeCls(r.source)}`}
                                    >
                                      {r.source}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2">
                                    {formatDate(r.date)}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                                    {r.reference}
                                  </td>
                                  <td className="max-w-[140px] truncate px-3 py-2">
                                    {r.details}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                                    {fmtCurrency(r.cashOut)}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                                    {r.grandTotal != null ? fmtCurrency(r.grandTotal) : "—"}
                                  </td>
                                  <td className="px-3 py-2 capitalize text-slate-500">
                                    {r.status}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </TableShell>
                    )}

                    {driverDetailTab === "cashHistory" && (
                      <>
                    <TableShell title="Cash history (bulk & vehicle)">
                      <div>
                        <table className="min-w-[36rem] w-full text-left text-xs sm:min-w-full">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-500">
                              <th className="px-3 py-2 font-medium">Type</th>
                              <th className="px-3 py-2 font-medium">Date</th>
                              <th className="px-3 py-2 text-right font-medium">Amount</th>
                              <th className="px-3 py-2 font-medium">Method</th>
                              <th className="px-3 py-2 font-medium">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {driverUnifiedCashHistory.length === 0 ? (
                              <EmptyTableRow colSpan={5} message="No cash history yet." />
                            ) : (
                              driverUnifiedCashHistory.map((r) => (
                                <tr
                                  key={r.id}
                                  className="border-b border-slate-50 text-slate-800"
                                >
                                  <td className="whitespace-nowrap px-3 py-2">
                                    <span
                                      className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${driverCashKindBadgeCls(r.kind)}`}
                                    >
                                      {r.kind}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2">
                                    {formatDate(r.date)}
                                  </td>
                                  <td
                                    className={`px-3 py-2 text-right font-medium tabular-nums ${cashAmountCls(r.direction)}`}
                                  >
                                    {fmtCurrency(r.amount)}
                                  </td>
                                  <td className="px-3 py-2">{r.method}</td>
                                  <td className="max-w-[200px] truncate px-3 py-2 text-slate-500">
                                    {r.notes || "—"}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </TableShell>

                    <p className="px-1 text-center text-[11px] leading-relaxed text-slate-400 sm:px-0">
                      You can also manage salary from{" "}
                      <Link to="/drivers" className="text-blue-600 hover:underline">
                        Drivers
                      </Link>{" "}
                      and bulk payouts from{" "}
                      <Link to="/bulk-entry" className="text-blue-600 hover:underline">
                        Bulk Entry
                      </Link>
                      .
                    </p>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </>
          )}

          {!hasSelection && (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center sm:p-8">
              {tab === "agencies" ? (
                <Building2 className="mx-auto h-12 w-12 text-slate-200" />
              ) : (
                <Users className="mx-auto h-12 w-12 text-slate-200" />
              )}
              <p className="mt-3 text-sm font-medium text-slate-500">
                {tab === "agencies" ? "Select an agency" : "Select a driver"}
              </p>
              <p className="mt-1 max-w-xs text-xs text-slate-400">
                Choose an item from the list to see amounts in tables and record cash in or cash out.
              </p>
            </div>
          )}
        </div>
      </div>

      {modal === "agencyMarkPayment" && (
        <Modal title="Mark Payment" onClose={() => setModal(null)}>
          <p className="mb-3 text-xs text-slate-500">
            Cash in = money got from agency. Cash out = money given to agency.
          </p>
          <fieldset className="block">
            <legend className="text-xs font-medium text-slate-600">Type</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setAgencyPaymentKind("cash_in")}
                className={`min-h-[40px] rounded-lg px-2 py-2 text-xs font-semibold sm:text-sm ${
                  agencyPaymentKind === "cash_in"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                Cash in
              </button>
              <button
                type="button"
                onClick={() => setAgencyPaymentKind("cash_out")}
                className={`min-h-[40px] rounded-lg px-2 py-2 text-xs font-semibold sm:text-sm ${
                  agencyPaymentKind === "cash_out"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                Cash out
              </button>
            </div>
          </fieldset>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Amount (₹)
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              min={0}
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Date
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Method
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Notes
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
            />
          </label>
          {payMessage && <p className="mt-2 text-xs text-red-600">{payMessage}</p>}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium sm:min-h-0 sm:w-auto sm:py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={paySaving}
              onClick={submitAgencyMarkPayment}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2"
            >
              {paySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {modal === "driverMarkPayment" && driverDetail && (
        <Modal title="Cash out" onClose={() => setModal(null)}>
          <p className="mb-3 text-xs text-slate-500">
            {driverPaymentKind === "advance"
              ? "Advance paid to driver (same as Drivers → Salary tab). Reduces trip bata pending for this period."
              : "Cash out to driver: applied to bata (salary) first, then bulk advance payout."}
            {driverSummaryMetrics && (
              <>
                {" "}
                {driverPaymentKind === "advance" ? (
                  <>
                    Bata remaining:{" "}
                    <strong>
                      {fmtCurrency(driverDetail.summary.vehicleBata.remaining)}
                    </strong>
                  </>
                ) : (
                  <>
                    Remaining to pay:{" "}
                    <strong>
                      {fmtSignedCurrency(driverSummaryMetrics.remainingToGet)}
                    </strong>
                  </>
                )}
              </>
            )}
          </p>
          <fieldset className="block">
            <legend className="text-xs font-medium text-slate-600">Type</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setDriverPaymentKind("cash_out")}
                className={`min-h-[40px] rounded-lg px-2 py-2 text-xs font-semibold sm:text-sm ${
                  driverPaymentKind === "cash_out"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                Cash out
              </button>
              <button
                type="button"
                onClick={() => setDriverPaymentKind("advance")}
                className={`min-h-[40px] rounded-lg px-2 py-2 text-xs font-semibold sm:text-sm ${
                  driverPaymentKind === "advance"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                Advance
              </button>
            </div>
          </fieldset>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Amount (₹)
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              min={0}
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Date
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </label>
          {driverPaymentKind === "cash_out" && (
            <label className="mt-3 block text-xs font-medium text-slate-600">
              Method
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Notes
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder={
                driverPaymentKind === "advance"
                  ? "e.g. Advance for trip"
                  : undefined
              }
            />
          </label>
          {payMessage && <p className="mt-2 text-xs text-red-600">{payMessage}</p>}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium sm:min-h-0 sm:w-auto sm:py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={paySaving}
              onClick={submitDriverMarkPayment}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2"
            >
              {paySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
