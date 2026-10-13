export type ExpensesModeId = "trip" | "vehicle";
export type ExpensesPayerFilter = "all" | "company" | "personal";

export type ExpensesUiPersisted = {
  mode: ExpensesModeId;
  tripSearch: string;
  payerFilter: ExpensesPayerFilter;
  selectedTripId: string | null;
  vehicleSearch: string;
  selectedVehicleId: string | null;
};

const STORAGE_KEY = "tripwise.expenses.ui";

function defaultUi(): ExpensesUiPersisted {
  return {
    mode: "trip",
    tripSearch: "",
    payerFilter: "all",
    selectedTripId: null,
    vehicleSearch: "",
    selectedVehicleId: null,
  };
}

function isMode(v: unknown): v is ExpensesModeId {
  return v === "trip" || v === "vehicle";
}

function isPayer(v: unknown): v is ExpensesPayerFilter {
  return v === "all" || v === "company" || v === "personal";
}

export function loadExpensesUi(): ExpensesUiPersisted {
  const base = defaultUi();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<ExpensesUiPersisted>;
    return {
      mode: isMode(parsed.mode) ? parsed.mode : base.mode,
      tripSearch:
        typeof parsed.tripSearch === "string"
          ? parsed.tripSearch
          : base.tripSearch,
      payerFilter: isPayer(parsed.payerFilter)
        ? parsed.payerFilter
        : base.payerFilter,
      selectedTripId:
        typeof parsed.selectedTripId === "string"
          ? parsed.selectedTripId
          : parsed.selectedTripId === null
            ? null
            : base.selectedTripId,
      vehicleSearch:
        typeof parsed.vehicleSearch === "string"
          ? parsed.vehicleSearch
          : base.vehicleSearch,
      selectedVehicleId:
        typeof parsed.selectedVehicleId === "string"
          ? parsed.selectedVehicleId
          : parsed.selectedVehicleId === null
            ? null
            : base.selectedVehicleId,
    };
  } catch {
    return base;
  }
}

export function saveExpensesUi(state: ExpensesUiPersisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}
