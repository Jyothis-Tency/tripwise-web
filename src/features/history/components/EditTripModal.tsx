import { useEffect, useMemo, useState } from "react";
import type { HistoryTrip } from "../api";
import { fetchPaymentHistory, updateTripFields } from "../api";
import { isoToTimeInputInTz, fmtTripDuration } from "../historyTimeUtils";
import {
  computeAgencyProfitPreview,
  getHistoryTripExpenseBreakdown,
} from "../tripExpenseBreakdown";
import { TimePicker12h } from "../../../components/ui/TimePicker12h";
import { normalizeHHmm } from "../../../lib/timePickerUtils";
import { AgencyNameCombobox } from "../../../components/AgencyNameCombobox";
import {
  historyDriverName,
  historyVehicleNumber,
} from "../historyTripDisplay";
import { X, Save } from "lucide-react";

/** Fields editable via inline edit on History trip cards (PATCH /fields). */
const HISTORY_EDITABLE_KEYS = [
  "startDate",
  "expectedEndDate",
  "startTime",
  "endTime",
  "from",
  "to",
  "distance",
  "startKilometers",
  "endKilometers",
  "customer",
  "agencyName",
  "notes",
  "agencyCost",
  "cabCost",
  "driver_salary",
  "advance",
] as const;

const NUMERIC_KEYS = new Set([
  "startKilometers",
  "endKilometers",
  "distance",
  "agencyCost",
  "cabCost",
  "driver_salary",
  "advance",
]);

