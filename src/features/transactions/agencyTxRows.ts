import type { AgencyCashInCashOutDetail } from "../cash-in-cash-out/api";

export type AgencyTxType = "Bulk" | "Vehicle" | "Cash in" | "Cash out";

export type AgencyTxRow = {
  id: string;
  date: string | null;
  amount: number;
  type: AgencyTxType;
  flow: "in" | "out";
  method: string;
  notes: string;
  sortTime: number;
};

function parseTime(value: string | null | undefined): number {
  if (value == null || value === "") return NaN;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function sortTime(date: string | null | undefined, id: string): number {
  const t = parseTime(date);
  if (Number.isFinite(t)) return t;
  const hex = id.replace(/\D/g, "").slice(0, 8);
  const n = parseInt(hex, 16);
  return Number.isFinite(n) ? n : 0;
}

function formatShortDate(value: string | null | undefined): string {
  const t = parseTime(value);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type BulkCashInRow = AgencyCashInCashOutDetail["tables"]["bulkTripsCashIn"][number];

type BulkLedgerGroup = BulkCashInRow & { tripCount: number };

function aggregateBulkTripRows(trips: BulkCashInRow[]): BulkLedgerGroup {
  if (trips.length === 1) return { ...trips[0], tripCount: 1 };

  const grandTotal = trips.reduce((s, t) => s + (Number(t.grandTotal) || 0), 0);
  const startMs = trips
    .map((t) => parseTime(t.startDate || t.date))
    .filter(Number.isFinite);
  const endMs = trips
    .map((t) => parseTime(t.endDate || t.startDate || t.date))
    .filter(Number.isFinite);
  const firstStart =
    startMs.length ? new Date(Math.min(...startMs)).toISOString() : trips[0].startDate;
  const lastEnd =
    endMs.length
      ? new Date(Math.max(...endMs)).toISOString()
      : trips[trips.length - 1].endDate;
  const latestSort = trips.reduce((best, t) => {
    const tb = parseTime(t.endDate || t.startDate || t.date);
    return tb > best ? tb : best;
  }, 0);
  const sortDate =
    latestSort > 0
      ? new Date(latestSort).toISOString()
      : trips[trips.length - 1].date;

  const groupId = String(trips[0].clientGroupId || "").trim();
  const stableId = groupId
    ? `cg-${groupId}`
    : `grp-${trips.map((t) => t._id).join("-")}`;

  return {
    ...trips[0],
    _id: stableId,
    grandTotal,
    startDate: firstStart ?? trips[0].startDate,
    endDate: lastEnd ?? trips[trips.length - 1].endDate,
    date: sortDate ?? trips[trips.length - 1].date,
    advancePaid: trips.reduce((s, t) => s + (Number(t.advancePaid) || 0), 0),
    status: trips[trips.length - 1].status,
    entryMode: "bulk",
    tripCount: trips.length,
  };
}

/**
 * One transaction-history row per bulk entry card (`clientGroupId`).
 * Trips without a stored group id stay one row per trip (legacy data).
 */
export function groupBulkTripsForLedger(rows: BulkCashInRow[]): BulkLedgerGroup[] {
  if (!rows.length) return [];

  const byGroupId = new Map<string, BulkCashInRow[]>();
  const legacy: BulkCashInRow[] = [];

  for (const row of rows) {
    const gid = String(row.clientGroupId || "").trim();
    if (gid) {
      const list = byGroupId.get(gid) || [];
      list.push(row);
      byGroupId.set(gid, list);
    } else {
      legacy.push(row);
    }
  }

  const grouped: BulkLedgerGroup[] = [];
  for (const trips of byGroupId.values()) {
    grouped.push(aggregateBulkTripRows(trips));
  }
  for (const row of legacy) {
    grouped.push({ ...row, tripCount: 1 });
  }

  return grouped;
}

function bulkGroupNotes(row: BulkCashInRow, tripCount: number): string {
  const driver = row.driverName?.trim() || "Driver";
  const vehicle = row.vehicleNumber?.trim() || "Vehicle";
  const from = formatShortDate(row.startDate || row.date);
  const to = formatShortDate(row.endDate || row.startDate || row.date);
  const range =
    from && to && from !== to ? `${from} → ${to}` : from || to || "";
  const parts = [`${driver}`, vehicle];
  if (range) parts.push(range);
  if (tripCount > 1) parts.push(`${tripCount} trips`);
  return parts.join(" · ");
}

export function buildAgencyTxRows(detail: AgencyCashInCashOutDetail): AgencyTxRow[] {
  const tables = detail?.tables;
  if (!tables) return [];

  const bulkGroups = groupBulkTripsForLedger(tables.bulkTripsCashIn ?? []);

  const bulkRows: AgencyTxRow[] = bulkGroups.map((row) => {
    const tripCount = row.tripCount;
    const stableKey = String(row.clientGroupId || "").trim()
      ? `bulk-cg-${row.clientGroupId}`
      : `bulk-${row._id}`;
    return {
      id: stableKey,
      date: row.date,
      amount: Number(row.grandTotal) || 0,
      type: "Bulk",
      flow: "in",
      method: "—",
      notes: bulkGroupNotes(row, tripCount),
      sortTime: sortTime(row.date, row._id),
    };
  });

  const receipts: AgencyTxRow[] = (tables.bulkReceiptPayments ?? []).map((r) => ({
    id: `in-${r._id}`,
    date: r.paymentDate,
    amount: r.amount,
    type: "Cash in",
    flow: "in",
    method: r.paymentMethod || "—",
    notes: r.notes || "Payment received",
    sortTime: sortTime(r.paymentDate, r._id),
  }));

  const vehicleRows: AgencyTxRow[] = (tables.vehicleTripsAgencyProfit ?? [])
    .filter((t) => String(t.status || "").toLowerCase() === "completed")
    .map((t) => {
      const amount = Number(t.agencyProfit) || 0;
      const route = [t.from, t.to].filter(Boolean).join(" → ");
      const tripLabel = t.tripNumber ? `Trip ${t.tripNumber}` : "Vehicle trip";
      const agency = Number(t.agencyCost) || 0;
      const totalCab =
        Number(t.totalCabCost) ||
        (Number(t.cabCost) || 0) + (Number(t.extraExpenses) || 0);
      const costNote =
        agency > 0 || totalCab > 0
          ? `Agency ₹${agency.toLocaleString("en-IN")} − Cab+extras ₹${totalCab.toLocaleString("en-IN")}`
          : "";
      return {
        id: `vehicle-${t._id}`,
        date: t.date,
        amount,
        type: "Vehicle",
        flow: "out",
        method: "—",
        notes: [tripLabel, route, costNote].filter(Boolean).join(" · "),
        sortTime: sortTime(t.date, t._id),
      };
    });

  const payouts: AgencyTxRow[] = (tables.agencyProfitPayoutPayments ?? []).map(
    (r) => ({
      id: `out-${r._id}`,
      date: r.paymentDate,
      amount: r.amount,
      type: "Cash out",
      flow: "out",
      method: r.paymentMethod || "—",
      notes: r.notes || "Profit payout",
      sortTime: sortTime(r.paymentDate, r._id),
    }),
  );

  return [...bulkRows, ...receipts, ...vehicleRows, ...payouts];
}
