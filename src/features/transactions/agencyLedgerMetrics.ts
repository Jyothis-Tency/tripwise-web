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

function vehicleExposure(cashOut: AgencyCashOutSummary): number {
  const total = Number(cashOut.totalOwed);
  if (Number.isFinite(total)) return total;
  return (
    (Number(cashOut.fromTrips) || 0) + (Number(cashOut.manualExtra) || 0)
  );
}

/** Net exposure before receipts/payouts: bulk grand total − vehicle cash out. */
export function agencyNetGrandTotal(
  cashIn: AgencyCashInSummary,
  cashOut: AgencyCashOutSummary,
): number {
  return bulkExposure(cashIn) - vehicleExposure(cashOut);
}

/** Still to settle with agency (positive = they owe you). Matches P&L-style net. */
export function agencyNetRemaining(
  cashIn: AgencyCashInSummary,
  cashOut: AgencyCashOutSummary,
): number {
  const received = Number(cashIn.received) || 0;
  const paid = Number(cashOut.paid) || 0;
  return agencyNetGrandTotal(cashIn, cashOut) - received - paid;
}

export type AggregatedAgencyLedger = {
  grandTotal: number;
  received: number;
  remaining: number;
  bulkTotal: number;
  vehicleOut: number;
  agencyCount: number;
};

/** Sum agency ledger KPIs (same math as Transaction History agency cards). */
export function aggregateAgencyLedgerFromSummaries(
  summaries: {
    cashInBulk?: AgencyCashInSummary;
    cashOutAgencyProfit?: AgencyCashOutSummary;
  }[],
): AggregatedAgencyLedger {
  let grandTotal = 0;
  let received = 0;
  let remaining = 0;
  let bulkTotal = 0;
  let vehicleOut = 0;
  let agencyCount = 0;

  for (const s of summaries) {
    const bulk = s.cashInBulk;
    const profit = s.cashOutAgencyProfit;
    if (!bulk || !profit) continue;
    agencyCount += 1;
    bulkTotal += Number(bulk.fromTrips) || 0;
    vehicleOut += Number(profit.fromTrips) || 0;
    grandTotal += agencyNetGrandTotal(bulk, profit);
    received += Number(bulk.received) || 0;
    remaining += agencyNetRemaining(bulk, profit);
  }

  return {
    grandTotal,
    received,
    remaining,
    bulkTotal,
    vehicleOut,
    agencyCount,
  };
}
