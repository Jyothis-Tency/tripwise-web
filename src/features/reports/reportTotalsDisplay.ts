import type { TripReportTotals } from "./entityReportTotals";

function fmtRs(n: number): string {
  return `Rs. ${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtKm(n: number): string {
  return `${Number(n || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 1,
  })} km`;
}

export type VehicleReportTotalFieldId =
  | "agencyCost"
  | "cabCost"
  | "extraExpense"
  | "totalCabCost"
  | "fuel"
  | "ownerProfit"
  | "advance"
  | "distance"
  | "driverSalary"
  | "driverAdvance"
  | "daysAndTime";

export type BulkReportTotalFieldId =
  | "daysAndTime"
  | "distance"
  | "grandTotal"
  | "advance"
  | "remaining"
  | "tolls"
  | "driverSalary"
  | "commissionProfit";

export type ReportTotalFieldId =
  | VehicleReportTotalFieldId
  | BulkReportTotalFieldId;

export type ReportTotalFieldDef = {
  id: ReportTotalFieldId;
  label: string;
  defaultOn: boolean;
};

export const VEHICLE_REPORT_TOTAL_DEFS: ReportTotalFieldDef[] = [
  { id: "agencyCost", label: "Agency Cost", defaultOn: true },
  { id: "cabCost", label: "Cab Cost", defaultOn: true },
  { id: "extraExpense", label: "Extra Expense", defaultOn: true },
  { id: "totalCabCost", label: "Total Cab Cost", defaultOn: true },
  { id: "fuel", label: "Fuel", defaultOn: true },
  { id: "ownerProfit", label: "Owner Profit", defaultOn: true },
  { id: "advance", label: "Advance", defaultOn: true },
  { id: "distance", label: "Distance", defaultOn: true },
  { id: "driverSalary", label: "Driver Salary", defaultOn: true },
  { id: "driverAdvance", label: "Driver Advance", defaultOn: true },
  { id: "daysAndTime", label: "Days & Time", defaultOn: true },
];

export const BULK_REPORT_TOTAL_DEFS: ReportTotalFieldDef[] = [
  { id: "daysAndTime", label: "Days & Time", defaultOn: true },
  { id: "distance", label: "Distance", defaultOn: true },
  { id: "grandTotal", label: "Grand Total", defaultOn: true },
  { id: "advance", label: "Advance", defaultOn: true },
  { id: "remaining", label: "Remaining", defaultOn: true },
  { id: "tolls", label: "Tolls", defaultOn: true },
  { id: "driverSalary", label: "Driver Salary", defaultOn: true },
  { id: "commissionProfit", label: "Commission Profit", defaultOn: true },
];

export function visibleReportTotalDefs(
  tripSource: "vehicle" | "bulk" = "vehicle",
): ReportTotalFieldDef[] {
  return tripSource === "bulk"
    ? BULK_REPORT_TOTAL_DEFS
    : VEHICLE_REPORT_TOTAL_DEFS;
}

export type ReportTotalsSelection = Record<ReportTotalFieldId, boolean>;

export function defaultReportTotalsSelection(
  tripSource: "vehicle" | "bulk" = "vehicle",
): ReportTotalsSelection {
  const defs = visibleReportTotalDefs(tripSource);
  const sel = {} as ReportTotalsSelection;
  for (const d of defs) {
    sel[d.id] = d.defaultOn;
  }
  return sel;
}

export function allReportTotalsSelection(
  tripSource: "vehicle" | "bulk" = "vehicle",
): ReportTotalsSelection {
  const defs = visibleReportTotalDefs(tripSource);
  const sel = {} as ReportTotalsSelection;
  for (const d of defs) {
    sel[d.id] = true;
  }
  return sel;
}

export function noneReportTotalsSelection(
  tripSource: "vehicle" | "bulk" = "vehicle",
): ReportTotalsSelection {
  const defs = visibleReportTotalDefs(tripSource);
  const sel = {} as ReportTotalsSelection;
  for (const d of defs) {
    sel[d.id] = false;
  }
  return sel;
}

export type ReportTotalLine = {
  id: ReportTotalFieldId;
  label: string;
  value: string;
  emphasize?: boolean;
};

/** Ordered summary lines for preview / PDF headers. */
export function tripReportTotalLines(
  totals: TripReportTotals,
  selection?: Partial<Record<string, boolean>>,
): ReportTotalLine[] {
  let lines: ReportTotalLine[] = [];
  if (totals.kind === "vehicle") {
    lines = [
      { id: "agencyCost", label: "Agency Cost", value: fmtRs(totals.agencyCost), emphasize: true },
      { id: "cabCost", label: "Cab Cost", value: fmtRs(totals.cabCost) },
      { id: "extraExpense", label: "Extra Expense", value: fmtRs(totals.extraExpense) },
      {
        id: "totalCabCost",
        label: "Total Cab Cost",
        value: fmtRs(totals.totalCabCost),
        emphasize: true,
      },
      { id: "fuel", label: "Fuel", value: fmtRs(totals.fuel) },
      { id: "ownerProfit", label: "Owner Profit", value: fmtRs(totals.ownerProfit) },
      { id: "advance", label: "Advance", value: fmtRs(totals.advance) },
      { id: "distance", label: "Distance", value: fmtKm(totals.distanceKm) },
      { id: "driverSalary", label: "Driver Salary", value: fmtRs(totals.driverSalary) },
      { id: "driverAdvance", label: "Driver Advance", value: fmtRs(totals.driverAdvance) },
      { id: "daysAndTime", label: "Days & Time", value: totals.daysAndTime },
    ];
  } else {
    lines = [
      { id: "daysAndTime", label: "Days & Time", value: totals.daysAndTime, emphasize: true },
      { id: "distance", label: "Distance", value: fmtKm(totals.distanceKm) },
      { id: "grandTotal", label: "Grand Total", value: fmtRs(totals.grandTotal), emphasize: true },
      { id: "advance", label: "Advance", value: fmtRs(totals.advance) },
      { id: "remaining", label: "Remaining", value: fmtRs(totals.remaining) },
      { id: "tolls", label: "Tolls", value: fmtRs(totals.tolls) },
      { id: "driverSalary", label: "Driver Salary", value: fmtRs(totals.driverSalary) },
      {
        id: "commissionProfit",
        label: "Commission Profit",
        value: fmtRs(totals.commissionProfit),
      },
    ];
  }

  if (!selection) return lines;
  return lines.filter((l) => selection[l.id] !== false);
}
