import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Loader2,
  User,
  Wallet,
} from "lucide-react";
import {
  fetchAgencies,
  fetchDrivers,
  fetchCashInCashOutAgencyDetail,
  fetchCashInCashOutDriverDetail,
  addAgencyPayoutPayment,
  addDriverPayoutPayment,
  recordAgencyProfitPayout,
  createSalaryTransaction,
  type Agency,
  type Driver,
  type DriverCashInCashOutDetail,
} from "../api";
import { FilterLabel, SearchInput } from "../components/FilterControls";

type EntityType = "agency" | "driver";
type CashKind = "cash_in" | "cash_out";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "online", label: "Online" },
  { value: "upi", label: "UPI" },
  { value: "other", label: "Other" },
] as const;

const fieldCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function driverDisplayName(d: Driver) {
  const full = (d as { fullName?: string }).fullName?.trim();
  if (full) return full;
  return `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || "Driver";
}

function fmtCurrency(n: number) {
  return `₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;
}

function fmtSignedCurrency(n: number) {
  if (n < 0) return `−${fmtCurrency(n)}`;
  if (n > 0) return `+${fmtCurrency(n)}`;
  return fmtCurrency(n);
}

function pickAgencyIdForDriverBulkPayout(
  detail: DriverCashInCashOutDetail,
  agencies: Agency[],
): string | null {
  const fromTrips = detail.tables.bulkTripsAdvance.find((t) => t.agencyId);
  if (fromTrips?.agencyId) return fromTrips.agencyId;
  const fromPay = detail.tables.bulkAdvancePayouts.find((t) => t.agencyId);
  if (fromPay?.agencyId) return fromPay.agencyId;
  return agencies[0]?._id ?? agencies[0]?.id ?? null;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <FilterLabel>{children}</FilterLabel>;
}

function BalanceStat({
  label,
  value,
  loading,
  tone = "neutral",
}: {
  label: string;
  value: number | null;
  loading: boolean;
  tone?: "neutral" | "remaining";
}) {
  const positive = (value ?? 0) >= 0;
  const valueCls =
    tone === "remaining"
      ? positive
        ? "text-emerald-600"
        : "text-amber-600"
      : "text-slate-800";

  return (
    <div className="text-right">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      {loading || value == null ? (
        <div className="mt-0.5 flex h-5 items-center justify-end">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
        </div>
      ) : (
        <p className={`mt-0.5 text-sm font-bold tabular-nums leading-none ${valueCls}`}>
          {tone === "remaining" ? fmtSignedCurrency(value) : fmtCurrency(value)}
        </p>
      )}
    </div>
  );
}

