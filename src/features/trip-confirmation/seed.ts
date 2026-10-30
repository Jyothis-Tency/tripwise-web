/**
 * Trip Confirmation seed — preloadable defaults matching the official Inway Cabs layout.
 */

export type SeedField = { label: string; value: string };

export type TripConfirmationSeed = {
  companyName: string;
  subtitle: string;
  documentTitle: string;
  tripFieldNames: string[];
  packagePriceHeading: string;
  packageIncludesTitle: string;
  packageIncludesItems: string[];
  extraKmLabel: string;
  tripDetailsHeading: string;
  tripDetailFieldNames: string[];
  bookingHeading: string;
  advanceLabel: string;
  bookingConfirmSentence: string;
  balanceSentence: string;
  paymentHeading: string;
  paymentFields: SeedField[];
  bankLines: string[];
  vehicleAvailableSentence: string;
  footerBrand: string;
  footerTagline: string;
  footerContact: string;
};

export const TRIP_CONFIRMATION_SEED: TripConfirmationSeed = {
  companyName: "INWAY CABS",
  subtitle: "Premium Taxi Service · Kochi",
  documentTitle: "TRIP CONFIRMATION",
  tripFieldNames: [
    "Customer Name",
    "Trip",
    "Duration",
    "Vehicle",
    "Package",
    "KM Calculation",
    "Route",
    "Sightseeing",
  ],
  packagePriceHeading: "PACKAGE PRICE",
  packageIncludesTitle: "Package includes",
  packageIncludesItems: ["Tolls parking driver exp and fuel"],
  extraKmLabel: "Extra km",
  tripDetailsHeading: "TRIP DETAILS",
  tripDetailFieldNames: [
    "Trip Dates",
    "Arrival",
    "Departure",
    "Pickup",
    "Drop",
  ],
  bookingHeading: "BOOKING CONFIRMATION",
  advanceLabel: "Advance",
  bookingConfirmSentence:
    "Booking will be confirmed upon receipt of the advance.",
  balanceSentence:
    "Payable directly to the driver before completion of the trip.",
  paymentHeading: "PAYMENT DETAILS",
  paymentFields: [
    { label: "UPI ID", value: "nebeel2688-1@okhdfcbank" },
    { label: "GPay / PhonePe", value: "8086556655" },
    { label: "Bank", value: "HDFC Bank | Current Account" },
    { label: "Account Name", value: "INWAY CABS" },
    { label: "A/C No.", value: "50200096785876" },
    { label: "IFSC", value: "HDFC0007323" },
    { label: "Branch", value: "Thammanam" },
  ],
  bankLines: [],
  vehicleAvailableSentence: "Vehicle available on pre-booking basis only.",
  footerBrand: "INWAY CABS",
  footerTagline:
    "Professional Service • Clean Vehicles • Experienced Drivers • Customer Satisfaction",
  footerContact: "+91 80865 56655 · inwaycabs@gmail.com · inwaycabs.in",
};
