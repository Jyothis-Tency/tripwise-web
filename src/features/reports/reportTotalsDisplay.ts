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

export type ReportTotalLine = { label: string; value: string; emphasize?: boolean };

/** Ordered summary lines for preview / PDF headers. */
export function tripReportTotalLines(
  totals: TripReportTotals,
): ReportTotalLine[] {
  if (totals.kind === "vehicle") {
    return [
      { label: "Agency Cost", value: fmtRs(totals.agencyCost), emphasize: true },
      { label: "Cab Cost", value: fmtRs(totals.cabCost) },
      { label: "Advance", value: fmtRs(totals.advance) },
      { label: "Owner Profit", value: fmtRs(totals.ownerProfit) },
      { label: "Distance", value: fmtKm(totals.distanceKm) },
      { label: "Driver Salary", value: fmtRs(totals.driverSalary) },
      { label: "Driver Advance", value: fmtRs(totals.driverAdvance) },
      { label: "Fuel", value: fmtRs(totals.fuel) },
      { label: "Extra Expense", value: fmtRs(totals.extraExpense) },
      { label: "Days & Time", value: totals.daysAndTime },
    ];
  }
  return [
    { label: "Days & Time", value: totals.daysAndTime, emphasize: true },
    { label: "Distance", value: fmtKm(totals.distanceKm) },
    { label: "Grand Total", value: fmtRs(totals.grandTotal), emphasize: true },
    { label: "Advance", value: fmtRs(totals.advance) },
    { label: "Remaining", value: fmtRs(totals.remaining) },
    { label: "Tolls", value: fmtRs(totals.tolls) },
  ];
}
