import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Link2,
  Loader2,
  X,
  Ban,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import {
  createGuestBulkInvite,
  fetchGuestBulkInvites,
  fetchGuestBulkSubmissions,
  guestBulkShareUrl,
  revokeGuestBulkInvite,
  unrevokeGuestBulkInvite,
  updateGuestBulkInvite,
  type GuestBulkInvite,
  type GuestBulkSubmission,
} from "../api";

function toLocalInputValue(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function GuestInvitesPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  onAccepted?: () => void;
}) {
  const [tab, setTab] = useState<"invites" | "all">("invites");
  const [invites, setInvites] = useState<GuestBulkInvite[]>([]);
  const [subs, setSubs] = useState<GuestBulkSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inv, list] = await Promise.all([
        fetchGuestBulkInvites(),
        fetchGuestBulkSubmissions("accepted"),
      ]);
      setInvites(inv);
      setSubs(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  if (!open) return null;

  const openInNewTab = (inv: GuestBulkInvite) => {
    window.open(guestBulkShareUrl(inv.token), "_blank", "noopener,noreferrer");
  };

  const onCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const inv = await createGuestBulkInvite({
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim(),
        expiresInDays,
      });
      setDriverName("");
      setDriverPhone("");
      await refresh();
      setTab("invites");
      openInNewTab(inv);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : null;
      setError(msg || (e instanceof Error ? e.message : "Create failed"));
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (inv: GuestBulkInvite) => {
    const url = guestBulkShareUrl(inv.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  const openLink = (inv: GuestBulkInvite) => {
    openInNewTab(inv);
  };

  const onRevoke = async (id: string) => {
    setActionId(id);
    setError(null);
    try {
      await revokeGuestBulkInvite(id);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setActionId(null);
    }
  };

  const onUnrevoke = async (id: string) => {
    setActionId(id);
    setError(null);
    try {
      await unrevokeGuestBulkInvite(id);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unrevoke failed");
    } finally {
      setActionId(null);
    }
  };

  const onExpiryChange = async (id: string, localValue: string) => {
    if (!localValue) return;
    setActionId(id);
    setError(null);
    try {
      const iso = new Date(localValue).toISOString();
      await updateGuestBulkInvite(id, { expiresAt: iso });
      await refresh();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : null;
      setError(msg || (e instanceof Error ? e.message : "Update failed"));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Driver guest links
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Share with driver · autosaves · open same link to Approve
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-5 shrink-0">
          <button
            type="button"
            onClick={() => setTab("invites")}
            className={`px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === "invites"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-400"
            }`}
          >
            Links
          </button>
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === "all"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-400"
            }`}
          >
            Approved history
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          )}

          {!loading && tab === "invites" && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  New driver link
                </p>
                <p className="text-xs text-slate-500">
                  Optional name/phone now, or leave blank for the driver to
                  fill. Multi-agency · autosave · you Approve on the same page.
                </p>
                <input
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Driver name (optional)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <label className="text-sm text-slate-600 flex items-center gap-2">
                  Expires
                  <select
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                  >
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={creating}
                  onClick={onCreate}
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {creating ? "Creating…" : "Create & open in new tab"}
                </button>
              </div>

              {invites.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-4">
                  No links yet
                </p>
              ) : (
                <ul className="space-y-2">
                  {invites.map((inv) => {
                    const expired =
                      inv.expired ||
                      (inv.expiresAt &&
                        new Date(inv.expiresAt).getTime() < Date.now());
                    const revoked = inv.status === "revoked";
                    return (
                      <li
                        key={inv.id}
                        className="rounded-xl border border-slate-200 bg-white p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {inv.driverName || inv.label}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {inv.driverPhone
                                ? `${inv.driverPhone} · `
                                : ""}
                              {revoked
                                ? "Revoked (drivers blocked)"
                                : expired
                                  ? "Expired (drivers blocked)"
                                  : "Active for drivers"}
                              {(inv.draft?.openRowCount ?? 0) > 0
                                ? ` · ${inv.draft?.openRowCount} open rows`
                                : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              title="Open in new tab (owner always)"
                              onClick={() => openLink(inv)}
                              className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Copy link for driver"
                              onClick={() => copyLink(inv)}
                              className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                            >
                              {copiedId === inv.id ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                            {revoked ? (
                              <button
                                type="button"
                                title="Unrevoke — allow drivers again"
                                disabled={actionId === inv.id}
                                onClick={() => onUnrevoke(inv.id)}
                                className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                title="Revoke — block drivers"
                                disabled={actionId === inv.id}
                                onClick={() => onRevoke(inv.id)}
                                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="shrink-0">Expires</span>
                          <input
                            type="datetime-local"
                            disabled={actionId === inv.id}
                            defaultValue={toLocalInputValue(inv.expiresAt)}
                            key={`${inv.id}-${inv.expiresAt}`}
                            onBlur={(e) => {
                              const next = e.target.value;
                              const prev = toLocalInputValue(inv.expiresAt);
                              if (next && next !== prev) {
                                void onExpiryChange(inv.id, next);
                              }
                            }}
                            className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {!loading && tab === "all" && (
            <>
              {subs.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">
                  No approved entries yet
                </p>
              ) : (
                <ul className="space-y-3">
                  {subs.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <p className="text-sm font-semibold text-slate-800">
                        {s.guestName || "Driver"}
                        {s.guestPhone ? (
                          <span className="font-normal text-slate-500">
                            {" "}
                            · {s.guestPhone}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {s.agencyName || "Agency"} · {s.rowCount} row
                        {s.rowCount === 1 ? "" : "s"}
                        {s.acceptedAt
                          ? ` · ${new Date(s.acceptedAt).toLocaleString()}`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function GuestLinkButton({
  pendingCount,
  onClick,
}: {
  pendingCount?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Driver guest links"
      className="relative flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-600 transition shadow-sm shrink-0"
    >
      <Link2 className="h-4 w-4" />
      <span className="hidden sm:inline">Guest link</span>
      {(pendingCount ?? 0) > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
          {pendingCount}
        </span>
      )}
    </button>
  );
}
