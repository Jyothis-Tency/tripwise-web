import jsPDF from "jspdf";
import {
  DEFAULT_INWAY_CONFIRMATION_DATA,
  type ConfirmationTableRow,
  type TripConfirmationDocument,
} from "./types";
import { TRIP_CONFIRMATION_SEED, type TripConfirmationSeed } from "./seed";
import {
  createInwayLogoPngDataUrl,
  createInwayWatermarkPngDataUrl,
  createTripwiseLogoPngDataUrl,
  isInwayOwner,
} from "../../lib/brand";

export * from "./types";

export type TemplateField = {
  id: string;
  label: string;
  value: string;
};

export type TemplateBlock =
  | {
      id: string;
      type: "heading";
      text: string;
      style: "company" | "title" | "section";
    }
  | {
      id: string;
      type: "fields";
      fields: TemplateField[];
    }
  | {
      id: string;
      type: "text";
      text: string;
      bold?: boolean;
      underline?: boolean;
    }
  | {
      id: string;
      type: "list";
      title: string;
      items: string[];
    }
  | {
      id: string;
      type: "pageBreak";
    };

export type TripConfirmationTemplate = {
  blocks: TemplateBlock[];
};

export type SimpleField = {
  label: string;
  value: string;
};

export type SimpleTripTemplate = {
  companyName: string;
  subtitle?: string;
  documentTitle: string;
  packagePriceHeading: string;
  tripDetailsHeading: string;
  bookingHeading: string;
  paymentHeading: string;
  tripFields: SimpleField[];
  routeText: string;
  packageIncludesTitle: string;
  packageIncludesItems: string[];
  packagePrice: string;
  extraKm: SimpleField;
  tripDetailFields: SimpleField[];
  advance: SimpleField;
  bookingNote: string;
  bookingSubNote: string;
  paymentFields: SimpleField[];
  bankLines: string[];
  vehicleAvailableSentence: string;
  footerBrand: string;
  footerTagline: string;
  footerContact?: string;
};

const LS_KEY_DOC = "tripwise.tripConfirmation.doc.v6";
const LS_KEY_SIMPLE = "tripwise.tripConfirmation.simple.v4";

function nid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newField(label = "Field", value = ""): TemplateField {
  return { id: nid("f"), label, value };
}

export function newRow(label = "", value = "", isBold = false): ConfirmationTableRow {
  return { id: nid("row"), label, value, isBold };
}

/**
 * Converts a legacy SimpleTripTemplate into the new unified TripConfirmationDocument.
 */
