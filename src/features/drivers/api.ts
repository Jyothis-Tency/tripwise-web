import { apiClient } from '../../services/axios';
import type { HistoryTripItem, VehicleHistoryResponse } from '../vehicles/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Driver {
  _id: string;
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  place?: string;
  password?: string;
  profileImg?: string;
  licenseImg?: string;
  isActive?: boolean;
  isBlocked?: boolean;
  blockedAt?: string;
  status?: string;
  assignedVehicle?: string | { _id: string; vehicleNumber: string; vehicleModel?: string };
  currentTrip?: string;
  documents?: string[];
  totalTrips?: number;
  totalKm?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DriverSalaryData {
  totalEarnings: number;
  totalTrips: number;
  totalKm: number;
  totalAdvance: number;
  /** Sum of `salary`-type settlement payments in the same period as the salary summary */
  salaryPaid: number;
  /** Trip Bata still owed after advances and recorded salary payments */
  pendingTripSalary: number;
  netSalary: number;
  advancePayments?: SalaryTransaction[];
  salaryPayments?: SalaryTransaction[];
  trips?: DriverTrip[];
}

export interface SalaryTransaction {
  _id: string;
  id?: string;
  amount: number;
  type: string;
  description?: string;
  notes?: string;
  date?: string;
  createdAt?: string;
}

export interface DriverTrip {
  _id: string;
  tripNumber?: string;
  from?: string;
  to?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  distance?: number;
  driver_salary?: number;
}

// ─── Driver CRUD ─────────────────────────────────────────────────────────────

export type DriverBlockFilter = 'all' | 'blocked' | 'unblocked';

export async function fetchDrivers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  blockFilter?: DriverBlockFilter;
}): Promise<{
  drivers: Driver[];
  pagination?: any;
}> {
  const { data } = await apiClient.get('/owners/drivers', { params });
  console.log('[fetchDrivers] raw response data:', data);
  // Backend returns { success, data: { drivers: [...], pagination } }
  const inner = data?.data ?? data;
  // inner could be { drivers: [...] } or the array directly
  if (Array.isArray(inner)) return { drivers: inner };
  if (inner?.drivers && Array.isArray(inner.drivers)) return inner;
  // Fallback: maybe drivers is at data.drivers directly
  if (data?.drivers && Array.isArray(data.drivers)) return data;
  console.warn('[fetchDrivers] could not extract drivers from response:', data);
  return { drivers: [] };
}

export async function fetchDriverById(id: string): Promise<Driver> {
  const { data } = await apiClient.get(`/owners/drivers/${id}`);
  return data.data ?? data;
}

export async function createDriver(driver: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  place?: string;
  password?: string;
  profileImg?: string;
  licenseImg?: string;
}): Promise<Driver> {
  const { data } = await apiClient.post('/owners/drivers', driver);
  return data.data ?? data;
}

export async function updateDriver(id: string, updates: Partial<Driver>): Promise<Driver> {
  const { data } = await apiClient.put(`/owners/drivers/${id}`, updates);
  return data.data ?? data;
}

export async function blockDriver(id: string): Promise<Driver> {
  const { data } = await apiClient.put(`/owners/drivers/${id}/block`);
  return data.data ?? data;
}

export async function unblockDriver(id: string): Promise<Driver> {
  const { data } = await apiClient.put(`/owners/drivers/${id}/unblock`);
  return data.data ?? data;
}

// ─── Driver Salary ───────────────────────────────────────────────────────────

export async function fetchDriverSalary(driverId: string, month?: string): Promise<DriverSalaryData> {
  const params: Record<string, string> = {};
  if (month) params.month = month;
  const { data } = await apiClient.get(`/owners/drivers/${driverId}/salary`, { params });
  const payload = data.data ?? data;
  
  const pending =
    payload.pendingTripSalary ?? payload.remainingBalance ?? 0;
  return {
    totalEarnings: payload.totalEarned ?? 0,
    totalTrips:
      payload.totalTrips ??
      (payload.completedTrips ?? 0) +
        (payload.inProgressTrips ?? 0) +
        (payload.scheduledTrips ?? 0),
    totalKm: payload.totalKm ?? 0,
    totalAdvance: payload.advanceSalary ?? 0,
    salaryPaid: payload.salaryPaid ?? 0,
    pendingTripSalary: pending,
    netSalary: pending,
    advancePayments: payload.advancePayments || [],
    salaryPayments: payload.salaryPayments || [],
  };
}

