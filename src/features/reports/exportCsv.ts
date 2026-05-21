import type { ReportHeader, ReportRunResult } from "./api";

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
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString("en-IN", {
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
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = filename ?? `tripwise-report-${result.dataSource}-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
