/** Fields that can appear on trip report cards (preview + PDF). */
export type ReportFieldId =
  | "driver"
  | "driverPhone"
  | "vehicle"
  | "vehicleType"
  | "mobileNumber"
  | "from"
  | "to"
  | "customer"
  | "agency"
  | "careOf"
  | "priority"
  | "notes"
  | "startingNote"
  | "completionNote"
  | "date"
  | "endDate"
  | "status"
  | "paymentStatus"
  | "isCompleted"
  | "distance"
  | "startKilometers"
  | "endKilometers"
  | "startTime"
  | "endTime"
  | "totalKm"
  | "totalTime"
  | "hours"
  | "agencyCost"
  | "cabCost"
  | "totalCabCost"
  | "grandTotal"
  | "driverSalary"
  | "personalExpenses"
  | "totalSalary"
  | "agencyProfit"
  | "fuelExpense"
  | "extraExpenses"
  | "advance"
  | "paidAmount"
  | "balance"
  | "toll"
  | "reportTotals";

export type ReportFieldSection =
  | "header"
  | "left"
  | "middle"
  | "right"
  | "summary";

export type ReportFieldDef = {
  id: ReportFieldId;
  label: string;
  section: ReportFieldSection;
  defaultOn: boolean;
};

export const REPORT_FIELD_DEFS: ReportFieldDef[] = [
  { id: "driver", label: "Driver", section: "header", defaultOn: true },
  { id: "driverPhone", label: "Driver Phone", section: "header", defaultOn: false },
  { id: "vehicle", label: "Vehicle", section: "header", defaultOn: true },
  { id: "vehicleType", label: "Vehicle Type", section: "header", defaultOn: false },
  { id: "mobileNumber", label: "Mobile Number", section: "header", defaultOn: false },
  { id: "from", label: "From", section: "left", defaultOn: true },
  { id: "to", label: "To", section: "left", defaultOn: true },
  { id: "customer", label: "Customer", section: "left", defaultOn: true },
  { id: "agency", label: "Agency", section: "left", defaultOn: true },
  { id: "careOf", label: "Care Of", section: "left", defaultOn: false },
  { id: "priority", label: "Priority", section: "left", defaultOn: false },
  { id: "notes", label: "Notes", section: "left", defaultOn: false },
  {
    id: "startingNote",
    label: "Starting Note",
    section: "left",
    defaultOn: false,
  },
  {
    id: "completionNote",
    label: "Completion Note",
    section: "left",
    defaultOn: false,
  },
  { id: "date", label: "Start Date", section: "middle", defaultOn: true },
  { id: "endDate", label: "End Date", section: "middle", defaultOn: true },
  { id: "status", label: "Status", section: "middle", defaultOn: true },
  {
    id: "paymentStatus",
    label: "Payment Status",
    section: "middle",
    defaultOn: false,
  },
  {
    id: "isCompleted",
    label: "Completed",
    section: "middle",
    defaultOn: false,
  },
  { id: "distance", label: "Distance", section: "middle", defaultOn: true },
  {
    id: "startKilometers",
    label: "Starting KM",
    section: "middle",
    defaultOn: true,
  },
  {
    id: "endKilometers",
    label: "Ending KM",
    section: "middle",
    defaultOn: true,
  },
  { id: "startTime", label: "Starting Time", section: "middle", defaultOn: true },
  { id: "endTime", label: "Ending Time", section: "middle", defaultOn: true },
  { id: "totalKm", label: "Total KM", section: "middle", defaultOn: true },
  { id: "totalTime", label: "Total Time", section: "middle", defaultOn: true },
  { id: "hours", label: "Hours", section: "middle", defaultOn: true },
  { id: "agencyCost", label: "Agency Cost", section: "right", defaultOn: true },
  { id: "cabCost", label: "Cab Cost", section: "right", defaultOn: true },
  {
    id: "totalCabCost",
    label: "Total Cab Cost",
    section: "right",
    defaultOn: true,
  },
  { id: "grandTotal", label: "Grand Total", section: "right", defaultOn: true },
  {
    id: "driverSalary",
    label: "Driver Bata",
    section: "right",
    defaultOn: true,
  },
  {
    id: "personalExpenses",
    label: "Personal Expenses",
    section: "right",
    defaultOn: false,
  },
  {
    id: "totalSalary",
    label: "Total Salary",
    section: "right",
    defaultOn: false,
  },
  { id: "agencyProfit", label: "Owner Profit", section: "right", defaultOn: false },
  { id: "fuelExpense", label: "Fuel", section: "right", defaultOn: false },
  { id: "extraExpenses", label: "Extra Expenses", section: "right", defaultOn: true },
  { id: "advance", label: "Advance", section: "right", defaultOn: true },
  { id: "paidAmount", label: "Paid Amount", section: "right", defaultOn: false },
  { id: "balance", label: "Remaining", section: "right", defaultOn: true },
  { id: "toll", label: "Toll", section: "right", defaultOn: true },
  {
    id: "reportTotals",
    label: "Report Totals",
    section: "summary",
    defaultOn: true,
  },
];

