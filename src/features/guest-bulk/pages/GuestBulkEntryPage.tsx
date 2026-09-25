import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useParams } from "react-router-dom";
import {
  Building2,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Cloud,
  CloudOff,
  Copy,
  Check,
  Ban,
  RotateCcw,
} from "lucide-react";
import {
  approveGuestBulk,
  createGuestAgency,
  fetchGuestInvite,
  guestBulkShareUrl,
  newBlockClientId,
  revokeGuestBulkInvite,
  syncGuestBulk,
  unrevokeGuestBulkInvite,
  updateGuestBulkInvite,
  type GuestAgencyBlock,
  type GuestBulkInvite,
} from "../api";
import type { Agency, BulkTripRow, DriverGroup } from "../../bulk-entry/api";
import { formatAgencyLabel } from "../../bulk-entry/api";

type SyncStatus = "idle" | "saving" | "saved" | "error";
const AUTOSAVE_DELAY = 800;

let _rowCounter = 0;
function nextRowId() {
  return `r_${Date.now()}_${++_rowCounter}`;
}

function emptyRow(): BulkTripRow {
  return {
    clientRowId: nextRowId(),
    startDate: "",
    endDate: "",
    startKm: "",
    endKm: "",
    startTime: "",
    endTime: "",
    distance: 0,
    hours: 0,
    toll: 0,
    advancePaid: 0,
    grandTotal: 0,
    notes: "",
  };
}

function emptyVehicleGroup(): DriverGroup {
  return {
    driverName: "",
    driverPhone: "",
    vehicleNumber: "",
    rows: [emptyRow()],
  };
}

function emptyBlock(): GuestAgencyBlock {
  return {
    clientId: newBlockClientId(),
    agencyId: null,
    agencyName: "",
    driverGroups: [emptyVehicleGroup()],
    status: "open",
  };
}

function quickHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return `${s.length}_${h}`;
}

