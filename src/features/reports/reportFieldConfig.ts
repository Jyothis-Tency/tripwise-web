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
  | "cabCost"
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
  { id: "cabCost", label: "Cab Cost", section: "right", defaultOn: true },
  { id: "advance", label: "Advance", section: "right", defaultOn: false },
  { id: "balance", label: "Balance", section: "right", defaultOn: false },
  { id: "toll", label: "Toll", section: "right", defaultOn: false },
  { id: "notes", label: "Notes", section: "left", defaultOn: false },
  { id: "vehicleType", label: "Vehicle Type", section: "header", defaultOn: false },
  { id: "mobileNumber", label: "Mobile Number", section: "header", defaultOn: false },
];

export type ReportFieldSelection = Record<ReportFieldId, boolean>;

export function defaultReportFieldSelection(
  tripSource: "vehicle" | "bulk" = "vehicle",
): ReportFieldSelection {
  const sel = {} as ReportFieldSelection;
  for (const f of REPORT_FIELD_DEFS) {
    if (tripSource === "bulk") {
      // For bulk trips, select bulk-specific fields by default
      if (["advance", "balance", "notes", "vehicleType", "mobileNumber", "toll"].includes(f.id)) {
        sel[f.id] = true;
        continue;
      }
      // Unselect vehicle-specific fields
      if (["customer", "startKilometers", "startTime", "totalKm", "totalTime"].includes(f.id)) {
        sel[f.id] = false;
        continue;
      }
    }
    sel[f.id] = f.defaultOn;
  }
  return sel;
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
