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
  Users,
  ChevronDown,
  ChevronUp,
  KeyRound,
} from "lucide-react";
import {
  blockGuestLinkUser,
  createGuestBulkInvite,
  fetchGuestBulkInvites,
  fetchGuestBulkSubmissions,
  fetchGuestLinkUsers,
  guestBulkShareUrl,
  revokeGuestBulkInvite,
  rotateGuestBulkInviteToken,
  unblockGuestLinkUser,
  unrevokeGuestBulkInvite,
  updateGuestBulkInvite,
  type GuestBulkInvite,
  type GuestBulkSubmission,
  type GuestLinkUser,
} from "../api";
import { fetchAllAgencies, type Agency } from "../../bulk-entry/api";
import { DateTimePicker } from "../../../components/ui/DateTimePicker";

function toLocalInputValue(iso?: string | null) {
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

  const [agencyId, setAgencyId] = useState("");
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [expiresInDays, setExpiresInDays] = useState(0);
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [usersByInvite, setUsersByInvite] = useState<
    Record<string, GuestLinkUser[]>
  >({});
  const [usersLoadingId, setUsersLoadingId] = useState<string | null>(null);

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
    if (!open) return;
    refresh();
    void (async () => {
      try {
        const { agencies: list } = await fetchAllAgencies();
        setAgencies(list);
      } catch {
        /* optional for agency links */
      }
    })();
  }, [open, refresh]);

  if (!open) return null;

  const pendingOnLinks = invites.reduce(
    (n, inv) => n + (inv.pendingSubmissions ?? 0),
    0,
  );

  const openInNewTab = (inv: GuestBulkInvite) => {
    window.open(guestBulkShareUrl(inv.token), "_blank", "noopener,noreferrer");
  };

  const apiErr = (e: unknown, fallback: string) => {
    const msg =
      e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { message?: string } } }).response?.data
            ?.message
        : null;
    return msg || (e instanceof Error ? e.message : fallback);
  };

  const onCreate = async () => {
    if (!agencyId) {
      setError("Select an agency for the shared link");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const inv = await createGuestBulkInvite({
        scope: "agency",
        agencyId,
        ...(expiresInDays > 0 ? { expiresInDays } : {}),
      });
      setAgencyId("");
      await refresh();
      setTab("invites");
      openInNewTab(inv);
    } catch (e: unknown) {
      setError(apiErr(e, "Create failed"));
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

  const onRotate = async (id: string) => {
    if (
      !window.confirm(
        "Rotate URL? The old link stops working. Active users must get the new link.",
      )
    ) {
      return;
    }
    setActionId(id);
    setError(null);
    try {
      const inv = await rotateGuestBulkInviteToken(id);
      await refresh();
      openInNewTab(inv);
    } catch (e: unknown) {
      setError(apiErr(e, "Rotate failed"));
    } finally {
      setActionId(null);
    }
  };

  const toggleUsers = async (inv: GuestBulkInvite) => {
    if (expandedId === inv.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(inv.id);
    if (usersByInvite[inv.id]) return;
    setUsersLoadingId(inv.id);
    try {
      const users = await fetchGuestLinkUsers(inv.id);
      setUsersByInvite((prev) => ({ ...prev, [inv.id]: users }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setUsersLoadingId(null);
    }
  };

  const onBlockUser = async (inviteId: string, user: GuestLinkUser) => {
    setActionId(`${inviteId}:${user.id}`);
    setError(null);
    try {
      const updated =
        user.status === "blocked"
          ? await unblockGuestLinkUser(inviteId, user.id)
          : await blockGuestLinkUser(inviteId, user.id);
      setUsersByInvite((prev) => ({
        ...prev,
        [inviteId]: (prev[inviteId] ?? []).map((u) =>
          u.id === user.id ? { ...u, ...updated } : u,
        ),
      }));
      await refresh();
    } catch (e: unknown) {
      setError(apiErr(e, "Update user failed"));
    } finally {
      setActionId(null);
    }
  };

  const onExpiryChange = async (id: string, localValue: string) => {
    setActionId(id);
    setError(null);
    try {
      await updateGuestBulkInvite(
        id,
        localValue
          ? { expiresAt: new Date(localValue).toISOString() }
          : { expiresAt: null },
      );
      await refresh();
    } catch (e: unknown) {
      setError(apiErr(e, "Update failed"));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 dark:bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-[var(--bg-card)] shadow-2xl dark:border-[#1e2638]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0 dark:border-[#1e2638]">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Guest links
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 dark:text-slate-500">
              Agency links · autosaves · Approve on the same page
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-5 shrink-0 dark:border-[#1e2638]">
          <button
            type="button"
            onClick={() => setTab("invites")}
            className={`relative px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === "invites"
                ? "border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-slate-400 dark:text-slate-500"
            }`}
          >
            Links
            {pendingOnLinks > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white align-middle">
                {pendingOnLinks}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === "all"
                ? "border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300"
                : "border-transparent text-slate-400 dark:text-slate-500"
            }`}
          >
            Approved history
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          )}

          {!loading && tab === "invites" && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 dark:border-[#1e2638] dark:bg-white/[0.03]">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  New agency link
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Shared agency URL. Each person enters name + phone and gets a
                  private draft. Agency is locked. (Old driver links are
                  retired.)
                </p>
                <select
                  value={agencyId}
                  onChange={(e) => setAgencyId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-[#1e2638] dark:text-slate-100"
                >
                  <option value="">Select agency…</option>
                  {agencies.map((a) => {
                    const id = String(a._id ?? a.id ?? "");
                    return (
                      <option key={id} value={id}>
                        {a.name}
                        {a.phone ? ` · ${a.phone}` : ""}
                      </option>
                    );
                  })}
                </select>

                <label className="text-sm text-slate-600 flex items-center gap-2 dark:text-slate-300">
                  Expires (optional)
                  <select
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-2 py-1.5 text-sm dark:border-[#1e2638] dark:text-slate-100"
                  >
                    <option value={0}>No expiry</option>
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
                  className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                >
                  {creating ? "Creating…" : "Create & open in new tab"}
                </button>
              </div>

              {invites.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-4 dark:text-slate-500">
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
                    const pending = inv.pendingSubmissions ?? 0;
                    const isAgency = inv.scope === "agency";
                    const expanded = expandedId === inv.id;
                    const users = usersByInvite[inv.id] ?? inv.guestUsers ?? [];
                    return (
                      <li
                        key={inv.id}
                        className={`rounded-xl border bg-[var(--bg-card)] p-3 space-y-2 dark:border-[#1e2638] ${
                          pending > 0
                            ? "border-orange-300 dark:border-orange-500/40"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <p className="text-sm font-semibold text-slate-800 truncate dark:text-slate-100">
                                {isAgency
                                  ? inv.agencyName || inv.label
                                  : inv.driverName || inv.label}
                              </p>
                              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:bg-white/10 dark:text-slate-400">
                                {isAgency ? "Agency" : "Driver"}
                              </span>
                              {pending > 0 && (
                                <span
                                  className="shrink-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white"
                                  title={`${pending} pending — open link to Approve`}
                                >
                                  {pending}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 dark:text-slate-500">
                              {!isAgency && inv.driverPhone
                                ? `${inv.driverPhone} · `
                                : ""}
                              {isAgency && (inv.guestUserCount ?? 0) > 0
                                ? `${inv.guestUserCount} user${inv.guestUserCount === 1 ? "" : "s"} · `
                                : ""}
                              {!isAgency
                                ? "Retired (guests blocked)"
                                : revoked
                                  ? "Revoked (guests blocked)"
                                  : expired
                                    ? "Expired (guests blocked)"
                                    : "Active"}
                              {pending > 0
                                ? ` · ${pending} with trips to Approve`
                                : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              title="Open in new tab"
                              onClick={() => openInNewTab(inv)}
                              className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Copy link"
                              onClick={() => copyLink(inv)}
                              className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/15"
                            >
                              {copiedId === inv.id ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                            {isAgency && (
                              <button
                                type="button"
                                title="Rotate URL"
                                disabled={actionId === inv.id}
                                onClick={() => onRotate(inv.id)}
                                className="rounded-lg p-2 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
                              >
                                <KeyRound className="h-4 w-4" />
                              </button>
                            )}
                            {revoked ? (
                              <button
                                type="button"
                                title="Unrevoke"
                                disabled={actionId === inv.id}
                                onClick={() => onUnrevoke(inv.id)}
                                className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                title="Revoke"
                                disabled={actionId === inv.id}
                                onClick={() => onRevoke(inv.id)}
                                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {isAgency && (
                          <button
                            type="button"
                            onClick={() => void toggleUsers(inv)}
                            className="flex w-full items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-[#1e2638] dark:bg-white/[0.03] dark:text-slate-300"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5" />
                              Link users
                              {(inv.guestUserCount ?? users.length) > 0
                                ? ` (${inv.guestUserCount ?? users.length})`
                                : ""}
                            </span>
                            {expanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}

                        {isAgency && expanded && (
                          <div className="space-y-1.5 rounded-lg border border-slate-100 p-2 dark:border-[#1e2638]">
                            {usersLoadingId === inv.id ? (
                              <div className="flex justify-center py-3">
                                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                              </div>
                            ) : users.length === 0 ? (
                              <p className="py-2 text-center text-xs text-slate-400">
                                No one has joined yet
                              </p>
                            ) : (
                              users.map((u) => (
                                <div
                                  key={u.id}
                                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-slate-700 dark:text-slate-200">
                                      {u.name}
                                      {u.status === "blocked" && (
                                        <span className="ml-1.5 text-rose-500">
                                          blocked
                                        </span>
                                      )}
                                    </p>
                                    <p className="truncate text-slate-400">
                                      {u.phone}
                                      {(u.pendingSubmissions ?? 0) > 0
                                        ? ` · ${u.pendingSubmissions} pending`
                                        : ""}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={
                                      actionId === `${inv.id}:${u.id}`
                                    }
                                    onClick={() => onBlockUser(inv.id, u)}
                                    className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${
                                      u.status === "blocked"
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                        : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
                                    }`}
                                  >
                                    {u.status === "blocked"
                                      ? "Unblock"
                                      : "Block"}
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="shrink-0">Expires</span>
                          <DateTimePicker
                            compact
                            disabled={actionId === inv.id}
                            value={toLocalInputValue(inv.expiresAt)}
                            onChange={(next) => {
                              const prev = toLocalInputValue(inv.expiresAt);
                              if (next !== prev) {
                                void onExpiryChange(inv.id, next);
                              }
                            }}
                            className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-[var(--bg-elevated)] px-2 py-1.5 text-xs text-slate-700 dark:border-[#1e2638] dark:text-slate-100"
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
                <p className="text-center text-sm text-slate-400 py-8 dark:text-slate-500">
                  No approved entries yet
                </p>
              ) : (
                <ul className="space-y-3">
                  {subs.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-xl border border-slate-200 bg-[var(--bg-card)] p-4 dark:border-[#1e2638]"
                    >
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {s.guestName || "Driver"}
                        {s.guestPhone ? (
                          <span className="font-normal text-slate-500 dark:text-slate-400">
                            {" "}
                            · {s.guestPhone}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 dark:text-slate-500">
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
  disabled,
  title,
}: {
  pendingCount?: number;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? "Open agency guest link"}
      className="relative flex items-center gap-1 rounded-md border border-slate-200 bg-[var(--bg-elevated)] px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 shrink-0 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-1.5 sm:rounded-lg sm:px-3 sm:py-2 sm:text-xs dark:border-[#1e2638] dark:text-slate-300 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
    >
      <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      <span className="hidden sm:inline">Guest link</span>
      {(pendingCount ?? 0) > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
          {pendingCount}
        </span>
      )}
    </button>
  );
}
