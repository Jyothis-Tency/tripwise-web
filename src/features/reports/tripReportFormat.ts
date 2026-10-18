import type { HistoryTrip } from "../history/api";
import { historyDriverName, historyVehicleNumber } from "../history/historyTripDisplay";
import { fmtTimeAmPm, fmtTripDuration } from "../history/historyTimeUtils";
import {
  computeDriverSalaryBreakdown,
  getHistoryTripExpenseBreakdown,
  resolveTripAgencyProfitDisplay,
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

function isBulkAgencyTrip(trip: HistoryTrip): boolean {
  // Bulk rows always have an explicit grandTotal from AgencyTrip mapping.
  // Do not treat vehicle paymentSummary.totalAmount as grandTotal.
  return trip.grandTotal != null && Number.isFinite(Number(trip.grandTotal));
}

function resolveReportOwnerProfit(trip: HistoryTrip): number {
  // Bulk: stored commission margin (agencyProfit), else outstanding (grandTotal − advance).
  if (isBulkAgencyTrip(trip)) {
    if (trip.agencyProfit != null && Number.isFinite(Number(trip.agencyProfit))) {
      return Math.max(Number(trip.agencyProfit), 0);
    }
    const gt = Number(trip.grandTotal) || 0;
    const adv = Number(trip.advance) || 0;
    if (trip.balanceAmount != null && Number.isFinite(Number(trip.balanceAmount))) {
      return Math.max(Number(trip.balanceAmount), 0);
    }
    return Math.max(gt - adv, 0);
  }
  // Vehicle: agencyCost − (cabCost + non-fuel extras incl. tolls).
  return resolveTripAgencyProfitDisplay(trip);
}

/** Paid / remaining / status — vehicle prefers cash-in (History Pay); bulk uses advance/balance. */
function resolveReportPaymentFields(trip: HistoryTrip): {
  paid: number;
  remaining: number;
  paymentStatus: string;
} {
  if (trip.cashInSummary != null) {
    const raw = trip.cashInSummary.status ?? "";
    return {
      paid: Number(trip.cashInSummary.paid) || 0,
      remaining: Number(trip.cashInSummary.remaining) || 0,
      paymentStatus: raw
        ? String(raw).replace(/_/g, " ").toUpperCase()
        : "N/A",
    };
  }

  if (isBulkAgencyTrip(trip)) {
    const paid =
      Number(
        trip.paidAmount ?? trip.paymentSummary?.paidAmount ?? trip.advance ?? 0,
      ) || 0;
    const remaining =
      trip.balanceAmount != null
        ? Number(trip.balanceAmount) || 0
        : trip.paymentSummary?.remainingBalance != null
          ? Number(trip.paymentSummary.remainingBalance) || 0
          : Math.max(
              (Number(trip.grandTotal) || 0) - (Number(trip.advance) || 0),
              0,
            );
    const raw = trip.paymentSummary?.paymentStatus ?? "";
    return {
      paid,
      remaining,
      paymentStatus: raw
        ? String(raw).replace(/_/g, " ").toUpperCase()
        : "N/A",
    };
  }

  // Vehicle without cashInSummary: match History TripCard (due = owner profit).
  const due = resolveTripAgencyProfitDisplay(trip);
  return { paid: 0, remaining: due, paymentStatus: "UNPAID" };
}

export function toTripReportRow(
  trip: HistoryTrip,
  resolveAgencyLabel: (agencyName?: string) => string,
): TripReportRow {
  const agencyRaw = trip.agencyName ?? "";

  const expenses = getHistoryTripExpenseBreakdown(trip);
  // Vehicle: agencyCost − (cabCost + non-fuel extras). Bulk: commission margin or outstanding.
  const agencyProfit = resolveReportOwnerProfit(trip);

  const salary = computeDriverSalaryBreakdown(trip);

  const { paid, remaining, paymentStatus } = resolveReportPaymentFields(trip);

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
    // Always cabCost + non-fuel extras (tolls, parking, …) — never a stale trip.totalCabCost.
    totalCabCost: reportFmtRs(expenses.totalCabCost),
    grandTotal: reportFmtRs(
      isBulkAgencyTrip(trip)
        ? trip.grandTotal ?? 0
        : trip.paymentSummary?.totalAmount ??
            trip.agencyCost ??
            trip.cabCost ??
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
