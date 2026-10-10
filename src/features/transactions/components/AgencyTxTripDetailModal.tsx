import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Wallet, X } from "lucide-react";
import type { AgencyTxTripDetail } from "../agencyTxRows";
import {
  fetchHistoryTripById,
  updateTripFields,
  type HistoryTrip,
} from "../../history/api";
import { EditTripModal } from "../../history/components/EditTripModal";
import { TripCashInModal } from "../../vehicles/components/TripCashInModal";
import {
  fetchAllBulkEntryTrips,
  updateBulkEntryTrip,
  type AgencyTrip,
} from "../../bulk-entry/api";
import { EditBulkTripModal } from "./EditBulkTripModal";
import { BulkTripCashInModal } from "./BulkTripCashInModal";
import {
  getHistoryTripExpenseBreakdown,
  resolveTripAgencyProfitDisplay,
} from "../../history/tripExpenseBreakdown";
import {
  fmtTimeAmPm,
  fmtTripDuration,
  isoToTimeInputInTz,
} from "../../history/historyTimeUtils";

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return x.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtMoney(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function toDateSeed(d?: string | null) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d).split("T")[0] ?? "";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

// ─── Inline Editable Row for Bulk Trips ─────────────────────────────────────

function BulkEditableRow({
  label,
  value,
  fieldKey,
  tripId,
  rawSeed,
  type = "text",
  highlight,
  emphasizeValue,
  onSaved,
}: {
  label: string;
  value: string;
  fieldKey: keyof AgencyTrip;
  tripId: string;
  rawSeed?: string | number | null;
  type?: "text" | "number" | "date";
  highlight?: boolean;
  emphasizeValue?: boolean;
  onSaved: (updatedTrip: AgencyTrip) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const [editValue, setEditValue] = useState(
    rawSeed != null ? String(rawSeed) : value === "—" ? "" : value,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDisplayValue(value);
      setEditValue(rawSeed != null ? String(rawSeed) : value === "—" ? "" : value);
    }
  }, [value, rawSeed, editing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let parsed: any = editValue;
      if (type === "number") {
        parsed = editValue.trim() === "" ? 0 : Number(editValue);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error("Enter a valid non-negative number");
        }
      }
      const updated = await updateBulkEntryTrip(tripId, {
        [fieldKey]: parsed,
      });
      setEditing(false);
      onSaved(updated);
    } catch (err: any) {
      alert(err?.message || "Failed to update field");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(rawSeed != null ? String(rawSeed) : value === "—" ? "" : value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1.5 py-1.5 sm:flex-row sm:items-center sm:gap-2">
        <span className="w-full shrink-0 text-xs sm:w-[110px] text-slate-500 dark:text-[#8d94b8]">
          {label}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <input
            autoFocus
            type={type === "number" ? "number" : type === "date" ? "date" : "text"}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            className="min-h-[30px] min-w-0 flex-1 rounded-md border border-indigo-300 bg-[var(--bg-card)] px-2 py-1 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200 dark:border-indigo-500/50 dark:text-[#eef0ff]"
            disabled={saving}
          />
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-40"
              aria-label="Save"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5"
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex min-w-0 items-baseline justify-between gap-2 py-1.5 border-b border-slate-100/60 dark:border-[#252c4d]/50 last:border-0">
      <span className="w-[110px] shrink-0 text-xs sm:text-[13px] text-slate-500 dark:text-[#8d94b8]">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5">
        <span
          className={`min-w-0 truncate text-xs sm:text-[13px] whitespace-nowrap tabular-nums ${
            emphasizeValue
              ? "font-bold text-slate-900 dark:text-white"
              : highlight
                ? "font-semibold text-emerald-600 dark:text-emerald-400"
                : "font-medium text-slate-800 dark:text-[#eef0ff]"
          }`}
        >
          {displayValue}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded p-1 text-slate-400 opacity-60 hover:opacity-100 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/5 transition"
          title={`Edit ${label}`}
          aria-label={`Edit ${label}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Inline Editable Row for Vehicle Trips ───────────────────────────────────

function EditableVehicleRow({
  label,
  value,
  fieldKey,
  tripId,
  rawSeed,
  type = "text",
  highlight,
  emphasizeValue,
  onSaved,
}: {
  label: string;
  value: string;
  fieldKey: string;
  tripId: string;
  rawSeed?: string | number | null;
  type?: "text" | "number" | "date";
  highlight?: boolean;
  emphasizeValue?: boolean;
  onSaved: (updated: HistoryTrip) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const [editValue, setEditValue] = useState(
    rawSeed != null ? String(rawSeed) : value === "—" ? "" : value,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDisplayValue(value);
      setEditValue(rawSeed != null ? String(rawSeed) : value === "—" ? "" : value);
    }
  }, [value, rawSeed, editing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let parsed: any = editValue;
      if (type === "number") {
        parsed = editValue.trim() === "" ? 0 : Number(editValue);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error("Enter a valid non-negative number");
        }
      }
      const updated = await updateTripFields(tripId, {
        [fieldKey]: parsed,
      } as any);
      setEditing(false);
      onSaved(updated);
    } catch (err: any) {
      alert(err?.message || "Failed to update field");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(rawSeed != null ? String(rawSeed) : value === "—" ? "" : value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1.5 py-1.5 sm:flex-row sm:items-center sm:gap-2">
        <span className="w-full shrink-0 text-xs sm:w-[110px] text-slate-500 dark:text-[#8d94b8]">
          {label}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <input
            autoFocus
            type={type === "number" ? "number" : type === "date" ? "date" : "text"}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            className="min-h-[30px] min-w-0 flex-1 rounded-md border border-indigo-300 bg-[var(--bg-card)] px-2 py-1 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200 dark:border-indigo-500/50 dark:text-[#eef0ff]"
            disabled={saving}
          />
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-40"
              aria-label="Save"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5"
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex min-w-0 items-baseline justify-between gap-2 py-1.5 border-b border-slate-100/60 dark:border-[#252c4d]/50 last:border-0">
      <span className="w-[110px] sm:w-[120px] shrink-0 text-xs sm:text-[13px] text-slate-500 dark:text-[#8d94b8]">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5">
        <span
          className={`min-w-0 truncate text-xs sm:text-[13px] whitespace-nowrap tabular-nums ${
            emphasizeValue
              ? "font-bold text-slate-900 dark:text-white"
              : highlight
                ? "font-semibold text-emerald-600 dark:text-emerald-400"
                : "font-medium text-slate-800 dark:text-[#eef0ff]"
          }`}
        >
          {displayValue}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded p-1 text-slate-400 opacity-60 hover:opacity-100 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/5 transition"
          title={`Edit ${label}`}
          aria-label={`Edit ${label}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function StaticVehicleRow({
  label,
  value,
  highlight,
  emphasizeValue,
  badge,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  emphasizeValue?: boolean;
  badge?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 py-1.5 border-b border-slate-100/60 dark:border-[#252c4d]/50 last:border-0">
      <span className="w-[110px] sm:w-[120px] shrink-0 text-xs sm:text-[13px] text-slate-500 dark:text-[#8d94b8]">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-end">
        {badge ? (
          <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
            {value}
          </span>
        ) : (
          <span
            className={`min-w-0 truncate text-xs sm:text-[13px] whitespace-nowrap tabular-nums ${
              emphasizeValue
                ? "font-bold text-slate-900 dark:text-white"
                : highlight
                  ? "font-bold text-emerald-600 dark:text-emerald-400"
                  : "font-medium text-slate-800 dark:text-[#eef0ff]"
            }`}
          >
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Vehicle Trip Segment Card (Custom Tailored 2-Column UI) ─────────────────

function VehicleTripSegmentCard({
  trip: initialTrip,
  resolveAgencyLabel,
  onEdit,
  onPayment,
  onTripUpdated,
}: {
  trip: HistoryTrip;
  resolveAgencyLabel?: (agencyName?: string) => string;
  onEdit: () => void;
  onPayment: () => void;
  onTripUpdated: (updated: HistoryTrip) => void;
}) {
  const [trip, setTrip] = useState<HistoryTrip>(initialTrip);

  useEffect(() => {
    setTrip(initialTrip);
  }, [initialTrip]);

  const handleSaved = (updated: HistoryTrip) => {
    setTrip(updated);
    onTripUpdated(updated);
  };

  const driver =
    typeof trip.driver === "string"
      ? trip.driver
      : `${trip.driver?.firstName ?? ""} ${trip.driver?.lastName ?? ""}`.trim() ||
        "Driver";
  const driverPhone =
    typeof trip.driver !== "string" ? trip.driver?.phone : undefined;

  const vehicle =
    typeof trip.vehicle === "string"
      ? trip.vehicle
      : trip.vehicle?.vehicleNumber ?? "—";
  const vehicleType =
    typeof trip.vehicle !== "string" ? trip.vehicle?.vehicleType : trip.vehicleType;

  const ownerProfit = resolveTripAgencyProfitDisplay(trip);
  const breakdown = getHistoryTripExpenseBreakdown(trip);
  const duration = fmtTripDuration(trip.startTime, trip.endTime);
  const routeFrom = trip.from ?? trip.pickup;
  const routeTo = trip.to ?? trip.drop;
  const travelledKm =
    trip.startKilometers != null && trip.endKilometers != null
      ? trip.endKilometers - trip.startKilometers
      : trip.distance != null
        ? Number(trip.distance)
        : null;

  const statusStyle = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300";
      case "cancelled":
        return "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300";
      case "in_progress":
      case "scheduled":
        return "bg-indigo-500/15 text-indigo-700 border-indigo-500/40 dark:text-indigo-300";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-300";
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Overview Banner */}
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10 shadow-sm">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
              Driver
            </div>
            <div className="mt-0.5 font-semibold text-slate-900 dark:text-white truncate">
              {driver}
            </div>
            {driverPhone ? (
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {driverPhone}
              </div>
            ) : null}
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
              Vehicle
            </div>
            <div className="mt-0.5 font-semibold text-slate-900 dark:text-white truncate">
              {vehicle}
            </div>
            {vehicleType ? (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {vehicleType}
              </div>
            ) : null}
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
              Agency Cost
            </div>
            <div className="mt-0.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
              {fmtMoney(trip.agencyCost)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
              Owner Profit
            </div>
            <div className="mt-0.5 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
              {fmtMoney(ownerProfit)}
            </div>
          </div>
        </div>

        {(routeFrom || routeTo || duration) ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-indigo-100 pt-2.5 text-xs text-slate-600 dark:border-indigo-500/20 dark:text-slate-300">
            {routeFrom && routeTo ? (
              <span className="font-semibold text-slate-900 dark:text-white">
                {routeFrom} → {routeTo}
              </span>
            ) : null}
            {duration && duration !== "—" ? (
              <span className="rounded-md bg-white/70 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
                {duration}
              </span>
            ) : null}
            {travelledKm != null && !Number.isNaN(travelledKm) ? (
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {travelledKm} km
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Main 2-Column Card */}
      <div className="rounded-2xl border border-slate-200 bg-[var(--bg-main)] p-4 sm:p-5 shadow-sm dark:border-[#252c4d]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-[#252c4d]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {trip.tripNumber ?? "Vehicle Trip"}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusStyle(trip.status)}`}
            >
              {(trip.status ?? "in_progress").replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPayment}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
              title="Mark cash in for this trip"
            >
              <Wallet className="h-3.5 w-3.5" />
              Payments
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
              title="Edit all fields in modal"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Trip
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6">
          {/* Column 1: Trip Details */}
          <section className="space-y-1">
            <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-1.5 dark:border-[#252c4d]">
              <span className="h-3.5 w-1 rounded-full bg-indigo-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Trip Details
              </h4>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:p-3.5 dark:border-[#252c4d]/60 dark:bg-white/[0.02]">
              <EditableVehicleRow
                label="Start date"
                value={fmtDate(trip.startDate ?? trip.date)}
                rawSeed={toDateSeed(trip.startDate ?? trip.date)}
                fieldKey="startDate"
                tripId={trip._id}
                type="date"
                onSaved={handleSaved}
              />
              <EditableVehicleRow
                label="End date"
                value={fmtDate(trip.expectedEndDate ?? trip.endDate)}
                rawSeed={toDateSeed(trip.expectedEndDate ?? trip.endDate)}
                fieldKey="expectedEndDate"
                tripId={trip._id}
                type="date"
                onSaved={handleSaved}
              />
              <EditableVehicleRow
                label="Start time"
                value={fmtTimeAmPm(trip.startTime)}
                rawSeed={isoToTimeInputInTz(trip.startTime)}
                fieldKey="startTime"
                tripId={trip._id}
                type="text"
                onSaved={handleSaved}
              />
              <EditableVehicleRow
                label="End time"
                value={fmtTimeAmPm(trip.endTime)}
                rawSeed={isoToTimeInputInTz(trip.endTime)}
                fieldKey="endTime"
                tripId={trip._id}
                type="text"
                onSaved={handleSaved}
              />
              <EditableVehicleRow
                label="From"
                value={trip.from ?? trip.pickup ?? "—"}
                rawSeed={trip.from ?? trip.pickup}
                fieldKey="from"
                tripId={trip._id}
                type="text"
                onSaved={handleSaved}
              />
              <EditableVehicleRow
                label="To"
                value={trip.to ?? trip.drop ?? "—"}
                rawSeed={trip.to ?? trip.drop}
                fieldKey="to"
                tripId={trip._id}
                type="text"
                onSaved={handleSaved}
              />
              <EditableVehicleRow
                label="Distance"
                value={trip.distance != null ? `${trip.distance} km` : "—"}
                rawSeed={trip.distance}
                fieldKey="distance"
                tripId={trip._id}
                type="number"
                onSaved={handleSaved}
              />
              <EditableVehicleRow
                label="Start KM"
                value={trip.startKilometers != null ? String(trip.startKilometers) : "—"}
                rawSeed={trip.startKilometers}
                fieldKey="startKilometers"
                tripId={trip._id}
                type="number"
                onSaved={handleSaved}
              />
              <EditableVehicleRow
                label="End KM"
                value={trip.endKilometers != null ? String(trip.endKilometers) : "—"}
                rawSeed={trip.endKilometers}
                fieldKey="endKilometers"
                tripId={trip._id}
                type="number"
                onSaved={handleSaved}
              />
              <EditableVehicleRow
                label="Agency"
                value={resolveAgencyLabel?.(trip.agencyName) || trip.agencyName || "—"}
                rawSeed={trip.agencyName}
                fieldKey="agencyName"
                tripId={trip._id}
                type="text"
                onSaved={handleSaved}
              />
            </div>
          </section>

          {/* Column 2: Financial Details */}
          <section className="space-y-1">
            <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-1.5 dark:border-[#252c4d]">
              <span className="h-3.5 w-1 rounded-full bg-emerald-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Financial Details
              </h4>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:p-3.5 dark:border-[#252c4d]/60 dark:bg-white/[0.02]">
              <EditableVehicleRow
                label="Agency Cost"
                value={fmtMoney(trip.agencyCost)}
                rawSeed={trip.agencyCost}
                fieldKey="agencyCost"
                tripId={trip._id}
                type="number"
                onSaved={handleSaved}
              />
              <EditableVehicleRow
                label="Cab Cost"
                value={fmtMoney(trip.cabCost)}
                rawSeed={trip.cabCost}
                fieldKey="cabCost"
                tripId={trip._id}
                type="number"
                onSaved={handleSaved}
              />
              <StaticVehicleRow
                label="Fuel expense"
                value={fmtMoney(breakdown.fuelExpense)}
              />
              <StaticVehicleRow
                label="Extra expenses"
                value={fmtMoney(breakdown.extraExpenses)}
              />
              <StaticVehicleRow
                label="Total Cab Cost"
                value={fmtMoney(breakdown.totalCabCost)}
                emphasizeValue
              />
              <EditableVehicleRow
                label="Driver Salary"
                value={fmtMoney(trip.driver_salary)}
                rawSeed={trip.driver_salary}
                fieldKey="driver_salary"
                tripId={trip._id}
                type="number"
                onSaved={handleSaved}
              />
              <EditableVehicleRow
                label="Advance"
                value={fmtMoney(trip.advance)}
                rawSeed={trip.advance}
                fieldKey="advance"
                tripId={trip._id}
                type="number"
                onSaved={handleSaved}
              />
              <StaticVehicleRow
                label="Owner profit"
                value={fmtMoney(ownerProfit)}
                highlight
                badge
              />
              <EditableVehicleRow
                label="Notes"
                value={trip.notes ?? trip.completionNote ?? "—"}
                rawSeed={trip.notes ?? trip.completionNote}
                fieldKey="notes"
                tripId={trip._id}
                type="text"
                onSaved={handleSaved}
              />
            </div>
          </section>
        </div>

        {trip._id ? (
          <div className="mt-3 text-right">
            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
              ID {trip._id}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Bulk Trip Segment Card (Custom Tailored 2-Column UI) ────────────────────

function BulkTripSegmentCard({
  trip: initialTrip,
  index,
  onEdit,
  onPayment,
  onTripUpdated,
}: {
  trip: AgencyTrip;
  index: number;
  onEdit: (trip: AgencyTrip) => void;
  onPayment: (trip: AgencyTrip) => void;
  onTripUpdated: (updated: AgencyTrip) => void;
}) {
  const [trip, setTrip] = useState<AgencyTrip>(initialTrip);

  useEffect(() => {
    setTrip(initialTrip);
  }, [initialTrip]);

  const id = String(trip._id ?? trip.id ?? "");

  const handleSaved = (updated: AgencyTrip) => {
    setTrip(updated);
    onTripUpdated(updated);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-[var(--bg-main)] p-4 sm:p-5 shadow-sm dark:border-[#252c4d]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-[#252c4d]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Trip {index + 1}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {(trip.status ?? "draft").replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPayment(trip)}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
            title="Mark cash in for this trip"
          >
            <Wallet className="h-3.5 w-3.5" />
            Payments
          </button>
          <button
            type="button"
            onClick={() => onEdit(trip)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
            title="Edit all fields in modal"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6">
        {/* Column 1: Trip Details */}
        <section className="space-y-1">
          <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-1.5 dark:border-[#252c4d]">
            <span className="h-3.5 w-1 rounded-full bg-indigo-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Trip Details
            </h4>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:p-3.5 dark:border-[#252c4d]/60 dark:bg-white/[0.02]">
            <BulkEditableRow
              label="Start date"
              value={fmtDate(trip.startDate ?? trip.date)}
              rawSeed={toDateSeed(trip.startDate ?? trip.date)}
              fieldKey="startDate"
              tripId={id}
              type="date"
              onSaved={handleSaved}
            />
            <BulkEditableRow
              label="End date"
              value={fmtDate(trip.endDate)}
              rawSeed={toDateSeed(trip.endDate)}
              fieldKey="endDate"
              tripId={id}
              type="date"
              onSaved={handleSaved}
            />
            <BulkEditableRow
              label="Start time"
              value={trip.startTime?.trim() || "—"}
              rawSeed={trip.startTime}
              fieldKey="startTime"
              tripId={id}
              type="text"
              onSaved={handleSaved}
            />
            <BulkEditableRow
              label="End time"
              value={trip.endTime?.trim() || "—"}
              rawSeed={trip.endTime}
              fieldKey="endTime"
              tripId={id}
              type="text"
              onSaved={handleSaved}
            />
            <BulkEditableRow
              label="Start KM"
              value={trip.startKm != null ? String(trip.startKm) : "—"}
              rawSeed={trip.startKm}
              fieldKey="startKm"
              tripId={id}
              type="number"
              onSaved={handleSaved}
            />
            <BulkEditableRow
              label="End KM"
              value={trip.endKm != null ? String(trip.endKm) : "—"}
              rawSeed={trip.endKm}
              fieldKey="endKm"
              tripId={id}
              type="number"
              onSaved={handleSaved}
            />
            <BulkEditableRow
              label="Distance"
              value={
                trip.distance != null && Number.isFinite(Number(trip.distance))
                  ? `${trip.distance} km`
                  : "—"
              }
              rawSeed={trip.distance}
              fieldKey="distance"
              tripId={id}
              type="number"
              onSaved={handleSaved}
            />
            <BulkEditableRow
              label="Hours"
              value={
                trip.hours != null && Number.isFinite(Number(trip.hours))
                  ? String(trip.hours)
                  : "—"
              }
              rawSeed={trip.hours}
              fieldKey="hours"
              tripId={id}
              type="number"
              onSaved={handleSaved}
            />
          </div>
        </section>

        {/* Column 2: Financials */}
        <section className="space-y-1">
          <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-1.5 dark:border-[#252c4d]">
            <span className="h-3.5 w-1 rounded-full bg-emerald-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Financials
            </h4>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:p-3.5 dark:border-[#252c4d]/60 dark:bg-white/[0.02]">
            <BulkEditableRow
              label="Toll"
              value={fmtMoney(trip.toll)}
              rawSeed={trip.toll}
              fieldKey="toll"
              tripId={id}
              type="number"
              onSaved={handleSaved}
            />
            <BulkEditableRow
              label="Advance paid"
              value={fmtMoney(trip.advancePaid)}
              rawSeed={trip.advancePaid}
              fieldKey="advancePaid"
              tripId={id}
              type="number"
              onSaved={handleSaved}
            />
            <BulkEditableRow
              label="Grand total"
              value={fmtMoney(trip.grandTotal)}
              rawSeed={trip.grandTotal}
              fieldKey="grandTotal"
              tripId={id}
              type="number"
              emphasizeValue
              highlight
              onSaved={handleSaved}
            />
            <BulkEditableRow
              label="Notes"
              value={trip.notes?.trim() || "—"}
              rawSeed={trip.notes}
              fieldKey="notes"
              tripId={id}
              type="text"
              onSaved={handleSaved}
            />
          </div>
        </section>
      </div>

      {id ? (
        <div className="mt-3 text-right">
          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
            ID {id}
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

export function AgencyTxTripDetailModal({
  detail,
  agencyId,
  agencyName,
  resolveAgencyLabel,
  onClose,
  onUpdated,
}: {
  detail: AgencyTxTripDetail;
  agencyId: string;
  agencyName?: string;
  resolveAgencyLabel?: (agencyName?: string) => string;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vehicleTrip, setVehicleTrip] = useState<HistoryTrip | null>(null);
  const [bulkTrips, setBulkTrips] = useState<AgencyTrip[]>([]);

  // Modals for Vehicle Trip
  const [editVehicleTripOpen, setEditVehicleTripOpen] = useState(false);
  const [paymentVehicleTripOpen, setPaymentVehicleTripOpen] = useState(false);

  // Modals for Bulk Trip
  const [editingBulkTrip, setEditingBulkTrip] = useState<AgencyTrip | null>(null);
  const [paymentBulkTripOpen, setPaymentBulkTripOpen] = useState(false);
  const [targetBulkTripForPayment, setTargetBulkTripForPayment] =
    useState<AgencyTrip | null>(null);

  const title =
    detail.kind === "vehicle" ? "Vehicle trip details" : "Bulk entry details";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reloadBulkTrips = useCallback(async () => {
    if (detail.kind !== "bulk") return;
    try {
      const idSet = new Set(detail.tripIds.map(String));
      const { trips } = await fetchAllBulkEntryTrips(agencyId);
      const matched = trips.filter((t) =>
        idSet.has(String(t._id ?? t.id ?? "")),
      );
      matched.sort((a, b) => {
        const ta = new Date(a.startDate ?? a.date ?? 0).getTime();
        const tb = new Date(b.startDate ?? b.date ?? 0).getTime();
        return ta - tb;
      });
      setBulkTrips(matched);
    } catch {
      // silently keep current
    }
  }, [detail, agencyId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setVehicleTrip(null);
      setBulkTrips([]);
      try {
        if (detail.kind === "vehicle") {
          const trip = await fetchHistoryTripById(detail.tripId);
          if (!cancelled) setVehicleTrip(trip);
        } else {
          const idSet = new Set(detail.tripIds.map(String));
          const { trips } = await fetchAllBulkEntryTrips(agencyId);
          const matched = trips.filter((t) =>
            idSet.has(String(t._id ?? t.id ?? "")),
          );
          matched.sort((a, b) => {
            const ta = new Date(a.startDate ?? a.date ?? 0).getTime();
            const tb = new Date(b.startDate ?? b.date ?? 0).getTime();
            return ta - tb;
          });
          if (!cancelled) {
            if (matched.length === 0) {
              setError("Could not load bulk trip details for this entry.");
            } else {
              setBulkTrips(matched);
            }
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          let message = "Failed to load trip details.";
          if (e && typeof e === "object" && "response" in e) {
            const raw = (e as { response?: { data?: { message?: string } } })
              .response?.data?.message;
            if (typeof raw === "string" && raw.trim()) message = raw;
          }
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detail, agencyId]);

  const bulkHeader = useMemo(() => {
    if (!bulkTrips.length) return null;
    const first = bulkTrips[0];
    const grand = bulkTrips.reduce(
      (s, t) => s + (Number(t.grandTotal) || 0),
      0,
    );
    const advance = bulkTrips.reduce(
      (s, t) => s + (Number(t.advancePaid) || 0),
      0,
    );
    return {
      driver: first.driverName?.trim() || "—",
      vehicle: first.vehicleNumber?.trim() || "—",
      grand,
      advance,
      count: bulkTrips.length,
    };
  }, [bulkTrips]);

  return (
    <>
      <div
        className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <div
          className="flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[var(--bg-card)] shadow-xl dark:border-[#252c4d]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-[#252c4d]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-[#eef0ff]">
                {title}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#252c4d]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading trip details…
              </div>
            ) : error ? (
              <p className="py-8 text-center text-sm text-red-600">{error}</p>
            ) : detail.kind === "vehicle" && vehicleTrip ? (
              <VehicleTripSegmentCard
                trip={vehicleTrip}
                resolveAgencyLabel={resolveAgencyLabel}
                onEdit={() => setEditVehicleTripOpen(true)}
                onPayment={() => setPaymentVehicleTripOpen(true)}
                onTripUpdated={(updated) => {
                  setVehicleTrip(updated);
                  onUpdated?.();
                }}
              />
            ) : bulkHeader ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10 shadow-sm">
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
                        Driver
                      </div>
                      <div className="mt-0.5 font-semibold text-slate-900 dark:text-white truncate">
                        {bulkHeader.driver}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
                        Vehicle
                      </div>
                      <div className="mt-0.5 font-semibold text-slate-900 dark:text-white truncate">
                        {bulkHeader.vehicle}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
                        Grand total
                      </div>
                      <div className="mt-0.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {fmtMoney(bulkHeader.grand)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
                        Advance
                      </div>
                      <div className="mt-0.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {fmtMoney(bulkHeader.advance)}
                      </div>
                    </div>
                  </div>
                  {bulkHeader.count > 1 ? (
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                      {bulkHeader.count} trips in this bulk entry
                    </p>
                  ) : null}
                </div>
                <div className="space-y-4">
                  {bulkTrips.map((t, i) => (
                    <BulkTripSegmentCard
                      key={String(t._id ?? t.id ?? i)}
                      trip={t}
                      index={i}
                      onEdit={(tripToEdit) => setEditingBulkTrip(tripToEdit)}
                      onPayment={(tripToPay) => {
                        setTargetBulkTripForPayment(tripToPay);
                        setPaymentBulkTripOpen(true);
                      }}
                      onTripUpdated={async () => {
                        await reloadBulkTrips();
                        onUpdated?.();
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Vehicle Trip Edit Modal */}
      {editVehicleTripOpen && vehicleTrip && (
        <EditTripModal
          trip={vehicleTrip}
          resolveAgencyLabel={resolveAgencyLabel}
          onClose={() => setEditVehicleTripOpen(false)}
          onSuccess={(updated) => {
            if (updated) setVehicleTrip(updated);
            setEditVehicleTripOpen(false);
            onUpdated?.();
          }}
        />
      )}

      {/* Vehicle Trip Payment Modal */}
      {paymentVehicleTripOpen && vehicleTrip && (
        <TripCashInModal
          trip={vehicleTrip}
          resolveAgencyLabel={resolveAgencyLabel ?? ((n) => n ?? "—")}
          onClose={() => setPaymentVehicleTripOpen(false)}
          onSuccess={async () => {
            setPaymentVehicleTripOpen(false);
            try {
              const refreshed = await fetchHistoryTripById(vehicleTrip._id);
              setVehicleTrip(refreshed);
            } catch {
              // ignore
            }
            onUpdated?.();
          }}
        />
      )}

      {/* Bulk Trip Segment Edit Modal */}
      {editingBulkTrip && (
        <EditBulkTripModal
          trip={editingBulkTrip}
          onClose={() => setEditingBulkTrip(null)}
          onSuccess={async () => {
            setEditingBulkTrip(null);
            await reloadBulkTrips();
            onUpdated?.();
          }}
        />
      )}

      {/* Bulk Trip Payment Modal */}
      {paymentBulkTripOpen && (
        <BulkTripCashInModal
          agencyId={agencyId}
          agencyName={agencyName}
          bulkTrips={bulkTrips}
          targetTrip={targetBulkTripForPayment}
          resolveAgencyLabel={resolveAgencyLabel}
          onClose={() => {
            setPaymentBulkTripOpen(false);
            setTargetBulkTripForPayment(null);
          }}
          onSuccess={async () => {
            setPaymentBulkTripOpen(false);
            setTargetBulkTripForPayment(null);
            await reloadBulkTrips();
            onUpdated?.();
          }}
        />
      )}
    </>
  );
}
