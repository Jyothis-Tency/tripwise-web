export type ConfirmationTableRow = {
  id: string;
  label: string;
  value: string;
  isBold?: boolean;
};

export type ConfirmationSection = {
  id: string;
  title: string;
  rows: ConfirmationTableRow[];
};

export type TripConfirmationDocument = {
  companyName: string;
  subtitle: string;
  documentTitle: string;
  sections: ConfirmationSection[];
  preBookingNote: string;
  footerBrand: string;
  footerTagline: string;
  footerContact: string;
};

export const DEFAULT_INWAY_CONFIRMATION_DATA: TripConfirmationDocument = {
  companyName: "INWAY CABS",
  subtitle: "Premium Taxi Service · Kochi",
  documentTitle: "TRIP CONFIRMATION",
  sections: [
    {
      id: "overview",
      title: "TRIP OVERVIEW",
      rows: [
        { id: "cust", label: "Customer Name", value: "" },
        { id: "trip", label: "Trip", value: "Cochin to Munnar" },
        { id: "duration", label: "Duration", value: "4 days 3 nights" },
        { id: "vehicle", label: "Vehicle", value: "Urbania", isBold: true },
        { id: "package", label: "Package", value: "Up to 500 km" },
        { id: "km_calc", label: "KM Calculation", value: "Garage to garage" },
        { id: "route", label: "Route", value: "Cochin local and Munnar" },
        { id: "sightseeing", label: "Sightseeing", value: "Munnar all sight seen" },
      ],
    },
    {
      id: "price",
      title: "PACKAGE PRICE",
      rows: [
        { id: "pkg_price", label: "Package Price", value: "35500/-", isBold: true },
        { id: "pkg_includes", label: "Package includes", value: "Tolls parking driver exp and fuel" },
        { id: "extra_km", label: "Extra km", value: "30" },
      ],
    },
    {
      id: "details",
      title: "TRIP DETAILS",
      rows: [
        { id: "dates", label: "Trip Dates", value: "14/01/27 to 17/01/27" },
        { id: "arrival", label: "Arrival", value: "14/01/27" },
        { id: "departure", label: "Departure", value: "17/01/27" },
        { id: "pickup", label: "Pickup", value: "Cochin" },
        { id: "drop", label: "Drop", value: "Cochin" },
      ],
    },
    {
      id: "booking",
      title: "BOOKING CONFIRMATION",
      rows: [
        { id: "adv", label: "Advance", value: "5000/-", isBold: true },
        { id: "confirm", label: "Confirmation", value: "Booking will be confirmed upon receipt of the advance." },
        { id: "balance", label: "Balance", value: "Payable directly to the driver before completion of the trip." },
      ],
    },
    {
      id: "payment",
      title: "PAYMENT DETAILS",
      rows: [
        { id: "upi", label: "UPI ID", value: "nebeel2688-1@okhdfcbank" },
        { id: "gpay", label: "GPay / PhonePe", value: "8086556655" },
        { id: "bank", label: "Bank", value: "HDFC Bank | Current Account" },
        { id: "ac_name", label: "Account Name", value: "INWAY CABS", isBold: true },
        { id: "ac_no", label: "A/C No.", value: "50200096785876", isBold: true },
        { id: "ifsc", label: "IFSC", value: "HDFC0007323" },
        { id: "branch", label: "Branch", value: "Thammanam" },
      ],
    },
  ],
  preBookingNote: "Vehicle available on pre-booking basis only.",
  footerBrand: "INWAY CABS",
  footerTagline: "Professional Service • Clean Vehicles • Experienced Drivers • Customer Satisfaction",
  footerContact: "+91 80865 56655 · inwaycabs@gmail.com · inwaycabs.in",
};

