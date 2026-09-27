import jsPDF from "jspdf";
import {
  TRIP_CONFIRMATION_SEED,
  type TripConfirmationSeed,
} from "./seed";

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

/** Build full template blocks from seed (preloads + empty per-trip slots). */
export function buildTemplateFromSeed(
  seed: TripConfirmationSeed = TRIP_CONFIRMATION_SEED,
): TripConfirmationTemplate {
  const bank = [...seed.bankLines];
  while (bank.length < 4) bank.push("");

  return {
    blocks: [
      newHeading(seed.companyName, "company"),
      newHeading(seed.documentTitle, "title"),
      newFields(seed.tripFieldNames.map((l) => [l, ""] as [string, string])),
      newText(""),
      newHeading(seed.packagePriceHeading, "section"),
      newText("", { bold: true, underline: true }),
      newList(seed.packageIncludesTitle, [...seed.packageIncludesItems]),
      newFields([[seed.extraKmLabel, ""]]),
      newHeading(seed.tripDetailsHeading, "section"),
      newFields(
        seed.tripDetailFieldNames.map((l) => [l, ""] as [string, string]),
      ),
      newHeading(seed.bookingHeading, "section"),
      newFields([[seed.advanceLabel, ""]]),
      newText(seed.bookingConfirmSentence),
      newText(seed.balanceSentence, { bold: true }),
      newHeading(seed.paymentHeading, "section"),
      newFields(
        seed.paymentFields.map(
          (f) => [f.label, f.value] as [string, string],
        ),
      ),
      newPageBreak(),
      newHeading(seed.companyName, "company"),
      newText(bank[0] ?? "", { bold: true }),
      newText(bank[1] ?? "", { bold: true }),
      newText(bank[2] ?? "", { bold: true }),
      newText(bank[3] ?? "", { bold: true }),
      newText(""),
      newText(seed.vehicleAvailableSentence, { bold: true }),
      newText(""),
      newText(seed.footerBrand, { bold: true }),
      newText(seed.footerTagline, { bold: true }),
    ],
  };
}

/** Default layout from seed script. */
export const DEFAULT_TRIP_CONFIRMATION: TripConfirmationTemplate =
  buildTemplateFromSeed();

const LS_KEY = "tripwise.tripConfirmation.template.v3";
const LS_KEY_V2 = "tripwise.tripConfirmation.template.v2";
const LS_KEY_LEGACY = "tripwise.tripConfirmation.defaults";

function isTemplate(v: unknown): v is TripConfirmationTemplate {
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as TripConfirmationTemplate).blocks)
  );
}

/** Write seed into localStorage (used by seed script / Reset to seed). */
export function applyTripConfirmationSeed(): TripConfirmationTemplate {
  const t = buildTemplateFromSeed();
  saveTripConfirmationDefaults(t);
  try {
    localStorage.removeItem(LS_KEY_V2);
    localStorage.removeItem(LS_KEY_LEGACY);
  } catch {
    /* ignore */
  }
  return t;
}

export function loadTripConfirmationDefaults(): TripConfirmationTemplate {
  try {
    const v3 = localStorage.getItem(LS_KEY);
    if (v3) {
      const parsed = JSON.parse(v3);
      if (isTemplate(parsed) && parsed.blocks.length) {
        return { blocks: parsed.blocks };
      }
    }
    // First visit / after seed bump: apply seed
    return applyTripConfirmationSeed();
  } catch {
    /* ignore */
  }
  return buildTemplateFromSeed();
}

export function saveTripConfirmationDefaults(data: TripConfirmationTemplate) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** Field name (key) + value. */
export type SimpleField = {
  label: string;
  value: string;
};

/** Flat form for template editor (preloads + field names). */
export type SimpleTripTemplate = {
  companyName: string;
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
};

function sf(label: string, value = ""): SimpleField {
  return { label, value };
}

