import apiClient from '../../services/axios';
import { ApiEndpoints } from '../../services/apiEndpoints';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HistoryTrip {
  _id: string;
  id?: string;
  tripNumber?: string;
  status: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  from?: string;
  to?: string;
  pickup?: string;
  drop?: string;
  distance?: string | number;
  customer?: string;
  priority?: string;
  agencyName?: string;
  notes?: string;
  completionNote?: string;
  startTime?: string;
  endTime?: string;
  startKilometers?: number;
  endKilometers?: number;
  driver?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
  } | string;
  vehicle?: {
    _id?: string;
    vehicleNumber?: string;
    vehicleModel?: string;
    vehicleType?: string;
  } | string;
  careOf?: { name?: string; phone?: string };
  agencyCost?: number;
  cabCost?: number;
  driver_salary?: number;
  advance?: number;
  totalExpenses?: number;
  ownerProfit?: number;
  paidAmount?: number;
  paymentSummary?: {
    totalAmount?: number;
    paidAmount?: number;
    remainingBalance?: number;
    paymentStatus?: 'paid' | 'partial' | 'unpaid';
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface HistoryPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface HistoryPaymentSummary {
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
}

export interface HistoryParams {
  page?: number;
  limit?: number;
  status?: string;
  month?: string;      // e.g. "2024-03"
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  driver?: string;
  vehicle?: string;
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD
}

export interface TripPayment {
  _id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function fetchTripHistory(params: HistoryParams = {}): Promise<{
  trips: HistoryTrip[];
  pagination: HistoryPagination;
  paymentSummary: HistoryPaymentSummary;
}> {
  // Strip empty/undefined params before sending
  const clean: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') clean[k] = v as string | number;
  }
  const res = await apiClient.get(ApiEndpoints.historyTrips, { params: clean });
  const data = res.data?.data ?? {};
  return {
    trips: data.trips ?? [],
    pagination: data.pagination ?? { page: 1, limit: 10, total: 0, pages: 1, hasNext: false, hasPrev: false },
    paymentSummary: data.paymentSummary ?? { totalAmount: 0, totalPaid: 0, totalOutstanding: 0 },
  };
}

export async function deleteTrip(id: string): Promise<void> {
  await apiClient.delete(`/owners/trips/${id}`);
}

export async function recordPayment(tripId: string, payload: {
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
  paymentDate?: string;
}): Promise<void> {
  await apiClient.post(`/owners/trips/${tripId}/payments`, payload);
}

export async function fetchPaymentHistory(tripId: string): Promise<{
  payments: TripPayment[];
  summary: { totalAmount: number; totalPaid: number; remainingBalance: number; paymentStatus: string };
}> {
  const res = await apiClient.get(`/owners/trips/${tripId}/payments`);
  return res.data?.data ?? { payments: [], summary: {} };
}

export async function updateTripFields(tripId: string, fields: Partial<HistoryTrip>): Promise<HistoryTrip> {
  const res = await apiClient.patch(`/owners/trips/${tripId}/fields`, { fields });
  return res.data?.data;
}