export async function fetchDriverTrips(driverId: string, params?: { page?: number; limit?: number; month?: string }): Promise<{
  trips: DriverTrip[];
  totalPages: number;
  currentPage: number;
}> {
  const { data } = await apiClient.get(`/owners/drivers/${driverId}/trips`, { params });
  return data.data ?? data;
}

/** Full driver trip history (filters + stats) — same shape as vehicle history for UI reuse. */
export type DriverHistoryResponse = VehicleHistoryResponse & {
  driver?: { _id?: string; firstName?: string; lastName?: string; phone?: string };
};

export async function fetchDriverHistoryDetailed(params: {
  driverId: string;
  page?: number;
  limit?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
  month?: string;
}): Promise<DriverHistoryResponse> {
  const { driverId, page = 1, limit = 10, status, startDate, endDate, month } = params;
  const clean: Record<string, string | number> = { page, limit };
  if (status && status !== 'all') clean.status = status;
  if (startDate) clean.startDate = startDate;
  if (endDate) clean.endDate = endDate;
  if (month) clean.month = month;

  const res = await apiClient.get(`/owners/drivers/${driverId}/trips`, { params: clean });
  const raw: any = res.data ?? {};
  const data = raw.data ?? raw;
  const tripsRaw: any[] = Array.isArray(data.trips) ? data.trips : [];

  return {
    driver: data.driver,
    vehicle: data.vehicle,
    tripStats: data.tripStats,
    financialStats: data.financialStats,
    pagination: data.pagination,
    trips: tripsRaw.map((t: any) => ({
      _id: t._id ?? t.id ?? '',
      tripNumber: t.tripNumber,
      from: t.from,
      to: t.to,
      status: t.status,
      startDate: t.startDate ?? t.departureDate ?? t.date,
      departureDate: t.departureDate ?? t.date,
      completedAt: t.completedAt ?? t.updatedAt,
      distance: t.distance,
      startKilometers: t.startKilometers,
      endKilometers: t.endKilometers,
      totalExpenses: t.totalExpenses,
      driver_salary: t.driver_salary,
      ownerProfit: t.ownerProfit,
      agencyCost: t.agencyCost,
      cabCost: t.cabCost,
      driverName:
        (
          t.driver?.fullName ??
          t.driver?.name ??
          `${t.driver?.firstName ?? ''} ${t.driver?.lastName ?? ''}`.trim()
        ) || t.driverName,
      driver: t.driver ?? null,
      vehicle: t.vehicle ?? null,
    })) as HistoryTripItem[],
  };
}

// ─── Salary Transactions (Advance Payments) ──────────────────────────────────

export async function createSalaryTransaction(driverId: string, payload: {
  amount: number;
  type: string;
  description?: string;
  notes?: string;
  date?: string;
}): Promise<SalaryTransaction> {
  const body = {
    amount: payload.amount,
    type: payload.type,
    notes: payload.notes ?? payload.description,
    date: payload.date,
  };
  const { data } = await apiClient.post(`/owners/drivers/${driverId}/salary/transactions`, body);
  return data.data ?? data;
}

export interface SalaryLedgerPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

function mapSalaryLedgerDoc(raw: Record<string, unknown>): SalaryTransaction {
  const id = String(raw._id ?? raw.id ?? '');
  return {
    _id: id,
    id,
    amount: Number(raw.amount) || 0,
    type: String(raw.type ?? ''),
    notes: (raw.notes as string) || undefined,
    date: raw.date as string | undefined,
    createdAt: raw.createdAt as string | undefined,
  };
}

/** Paginated salary + advance ledger for a driver (owner API). */
export async function fetchDriverSalaryLedger(
  driverId: string,
  params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    type?: 'salary' | 'advance';
  },
): Promise<{ transactions: SalaryTransaction[]; pagination: SalaryLedgerPagination | null }> {
  const { data } = await apiClient.get(`/owners/drivers/${driverId}/salary/transactions`, {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 25,
      startDate: params?.startDate,
      endDate: params?.endDate,
      type: params?.type,
    },
  });
  const inner = (data?.data ?? data) as {
    documents?: Record<string, unknown>[];
    pagination?: SalaryLedgerPagination;
  };
  const docs = inner.documents ?? [];
  return {
    transactions: docs.map(mapSalaryLedgerDoc),
    pagination: inner.pagination ?? null,
  };
}

export async function deleteSalaryTransaction(transactionId: string): Promise<void> {
  await apiClient.delete(`/owners/driver-salary/${transactionId}`);
}
