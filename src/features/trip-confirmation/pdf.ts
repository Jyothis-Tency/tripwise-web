import jsPDF from "jspdf";

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
      /** company = large, title = medium, section = section header */
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

function nid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newField(label = "Field", value = ""): TemplateField {
  return { id: nid("f"), label, value };
}

export function newHeading(
  text: string,
  style: "company" | "title" | "section" = "section",
): TemplateBlock {
  return { id: nid("h"), type: "heading", text, style };
}

export function newFields(fields: Array<[string, string]>): TemplateBlock {
  return {
    id: nid("fields"),
    type: "fields",
    fields: fields.map(([label, value]) => newField(label, value)),
  };
}

export function newText(
  text: string,
  opts?: { bold?: boolean; underline?: boolean },
): TemplateBlock {
  return {
    id: nid("t"),
    type: "text",
    text,
    bold: opts?.bold,
    underline: opts?.underline,
  };
}

export function newList(title: string, items: string[]): TemplateBlock {
  return { id: nid("l"), type: "list", title, items: [...items] };
}

export function newPageBreak(): TemplateBlock {
  return { id: nid("pb"), type: "pageBreak" };
}

/** Default layout — labels/structure only; values filled on Trip Confirmation. */
export const DEFAULT_TRIP_CONFIRMATION: TripConfirmationTemplate = {
  blocks: [
    newHeading("INWAY CABS", "company"),
    newHeading("PREMIUM CRYSTA – TOUR QUOTATION", "title"),
    newFields([
      ["Trip", ""],
      ["Duration", ""],
      ["Vehicle", ""],
      ["Package", ""],
      ["KM Calculation", ""],
    ]),
    newText(""),
    newHeading("PACKAGE PRICE", "section"),
    newText("", { bold: true, underline: true }),
    newList("Package Includes:", [
      "Fuel",
      "Toll Charges",
      "Parking Charges",
      "Driver Allowance",
      "Professional Driver",
      "Up to 700 km",
    ]),
    newFields([["Extra KM", ""]]),
    newHeading("TRIP DETAILS", "section"),
    newFields([
      ["Arrival", ""],
      ["Departure", ""],
      ["Pickup", ""],
      ["Drop", ""],
      ["Pickup Time", ""],
    ]),
    newHeading("BOOKING CONFIRMATION", "section"),
    newFields([["Advance", ""]]),
    newText(""),
    newText("", { bold: true }),
    newHeading("PAYMENT DETAILS", "section"),
    newFields([
      ["UPI ID", ""],
      ["G Pay / PhonePe", ""],
    ]),
    newPageBreak(),
    newHeading("INWAY CABS", "company"),
    newText("", { bold: true }),
    newText("", { bold: true }),
    newText("", { bold: true }),
    newText("", { bold: true }),
    newText(""),
    newText("★ INWAY CABS", { bold: true }),
    newText(
      "Professional Service • Clean Vehicles • Experienced Drivers • Customer Satisfaction",
      { bold: true },
    ),
  ],
};

const LS_KEY = "tripwise.tripConfirmation.template.v2";
const LS_KEY_LEGACY = "tripwise.tripConfirmation.defaults";

function isTemplate(v: unknown): v is TripConfirmationTemplate {
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as TripConfirmationTemplate).blocks)
  );
}

