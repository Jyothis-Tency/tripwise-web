import { useCallback, useEffect, useMemo, useState } from "react";
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
  updateAgencyCashInCashOutAdjustments,
  updateDriverCashInCashOutAdjustments,
  type AgencyCashInCashOutDetail,
  type DriverCashInCashOutDetail,
} from "../api";
import { fetchAgencies, addAgencyPayoutPayment, addDriverPayoutPayment, type Agency } from "../../bulk-entry/api";
import { fetchDrivers, createSalaryTransaction, type Driver } from "../../drivers/api";

function fmtCurrency(v: number): string {
  return `₹${v.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
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

type TabId = "agencies" | "drivers";
type DetailTabId = "trips" | "cashHistory";

function parseSortDate(d?: string | Date | null): number {
  if (d == null || d === "") return 0;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? 0 : t;
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

type AgencyUnifiedCashRow = {
  id: string;
  source: "Bulk" | "Vehicle";
  direction: "Cash in" | "Cash out" | "Extra";
  date: string | null;
  amount: number;
  method: string;
  notes: string;
};

function buildAgencyUnifiedTrips(
  detail: AgencyCashInCashOutDetail,
): AgencyUnifiedTripRow[] {
  const bulk: Array<AgencyUnifiedTripRow & { sortDate: number }> =
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
    sortDate: parseSortDate(r.date),
  }));
  const vehicle: Array<AgencyUnifiedTripRow & { sortDate: number }> =
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
    sortDate: parseSortDate(r.date),
  }));
  const manualRows: Array<AgencyUnifiedTripRow & { sortDate: number }> = [];
  const cashInExtra =
    detail.summary.cashInBulk.manualExtra ??
    detail.adjustments?.cashInBulk?.amount ??
    0;
  if (cashInExtra > 0) {
    manualRows.push({
      id: "manual-cash-in",
      source: "Bulk",
      date: null,
      reference: "Manual extra",
      details:
        detail.adjustments?.cashInBulk?.notes?.trim() ||
        "Additional amount to collect",
      cashIn: cashInExtra,
      cashOut: null,
      advance: null,
      status: "extra",
      sortDate: Number.MAX_SAFE_INTEGER,
    });
  }
  const cashOutExtra =
    detail.summary.cashOutAgencyProfit.manualExtra ??
    detail.adjustments?.cashOutVehicle?.amount ??
    0;
  if (cashOutExtra > 0) {
    manualRows.push({
      id: "manual-cash-out",
      source: "Vehicle",
      date: null,
      reference: "Manual extra",
      details:
        detail.adjustments?.cashOutVehicle?.notes?.trim() ||
        "Additional amount to pay",
      cashIn: null,
      cashOut: cashOutExtra,
      advance: null,
      status: "extra",
      sortDate: Number.MAX_SAFE_INTEGER - 1,
    });
  }
  return [...bulk, ...vehicle, ...manualRows]
    .sort((a, b) => b.sortDate - a.sortDate)
    .map(({ sortDate: _s, ...row }) => row);
}

function buildAgencyUnifiedCashHistory(
  detail: AgencyCashInCashOutDetail,
): AgencyUnifiedCashRow[] {
  const receipts = detail.tables.bulkReceiptPayments.map((r) => ({
    id: `in-${r._id}`,
    source: "Bulk" as const,
    direction: "Cash in" as const,
    date: r.paymentDate,
    amount: r.amount,
    method: r.paymentMethod,
    notes: r.notes,
    sortDate: parseSortDate(r.paymentDate),
  }));
  const payouts = detail.tables.agencyProfitPayoutPayments.map((r) => ({
    id: `out-${r._id}`,
    source: "Vehicle" as const,
    direction: "Cash out" as const,
    date: r.paymentDate,
    amount: r.amount,
    method: r.paymentMethod,
    notes: r.notes,
    sortDate: parseSortDate(r.paymentDate),
  }));
  const extras = (detail.tables.extraAdjustments ?? []).map((r) => ({
    id: `extra-${r._id}`,
    source: (r.kind === "cash_in_bulk_extra" ? "Bulk" : "Vehicle") as
      | "Bulk"
      | "Vehicle",
    direction: "Extra" as const,
    date: r.recordedAt,
    amount: r.amount,
    method: "—",
    notes: r.notes,
    sortDate: parseSortDate(r.recordedAt),
  }));

  if (extras.length === 0) {
    const cashInExtra =
      detail.summary.cashInBulk.manualExtra ??
      detail.adjustments?.cashInBulk?.amount ??
      0;
    if (cashInExtra > 0) {
      extras.push({
        id: "extra-manual-cash-in",
        source: "Bulk",
        direction: "Extra",
        date: null,
        amount: cashInExtra,
        method: "—",
        notes:
          detail.adjustments?.cashInBulk?.notes?.trim() ||
          "Manual extra (cash in)",
        sortDate: 0,
      });
    }
    const cashOutExtra =
      detail.summary.cashOutAgencyProfit.manualExtra ??
      detail.adjustments?.cashOutVehicle?.amount ??
      0;
    if (cashOutExtra > 0) {
      extras.push({
        id: "extra-manual-cash-out",
        source: "Vehicle",
        direction: "Extra",
        date: null,
        amount: cashOutExtra,
        method: "—",
        notes:
          detail.adjustments?.cashOutVehicle?.notes?.trim() ||
          "Manual extra (cash out)",
        sortDate: 0,
      });
    }
  }

  return [...receipts, ...payouts, ...extras]
    .sort((a, b) => b.sortDate - a.sortDate)
    .map(({ sortDate: _s, ...row }) => row);
}

function sourceBadgeCls(source: "Bulk" | "Vehicle") {
  return source === "Bulk"
    ? "bg-emerald-100 text-emerald-800"
    : "bg-blue-100 text-blue-800";
}

function directionBadgeCls(direction: AgencyUnifiedCashRow["direction"]) {
  if (direction === "Cash in") return "bg-emerald-100 text-emerald-800";
  if (direction === "Cash out") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function agencyCashAmountCls(row: AgencyUnifiedCashRow) {
  if (row.direction === "Cash in") return "text-emerald-700";
  if (row.direction === "Cash out") return "text-amber-700";
  return row.source === "Bulk" ? "text-emerald-700" : "text-amber-700";
}

function driverCashKindBadgeCls(kind: string) {
  if (kind === "Bata (salary)") return "bg-violet-100 text-violet-800";
  if (kind === "Advance payout") return "bg-amber-100 text-amber-800";
  if (kind === "Extra") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function driverCashAmountCls(row: DriverUnifiedCashRow) {
  if (row.kind === "Extra") {
    return row.source === "Vehicle" ? "text-violet-700" : "text-amber-700";
  }
  if (row.kind === "Advance payout") return "text-amber-700";
  return "text-violet-700";
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
  source: "Bulk" | "Vehicle";
  kind: string;
  date: string | null;
  amount: number;
  method: string;
  notes: string;
};

function buildDriverUnifiedTrips(
  detail: DriverCashInCashOutDetail,
): DriverUnifiedTripRow[] {
  const vehicle: Array<DriverUnifiedTripRow & { sortDate: number }> =
    detail.tables.vehicleTrips.map((r) => ({
    id: `vehicle-${r._id}`,
    source: "Vehicle" as const,
    date: r.date,
    reference: r.tripNumber || "—",
    details: [r.from, r.to].filter(Boolean).join(" → ") || "—",
    cashOut: r.driverSalary,
    grandTotal: null,
    status: r.status,
    sortDate: parseSortDate(r.date),
  }));
  const bulk: Array<DriverUnifiedTripRow & { sortDate: number }> =
    detail.tables.bulkTripsAdvance.map((r) => ({
    id: `bulk-${r._id}`,
    source: "Bulk" as const,
    date: r.date,
    reference: r.vehicleNumber || "—",
    details: r.agencyName || "—",
    cashOut: r.advancePaid,
    grandTotal: r.grandTotal,
    status: r.status,
    sortDate: parseSortDate(r.date),
  }));
  const manualRows: Array<DriverUnifiedTripRow & { sortDate: number }> = [];
  const bataExtra =
    detail.summary.vehicleBata.manualExtra ??
    detail.adjustments?.vehicleBata?.amount ??
    0;
  if (bataExtra > 0) {
    manualRows.push({
      id: "manual-bata",
      source: "Vehicle",
      date: null,
      reference: "Manual extra",
      details:
        detail.adjustments?.vehicleBata?.notes?.trim() ||
        "Additional bata to pay",
      cashOut: bataExtra,
      grandTotal: null,
      status: "extra",
      sortDate: Number.MAX_SAFE_INTEGER,
    });
  }
  const advanceExtra =
    detail.summary.bulkAdvance.manualExtra ??
    detail.adjustments?.bulkAdvance?.amount ??
    0;
  if (advanceExtra > 0) {
    manualRows.push({
      id: "manual-advance",
      source: "Bulk",
      date: null,
      reference: "Manual extra",
      details:
        detail.adjustments?.bulkAdvance?.notes?.trim() ||
        "Additional advance to pay",
      cashOut: advanceExtra,
      grandTotal: null,
      status: "extra",
      sortDate: Number.MAX_SAFE_INTEGER - 1,
    });
  }
  return [...vehicle, ...bulk, ...manualRows]
    .sort((a, b) => b.sortDate - a.sortDate)
    .map(({ sortDate: _s, ...row }) => row);
}

function buildDriverUnifiedCashHistory(
  detail: DriverCashInCashOutDetail,
): DriverUnifiedCashRow[] {
  const bata = detail.tables.salaryPayments.map((r) => ({
    id: `salary-${r._id}`,
    source: "Vehicle" as const,
    kind: "Bata (salary)",
    date: r.date,
    amount: r.amount,
    method: "—",
    notes: r.notes,
    sortDate: parseSortDate(r.date),
  }));
  const vehicleAdvance = detail.tables.advanceLedger.map((r) => ({
    id: `vadv-${r._id}`,
    source: "Vehicle" as const,
    kind: "Advance",
    date: r.date,
    amount: r.amount,
    method: "—",
    notes: r.notes,
    sortDate: parseSortDate(r.date),
  }));
  const bulkPayouts = detail.tables.bulkAdvancePayouts.map((r) => ({
    id: `bulkpay-${r._id}`,
    source: "Bulk" as const,
    kind: "Advance payout",
    date: r.paymentDate,
    amount: r.amount,
    method: r.paymentMethod,
    notes: r.notes,
    sortDate: parseSortDate(r.paymentDate),
  }));
  const extras = (detail.tables.extraAdjustments ?? []).map((r) => ({
    id: `extra-${r._id}`,
    source: (r.kind === "vehicle_bata_extra" ? "Vehicle" : "Bulk") as
      | "Bulk"
      | "Vehicle",
    kind: "Extra",
    date: r.recordedAt,
    amount: r.amount,
    method: "—",
    notes: r.notes,
    sortDate: parseSortDate(r.recordedAt),
  }));

  if (extras.length === 0) {
    const bataExtra =
      detail.summary.vehicleBata.manualExtra ??
      detail.adjustments?.vehicleBata?.amount ??
      0;
    if (bataExtra > 0) {
      extras.push({
        id: "extra-manual-bata",
        source: "Vehicle",
        kind: "Extra",
        date: null,
        amount: bataExtra,
        method: "—",
        notes:
          detail.adjustments?.vehicleBata?.notes?.trim() || "Manual extra (bata)",
        sortDate: 0,
      });
    }
    const advanceExtra =
      detail.summary.bulkAdvance.manualExtra ??
      detail.adjustments?.bulkAdvance?.amount ??
      0;
    if (advanceExtra > 0) {
      extras.push({
        id: "extra-manual-advance",
        source: "Bulk",
        kind: "Extra",
        date: null,
        amount: advanceExtra,
        method: "—",
        notes:
          detail.adjustments?.bulkAdvance?.notes?.trim() ||
          "Manual extra (advance)",
        sortDate: 0,
      });
    }
  }

  return [...bata, ...vehicleAdvance, ...bulkPayouts, ...extras]
    .sort((a, b) => b.sortDate - a.sortDate)
    .map(({ sortDate: _s, ...row }) => row);
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
  const [tab, setTab] = useState<TabId>("agencies");
  const [listSearch, setListSearch] = useState("");

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);
  const [agencyDetailTab, setAgencyDetailTab] = useState<DetailTabId>("trips");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [driverDetailTab, setDriverDetailTab] = useState<DetailTabId>("trips");

  const [agencyDetail, setAgencyDetail] = useState<AgencyCashInCashOutDetail | null>(null);
  const [driverDetail, setDriverDetail] = useState<DriverCashInCashOutDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [modal, setModal] = useState<
    | "agencyCashIn"
    | "agencyCashOut"
    | "agencyCashInExtra"
    | "agencyCashOutExtra"
    | "driverBata"
    | "driverAdvance"
    | "driverBataExtra"
    | "driverAdvanceExtra"
    | null
  >(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod] = useState<string>("cash");
  const [payNotes, setPayNotes] = useState("");
  const [advanceAgencyId, setAdvanceAgencyId] = useState("");
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
    setSelectedAgencyId(null);
    setSelectedDriverId(null);
    setAgencyDetail(null);
    setDriverDetail(null);
    if (tab === "agencies") loadAgencies();
    else loadDrivers();
  }, [tab, loadAgencies, loadDrivers]);

  const loadAgencyDetail = useCallback(async (agencyId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const d = await fetchCashInCashOutAgencyDetail(agencyId);
      setAgencyDetail(d);
    } catch {
      setAgencyDetail(null);
      setDetailError("Could not load agency details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadDriverDetail = useCallback(async (driverId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const d = await fetchCashInCashOutDriverDetail(driverId);
      setDriverDetail(d);
    } catch {
      setDriverDetail(null);
      setDetailError("Could not load driver details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    setAgencyDetailTab("trips");
  }, [selectedAgencyId]);

  useEffect(() => {
    setDriverDetailTab("trips");
  }, [selectedDriverId]);

  useEffect(() => {
    if (tab === "agencies" && selectedAgencyId) {
      loadAgencyDetail(selectedAgencyId);
    } else {
      setAgencyDetail(null);
    }
  }, [tab, selectedAgencyId, loadAgencyDetail]);

  useEffect(() => {
    if (tab === "drivers" && selectedDriverId) {
      loadDriverDetail(selectedDriverId);
    } else {
      setDriverDetail(null);
    }
  }, [tab, selectedDriverId, loadDriverDetail]);

  const filteredAgencies = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return agencies;
    return agencies.filter((a) => (a.name || "").toLowerCase().includes(q));
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

  const driverUnifiedTrips = useMemo(
    () => (driverDetail ? buildDriverUnifiedTrips(driverDetail) : []),
    [driverDetail],
  );

  const driverUnifiedCashHistory = useMemo(
    () => (driverDetail ? buildDriverUnifiedCashHistory(driverDetail) : []),
    [driverDetail],
  );

  const openPayModal = (kind: typeof modal) => {
    setPayMessage(null);
    setPayAmount("");
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayMethod("cash");
    setPayNotes("");
    setAdvanceAgencyId("");
    setModal(kind);
  };

  const openDriverExtraModal = (kind: "driverBataExtra" | "driverAdvanceExtra") => {
    if (!driverDetail) return;
    const adj =
      kind === "driverBataExtra"
        ? (driverDetail.adjustments?.vehicleBata ?? {
            amount: driverDetail.summary.vehicleBata.manualExtra ?? 0,
            notes: "",
          })
        : (driverDetail.adjustments?.bulkAdvance ?? {
            amount: driverDetail.summary.bulkAdvance.manualExtra ?? 0,
            notes: "",
          });
    setPayMessage(null);
    setPayAmount(adj.amount > 0 ? String(adj.amount) : "");
    setPayNotes(adj.notes || "");
    setModal(kind);
  };

  const openAgencyExtraModal = (kind: "agencyCashInExtra" | "agencyCashOutExtra") => {
    if (!agencyDetail) return;
    const adj =
      kind === "agencyCashInExtra"
        ? (agencyDetail.adjustments?.cashInBulk ?? {
            amount: agencyDetail.summary.cashInBulk.manualExtra ?? 0,
            notes: "",
          })
        : (agencyDetail.adjustments?.cashOutVehicle ?? {
            amount: agencyDetail.summary.cashOutAgencyProfit.manualExtra ?? 0,
            notes: "",
          });
    setPayMessage(null);
    setPayAmount(adj.amount > 0 ? String(adj.amount) : "");
    setPayNotes(adj.notes || "");
    setModal(kind);
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
      await loadAgencyDetail(selectedAgencyId);
    } catch (e: unknown) {
      setPayMessage(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to record.",
      );
    } finally {
      setPaySaving(false);
    }
  };

  const submitAgencyExtra = async (kind: "agencyCashInExtra" | "agencyCashOutExtra") => {
    if (!selectedAgencyId) return;
    const amt = Number(payAmount);
    if (Number.isNaN(amt) || amt < 0) {
      setPayMessage("Enter a valid amount (0 or more).");
      return;
    }
    setPaySaving(true);
    setPayMessage(null);
    try {
      await updateAgencyCashInCashOutAdjustments(
        selectedAgencyId,
        kind === "agencyCashInExtra"
          ? { cashInBulkExtra: amt, cashInBulkExtraNotes: payNotes }
          : { cashOutVehicleExtra: amt, cashOutVehicleExtraNotes: payNotes },
      );
      setModal(null);
      await loadAgencyDetail(selectedAgencyId);
    } catch (e: unknown) {
      setPayMessage(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to save.",
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
      await loadAgencyDetail(selectedAgencyId);
    } catch (e: unknown) {
      setPayMessage(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to record.",
      );
    } finally {
      setPaySaving(false);
    }
  };

  const submitDriverExtra = async (kind: "driverBataExtra" | "driverAdvanceExtra") => {
    if (!selectedDriverId) return;
    const amt = Number(payAmount);
    if (Number.isNaN(amt) || amt < 0) {
      setPayMessage("Enter a valid amount (0 or more).");
      return;
    }
    setPaySaving(true);
    setPayMessage(null);
    try {
      await updateDriverCashInCashOutAdjustments(
        selectedDriverId,
        kind === "driverBataExtra"
          ? { vehicleBataExtra: amt, vehicleBataExtraNotes: payNotes }
          : { bulkAdvanceExtra: amt, bulkAdvanceExtraNotes: payNotes },
      );
      setModal(null);
      await loadDriverDetail(selectedDriverId);
    } catch (e: unknown) {
      setPayMessage(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to save.",
      );
    } finally {
      setPaySaving(false);
    }
  };

  const submitDriverBata = async () => {
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
        type: "salary",
        amount: amt,
        date: payDate,
        notes: payNotes,
      });
      setModal(null);
      await loadDriverDetail(selectedDriverId);
    } catch (e: unknown) {
      setPayMessage(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to record.",
      );
    } finally {
      setPaySaving(false);
    }
  };

  const submitDriverAdvance = async () => {
    if (!selectedDriverId || !driverDetail) return;
    const amt = Number(payAmount);
    if (!advanceAgencyId) {
      setPayMessage("Select an agency.");
      return;
    }
    if (!amt || amt <= 0) {
      setPayMessage("Enter a valid amount.");
      return;
    }
    setPaySaving(true);
    setPayMessage(null);
    try {
      await addDriverPayoutPayment(advanceAgencyId, {
        driverName: driverDetail.driver.displayName,
        amount: amt,
        paymentDate: payDate,
        paymentMethod: payMethod,
        notes: payNotes,
      });
      setModal(null);
      await loadDriverDetail(selectedDriverId);
    } catch (e: unknown) {
      setPayMessage(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to record.",
      );
    } finally {
      setPaySaving(false);
    }
  };

  const advanceAgencyOptions = useMemo(() => {
    if (!driverDetail) return agencies;
    const ids = new Set(
      driverDetail.tables.bulkTripsAdvance.map((r) => r.agencyId).filter(Boolean),
    );
    if (ids.size === 0) return agencies;
    return agencies.filter((a) => ids.has(a._id ?? a.id ?? ""));
  }, [driverDetail, agencies]);

  const hasSelection =
    tab === "agencies" ? selectedAgencyId != null : selectedDriverId != null;

  const refreshList = () => {
    if (tab === "agencies") loadAgencies();
    else loadDrivers();
    if (selectedAgencyId) loadAgencyDetail(selectedAgencyId);
    if (selectedDriverId) loadDriverDetail(selectedDriverId);
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
                          <p className="text-xs text-slate-400">Agency</p>
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
              <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2 lg:px-4">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAgencyId(null)}
                    className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="min-w-0 flex-1 truncate text-base font-bold text-slate-900 sm:text-lg">
                    {agencyDetail?.agency.name ?? "…"}
                  </h2>
                </div>
                <EntityDetailTabBar
                  tab={agencyDetailTab}
                  setTab={setAgencyDetailTab}
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
                {detailLoading && !agencyDetail ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : detailError ? (
                  <p className="text-sm text-red-600">{detailError}</p>
                ) : agencyDetail ? (
                  <>
                    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-2">
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-xs sm:p-4 sm:text-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                          <p className="min-w-0 font-semibold leading-snug text-emerald-900">Cash in (bulk)</p>
                          <div className="flex w-full flex-wrap gap-1.5 sm:w-auto sm:shrink-0 sm:justify-end">
                            <button
                              type="button"
                              onClick={() => openAgencyExtraModal("agencyCashInExtra")}
                              className="min-h-[36px] touch-manipulation rounded-lg border border-emerald-300 bg-white px-2.5 py-2 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 sm:min-h-0 sm:py-1.5"
                            >
                              Extra
                            </button>
                            <button
                              type="button"
                              onClick={() => openPayModal("agencyCashIn")}
                              className="min-h-[36px] touch-manipulation rounded-lg bg-emerald-600 px-2.5 py-2 text-[11px] font-semibold text-white hover:bg-emerald-700 sm:min-h-0 sm:py-1.5"
                            >
                              Cash in
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-emerald-800">
                          Received {fmtCurrency(agencyDetail.summary.cashInBulk.received)} ·
                          Remaining{" "}
                          <span className="font-bold">
                            {fmtCurrency(agencyDetail.summary.cashInBulk.remaining)}
                          </span>
                        </p>
                      </div>
                      <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-xs sm:p-4 sm:text-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                          <p className="min-w-0 font-semibold leading-snug text-amber-900">Cash out (vehicle profit)</p>
                          <div className="flex w-full flex-wrap gap-1.5 sm:w-auto sm:shrink-0 sm:justify-end">
                            <button
                              type="button"
                              onClick={() => openAgencyExtraModal("agencyCashOutExtra")}
                              className="min-h-[36px] touch-manipulation rounded-lg border border-amber-300 bg-white px-2.5 py-2 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 sm:min-h-0 sm:py-1.5"
                            >
                              Extra
                            </button>
                            <button
                              type="button"
                              onClick={() => openPayModal("agencyCashOut")}
                              className="min-h-[36px] touch-manipulation rounded-lg bg-amber-600 px-2.5 py-2 text-[11px] font-semibold text-white hover:bg-amber-700 sm:min-h-0 sm:py-1.5"
                            >
                              Cash out
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-amber-800">
                          Paid {fmtCurrency(agencyDetail.summary.cashOutAgencyProfit.paid)} · Remaining{" "}
                          <span className="font-bold">
                            {fmtCurrency(agencyDetail.summary.cashOutAgencyProfit.remaining)}
                          </span>
                        </p>
                      </div>
                    </div>

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
                              <th className="px-3 py-2 font-medium">Source</th>
                              <th className="px-3 py-2 font-medium">Type</th>
                              <th className="px-3 py-2 font-medium">Date</th>
                              <th className="px-3 py-2 text-right font-medium">Amount</th>
                              <th className="px-3 py-2 font-medium">Method</th>
                              <th className="px-3 py-2 font-medium">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {agencyUnifiedCashHistory.length === 0 ? (
                              <EmptyTableRow colSpan={6} message="No cash history yet." />
                            ) : (
                              agencyUnifiedCashHistory.map((r) => (
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
                                    className={`px-3 py-2 text-right font-medium tabular-nums ${agencyCashAmountCls(r)}`}
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
                  </>
                ) : null}
              </div>
            </>
          )}

          {tab === "drivers" && selectedDriverId && (
            <>
              <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2 lg:px-4">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDriverId(null)}
                    className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="min-w-0 flex-1 truncate text-base font-bold text-slate-900 sm:text-lg">
                    {driverDetail?.driver.displayName ?? "…"}
                  </h2>
                </div>
                <EntityDetailTabBar
                  tab={driverDetailTab}
                  setTab={setDriverDetailTab}
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
                {detailLoading && !driverDetail ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : detailError ? (
                  <p className="text-sm text-red-600">{detailError}</p>
                ) : driverDetail ? (
                  <>
                    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-2">
                      <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 text-xs sm:p-4 sm:text-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                          <p className="min-w-0 font-semibold leading-snug text-violet-900">Driver bata</p>
                          <div className="flex w-full flex-wrap gap-1.5 sm:w-auto sm:shrink-0 sm:justify-end">
                            <button
                              type="button"
                              onClick={() => openDriverExtraModal("driverBataExtra")}
                              className="min-h-[36px] touch-manipulation rounded-lg border border-violet-300 bg-white px-2.5 py-2 text-[11px] font-semibold text-violet-800 hover:bg-violet-50 sm:min-h-0 sm:py-1.5"
                            >
                              Extra
                            </button>
                            <button
                              type="button"
                              onClick={() => openPayModal("driverBata")}
                              className="min-h-[36px] touch-manipulation rounded-lg bg-violet-600 px-2.5 py-2 text-[11px] font-semibold text-white hover:bg-violet-700 sm:min-h-0 sm:py-1.5"
                            >
                              Cash out (Bata)
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-violet-800">
                          {(driverDetail.summary.vehicleBata.manualExtra ?? 0) > 0 && (
                            <>
                              Trips{" "}
                              {fmtCurrency(
                                driverDetail.summary.vehicleBata.fromTrips ??
                                  driverDetail.summary.vehicleBata.totalOwed,
                              )}{" "}
                              · Extra {fmtCurrency(driverDetail.summary.vehicleBata.manualExtra)}
                              {" · "}
                            </>
                          )}
                          Paid {fmtCurrency(driverDetail.summary.vehicleBata.paid)} · Remaining{" "}
                          <span className="font-bold">
                            {fmtCurrency(driverDetail.summary.vehicleBata.remaining)}
                          </span>
                        </p>
                      </div>
                      <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-xs sm:p-4 sm:text-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                          <p className="min-w-0 font-semibold leading-snug text-amber-900">Bulk advance</p>
                          <div className="flex w-full flex-wrap gap-1.5 sm:w-auto sm:shrink-0 sm:justify-end">
                            <button
                              type="button"
                              onClick={() => openDriverExtraModal("driverAdvanceExtra")}
                              className="min-h-[36px] touch-manipulation rounded-lg border border-amber-300 bg-white px-2.5 py-2 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 sm:min-h-0 sm:py-1.5"
                            >
                              Extra
                            </button>
                            <button
                              type="button"
                              onClick={() => openPayModal("driverAdvance")}
                              className="min-h-[36px] touch-manipulation rounded-lg bg-amber-600 px-2.5 py-2 text-[11px] font-semibold text-white hover:bg-amber-700 sm:min-h-0 sm:py-1.5"
                            >
                              Cash out (Advance)
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-amber-800">
                          {(driverDetail.summary.bulkAdvance.manualExtra ?? 0) > 0 && (
                            <>
                              Trips{" "}
                              {fmtCurrency(
                                driverDetail.summary.bulkAdvance.fromTrips ??
                                  driverDetail.summary.bulkAdvance.totalOwed,
                              )}{" "}
                              · Extra {fmtCurrency(driverDetail.summary.bulkAdvance.manualExtra)}
                              {" · "}
                            </>
                          )}
                          Paid {fmtCurrency(driverDetail.summary.bulkAdvance.paid)} · Remaining{" "}
                          <span className="font-bold">
                            {fmtCurrency(driverDetail.summary.bulkAdvance.remaining)}
                          </span>
                        </p>
                      </div>
                    </div>

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
                                  <td className="px-3 py-2 text-right tabular-nums text-violet-700">
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
                              <th className="px-3 py-2 font-medium">Source</th>
                              <th className="px-3 py-2 font-medium">Type</th>
                              <th className="px-3 py-2 font-medium">Date</th>
                              <th className="px-3 py-2 text-right font-medium">Amount</th>
                              <th className="px-3 py-2 font-medium">Method</th>
                              <th className="px-3 py-2 font-medium">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {driverUnifiedCashHistory.length === 0 ? (
                              <EmptyTableRow colSpan={6} message="No cash history yet." />
                            ) : (
                              driverUnifiedCashHistory.map((r) => (
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
                                    className={`px-3 py-2 text-right font-medium tabular-nums ${driverCashAmountCls(r)}`}
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
                  </>
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

      {modal === "agencyCashInExtra" && (
        <Modal
          title="Manual extra — cash in (bulk)"
          onClose={() => setModal(null)}
        >
          <p className="mb-3 text-xs text-slate-500">
            Add an amount owed from this agency beyond bulk trip totals (e.g. old balance,
            adjustment). Set to 0 to remove.
          </p>
          <label className="block text-xs font-medium text-slate-600">
            Extra amount (₹)
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              min={0}
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Reason / notes
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="e.g. Opening balance, correction"
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
              onClick={() => submitAgencyExtra("agencyCashInExtra")}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2"
            >
              {paySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {modal === "agencyCashOutExtra" && (
        <Modal
          title="Manual extra — cash out (vehicle)"
          onClose={() => setModal(null)}
        >
          <p className="mb-3 text-xs text-slate-500">
            Add an amount to pay this agency beyond vehicle-trip profit. Set to 0 to remove.
          </p>
          <label className="block text-xs font-medium text-slate-600">
            Extra amount (₹)
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              min={0}
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Reason / notes
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="e.g. Bonus, prior agreement"
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
              onClick={() => submitAgencyExtra("agencyCashOutExtra")}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2"
            >
              {paySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {modal === "agencyCashIn" && (
        <Modal title="Record cash in (bulk receipt)" onClose={() => setModal(null)}>
          <p className="mb-3 text-xs text-slate-500">
            Records money received from this agency against bulk trip totals.
          </p>
          <label className="block text-xs font-medium text-slate-600">
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
              onClick={submitAgencyCashIn}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2"
            >
              {paySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {modal === "agencyCashOut" && (
        <Modal title="Record cash out (agency profit)" onClose={() => setModal(null)}>
          <p className="mb-3 text-xs text-slate-500">
            Records money paid to this agency for vehicle-trip agency profit.
          </p>
          <label className="block text-xs font-medium text-slate-600">
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
              onClick={submitAgencyCashOut}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2"
            >
              {paySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {modal === "driverBataExtra" && (
        <Modal title="Manual extra — driver bata" onClose={() => setModal(null)}>
          <p className="mb-3 text-xs text-slate-500">
            Add bata/commission owed to this driver beyond vehicle trips. Set to 0 to remove.
          </p>
          <label className="block text-xs font-medium text-slate-600">
            Extra amount (₹)
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              min={0}
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Reason / notes
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="e.g. Opening balance, correction"
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
              onClick={() => submitDriverExtra("driverBataExtra")}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-violet-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2"
            >
              {paySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {modal === "driverAdvanceExtra" && (
        <Modal title="Manual extra — bulk advance" onClose={() => setModal(null)}>
          <p className="mb-3 text-xs text-slate-500">
            Add bulk advance owed to this driver beyond bulk trip rows. Set to 0 to remove.
          </p>
          <label className="block text-xs font-medium text-slate-600">
            Extra amount (₹)
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              min={0}
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Reason / notes
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="e.g. Prior advance not in bulk entry"
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
              onClick={() => submitDriverExtra("driverAdvanceExtra")}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2"
            >
              {paySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {modal === "driverBata" && driverDetail && (
        <Modal title="Cash out — driver bata (salary)" onClose={() => setModal(null)}>
          <p className="mb-3 text-xs text-slate-500">
            Maximum allowed matches backend rules (trip Bata minus advance and salary
            already recorded). Remaining:{" "}
            <strong>{fmtCurrency(driverDetail.summary.vehicleBata.remaining)}</strong>
          </p>
          <label className="block text-xs font-medium text-slate-600">
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
              onClick={submitDriverBata}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-violet-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2"
            >
              {paySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {modal === "driverAdvance" && driverDetail && (
        <Modal title="Cash out — bulk advance" onClose={() => setModal(null)}>
          <p className="mb-3 text-xs text-slate-500">
            Records a driver payout for bulk advance. Driver name sent:{" "}
            <strong>{driverDetail.driver.displayName}</strong>
          </p>
          <label className="block text-xs font-medium text-slate-600">
            Agency
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={advanceAgencyId}
              onChange={(e) => setAdvanceAgencyId(e.target.value)}
            >
              <option value="">Select agency…</option>
              {(advanceAgencyOptions.length ? advanceAgencyOptions : agencies).map(
                (a) => {
                  const id = a._id ?? a.id ?? "";
                  return (
                    <option key={id} value={id}>
                      {a.name}
                    </option>
                  );
                },
              )}
            </select>
          </label>
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
              onClick={submitDriverAdvance}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2"
            >
              {paySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
