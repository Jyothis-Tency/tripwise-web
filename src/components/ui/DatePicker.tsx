import { useEffect, useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  formatDateDisplaySlash,
  isDateAfterMax,
  isDateBeforeMin,
  normalizeIsoDate,
  parseIsoDateLocal,
} from "../../lib/datePickerUtils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export const datePickerTriggerCls =
  "flex w-full items-center gap-2 rounded-lg border border-slate-200/90 bg-[var(--bg-elevated)] text-left text-slate-800 shadow-xs outline-none transition hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-100 dark:hover:border-white/20 dark:focus:border-indigo-400";

type CalendarPanelProps = {
  selectedIso: string;
  viewMonth: Date;
  onViewMonthChange: (d: Date) => void;
  onSelect: (iso: string) => void;
  min?: string;
  max?: string;
  onClear?: () => void;
  onToday?: () => void;
};

export function CalendarPanel({
  selectedIso,
  viewMonth,
  onViewMonthChange,
  onSelect,
  min,
  max,
  onClear,
  onToday,
}: CalendarPanelProps) {
  const selected = parseIsoDateLocal(selectedIso);

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 });
    const out: { date: Date; inMonth: boolean }[] = [];
    let d = gridStart;
    while (d <= gridEnd) {
      out.push({ date: d, inMonth: isSameMonth(d, viewMonth) });
      d = addDays(d, 1);
    }
    return out;
  }, [viewMonth]);

  const monthLabel = format(viewMonth, "MMMM, yyyy");

  const dayDisabled = (d: Date) => {
    const iso = format(d, "yyyy-MM-dd");
    return isDateBeforeMin(iso, min) || isDateAfterMax(iso, max);
  };

  return (
    <div className="w-[17.5rem] select-none">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
          aria-label="Previous month"
          onClick={() => onViewMonthChange(addMonths(viewMonth, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {monthLabel}
        </span>
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
          aria-label="Next month"
          onClick={() => onViewMonthChange(addMonths(viewMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500"
          >
            {wd}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map(({ date, inMonth }) => {
          const iso = format(date, "yyyy-MM-dd");
          const isSelected = selected ? isSameDay(date, selected) : false;
          const disabled = dayDisabled(date);
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(iso)}
              className={cn(
                "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition",
                !inMonth && "text-slate-300 dark:text-slate-600",
                inMonth && "text-slate-700 dark:text-slate-200",
                isSelected &&
                  "bg-indigo-600 text-white shadow-sm dark:bg-indigo-500",
                !isSelected &&
                  inMonth &&
                  !disabled &&
                  "hover:bg-indigo-50 dark:hover:bg-indigo-500/15",
                isToday(date) &&
                  !isSelected &&
                  "ring-1 ring-indigo-300 dark:ring-indigo-500/50",
                disabled && "cursor-not-allowed opacity-30",
              )}
            >
              {format(date, "d")}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-200/80 pt-2 dark:border-white/10">
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onToday}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        >
          Today
        </button>
      </div>
    </div>
  );
}

export type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Placeholder when empty */
  placeholder?: string;
  compact?: boolean;
  min?: string;
  max?: string;
  "aria-label"?: string;
};

export function DatePicker({
  value,
  onChange,
  disabled,
  id,
  className,
  placeholder = "Select date",
  compact = false,
  min,
  max,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const iso = normalizeIsoDate(value);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() =>
    parseIsoDateLocal(iso) ?? new Date(),
  );

  useEffect(() => {
    const d = parseIsoDateLocal(iso);
    if (d) setViewMonth(d);
  }, [iso]);

  const display = iso ? formatDateDisplaySlash(iso, placeholder) : placeholder;

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel ?? "Choose date"}
          className={cn(
            datePickerTriggerCls,
            compact ? "px-2 py-1.5 text-xs" : "px-3 py-2.5 text-sm",
            className,
          )}
        >
          <Calendar
            className={cn(
              "shrink-0 text-slate-400 dark:text-slate-500",
              compact ? "h-3.5 w-3.5" : "h-4 w-4",
            )}
            aria-hidden
          />
          <span
            className={cn(
              "min-w-0 flex-1 truncate font-medium tabular-nums",
              !iso && "text-slate-400 dark:text-slate-500",
            )}
          >
            {display}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-[200] rounded-2xl border border-slate-200/90 bg-[var(--bg-card)] p-3 shadow-xl animate-in fade-in-0 zoom-in-95 dark:border-[#252c4d] dark:shadow-2xl"
        >
          <CalendarPanel
            selectedIso={iso}
            viewMonth={viewMonth}
            onViewMonthChange={setViewMonth}
            min={min}
            max={max}
            onSelect={pick}
            onClear={() => {
              onChange("");
              setOpen(false);
            }}
            onToday={() => {
              const today = format(new Date(), "yyyy-MM-dd");
              if (!isDateBeforeMin(today, min) && !isDateAfterMax(today, max)) {
                pick(today);
              }
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
