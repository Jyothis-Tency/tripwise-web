import type { HistoryTrip } from "../../history/api";
import type { ReportFieldSelection } from "../reportFieldConfig";
import { buildReportCardLines } from "../tripReportCardLayout";
import { toTripReportRow } from "../tripReportFormat";

function DetailLine({ label, value }: { label: string; value: string }) {
  const isCab = label === "Cab Cost";
  return (
    <p className="text-[13px] leading-snug text-slate-800">
      <span className="font-bold text-slate-900">{label}</span>
      {isCab ? " " : " "}
      {value}
    </p>
  );
}

function TripReportCard({
  index,
  tripNumber,
  lines,
}: {
  index: number;
  tripNumber: string;
  lines: ReturnType<typeof buildReportCardLines>;
}) {
  const hasBody =
    lines.left.length > 0 || lines.middle.length > 0 || lines.right.length > 0;

  return (
    <article className="rounded-md border border-slate-300 bg-white px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-4 sm:gap-y-1">
        <p className="text-sm font-bold text-slate-900 shrink-0">
          Trip {index + 1}: {tripNumber}
        </p>
        {lines.header.map((h) => (
          <p key={h.label} className="text-[13px] text-slate-800 min-w-0">
            <span className="font-bold">{h.label}</span> {h.value}
          </p>
        ))}
      </div>

      {hasBody && (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          <div className="space-y-1 min-h-[1rem]">
            {lines.left.map((ln) => (
              <DetailLine key={ln.label} label={ln.label} value={ln.value} />
            ))}
          </div>
          <div className="space-y-1 min-h-[1rem]">
            {lines.middle.map((ln) => (
              <DetailLine key={ln.label} label={ln.label} value={ln.value} />
            ))}
          </div>
          <div className="space-y-1 min-h-[1rem]">
            {lines.right.map((ln) => (
              <DetailLine key={ln.label} label={ln.label} value={ln.value} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export function TripReportPreviewDocument({
  trips,
  totalTrips,
  fieldSelection,
  title = "Trip History Report",
  subtitle,
  resolveAgencyLabel,
  pageNote,
  tripIndexOffset = 0,
}: {
  trips: HistoryTrip[];
  totalTrips: number;
  fieldSelection: ReportFieldSelection;
  title?: string;
  subtitle?: string;
  resolveAgencyLabel: (agencyName?: string) => string;
  pageNote?: string;
  tripIndexOffset?: number;
}) {
  const generatedOn = (() => {
    const d = new Date();
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  })();

  return (
    <div className="mx-auto w-full max-w-[210mm] rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900 sm:text-2xl">
              {title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Generated on: {generatedOn}
            </p>
            {subtitle?.trim() && (
              <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
            )}
          </div>
          <p className="text-sm font-bold text-slate-900 tabular-nums">
            Total Trips: {totalTrips.toLocaleString("en-IN")}
          </p>
        </div>

        <hr className="my-5 border-slate-300" />

        <h4 className="text-base font-bold text-slate-900">Trip Details</h4>

        {pageNote && (
          <p className="mt-1 mb-3 text-xs text-slate-500">{pageNote}</p>
        )}

        <div className="mt-4 space-y-4">
          {trips.map((trip, idx) => {
            const row = toTripReportRow(trip, resolveAgencyLabel);
            const lines = buildReportCardLines(row, fieldSelection);
            return (
              <TripReportCard
                key={trip._id}
                index={tripIndexOffset + idx}
                tripNumber={row.tripNumber}
                lines={lines}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
