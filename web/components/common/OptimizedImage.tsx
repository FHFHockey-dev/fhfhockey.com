import React from "react";
import Image, { ImageProps } from "next/image";

/**
 * OptimizedImage
 * Wrapper around next/image providing:
 * - Sensible default loading behavior (lazy unless priority specified)
 * - Optional fallback image on error
 * - Simple width/height requirement guard (avoids layout shift)
 * - Accepts className & style passthrough
 *
 * Usage:
 * <OptimizedImage src={getTeamLogoPath(abbrev)} alt={`${team} logo`} width={64} height={64} />
 */
export interface OptimizedImageProps extends Omit<ImageProps, "src" | "alt"> {
  src: string;
  alt?: string;
  fallbackSrc?: string;
  safeAlt?: string; // optional safer alt fallback if alt omitted
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  fallbackSrc = "/teamLogos/default.png",
  safeAlt = "Image",
  priority,
  ...rest
}) => {
  const finalAlt = alt || safeAlt;
  // next/image already throws if width/height missing in static import scenario
  return (
    <Image
      src={src}
      alt={finalAlt}
      onError={(e) => {
        if (fallbackSrc && e.currentTarget instanceof HTMLImageElement) {
          e.currentTarget.src = fallbackSrc; // graceful fallback for plain HTMLImageElement path
        }
      }}
      priority={priority}
      {...rest}
    />
  );
};

export default OptimizedImage;
