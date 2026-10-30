import type { ReportPreset } from "./api";
import {
  defaultReportFieldSelection,
  type ReportFieldSelection,
} from "./reportFieldConfig";

export type TripReportUiPreset = {
  id: string;
  name: string;
  description: string;
  tripSource: "vehicle" | "bulk";
  /** Trip lifecycle status or payment status (backend accepts both via status). */
  status: string;
  fieldSelection: ReportFieldSelection;
};

function withFields(
  tripSource: "vehicle" | "bulk",
  on: Array<keyof ReportFieldSelection>,
): ReportFieldSelection {
  const base = defaultReportFieldSelection(tripSource);
  for (const key of Object.keys(base) as Array<keyof ReportFieldSelection>) {
    base[key] = false;
  }
  for (const id of on) base[id] = true;
  base.reportTotals = true;
  return base;
}

/** Built-in trip-card presets (PDF card layout). */
export const TRIP_REPORT_UI_PRESETS: TripReportUiPreset[] = [
  {
    id: "monthly_vehicle_ops",
    name: "Monthly vehicle trips",
    description: "Completed vehicle trips with route + costs",
    tripSource: "vehicle",
    status: "completed",
    fieldSelection: withFields("vehicle", [
      "driver",
      "vehicle",
      "from",
      "to",
      "agency",
      "date",
      "endDate",
      "status",
      "agencyCost",
      "cabCost",
      "totalCabCost",
      "totalKm",
    ]),
  },
  {
    id: "agency_vehicle_statement",
    name: "Agency vehicle statement",
    description: "Agency cost focus for settlement",
    tripSource: "vehicle",
    status: "completed",
    fieldSelection: withFields("vehicle", [
      "driver",
      "vehicle",
      "from",
      "to",
      "agency",
      "date",
      "agencyCost",
      "cabCost",
      "totalCabCost",
      "agencyProfit",
      "extraExpenses",
      "paidAmount",
      "balance",
    ]),
  },
  {
    id: "driver_trip_log",
    name: "Driver trip log",
    description: "KM / time focused driver sheet",
    tripSource: "vehicle",
    status: "completed",
    fieldSelection: withFields("vehicle", [
      "driver",
      "driverPhone",
      "vehicle",
      "from",
      "to",
      "date",
      "endDate",
      "startKilometers",
      "endKilometers",
      "startTime",
      "endTime",
      "totalKm",
      "totalTime",
      "status",
    ]),
  },
  {
    id: "bulk_financials",
    name: "Bulk trips financials",
    description: "Grand total, advance, balance",
    tripSource: "bulk",
    status: "all",
    fieldSelection: withFields("bulk", [
      "driver",
      "mobileNumber",
      "vehicle",
      "vehicleType",
      "agency",
      "date",
      "endDate",
      "startKilometers",
      "endKilometers",
      "hours",
      "status",
      "cabCost",
      "grandTotal",
      "advance",
      "paidAmount",
      "balance",
      "toll",
      "notes",
    ]),
  },
  {
    id: "unpaid_vehicle",
    name: "Unpaid vehicle trips",
    description: "Still to collect on vehicle trips",
    tripSource: "vehicle",
    status: "unpaid",
    fieldSelection: withFields("vehicle", [
      "driver",
      "vehicle",
      "agency",
      "from",
      "to",
      "date",
      "agencyCost",
      "cabCost",
      "agencyProfit",
      "paidAmount",
      "balance",
      "status",
    ]),
  },
];

export type TabularPresetCard = {
  id: string;
  name: string;
  description: string;
  dataSource: string;
  columns: string[];
  filters: Record<string, string>;
  kind: "tabular";
};

export function tabularPresetsFromCatalog(
  presets: ReportPreset[],
): TabularPresetCard[] {
  return presets.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.dataSource.replace(/_/g, " "),
    dataSource: p.dataSource,
    columns: p.columns,
    filters: p.filters || {},
    kind: "tabular" as const,
  }));
}
