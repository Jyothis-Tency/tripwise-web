import type { ReportRunConfig } from "./api";

const STORAGE_KEY = "tripwise.savedReports";

export type SavedReport = {
  id: string;
  name: string;
  config: ReportRunConfig;
  updatedAt: string;
};

export function loadSavedReports(): SavedReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSavedReports(reports: SavedReport[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export function upsertSavedReport(name: string, config: ReportRunConfig): SavedReport[] {
  const list = loadSavedReports();
  const id = `sr-${Date.now()}`;
  const entry: SavedReport = {
    id,
    name: name.trim() || "Untitled report",
    config,
    updatedAt: new Date().toISOString(),
  };
  const next = [entry, ...list].slice(0, 30);
  saveSavedReports(next);
  return next;
}

export function deleteSavedReport(id: string): SavedReport[] {
  const next = loadSavedReports().filter((r) => r.id !== id);
  saveSavedReports(next);
  return next;
}
