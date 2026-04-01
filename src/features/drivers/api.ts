import { apiClient } from '../../services/axios';

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
  netSalary: number;
  advancePayments?: SalaryTransaction[];
  trips?: DriverTrip[];
}

export interface SalaryTransaction {
  _id: string;
  amount: number;
  type: string;
  description?: string;
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

export async function fetchDrivers(params?: { page?: number; limit?: number; search?: string }): Promise<{
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

export async function deleteDriver(id: string): Promise<void> {
  await apiClient.delete(`/owners/drivers/${id}`);
}

// ─── Driver Salary ───────────────────────────────────────────────────────────

export async function fetchDriverSalary(driverId: string, month?: string): Promise<DriverSalaryData> {
  const params: Record<string, string> = {};
  if (month) params.month = month;
  const { data } = await apiClient.get(`/owners/drivers/${driverId}/salary`, { params });
  const payload = data.data ?? data;
  
  return {
    totalEarnings: payload.totalEarned ?? 0,
    totalTrips: (payload.completedTrips ?? 0) + (payload.inProgressTrips ?? 0),
    totalKm: payload.totalKm ?? 0,
    totalAdvance: payload.advanceSalary ?? 0,
    netSalary: payload.remainingBalance ?? 0,
    advancePayments: payload.advancePayments || [],
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

// ─── Salary Transactions (Advance Payments) ──────────────────────────────────

export async function createSalaryTransaction(driverId: string, payload: {
  amount: number;
  type: string;
  description?: string;
  date?: string;
}): Promise<SalaryTransaction> {
  const { data } = await apiClient.post(`/owners/drivers/${driverId}/salary/transactions`, payload);
  return data.data ?? data;
}

export async function deleteSalaryTransaction(transactionId: string): Promise<void> {
  await apiClient.delete(`/owners/driver-salary/${transactionId}`);
}
