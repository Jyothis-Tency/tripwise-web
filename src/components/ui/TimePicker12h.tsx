import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
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
  /** Optional micro-label shown left of the control (e.g. Start / End) */
  label?: string;
}

type Period = "AM" | "PM";

function defaultParts(): {
  hour12: number;
  minute: QuarterMinute;
  period: Period;
} {
  return { hour12: 12, minute: 0, period: "AM" };
}

function SegmentSelect({
  ariaLabel,
  value,
  disabled,
  compact,
  widthCls,
  onChange,
  children,
}: {
  ariaLabel: string;
  value: string;
  disabled?: boolean;
  compact?: boolean;
  widthCls: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative shrink-0 ${widthCls}`}>
      <select
        aria-label={ariaLabel}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full appearance-none bg-transparent font-semibold tabular-nums text-slate-800 outline-none disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-100 ${
          compact
            ? "py-1.5 pl-1.5 pr-5 text-[11px] leading-tight"
            : "py-2 pl-2.5 pr-7 text-sm leading-tight"
        }`}
      >
        {children}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 ${
          compact
            ? "right-0.5 h-3 w-3"
            : "right-1.5 h-3.5 w-3.5"
        }`}
        aria-hidden
      />
    </div>
  );
}

export function TimePicker12h({
  value,
  onChange,
  disabled = false,
  allowEmpty = false,
  compact = false,
  className = "",
  id,
  label,
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

  const emptyDisabled = disabled || (allowEmpty && hour12 === "");

  return (
    <div
      id={id}
      className={`inline-flex max-w-full items-center gap-1.5 ${className}`}
      role="group"
      aria-label={label ? `${label} time` : "Time"}
    >
      {label ? (
        <span
          className={`shrink-0 font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 ${
            compact ? "w-7 text-[9px]" : "w-9 text-[10px]"
          }`}
        >
          {label}
        </span>
      ) : null}

      <div
        className={`inline-flex items-stretch overflow-hidden rounded-lg border border-slate-200/90 bg-[var(--bg-elevated)] shadow-xs transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/15 dark:border-white/10 dark:focus-within:border-indigo-400 ${
          disabled ? "opacity-50" : ""
        }`}
      >
        <SegmentSelect
          ariaLabel="Hour"
          value={hour12 === "" ? "" : String(hour12)}
          disabled={disabled}
          compact={compact}
          widthCls={compact ? "w-[2.75rem]" : "w-[3.35rem]"}
          onChange={(v) => {
            if (v === "") {
              setHour12("");
              emit("", minute, period);
              return;
            }
            const h = Number(v);
            setHour12(h);
            emit(h, minute, period);
          }}
        >
          {allowEmpty && <option value="">—</option>}
          {HOURS_12.map((h) => (
            <option key={h} value={String(h)}>
              {h}
            </option>
          ))}
        </SegmentSelect>

        <span
          className="flex items-center px-0.5 text-[11px] font-bold text-slate-300 dark:text-slate-600"
          aria-hidden
        >
          :
        </span>

        <SegmentSelect
          ariaLabel="Minute"
          value={String(minute)}
          disabled={emptyDisabled}
          compact={compact}
          widthCls={compact ? "w-[3.1rem]" : "w-[3.6rem]"}
          onChange={(v) => {
            const m = Number(v) as QuarterMinute;
            setMinute(m);
            emit(hour12 === "" ? "" : hour12, m, period);
          }}
        >
          {QUARTER_MINUTES.map((m) => (
            <option key={m} value={String(m)}>
              {String(m).padStart(2, "0")}
            </option>
          ))}
        </SegmentSelect>

        <div className="w-px self-stretch bg-slate-200/80 dark:bg-white/10" />

        <SegmentSelect
          ariaLabel="AM or PM"
          value={period}
          disabled={emptyDisabled}
          compact={compact}
          widthCls={compact ? "w-[3.25rem]" : "w-[3.85rem]"}
          onChange={(v) => {
            const per = v as Period;
            setPeriod(per);
            emit(hour12 === "" ? "" : hour12, minute, per);
          }}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </SegmentSelect>
      </div>
    </div>
  );
}
