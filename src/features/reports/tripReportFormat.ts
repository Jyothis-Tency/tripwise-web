import type { HistoryTrip } from "../history/api";
import { historyDriverName, historyVehicleNumber } from "../history/historyTripDisplay";
import { fmtTimeAmPm, fmtTripDuration } from "../history/historyTimeUtils";
import type { ReportFieldId } from "./reportFieldConfig";

export function reportFmtDate(raw: unknown): string {
  const dt = raw ? new Date(String(raw)) : null;
  if (!dt || Number.isNaN(dt.getTime())) return "N/A";
  return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
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

export function toTripReportRow(
  trip: HistoryTrip,
  resolveAgencyLabel: (agencyName?: string) => string,
): TripReportRow {
  const agencyRaw = trip.agencyName ?? "";
  const startKm =
    trip.startKilometers != null && Number.isFinite(Number(trip.startKilometers))
      ? `${trip.startKilometers} km`
      : "N/A";

  return {
    tripNumber: trip.tripNumber ? String(trip.tripNumber) : "N/A",
    driver: historyDriverName(trip.driver),
    vehicle: reportVehicleText(trip),
    from: trip.from ?? "N/A",
    to: trip.to ?? "N/A",
    customer: trip.customer ?? "N/A",
    agency: agencyRaw ? resolveAgencyLabel(agencyRaw) : "N/A",
    date: reportFmtDate(trip.startDate ?? trip.date ?? trip.createdAt),
    status: String(trip.status ?? "N/A").toUpperCase(),
    distance: reportDistance(trip),
    startKilometers: startKm,
    startTime: fmtTimeAmPm(trip.startTime),
    totalKm: reportTotalKm(trip),
    totalTime: fmtTripDuration(trip.startTime, trip.endTime),
    cabCost: reportFmtRs(trip.cabCost ?? 0),
  };
}

/** Label shown in report for each field id. */
export function reportFieldLabel(id: ReportFieldId): string {
  const labels: Record<ReportFieldId, string> = {
    driver: "Driver:",
    vehicle: "Vehicle:",
    from: "From:",
    to: "To:",
    customer: "Customer:",
    agency: "Agency:",
    date: "Date:",
    status: "Status:",
    distance: "Distance:",
    startKilometers: "Starting KM:",
    startTime: "Starting Time:",
    totalKm: "Total KM:",
    totalTime: "Total Time:",
    cabCost: "Cab Cost",
  };
  return labels[id];
}
