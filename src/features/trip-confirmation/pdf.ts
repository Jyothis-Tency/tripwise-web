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

/** Migrate legacy Pickup/Drop trip-detail labels → Driver Name / Number. */
function migrateTripDetailFields<T extends { label: string; value: string }>(
  fields: T[],
): T[] {
  return fields.map((f) => {
    const label = String(f.label || "").trim();
    if (/^pickup$/i.test(label)) {
      return { ...f, label: "Driver Name" };
    }
    if (/^drop$/i.test(label)) {
      return { ...f, label: "Driver Number" };
    }
    return f;
  });
}

/** Build full template blocks from seed (preloads + empty per-trip slots). */
export function buildTemplateFromSeed(
  seed: TripConfirmationSeed = TRIP_CONFIRMATION_SEED,
): TripConfirmationTemplate {
  const bank = [...seed.bankLines].filter((l) => String(l).trim());

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
      // UI-only split (Page 1 | Page 2). PDF ignores pageBreak and stays one page.
      newPageBreak(),
      newHeading(seed.paymentHeading, "section"),
      newFields(
        seed.paymentFields.map(
          (f) => [f.label, f.value] as [string, string],
        ),
      ),
      ...bank.map((line) => newText(line, { bold: true })),
      newText(seed.vehicleAvailableSentence, { bold: true }),
      newText(seed.footerBrand, { bold: true }),
      newText(seed.footerTagline, { bold: true }),
    ],
  };
}

/** Default layout from seed script. */
export const DEFAULT_TRIP_CONFIRMATION: TripConfirmationTemplate =
  buildTemplateFromSeed();

/** Simple form is source of truth (avoids block round-trip corruption). */
const LS_KEY_SIMPLE = "tripwise.tripConfirmation.simple.v4";
/** Legacy block-based keys — migrated once into simple form. */
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

function isSimpleTemplate(v: unknown): v is SimpleTripTemplate {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as SimpleTripTemplate).companyName === "string" &&
    Array.isArray((v as SimpleTripTemplate).tripFields)
  );
}

function sanitizeSimple(s: SimpleTripTemplate): SimpleTripTemplate {
  const fb = templateToSimpleFromSeed(TRIP_CONFIRMATION_SEED);
  const next: SimpleTripTemplate = {
    ...fb,
    ...s,
    tripFields: Array.isArray(s.tripFields) ? s.tripFields : fb.tripFields,
    tripDetailFields: migrateTripDetailFields(
      Array.isArray(s.tripDetailFields) ? s.tripDetailFields : fb.tripDetailFields,
    ),
    paymentFields: Array.isArray(s.paymentFields)
      ? s.paymentFields
      : fb.paymentFields,
    packageIncludesItems: Array.isArray(s.packageIncludesItems)
      ? s.packageIncludesItems
      : [],
    extraKm: s.extraKm ?? fb.extraKm,
    advance: s.advance ?? fb.advance,
    bankLines: Array.isArray(s.bankLines) ? [...s.bankLines] : [...fb.bankLines],
  };
  while (next.bankLines.length < 4) next.bankLines.push("");
  return next;
}

export function saveSimpleTripTemplate(simple: SimpleTripTemplate) {
  const clean = sanitizeSimple(simple);
  try {
    localStorage.setItem(LS_KEY_SIMPLE, JSON.stringify(clean));
    // Drop legacy block cache so reopen can't resurrect old labels.
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_KEY_V2);
    localStorage.removeItem(LS_KEY_LEGACY);
  } catch {
    /* ignore */
  }
  return clean;
}

export function loadSimpleTripTemplate(): SimpleTripTemplate {
  try {
    const raw = localStorage.getItem(LS_KEY_SIMPLE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isSimpleTemplate(parsed)) return sanitizeSimple(parsed);
    }
    // Migrate legacy block template → simple once.
    const v3 = localStorage.getItem(LS_KEY);
    if (v3) {
      const parsed = JSON.parse(v3);
      if (isTemplate(parsed) && parsed.blocks.length) {
        const simple = sanitizeSimple(templateToSimple(parsed));
        saveSimpleTripTemplate(simple);
        return simple;
      }
    }
  } catch {
    /* ignore */
  }
  return templateToSimpleFromSeed(TRIP_CONFIRMATION_SEED);
}

