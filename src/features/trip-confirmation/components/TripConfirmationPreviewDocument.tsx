import type { TripConfirmationDocument } from "../types";
import { TripwiseLogo } from "../../../components/brand/TripwiseLogo";
import { useBrand } from "../../../lib/brand";

interface TripConfirmationPreviewDocumentProps {
  document: TripConfirmationDocument;
}

export function TripConfirmationPreviewDocument({
  document: doc,
}: TripConfirmationPreviewDocumentProps) {
  const { isInway, isRightLine, isMaegler } = useBrand();

  // Split contact details into separate lines for the right side of header
  const contactLines = doc.footerContact
    ? doc.footerContact.split(/[·•|]/).map((s) => s.trim()).filter(Boolean)
    : isRightLine
    ? ["Right Line The Travel Expert"]
    : isMaegler
    ? ["Mægler Tours and Travels"]
    : ["+91 80865 56655", "inwaycabs@gmail.com", "inwaycabs.in"];

  return (
    <div className="relative mx-auto w-full max-w-[760px] overflow-hidden bg-white text-slate-900 shadow-[0_20px_40px_-14px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/10 p-6 sm:p-10 font-sans transition-all">
      {/* Large Translucent Logo Watermark in the Centre of the Page */}
      {isRightLine && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.08] select-none z-0"
          aria-hidden="true"
        >
          <svg
            viewBox="440 3 480 480"
            className="h-[460px] w-[460px] sm:h-[540px] sm:w-[540px] text-black"
          >
            <path
              fill="currentColor"
              d="M459 414 L459 150 Q459 72 505 72 L888 72 L900 84 L690 283 L825 414 L750 414 L617 285 L783 118 L548 118 Q517 118 517 150 L517 414 Z"
            />
            <path
              fill="currentColor"
              d="M527 193 L553 165 L603 213 L679 137 L735 135 L605 267 Z"
            />
            <path
              fill="none"
              stroke="#ffffff"
              strokeWidth="6"
              strokeDasharray="28 26"
              d="M488 414 L488 150 Q488 88 540 88 L885 88"
            />
          </svg>
        </div>
      )}
      {isMaegler && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06] select-none z-0"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 1024 1024"
            className="h-[460px] w-[460px] sm:h-[540px] sm:w-[540px]"
          >
            <rect x="25" y="25" width="974" height="974" rx="48" fill="none" stroke="#000" strokeWidth="6"/>
            <rect x="36" y="36" width="952" height="952" rx="38" fill="none" stroke="#000" strokeWidth="2"/>
            <text x="130" y="553" fontFamily="'Source Serif 4', Georgia, serif" fontSize="220" fontWeight="700" fill="#000" textLength="775" lengthAdjust="spacing">
              m<tspan fill="#ee0a0a">æ</tspan>gler
            </text>
            <text x="145" y="705" fontFamily="'EB Garamond', Garamond, Georgia, serif" fontSize="100" fill="#000" textLength="737" lengthAdjust="spacing">
              Tours and Travels
            </text>
          </svg>
        </div>
      )}
      {isInway && !isRightLine && !isMaegler && (
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
              {isMaegler && !doc.companyName ? (
                <>
                  <h1 className="font-['Source_Serif_4','Droid_Serif',Georgia,serif] text-2xl font-bold tracking-[0.04em] text-slate-950 leading-tight">
                    <span>m</span>
                    <span className="text-[#ee0a0a]">æ</span>
                    <span>gler</span>
                  </h1>
                  <p className="font-['EB_Garamond',Garamond,Georgia,serif] text-sm font-normal tracking-[0.03em] text-slate-600 mt-0.5 leading-tight">
                    {doc.subtitle || "Tours and Travels"}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-950">
                    {doc.companyName || (isRightLine ? "RIGHT LINE" : isInway ? "INWAY CABS" : "TRIPWISE")}
                  </h1>
                  {doc.subtitle && (
                    <p className="text-xs sm:text-sm font-medium text-slate-600">
                      {doc.subtitle}
                    </p>
                  )}
                </>
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