export function TransactionPage() {
  const [entityType, setEntityType] = useState<EntityType>("agency");
  const [nameQuery, setNameQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [cashKind, setCashKind] = useState<CashKind>("cash_in");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [grandTotal, setGrandTotal] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const [a, d] = await Promise.all([
        fetchAgencies(1, 200),
        fetchDrivers({ page: 1, limit: 200, blockFilter: "unblocked" }),
      ]);
      setAgencies(a.agencies);
      setDrivers(d.drivers);
    } catch {
      setMessage("Failed to load agencies / drivers.");
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    setSelectedId("");
    setNameQuery("");
    setMessage(null);
    setSuccess(false);
    setGrandTotal(null);
    setRemaining(null);
    setCashKind(entityType === "driver" ? "cash_out" : "cash_in");
  }, [entityType]);

  const loadBalance = useCallback(
    async (id: string, type: EntityType) => {
      if (!id) {
        setGrandTotal(null);
        setRemaining(null);
        return;
      }
      setBalanceLoading(true);
      try {
        if (type === "agency") {
          const detail = await fetchCashInCashOutAgencyDetail(id, "all_time");
          const bulk = Number(detail.summary.cashInBulk.fromTrips) || 0;
          const vehicle =
            Number(detail.summary.cashOutAgencyProfit.fromTrips) || 0;
          // Same as History: Grand Total = bulk (+) − vehicle (−)
          setGrandTotal(bulk - vehicle);
          setRemaining(
            detail.summary.cashInBulk.remaining -
              detail.summary.cashOutAgencyProfit.remaining,
          );
        } else {
          const detail = await fetchCashInCashOutDriverDetail(id, "all_time");
          setGrandTotal(
            (Number(detail.summary.bulkAdvance.fromTrips) || 0) +
              (Number(detail.summary.vehicleBata.fromTrips) || 0),
          );
          setRemaining(
            detail.summary.vehicleBata.remaining +
              detail.summary.bulkAdvance.remaining,
          );
        }
      } catch {
        setGrandTotal(null);
        setRemaining(null);
      } finally {
        setBalanceLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedId) {
      setGrandTotal(null);
      setRemaining(null);
      return;
    }
    loadBalance(selectedId, entityType);
  }, [selectedId, entityType, loadBalance]);

  const nameOptions = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    if (entityType === "agency") {
      return agencies
        .map((a) => ({
          id: a._id ?? a.id ?? "",
          label: a.name,
          sub: a.phone || "Agency",
        }))
        .filter((o) => o.id && (!q || o.label.toLowerCase().includes(q)));
    }
    return drivers
      .map((d) => ({
        id: d._id,
        label: driverDisplayName(d),
        sub: d.phone || "Driver",
      }))
      .filter(
        (o) =>
          o.id &&
          (!q ||
            o.label.toLowerCase().includes(q) ||
            o.sub.toLowerCase().includes(q)),
      );
  }, [entityType, agencies, drivers, nameQuery]);

  const selected = nameOptions.find((o) => o.id === selectedId);

  const directionHint =
    entityType === "agency"
      ? cashKind === "cash_in"
        ? "Money received from agency"
        : "Money paid to agency"
      : cashKind === "cash_in"
        ? "Advance given to driver"
        : "Salary / bata payment to driver";

  const submit = async () => {
    setMessage(null);
    setSuccess(false);
    const amt = Number(amount);
    if (!selectedId) {
      setMessage(
        `Select ${entityType === "agency" ? "an agency" : "a driver"}.`,
      );
      return;
    }
    if (!amt || amt <= 0) {
      setMessage("Enter a valid amount.");
      return;
    }

    setSaving(true);
    try {
      if (entityType === "agency") {
        if (cashKind === "cash_in") {
          await addAgencyPayoutPayment(selectedId, {
            amount: amt,
            paymentDate: date,
            paymentMethod: method,
            notes,
          });
        } else {
          await recordAgencyProfitPayout(selectedId, {
            amount: amt,
            paymentDate: date,
            paymentMethod: method,
            notes,
          });
        }
      } else if (cashKind === "cash_in") {
        await createSalaryTransaction(selectedId, {
          type: "advance",
          amount: amt,
          date,
          notes: notes.trim() || "Advance",
        });
      } else {
        const detail = await fetchCashInCashOutDriverDetail(selectedId);
        let left = amt;
        const bataRemaining = detail.summary.vehicleBata.remaining;
        const bulkRemaining = detail.summary.bulkAdvance.remaining;
        const maxPayable = bataRemaining + bulkRemaining;

        if (amt > maxPayable + 0.01) {
          throw new Error(
            `Amount exceeds payable balance (₹${maxPayable.toLocaleString("en-IN")}). Bata ₹${bataRemaining.toLocaleString("en-IN")} + bulk advance ₹${bulkRemaining.toLocaleString("en-IN")}.`,
          );
        }

        // Waterfall: vehicle bata first, then bulk advance payout (matches CICO).
        if (left > 0 && bataRemaining > 0) {
          const pay = Math.min(left, bataRemaining);
          await createSalaryTransaction(selectedId, {
            type: "salary",
            amount: pay,
            date,
            notes,
          });
          left -= pay;
        }

        if (left > 0 && bulkRemaining > 0) {
          const agencyId = pickAgencyIdForDriverBulkPayout(detail, agencies);
          if (!agencyId) {
            throw new Error(
              "Could not record advance payout: no agency linked. Link a trip to an agency first.",
            );
          }
          const pay = Math.min(left, bulkRemaining);
          await addDriverPayoutPayment(agencyId, {
            driverName: detail.driver.displayName,
            amount: pay,
            paymentDate: date,
            paymentMethod: method,
            notes,
          });
          left -= pay;
        }
      }

      setSuccess(true);
      setAmount("");
      setNotes("");
      setMessage("Transaction recorded successfully.");
      if (selectedId) loadBalance(selectedId, entityType);
    } catch (e: unknown) {
      const msg =
        (e as { message?: string })?.message ||
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
        "Failed to record transaction.";
      setMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 py-4 sm:px-6 sm:py-5">
        <div className="mb-4 flex shrink-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Transaction</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Record cash in or cash out for an agency or driver.
            </p>
          </div>
        </div>

        {loadingLists ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
          </div>
        ) : (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-slate-800">
                Record transaction
              </h2>
              <p className="text-xs text-slate-400">
                {selected
                  ? `Party: ${selected.label}`
                  : "Choose a party, then enter payment details"}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 md:gap-8">
                {/* Party */}
                <div className="flex min-h-0 flex-col gap-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Party
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Choose agency or driver
                    </p>
                  </div>

                  <div
                    className="grid shrink-0 grid-cols-2 rounded-full border border-slate-200 bg-slate-100 p-1"
                    role="tablist"
                  >
                    {(
                      [
                        ["agency", "Agency", Building2],
                        ["driver", "Driver", User],
                      ] as const
                    ).map(([id, label, Icon]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={entityType === id}
                        onClick={() => setEntityType(id)}
                        className={`flex h-9 items-center justify-center gap-2 rounded-full text-sm font-semibold transition ${
                          entityType === id
                            ? "bg-white text-blue-600 shadow-sm"
                            : "bg-transparent text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="shrink-0">
                    <FieldLabel>
                      Search {entityType === "agency" ? "agency" : "driver"}
                    </FieldLabel>
                    <SearchInput
                      value={nameQuery}
                      onChange={setNameQuery}
                      placeholder="Search by name or phone…"
                      resultCount={nameOptions.length}
                    />
                  </div>

                  <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/70 p-1.5 md:max-h-none md:min-h-[16rem] md:flex-1">
                    {nameOptions.length === 0 ? (
                      <p className="px-3 py-8 text-center text-xs text-slate-400">
                        No matches
                      </p>
                    ) : (
                      nameOptions.map((o) => {
                        const sel = o.id === selectedId;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => setSelectedId(o.id)}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                              sel
                                ? "border border-blue-300 bg-blue-50 shadow-sm"
                                : "border border-transparent bg-white hover:border-slate-200"
                            }`}
                          >
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                entityType === "agency"
                                  ? "bg-blue-100 text-blue-600"
                                  : "bg-violet-100 text-violet-600"
                              }`}
                            >
                              {entityType === "agency" ? (
                                <Building2 className="h-4 w-4" />
                              ) : (
                                <User className="h-4 w-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {o.label}
                              </p>
                              <p className="truncate text-xs text-slate-400">
                                {o.sub}
                              </p>
                            </div>
                            {sel && (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-500" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Payment */}
                <div className="flex flex-col gap-4 border-t border-slate-100 pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Payment
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {selected
                          ? `For ${selected.label}`
                          : "Select a party first"}
                      </p>
                    </div>
                    {selectedId && (
                      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                        <BalanceStat
                          label="Grand Total"
                          value={grandTotal}
                          loading={balanceLoading}
                        />
                        <div
                          className="h-8 w-px bg-slate-200"
                          aria-hidden
                        />
                        <BalanceStat
                          label="Remaining"
                          value={remaining}
                          loading={balanceLoading}
                          tone="remaining"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <FieldLabel>Direction</FieldLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {entityType === "agency" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setCashKind("cash_in")}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                              cashKind === "cash_in"
                                ? "border-emerald-400 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            <ArrowDownLeft className="h-4 w-4" />
                            Cash In
                          </button>
                          <button
                            type="button"
                            onClick={() => setCashKind("cash_out")}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                              cashKind === "cash_out"
                                ? "border-amber-400 bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            <ArrowUpRight className="h-4 w-4" />
                            Cash Out
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setCashKind("cash_out")}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                              cashKind === "cash_out"
                                ? "border-amber-400 bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            <ArrowUpRight className="h-4 w-4" />
                            Cash Out
                          </button>
                          <button
                            type="button"
                            onClick={() => setCashKind("cash_in")}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                              cashKind === "cash_in"
                                ? "border-sky-400 bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            <Wallet className="h-4 w-4" />
                            Advance
                          </button>
                        </>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{directionHint}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <FieldLabel>Amount (₹)</FieldLabel>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        className={fieldCls}
                      />
                    </div>
                    <div>
                      <FieldLabel>Date</FieldLabel>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className={fieldCls}
                      />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Method</FieldLabel>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      className={fieldCls}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Notes</FieldLabel>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Optional note…"
                      className={`${fieldCls} resize-none`}
                    />
                  </div>

                  {message && (
                    <div
                      className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${
                        success
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                    >
                      {success && (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <span>{message}</span>
                    </div>
                  )}

                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={saving || !selectedId}
                      onClick={submit}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        "Save Transaction"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
