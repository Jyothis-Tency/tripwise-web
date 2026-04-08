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
  assignDriver: (vehicleId: string) => `/owners/vehicles/assign-driver/${vehicleId}`,
  unassignDriver: (vehicleId: string) => `/owners/vehicles/unassign-driver/${vehicleId}`,

  // DRIVERS
  drivers: '/owners/drivers',
  driverById: (id: string) => `/owners/drivers/${id}`,
  driverBlock: (id: string) => `/owners/drivers/${id}/block`,
  driverUnblock: (id: string) => `/owners/drivers/${id}/unblock`,
  driverSalary: (id: string) => `/owners/drivers/${id}/salary`,
  driverTrips: (id: string) => `/owners/drivers/${id}/trips`,
  driverSalaryTransactions: (driverId: string) => `/owners/drivers/${driverId}/salary/transactions`,
  driverSalaryTransactionById: (id: string) => `/owners/driver-salary/${id}`,

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

  // TRACKING
  trackingVehicles: '/owners/tracking/vehicles',
  trackingVehicleById: (id: string) => `/owners/tracking/vehicles/${id}`,

  // AGENCIES
  agencies: '/owners/agencies',
  agencyById: (id: string) => `/owners/agencies/${id}`,

  // BULK ENTRY
  bulkEntryTrips: '/owners/bulk-entry/trips',
  bulkEntrySync: '/owners/bulk-entry/sync',
  bulkEntryTripById: (id: string) => `/owners/bulk-entry/trips/${id}`,

  // NORMAL ENTRY
  normalEntry: '/owners/normal-entry',
  normalEntryTrips: '/owners/normal-entry/trips',
  normalEntryTripById: (id: string) => `/owners/normal-entry/trips/${id}`,
  normalEntrySync: '/owners/normal-entry/sync',

  // REMINDERS
  reminders: '/owners/reminders',
  reminderById: (id: string) => `/owners/reminders/${id}`,
  completeReminder: (id: string) => `/owners/reminders/${id}/complete`,

  // EXPENSES (Personal)
  expenses: '/owners/expenses',
  expenseById: (id: string) => `/owners/expenses/${id}`,
  expenseCategories: '/owners/expenses/categories',

  // EXPENSES (Trip)
  tripsWithExpenses: '/owners/trips/expenses',
  tripExpenses: (tripId: string) => `/owners/trips/${tripId}/expenses`,
  tripExpenseById: (tripId: string, expenseId: string) => `/owners/trips/${tripId}/expenses/${expenseId}`,
};
