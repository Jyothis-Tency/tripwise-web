import type { HistoryTrip } from "../history/api";
import { todayIsoInAppTz } from "../../lib/datePickerUtils";
import { isInwayOwner } from "../../lib/brand";
import type { ReportHeader, ReportRunResult } from "./api";
import {
  type ReportFieldSelection,
  visibleReportFields,
} from "./reportFieldConfig";
import { toTripReportRow } from "./tripReportFormat";

function escapeCsvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatCellValue(
  value: unknown,
  type: ReportHeader["type"],
): string {
  if (value == null || value === "") return "";
  if (type === "date" && typeof value === "string") {
    try {
      const raw = value.trim();
      const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ymd) {
        return new Date(
          Number(ymd[1]),
          Number(ymd[2]) - 1,
          Number(ymd[3]),
        ).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }
    } catch {
      /* keep raw */
    }
  }
  if (type === "currency" || type === "number") {
    const n = Number(value);
    if (Number.isFinite(n)) return String(n);
  }
  return String(value);
}

export function downloadReportCsv(
  result: ReportRunResult,
  filename?: string,
): void {
  const lines: string[] = [];
  const headers = result.headers.map((h) => escapeCsvCell(h.label));
  lines.push(headers.join(","));

  for (const row of result.rows) {
    lines.push(
      result.headers
        .map((h) => escapeCsvCell(formatCellValue(row[h.id], h.type)))
        .join(","),
    );
  }

  const totalsRow = result.headers.map((h) => {
    const t = result.totals[h.id];
    if (t != null && (h.type === "currency" || h.type === "number")) {
      return escapeCsvCell(t);
    }
    return h.id === result.headers[0]?.id ? escapeCsvCell("TOTAL") : "";
  });
  if (Object.keys(result.totals).length > 0) {
    lines.push(totalsRow.join(","));
  }

  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = todayIsoInAppTz();
  const prefix = isInwayOwner() ? "inway-cabs" : "tripwise";
  a.href = url;
  a.download = filename ?? `${prefix}-report-${result.dataSource}-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** CSV for trip-card reports (selected fields). */
export function downloadTripReportCsv(
  trips: HistoryTrip[],
  fieldSelection: ReportFieldSelection,
  opts?: {
    tripSource?: "vehicle" | "bulk";
    resolveAgencyLabel?: (agencyName?: string) => string;
    filename?: string;
  },
): void {
  if (!trips.length) {
    throw new Error("No trips to export.");
  }
  const tripSource = opts?.tripSource ?? "vehicle";
  const resolveAgencyLabel = opts?.resolveAgencyLabel ?? ((n) => n ?? "N/A");
  const fields = visibleReportFields(tripSource).filter(
    (f) => fieldSelection[f.id] && f.id !== "reportTotals",
  );
  if (fields.length === 0) {
    throw new Error("Select at least one report field.");
  }

  const headers = ["Trip #", ...fields.map((f) => f.label)];
  const lines = [headers.map(escapeCsvCell).join(",")];

  for (const trip of trips) {
    const row = toTripReportRow(trip, resolveAgencyLabel);
    lines.push(
      [row.tripNumber, ...fields.map((f) => row[f.id])]
        .map(escapeCsvCell)
        .join(","),
    );
  }

  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = todayIsoInAppTz();
  const prefix = isInwayOwner() ? "inway-cabs" : "tripwise";
  a.href = url;
  a.download = opts?.filename ?? `${prefix}-trips-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
