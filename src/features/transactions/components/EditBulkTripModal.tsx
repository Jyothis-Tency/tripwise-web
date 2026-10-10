import { useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import { DatePicker } from "../../../components/ui/DatePicker";
import { updateBulkEntryTrip, type AgencyTrip } from "../../bulk-entry/api";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30";

function toDateString(val?: string | null): string {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val).split("T")[0] ?? "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

export function EditBulkTripModal({
  trip,
  onClose,
  onSuccess,
}: {
  trip: AgencyTrip;
  onClose: () => void;
  onSuccess: (updated: AgencyTrip) => void;
}) {
  const tripId = String(trip._id ?? trip.id ?? "");

  const [startDate, setStartDate] = useState(() =>
    toDateString(trip.startDate ?? trip.date),
  );
  const [endDate, setEndDate] = useState(() => toDateString(trip.endDate));
  const [startTime, setStartTime] = useState(trip.startTime ?? "");
  const [endTime, setEndTime] = useState(trip.endTime ?? "");
  const [startKm, setStartKm] = useState(
    trip.startKm != null ? String(trip.startKm) : "",
  );
  const [endKm, setEndKm] = useState(
    trip.endKm != null ? String(trip.endKm) : "",
  );
  const [distance, setDistance] = useState(
    trip.distance != null ? String(trip.distance) : "",
  );
  const [hours, setHours] = useState(
    trip.hours != null ? String(trip.hours) : "",
  );
  const [toll, setToll] = useState(
    trip.toll != null ? String(trip.toll) : "",
  );
  const [advancePaid, setAdvancePaid] = useState(
    trip.advancePaid != null ? String(trip.advancePaid) : "",
  );
  const [grandTotal, setGrandTotal] = useState(
    trip.grandTotal != null ? String(trip.grandTotal) : "",
  );
  const [driverName, setDriverName] = useState(trip.driverName ?? "");
  const [vehicleNumber, setVehicleNumber] = useState(trip.vehicleNumber ?? "");
  const [notes, setNotes] = useState(trip.notes ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId) {
      setError("Trip ID is missing");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<AgencyTrip> = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        startTime: startTime.trim() || undefined,
        endTime: endTime.trim() || undefined,
        startKm: startKm.trim() ? startKm.trim() : undefined,
        endKm: endKm.trim() ? endKm.trim() : undefined,
        distance: distance.trim() ? Number(distance) : undefined,
        hours: hours.trim() ? Number(hours) : undefined,
        toll: toll.trim() ? Number(toll) : 0,
        advancePaid: advancePaid.trim() ? Number(advancePaid) : 0,
        grandTotal: grandTotal.trim() ? Number(grandTotal) : 0,
        driverName: driverName.trim() || undefined,
        vehicleNumber: vehicleNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const updated = await updateBulkEntryTrip(tripId, payload);
      onSuccess(updated);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err?.message ??
          "Failed to update bulk trip details",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,850px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[var(--bg-card)] shadow-2xl dark:border-[#252c4d]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-[#252c4d]">
          <h3 className="text-base font-bold text-slate-800 dark:text-[#eef0ff]">
            Edit Bulk Trip Details
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4"
        >
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Driver Name
              </label>
              <input
                type="text"
                className={inputCls}
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Driver name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Vehicle Number
              </label>
              <input
                type="text"
                className={inputCls}
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="Vehicle number"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Start Date
              </label>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                End Date
              </label>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Start Time
              </label>
              <input
                type="text"
                className={inputCls}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="e.g. 09:00 AM"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                End Time
              </label>
              <input
                type="text"
                className={inputCls}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="e.g. 06:00 PM"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Start Km
              </label>
              <input
                type="number"
                step="any"
                className={inputCls}
                value={startKm}
                onChange={(e) => setStartKm(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                End Km
              </label>
              <input
                type="number"
                step="any"
                className={inputCls}
                value={endKm}
                onChange={(e) => setEndKm(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Distance (km)
              </label>
              <input
                type="number"
                step="any"
                className={inputCls}
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Hours
              </label>
              <input
                type="number"
                step="any"
                className={inputCls}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Toll (₹)
              </label>
              <input
                type="number"
                step="any"
                className={inputCls}
                value={toll}
                onChange={(e) => setToll(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Advance Paid (₹)
              </label>
              <input
                type="number"
                step="any"
                className={inputCls}
                value={advancePaid}
                onChange={(e) => setAdvancePaid(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Grand Total (₹)
              </label>
              <input
                type="number"
                step="any"
                className={inputCls}
                value={grandTotal}
                onChange={(e) => setGrandTotal(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Notes
            </label>
            <textarea
              rows={2}
              className={inputCls}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Trip notes…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#252c4d]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
