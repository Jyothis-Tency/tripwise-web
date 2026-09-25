import { apiClient } from '../../services/axios';
import { ApiEndpoints } from '../../services/apiEndpoints';

export interface PLRevenue {
  total: number;
  commission: number;
  commissionRevenue?: number;
  ownerRevenue?: number;
  tripRevenue: number;
  billedRevenue?: number;
  cabFare?: number;
  driverSalary: number;
  agencyProfit: number;
  ownerProfit?: number;
  /** Bulk-only commission (before extra add-ins). */
  commissionFromBulk?: number;
  /** Sum of manual Extra Commission add-ins in the period. */
  extraCommission?: number;
}

export interface PLSummary {
  avgRevenuePerTrip: number;
}

export interface PLTrips {
  total: number;
  completed: number;
  cancelled: number;
  completionRate: number;
}

export interface PLRoute {
  route: string;
  trips: number;
  revenue: number;
  avgRevenue: number;
  profit?: number;
  driverName?: string;
  vehicleName?: string;
}

export interface PLDataResponse {
  period: string;
  revenue: PLRevenue;
  summary: PLSummary;
  trips: PLTrips;
  topRoutes: PLRoute[];
  vehicles?: any;
  drivers?: any;
}

export interface ExtraCommissionEntry {
  _id: string;
  amount: number;
  paymentDate: string | null;
  notes: string;
  createdAt: string | null;
}

export const fetchPLData = async (
  period?: string,
  startDate?: string,
  endDate?: string
): Promise<PLDataResponse> => {
  const params: Record<string, string> = {};
  if (period) params.period = period;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const response = await apiClient.get<{ success: boolean; data: PLDataResponse }>(
    ApiEndpoints.analyticsOverview,
    { params }
  );

  if (response.data.success) {
    return response.data.data;
  } else {
    throw new Error('Failed to fetch P&L data');
  }
};

export async function fetchExtraCommissions(): Promise<ExtraCommissionEntry[]> {
  const res = await apiClient.get(ApiEndpoints.extraCommissions);
  const raw: any = res.data ?? {};
  const data = raw.data ?? raw;
  return Array.isArray(data) ? data : [];
}

export async function addExtraCommission(payload: {
  amount: number;
  paymentDate?: string;
  notes?: string;
}): Promise<ExtraCommissionEntry> {
  const res = await apiClient.post(ApiEndpoints.extraCommissions, payload);
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as ExtraCommissionEntry;
}
