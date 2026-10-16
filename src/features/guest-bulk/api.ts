import apiClient from "../../services/axios";
import { ApiEndpoints } from "../../services/apiEndpoints";
import { getApiBaseUrl } from "../../lib/apiBase";
import type { Agency, DriverGroup } from "../bulk-entry/api";

const API_BASE = getApiBaseUrl();

export interface GuestAgencyBlock {
  clientId: string;
  agencyId?: string | null;
  agencyName: string;
  driverGroups: DriverGroup[];
  status: "open" | "accepted";
  acceptedAt?: string | null;
  activityAt?: string | null;
  rowCount?: number;
  syncResult?: unknown;
  /** Present on owner overview — which link user owns this block */
  guestUserId?: string | null;
  guestName?: string;
  guestPhone?: string;
}

export interface GuestLinkUser {
  id: string;
  name: string;
  phone: string;
  status: "active" | "blocked";
  lastSeenAt?: string | null;
  pendingSubmissions?: number;
  rowCount?: number;
  openRowCount?: number;
  createdAt?: string;
}

export interface GuestBulkInvite {
  id: string;
  token: string;
  label: string;
  scope?: "driver" | "agency";
  agencyId?: string | null;
  agencyName?: string;
  ownerName?: string;
  ownerCompany?: string;
  status: "active" | "revoked";
  expiresAt?: string | null;
  expired?: boolean;
  guestAccessAllowed?: boolean;
  driverName: string;
  driverPhone: string;
  allowCreateAgency: boolean;
  maxRows: number;
  isOwner?: boolean;
  joinRequired?: boolean;
  /** Owner seeing all link users' drafts merged */
  ownerOverview?: boolean;
  guestUserId?: string | null;
  guestUser?: GuestLinkUser | null;
  guestUsers?: GuestLinkUser[];
  guestUserCount?: number;
  agencies?: Agency[];
  draft?: {
    blocks: GuestAgencyBlock[];
    updatedAt?: string | null;
    rowCount?: number;
    openRowCount?: number;
  };
  pendingSubmissions?: number;
  createdAt?: string;
}

export interface GuestBulkSubmission {
  id: string;
  inviteId?: string | null;
  inviteLabel?: string;
  status: "pending" | "accepted" | "rejected";
  guestName: string;
  guestPhone?: string;
  agencyName: string;
  agency?: Agency | null;
  rowCount: number;
  driverGroups?: DriverGroup[];
  createdAt?: string;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  syncResult?: unknown;
}

const GUEST_USER_KEY = (token: string) => `guestBulkUser:${token}`;

export function loadStoredGuestUserId(token: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(GUEST_USER_KEY(token));
}

export function storeGuestUserId(token: string, userId: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(GUEST_USER_KEY(token), userId);
}

export function clearStoredGuestUserId(token: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(GUEST_USER_KEY(token));
}

function authHeaders(guestUserId?: string | null): HeadersInit {
  const token =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("accessToken")
      : null;
  return {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(guestUserId ? { "X-Guest-User": guestUserId } : {}),
  };
}

/** Map API / network failures to clear guest-link messages (no technical jargon). */
export function formatGuestApiError(
  status: number | null,
  serverMessage?: string | null,
  networkDetail?: string | null,
): string {
  if (status == null) {
    const detail = String(networkDetail || "");
    if (/failed to fetch|networkerror|load failed/i.test(detail)) {
      return "Could not reach the server. Check your internet connection. If it keeps failing, ask the owner — the link may need a server update.";
    }
    return "Network error — check your connection and try again.";
  }
  const msg = String(serverMessage || "").trim();
  if (status === 429) {
    return msg || "Too many saves. Wait a moment and try again.";
  }
  if (status === 410) {
    return (
      msg ||
      "This guest link is no longer active. Ask the owner for a new agency guest link."
    );
  }
  if (status === 403) {
    if (/not authorized for this invite/i.test(msg)) {
      return "This link belongs to a different owner account. Log in with the owner who created the link, or open it in a private window as a driver.";
    }
    return (
      msg ||
      "You cannot use this link right now (revoked, expired, or blocked)."
    );
  }
  if (status === 404) {
    if (/guest session|enter your phone/i.test(msg)) {
      return "Session expired. Enter your name and phone again to continue.";
    }
    return msg || "This guest link was not found. Check the URL from the owner.";
  }
  if (status === 409) {
    return msg || "That phone number is already in use. Try a different number.";
  }
  if (status >= 500) {
    return "Server error — please try again in a moment. If it continues, tell the owner.";
  }
  return msg || `Request failed (${status})`;
}

async function guestFetch<T>(
  path: string,
  init?: RequestInit,
  guestUserId?: string | null,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...authHeaders(guestUserId),
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    // fetch() throws on CORS preflight failures and unreachable hosts — not only
    // offline. Agency guest links send X-Guest-User; if the API CORS allow-list
    // omits it, the browser blocks the call and looks like "no internet".
    const detail = err instanceof Error ? err.message : "";
    throw new Error(formatGuestApiError(null, null, detail));
  }
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const serverMessage =
      raw && typeof raw === "object" && "message" in raw
        ? String((raw as { message?: string }).message || "")
        : "";
    throw new Error(formatGuestApiError(res.status, serverMessage));
  }
  const data =
    raw && typeof raw === "object" && "data" in raw
      ? (raw as { data: T }).data
      : (raw as T);
  return data;
}

export async function fetchGuestInvite(
  token: string,
  guestUserId?: string | null,
): Promise<GuestBulkInvite> {
  const uid = guestUserId ?? loadStoredGuestUserId(token);
  const q = uid ? `?guestUserId=${encodeURIComponent(uid)}` : "";
  return guestFetch<GuestBulkInvite>(
    `${ApiEndpoints.guestBulkByToken(token)}${q}`,
    undefined,
    uid,
  );
}

