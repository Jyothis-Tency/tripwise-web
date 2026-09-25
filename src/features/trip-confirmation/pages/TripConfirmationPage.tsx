import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileCheck2,
  Download,
  RotateCcw,
  Settings2,
} from "lucide-react";
import {
  generateTripConfirmationPdf,
  loadTripConfirmationDefaults,
  stripTemplateValues,
  type TemplateBlock,
  type TripConfirmationTemplate,
} from "../pdf";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

/** Fill client values from saved template — structure/labels edited on Template page. */
export function TripConfirmationPage() {
  const [data, setData] = useState<TripConfirmationTemplate>(() =>
    stripTemplateValues(structuredClone(loadTripConfirmationDefaults())),
  );

  const reloadTemplate = useCallback(() => {
    setData(
      stripTemplateValues(structuredClone(loadTripConfirmationDefaults())),
    );
  }, []);

  // Refresh when returning from template editor (same tab focus)
  useEffect(() => {
    const onFocus = () => reloadTemplate();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reloadTemplate]);

  const updateBlock = (id: string, patch: Partial<TemplateBlock>) => {
    setData((prev) => ({
      blocks: prev.blocks.map((b) =>
        b.id === id ? ({ ...b, ...patch } as TemplateBlock) : b,
      ),
    }));
  };

  const handleDownload = () => generateTripConfirmationPdf(data);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
              Trip Confirmation
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Fill values for this client, then download the PDF.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/trip-confirmation/template"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:text-sm"
          >
            <Settings2 className="h-4 w-4" />
            Edit template
          </Link>
          <button
            type="button"
            onClick={reloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:text-sm"
            title="Reload saved template"
          >
            <RotateCcw className="h-4 w-4" />
            Reload
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 sm:text-sm"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {data.blocks.map((block) => {
          if (block.type === "pageBreak") {
            return (
              <div
                key={block.id}
                className="border-t border-dashed border-slate-200 pt-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400"
              >
                Page 2
              </div>
            );
          }

          if (block.type === "heading") {
            const size =
              block.style === "company"
                ? "text-lg font-black tracking-tight text-slate-900"
                : block.style === "title"
                  ? "text-sm font-bold uppercase tracking-wide text-slate-800"
                  : "text-xs font-bold uppercase tracking-wider text-slate-500";
            return (
              <p key={block.id} className={size}>
                {block.text || "—"}
              </p>
            );
          }

          if (block.type === "fields") {
            return (
              <div key={block.id} className="space-y-3">
                {block.fields.map((f, fi) => (
                  <label key={f.id} className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">
                      {f.label || "Field"}
                    </span>
                    <input
                      className={inputCls}
                      value={f.value}
                      onChange={(e) => {
                        const fields = block.fields.map((x, i) =>
                          i === fi ? { ...x, value: e.target.value } : x,
                        );
                        updateBlock(block.id, { fields });
                      }}
                      placeholder={`Enter ${f.label || "value"}…`}
                    />
                  </label>
                ))}
              </div>
            );
          }

          if (block.type === "text") {
            return (
              <label key={block.id} className="block">
                <textarea
                  className={`${inputCls} min-h-[56px] resize-y ${
                    block.bold ? "font-semibold" : ""
                  }`}
                  value={block.text}
                  onChange={(e) =>
                    updateBlock(block.id, { text: e.target.value })
                  }
                />
              </label>
            );
          }

          if (block.type === "list") {
            return (
              <div key={block.id} className="space-y-2">
                <p className="text-xs font-bold text-slate-700">
                  {block.title || "List"}
                </p>
                {block.items.map((item, ii) => (
                  <input
                    key={ii}
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
                ))}
              </div>
            );
          }

          return null;
        })}
      </div>

      <div className="sticky bottom-3 z-10 flex justify-end pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-700"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </button>
      </div>
    </div>
  );
}
