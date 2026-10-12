import { apiClient } from '../../services/axios';
import { ApiEndpoints } from '../../services/apiEndpoints';

/* ── Types ─────────────────────────────────────────────── */
export interface Expense {
  _id: string;
  id?: string;
  title?: string;
  description?: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TripExpense {
  _id: string;
  id?: string;
  description?: string;
  amount: number;
  category?: string;
  type?: string;
  date?: string;
  paidBy?: 'Company' | 'Personal';
  receiptPath?: string | null;
}

export interface TripWithExpenses {
  _id: string;
  id?: string;
  tripNumber?: string;
  customer?: string;
  fromLocation?: string;
  toLocation?: string;
  startDate?: string;
  status?: string;
  /** Mongo id of the trip's vehicle, when API returns populated or raw id */
  vehicleId?: string;
  driver?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  } | null;
  vehicle?: {
    _id?: string;
    vehicleNumber?: string;
    vehicleModel?: string;
    vehicleType?: string;
  } | null;
  fuelExpense?: number;
  expenses: TripExpense[];
  totalExpenses?: number;
}

export interface CreateExpensePayload {
  title?: string;
  description?: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
}

/* ── Helpers ───────────────────────────────────────────── */
function extract(axiosRes: any) {
  const body = axiosRes?.data ?? axiosRes;
  return body?.data ?? body;
}

/* ── Personal Expenses ─────────────────────────────────── */

export async function fetchExpenses(params?: {
  page?: number; limit?: number; search?: string; category?: string;
  startDate?: string; endDate?: string;
}): Promise<{ expenses: Expense[]; pagination?: any }> {
  const qp = new URLSearchParams();
  if (params?.page) qp.set('page', String(params.page));
  if (params?.limit) qp.set('limit', String(params.limit));
  if (params?.search) qp.set('search', params.search);
  if (params?.category) qp.set('category', params.category);
  if (params?.startDate) qp.set('startDate', params.startDate);
  if (params?.endDate) qp.set('endDate', params.endDate);
  const qs = qp.toString();
  const res = await apiClient.get(`${ApiEndpoints.expenses}${qs ? '?' + qs : ''}`);
  const inner = extract(res);
  const expenses: Expense[] = Array.isArray(inner?.expenses) ? inner.expenses : Array.isArray(inner) ? inner : [];
  return { expenses, pagination: inner?.pagination };
}

export async function createExpense(data: CreateExpensePayload): Promise<Expense> {
  const res = await apiClient.post(ApiEndpoints.expenses, data);
  return extract(res);
}

export async function updateExpense(id: string, data: Partial<CreateExpensePayload>): Promise<Expense> {
  const res = await apiClient.put(ApiEndpoints.expenseById(id), data);
  return extract(res);
}

export async function deleteExpense(id: string): Promise<void> {
  await apiClient.delete(ApiEndpoints.expenseById(id));
}

export async function fetchExpenseCategories(): Promise<string[]> {
  try {
    const res = await apiClient.get(ApiEndpoints.expenseCategories);
    const inner = extract(res);
    return Array.isArray(inner) ? inner : [];
  } catch {
    return [];
  }
}

/* ── Trip Expenses ─────────────────────────────────────── */

export async function fetchTripsWithExpenses(params?: {
  page?: number; limit?: number; search?: string;
}): Promise<{ trips: TripWithExpenses[]; pagination?: any }> {
  const qp = new URLSearchParams();
  if (params?.page) qp.set('page', String(params.page));
  if (params?.limit) qp.set('limit', String(params.limit));
  if (params?.search) qp.set('search', params.search);
  const qs = qp.toString();
  const res = await apiClient.get(`${ApiEndpoints.tripsWithExpenses}${qs ? '?' + qs : ''}`);
  const inner = extract(res);
  const rawTrips: any[] = Array.isArray(inner?.trips) ? inner.trips : Array.isArray(inner) ? inner : [];
  // Backend returns { trip: { _id, from, to, driver, vehicle, ... }, expenses: [...], totalExpenses, fuelExpense }
  // Flatten into our TripWithExpenses shape
  const trips: TripWithExpenses[] = rawTrips.map((item: any) => {
    const t = item.trip ?? item;
    const veh = t.vehicle;
    let vehicleId: string | undefined;
    if (veh && typeof veh === 'object' && veh._id != null) {
      vehicleId = String(veh._id);
    } else if (typeof veh === 'string') {
      vehicleId = veh;
    }

    const rawExpenses = item.expenses ?? t.expenses ?? [];
    const expenses: TripExpense[] = Array.isArray(rawExpenses)
      ? rawExpenses.map((exp: any) => ({
          _id: exp._id || exp.id || '',
          id: exp.id || exp._id || '',
          description: exp.description || '',
          amount: Number(exp.amount) || 0,
          category: exp.category || exp.type,
          type: exp.type || exp.category,
          date: exp.date || exp.createdAt,
          paidBy: (exp.paidBy === 'Personal' ? 'Personal' : 'Company') as 'Company' | 'Personal',
          receiptPath: exp.receiptPath || null,
        }))
      : [];

    return {
      _id: t._id || t.id || item._id || item.id || '',
      id: t.id || t._id || item._id || item.id || '',
      tripNumber: t.tripNumber,
      customer: t.customer,
      fromLocation: t.from || t.fromLocation || '',
      toLocation: t.to || t.toLocation || '',
      startDate: t.startDate || t.date,
      status: t.status,
      vehicleId,
      driver: t.driver && typeof t.driver === 'object' ? t.driver : null,
      vehicle: veh && typeof veh === 'object' ? veh : null,
      fuelExpense: Number(item.fuelExpense) || 0,
      expenses,
      totalExpenses: Number(item.totalExpenses) || 0,
    };
  });
  return { trips, pagination: inner?.pagination };
}

export interface AddTripExpensePayload {
  description?: string;
  amount: number;
  category?: string;
  type?: string;
  date?: string;
  paidBy?: 'Company' | 'Personal';
  receiptPath?: string | null;
}

export async function addTripExpense(tripId: string, data: AddTripExpensePayload): Promise<any> {
  // Backend expects `type` (Trip embedded expense enum). Frontend historically sent `category` only.
  const type = data.type ?? data.category;
  const res = await apiClient.post(ApiEndpoints.tripExpenses(tripId), { ...data, type });
  return extract(res);
}

export async function updateTripExpense(tripId: string, expenseId: string, data: Partial<AddTripExpensePayload>): Promise<any> {
  const type = data.type ?? data.category;
  const payload = type !== undefined ? { ...data, type } : data;
  const res = await apiClient.put(ApiEndpoints.tripExpenseById(tripId, expenseId), payload);
  return extract(res);
}

export async function deleteTripExpense(tripId: string, expenseId: string): Promise<void> {
  await apiClient.delete(ApiEndpoints.tripExpenseById(tripId, expenseId));
}
