import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  fetchCashInCashOutDriverDetail,
  type DriverCashInCashOutDetail,
} from "../../cash-in-cash-out/api";
import {
  fetchAgencies,
  addDriverPayoutPayment,
  type Agency,
} from "../../bulk-entry/api";
import { createSalaryTransaction } from "../api";

const PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "cheque",
  "online",
  "upi",
  "other",
] as const;

type PaymentKind = "pay" | "advance";

function fmtCurrency(v: number): string {
  return `₹${Math.abs(v).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function pickAgencyIdForDriverBulkPayout(
  detail: DriverCashInCashOutDetail,
  agencies: Agency[],
): string {
  const rows = detail.tables.bulkTripsAdvance.filter((r) => r.agencyId);
  if (rows.length > 0) {
    const counts = new Map<string, number>();
    for (const r of rows) {
      counts.set(r.agencyId, (counts.get(r.agencyId) ?? 0) + 1);
    }
    let best = rows[0].agencyId;
    let max = 0;
    for (const [id, c] of counts) {
      if (c > max) {
        max = c;
        best = id;
      }
    }
    return best;
  }
  const first = agencies[0];
  return first?._id ?? first?.id ?? "";
}

function driverTotalRemaining(detail: DriverCashInCashOutDetail): number {
  return (
    detail.summary.vehicleBata.remaining + detail.summary.bulkAdvance.remaining
  );
}

export type DriverPayModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  driverId: string;
  driverDisplayName: string;
  /** Month filter for CICO detail: `all_time` or `YYYY-MM` */
  detailMonth?: string;
  /** Skip refetch when parent already loaded detail */
  initialDetail?: DriverCashInCashOutDetail | null;
};

export function DriverPayModal({
  open,
  onClose,
  onSuccess,
  driverId,
  driverDisplayName,
  detailMonth = "all_time",
  initialDetail = null,
}: DriverPayModalProps) {
  const [detail, setDetail] = useState<DriverCashInCashOutDetail | null>(
    initialDetail,
  );
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [paymentKind, setPaymentKind] = useState<PaymentKind>("pay");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() =>
    new Date().toISOString().split("T")[0],
  );
  const [payMethod, setPayMethod] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [payMessage, setPayMessage] = useState<string | null>(null);
  const [paySaving, setPaySaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPaymentKind("pay");
    setPayAmount("");
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayMethod("cash");
    setPayNotes("");
    setPayMessage(null);
    setDetail(initialDetail);
  }, [open, driverId, initialDetail]);

  useEffect(() => {
    if (!open || !driverId) return;
    let cancelled = false;
    (async () => {
      setLoadingDetail(!initialDetail);
      try {
        const agenciesRes = await fetchAgencies(1, 200).catch(() => ({
          agencies: [] as Agency[],
          total: 0,
        }));
        if (!cancelled) setAgencies(agenciesRes.agencies ?? []);

        if (initialDetail) {
          if (!cancelled) setDetail(initialDetail);
        } else {
          const detailRes = await fetchCashInCashOutDriverDetail(
            driverId,
            detailMonth,
          );
          if (!cancelled) setDetail(detailRes);
        }
      } catch {
        if (!cancelled) setPayMessage("Could not load driver payment details.");
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, driverId, detailMonth, initialDetail]);

  const remainingToPay = useMemo(
    () => (detail ? driverTotalRemaining(detail) : 0),
    [detail],
  );

  const submitAdvance = async () => {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      setPayMessage("Enter a valid amount.");
      return;
    }
    setPaySaving(true);
    setPayMessage(null);
    try {
      await createSalaryTransaction(driverId, {
        type: "advance",
        amount: amt,
        date: payDate,
        notes: payNotes.trim() || "Advance payment",
      });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setPayMessage(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to record advance.",
      );
    } finally {
      setPaySaving(false);
    }
  };

  const submitPay = async () => {
    if (!detail) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      setPayMessage("Enter a valid amount.");
      return;
    }

    const bataRemaining = detail.summary.vehicleBata.remaining;
    const bulkRemaining = detail.summary.bulkAdvance.remaining;

    setPaySaving(true);
    setPayMessage(null);
    try {
      let left = amt;

      if (left > 0 && bataRemaining > 0) {
        const pay = Math.min(left, bataRemaining);
        await createSalaryTransaction(driverId, {
          type: "salary",
          amount: pay,
          date: payDate,
          notes: payNotes,
        });
        left -= pay;
      }

      if (left > 0 && bulkRemaining > 0) {
        const agencyId = pickAgencyIdForDriverBulkPayout(detail, agencies);
        if (!agencyId) {
          setPayMessage(
            "Could not record bulk advance: no agency available. Link a bulk trip to an agency first.",
          );
          return;
        }
        const pay = Math.min(left, bulkRemaining);
        await addDriverPayoutPayment(agencyId, {
          driverName: detail.driver.displayName || driverDisplayName,
          amount: pay,
          paymentDate: payDate,
          paymentMethod: payMethod,
          notes: payNotes,
        });
        left -= pay;
      }

      if (left > 0) {
        await createSalaryTransaction(driverId, {
          type: "salary",
          amount: left,
          date: payDate,
          notes: payNotes,
        });
      }

      onSuccess();
      onClose();
    } catch (e: unknown) {
      setPayMessage(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to record payment.",
      );
    } finally {
      setPaySaving(false);
    }
  };

  const handleSubmit = () => {
    if (paymentKind === "advance") submitAdvance();
    else submitPay();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className="flex max-h-[min(92dvh,100%)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="pr-2 text-sm font-semibold leading-snug text-slate-900 sm:text-base">
            Pay
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-5">
          {loadingDetail && !detail ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-slate-500">
                {paymentKind === "advance"
                  ? "Advance paid to driver. Reduces trip bata pending for this period."
                  : "Payment to driver: applied to bata (salary) first, then bulk advance payout."}
                {detail && (
                  <>
                    {" "}
                    {paymentKind === "advance" ? (
                      <>
                        Bata remaining:{" "}
                        <strong>
                          {fmtCurrency(detail.summary.vehicleBata.remaining)}
                        </strong>
                      </>
                    ) : (
                      <>
                        Remaining to pay:{" "}
                        <strong>{fmtCurrency(remainingToPay)}</strong>
                      </>
                    )}
                  </>
                )}
              </p>
              <fieldset className="block">
                <legend className="text-xs font-medium text-slate-600">
                  Type
                </legend>
                <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setPaymentKind("pay")}
                    className={`min-h-[40px] rounded-lg px-2 py-2 text-xs font-semibold sm:text-sm ${
                      paymentKind === "pay"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    Pay
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentKind("advance")}
                    className={`min-h-[40px] rounded-lg px-2 py-2 text-xs font-semibold sm:text-sm ${
                      paymentKind === "advance"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    Advance
                  </button>
                </div>
              </fieldset>
              <label className="mt-3 block text-xs font-medium text-slate-600">
                Amount (₹)
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  min={0}
                />
              </label>
              <label className="mt-3 block text-xs font-medium text-slate-600">
                Date
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </label>
              {paymentKind === "pay" && (
                <label className="mt-3 block text-xs font-medium text-slate-600">
                  Method
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="mt-3 block text-xs font-medium text-slate-600">
                Notes
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder={
                    paymentKind === "advance"
                      ? "e.g. Advance for trip"
                      : undefined
                  }
                />
              </label>
              {payMessage && (
                <p className="mt-2 text-xs text-red-600">{payMessage}</p>
              )}
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium sm:min-h-0 sm:w-auto sm:py-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={paySaving || loadingDetail}
                  onClick={handleSubmit}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-2"
                >
                  {paySaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
