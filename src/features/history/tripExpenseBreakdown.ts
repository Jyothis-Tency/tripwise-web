/** Expense breakdown for History trip cards (matches backend computeTripExpenseBreakdown). */

export type TripExpenseLine = {
  type?: string;
  amount?: number;
};

export type TripExpenseBreakdown = {
  fuelExpense: number;
  extraExpenses: number;
  totalCabCost: number;
};

function isFuelExpenseType(type: unknown): boolean {
  const t = String(type ?? "")
    .toLowerCase()
    .trim();
  return t === "fuel" || t === "petrol" || t === "diesel";
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeTripExpenseBreakdownFromLines(
  expenses: TripExpenseLine[] | undefined,
  cabCost: unknown,
): TripExpenseBreakdown {
  let fuelExpense = 0;
  let extraExpenses = 0;
  for (const expense of expenses ?? []) {
    const amount = Number(expense.amount) || 0;
    if (isFuelExpenseType(expense.type)) {
      fuelExpense += amount;
    } else {
      extraExpenses += amount;
    }
  }
  const cab = Number(cabCost) || 0;
  return {
    fuelExpense: roundMoney(fuelExpense),
    extraExpenses: roundMoney(extraExpenses),
    totalCabCost: roundMoney(extraExpenses + cab),
  };
}

/** Live preview: agency profit from agency cost, cab cost, and optional expense lines. */
export function computeAgencyProfitPreview(
  agencyCost: unknown,
  cabCost: unknown,
  expenses?: TripExpenseLine[],
): number {
  const agency = Number(agencyCost) || 0;
  const { totalCabCost } = computeTripExpenseBreakdownFromLines(
    expenses,
    cabCost,
  );
  return roundMoney(Math.max(agency - totalCabCost, 0));
}

export function getHistoryTripExpenseBreakdown(trip: {
  expenses?: TripExpenseLine[];
  cabCost?: number;
  fuelExpense?: number;
  extraExpenses?: number;
  totalExpenses?: number;
}): TripExpenseBreakdown {
  let fuelExpense: number;
  let extraExpenses: number;

  if (trip.fuelExpense != null && trip.extraExpenses != null) {
    fuelExpense = Number(trip.fuelExpense) || 0;
    extraExpenses = Number(trip.extraExpenses) || 0;
  } else if (trip.expenses?.length) {
    const computed = computeTripExpenseBreakdownFromLines(
      trip.expenses,
      trip.cabCost,
    );
    fuelExpense = computed.fuelExpense;
    extraExpenses = computed.extraExpenses;
  } else {
    // Legacy: totalExpenses was fuel + other — cannot split fuel without line items
    const legacyTotal = Number(trip.totalExpenses) || 0;
    fuelExpense = 0;
    extraExpenses = roundMoney(legacyTotal);
  }

  const cab = Number(trip.cabCost) || 0;
  return {
    fuelExpense: roundMoney(fuelExpense),
    extraExpenses: roundMoney(extraExpenses),
    totalCabCost: roundMoney(extraExpenses + cab),
  };
}
