import { Car, ChevronRight, Pencil } from "lucide-react";
import type { Vehicle } from "../api";

function statusDotCls(status?: string) {
  switch ((status ?? "").toLowerCase()) {
    case "available":
      return "bg-emerald-500";
    case "on trip":
    case "on_trip":
      return "bg-indigo-500";
    case "maintenance":
    case "under maintenance":
      return "bg-amber-500";
    case "inactive":
      return "bg-slate-400";
    default:
      return "bg-slate-300 dark:bg-slate-600";
  }
}

function statusTextCls(status?: string) {
  switch ((status ?? "").toLowerCase()) {
    case "available":
      return "text-emerald-700 dark:text-emerald-400";
    case "on trip":
    case "on_trip":
      return "text-indigo-700 dark:text-indigo-300";
    case "maintenance":
    case "under maintenance":
      return "text-amber-700 dark:text-amber-400";
    case "inactive":
      return "text-slate-500 dark:text-slate-400";
    default:
      return "text-slate-500 dark:text-slate-400";
  }
}

/** Driver Bata / commission label for lists and detail rows */
export function commissionText(v: Vehicle): string {
  if (v.commission == null) return "";
  const n = v.commission;
  return `${n % 1 === 0 ? n.toFixed(0) : n}%`;
}

export function VehicleListCard({
  vehicle,
  isSelected,
  onSelect,
  onEdit,
  showEditButton = true,
}: {
  vehicle: Vehicle;
  isSelected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  /** Trip Details shows an edit pencil; Expenses sidebars can hide it. */
  showEditButton?: boolean;
}) {
  const trip =
    vehicle.currentTrip && typeof vehicle.currentTrip === "object"
      ? (vehicle.currentTrip as Record<string, unknown>)
      : null;
  const tripFrom = vehicle.tripFrom ?? (trip?.from as string | undefined);
  const tripTo = vehicle.tripTo ?? (trip?.to as string | undefined);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`group relative w-full cursor-pointer rounded-xl p-3.5 text-left transition-all ${
        isSelected
          ? "border-2 border-indigo-500 bg-indigo-50/40 shadow-xs dark:border-indigo-400 dark:bg-indigo-500/10"
          : "border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs dark:border-white/10 dark:bg-[#0e121d]/80 dark:hover:border-white/20 dark:hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${
              isSelected
                ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"
                : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"
            }`}
          >
            <Car className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              {vehicle.vehicleNumber}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusDotCls(vehicle.status)}`}
              />
              <span
                className={`text-xs font-medium capitalize ${statusTextCls(vehicle.status)}`}
              >
                {vehicle.status ?? "Unknown"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          {!isSelected && vehicle.vehicleModel ? (
            <span className="hidden max-w-[5.5rem] truncate text-[11px] font-medium text-slate-400 sm:inline dark:text-slate-500">
              {vehicle.vehicleModel}
            </span>
          ) : null}
          {showEditButton && onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="rounded p-1 text-slate-400 transition hover:bg-white hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
              title="Edit vehicle"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {isSelected && (
        <div
          className={`mt-3 grid grid-cols-2 gap-y-1 border-t pt-2.5 text-[11px] ${
            isSelected
              ? "border-indigo-100/70 text-slate-600 dark:border-indigo-500/20 dark:text-slate-300"
              : "border-slate-100"
          }`}
        >
          {vehicle.vehicleType != null && vehicle.vehicleType !== "" && (
            <div>
              <span className="text-slate-400 dark:text-slate-500">Type:</span>{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {vehicle.vehicleType}
              </span>
            </div>
          )}
          {vehicle.vehicleModel != null && vehicle.vehicleModel !== "" && (
            <div>
              <span className="text-slate-400 dark:text-slate-500">Model:</span>{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {vehicle.vehicleModel}
              </span>
            </div>
          )}
          {vehicle.vehicleYear ? (
            <div>
              <span className="text-slate-400 dark:text-slate-500">Year:</span>{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {vehicle.vehicleYear}
              </span>
            </div>
          ) : null}
          {commissionText(vehicle) ? (
            <div>
              <span className="text-slate-400 dark:text-slate-500">
                Driver Bata:
              </span>{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {commissionText(vehicle)}
              </span>
            </div>
          ) : null}
          <div className="col-span-2 pt-0.5">
            <span className="text-slate-400 dark:text-slate-500">Driver:</span>{" "}
            <span
              className={
                vehicle.currentDriverName
                  ? "font-medium text-slate-800 dark:text-slate-200"
                  : "italic text-slate-500"
              }
            >
              {vehicle.currentDriverName ?? "Unassigned"}
            </span>
          </div>
          {tripFrom && tripTo && (
            <div className="col-span-2 mt-0.5 flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-300">
              <span className="truncate">{tripFrom}</span>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="truncate">{tripTo}</span>
            </div>
          )}
        </div>
      )}

      {!isSelected && (
        <div className="mt-2 space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          {vehicle.currentDriverName ? (
            <p>
              <span className="text-slate-400">Driver:</span>{" "}
              {vehicle.currentDriverName}
            </p>
          ) : null}
          {tripFrom && tripTo && (
            <p className="flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-300">
              <span className="truncate">{tripFrom}</span>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="truncate">{tripTo}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
