export const ApiEndpoints = {
  // Base URL is configured in axios.ts; this file mirrors Flutter ApiConstants paths.

  // AUTH
  ownerLogin: '/auth/owner/login',
  ownerLogout: '/auth/owner/logout',
  adminLogin: '/admin/auth/login',
  adminLogout: '/admin/auth/logout',

  // DASHBOARD
  dashboardOverview: '/owners/dashboard/overview',
  dashboardOngoingTrips: '/owners/dashboard/ongoing-trips',
  dashboardUpcomingTrips: '/owners/dashboard/upcoming-trips',
  dashboardAlerts: '/owners/dashboard/alerts',

  // VEHICLES
  vehicles: '/owners/vehicles',
  vehicleById: (id: string) => `/owners/vehicles/${id}`,
  vehicleHistory: (id: string) => `/owners/vehicles/${id}/history`,
  vehicleExpenses: (id: string) => `/owners/vehicles/${id}/expenses`,
  vehicleExpenseAction: (vehicleId: string, expenseId: string) => `/owners/vehicles/${vehicleId}/expenses/${expenseId}`,
  assignDriver: (vehicleId: string) => `/owners/vehicles/${vehicleId}/assign-driver`,
  unassignDriver: (vehicleId: string) => `/owners/vehicles/${vehicleId}/unassign-driver`,

  // DRIVERS
  drivers: '/owners/drivers',
  driverById: (id: string) => `/owners/drivers/${id}`,

  // TRIPS
  trips: '/owners/trips',
  tripById: (id: string) => `/owners/trips/${id}`,
  tripCancel: (id: string) => `/owners/trips/${id}/cancel`,
  assignDriverToTrip: (tripId: string) => `/owners/trips/${tripId}/assign-driver`,
  unassignDriverFromTrip: (tripId: string) => `/owners/trips/${tripId}/unassign-driver`,

  // HISTORY
  historyTrips: '/owners/trips/history',

  // ANALYTICS
  analyticsOverview: '/owners/analytics/overview',
};
