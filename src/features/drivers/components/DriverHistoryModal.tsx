import { useCallback, useEffect, useRef, useState } from "react";
import { Car, History, UserCheck, X } from "lucide-react";
import type { Driver } from "../api";
import { fetchDriverHistoryDetailed } from "../api";
import type { HistoryTripItem } from "../../vehicles/api";
import { DatePicker } from "../../../components/ui/DatePicker";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30";

function driverName(d: Driver): string {
  if (d.firstName && d.lastName) return `${d.firstName} ${d.lastName}`.trim();
  return (d as any).name ?? "Driver";
}

function formatDate(d?: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function statusBadgeCls(status?: string) {
  switch ((status ?? "").toLowerCase()) {
    case "scheduled":
      return "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30";
    case "in_progress":
    case "in progress":
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30";
    case "completed":
      return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30";
    case "cancelled":
      return "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10";
  }
}

function resolveVehicleLabel(t: HistoryTripItem): string {
  const v = t.vehicle;
  if (!v) return "—";
  if (typeof v === "string") return v;
  const num = v.vehicleNumber ?? "";
  const model = v.vehicleModel ?? "";
  if (num && model) return `${num} — ${model}`;
  return num || model || "—";
}

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

function ModalShell({
  title,
  onClose,
  children,
  maxWidth = "max-w-lg",
}: ModalShellProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-black/60"
    >
      <div
        className={`flex max-h-[90vh] w-full ${maxWidth} flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-[#1e2638] dark:bg-[#0e121d]`}
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

export function DriverHistoryModal({
  driver,
  onClose,
}: {
  driver: Driver;
  onClose: () => void;
}) {
  const STATUS_OPTIONS = [
    "all",
    "completed",
    "in_progress",
    "scheduled",
    "cancelled",
  ] as const;
  const [selectedStatus, setSelectedStatus] =
    useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const [historyData, setHistoryData] = useState<Awaited<
    ReturnType<typeof fetchDriverHistoryDetailed>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const driverId = driver._id ?? (driver as any).id;

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDriverHistoryDetailed({
        driverId,
        page,
        limit,
        status: selectedStatus,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setHistoryData(res);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ?? e?.message ?? "Failed to load history",
      );
    } finally {
      setLoading(false);
    }
  }, [driverId, page, limit, selectedStatus, startDate, endDate]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const trips = historyData?.trips ?? [];
  const pagination = historyData?.pagination;
  const tripStats = historyData?.tripStats;
  const financialStats = historyData?.financialStats;

  const formatMoney0 = (v: any) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return `₹${Math.round(n).toLocaleString("en-IN")}`;
  };

  const resolveDriverName = (t: HistoryTripItem) => {
    if (typeof t.driverName === "string" && t.driverName.trim())
      return t.driverName;
    const dr = t.driver;
    if (!dr) return "—";
    if (typeof dr === "string") return dr;
    const first = dr.firstName ?? "";
    const last = dr.lastName ?? "";
    const nm = `${first} ${last}`.trim();
    return nm || "—";
  };

  const kmTravelledText = (t: HistoryTripItem) => {
    const s = Number(t.startKilometers);
    const e = Number(t.endKilometers);
    const hasS = Number.isFinite(s);
    const hasE = Number.isFinite(e);
    if (hasS && hasE) return `${Math.max(e - s, 0)} km travelled`;
    if (hasS) return `Start: ${s} km`;
    if (hasE) return `End: ${e} km`;
    return "—";
  };

  const pageNum =
    (pagination as any)?.current ?? (pagination as any)?.page ?? 1;
  const canPrev = pageNum > 1;
  const canNext =
    pagination?.pages != null ? pageNum < (pagination.pages ?? 1) : false;

  return (
    <ModalShell
      title={`Driver History — ${driverName(driver)}`}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 p-4">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="w-full sm:w-40">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value as any);
                  setPage(1);
                }}
                className={inputCls}
                style={{ paddingTop: 8, paddingBottom: 8 }}
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
                <option value="scheduled">Scheduled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="w-full sm:flex-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                From Date
              </label>
              <DatePicker
                value={startDate}
                onChange={(v) => {
                  setStartDate(v);
                  setPage(1);
                  if (v && endDate && new Date(endDate) < new Date(v))
                    setEndDate("");
                }}
                className={inputCls}
              />
            </div>

            <div className="w-full sm:flex-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                To Date
              </label>
              <DatePicker
                value={endDate}
                onChange={(v) => {
                  setEndDate(v);
                  setPage(1);
                  if (v && startDate && new Date(v) < new Date(startDate))
                    setStartDate("");
                }}
                className={inputCls}
              />
            </div>
          </div>

          {tripStats?.completed != null && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tripStats?.completed ?? 0} completed trips
            </p>
          )}
        </div>

        {financialStats && (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                Total Revenue
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {formatMoney0(financialStats.totalRevenue)}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Driver Salary
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {formatMoney0(financialStats.totalDriverSalary)}
              </div>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                Owner Revenue
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {formatMoney0(financialStats.ownerRevenue)}
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Trip Expense
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {formatMoney0(financialStats.totalExpenses)}
              </div>
            </div>
          </section>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
              >
                <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-white/10" />
                <div className="mt-3 h-3 w-2/3 rounded bg-slate-100 dark:bg-white/10" />
                <div className="mt-3 h-3 w-1/3 rounded bg-slate-100 dark:bg-white/10" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="py-6 text-center text-xs text-red-500 dark:text-red-400">
            {error}
          </p>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <History className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">
              No trip history found
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((t, idx) => {
              const offset = (pageNum - 1) * limit;
              const rowNumber = offset + idx + 1;
              const status = (t.status ?? "—").toString();
              return (
                <section
                  key={t._id}
                  className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0e121d]/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-[11px] font-bold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300">
                          {rowNumber}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {t.tripNumber ?? "—"}
                          </div>
                          <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                            {t.from && t.to ? `${t.from} → ${t.to}` : "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] capitalize ${statusBadgeCls(status)}`}
                    >
                      {status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      <div>Distance: {t.distance ?? "—"}</div>
                      <div className="mt-1 font-medium text-indigo-700 dark:text-indigo-300">
                        {kmTravelledText(t)}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      <div>
                        Date: {formatDate(t.startDate ?? t.departureDate)}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Car className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="truncate">
                          Vehicle: {resolveVehicleLabel(t)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <UserCheck className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="truncate">
                          Driver: {resolveDriverName(t)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                      <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                        Driver Salary
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                        {formatMoney0(t.driver_salary)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                      <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                        Trip Expense
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                        {formatMoney0(t.totalExpenses)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                      <div className="text-[11px] font-semibold text-indigo-800 dark:text-indigo-300">
                        Agency Profit
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                        {formatMoney0(t.agencyProfit || 0)}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {pagination && (pagination.pages ?? 1) > 1 && (
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => canPrev && setPage((p) => Math.max(1, p - 1))}
              disabled={!canPrev}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Prev
            </button>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Page {pageNum} of {pagination.pages ?? 1}
            </div>
            <button
              type="button"
              onClick={() => canNext && setPage((p) => p + 1)}
              disabled={!canNext}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
