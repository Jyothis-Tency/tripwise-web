import { CalendarDays } from "lucide-react";
import type { TripWithExpenses } from "../api";
import { getTripDateEntries } from "../tripDates";

/** Compact two-column list used inside trip cards. */
export function TripDatesCompact({ trip }: { trip: TripWithExpenses }) {
  const entries = getTripDateEntries(trip);
  if (entries.length === 0) return null;
  return (
    <div className="mt-2.5 space-y-1 border-t border-slate-100 pt-2 text-[11px] dark:border-white/5">
      {entries.map((e) => (
        <div
          key={e.key}
          className="flex items-center justify-between gap-1 text-slate-600 dark:text-slate-300"
        >
          <span className="flex shrink-0 items-center gap-1 text-slate-400 dark:text-slate-500">
            <CalendarDays className="h-3 w-3" />
            {e.label}:
          </span>
          <span className="truncate text-right font-medium text-slate-800 dark:text-slate-200">
            {e.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Chip strip used on the trip details page. */
export function TripDatesStrip({ trip }: { trip: TripWithExpenses }) {
  const entries = getTripDateEntries(trip);
  if (entries.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {entries.map((e) => (
        <div
          key={e.key}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-white/5"
        >
          <CalendarDays className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <span className="text-slate-500 dark:text-slate-400">{e.label}</span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {e.value}
          </span>
        </div>
      ))}
    </div>
  );
}
