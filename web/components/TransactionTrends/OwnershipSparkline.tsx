import { useMemo } from "react";

export type OwnershipSparkPoint = {
  date: string;
  value: number;
};

type OwnershipSparklineProps = {
  points: OwnershipSparkPoint[];
  variant: "rise" | "fall";
  width?: number;
  height?: number;
  baseline?: boolean;
  svgClassName?: string;
  pathClassName?: string;
  areaClassName?: string;
  riseClassName?: string;
  fallClassName?: string;
  baselineClassName?: string;
  emptyClassName?: string;
};

type SparkGeometry = {
  line: string;
  area: string;
  baselineY: number;
};

function buildSparkGeometry(
  points: OwnershipSparkPoint[],
  width: number,
  height: number
): SparkGeometry | null {
  const series = points.filter((point) => typeof point.value === "number").slice(-20);
  if (series.length === 0) return null;

  const values = series.map((point) => point.value);
  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    min -= 0.5;
    max += 0.5;
  }

  const range = max - min || 1;
  const normalized = series.map((point, index) => ({
    x: series.length === 1 ? 0 : (index / (series.length - 1)) * width,
    y: height - ((point.value - min) / range) * (height - 4) - 2
  }));

  const line = normalized
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    )
    .join(" ");
  const polygon = [
    `0,${height}`,
    ...normalized.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`),
    `${width},${height}`
  ].join(" ");
  const baselineY = Math.min(
    height - 2,
    Math.max(
      2,
      height - ((series[0].value - min) / range) * (height - 4) - 2
    )
  );

  return {
    line,
    area: polygon,
    baselineY
  };
}

export default function OwnershipSparkline({
  points,
  variant,
  width = 100,
  height = 24,
  baseline = false,
  svgClassName,
  pathClassName,
  areaClassName,
  riseClassName,
  fallClassName,
  baselineClassName,
  emptyClassName
}: OwnershipSparklineProps) {
  const geometry = useMemo(
    () => buildSparkGeometry(points, width, height),
    [height, points, width]
  );

  if (!geometry) {
    return <span className={emptyClassName}>--</span>;
  }

  const variantClassName = variant === "rise" ? riseClassName : fallClassName;

  return (
    <svg
      className={svgClassName}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {baseline && baselineClassName ? (
        <polyline
          className={baselineClassName}
          points={`0,${geometry.baselineY.toFixed(2)} ${width},${geometry.baselineY.toFixed(2)}`}
        />
      ) : null}
      {areaClassName ? (
        <polygon
          className={[areaClassName, variantClassName].filter(Boolean).join(" ")}
          points={geometry.area}
        />
      ) : null}
      <path
        className={[pathClassName, variantClassName].filter(Boolean).join(" ")}
        d={geometry.line}
      />
    </svg>
  );
}