/** Migrate old fixed-field saves into the flexible template. */
function migrateLegacy(raw: Record<string, string>): TripConfirmationTemplate {
  const t = structuredClone(DEFAULT_TRIP_CONFIRMATION);
  const setField = (label: string, value?: string) => {
    if (value == null) return;
    for (const b of t.blocks) {
      if (b.type !== "fields") continue;
      const f = b.fields.find(
        (x) => x.label.toLowerCase() === label.toLowerCase(),
      );
      if (f) f.value = value;
    }
  };
  if (raw.companyName) {
    for (const b of t.blocks) {
      if (b.type === "heading" && b.style === "company") b.text = raw.companyName;
    }
  }
  if (raw.documentTitle) {
    for (const b of t.blocks) {
      if (b.type === "heading" && b.style === "title") b.text = raw.documentTitle;
    }
  }
  setField("Trip", raw.trip);
  setField("Duration", raw.duration);
  setField("Vehicle", raw.vehicle);
  setField("Package", raw.packageKm);
  setField("KM Calculation", raw.kmCalculation);
  setField("Arrival", raw.arrival);
  setField("Departure", raw.departure);
  setField("Pickup", raw.pickup);
  setField("Drop", raw.drop);
  setField("Pickup Time", raw.pickupTime);
  setField("Advance", raw.advanceAmount);
  setField("Extra KM", raw.extraKmRate);
  setField("UPI ID", raw.upiId);
  setField("G Pay / PhonePe", raw.gpayPhone);

  // Update first free-text route / notes / bank lines if present
  const texts = t.blocks.filter((b) => b.type === "text");
  if (raw.route && texts[0]?.type === "text") texts[0].text = raw.route;
  if (raw.packagePrice) {
    const price = t.blocks.find(
      (b) => b.type === "text" && b.underline,
    );
    if (price?.type === "text") price.text = raw.packagePrice;
  }
  if (raw.packageIncludes) {
    const list = t.blocks.find((b) => b.type === "list");
    if (list?.type === "list") {
      list.items = raw.packageIncludes.split("\n").filter(Boolean);
    }
  }
  return t;
}

export function loadTripConfirmationDefaults(): TripConfirmationTemplate {
  try {
    const v2 = localStorage.getItem(LS_KEY);
    if (v2) {
      const parsed = JSON.parse(v2);
      if (isTemplate(parsed)) {
        const raw: TripConfirmationTemplate = {
          blocks: parsed.blocks.length
            ? parsed.blocks
            : structuredClone(DEFAULT_TRIP_CONFIRMATION.blocks),
        };
        return stripTemplateValues(raw);
      }
    }
    const legacy = localStorage.getItem(LS_KEY_LEGACY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as Record<string, string>;
      return stripTemplateValues(migrateLegacy(parsed));
    }
  } catch {
    /* ignore */
  }
  return stripTemplateValues(structuredClone(DEFAULT_TRIP_CONFIRMATION));
}

export function saveTripConfirmationDefaults(data: TripConfirmationTemplate) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(stripTemplateValues(data)));
  } catch {
    /* ignore */
  }
}

/** Keep structure/labels; clear field & text values (for blank client forms). */
export function stripTemplateValues(
  data: TripConfirmationTemplate,
): TripConfirmationTemplate {
  return {
    blocks: data.blocks.map((b) => {
      if (b.type === "fields") {
        return {
          ...b,
          fields: b.fields.map((f) => ({ ...f, value: "" })),
        };
      }
      if (b.type === "text") {
        // Keep static branding lines that look like fixed template copy
        const t = (b.text || "").trim();
        if (
          t.startsWith("★") ||
          /Professional Service/i.test(t)
        ) {
          return { ...b };
        }
        return { ...b, text: "" };
      }
      return { ...b };
    }),
  };
}

/** Flat form model for the simple template editor. */
export type SimpleTripTemplate = {
  companyName: string;
  documentTitle: string;
  packagePriceHeading: string;
  tripDetailsHeading: string;
  bookingHeading: string;
  paymentHeading: string;
  tripFields: string[];
  packageIncludesTitle: string;
  packageIncludesItems: string[];
  extraKmLabel: string;
  tripDetailFields: string[];
  advanceLabel: string;
  paymentFields: string[];
  footerBrand: string;
  footerTagline: string;
};

export function defaultSimpleTripTemplate(): SimpleTripTemplate {
  return {
    companyName: "INWAY CABS",
    documentTitle: "PREMIUM CRYSTA – TOUR QUOTATION",
    packagePriceHeading: "PACKAGE PRICE",
    tripDetailsHeading: "TRIP DETAILS",
    bookingHeading: "BOOKING CONFIRMATION",
    paymentHeading: "PAYMENT DETAILS",
    tripFields: ["Trip", "Duration", "Vehicle", "Package", "KM Calculation"],
    packageIncludesTitle: "Package Includes:",
    packageIncludesItems: [
      "Fuel",
      "Toll Charges",
      "Parking Charges",
      "Driver Allowance",
      "Professional Driver",
      "Up to 700 km",
    ],
    extraKmLabel: "Extra KM",
    tripDetailFields: [
      "Arrival",
      "Departure",
      "Pickup",
      "Drop",
      "Pickup Time",
    ],
    advanceLabel: "Advance",
    paymentFields: ["UPI ID", "G Pay / PhonePe"],
    footerBrand: "★ INWAY CABS",
    footerTagline:
      "Professional Service • Clean Vehicles • Experienced Drivers • Customer Satisfaction",
  };
}

