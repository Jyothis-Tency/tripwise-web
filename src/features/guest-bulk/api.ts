import apiClient from "../../services/axios";
import { ApiEndpoints } from "../../services/apiEndpoints";
import type { Agency, DriverGroup } from "../bulk-entry/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "https://heyanoop.site";

export interface GuestAgencyBlock {
  clientId: string;
  agencyId?: string | null;
  agencyName: string;
  driverGroups: DriverGroup[];
  status: "open" | "accepted";
  acceptedAt?: string | null;
  rowCount?: number;
  syncResult?: unknown;
}

export interface GuestBulkInvite {
  id: string;
  token: string;
  label: string;
  status: "active" | "revoked";
  expiresAt: string;
  expired?: boolean;
  guestAccessAllowed?: boolean;
  driverName: string;
  driverPhone: string;
  allowCreateAgency: boolean;
  maxRows: number;
  isOwner?: boolean;
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

function authHeaders(): HeadersInit {
  const token =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("accessToken")
      : null;
  return {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function guestFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (raw && typeof raw === "object" && "message" in raw
        ? String((raw as { message?: string }).message)
        : null) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  const data =
    raw && typeof raw === "object" && "data" in raw
      ? (raw as { data: T }).data
      : (raw as T);
  return data;
}

export async function fetchGuestInvite(
  token: string,
): Promise<GuestBulkInvite> {
  return guestFetch<GuestBulkInvite>(ApiEndpoints.guestBulkByToken(token));
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
    blocks: Array<{
      clientId: string;
      agencyId?: string | null;
      agencyName?: string;
      driverGroups: DriverGroup[];
    }>;
  },
): Promise<GuestBulkInvite> {
  return guestFetch<GuestBulkInvite>(ApiEndpoints.guestBulkSync(token), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function approveGuestBulk(
  token: string,
  body: { clientId?: string; all?: boolean },
): Promise<GuestBulkInvite & { approved?: unknown[] }> {
  return guestFetch(ApiEndpoints.guestBulkApprove(token), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Owner APIs ───────────────────────────────────────────────────────────────

export async function createGuestBulkInvite(body: {
  label?: string;
  driverName?: string;
  driverPhone?: string;
  expiresInDays?: number;
  maxRows?: number;
}): Promise<GuestBulkInvite> {
  const res = await apiClient.post(ApiEndpoints.guestBulkInvites, body);
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

export async function updateGuestBulkInvite(
  id: string,
  body: {
    expiresAt?: string;
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
  let url = ApiEndpoints.guestBulkSubmissions;
  if (status) url += `?status=${status}`;
  const res = await apiClient.get(url);
  const raw: any = res.data ?? {};
  const d = raw.data ?? raw;
  return Array.isArray(d) ? d : [];
}

export async function acceptGuestBulkSubmission(
  id: string,
): Promise<GuestBulkSubmission> {
  const res = await apiClient.post(ApiEndpoints.guestBulkSubmissionAccept(id));
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as GuestBulkSubmission;
}

export async function rejectGuestBulkSubmission(
  id: string,
): Promise<GuestBulkSubmission> {
  const res = await apiClient.post(ApiEndpoints.guestBulkSubmissionReject(id));
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as GuestBulkSubmission;
}

export function guestBulkShareUrl(token: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/guest-bulk/${token}`;
}

export function newBlockClientId() {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
