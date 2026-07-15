import useSWR from "swr";

import type { HomepagePulsePoint } from "lib/homepagePulse";
import styles from "styles/Home.module.scss";

type HomepagePulseProps = {
  initialPoints?: HomepagePulsePoint[];
};

type HomepagePulseResponse = {
  points: HomepagePulsePoint[];
};

async function fetchPulse(url: string): Promise<HomepagePulseResponse> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to refresh homepage pulse");
  return response.json();
}

function toPolyline(points: HomepagePulsePoint[]): string {
  if (points.length < 2) return "";

  const timestamps = points.map((point) => Date.parse(point.timestamp));
  const values = points.map((point) => point.value);
  const firstTimestamp = Math.min(...timestamps);
  const lastTimestamp = Math.max(...timestamps);
  const timestampRange = Math.max(lastTimestamp - firstTimestamp, 1);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const observedRange = maximum - minimum;
  const visualRange = Math.max(observedRange, 0.025);
  const domainMinimum = Math.max(0, minimum - visualRange * 0.2);
  const domainMaximum = maximum + visualRange * 0.2;
  const domainRange = Math.max(domainMaximum - domainMinimum, 0.001);

  return points
    .map((point, index) => {
      const parsedTimestamp = timestamps[index];
      const x = Number.isFinite(parsedTimestamp)
        ? ((parsedTimestamp - firstTimestamp) / timestampRange) * 100
        : (index / Math.max(points.length - 1, 1)) * 100;
      const y = 25 - ((point.value - domainMinimum) / domainRange) * 22;
      return `${x.toFixed(2)},${Math.max(2, Math.min(26, y)).toFixed(2)}`;
    })
    .join(" ");
}

export default function HomepagePulse({
  initialPoints = [],
}: HomepagePulseProps) {
  const { data } = useSWR<HomepagePulseResponse>(
    "/api/v1/homepage/pulse",
    fetchPulse,
    {
      fallbackData: { points: initialPoints },
      refreshInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
      revalidateOnMount: false,
    },
  );
  const polyline = toPolyline(data?.points ?? initialPoints);

  if (!polyline) return null;

  return (
    <svg
      className={styles.homepagePulse}
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="homepage-pulse-gradient" x1="0" x2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.16" stopColor="currentColor" stopOpacity="0.82" />
          <stop offset="0.72" stopColor="currentColor" stopOpacity="1" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <polyline
        className={styles.homepagePulseLine}
        points={polyline}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