export function templateToSimple(
  data: TripConfirmationTemplate,
): SimpleTripTemplate {
  const fallback = defaultSimpleTripTemplate();
  const headings = data.blocks.filter(
    (b): b is Extract<TemplateBlock, { type: "heading" }> =>
      b.type === "heading",
  );
  const fieldGroups = data.blocks.filter(
    (b): b is Extract<TemplateBlock, { type: "fields" }> => b.type === "fields",
  );
  const lists = data.blocks.filter(
    (b): b is Extract<TemplateBlock, { type: "list" }> => b.type === "list",
  );
  const texts = data.blocks.filter(
    (b): b is Extract<TemplateBlock, { type: "text" }> => b.type === "text",
  );

  const company =
    headings.find((h) => h.style === "company")?.text ?? fallback.companyName;
  const title =
    headings.find((h) => h.style === "title")?.text ?? fallback.documentTitle;
  const sections = headings.filter((h) => h.style === "section");

  const footerBrand =
    texts.find((t) => t.text.trim().startsWith("★"))?.text ??
    fallback.footerBrand;
  const footerTagline =
    texts.find((t) => /Professional Service/i.test(t.text))?.text ??
    fallback.footerTagline;

  return {
    companyName: company,
    documentTitle: title,
    packagePriceHeading: sections[0]?.text ?? fallback.packagePriceHeading,
    tripDetailsHeading: sections[1]?.text ?? fallback.tripDetailsHeading,
    bookingHeading: sections[2]?.text ?? fallback.bookingHeading,
    paymentHeading: sections[3]?.text ?? fallback.paymentHeading,
    tripFields: fieldGroups[0]?.fields.map((f) => f.label).filter(Boolean)
      .length
      ? fieldGroups[0]!.fields.map((f) => f.label)
      : fallback.tripFields,
    packageIncludesTitle: lists[0]?.title ?? fallback.packageIncludesTitle,
    packageIncludesItems: lists[0]?.items?.length
      ? [...lists[0].items]
      : fallback.packageIncludesItems,
    extraKmLabel: fieldGroups[1]?.fields[0]?.label ?? fallback.extraKmLabel,
    tripDetailFields: fieldGroups[2]?.fields.map((f) => f.label).filter(Boolean)
      .length
      ? fieldGroups[2]!.fields.map((f) => f.label)
      : fallback.tripDetailFields,
    advanceLabel: fieldGroups[3]?.fields[0]?.label ?? fallback.advanceLabel,
    paymentFields: fieldGroups[4]?.fields.map((f) => f.label).filter(Boolean)
      .length
      ? fieldGroups[4]!.fields.map((f) => f.label)
      : fallback.paymentFields,
    footerBrand,
    footerTagline,
  };
}

export function simpleToTemplate(
  s: SimpleTripTemplate,
): TripConfirmationTemplate {
  const labels = (arr: string[]) =>
    arr.map((label) => [label.trim() || "Field", ""] as [string, string]);

  return stripTemplateValues({
    blocks: [
      newHeading(s.companyName.trim() || "INWAY CABS", "company"),
      newHeading(
        s.documentTitle.trim() || "PREMIUM CRYSTA – TOUR QUOTATION",
        "title",
      ),
      newFields(
        labels(
          s.tripFields.length ? s.tripFields : ["Trip", "Duration", "Vehicle"],
        ),
      ),
      newText(""),
      newHeading(s.packagePriceHeading.trim() || "PACKAGE PRICE", "section"),
      newText("", { bold: true, underline: true }),
      newList(
        s.packageIncludesTitle.trim() || "Package Includes:",
        (s.packageIncludesItems.length
          ? s.packageIncludesItems
          : ["Fuel"]
        ).map((x) => x.trim()).filter(Boolean),
      ),
      newFields([[s.extraKmLabel.trim() || "Extra KM", ""]]),
      newHeading(s.tripDetailsHeading.trim() || "TRIP DETAILS", "section"),
      newFields(
        labels(
          s.tripDetailFields.length
            ? s.tripDetailFields
            : ["Arrival", "Departure", "Pickup", "Drop", "Pickup Time"],
        ),
      ),
      newHeading(s.bookingHeading.trim() || "BOOKING CONFIRMATION", "section"),
      newFields([[s.advanceLabel.trim() || "Advance", ""]]),
      newText(""),
      newText("", { bold: true }),
      newHeading(s.paymentHeading.trim() || "PAYMENT DETAILS", "section"),
      newFields(
        labels(
          s.paymentFields.length
            ? s.paymentFields
            : ["UPI ID", "G Pay / PhonePe"],
        ),
      ),
      newPageBreak(),
      newHeading(s.companyName.trim() || "INWAY CABS", "company"),
      newText("", { bold: true }),
      newText("", { bold: true }),
      newText("", { bold: true }),
      newText("", { bold: true }),
      newText(""),
      newText(s.footerBrand.trim() || "★ INWAY CABS", { bold: true }),
      newText(
        s.footerTagline.trim() ||
          "Professional Service • Clean Vehicles • Experienced Drivers • Customer Satisfaction",
        { bold: true },
      ),
    ],
  });
}


