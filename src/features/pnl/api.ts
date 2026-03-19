import { apiClient } from '../../services/axios';
import { ApiEndpoints } from '../../services/apiEndpoints';

export interface PLRevenue {
  total: number;
  commission: number;
  commissionRevenue?: number;
  ownerRevenue?: number;
  tripRevenue: number;
  driverSalary: number;
  ownerProfit: number;
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
