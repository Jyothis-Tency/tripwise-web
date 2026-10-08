import jsPDF from "jspdf";
import type { AgencyTxType } from "./agencyTxRows";

export type AgencyTxPdfRow = {
  date: string | null;
  amount: number;
  type: AgencyTxType | string;
  flow: "in" | "out";
  method: string;
  notes: string;
};

export type AgencyTxPdfSectionVisibility = {
  ownerName: boolean;
  companyName: boolean;
  agencyHeading: boolean;
  grandTotal: boolean;
  paid: boolean;
  remaining: boolean;
};

export type AgencyTxPdfColumnVisibility = {
  date: boolean;
  time: boolean;
  type: boolean;
  method: boolean;
  notes: boolean;
  amount: boolean;
};

export type AgencyTxPdfOptions = {
  ownerName: string;
  companyName: string;
  agencyName: string;
  sections: AgencyTxPdfSectionVisibility;
  columns: AgencyTxPdfColumnVisibility;
  types: AgencyTxType[];
  dateFrom: string;
  dateTo: string;
  summary: {
    grandTotal: number;
    paid: number;
    remaining: number;
  };
  rows: AgencyTxPdfRow[];
};

/** Plain amount — no +/- prefix. Negative values use a leading minus. */
function fmtCurrency(n: number) {
  const abs = Math.abs(n).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });
  return n < 0 ? `Rs. -${abs}` : `Rs. ${abs}`;
}

