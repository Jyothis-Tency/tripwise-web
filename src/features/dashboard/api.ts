import apiClient from '../../services/axios';
import { ApiEndpoints } from '../../services/apiEndpoints';

export interface DashboardOverview {
  totalVehicles?: number;
  totalDrivers?: number;
  totalTrips?: number;
  totalRevenue?: number;
  [key: string]: unknown;
}

export interface TripSummary {
  _id: string;
  tripNumber?: string;
  from?: string;
  to?: string;
  status?: string;
  startDate?: string;
  expectedEndDate?: string;
}

export interface DashboardData {
  overview: DashboardOverview;
  ongoingTrips: TripSummary[];
  upcomingTrips: TripSummary[];
  alerts: any[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const [overviewRes, ongoingRes, upcomingRes, alertsRes] = await Promise.all([
    apiClient.get(ApiEndpoints.dashboardOverview),
    apiClient.get(ApiEndpoints.dashboardOngoingTrips),
    apiClient.get(ApiEndpoints.dashboardUpcomingTrips),
    apiClient.get(ApiEndpoints.dashboardAlerts),
  ]);

  const wrap = (res: any) => res?.data?.data ?? res?.data ?? {};

  const overview = wrap(overviewRes);
  const ongoing = wrap(ongoingRes);
  const upcoming = wrap(upcomingRes);
  const alerts = wrap(alertsRes);

  const toArray = (value: any): TripSummary[] =>
    Array.isArray(value) ? (value as TripSummary[]) : [];

  return {
    overview: (overview as DashboardOverview) ?? {},
    ongoingTrips: toArray(ongoing.ongoingTrips ?? ongoing.trips ?? ongoing),
    upcomingTrips: toArray(upcoming.upcomingTrips ?? upcoming.trips ?? upcoming),
    alerts: Array.isArray(alerts) ? alerts : Array.isArray(alerts.alerts) ? alerts.alerts : [],
  };
}