export function defaultSimpleTripTemplate(): SimpleTripTemplate {
  return templateToSimple(buildTemplateFromSeed());
}

export function templateToSimple(
  data: TripConfirmationTemplate,
): SimpleTripTemplate {
  const fallback = templateToSimpleFromSeed(TRIP_CONFIRMATION_SEED);
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
  const title = headings.find((h) => h.style === "title")?.text ?? "";
  const sections = headings.filter((h) => h.style === "section");

  const footerBrand =
    texts.find((t) => t.text.trim().startsWith("★"))?.text ??
    fallback.footerBrand;
  const footerTagline =
    texts.find((t) => /Professional Service/i.test(t.text))?.text ??
    fallback.footerTagline;
  const vehicleLine =
    texts.find((t) => /pre-booking/i.test(t.text))?.text ??
    fallback.vehicleAvailableSentence;

  const toFields = (
    group: Extract<TemplateBlock, { type: "fields" }> | undefined,
    fb: SimpleField[],
  ): SimpleField[] =>
    group?.fields?.length
      ? group.fields.map((f) => ({ label: f.label, value: f.value ?? "" }))
      : fb.map((f) => ({ ...f }));

  const contentTexts = texts.filter(
    (t) =>
      !t.text.trim().startsWith("★") &&
      !/Professional Service/i.test(t.text) &&
      !/pre-booking/i.test(t.text),
  );
  const priceText =
    texts.find((t) => t.underline)?.text ?? contentTexts[1]?.text ?? "";

  const pageBreakIdx = data.blocks.findIndex((b) => b.type === "pageBreak");
  const page2Texts = data.blocks
    .slice(pageBreakIdx + 1)
    .filter(
      (b): b is Extract<TemplateBlock, { type: "text" }> =>
        b.type === "text" &&
        !b.text.trim().startsWith("★") &&
        !/Professional Service/i.test(b.text) &&
        !/pre-booking/i.test(b.text),
    );

  // booking sentences: after advance field group — contentTexts[2], [3] typically
  const bookingNote =
    contentTexts.find((t) => /confirmed upon receipt/i.test(t.text))?.text ??
    contentTexts[2]?.text ??
    fallback.bookingNote;
  const bookingSubNote =
    contentTexts.find((t) => /Balance:/i.test(t.text))?.text ??
    contentTexts[3]?.text ??
    fallback.bookingSubNote;

  return {
    companyName: company,
    documentTitle: title,
    packagePriceHeading: sections[0]?.text ?? fallback.packagePriceHeading,
    tripDetailsHeading: sections[1]?.text ?? fallback.tripDetailsHeading,
    bookingHeading: sections[2]?.text ?? fallback.bookingHeading,
    paymentHeading: sections[3]?.text ?? fallback.paymentHeading,
    tripFields: toFields(fieldGroups[0], fallback.tripFields),
    routeText: contentTexts[0]?.text ?? "",
    packageIncludesTitle: lists[0]?.title ?? fallback.packageIncludesTitle,
    packageIncludesItems: lists[0]?.items ? [...lists[0].items] : [],
    packagePrice: priceText,
    extraKm: fieldGroups[1]?.fields[0]
      ? {
          label: fieldGroups[1].fields[0].label,
          value: fieldGroups[1].fields[0].value ?? "",
        }
      : { ...fallback.extraKm },
    tripDetailFields: toFields(fieldGroups[2], fallback.tripDetailFields),
    advance: fieldGroups[3]?.fields[0]
      ? {
          label: fieldGroups[3].fields[0].label,
          value: fieldGroups[3].fields[0].value ?? "",
        }
      : { ...fallback.advance },
    bookingNote,
    bookingSubNote,
    paymentFields: toFields(fieldGroups[4], fallback.paymentFields),
    bankLines: [
      page2Texts[0]?.text ?? "",
      page2Texts[1]?.text ?? "",
      page2Texts[2]?.text ?? "",
      page2Texts[3]?.text ?? "",
    ],
    vehicleAvailableSentence: vehicleLine,
    footerBrand,
    footerTagline,
  };
}