export async function joinGuestBulk(
  token: string,
  body: { name: string; phone: string },
): Promise<GuestBulkInvite> {
  const data = await guestFetch<GuestBulkInvite>(
    ApiEndpoints.guestBulkJoin(token),
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  if (data.guestUserId) {
    storeGuestUserId(token, data.guestUserId);
  }
  return data;
}

export async function createGuestAgency(
  token: string,
  name: string,
  phone: string,
): Promise<Agency> {
  return guestFetch<Agency>(ApiEndpoints.guestBulkCreateAgency(token), {
    method: "POST",
    body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
  });
}

export async function syncGuestBulk(
  token: string,
  payload: {
    driverName?: string;
    driverPhone?: string;
    guestUserId?: string | null;
    blocks: Array<{
      clientId: string;
      agencyId?: string | null;
      agencyName?: string;
      driverGroups: DriverGroup[];
    }>;
  },
): Promise<GuestBulkInvite> {
  const guestUserId =
    payload.guestUserId ?? loadStoredGuestUserId(token) ?? undefined;
  return guestFetch<GuestBulkInvite>(
    ApiEndpoints.guestBulkSync(token),
    {
      method: "POST",
      body: JSON.stringify({ ...payload, guestUserId }),
    },
    guestUserId,
  );
}

export async function approveGuestBulk(
  token: string,
  body: { clientId?: string; all?: boolean; guestUserId?: string | null },
): Promise<GuestBulkInvite & { approved?: unknown[]; warning?: string | null }> {
  const guestUserId =
    body.guestUserId ?? loadStoredGuestUserId(token) ?? undefined;
  return guestFetch(
    ApiEndpoints.guestBulkApprove(token),
    {
      method: "POST",
      body: JSON.stringify({ ...body, guestUserId }),
    },
    guestUserId,
  );
}

// ─── Owner APIs ───────────────────────────────────────────────────────────────

export async function createGuestBulkInvite(body: {
  label?: string;
  scope?: "driver" | "agency";
  agencyId?: string;
  driverName?: string;
  driverPhone?: string;
  expiresInDays?: number;
  maxRows?: number;
}): Promise<GuestBulkInvite> {
  const res = await apiClient.post(ApiEndpoints.guestBulkInvites, body);
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as GuestBulkInvite;
}

/** Get or create the agency guest link for Bulk Entry. */
export async function ensureAgencyGuestInvite(
  agencyId: string,
): Promise<GuestBulkInvite> {
  const res = await apiClient.post(ApiEndpoints.guestBulkInviteForAgency, {
    agencyId,
  });
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as GuestBulkInvite;
}

export async function fetchGuestBulkInvites(): Promise<GuestBulkInvite[]> {
  const res = await apiClient.get(ApiEndpoints.guestBulkInvites);
  const raw: any = res.data ?? {};
  const d = raw.data ?? raw;
  return Array.isArray(d) ? d : [];
}

export async function revokeGuestBulkInvite(
  id: string,
): Promise<GuestBulkInvite> {
  const res = await apiClient.post(ApiEndpoints.guestBulkInviteRevoke(id));
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as GuestBulkInvite;
}

export async function unrevokeGuestBulkInvite(
  id: string,
): Promise<GuestBulkInvite> {
  const res = await apiClient.post(ApiEndpoints.guestBulkInviteUnrevoke(id));
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as GuestBulkInvite;
}

export async function rotateGuestBulkInviteToken(
  id: string,
): Promise<GuestBulkInvite> {
  const res = await apiClient.post(ApiEndpoints.guestBulkInviteRotateToken(id));
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as GuestBulkInvite;
}

export async function fetchGuestLinkUsers(
  inviteId: string,
): Promise<GuestLinkUser[]> {
  const res = await apiClient.get(ApiEndpoints.guestBulkInviteUsers(inviteId));
  const raw: any = res.data ?? {};
  const d = raw.data ?? raw;
  return Array.isArray(d) ? d : [];
}

export async function blockGuestLinkUser(
  inviteId: string,
  userId: string,
): Promise<GuestLinkUser> {
  const res = await apiClient.post(
    ApiEndpoints.guestBulkInviteUserBlock(inviteId, userId),
  );
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as GuestLinkUser;
}

export async function unblockGuestLinkUser(
  inviteId: string,
  userId: string,
): Promise<GuestLinkUser> {
  const res = await apiClient.post(
    ApiEndpoints.guestBulkInviteUserUnblock(inviteId, userId),
  );
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as GuestLinkUser;
}

export async function updateGuestBulkInvite(
  id: string,
  body: {
    expiresAt?: string | null;
    expiresInDays?: number;
    status?: "active" | "revoked";
    driverName?: string;
    driverPhone?: string;
    label?: string;
  },
): Promise<GuestBulkInvite> {
  const res = await apiClient.patch(ApiEndpoints.guestBulkInviteById(id), body);
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as GuestBulkInvite;
}

export async function fetchGuestBulkSubmissions(
  status?: "pending" | "accepted" | "rejected",
): Promise<GuestBulkSubmission[]> {
  const res = await apiClient.get(ApiEndpoints.guestBulkSubmissions, {
    params: status ? { status } : undefined,
  });
  const raw: any = res.data ?? {};
  const d = raw.data ?? raw;
  return Array.isArray(d) ? d : [];
}

export function guestBulkShareUrl(token: string): string {
  if (typeof window === "undefined") return `/guest-bulk/${token}`;
  return `${window.location.origin}/guest-bulk/${token}`;
}

export function newBlockClientId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `b_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
