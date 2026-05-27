import type { ReportFieldId, ReportFieldSelection } from "./reportFieldConfig";
import { selectedFieldsInSection } from "./reportFieldConfig";
import {
  reportFieldLabel,
  type TripReportRow,
} from "./tripReportFormat";

export type ReportLine = { label: string; value: string };

export function buildReportCardLines(
  row: TripReportRow,
  selection: ReportFieldSelection,
): {
  header: ReportLine[];
  left: ReportLine[];
  middle: ReportLine[];
  right: ReportLine[];
} {
  const line = (id: ReportFieldId, label: string): ReportLine => ({
    label,
    value: row[id] ?? "N/A",
  });

  const header: ReportLine[] = [];
  if (selection.driver) {
    header.push(line("driver", reportFieldLabel("driver")));
  }
  if (selection.vehicle) {
    header.push(line("vehicle", reportFieldLabel("vehicle")));
  }

  const left = selectedFieldsInSection(selection, "left").map((f) =>
    line(f.id, reportFieldLabel(f.id)),
  );
  const middle = selectedFieldsInSection(selection, "middle").map((f) =>
    line(f.id, reportFieldLabel(f.id)),
  );
  const right = selectedFieldsInSection(selection, "right").map((f) =>
    line(f.id, reportFieldLabel(f.id)),
  );

  return { header, left, middle, right };
}

export function maxBodyLineCount(lines: {
  left: ReportLine[];
  middle: ReportLine[];
  right: ReportLine[];
}): number {
  return Math.max(lines.left.length, lines.middle.length, lines.right.length, 0);
}
