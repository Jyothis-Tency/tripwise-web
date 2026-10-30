import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileCheck2,
  Download,
  Settings2,
  Plus,
  Trash2,
  Eye,
  Edit3,
  Save,
  Check,
  Bold,
  Sparkles,
} from "lucide-react";
import {
  DEFAULT_INWAY_CONFIRMATION_DATA,
  generateTripConfirmationPdf,
  loadTripConfirmationDocument,
  saveTripConfirmationDocument,
  type ConfirmationTableRow,
  type TripConfirmationDocument,
} from "../pdf";
import { TripConfirmationPreviewDocument } from "../components/TripConfirmationPreviewDocument";
import { fetchTripConfirmationTemplate, saveTripConfirmationTemplateRemote } from "../api";
import { useAuth } from "../../../hooks/useAuth";
import { useBrand } from "../../../lib/brand";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20";

const labelInputCls =
  "min-w-0 flex-1 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-2.5 py-1 text-xs font-bold text-slate-800 outline-none transition focus:border-solid focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 dark:border-white/20 dark:bg-white/5 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:bg-white/10";

const cardCls =
  "relative flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-[#1e2638] dark:bg-[#0e121d]/90 dark:backdrop-blur-xl";

const btnSecondary =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 active:scale-95 dark:border-[#1e2638] dark:bg-[#141a29]/90 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-[#1a2236] dark:hover:text-white";

const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/30 transition hover:bg-indigo-700 active:scale-95 dark:bg-gradient-to-r dark:from-indigo-600 dark:to-indigo-500 dark:shadow-indigo-500/25";

export function TripConfirmationPage() {
  const { user } = useAuth();
  const { isInway } = useBrand();
  const [doc, setDoc] = useState<TripConfirmationDocument>(() =>
    loadTripConfirmationDocument(),
  );
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Adapt default template for non-Inway owners if no local custom doc exists
  useEffect(() => {
    if (!isInway && user && doc.companyName === "INWAY CABS") {
      const hasSaved = !!localStorage.getItem("tripwise.tripConfirmation.doc.v6");
      if (!hasSaved) {
        const comp = user.company?.trim() || user.name?.trim() || "Tripwise Fleet";
        setDoc((prev) => ({
          ...prev,
          companyName: comp,
          subtitle: "Fleet Operations",
          footerBrand: comp,
          footerContact: [user.phone, user.email].filter(Boolean).join(" · ") || prev.footerContact,
        }));
      }
    }
  }, [isInway, user]);

  // Sync to localStorage on change
  useEffect(() => {
    saveTripConfirmationDocument(doc);
  }, [doc]);

  // Load from remote if available
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchTripConfirmationTemplate();
        if (!cancelled && remote) {
          // If remote exists, check if user hasn't heavily customized
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDownload = useCallback(() => {
    generateTripConfirmationPdf(doc);
  }, [doc]);

  const downloadRef = useRef(handleDownload);
  downloadRef.current = handleDownload;

  // Keyboard shortcut Ctrl+Enter / Cmd+Enter
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
        ev.preventDefault();
        downloadRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const updateHeader = (
    field: "companyName" | "subtitle" | "documentTitle",
    value: string,
  ) => {
    setDoc((prev) => ({ ...prev, [field]: value }));
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setDoc((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, title } : s,
      ),
    }));
  };

  const updateRow = (
    sectionId: string,
    rowId: string,
    patch: Partial<ConfirmationTableRow>,
  ) => {
    setDoc((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              rows: s.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
            }
          : s,
      ),
    }));
  };

  const addRow = (sectionId: string) => {
    const newId = `row_${Math.random().toString(36).slice(2, 8)}`;
    setDoc((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              rows: [...s.rows, { id: newId, label: "New Field", value: "" }],
            }
          : s,
      ),
    }));
  };

  const removeRow = (sectionId: string, rowId: string) => {
    setDoc((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              rows: s.rows.filter((r) => r.id !== rowId),
            }
          : s,
      ),
    }));
  };

  const loadSample = () => {
    setDoc(structuredClone(DEFAULT_INWAY_CONFIRMATION_DATA));
  };

  const saveDefaults = async () => {
    saveTripConfirmationDocument(doc);
    try {
      // also sync to backend
      const { confirmationDocumentToSimple } = await import("../pdf");
      const simple = confirmationDocumentToSimple(doc);
      await saveTripConfirmationTemplateRemote(simple);
    } catch {}
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-[#07090e]">
      {/* Top action bar */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 dark:border-[#1e2638] dark:bg-[#0c0e15]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm dark:bg-gradient-to-br dark:from-indigo-600 dark:to-indigo-700 dark:shadow-indigo-600/30">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl">
              Trip Confirmation
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live document preview · Instant PDF export
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mobile view toggle */}
          <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 lg:hidden dark:border-[#1e2638] dark:bg-slate-900/60">
            <button
              type="button"
              onClick={() => setMobileTab("edit")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                mobileTab === "edit"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-[#141a29] dark:text-white"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("preview")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                mobileTab === "preview"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-[#141a29] dark:text-white"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Preview</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadSample}
            className={btnSecondary}
            title="Load the exact Inway Cabs quotation sample"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden sm:inline">Load Sample</span>
          </button>

          <button
            type="button"
            onClick={saveDefaults}
            className={btnSecondary}
            title="Save current layout & payment details as default"
          >
            {savedSuccess ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Saved</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                <span className="hidden sm:inline">Save Default</span>
              </>
            )}
          </button>

          <Link
            to="/trip-confirmation/template"
            className={btnSecondary}
            title="Configure global template defaults"
          >
            <Settings2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span className="hidden md:inline">Template</span>
          </Link>

          <button
            type="button"
            onClick={handleDownload}
            className={btnPrimary}
            title="Export exact PDF (Ctrl+Enter)"
          >
            <Download className="h-4 w-4" />
            <span>Download PDF</span>
            <kbd className="hidden rounded bg-indigo-700/60 px-1.5 py-0.5 font-mono text-[10px] text-indigo-100 sm:inline-block dark:border dark:border-white/10 dark:bg-black/30">
              Ctrl+Enter
            </kbd>
          </button>
        </div>
      </header>

      {/* Main split content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Left pane: Builder / Form Editor */}
        <aside
          className={`w-full shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50/50 p-4 lg:w-[460px] xl:w-[500px] dark:border-[#1e2638] dark:bg-[#090d16] ${
            mobileTab === "preview" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="space-y-5 pb-24">
            {/* Header Card */}
            <section className={cardCls}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-[#1e2638]">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Header Details
                </span>
              </div>
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Company Name
                  </span>
                  <input
                    className={`${inputCls} font-bold tracking-wide`}
                    value={doc.companyName}
                    onChange={(e) => updateHeader("companyName", e.target.value)}
                    placeholder="e.g. INWAY CABS"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Subtitle
                  </span>
                  <input
                    className={inputCls}
                    value={doc.subtitle}
                    onChange={(e) => updateHeader("subtitle", e.target.value)}
                    placeholder="e.g. Premium Taxi Service · Kochi"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Document Title
                  </span>
                  <input
                    className={`${inputCls} font-bold uppercase tracking-wider`}
                    value={doc.documentTitle}
                    onChange={(e) =>
                      updateHeader("documentTitle", e.target.value)
                    }
                    placeholder="TRIP CONFIRMATION"
                  />
                </label>
              </div>
            </section>

            {/* Sections */}
            {doc.sections.map((section) => (
              <section key={section.id} className={cardCls}>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-[#1e2638]">
                  <input
                    className="border-none bg-transparent text-xs font-black uppercase tracking-wider text-slate-800 outline-none focus:ring-0 dark:text-slate-200"
                    value={section.title}
                    onChange={(e) =>
                      updateSectionTitle(section.id, e.target.value)
                    }
                  />
                  <span className="text-[11px] font-medium text-slate-400">
                    {section.rows.length} fields
                  </span>
                </div>

                <div className="space-y-2.5">
                  {section.rows.map((row) => (
                    <div
                      key={row.id}
                      className="group flex flex-col gap-1.5 rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-xs transition hover:border-slate-300 dark:border-[#1e2638] dark:bg-[#141a29]/60 dark:hover:border-slate-600"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          className={labelInputCls}
                          value={row.label}
                          onChange={(e) =>
                            updateRow(section.id, row.id, {
                              label: e.target.value,
                            })
                          }
                          placeholder="Label name"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateRow(section.id, row.id, {
                                isBold: !row.isBold,
                              })
                            }
                            className={`rounded-md p-1 transition ${
                              row.isBold
                                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
                                : "text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                            }`}
                            title="Toggle bold value"
                          >
                            <Bold className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(section.id, row.id)}
                            className="rounded-md p-1 text-slate-400 opacity-60 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                            title="Remove field"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <input
                        className={`w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-indigo-400 ${
                          row.isBold ? "font-bold" : ""
                        }`}
                        value={row.value}
                        onChange={(e) =>
                          updateRow(section.id, row.id, {
                            value: e.target.value,
                          })
                        }
                        placeholder={
                          row.label ? `Enter ${row.label}…` : "Enter value…"
                        }
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addRow(section.id)}
                    className="inline-flex items-center gap-1.5 pt-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Row</span>
                  </button>
                </div>
              </section>
            ))}

            {/* Note & Footer Card */}
            <section className={cardCls}>
              <div className="border-b border-slate-100 pb-2 dark:border-[#1e2638]">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Notes &amp; Footer
                </span>
              </div>
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Pre-booking Note
                  </span>
                  <input
                    className={`${inputCls} italic`}
                    value={doc.preBookingNote}
                    onChange={(e) =>
                      setDoc((p) => ({ ...p, preBookingNote: e.target.value }))
                    }
                    placeholder="Vehicle available on pre-booking basis only."
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Footer Brand
                  </span>
                  <input
                    className={`${inputCls} font-bold`}
                    value={doc.footerBrand}
                    onChange={(e) =>
                      setDoc((p) => ({ ...p, footerBrand: e.target.value }))
                    }
                    placeholder="INWAY CABS"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Footer Tagline
                  </span>
                  <input
                    className={inputCls}
                    value={doc.footerTagline}
                    onChange={(e) =>
                      setDoc((p) => ({ ...p, footerTagline: e.target.value }))
                    }
                    placeholder="Professional Service • Clean Vehicles..."
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Contact details &amp; Website (Header &amp; Footer)
                  </span>
                  <input
                    className={inputCls}
                    value={doc.footerContact}
                    onChange={(e) =>
                      setDoc((p) => ({ ...p, footerContact: e.target.value }))
                    }
                    placeholder="+91 80865 56655 · inwaycabs@gmail.com · inwaycabs.in"
                  />
                </label>
              </div>
            </section>
          </div>
        </aside>

        {/* Right pane: Live Document Preview */}
        <main
          className={`relative flex min-w-0 flex-1 flex-col overflow-hidden ${
            mobileTab === "edit" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Subtle dotted background grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }}
          />

          <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="mx-auto w-full max-w-[840px] space-y-3 p-4 sm:p-6 lg:p-8">
              {/* Document preview header indicator */}
              <div className="flex items-center justify-between gap-2 px-1">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Live Document Preview
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Exact print and PDF rendering · updates in real-time
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs backdrop-blur transition hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200"
                >
                  <Download className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Download PDF</span>
                </button>
              </div>

              {/* The Paper Document */}
              <TripConfirmationPreviewDocument document={doc} />
            </div>
          </div>
        </main>
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden dark:border-[#1e2638] dark:bg-[#0b0e14]/95">
        <button
          type="button"
          onClick={handleDownload}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </button>
      </div>
    </div>
  );
}
