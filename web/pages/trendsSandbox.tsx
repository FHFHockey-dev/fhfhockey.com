import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import * as d3 from "d3";
import { format } from "date-fns";
import { useRouter } from "next/router";
import type { StreakSegment, StreakType, TrendDataBundle } from "lib/trends/types";
import { buildTrendData, rollingAverage, winsorize } from "lib/trends/utils";

import { TRENDS_SURFACE_LINKS } from "lib/navigation/siteSurfaceLinks";
import supabase from "lib/supabase/client";
import type { Database } from "lib/supabase/database-generated.types";
import { teamsInfo } from "lib/teamsInfo";
import {
  extractReasonHighlights,
  SANDBOX_ENTITY_CONFIG,
  type SandboxBandRow,
  type SandboxEntityType,
  type SandboxScoreRow
} from "lib/sustainability/entitySurface";
import styles from "./trends/sandbox.module.scss";

type EntityOption = {
  id: number;
  name: string;
  subtitle: string | null;
  imageUrl: string | null;
};

type ScoresResponse = {
  success: boolean;
  snapshotDate: string | null;
  windowCode: string;
  totalRows: number;
  rows: SandboxScoreRow[];
  selectedRow: SandboxScoreRow | null;
  message?: string;
};

type BandsResponse = {
  success: boolean;
  snapshotDate: string | null;
  windowCode: string;
  currentRows: SandboxBandRow[];
  historyRows: SandboxBandRow[];
  message?: string;
};

type ScoreHistoryRow = {
  entityType: SandboxEntityType;
  entityId: number;
  entityName: string;
  entitySubtitle: string | null;
  snapshotDate: string;
  windowCode: string;
  score: number;
  rawScore: number;
  expectationState: SandboxScoreRow["expectationState"];
  baselineValue: number | null;
  recentValue: number | null;
  expectedValue: number | null;
};

type ScoreHistoryResponse = {
  success: boolean;
  snapshotDate: string | null;
  windowCode: string;
  rows: ScoreHistoryRow[];
  message?: string;
};

type ChartSurfaceTab = "elasticity" | "metricStreaks" | "scoreStreaks";

type PaddedReasonCard = ReturnType<typeof extractReasonHighlights>[number] & {
  placeholder?: boolean;
};

const REASON_TO_BAND_METRIC_KEY: Record<string, string> = {
  z_ixg60: "ixg_per_60",
  z_icf60: "icf_per_60",
  z_shp: "sh_pct",
  z_oishp: "on_ice_sh_pct",
  z_ipp: "ipp",
  z_hdcf60: "hdcf_per_60",
  z_ppshp: "pp_shooting_pct"
};

type HistoryChartPoint = {
  date: Date;
  gameIndex: number;
  points: number;
  rollingAverage: number;
  streakType: StreakType;
  streakLength: number;
};

type HistoryTrendBundle = {
  baseline: number;
  chartPoints: HistoryChartPoint[];
  streaks: StreakSegment[];
  valueLabel: string;
  averageLabel: string;
  baselineLabel: string;
  title: string;
  subtitle: string;
};

const WINDOW_OPTIONS = ["l3", "l5", "l10", "l20"] as const;
const DEFAULT_DATE = new Date().toISOString().slice(0, 10);
const MIN_SEARCH_LENGTH = 2;
const BAROMETER_MIN = -3;
const BAROMETER_MAX = 3;

type WgoSkaterTrendRow = Pick<
  Database["public"]["Tables"]["wgo_skater_stats"]["Row"],
  | "date"
  | "season_id"
  | "games_played"
  | "points"
  | "goals"
  | "assists"
  | "shots"
  | "hits"
  | "blocked_shots"
  | "pp_points"
  | "points_per_60_5v5"
  | "pp_goals_per_60"
  | "pp_points_per_60"
  | "pp_toi_pct_per_game"
  | "shooting_percentage"
  | "blocks_per_60"
  | "hits_per_60"
>;

type NstSkaterCountsRow = Pick<
  Database["public"]["Tables"]["nst_gamelog_as_counts"]["Row"],
  | "date_scraped"
  | "season"
  | "gp"
  | "ixg"
  | "icf"
  | "hdcf"
  | "ipp"
  | "sh_percentage"
  | "shots"
  | "shots_blocked"
  | "toi"
  | "total_points"
>;

type NstSkaterOnIceRow = Pick<
  Database["public"]["Tables"]["nst_gamelog_as_counts_oi"]["Row"],
  | "date_scraped"
  | "season"
  | "gp"
  | "on_ice_sh_pct"
  | "on_ice_sv_pct"
  | "pdo"
  | "xgf"
  | "xga"
  | "toi"
>;

type SkaterTrendGameRow = {
  date: string;
  seasonId: number;
  toiSeconds: number | null;
  totalPoints: number;
  shots: number;
  hits: number;
  blocks: number;
  ppPoints: number;
  ixgPer60: number | null;
  icfPer60: number | null;
  hdcfPer60: number | null;
  ipp: number | null;
  onIceShPct: number | null;
  onIceSvPct: number | null;
  pdo: number | null;
  pointsPer60_5v5: number | null;
  ppGoalsPer60: number | null;
  ppPointsPer60: number | null;
  ppToiPct: number | null;
  shootingPct: number | null;
  blocksPer60: number | null;
  hitsPer60: number | null;
  fantasyScore: number;
};

const INITIAL_TREND_BUNDLE: TrendDataBundle = {
  baseline: 0,
  chartPoints: [],
  streaks: []
};

const FANTASY_WEIGHTS = {
  G: 3,
  A: 2,
  PPP_BONUS: 1,
  SOG: 0.2,
  HIT: 0.2,
  BLK: 0.25
} as const;

const TEAM_OPTIONS: EntityOption[] = Object.values(teamsInfo)
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((team) => ({
    id: team.id,
    name: team.name,
    subtitle: team.abbrev,
    imageUrl: `/teamLogos/${team.abbrev}.png`
  }));

function resolveSeasonIdFromDate(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    const now = new Date();
    const year = now.getUTCFullYear();
    return now.getUTCMonth() >= 8 ? year * 10000 + (year + 1) : (year - 1) * 10000 + year;
  }
  const year = parsed.getUTCFullYear();
  return parsed.getUTCMonth() >= 8
    ? year * 10000 + (year + 1)
    : (year - 1) * 10000 + year;
}

function slugifyEntityName(value: string | null | undefined) {
  if (!value) return null;
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}

function getSeasonDateRangeFromSeasonId(seasonId: number) {
  const startYear = Math.floor(seasonId / 10000);
  const endYear = seasonId % 10000;
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) {
    return null;
  }
  return {
    startDate: `${startYear}-09-01`,
    endDateExclusive: `${endYear}-09-01`
  };
}

function normalizeDateOnly(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
}

function parseEntityTypeQuery(value: unknown): SandboxEntityType {
  if (value === "team" || value === "goalie") return value;
  return "skater";
}

function parseWindowCodeQuery(
  value: unknown
): (typeof WINDOW_OPTIONS)[number] | null {
  return WINDOW_OPTIONS.includes(value as (typeof WINDOW_OPTIONS)[number])
    ? (value as (typeof WINDOW_OPTIONS)[number])
    : null;
}

function parseChartSurfaceTabQuery(value: unknown): ChartSurfaceTab | null {
  if (value === "elasticity" || value === "metricStreaks" || value === "scoreStreaks") {
    return value;
  }
  return null;
}

