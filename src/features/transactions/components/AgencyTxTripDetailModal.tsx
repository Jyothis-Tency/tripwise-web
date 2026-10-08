import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { AgencyTxTripDetail } from "../agencyTxRows";
import { fetchHistoryTripById, type HistoryTrip } from "../../history/api";
import { TripCard } from "../../history/components/TripCard";
import {
  fetchAllBulkEntryTrips,
  type AgencyTrip,
} from "../../bulk-entry/api";

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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 border-b border-slate-100 py-1.5 text-sm last:border-0 dark:border-[#252c4d]">
      <span className="w-[120px] shrink-0 text-slate-500 dark:text-[#8d94b8]">
        {label}
      </span>
      <span className="min-w-0 font-medium text-slate-800 dark:text-[#eef0ff]">
        {value}
      </span>
    </div>
  );
}

function BulkTripSegmentCard({
  trip,
  index,
  total,
}: {
  trip: AgencyTrip;
  index: number;
  total: number;
}) {
  const id = String(trip._id ?? trip.id ?? "");
  return (
    <div className="rounded-xl border border-slate-200 bg-[var(--bg-main)] p-4 dark:border-[#252c4d]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          Trip {index + 1}
          {total > 1 ? ` of ${total}` : ""}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-600 dark:bg-white/10 dark:text-slate-300">
          {(trip.status ?? "—").replace(/_/g, " ")}
        </span>
      </div>
      <DetailRow label="Start date" value={fmtDate(trip.startDate ?? trip.date)} />
      <DetailRow label="End date" value={fmtDate(trip.endDate)} />
      <DetailRow label="Start time" value={trip.startTime?.trim() || "—"} />
      <DetailRow label="End time" value={trip.endTime?.trim() || "—"} />
      <DetailRow
        label="Kilometers"
        value={
          trip.startKm || trip.endKm
            ? `${trip.startKm ?? "—"} → ${trip.endKm ?? "—"}`
            : "—"
        }
      />
      <DetailRow
        label="Distance"
        value={
          trip.distance != null && Number.isFinite(Number(trip.distance))
            ? `${trip.distance} km`
            : "—"
        }
      />
      <DetailRow
        label="Hours"
        value={
          trip.hours != null && Number.isFinite(Number(trip.hours))
            ? String(trip.hours)
            : "—"
        }
      />
      <DetailRow label="Toll" value={fmtMoney(trip.toll)} />
      <DetailRow label="Advance paid" value={fmtMoney(trip.advancePaid)} />
      <DetailRow label="Grand total" value={fmtMoney(trip.grandTotal)} />
      {trip.notes?.trim() ? (
        <DetailRow label="Notes" value={trip.notes.trim()} />
      ) : null}
      {id ? (
        <p className="mt-2 font-mono text-[10px] text-slate-400">ID {id}</p>
      ) : null}
    </div>
  );
}

export function AgencyTxTripDetailModal({
  detail,
  agencyId,
  resolveAgencyLabel,
  onClose,
}: {
  detail: AgencyTxTripDetail;
  agencyId: string;
  resolveAgencyLabel?: (agencyName?: string) => string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vehicleTrip, setVehicleTrip] = useState<HistoryTrip | null>(null);
  const [bulkTrips, setBulkTrips] = useState<AgencyTrip[]>([]);

  const title =
    detail.kind === "vehicle" ? "Vehicle trip details" : "Bulk entry details";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          <h3 className="text-sm font-bold text-slate-800 dark:text-[#eef0ff]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#252c4d]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
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
            <TripCard
              trip={vehicleTrip}
              readOnly
              defaultExpanded
              resolveAgencyLabel={resolveAgencyLabel}
            />
          ) : bulkHeader ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
                      Driver
                    </div>
                    <div className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                      {bulkHeader.driver}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
                      Vehicle
                    </div>
                    <div className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                      {bulkHeader.vehicle}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
                      Grand total
                    </div>
                    <div className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                      {fmtMoney(bulkHeader.grand)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
                      Advance
                    </div>
                    <div className="mt-0.5 font-semibold text-slate-900 dark:text-white">
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
              <div className="space-y-3">
                {bulkTrips.map((t, i) => (
                  <BulkTripSegmentCard
                    key={String(t._id ?? t.id ?? i)}
                    trip={t}
                    index={i}
                    total={bulkTrips.length}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
