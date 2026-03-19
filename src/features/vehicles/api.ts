import apiClient from '../../services/axios';
import { ApiEndpoints } from '../../services/apiEndpoints';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Vehicle {
  _id: string;
  vehicleNumber: string;
  vehicleType?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  status?: string;
  commission?: number;
  seats?: number;
  currentDriverName?: string;
  driverId?: string;
  currentDriver?: Record<string, unknown> | null;
  currentTrip?: Record<string, unknown> | null;
  activeTrip?: Record<string, unknown> | null;
  tripDetails?: { from?: string; to?: string } | null;
  tripFrom?: string;
  tripTo?: string;
  totalTrips?: number;
  totalKm?: number;
  trips?: TripItem[];
}

export interface VehiclesResponse {
  items: Vehicle[];
  total: number;
  page: number;
  limit: number;
}

export interface TripItem {
  _id: string;
  tripNumber?: string;
  from?: string;
  to?: string;
  status?: string;
  amount?: number;
  startDate?: string;
  expectedEndDate?: string;
  departureDate?: string;
  distance?: number;
  customer?: string;
  priority?: string;
  agencyCost?: number;
  cabCost?: number;
  agencyName?: string;
  ownerProfit?: number | string;
  advance?: number;
  notes?: string;
  careOf?: {
    name?: string;
    phone?: string;
  };
  driver?: {
    _id?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    phone?: string;
  } | null;
}

export interface DriverItem {
  _id: string;
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status?: string;
  isAvailable?: boolean;
}

export interface ExpenseItem {
  _id: string;
  date?: string;
  category?: string;
  amount?: number;
  notes?: string;
  description?: string;
  vendor?: string;
}

export interface HistoryTripItem {
  _id: string;
  tripNumber?: string;
  from?: string;
  to?: string;
  status?: string;
  departureDate?: string;
  startDate?: string;
  completedAt?: string;
  driverName?: string;
  distance?: string | number;
  startKilometers?: number;
  endKilometers?: number;
  totalExpenses?: number;
  driver_salary?: number;
  ownerProfit?: number;
  agencyCost?: number;
  cabCost?: number;
  driver?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
  } | string | null;
  vehicle?: {
    _id?: string;
    vehicleNumber?: string;
    vehicleModel?: string;
    vehicleType?: string;
  } | string | null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapTrip(t: any): TripItem {
  return {
    _id: t._id ?? t.id ?? t.tripId ?? '',
    tripNumber: t.tripNumber,
    from: t.from,
    to: t.to,
    status: t.status,
    amount: t.amount ?? t.fare,
    startDate: t.startDate,
    expectedEndDate: t.expectedEndDate,
    departureDate: t.departureDate ?? t.date,
    distance: t.distance,
    customer: t.customer,
    priority: t.priority,
    agencyCost: t.agencyCost,
    cabCost: t.cabCost,
    agencyName: t.agencyName,
    ownerProfit: t.ownerProfit,
    advance: t.advance,
    notes: t.notes,
    careOf: t.careOf,
    driver: t.driver ?? null,
  };
}

function mapVehicle(v: any): Vehicle {
  const driverName =
    v.driverName ??
    v.currentDriver?.fullName ??
    v.currentDriver?.name ??
    (v.currentDriver
      ? `${v.currentDriver.firstName ?? ''} ${v.currentDriver.lastName ?? ''}`.trim()
      : undefined);

  const trips: TripItem[] = Array.isArray(v.trips) ? v.trips.map(mapTrip) : [];

  return {
    _id: v._id ?? v.id ?? '',
    vehicleNumber: v.vehicleNumber ?? v.vehicleNo ?? '',
    vehicleType: v.vehicleType ?? v.type,
    vehicleModel: v.vehicleModel ?? v.model,
    vehicleYear: v.vehicleYear?.toString() ?? v.year?.toString(),
    status: v.status ?? 'Available',
    commission:
      typeof v.commission === 'number'
        ? v.commission
        : v.commission
          ? parseFloat(v.commission)
          : undefined,
    seats: v.seats,
    currentDriverName: driverName || undefined,
    driverId: v.driverId,
    currentDriver: v.currentDriver ?? null,
    currentTrip: v.currentTrip ?? null,
    activeTrip: v.activeTrip ?? null,
    tripDetails: v.tripDetails ?? null,
    tripFrom: v.tripFrom ?? (v.tripDetails as any)?.from,
    tripTo: v.tripTo ?? (v.tripDetails as any)?.to,
    totalTrips: v.totalTrips ?? 0,
    totalKm: v.totalKm ?? 0,
    trips,
  };
}

// ─── Vehicle CRUD ─────────────────────────────────────────────────────────────

