import React, { useState } from "react";
import Image, { ImageProps } from "next/image";
import { fallbackTeamLogo } from "lib/images";

/**
 * OptimizedImage
 * Wrapper around next/image providing:
 * - Sensible default loading behavior (lazy unless priority specified)
 * - One fallback attempt before a deterministic terminal error state
 * - Caller error notification without allowing the fallback to be bypassed
 * - An explicit width/height pair or fill layout (never implicit dimensions)
 * - Accepts className & style passthrough
 *
 * Sources must be local assets or match the application's Next image config.
 *
 * Usage:
 * <OptimizedImage src={getTeamLogoPath(abbrev)} alt={`${team} logo`} width={64} height={64} />
 */
type OptimizedImageBaseProps = Omit<
  ImageProps,
  | "src"
  | "alt"
  | "width"
  | "height"
  | "fill"
  | "layout"
  | "overrideSrc"
  | "onError"
> & {
  src: string;
  alt?: string;
  fallbackSrc?: string;
  safeAlt?: string;
  onError?: ImageProps["onError"];
};

type OptimizedImageSizedProps = {
  width: NonNullable<ImageProps["width"]>;
  height: NonNullable<ImageProps["height"]>;
  fill?: false;
};

type OptimizedImageFillProps = {
  fill: true;
  width?: never;
  height?: never;
};

export type OptimizedImageProps = OptimizedImageBaseProps &
  (OptimizedImageSizedProps | OptimizedImageFillProps);

type OptimizedImageRendererProps = Omit<OptimizedImageProps, "fallbackSrc"> & {
  fallbackSrc: string;
};

function OptimizedImageRenderer({
  src,
  alt,
  fallbackSrc,
  safeAlt = "Image",
  fill,
  width,
  height,
  onError,
  ...rest
}: OptimizedImageRendererProps) {
  const [imageState, setImageState] = useState({
    activeSrc: src,
    fallbackAttempted: false,
  });

  const finalAlt = alt ?? safeAlt;
  const handleError: NonNullable<ImageProps["onError"]> = (event) => {
    setImageState((current) => {
      if (
        current.fallbackAttempted ||
        !fallbackSrc ||
        current.activeSrc === fallbackSrc
      ) {
        return current;
      }

      return {
        activeSrc: fallbackSrc,
        fallbackAttempted: true,
      };
    });

    onError?.(event);
  };

  if (fill === true) {
    return (
      <Image
        {...rest}
        key={imageState.activeSrc}
        src={imageState.activeSrc}
        alt={finalAlt}
        fill
        onError={handleError}
      />
    );
  }

  return (
    <Image
      {...rest}
      key={imageState.activeSrc}
      src={imageState.activeSrc}
      alt={finalAlt}
      width={width}
      height={height}
      onError={handleError}
    />
  );
}

export function OptimizedImage(props: OptimizedImageProps) {
  const hasWidth = props.width != null;
  const hasHeight = props.height != null;

  if (props.fill === true ? hasWidth || hasHeight : !hasWidth || !hasHeight) {
    throw new Error(
      "OptimizedImage requires either fill or an explicit width and height pair.",
    );
  }

  const fallbackSrc = props.fallbackSrc ?? fallbackTeamLogo;

  return (
    <OptimizedImageRenderer
      {...props}
      key={`${props.src}\u0000${fallbackSrc}`}
      fallbackSrc={fallbackSrc}
    />
  );
}

export default OptimizedImage;