/** Bulk-only presentation fields (not typical vehicle-trip columns). */
export const BULK_ONLY_FIELDS: ReportFieldId[] = [
  "grandTotal",
  "toll",
  "mobileNumber",
  "hours",
  "isCompleted",
];

/** Vehicle-trip fields that do not apply to bulk agency trips. */
export const VEHICLE_ONLY_FIELDS: ReportFieldId[] = [
  "from",
  "to",
  "customer",
  "careOf",
  "priority",
  "startingNote",
  "completionNote",
  "fuelExpense",
  "extraExpenses",
  "totalCabCost",
  "personalExpenses",
  "totalSalary",
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
        // Bulk entry always cares about these operational/money fields
        if (
          f.id === "grandTotal" ||
          f.id === "toll" ||
          f.id === "hours" ||
          f.id === "mobileNumber"
        ) {
          sel[f.id] = true;
          continue;
        }
        sel[f.id] = f.defaultOn;
        continue;
      }
      // Shared operational + money fields for bulk agency reports
      if (
        f.id === "cabCost" ||
        f.id === "advance" ||
        f.id === "balance" ||
        f.id === "paidAmount" ||
        f.id === "paymentStatus" ||
        f.id === "driverSalary" ||
        f.id === "agencyCost" ||
        f.id === "agencyProfit" ||
        f.id === "startKilometers" ||
        f.id === "endKilometers" ||
        f.id === "startTime" ||
        f.id === "endTime" ||
        f.id === "totalKm" ||
        f.id === "totalTime" ||
        f.id === "distance" ||
        f.id === "endDate" ||
        f.id === "vehicleType" ||
        f.id === "notes" ||
        f.id === "reportTotals"
      ) {
        sel[f.id] = true;
        continue;
      }
    }
    if (tripSource === "vehicle") {
      if (
        f.id === "grandTotal" ||
        f.id === "toll" ||
        f.id === "hours" ||
        f.id === "isCompleted"
      ) {
        sel[f.id] = false;
        continue;
      }
    }
    sel[f.id] = f.defaultOn;
  }
  return sel;
}

/** Merge persisted/partial selection with current field defs (hot reload safe). */
export function ensureReportFieldSelection(
  selection: Partial<ReportFieldSelection> | null | undefined,
  tripSource: "vehicle" | "bulk",
): ReportFieldSelection {
  const defaults = defaultReportFieldSelection(tripSource);
  const visible = new Set(visibleReportFields(tripSource).map((f) => f.id));
  const out = { ...defaults };
  for (const f of REPORT_FIELD_DEFS) {
    if (typeof selection?.[f.id] === "boolean") {
      out[f.id] = selection[f.id] as boolean;
    }
    if (!visible.has(f.id)) out[f.id] = false;
  }
  return out;
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
