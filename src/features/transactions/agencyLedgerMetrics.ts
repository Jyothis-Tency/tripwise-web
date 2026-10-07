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
