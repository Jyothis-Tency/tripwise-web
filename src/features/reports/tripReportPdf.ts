import jsPDF from "jspdf";
import type { HistoryTrip } from "../history/api";
import type { ReportFieldSelection } from "./reportFieldConfig";
import {
  buildReportCardLines,
  maxBodyLineCount,
} from "./tripReportCardLayout";
import { reportFmtDate, toTripReportRow } from "./tripReportFormat";

export type TripReportPdfOptions = {
  title?: string;
  subtitle?: string;
  resolveAgencyLabel?: (agencyName?: string) => string;
  fieldSelection: ReportFieldSelection;
};

export function downloadTripReportPdf(
  trips: HistoryTrip[],
  options: TripReportPdfOptions,
): void {
  if (!trips.length) {
    throw new Error("No trips to export.");
  }

  const title = options.title ?? "Trip Report";
  const resolveAgencyLabel = options.resolveAgencyLabel ?? ((n) => n ?? "N/A");
  const fieldSelection = options.fieldSelection;

  const doc = new jsPDF("p", "mm", "a4");
  const leftX = 14;
  const rightX = 196;
  const pageBottomY = 280;
  let y = 16;

  const fmtDate = reportFmtDate;
  const pageWidth = rightX - leftX;
  const lineH = 5;

  const textWidth = (txt: string): number => doc.getTextWidth(txt);

  const truncateToWidth = (txt: string, maxW: number): string => {
    const s = String(txt ?? "");
    if (textWidth(s) <= maxW) return s;
    const ell = "…";
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const candidate = s.slice(0, mid).trimEnd() + ell;
      if (textWidth(candidate) <= maxW) lo = mid + 1;
      else hi = mid;
    }
    const cut = Math.max(0, lo - 1);
    return s.slice(0, cut).trimEnd() + ell;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageBottomY) return;
    doc.addPage();
    y = 16;
  };

  const writeText = (
    text: string,
    x: number,
    yPos: number,
    opts?: { size?: number; bold?: boolean; color?: [number, number, number] },
  ) => {
    const size = opts?.size ?? 10;
    const bold = opts?.bold ?? false;
    const color = opts?.color ?? [15, 23, 42];
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(text, x, yPos);
  };

  const writeDetailRow = (
    label: string,
    value: string,
    x: number,
    yPos: number,
    maxValueW: number,
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const labelW = Math.max(18, textWidth(label) + 2);
    writeText(label, x, yPos, { size: 9, bold: true });
    writeText(truncateToWidth(value, maxValueW), x + labelW, yPos, {
      size: 9,
      bold: false,
    });
  };

  writeText(title, leftX, y, { size: 18, bold: true });
  const totalTripsText = `Total Trips: ${trips.length}`;
  writeText(totalTripsText, rightX - textWidth(totalTripsText), y, {
    size: 11,
    bold: true,
  });
  y += 7;
  writeText(`Generated on: ${fmtDate(new Date())}`, leftX, y, {
    size: 10,
    color: [51, 65, 85],
  });
  y += 6;
  if (options.subtitle?.trim()) {
    writeText(options.subtitle.trim(), leftX, y, {
      size: 10,
      color: [71, 85, 105],
    });
    y += 6;
  }
  y += 3;

  doc.setDrawColor(60, 60, 60);
  doc.line(leftX, y, rightX, y);
  y += 12;

  writeText("Trip Details", leftX, y, { size: 14, bold: true });
  y += 8;

  trips.forEach((trip, idx) => {
    const row = toTripReportRow(trip, resolveAgencyLabel);
    const lines = buildReportCardLines(row, fieldSelection);
    const bodyRows = maxBodyLineCount(lines);

    const cardPadX = 3;
    const colTripX = leftX + cardPadX;
    const colDriverX = leftX + 86;
    const colVehicleX = leftX + 136;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    let extraHeaderH = 0;
    const vehicleLine = lines.header.find((h) => h.label.startsWith("Vehicle"));
    if (vehicleLine) {
      const vehicleValX = colVehicleX + textWidth("Vehicle:") + 3;
      const vehicleMaxW = rightX - cardPadX - vehicleValX;
      const vehicleLines = doc
        .splitTextToSize(String(vehicleLine.value), Math.max(10, vehicleMaxW))
        .slice(0, 2) as string[];
      extraHeaderH = Math.max(0, vehicleLines.length - 1) * 4.6;
    }

    const bodyH = Math.max(0, bodyRows - 1) * lineH;
    const cardH = 22 + extraHeaderH + bodyH + (bodyRows > 0 ? 12 : 4);

    ensureSpace(cardH + 6);

    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(leftX, y - 2, pageWidth, cardH, 2, 2, "S");

    const headerY = y + 4;
    writeText(`Trip ${idx + 1}: ${row.tripNumber}`, colTripX, headerY, {
      size: 10,
      bold: true,
    });

    const driverLine = lines.header.find((h) => h.label.startsWith("Driver"));
    if (driverLine) {
      writeText("Driver:", colDriverX, headerY, { size: 9, bold: true });
      const driverValX = colDriverX + textWidth("Driver:") + 3;
      const driverMaxW = colVehicleX - driverValX - 2;
      writeText(
        truncateToWidth(driverLine.value, driverMaxW),
        driverValX,
        headerY,
        { size: 9 },
      );
    }

    if (vehicleLine) {
      writeText("Vehicle:", colVehicleX, headerY, { size: 9, bold: true });
      const vehicleValX = colVehicleX + textWidth("Vehicle:") + 3;
      const vehicleMaxW = rightX - cardPadX - vehicleValX;
      const vehicleLines = doc
        .splitTextToSize(String(vehicleLine.value), Math.max(10, vehicleMaxW))
        .slice(0, 2) as string[];
      vehicleLines.forEach((ln, i) => {
        writeText(ln, vehicleValX, headerY + i * 4.6, { size: 9 });
      });
    }

    if (bodyRows > 0) {
      doc.setDrawColor(220, 220, 220);
      const dividerY = y + 7 + extraHeaderH;
      doc.line(leftX + 3, dividerY, rightX - 3, dividerY);

      const rowY1 = dividerY + 5;
      const leftColX = leftX + 3;
      const midColX = leftX + 82;
      const rightColX = leftX + 132;
      const leftValMaxW = midColX - (leftColX + 26) - 4;
      const midValMaxW = rightColX - (midColX + 26) - 4;

      for (let i = 0; i < bodyRows; i++) {
      const yRow = rowY1 + i * lineH;
      const leftLn = lines.left[i];
      const midLn = lines.middle[i];
      const rightLn = lines.right[i];

      if (leftLn) {
        writeDetailRow(
          leftLn.label,
          leftLn.value,
          leftColX,
          yRow,
          leftValMaxW,
        );
      }
      if (midLn) {
        writeDetailRow(midLn.label, midLn.value, midColX, yRow, midValMaxW);
      }
      if (rightLn) {
        if (rightLn.label === "Cab Cost") {
          writeText("Cab Cost", rightColX, yRow, { size: 9, bold: true });
          writeText(
            String(rightLn.value),
            rightColX + textWidth("Cab Cost") + 4,
            yRow,
            { size: 9 },
          );
        } else {
          writeDetailRow(
            rightLn.label,
            rightLn.value,
            rightColX,
            yRow,
            rightX - rightColX - 8,
          );
        }
      }
      }
    }

    y += cardH + 6;
  });

  const today = fmtDate(new Date()).replaceAll("/", "-");
  const safeTitle = title.replace(/[^\w\s-]/g, "").trim() || "Trip-Report";
  doc.save(`${safeTitle} ${today}.pdf`);
}
