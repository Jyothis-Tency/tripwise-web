/**
 * Vehicle trip amount on Transaction / Transaction History ledgers:
 * agency cost collected from the agency (not owner profit / cab / extras).
 */
export function vehicleAgencyLedgerMargin(t: {
  agencyCost?: number;
  cabCost?: number;
  agencyProfit?: number;
}): number {
  const agency = Number(t.agencyCost);
  if (Number.isFinite(agency) && agency > 0) {
    return Math.round(agency * 100) / 100;
  }
  // Legacy fallback if agencyCost was never stored.
  if (Number.isFinite(agency) && agency === 0) return 0;
  return Number(t.agencyProfit) || 0;
}

/** Sum completed vehicle-trip agency cost for ledger KPIs. */
export function sumVehicleAgencyCost(
  rows: Array<{ status?: string; agencyCost?: number; agencyProfit?: number }> = [],
): number {
  return rows
    .filter((t) => String(t.status || "").toLowerCase() === "completed")
    .reduce((s, t) => s + vehicleAgencyLedgerMargin(t), 0);
}
