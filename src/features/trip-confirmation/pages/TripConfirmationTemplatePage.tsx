import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Download,
  RotateCcw,
  Save,
  Plus,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import {
  defaultSimpleTripTemplate,
  generateTripConfirmationPdf,
  loadTripConfirmationDefaults,
  saveTripConfirmationDefaults,
  simpleToTemplate,
  templateToSimple,
  type SimpleTripTemplate,
} from "../pdf";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

const labelCls = "mb-1 block text-xs font-semibold text-slate-600";

/** Simple template editor — rename labels & lists; layout stays fixed. */
export function TripConfirmationTemplatePage() {
  const [form, setForm] = useState<SimpleTripTemplate>(() =>
    templateToSimple(loadTripConfirmationDefaults()),
  );
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const set = <K extends keyof SimpleTripTemplate>(
    key: K,
    value: SimpleTripTemplate[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const updateLabelList = (
    key: "tripFields" | "tripDetailFields" | "paymentFields",
    index: number,
    value: string,
  ) => {
    setForm((prev) => {
      const next = [...prev[key]];
      next[index] = value;
      return { ...prev, [key]: next };
    });
  };

  const addLabel = (
    key: "tripFields" | "tripDetailFields" | "paymentFields",
  ) => {
    setForm((prev) => ({ ...prev, [key]: [...prev[key], "New field"] }));
  };

  const removeLabel = (
    key: "tripFields" | "tripDetailFields" | "paymentFields",
    index: number,
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  };

  const handleSave = () => {
    saveTripConfirmationDefaults(simpleToTemplate(form));
    setSavedMsg("Template saved.");
    setTimeout(() => setSavedMsg(null), 2500);
  };

  const handleReset = () => setForm(defaultSimpleTripTemplate());

  const handlePreview = () =>
    generateTripConfirmationPdf(simpleToTemplate(form));

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <Link
              to="/trip-confirmation"
              className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Trip Confirmation
            </Link>
            <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
              Confirmation template
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Change names and includes. Fill client values on Trip Confirmation.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:text-sm"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={handlePreview}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:text-sm"
          >
            <Download className="h-4 w-4" />
            Preview PDF
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700 sm:text-sm"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
      </div>

      {savedMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {savedMsg}
        </div>
      )}

      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <Section title="Header">
          <Field
            label="Company name"
            value={form.companyName}
            onChange={(v) => set("companyName", v)}
          />
          <Field
            label="Document title"
            value={form.documentTitle}
            onChange={(v) => set("documentTitle", v)}
          />
        </Section>

        <Section title="Trip info — field names">
          <LabelList
            items={form.tripFields}
            onChange={(i, v) => updateLabelList("tripFields", i, v)}
            onAdd={() => addLabel("tripFields")}
            onRemove={(i) => removeLabel("tripFields", i)}
          />
        </Section>

        <Section title="Package">
          <Field
            label="Section heading"
            value={form.packagePriceHeading}
            onChange={(v) => set("packagePriceHeading", v)}
          />
          <Field
            label="Includes title"
            value={form.packageIncludesTitle}
            onChange={(v) => set("packageIncludesTitle", v)}
          />
          <label className="block">
            <span className={labelCls}>Includes (one per line)</span>
            <textarea
              className={`${inputCls} min-h-[120px] resize-y`}
              value={form.packageIncludesItems.join("\n")}
              onChange={(e) =>
                set(
                  "packageIncludesItems",
                  e.target.value.split("\n"),
                )
              }
            />
          </label>
          <Field
            label="Extra KM label"
            value={form.extraKmLabel}
            onChange={(v) => set("extraKmLabel", v)}
          />
        </Section>

        <Section title="Trip details — field names">
          <Field
            label="Section heading"
            value={form.tripDetailsHeading}
            onChange={(v) => set("tripDetailsHeading", v)}
          />
          <LabelList
            items={form.tripDetailFields}
            onChange={(i, v) => updateLabelList("tripDetailFields", i, v)}
            onAdd={() => addLabel("tripDetailFields")}
            onRemove={(i) => removeLabel("tripDetailFields", i)}
          />
        </Section>

        <Section title="Booking">
          <Field
            label="Section heading"
            value={form.bookingHeading}
            onChange={(v) => set("bookingHeading", v)}
          />
          <Field
            label="Advance field name"
            value={form.advanceLabel}
            onChange={(v) => set("advanceLabel", v)}
          />
        </Section>

        <Section title="Payment — field names">
          <Field
            label="Section heading"
            value={form.paymentHeading}
            onChange={(v) => set("paymentHeading", v)}
          />
          <LabelList
            items={form.paymentFields}
            onChange={(i, v) => updateLabelList("paymentFields", i, v)}
            onAdd={() => addLabel("paymentFields")}
            onRemove={(i) => removeLabel("paymentFields", i)}
          />
        </Section>

        <Section title="Footer">
          <Field
            label="Brand line"
            value={form.footerBrand}
            onChange={(v) => set("footerBrand", v)}
          />
          <Field
            label="Tagline"
            value={form.footerTagline}
            onChange={(v) => set("footerTagline", v)}
          />
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 border-b border-slate-100 pb-5 last:border-0 last:pb-0">
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        className={inputCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function LabelList({
  items,
  onChange,
  onAdd,
  onRemove,
}: {
  items: string[];
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            className={inputCls}
            value={item}
            onChange={(e) => onChange(i, e.target.value)}
            placeholder="Field name"
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="rounded-lg border border-slate-200 p-2 text-red-400 hover:bg-red-50"
            aria-label="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
      >
        <Plus className="h-3.5 w-3.5" /> Add field
      </button>
    </div>
  );
}
