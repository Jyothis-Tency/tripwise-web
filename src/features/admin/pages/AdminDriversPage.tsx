import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, Key, KeyRound, Loader2, Search } from "lucide-react";
import {
  fetchAdminDriverById,
  fetchAdminDrivers,
  type AdminDriver,
} from "../api";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>{label || "Copy"}</span>
        </>
      )}
    </button>
  );
}

function Field({
  label,
  value,
  mono,
  secret,
  defaultShow = true,
}: {
  label: string;
  value?: string | number | boolean | null;
  mono?: boolean;
  secret?: boolean;
  defaultShow?: boolean;
}) {
  const [show, setShow] = useState(defaultShow);
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : typeof value === "boolean"
        ? value
          ? "Yes"
          : "No"
        : String(value);

  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 flex items-center gap-2 break-all text-sm font-semibold text-slate-900 dark:text-slate-100">
        <span className={mono ? "font-mono text-[13px]" : undefined}>
          {secret && !show ? "••••••••" : display}
        </span>
        {secret && display !== "—" && (
          <div className="flex items-center gap-1">
            <CopyButton text={display} label="" />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="rounded p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              aria-label={show ? "Hide" : "Show"}
              title={show ? "Hide password" : "Show password"}
            >
              {show ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}
      </dd>
    </div>
  );
}

export function AdminDriversPage() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminDriver | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminDrivers({
        page: 1,
        limit: 100,
        search: q || undefined,
      });
      setDrivers(res.drivers);
      setTotal(res.pagination.total);
      if (!selectedId && res.drivers[0]) {
        setSelectedId(String(res.drivers[0]._id ?? res.drivers[0].id));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }, [q, selectedId]);

  useEffect(() => {
    void load();
  }, [q]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const d = await fetchAdminDriverById(selectedId);
        if (!cancelled) setDetail(d);
      } catch {
        const fromList = drivers.find(
          (dr) => String(dr._id ?? dr.id) === selectedId,
        );
        if (!cancelled) setDetail(fromList ?? null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, drivers]);

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <section className="flex w-full shrink-0 flex-col border-b border-slate-200 lg:w-[360px] lg:border-b-0 lg:border-r dark:border-[#1e2638]">
        <div className="border-b border-slate-200 p-4 dark:border-[#1e2638]">
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Drivers
          </h1>
          <p className="text-xs text-slate-500">{total} total</p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(search.trim());
            }}
          >
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-[var(--bg-main)] px-3 dark:border-[#1e2638]">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search driver, phone, email…"
                className="w-full border-0 bg-transparent py-2 text-sm outline-none dark:text-slate-100"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
            >
              Go
            </button>
          </form>
        </div>

        <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-[#1e2638]">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <p className="p-4 text-xs text-rose-500">{error}</p>
          ) : drivers.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">No drivers found.</p>
          ) : (
            drivers.map((d) => {
              const id = String(d._id ?? d.id);
              const active = id === selectedId;
              const name =
                d.name ||
                `${d.firstName || ""} ${d.lastName || ""}`.trim() ||
                "Driver";
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedId(id)}
                  className={`w-full text-left p-3.5 transition ${
                    active
                      ? "bg-indigo-50/90 dark:bg-indigo-500/15"
                      : "hover:bg-slate-50 dark:hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-bold text-slate-800 dark:text-slate-100">
                      {name}
                    </p>
                    {d.isActive && (
                      <span className="shrink-0 rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {d.phone || d.email}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">
                    {d.owner?.name || d.owner?.company || "Owner —"}
                  </p>

                  {/* Password badge in sidebar list */}
                  {d.password && (
                    <div className="mt-2 flex items-center justify-between gap-1.5 rounded-lg border border-teal-100 bg-white/80 px-2 py-1 dark:border-teal-900/40 dark:bg-slate-900/80">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Key className="h-3 w-3 shrink-0 text-teal-600 dark:text-teal-400" />
                        <span className="truncate font-mono text-[11px] font-bold text-teal-700 dark:text-teal-300">
                          {d.password}
                        </span>
                      </div>
                      <CopyButton text={d.password} />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="min-w-0 flex-1 overflow-y-auto p-5 sm:p-7">
        {!selectedId ? (
          <p className="text-sm text-slate-500">Select a driver</p>
        ) : detailLoading && !detail ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : detail ? (
          <div className="mx-auto max-w-2xl space-y-5">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {detail.name ||
                  `${detail.firstName || ""} ${detail.lastName || ""}`.trim()}
              </h2>
              <p className="text-sm text-slate-500">
                Under {detail.owner?.name || detail.owner?.company || "—"}
              </p>
            </div>

            {/* Prominent Credentials Card */}
            <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50/80 to-emerald-50/50 p-4 shadow-sm dark:border-teal-900/50 dark:from-teal-950/30 dark:to-emerald-950/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md shadow-teal-600/20">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                      Driver App Login Password
                    </p>
                    <p className="font-mono text-base font-black tracking-wide text-slate-900 dark:text-white">
                      {detail.password || "—"}
                    </p>
                  </div>
                </div>

                {detail.password && (
                  <CopyButton text={detail.password} label="Copy Password" />
                )}
              </div>
            </div>

            <dl className="grid gap-4 rounded-2xl border border-slate-200 bg-[var(--bg-card)] p-5 sm:grid-cols-2 dark:border-[#1e2638]">
              <Field label="First name" value={detail.firstName} />
              <Field label="Last name" value={detail.lastName} />
              <Field label="Email" value={detail.email} mono />
              <Field label="Phone" value={detail.phone} mono />
              <Field label="Password" value={detail.password} mono secret defaultShow={true} />
              <Field label="Place" value={detail.place} />
              <Field label="Active" value={detail.isActive} />
              <Field label="Blocked" value={detail.isBlocked} />
              <Field label="Owner" value={detail.owner?.name} />
              <Field label="Owner email" value={detail.owner?.email} mono />
              <Field label="Owner company" value={detail.owner?.company} />
              <Field
                label="Vehicle"
                value={detail.assignedVehicle?.vehicleNumber}
                mono
              />
              <Field
                label="Created"
                value={
                  detail.createdAt
                    ? new Date(detail.createdAt).toLocaleString("en-IN")
                    : null
                }
              />
              <Field label="Driver ID" value={detail._id ?? detail.id} mono />
            </dl>
          </div>
        ) : (
          <p className="text-sm text-rose-500">Could not load driver.</p>
        )}
      </section>
    </div>
  );
}
