import { Pencil, User } from "lucide-react";
import type { Driver } from "../api";

function getStatusColor(driver: Driver): string {
  if (driver.isBlocked) return "bg-rose-500";
  const statusVal =
    driver.status || (driver.isActive !== false ? "Active" : "Inactive");
  const s = String(statusVal).toLowerCase();
  if (s === "active") return "bg-emerald-500";
  if (s === "on leave") return "bg-amber-500";
  return "bg-slate-400";
}

function getStatusLabel(driver: Driver): string {
  if (driver.isBlocked) return "Blocked";
  return driver.status || (driver.isActive !== false ? "Active" : "Inactive");
}

function getStatusTextCls(driver: Driver): string {
  if (driver.isBlocked) return "text-rose-700 dark:text-rose-400";
  const s = String(
    driver.status || (driver.isActive !== false ? "Active" : "Inactive"),
  ).toLowerCase();
  if (s === "active") return "text-emerald-700 dark:text-emerald-400";
  if (s === "on leave") return "text-amber-700 dark:text-amber-400";
  return "text-slate-500 dark:text-slate-400";
}

interface DriverCardProps {
  driver: Driver;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}

export function DriverCard({
  driver,
  isSelected,
  onSelect,
  onEdit,
}: DriverCardProps) {
  const name =
    driver.firstName && driver.lastName
      ? `${driver.firstName} ${driver.lastName}`.trim()
      : ((driver as any).name ?? "—");
  const statusLabel = getStatusLabel(driver);
  const statusDot = getStatusColor(driver);
  const subtitle = driver.place
    ? driver.place
    : `${driver.totalTrips ?? 0} trips · ${driver.totalKm ?? 0} km`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`group flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
        isSelected
          ? "border-indigo-500 bg-indigo-50/40 shadow-xs dark:border-indigo-400 dark:bg-indigo-500/10"
          : "border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50/70 dark:border-white/10 dark:bg-[#0e121d]/80 dark:hover:border-white/20 dark:hover:bg-white/[0.04]"
      }`}
    >
      {driver.profileImg ? (
        <img
          src={driver.profileImg}
          alt={name}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isSelected
              ? "bg-indigo-600 text-white shadow-xs dark:bg-indigo-500"
              : "border border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
          }`}
        >
          <User className="h-5 w-5" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-xs font-bold tracking-tight text-slate-900 dark:text-white">
            {name}
          </p>
          {!driver.isBlocked &&
            String(statusLabel).toLowerCase() === "active" && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          {(driver.isBlocked ||
            String(statusLabel).toLowerCase() !== "active") && (
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
          )}
          <span
            className={`text-[11px] font-medium ${getStatusTextCls(driver)}`}
          >
            {statusLabel}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
          {subtitle}
        </p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className={`shrink-0 rounded-md p-1.5 transition ${
          isSelected
            ? "text-indigo-600 hover:bg-indigo-100/70 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
            : "text-slate-400 opacity-80 hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-white/10 dark:hover:text-slate-200"
        }`}
        title="Edit driver"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