/** Write seed into localStorage (used by seed script / Reset to seed). */
export function applyTripConfirmationSeed(): TripConfirmationTemplate {
  const simple = templateToSimpleFromSeed(TRIP_CONFIRMATION_SEED);
  saveSimpleTripTemplate(simple);
  return simpleToTemplate(simple);
}

export function loadTripConfirmationDefaults(): TripConfirmationTemplate {
  return simpleToTemplate(loadSimpleTripTemplate());
}

/** Persist from blocks (main page label edits) via simple round-trip. */
export function saveTripConfirmationDefaults(data: TripConfirmationTemplate) {
  try {
    const simple = sanitizeSimple(templateToSimple(data));
    // Keep preload values; clear only known per-trip slots when saving from main.
    saveSimpleTripTemplate(simple);
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

  // booking sentences: after advance field group — contentTexts[2], [3] typically
  const bookingNote =
    contentTexts.find((t) => /confirmed upon receipt/i.test(t.text))?.text ??
    contentTexts[2]?.text ??
    fallback.bookingNote;
  const bookingSubNote =
    contentTexts.find((t) => /Balance:/i.test(t.text))?.text ??
    contentTexts[3]?.text ??
    fallback.bookingSubNote;

  // Bank lines: bold text blocks that look like account details (after payment fields).
  const bankCandidateTexts = texts.filter(
    (t) =>
      t.bold &&
      t.text.trim() &&
      !t.text.trim().startsWith("★") &&
      !/Professional Service/i.test(t.text) &&
      !/pre-booking/i.test(t.text) &&
      !/confirmed upon receipt/i.test(t.text) &&
      !/Balance:/i.test(t.text),
  );
  const bankLines = bankCandidateTexts
    .filter(
      (t) =>
        /bank|a\/c|ifsc|branch|account|hdfc|sbi|icici/i.test(t.text) ||
        /^\d/.test(t.text.trim()),
    )
    .map((t) => t.text);
  while (bankLines.length < 4) bankLines.push("");

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
    tripDetailFields: migrateTripDetailFields(
      toFields(fieldGroups[2], fallback.tripDetailFields),
    ),
    advance: fieldGroups[3]?.fields[0]
      ? {
          label: fieldGroups[3].fields[0].label,
          value: fieldGroups[3].fields[0].value ?? "",
        }
      : { ...fallback.advance },
    bookingNote,
    bookingSubNote,
    paymentFields: toFields(fieldGroups[4], fallback.paymentFields),
    bankLines: bankLines.slice(0, 4),
    vehicleAvailableSentence: vehicleLine,
    footerBrand,
    footerTagline,
  };
}

export function templateToSimpleFromSeed(
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
          sf("Driver Name"),
          sf("Driver Number"),
          sf("Pickup Time"),
        ];
  const payment =
    s.paymentFields.length > 0
      ? s.paymentFields
      : [sf("UPI ID"), sf("G Pay / PhonePe")];

  const bank = [...(s.bankLines ?? [])].filter((line) => String(line).trim());

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
      // UI-only split (Page 1 | Page 2). PDF ignores pageBreak and stays one page.
      newPageBreak(),
      newHeading(s.paymentHeading.trim(), "section"),
      newFields(pairs(payment)),
      ...bank.map((line) => newText(line, { bold: true })),
      newText(s.vehicleAvailableSentence ?? "", { bold: true }),
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

/**
 * Single-page trip confirmation PDF.
 * Sequential Y only (no absolute jumps). Empty values still keep tidy rows.
 * Footer brand/tagline pinned to bottom so they never collide with body.
 */