export function simpleToConfirmationDocument(
  s: SimpleTripTemplate,
): TripConfirmationDocument {
  const base = structuredClone(DEFAULT_INWAY_CONFIRMATION_DATA);

  base.companyName = s.companyName || base.companyName;
  if (s.subtitle) base.subtitle = s.subtitle;
  base.documentTitle = s.documentTitle || base.documentTitle;
  base.preBookingNote = s.vehicleAvailableSentence || base.preBookingNote;
  base.footerBrand = (s.footerBrand || base.footerBrand).replace(/^[★*•\s]+/, "");
  base.footerTagline = s.footerTagline || base.footerTagline;
  if (s.footerContact) base.footerContact = s.footerContact;

  // 1. Overview
  if (s.tripFields && s.tripFields.length > 0) {
    base.sections[0].rows = s.tripFields.map((f) => ({
      id: nid("ov"),
      label: f.label,
      value: f.value,
      isBold: /vehicle/i.test(f.label),
    }));
  }

  // 2. Package Price
  const pkgRows: ConfirmationTableRow[] = [];
  pkgRows.push({
    id: nid("pr"),
    label: "Package Price",
    value: s.packagePrice || "35500/-",
    isBold: true,
  });
  const incl =
    s.packageIncludesItems?.join(", ") ||
    (s.packageIncludesTitle ? s.packageIncludesTitle : "Tolls parking driver exp and fuel");
  pkgRows.push({
    id: nid("pr"),
    label: "Package includes",
    value: incl,
  });
  pkgRows.push({
    id: nid("pr"),
    label: s.extraKm?.label || "Extra km",
    value: s.extraKm?.value || "30",
  });
  base.sections[1].rows = pkgRows;

  // 3. Trip Details
  if (s.tripDetailFields && s.tripDetailFields.length > 0) {
    base.sections[2].rows = s.tripDetailFields.map((f) => ({
      id: nid("td"),
      label: f.label,
      value: f.value,
    }));
  }

  // 4. Booking Confirmation
  base.sections[3].rows = [
    {
      id: nid("bk"),
      label: s.advance?.label || "Advance",
      value: s.advance?.value || "5000/-",
      isBold: true,
    },
    {
      id: nid("bk"),
      label: "Confirmation",
      value: s.bookingNote || "Booking will be confirmed upon receipt of the advance.",
    },
    {
      id: nid("bk"),
      label: "Balance",
      value: s.bookingSubNote || "Payable directly to the driver before completion of the trip.",
    },
  ];

  // 5. Payment Details
  const payRows: ConfirmationTableRow[] = [];
  if (s.paymentFields && s.paymentFields.length > 0) {
    for (const f of s.paymentFields) {
      payRows.push({
        id: nid("py"),
        label: f.label,
        value: f.value,
        isBold: /account name|a\/c/i.test(f.label),
      });
    }
  }
  if (s.bankLines && s.bankLines.length > 0) {
    for (const line of s.bankLines) {
      if (!line.trim()) continue;
      if (line.includes(":")) {
        const [k, ...v] = line.split(":");
        payRows.push({
          id: nid("py"),
          label: k.trim(),
          value: v.join(":").trim(),
        });
      } else {
        payRows.push({
          id: nid("py"),
          label: "Bank",
          value: line.trim(),
        });
      }
    }
  }
  if (payRows.length > 0) {
    base.sections[4].rows = payRows;
  }

  return base;
}

/**
 * Converts a TripConfirmationDocument back into SimpleTripTemplate for legacy storage/API.
 */
export function confirmationDocumentToSimple(
  doc: TripConfirmationDocument,
): SimpleTripTemplate {
  const overview = doc.sections.find((s) => s.id === "overview")?.rows || [];
  const price = doc.sections.find((s) => s.id === "price")?.rows || [];
  const details = doc.sections.find((s) => s.id === "details")?.rows || [];
  const booking = doc.sections.find((s) => s.id === "booking")?.rows || [];
  const payment = doc.sections.find((s) => s.id === "payment")?.rows || [];

  const pkgPriceRow = price.find((r) => /price/i.test(r.label));
  const pkgInclRow = price.find((r) => /include/i.test(r.label));
  const extraKmRow = price.find((r) => /extra/i.test(r.label));

  const advRow = booking.find((r) => /advance/i.test(r.label));
  const confirmRow = booking.find((r) => /confirm/i.test(r.label));
  const balanceRow = booking.find((r) => /balance/i.test(r.label));

  return {
    companyName: doc.companyName,
    subtitle: doc.subtitle,
    documentTitle: doc.documentTitle,
    packagePriceHeading: doc.sections[1]?.title || "PACKAGE PRICE",
    tripDetailsHeading: doc.sections[2]?.title || "TRIP DETAILS",
    bookingHeading: doc.sections[3]?.title || "BOOKING CONFIRMATION",
    paymentHeading: doc.sections[4]?.title || "PAYMENT DETAILS",
    tripFields: overview.map((r) => ({ label: r.label, value: r.value })),
    routeText: "",
    packageIncludesTitle: "Package includes",
    packageIncludesItems: pkgInclRow?.value ? [pkgInclRow.value] : [],
    packagePrice: pkgPriceRow?.value || "",
    extraKm: {
      label: extraKmRow?.label || "Extra km",
      value: extraKmRow?.value || "",
    },
    tripDetailFields: details.map((r) => ({ label: r.label, value: r.value })),
    advance: {
      label: advRow?.label || "Advance",
      value: advRow?.value || "",
    },
    bookingNote: confirmRow?.value || "",
    bookingSubNote: balanceRow?.value || "",
    paymentFields: payment.map((r) => ({ label: r.label, value: r.value })),
    bankLines: [],
    vehicleAvailableSentence: doc.preBookingNote,
    footerBrand: doc.footerBrand,
    footerTagline: doc.footerTagline,
    footerContact: doc.footerContact,
  };
}

