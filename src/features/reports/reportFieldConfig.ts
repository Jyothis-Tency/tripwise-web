/** Fields that can appear on trip report cards (preview + PDF). */
export type ReportFieldId =
  | "driver"
  | "vehicle"
  | "from"
  | "to"
  | "customer"
  | "agency"
  | "date"
  | "status"
  | "distance"
  | "startKilometers"
  | "startTime"
  | "totalKm"
  | "totalTime"
  | "agencyCost"
  | "cabCost"
  | "grandTotal"
  | "driverSalary"
  | "agencyProfit"
  | "fuelExpense"
  | "extraExpenses"
  | "advance"
  | "balance"
  | "toll"
  | "notes"
  | "vehicleType"
  | "mobileNumber";

export type ReportFieldSection = "header" | "left" | "middle" | "right";

export type ReportFieldDef = {
  id: ReportFieldId;
  label: string;
  section: ReportFieldSection;
  defaultOn: boolean;
};

export const REPORT_FIELD_DEFS: ReportFieldDef[] = [
  { id: "driver", label: "Driver", section: "header", defaultOn: true },
  { id: "vehicle", label: "Vehicle", section: "header", defaultOn: true },
  { id: "from", label: "From", section: "left", defaultOn: true },
  { id: "to", label: "To", section: "left", defaultOn: true },
  { id: "customer", label: "Customer", section: "left", defaultOn: true },
  { id: "agency", label: "Agency", section: "left", defaultOn: true },
  { id: "date", label: "Date", section: "middle", defaultOn: true },
  { id: "status", label: "Status", section: "middle", defaultOn: true },
  { id: "distance", label: "Distance", section: "middle", defaultOn: true },
  {
    id: "startKilometers",
    label: "Starting KM",
    section: "middle",
    defaultOn: true,
  },
  { id: "startTime", label: "Starting Time", section: "middle", defaultOn: true },
  { id: "totalKm", label: "Total KM", section: "middle", defaultOn: true },
  { id: "totalTime", label: "Total Time", section: "middle", defaultOn: true },
  { id: "agencyCost", label: "Agency Cost", section: "right", defaultOn: true },
  { id: "cabCost", label: "Cab Cost", section: "right", defaultOn: true },
  { id: "grandTotal", label: "Grand Total", section: "right", defaultOn: true },
  {
    id: "driverSalary",
    label: "Driver Salary",
    section: "right",
    defaultOn: true,
  },
  { id: "agencyProfit", label: "Owner Profit", section: "right", defaultOn: false },
  { id: "fuelExpense", label: "Fuel", section: "right", defaultOn: false },
  { id: "extraExpenses", label: "Extra Expenses", section: "right", defaultOn: false },
  { id: "advance", label: "Advance", section: "right", defaultOn: true },
  { id: "balance", label: "Remaining", section: "right", defaultOn: true },
  { id: "toll", label: "Toll", section: "right", defaultOn: false },
  { id: "notes", label: "Notes", section: "left", defaultOn: false },
  { id: "vehicleType", label: "Vehicle Type", section: "header", defaultOn: false },
  { id: "mobileNumber", label: "Mobile Number", section: "header", defaultOn: false },
];

/** Bulk-only presentation fields (not typical vehicle-trip columns). */
export const BULK_ONLY_FIELDS: ReportFieldId[] = [
  "grandTotal",
  "toll",
  "notes",
  "vehicleType",
  "mobileNumber",
];

export const VEHICLE_ONLY_FIELDS: ReportFieldId[] = [
  "from",
  "to",
  "customer",
  "startKilometers",
  "startTime",
  "totalKm",
  "totalTime",
  "agencyCost",
  "agencyProfit",
  "fuelExpense",
  "extraExpenses",
];

export type ReportFieldSelection = Record<ReportFieldId, boolean>;

export function defaultReportFieldSelection(
  tripSource: "vehicle" | "bulk" = "vehicle",
): ReportFieldSelection {
  const sel = {} as ReportFieldSelection;
  for (const f of REPORT_FIELD_DEFS) {
    if (tripSource === "bulk") {
      if (VEHICLE_ONLY_FIELDS.includes(f.id)) {
        sel[f.id] = false;
        continue;
      }
      if (BULK_ONLY_FIELDS.includes(f.id)) {
        sel[f.id] = f.defaultOn;
        continue;
      }
      // Shared money fields for bulk agency reports
      if (
        f.id === "cabCost" ||
        f.id === "advance" ||
        f.id === "balance" ||
        f.id === "driverSalary"
      ) {
        sel[f.id] = true;
        continue;
      }
    }
    if (tripSource === "vehicle" && f.id === "grandTotal") {
      sel[f.id] = false;
      continue;
    }
    sel[f.id] = f.defaultOn;
  }
  return sel;
}

export function visibleReportFields(
  tripSource: "vehicle" | "bulk",
): ReportFieldDef[] {
  return REPORT_FIELD_DEFS.filter((f) => {
    if (tripSource === "bulk" && VEHICLE_ONLY_FIELDS.includes(f.id)) return false;
    if (tripSource === "vehicle" && BULK_ONLY_FIELDS.includes(f.id)) return false;
    return true;
  });
}

export function selectionForAllVisible(
  tripSource: "vehicle" | "bulk",
): ReportFieldSelection {
  const all = defaultReportFieldSelection(tripSource);
  for (const f of visibleReportFields(tripSource)) {
    all[f.id] = true;
  }
  return all;
}

export function isReportFieldOn(
  selection: ReportFieldSelection,
  id: ReportFieldId,
): boolean {
  return selection[id] === true;
}

export function selectedFieldsInSection(
  selection: ReportFieldSelection,
  section: ReportFieldSection,
): ReportFieldDef[] {
  return REPORT_FIELD_DEFS.filter(
    (f) => f.section === section && selection[f.id],
  );
}

export function countSelectedFields(selection: ReportFieldSelection): number {
  return REPORT_FIELD_DEFS.filter((f) => selection[f.id]).length;
}