function formatDate(d?: string | null) {
  if (!d) return "-";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "-";
  return x.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(d?: string | null) {
  if (!d) return "-";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "-";
  return x.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Normalize notes for Helvetica (no unicode arrows/dots that break layout). */
function sanitizeNotes(raw: string): string {
  return String(raw || "")
    .replace(/\u2192|\u2794|\u279C|\u27A1/g, "->")
    .replace(/\u00B7|\u2022|\u2219/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

function inDateRange(
  date: string | null,
  from: string,
  to: string,
): boolean {
  if (!from && !to) return true;
  if (!date) return false;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  if (from) {
    const start = new Date(`${from}T00:00:00`).getTime();
    if (t < start) return false;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999`).getTime();
    if (t > end) return false;
  }
  return true;
}

export function downloadAgencyTransactionHistoryPdf(
  options: AgencyTxPdfOptions,
): void {
  const typeSet = new Set(options.types);
  const rows = options.rows.filter(
    (r) =>
      typeSet.has(r.type as AgencyTxType) &&
      inDateRange(r.date, options.dateFrom, options.dateTo),
  );

  const cols = options.columns;
  // Main row columns exclude notes — notes render full-width under each row.
  const mainCols = (
    [
      ["date", "Date", 28],
      ["time", "Time", 22],
      ["type", "Type", 24],
      ["method", "Method", 28],
      ["amount", "Amount", 30],
    ] as const
  ).filter(([key]) => cols[key]);

  const showNotes = cols.notes;

  if (
    mainCols.length === 0 &&
    !showNotes &&
    !Object.values(options.sections).some(Boolean)
  ) {
    throw new Error("Select at least one section or table column for the PDF.");
  }

  const doc = new jsPDF("p", "mm", "a4");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const leftX = 14;
  const rightX = pageW - 14;
  const contentW = rightX - leftX;
  const pageBottomY = pageH - 16;
  let y = 16;

  const ensureSpace = (need: number) => {
    if (y + need <= pageBottomY) return false;
    doc.addPage();
    y = 16;
    return true;
  };

  // Heading: owner + company
  const headingParts: string[] = [];
  if (options.sections.ownerName && options.ownerName.trim()) {
    headingParts.push(options.ownerName.trim());
  }
  if (options.sections.companyName && options.companyName.trim()) {
    headingParts.push(options.companyName.trim());
  }
  if (headingParts.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(headingParts.join(" - "), leftX, y);
    y += 8;
  }

  if (options.sections.agencyHeading) {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(
      `Agency Transaction History - ${options.agencyName || "Agency"}`,
      leftX,
      y,
    );
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const rangeLabel =
      options.dateFrom || options.dateTo
        ? `Table period: ${options.dateFrom || "..."} to ${options.dateTo || "..."}`
        : "Table period: All dates";
    doc.text(rangeLabel, leftX, y);
    y += 8;
  }

  const summaryBits: string[] = [];
  if (options.sections.grandTotal) {
    summaryBits.push(`Grand total: ${fmtCurrency(options.summary.grandTotal)}`);
  }
  if (options.sections.paid) {
    summaryBits.push(`Paid (Received): ${fmtCurrency(options.summary.paid)}`);
  }
  if (options.sections.remaining) {
    summaryBits.push(`Remaining: ${fmtCurrency(options.summary.remaining)}`);
  }
  if (summaryBits.length) {
    ensureSpace(14);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(leftX, y - 4, contentW, 12, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const summaryText = summaryBits.join("   |   ");
    const summaryLines = doc.splitTextToSize(summaryText, contentW - 6);
    doc.text(summaryLines, leftX + 3, y + 3);
    y += Math.max(14, summaryLines.length * 4 + 8);
  }

  if (mainCols.length > 0 || showNotes) {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Transactions (${rows.length})`, leftX, y);
    y += 6;

    // Distribute main column widths across full content width
    const colDefs = mainCols.map(([key, label, w]) => ({
      key,
      label,
      width: w as number,
    }));
    if (colDefs.length) {
      const totalFixed = colDefs.reduce((s, c) => s + c.width, 0);
      const scale = contentW / Math.max(totalFixed, 1);
      for (const c of colDefs) c.width = c.width * scale;
    }

    const drawHeader = () => {
      if (!colDefs.length) return;
      doc.setFillColor(241, 245, 249);
      doc.rect(leftX, y - 4, contentW, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      let x = leftX;
      for (const c of colDefs) {
        if (c.key === "amount") {
          doc.text(c.label, x + c.width - 1, y, { align: "right" });
        } else {
          doc.text(c.label, x + 1, y);
        }
        x += c.width;
      }
      y += 5;
      doc.setDrawColor(226, 232, 240);
      doc.line(leftX, y, rightX, y);
      y += 4;
    };

    drawHeader();

    const cellText = (
      key: (typeof colDefs)[number]["key"] | "notes",
      r: AgencyTxPdfRow,
    ): string => {
      switch (key) {
        case "date":
          return formatDate(r.date);
        case "time":
          return formatTime(r.date);
        case "type":
          return String(r.type);
        case "method":
          return String(r.method || "-").replace(/_/g, " ");
        case "notes":
          return sanitizeNotes(r.notes) || "-";
        case "amount":
          return fmtCurrency(r.amount);
        default:
          return "";
      }
    };

    for (const r of rows) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      const notesRaw = showNotes ? cellText("notes", r) : "";
      const notesLines =
        showNotes && notesRaw && notesRaw !== "-"
          ? doc.splitTextToSize(`Notes: ${notesRaw}`, contentW - 4)
          : [];

      const mainH = colDefs.length ? 5 : 0;
      const notesGap = notesLines.length ? 5.5 : 0;
      const notesH = notesLines.length ? notesLines.length * 3.8 + 2 : 0;
      const rowH = mainH + notesGap + notesH + 3;

      if (ensureSpace(rowH + 4)) {
        drawHeader();
      }

      // Main fields row
      if (colDefs.length) {
        let x = leftX;
        for (const c of colDefs) {
          const text = cellText(c.key, r);
          if (c.key === "amount") {
            doc.setTextColor(
              r.flow === "in" ? 5 : 190,
              r.flow === "in" ? 150 : 18,
              r.flow === "in" ? 105 : 60,
            );
            doc.setFont("helvetica", "bold");
            doc.text(text, x + c.width - 1, y, { align: "right" });
            doc.setFont("helvetica", "normal");
            doc.setTextColor(30, 41, 59);
          } else {
            doc.setTextColor(30, 41, 59);
            const clipped = doc.splitTextToSize(text, Math.max(6, c.width - 2));
            doc.text(clipped[0] ?? "-", x + 1, y);
          }
          x += c.width;
        }
        y += mainH;
      }

      // Full-width notes under the row — never overlaps amount/type/etc.
      if (notesLines.length) {
        y += 5.5; // gap below the main fields
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        let ly = y;
        for (const line of notesLines) {
          if (ensureSpace(5)) {
            drawHeader();
            ly = y;
          }
          doc.text(line, leftX + 1, ly);
          ly += 3.8;
        }
        y = ly + 1;
      }

      doc.setDrawColor(226, 232, 240);
      doc.line(leftX, y, rightX, y);
      y += 3;
    }

    if (rows.length === 0) {
      ensureSpace(10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        "No transactions match the selected types and date range.",
        leftX,
        y,
      );
      y += 6;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${pageCount}`, pageW / 2, pageH - 8, {
      align: "center",
    });
  }

  const agencyPart = (options.agencyName || "Agency").replace(/\s+/g, "_");
  const today = new Date().toISOString().split("T")[0];
  doc.save(`Agency_Transaction_History_${agencyPart}_${today}.pdf`);
}
