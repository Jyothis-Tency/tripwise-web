import apiClient from "../../services/axios";
import { ApiEndpoints } from "../../services/apiEndpoints";

export type AdminOwner = {
  _id: string;
  id?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  businessType?: string;
  isActive?: boolean;
  isBlocked?: boolean;
  isVerified?: boolean;
  password?: string;
  totalFleets?: number;
  totalDrivers?: number;
  createdAt?: string;
  lastLogin?: string;
};

export type AdminDriver = {
  _id: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email: string;
  phone?: string;
  password?: string;
  place?: string;
  isActive?: boolean;
  isBlocked?: boolean;
  owner?: {
    _id?: string;
    name?: string;
    email?: string;
    company?: string;
    phone?: string;
  } | null;
  assignedVehicle?: {
    _id?: string;
    vehicleNumber?: string;
    vehicleModel?: string;
    vehicleType?: string;
  } | null;
  createdAt?: string;
};

export type AdminPagination = {
  current: number;
  pages: number;
  total: number;
};

async function adminGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const res = await apiClient.get(path, { params });
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as T;
}

export async function fetchAdminOwners(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<{ owners: AdminOwner[]; pagination: AdminPagination }> {
  const data = await adminGet<{
    owners?: AdminOwner[];
    pagination?: AdminPagination;
  }>(ApiEndpoints.adminOwners, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 50,
    search: params?.search || undefined,
    status: params?.status || undefined,
  });
  return {
    owners: Array.isArray(data.owners) ? data.owners : [],
    pagination: data.pagination ?? { current: 1, pages: 1, total: 0 },
  };
}

export async function fetchAdminOwnerById(id: string): Promise<AdminOwner> {
  return adminGet<AdminOwner>(ApiEndpoints.adminOwnerById(id));
}

export async function fetchAdminDrivers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<{ drivers: AdminDriver[]; pagination: AdminPagination }> {
  const data = await adminGet<{
    drivers?: AdminDriver[];
    pagination?: AdminPagination;
  }>(ApiEndpoints.adminDrivers, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 50,
    search: params?.search || undefined,
    status: params?.status || undefined,
  });
  return {
    drivers: Array.isArray(data.drivers) ? data.drivers : [],
    pagination: data.pagination ?? { current: 1, pages: 1, total: 0 },
  };
}

export async function fetchAdminDriverById(id: string): Promise<AdminDriver> {
  return adminGet<AdminDriver>(ApiEndpoints.adminDriverById(id));
}

export async function fetchAdminDashboardStats(): Promise<{
  totalOwners?: number;
  totalDrivers?: number;
  totalVehicles?: number;
  totalTrips?: number;
  [key: string]: unknown;
}> {
  try {
    return await adminGet(ApiEndpoints.adminDashboardStats);
  } catch {
    return {};
  }
}
