import apiClient from "../../services/axios";
import { ApiEndpoints } from "../../services/apiEndpoints";

// ─── Types ───────────────────────────────────────────────────────────────────

import {
  formatAgencyLabel,
  resolveAgencyLabelFromName,
  buildAgencyLabelLookup,
} from "../../lib/agencyDisplay";
import {
  fetchAllPages,
  DEFAULT_LIST_PAGE_SIZE,
  type PagePagination,
} from "../../lib/fetchAllPages";

export type { AgencyDisplayFields } from "../../lib/agencyDisplay";
export {
  formatAgencyLabel,
  resolveAgencyLabelFromName,
  buildAgencyLabelLookup,
};

export interface Agency {
  _id?: string;
  id?: string;
  name: string;
  phone?: string;
  owner?: string;
  createdAt?: string;
}

export interface AgencyTrip {
  _id?: string;
  id?: string;
  agencyTripId?: string;
  // Bulk entry fields
  driverName?: string;
  vehicleNumber?: string;
  advancePaid?: number;
  startDate?: string;
  endDate?: string;
  startKm?: string;
  endKm?: string;
  startTime?: string;
  endTime?: string;
  toll?: number;
  grandTotal?: number;
  distance?: number;
  hours?: number;
  status?: string;
  // Normal entry fields
  mobileNumber?: string;
  vehicleType?: string;
  date?: string;
  notes?: string;
  isCompleted?: boolean;
  createdAt?: string;
  /** Bulk entry card id — groups trips on the same driver/vehicle card. */
  clientGroupId?: string;
}

// ─── Bulk Entry Row (local UI model) ─────────────────────────────────────────

export interface BulkTripRow {
  clientRowId: string;
  _id?: string;
  startDate: string;
  endDate: string;
  startKm: string;
  endKm: string;
  startTime: string;
  endTime: string;
  distance: number;
  hours: number;
  toll: number;
  advancePaid: number;
  grandTotal: number;
  notes: string;
  isCompleted?: boolean;
  /** Server createdAt — used to order driver groups by when they were created. */
  createdAt?: string;
}

export interface DriverGroup {
  /**
   * Stable UI identity for this driver/vehicle card.
   * Never reuse across cards — used for React keys and delete scoping
   * so two cards never share identity even with the same driver/vehicle.
   */
  clientGroupId?: string;
  driverName: string;
  /** Set when picked from drivers list or after create — links bulk trips to Driver doc. */
  driverId?: string;
  /** Phone for new-driver creation on sync (from create modal or normal entry mobile). */
  driverPhone?: string;
  vehicleNumber: string;
  rows: BulkTripRow[];
  /** When this driver/vehicle block was first created (client or earliest trip). */
  groupCreatedAt?: string;
}

export interface NormalEntryRow {
  _id?: string;
  clientRowId?: string;
  date: string;
  driverName: string;
  driverId?: string;
  mobileNumber: string;
  vehicleNumber: string;
  vehicleType: string;
  notes: string;
  isCompleted?: boolean;
}

// ─── API Calls ───────────────────────────────────────────────────────────────

