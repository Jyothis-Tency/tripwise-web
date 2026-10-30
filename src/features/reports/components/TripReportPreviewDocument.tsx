import type { HistoryTrip } from "../../history/api";
import type { TripReportTotals } from "../entityReportTotals";
import type { ReportFieldSelection } from "../reportFieldConfig";
import { tripReportTotalLines } from "../reportTotalsDisplay";
import { buildReportCardLines } from "../tripReportCardLayout";
import { toTripReportRow } from "../tripReportFormat";
import { useBrand } from "../../../lib/brand";
import { TripwiseLogo } from "../../../components/brand/TripwiseLogo";

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[12px] leading-snug text-slate-800">
      <span className="font-bold text-slate-900">{label}</span> {value}
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
    <article className="rounded-md border border-slate-300 bg-white px-3 py-2.5 sm:px-4">
      <div className="flex flex-col gap-1.5 border-b border-slate-200 pb-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-4 sm:gap-y-1">
        <p className="shrink-0 text-[13px] font-bold text-slate-900">
          Trip {index + 1}: {tripNumber}
        </p>
        {lines.header.map((h) => (
          <p key={h.label} className="min-w-0 text-[12px] text-slate-800">
            <span className="font-bold">{h.label}</span> {h.value}
          </p>
        ))}
      </div>

      {hasBody && (
        <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5">
          <div className="min-h-[1rem] space-y-0.5">
            {lines.left.map((ln) => (
              <DetailLine key={ln.label} label={ln.label} value={ln.value} />
            ))}
          </div>
          <div className="min-h-[1rem] space-y-0.5">
            {lines.middle.map((ln) => (
              <DetailLine key={ln.label} label={ln.label} value={ln.value} />
            ))}
          </div>
          <div className="min-h-[1rem] space-y-0.5">
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
  reportTotals,
}: {
  trips: HistoryTrip[];
  totalTrips: number;
  fieldSelection: ReportFieldSelection;
  title?: string;
  subtitle?: string;
  resolveAgencyLabel: (agencyName?: string) => string;
  pageNote?: string;
  tripIndexOffset?: number;
  /** Full vehicle/bulk totals across all matching trips. */
  reportTotals?: TripReportTotals | null;
}) {
  const generatedOn = (() => {
    const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(new Date())
      .split("-");
    return `${Number(d)}/${Number(m)}/${Number(y)}`;
  })();
  const totalLines = reportTotals ? tripReportTotalLines(reportTotals) : [];
  const { confidentialNotice, isInway } = useBrand();

  return (
    <div className="mx-auto w-full max-w-full bg-white text-slate-900 shadow-[0_20px_40px_-14px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/10">
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-2 sm:px-6">
        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          <span>{confidentialNotice}</span>
          <span className="font-mono tracking-normal normal-case text-slate-400">
            Preview
          </span>
        </div>
      </div>
      <div className="px-4 py-5 sm:px-6 sm:py-6">
        {isInway && (
          <div className="mb-4 flex items-center gap-3">
            <TripwiseLogo className="h-10 w-10 shrink-0" variant="auto" />
            <div>
              <div className="font-['Poppins',system-ui,sans-serif] text-sm font-bold tracking-tight text-slate-900">
                INWAY CABS
              </div>
              <p className="text-[11px] font-medium text-slate-500">
                Fleet Operations
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {title}
            </h3>
            <p className="mt-1 font-mono text-xs text-slate-500">
              Generated {generatedOn}
            </p>
            {subtitle?.trim() && (
              <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-900 tabular-nums">
              Total Trips: {totalTrips.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {fieldSelection.reportTotals !== false && totalLines.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3 sm:px-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Report totals
            </p>
            <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {totalLines.map((line) => (
                <div
                  key={line.label}
                  className="flex items-baseline justify-between gap-3 text-[12px]"
                >
                  <span className="text-slate-600">{line.label}</span>
                  <span
                    className={`tabular-nums ${
                      line.emphasize
                        ? "font-bold text-slate-900"
                        : "font-semibold text-slate-800"
                    }`}
                  >
                    {line.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <hr className="my-4 border-slate-300" />

        <h4 className="text-base font-bold text-slate-900">Trip Details</h4>

        {pageNote && (
          <p className="mb-2 mt-1 text-xs text-slate-500">{pageNote}</p>
        )}

        <div className="mt-3 space-y-3">
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
