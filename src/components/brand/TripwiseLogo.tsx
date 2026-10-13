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

/**
 * Official Tripwise brand mark — rounded T with dashed road lines.
 * Spec: navy #12243A · amber #F5A300
 */
export function TripwiseLogo({
  className = "h-11 w-11",
  alt = "Tripwise",
  variant = "auto",
  withWordmark = false,
  tagline,
}: TripwiseLogoProps) {
  const markClass = withWordmark ? "h-full w-full" : className;

  const mark =
    variant === "auto" ? (
      <>
        <MarkSvg
          {...COLORS.navy}
          alt={alt}
          className={`${markClass} dark:hidden`}
        />
        <MarkSvg
          {...COLORS.amber}
          alt={alt}
          className={`${markClass} hidden dark:block`}
        />
      </>
    ) : (
      <MarkSvg {...COLORS[variant]} alt={alt} className={markClass} />
    );

  if (!withWordmark) {
    if (variant === "auto") {
      return <span className={`inline-flex ${className}`}>{mark}</span>;
    }
    return mark;
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
