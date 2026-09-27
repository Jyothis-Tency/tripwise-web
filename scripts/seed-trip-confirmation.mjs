/**
 * Seed Trip Confirmation preloads into the browser.
 *
 * Usage (from tripwise-web):
 *   npm run seed:trip-confirmation
 *
 * Then open the app → Trip Confirmation → Edit template → "Reset to seed"
 * (or clear site localStorage and reload — first load applies the seed).
 *
 * Edit source of truth:
 *   src/features/trip-confirmation/seed.ts
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Keep in sync with src/features/trip-confirmation/seed.ts */
const TRIP_CONFIRMATION_SEED = {
  companyName: "INWAY CABS",
  documentTitle: "",
  tripFieldNames: [
    "Trip",
    "Duration",
    "Vehicle",
    "Package",
    "KM Calculation",
  ],
  packagePriceHeading: "PACKAGE PRICE",
  packageIncludesTitle: "Package Includes:",
  packageIncludesItems: [],
  extraKmLabel: "Extra KM",
  tripDetailsHeading: "TRIP DETAILS",
  tripDetailFieldNames: [
    "Arrival",
    "Departure",
    "Pickup",
    "Drop",
    "Pickup Time",
  ],
  bookingHeading: "BOOKING CONFIRMATION",
  advanceLabel: "Advance",
  bookingConfirmSentence:
    "Booking will be confirmed upon receipt of the advance.",
  balanceSentence:
    "Balance: Payable directly to the driver before completion of the trip.",
  paymentHeading: "PAYMENT DETAILS",
  paymentFields: [
    { label: "UPI ID", value: "nebeel2688-1@okhdfcbank" },
    { label: "G Pay / PhonePe", value: "8086556655" },
  ],
  bankLines: [
    "HDFC Bank | Current Account",
    "A/C: 50200096785876",
    "IFSC: HDFC0007323",
    "Branch: Thammanam",
  ],
  vehicleAvailableSentence: "Vehicle available on pre-booking basis only.",
  footerBrand: "★ INWAY CABS",
  footerTagline:
    "Professional Service • Clean Vehicles • Experienced Drivers • Customer Satisfaction",
};

const out = join(
  __dirname,
  "../src/features/trip-confirmation/seed.generated.json",
);
writeFileSync(out, JSON.stringify(TRIP_CONFIRMATION_SEED, null, 2) + "\n");

console.log("Trip Confirmation seed written to:");
console.log(" ", out);
console.log("");
console.log("Preloaded:");
console.log("  • Company:", TRIP_CONFIRMATION_SEED.companyName);
console.log(
  "  • Payment:",
  TRIP_CONFIRMATION_SEED.paymentFields
    .map((f) => `${f.label}=${f.value}`)
    .join(", "),
);
console.log("  • Bank lines:", TRIP_CONFIRMATION_SEED.bankLines.length);
console.log("  • Sentences: booking, balance, vehicle, tagline");
console.log("");
console.log("Not preloaded (fill per trip):");
console.log("  • Document title, trip→booking fields, package includes/price");
console.log("");
console.log(
  'In the app: Edit template → "Reset to seed" to apply into localStorage.',
);
