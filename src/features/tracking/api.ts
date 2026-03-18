import apiClient from '../../services/axios';
import { ApiEndpoints } from '../../services/apiEndpoints';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface TrackingVehicle {
  vehicle: {
    _id?: string;
    id?: string;
    vehicleNumber: string;
    vehicleType?: string;
    vehicleModel?: string;
    vehicleYear?: string | number;
    status?: string;
  };
  driver: {
    _id?: string;
    id?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
  } | null;
  activeTrip: {
    _id?: string;
    id?: string;
    tripNumber?: string;
    from?: string;
    to?: string;
    status?: string;
    priority?: string;
    startDate?: string;
    expectedEndDate?: string;
    distance?: string | number;
    customer?: string;
    agencyCost?: string | number;
    cabCost?: string | number;
    ownerProfit?: string | number;
    agencyName?: string;
    startKilometers?: number;
    careOf?: { name?: string; phone?: string };
    expenses?: {
      _id?: string;
      type?: string;
      amount?: number | string;
      description?: string;
    }[];
  } | null;
}

// ─── API Calls ───────────────────────────────────────────────────────────────

export async function fetchTrackingVehicles(): Promise<TrackingVehicle[]> {
  const res = await apiClient.get(ApiEndpoints.trackingVehicles);
  const raw: any = res.data ?? {};
  const root = raw.data ?? raw;

  // Backend can return { vehicles: [...] } or array directly
  const list: any[] = Array.isArray(root)
    ? root
    : root.vehicles ?? root.items ?? root.documents ?? [];

  return list.map(mapTrackingVehicle);
}

export async function completeTrip(
  tripId: string,
  endKilometers: number,
): Promise<void> {
  await apiClient.put(ApiEndpoints.tripById(tripId), {
    status: 'completed',
    endKilometers,
  });
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

function mapTrackingVehicle(raw: any): TrackingVehicle {
  return {
    vehicle: raw.vehicle ?? {},
    driver: raw.driver ?? null,
    activeTrip: raw.activeTrip ?? null,
  };
}