function templateToSimpleFromSeed(
  seed: TripConfirmationSeed,
): SimpleTripTemplate {
  return {
    companyName: seed.companyName,
    documentTitle: seed.documentTitle,
    packagePriceHeading: seed.packagePriceHeading,
    tripDetailsHeading: seed.tripDetailsHeading,
    bookingHeading: seed.bookingHeading,
    paymentHeading: seed.paymentHeading,
    tripFields: seed.tripFieldNames.map((l) => sf(l)),
    routeText: "",
    packageIncludesTitle: seed.packageIncludesTitle,
    packageIncludesItems: [...seed.packageIncludesItems],
    packagePrice: "",
    extraKm: sf(seed.extraKmLabel),
    tripDetailFields: seed.tripDetailFieldNames.map((l) => sf(l)),
    advance: sf(seed.advanceLabel),
    bookingNote: seed.bookingConfirmSentence,
    bookingSubNote: seed.balanceSentence,
    paymentFields: seed.paymentFields.map((f) => ({ ...f })),
    bankLines: [...seed.bankLines],
    vehicleAvailableSentence: seed.vehicleAvailableSentence,
    footerBrand: seed.footerBrand,
    footerTagline: seed.footerTagline,
  };
}

export function simpleToTemplate(
  s: SimpleTripTemplate,
): TripConfirmationTemplate {
  const pairs = (arr: SimpleField[]) =>
    arr.map(
      (f) =>
        [f.label.trim() || "Field", f.value ?? ""] as [string, string],
    );

  const trip =
    s.tripFields.length > 0
      ? s.tripFields
      : [sf("Trip"), sf("Duration"), sf("Vehicle")];
  const details =
    s.tripDetailFields.length > 0
      ? s.tripDetailFields
      : [
          sf("Arrival"),
          sf("Departure"),
          sf("Pickup"),
          sf("Drop"),
          sf("Pickup Time"),
        ];
  const payment =
    s.paymentFields.length > 0
      ? s.paymentFields
      : [sf("UPI ID"), sf("G Pay / PhonePe")];

  const bank = [...(s.bankLines ?? [])];
  while (bank.length < 4) bank.push("");

  return {
    blocks: [
      newHeading(s.companyName.trim(), "company"),
      newHeading(s.documentTitle.trim(), "title"),
      newFields(pairs(trip)),
      newText(s.routeText ?? ""),
      newHeading(s.packagePriceHeading.trim(), "section"),
      newText(s.packagePrice ?? "", { bold: true, underline: true }),
      newList(
        s.packageIncludesTitle.trim(),
        (s.packageIncludesItems ?? []).map((x) => x.trim()).filter(Boolean),
      ),
      newFields([
        [s.extraKm.label.trim() || "Extra KM", s.extraKm.value ?? ""],
      ]),
      newHeading(s.tripDetailsHeading.trim(), "section"),
      newFields(pairs(details)),
      newHeading(s.bookingHeading.trim(), "section"),
      newFields([
        [s.advance.label.trim() || "Advance", s.advance.value ?? ""],
      ]),
      newText(s.bookingNote ?? ""),
      newText(s.bookingSubNote ?? "", { bold: true }),
      newHeading(s.paymentHeading.trim(), "section"),
      newFields(pairs(payment)),
      newPageBreak(),
      newHeading(s.companyName.trim(), "company"),
      newText(bank[0] ?? "", { bold: true }),
      newText(bank[1] ?? "", { bold: true }),
      newText(bank[2] ?? "", { bold: true }),
      newText(bank[3] ?? "", { bold: true }),
      newText(""),
      newText(s.vehicleAvailableSentence ?? "", { bold: true }),
      newText(""),
      newText(s.footerBrand.trim(), { bold: true }),
      newText(s.footerTagline.trim(), { bold: true }),
    ],
  };
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
