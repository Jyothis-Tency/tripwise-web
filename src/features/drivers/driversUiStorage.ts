export type DriverBlockFilterId = "unblocked" | "blocked" | "all";
export type DriverDetailTabId = "details" | "salary";

export type DriversUiPersisted = {
  search: string;
  blockFilter: DriverBlockFilterId;
  selectedDriverId: string | null;
  detailTab: DriverDetailTabId;
};

const STORAGE_KEY = "tripwise.drivers.ui";

function defaultUi(): DriversUiPersisted {
  return {
    search: "",
    blockFilter: "unblocked",
    selectedDriverId: null,
    detailTab: "details",
  };
}

function isBlockFilter(v: unknown): v is DriverBlockFilterId {
  return v === "unblocked" || v === "blocked" || v === "all";
}

function isDetailTab(v: unknown): v is DriverDetailTabId {
  return v === "details" || v === "salary";
}

export function loadDriversUi(): DriversUiPersisted {
  const base = defaultUi();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<DriversUiPersisted>;
    return {
      search: typeof parsed.search === "string" ? parsed.search : base.search,
      blockFilter: isBlockFilter(parsed.blockFilter)
        ? parsed.blockFilter
        : base.blockFilter,
      selectedDriverId:
        typeof parsed.selectedDriverId === "string"
          ? parsed.selectedDriverId
          : parsed.selectedDriverId === null
            ? null
            : base.selectedDriverId,
      detailTab: isDetailTab(parsed.detailTab)
        ? parsed.detailTab
        : base.detailTab,
    };
  } catch {
    return base;
  }
}

export function saveDriversUi(state: DriversUiPersisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}