function fmtCurrency(v: unknown): string {
  const n = parseFloat(String(v ?? 0));
  if (isNaN(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ReadOnlyRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 py-1.5 border-b border-slate-100/80 last:border-0">
      <span className="w-[130px] sm:w-[150px] shrink-0 text-sm text-slate-600">
        {label}
      </span>
      <span
        className={`text-sm sm:text-[15px] font-semibold tabular-nums ${highlight ? "text-blue-700" : "text-slate-800"}`}
      >
        {value}
      </span>
    </div>
  );
}

const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";

const currencyWrapCls =
  "flex border border-slate-200 rounded-lg overflow-hidden focus-within:border-blue-400 focus-within:ring-1";

function buildInitialFields(trip: HistoryTrip) {
  return {
    startDate: trip.startDate
      ? trip.startDate.split("T")[0]
      : trip.date
        ? trip.date.split("T")[0]
        : "",
    expectedEndDate: (trip.expectedEndDate ?? trip.endDate)
      ? String(trip.expectedEndDate ?? trip.endDate).split("T")[0]
      : "",
    startTime: trip.startTime
      ? normalizeHHmm(isoToTimeInputInTz(trip.startTime))
      : "",
    endTime: trip.endTime
      ? normalizeHHmm(isoToTimeInputInTz(trip.endTime))
      : "",
    from: trip.from || trip.pickup || "",
    to: trip.to || trip.drop || "",
    distance: trip.distance?.toString() || "",
    startKilometers: trip.startKilometers?.toString() || "",
    endKilometers: trip.endKilometers?.toString() || "",
    customer: trip.customer || "",
    agencyName: trip.agencyName || "",
    notes: trip.notes ?? trip.completionNote ?? "",
    agencyCost: trip.agencyCost?.toString() || "",
    cabCost: trip.cabCost?.toString() || "",
    driver_salary: trip.driver_salary?.toString() || "",
    advance: trip.advance?.toString() || "",
  };
}

type FormFields = ReturnType<typeof buildInitialFields>;

export function EditTripModal({
  trip,
  onClose,
  onSuccess,
  resolveAgencyLabel,
  driverNameFallback,
  vehicleNumberFallback,
}: {
  trip: HistoryTrip;
  onClose: () => void;
  onSuccess: (updated?: HistoryTrip) => void;
  resolveAgencyLabel?: (agencyName?: string) => string;
  /** From vehicle history row when API returns driver id only */
  driverNameFallback?: string;
  vehicleNumberFallback?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<FormFields>(() => buildInitialFields(trip));
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState(
    trip.paymentSummary ?? null,
  );

  useEffect(() => {
    setFields(buildInitialFields(trip));
  }, [trip]);

  const expenseBreakdown = useMemo(
    () => getHistoryTripExpenseBreakdown(trip),
    [trip],
  );

  const travelledKm =
    trip.startKilometers != null && trip.endKilometers != null
      ? trip.endKilometers - trip.startKilometers
      : null;

  const agencyProfit = useMemo(
    () =>
      computeAgencyProfitPreview(
        fields.agencyCost,
        fields.cabCost,
        trip.expenses,
      ),
    [fields.agencyCost, fields.cabCost, trip.expenses],
  );

  const driverDisplay = historyDriverName(trip.driver, driverNameFallback);
  const vehicleDisplay = historyVehicleNumber(
    trip.vehicle,
    vehicleNumberFallback,
  );
  const agencyDisplayLabel =
    resolveAgencyLabel?.(trip.agencyName) ?? trip.agencyName ?? "—";

  useEffect(() => {
    if (trip.paymentSummary) {
      setPaymentSummary(trip.paymentSummary);
      return;
    }
    let cancelled = false;
    setPaymentLoading(true);
    fetchPaymentHistory(trip._id)
      .then(({ summary }) => {
        if (!cancelled) {
          setPaymentSummary({
            totalAmount: summary.totalAmount,
            paidAmount: summary.totalPaid,
            remainingBalance: summary.remainingBalance,
            paymentStatus: summary.paymentStatus as
              | "paid"
              | "partial"
              | "unpaid",
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPaymentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trip._id, trip.paymentSummary]);

  const totalAmount =
    paymentSummary?.totalAmount ?? (Number(trip.agencyCost) || 0);
  const paidAmount = paymentSummary?.paidAmount ?? trip.paidAmount ?? 0;
  const remaining =
    paymentSummary?.remainingBalance ?? totalAmount - paidAmount;
  const paymentStatus = paymentSummary?.paymentStatus ?? "unpaid";
  const progress =
    totalAmount > 0 ? Math.min((paidAmount / totalAmount) * 100, 100) : 0;

  const paymentBadgeCls =
    paymentStatus === "paid"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : paymentStatus === "partial"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-red-50 text-red-700 border-red-200";

  const handleChange = (field: keyof FormFields, value: string) => {
    setFields((prev) => ({ ...prev, [field]: value }));
  };

  const calculateDistanceFromKm = () => {
    const start = parseFloat(fields.startKilometers);
    const end = parseFloat(fields.endKilometers);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      handleChange("distance", (end - start).toString());
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {};
      for (const key of HISTORY_EDITABLE_KEYS) {
        const v = fields[key];
        if (v === "") continue;
        if (NUMERIC_KEYS.has(key)) {
          payload[key] = parseFloat(v);
        } else {
          payload[key] = v;
        }
      }
      const updated = await updateTripFields(
        trip._id,
        payload as Partial<HistoryTrip>,
      );
      onSuccess(
        updated
          ? {
              ...trip,
              ...updated,
              paymentSummary: updated.paymentSummary ?? trip.paymentSummary,
            }
          : undefined,
      );
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      setError(msg ?? "Failed to update trip fields. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-semibold text-slate-800 text-lg">
              Edit Trip Details
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Trip {trip.tripNumber || trip._id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-3">
            <section className="xl:col-span-2">
              <h4 className="text-sm font-bold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-400 rounded-full" />
                Trip Details
              </h4>
              <div className="rounded-lg bg-slate-50/50 border border-slate-100 px-4 sm:px-5 py-3 sm:py-4 space-y-3">
                <ReadOnlyRow
                  label="Trip Number"
                  value={trip.tripNumber ?? trip._id}
                  highlight
                />
                <ReadOnlyRow
                  label="Status"
                  value={(trip.status ?? "—").replace(/_/g, " ")}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={fields.startDate}
                      onChange={(e) =>
                        handleChange("startDate", e.target.value)
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={fields.expectedEndDate}
                      onChange={(e) =>
                        handleChange("expectedEndDate", e.target.value)
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Start Time
                    </label>
                    <TimePicker12h
                      value={fields.startTime}
                      allowEmpty
                      onChange={(v) =>
                        handleChange("startTime", v ? normalizeHHmm(v) : "")
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      End Time
                    </label>
                    <TimePicker12h
                      value={fields.endTime}
                      allowEmpty
                      onChange={(v) =>
                        handleChange("endTime", v ? normalizeHHmm(v) : "")
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <ReadOnlyRow
                  label="Trip duration"
                  value={fmtTripDuration(trip.startTime, trip.endTime)}
                  highlight
                />
                <ReadOnlyRow label="Driver" value={driverDisplay} />
                {typeof trip.driver === "object" && trip.driver?.phone && (
                  <ReadOnlyRow label="Driver Phone" value={trip.driver.phone} />
                )}
                <ReadOnlyRow label="Vehicle" value={vehicleDisplay} />
                {typeof trip.vehicle === "object" && trip.vehicle?.vehicleType && (
                  <ReadOnlyRow
                    label="Vehicle Type"
                    value={trip.vehicle.vehicleType}
                  />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      From
                    </label>
                    <input
                      type="text"
                      value={fields.from}
                      onChange={(e) => handleChange("from", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      To
                    </label>
                    <input
                      type="text"
                      value={fields.to}
                      onChange={(e) => handleChange("to", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Distance
                    </label>
                    <input
                      type="number"
                      value={fields.distance}
                      onChange={(e) =>
                        handleChange("distance", e.target.value)
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Start KM
                    </label>
                    <input
                      type="number"
                      value={fields.startKilometers}
                      onChange={(e) =>
                        handleChange("startKilometers", e.target.value)
                      }
                      onBlur={calculateDistanceFromKm}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      End KM
                    </label>
                    <input
                      type="number"
                      value={fields.endKilometers}
                      onChange={(e) =>
                        handleChange("endKilometers", e.target.value)
                      }
                      onBlur={calculateDistanceFromKm}
                      className={inputCls}
                    />
                  </div>
                </div>

                {travelledKm != null && (
                  <ReadOnlyRow
                    label="KM Travelled"
                    value={`${travelledKm} km`}
                    highlight
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Customer
                    </label>
                    <input
                      type="text"
                      value={fields.customer}
                      onChange={(e) =>
                        handleChange("customer", e.target.value)
                      }
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm text-slate-600 mb-1">
                      Agency
                    </label>
                    <AgencyNameCombobox
                      id="edit-trip-agency"
                      value={fields.agencyName}
                      onChange={(name) => handleChange("agencyName", name)}
                      inputClassName={inputCls}
                      placeholder="Agency name"
                      extraSuggestionNames={
                        trip.agencyName?.trim() ? [trip.agencyName.trim()] : []
                      }
                    />
                    {resolveAgencyLabel && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {resolveAgencyLabel(fields.agencyName) ||
                          agencyDisplayLabel}
                      </p>
                    )}
                  </div>
                </div>

                {trip.careOf?.name && (
                  <ReadOnlyRow label="Care Of" value={trip.careOf.name} />
                )}

                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={fields.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>
            </section>

            <div className="space-y-5">
              <section>
                <h4 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-1 h-4 bg-emerald-400 rounded-full" />
                  Financial Details
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Agency Cost
                    </label>
                    <div className={currencyWrapCls}>
                      <span className="px-3 bg-slate-50 border-r border-slate-200 py-2 text-sm text-slate-500">
                        ₹
                      </span>
                      <input
                        type="number"
                        value={fields.agencyCost}
                        onChange={(e) =>
                          handleChange("agencyCost", e.target.value)
                        }
                        className="flex-1 w-full min-w-0 px-3 py-2 text-sm outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Cab Cost
                    </label>
                    <div className={currencyWrapCls}>
                      <span className="px-3 bg-slate-50 border-r border-slate-200 py-2 text-sm text-slate-500">
                        ₹
                      </span>
                      <input
                        type="number"
                        value={fields.cabCost}
                        onChange={(e) =>
                          handleChange("cabCost", e.target.value)
                        }
                        className="flex-1 w-full min-w-0 px-3 py-2 text-sm outline-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-50/30 border border-emerald-100 px-4 py-3 my-3">
                  <ReadOnlyRow
                    label="Fuel expense"
                    value={fmtCurrency(expenseBreakdown.fuelExpense)}
                  />
                  <ReadOnlyRow
                    label="Extra Expenses"
                    value={fmtCurrency(expenseBreakdown.extraExpenses)}
                  />
                  <ReadOnlyRow
                    label="Total Cab Cost"
                    value={fmtCurrency(expenseBreakdown.totalCabCost)}
                    highlight
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Driver Salary
                    </label>
                    <div className={currencyWrapCls}>
                      <span className="px-3 bg-slate-50 border-r border-slate-200 py-2 text-sm text-slate-500">
                        ₹
                      </span>
                      <input
                        type="number"
                        value={fields.driver_salary}
                        onChange={(e) =>
                          handleChange("driver_salary", e.target.value)
                        }
                        className="flex-1 w-full min-w-0 px-3 py-2 text-sm outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Advance
                    </label>
                    <div className={currencyWrapCls}>
                      <span className="px-3 bg-slate-50 border-r border-slate-200 py-2 text-sm text-slate-500">
                        ₹
                      </span>
                      <input
                        type="number"
                        value={fields.advance}
                        onChange={(e) =>
                          handleChange("advance", e.target.value)
                        }
                        className="flex-1 w-full min-w-0 px-3 py-2 text-sm outline-none"
                      />
                    </div>
                  </div>
                  <ReadOnlyRow
                    label="Agency profit"
                    value={fmtCurrency(agencyProfit)}
                    highlight
                  />
                </div>
              </section>

              <section>
                <h4 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-1 h-4 bg-amber-400 rounded-full" />
                  Payment Status
                </h4>
                {paymentLoading ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    Loading payment…
                  </p>
                ) : (
                  <div className="rounded-lg bg-amber-50/30 border border-amber-100 px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-bold capitalize ${paymentBadgeCls}`}
                      >
                        {paymentStatus}
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${progress}%`,
                          background:
                            progress >= 100
                              ? "linear-gradient(90deg, #10b981, #059669)"
                              : progress > 0
                                ? "linear-gradient(90deg, #f59e0b, #d97706)"
                                : "#ef4444",
                        }}
                      />
                    </div>
                    <ReadOnlyRow
                      label="Total Amount"
                      value={fmtCurrency(totalAmount)}
                    />
                    <ReadOnlyRow
                      label="Paid Amount"
                      value={fmtCurrency(paidAmount)}
                    />
                    <ReadOnlyRow
                      label={
                        remaining < -1e-6 ? "Overpaid (credit)" : "Remaining"
                      }
                      value={fmtCurrency(remaining)}
                      highlight
                    />
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-white transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-[2] flex justify-center items-center gap-2 bg-blue-600 text-white rounded-xl py-2 px-4 text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-70"
          >
            {saving ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
