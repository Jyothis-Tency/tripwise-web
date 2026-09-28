import type { Driver } from "../api";

const AVATAR_COLORS = [
  "#4f46e5",
  "#0ea5a4",
  "#e5484d",
  "#f59e0b",
  "#7c3aed",
  "#0891b2",
  "#db2777",
];

export function driverDisplayName(d: Driver): string {
  if (d.firstName || d.lastName) {
    return `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim();
  }
  return (d as { name?: string }).name ?? "—";
}

export function driverInitials(d: Driver): string {
  const name = driverDisplayName(d);
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function driverAvatarColor(index: number): string {
  return AVATAR_COLORS[Math.abs(index) % AVATAR_COLORS.length];
}

interface DriverCardProps {
  driver: Driver;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

export function DriverCard({
  driver,
  index,
  isSelected,
  onSelect,
}: DriverCardProps) {
  const name = driverDisplayName(driver);
  const phone = driver.phone?.trim();
  const blocked = !!driver.isBlocked;
  const color = driverAvatarColor(index);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-[14px] border p-[11px] text-left transition ${
        isSelected
          ? "border-indigo-500 bg-indigo-50/80 dark:border-indigo-400 dark:bg-[#242a57]"
          : "border-transparent hover:bg-[var(--bg-main)] dark:hover:bg-white/[0.04]"
      }`}
    >
      <span className="relative shrink-0">
        {driver.profileImg ? (
          <img
            src={driver.profileImg}
            alt=""
            className="h-[42px] w-[42px] rounded-full object-cover"
          />
        ) : (
          <span
            className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-sm font-extrabold text-white"
            style={{ background: color }}
          >
            {driverInitials(driver)}
          </span>
        )}
        {!blocked && (
          <span className="absolute -bottom-px -right-px h-3 w-3 rounded-full border-2 border-[var(--bg-card)] bg-emerald-500" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-slate-900 dark:text-[#eef0ff]">
          {name}
        </span>
        <span className="block truncate text-xs text-slate-500 dark:text-[#8d94b8]">
          {phone || "No phone added"}
        </span>
      </span>

      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
          blocked
            ? "bg-rose-50 text-rose-600 dark:bg-[#3a1a1e] dark:text-[#fda4af]"
            : "bg-emerald-50 text-emerald-700 dark:bg-[#0d3325] dark:text-[#34d399]"
        }`}
      >
        {blocked ? "Blocked" : "Active"}
      </span>
    </button>
  );
}
