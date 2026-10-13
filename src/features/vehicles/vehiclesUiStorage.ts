export type VehicleDetailTabId = "upcoming" | "live" | "history";

export type VehiclesUiPersisted = {
  search: string;
  selectedVehicleId: string | null;
  detailTab: VehicleDetailTabId;
};

const STORAGE_KEY = "tripwise.vehicles.ui";

function defaultUi(): VehiclesUiPersisted {
  return {
    search: "",
    selectedVehicleId: null,
    detailTab: "live",
  };
}

function isDetailTab(v: unknown): v is VehicleDetailTabId {
  return v === "upcoming" || v === "live" || v === "history";
}

export function loadVehiclesUi(): VehiclesUiPersisted {
  const base = defaultUi();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<VehiclesUiPersisted>;
    return {
      search: typeof parsed.search === "string" ? parsed.search : base.search,
      selectedVehicleId:
        typeof parsed.selectedVehicleId === "string"
          ? parsed.selectedVehicleId
          : parsed.selectedVehicleId === null
            ? null
            : base.selectedVehicleId,
      detailTab: isDetailTab(parsed.detailTab)
        ? parsed.detailTab
        : base.detailTab,
    };
  } catch {
    return base;
  }
}

export function saveVehiclesUi(state: VehiclesUiPersisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}
