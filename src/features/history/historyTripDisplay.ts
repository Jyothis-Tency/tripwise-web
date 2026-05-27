import type { HistoryTrip } from "./api";

export function isMongoObjectId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value.trim());
}

/** Prefer populated driver doc; use plain name when API only sent an id + driverName. */
export function normalizeHistoryTripDriver(
  driver: HistoryTrip["driver"],
  driverName?: string,
): HistoryTrip["driver"] {
  if (driver && typeof driver === "object") {
    if (
      driver.firstName != null ||
      driver.lastName != null ||
      driver.phone != null
    ) {
      return driver;
    }
  }
  const name = driverName?.trim();
  if (name) return name;
  if (typeof driver === "string" && driver.trim() && !isMongoObjectId(driver)) {
    return driver.trim();
  }
  return driver ?? undefined;
}

export function normalizeHistoryTripVehicle(
  vehicle: HistoryTrip["vehicle"],
  vehicleNumber?: string,
): HistoryTrip["vehicle"] {
  if (vehicle && typeof vehicle === "object") {
    if (
      vehicle.vehicleNumber != null ||
      vehicle.vehicleModel != null ||
      vehicle.vehicleType != null
    ) {
      return vehicle;
    }
  }
  const num = vehicleNumber?.trim();
  if (num) return num;
  if (
    typeof vehicle === "string" &&
    vehicle.trim() &&
    !isMongoObjectId(vehicle)
  ) {
    return vehicle.trim();
  }
  return vehicle ?? undefined;
}

export function historyDriverName(
  driver: HistoryTrip["driver"],
  fallbackName?: string,
): string {
  if (typeof driver === "object" && driver) {
    const nm = `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim();
    if (nm) return nm;
    const anyDriver = driver as { fullName?: string; name?: string };
    if (anyDriver.fullName?.trim()) return anyDriver.fullName.trim();
    if (anyDriver.name?.trim()) return anyDriver.name.trim();
  }
  if (typeof driver === "string" && driver.trim()) {
    return isMongoObjectId(driver) ? fallbackName?.trim() || "—" : driver.trim();
  }
  return fallbackName?.trim() || "—";
}

export function historyVehicleNumber(
  vehicle: HistoryTrip["vehicle"],
  fallbackNumber?: string,
): string {
  if (typeof vehicle === "object" && vehicle) {
    if (vehicle.vehicleNumber?.trim()) return vehicle.vehicleNumber.trim();
    const anyVehicle = vehicle as { vehicleNo?: string };
    if (anyVehicle.vehicleNo?.trim()) return anyVehicle.vehicleNo.trim();
  }
  if (typeof vehicle === "string" && vehicle.trim()) {
    return isMongoObjectId(vehicle)
      ? fallbackNumber?.trim() || "—"
      : vehicle.trim();
  }
  return fallbackNumber?.trim() || "—";
}
