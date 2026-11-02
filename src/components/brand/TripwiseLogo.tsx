import { useBrand, type BrandKey } from "../../lib/brand";

type TripwiseLogoVariant = "navy" | "amber" | "auto";

type TripwiseLogoProps = {
  className?: string;
  /** Accessible name for the mark */
  alt?: string;
  /**
   * navy — dark tile (default UI surfaces)
   * amber — amber tile for dark / branded panels (login)
   * auto — navy in light mode, amber in dark mode
   */
  variant?: TripwiseLogoVariant;
  /** Optional wordmark next to the mark */
  withWordmark?: boolean;
  /** Title under wordmark (sidebar) */
  tagline?: string;
  /** Explicit override for Inway Cabs branding (e.g. for guest / driver links) */
  overrideInway?: boolean;
  /** Explicit brand key override */
  overrideBrand?: BrandKey;
};

const COLORS = {
  navy: {
    tile: "#12243A",
    tee: "#FFFFFF",
    dash: "#12243A",
  },
  amber: {
    tile: "#F5A300",
    tee: "#12243A",
    dash: "#F5A300",
  },
} as const;

function MarkSvg({
  tile,
  tee,
  dash,
  className,
  alt,
}: {
  tile: string;
  tee: string;
  dash: string;
  className?: string;
  alt: string;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={alt}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{alt}</title>
      <rect width="120" height="120" rx="28" fill={tile} />
      <rect x="24" y="24" width="72" height="18" rx="9" fill={tee} />
      <rect x="51" y="24" width="18" height="72" rx="9" fill={tee} />
      <line
        x1="34"
        y1="33"
        x2="86"
        y2="33"
        stroke={dash}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      <line
        x1="60"
        y1="46"
        x2="60"
        y2="86"
        stroke={dash}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
    </svg>
  );
}

function InwayMarkSvg({
  tile = "#0a0a0a",
  mark = "#ffffff",
  className,
  alt = "Inway Cabs",
}: {
  tile?: string;
  mark?: string;
  className?: string;
  alt?: string;
}) {
  return (
    <svg
      viewBox="340 187 400 400"
      role="img"
      aria-label={alt}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{alt}</title>
      <rect x="340" y="187" width="400" height="400" rx="80" fill={tile} />
      <g>
        <path
          fill={mark}
          d="M399 296 L411 272 Q418 260 432 265 L676 358 Q692 366 688 382 Q686 388 678 392 L497 508 Q485 515 474 510 Q464 504 468 490 L512 392 L408 315 Q396 308 399 296 Z"
        />
        <path
          fill="none"
          stroke={mark}
          strokeWidth="32"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M408 429 L424 458 L467 393"
        />
      </g>
    </svg>
  );
}

function RightLineMarkSvg({
  tile = "#0a0a0a",
  mark = "#ffffff",
  dash = "#0a0a0a",
  className,
  alt = "Right Line",
}: {
  tile?: string;
  mark?: string;
  dash?: string;
  className?: string;
  alt?: string;
}) {
  return (
    <svg
      viewBox="440 3 480 480"
      role="img"
      aria-label={alt}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{alt}</title>
      <rect x="440" y="3" width="480" height="480" rx="96" fill={tile} />
      <g>
        <path
          fill={mark}
          d="M459 414 L459 150 Q459 72 505 72 L888 72 L900 84 L690 283 L825 414 L750 414 L617 285 L783 118 L548 118 Q517 118 517 150 L517 414 Z"
        />
        <path
          fill={mark}
          d="M527 193 L553 165 L603 213 L679 137 L735 135 L605 267 Z"
        />
        <path
          fill="none"
          stroke={dash}
          strokeWidth="6"
          strokeDasharray="28 26"
          d="M488 414 L488 150 Q488 88 540 88 L885 88"
        />
      </g>
    </svg>
  );
}

/**
 * Official brand mark — Tripwise, Inway Cabs, or Right Line (dynamic per logged-in owner).
 */