export async function fetchVehicles(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<VehiclesResponse> {
  const { page = 1, limit = 20, search, status } = params ?? {};

  let query = `?page=${page}&limit=${limit}`;
  if (search) query += `&search=${encodeURIComponent(search)}`;
  if (status) query += `&status=${encodeURIComponent(status)}`;

  const res = await apiClient.get(ApiEndpoints.vehicles + query);
  const raw: any = res.data ?? {};
  const root = raw.data ?? raw;
  const data = root.data ?? root;

  const vehiclesNode: any = data.vehicles ?? data;
  const documents: any[] =
    vehiclesNode.documents ??
    vehiclesNode.items ??
    (Array.isArray(vehiclesNode) ? vehiclesNode : []);

  const items: Vehicle[] = documents.map(mapVehicle);

  return {
    items,
    total: Number(data.pagination?.total ?? data.total ?? items.length),
    page: Number(data.pagination?.page ?? data.page ?? page),
    limit: Number(data.pagination?.limit ?? data.limit ?? limit),
  };
}

export async function fetchVehicleById(id: string): Promise<Vehicle> {
  const res = await apiClient.get(ApiEndpoints.vehicleById(id));
  const raw: any = res.data ?? {};
  const data = raw.data ?? raw;
  return mapVehicle(data);
}

export async function createVehicle(payload: {
  vehicleNumber: string;
  vehicleType: string;
  vehicleModel: string;
  vehicleYear?: number;
  seats?: number;
  commission?: number;
}): Promise<Vehicle> {
  const res = await apiClient.post(ApiEndpoints.vehicles, payload);
  const raw: any = res.data ?? {};
  const data = raw.data ?? raw;
  return mapVehicle(data);
}

export async function updateVehicle(
  id: string,
  payload: {
    vehicleNumber?: string;
    vehicleType?: string;
    vehicleModel?: string;
    vehicleYear?: number;
    seats?: number;
    commission?: number;
    status?: string;
  },
): Promise<Vehicle> {
  const res = await apiClient.put(ApiEndpoints.vehicleById(id), payload);
  const raw: any = res.data ?? {};
  const data = raw.data ?? raw;
  return mapVehicle(data);
}

// ─── Vehicle History & Expenses ───────────────────────────────────────────────

export interface VehicleHistoryResponse {
  vehicle?: any;
  trips: HistoryTripItem[];
  tripStats?: {
    total?: number;
    scheduled?: number;
    inProgress?: number;
    completed?: number;
    cancelled?: number;
  };
  financialStats?: {
    totalRevenue?: number;
    totalDriverSalary?: number;
    ownerRevenue?: number;
    totalExpenses?: number;
    vehicleExpenses?: number;
  };
  pagination?: {
    current?: number;
    pages?: number;
    total?: number;
  };
}

export async function fetchVehicleHistoryDetailed(params: {
  vehicleId: string;
  page?: number;
  limit?: number;
  status?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}): Promise<VehicleHistoryResponse> {
  const {
    vehicleId,
    page = 1,
    limit = 10,
    status,
    startDate,
    endDate,
  } = params;

  const clean: Record<string, string | number> = { page, limit };
  if (status && status !== 'all') clean.status = status;
  if (startDate) clean.startDate = startDate;
  if (endDate) clean.endDate = endDate;

  const res = await apiClient.get(ApiEndpoints.vehicleHistory(vehicleId), { params: clean });
  const raw: any = res.data ?? {};
  const data = raw.data ?? raw;

  const tripsRaw: any[] = Array.isArray(data.trips) ? data.trips : [];

  return {
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
    })),
  };
}

export async function fetchVehicleExpenses(vehicleId: string): Promise<ExpenseItem[]> {
  const res = await apiClient.get(ApiEndpoints.vehicleExpenses(vehicleId));
  const raw: any = res.data ?? {};
  const root = raw.data ?? raw;
  const list: any[] = Array.isArray(root) ? root : root.expenses ?? root.documents ?? [];
  return list.map((e: any) => ({
    _id: e._id ?? e.id ?? '',
    date: e.date ?? e.createdAt,
    category: e.category ?? e.type,
    amount: e.amount,
    notes: e.notes ?? e.description,
    description: e.description,
    vendor: e.vendor ?? e.vendorName,
  }));
}

export async function createVehicleExpense(
  vehicleId: string,
  payload: {
    category: string;
    description: string;
    amount: number;
    date: string;
    vendor?: string;
  },
): Promise<ExpenseItem> {
  const res = await apiClient.post(ApiEndpoints.vehicleExpenses(vehicleId), payload);
  const data = res.data?.data ?? res.data;
  return {
    _id: data._id ?? data.id ?? '',
    date: data.date ?? data.createdAt,
    category: data.category ?? data.type,
    amount: data.amount,
    notes: data.notes ?? data.description,
    description: data.description,
    vendor: data.vendor ?? data.vendorName,
  };
}

