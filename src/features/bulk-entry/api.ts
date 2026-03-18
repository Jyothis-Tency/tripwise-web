import apiClient from '../../services/axios';
import { ApiEndpoints } from '../../services/apiEndpoints';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Agency {
  _id?: string;
  id?: string;
  name: string;
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
  grandTotal: number;
  notes: string;
}

export interface DriverGroup {
  driverName: string;
  vehicleNumber: string;
  advancePaid: number;
  rows: BulkTripRow[];
}

export interface NormalEntryRow {
  _id?: string;
  clientRowId?: string;
  date: string;
  driverName: string;
  mobileNumber: string;
  vehicleNumber: string;
  vehicleType: string;
  notes: string;
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
      name: a.name ?? '',
      owner: a.owner,
      createdAt: a.createdAt,
    })),
    total: root.total ?? root.totalAgencies ?? list.length,
  };
}

/** Create an agency */
export async function createAgency(name: string): Promise<Agency> {
  const res = await apiClient.post(ApiEndpoints.agencies, { name });
  const raw: any = res.data ?? {};
  const d = raw.data ?? raw;
  return { _id: d._id ?? d.id, id: d.id ?? d._id, name: d.name ?? name };
}

/** Delete an agency */
export async function deleteAgency(id: string): Promise<void> {
  await apiClient.delete(ApiEndpoints.agencyById(id));
}

// ── Bulk Entry ──

/** Fetch bulk entry trips for an agency */
export async function fetchBulkEntryTrips(
  agencyId: string,
  page = 1,
  limit = 100,
): Promise<AgencyTrip[]> {
  const res = await apiClient.get(
    `${ApiEndpoints.bulkEntryTrips}?agencyId=${agencyId}&page=${page}&limit=${limit}`,
  );
  const raw: any = res.data ?? {};
  const root = raw.data ?? raw;
  return root.bulkEntryTrips ?? root.agencyTrips ?? root.documents ?? root.items ?? [];
}

/** Sync bulk entry (autosave endpoint) */
export async function syncBulkEntry(payload: {
  agencyName: string;
  idempotencyKey?: string;
  driverGroups: DriverGroup[];
}): Promise<{
  created: number;
  updated: number;
  deleted: number;
  failed: number;
  rows?: Array<{ clientRowId?: string; _id?: string; status?: string; result?: string }>;
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
  agencyName: string;
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

/** Delete a bulk entry trip */
export async function deleteBulkEntryTrip(id: string): Promise<void> {
  await apiClient.delete(ApiEndpoints.bulkEntryTripById(id));
}

// ── Normal Entry ──

/** Fetch normal entry trips for an agency */
export async function fetchNormalEntryTrips(
  agencyId: string,
  page = 1,
  limit = 100,
): Promise<AgencyTrip[]> {
  const res = await apiClient.get(
    `${ApiEndpoints.normalEntryTrips}?agencyId=${agencyId}&page=${page}&limit=${limit}`,
  );
  const raw: any = res.data ?? {};
  const root = raw.data ?? raw;
  return root.normalEntryTrips ?? root.agencyTrips ?? root.documents ?? root.items ?? [];
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
  agencyName: string;
  idempotencyKey?: string;
  entries: NormalEntryRow[];
}): Promise<{
  created: number;
  updated: number;
  deleted: number;
  failed: number;
  rows?: Array<{ clientRowId?: string; _id?: string; status?: string; result?: string }>;
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
