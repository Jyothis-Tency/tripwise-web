import type { HistoryTrip } from "../history/api";
import { historyDriverName, historyVehicleNumber } from "../history/historyTripDisplay";
import { fmtTimeAmPm, fmtTripDuration } from "../history/historyTimeUtils";
import {
  computeAgencyProfitPreview,
  computeDriverSalaryBreakdown,
  getHistoryTripExpenseBreakdown,
} from "../history/tripExpenseBreakdown";
import type { ReportFieldId } from "./reportFieldConfig";

export function reportFmtDate(raw: unknown): string {
  const s = raw == null ? "" : String(raw).trim();
  if (!s) return "N/A";
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    return `${Number(ymd[3])}/${Number(ymd[2])}/${Number(ymd[1])}`;
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return "N/A";
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(dt)
    .split("-");
  return `${Number(d)}/${Number(m)}/${Number(y)}`;
}

export function reportFmtRs(raw: unknown): string {
  const n = raw == null ? 0 : Number(raw);
  const v = Number.isFinite(n) ? n : 0;
  return `Rs. ${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function reportVehicleText(trip: HistoryTrip): string {
  const num = historyVehicleNumber(trip.vehicle);
  const v = trip.vehicle;
  if (typeof v === "object" && v?.vehicleModel) {
    return `${num} - ${v.vehicleModel}`;
  }
  return num;
}

function reportTotalKm(trip: HistoryTrip): string {
  const start = Number(trip.startKilometers);
  const end = Number(trip.endKilometers);
  if (Number.isFinite(start) && Number.isFinite(end)) {
    return `${Math.max(end - start, 0)} km`;
  }
  const distRaw = trip.distance;
  const distNum = distRaw == null ? null : Number(distRaw);
  if (distNum != null && Number.isFinite(distNum)) {
    return `${distNum} km`;
  }
  if (distRaw != null && String(distRaw).trim()) return String(distRaw);
  return "N/A";
}

function reportDistance(trip: HistoryTrip): string {
  const distRaw = trip.distance;
  const distNum = distRaw == null ? null : Number(distRaw);
  if (distNum != null && Number.isFinite(distNum)) {
    return `${distNum} km`;
  }
  return String(distRaw ?? "N/A");
}

export type TripReportRow = {
  tripNumber: string;
} & Record<ReportFieldId, string>;

function reportKmReading(raw: unknown): string {
  if (raw == null || raw === "") return "N/A";
  const n = Number(raw);
  if (Number.isFinite(n)) return `${n} km`;
  const s = String(raw).trim();
  return s || "N/A";
}

function reportHours(trip: HistoryTrip): string {
  const raw = trip.hours;
  if (raw == null) return "N/A";
  const n = Number(raw);
  if (Number.isFinite(n)) return `${n} hr`;
  return String(raw);
}

function reportCareOf(trip: HistoryTrip): string {
  const c = trip.careOf as
    | string
    | { name?: string; phone?: string }
    | null
    | undefined;
  if (!c) return "N/A";
  if (typeof c === "string") return c.trim() || "N/A";
  const name = c.name?.trim() || "";
  const phone = c.phone?.trim() || "";
  if (name && phone) return `${name} (${phone})`;
  return name || phone || "N/A";
}

function reportDriverPhone(trip: HistoryTrip): string {
  const d = trip.driver;
  if (typeof d === "object" && d?.phone?.trim()) return d.phone.trim();
  if (trip.mobileNumber?.trim()) return trip.mobileNumber.trim();
  return "N/A";
}

function reportVehicleType(trip: HistoryTrip): string {
  if (trip.vehicleType?.trim()) return trip.vehicleType.trim();
  const v = trip.vehicle;
  if (typeof v === "object" && v?.vehicleType?.trim()) return v.vehicleType.trim();
  return "N/A";
}

export function toTripReportRow(
  trip: HistoryTrip,
  resolveAgencyLabel: (agencyName?: string) => string,
): TripReportRow {
  const agencyRaw = trip.agencyName ?? "";

  const expenses = getHistoryTripExpenseBreakdown(trip);
  const agencyProfit =
    trip.agencyProfit != null && Number.isFinite(Number(trip.agencyProfit))
      ? Number(trip.agencyProfit)
      : computeAgencyProfitPreview(trip.agencyCost, trip.cabCost, trip.expenses);

  const salary = computeDriverSalaryBreakdown(trip);

  const paid =
    trip.paidAmount ??
    trip.paymentSummary?.paidAmount ??
    trip.cashInSummary?.paid ??
    0;

  const remaining =
    trip.balanceAmount ??
    trip.paymentSummary?.remainingBalance ??
    trip.cashInSummary?.remaining ??
    0;

  const paymentStatusRaw =
    trip.paymentSummary?.paymentStatus ??
    trip.cashInSummary?.status ??
    "";
  const paymentStatus = paymentStatusRaw
    ? String(paymentStatusRaw).replace(/_/g, " ").toUpperCase()
    : "N/A";

  const isCompleted =
    typeof (trip as { isCompleted?: boolean }).isCompleted === "boolean"
      ? (trip as { isCompleted?: boolean }).isCompleted
        ? "Yes"
        : "No"
      : "N/A";

  return {
    tripNumber: trip.tripNumber ? String(trip.tripNumber) : "N/A",
    driver: historyDriverName(trip.driver),
    driverPhone: reportDriverPhone(trip),
    vehicle: reportVehicleText(trip),
    vehicleType: reportVehicleType(trip),
    mobileNumber: trip.mobileNumber?.trim() || "N/A",
    from: trip.from ?? "N/A",
    to: trip.to ?? "N/A",
    customer: trip.customer ?? "N/A",
    agency: agencyRaw ? resolveAgencyLabel(agencyRaw) : "N/A",
    careOf: reportCareOf(trip),
    priority: trip.priority?.trim() || "N/A",
    notes: trip.notes?.trim() || "N/A",
    startingNote: trip.startingNote?.trim() || "N/A",
    completionNote: trip.completionNote?.trim() || "N/A",
    date: reportFmtDate(trip.startDate ?? trip.date ?? trip.createdAt),
    endDate: reportFmtDate(trip.endDate ?? trip.expectedEndDate),
    status: String(trip.status ?? "N/A").toUpperCase(),
    paymentStatus,
    isCompleted,
    distance: reportDistance(trip),
    startKilometers: reportKmReading(trip.startKilometers),
    endKilometers: reportKmReading(trip.endKilometers),
    startTime: fmtTimeAmPm(trip.startTime),
    endTime: fmtTimeAmPm(trip.endTime),
    totalKm: reportTotalKm(trip),
    totalTime: fmtTripDuration(trip.startTime, trip.endTime),
    hours: reportHours(trip),
    agencyCost: reportFmtRs(trip.agencyCost ?? 0),
    cabCost: reportFmtRs(trip.cabCost ?? 0),
    totalCabCost: reportFmtRs(trip.totalCabCost ?? expenses.totalCabCost),
    grandTotal: reportFmtRs(
      trip.grandTotal ??
        trip.paymentSummary?.totalAmount ??
        trip.cabCost ??
        trip.agencyCost ??
        0,
    ),
    driverSalary: reportFmtRs(salary.driverBata),
    personalExpenses: reportFmtRs(salary.personalExpenses),
    totalSalary: reportFmtRs(salary.totalSalary),
    agencyProfit: reportFmtRs(agencyProfit),
    fuelExpense: reportFmtRs(expenses.fuelExpense),
    extraExpenses: reportFmtRs(expenses.extraExpenses),
    advance: reportFmtRs(trip.advance ?? 0),
    paidAmount: reportFmtRs(paid),
    balance: reportFmtRs(remaining),
    toll: reportFmtRs(trip.toll ?? 0),
  };
}

/** Label shown in report for each field id. */
export function reportFieldLabel(id: ReportFieldId): string {
  const labels: Record<ReportFieldId, string> = {
    driver: "Driver:",
    driverPhone: "Driver Phone:",
    vehicle: "Vehicle:",
    vehicleType: "Vehicle Type:",
    mobileNumber: "Mobile:",
    from: "From:",
    to: "To:",
    customer: "Customer:",
    agency: "Agency:",
    careOf: "Care Of:",
    priority: "Priority:",
    notes: "Notes",
    startingNote: "Starting Note",
    completionNote: "Completion Note",
    date: "Start Date:",
    endDate: "End Date:",
    status: "Status:",
    paymentStatus: "Payment Status:",
    isCompleted: "Completed:",
    distance: "Distance:",
    startKilometers: "Starting KM:",
    endKilometers: "Ending KM:",
    startTime: "Starting Time:",
    endTime: "Ending Time:",
    totalKm: "Total KM:",
    totalTime: "Total Time:",
    hours: "Hours:",
    agencyCost: "Agency Cost",
    cabCost: "Cab Cost",
    totalCabCost: "Total Cab Cost",
    grandTotal: "Grand Total",
    driverSalary: "Driver Bata",
    personalExpenses: "Personal Expenses",
    totalSalary: "Total Salary",
    agencyProfit: "Owner Profit",
    fuelExpense: "Fuel",
    extraExpenses: "Extra Expenses",
    advance: "Advance",
    paidAmount: "Paid Amount",
    balance: "Remaining",
    toll: "Toll",
  };
  return labels[id];
}
