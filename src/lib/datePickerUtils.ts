import {
  addDays,
  format,
  isValid,
  parse,
  startOfDay,
  isBefore,
  isAfter,
} from "date-fns";
import { APP_TIMEZONE } from "./timePickerUtils";

/** Calendar "today" in app business timezone (IST). */
export function todayIsoInAppTz(timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Add whole days to a `YYYY-MM-DD` calendar date (no TZ shift). */
export function addDaysIso(iso: string, days: number): string {
  const n = normalizeIsoDate(iso);
  if (!n) return "";
  const d = parse(n, "yyyy-MM-dd", new Date());
  if (!isValid(d)) return "";
  return format(addDays(d, days), "yyyy-MM-dd");
}

/** Normalize to `YYYY-MM-DD` or empty string. */
export function normalizeIsoDate(value: string | null | undefined): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isValid(d)) return "";
  // Prefer IST calendar day for absolute instants (matches APP_TIMEZONE).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function parseIsoDateLocal(iso: string): Date | null {
  const n = normalizeIsoDate(iso);
  if (!n) return null;
  const d = parse(n, "yyyy-MM-dd", new Date());
  return isValid(d) ? startOfDay(d) : null;
}

export function formatDateDisplay(iso: string, emptyLabel = "Select date"): string {
  const d = parseIsoDateLocal(iso);
  if (!d) return emptyLabel;
  return format(d, "dd MMM yyyy");
}

export function formatDateDisplaySlash(iso: string, emptyLabel = "YYYY/MM/DD"): string {
  const d = parseIsoDateLocal(iso);
  if (!d) return emptyLabel;
  return format(d, "yyyy/MM/dd");
}

export function isDateBeforeMin(iso: string, min?: string): boolean {
  if (!min) return false;
  const d = parseIsoDateLocal(iso);
  const m = parseIsoDateLocal(min);
  if (!d || !m) return false;
  return isBefore(d, m);
}

export function isDateAfterMax(iso: string, max?: string): boolean {
  if (!max) return false;
  const d = parseIsoDateLocal(iso);
  const m = parseIsoDateLocal(max);
  if (!d || !m) return false;
  return isAfter(d, m);
}

/** `datetime-local` value → `{ date: YYYY-MM-DD, time: HH:mm }` */
export function splitDateTimeLocal(value: string): {
  date: string;
  time: string;
} {
  const s = String(value ?? "").trim();
  if (!s) return { date: "", time: "" };
  const [datePart, timePart] = s.split("T");
  const date = normalizeIsoDate(datePart);
  const time = timePart?.slice(0, 5) ?? "";
  return { date, time };
}

export function joinDateTimeLocal(date: string, time: string): string {
  const d = normalizeIsoDate(date);
  if (!d) return "";
  const t = String(time ?? "").trim();
  if (!t) return `${d}T00:00`;
  return `${d}T${t.length === 5 ? t : "00:00"}`;
}

export function formatDateTimeDisplay(
  value: string,
  emptyLabel = "Select date & time",
): string {
  const { date, time } = splitDateTimeLocal(value);
  if (!date) return emptyLabel;
  const dateLbl = formatDateDisplaySlash(date, "");
  if (!time) return dateLbl;
  return `${dateLbl} · ${time}`;
}
