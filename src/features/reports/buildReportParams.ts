import type { HistoryParams } from "../history/api";
import type { ReportEntityFilter } from "./components/ReportEntitySearch";

export type ReportDateFilter = {
  filterMode: "month" | "daterange";
  month: string;
  startDate: string;
  endDate: string;
};

export function buildTripReportHistoryParams(
  entity: ReportEntityFilter | null,
  status: string,
  dates: ReportDateFilter,
  opts?: { page?: number; limit?: number },
): HistoryParams {
  const params: HistoryParams = {
    page: opts?.page ?? 1,
    limit: opts?.limit ?? 20,
    status: status === "all" ? undefined : status,
    sortBy: "startDate",
    sortOrder: "desc",
  };

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
  return parts.join(" · ");
}
