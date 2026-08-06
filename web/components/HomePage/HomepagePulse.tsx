import { useEffect, useState } from "react";
import useSWR from "swr";

import type { HomepagePulsePoint } from "lib/homepagePulse";
import styles from "styles/Home.module.scss";

type HomepagePulseProps = {
  initialPoints?: HomepagePulsePoint[];
  initialVisitorPoints?: HomepagePulsePoint[];
};

type HomepagePulseResponse = {
  points: HomepagePulsePoint[];
};

async function fetchPulse(url: string): Promise<HomepagePulseResponse> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to refresh homepage pulse");
  return response.json();
}

const SERIES_HOLD_MS = 8_000;
const SERIES_FADE_MS = 600;

function toSmoothPath(points: HomepagePulsePoint[]): string {
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

  const coordinates = points.map((point, index) => {
      const parsedTimestamp = timestamps[index];
      const x = Number.isFinite(parsedTimestamp)
        ? ((parsedTimestamp - firstTimestamp) / timestampRange) * 100
        : (index / Math.max(points.length - 1, 1)) * 100;
      const y = 25 - ((point.value - domainMinimum) / domainRange) * 22;
      return {
        x,
        y: Math.max(2, Math.min(26, y)),
      };
    });

  const first = coordinates[0];
  let path = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const previous = coordinates[Math.max(0, index - 1)];
    const current = coordinates[index];
    const next = coordinates[index + 1];
    const following = coordinates[Math.min(coordinates.length - 1, index + 2)];
    const firstControlX = current.x + (next.x - previous.x) / 6;
    const firstControlY = current.y + (next.y - previous.y) / 6;
    const secondControlX = next.x - (following.x - current.x) / 6;
    const secondControlY = next.y - (following.y - current.y) / 6;

    path += ` C ${firstControlX.toFixed(2)} ${firstControlY.toFixed(2)}, ${secondControlX.toFixed(2)} ${secondControlY.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }

  return path;
}

export default function HomepagePulse({
  initialPoints = [],
  initialVisitorPoints = [],
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
  const { data: visitorData } = useSWR<HomepagePulseResponse>(
    "/api/v1/homepage/visitors",
    fetchPulse,
    {
      fallbackData: { points: initialVisitorPoints },
      refreshInterval: 6 * 60 * 60 * 1000,
      revalidateOnFocus: false,
      revalidateOnMount: initialVisitorPoints.length === 0,
    },
  );
  const modelPath = toSmoothPath(data?.points ?? initialPoints);
  const visitorPath = toSmoothPath(
    visitorData?.points ?? initialVisitorPoints,
  );
  const [activeSeries, setActiveSeries] = useState<"model" | "visitors">(
    "model",
  );
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (!modelPath || !visitorPath) return;

    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    const seriesTimer = setInterval(() => {
      setIsFading(true);
      fadeTimer = setTimeout(() => {
        setActiveSeries((current) =>
          current === "model" ? "visitors" : "model",
        );
        setIsFading(false);
      }, SERIES_FADE_MS);
    }, SERIES_HOLD_MS);

    return () => {
      clearInterval(seriesTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [modelPath, visitorPath]);

  const path =
    activeSeries === "visitors" && visitorPath ? visitorPath : modelPath;

  if (!path) return null;

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
      <g
        className={`${styles.homepagePulseSeries} ${
          isFading ? styles.homepagePulseSeriesFading : ""
        }`}
      >
        <path
          className={styles.homepagePulseGhostLine}
          d={path}
          vectorEffect="non-scaling-stroke"
        />
        <path
          className={styles.homepagePulseGlowLine}
          d={path}
          vectorEffect="non-scaling-stroke"
        />
        <path
          className={styles.homepagePulseLine}
          d={path}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}
