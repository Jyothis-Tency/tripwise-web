import type { TripWithExpenses } from "./api";

const IST = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60 * 1000;

/** IST midnight of a calendar date, as an instant. Null for impossible dates (e.g. 31-02). */
function istMidnight(y: number, m: number, d: number): Date | null {
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return new Date(probe.getTime() - IST_OFFSET_MS);
}

/**
 * Parse DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD or ISO strings into an instant.
 * Date-only values are IST calendar dates; ISO instants keep their real time.
 * Always format the result with timeZone Asia/Kolkata.
 */
export function parseTripDate(raw?: string | null): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return istMidnight(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));

  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return istMidnight(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));

  // ISO date-time without a zone: wall-clock as written (IST)
  const local = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (local) {
    const base = istMidnight(Number(local[1]), Number(local[2]), Number(local[3]));
    if (!base) return null;
    return new Date(
      base.getTime() + (Number(local[4]) * 60 + Number(local[5])) * 60000 + Number(local[6] ?? 0) * 1000,
    );
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(raw?: string | null): string {
  const d = parseTripDate(raw);
  return d
    ? d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: IST,
      })
    : "—";
}

/** Date + time, only when the source carries a time component (ISO instants). */
export function fmtDateTime(raw?: string | null): string {
  const d = parseTripDate(raw);
  if (!d) return "—";
  const hasTime = typeof raw === "string" && /[T ]\d{2}:\d{2}/.test(raw);
  const date = fmtDate(raw);
  if (!hasTime) return date;
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });
  return `${date}, ${time}`;
}

export type TripDateEntry = { key: string; label: string; value: string };

/**
 * Start and end dates only. Actual start/end values replace the planned
 * ones when the trip has them. Missing ones are omitted.
 */
export function getTripDateEntries(trip: TripWithExpenses): TripDateEntry[] {
  const defs: Array<[string, string, string | null | undefined]> = [
    [
      "start",
      "Start date",
      parseTripDate(trip.actualStartTime) ? trip.actualStartTime : trip.startDate,
    ],
    [
      "end",
      "End date",
      parseTripDate(trip.actualEndTime) ? trip.actualEndTime : trip.expectedEndDate,
    ],
  ];
  return defs
    .filter(([, , v]) => parseTripDate(v) !== null)
    .map(([key, label, v]) => ({ key, label, value: fmtDateTime(v) }));
}

/* ── Date filter ─────────────────────────────────────────── */

export type ExpensesDateFilter =
  | { kind: "all" }
  | { kind: "month"; month: string } // YYYY-MM
  | { kind: "custom"; from: string; to: string }; // YYYY-MM-DD (either may be "")

export const DEFAULT_DATE_FILTER: ExpensesDateFilter = { kind: "all" };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Resolve a filter into inclusive YYYY-MM-DD bounds for the API. */
export function dateFilterToRange(f: ExpensesDateFilter): {
  startDate?: string;
  endDate?: string;
} {
  if (f.kind === "month") {
    const m = f.month.match(/^(\d{4})-(\d{2})$/);
    if (!m) return {};
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const last = new Date(y, mo, 0).getDate();
    return { startDate: `${y}-${pad(mo)}-01`, endDate: `${y}-${pad(mo)}-${pad(last)}` };
  }
  if (f.kind === "custom") {
    return {
      startDate: f.from || undefined,
      endDate: f.to || undefined,
    };
  }
  return {};
}

export function currentMonthValue(): string {
  // en-CA gives YYYY-MM-DD; take the IST calendar month regardless of browser timezone
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: IST })
    .slice(0, 7);
}