export function loadTripConfirmationDocument(): TripConfirmationDocument {
  try {
    const raw = localStorage.getItem(LS_KEY_DOC);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sections)) {
        return parsed as TripConfirmationDocument;
      }
    }
    const legacy = localStorage.getItem(LS_KEY_SIMPLE);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (parsed && typeof parsed.companyName === "string") {
        return simpleToConfirmationDocument(parsed);
      }
    }
  } catch {}
  return structuredClone(DEFAULT_INWAY_CONFIRMATION_DATA);
}

export function saveTripConfirmationDocument(
  doc: TripConfirmationDocument,
): TripConfirmationDocument {
  try {
    localStorage.setItem(LS_KEY_DOC, JSON.stringify(doc));
    const simple = confirmationDocumentToSimple(doc);
    localStorage.setItem(LS_KEY_SIMPLE, JSON.stringify(simple));
  } catch {}
  return doc;
}

export function loadSimpleTripTemplate(): SimpleTripTemplate {
  const doc = loadTripConfirmationDocument();
  return confirmationDocumentToSimple(doc);
}

export function saveSimpleTripTemplate(simple: SimpleTripTemplate) {
  const doc = simpleToConfirmationDocument(simple);
  saveTripConfirmationDocument(doc);
  return simple;
}

export function applyTripConfirmationSeed(): TripConfirmationTemplate {
  saveTripConfirmationDocument(structuredClone(DEFAULT_INWAY_CONFIRMATION_DATA));
  return simpleToTemplate(confirmationDocumentToSimple(DEFAULT_INWAY_CONFIRMATION_DATA));
}

export function loadTripConfirmationDefaults(): TripConfirmationTemplate {
  return simpleToTemplate(loadSimpleTripTemplate());
}

export function saveTripConfirmationDefaults(data: TripConfirmationTemplate) {
  const simple = templateToSimple(data);
  saveSimpleTripTemplate(simple);
}

export function templateToSimpleFromSeed(
  _seed: TripConfirmationSeed = TRIP_CONFIRMATION_SEED,
): SimpleTripTemplate {
  return confirmationDocumentToSimple(DEFAULT_INWAY_CONFIRMATION_DATA);
}

export function templateToSimple(
  _data: TripConfirmationTemplate,
): SimpleTripTemplate {
  return loadSimpleTripTemplate();
}

export function simpleToTemplate(
  s: SimpleTripTemplate,
): TripConfirmationTemplate {
  const doc = simpleToConfirmationDocument(s);
  const blocks: TemplateBlock[] = [
    { id: nid("h"), type: "heading", text: doc.companyName, style: "company" },
    { id: nid("h"), type: "heading", text: doc.documentTitle, style: "title" },
  ];

  for (const sec of doc.sections) {
    blocks.push({ id: nid("h"), type: "heading", text: sec.title, style: "section" });
    blocks.push({
      id: nid("f"),
      type: "fields",
      fields: sec.rows.map((r) => ({ id: r.id, label: r.label, value: r.value })),
    });
  }

  return { blocks };
}

/**
 * Generates the official Trip Confirmation PDF matching the exact new design.
 */
