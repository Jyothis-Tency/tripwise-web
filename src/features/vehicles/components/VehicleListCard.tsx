import { Car, ChevronRight, Pencil } from "lucide-react";
import type { Vehicle } from "../api";

function statusDotCls(status?: string) {
  switch ((status ?? "").toLowerCase()) {
    case "available":
      return "bg-green-500";
    case "on trip":
    case "on_trip":
      return "bg-blue-500";
    case "maintenance":
    case "under maintenance":
      return "bg-orange-400";
    case "inactive":
      return "bg-slate-400";
    default:
      return "bg-slate-300";
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

  const metaBits = [
    vehicle.vehicleYear ? `Year: ${vehicle.vehicleYear}` : null,
    vehicle.seats != null ? `Seats: ${vehicle.seats}` : null,
  ].filter(Boolean) as string[];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`w-full cursor-pointer rounded-xl border p-3 text-left transition-all ${
        isSelected
          ? "border-blue-400 bg-blue-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100">
          <Car className="h-5 w-5 text-blue-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {vehicle.vehicleNumber}
            </p>
            {showEditButton && onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="shrink-0 rounded p-0.5 text-slate-400 hover:text-blue-500"
                title="Edit vehicle"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusDotCls(vehicle.status)}`}
            />
            <span className="text-xs capitalize text-slate-500">
              {vehicle.status ?? "Unknown"}
            </span>
          </div>
          {vehicle.vehicleType != null && vehicle.vehicleType !== "" && (
            <p className="text-xs text-slate-400">Type: {vehicle.vehicleType}</p>
          )}
          {vehicle.vehicleModel != null && vehicle.vehicleModel !== "" && (
            <p className="text-xs text-slate-400">Model: {vehicle.vehicleModel}</p>
          )}
          {metaBits.length > 0 && (
            <p className="text-xs text-slate-400">{metaBits.join(" · ")}</p>
          )}
          {commissionText(vehicle) ? (
            <p className="text-xs text-slate-400">
              Driver Bata: {commissionText(vehicle)}
            </p>
          ) : null}
          <p className="text-xs text-slate-400">
            Driver: {vehicle.currentDriverName ?? "Unassigned"}
          </p>
          {tripFrom && tripTo && (
            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-blue-500">
              <span className="truncate">{tripFrom}</span>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="truncate">{tripTo}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