export function generateTripConfirmationPdf(data: TripConfirmationTemplate) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 14;
  const right = pageW - 14;
  const maxW = right - left;
  const footerReserve = 22;
  const bottomLimit = pageH - footerReserve;
  let y = 14;
  let companyForFilename = "Trip";
  let footerBrand = "";
  let footerTagline = "";

  const blocks = data.blocks.filter((b) => b.type !== "pageBreak");

  const ensureSpace = (need: number) => y + need <= bottomLimit;

  // Header band
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageW, 32, "F");
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.line(0, 32, pageW, 32);

  const drawSection = (title: string) => {
    if (!ensureSpace(10)) return;
    y += 3;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(left, y, right, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 64, 175);
    doc.text(title.toUpperCase(), left, y);
    y += 5;
  };

  const drawFieldGrid = (
    fields: Array<{ label: string; value: string }>,
  ) => {
    const visible = fields.filter((f) => (f.label || "").trim());
    if (!visible.length) return;

    const colGap = 6;
    const colW = (maxW - colGap) / 2;
    const rowH = 7;
    let col = 0;
    let rowTop = y;

    for (const f of visible) {
      if (!ensureSpace(rowH + 2)) break;
      const label = (f.label || "").trim();
      let value = (f.value ?? "").trim();
      if (!value) {
        value = /time/i.test(label) ? "____________" : "—";
      }

      const x = left + col * (colW + colGap);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const labelText = `${label}:`;
      doc.text(labelText, x, rowTop);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      const labelW = doc.getTextWidth(`${labelText} `) + 1;
      const lines = doc.splitTextToSize(
        value,
        Math.max(10, colW - labelW),
      ) as string[];
      doc.text(lines[0] ?? "—", x + labelW, rowTop);

      col += 1;
      if (col >= 2) {
        col = 0;
        rowTop += rowH;
      }
    }
    if (col !== 0) rowTop += rowH;
    y = rowTop + 1;
  };

  for (const block of blocks) {
    if (!ensureSpace(8)) break;

    if (block.type === "heading") {
      const text = (block.text || "").trim();
      if (!text) continue;
      if (block.style === "company") {
        companyForFilename = text;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42);
        doc.text(text.toUpperCase(), pageW / 2, 14, { align: "center" });
        y = 38;
      } else if (block.style === "title") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(51, 65, 85);
        doc.text(text.toUpperCase(), pageW / 2, 22, { align: "center" });
        y = Math.max(y, 38);
      } else {
        if (y < 36) y = 38;
        drawSection(text);
      }
      continue;
    }

    if (block.type === "fields") {
      drawFieldGrid(block.fields);
      continue;
    }

    if (block.type === "text") {
      const text = (block.text || "").trim();
      if (!text) continue;

      // Hold footer for bottom pin — prevents overlap with body content.
      if (text.startsWith("★") || /^★/.test(text.replace(/\s/g, ""))) {
        footerBrand = text;
        continue;
      }
      if (/Professional Service/i.test(text)) {
        footerTagline = text;
        continue;
      }

      const isPrice = !!block.underline;
      if (!ensureSpace(isPrice ? 8 : 6)) break;
      doc.setFont("helvetica", block.bold || isPrice ? "bold" : "normal");
      doc.setFontSize(isPrice ? 11 : 9);
      doc.setTextColor(15, 23, 42);
      const startY = y;
      const lh = isPrice ? 5 : 4.2;
      y = wrapText(doc, text, left, y, maxW, lh);
      if (block.underline) {
        const w = Math.min(doc.getTextWidth(text), maxW);
        doc.setDrawColor(30, 64, 175);
        doc.setLineWidth(0.4);
        doc.line(left, startY + 1.2, left + w, startY + 1.2);
      }
      y += 2.5;
      continue;
    }

    if (block.type === "list") {
      const items = (block.items || []).map((i) => i.trim()).filter(Boolean);
      if (block.title?.trim()) {
        if (!ensureSpace(6)) break;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(block.title.trim(), left, y);
        y += 4.5;
      }
      if (!items.length) {
        y += 1;
        continue;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      for (const item of items) {
        if (!ensureSpace(5)) break;
        const lines = doc.splitTextToSize(`•  ${item}`, maxW - 2) as string[];
        for (const line of lines) {
          doc.text(line, left + 1, y);
          y += 4;
        }
      }
      y += 2;
    }
  }

  // Pinned footer
  let fy = pageH - 16;
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.55);
  doc.line(left, fy - 6, right, fy - 6);

  if (footerBrand) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(footerBrand, pageW / 2, fy - 1, { align: "center" });
    fy += 4;
  }
  if (footerTagline) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const lines = doc.splitTextToSize(footerTagline, maxW) as string[];
    for (const line of lines.slice(0, 2)) {
      doc.text(line, pageW / 2, fy, { align: "center" });
      fy += 3.5;
    }
  }

  const safeName = companyForFilename.replace(/[^\w]+/g, "_").slice(0, 24);
  doc.save(`Trip_Confirmation_${safeName}_${Date.now()}.pdf`);
}
