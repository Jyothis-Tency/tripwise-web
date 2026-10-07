import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  formatDateTimeDisplay,
  joinDateTimeLocal,
  normalizeIsoDate,
  parseIsoDateLocal,
  splitDateTimeLocal,
  isDateBeforeMin,
  isDateAfterMax,
} from "../../lib/datePickerUtils";
import { CalendarPanel, datePickerTriggerCls } from "./DatePicker";
import { TimePicker12h } from "./TimePicker12h";

export type DateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
  compact?: boolean;
  min?: string;
  max?: string;
  "aria-label"?: string;
};

export function DateTimePicker({
  value,
  onChange,
  disabled,
  id,
  className,
  placeholder = "Select date & time",
  compact = false,
  min,
  max,
  "aria-label": ariaLabel,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const { date, time } = splitDateTimeLocal(value);
  const [draftDate, setDraftDate] = useState(date);
  const [draftTime, setDraftTime] = useState(time);
  const [viewMonth, setViewMonth] = useState(
    () => parseIsoDateLocal(date) ?? new Date(),
  );

  useEffect(() => {
    if (open) {
      const parts = splitDateTimeLocal(value);
      setDraftDate(parts.date);
      setDraftTime(parts.time);
      const d = parseIsoDateLocal(parts.date);
      if (d) setViewMonth(d);
    }
  }, [open, value]);

  const display = value
    ? formatDateTimeDisplay(value, placeholder)
    : placeholder;

  const apply = () => {
    const next = joinDateTimeLocal(draftDate, draftTime);
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel ?? "Choose date and time"}
          className={cn(
            datePickerTriggerCls,
            compact ? "px-2 py-1.5 text-xs" : "px-3 py-2.5 text-sm",
            className,
          )}
        >
          <CalendarClock
            className={cn(
              "shrink-0 text-slate-400 dark:text-slate-500",
              compact ? "h-3.5 w-3.5" : "h-4 w-4",
            )}
            aria-hidden
          />
          <span
            className={cn(
              "min-w-0 flex-1 truncate font-medium tabular-nums",
              !value && "text-slate-400 dark:text-slate-500",
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
          className="z-[200] rounded-2xl border border-slate-200/90 bg-[var(--bg-card)] p-3 shadow-xl dark:border-[#252c4d]"
        >
          <div className="space-y-3">
            <CalendarPanel
              selectedIso={draftDate}
              viewMonth={viewMonth}
              onViewMonthChange={setViewMonth}
              min={min}
              max={max}
              onSelect={setDraftDate}
              onClear={() => setDraftDate("")}
              onToday={() => {
                const today = format(new Date(), "yyyy-MM-dd");
                if (
                  !isDateBeforeMin(today, min) &&
                  !isDateAfterMax(today, max)
                ) {
                  setDraftDate(today);
                }
              }}
            />
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Time
              </p>
              <TimePicker12h
                value={draftTime}
                onChange={setDraftTime}
                allowEmpty
                compact
              />
            </div>
            <button
              type="button"
              onClick={apply}
              disabled={!normalizeIsoDate(draftDate)}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40 dark:bg-indigo-500"
            >
              Apply
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
