import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  fetchAgencies,
  createAgency,
  type Agency,
} from "../features/bulk-entry/api";

function ModalShell({
  title,
  onClose,
  children,
  maxWidth = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onClick={(e) => e.target === ref.current && onClose()}
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div
        className={`w-full ${maxWidth} flex max-h-[90vh] flex-col rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function CreateAgencyModal({
  onClose,
  onCreated,
  initialName = "",
}: {
  onClose: () => void;
  onCreated: (a: Agency) => void;
  initialName?: string;
}) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setErr("Agency name is required");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const agency = await createAgency(name.trim());
      onCreated(agency);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      setErr(msg ?? "Failed to create agency");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Create New Agency" onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-4 p-6">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">
            Agency name <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErr(null);
            }}
            placeholder="Enter agency name"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export type AgencyNameComboboxProps = {
  id: string;
  value: string;
  onChange: (name: string) => void;
  inputClassName: string;
  required?: boolean;
  placeholder?: string;
  /** Include these in suggestions even if missing from the latest agencies response (e.g. legacy trip name). */
  extraSuggestionNames?: string[];
};

/**
 * Trip agency field backed by the same owner agencies list as Bulk Entry
 * (`GET/POST /owners/agencies`), with optional in-place create.
 */
export function AgencyNameCombobox({
  id,
  value,
  onChange,
  inputClassName,
  required,
  placeholder = "Agency name",
  extraSuggestionNames = [],
}: AgencyNameComboboxProps) {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPreset, setCreatePreset] = useState("");

  const reload = useCallback(async () => {
    try {
      const { agencies: list } = await fetchAgencies(1, 500);
      setAgencies(list);
    } catch {
      /* keep typed value usable */
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const suggestionPool = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const a of agencies) {
      const n = a.name?.trim();
      if (n) byKey.set(n.toLowerCase(), n);
    }
    for (const ex of extraSuggestionNames) {
      const n = ex?.trim();
      if (n && !byKey.has(n.toLowerCase())) byKey.set(n.toLowerCase(), n);
    }
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
  }, [agencies, extraSuggestionNames]);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestionPool.slice(0, 10);
    return suggestionPool
      .filter((n) => n.toLowerCase().includes(q))
      .slice(0, 10);
  }, [suggestionPool, value]);

  const exactMatch = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return false;
    return suggestionPool.some((n) => n.toLowerCase() === q);
  }, [suggestionPool, value]);

  const openCreate = (preset: string) => {
    setCreatePreset(preset);
    setCreateOpen(true);
    setShowSuggestions(false);
  };

  const panelVisible =
    showSuggestions && (filtered.length > 0 || (!!value.trim() && !exactMatch));

  return (
    <>
      <div className="relative">
        <input
          id={id}
          required={required}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          autoComplete="off"
          className={inputClassName}
          placeholder={placeholder}
        />
        {panelVisible && (
          <div className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
            {filtered.map((name) => (
              <button
                key={name}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(name);
                  setShowSuggestions(false);
                }}
              >
                {name}
              </button>
            ))}
            {value.trim() && !exactMatch && (
              <button
                type="button"
                className="w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  openCreate(value.trim());
                }}
              >
                + Create agency &quot;{value.trim()}&quot;
              </button>
            )}
          </div>
        )}
      </div>
      {createOpen && (
        <CreateAgencyModal
          initialName={createPreset}
          onClose={() => setCreateOpen(false)}
          onCreated={async (a) => {
            onChange(a.name);
            setCreateOpen(false);
            await reload();
          }}
        />
      )}
    </>
  );
}
