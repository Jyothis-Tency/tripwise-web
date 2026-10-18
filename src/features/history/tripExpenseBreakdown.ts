/** Expense breakdown for History trip cards (matches backend computeTripExpenseBreakdown). */

export type TripExpenseLine = {
  type?: string;
  /** Some clients send category instead of / in addition to type. */
  category?: string;
  amount?: number | string;
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

/** Exported so Expenses/Tracking use the same fuel classification as History. */
export function expenseLineIsFuel(expense: TripExpenseLine): boolean {
  return (
    isFuelExpenseType(expense.type) || isFuelExpenseType(expense.category)
  );
}

export { isFuelExpenseType };

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
    if (expenseLineIsFuel(expense)) {
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

/** Live preview: owner profit (agency cost − cab − non-fuel extras). */
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

/** Display owner profit on History/Tracking — matches backend tripAgencyProfitNumber. */
export function resolveTripAgencyProfitDisplay(trip: {
  agencyCost?: unknown;
  cabCost?: unknown;
  expenses?: TripExpenseLine[];
  fuelExpense?: number;
  extraExpenses?: number;
  totalExpenses?: number;
  totalCabCost?: number;
}): number {
  const agency = Number(trip.agencyCost) || 0;
  const { totalCabCost } = getHistoryTripExpenseBreakdown({
    expenses: trip.expenses,
    cabCost: Number(trip.cabCost) || 0,
    fuelExpense: trip.fuelExpense,
    extraExpenses: trip.extraExpenses,
    totalExpenses: trip.totalExpenses,
  });
  return roundMoney(Math.max(agency - totalCabCost, 0));
}

export function getHistoryTripExpenseBreakdown(trip: {
  expenses?: TripExpenseLine[];
  cabCost?: number;
  fuelExpense?: number;
  extraExpenses?: number;
  totalExpenses?: number;
  /** Ignored for math — always recomputed as cabCost + non-fuel extras. */
  totalCabCost?: number;
}): TripExpenseBreakdown {
  let fuelExpense: number;
  let extraExpenses: number;

  // Prefer live expense lines when present so tolls/parking etc. are never
  // dropped because of stale precomputed fuelExpense/extraExpenses (= 0).
  if (Array.isArray(trip.expenses) && trip.expenses.length > 0) {
    const computed = computeTripExpenseBreakdownFromLines(
      trip.expenses,
      trip.cabCost,
    );
    fuelExpense = computed.fuelExpense;
    extraExpenses = computed.extraExpenses;
  } else if (trip.fuelExpense != null || trip.extraExpenses != null) {
    fuelExpense = Number(trip.fuelExpense) || 0;
    extraExpenses = Number(trip.extraExpenses) || 0;
  } else {
    // Legacy: totalExpenses was non-fuel (or fuel+other) without line items
    const legacyTotal = Number(trip.totalExpenses) || 0;
    fuelExpense = 0;
    extraExpenses = roundMoney(legacyTotal);
  }

  const cab = Number(trip.cabCost) || 0;
  return {
    fuelExpense: roundMoney(fuelExpense),
    extraExpenses: roundMoney(extraExpenses),
    // Product rule: Total Cab Cost = Cab Cost + Extra Expenses (tolls, etc.). Fuel is separate.
    totalCabCost: roundMoney(extraExpenses + cab),
  };
}

export type DriverSalaryBreakdown = {
  driverBata: number;
  personalExpenses: number;
  bulkAmount: number;
  totalSalary: number;
  bracketText: string;
};

export function formatDriverSalaryBracket(
  driverBata: number,
  personalExpenses: number,
  bulkAmount: number = 0,
): string {
  return `(driver bata: ${driverBata}, personal expense: ${personalExpenses}, bulk amount: ${bulkAmount})`;
}

export function computeDriverSalaryBreakdown(trip: {
  driver_salary?: unknown;
  driverSalary?: unknown;
  driverBata?: unknown;
  driver_bata?: unknown;
  extraPersonalExpenses?: unknown;
  totalPersonalExpense?: unknown;
  personalExpenses?: unknown;
  personalExpense?: unknown;
  totalDriverSalary?: unknown;
  bulkAmount?: unknown;
  bulk_amount?: unknown;
  bulkAdvance?: unknown;
  expenses?: Array<{ paidBy?: string; paid_by?: string; amount?: unknown }>;
}): DriverSalaryBreakdown {
  const driverBata = roundMoney(
    Number(
      trip.driverBata ??
        trip.driver_bata ??
        trip.driver_salary ??
        trip.driverSalary,
    ) || 0,
  );

  let personalExpenses = 0;
  if (
    trip.extraPersonalExpenses != null ||
    trip.totalPersonalExpense != null ||
    trip.personalExpenses != null ||
    trip.personalExpense != null
  ) {
    personalExpenses = roundMoney(
      Number(
        trip.extraPersonalExpenses ??
          trip.totalPersonalExpense ??
          trip.personalExpenses ??
          trip.personalExpense,
      ) || 0,
    );
  } else if (Array.isArray(trip.expenses) && trip.expenses.length > 0) {
    let sum = 0;
    for (const e of trip.expenses) {
      const p = String(e?.paidBy ?? e?.paid_by ?? "")
        .toLowerCase()
        .trim();
      if (p === "personal") {
        sum += Number(e?.amount) || 0;
      }
    }
    personalExpenses = roundMoney(sum);
  }

  const bulkAmount = roundMoney(
    Number(trip.bulkAmount ?? trip.bulk_amount ?? trip.bulkAdvance) || 0,
  );

  const totalSalary =
    trip.totalDriverSalary != null
      ? roundMoney(Number(trip.totalDriverSalary) || 0)
      : roundMoney(driverBata + personalExpenses);

  const bracketText = formatDriverSalaryBracket(
    driverBata,
    personalExpenses,
    bulkAmount,
  );

  return {
    driverBata,
    personalExpenses,
    bulkAmount,
    totalSalary,
    bracketText,
  };
}