export function TripwiseLogo({
  className = "h-11 w-11",
  alt,
  variant = "auto",
  withWordmark = false,
  tagline,
  overrideInway,
  overrideBrand,
}: TripwiseLogoProps) {
  const brand = useBrand();
  const effectiveBrand: BrandKey =
    overrideBrand ??
    (overrideInway !== undefined
      ? overrideInway
        ? "inway"
        : "tripwise"
      : brand.brandKey);

  const defaultAlt =
    effectiveBrand === "rightline"
      ? "Right Line"
      : effectiveBrand === "inway"
      ? "Inway Cabs"
      : "Tripwise";
  const effectiveAlt = alt ?? defaultAlt;
  const markClass = withWordmark ? "h-full w-full" : className;

  let mark: React.ReactNode;

  if (effectiveBrand === "rightline") {
    mark =
      variant === "auto" ? (
        <>
          {/* Light mode: dark tile with white mark */}
          <RightLineMarkSvg
            tile="#0a0a0a"
            mark="#ffffff"
            dash="#0a0a0a"
            className={`${markClass} dark:hidden`}
            alt={effectiveAlt}
          />
          {/* Dark mode: crisp white tile with dark mark to match dark theme */}
          <RightLineMarkSvg
            tile="#ffffff"
            mark="#0a0a0a"
            dash="#ffffff"
            className={`${markClass} hidden dark:block`}
            alt={effectiveAlt}
          />
        </>
      ) : variant === "amber" ? (
        <RightLineMarkSvg
          tile="#ffffff"
          mark="#0a0a0a"
          dash="#ffffff"
          className={markClass}
          alt={effectiveAlt}
        />
      ) : (
        <RightLineMarkSvg
          tile="#0a0a0a"
          mark="#ffffff"
          dash="#0a0a0a"
          className={markClass}
          alt={effectiveAlt}
        />
      );
  } else if (effectiveBrand === "inway") {
    mark =
      variant === "auto" ? (
        <>
          {/* Light mode: dark tile with white mark */}
          <InwayMarkSvg
            tile="#0a0a0a"
            mark="#ffffff"
            className={`${markClass} dark:hidden`}
            alt={effectiveAlt}
          />
          {/* Dark mode: crisp white tile with dark mark to match dark theme */}
          <InwayMarkSvg
            tile="#ffffff"
            mark="#0a0a0a"
            className={`${markClass} hidden dark:block`}
            alt={effectiveAlt}
          />
        </>
      ) : variant === "amber" ? (
        <InwayMarkSvg
          tile="#ffffff"
          mark="#0a0a0a"
          className={markClass}
          alt={effectiveAlt}
        />
      ) : (
        <InwayMarkSvg
          tile="#0a0a0a"
          mark="#ffffff"
          className={markClass}
          alt={effectiveAlt}
        />
      );
  } else {
    mark =
      variant === "auto" ? (
        <>
          <MarkSvg
            {...COLORS.navy}
            alt={effectiveAlt}
            className={`${markClass} dark:hidden`}
          />
          <MarkSvg
            {...COLORS.amber}
            alt={effectiveAlt}
            className={`${markClass} hidden dark:block`}
          />
        </>
      ) : (
        <MarkSvg {...COLORS[variant]} alt={effectiveAlt} className={markClass} />
      );
  }

  if (!withWordmark) {
    if (variant === "auto") {
      const isCentering = className.includes("mx-auto");
      return (
        <span
          className={`${isCentering ? "flex justify-center" : "inline-flex"} ${className}`}
        >
          {mark}
        </span>
      );
    }
    return mark;
  }

  if (effectiveBrand === "rightline") {
    return (
      <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
        <div className="relative h-11 w-11 shrink-0">{mark}</div>
        <div className="min-w-0">
          <div className="flex items-baseline tracking-wider uppercase font-['Open_Sans',system-ui,sans-serif] text-[13.5px] font-extrabold text-slate-900 dark:text-white">
            <span>RIGHT LINE</span>
          </div>
          <p className="truncate text-[10px] tracking-wider uppercase font-semibold text-slate-500 dark:text-slate-400">
            {tagline || "The Travel Expert"}
          </p>
        </div>
      </div>
    );
  }

  if (effectiveBrand === "inway") {
    return (
      <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
        <div className="relative h-11 w-11 shrink-0">{mark}</div>
        <div className="min-w-0">
          <div className="flex items-baseline truncate font-['Poppins',system-ui,sans-serif] text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
            <span>inway</span>
            <span className="ml-1 font-normal text-slate-500 dark:text-neutral-400">cabs</span>
          </div>
          {tagline ? (
            <p className="truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {tagline}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <div className="relative h-11 w-11 shrink-0">{mark}</div>
      <div className="min-w-0">
        <div className="truncate font-[family-name:Sora,ui-sans-serif,system-ui,sans-serif] text-sm font-bold tracking-tight text-slate-900 dark:text-white">
          Trip
          <span className="text-[#C98200] dark:text-[#F5A300]">wise</span>
        </div>
        {tagline ? (
          <p className="truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {tagline}
          </p>
        ) : null}
      </div>
    </div>
  );
}
