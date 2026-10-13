import type { HistoryParams } from "../history/api";
import type { ReportEntityFilter } from "./components/ReportEntitySearch";

export type ReportDateFilter = {
  filterMode: "month" | "daterange";
  month: string;
  startDate: string;
  endDate: string;
};

const VEHICLE_TRIP_STATUSES = new Set([
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);
/** AgencyTrip / bulk entry statuses (not vehicle trip lifecycle). */
const BULK_TRIP_STATUSES = new Set([
  "draft",
  "pending",
  "converted",
  "cancelled",
]);
const PAYMENT_STATUSES = new Set(["paid", "partial", "unpaid"]);

/**
 * Build History API params.
 * Trip status and payment status are separate filters.
 * When only payment status is set, it is sent as `status` (backend legacy).
 * When both are set, trip status goes to `status` and payment to `paymentStatus`.
 * Bulk entries use pending/converted/… — vehicle statuses like "completed" are ignored.
 */
export function buildTripReportHistoryParams(
  entity: ReportEntityFilter | null,
  tripStatus: string,
  dates: ReportDateFilter,
  opts?: {
    page?: number;
    limit?: number;
    tripSource?: "vehicle" | "bulk";
    paymentStatus?: string;
  },
): HistoryParams {
  const tripSource = opts?.tripSource ?? "vehicle";
  const paymentStatus =
    opts?.paymentStatus && opts.paymentStatus !== "all"
      ? opts.paymentStatus
      : "";
  const allowedStatuses =
    tripSource === "bulk" ? BULK_TRIP_STATUSES : VEHICLE_TRIP_STATUSES;
  const hasTrip =
    tripStatus && tripStatus !== "all" && allowedStatuses.has(tripStatus);
  const hasPayment =
    paymentStatus && PAYMENT_STATUSES.has(paymentStatus);

  const params: HistoryParams = {
    page: opts?.page ?? 1,
    limit: opts?.limit ?? 20,
    sortBy: "startDate",
    sortOrder: "desc",
    tripSource,
  };

  if (hasTrip && hasPayment) {
    params.status = tripStatus;
    params.paymentStatus = paymentStatus;
  } else if (hasTrip) {
    params.status = tripStatus;
  } else if (hasPayment) {
    // Backend treats paid/partial/unpaid on the status query as payment filter
    params.status = paymentStatus;
  } else if (tripSource === "bulk") {
    // Omit status so backend returns all non-cancelled bulk rows
    params.status = "all";
  }

  if (dates.filterMode === "month" && dates.month && dates.month !== "all_time") {
    params.month = dates.month;
  } else if (dates.filterMode === "daterange") {
    if (dates.startDate) params.startDate = dates.startDate;
    if (dates.endDate) params.endDate = dates.endDate;
  }

  if (entity) {
    switch (entity.type) {
      case "driver":
        params.driver = entity.id;
        break;
      case "vehicle":
        params.vehicle = entity.id;
        break;
      case "agency":
        params.agencyName = entity.name;
        break;
      case "trip":
        params.search = entity.tripNumber;
        break;
    }
  }

  return params;
}

export function reportFilterSubtitle(
  entity: ReportEntityFilter | null,
  dates: ReportDateFilter,
  extras?: { tripStatus?: string; paymentStatus?: string },
): string {
  const parts: string[] = [];
  if (entity) {
    const kind =
      entity.type === "trip"
        ? "Trip"
        : entity.type.charAt(0).toUpperCase() + entity.type.slice(1);
    parts.push(`${kind}: ${entity.label}`);
  }
  if (dates.filterMode === "month" && dates.month && dates.month !== "all_time") {
    const [y, m] = dates.month.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    parts.push(
      d.toLocaleString("en-IN", { month: "long", year: "numeric" }),
    );
  } else if (dates.filterMode === "daterange" && dates.startDate && dates.endDate) {
    parts.push(`${dates.startDate} – ${dates.endDate}`);
  }
  if (extras?.tripStatus && extras.tripStatus !== "all") {
    parts.push(extras.tripStatus.replace(/_/g, " "));
  }
  if (extras?.paymentStatus && extras.paymentStatus !== "all") {
    parts.push(extras.paymentStatus);
  }
  return parts.join(" · ");
}
