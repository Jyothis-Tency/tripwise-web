export type CashInCashOutTabId = "agencies" | "drivers";
export type CashInCashOutDetailTabId = "trips" | "cashHistory";

export type CashInCashOutUiPersisted = {
  tab: CashInCashOutTabId;
  selectedAgencyId: string | null;
  selectedDriverId: string | null;
  agencyDetailTab: CashInCashOutDetailTabId;
  driverDetailTab: CashInCashOutDetailTabId;
  detailMonth: string;
  listSearch: string;
};

const STORAGE_KEY = "tripwise.cashInCashOut.ui";

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function defaultUi(): CashInCashOutUiPersisted {
  return {
    tab: "agencies",
    selectedAgencyId: null,
    selectedDriverId: null,
    agencyDetailTab: "trips",
    driverDetailTab: "trips",
    detailMonth: currentMonthValue(),
    listSearch: "",
  };
}

function isTabId(v: unknown): v is CashInCashOutTabId {
  return v === "agencies" || v === "drivers";
}

function isDetailTabId(v: unknown): v is CashInCashOutDetailTabId {
  return v === "trips" || v === "cashHistory";
}

function isMonthValue(v: unknown): boolean {
  if (typeof v !== "string" || !v) return false;
  if (v === "all_time") return true;
  return /^\d{4}-\d{2}$/.test(v);
}

export function loadCashInCashOutUi(): CashInCashOutUiPersisted {
  const base = defaultUi();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<CashInCashOutUiPersisted>;
    return {
      tab: isTabId(parsed.tab) ? parsed.tab : base.tab,
      selectedAgencyId:
        typeof parsed.selectedAgencyId === "string"
          ? parsed.selectedAgencyId
          : parsed.selectedAgencyId === null
            ? null
            : base.selectedAgencyId,
      selectedDriverId:
        typeof parsed.selectedDriverId === "string"
          ? parsed.selectedDriverId
          : parsed.selectedDriverId === null
            ? null
            : base.selectedDriverId,
      agencyDetailTab: isDetailTabId(parsed.agencyDetailTab)
        ? parsed.agencyDetailTab
        : base.agencyDetailTab,
      driverDetailTab: isDetailTabId(parsed.driverDetailTab)
        ? parsed.driverDetailTab
        : base.driverDetailTab,
      detailMonth:
        typeof parsed.detailMonth === "string" && isMonthValue(parsed.detailMonth)
          ? parsed.detailMonth
          : base.detailMonth,
      listSearch: typeof parsed.listSearch === "string" ? parsed.listSearch : base.listSearch,
    };
  } catch {
    return base;
  }
}

export function saveCashInCashOutUi(state: CashInCashOutUiPersisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode errors
  }
}
