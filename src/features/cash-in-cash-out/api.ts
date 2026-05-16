import apiClient from "../../services/axios";
import { ApiEndpoints } from "../../services/apiEndpoints";

export interface CashInCashOutMoneyBlock {
  totalOwed: number;
  received?: number;
  paid?: number;
  remaining: number;
}

export interface CashInCashOutSummary {
  agencies: {
    cashInBulk: CashInCashOutMoneyBlock;
    cashOutAgencyProfit: {
      totalOwed: number;
      paid: number;
      remaining: number;
    };
  };
  drivers: {
    vehicleBata: {
      totalOwed: number;
      paid: number;
      remaining: number;
    };
    bulkAdvance: {
      totalOwed: number;
      paid: number;
      remaining: number;
    };
  };
}

export async function fetchCashInCashOutSummary(): Promise<CashInCashOutSummary> {
  const res = await apiClient.get(ApiEndpoints.cashInCashOutSummary);
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as CashInCashOutSummary;
}

export async function updateAgencyCashInCashOutAdjustments(
  agencyId: string,
  body: {
    cashInBulkExtra?: number;
    cashInBulkExtraNotes?: string;
    cashOutVehicleExtra?: number;
    cashOutVehicleExtraNotes?: string;
  },
): Promise<{ adjustments: AgencyCashAdjustments }> {
  const res = await apiClient.patch(
    ApiEndpoints.cashInCashOutAgencyAdjustments(agencyId),
    body,
  );
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as { adjustments: AgencyCashAdjustments };
}

export async function recordAgencyProfitPayout(
  agencyId: string,
  body: {
    amount: number;
    paymentDate?: string;
    paymentMethod?: string;
    notes?: string;
  },
): Promise<unknown> {
  const res = await apiClient.post(
    ApiEndpoints.agencyProfitPayoutPayments(agencyId),
    body,
  );
  const raw: any = res.data ?? {};
  return raw.data ?? raw;
}

// ─── Per-entity detail (sidebar + tables) ─────────────────────────────────────

export interface AgencyCashSummaryBlock {
  fromTrips: number;
  manualExtra: number;
  totalOwed: number;
  received?: number;
  paid?: number;
  remaining: number;
}

export interface AgencyCashAdjustments {
  cashInBulk: { amount: number; notes: string };
  cashOutVehicle: { amount: number; notes: string };
}

export interface AgencyCashInCashOutDetail {
  agency: { _id: string; name: string };
  summary: {
    cashInBulk: AgencyCashSummaryBlock & { received: number };
    cashOutAgencyProfit: AgencyCashSummaryBlock & { paid: number };
  };
  adjustments: AgencyCashAdjustments;
  tables: {
    bulkTripsCashIn: Array<{
      _id: string;
      date: string | null;
      driverName: string;
      vehicleNumber: string;
      grandTotal: number;
      advancePaid: number;
      status: string;
      entryMode: string;
    }>;
    bulkReceiptPayments: Array<{
      _id: string;
      amount: number;
      paymentDate: string;
      paymentMethod: string;
      notes: string;
    }>;
    vehicleTripsAgencyProfit: Array<{
      _id: string;
      tripNumber: string;
      from: string;
      to: string;
      date: string | null;
      status: string;
      agencyProfit: number;
    }>;
    agencyProfitPayoutPayments: Array<{
      _id: string;
      amount: number;
      paymentDate: string;
      paymentMethod: string;
      notes: string;
    }>;
    extraAdjustments: Array<{
      _id: string;
      kind: "cash_in_bulk_extra" | "cash_out_vehicle_extra";
      amount: number;
      recordedAt: string | null;
      notes: string;
    }>;
  };
}

export interface DriverCashAdjustments {
  vehicleBata: { amount: number; notes: string };
  bulkAdvance: { amount: number; notes: string };
}

export interface DriverCashInCashOutDetail {
  driver: {
    _id: string;
    firstName: string;
    lastName: string;
    displayName: string;
  };
  summary: {
    vehicleBata: AgencyCashSummaryBlock & { paid: number };
    bulkAdvance: AgencyCashSummaryBlock & { paid: number };
  };
  adjustments: DriverCashAdjustments;
  tables: {
    vehicleTrips: Array<{
      _id: string;
      tripNumber: string;
      from: string;
      to: string;
      date: string | null;
      status: string;
      driverSalary: number;
    }>;
    salaryPayments: Array<{
      _id: string;
      amount: number;
      date: string;
      notes: string;
      type: string;
    }>;
    advanceLedger: Array<{
      _id: string;
      amount: number;
      date: string;
      notes: string;
      type: string;
    }>;
    bulkTripsAdvance: Array<{
      _id: string;
      agencyId: string;
      agencyName: string;
      date: string | null;
      driverName: string;
      vehicleNumber: string;
      advancePaid: number;
      grandTotal: number;
      status: string;
    }>;
    bulkAdvancePayouts: Array<{
      _id: string;
      agencyId: string;
      agencyName: string;
      amount: number;
      paymentDate: string;
      paymentMethod: string;
      notes: string;
      driverName: string;
    }>;
    extraAdjustments: Array<{
      _id: string;
      kind: "vehicle_bata_extra" | "bulk_advance_extra";
      amount: number;
      recordedAt: string | null;
      notes: string;
    }>;
  };
}

export async function updateDriverCashInCashOutAdjustments(
  driverId: string,
  body: {
    vehicleBataExtra?: number;
    vehicleBataExtraNotes?: string;
    bulkAdvanceExtra?: number;
    bulkAdvanceExtraNotes?: string;
  },
): Promise<{ adjustments: DriverCashAdjustments }> {
  const res = await apiClient.patch(
    ApiEndpoints.cashInCashOutDriverAdjustments(driverId),
    body,
  );
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as { adjustments: DriverCashAdjustments };
}

export async function fetchCashInCashOutAgencyDetail(
  agencyId: string,
): Promise<AgencyCashInCashOutDetail> {
  const res = await apiClient.get(ApiEndpoints.cashInCashOutAgencyDetail(agencyId));
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as AgencyCashInCashOutDetail;
}

export async function fetchCashInCashOutDriverDetail(
  driverId: string,
): Promise<DriverCashInCashOutDetail> {
  const res = await apiClient.get(ApiEndpoints.cashInCashOutDriverDetail(driverId));
  const raw: any = res.data ?? {};
  return (raw.data ?? raw) as DriverCashInCashOutDetail;
}
