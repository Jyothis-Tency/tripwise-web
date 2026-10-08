/** Agency ledger KPIs — must match Cash In / Cash Out summary math. */

export type AgencyCashInSummary = {
  fromTrips?: number;
  manualExtra?: number;
  totalOwed?: number;
  received?: number;
  /** Driver advance on bulk rows (driver ledger only; does not reduce agency cash-in). */
  advances?: number;
  remaining?: number;
};

export type AgencyCashOutSummary = {
  fromTrips?: number;
  manualExtra?: number;
  totalOwed?: number;
  paid?: number;
  remaining?: number;
};

function bulkExposure(cashIn: AgencyCashInSummary): number {
  const total = Number(cashIn.totalOwed);
  if (Number.isFinite(total)) return total;
  return (
    (Number(cashIn.fromTrips) || 0) + (Number(cashIn.manualExtra) || 0)
  );
}

/**
 * Explicit cash given to the agency (manual extras / payouts only).
 * Do not use vehicle-trip fromTrips here — that is owner profit, not cash out.
 */
function agencyCashOutExposure(cashOut: AgencyCashOutSummary): number {
  const total = Number(cashOut.totalOwed);
  if (Number.isFinite(total)) return total;
  return Number(cashOut.manualExtra) || 0;
}

/**
 * Grand total of money from the agency before receipts/payouts:
 * bulk (cash in) + vehicle owner profit − explicit cash out extras.
 * Whether cash was collected is handled by Received / Remaining.
 */
export function agencyNetGrandTotal(
  cashIn: AgencyCashInSummary,
  cashOut: AgencyCashOutSummary,
  ownerProfitFromVehicles = 0,
): number {
  return (
    bulkExposure(cashIn) +
    (Number(ownerProfitFromVehicles) || 0) -
    agencyCashOutExposure(cashOut)
  );
}

/** Still to settle with agency (positive = they owe you). */
export function agencyNetRemaining(
  cashIn: AgencyCashInSummary,
  cashOut: AgencyCashOutSummary,
  ownerProfitFromVehicles = 0,
): number {
  const received = Number(cashIn.received) || 0;
  const paid = Number(cashOut.paid) || 0;
  return (
    agencyNetGrandTotal(cashIn, cashOut, ownerProfitFromVehicles) -
    received -
    paid
  );
}

export type AggregatedAgencyLedger = {
  grandTotal: number;
  received: number;
  remaining: number;
  bulkTotal: number;
  /** Explicit cash-out extras/payouts exposure (not vehicle trip profit). */
  cashOutExtra: number;
  ownerProfitFromVehicles: number;
  agencyCount: number;
};

/** Sum agency ledger KPIs (same math as Transaction History agency cards). */
export function aggregateAgencyLedgerFromSummaries(
  summaries: {
    cashInBulk?: AgencyCashInSummary;
    cashOutAgencyProfit?: AgencyCashOutSummary;
    ownerProfitFromVehicleTrips?: number;
  }[],
): AggregatedAgencyLedger {
  let grandTotal = 0;
  let received = 0;
  let remaining = 0;
  let bulkTotal = 0;
  let cashOutExtra = 0;
  let ownerProfitFromVehicles = 0;
  let agencyCount = 0;

  for (const s of summaries) {
    const bulk = s.cashInBulk;
    const cashOut = s.cashOutAgencyProfit;
    if (!bulk || !cashOut) continue;
    agencyCount += 1;
    const vehicleProfit = Number(s.ownerProfitFromVehicleTrips) || 0;
    bulkTotal += Number(bulk.fromTrips) || 0;
    cashOutExtra += Number(cashOut.manualExtra) || 0;
    ownerProfitFromVehicles += vehicleProfit;
    grandTotal += agencyNetGrandTotal(bulk, cashOut, vehicleProfit);
    received += Number(bulk.received) || 0;
    remaining += agencyNetRemaining(bulk, cashOut, vehicleProfit);
  }

  return {
    grandTotal,
    received,
    remaining,
    bulkTotal,
    cashOutExtra,
    ownerProfitFromVehicles,
    agencyCount,
  };
}
