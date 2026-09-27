import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight,
  Calculator,
  Car,
  CheckCircle2,
  MapPin,
  Navigation,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { AgencyNameCombobox } from "../../../components/AgencyNameCombobox";
import {
  createTrip,
  fetchDriversList,
  fetchVehicles,
  type DriverItem,
  type TripItem,
  type Vehicle,
} from "../../vehicles/api";
import { fetchAgencies, type Agency } from "../../bulk-entry/api";
import { computeAgencyProfitPreview } from "../../history/tripExpenseBreakdown";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-xs outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30";

function Field({
  label,
  id,
  required,
  optional,
  children,
  trailing,
}: {
  label: string;
  id: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-xs font-semibold text-slate-700 dark:text-slate-300"
        >
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
          {optional && (
            <span className="ml-1 font-normal text-slate-400">(optional)</span>
          )}
        </label>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function driverLabel(d: DriverItem): string {
  const name =
    d.name?.trim() ||
    `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() ||
    d.fullName?.trim() ||
    "Driver";
  return d.phone ? `${name} · ${d.phone}` : name;
}

function driverShortName(d: DriverItem): string {
  const name =
    d.name?.trim() ||
    `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() ||
    d.fullName?.trim() ||
    "Driver";
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 12);
  return `${parts[0]} ${parts[1][0]}.`;
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function CreateNewTripPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState<string | null>(null);

  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [agencyId, setAgencyId] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const [form, setForm] = useState({
    from: "",
    to: "",
    startDate: "",
    expectedEndDate: "",
    distance: "",
    customer: "",
    agencyName: "",
    agencyCost: "",
    cabCost: "",
    advance: "",
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTrip, setCreatedTrip] = useState<TripItem | null>(null);

  useEffect(() => {
    let active = true;
    setListsLoading(true);
    setListsError(null);
    Promise.all([
      fetchVehicles({ page: 1, limit: 500 }),
      fetchDriversList(),
      fetchAgencies(1, 8).catch(() => ({ agencies: [], total: 0 })),
    ])
      .then(([vRes, dList, aRes]) => {
        if (!active) return;
        setVehicles(vRes.items ?? []);
        setDrivers(dList);
        setAgencies(aRes.agencies ?? []);
      })
      .catch(() => {
        if (!active) return;
        setListsError(
          "Could not load vehicles or drivers. Refresh and try again.",
        );
      })
      .finally(() => {
        if (active) setListsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const vehicleTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of vehicles) {
      const t = (v.vehicleType || v.vehicleModel || "").trim();
      if (!t) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([type, count]) => ({ type, count }));
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    if (!typeFilter) return vehicles;
    const f = typeFilter.toLowerCase();
    return vehicles.filter((v) => {
      const t = (v.vehicleType || "").toLowerCase();
      const m = (v.vehicleModel || "").toLowerCase();
      return t === f || m === f || t.includes(f) || m.includes(f);
    });
  }, [vehicles, typeFilter]);

  useEffect(() => {
    if (
      vehicleId &&
      !filteredVehicles.some((v) => v._id === vehicleId)
    ) {
      setVehicleId("");
    }
  }, [filteredVehicles, vehicleId]);

  const set =
    (k: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const agencyNum = Number(form.agencyCost) || 0;
  const cabNum = Number(form.cabCost) || 0;
  const profitPreview = computeAgencyProfitPreview(
    form.agencyCost,
    form.cabCost,
  );
  const marginPct =
    agencyNum > 0 ? Math.round((profitPreview / agencyNum) * 1000) / 10 : null;
  const showProfit = agencyNum > 0 || cabNum > 0;

  const resetFormFields = useCallback(() => {
    setForm({
      from: "",
      to: "",
      startDate: "",
      expectedEndDate: "",
      distance: "",
      customer: "",
      agencyName: "",
      agencyCost: "",
      cabCost: "",
      advance: "",
      notes: "",
    });
    setDriverId("");
    setVehicleId("");
    setAgencyId(undefined);
    setTypeFilter(null);
    setError(null);
  }, []);

  const swapLocations = () => {
    setForm((prev) => ({ ...prev, from: prev.to, to: prev.from }));
  };

  const setStartRelative = (daysFromToday: number) => {
    const d = addDays(new Date(), daysFromToday);
    setForm((prev) => ({ ...prev, startDate: toDateInputValue(d) }));
  };

  const setEndRelative = (mode: "same" | "plus2") => {
    setForm((prev) => {
      const base = prev.startDate
        ? new Date(prev.startDate + "T12:00:00")
        : new Date();
      if (mode === "same") {
        return { ...prev, expectedEndDate: toDateInputValue(base) };
      }
      return {
        ...prev,
        expectedEndDate: toDateInputValue(addDays(base, 2)),
      };
    });
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (saving || listsLoading || listsError) return;
    if (!vehicleId) {
      setError("Select a vehicle.");
      return;
    }
    if (!form.from.trim() || !form.to.trim()) {
      setError("From and To locations are required");
      return;
    }
    if (!form.agencyName.trim()) {
      setError("Agency name is required");
      return;
    }
    if (
      form.startDate &&
      form.expectedEndDate &&
      form.expectedEndDate < form.startDate
    ) {
      setError("Expected end date cannot be before start date");
      return;
    }
    setSaving(true);
    setError(null);
    setCreatedTrip(null);
    try {
      const payload = {
        from: form.from.trim(),
        to: form.to.trim(),
        startDate: form.startDate || undefined,
        expectedEndDate: form.expectedEndDate || undefined,
        departureDate: form.startDate || undefined,
        distance: form.distance ? parseFloat(form.distance) : undefined,
        customer: form.customer.trim() || undefined,
        agencyName: form.agencyName.trim(),
        ...(agencyId ? { agencyId } : {}),
        agencyCost: form.agencyCost ? parseFloat(form.agencyCost) : undefined,
        cabCost: form.cabCost ? parseFloat(form.cabCost) : undefined,
        advance: form.advance ? parseFloat(form.advance) : undefined,
        amount: form.agencyCost ? parseFloat(form.agencyCost) : undefined,
        notes: form.notes.trim() || undefined,
      };
      const saved = await createTrip({
        vehicleId,
        driverId: driverId || undefined,
        ...payload,
      });
      setCreatedTrip(saved);
      resetFormFields();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to create trip");
    } finally {
      setSaving(false);
    }
  };

  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
        ev.preventDefault();
        void submitRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const chipBtn =
    "rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300";

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50/70 dark:bg-transparent">
      <header className="shrink-0 border-b border-slate-200/90 bg-white/95 px-4 py-4 backdrop-blur-md sm:px-5 lg:px-6 dark:border-white/10 dark:bg-[#0c0e15]/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              Create New Trip
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Changes to existing trips:{" "}
              <Link
                to="/vehicles"
                className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
              >
                Trip Details → Trip &amp; Driver
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs text-slate-500 shadow-xs dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
              <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
                Ctrl+Enter
              </kbd>
              <span>Save</span>
            </div>
            {createdTrip && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="min-w-0 font-medium leading-snug">
                  {createdTrip.tripNumber
                    ? `Trip #${createdTrip.tripNumber} created`
                    : "Trip created"}
                </span>
                <Link
                  to="/vehicles"
                  className="shrink-0 text-xs font-semibold text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300"
                >
                  View
                </Link>
                <button
                  type="button"
                  onClick={() => setCreatedTrip(null)}
                  className="shrink-0 rounded-lg p-1 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
        {listsLoading && (
          <div className="mx-auto max-w-7xl space-y-3 animate-fade-in">
            <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-white/5" />
            <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5" />
          </div>
        )}
        {listsError && (
          <p className="mx-auto max-w-7xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {listsError}
          </p>
        )}

        {!listsLoading && !listsError && (
          <form
            onSubmit={submit}
            className="mx-auto flex h-full min-h-0 max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-subtle dark:border-white/10 dark:bg-[#0e111a]/72 dark:backdrop-blur-xl"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
              {error && (
                <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 divide-y divide-slate-200/90 lg:grid-cols-2 lg:divide-x lg:divide-y-0 dark:divide-white/10">
                {/* Column 1 */}
                <section className="space-y-5 p-5 sm:p-6 lg:p-7">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                        <Navigation className="h-4 w-4" />
                      </div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                        Vehicle &amp; Route
                      </h2>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">
                      Step 1 of 2
                    </span>
                  </div>

                  {vehicleTypes.length > 1 && (
                    <div>
                      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Filter by type
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTypeFilter(null)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                            !typeFilter
                              ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300"
                              : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
                          }`}
                        >
                          All ({vehicles.length})
                        </button>
                        {vehicleTypes.map(({ type, count }) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() =>
                              setTypeFilter((t) => (t === type ? null : type))
                            }
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                              typeFilter === type
                                ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300"
                                : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
                            }`}
                          >
                            {type}{" "}
                            <span className="font-mono text-[10px] opacity-70">
                              {count}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Vehicle" id="c-vehicle" required>
                      <div className="relative">
                        <Car className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <select
                          id="c-vehicle"
                          required
                          value={vehicleId}
                          onChange={(e) => setVehicleId(e.target.value)}
                          className={`${inputCls} cursor-pointer pl-9`}
                        >
                          <option value="">Select vehicle…</option>
                          {filteredVehicles.map((v) => (
                            <option key={v._id} value={v._id}>
                              {v.vehicleNumber}
                              {v.vehicleModel ? ` — ${v.vehicleModel}` : ""}
                              {v.vehicleType ? ` (${v.vehicleType})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </Field>
                    <Field label="Driver" id="c-driver" optional>
                      <div className="relative">
                        <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <select
                          id="c-driver"
                          value={driverId}
                          onChange={(e) => setDriverId(e.target.value)}
                          className={`${inputCls} cursor-pointer pl-9`}
                        >
                          <option value="">Assign later</option>
                          {drivers.map((d) => (
                            <option key={d._id} value={d._id}>
                              {driverLabel(d)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </Field>
                  </div>

                  {drivers.length > 0 && (
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-white/10 dark:bg-white/5">
                      <p className="mb-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Quick assign driver
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {drivers.slice(0, 6).map((d) => (
                          <button
                            key={d._id}
                            type="button"
                            onClick={() => setDriverId(d._id)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                              driverId === d._id
                                ? "border-indigo-300 bg-indigo-50 font-semibold text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300"
                                : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                            }`}
                          >
                            {driverShortName(d)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="From" id="c-from" required>
                        <div className="relative">
                          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                          <input
                            id="c-from"
                            value={form.from}
                            onChange={set("from")}
                            required
                            className={`${inputCls} pl-9`}
                            placeholder="Origin"
                          />
                        </div>
                      </Field>
                      <Field label="To" id="c-to" required>
                        <div className="relative">
                          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-500" />
                          <input
                            id="c-to"
                            value={form.to}
                            onChange={set("to")}
                            required
                            className={`${inputCls} pl-9`}
                            placeholder="Destination"
                          />
                        </div>
                      </Field>
                    </div>
                    <div className="absolute left-1/2 top-[30px] z-10 hidden -translate-x-1/2 sm:flex">
                      <button
                        type="button"
                        onClick={swapLocations}
                        title="Swap origin and destination"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:border-indigo-400 hover:text-indigo-600 dark:border-white/15 dark:bg-[#161a29] dark:text-slate-300 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={swapLocations}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 sm:hidden dark:text-indigo-400"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" /> Swap From / To
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      label="Start date"
                      id="c-startdate"
                      trailing={
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className={chipBtn}
                            onClick={() => setStartRelative(0)}
                          >
                            Today
                          </button>
                          <button
                            type="button"
                            className={chipBtn}
                            onClick={() => setStartRelative(1)}
                          >
                            Tmrw
                          </button>
                        </div>
                      }
                    >
                      <input
                        id="c-startdate"
                        type="date"
                        value={form.startDate}
                        onChange={set("startDate")}
                        className={inputCls}
                      />
                    </Field>
                    <Field
                      label="Expected end date"
                      id="c-enddate"
                      trailing={
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className={chipBtn}
                            onClick={() => setEndRelative("same")}
                          >
                            Same day
                          </button>
                          <button
                            type="button"
                            className={chipBtn}
                            onClick={() => setEndRelative("plus2")}
                          >
                            +2 days
                          </button>
                        </div>
                      }
                    >
                      <input
                        id="c-enddate"
                        type="date"
                        value={form.expectedEndDate}
                        onChange={set("expectedEndDate")}
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Distance (km)" id="c-dist">
                      <input
                        id="c-dist"
                        type="number"
                        min={0}
                        value={form.distance}
                        onChange={set("distance")}
                        className={inputCls}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Customer" id="c-cus" optional>
                      <input
                        id="c-cus"
                        value={form.customer}
                        onChange={set("customer")}
                        className={inputCls}
                        placeholder="Name"
                      />
                    </Field>
                  </div>
                </section>

                {/* Column 2 */}
                <section className="space-y-5 p-5 sm:p-6 lg:p-7">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                        <Wallet className="h-4 w-4" />
                      </div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                        Agency &amp; Amounts
                      </h2>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">
                      Step 2 of 2
                    </span>
                  </div>

                  <Field label="Agency name" id="c-agn" required>
                    <AgencyNameCombobox
                      id="c-agn"
                      required
                      value={form.agencyName}
                      selectedAgencyId={agencyId}
                      onChange={(agencyName) => {
                        setAgencyId(undefined);
                        setForm((prev) => ({ ...prev, agencyName }));
                      }}
                      onAgencySelect={(agency) =>
                        setAgencyId(agency._id ?? agency.id)
                      }
                      inputClassName={inputCls}
                    />
                  </Field>

                  {agencies.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Recent
                      </span>
                      {agencies.slice(0, 5).map((a) => (
                        <button
                          key={a._id ?? a.id}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              agencyName: a.name,
                            }));
                            setAgencyId(a._id ?? a.id);
                          }}
                          className={chipBtn}
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Agency cost (₹)" id="c-agencyC">
                      <input
                        id="c-agencyC"
                        type="number"
                        step="0.01"
                        min={0}
                        value={form.agencyCost}
                        onChange={set("agencyCost")}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Cab cost (₹)" id="c-cabC">
                      <input
                        id="c-cabC"
                        type="number"
                        step="0.01"
                        min={0}
                        value={form.cabCost}
                        onChange={set("cabCost")}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Advance (₹)" id="c-advance">
                      <input
                        id="c-advance"
                        type="number"
                        step="0.01"
                        min={0}
                        value={form.advance}
                        onChange={set("advance")}
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  {showProfit && (
                    <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                      <Calculator className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                      <div>
                        <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">
                          Agency profit: ₹
                          {profitPreview.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          {marginPct != null && (
                            <span className="ml-2 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                              {marginPct}% margin
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-indigo-600/80 dark:text-indigo-300/70">
                          Agency cost − Cab cost
                        </p>
                      </div>
                    </div>
                  )}

                  <Field label="Notes" id="c-notes" optional>
                    <textarea
                      id="c-notes"
                      value={form.notes}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      className={`${inputCls} min-h-[72px] resize-y`}
                      rows={3}
                      placeholder="Anything the driver or office should know…"
                    />
                  </Field>
                </section>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 pb-safe sm:px-5 lg:px-6 dark:border-white/10 dark:bg-white/5">
              <Link
                to="/vehicles"
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving || !vehicleId || !form.agencyName.trim()}
                className="rounded-xl bg-indigo-600 px-8 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                {saving ? "Creating…" : "Create trip"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