function SyncBadge({ status }: { status: SyncStatus }) {
  if (status === "idle") return null;
  const cfg = {
    saving: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      text: "Saving…",
      cls: "text-amber-600 bg-amber-50 border-amber-200",
    },
    saved: {
      icon: <Cloud className="h-4 w-4" />,
      text: "Saved",
      cls: "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
    error: {
      icon: <CloudOff className="h-4 w-4" />,
      text: "Offline",
      cls: "text-red-600 bg-red-50 border-red-200",
    },
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${cfg.cls}`}
    >
      {cfg.icon}
      {cfg.text}
    </span>
  );
}

function VehicleGroupsEditor({
  groups,
  onChange,
  readOnly,
}: {
  groups: DriverGroup[];
  onChange: Dispatch<SetStateAction<DriverGroup[]>>;
  readOnly?: boolean;
}) {
  const updateRowField = (
    gi: number,
    ri: number,
    field: string,
    type: "date" | "number" | "text",
    raw: string,
  ) => {
    onChange((prev) => {
      const next = [...prev];
      const rows = [...next[gi].rows];
      const val = type === "number" ? Number(raw) || 0 : raw;
      rows[ri] = { ...rows[ri], [field]: val };
      next[gi] = { ...next[gi], rows };
      return next;
    });
  };

  const fields = [
    ["startDate", "date", "Start date"],
    ["endDate", "date", "End date"],
    ["startKm", "text", "Start KM"],
    ["endKm", "text", "End KM"],
    ["toll", "number", "Toll"],
    ["advancePaid", "number", "Advance"],
    ["grandTotal", "number", "Total"],
    ["notes", "text", "Notes"],
  ] as const;

  return (
    <div className="space-y-3">
      {groups.map((g, gi) => (
        <div
          key={gi}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 bg-blue-50/50 px-3 py-2.5 sm:px-4 sm:py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
              {gi + 1}
            </span>
            <input
              value={g.vehicleNumber}
              disabled={readOnly}
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                onChange((prev) => {
                  const next = [...prev];
                  next[gi] = { ...next[gi], vehicleNumber: v };
                  return next;
                });
              }}
              placeholder="Vehicle number"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium disabled:bg-slate-50"
            />
            {!readOnly && groups.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => prev.filter((_, i) => i !== gi))
                }
                className="shrink-0 rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Remove vehicle"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Mobile: stacked trip cards */}
          <div className="space-y-3 p-3 md:hidden">
            {g.rows.map((r, ri) => (
              <div
                key={r.clientRowId}
                className="rounded-xl border border-slate-200 bg-slate-50/80 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Trip {ri + 1}
                  </span>
                  {!readOnly && g.rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange((prev) => {
                          const next = [...prev];
                          next[gi] = {
                            ...next[gi],
                            rows: next[gi].rows.filter((_, i) => i !== ri),
                          };
                          return next;
                        })
                      }
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-500"
                      aria-label="Remove trip"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {fields.map(([field, type, label]) => (
                    <label
                      key={field}
                      className={
                        field === "notes" || field === "grandTotal"
                          ? "col-span-2 block"
                          : "block"
                      }
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {label}
                      </span>
                      <input
                        disabled={readOnly}
                        type={
                          type === "date"
                            ? "date"
                            : type === "number"
                              ? "number"
                              : "text"
                        }
                        inputMode={
                          type === "number" ? "decimal" : undefined
                        }
                        value={
                          type === "number"
                            ? String((r as any)[field] || "")
                            : String((r as any)[field] ?? "")
                        }
                        onChange={(e) =>
                          updateRowField(gi, ri, field, type, e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-sm disabled:bg-slate-50"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="px-3 py-2 font-semibold">Start</th>
                  <th className="px-3 py-2 font-semibold">End</th>
                  <th className="px-3 py-2 font-semibold">Start KM</th>
                  <th className="px-3 py-2 font-semibold">End KM</th>
                  <th className="px-3 py-2 font-semibold">Toll</th>
                  <th className="px-3 py-2 font-semibold">Advance</th>
                  <th className="px-3 py-2 font-semibold">Total</th>
                  <th className="px-3 py-2 font-semibold">Notes</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, ri) => (
                  <tr key={r.clientRowId} className="border-b border-slate-50">
                    {fields.map(([field, type]) => (
                      <td key={field} className="px-2 py-1.5">
                        <input
                          disabled={readOnly}
                          type={
                            type === "date"
                              ? "date"
                              : type === "number"
                                ? "number"
                                : "text"
                          }
                          value={
                            type === "number"
                              ? String((r as any)[field] || "")
                              : String((r as any)[field] ?? "")
                          }
                          onChange={(e) =>
                            updateRowField(
                              gi,
                              ri,
                              field,
                              type,
                              e.target.value,
                            )
                          }
                          className="w-full min-w-[88px] rounded border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50"
                        />
                      </td>
                    ))}
                    <td className="px-2">
                      {!readOnly && g.rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            onChange((prev) => {
                              const next = [...prev];
                              next[gi] = {
                                ...next[gi],
                                rows: next[gi].rows.filter((_, i) => i !== ri),
                              };
                              return next;
                            })
                          }
                          className="text-red-300 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!readOnly && (
            <div className="border-t border-slate-50 px-3 py-2.5 sm:px-4">
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => {
                    const next = [...prev];
                    next[gi] = {
                      ...next[gi],
                      rows: [...next[gi].rows, emptyRow()],
                    };
                    return next;
                  })
                }
                className="w-full rounded-lg py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 hover:text-blue-700 sm:w-auto sm:py-1"
              >
                + Add row
              </button>
            </div>
          )}
        </div>
      ))}

      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange((prev) => [...prev, emptyVehicleGroup()])}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-600"
        >
          <Plus className="h-4 w-4" /> Add vehicle
        </button>
      )}
    </div>
  );
}

export function GuestBulkEntryPage() {
  const { token = "" } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<GuestBulkInvite | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [blocks, setBlocks] = useState<GuestAgencyBlock[]>([emptyBlock()]);
  const [isOwner, setIsOwner] = useState(false);

  const [showCreateFor, setShowCreateFor] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [ownerBusy, setOwnerBusy] = useState(false);

  const lastBackendHash = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const skipNextSync = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setLoadError("Invalid invite link");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await fetchGuestInvite(token);
        if (cancelled) return;
        setInvite(data);
        setIsOwner(Boolean(data.isOwner));
        setAgencies(data.agencies ?? []);
        setDriverName(data.driverName || "");
        setDriverPhone(data.driverPhone || "");
        const loaded = data.draft?.blocks?.length
          ? data.draft.blocks
          : [emptyBlock()];
        setBlocks(loaded);
        skipNextSync.current = true;
        lastBackendHash.current = quickHash(
          JSON.stringify({
            driverName: data.driverName || "",
            driverPhone: data.driverPhone || "",
            blocks: loaded,
          }),
        );
      } catch (e: unknown) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Failed to load invite",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const syncPayload = useMemo(
    () => ({
      driverName,
      driverPhone,
      blocks: blocks.map((b) => ({
        clientId: b.clientId,
        agencyId: b.agencyId ?? null,
        agencyName: b.agencyName,
        driverGroups: b.driverGroups,
        status: b.status,
      })),
    }),
    [driverName, driverPhone, blocks],
  );

  // Autosave (like Bulk Entry) — no submit button
  useEffect(() => {
    if (!token || !invite || loading) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }

    const json = JSON.stringify(syncPayload);
    const hash = quickHash(json);
    if (hash === lastBackendHash.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      setSyncStatus("saving");
      try {
        const openBlocks = syncPayload.blocks
          .filter((b) => b.status !== "accepted")
          .map((b) => ({
            clientId: b.clientId,
            agencyId: b.agencyId,
            agencyName: b.agencyName,
            driverGroups: b.driverGroups,
          }));
        // Include accepted blocks by clientId so server keeps them (sync merges)
        const accepted = syncPayload.blocks.filter(
          (b) => b.status === "accepted",
        );
        const data = await syncGuestBulk(token, {
          driverName: syncPayload.driverName,
          driverPhone: syncPayload.driverPhone,
          blocks: [
            ...openBlocks,
            ...accepted.map((b) => ({
              clientId: b.clientId,
              agencyId: b.agencyId,
              agencyName: b.agencyName,
              driverGroups: b.driverGroups,
            })),
          ],
        });
        if (!mountedRef.current) return;
        lastBackendHash.current = hash;
        setSyncStatus("saved");
        if (data.draft?.blocks) {
          // Don't overwrite local typing if user kept editing — only refresh accepted flags
          setBlocks((prev) => {
            const serverMap = new Map(
              data.draft!.blocks.map((b) => [b.clientId, b]),
            );
            return prev.map((b) => {
              const s = serverMap.get(b.clientId);
              if (s?.status === "accepted") return s;
              return b;
            });
          });
        }
        setTimeout(() => {
          if (mountedRef.current) setSyncStatus("idle");
        }, 2000);
      } catch {
        if (mountedRef.current) setSyncStatus("error");
      }
    }, AUTOSAVE_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [token, invite, loading, syncPayload]);

  const updateBlock = (clientId: string, patch: Partial<GuestAgencyBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.clientId === clientId ? { ...b, ...patch } : b)),
    );
  };

  const onCreateAgency = async () => {
    if (!token || !showCreateFor) return;
    setCreating(true);
    setApproveError(null);
    try {
      const agency = await createGuestAgency(token, newName, newPhone);
      setAgencies((prev) => [...prev, agency]);
      updateBlock(showCreateFor, {
        agencyId: agency._id ?? agency.id ?? null,
        agencyName: agency.name,
      });
      setShowCreateFor(null);
      setNewName("");
      setNewPhone("");
    } catch (e: unknown) {
      setApproveError(
        e instanceof Error ? e.message : "Failed to create agency",
      );
    } finally {
      setCreating(false);
    }
  };

  const onApprove = async (clientId?: string) => {
    if (!token) return;
    setApproveError(null);
    setApproving(clientId ?? "__all__");
    try {
      const data = await approveGuestBulk(
        token,
        clientId ? { clientId } : { all: true },
      );
      skipNextSync.current = true;
      if (data.draft?.blocks) setBlocks(data.draft.blocks);
      setInvite((prev) => (prev ? { ...prev, ...data } : data));
      lastBackendHash.current = quickHash(
        JSON.stringify({
          driverName: data.driverName || driverName,
          driverPhone: data.driverPhone || driverPhone,
          blocks: data.draft?.blocks ?? blocks,
        }),
      );
    } catch (e: unknown) {
      setApproveError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setApproving(null);
    }
  };

  const copyShareLink = async () => {
    if (!token) return;
    const url = guestBulkShareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  const applyInviteUpdate = (data: GuestBulkInvite) => {
    setInvite((prev) => (prev ? { ...prev, ...data } : data));
  };

  const onToggleRevoke = async () => {
    if (!invite?.id) return;
    setOwnerBusy(true);
    setApproveError(null);
    try {
      const data =
        invite.status === "revoked"
          ? await unrevokeGuestBulkInvite(invite.id)
          : await revokeGuestBulkInvite(invite.id);
      applyInviteUpdate(data);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : null;
      setApproveError(msg || (e instanceof Error ? e.message : "Update failed"));
    } finally {
      setOwnerBusy(false);
    }
  };

  const onOwnerExpiryChange = async (localValue: string) => {
    if (!invite?.id || !localValue) return;
    setOwnerBusy(true);
    setApproveError(null);
    try {
      const data = await updateGuestBulkInvite(invite.id, {
        expiresAt: new Date(localValue).toISOString(),
      });
      applyInviteUpdate(data);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : null;
      setApproveError(msg || (e instanceof Error ? e.message : "Update failed"));
    } finally {
      setOwnerBusy(false);
    }
  };

  const toLocalInputValue = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openBlocks = blocks.filter((b) => b.status !== "accepted");
  const canApproveAll = openBlocks.some(
    (b) =>
      (b.agencyId || b.agencyName) &&
      b.driverGroups.some(
        (g) => g.vehicleNumber.trim() && (g.rows?.length ?? 0) > 0,
      ),
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (loadError || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-100 bg-white p-6 shadow-sm text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-slate-800">Link unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">{loadError}</p>
        </div>
      </div>
    );
  }

  const expiresLabel = invite.expiresAt
    ? new Date(invite.expiresAt).toLocaleString()
    : "";

  return (
    <div className="min-h-screen bg-slate-50 pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/90 sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-5xl flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
              {isOwner
                ? "Tripware · owner review"
                : "Tripware · driver entry"}
            </p>
            <h1 className="truncate text-base font-bold leading-snug text-slate-800 sm:text-lg">
              {invite.label}
            </h1>
            {expiresLabel && (
              <p className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">
                Expires {expiresLabel}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SyncBadge status={syncStatus} />
            <button
              type="button"
              onClick={copyShareLink}
              title="Copy share link"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:border-blue-300 hover:text-blue-600 sm:text-sm"
            >
              {linkCopied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="sm:hidden">
                {linkCopied ? "Copied" : "Link"}
              </span>
              <span className="hidden sm:inline">
                {linkCopied ? "Copied" : "Copy link"}
              </span>
            </button>
            {isOwner && (
              <button
                type="button"
                disabled={ownerBusy}
                onClick={onToggleRevoke}
                title={
                  invite.status === "revoked"
                    ? "Unrevoke — allow drivers"
                    : "Revoke — block drivers"
                }
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm disabled:opacity-60 sm:text-sm ${
                  invite.status === "revoked"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-red-200 bg-white text-red-600 hover:bg-red-50"
                }`}
              >
                {invite.status === "revoked" ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                <span>
                  {invite.status === "revoked" ? "Unrevoke" : "Revoke"}
                </span>
              </button>
            )}
            {isOwner && canApproveAll && (
              <button
                type="button"
                disabled={Boolean(approving)}
                onClick={() => onApprove()}
                className="min-h-10 flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 sm:flex-none"
              >
                {approving === "__all__" ? "Approving…" : "Approve all"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-3 p-3 sm:space-y-4 sm:p-6">
        {isOwner && (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800 sm:rounded-lg sm:px-4">
            <p className="text-xs leading-relaxed sm:text-sm">
              You are viewing this as the owner. Edits still autosave. Use{" "}
              <strong>Approve</strong> to merge into Bulk Entry. You can open
              this link anytime — even if revoked or expired.
            </p>
            {(invite.status === "revoked" || invite.expired) && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {invite.status === "revoked"
                  ? "Revoked — drivers cannot open this link."
                  : "Expired — drivers cannot open this link."}{" "}
                Unrevoke / extend expiry to restore driver access.
              </p>
            )}
            <label className="flex flex-col gap-1.5 text-xs text-emerald-900 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
              <span className="font-semibold">Expires</span>
              <input
                type="datetime-local"
                disabled={ownerBusy}
                key={invite.expiresAt}
                defaultValue={toLocalInputValue(invite.expiresAt)}
                onBlur={(e) => {
                  const next = e.target.value;
                  const prev = toLocalInputValue(invite.expiresAt);
                  if (next && next !== prev) void onOwnerExpiryChange(next);
                }}
                className="w-full rounded-lg border border-emerald-200 bg-white px-2 py-2 text-xs text-slate-700 sm:w-auto sm:py-1.5"
              />
            </label>
          </div>
        )}

        {approveError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 sm:px-4">
            {approveError}
          </div>
        )}

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Driver details
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">
                Name *
              </span>
              <input
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                placeholder="Driver name"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Phone</span>
              <input
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                inputMode="tel"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                placeholder="Mobile number"
              />
            </label>
          </div>
        </div>

        {blocks.map((block, bi) => {
          const accepted = block.status === "accepted";
          return (
            <section
              key={block.clientId}
              className={`space-y-3 rounded-2xl border p-3 sm:p-5 ${
                accepted
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                  <h2 className="text-sm font-bold text-slate-800">
                    Agency {bi + 1}
                  </h2>
                  {accepted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> Approved
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isOwner && !accepted && (
                    <button
                      type="button"
                      disabled={Boolean(approving)}
                      onClick={() => onApprove(block.clientId)}
                      className="min-h-9 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {approving === block.clientId ? "…" : "Approve"}
                    </button>
                  )}
                  {!accepted && blocks.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setBlocks((prev) =>
                          prev.filter((b) => b.clientId !== block.clientId),
                        )
                      }
                      className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove agency"
                      aria-label="Remove agency"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {!accepted ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <select
                    value={block.agencyId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      const a = agencies.find((x) => (x._id ?? x.id) === id);
                      updateBlock(block.clientId, {
                        agencyId: id || null,
                        agencyName: a?.name ?? "",
                      });
                    }}
                    className="min-h-11 w-full min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm sm:min-w-[180px]"
                  >
                    <option value="">Select agency…</option>
                    {agencies.map((a) => (
                      <option key={a._id ?? a.id} value={a._id ?? a.id}>
                        {formatAgencyLabel(a)}
                      </option>
                    ))}
                  </select>
                  {invite.allowCreateAgency && (
                    <button
                      type="button"
                      onClick={() => setShowCreateFor(block.clientId)}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 sm:w-auto"
                    >
                      <Plus className="h-4 w-4" /> New agency
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm font-medium text-slate-700">
                  {block.agencyName || "Agency"}
                </p>
              )}

              <VehicleGroupsEditor
                groups={block.driverGroups}
                readOnly={accepted}
                onChange={(updater) => {
                  setBlocks((prev) =>
                    prev.map((b) => {
                      if (b.clientId !== block.clientId) return b;
                      const nextGroups =
                        typeof updater === "function"
                          ? updater(b.driverGroups)
                          : updater;
                      return { ...b, driverGroups: nextGroups };
                    }),
                  );
                }}
              />
            </section>
          );
        })}

        <button
          type="button"
          onClick={() => setBlocks((prev) => [...prev, emptyBlock()])}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-600"
        >
          <Plus className="h-4 w-4" /> Add another agency
        </button>

        <p className="pb-8 text-center text-xs text-slate-400">
          Autosaves as you type · no submit needed
          {invite.maxRows ? ` · max ${invite.maxRows} rows` : ""}
        </p>
      </main>

      {showCreateFor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={(e) =>
            e.target === e.currentTarget && setShowCreateFor(null)
          }
        >
          <div className="w-full max-w-md space-y-4 rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
            <h3 className="text-base font-semibold text-slate-900">
              New agency
            </h3>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Agency name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone (10+ digits)"
              inputMode="tel"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            />
            <div className="flex gap-2 pb-[env(safe-area-inset-bottom)] sm:pb-0">
              <button
                type="button"
                onClick={() => setShowCreateFor(null)}
                className="min-h-11 flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={onCreateAgency}
                className="min-h-11 flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
