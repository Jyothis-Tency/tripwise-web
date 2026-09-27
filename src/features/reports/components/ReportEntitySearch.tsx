import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, User, Car, Building2, Hash } from "lucide-react";
import type { Driver } from "../../drivers/api";
import type { Vehicle } from "../../vehicles/api";
import type { Agency } from "../../bulk-entry/api";
import { formatAgencyLabel } from "../../../lib/agencyDisplay";

export type ReportEntityFilter =
  | { type: "driver"; id: string; label: string }
  | { type: "vehicle"; id: string; label: string }
  | { type: "agency"; name: string; label: string }
  | { type: "trip"; tripNumber: string; label: string };

type Suggestion =
  | { kind: "driver"; id: string; label: string }
  | { kind: "vehicle"; id: string; label: string }
  | { kind: "agency"; name: string; label: string }
  | { kind: "trip"; tripNumber: string; label: string };

function driverLabel(d: Driver): string {
  return `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || d.email || d._id;
}

export function ReportEntitySearch({
  value,
  onChange,
  onQueryChange,
  drivers,
  vehicles,
  agencies,
  tripNumberSuggestions = [],
  loadingTrips = false,
}: {
  value: ReportEntityFilter | null;
  onChange: (filter: ReportEntityFilter | null) => void;
  /** Fired when user types (for trip-number API suggestions). */
  onQueryChange?: (query: string) => void;
  drivers: Driver[];
  vehicles: Vehicle[];
  agencies: Agency[];
  tripNumberSuggestions?: string[];
  loadingTrips?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const suggestions = useMemo((): Suggestion[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const out: Suggestion[] = [];
    const seen = new Set<string>();

    for (const d of drivers) {
      const label = driverLabel(d);
      if (!label.toLowerCase().includes(q)) continue;
      const key = `driver:${d._id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: "driver", id: d._id, label });
      if (out.length >= 12) break;
    }

    for (const v of vehicles) {
      const label = v.vehicleNumber ?? "";
      if (!label.toLowerCase().includes(q)) continue;
      const key = `vehicle:${v._id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: "vehicle", id: v._id, label });
      if (out.length >= 16) break;
    }

    for (const a of agencies) {
      const label = formatAgencyLabel(a);
      if (
        !a.name.toLowerCase().includes(q) &&
        !label.toLowerCase().includes(q)
      ) {
        continue;
      }
      const key = `agency:${a.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: "agency", name: a.name, label });
      if (out.length >= 20) break;
    }

    for (const tn of tripNumberSuggestions) {
      if (!tn.toLowerCase().includes(q)) continue;
      const key = `trip:${tn}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: "trip", tripNumber: tn, label: tn });
      if (out.length >= 24) break;
    }

    return out;
  }, [query, drivers, vehicles, agencies, tripNumberSuggestions]);

  const selectSuggestion = (s: Suggestion) => {
    if (s.kind === "driver") {
      onChange({ type: "driver", id: s.id, label: s.label });
    } else if (s.kind === "vehicle") {
      onChange({ type: "vehicle", id: s.id, label: s.label });
    } else if (s.kind === "agency") {
      onChange({ type: "agency", name: s.name, label: s.label });
    } else {
      onChange({ type: "trip", tripNumber: s.tripNumber, label: s.label });
    }
    setQuery("");
    setOpen(false);
  };

  const iconFor = (kind: Suggestion["kind"]) => {
    switch (kind) {
      case "driver":
        return <User className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />;
      case "vehicle":
        return (
          <Car className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        );
      case "agency":
        return (
          <Building2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        );
      case "trip":
        return <Hash className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  const kindLabel = (kind: Suggestion["kind"]) => {
    switch (kind) {
      case "driver":
        return "Driver";
      case "vehicle":
        return "Vehicle";
      case "agency":
        return "Agency";
      case "trip":
        return "Trip #";
    }
  };

  return (
    <div ref={wrapRef} className="relative space-y-2">
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Search entity / ID
      </label>
      {value && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-200">
            {iconFor(value.type === "trip" ? "trip" : value.type)}
            <span className="text-xs uppercase text-indigo-600/80 dark:text-indigo-400">
              {value.type === "trip"
                ? "Trip"
                : value.type.charAt(0).toUpperCase() + value.type.slice(1)}
            </span>
            {value.label}
            <button
              type="button"
              onClick={() => onChange(null)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-500/25"
              aria-label="Clear filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            onQueryChange?.(v);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search trip number, driver, vehicle, or agency…"
          className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] py-2.5 pl-10 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 disabled:opacity-60 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400"
          disabled={!!value}
        />
        {query && !value && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onQueryChange?.("");
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && !value && query.trim() && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-[var(--bg-card)] shadow-lg dark:border-[#1e2638]">
          {loadingTrips && suggestions.length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              Searching trips…
            </p>
          )}
          {!loadingTrips && suggestions.length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              No matches
            </p>
          )}
          {suggestions.map((s) => (
            <button
              key={`${s.kind}-${s.kind === "agency" ? s.name : s.kind === "trip" ? s.tripNumber : s.id}`}
              type="button"
              onClick={() => selectSuggestion(s)}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-indigo-50/60 dark:border-[#1e2638] dark:hover:bg-indigo-500/10"
            >
              {iconFor(s.kind)}
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                {s.label}
              </span>
              <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                {kindLabel(s.kind)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