function parseEntityIdQuery(query: Record<string, unknown>) {
  const raw =
    query.entityId ?? query.playerId ?? query.goalieId ?? query.teamId ?? null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function asFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toRatePer60(value: number | null, toiSeconds: number | null) {
  if (value == null || toiSeconds == null || toiSeconds <= 0) return null;
  return (value / toiSeconds) * 3600;
}

function toDecimalPct(value: number | null) {
  if (value == null) return null;
  return value > 1 ? value / 100 : value;
}

function buildHistoryBundleFromTrend(args: {
  trend: TrendDataBundle;
  title: string;
  subtitle: string;
  valueLabel: string;
  averageLabel: string;
  baselineLabel: string;
}): HistoryTrendBundle {
  return {
    baseline: args.trend.baseline,
    chartPoints: args.trend.chartPoints,
    streaks: args.trend.streaks,
    valueLabel: args.valueLabel,
    averageLabel: args.averageLabel,
    baselineLabel: args.baselineLabel,
    title: args.title,
    subtitle: args.subtitle
  };
}

function getSkaterMetricValue(row: SkaterTrendGameRow, metricKey: string) {
  switch (metricKey) {
    case "ixg_per_60":
      return row.ixgPer60;
    case "icf_per_60":
      return row.icfPer60;
    case "hdcf_per_60":
      return row.hdcfPer60;
    case "shots_per_60":
      return toRatePer60(row.shots, row.toiSeconds);
    case "pp_toi_pct":
      return row.ppToiPct;
    case "points_per_60_5v5":
      return row.pointsPer60_5v5;
    case "sh_pct":
      return row.shootingPct;
    case "on_ice_sh_pct":
      return row.onIceShPct;
    case "on_ice_sv_pct":
      return row.onIceSvPct;
    case "pdo":
      return row.pdo;
    case "ipp":
      return row.ipp;
    case "blocks_per_60":
      return row.blocksPer60;
    case "hits_per_60":
      return row.hitsPer60;
    case "pp_goals_per_60":
      return row.ppGoalsPer60;
    case "pp_points_per_60":
      return row.ppPointsPer60;
    case "fantasy_score":
      return row.fantasyScore;
    default:
      return null;
  }
}

function buildPlayerSubtitle(option: {
  teamId?: number | null;
  positionCode?: string | null;
}) {
  const team = option.teamId != null
    ? Object.values(teamsInfo).find((candidate) => candidate.id === option.teamId)
    : null;
  const parts = [team?.abbrev ?? null, option.positionCode ?? null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function formatStateLabel(state: SandboxScoreRow["expectationState"]) {
  if (state === "overperforming") return "Overperforming";
  if (state === "underperforming") return "Underperforming";
  return "Stable";
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function formatDelta(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function formatPercentDelta(value: number | null | undefined, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function scoreToneClass(state: SandboxScoreRow["expectationState"]) {
  if (state === "overperforming") return styles.bandHot;
  if (state === "underperforming") return styles.bandCold;
  return styles.bandNeutral;
}

function comparisonDeltaTone(deltaPct: number | null | undefined) {
  if (typeof deltaPct !== "number" || !Number.isFinite(deltaPct)) {
    return styles.bandComparisonDeltaNeutral;
  }
  if (deltaPct > 0) return styles.bandComparisonDeltaPositive;
  if (deltaPct < 0) return styles.bandComparisonDeltaNegative;
  return styles.bandComparisonDeltaNeutral;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getWindowLabel(windowCode: string) {
  const normalized = windowCode.toUpperCase();
  return normalized.startsWith("L") ? `Last ${normalized.slice(1)}` : normalized;
}

function getBarometerLabel(state: SandboxScoreRow["expectationState"] | null) {
  if (state === "overperforming") return "Running Hot";
  if (state === "underperforming") return "Running Cold";
  return "On Pace";
}

function getBarometerHelperCopy(state: SandboxScoreRow["expectationState"] | null) {
  if (state === "overperforming") {
    return "Current form is running above the player's usual lane.";
  }
  if (state === "underperforming") {
    return "Current form is sitting below the player's usual lane.";
  }
  return "Current form is landing inside the player's usual lane.";
}

function buildStatusTrendBundle(args: {
  title: string;
  subtitle: string;
  valueLabel: string;
  averageLabel: string;
  baselineLabel: string;
  baseline: number;
  rows: Array<{
    snapshotDate: string;
    value: number;
    rollingAverage?: number | null;
    status: StreakType;
  }>;
}): HistoryTrendBundle {
  const parsed = args.rows
    .map((row) => {
      const date = new Date(row.snapshotDate);
      if (!Number.isFinite(row.value) || Number.isNaN(date.getTime())) {
        return null;
      }
      return {
        date,
        value: row.value,
        rollingAverage: row.rollingAverage,
        status: row.status
      };
    })
    .filter(
      (
        row
      ): row is {
        date: Date;
        value: number;
        rollingAverage: number | null | undefined;
        status: StreakType;
      } => row != null
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (!parsed.length) {
    return {
      baseline: args.baseline,
      chartPoints: [],
      streaks: [],
      valueLabel: args.valueLabel,
      averageLabel: args.averageLabel,
      baselineLabel: args.baselineLabel,
      title: args.title,
      subtitle: args.subtitle
    };
  }

  const fallbackRolling = rollingAverage(
    parsed.map((row) => row.value),
    Math.min(5, parsed.length)
  );
  const chartPoints: HistoryChartPoint[] = [];
  const streaks: StreakSegment[] = [];
  let openSegment: {
    type: Exclude<StreakType, "neutral">;
    startIndex: number;
  } | null = null;
  let hotRun = 0;
  let coldRun = 0;

  const finalizeSegment = (endIndex: number) => {
    if (!openSegment) return;
    const length = endIndex - openSegment.startIndex + 1;
    streaks.push({
      type: openSegment.type,
      startDate: parsed[openSegment.startIndex].date,
      endDate: parsed[endIndex].date,
      startIndex: openSegment.startIndex,
      endIndex,
      length,
      intensity: Math.min(1, 0.25 + length * 0.18)
    });
    openSegment = null;
  };

  parsed.forEach((row, index) => {
    const streakType = row.status;
    if (openSegment && streakType !== openSegment.type) {
      finalizeSegment(index - 1);
    }

    if (streakType === "hot") {
      hotRun += 1;
      coldRun = 0;
      if (!openSegment) {
        openSegment = { type: "hot", startIndex: index };
      }
    } else if (streakType === "cold") {
      coldRun += 1;
      hotRun = 0;
      if (!openSegment) {
        openSegment = { type: "cold", startIndex: index };
      }
    } else {
      hotRun = 0;
      coldRun = 0;
    }

    chartPoints.push({
      date: row.date,
      gameIndex: index,
      points: row.value,
      rollingAverage:
        typeof row.rollingAverage === "number" && Number.isFinite(row.rollingAverage)
          ? row.rollingAverage
          : fallbackRolling[index] ?? row.value,
      streakType,
      streakLength:
        streakType === "hot" ? hotRun : streakType === "cold" ? coldRun : 0
    });

    if (streakType === "neutral" && openSegment) {
      finalizeSegment(index - 1);
    }
  });

  if (openSegment) {
    finalizeSegment(parsed.length - 1);
  }

  return {
    baseline: args.baseline,
    chartPoints,
    streaks,
    valueLabel: args.valueLabel,
    averageLabel: args.averageLabel,
    baselineLabel: args.baselineLabel,
    title: args.title,
    subtitle: args.subtitle
  };
}

type ElasticityBandChartProps = {
  data: SandboxBandRow[];
  loading: boolean;
  error: string | null;
};

function ElasticityBandChart({
  data,
  loading,
  error
}: ElasticityBandChartProps) {
  const parsed = useMemo(() => {
    return data
      .map((row) => {
        const date = new Date(row.snapshotDate);
        if (Number.isNaN(date.getTime())) return null;
        const status =
          row.value > row.ciUpper
            ? "hot"
            : row.value < row.ciLower
              ? "cold"
              : "neutral";
        return {
          date,
          lower: row.ciLower,
          upper: row.ciUpper,
          value: row.value,
          baseline: row.baseline,
          status,
          gameContext: row.gameContext ?? null
        } as {
          date: Date;
          lower: number;
          upper: number;
          value: number;
          baseline: number | null;
          status: "hot" | "cold" | "neutral";
          gameContext: SandboxBandRow["gameContext"];
        };
      })
      .filter(
        (
          row
        ): row is {
          date: Date;
          lower: number;
          upper: number;
          value: number;
          baseline: number | null;
          status: "hot" | "cold" | "neutral";
          gameContext: SandboxBandRow["gameContext"];
        } => row != null
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(960);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartHeight = 320;
  const margins = useMemo(
    () => ({ top: 32, right: 24, bottom: 48, left: 64 }),
    []
  );
  const innerWidth = Math.max(containerWidth - margins.left - margins.right, 24);
  const innerHeight = Math.max(chartHeight - margins.top - margins.bottom, 24);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateWidth = () => {
      const next = element.clientWidth || 960;
      setContainerWidth((prev) => (prev !== next ? next : prev));
    };
    updateWidth();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(element);
      return () => observer.disconnect();
    }
    const handleResize = () => updateWidth();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const latest = parsed.at(-1) ?? null;
  const xTickFormatter = useMemo(() => {
    if (parsed.length <= 1) {
      return d3.timeFormat("%b %-d");
    }
    const first = parsed[0]?.date;
    const last = parsed.at(-1)?.date;
    if (!first || !last) {
      return d3.timeFormat("%b %-d");
    }
    const spanDays = Math.max(
      1,
      Math.round((last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000))
    );
    if (spanDays >= 330) return d3.timeFormat("%b '%y");
    return d3.timeFormat("%b %-d");
  }, [parsed]);

  const geometry = useMemo(() => {
    if (!parsed.length || innerWidth <= 0 || innerHeight <= 0) {
      return null;
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    parsed.forEach((row) => {
      min = Math.min(min, row.lower, row.upper, row.value);
      if (row.baseline != null) min = Math.min(min, row.baseline);
      max = Math.max(max, row.lower, row.upper, row.value);
      if (row.baseline != null) max = Math.max(max, row.baseline);
    });
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = 0;
      max = 1;
    }
    if (max === min) {
      max += 0.5;
      min -= 0.5;
    }
    const padding = Math.max((max - min) * 0.08, 1e-3);
    const domain: [number, number] = [min - padding, max + padding];

    const extent = d3.extent(parsed, (row) => row.date);
    if (!extent[0] || !extent[1]) return null;

    const xScale = d3
      .scaleTime()
      .domain([extent[0], extent[1]])
      .range([0, innerWidth]);
    const yScale = d3
      .scaleLinear()
      .domain(domain)
      .range([innerHeight, 0])
      .nice();

    const areaGenerator = d3
      .area<typeof parsed[number]>()
      .x((d) => xScale(d.date))
      .y0((d) => yScale(d.lower))
      .y1((d) => yScale(d.upper))
      .curve(d3.curveMonotoneX);

    const lineGenerator = d3
      .line<{ date: Date; value: number }>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    const valueSeries = parsed.map((row) => ({
      date: row.date,
      value: row.value
    }));
    const baselineSeries = parsed
      .filter((row) => row.baseline != null)
      .map((row) => ({
        date: row.date,
        value: row.baseline as number
      }));

    return {
      xScale,
      yScale,
      areaPath: areaGenerator(parsed) ?? "",
      linePath: lineGenerator(valueSeries) ?? "",
      baselinePath:
        baselineSeries.length >= 2 ? lineGenerator(baselineSeries) ?? "" : "",
      xTicks: xScale.ticks(Math.min(6, parsed.length)),
      yTicks: yScale.ticks(6)
    };
  }, [parsed, innerHeight, innerWidth]);

  useEffect(() => {
    if (hoveredIndex != null && hoveredIndex >= parsed.length) {
      setHoveredIndex(null);
    }
  }, [hoveredIndex, parsed.length]);

  const hoveredPoint = hoveredIndex != null ? parsed[hoveredIndex] ?? null : null;
  const hoveredGeometry =
    hoveredPoint && geometry
      ? {
          x: margins.left + geometry.xScale(hoveredPoint.date),
          y: margins.top + geometry.yScale(hoveredPoint.value)
        }
      : null;

  const handleChartMouseMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (!geometry || !svgRef.current || !parsed.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const svgX = ((event.clientX - rect.left) / rect.width) * containerWidth;
    const plotX = svgX - margins.left;
    const clampedX = Math.max(0, Math.min(innerWidth, plotX));
    const hoveredDate = geometry.xScale.invert(clampedX);
    const bisect = d3.bisector<(typeof parsed)[number], Date>((row) => row.date).center;
    const nextIndex = bisect(parsed, hoveredDate);
    setHoveredIndex(Math.max(0, Math.min(parsed.length - 1, nextIndex)));
  };

  const handleChartMouseLeave = () => {
    setHoveredIndex(null);
  };

  const statusLabel =
    latest?.status === "hot"
      ? "Running Hot"
      : latest?.status === "cold"
        ? "Running Cold"
        : "Within Band";

  const statusValueClass =
    latest?.status === "hot"
      ? styles.bandChartLatestHot
      : latest?.status === "cold"
        ? styles.bandChartLatestCold
        : styles.bandChartLatestNeutral;

  return (
    <div className={styles.bandChart}>
      <div className={styles.bandChartHeader}>
        <div className={styles.bandChartTitleBlock}>
          <span className={styles.bandChartMetric}>
            {data[0]?.metricLabel ?? "Elasticity Band"}
          </span>
          <span className={styles.bandChartWindow}>
            Window {data[0]?.windowCode?.toUpperCase() ?? "—"}
          </span>
        </div>
        <div className={styles.bandChartLatest}>
          {latest ? (
            <>
              <span className={styles.bandChartLatestValue}>
                {latest.value.toFixed(2)}
              </span>
              <span
                className={`${styles.bandChartLatestStatus} ${statusValueClass}`}
              >
                {statusLabel}
              </span>
              <span className={styles.bandChartLatestRange}>
                Band {latest.lower.toFixed(2)} – {latest.upper.toFixed(2)}
              </span>
              {latest.baseline != null && (
                <span className={styles.bandChartLatestBaseline}>
                  Baseline {latest.baseline.toFixed(2)}
                </span>
              )}
            </>
          ) : (
            <span className={styles.bandChartLatestValue}>—</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.bandChartMessage}>Loading band history…</div>
      ) : error ? (
        <div className={`${styles.bandChartMessage} ${styles.bandChartError}`}>
          {error}
        </div>
      ) : !parsed.length ? (
        <div className={styles.bandChartMessage}>
          No historical band data available yet.
        </div>
      ) : !geometry ? (
        <div className={styles.bandChartMessage}>
          Not enough room to render the band chart.
        </div>
      ) : (
        <div ref={containerRef} className={styles.bandChartWrapper}>
          {hoveredPoint && hoveredGeometry ? (
            <div
              className={styles.bandChartTooltip}
              style={{
                left: `${Math.min(
                  Math.max(hoveredGeometry.x + 14, 16),
                  containerWidth - 220
                )}px`,
                top: `${Math.max(hoveredGeometry.y - 18, 16)}px`
              }}
            >
              <div className={styles.bandChartTooltipDate}>
                {format(hoveredPoint.date, "MMM d, yyyy")}
              </div>
              {hoveredPoint.gameContext?.teamAbbreviation ||
              hoveredPoint.gameContext?.opponentAbbreviation ? (
                <div className={styles.bandChartTooltipMatchup}>
                  {hoveredPoint.gameContext?.homeRoad === "H" ? "vs" : "@"}{" "}
                  {hoveredPoint.gameContext?.opponentAbbreviation ?? "—"}
                </div>
              ) : null}
              <div className={styles.bandChartTooltipGrid}>
                <span>Current</span>
                <strong>{formatNumber(hoveredPoint.value, 2)}</strong>
                <span>Usual range</span>
                <strong>
                  {formatNumber(hoveredPoint.lower, 2)} - {formatNumber(hoveredPoint.upper, 2)}
                </strong>
                <span>Normal level</span>
                <strong>{formatNumber(hoveredPoint.baseline, 2)}</strong>
                {hoveredPoint.gameContext?.points != null ? (
                  <>
                    <span>Points</span>
                    <strong>{formatNumber(hoveredPoint.gameContext.points, 0)}</strong>
                  </>
                ) : null}
                {hoveredPoint.gameContext?.shots != null ? (
                  <>
                    <span>Shots</span>
                    <strong>{formatNumber(hoveredPoint.gameContext.shots, 0)}</strong>
                  </>
                ) : null}
                {hoveredPoint.gameContext?.ppPoints != null ? (
                  <>
                    <span>PP Points</span>
                    <strong>{formatNumber(hoveredPoint.gameContext.ppPoints, 0)}</strong>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
          <svg
            ref={svgRef}
            className={styles.bandChartSvg}
            width="100%"
            height={chartHeight}
            viewBox={`0 0 ${containerWidth} ${chartHeight}`}
            preserveAspectRatio="none"
            onMouseMove={handleChartMouseMove}
            onMouseLeave={handleChartMouseLeave}
          >
            <g transform={`translate(${margins.left},${margins.top})`}>
              <rect
                className={styles.bandChartPlot}
                width={innerWidth}
                height={innerHeight}
              />
              {geometry.yTicks.map((tickValue) => {
                const y = geometry.yScale(tickValue);
                return (
                  <g key={`y-${tickValue}`}>
                    <line
                      className={styles.bandChartGridline}
                      x1={0}
                      x2={innerWidth}
                      y1={y}
                      y2={y}
                    />
                    <text
                      className={`${styles.bandChartAxisText} ${styles.bandChartAxisTextY}`}
                      x={-12}
                      y={y}
                      dy="0.32em"
                      textAnchor="end"
                    >
                      {tickValue.toFixed(2)}
                    </text>
                  </g>
                );
              })}
              {geometry.xTicks.map((tickDate) => {
                const x = geometry.xScale(tickDate);
                return (
                  <g
                    key={`x-${tickDate.getTime()}`}
                    transform={`translate(${x},0)`}
                  >
                    <line
                      className={styles.bandChartGridlineVertical}
                      x1={0}
                      x2={0}
                      y1={0}
                      y2={innerHeight}
                    />
                    <text
                      className={`${styles.bandChartAxisText} ${styles.bandChartAxisTextX}`}
                      x={0}
                      y={innerHeight + 16}
                      textAnchor="middle"
                    >
                      {xTickFormatter(tickDate)}
                    </text>
                  </g>
                );
              })}
              {geometry.areaPath && (
                <path className={styles.bandChartArea} d={geometry.areaPath} />
              )}
              {geometry.baselinePath && (
                <path
                  className={styles.bandChartBaseline}
                  d={geometry.baselinePath}
                />
              )}
              {geometry.linePath && (
                <path className={styles.bandChartLine} d={geometry.linePath} />
              )}
              {hoveredPoint && hoveredGeometry ? (
                <>
                  <line
                    className={styles.bandChartCrosshairX}
                    x1={geometry.xScale(hoveredPoint.date)}
                    x2={geometry.xScale(hoveredPoint.date)}
                    y1={0}
                    y2={innerHeight}
                  />
                  <line
                    className={styles.bandChartCrosshairY}
                    x1={0}
                    x2={innerWidth}
                    y1={geometry.yScale(hoveredPoint.value)}
                    y2={geometry.yScale(hoveredPoint.value)}
                  />
                  <circle
                    className={styles.bandChartHoverDot}
                    cx={geometry.xScale(hoveredPoint.date)}
                    cy={geometry.yScale(hoveredPoint.value)}
                    r={5}
                  />
                </>
              ) : null}
              {parsed.map((point, index) => {
                const dotClass =
                  point.status === "hot"
                    ? styles.bandChartDotHot
                    : point.status === "cold"
                      ? styles.bandChartDotCold
                      : styles.bandChartDotNeutral;
                const cx = geometry.xScale(point.date);
                const cy = geometry.yScale(point.value);
                return (
                  <circle
                    key={`${point.date.getTime()}-${index}`}
                    className={`${styles.bandChartDot} ${dotClass}`}
                    cx={cx}
                    cy={cy}
                    r={3.2}
                  />
                );
              })}
            </g>
          </svg>
        </div>
      )}
    </div>
  );
}

type BrushableStreakChartProps = {
  data: HistoryTrendBundle;
  emptyMessage: string;
};

function BrushableStreakChart({
  data,
  emptyMessage
}: BrushableStreakChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(960);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const element = containerRef.current;
    if (!element) return;

    setContainerWidth(element.clientWidth || 960);

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width } = entry.contentRect;
      setContainerWidth((prev) => (Math.abs(prev - width) > 1 ? width : prev));
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const points = data.chartPoints;
    if (!points.length) {
      d3.select(svgElement).selectAll("*").remove();
      return;
    }

    const width = Math.max(containerWidth, 640);
    const margin = { top: 24, right: 36, bottom: 36, left: 68 };
    const focusHeight = 320;
    const contextHeight = 80;
    const gap = 28;
    const innerWidth = Math.max(240, width - margin.left - margin.right);
    const svgWidth = innerWidth + margin.left + margin.right;
    const svgHeight =
      margin.top + focusHeight + gap + contextHeight + margin.bottom;

    const svg = d3
      .select(svgElement)
      .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    svg.selectAll("*").remove();

    const svgId = Math.random().toString(36).slice(2, 9);
    const clipId = `clip-${svgId}`;
    const defs = svg.append("defs");
    defs
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("width", innerWidth)
      .attr("height", focusHeight);

    const focus = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const context = svg
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left},${margin.top + focusHeight + gap})`
      );

    const x = d3.scaleTime().range([0, innerWidth]);
    const x2 = d3.scaleTime().range([0, innerWidth]);
    const y = d3.scaleLinear().range([focusHeight, 0]);
    const y2 = d3.scaleLinear().range([contextHeight, 0]);

    const dateExtent = d3.extent(points, (point) => point.date) as [
      Date | undefined,
      Date | undefined
    ];
    if (!dateExtent[0] || !dateExtent[1]) return;

    let [minDate, maxDate] = dateExtent;
    if (minDate.getTime() === maxDate.getTime()) {
      const paddingMs = 2 * 24 * 60 * 60 * 1000;
      minDate = new Date(minDate.getTime() - paddingMs);
      maxDate = new Date(maxDate.getTime() + paddingMs);
    }

    x.domain([minDate, maxDate]);
    x2.domain([minDate, maxDate]);

    const rawValues = [
      data.baseline,
      ...points.flatMap((point) => [point.points, point.rollingAverage])
    ].filter((value) => Number.isFinite(value)) as number[];
    const safeValues = winsorize(rawValues, 0.01);
    let minValue = d3.min(safeValues) ?? 0;
    let maxValue = d3.max(safeValues) ?? 1;
    if (minValue === maxValue) {
      const delta = Math.abs(minValue) < 1 ? 1 : Math.abs(minValue) * 0.2;
      minValue -= delta;
      maxValue += delta;
    }
    const valuePadding = (maxValue - minValue) * 0.15 || 1;
    y.domain([minValue - valuePadding, maxValue + valuePadding]);
    y2.domain(y.domain());

    const rollingLine = d3
      .line<HistoryChartPoint>()
      .x((d) => x(d.date))
      .y((d) => y(d.rollingAverage));

    const rollingLineContext = d3
      .line<HistoryChartPoint>()
      .x((d) => x2(d.date))
      .y((d) => y2(d.rollingAverage));

    const tickFormatter = d3.timeFormat("%b %d");
    const focusXAxis = d3
      .axisBottom<Date>(x)
      .ticks(Math.min(8, points.length))
      .tickFormat((value) => tickFormatter(value as Date));
    const focusYAxis = d3.axisLeft<number>(y).ticks(6);
    const contextXAxis = d3
      .axisBottom<Date>(x2)
      .ticks(Math.min(8, points.length))
      .tickFormat((value) => tickFormatter(value as Date));

    const streakLayer = focus
      .append("g")
      .attr("class", "streak-layer")
      .attr("clip-path", `url(#${clipId})`);
    const markerLayer = focus
      .append("g")
      .attr("class", "marker-layer")
      .attr("clip-path", `url(#${clipId})`);
    const pathLayer = focus
      .append("g")
      .attr("class", "path-layer")
      .attr("clip-path", `url(#${clipId})`);
    const pointLayer = focus
      .append("g")
      .attr("class", "point-layer")
      .attr("clip-path", `url(#${clipId})`);

    const contextLayer = context.append("g");

    const linePath = pathLayer
      .append("path")
      .datum(points)
      .attr("class", "rolling-line focus-line")
      .attr("fill", "none")
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("stroke-width", 2.5);

    const contextLinePath = contextLayer
      .append("path")
      .datum(points)
      .attr("class", "rolling-line context-line")
      .attr("fill", "none")
      .attr("stroke-width", 1.5);

    const baselineLine = focus
      .append("line")
      .attr("class", "baseline-line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("stroke-dasharray", "6 4");

    const contextBaseline = context
      .append("line")
      .attr("class", "baseline-line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("stroke-dasharray", "4 4");

    const xAxisGroup = focus
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${focusHeight})`)
      .call(focusXAxis);

    const yAxisGroup = focus.append("g").attr("class", "y-axis").call(focusYAxis);

    context
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${contextHeight})`)
      .call(contextXAxis);

    const streakGradientIds = new Map<string, string>();
    data.streaks.forEach((segment) => {
      const segmentPoints = points.slice(segment.startIndex, segment.endIndex + 1);
      if (!segmentPoints.length) return;

      const deviations = segmentPoints.map((point) => {
        const delta =
          segment.type === "hot"
            ? point.rollingAverage - data.baseline
            : data.baseline - point.rollingAverage;
        return Math.max(0, delta);
      });
      const maxDeviation = Math.max(...deviations, 1e-6);
      const gradientId = `streak-gradient-${svgId}-${segment.type}-${segment.startIndex}-${segment.endIndex}`;
      const gradient = defs
        .append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("x2", "100%")
        .attr("y1", "0%")
        .attr("y2", "0%");

      const stops =
        segmentPoints.length === 1
          ? [
              { offset: 0, opacity: 0.32 },
              { offset: 1, opacity: 0.32 }
            ]
          : segmentPoints.map((point, index) => ({
              offset: index / (segmentPoints.length - 1),
              opacity: 0.18 + (deviations[index] / maxDeviation) * 0.62
            }));

      stops.forEach((stop) => {
        gradient
          .append("stop")
          .attr("offset", `${(stop.offset * 100).toFixed(2)}%`)
          .attr(
            "stop-color",
            segment.type === "hot" ? "rgb(242, 82, 33)" : "rgb(32, 168, 255)"
          )
          .attr("stop-opacity", Math.min(0.9, Math.max(0.16, stop.opacity)));
      });

      streakGradientIds.set(
        `${segment.type}-${segment.startIndex}-${segment.endIndex}`,
        gradientId
      );
    });

    const spacing = innerWidth / Math.max(points.length, 1);
    const offset = spacing * 0.45;
    const clampX = (value: number) =>
      Number.isFinite(value) ? Math.max(0, Math.min(innerWidth, value)) : 0;

    const streakRects = streakLayer
      .selectAll<SVGRectElement, StreakSegment>("rect")
      .data(
        data.streaks,
        (segment) => `${segment.type}-${segment.startIndex}-${segment.endIndex}`
      )
      .join("rect")
      .attr("class", (segment) => `streak ${segment.type}`)
      .attr("fill", (segment) => {
        const gradientId = streakGradientIds.get(
          `${segment.type}-${segment.startIndex}-${segment.endIndex}`
        );
        return gradientId
          ? `url(#${gradientId})`
          : segment.type === "hot"
            ? "rgba(242, 82, 33, 0.35)"
            : "rgba(32, 168, 255, 0.35)";
      });

    type MarkerDatum = {
      key: string;
      type: "hot" | "cold";
      date: Date;
      isStart: boolean;
    };

    const markerData: MarkerDatum[] = data.streaks.flatMap((segment) => [
      {
        key: `${segment.type}-${segment.startIndex}-start`,
        type: segment.type,
        date: segment.startDate,
        isStart: true
      },
      {
        key: `${segment.type}-${segment.endIndex}-end`,
        type: segment.type,
        date: segment.endDate,
        isStart: false
      }
    ]);

    const markerLines = markerLayer
      .selectAll<SVGLineElement, MarkerDatum>("line")
      .data(markerData, (d) => d.key)
      .join("line")
      .attr(
        "class",
        (d) => `streak-marker ${d.type} ${d.isStart ? "start" : "end"}`
      )
      .attr("stroke", (d) =>
        d.type === "hot"
          ? "rgba(242, 82, 33, 0.85)"
          : "rgba(32, 168, 255, 0.85)"
      )
      .attr("stroke-width", (d) => (d.isStart ? 1.5 : 1))
      .attr("stroke-dasharray", (d) => (d.isStart ? "4 2" : "4 3"));

    const circles = pointLayer
      .selectAll<SVGCircleElement, HistoryChartPoint>("circle")
      .data(points, (point) => point.gameIndex)
      .join("circle")
      .attr("class", (point) => `game-point ${point.streakType}`)
      .attr("r", 4)
      .attr("stroke-width", 1)
      .attr("stroke", "#0f172a")
      .attr("fill", (point) => {
        if (point.streakType === "hot") return "#f2542d";
        if (point.streakType === "cold") return "#3ba7ff";
        return "#a0aabf";
      })
      .attr("opacity", (point) => {
        if (point.streakType === "neutral") return 0.65;
        return Math.min(1, 0.4 + point.streakLength * 0.12);
      });

    const root = d3.select(containerRef.current);
    let hover = root.select<HTMLDivElement>("div.trend-tooltip");
    if (hover.empty()) {
      hover = root
        .append("div")
        .attr("class", "trend-tooltip")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", "rgba(15,23,42,0.92)")
        .style("border", "1px solid rgba(148,163,184,0.35)")
        .style("border-radius", "6px")
        .style("padding", "6px 8px")
        .style("font-size", "12px")
        .style("line-height", "1.35")
        .style("color", "#e5e7eb")
        .style("box-shadow", "0 8px 16px rgba(0,0,0,0.35)")
        .style("opacity", "0");
      root.style("position", "relative");
    }

    const crosshairLayer = focus
      .append("g")
      .attr("class", "crosshair-layer")
      .attr("clip-path", `url(#${clipId})`);

    const crosshairX = crosshairLayer
      .append("line")
      .attr("class", "crosshair-x")
      .attr("y1", 0)
      .attr("y2", focusHeight)
      .attr("stroke", "rgba(148,163,184,0.6)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3")
      .style("opacity", 0);

    const crosshairY = crosshairLayer
      .append("line")
      .attr("class", "crosshair-y")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("stroke", "rgba(148,163,184,0.6)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3")
      .style("opacity", 0);

    const hoverDot = crosshairLayer
      .append("circle")
      .attr("class", "hover-point")
      .attr("r", 4.5)
      .attr("fill", "#0ea5e9")
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 1)
      .style("opacity", 0);

    const fmtFull = d3.timeFormat("%b %d, %Y");
    const bisectDate = d3.bisector<HistoryChartPoint, Date>((d) => d.date).left;

    const updateFocus = () => {
      linePath.attr("d", rollingLine);
      contextLinePath.attr("d", rollingLineContext);

      baselineLine
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", y(data.baseline))
        .attr("y2", y(data.baseline));

      contextBaseline
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", y2(data.baseline))
        .attr("y2", y2(data.baseline));

      streakRects
        .attr("y", 0)
        .attr("height", focusHeight)
        .attr("x", (segment) => clampX(x(segment.startDate) - offset))
        .attr("width", (segment) => {
          const start = clampX(x(segment.startDate) - offset);
          const end = clampX(x(segment.endDate) + offset);
          return Math.max(2, Math.abs(end - start));
        });

      markerLines
        .attr("x1", (d) => clampX(x(d.date)))
        .attr("x2", (d) => clampX(x(d.date)))
        .attr("y1", 0)
        .attr("y2", focusHeight);

      circles
        .attr("cx", (point) => clampX(x(point.date)))
        .attr("cy", (point) => y(point.points));

      xAxisGroup.call(focusXAxis);
      yAxisGroup.call(focusYAxis);
    };

    updateFocus();

    let brushGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null =
      null;
    let isSyncing = false;

    const brush = d3
      .brushX()
      .extent([
        [0, 0],
        [innerWidth, contextHeight]
      ])
      .on("brush end", (event) => {
        if (isSyncing) return;
        if (event.sourceEvent && event.sourceEvent.type === "zoom") return;
        const selection = event.selection as [number, number] | null;
        if (!selection) return;
        const [x0, x1] = selection;
        x.domain([x2.invert(x0), x2.invert(x1)]);
        updateFocus();
        isSyncing = true;
        try {
          zoomPane.call(
            zoom.transform,
            d3.zoomIdentity
              .scale(innerWidth / Math.max(1, x1 - x0))
              .translate(-x0, 0)
          );
        } finally {
          isSyncing = false;
        }
      });

    const zoom = d3
      .zoom<SVGRectElement, unknown>()
      .filter(
        (ev: any) =>
          ev.type === "wheel" ||
          (ev.type === "mousedown" && ev.button === 0) ||
          ev.type === "touchstart" ||
          ev.type === "touchmove" ||
          ev.type === "touchend"
      )
      .scaleExtent([1, 20])
      .translateExtent([
        [0, 0],
        [innerWidth, focusHeight]
      ])
      .extent([
        [0, 0],
        [innerWidth, focusHeight]
      ])
      .on("zoom", (event) => {
        if (isSyncing) return;
        if (event.sourceEvent && event.sourceEvent.type === "brush") return;
        const transform = event.transform;
        x.domain(transform.rescaleX(x2).domain());
        updateFocus();
        if (brushGroup) {
          isSyncing = true;
          try {
            brushGroup.call(
              brush.move,
              x.range().map(transform.invertX, transform) as [number, number]
            );
          } finally {
            isSyncing = false;
          }
        }
      });

    const zoomPane = svg
      .append("rect")
      .attr("class", "zoom-pane")
      .attr("width", innerWidth)
      .attr("height", focusHeight)
      .attr("transform", `translate(${margin.left},${margin.top})`)
      .style("fill", "none")
      .style("pointer-events", "all")
      .style("cursor", "crosshair")
      .on("mousemove", (event) => {
        const [mx, my] = d3.pointer(event, focus.node() as SVGGElement);
        const clampedX = Math.max(0, Math.min(innerWidth, mx));
        const clampedY = Math.max(0, Math.min(focusHeight, my));

        crosshairX
          .attr("x1", clampedX)
          .attr("x2", clampedX)
          .style("opacity", 1);
        crosshairY
          .attr("y1", clampedY)
          .attr("y2", clampedY)
          .style("opacity", 1);

        const xm = x.invert(clampedX);
        const i = Math.max(1, Math.min(points.length - 1, bisectDate(points, xm)));
        const p0 = points[i - 1];
        const p1 = points[i];
        const nearest =
          !p1 ||
          xm.getTime() - p0.date.getTime() < p1.date.getTime() - xm.getTime()
            ? p0
            : p1;

        hoverDot
          .attr("cx", x(nearest.date))
          .attr("cy", y(nearest.points))
          .style("opacity", 1);

        const html = `
          <div><strong>${fmtFull(nearest.date)}</strong></div>
          <div>${data.valueLabel}: ${nearest.points.toFixed(2)}</div>
          <div>${data.averageLabel}: ${nearest.rollingAverage.toFixed(2)}</div>
          <div>${data.baselineLabel}: ${data.baseline.toFixed(2)}</div>
          <div>Streak: ${
            nearest.streakType === "neutral"
              ? "neutral"
              : `${nearest.streakType} ×${nearest.streakLength}`
          }</div>`;

        hover.html(html).style("opacity", "1");
        const [cx, cy] = d3.pointer(
          event,
          containerRef.current as HTMLDivElement
        );
        hover.style("left", `${cx + 14}px`).style("top", `${cy + 12}px`);
      })
      .on("mouseleave", () => {
        crosshairX.style("opacity", 0);
        crosshairY.style("opacity", 0);
        hoverDot.style("opacity", 0);
        hover.style("opacity", "0");
      })
      .call(zoom)
      .on("mousedown.zoomCursor", function () {
        d3.select(this as SVGRectElement).style("cursor", "grabbing");
        hover.style("opacity", "0");
      })
      .on("mouseup.zoomCursor", function () {
        d3.select(this as SVGRectElement).style("cursor", "crosshair");
      });

    brushGroup = context.append("g").attr("class", "brush").call(brush);
    isSyncing = true;
    try {
      brushGroup.call(brush.move, x.range() as [number, number]);
    } finally {
      isSyncing = false;
    }

    return () => {
      svg.selectAll("*").remove();
    };
  }, [containerWidth, data]);

  if (!data.chartPoints.length) {
    return <div className={styles.chartPlaceholder}>{emptyMessage}</div>;
  }

  return (
    <div ref={containerRef} className={styles.chartWrapper}>
      <div className={styles.chartMeta}>
        <h2>{data.title}</h2>
        <span>{data.subtitle}</span>
      </div>
      <svg
        ref={svgRef}
        className={styles.chartSvg}
        role="img"
        aria-label={data.title}
      />
    </div>
  );
}

export default function TrendsSandboxPage() {
  const router = useRouter();
  const hasHydratedQuery = useRef(false);
  const skipNextEntityReset = useRef(false);
  const [entityType, setEntityType] = useState<SandboxEntityType>("skater");
  const [chartSurfaceTab, setChartSurfaceTab] =
    useState<ChartSurfaceTab>("elasticity");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EntityOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<EntityOption | null>(null);
  const [requestedDate, setRequestedDate] = useState(DEFAULT_DATE);
  const [windowCode, setWindowCode] = useState<(typeof WINDOW_OPTIONS)[number]>(
    "l5"
  );
  const [selectedMetric, setSelectedMetric] = useState(
    SANDBOX_ENTITY_CONFIG.skater.metrics[0]?.key ?? "ixg_per_60"
  );
  const [scoreData, setScoreData] = useState<ScoresResponse | null>(null);
  const [bandData, setBandData] = useState<BandsResponse | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [bandLoading, setBandLoading] = useState(false);
  const [scoreHistoryData, setScoreHistoryData] =
    useState<ScoreHistoryResponse | null>(null);
  const [skaterTrendRows, setSkaterTrendRows] = useState<SkaterTrendGameRow[]>([]);
  const [scoreHistoryLoading, setScoreHistoryLoading] = useState(false);
  const [skaterTrendLoading, setSkaterTrendLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bandError, setBandError] = useState<string | null>(null);
  const [scoreHistoryError, setScoreHistoryError] = useState<string | null>(null);
  const [skaterTrendError, setSkaterTrendError] = useState<string | null>(null);

  const entityConfig = SANDBOX_ENTITY_CONFIG[entityType];
  const selectedEntityId = selectedEntity?.id ?? null;
  const initialMetricKey = entityConfig.metrics[0]?.key ?? "";
  const activeSeasonId = useMemo(() => {
    if (!selectedEntity) return null;
    return (
      scoreData?.selectedRow?.seasonId ??
      scoreData?.rows.find((row) => row.entityId === selectedEntity.id)?.seasonId ??
      null
    );
  }, [scoreData, selectedEntity]);
  const resolvedSeasonId = useMemo(
    () => activeSeasonId ?? resolveSeasonIdFromDate(requestedDate),
    [activeSeasonId, requestedDate]
  );

  useEffect(() => {
    if (!router.isReady || hasHydratedQuery.current) return;

    const query = router.query as Record<string, unknown>;
    const nextEntityType = parseEntityTypeQuery(query.entityType);
    const nextDate =
      typeof query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.date)
        ? query.date
        : DEFAULT_DATE;
    const nextWindowCode = parseWindowCodeQuery(query.windowCode) ?? "l5";
    const nextChartTab =
      parseChartSurfaceTabQuery(query.chartSurfaceTab) ?? "elasticity";
    const nextEntityId = parseEntityIdQuery(query);
    const nextMetricKey =
      typeof query.metricKey === "string" &&
      SANDBOX_ENTITY_CONFIG[nextEntityType].metrics.some(
        (metric) => metric.key === query.metricKey
      )
        ? query.metricKey
        : SANDBOX_ENTITY_CONFIG[nextEntityType].metrics[0]?.key ?? "ixg_per_60";

    hasHydratedQuery.current = true;
    skipNextEntityReset.current = true;
    setEntityType(nextEntityType);
    setRequestedDate(nextDate);
    setWindowCode(nextWindowCode);
    setChartSurfaceTab(nextChartTab);
    setSelectedMetric(nextMetricKey);

    if (nextEntityId == null) return;

    if (nextEntityType === "team") {
      const team = TEAM_OPTIONS.find((option) => option.id === nextEntityId) ?? null;
      if (team) {
        setSelectedEntity(team);
      }
      return;
    }

    let cancelled = false;
    supabase
      .from("players")
      .select("id, fullName, position, team_id, image_url")
      .eq("id", nextEntityId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setSelectedEntity({
          id: Number(data.id),
          name: data.fullName ?? `Player ${nextEntityId}`,
          subtitle: buildPlayerSubtitle({
            teamId: data.team_id,
            positionCode: data.position
          }),
          imageUrl: data.image_url ?? null
        });
        setSearchQuery(data.fullName ?? "");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!router.isReady || !hasHydratedQuery.current) return;

    const nextQuery: Record<string, string> = {
      entityType,
      date: requestedDate,
      windowCode,
      metricKey: selectedMetric,
      chartSurfaceTab
    };

    if (selectedEntity) {
      nextQuery.entityId = String(selectedEntity.id);
      nextQuery.entitySlug = slugifyEntityName(selectedEntity.name) ?? String(selectedEntity.id);
      if (entityType === "team") {
        nextQuery.teamId = String(selectedEntity.id);
      } else {
        nextQuery.playerId = String(selectedEntity.id);
      }
    }

    if (resolvedSeasonId) {
      nextQuery.seasonId = String(resolvedSeasonId);
    }

    const currentQuery = router.query as Record<string, unknown>;
    const normalizedCurrent = Object.entries(currentQuery)
      .reduce<Record<string, string>>((acc, [key, value]) => {
        if (typeof value === "string") acc[key] = value;
        return acc;
      }, {});

    const sameQuery =
      Object.keys(nextQuery).length === Object.keys(normalizedCurrent).length &&
      Object.entries(nextQuery).every(([key, value]) => normalizedCurrent[key] === value);

    if (sameQuery) return;

    router.replace(
      {
        pathname: router.pathname,
        query: nextQuery
      },
      undefined,
      { shallow: true, scroll: false }
    );
  }, [
    chartSurfaceTab,
    entityType,
    requestedDate,
    resolvedSeasonId,
    router,
    selectedEntity,
    selectedMetric,
    windowCode
  ]);

  useEffect(() => {
    if (skipNextEntityReset.current) {
      skipNextEntityReset.current = false;
      return;
    }
    setSearchQuery("");
    setSearchResults([]);
    setSelectedEntity(null);
    setSelectedMetric(initialMetricKey);
    setBandData(null);
    setScoreHistoryData(null);
    setSkaterTrendRows([]);
    setChartSurfaceTab("elasticity");
    setErrorMessage(null);
    setBandError(null);
    setScoreHistoryError(null);
    setSkaterTrendError(null);
  }, [entityType, initialMetricKey]);

  useEffect(() => {
    if (entityType === "team") {
      setSearchResults([]);
      return;
    }

    if (searchQuery.trim().length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          entityType,
          q: searchQuery.trim(),
          limit: "12"
        });
        const response = await fetch(
          `/api/v1/sustainability/entity-options?${params.toString()}`
        );
        const json = (await response.json()) as {
          success: boolean;
          options?: EntityOption[];
          message?: string;
        };

        if (cancelled) return;
        if (!response.ok || !json.success) {
          throw new Error(json.message ?? "Failed to search entities");
        }
        setSearchResults(json.options ?? []);
      } catch (error: any) {
        if (!cancelled) {
          setSearchResults([]);
          setErrorMessage(error?.message ?? "Unable to search right now.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [entityType, searchQuery]);

  useEffect(() => {
    let cancelled = false;
    setScoreLoading(true);
    setErrorMessage(null);

    const params = new URLSearchParams({
      entityType,
      date: requestedDate,
      windowCode,
      limit: "80"
    });
    if (selectedEntityId != null) {
      params.set("entityId", String(selectedEntityId));
    }

    fetch(`/api/v1/sustainability/entity-scores?${params.toString()}`)
      .then(async (response) => {
        const json = (await response.json()) as ScoresResponse & {
          success: boolean;
          message?: string;
        };
        if (cancelled) return;
        if (!response.ok || !json.success) {
          throw new Error(json.message ?? "Failed to load sustainability scores");
        }
        setScoreData(json);
      })
      .catch((error: any) => {
        if (!cancelled) {
          setScoreData(null);
          setErrorMessage(error?.message ?? "Unable to load sustainability scores.");
        }
      })
      .finally(() => {
        if (!cancelled) setScoreLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entityType, requestedDate, selectedEntityId, windowCode]);

  useEffect(() => {
    if (entityType !== "skater" || selectedEntityId == null) {
      setSkaterTrendRows([]);
      setSkaterTrendError(null);
      setSkaterTrendLoading(false);
      return;
    }

    let cancelled = false;
    const seasonId = activeSeasonId ?? resolveSeasonIdFromDate(requestedDate);
    const seasonRange = getSeasonDateRangeFromSeasonId(seasonId);
    if (!seasonRange) {
      setSkaterTrendRows([]);
      setSkaterTrendError("Unable to resolve the selected season window.");
      return;
    }

    setSkaterTrendLoading(true);
    setSkaterTrendError(null);

    const { startDate, endDateExclusive } = seasonRange;

    Promise.all([
      supabase
        .from("wgo_skater_stats")
        .select(
          "date, season_id, games_played, points, goals, assists, shots, hits, blocked_shots, pp_points, points_per_60_5v5, pp_goals_per_60, pp_points_per_60, pp_toi_pct_per_game, shooting_percentage, blocks_per_60, hits_per_60"
        )
        .eq("player_id", selectedEntityId)
        .eq("season_id", seasonId)
        .gt("games_played", 0)
        .gte("date", startDate)
        .lt("date", endDateExclusive)
        .order("date", { ascending: true }),
      supabase
        .from("nst_gamelog_as_counts")
        .select(
          "date_scraped, season, gp, ixg, icf, hdcf, ipp, sh_percentage, shots, toi, total_points"
        )
        .eq("player_id", selectedEntityId)
        .eq("season", seasonId)
        .gt("gp", 0)
        .gte("date_scraped", startDate)
        .lt("date_scraped", endDateExclusive)
        .order("date_scraped", { ascending: true }),
      supabase
        .from("nst_gamelog_as_counts_oi")
        .select("date_scraped, season, gp, on_ice_sh_pct, on_ice_sv_pct, pdo, toi")
        .eq("player_id", selectedEntityId)
        .eq("season", seasonId)
        .gt("gp", 0)
        .gte("date_scraped", startDate)
        .lt("date_scraped", endDateExclusive)
        .order("date_scraped", { ascending: true })
    ])
      .then(([wgoResponse, nstCountsResponse, nstOiResponse]) => {
        if (cancelled) return;
        if (wgoResponse.error) throw wgoResponse.error;
        if (nstCountsResponse.error) throw nstCountsResponse.error;
        if (nstOiResponse.error) throw nstOiResponse.error;

        const wgoRows = (wgoResponse.data as WgoSkaterTrendRow[] | null) ?? [];
        const merged = new Map<string, SkaterTrendGameRow>();

        wgoRows.forEach((row) => {
          const date = normalizeDateOnly(row.date);
          if (!date) return;
          merged.set(date, {
            date,
            seasonId: row.season_id ?? seasonId,
            toiSeconds: null,
            totalPoints: row.points ?? 0,
            shots: row.shots ?? 0,
            hits: row.hits ?? 0,
            blocks: row.blocked_shots ?? 0,
            ppPoints: row.pp_points ?? 0,
            ixgPer60: null,
            icfPer60: null,
            hdcfPer60: null,
            ipp: null,
            onIceShPct: null,
            onIceSvPct: null,
            pdo: null,
            pointsPer60_5v5: asFiniteNumber(row.points_per_60_5v5),
            ppGoalsPer60: asFiniteNumber(row.pp_goals_per_60),
            ppPointsPer60: asFiniteNumber(row.pp_points_per_60),
            ppToiPct: asFiniteNumber(row.pp_toi_pct_per_game),
            shootingPct: toDecimalPct(asFiniteNumber(row.shooting_percentage)),
            blocksPer60: asFiniteNumber(row.blocks_per_60),
            hitsPer60: asFiniteNumber(row.hits_per_60),
            fantasyScore:
              (row.goals ?? 0) * FANTASY_WEIGHTS.G +
              (row.assists ?? 0) * FANTASY_WEIGHTS.A +
              (row.pp_points ?? 0) * FANTASY_WEIGHTS.PPP_BONUS +
              (row.shots ?? 0) * FANTASY_WEIGHTS.SOG +
              (row.hits ?? 0) * FANTASY_WEIGHTS.HIT +
              (row.blocked_shots ?? 0) * FANTASY_WEIGHTS.BLK
          });
        });

        (nstCountsResponse.data as NstSkaterCountsRow[] | null)?.forEach((row) => {
          const date = normalizeDateOnly(row.date_scraped);
          if (!date) return;
          const current = merged.get(date);
          if (!current && wgoRows.length > 0) return;
          const next =
            current ??
            {
              date,
              seasonId: row.season ?? seasonId,
              toiSeconds: null,
              totalPoints: row.total_points ?? 0,
              shots: row.shots ?? 0,
              hits: 0,
              blocks: 0,
              ppPoints: 0,
              ixgPer60: null,
              icfPer60: null,
              hdcfPer60: null,
              ipp: null,
              onIceShPct: null,
              onIceSvPct: null,
              pdo: null,
              pointsPer60_5v5: null,
              ppGoalsPer60: null,
              ppPointsPer60: null,
              ppToiPct: null,
              shootingPct: toDecimalPct(asFiniteNumber(row.sh_percentage)),
              blocksPer60: null,
              hitsPer60: null,
              fantasyScore: 0
            };
          const toiSeconds = asFiniteNumber(row.toi);
          next.toiSeconds = toiSeconds ?? next.toiSeconds;
          next.totalPoints = row.total_points ?? next.totalPoints;
          next.shots = row.shots ?? next.shots;
          next.ixgPer60 = toRatePer60(asFiniteNumber(row.ixg), toiSeconds);
          next.icfPer60 = toRatePer60(asFiniteNumber(row.icf), toiSeconds);
          next.hdcfPer60 = toRatePer60(asFiniteNumber(row.hdcf), toiSeconds);
          next.ipp = toDecimalPct(asFiniteNumber(row.ipp));
          next.shootingPct =
            toDecimalPct(asFiniteNumber(row.sh_percentage)) ?? next.shootingPct;
          merged.set(date, next);
        });

        (nstOiResponse.data as NstSkaterOnIceRow[] | null)?.forEach((row) => {
          const date = normalizeDateOnly(row.date_scraped);
          if (!date) return;
          const current = merged.get(date);
          if (!current) return;
          current.toiSeconds = asFiniteNumber(row.toi) ?? current.toiSeconds;
          current.onIceShPct = toDecimalPct(asFiniteNumber(row.on_ice_sh_pct));
          current.onIceSvPct = toDecimalPct(asFiniteNumber(row.on_ice_sv_pct));
          current.pdo = asFiniteNumber(row.pdo);
          merged.set(date, current);
        });

        const rows = [...merged.values()]
          .filter((row) => normalizeDateOnly(row.date) != null)
          .sort((a, b) => a.date.localeCompare(b.date));
        setSkaterTrendRows(rows);
      })
      .catch((error: any) => {
        if (cancelled) return;
        setSkaterTrendRows([]);
        setSkaterTrendError(
          error?.message ?? "Unable to load full-season skater trend history."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setSkaterTrendLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSeasonId, entityType, requestedDate, selectedEntityId]);

  useEffect(() => {
    if (selectedEntityId == null || !selectedMetric) {
      setBandData(null);
      return;
    }

    let cancelled = false;
    setBandLoading(true);
    setBandError(null);

    const params = new URLSearchParams({
      entityType,
      entityId: String(selectedEntityId),
      date: requestedDate,
      windowCode,
      metricKey: selectedMetric,
      limit: "180"
    });

    fetch(`/api/v1/sustainability/entity-bands?${params.toString()}`)
      .then(async (response) => {
        const json = (await response.json()) as BandsResponse & {
          success: boolean;
          message?: string;
        };
        if (cancelled) return;
        if (!response.ok || !json.success) {
          throw new Error(json.message ?? "Failed to load elasticity bands");
        }
        setBandData(json);
      })
      .catch((error: any) => {
        if (!cancelled) {
          setBandData(null);
          setBandError(error?.message ?? "Unable to load elasticity bands.");
        }
      })
      .finally(() => {
        if (!cancelled) setBandLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entityType, requestedDate, selectedEntityId, selectedMetric, windowCode]);

  useEffect(() => {
    if (selectedEntityId == null) {
      setScoreHistoryData(null);
      return;
    }

    let cancelled = false;
    setScoreHistoryLoading(true);
    setScoreHistoryError(null);

    const params = new URLSearchParams({
      entityType,
      entityId: String(selectedEntityId),
      date: requestedDate,
      windowCode,
      limit: "180"
    });

    fetch(`/api/v1/sustainability/entity-history?${params.toString()}`)
      .then(async (response) => {
        const json = (await response.json()) as ScoreHistoryResponse & {
          success: boolean;
          message?: string;
        };
        if (cancelled) return;
        if (!response.ok || !json.success) {
          throw new Error(
            json.message ?? "Failed to load sustainability score history"
          );
        }
        setScoreHistoryData(json);
      })
      .catch((error: any) => {
        if (!cancelled) {
          setScoreHistoryData(null);
          setScoreHistoryError(
            error?.message ?? "Unable to load sustainability score history."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setScoreHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entityType, requestedDate, selectedEntityId, windowCode]);

  const activeRow = useMemo(() => {
    if (!selectedEntity) return null;
    return (
      scoreData?.selectedRow ??
      scoreData?.rows.find((row) => row.entityId === selectedEntity.id) ??
      null
    );
  }, [scoreData, selectedEntity]);

  const bandRows = useMemo(() => {
    if (!bandData?.currentRows) return [];
    return [...bandData.currentRows].sort((a, b) =>
      a.metricLabel.localeCompare(b.metricLabel)
    );
  }, [bandData]);

  const filteredBandHistoryRows = useMemo(() => {
    const rows = bandData?.historyRows ?? [];
    if (!rows.length) return [];
    const seasonRows = rows.filter(
      (row) => row.seasonId == null || row.seasonId === resolvedSeasonId
    );
    return seasonRows.length ? seasonRows : rows;
  }, [bandData, resolvedSeasonId]);

  const topSurfaceLinks = useMemo(
    () =>
      TRENDS_SURFACE_LINKS.slice(0, 3).map((link) => {
        if (link.label === "Underlying Stats") {
          return {
            ...link,
            description: "Open the bigger-picture team read behind this player's form."
          };
        }
        if (link.label === "Splits") {
          return {
            ...link,
            description: "Check matchup and split context before acting on the trend."
          };
        }
        if (link.label === "Starter Board") {
          return {
            ...link,
            description: "Carry the read into start-sit and lineup decisions."
          };
        }
        return link;
      }),
    []
  );

  const bandRowsByMetricKey = useMemo(() => {
    const lookup = new Map<string, SandboxBandRow>();
    bandRows.forEach((row) => {
      lookup.set(row.metricKey, row);
    });
    return lookup;
  }, [bandRows]);

  const metricHistoryBundle = useMemo(() => {
    if (entityType === "skater" && skaterTrendRows.length) {
      const metricLabel =
        entityConfig.metrics.find((metric) => metric.key === selectedMetric)?.label ??
        "Metric";
      const points = skaterTrendRows.map((row) =>
        getSkaterMetricValue(row, selectedMetric)
      );
      const dates = skaterTrendRows.map((row) => new Date(`${row.date}T12:00:00Z`));
      const validRows = points
        .map((value, index) => ({ value, date: dates[index] }))
        .filter(
          (row): row is { value: number; date: Date } =>
            typeof row.value === "number" && Number.isFinite(row.value)
        );
      if (!validRows.length) {
        return buildHistoryBundleFromTrend({
          trend: INITIAL_TREND_BUNDLE,
          title: `${metricLabel} Streaks`,
          subtitle: `Brush and zoom the selected skater metric across the full season`,
          valueLabel: metricLabel,
          averageLabel: `${windowCode.toUpperCase()} Avg`,
          baselineLabel: "Season Avg"
        });
      }
      const baseline =
        validRows.reduce((sum, row) => sum + row.value, 0) / validRows.length;
      return buildHistoryBundleFromTrend({
        trend: buildTrendData({
          dates: validRows.map((row) => row.date),
          points: validRows.map((row) => row.value),
          window: Number(windowCode.slice(1)) || 5,
          baseline
        }),
        title: `${metricLabel} Streaks`,
        subtitle: `Brush and zoom the selected skater metric across the full season`,
        valueLabel: metricLabel,
        averageLabel: `${windowCode.toUpperCase()} Avg`,
        baselineLabel: "Season Avg"
      });
    }

    const historyRows = filteredBandHistoryRows;
    const metricLabel =
      historyRows[0]?.metricLabel ??
      entityConfig.metrics.find((metric) => metric.key === selectedMetric)?.label ??
      "Metric";
    const baselineCandidates = historyRows
      .map((row) => row.baseline)
      .filter((value): value is number => typeof value === "number");
    const fallbackBaseline =
      baselineCandidates.at(-1) ??
      (historyRows.length
        ? historyRows.reduce((sum, row) => sum + row.value, 0) / historyRows.length
        : 0);

    return buildStatusTrendBundle({
      title: `${metricLabel} Streaks`,
      subtitle: `Brush and zoom the selected ${entityType} metric history`,
      valueLabel: metricLabel,
      averageLabel: "Band Trend",
      baselineLabel: "Baseline",
      baseline: fallbackBaseline,
      rows: historyRows.map((row) => ({
        snapshotDate: row.snapshotDate,
        value: row.value,
        rollingAverage: row.ewma,
        status:
          row.value > row.ciUpper
            ? "hot"
            : row.value < row.ciLower
              ? "cold"
              : "neutral"
      }))
    });
  }, [
    entityConfig.metrics,
    entityType,
    filteredBandHistoryRows,
    selectedMetric,
    skaterTrendRows,
    windowCode
  ]);

  const scoreHistoryBundle = useMemo(() => {
    if (entityType === "skater" && skaterTrendRows.length) {
      const fantasySeries = skaterTrendRows.map((row) => row.fantasyScore);
      const baseline = fantasySeries.length
        ? fantasySeries.reduce((sum, value) => sum + value, 0) / fantasySeries.length
        : 0;
      return buildHistoryBundleFromTrend({
        trend: buildTrendData({
          dates: skaterTrendRows.map((row) => new Date(`${row.date}T12:00:00Z`)),
          points: fantasySeries,
          window: Number(windowCode.slice(1)) || 5,
          baseline
        }),
        title: "Score Streaks",
        subtitle: "Brush and zoom the full-season fantasy score timeline",
        valueLabel: "Fantasy Score",
        averageLabel: `${windowCode.toUpperCase()} Avg`,
        baselineLabel: "Season Avg"
      });
    }

    const rows = scoreHistoryData?.rows ?? [];
    const baseline =
      rows.length > 0
        ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length
        : 50;

    return buildStatusTrendBundle({
      title: "Sustainability Score Streaks",
      subtitle: `Brush and zoom the ${windowCode.toUpperCase()} score history`,
      valueLabel: "Sustainability Score",
      averageLabel: "Rolling Score",
      baselineLabel: "History Avg",
      baseline,
      rows: rows.map((row) => ({
        snapshotDate: row.snapshotDate,
        value: row.score,
        status:
          row.expectationState === "overperforming"
            ? "hot"
            : row.expectationState === "underperforming"
              ? "cold"
              : "neutral"
        }))
    });
  }, [entityType, scoreHistoryData, skaterTrendRows, windowCode]);

  const leaderboard = useMemo(() => {
    const rows = scoreData?.rows ?? [];
    return {
      overperforming: rows
        .filter((row) => row.expectationState === "overperforming")
        .slice(0, 5),
      stable: rows.filter((row) => row.expectationState === "stable").slice(0, 5),
      underperforming: rows
        .filter((row) => row.expectationState === "underperforming")
        .slice(0, 5)
    };
  }, [scoreData]);

  const reasonHighlights = useMemo(
    () => extractReasonHighlights(activeRow?.components, 5),
    [activeRow]
  );

  const paddedReasonHighlights = useMemo<PaddedReasonCard[]>(() => {
    const cards: PaddedReasonCard[] = [...reasonHighlights];
    while (cards.length < 5) {
      cards.push({
        key: `placeholder-${cards.length + 1}`,
        label: "Awaiting signal",
        value: 0,
        direction: "positive",
        sentence: activeRow
          ? "This slot will populate when another interpretable driver clears the surfacing threshold."
          : "Select an entity to inspect the strongest inputs behind its sustainability read.",
        placeholder: true
      });
    }
    return cards;
  }, [activeRow, reasonHighlights]);

  const reasonComparisonRows = useMemo(() => {
    return paddedReasonHighlights.map((reason) => {
      const mappedMetricKey = REASON_TO_BAND_METRIC_KEY[reason.key];
      const metricRow = mappedMetricKey ? bandRowsByMetricKey.get(mappedMetricKey) : null;
      return {
        ...reason,
        comparisons:
          metricRow?.comparisons.filter((comparison) =>
            comparison.key === "l5" ||
            comparison.key === "l10" ||
            comparison.key === "l20" ||
            comparison.key === "season"
          ) ?? []
      };
    });
  }, [bandRowsByMetricKey, paddedReasonHighlights]);

  const barometerPointer = useMemo(() => {
    const rawScore = activeRow?.rawScore;
    if (typeof rawScore !== "number" || !Number.isFinite(rawScore)) {
      return 50;
    }

    const normalized =
      (clamp(rawScore, BAROMETER_MIN, BAROMETER_MAX) - BAROMETER_MIN) /
      (BAROMETER_MAX - BAROMETER_MIN);
    return normalized * 100;
  }, [activeRow]);

  const hasUsualLevelData = useMemo(() => {
    if (!activeRow) return false;
    return (
      activeRow.baselineValue != null ||
      activeRow.recentValue != null ||
      activeRow.expectedValue != null
    );
  }, [activeRow]);

  const resetState = () => {
    setEntityType("skater");
    setChartSurfaceTab("elasticity");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedEntity(null);
    setRequestedDate(DEFAULT_DATE);
    setWindowCode("l5");
    setSelectedMetric(SANDBOX_ENTITY_CONFIG.skater.metrics[0]?.key ?? "ixg_per_60");
    setScoreData(null);
    setBandData(null);
    setScoreHistoryData(null);
    setSkaterTrendRows([]);
    setErrorMessage(null);
    setBandError(null);
    setScoreHistoryError(null);
    setSkaterTrendError(null);
    setSkaterTrendLoading(false);
  };

  return (
    <div className={styles.page}>
      <section className={styles.topWorkspace}>
        <article className={styles.overviewCard}>
          <div className={styles.overviewHeader}>
            <span className={styles.overviewEyebrow}>Workshop Pillar</span>
            <div className={styles.overviewTitleRow}>
              <div>
                <h1 className={styles.overviewTitle}>Trends Sandbox</h1>
                <p className={styles.overviewDescription}>
                  Read whether a team, skater, or goalie is running hotter or colder
                  than their usual level using rolling windows and baseline checks.
                </p>
              </div>
              <button
                type="button"
                onClick={resetState}
                className={styles.resetButton}
              >
                Reset
              </button>
            </div>
          </div>

          <div className={styles.entityTabs}>
            {(["team", "skater", "goalie"] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={
                  type === entityType ? styles.entityTabActive : styles.entityTab
                }
                onClick={() => setEntityType(type)}
              >
                {SANDBOX_ENTITY_CONFIG[type].label}
              </button>
            ))}
          </div>

          <div className={styles.linkGrid}>
            {topSurfaceLinks.map((link) => (
              <a key={link.href} href={link.href} className={styles.linkCard}>
                <span className={styles.linkCardLabel}>{link.label}</span>
                <span className={styles.linkCardDescription}>{link.description}</span>
              </a>
            ))}
          </div>
        </article>

        <section className={styles.controls}>
          <div className={styles.controlsHeader}>
            <h2 className={styles.compactTitle}>Controls</h2>
            <span className={styles.compactMeta}>
              Pick the player, date, and time window
            </span>
          </div>
          <div className={styles.controlGrid}>
            <div className={styles.controlGroup}>
              <label htmlFor="entity-date">Date</label>
              <input
                id="entity-date"
                type="date"
                value={requestedDate}
                onChange={(event) => setRequestedDate(event.target.value)}
              />
            </div>

            <div className={styles.controlGroup}>
              <span>Window</span>
              <div className={styles.windowButtons}>
                {WINDOW_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={
                      option === windowCode
                        ? styles.windowButtonActive
                        : styles.windowButton
                    }
                    onClick={() => setWindowCode(option)}
                  >
                    {option.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {entityType === "team" ? (
              <div className={styles.controlGroup}>
                <label htmlFor="team-select">Team</label>
                <select
                  id="team-select"
                  value={selectedEntity?.id ?? ""}
                  onChange={(event) => {
                    const next = TEAM_OPTIONS.find(
                      (option) => option.id === Number(event.target.value)
                    );
                    setSelectedEntity(next ?? null);
                  }}
                >
                  <option value="">Select a team</option>
                  {TEAM_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className={styles.controlGroup}>
                <label htmlFor="entity-search">
                  {entityType === "goalie" ? "Goalie" : "Skater"}
                </label>
                <input
                  id="entity-search"
                  type="search"
                  placeholder={entityConfig.searchPlaceholder}
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setErrorMessage(null);
                  }}
                />
                {searching && <span className={styles.status}>Searching…</span>}
                {!searching && searchResults.length > 0 && (
                  <ul className={styles.playerResults}>
                    {searchResults.map((option) => (
                      <li key={option.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEntity(option);
                            setSearchQuery(option.name);
                            setSearchResults([]);
                          }}
                        >
                          <span>{option.name}</span>
                          {option.subtitle ? (
                            <span className={styles.positionTag}>
                              {option.subtitle}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className={styles.controlGroup}>
              <label htmlFor="metric-select">Focus Metric</label>
              <select
                id="metric-select"
                value={selectedMetric}
                onChange={(event) => setSelectedMetric(event.target.value)}
              >
                {entityConfig.metrics.map((metric) => (
                  <option key={metric.key} value={metric.key}>
                    {metric.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className={styles.summaryPanel}>
          <div className={styles.controlsHeader}>
            <h2 className={styles.compactTitle}>Current Read</h2>
            <span className={styles.compactMeta}>Scope and data health</span>
          </div>
          <div className={styles.summary}>
            <div>
              <strong>Entity</strong>
              <span>{selectedEntity?.name ?? entityConfig.label}</span>
            </div>
            <div>
              <strong>Date Used</strong>
              <span>{scoreData?.snapshotDate ?? "—"}</span>
            </div>
            <div>
              <strong>Window</strong>
              <span>{getWindowLabel(windowCode)}</span>
            </div>
            <div>
              <strong>Rows Loaded</strong>
              <span>{scoreLoading ? "Loading…" : scoreData?.totalRows ?? "0"}</span>
            </div>
            <div>
              <strong>Entity Type</strong>
              <span>{entityConfig.label}</span>
            </div>
            <div>
              <strong>Contract Note</strong>
              <span>{entityConfig.readinessCopy}</span>
            </div>
          </div>
        </section>
      </section>

      {errorMessage && <p className={styles.error}>{errorMessage}</p>}

      <section className={styles.sustainabilityWorkbench}>
        <article className={styles.surfaceCard}>
          <div className={styles.surfaceCardHeader}>
            <h2 className={styles.surfaceCardTitle}>Form Barometer</h2>
            <span className={styles.surfaceCardMeta}>
              {activeRow
                ? getBarometerLabel(activeRow.expectationState)
                : "Awaiting selection"}
            </span>
          </div>
          {activeRow ? (
            <div className={styles.meterBlock}>
              <div className={styles.barometerRail}>
                <div className={styles.barometerScale}>
                  <span>Cold</span>
                  <span>Usual Range</span>
                  <span>Hot</span>
                </div>
                <div className={styles.barometerTrack}>
                  <div className={styles.barometerColdZone} />
                  <div className={styles.barometerStableZone} />
                  <div className={styles.barometerHotZone} />
                  <div
                    className={styles.barometerPointer}
                    style={{ left: `${barometerPointer}%` }}
                  />
                </div>
                <p className={styles.barometerCopy}>
                  {getBarometerHelperCopy(activeRow.expectationState)}
                </p>
              </div>
              <div
                className={`${styles.meterScore} ${scoreToneClass(
                  activeRow.expectationState
                )}`}
              >
                {formatNumber(activeRow.score, 2)}
              </div>
              <div className={styles.meterMeta}>
                <div>
                  <strong>Reading</strong>
                  <span>{getBarometerLabel(activeRow.expectationState)}</span>
                </div>
                <div>
                  <strong>Heat Check</strong>
                  <span>{formatNumber(activeRow.rawScore, 2)}</span>
                </div>
                <div>
                  <strong>Stability Score</strong>
                  <span>{formatNumber(activeRow.zScore, 2)}</span>
                </div>
                <div>
                  <strong>Gap vs Usual</strong>
                  <span>
                    {activeRow.recentValue != null && activeRow.expectedValue != null
                      ? formatDelta(activeRow.recentValue - activeRow.expectedValue, 2)
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.bandEmpty}>
              Select an entity to load the form barometer.
            </div>
          )}
        </article>

        <article className={styles.surfaceCard}>
          <div className={styles.surfaceCardHeader}>
            <h2 className={styles.surfaceCardTitle}>Usual Level</h2>
            <span className={styles.surfaceCardMeta}>Baseline averages</span>
          </div>
          {activeRow && hasUsualLevelData ? (
            <div className={styles.detailGrid}>
              <div>
                <strong>Normal Level</strong>
                <span>{formatNumber(activeRow.baselineValue, 2)}</span>
              </div>
              <div>
                <strong>Current Window</strong>
                <span>{formatNumber(activeRow.recentValue, 2)}</span>
              </div>
              <div>
                <strong>Expected Lane</strong>
                <span>{formatNumber(activeRow.expectedValue, 2)}</span>
              </div>
              <div>
                <strong>Window</strong>
                <span>{getWindowLabel(activeRow.windowCode)}</span>
              </div>
            </div>
          ) : (
            <div className={styles.bandEmpty}>
              {activeRow
                ? "The direct expected-lane fields are not populated for this row yet. Use the performance checkpoints below for the full rolling-average view."
                : "This panel shows where the selected player usually lands versus the current window."}
            </div>
          )}
        </article>

        <article className={`${styles.surfaceCard} ${styles.metricShelfCard}`}>
          <div className={styles.surfaceCardHeader}>
            <h2 className={styles.surfaceCardTitle}>Metric Cards</h2>
            <span className={styles.surfaceCardMeta}>{entityConfig.label}</span>
          </div>
          <ul className={styles.metricList}>
            {entityConfig.metrics.map((metric) => (
              <li key={metric.key} className={styles.metricRow}>
                <div>
                  <strong>{metric.label}</strong>
                  <span>{metric.description}</span>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className={styles.surfaceSection}>
        <div className={styles.bandHeader}>
          <h2>Slate Snapshot</h2>
          <span className={styles.bandStatus}>
            Quick leaders by current form reading
          </span>
        </div>
        <div className={styles.leaderboardGrid}>
          {(["overperforming", "stable", "underperforming"] as const).map(
            (state) => (
              <div key={state} className={styles.leaderboardCard}>
                <div className={styles.leaderboardTitle}>
                  {formatStateLabel(state)}
                </div>
                {(leaderboard[state] ?? []).length > 0 ? (
                  <ul className={styles.leaderboardList}>
                    {leaderboard[state].map((row) => (
                      <li key={`${row.entityType}-${row.entityId}`} className={styles.leaderboardRow}>
                        <button
                          type="button"
                          className={styles.leaderboardButton}
                          onClick={() =>
                            setSelectedEntity({
                              id: row.entityId,
                              name: row.entityName,
                              subtitle: row.entitySubtitle,
                              imageUrl: null
                            })
                          }
                        >
                          <span>{row.entityName}</span>
                          <span>{formatNumber(row.score, 1)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={styles.bandEmpty}>No rows in this state.</div>
                )}
              </div>
            )
          )}
        </div>
      </section>

      <section className={styles.bandSection}>
        <div className={styles.bandWorkspace}>
          <div className={styles.bandWorkspacePanel}>
            <div className={styles.bandHeader}>
              <h2>Performance Checkpoints</h2>
              {bandLoading && <span className={styles.bandStatus}>Refreshing…</span>}
              {bandError && <span className={styles.error}>{bandError}</span>}
            </div>
            <div className={styles.bandGrid}>
              {bandRows.length > 0 ? (
                bandRows.map((row) => {
                  const statusClass =
                    row.value > row.ciUpper
                      ? styles.bandHot
                      : row.value < row.ciLower
                        ? styles.bandCold
                        : styles.bandNeutral;
                  return (
                    <button
                      key={`${row.metricKey}-${row.windowCode}`}
                      type="button"
                      className={`${styles.bandCard} ${statusClass}`}
                      onClick={() => setSelectedMetric(row.metricKey)}
                    >
                      <div className={styles.bandCardHeader}>
                        <div className={styles.bandMetric}>{row.metricLabel}</div>
                        <div className={styles.bandWindow}>
                          {getWindowLabel(row.windowCode)}
                        </div>
                      </div>
                      <div className={styles.bandSnapshotRow}>
                        <span className={styles.bandSnapshotLabel}>Current Window</span>
                        <span className={styles.bandValue}>
                          {row.value.toFixed(2)}
                        </span>
                      </div>
                      <div className={styles.bandRange}>
                        Usual range {row.ciLower.toFixed(2)} – {row.ciUpper.toFixed(2)}
                      </div>
                      {row.baseline != null && (
                        <div className={styles.bandBaseline}>
                          Normal level {row.baseline.toFixed(2)}
                        </div>
                      )}
                      <div className={styles.bandComparisonList}>
                        {row.comparisons.map((comparison) => (
                          <div
                            key={`${row.metricKey}-${comparison.key}`}
                            className={styles.bandComparisonRow}
                          >
                            <span className={styles.bandComparisonLabel}>
                              {comparison.label}
                            </span>
                            <div className={styles.bandComparisonValues}>
                              <span className={styles.bandComparisonValue}>
                                {formatNumber(comparison.value, 2)}
                              </span>
                              <span
                                className={`${styles.bandComparisonDelta} ${comparisonDeltaTone(
                                  comparison.deltaPct
                                )}`}
                              >
                                {formatPercentDelta(comparison.deltaPct, 1)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className={styles.bandEmpty}>
                  {selectedEntity
                    ? "No band rows are available yet for the selected entity."
                    : "Select an entity to load threshold bands."}
                </div>
              )}
            </div>
          </div>

          <div className={styles.reasonColumn}>
            <div className={styles.bandHeader}>
              <h2>Why This Reading</h2>
              <span className={styles.bandStatus}>The biggest drivers underneath it</span>
            </div>
            <div className={styles.reasonGrid}>
              {reasonComparisonRows.map((reason) => (
                <div
                  key={reason.key}
                  className={`${styles.reasonCard} ${
                    reason.placeholder ? styles.reasonCardPlaceholder : ""
                  }`}
                >
                  <div className={styles.reasonLabel}>{reason.label}</div>
                  <div className={styles.reasonValue}>
                    {reason.placeholder ? "—" : formatDelta(reason.value, 2)}
                  </div>
                  <p className={styles.reasonSentence}>{reason.sentence}</p>
                  <div className={styles.reasonComparisonList}>
                    {(reason.comparisons.length > 0
                      ? reason.comparisons
                      : [
                          { key: "l5", label: "L5 Avg", value: null, deltaPct: null },
                          { key: "l10", label: "L10 Avg", value: null, deltaPct: null },
                          { key: "l20", label: "L20 Avg", value: null, deltaPct: null },
                          {
                            key: "season",
                            label: "Season Avg",
                            value: null,
                            deltaPct: null
                          }
                        ]
                    ).map((comparison) => (
                      <div
                        key={`${reason.key}-${comparison.key}`}
                        className={styles.reasonComparisonRow}
                      >
                        <span className={styles.reasonComparisonLabel}>
                          {comparison.label}
                        </span>
                        <div className={styles.reasonComparisonValues}>
                          <span className={styles.reasonComparisonValue}>
                            {formatNumber(comparison.value, 2)}
                          </span>
                          <span
                            className={`${styles.reasonComparisonDelta} ${comparisonDeltaTone(
                              comparison.deltaPct
                            )}`}
                          >
                            {formatPercentDelta(comparison.deltaPct, 1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.bandChartSection}>
        <div className={styles.bandHeader}>
          <h2>Historical Chart Surface</h2>
          <div className={styles.chartSurfaceTabs}>
            <button
              type="button"
              className={
                chartSurfaceTab === "elasticity"
                  ? styles.chartSurfaceTabActive
                  : styles.chartSurfaceTab
              }
              onClick={() => setChartSurfaceTab("elasticity")}
            >
              Elasticity
            </button>
            <button
              type="button"
              className={
                chartSurfaceTab === "metricStreaks"
                  ? styles.chartSurfaceTabActive
                  : styles.chartSurfaceTab
              }
              onClick={() => setChartSurfaceTab("metricStreaks")}
            >
              Metric Streaks
            </button>
            <button
              type="button"
              className={
                chartSurfaceTab === "scoreStreaks"
                  ? styles.chartSurfaceTabActive
                  : styles.chartSurfaceTab
              }
              onClick={() => setChartSurfaceTab("scoreStreaks")}
            >
              Score Streaks
            </button>
          </div>
        </div>

        {chartSurfaceTab === "elasticity" ? (
          <ElasticityBandChart
            data={filteredBandHistoryRows}
            loading={bandLoading}
            error={bandError}
          />
        ) : chartSurfaceTab === "metricStreaks" ? (
          entityType === "skater" ? (
            <BrushableStreakChart
              data={metricHistoryBundle}
              emptyMessage={
                skaterTrendLoading
                  ? "Loading full-season metric history…"
                  : skaterTrendError
                    ? skaterTrendError
                    : selectedEntity
                      ? "No full-season metric history is available for the selected skater yet."
                      : "Select a skater to load full-season metric history."
              }
            />
          ) : bandLoading ? (
            <div className={styles.chartPlaceholder}>Loading metric history…</div>
          ) : bandError ? (
            <div className={styles.chartPlaceholder}>{bandError}</div>
          ) : (
            <BrushableStreakChart
              data={metricHistoryBundle}
              emptyMessage={
                selectedEntity
                  ? "No metric streak history is available for the selected entity yet."
                  : "Select an entity to load metric streak history."
              }
            />
          )
        ) : entityType === "skater" ? (
          <BrushableStreakChart
            data={scoreHistoryBundle}
            emptyMessage={
              skaterTrendLoading
                ? "Loading full-season score history…"
                : skaterTrendError
                  ? skaterTrendError
                  : selectedEntity
                    ? "No full-season score history is available for the selected skater yet."
                    : "Select a skater to load full-season score history."
            }
          />
        ) : scoreHistoryLoading ? (
          <div className={styles.chartPlaceholder}>Loading score history…</div>
        ) : scoreHistoryError ? (
          <div className={styles.chartPlaceholder}>{scoreHistoryError}</div>
        ) : (
          <BrushableStreakChart
            data={scoreHistoryBundle}
            emptyMessage={
              selectedEntity
                ? "No sustainability score history is available for the selected entity yet."
                : "Select an entity to load sustainability score history."
            }
          />
        )}
      </section>
    </div>
  );
}
