type TripwiseLogoProps = {
  className?: string;
  alt?: string;
};

/**
 * Official Tripwise brand mark — car icon only (no wordmark).
 */
export function TripwiseLogo({
  className = "h-11 w-11",
  alt = "Tripwise",
}: TripwiseLogoProps) {
  return (
    <img
      src="/tripwise-logo.png?v=6"
      alt={alt}
      className={className}
      draggable={false}
      decoding="async"
    />
  );
}
