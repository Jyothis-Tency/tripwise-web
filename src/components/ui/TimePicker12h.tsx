import { useEffect, useMemo, useState } from "react";
import {
  QUARTER_MINUTES,
  hhmmTo12hParts,
  parts12hToHHmm,
  type QuarterMinute,
} from "../../lib/timePickerUtils";

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

export interface TimePicker12hProps {
  /** 24-hour `HH:mm` (minutes snapped to 0/15/30/45) or empty string */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  /** Tighter single-line layout for table cells (e.g. bulk entry) */
  compact?: boolean;
  className?: string;
  id?: string;
}

type Period = "AM" | "PM";

function defaultParts(): {
  hour12: number;
  minute: QuarterMinute;
  period: Period;
} {
  return { hour12: 12, minute: 0, period: "AM" };
}

export function TimePicker12h({
  value,
  onChange,
  disabled = false,
  allowEmpty = false,
  compact = false,
  className = "",
  id,
}: TimePicker12hProps) {
  const parsed = useMemo(() => (value ? hhmmTo12hParts(value) : null), [value]);
  const isEmpty = allowEmpty && !value;

  const [hour12, setHour12] = useState<number | "">(() =>
    isEmpty ? "" : (parsed?.hour12 ?? 12),
  );
  const [minute, setMinute] = useState<QuarterMinute>(
    () => parsed?.minute ?? 0,
  );
  const [period, setPeriod] = useState<Period>(() => parsed?.period ?? "AM");

  useEffect(() => {
    if (allowEmpty && !value) {
      setHour12("");
      setMinute(0);
      setPeriod("AM");
      return;
    }
    const p = value ? hhmmTo12hParts(value) : null;
    if (p) {
      setHour12(p.hour12);
      setMinute(p.minute);
      setPeriod(p.period);
    } else if (!allowEmpty) {
      const d = defaultParts();
      setHour12(d.hour12);
      setMinute(d.minute);
      setPeriod(d.period);
    }
  }, [value, allowEmpty]);

  const emit = (h: number | "", m: QuarterMinute, per: Period) => {
    if (allowEmpty && h === "") {
      onChange("");
      return;
    }
    const hourNum = h === "" ? 12 : h;
    onChange(parts12hToHHmm(hourNum, m, per));
  };

  const selectCls = compact
    ? "rounded border border-slate-200 bg-white px-0.5 py-1 text-[11px] leading-none outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
    : "rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

  const hourCls = compact ? "w-9 min-w-9" : "w-[3.25rem]";
  const minuteCls = compact ? "w-10 min-w-10" : "w-[3.5rem]";
  const periodCls = compact ? "w-11 min-w-11" : "w-[3.75rem]";

  return (
    <div
      id={id}
      className={`inline-flex max-w-full items-center ${compact ? "flex-nowrap gap-0.5" : "flex-wrap gap-1"} ${className}`}
      role="group"
      aria-label="Time"
    >
      <select
        aria-label="Hour"
        disabled={disabled}
        value={hour12 === "" ? "" : String(hour12)}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") {
            setHour12("");
            emit("", minute, period);
            return;
          }
          const h = Number(v);
          setHour12(h);
          emit(h, minute, period);
        }}
        className={`${selectCls} ${hourCls} shrink-0`}
      >
        {allowEmpty && <option value="">—</option>}
        {HOURS_12.map((h) => (
          <option key={h} value={String(h)}>
            {h}
          </option>
        ))}
      </select>
      <span
        className={`shrink-0 text-slate-400 font-medium ${compact ? "text-[10px] px-px" : ""}`}
      >
        :
      </span>
      <select
        aria-label="Minute"
        disabled={disabled || (allowEmpty && hour12 === "")}
        value={String(minute)}
        onChange={(e) => {
          const m = Number(e.target.value) as QuarterMinute;
          setMinute(m);
          emit(hour12 === "" ? "" : hour12, m, period);
        }}
        className={`${selectCls} ${minuteCls} shrink-0`}
      >
        {QUARTER_MINUTES.map((m) => (
          <option key={m} value={String(m)}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
      <select
        aria-label="AM or PM"
        disabled={disabled || (allowEmpty && hour12 === "")}
        value={period}
        onChange={(e) => {
          const per = e.target.value as Period;
          setPeriod(per);
          emit(hour12 === "" ? "" : hour12, minute, per);
        }}
        className={`${selectCls} ${periodCls} shrink-0`}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
