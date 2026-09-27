import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Search,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

export const filterControlCls =
  "h-10 w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3.5 text-sm text-slate-800 shadow-xs outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 dark:border-[#1e2638] dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-white/15 dark:focus:border-indigo-400";

export function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {children}
    </span>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  resultCount,
  autoFocus,
  size = "md",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  resultCount?: number;
  autoFocus?: boolean;
  size?: "sm" | "md";
}) {
  const isSm = size === "sm";
  const showClear = Boolean(value);
  const showCount = typeof resultCount === "number" && value.trim().length > 0;

  return (
    <div
      className={`group relative flex w-full items-center rounded-lg border border-slate-200 bg-[var(--bg-elevated)] shadow-xs transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/15 hover:border-slate-300 dark:border-[#1e2638] dark:hover:border-white/15 ${
        isSm ? "h-9" : "h-11"
      }`}
    >
      <span
        className={`pointer-events-none flex shrink-0 items-center justify-center text-slate-400 group-focus-within:text-indigo-500 dark:text-slate-500 dark:group-focus-within:text-indigo-400 ${
          isSm ? "w-9" : "w-11"
        }`}
      >
        <Search className={isSm ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} />
      </span>

      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`min-w-0 flex-1 border-0 bg-transparent py-0 text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500 ${
          isSm ? "text-xs" : "text-sm"
        }`}
      />

      <span className="flex shrink-0 items-center gap-1 pr-2">
        {showCount && (
          <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            {resultCount}
          </span>
        )}
        {showClear ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className={isSm ? "w-1" : "w-2"} aria-hidden />
        )}
      </span>
    </div>
  );
}

export function SortToggle({
  value,
  onChange,
}: {
  value: "desc" | "asc";
  onChange: (v: "desc" | "asc") => void;
}) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2">
      <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 sm:inline">
        Sort
      </span>
      <div
        className="inline-flex h-11 items-stretch rounded-lg border border-slate-200 bg-slate-100 p-1 shadow-xs dark:border-[#1e2638] dark:bg-white/5"
        role="group"
        aria-label="Sort order"
      >
        <button
          type="button"
          onClick={() => onChange("desc")}
          className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 text-xs font-semibold transition sm:min-w-[6.5rem] ${
            value === "desc"
              ? "bg-[var(--bg-card)] text-indigo-600 shadow-xs dark:bg-[#0e121d] dark:text-indigo-300"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <ArrowDownWideNarrow className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
          Newest
        </button>
        <button
          type="button"
          onClick={() => onChange("asc")}
          className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 text-xs font-semibold transition sm:min-w-[6.5rem] ${
            value === "asc"
              ? "bg-[var(--bg-card)] text-indigo-600 shadow-xs dark:bg-[#0e121d] dark:text-indigo-300"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <ArrowUpWideNarrow className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
          Oldest
        </button>
      </div>
    </div>
  );
}

/** Combined search + sort row for history filters. */
export function SearchSortBar({
  search,
  onSearchChange,
  searchPlaceholder,
  resultCount,
  sort,
  onSortChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  resultCount?: number;
  sort: "desc" | "asc";
  onSortChange: (v: "desc" | "asc") => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          resultCount={resultCount}
        />
      </div>
      <SortToggle value={sort} onChange={onSortChange} />
    </div>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
  tone = "neutral",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: "neutral" | "in" | "out";
}) {
  const activeCls =
    tone === "in"
      ? "border-emerald-400/60 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20"
      : tone === "out"
        ? "border-rose-400/60 bg-rose-50 text-rose-700 ring-1 ring-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/20"
        : "border-indigo-400/60 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/20";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition ${
        active
          ? activeCls
          : "border-slate-200 bg-[var(--bg-elevated)] text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-[#1e2638] dark:text-slate-400 dark:hover:border-white/15 dark:hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

export function ActiveFilterPill({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-[var(--bg-elevated)] py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-slate-600 dark:border-[#1e2638] dark:text-slate-300">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
        aria-label={`Clear ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
