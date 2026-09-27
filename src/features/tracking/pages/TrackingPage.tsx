import { useCallback, useEffect, useRef, useState } from "react";
import {
  Car,
  ChevronRight,
  User,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  X,
  AlertTriangle,
  Info,
  Navigation,
  RefreshCw,
  Fuel,
  Landmark,
  FileText,
  ParkingCircle,
  Package,
} from "lucide-react";
import {
  fetchTrackingVehicles,
  completeTrip,
  type TrackingVehicle,
} from "../api";
import { fetchAgencies, type Agency } from "../../bulk-entry/api";
import { resolveAgencyLabelFromName } from "../../../lib/agencyDisplay";
import { resolveTripAgencyProfitDisplay } from "../../history/tripExpenseBreakdown";

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function statusBadgeCls(status?: string) {
  switch ((status ?? "").toLowerCase()) {
    case "in_progress":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400";
    case "scheduled":
      return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300";
    case "completed":
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400";
  }
}

function statusLabel(status?: string) {
  switch ((status ?? "").toLowerCase()) {
    case "in_progress":
      return "In Progress";
    case "scheduled":
      return "Scheduled";
    case "completed":
      return "Completed";
    default:
      return status ?? "Unknown";
  }
}

function formatDate(d?: string) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function driverName(driver: TrackingVehicle["driver"]): string {
  if (!driver) return "No Driver";
  if (driver.fullName) return driver.fullName;
  if (driver.firstName && driver.lastName)
    return `${driver.firstName} ${driver.lastName}`;
  return "No Driver";
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30";

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL SHELL
// ═══════════════════════════════════════════════════════════════════════════════

function ModalShell({
  title,
  onClose,
  children,
  maxWidth = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onClick={(e) => e.target === ref.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-black/60"
    >
      <div
        className={`flex w-full ${maxWidth} max-h-[90vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#1e2638] dark:bg-[#0e121d]`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INFO DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-subtle sm:p-6 dark:border-[#1e2638] dark:bg-[#0e121d]/80 dark:backdrop-blur-xl">
      <h4 className="mb-3 text-sm font-semibold text-slate-800 sm:text-base dark:text-white">
        {title}
      </h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value?: string | number | null;
  valueColor?: string;
}) {
  return (
    <div className="flex items-start justify-between border-b border-slate-50 py-2 last:border-0 dark:border-white/5">
      <span className="mr-4 shrink-0 text-sm text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span
        className={`text-right text-sm font-medium ${valueColor ?? "text-slate-800 dark:text-slate-200"}`}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKING CARD (Left List)
// ═══════════════════════════════════════════════════════════════════════════════

function TrackingCardSkeleton() {
  return (
    <div className="w-full animate-pulse rounded-xl border border-slate-100 bg-white p-4 dark:border-[#1e2638] dark:bg-[#0e121d]/80">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 dark:bg-white/5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-28 rounded bg-slate-100 dark:bg-white/5" />
          <div className="h-3 w-20 rounded bg-slate-100 dark:bg-white/5" />
        </div>
      </div>
      <div className="mt-3 h-3 w-2/3 rounded bg-slate-100 dark:bg-white/5" />
      <div className="mt-1.5 h-3 w-1/2 rounded bg-slate-100 dark:bg-white/5" />
    </div>
  );
}

function TrackingCard({
  item,
  isSelected,
  onSelect,
}: {
  item: TrackingVehicle;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const v = item.vehicle;
  const trip = item.activeTrip;
  const drv = item.driver;
  const tripStatus = (trip?.status ?? "scheduled").toLowerCase();
  const inProgress = tripStatus === "in_progress";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl p-3.5 text-left transition-all ${
        isSelected
          ? "border-2 border-indigo-500 bg-indigo-50/40 shadow-xs dark:border-indigo-400 dark:bg-indigo-500/10"
          : "border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs dark:border-white/10 dark:bg-[#0e121d]/80 dark:hover:border-white/20 dark:hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            isSelected
              ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"
              : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"
          }`}
        >
          <Car className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            {v.vehicleNumber ?? "N/A"}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                inProgress ? "bg-emerald-500" : "bg-indigo-500"
              }`}
            />
            <span
              className={`text-xs font-medium ${
                inProgress
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-indigo-700 dark:text-indigo-300"
              }`}
            >
              {statusLabel(trip?.status)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-slate-600 dark:text-slate-300">
        <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate text-xs font-medium">{driverName(drv)}</span>
      </div>

      {trip?.from && trip?.to && (
        <div className="mt-1.5 flex items-center gap-2 text-indigo-600 dark:text-indigo-300">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-indigo-400 dark:text-indigo-400/80" />
          <span className="truncate text-xs font-medium">
            {trip.from} → {trip.to}
          </span>
        </div>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL TABS
// ═══════════════════════════════════════════════════════════════════════════════

function TripInfoTab({
  item,
  onComplete,
}: {
  item: TrackingVehicle;
  onComplete: () => void;
}) {
  const trip = item.activeTrip;
  if (!trip)
    return (
      <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/40 py-12 text-center dark:border-white/10 dark:bg-white/5">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          No active trip data
        </p>
      </div>
    );

  const tripId = trip._id ?? trip.id ?? "";
  const isInProgress = (trip.status ?? "").toLowerCase() === "in_progress";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <InfoCard title="Trip Overview">
          <InfoRow label="Trip Number" value={trip.tripNumber} />
          <InfoRow label="Status" value={statusLabel(trip.status)} />
          <InfoRow label="Priority" value={trip.priority ?? "Normal"} />
        </InfoCard>
      </div>

      <InfoCard title="Route Information">
        <InfoRow label="From" value={trip.from} />
        <InfoRow label="To" value={trip.to} />
        <InfoRow
          label="Distance"
          value={trip.distance != null ? `${trip.distance}` : undefined}
        />
      </InfoCard>

      <InfoCard title="Schedule">
        <InfoRow label="Start Date" value={formatDate(trip.startDate)} />
        <InfoRow
          label="Expected End"
          value={formatDate(trip.expectedEndDate)}
        />
      </InfoCard>

      <div className="md:col-span-2">
        <InfoCard title="Customer Information">
          <InfoRow label="Customer" value={trip.customer} />
          <InfoRow label="Care Of Name" value={trip.careOf?.name} />
          <InfoRow label="Care Of Phone" value={trip.careOf?.phone} />
        </InfoCard>
      </div>

      {isInProgress && tripId && (
        <div className="md:col-span-2">
          <InfoCard title="Trip Actions">
            <button
              type="button"
              onClick={onComplete}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              <CheckCircle2 className="h-5 w-5" />
              Complete Trip
            </button>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-slate-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-slate-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-300" />
              <span>
                This will mark the trip as completed. The vehicle will be
                available for new trips.
              </span>
            </div>
          </InfoCard>
        </div>
      )}
    </div>
  );
}

function DriverInfoTab({ item }: { item: TrackingVehicle }) {
  const drv = item.driver;
  const v = item.vehicle;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <InfoCard title="Driver Profile">
        <InfoRow label="Name" value={driverName(drv)} />
        <InfoRow label="Phone" value={drv?.phone} />
        <InfoRow label="Email" value={drv?.email} />
        <InfoRow label="Driver ID" value={drv?._id ?? drv?.id} />
      </InfoCard>

      <InfoCard title="Vehicle Information">
        <InfoRow label="Vehicle Number" value={v.vehicleNumber} />
        <InfoRow label="Vehicle Type" value={v.vehicleType} />
        <InfoRow label="Vehicle Model" value={v.vehicleModel} />
        <InfoRow
          label="Vehicle Year"
          value={v.vehicleYear != null ? String(v.vehicleYear) : undefined}
        />
      </InfoCard>
    </div>
  );
}

function ExpenseInfoTab({
  item,
  resolveAgencyLabel,
}: {
  item: TrackingVehicle;
  resolveAgencyLabel: (agencyName?: string) => string;
}) {
  const trip = item.activeTrip;
  if (!trip)
    return (
      <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/40 py-12 text-center dark:border-white/10 dark:bg-white/5">
        <p className="text-sm text-slate-500 dark:text-slate-400">No trip data</p>
      </div>
    );

  const agencyCost = trip.agencyCost != null ? Number(trip.agencyCost) : 0;
  const cabCost = trip.cabCost != null ? Number(trip.cabCost) : 0;
  const expenses = trip.expenses ?? [];
  const agencyProfitAmt = resolveTripAgencyProfitDisplay({
    agencyCost: trip.agencyCost,
    cabCost: trip.cabCost,
    expenses,
  });

  let fuel = 0,
    toll = 0,
    taxPermit = 0,
    parking = 0,
    other = 0;
  expenses.forEach((e) => {
    const amt = Number(e.amount ?? 0);
    switch ((e.type ?? "").toLowerCase()) {
      case "fuel":
        fuel += amt;
        break;
      case "toll":
        toll += amt;
        break;
      case "tax":
      case "permit":
        taxPermit += amt;
        break;
      case "parking":
        parking += amt;
        break;
      default:
        other += amt;
    }
  });
  const totalExpenses = toll + taxPermit + parking + other;

  return (
    <div className="space-y-4">
      <InfoCard title="Cost Summary">
        <InfoRow
          label="Agency Name"
          value={resolveAgencyLabel(trip.agencyName)}
        />
        <InfoRow
          label="Agency Cost"
          value={`₹${agencyCost.toLocaleString("en-IN")}`}
        />
        <InfoRow
          label="Cab Cost"
          value={`₹${cabCost.toLocaleString("en-IN")}`}
        />
        <div className="my-1 border-t border-slate-100 dark:border-white/10" />
        <InfoRow
          label="Agency Profit"
          value={`₹${agencyProfitAmt.toLocaleString("en-IN")}`}
          valueColor="font-bold text-emerald-600 dark:text-emerald-400"
        />
        <InfoRow
          label="Advance"
          value={`₹${(trip.advance != null ? Number(trip.advance) : 0).toLocaleString("en-IN")}`}
        />
      </InfoCard>

      <InfoCard title="Cab Expenses Breakdown">
        <ExpenseRow icon={Fuel} label="Petrol / Diesel" amount={fuel} />
        <ExpenseRow icon={Landmark} label="Toll Charges" amount={toll} />
        <ExpenseRow icon={FileText} label="Tax & Permit" amount={taxPermit} />
        <ExpenseRow icon={ParkingCircle} label="Parking" amount={parking} />
        <ExpenseRow icon={Package} label="Other" amount={other} />
        <div className="my-1 border-t border-slate-100 dark:border-white/10" />
        <InfoRow
          label="Total Cab Expenses"
          value={`₹${totalExpenses.toLocaleString("en-IN")}`}
          valueColor="font-bold text-amber-600 dark:text-amber-400"
        />
      </InfoCard>
    </div>
  );
}

function ExpenseRow({
  icon: Icon,
  label,
  amount,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  amount: number;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-50 py-2 last:border-0 dark:border-white/5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
        ₹{amount.toLocaleString("en-IN")}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETE TRIP MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function CompleteTripModal({
  tripId,
  startKm,
  onClose,
  onCompleted,
}: {
  tripId: string;
  startKm?: number;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [endKm, setEndKm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const parsed = parseFloat(endKm.trim());
    if (!endKm.trim()) {
      setErr("Ending KM is required");
      return;
    }
    if (isNaN(parsed)) {
      setErr("Please enter a valid number");
      return;
    }
    if (parsed < 0) {
      setErr("KM cannot be negative");
      return;
    }
    if (startKm != null && parsed < startKm) {
      setErr("Ending KM must be ≥ starting KM");
      return;
    }

    setSubmitting(true);
    try {
      await completeTrip(tripId, parsed);
      onCompleted();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Failed to complete trip");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Complete Trip" onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-4 p-6">
        {startKm != null && (
          <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-slate-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-slate-300">
            <Info className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-300" />
            <span>
              Starting KM: <strong>{startKm}</strong>
            </span>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="endKm"
            className="text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Ending KM <span className="text-red-500">*</span>
          </label>
          <input
            id="endKm"
            type="number"
            value={endKm}
            onChange={(e) => {
              setEndKm(e.target.value);
              setErr(null);
            }}
            placeholder="Enter ending odometer reading"
            className={inputCls}
          />
          {err && (
            <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
          )}
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          Please enter the ending odometer reading to complete the trip.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            {submitting ? "Completing…" : "Complete Trip"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function DetailPanel({
  item,
  onBack,
  onRefresh,
  resolveAgencyLabel,
}: {
  item: TrackingVehicle;
  onBack: () => void;
  onRefresh: () => void;
  resolveAgencyLabel: (agencyName?: string) => string;
}) {
  const [tab, setTab] = useState<"trip" | "driver" | "expense">("trip");
  const [showComplete, setShowComplete] = useState(false);

  const v = item.vehicle;
  const trip = item.activeTrip;
  const tripStatus = trip?.status ?? "scheduled";

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "trip", label: "Trip Info" },
    { key: "driver", label: "Driver Info" },
    { key: "expense", label: "Expense Info" },
  ];

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-[#0e121d]">
      <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-4 shadow-sm backdrop-blur-md lg:px-6 dark:border-[#1e2638] dark:bg-[#0e121d]/90">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 active:scale-95 lg:hidden dark:text-slate-400 dark:hover:bg-white/5"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h3 className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl dark:text-white">
              {v.vehicleNumber}
            </h3>
            {trip?.from && trip?.to && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                {trip.from}{" "}
                <ChevronRight className="h-3.5 w-3.5 shrink-0" /> {trip.to}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider sm:px-3.5 sm:py-1.5 sm:text-xs ${statusBadgeCls(tripStatus)}`}
          >
            {statusLabel(tripStatus)}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 active:rotate-180 dark:text-slate-400 dark:hover:bg-white/5"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="no-scrollbar sticky top-[73px] z-10 flex shrink-0 overflow-x-auto border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-[#1e2638] dark:bg-[#0e121d]/90">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative whitespace-nowrap border-b-2 px-4 py-3.5 text-xs font-semibold transition-all sm:px-6 sm:text-sm ${
              tab === t.key
                ? "border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {tab === "trip" && (
          <TripInfoTab item={item} onComplete={() => setShowComplete(true)} />
        )}
        {tab === "driver" && <DriverInfoTab item={item} />}
        {tab === "expense" && (
          <ExpenseInfoTab
            item={item}
            resolveAgencyLabel={resolveAgencyLabel}
          />
        )}
      </div>

      {showComplete && trip && (
        <CompleteTripModal
          tripId={trip._id ?? trip.id ?? ""}
          startKm={trip.startKilometers}
          onClose={() => setShowComplete(false)}
          onCompleted={() => {
            setShowComplete(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function TrackingPage() {
  const [vehicles, setVehicles] = useState<TrackingVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [ownerAgencies, setOwnerAgencies] = useState<Agency[]>([]);

  const resolveAgencyLabel = useCallback(
    (agencyName?: string) =>
      resolveAgencyLabelFromName(agencyName, ownerAgencies),
    [ownerAgencies],
  );

  const selected =
    selectedIdx !== null ? (vehicles[selectedIdx] ?? null) : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTrackingVehicles();
      setVehicles(data);
      setSelectedIdx(null);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to load tracking data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchAgencies(1, 500)
      .then((res) => setOwnerAgencies(res.agencies))
      .catch(() => setOwnerAgencies([]));
  }, []);

  return (
    <div className="relative flex h-full overflow-hidden dark:bg-[#0e121d]">
      {/* LEFT: list panel */}
      <div
        className={`flex w-full shrink-0 flex-col border-r border-slate-200 bg-white transition-all md:w-72 lg:w-80 xl:w-96 dark:border-[#1e2638] dark:bg-[#0e121d]/80 ${
          selectedIdx !== null ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3.5 dark:border-[#1e2638]">
          <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            Active Trips
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-600 transition-all hover:bg-indigo-50 active:scale-95 dark:text-indigo-300 dark:hover:bg-indigo-500/15"
              title="Refresh tracking data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300">
              {vehicles.length}
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TrackingCardSkeleton key={i} />
            ))
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <AlertTriangle className="h-10 w-10 text-rose-300 dark:text-rose-400/70" />
              <p className="text-sm text-rose-500 dark:text-rose-400">
                {error}
              </p>
              <button
                type="button"
                onClick={load}
                className="text-xs font-semibold text-indigo-600 underline dark:text-indigo-300"
              >
                Retry
              </button>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/40 py-14 text-center dark:border-white/10 dark:bg-white/5">
              <Navigation className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                No active trips
              </p>
              <p className="max-w-[14rem] text-xs text-slate-400 dark:text-slate-500">
                Vehicles with in-progress or scheduled trips will appear here
              </p>
            </div>
          ) : (
            vehicles.map((v, i) => (
              <TrackingCard
                key={v.vehicle.id ?? v.vehicle._id ?? i}
                item={v}
                isSelected={i === selectedIdx}
                onSelect={() => setSelectedIdx(i)}
              />
            ))
          )}
        </div>
      </div>

      {/* RIGHT: detail panel */}
      <div
        className={`flex-1 overflow-hidden transition-all ${
          selectedIdx !== null
            ? "flex flex-col"
            : "hidden flex-col md:flex"
        }`}
      >
        {selected ? (
          <DetailPanel
            item={selected}
            onBack={() => setSelectedIdx(null)}
            onRefresh={load}
            resolveAgencyLabel={resolveAgencyLabel}
          />
        ) : !loading ? (
          <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-[#0e121d]">
            <div className="text-center">
              <Navigation className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                No vehicle selected
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Select a vehicle from the list to view tracking details
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
