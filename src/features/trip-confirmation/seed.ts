/**
 * Trip Confirmation seed — preloadable defaults only.
 *
 * Differs every trip (NOT seeded as values):
 * - Document title
 * - Trip → Booking Confirmation (fields, route, package price, package includes, advance)
 *
 * Preloaded (same most of the time):
 * - Company name
 * - Payment details
 * - Bank / account lines
 * - Fixed sentences (booking, balance, vehicle, tagline)
 */

export type SeedField = { label: string; value: string };

export type TripConfirmationSeed = {
  companyName: string;
  /** Empty — changes every quotation */
  documentTitle: string;
  /** Field names only — values filled per trip */
  tripFieldNames: string[];
  packagePriceHeading: string;
  packageIncludesTitle: string;
  /** Empty — package includes change every trip */
  packageIncludesItems: string[];
  extraKmLabel: string;
  tripDetailsHeading: string;
  tripDetailFieldNames: string[];
  bookingHeading: string;
  advanceLabel: string;
  /** Preloaded sentences */
  bookingConfirmSentence: string;
  balanceSentence: string;
  paymentHeading: string;
  paymentFields: SeedField[];
  bankLines: string[];
  vehicleAvailableSentence: string;
  footerBrand: string;
  footerTagline: string;
};

/** Canonical seed from INWAY CABS quotation layout. */
export const TRIP_CONFIRMATION_SEED: TripConfirmationSeed = {
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
    "Driver Name",
    "Driver Number",
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
