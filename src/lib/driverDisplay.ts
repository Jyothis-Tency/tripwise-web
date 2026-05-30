import type { Driver } from "../features/drivers/api";

export type DriverDisplayFields = Pick<
  Driver,
  "_id" | "id" | "firstName" | "lastName" | "phone"
>;

/** Full name as stored on trips / Cash In–Out matching. */
export function driverDisplayName(d: DriverDisplayFields): string {
  const name = `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim();
  return name || "Driver";
}

export function formatDriverLabel(d: DriverDisplayFields): string {
  const name = driverDisplayName(d);
  const phone = String(d.phone ?? "").trim();
  return phone ? `${name} · ${phone}` : name;
}

export function splitDriverFullName(full: string): {
  firstName: string;
  lastName: string;
} {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}