export function generateTripConfirmationPdf(
  inputData: TripConfirmationDocument | TripConfirmationTemplate,
) {
  const docData: TripConfirmationDocument =
    "sections" in inputData
      ? inputData
      : simpleToConfirmationDocument(templateToSimple(inputData));

  const doc = new jsPDF("p", "mm", "a4");
  const pageW = doc.internal.pageSize.getWidth(); // 210mm
  const pageH = doc.internal.pageSize.getHeight(); // 297mm
  const left = 16;
  const right = pageW - 16; // 194mm
  const tableW = right - left; // 178mm
  const labelColW = 54;
  const valColW = tableW - labelColW; // 124mm

  const inway = isInwayOwner();

  // Background: Large Translucent Logo Watermark (Inway Cabs only)
  const watermarkData = inway ? createInwayWatermarkPngDataUrl(600, 0.085) : "";
  const drawWatermark = () => {
    if (watermarkData) {
      const wmSize = 135;
      const wmX = (pageW - wmSize) / 2;
      const wmY = (pageH - wmSize) / 2 + 5;
      doc.addImage(watermarkData, "PNG", wmX, wmY, wmSize, wmSize);
    }
  };
  drawWatermark();

  let y = 14;

  // 1. Letterhead Format Header
  // Left: Brand Logo + Name & Subtitle
  const logoData = inway
    ? createInwayLogoPngDataUrl(400)
    : createTripwiseLogoPngDataUrl(400);
  const logoSize = 13;
  if (logoData) {
    doc.addImage(logoData, "PNG", left, y, logoSize, logoSize);
  }

  const textLeft = logoData ? left + logoSize + 3.5 : left;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text((docData.companyName || "INWAY CABS").toUpperCase(), textLeft, y + 5.5);

  if (docData.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(docData.subtitle, textLeft, y + 10);
  }

  // Right: Contact details & website
  const contactLines = docData.footerContact
    ? docData.footerContact.split(/[·•|]/).map((s) => s.trim()).filter(Boolean)
    : ["+91 80865 56655", "inwaycabs@gmail.com", "inwaycabs.in"];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  let contactY = y + 3.2;
  for (const line of contactLines) {
    doc.text(line, right, contactY, { align: "right" });
    contactY += 3.8;
  }

  y = Math.max(y + logoSize + 2, contactY + 1);

  // 2. Horizontal Divider Line
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.45);
  doc.line(left, y, right, y);
  y += 4.5;

  // 3. Document Title (Centered)
  if (docData.documentTitle) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(docData.documentTitle.toUpperCase(), pageW / 2, y, {
      align: "center",
    });
    y += 4.5;
  }

  // 5. Sections
  for (const section of docData.sections) {
    if (!section.rows.length) continue;

    // Check if new page needed
    if (y + 25 > pageH - 25) {
      doc.addPage();
      drawWatermark();
      y = 16;
    }

    // Black Banner
    const bannerH = 6.2;
    doc.setFillColor(24, 24, 27);
    doc.rect(left, y, tableW, bannerH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(section.title.toUpperCase(), left + 3.2, y + 4.3);
    y += bannerH;

    // Table rows
    for (const row of section.rows) {
      const valStr = String(row.value ?? "").trim();
      const valLines = doc.splitTextToSize(
        valStr || "—",
        valColW - 6,
      ) as string[];

      const rowH = Math.max(5.8, valLines.length * 3.8 + 2.4);

      if (y + rowH > pageH - 25) {
        doc.addPage();
        drawWatermark();
        y = 16;
      }

      // Border outline & column separator
      doc.setDrawColor(209, 213, 219);
      doc.setLineWidth(0.2);
      doc.rect(left, y, tableW, rowH);
      doc.line(left + labelColW, y, left + labelColW, y + rowH);

      // Label (Left Column)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(row.label, left + 3, y + 4.2);

      // Value (Right Column)
      doc.setFont("helvetica", row.isBold ? "bold" : "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);

      let textY = y + 4.2;
      for (const line of valLines) {
        doc.text(line, left + labelColW + 3, textY);
        textY += 3.8;
      }

      y += rowH;
    }

    y += 3.5; // Gap between sections
  }

  // 6. Pre-booking Note
  if (docData.preBookingNote) {
    if (y + 20 > pageH - 15) {
      doc.addPage();
      drawWatermark();
      y = 16;
    }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(docData.preBookingNote, pageW / 2, y + 1.5, { align: "center" });
    y += 5.5;
  }

  // 7. Bottom Solid Divider
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.45);
  doc.line(left, y, right, y);
  y += 5;

  // 8. Footer (Brand, Tagline, Contact)
  if (docData.footerBrand) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(docData.footerBrand.toUpperCase(), pageW / 2, y, {
      align: "center",
    });
    y += 4.5;
  }
  if (docData.footerTagline) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(docData.footerTagline, pageW / 2, y, { align: "center" });
    y += 3.8;
  }
  if (docData.footerContact) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(docData.footerContact, pageW / 2, y, { align: "center" });
  }

  const safeName = (docData.companyName || "Trip_Confirmation")
    .replace(/[^\w]+/g, "_")
    .slice(0, 24);
  doc.save(`Trip_Confirmation_${safeName}.pdf`);
}
