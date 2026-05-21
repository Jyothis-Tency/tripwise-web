/** IST — matches trip history / owner expectations */
export const APP_TIMEZONE = "Asia/Kolkata";

export const QUARTER_MINUTES = [0, 15, 30, 45] as const;
export type QuarterMinute = (typeof QUARTER_MINUTES)[number];

export function snapMinuteToQuarter(minute: number): QuarterMinute {
  const m = Math.max(0, Math.min(59, Math.round(Number(minute)) || 0));
  let best: QuarterMinute = 0;
  let bestDist = 60;
  for (const q of QUARTER_MINUTES) {
    const dist = Math.abs(m - q);
    if (dist < bestDist) {
      bestDist = dist;
      best = q;
    }
  }
  return best;
}

/** Parse "HH:mm" or "H:mm" → 24h parts with snapped minute. */
export function parseHHmm(value: string): { hour: number; minute: QuarterMinute } | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = snapMinuteToQuarter(Number(m[2]));
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  return { hour, minute };
}

export function hhmmTo12hParts(value: string): {
  hour12: number;
  minute: QuarterMinute;
  period: "AM" | "PM";
} | null {
  const parsed = parseHHmm(value);
  if (!parsed) return null;
  const { hour, minute } = parsed;
  const period: "AM" | "PM" = hour >= 12 ? "PM" : "AM";
  let hour12 = hour % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute, period };
}

export function parts12hToHHmm(
  hour12: number,
  minute: QuarterMinute,
  period: "AM" | "PM",
): string {
  let h = hour12 % 12;
  if (period === "PM") h += 12;
  if (period === "AM" && hour12 === 12) h = 0;
  if (period === "PM" && hour12 === 12) h = 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Normalize any HH:mm string for storage (snap minutes to quarter). */
export function normalizeHHmm(value: string): string {
  const parsed = parseHHmm(value);
  if (!parsed) return "";
  return `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
}

export function isoToHHmmInTz(v: unknown, timeZone = APP_TIMEZONE): string {
  if (!v) return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return normalizeHHmm(`${h}:${m}`);
}

export function fmtTimeAmPm(v: unknown, timeZone = APP_TIMEZONE): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function fmtHHmmAmPm(hhmm: string): string {
  const parts = hhmmTo12hParts(hhmm);
  if (!parts) return hhmm || "—";
  const min = String(parts.minute).padStart(2, "0");
  return `${parts.hour12}:${min} ${parts.period}`;
}

export function fmtTripDuration(start: unknown, end: unknown): string {
  if (!start || !end) return "—";
  const a = new Date(String(start));
  const b = new Date(String(end));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "—";
  let ms = b.getTime() - a.getTime();
  if (ms < 0) ms += 24 * 60 * 60 * 1000;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
