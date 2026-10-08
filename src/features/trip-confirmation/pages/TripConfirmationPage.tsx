import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileCheck2,
  Download,
  RotateCcw,
  Settings2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  generateTripConfirmationPdf,
  loadTripConfirmationDefaults,
  newField,
  type TemplateBlock,
  type TripConfirmationTemplate,
} from "../pdf";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20";

const labelInputCls =
  "min-w-0 flex-1 rounded-full border border-dashed border-slate-300 bg-slate-50/70 px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none transition focus:border-solid focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 dark:border-white/20 dark:bg-white/5 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:bg-white/10";

const sheetCard =
  "relative flex flex-col gap-5 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-subtle md:p-6 dark:border-[#1e2638] dark:bg-[#0e121d]/90 dark:backdrop-blur-xl";

const btnSecondary =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 active:scale-95 dark:border-[#1e2638] dark:bg-[#141a29]/90 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-[#1a2236] dark:hover:text-white";

const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/30 transition hover:bg-indigo-700 active:scale-95 dark:bg-gradient-to-r dark:from-indigo-600 dark:to-indigo-500 dark:shadow-indigo-500/25";

/** Fill values for this client; template defines field names & preloads. */
export function TripConfirmationPage() {
  const [data, setData] = useState<TripConfirmationTemplate>(() =>
    structuredClone(loadTripConfirmationDefaults()),
  );

  const reloadTemplate = useCallback(() => {
    setData(structuredClone(loadTripConfirmationDefaults()));
  }, []);

  const updateBlock = (id: string, patch: Partial<TemplateBlock>) => {
    setData((prev) => ({
      blocks: prev.blocks.map((b) =>
        b.id === id ? ({ ...b, ...patch } as TemplateBlock) : b,
      ),
    }));
  };

  const updateCompanyName = (text: string) => {
    setData((prev) => ({
      blocks: prev.blocks.map((b) =>
        b.type === "heading" && b.style === "company" ? { ...b, text } : b,
      ),
    }));
  };

  const addSubfield = (blockId: string) => {
    setData((prev) => ({
      blocks: prev.blocks.map((b) => {
        if (b.id !== blockId || b.type !== "fields") return b;
        return { ...b, fields: [...b.fields, newField("", "")] };
      }),
    }));
  };

  const removeSubfield = (blockId: string, fieldIndex: number) => {
    setData((prev) => ({
      blocks: prev.blocks.map((b) => {
        if (b.id !== blockId || b.type !== "fields") return b;
        return {
          ...b,
          fields: b.fields.filter((_, i) => i !== fieldIndex),
        };
      }),
    }));
  };

  const handleDownload = useCallback(() => {
    generateTripConfirmationPdf(data);
  }, [data]);

  const downloadRef = useRef(handleDownload);
  downloadRef.current = handleDownload;

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

  const firstCompanyId = data.blocks.find(
    (b) => b.type === "heading" && b.style === "company",
  )?.id;
  const firstTitleId = data.blocks.find(
    (b) => b.type === "heading" && b.style === "title",
  )?.id;

  const pageBreakIndex = data.blocks.findIndex((b) => b.type === "pageBreak");
  const page1Blocks =
    pageBreakIndex >= 0 ? data.blocks.slice(0, pageBreakIndex) : data.blocks;
  const page2Blocks =
    pageBreakIndex >= 0 ? data.blocks.slice(pageBreakIndex + 1) : [];

  const renderBlock = (block: (typeof data.blocks)[number]) => {
    if (block.type === "heading") {
      // Company + document title render together in a 2-col row (see page1).
      if (block.style === "company" || block.style === "title") {
        return null;
      }
      const text = (block.text || "").trim();
      if (!text) return null;
      return (
        <p
          key={block.id}
          className="border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400"
        >
          {text}
        </p>
      );
    }

    if (block.type === "fields") {
      return (
        <div key={block.id} className="space-y-3">
          <div className="grid gap-3.5 sm:grid-cols-2">
            {block.fields.map((f, fi) => (
              <div
                key={f.id}
                className="space-y-2 rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-xs dark:border-[#1e2638] dark:bg-[#141a29]/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    className={labelInputCls}
                    value={f.label}
                    onChange={(e) => {
                      const fields = block.fields.map((x, i) =>
                        i === fi ? { ...x, label: e.target.value } : x,
                      );
                      updateBlock(block.id, { fields });
                    }}
                    placeholder="Field name"
                  />
                  <button
                    type="button"
                    onClick={() => removeSubfield(block.id, fi)}
                    className="shrink-0 rounded-md p-1 text-rose-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                    aria-label="Remove field"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:border-indigo-400"
                  value={f.value}
                  onChange={(e) => {
                    const fields = block.fields.map((x, i) =>
                      i === fi ? { ...x, value: e.target.value } : x,
                    );
                    updateBlock(block.id, { fields });
                  }}
                  placeholder={
                    f.label ? `Enter ${f.label}…` : "Enter value…"
                  }
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => addSubfield(block.id)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            <Plus className="h-3.5 w-3.5" /> Add field
          </button>
        </div>
      );
    }

    if (block.type === "text") {
      return (
        <label key={block.id} className="block">
          <textarea
            className={`${inputCls} min-h-[56px] resize-y ${
              block.bold ? "font-semibold" : ""
            } ${block.underline ? "underline decoration-2 underline-offset-4" : ""}`}
            value={block.text}
            onChange={(e) => updateBlock(block.id, { text: e.target.value })}
            placeholder="Enter text…"
          />
        </label>
      );
    }

    if (block.type === "list") {
      return (
        <div key={block.id} className="space-y-2">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {block.title || "List"}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {block.items.map((item, ii) => (
              <div key={ii} className="flex gap-2">
                <input
                  className={inputCls}
                  value={item}
                  onChange={(e) => {
                    const items = block.items.map((x, i) =>
                      i === ii ? e.target.value : x,
                    );
                    updateBlock(block.id, { items });
                  }}
                  placeholder="Item"
                />
                <button
                  type="button"
                  onClick={() => {
                    updateBlock(block.id, {
                      items: block.items.filter((_, i) => i !== ii),
                    });
                  }}
                  className="rounded-lg border border-slate-200 p-2 text-rose-400 hover:bg-rose-50 dark:border-white/10 dark:hover:bg-rose-500/10"
                  aria-label="Remove item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              updateBlock(block.id, { items: [...block.items, ""] })
            }
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            <Plus className="h-3.5 w-3.5" /> Add item
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24 animate-fade-in">
      {/* Title + actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm dark:bg-gradient-to-br dark:from-indigo-600 dark:to-indigo-700 dark:shadow-indigo-600/30 dark:ring-1 dark:ring-white/10">
            <FileCheck2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
              Trip Confirmation
            </h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Fill trip details for this client. Payment &amp; sentences come
              from the template seed.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <Link to="/trip-confirmation/template" className={btnSecondary}>
            <Settings2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            Edit template
          </Link>
          <button
            type="button"
            onClick={reloadTemplate}
            className={btnSecondary}
            title="Reload saved template"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            Reload
          </button>
          <button type="button" onClick={handleDownload} className={btnPrimary}>
            <Download className="h-4 w-4" />
            <span>Download PDF</span>
            <kbd className="hidden rounded bg-indigo-700/60 px-1.5 py-0.5 font-mono text-[10px] text-indigo-100 sm:inline-block dark:border dark:border-white/10 dark:bg-black/30">
              Ctrl+Enter
            </kbd>
          </button>
        </div>
      </div>

      {/* Two sheet columns */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <section className={sheetCard}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#1e2638]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-500 dark:shadow-sm dark:shadow-indigo-500/50" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Page 1 — Trip &amp; client
              </span>
            </div>
            <span className="font-mono text-xs text-slate-400">1 / 2</span>
          </div>
          <div className="flex flex-col gap-5">
            {/* Company + title side by side for quicker fill */}
            {(firstCompanyId || firstTitleId) && (
              <div className="grid gap-3.5 sm:grid-cols-2">
                {page1Blocks
                  .filter(
                    (b) =>
                      b.type === "heading" &&
                      ((b.style === "company" && b.id === firstCompanyId) ||
                        (b.style === "title" && b.id === firstTitleId)),
                  )
                  .map((block) => {
                    if (block.type !== "heading") return null;
                    if (block.style === "company") {
                      return (
                        <label key={block.id} className="block space-y-1.5">
                          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                            Company name
                          </span>
                          <input
                            className={`${inputCls} font-bold tracking-wider`}
                            value={block.text}
                            onChange={(e) => updateCompanyName(e.target.value)}
                            placeholder="e.g. INWAY CABS"
                          />
                        </label>
                      );
                    }
                    return (
                      <label key={block.id} className="block space-y-1.5">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                          Document title
                        </span>
                        <input
                          className={`${inputCls} bg-slate-50/50 text-xs font-semibold uppercase tracking-wider dark:bg-white/5`}
                          value={block.text}
                          onChange={(e) =>
                            updateBlock(block.id, { text: e.target.value })
                          }
                          placeholder="ENTER DOCUMENT TITLE…"
                        />
                      </label>
                    );
                  })}
              </div>
            )}
            {page1Blocks.map((block) => renderBlock(block))}
          </div>
        </section>

        <section className={sheetCard}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#1e2638]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Page 2 — Payment &amp; bank
              </span>
            </div>
            <span className="font-mono text-xs text-slate-400">2 / 2</span>
          </div>
          <div className="flex flex-col gap-5">
            {page2Blocks.length > 0 ? (
              page2Blocks.map((block) => renderBlock(block))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Payment &amp; bank fields load from the template. Click Reload
                if this column is empty.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden dark:border-[#1e2638] dark:bg-[#0b0e14]/95">
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
