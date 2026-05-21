import apiClient from "../../services/axios";
import { ApiEndpoints } from "../../services/apiEndpoints";

export type ReportColumnType = "text" | "date" | "currency" | "number";

export interface ReportColumnDef {
  id: string;
  label: string;
  type: ReportColumnType;
  default?: boolean;
}

export interface ReportSource {
  id: string;
  label: string;
  description: string;
  category: string;
}

export interface ReportPreset {
  id: string;
  name: string;
  dataSource: string;
  columns: string[];
  filters: Record<string, string>;
}

export interface ReportCatalog {
  sources: ReportSource[];
  columns: Record<string, ReportColumnDef[]>;
  presets: ReportPreset[];
  limits: { maxRows: number };
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  month?: string;
  status?: string;
  search?: string;
  driverId?: string;
  vehicleId?: string;
  agencyId?: string;
  agencyName?: string;
  driverName?: string;
  paymentType?: string;
  salaryType?: string;
}

export interface ReportRunConfig {
  dataSource: string;
  columns?: string[];
  filters?: ReportFilters;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ReportHeader {
  id: string;
  label: string;
  type: ReportColumnType;
}

export interface ReportRunResult {
  dataSource: string;
  filters: ReportFilters & { startDate?: string | null; endDate?: string | null };
  headers: ReportHeader[];
  rows: Record<string, string | number>[];
  totals: Record<string, number>;
  meta: {
    rowCount: number;
    totalMatched: number;
    truncated: boolean;
    generatedAt: string;
  };
}

export async function fetchReportsCatalog(): Promise<ReportCatalog> {
  const res = await apiClient.get(ApiEndpoints.reportsCatalog);
  const raw: { data?: ReportCatalog } = res.data ?? {};
  return (raw.data ?? raw) as ReportCatalog;
}

export async function runReport(
  config: ReportRunConfig,
): Promise<ReportRunResult> {
  const res = await apiClient.post(ApiEndpoints.reportsRun, config);
  const raw: { data?: ReportRunResult } = res.data ?? {};
  return (raw.data ?? raw) as ReportRunResult;
}
