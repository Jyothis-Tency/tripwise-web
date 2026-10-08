import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  RotateCcw,
  Save,
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import {
  applyTripConfirmationSeed,
  loadSimpleTripTemplate,
  saveSimpleTripTemplate,
  templateToSimpleFromSeed,
  type SimpleField,
  type SimpleTripTemplate,
} from "../pdf";
import { TRIP_CONFIRMATION_SEED } from "../seed";
import {
  fetchTripConfirmationTemplate,
  saveTripConfirmationTemplateRemote,
} from "../api";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20";

const keyInputCls =
  "w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-solid focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 dark:border-white/20 dark:bg-white/5 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:bg-white/10";

const labelCls =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400";

/**
 * Template = preloads + field names.
 * Per-trip values are filled on Trip Confirmation.
 */
export function TripConfirmationTemplatePage() {
  const [form, setForm] = useState<SimpleTripTemplate>(() =>
    loadSimpleTripTemplate(),
  );
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingRemote, setLoadingRemote] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchTripConfirmationTemplate();
        if (!cancelled && remote) {
          const cleaned = saveSimpleTripTemplate(remote);
          setForm(cleaned);
        }
      } catch {
        /* keep local */
      } finally {
        if (!cancelled) setLoadingRemote(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = <K extends keyof SimpleTripTemplate>(
    key: K,
    value: SimpleTripTemplate[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const updateName = (
    key: "tripFields" | "tripDetailFields",
    index: number,
    label: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].map((f, i) =>
        i === index ? { ...f, label, value: "" } : f,
      ),
    }));
  };

  const addName = (key: "tripFields" | "tripDetailFields") => {
    setForm((prev) => ({
      ...prev,
      [key]: [...prev[key], { label: "New field", value: "" }],
    }));
  };

  const removeName = (
    key: "tripFields" | "tripDetailFields",
    index: number,
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  };

  const updatePayment = (index: number, patch: Partial<SimpleField>) => {
    setForm((prev) => ({
      ...prev,
      paymentFields: prev.paymentFields.map((f, i) =>
        i === index ? { ...f, ...patch } : f,
      ),
    }));
  };

  const handleSave = async () => {
    const forSave: SimpleTripTemplate = {
      ...form,
      documentTitle: "",
      routeText: "",
      packagePrice: "",
      packageIncludesItems: [],
      tripFields: form.tripFields.map((f) => ({ ...f, value: "" })),
      tripDetailFields: form.tripDetailFields.map((f) => ({
        ...f,
        value: "",
      })),
      extraKm: { ...form.extraKm, value: "" },
      advance: { ...form.advance, value: "" },
    };
    const cleaned = saveSimpleTripTemplate(forSave);
    setForm(cleaned);
    setSaving(true);
    setSavedMsg(null);
    try {
      await saveTripConfirmationTemplateRemote(cleaned);
      setSavedMsg("Saved to your account — will stay after reopen.");
    } catch {
      setSavedMsg(
        "Saved on this device. Could not sync to server — check login/network.",
      );
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(null), 3500);
    }
  };

  const handleResetSeed = async () => {
    const reset = saveSimpleTripTemplate(
      templateToSimpleFromSeed(TRIP_CONFIRMATION_SEED),
    );
    applyTripConfirmationSeed();
    setForm(reset);
    setSaving(true);
    try {
      await saveTripConfirmationTemplateRemote(reset);
      setSavedMsg("Reset from seed and saved.");
    } catch {
      setSavedMsg("Reset on this device. Server sync failed.");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(null), 3500);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm dark:bg-gradient-to-br dark:from-indigo-600 dark:to-indigo-700 dark:ring-1 dark:ring-white/10">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <Link
              to="/trip-confirmation"
              className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Trip Confirmation
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              Confirmation template
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Preloads (company, payment, sentences) and field names. Trip
              details are filled on the main page.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleResetSeed}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-[#1e2638] dark:bg-[#141a29] dark:text-slate-200 dark:hover:bg-[#1a2236]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to seed
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loadingRemote}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 dark:bg-gradient-to-r dark:from-indigo-600 dark:to-indigo-500"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </button>
        </div>
      </div>

      {savedMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {savedMsg}
        </div>
      )}

      <div className="space-y-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-subtle dark:border-[#1e2638] dark:bg-[#0e121d]/90 dark:backdrop-blur-xl">
        <Section title="Company (preload)">
          <TextField
            label="Company name"
            value={form.companyName}
            onChange={(v) => set("companyName", v)}
          />
        </Section>

        <Section title="Trip info — field names only">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Values change every trip — set names here, fill on main page.
          </p>
          <NameList
            items={form.tripFields.map((f) => f.label)}
            onChange={(i, l) => updateName("tripFields", i, l)}
            onAdd={() => addName("tripFields")}
            onRemove={(i) => removeName("tripFields", i)}
          />
        </Section>

        <Section title="Package / trip details — field names">
          <TextField
            label="Package section heading"
            value={form.packagePriceHeading}
            onChange={(v) => set("packagePriceHeading", v)}
          />
          <TextField
            label="Includes title"
            value={form.packageIncludesTitle}
            onChange={(v) => set("packageIncludesTitle", v)}
          />
          <TextField
            label="Extra KM field name"
            value={form.extraKm.label}
            onChange={(v) => set("extraKm", { label: v, value: "" })}
          />
          <TextField
            label="Trip details heading"
            value={form.tripDetailsHeading}
            onChange={(v) => set("tripDetailsHeading", v)}
          />
          <NameList
            items={form.tripDetailFields.map((f) => f.label)}
            onChange={(i, l) => updateName("tripDetailFields", i, l)}
            onAdd={() => addName("tripDetailFields")}
            onRemove={(i) => removeName("tripDetailFields", i)}
          />
          <TextField
            label="Booking heading"
            value={form.bookingHeading}
            onChange={(v) => set("bookingHeading", v)}
          />
          <TextField
            label="Advance field name"
            value={form.advance.label}
            onChange={(v) => set("advance", { label: v, value: "" })}
          />
        </Section>

        <Section title="Sentences (preload)">
          <TextField
            label="Booking confirm sentence"
            value={form.bookingNote}
            onChange={(v) => set("bookingNote", v)}
          />
          <TextField
            label="Balance sentence"
            value={form.bookingSubNote}
            onChange={(v) => set("bookingSubNote", v)}
          />
          <TextField
            label="Vehicle available sentence"
            value={form.vehicleAvailableSentence}
            onChange={(v) => set("vehicleAvailableSentence", v)}
          />
          <TextField
            label="Footer brand"
            value={form.footerBrand}
            onChange={(v) => set("footerBrand", v)}
          />
          <TextField
            label="Footer tagline"
            value={form.footerTagline}
            onChange={(v) => set("footerTagline", v)}
          />
        </Section>

        <Section title="Payment details (preload)" last>
          <TextField
            label="Section heading"
            value={form.paymentHeading}
            onChange={(v) => set("paymentHeading", v)}
          />
          {form.paymentFields.map((f, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className={labelCls}>Field name</span>
                <input
                  className={keyInputCls}
                  value={f.label}
                  onChange={(e) => updatePayment(i, { label: e.target.value })}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Preload value</span>
                <input
                  className={inputCls}
                  value={f.value}
                  onChange={(e) => updatePayment(i, { value: e.target.value })}
                />
              </label>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              set("paymentFields", [
                ...form.paymentFields,
                { label: "New field", value: "" },
              ])
            }
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            <Plus className="h-3.5 w-3.5" /> Add payment field
          </button>
          <p className={`${labelCls} !mb-2 mt-2`}>Bank / account lines</p>
          {form.bankLines.map((line, i) => (
            <input
              key={i}
              className={inputCls}
              value={line}
              placeholder={`Line ${i + 1}`}
              onChange={(e) => {
                const next = [...form.bankLines];
                next[i] = e.target.value;
                set("bankLines", next);
              }}
            />
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`space-y-3 p-5 sm:p-6 ${
        last ? "" : "border-b border-slate-100 dark:border-[#1e2638]"
      }`}
    >
      <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
        {title}
      </h2>
      {children}
    </div>
  );
}

function TextField({
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

function NameList({
  items,
  onChange,
  onAdd,
  onRemove,
}: {
  items: string[];
  onChange: (index: number, label: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            className={keyInputCls}
            value={item}
            onChange={(e) => onChange(i, e.target.value)}
            placeholder="Field name"
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="rounded-lg border border-slate-200 p-2 text-rose-400 hover:bg-rose-50 dark:border-white/10 dark:hover:bg-rose-500/10"
            aria-label="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
      >
        <Plus className="h-3.5 w-3.5" /> Add field
      </button>
    </div>
  );
}