/** Fetch paginated agencies */
export async function fetchAgencies(
  page = 1,
  limit = 50,
  search?: string,
): Promise<{ agencies: Agency[]; total: number }> {
  let url = `${ApiEndpoints.agencies}?page=${page}&limit=${limit}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  const res = await apiClient.get(url);
  const raw: any = res.data ?? {};
  const root = raw.data ?? raw;
  const list = root.agencies ?? root.documents ?? root.items ?? [];
  return {
    agencies: list.map((a: any) => ({
      _id: a._id ?? a.id,
      id: a.id ?? a._id,
      name: a.name ?? "",
      phone: a.phone ?? "",
      owner: a.owner,
      createdAt: a.createdAt,
    })),
    total: root.total ?? root.totalAgencies ?? list.length,
  };
}

/** Load every agency for the owner (paginated). */
export async function fetchAllAgencies(search?: string): Promise<{
  agencies: Agency[];
  complete: boolean;
}> {
  const result = await fetchAllPages(async (page, pageSize) => {
    const { agencies, total } = await fetchAgencies(page, pageSize, search);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: agencies,
      pagination: {
        page,
        limit: pageSize,
        total,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
      },
    };
  });
  return { agencies: result.items, complete: result.complete };
}

/** Create an agency */
export async function createAgency(
  name: string,
  phone: string,
): Promise<Agency> {
  const res = await apiClient.post(ApiEndpoints.agencies, {
    name: name.trim(),
    phone: phone.trim(),
  });
  const raw: any = res.data ?? {};
  const d = raw.data ?? raw;
  return {
    _id: d._id ?? d.id,
    id: d.id ?? d._id,
    name: d.name ?? name,
    phone: d.phone ?? phone,
  };
}

/** Delete an agency */
export async function deleteAgency(id: string): Promise<void> {
  await apiClient.delete(ApiEndpoints.agencyById(id));
}

// ── Bulk Entry ──

export type EntryTripsPagination = PagePagination;

function parseBulkEntryTripsResponse(raw: unknown): {
  trips: AgencyTrip[];
  pagination: EntryTripsPagination | null;
} {
  const root: any = (raw as any)?.data ?? raw ?? {};
  const trips: AgencyTrip[] =
    root.bulkEntryTrips ??
    root.agencyTrips ??
    root.documents ??
    root.items ??
    [];
  const pagination = root.pagination ?? null;
  return { trips, pagination };
}

function parseNormalEntryTripsResponse(raw: unknown): {
  trips: AgencyTrip[];
  pagination: EntryTripsPagination | null;
} {
  const root: any = (raw as any)?.data ?? raw ?? {};
  const trips: AgencyTrip[] =
    root.normalEntryTrips ??
    root.agencyTrips ??
    root.documents ??
    root.items ??
    [];
  const pagination = root.pagination ?? null;
  return { trips, pagination };
}

export type FetchAllEntryTripsResult = {
  trips: AgencyTrip[];
  /** False if server total not reached or safety cap hit */
  complete: boolean;
  loadedCount: number;
  expectedTotal: number | null;
};

async function fetchAllEntryTripsPaginated(
  fetchPage: (
    page: number,
    limit: number,
  ) => Promise<{ trips: AgencyTrip[]; pagination: EntryTripsPagination | null }>,
): Promise<FetchAllEntryTripsResult> {
  const result = await fetchAllPages((page, pageSize) =>
    fetchPage(page, pageSize).then(({ trips, pagination }) => ({
      items: trips,
      pagination,
    })),
  );
  return {
    trips: result.items,
    complete: result.complete,
    loadedCount: result.loadedCount,
    expectedTotal: result.expectedTotal,
  };
}

/** Fetch one page of bulk entry trips for an agency */
export async function fetchBulkEntryTrips(
  agencyId: string,
  page = 1,
  limit = DEFAULT_LIST_PAGE_SIZE,
): Promise<AgencyTrip[]> {
  const { trips } = await fetchBulkEntryTripsPage(agencyId, page, limit);
  return trips;
}

export async function fetchBulkEntryTripsPage(
  agencyId: string,
  page = 1,
  limit = DEFAULT_LIST_PAGE_SIZE,
): Promise<{ trips: AgencyTrip[]; pagination: EntryTripsPagination | null }> {
  const res = await apiClient.get(
    `${ApiEndpoints.bulkEntryTrips}?agencyId=${agencyId}&page=${page}&limit=${limit}`,
  );
  return parseBulkEntryTripsResponse(res.data);
}

/**
 * Load every bulk trip for an agency.
 * Paginates until `pagination.total` is loaded or the server has no next page.
 */
export async function fetchAllBulkEntryTrips(
  agencyId: string,
): Promise<FetchAllEntryTripsResult> {
  return fetchAllEntryTripsPaginated((page, limit) =>
    fetchBulkEntryTripsPage(agencyId, page, limit),
  );
}

/** Sync bulk entry (autosave endpoint) */
export async function syncBulkEntry(payload: {
  agencyId?: string;
  agencyName?: string;
  idempotencyKey?: string;
  driverGroups: DriverGroup[];
}): Promise<{
  created: number;
  updated: number;
  deleted: number;
  failed: number;
  rows?: Array<{
    clientRowId?: string;
    _id?: string;
    status?: string;
    result?: string;
  }>;
}> {
  const res = await apiClient.post(ApiEndpoints.bulkEntrySync, payload);
  const raw: any = res.data ?? {};
  const d = raw.data ?? raw;
  return {
    created: d.created ?? 0,
    updated: d.updated ?? 0,
    deleted: d.deleted ?? 0,
    failed: d.failed ?? 0,
    rows: d.rows ?? undefined,
  };
}

/** Create bulk trips (submit) */
export async function createBulkTrips(payload: {
  agencyId?: string;
  agencyName?: string;
  driverGroups: DriverGroup[];
}): Promise<{ created: number; updated: number; failed: number }> {
  const res = await apiClient.post(ApiEndpoints.bulkEntryTrips, payload);
  const raw: any = res.data ?? {};
  const d = raw.data ?? raw;
  return {
    created: d.created ?? 0,
    updated: d.updated ?? 0,
    failed: d.failed ?? 0,
  };
}

/** Update a bulk entry trip */
export async function updateBulkEntryTrip(
  id: string,
  payload: Partial<AgencyTrip>,
): Promise<AgencyTrip> {
  const res = await apiClient.put(ApiEndpoints.bulkEntryTripById(id), payload);
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as AgencyTrip;
}

/** Delete a bulk entry trip */
export async function deleteBulkEntryTrip(id: string): Promise<void> {
  await apiClient.delete(ApiEndpoints.bulkEntryTripById(id));
}

/** Move an entire bulk entry card (clientGroupId) to another agency. */
export async function transferBulkEntryGroup(payload: {
  sourceAgencyId: string;
  targetAgencyId: string;
  clientGroupId: string;
  /** Saved row ids on the card — used when DB clientGroupId does not match UI yet */
  tripIds?: string[];
}): Promise<{
  movedCount: number;
  tripIds: string[];
  clientGroupId: string;
  sourceAgencyId: string;
  targetAgencyId: string;
  targetAgencyName?: string;
}> {
  const res = await apiClient.post(ApiEndpoints.bulkEntryTransfer, payload);
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as {
    movedCount: number;
    tripIds: string[];
    clientGroupId: string;
    sourceAgencyId: string;
    targetAgencyId: string;
    targetAgencyName?: string;
  };
}

// ── Normal Entry ──

/** Fetch one page of normal entry trips for an agency */
export async function fetchNormalEntryTrips(
  agencyId: string,
  page = 1,
  limit = DEFAULT_LIST_PAGE_SIZE,
): Promise<AgencyTrip[]> {
  const { trips } = await fetchNormalEntryTripsPage(agencyId, page, limit);
  return trips;
}

export async function fetchNormalEntryTripsPage(
  agencyId: string,
  page = 1,
  limit = DEFAULT_LIST_PAGE_SIZE,
): Promise<{ trips: AgencyTrip[]; pagination: EntryTripsPagination | null }> {
  const res = await apiClient.get(
    `${ApiEndpoints.normalEntryTrips}?agencyId=${agencyId}&page=${page}&limit=${limit}`,
  );
  return parseNormalEntryTripsResponse(res.data);
}

/** Load every normal entry trip for an agency (same pagination rules as bulk). */
export async function fetchAllNormalEntryTrips(
  agencyId: string,
): Promise<FetchAllEntryTripsResult> {
  return fetchAllEntryTripsPaginated((page, limit) =>
    fetchNormalEntryTripsPage(agencyId, page, limit),
  );
}

/** Create normal entries (submit) */
export async function createNormalEntries(payload: {
  agencyName: string;
  entries: NormalEntryRow[];
}): Promise<{ created: number; updated: number; failed: number }> {
  const res = await apiClient.post(ApiEndpoints.normalEntry, payload);
  const raw: any = res.data ?? {};
  const d = raw.data ?? raw;
  return {
    created: d.created ?? 0,
    updated: d.updated ?? 0,
    failed: d.failed ?? 0,
  };
}

/** Sync normal entry (autosave endpoint) */
export async function syncNormalEntry(payload: {
  agencyId?: string;
  agencyName?: string;
  idempotencyKey?: string;
  entries: NormalEntryRow[];
}): Promise<{
  created: number;
  updated: number;
  deleted: number;
  failed: number;
  rows?: Array<{
    clientRowId?: string;
    _id?: string;
    status?: string;
    result?: string;
  }>;
}> {
  const res = await apiClient.post(ApiEndpoints.normalEntrySync, payload);
  const raw: any = res.data ?? {};
  const d = raw.data ?? raw;
  return {
    created: d.created ?? 0,
    updated: d.updated ?? 0,
    deleted: d.deleted ?? 0,
    failed: d.failed ?? 0,
    rows: d.rows ?? undefined,
  };
}

/** Delete a normal entry trip */
export async function deleteNormalEntryTrip(id: string): Promise<void> {
  await apiClient.delete(ApiEndpoints.normalEntryTripById(id));
}

// ── Payout ──

export interface PayoutPayment {
  _id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes?: string;
}

export interface AgencyPayoutSummary {
  grandTotal: number;
  /** Advances on trips in the selected period */
  totalAdvance: number;
  /** Agency receipt payments only (does not include advances) */
  totalReceived: number;
  /** advance + payments */
  totalApplied?: number;
  remaining: number;
  overpaid?: number;
  month?: string;
  monthLabel?: string;
  agencyRemainingAllTime?: number;
  agencyOverpaidAllTime?: number;
  payments: PayoutPayment[];
}

export interface DriverPayoutSummary {
  totalAdvance: number;
  totalPaid: number;
  remaining: number;
  payments: PayoutPayment[];
}

export async function fetchAgencyPayoutSummary(
  agencyId: string,
  month?: string,
): Promise<AgencyPayoutSummary> {
  const url = month
    ? `/owners/agencies/${agencyId}/payout-summary?month=${encodeURIComponent(month)}`
    : `/owners/agencies/${agencyId}/payout-summary`;
  const res = await apiClient.get(url);
  const raw: any = res.data ?? {};
  return raw.data ?? raw;
}

export async function addAgencyPayoutPayment(
  agencyId: string,
  payload: {
    amount: number;
    paymentDate?: string;
    paymentMethod?: string;
    notes?: string;
  },
): Promise<PayoutPayment> {
  const res = await apiClient.post(
    `/owners/agencies/${agencyId}/payout-payments`,
    payload,
  );
  const raw: any = res.data ?? {};
  return raw.data ?? raw;
}

export async function deletePayoutPayment(paymentId: string): Promise<void> {
  await apiClient.delete(`/owners/payout-payments/${paymentId}`);
}

export async function fetchDriverPayoutSummary(
  agencyId: string,
  driverName: string,
  month?: string,
): Promise<DriverPayoutSummary> {
  const queryParts = [`driverName=${encodeURIComponent(driverName)}`];
  if (month) {
    queryParts.push(`month=${encodeURIComponent(month)}`);
  }
  const res = await apiClient.get(
    `/owners/agencies/${agencyId}/driver-payout-summary?${queryParts.join("&")}`,
  );
  const raw: any = res.data ?? {};
  return raw.data ?? raw;
}

export async function addDriverPayoutPayment(
  agencyId: string,
  payload: {
    driverName: string;
    amount: number;
    paymentDate?: string;
    paymentMethod?: string;
    notes?: string;
  },
): Promise<PayoutPayment> {
  const res = await apiClient.post(
    `/owners/agencies/${agencyId}/driver-payout-payments`,
    payload,
  );
  const raw: any = res.data ?? {};
  return raw.data ?? raw;
}
