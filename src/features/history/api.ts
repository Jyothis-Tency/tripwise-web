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

export interface HistoryPayoutAgency {
  _id: string;
  id?: string;
  name: string;
  totalAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
}

export interface HistoryPayoutPayment {
  _id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes?: string;
}

export interface HistoryAgencyPayoutSummary {
  grandTotal: number;
  totalReceived: number;
  remaining: number;
  payments: HistoryPayoutPayment[];
}

export interface HistoryPayoutAgencyTrip {
  _id: string;
  tripId?: string;
  tripNumber: string;
  driverName: string;
  from: string;
  to: string;
  startDate: string;
  expectedEndDate?: string;
  agencyCost: number;
  cabCost: number;
  ownerProfit: number;
  advance: number;
  paidAmount?: number;
  remainingAmount?: number;
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
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

/** Mirrors backend `recordTripPayment` → `tripSummary`. */
export interface RecordPaymentTripSummary {
  tripId: string;
  tripNumber?: string;
  totalAmount: number;
  paidAmount: number;
  advance?: number;
  remainingBalance: number;
  paymentStatus: string;
}

export async function recordPayment(tripId: string, payload: {
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
  paymentDate?: string;
}): Promise<RecordPaymentTripSummary> {
  const res = await apiClient.post(`/owners/trips/${tripId}/payments`, payload);
  const raw = res.data?.data?.tripSummary ?? res.data?.tripSummary;
  if (!raw || raw.tripId == null) {
    throw new Error('Invalid payment response');
  }
  return {
    tripId: String(raw.tripId),
    tripNumber: raw.tripNumber,
    totalAmount: Number(raw.totalAmount) || 0,
    paidAmount: Number(raw.paidAmount) || 0,
    advance: raw.advance != null ? Number(raw.advance) : undefined,
    remainingBalance: Number(raw.remainingBalance) || 0,
    paymentStatus: String(raw.paymentStatus ?? 'unpaid'),
  };
}

export async function fetchPaymentHistory(tripId: string): Promise<{
  payments: TripPayment[];
  summary: { totalAmount: number; totalPaid: number; remainingBalance: number; paymentStatus: string };
}> {
  const res = await apiClient.get(`/owners/trips/${tripId}/payments`);
  const raw = res.data?.data ?? {};
  const summary = raw.summary ?? {};
  return {
    payments: raw.payments ?? [],
    summary: {
      totalAmount: Number(summary.totalAmount) || 0,
      // Backend currently returns `paidAmount`; keep fallback for compatibility.
      totalPaid: Number(summary.totalPaid ?? summary.paidAmount) || 0,
      remainingBalance: Number(summary.remainingBalance) || 0,
      paymentStatus: summary.paymentStatus ?? 'unpaid',
    },
  };
}

export async function updateTripFields(tripId: string, fields: Partial<HistoryTrip>): Promise<HistoryTrip> {
  const res = await apiClient.patch(`/owners/trips/${tripId}/fields`, { fields });
  return res.data?.data;
}

export async function fetchMainTripPayoutAgencies(): Promise<HistoryPayoutAgency[]> {
  const res = await apiClient.get('/owners/history/payout-agencies');
  const raw: any = res.data ?? {};
  const list: any[] = raw.data ?? [];
  return list.map((a: any) => ({
    _id: a._id ?? a.id,
    id: a.id ?? a._id,
    name: a.name ?? '',
    totalAmount: Number(a.totalAmount) || 0,
    paidAmount: Number(a.paidAmount) || 0,
    remainingAmount: Number(a.remainingAmount) || 0,
  }));
}

export async function fetchHistoryAgencyPayoutSummary(
  agencyId: string,
): Promise<HistoryAgencyPayoutSummary> {
  const res = await apiClient.get(`/owners/agencies/${agencyId}/payout-summary`, {
    params: { source: 'main' },
  });
  const raw: any = res.data ?? {};
  return raw.data ?? {
    grandTotal: 0,
    totalReceived: 0,
    remaining: 0,
    payments: [],
  };
}

export async function addHistoryAgencyPayoutPayment(
  agencyId: string,
  payload: {
    amount: number;
    paymentDate?: string;
    paymentMethod?: string;
    notes?: string;
  },
): Promise<HistoryPayoutPayment> {
  const res = await apiClient.post(`/owners/agencies/${agencyId}/payout-payments`, {
    ...payload,
    source: 'main',
  });
  const raw: any = res.data ?? {};
  return raw.data ?? raw;
}

export async function deleteHistoryPayoutPayment(paymentId: string): Promise<void> {
  await apiClient.delete(`/owners/payout-payments/${paymentId}`);
}

export async function fetchMainTripPayoutAgencyTrips(
  agencyId: string,
): Promise<HistoryPayoutAgencyTrip[]> {
  const res = await apiClient.get(`/owners/history/payout-agencies/${agencyId}/trips`);
  const raw: any = res.data ?? {};
  return raw.data ?? [];
}
