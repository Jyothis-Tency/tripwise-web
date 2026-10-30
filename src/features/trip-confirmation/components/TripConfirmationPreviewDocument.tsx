import type { TripConfirmationDocument } from "../types";
import { TripwiseLogo } from "../../../components/brand/TripwiseLogo";
import { useBrand } from "../../../lib/brand";

interface TripConfirmationPreviewDocumentProps {
  document: TripConfirmationDocument;
}

export function TripConfirmationPreviewDocument({
  document: doc,
}: TripConfirmationPreviewDocumentProps) {
  const { isInway } = useBrand();

  // Split contact details into separate lines for the right side of header
  const contactLines = doc.footerContact
    ? doc.footerContact.split(/[·•|]/).map((s) => s.trim()).filter(Boolean)
    : ["+91 80865 56655", "inwaycabs@gmail.com", "inwaycabs.in"];

  return (
    <div className="relative mx-auto w-full max-w-[760px] overflow-hidden bg-white text-slate-900 shadow-[0_20px_40px_-14px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/10 p-6 sm:p-10 font-sans transition-all">
      {/* Large Translucent Logo Watermark in the Centre of the Page (Inway Cabs only) */}
      {isInway && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.08] select-none z-0"
          aria-hidden="true"
        >
          <svg
            viewBox="340 187 400 400"
            className="h-[460px] w-[460px] sm:h-[540px] sm:w-[540px] text-black"
            fill="currentColor"
          >
            <g>
              <path d="M399 296 L411 272 Q418 260 432 265 L676 358 Q692 366 688 382 Q686 388 678 392 L497 508 Q485 515 474 510 Q464 504 468 490 L512 392 L408 315 Q396 308 399 296 Z" />
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="32"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M408 429 L424 458 L467 393"
              />
            </g>
          </svg>
        </div>
      )}

      {/* Main Document Content */}
      <div className="relative z-[1]">
        {/* Letterhead Header: Left (Logo + Company Name) · Right (Contact details + website) */}
        <div className="flex items-start justify-between gap-4 pb-2">
          {/* Left: Logo & Company Name */}
          <div className="flex items-center gap-3">
            <TripwiseLogo className="h-12 w-12 shrink-0" variant="auto" />
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-950">
                {doc.companyName || "INWAY CABS"}
              </h1>
              {doc.subtitle && (
                <p className="text-xs sm:text-sm font-medium text-slate-600">
                  {doc.subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right: Contact details & website */}
          <div className="text-right space-y-0.5 text-xs text-slate-600 font-medium pt-1">
            {contactLines.map((line, idx) => (
              <p key={idx} className="leading-tight">
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Header divider line */}
        <div className="my-2.5 border-b-2 border-slate-900" />

        {/* Document Title Banner */}
        {doc.documentTitle && (
          <div className="mb-3 text-center">
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-widest text-slate-950">
              {doc.documentTitle}
            </h2>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-3.5">
          {doc.sections.map((section) => (
            <div key={section.id} className="overflow-hidden">
              {/* Black Section Banner */}
              <div className="bg-[#18181b] px-3 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-white">
                {section.title}
              </div>

              {/* 2-Column Table Grid */}
              <table className="w-full border-collapse border border-slate-300 text-[11px] sm:text-xs bg-transparent">
                <tbody>
                  {section.rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-300 last:border-b-0"
                    >
                      <td className="w-[32%] border-r border-slate-300 bg-slate-100/25 px-3 py-1.5 align-top font-bold text-slate-900">
                        {row.label}
                      </td>
                      <td
                        className={`px-3 py-1.5 text-slate-900 align-top whitespace-pre-wrap bg-transparent ${
                          row.isBold ? "font-bold" : "font-normal"
                        }`}
                      >
                        {row.value || (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Pre-booking Note */}
        {doc.preBookingNote && (
          <p className="mt-4 text-center text-[11px] sm:text-xs italic text-slate-600">
            {doc.preBookingNote}
          </p>
        )}

        {/* Bottom divider */}
        <div className="my-3 border-b-2 border-slate-900" />

        {/* Footer */}
        <div className="mt-1 space-y-0.5 text-center">
          {doc.footerBrand && (
            <p className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-950">
              {doc.footerBrand}
            </p>
          )}
          {doc.footerTagline && (
            <p className="text-[10px] sm:text-xs font-medium text-slate-600">
              {doc.footerTagline}
            </p>
          )}
          {doc.footerContact && (
            <p className="text-[10px] sm:text-xs font-medium text-slate-600">
              {doc.footerContact}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
