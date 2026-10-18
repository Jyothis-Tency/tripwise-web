import type { HistoryTrip } from "../history/api";
import {
  computeDriverSalaryBreakdown,
  getHistoryTripExpenseBreakdown,
  resolveTripAgencyProfitDisplay,
} from "../history/tripExpenseBreakdown";

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function tripDistanceKm(t: HistoryTrip): number {
  const start = Number(t.startKilometers);
  const end = Number(t.endKilometers);
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    return end - start;
  }
  const dist = Number(t.distance);
  return Number.isFinite(dist) ? dist : 0;
}

function tripDurationMs(t: HistoryTrip): number {
  if (t.startTime && t.endTime) {
    const a = new Date(String(t.startTime)).getTime();
    const b = new Date(String(t.endTime)).getTime();
    if (Number.isFinite(a) && Number.isFinite(b)) {
      let ms = b - a;
      if (ms < 0) ms += 24 * 60 * 60 * 1000;
      if (ms > 0) return ms;
    }
  }
  // Bulk trips often store hours as a number (and times as "08:00 AM" strings).
  const hours = Number(t.hours);
  if (Number.isFinite(hours) && hours > 0) {
    return Math.round(hours * 60 * 60 * 1000);
  }
  return 0;
}

function tripDayKey(t: HistoryTrip): string | null {
  const raw = t.startDate ?? t.date ?? t.createdAt;
  if (!raw) return null;
  const s = String(raw).trim();
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatReportDuration(totalMs: number): string {
  const totalMin = Math.floor(Math.max(0, totalMs) / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
  return parts.join(" ");
}

export function formatDaysAndTime(uniqueDays: number, totalMs: number): string {
  const dayLabel = `${uniqueDays} day${uniqueDays === 1 ? "" : "s"}`;
  return `${dayLabel} · ${formatReportDuration(totalMs)}`;
}

export type VehicleReportTotals = {
  kind: "vehicle";
  agencyCost: number;
  cabCost: number;
  /** Cab cost + non-fuel extras (tolls, parking, etc.). */
  totalCabCost: number;
  advance: number;
  ownerProfit: number;
  distanceKm: number;
  driverSalary: number;
  driverAdvance: number;
  fuel: number;
  extraExpense: number;
  uniqueDays: number;
  totalDurationMs: number;
  daysAndTime: string;
};

export type BulkReportTotals = {
  kind: "bulk";
  uniqueDays: number;
  totalDurationMs: number;
  daysAndTime: string;
  distanceKm: number;
  grandTotal: number;
  advance: number;
  remaining: number;
  tolls: number;
  /** Sum of driver bata / salary on bulk rows. */
  driverSalary: number;
  /**
   * Sum of bulk commission margin (stored agencyProfit = grandTotal − driverSalary
   * when set; otherwise outstanding balance). Distinct from `remaining` when margin is stored.
   */
  commissionProfit: number;
};

/** @deprecated Prefer VehicleReportTotals / BulkReportTotals */
export type AgencyVehicleTotals = {
  kind: "agency_vehicle";
  agencyCost: number;
  cabCost: number;
  advance: number;
};

/** @deprecated Prefer BulkReportTotals */
export type AgencyBulkTotals = {
  kind: "agency_bulk";
  grandTotal: number;
  advance: number;
  remaining: number;
};

/** @deprecated Prefer VehicleReportTotals when driver-filtered */
export type DriverTotals = {
  kind: "driver";
  salary: number;
  advance: number;
};

export type EntityReportTotals =
  | VehicleReportTotals
  | BulkReportTotals
  | AgencyVehicleTotals
  | AgencyBulkTotals
  | DriverTotals;

export type TripReportTotals = VehicleReportTotals | BulkReportTotals;

export function computeVehicleReportTotals(
  trips: HistoryTrip[],
): VehicleReportTotals {
  let agencyCost = 0;
  let cabCost = 0;
  let totalCabCost = 0;
  let advance = 0;
  let ownerProfit = 0;
  let distanceKm = 0;
  let driverSalary = 0;
  let driverAdvance = 0;
  let fuel = 0;
  let extraExpense = 0;
  let totalDurationMs = 0;
  const days = new Set<string>();

  for (const t of trips) {
    agencyCost += n(t.agencyCost);
    cabCost += n(t.cabCost);
    advance += n(t.advance);
    ownerProfit += resolveTripAgencyProfitDisplay(t);
    distanceKm += tripDistanceKm(t);

    const salary = computeDriverSalaryBreakdown(t);
    driverSalary += salary.totalSalary;
    driverAdvance += n(
      (t as { advancePaid?: number }).advancePaid ?? t.advance,
    );

    const expenses = getHistoryTripExpenseBreakdown(t);
    fuel += expenses.fuelExpense;
    extraExpense += expenses.extraExpenses;
    totalCabCost += expenses.totalCabCost;

    totalDurationMs += tripDurationMs(t);
    const day = tripDayKey(t);
    if (day) days.add(day);
  }

  const uniqueDays = days.size;
  return {
    kind: "vehicle",
    agencyCost,
    cabCost,
    totalCabCost,
    advance,
    ownerProfit,
    distanceKm,
    driverSalary,
    driverAdvance,
    fuel,
    extraExpense,
    uniqueDays,
    totalDurationMs,
    daysAndTime: formatDaysAndTime(uniqueDays, totalDurationMs),
  };
}

export function computeBulkReportTotals(trips: HistoryTrip[]): BulkReportTotals {
  let distanceKm = 0;
  let grandTotal = 0;
  let advance = 0;
  let remaining = 0;
  let tolls = 0;
  let driverSalary = 0;
  let commissionProfit = 0;
  let totalDurationMs = 0;
  const days = new Set<string>();

  for (const t of trips) {
    distanceKm += tripDistanceKm(t);
    const total =
      t.grandTotal != null
        ? n(t.grandTotal)
        : t.paymentSummary?.totalAmount != null
          ? n(t.paymentSummary.totalAmount)
          : n(t.cabCost) || n(t.agencyCost);
    const adv = n(t.advance);
    const rem =
      t.paymentSummary?.remainingBalance != null
        ? n(t.paymentSummary.remainingBalance)
        : t.balanceAmount != null
          ? n(t.balanceAmount)
          : Math.max(total - adv, 0);
    const salary = computeDriverSalaryBreakdown(t);
    const profit =
      t.agencyProfit != null && Number.isFinite(Number(t.agencyProfit))
        ? Math.max(n(t.agencyProfit), 0)
        : rem;
    grandTotal += total;
    advance += adv;
    remaining += rem;
    tolls += n(t.toll);
    driverSalary += salary.driverBata;
    commissionProfit += profit;
    totalDurationMs += tripDurationMs(t);
    const day = tripDayKey(t);
    if (day) days.add(day);
  }

  const uniqueDays = days.size;
  return {
    kind: "bulk",
    uniqueDays,
    totalDurationMs,
    daysAndTime: formatDaysAndTime(uniqueDays, totalDurationMs),
    distanceKm,
    grandTotal,
    advance,
    remaining,
    tolls,
    driverSalary,
    commissionProfit,
  };
}

/** Full report rollup for the active dataset (all matching trips). */
export function computeTripReportTotals(
  trips: HistoryTrip[],
  tripSource: "vehicle" | "bulk",
): TripReportTotals {
  if (tripSource === "bulk") return computeBulkReportTotals(trips);
  return computeVehicleReportTotals(trips);
}

/** Narrow entity-focused rollup (kept for older call sites). */
export function computeEntityReportTotals(
  trips: HistoryTrip[],
  entityType: "agency" | "driver",
  tripSource: "vehicle" | "bulk",
): EntityReportTotals {
  if (entityType === "driver") {
    const v = computeVehicleReportTotals(trips);
    return { kind: "driver", salary: v.driverSalary, advance: v.driverAdvance };
  }
  if (tripSource === "bulk") {
    const b = computeBulkReportTotals(trips);
    return {
      kind: "agency_bulk",
      grandTotal: b.grandTotal,
      advance: b.advance,
      remaining: b.remaining,
    };
  }
  const v = computeVehicleReportTotals(trips);
  return {
    kind: "agency_vehicle",
    agencyCost: v.agencyCost,
    cabCost: v.cabCost,
    advance: v.advance,
  };
}
