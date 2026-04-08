/** IST — matches TripCard / owner expectations for driver-reported times */
export const HISTORY_TZ = 'Asia/Kolkata';

export function fmtTimeAmPm(v: unknown): string {
  if (!v) return '—';
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString('en-IN', {
    timeZone: HISTORY_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function isoToTimeInputInTz(v: unknown): string {
  if (!v) return '';
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return '';
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: HISTORY_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const h = parts.find(p => p.type === 'hour')?.value ?? '00';
  const m = parts.find(p => p.type === 'minute')?.value ?? '00';
  return `${h.padStart(2, '0')}:${m}`;
}

export function fmtTripDuration(start: unknown, end: unknown): string {
  if (!start || !end) return '—';
  const a = new Date(String(start));
  const b = new Date(String(end));
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return '—';
  let ms = b.getTime() - a.getTime();
  if (ms < 0) ms += 24 * 60 * 60 * 1000;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