function wrapText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = doc.splitTextToSize(text || "", maxWidth) as string[];
  for (const line of lines) {
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + need > pageH - 16) {
    doc.addPage();
    return 22;
  }
  return y;
}

/** Build PDF from fully editable template blocks. */
export function generateTripConfirmationPdf(data: TripConfirmationTemplate) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = doc.internal.pageSize.getWidth();
  const left = 18;
  const maxW = pageW - left * 2;
  let y = 22;
  let companyForFilename = "Trip";

  for (const block of data.blocks) {
    if (block.type === "pageBreak") {
      doc.addPage();
      y = 28;
      continue;
    }

    if (block.type === "heading") {
      const text = (block.text || "").trim();
      if (!text) continue;
      y = ensureSpace(doc, y, 14);
      if (block.style === "company") {
        companyForFilename = text;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text(text.toUpperCase(), left, y);
        y += 10;
      } else if (block.style === "title") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(text.toUpperCase(), left, y);
        y += 12;
      } else {
        y += 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(text.toUpperCase(), left, y);
        y += 8;
      }
      continue;
    }

    if (block.type === "fields") {
      doc.setFontSize(11);
      for (const f of block.fields) {
        const label = (f.label || "").trim();
        let value = f.value ?? "";
        if (!label && !value.trim()) continue;
        // Blank pickup-time style: empty value → underline
        if (!value.trim() && /time/i.test(label)) {
          value = "________________";
        }
        y = ensureSpace(doc, y, 10);
        if (label) {
          doc.setFont("helvetica", "bold");
          const labelText = `${label}:`;
          doc.text(labelText, left, y);
          doc.setFont("helvetica", "normal");
          const labelW = doc.getTextWidth(`${labelText} `);
          y = wrapText(doc, value || "—", left + labelW, y, maxW - labelW, 6);
        } else {
          doc.setFont("helvetica", "normal");
          y = wrapText(doc, value, left, y, maxW, 6);
        }
        y += 2;
      }
      y += 2;
      continue;
    }

    if (block.type === "text") {
      const text = (block.text || "").trim();
      if (!text) continue;
      y = ensureSpace(doc, y, 12);
      doc.setFont("helvetica", block.bold ? "bold" : "normal");
      doc.setFontSize(block.underline ? 14 : 11);
      const startY = y;
      y = wrapText(doc, text, left, y, maxW, block.underline ? 7 : 6);
      if (block.underline) {
        const w = Math.min(doc.getTextWidth(text), maxW);
        doc.setLineWidth(0.4);
        doc.line(left, startY + 1.2, left + w, startY + 1.2);
      }
      y += 4;
      continue;
    }

    if (block.type === "list") {
      y = ensureSpace(doc, y, 16);
      if (block.title?.trim()) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(block.title.trim(), left, y);
        y += 7;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      for (const item of block.items) {
        if (!item?.trim()) continue;
        y = ensureSpace(doc, y, 8);
        doc.text(`•  ${item.trim()}`, left + 2, y);
        y += 6;
      }
      y += 4;
    }
  }

  const safeName = companyForFilename.replace(/[^\w]+/g, "_").slice(0, 24);
  doc.save(`Trip_Confirmation_${safeName}_${Date.now()}.pdf`);
}