export async function updateVehicleExpense(
  vehicleId: string,
  expenseId: string,
  payload: Partial<{
    category: string;
    description: string;
    amount: number;
    date: string;
    vendor: string;
  }>,
): Promise<ExpenseItem> {
  const res = await apiClient.put(ApiEndpoints.vehicleExpenseAction(vehicleId, expenseId), payload);
  const data = res.data?.data ?? res.data;
  return {
    _id: data._id ?? data.id ?? '',
    date: data.date ?? data.createdAt,
    category: data.category ?? data.type,
    amount: data.amount,
    notes: data.notes ?? data.description,
    description: data.description,
    vendor: data.vendor ?? data.vendorName,
  };
}

export async function deleteVehicleExpense(vehicleId: string, expenseId: string): Promise<void> {
  await apiClient.delete(ApiEndpoints.vehicleExpenseAction(vehicleId, expenseId));
}

// ─── Drivers ──────────────────────────────────────────────────────────────────

export async function fetchDriversList(): Promise<DriverItem[]> {
  const res = await apiClient.get(ApiEndpoints.drivers + '?limit=100');
  const raw: any = res.data ?? {};
  const root = raw.data ?? raw;
  const data = root.data ?? root;
  const driversNode: any = data.drivers ?? data;
  const list: any[] =
    driversNode.documents ??
    driversNode.items ??
    (Array.isArray(driversNode) ? driversNode : []);
  return list.map((d: any) => ({
    _id: d._id ?? d.id ?? '',
    name: d.name ?? d.fullName ?? `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim(),
    fullName: d.fullName ?? d.name,
    firstName: d.firstName,
    lastName: d.lastName,
    phone: d.phone ?? d.phoneNumber,
    status: d.status,
    isAvailable: d.isAvailable ?? d.status === 'active',
  }));
}

export async function assignDriverToVehicle(vehicleId: string, driverId: string): Promise<void> {
  await apiClient.put(ApiEndpoints.assignDriver(vehicleId), { driverId });
}

export async function unassignDriverFromVehicle(vehicleId: string): Promise<void> {
  await apiClient.put(ApiEndpoints.unassignDriver(vehicleId), {});
}

export async function assignDriverToTrip(tripId: string, driverId: string): Promise<void> {
  await apiClient.put(ApiEndpoints.assignDriverToTrip(tripId), { driverId });
}

export async function unassignDriverFromTripApi(tripId: string): Promise<void> {
  await apiClient.put(ApiEndpoints.unassignDriverFromTrip(tripId), { driverId: null });
}

// ─── Trips ────────────────────────────────────────────────────────────────────

export async function createTrip(payload: {
  vehicleId: string;
  from: string;
  to: string;
  startDate?: string;
  expectedEndDate?: string;
  departureDate?: string;
  distance?: number | string;
  customer?: string;
  priority?: string;
  agencyCost?: number | string;
  cabCost?: number | string;
  agencyName?: string;
  ownerProfit?: number | string;
  advance?: number | string;
  amount?: number;
  notes?: string;
  careOf?: { name?: string; phone?: string };
}): Promise<TripItem> {
  const { vehicleId, ...rest } = payload;
  const res = await apiClient.post(ApiEndpoints.trips, {
    ...rest,
    vehicle: vehicleId,
  });
  const raw: any = res.data ?? {};
  const data = raw.data ?? raw;
  return mapTrip(data);
}

export async function fetchTripById(tripId: string): Promise<TripItem> {
  const res = await apiClient.get(ApiEndpoints.tripById(tripId));
  const raw: any = res.data ?? {};
  const data = raw.data ?? raw;
  return mapTrip(data);
}

export async function updateTrip(
  tripId: string,
  payload: {
    from?: string;
    to?: string;
    startDate?: string;
    expectedEndDate?: string;
    departureDate?: string;
    distance?: number | string;
    customer?: string;
    priority?: string;
    agencyCost?: number | string;
    cabCost?: number | string;
    agencyName?: string;
    ownerProfit?: number | string;
    advance?: number | string;
    amount?: number;
    notes?: string;
    status?: string;
    careOf?: { name?: string; phone?: string };
  },
): Promise<TripItem> {
  const res = await apiClient.put(ApiEndpoints.tripById(tripId), payload);
  const raw: any = res.data ?? {};
  const data = raw.data ?? raw;
  return mapTrip(data);
}

export async function cancelTrip(tripId: string): Promise<void> {
  await apiClient.post(ApiEndpoints.tripCancel(tripId), {});
}
