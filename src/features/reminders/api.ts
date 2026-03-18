import { apiClient } from '../../services/axios';
import { ApiEndpoints } from '../../services/apiEndpoints';

/* ── Types ─────────────────────────────────────────────── */
export interface Reminder {
  _id: string;
  id?: string;
  customerName: string;
  customerPhone?: string;
  fromLocation: string;
  toLocation: string;
  tripDate: string;
  message?: string;
  isCompleted: boolean;
  daysUntilTrip?: number;
  vehicleAssigned?: boolean;
  driverAssigned?: boolean;
  advanceCollected?: number;
  totalPayment?: number;
  vehicleDetails?: { vehicleType?: string };
  tripId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateReminderPayload {
  customerName: string;
  customerPhone?: string;
  fromLocation: string;
  toLocation: string;
  tripDate: string;
  message?: string;
  vehicleDetails?: { vehicleType?: string };
  advanceCollected?: number;
  totalPayment?: number;
}

/* ── Helpers ───────────────────────────────────────────── */
function extract(axiosRes: any) {
  const body = axiosRes?.data ?? axiosRes;
  return body?.data ?? body;
}

/* ── API Functions ─────────────────────────────────────── */

export async function fetchReminders(params?: { page?: number; limit?: number; isCompleted?: boolean }): Promise<{ reminders: Reminder[]; pagination?: any }> {
  const qp = new URLSearchParams();
  if (params?.page) qp.set('page', String(params.page));
  if (params?.limit) qp.set('limit', String(params.limit));
  if (params?.isCompleted !== undefined) qp.set('isCompleted', String(params.isCompleted));
  const qs = qp.toString();
  const res = await apiClient.get(`${ApiEndpoints.reminders}${qs ? '?' + qs : ''}`);
  const inner = extract(res);
  const reminders: Reminder[] = Array.isArray(inner?.reminders) ? inner.reminders : Array.isArray(inner) ? inner : [];
  return { reminders, pagination: inner?.pagination };
}

export async function createReminder(data: CreateReminderPayload): Promise<Reminder> {
  const res = await apiClient.post(ApiEndpoints.reminders, data);
  return extract(res);
}

export async function updateReminder(id: string, data: Partial<CreateReminderPayload>): Promise<Reminder> {
  const res = await apiClient.put(ApiEndpoints.reminderById(id), data);
  return extract(res);
}

export async function deleteReminder(id: string): Promise<void> {
  await apiClient.delete(ApiEndpoints.reminderById(id));
}

export async function completeReminder(id: string): Promise<Reminder> {
  const res = await apiClient.put(ApiEndpoints.completeReminder(id), {});
  return extract(res);
}
