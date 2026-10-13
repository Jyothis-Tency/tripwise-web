import {
  Route,
  User,
  Car,
  Building2,
  ArrowRight,
  Wallet,
} from "lucide-react";
import type { TripWithExpenses } from "../api";

function statusDotCls(status?: string) {
  switch ((status ?? "").toLowerCase()) {
    case "completed":
      return "bg-emerald-500";
    case "in_progress":
    case "in progress":
      return "bg-indigo-500";
    case "scheduled":
      return "bg-sky-500";
    case "cancelled":
      return "bg-rose-500";
    default:
      return "bg-slate-300 dark:bg-slate-600";
  }
}

function statusTextCls(status?: string) {
  switch ((status ?? "").toLowerCase()) {
    case "completed":
      return "text-emerald-700 dark:text-emerald-400";
    case "in_progress":
    case "in progress":
      return "text-indigo-700 dark:text-indigo-300";
    case "scheduled":
      return "text-sky-700 dark:text-sky-400";
    case "cancelled":
      return "text-rose-700 dark:text-rose-400";
    default:
      return "text-slate-500 dark:text-slate-400";
  }
}

function fmtCurrency(v: number): string {
  return `₹${v.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function TripListCard({
  trip,
  isSelected,
  onSelect,
}: {
  trip: TripWithExpenses;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const tripNum =
    trip.tripNumber ||
    (trip._id ? trip._id.slice(-6).toUpperCase() : "TRIP");

  const fromLoc = trip.fromLocation || "Origin";
  const toLoc = trip.toLocation || "Destination";

  const driverObj = trip.driver;
  const driverName = driverObj
    ? `${driverObj.firstName ?? ""} ${driverObj.lastName ?? ""}`.trim() ||
      driverObj.email ||
      "Driver"
    : "Unassigned";

  const agencyName =
    trip.agencyName || trip.customer || "Direct / No Agency";

  const vehiclePlate = trip.vehicle?.vehicleNumber || "Unassigned";

  // Financial summary
  const expenses = trip.expenses ?? [];
  const totalAmount = expenses.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  );
  const personalTotal = expenses.reduce(
    (sum, e) => (e.paidBy === "Personal" ? sum + (Number(e.amount) || 0) : sum),
    0
  );

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
      {/* Top Header: Trip Number + Status Dot & Total Outflow */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${
              isSelected
                ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"
                : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"
            }`}
          >
            <Route className="h-5 w-5" strokeWidth={1.8} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-mono text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                {tripNum}
              </span>
              <span
                className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusDotCls(
                  trip.status
                )}`}
              />
            </div>
            <p
              className={`text-xs font-medium capitalize ${statusTextCls(
                trip.status
              )}`}
            >
              {trip.status ?? "Scheduled"}
            </p>
          </div>
        </div>

        {/* Expenses amount pill on the right */}
        <div className="text-right shrink-0">
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            {fmtCurrency(totalAmount)}
          </span>
          {personalTotal > 0 && (
            <p className="flex items-center justify-end gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              <Wallet className="h-2.5 w-2.5" />
              <span>{fmtCurrency(personalTotal)}</span>
            </p>
          )}
        </div>
      </div>

      {/* From and To (Route) */}
      <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-slate-50/80 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-white/5 dark:text-slate-200">
        <span className="truncate max-w-[45%] font-semibold text-indigo-600 dark:text-indigo-400">
          {fromLoc}
        </span>
        <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" />
        <span className="truncate max-w-[45%] font-semibold text-emerald-600 dark:text-emerald-400">
          {toLoc}
        </span>
      </div>

      {/* Required fields grid: Driver, Agency, Vehicle */}
      <div
        className={`mt-2.5 space-y-1 border-t pt-2 text-[11px] ${
          isSelected
            ? "border-indigo-100/70 dark:border-indigo-500/20"
            : "border-slate-100 dark:border-white/5"
        }`}
      >
        {/* Driver */}
        <div className="flex items-center justify-between gap-1 text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500 shrink-0">
            <User className="h-3 w-3" />
            Driver:
          </span>
          <span className="truncate font-medium text-slate-800 dark:text-slate-200 text-right">
            {driverName}
          </span>
        </div>

        {/* Agency */}
        <div className="flex items-center justify-between gap-1 text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500 shrink-0">
            <Building2 className="h-3 w-3" />
            Agency:
          </span>
          <span className="truncate font-medium text-slate-800 dark:text-slate-200 text-right">
            {agencyName}
          </span>
        </div>

        {/* Vehicle */}
        <div className="flex items-center justify-between gap-1 text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500 shrink-0">
            <Car className="h-3 w-3" />
            Vehicle:
          </span>
          <span className="truncate font-mono font-medium text-slate-800 dark:text-slate-200 text-right">
            {vehiclePlate}
          </span>
        </div>
      </div>
    </div>
  );
}
