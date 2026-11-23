import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import * as d3 from "d3";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/router";
import type { StreakSegment, StreakType, TrendDataBundle } from "lib/trends/types";
import {
  buildTrendData,
  mean,
  rollingAverage,
  summarizePairedCorrelation,
  winsorize
} from "lib/trends/utils";

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
import {
  readUsualRange,
  USUAL_RANGE_REASON_LABELS
} from "lib/sustainability/usualRange";
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

// Short labels for the Focus metric toggle (TJ). The full name stays in the
// accessible name, the hover title and the note under the toggle. Keys repeat
// across entity types (on_ice_sh_pct), so the map is per type.
const METRIC_SHORT_LABELS: Record<SandboxEntityType, Record<string, string>> = {
  skater: {
    ixg_per_60: "ixG/60",
    shots_per_60: "SOG/60",
    pp_toi_pct: "PP%",
    points_per_60_5v5: "Pts/60 5v5",
    sh_pct: "S%",
    on_ice_sh_pct: "oiSH%"
  },
  team: {
    xgf_pct: "xGF%",
    scf_pct: "SCF%",
    hdcf_pct: "HDCF%",
    on_ice_sh_pct: "SH%",
    on_ice_sv_pct: "SV%",
    pdo: "PDO"
  },
  goalie: {
    save_pct: "SV%",
    quality_starts_pct: "QS%",
    goals_against_avg: "GAA",
    shots_against_per_60: "SA/60",
    saves: "SV",
    shutouts: "SO"
  }
};

// shortLabel is the one-line phone label (TJ); it is a word of the full
// label, so the accessible name still contains what's on screen (2.5.3).
const CHART_SURFACE_TABS: {
  key: ChartSurfaceTab;
  label: string;
  shortLabel: string;
}[] = [
  { key: "elasticity", label: "Usual Range", shortLabel: "Range" },
  { key: "metricStreaks", label: "Metric Streaks", shortLabel: "Metric" },
  { key: "scoreStreaks", label: "Score Streaks", shortLabel: "Score" }
];

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
// The visitor's own calendar date. A UTC date (toISOString) turned into
// tomorrow from 7 PM Eastern, which has no scores yet.
function todayLocalIsoDate() {
  return format(new Date(), "yyyy-MM-dd");
}
// Pipeline and contract notes are for us while building; fans never see them.
const SHOW_DEV_DIAGNOSTICS = process.env.NODE_ENV !== "production";
const RESET_CONFIRM_MS = 5000;
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
  // No reading of hot/cold/on pace: no state colour (green read as "good").
  if (state === "unavailable") return "";
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

// Fans get plain copy; the server's own message (e.g. a database timeout) is
// appended only in development (superstyle rule 9).
function loadErrorCopy(fanCopy: string, error: unknown) {
  const detail = error instanceof Error ? error.message : null;
  return SHOW_DEV_DIAGNOSTICS && detail ? `${fanCopy} (${detail})` : fanCopy;
}

// Score components mix drivers (z_* z-scores) with model settings such as
// extremeThreshold (5), which the lib would otherwise present as a driver
// "running above baseline by 5.00 standard deviations".
function driverComponents(
  components: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!components) return null;
  const entries = Object.entries(components);
  const zScores = entries.filter(([key]) => key.startsWith("z_"));
  if (zScores.length) return Object.fromEntries(zScores);
  return Object.fromEntries(entries.filter(([key]) => key !== "extremeThreshold"));
}

// "EDM · L" → "EDM · LW": wingers read as LW/RW in the box tag and the
// search results alike.
function formatEntityTag(subtitle: string) {
  return subtitle
    .split(" · ")
    .map((part) => (part === "L" ? "LW" : part === "R" ? "RW" : part))
    .join(" · ");
}

// Tooltip opponent: "vs Hurricanes" rather than "vs CAR"; unknown codes
// fall back to the abbreviation.
function opponentName(abbreviation: string) {
  return (
    (teamsInfo as Record<string, { shortName?: string }>)[abbreviation]?.shortName ??
    abbreviation
  );
}

function getWindowLabel(windowCode: string) {
  const normalized = windowCode.toUpperCase();
  return normalized.startsWith("L") ? `Last ${normalized.slice(1)}` : normalized;
}

function getBarometerLabel(state: SandboxScoreRow["expectationState"] | null) {
  if (state === "unavailable") return "Performance unavailable";
  if (state === "overperforming") return "Running Hot";
  if (state === "underperforming") return "Running Cold";
  return "On Pace";
}

function getBarometerHelperCopy(state: SandboxScoreRow["expectationState"] | null) {
  if (state === "unavailable") {
    return "This process support index blends underlying skill and conversion signals. It does not measure observed performance against an expectation; over/underperformance is unavailable.";
  }
  if (state === "overperforming") {
    return "Running above their usual range.";
  }
  if (state === "underperforming") {
    return "Running below their usual range.";
  }
  return "Inside their usual range.";
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
      // parseISO reads "YYYY-MM-DD" as local midnight; new Date() read it as UTC,
      // which showed every game a day early west of Greenwich.
      const date = parseISO(row.snapshotDate);
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
        const date = parseISO(row.snapshotDate); // local date, not UTC midnight
        if (Number.isNaN(date.getTime())) return null;
        // Usual range = pre-window baseline predictive range (decision 33);
        // snapshots without one are left out rather than drawn as neutral.
        const usual = readUsualRange(row.distribution);
        if (!usual.range || usual.status === "unknown") return null;
        return {
          date,
          lower: usual.range.lower,
          upper: usual.range.upper,
          value: usual.range.observed,
          baseline: usual.range.baseline,
          status: usual.status,
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
  // Phones: when the values span 5+ units the y ticks are whole steps, so the
  // labels drop decimals (13 not 13.00) and the gutter narrows further.
  const yValueSpan = useMemo(() => {
    const values = parsed.flatMap((row) => [row.lower, row.upper, row.value]);
    return values.length ? Math.max(...values) - Math.min(...values) : 0;
  }, [parsed]);
  const compactYAxis = containerWidth < 480 && yValueSpan >= 5;
  const margins = useMemo(
    () => ({
      top: 32,
      right: containerWidth < 480 ? 12 : 24,
      bottom: 48,
      left: containerWidth < 480 ? (compactYAxis ? 32 : 36) : 64
    }),
    [compactYAxis, containerWidth]
  );
  const innerWidth = Math.max(containerWidth - margins.left - margins.right, 24);
  const innerHeight = Math.max(chartHeight - margins.top - margins.bottom, 24);

  const hasChartFrame = !loading && !error && parsed.length > 0;

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
    // Re-measure once the chart frame exists: on first render it is still
    // loading, so a mount-only effect left the 960px default (squeezed on phones).
  }, [hasChartFrame]);

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

    // About one date label per 70px so labels never collide on phones.
    // d3's tick count is only a hint (a 6-week span can flip to weekly
    // ticks), so thin the result to every nth tick.
    const maxXTicks = Math.min(6, parsed.length, Math.max(2, Math.floor(innerWidth / 70)));
    const rawXTicks = xScale.ticks(maxXTicks);
    const xTickStep = Math.ceil(rawXTicks.length / maxXTicks);
    const xTicks = rawXTicks.filter((_, index) => index % xTickStep === 0);

    return {
      xScale,
      yScale,
      areaPath: areaGenerator(parsed) ?? "",
      linePath: lineGenerator(valueSeries) ?? "",
      baselinePath:
        baselineSeries.length >= 2 ? lineGenerator(baselineSeries) ?? "" : "",
      xTicks,
      yTicks: yScale.ticks(6)
    };
  }, [parsed, innerHeight, innerWidth]);

  useEffect(() => {
    if (hoveredIndex != null && hoveredIndex >= parsed.length) {
      setHoveredIndex(null);
    }
  }, [hoveredIndex, parsed.length]);

  // Desktop: two decimals. Phones: whole numbers for wide ranges, otherwise
  // as many decimals as the tick step needs (at least one: 0.5, not 0.50).
  const yTickStep =
    geometry && geometry.yTicks.length > 1
      ? Math.abs(geometry.yTicks[1] - geometry.yTicks[0])
      : 1;
  const yTickDecimals =
    containerWidth >= 480
      ? 2
      : compactYAxis
        ? 0
        : Math.max(1, d3.precisionFixed(yTickStep));

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

  // Keyboard path to the same per-game details the mouse tooltip shows.
  const handleChartKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!parsed.length) return;
    const last = parsed.length - 1;
    const current = hoveredIndex ?? last;
    const next =
      event.key === "ArrowRight"
        ? Math.min(last, current + 1)
        : event.key === "ArrowLeft"
          ? Math.max(0, current - 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : event.key === "Escape"
                ? null
                : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setHoveredIndex(next);
  };

  const chartSummary = parsed.length
    ? `${data[0]?.metricLabel ?? "Metric"} usual-range chart, ${parsed.length} games from ${format(
        parsed[0].date,
        "MMM d"
      )} to ${format(parsed[parsed.length - 1].date, "MMM d, yyyy")}.` +
      (latest
        ? ` Latest ${latest.value.toFixed(2)}, usual range ${latest.lower.toFixed(
            2
          )} to ${latest.upper.toFixed(2)}.`
        : "")
    : "";
  const hoveredAnnouncement = hoveredPoint
    ? `${format(hoveredPoint.date, "MMM d, yyyy")}${
        hoveredPoint.gameContext?.opponentAbbreviation
          ? ` ${hoveredPoint.gameContext.homeRoad === "H" ? "vs" : "at"} ${opponentName(
              hoveredPoint.gameContext.opponentAbbreviation
            )}`
          : ""
      }: ${formatNumber(
        hoveredPoint.value,
        2
      )}, usual range ${formatNumber(hoveredPoint.lower, 2)} to ${formatNumber(
        hoveredPoint.upper,
        2
      )}.`
    : "";

  const statusLabel =
    latest?.status === "hot"
      ? "Running Hot"
      : latest?.status === "cold"
        ? "Running Cold"
        : "Within Usual Range";

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
            {data[0]?.metricLabel ?? "Usual Range"}
          </span>
          <span className={styles.bandChartWindow}>
            {data[0]?.windowCode ? `${getWindowLabel(data[0].windowCode)} games` : "—"}
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
                Usual range {latest.lower.toFixed(2)} – {latest.upper.toFixed(2)}
              </span>
              {latest.baseline != null && (
                <span className={styles.bandChartLatestBaseline}>
                  Normal level {latest.baseline.toFixed(2)}
                </span>
              )}
            </>
          ) : (
            <span className={styles.bandChartLatestValue}>—</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.bandChartMessage}>Loading usual-range history…</div>
      ) : error ? (
        <div className={`${styles.bandChartMessage} ${styles.bandChartError}`}>
          {error}
        </div>
      ) : !parsed.length ? (
        <div className={styles.bandChartMessage}>
          No usual-range history for this selection yet.
        </div>
      ) : !geometry ? (
        <div className={styles.bandChartMessage}>
          Not enough room to render the band chart.
        </div>
      ) : (
        <div
          ref={containerRef}
          className={styles.bandChartWrapper}
          tabIndex={0}
          role="group"
          aria-label="Usual-range chart. Use the left and right arrow keys to read each game."
          onKeyDown={handleChartKeyDown}
          onFocus={() => setHoveredIndex((index) => index ?? parsed.length - 1)}
          onBlur={() => setHoveredIndex(null)}
        >
          <span className={styles.visuallyHidden} aria-live="polite">
            {hoveredAnnouncement}
          </span>
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
              {hoveredPoint.gameContext?.opponentAbbreviation ? (
                <div className={styles.bandChartTooltipMatchup}>
                  {hoveredPoint.gameContext.homeRoad === "H" ? "vs" : "@"}{" "}
                  {opponentName(hoveredPoint.gameContext.opponentAbbreviation)}
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
            role="img"
            aria-label={chartSummary}
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
                      {tickValue.toFixed(yTickDecimals)}
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
  const liveRef = useRef<HTMLSpanElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(960);
  // The wrapper (and its ref) only renders once there are points, so the
  // measuring effect re-runs when the chart appears; otherwise phones keep
  // the 960px default and the viewBox shrinks every label to ~5px.
  const hasPoints = data.chartPoints.length > 0;

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
  }, [hasPoints]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const points = data.chartPoints;
    if (!points.length) {
      d3.select(svgElement).selectAll("*").remove();
      return;
    }

    // Draw at the real width so the viewBox never scales text down; phones
    // get a shorter chart and slimmer gutters.
    const isPhone = containerWidth < 480;
    const width = Math.max(containerWidth, 280);
    const margin = isPhone
      ? { top: 16, right: 12, bottom: 28, left: 32 }
      : { top: 24, right: 36, bottom: 36, left: 68 };
    const focusHeight = isPhone ? 220 : 320;
    const contextHeight = isPhone ? 56 : 80;
    const gap = isPhone ? 20 : 28;
    const innerWidth = Math.max(200, width - margin.left - margin.right);
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
    // About one date label per 70px; d3's count is only a hint, so thin the
    // ticks it returns to every nth one.
    const maxXTicks = Math.min(8, points.length, Math.max(2, Math.floor(innerWidth / 70)));
    const thinTicks = (ticks: Date[]) => {
      const step = Math.ceil(ticks.length / maxXTicks);
      return ticks.filter((_, index) => index % step === 0);
    };
    const focusXAxis = d3
      .axisBottom<Date>(x)
      .tickValues(thinTicks(x.ticks(maxXTicks)))
      .tickFormat((value) => tickFormatter(value as Date));
    const focusYAxis = d3.axisLeft<number>(y).ticks(isPhone ? 4 : 6);
    const contextXAxis = d3
      .axisBottom<Date>(x2)
      .tickValues(thinTicks(x2.ticks(maxXTicks)))
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
      // Flat state tint from the stylesheet (hot = danger, cold = primary,
      // like the barometer); no per-game gradient wash over the line.
      .attr("class", (segment) => `streak ${segment.type}`);

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
      .attr("stroke-width", (d) => (d.isStart ? 1.5 : 1))
      .attr("stroke-dasharray", (d) => (d.isStart ? "4 2" : "4 3"));

    const circles = pointLayer
      .selectAll<SVGCircleElement, HistoryChartPoint>("circle")
      .data(points, (point) => point.gameIndex)
      .join("circle")
      .attr("class", (point) => `game-point ${point.streakType}`)
      .attr("r", 4)
      .attr("stroke-width", 1)
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
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3")
      .style("opacity", 0);

    const crosshairY = crosshairLayer
      .append("line")
      .attr("class", "crosshair-y")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3")
      .style("opacity", 0);

    const hoverDot = crosshairLayer
      .append("circle")
      .attr("class", "hover-point")
      .attr("r", 4.5)
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

      // Re-thin for the zoomed domain so the date labels follow the brush.
      xAxisGroup.call(focusXAxis.tickValues(thinTicks(x.ticks(maxXTicks))));
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

    // Shared by mouse hover and keyboard reading: crosshair, dot, tooltip, and
    // (for the keyboard) a polite live-region line.
    const describePoint = (point: HistoryChartPoint) =>
      `${fmtFull(point.date)}: ${data.valueLabel} ${point.points.toFixed(2)}, ${
        data.averageLabel
      } ${point.rollingAverage.toFixed(2)}, ${data.baselineLabel} ${data.baseline.toFixed(2)}, streak ${
        point.streakType === "neutral"
          ? "neutral"
          : `${point.streakType} ×${point.streakLength}`
      }.`;

    const showPoint = (
      nearest: HistoryChartPoint,
      crossX: number,
      crossY: number | null,
      tooltipLeft: number,
      tooltipTop: number
    ) => {
      crosshairX.attr("x1", crossX).attr("x2", crossX).style("opacity", 1);
      if (crossY == null) {
        crosshairY.style("opacity", 0);
      } else {
        crosshairY.attr("y1", crossY).attr("y2", crossY).style("opacity", 1);
      }

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
      hover.style("left", `${tooltipLeft}px`).style("top", `${tooltipTop}px`);
    };

    const hidePoint = () => {
      crosshairX.style("opacity", 0);
      crosshairY.style("opacity", 0);
      hoverDot.style("opacity", 0);
      hover.style("opacity", "0");
    };

    // Keyboard: ←/→/Home/End step through the games in the current zoom.
    let keyboardIndex: number | null = null;
    const visiblePoints = () => {
      const [start, end] = x.domain();
      return points.filter((point) => point.date >= start && point.date <= end);
    };
    const showKeyboardPoint = (index: number) => {
      const visible = visiblePoints();
      if (!visible.length) return;
      keyboardIndex = Math.max(0, Math.min(visible.length - 1, index));
      const point = visible[keyboardIndex];
      const px = x(point.date);
      showPoint(point, px, null, 0, 0);
      // Place the tooltip from the dot's on-screen box: the SVG is scaled to fit
      // its container, so SVG units are not CSS pixels.
      const dot = hoverDot.node()?.getBoundingClientRect();
      const box = containerRef.current?.getBoundingClientRect();
      const tip = (hover.node() as HTMLDivElement | null)?.getBoundingClientRect();
      if (dot && box) {
        const tipWidth = tip?.width ?? 200;
        const rightSide = dot.right - box.left + 14;
        const left =
          rightSide + tipWidth > box.width
            ? dot.left - box.left - tipWidth - 14
            : rightSide;
        hover
          .style("left", `${Math.max(8, left)}px`)
          .style("top", `${dot.bottom - box.top + 12}px`);
      }
      if (liveRef.current) liveRef.current.textContent = describePoint(point);
    };
    const container = d3.select(containerRef.current);
    container
      .on("focus.chart", () => {
        showKeyboardPoint(keyboardIndex ?? visiblePoints().length - 1);
      })
      .on("blur.chart", () => {
        keyboardIndex = null;
        hidePoint();
        if (liveRef.current) liveRef.current.textContent = "";
      })
      .on("keydown.chart", (event: KeyboardEvent) => {
        const last = visiblePoints().length - 1;
        const current = keyboardIndex ?? last;
        const next =
          event.key === "ArrowRight"
            ? current + 1
            : event.key === "ArrowLeft"
              ? current - 1
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? last
                  : null;
        if (event.key === "Escape") {
          event.preventDefault();
          keyboardIndex = null;
          hidePoint();
          return;
        }
        if (next == null) return;
        event.preventDefault();
        showKeyboardPoint(next);
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

        const xm = x.invert(clampedX);
        const i = Math.max(1, Math.min(points.length - 1, bisectDate(points, xm)));
        const p0 = points[i - 1];
        const p1 = points[i];
        const nearest =
          !p1 ||
          xm.getTime() - p0.date.getTime() < p1.date.getTime() - xm.getTime()
            ? p0
            : p1;

        const [cx, cy] = d3.pointer(
          event,
          containerRef.current as HTMLDivElement
        );
        showPoint(nearest, clampedX, clampedY, cx + 14, cy + 12);
      })
      .on("mouseleave", hidePoint)
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
      container.on(".chart", null);
      svg.selectAll("*").remove();
    };
  }, [containerWidth, data]);

  if (!data.chartPoints.length) {
    return <div className={styles.chartPlaceholder}>{emptyMessage}</div>;
  }

  const firstPoint = data.chartPoints[0];
  const lastPoint = data.chartPoints[data.chartPoints.length - 1];
  const chartSummary = `${data.title}: ${data.chartPoints.length} games from ${format(
    firstPoint.date,
    "MMM d"
  )} to ${format(lastPoint.date, "MMM d, yyyy")}. Latest ${data.valueLabel} ${lastPoint.points.toFixed(
    2
  )}, ${data.averageLabel} ${lastPoint.rollingAverage.toFixed(2)}.`;

  return (
    <div
      ref={containerRef}
      className={styles.chartWrapper}
      tabIndex={0}
      role="group"
      aria-label={`${data.title}. Use the left and right arrow keys to read each game.`}
    >
      <div className={styles.chartMeta}>
        <h2>{data.title}</h2>
        <span>{data.subtitle}</span>
      </div>
      <span ref={liveRef} className={styles.visuallyHidden} aria-live="polite" />
      <svg
        ref={svgRef}
        className={styles.chartSvg}
        role="img"
        aria-label={chartSummary}
      />
    </div>
  );
}

export default function TrendsSandboxPage() {
  const router = useRouter();
  const hasHydratedQuery = useRef(false);
  // Set in the render after the URL is read, so data fetches and the URL sync
  // never run with the pre-hydration defaults (today's date) on a deep link.
  const [queryHydrated, setQueryHydrated] = useState(false);
  // "Try again" on the load-error notice bumps this to re-run the failed loads.
  const [retryKey, setRetryKey] = useState(0);
  const controlsHeadingRef = useRef<HTMLHeadingElement>(null);
  const activeEntityTabRef = useRef<HTMLButtonElement>(null);
  const metricChipsRef = useRef<HTMLDivElement>(null);
  // Only a user's entity-type switch clears the selection. The reset effect
  // compares against the type it last saw; query hydration marks the type it
  // set so that one switch keeps the deep-linked selection.
  const previousEntityTypeRef = useRef<SandboxEntityType>("skater");
  const hydratedEntityTypeRef = useRef<SandboxEntityType | null>(null);
  const [entityType, setEntityType] = useState<SandboxEntityType>("skater");
  const [chartSurfaceTab, setChartSurfaceTab] =
    useState<ChartSurfaceTab>("elasticity");
  const [searchQuery, setSearchQuery] = useState("");
  // Reset clears the selected player too, so it asks once inline first.
  const [confirmingReset, setConfirmingReset] = useState(false);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const resetCancelRef = useRef<HTMLButtonElement>(null);
  const resetConfirmRef = useRef<HTMLSpanElement>(null);
  const [searchResults, setSearchResults] = useState<EntityOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<EntityOption | null>(null);
  const selectedEntityName = selectedEntity?.name ?? null;
  // Team and position shown inside the search box while it holds the selection.
  const selectedEntityTag =
    selectedEntity?.subtitle && searchQuery === selectedEntity.name
      ? formatEntityTag(selectedEntity.subtitle)
      : null;
  const [requestedDate, setRequestedDate] = useState(todayLocalIsoDate);
  const [windowCode, setWindowCode] = useState<(typeof WINDOW_OPTIONS)[number]>(
    "l5"
  );
  const [selectedMetric, setSelectedMetric] = useState(
    SANDBOX_ENTITY_CONFIG.skater.metrics[0]?.key ?? "ixg_per_60"
  );
  // Phones show the metric pills as one sideways-scrolling row; keep the
  // pressed pill in view (deep links can select one past the edge). Only the
  // row scrolls, never the page.
  useEffect(() => {
    const row = metricChipsRef.current;
    if (!row || row.scrollWidth <= row.clientWidth) return;
    const pressed = row.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!pressed) return;
    const rowBox = row.getBoundingClientRect();
    const pillBox = pressed.getBoundingClientRect();
    const inset = 4; // room for the focus ring at the clip edge
    if (pillBox.left < rowBox.left + inset) {
      row.scrollLeft -= rowBox.left + inset - pillBox.left;
    } else if (pillBox.right > rowBox.right - inset) {
      row.scrollLeft += pillBox.right - (rowBox.right - inset);
    }
  }, [selectedMetric]);
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
  const selectedMetricConfig = entityConfig.metrics.find(
    (metric) => metric.key === selectedMetric
  );
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
        : todayLocalIsoDate();
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
    setQueryHydrated(true);
    hydratedEntityTypeRef.current = nextEntityType;
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

    // No cleanup cancel: the URL sync below calls router.replace right after
    // hydration, which re-runs this effect's cleanup and used to discard the
    // lookup. A selection the user made meanwhile still wins.
    supabase
      .from("players")
      .select("id, fullName, position, team_id, image_url")
      .eq("id", nextEntityId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) return;
        const name = data.fullName ?? `Player ${nextEntityId}`;
        setSelectedEntity(
          (current) =>
            current ?? {
              id: Number(data.id),
              name,
              subtitle: buildPlayerSubtitle({
                teamId: data.team_id,
                positionCode: data.position
              }),
              imageUrl: data.image_url ?? null
            }
        );
        setSearchQuery((current) => current || name);
      });
  }, [router]);

  useEffect(() => {
    if (!router.isReady || !queryHydrated) return;

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
    queryHydrated,
    requestedDate,
    resolvedSeasonId,
    router,
    selectedEntity,
    selectedMetric,
    windowCode
  ]);

  useEffect(() => {
    const previousEntityType = previousEntityTypeRef.current;
    previousEntityTypeRef.current = entityType;
    if (previousEntityType === entityType) return;
    const hydratedEntityType = hydratedEntityTypeRef.current;
    hydratedEntityTypeRef.current = null;
    if (hydratedEntityType === entityType) return;
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

    // The box shows the selected player's name; that text isn't a new search.
    if (
      searchQuery.trim().length < MIN_SEARCH_LENGTH ||
      searchQuery === selectedEntityName
    ) {
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
          setErrorMessage(loadErrorCopy("Couldn't search players right now.", error));
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [entityType, retryKey, searchQuery, selectedEntityName]);

  useEffect(() => {
    if (!queryHydrated) return;
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
          setErrorMessage(loadErrorCopy("Couldn't load the readings right now.", error));
        }
      })
      .finally(() => {
        if (!cancelled) setScoreLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entityType, queryHydrated, requestedDate, retryKey, selectedEntityId, windowCode]);

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
      setSkaterTrendError("Couldn't find the season for this date.");
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
          loadErrorCopy("Couldn't load this skater's season history.", error)
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
          setBandError(loadErrorCopy("Couldn't load the usual-range history.", error));
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
            loadErrorCopy("Couldn't load the score history.", error)
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
      rows: historyRows.flatMap((row) => {
        const usual = readUsualRange(row.distribution);
        if (!usual.range || usual.status === "unknown") return [];
        return [
          {
            snapshotDate: row.snapshotDate,
            value: usual.range.observed,
            rollingAverage: row.ewma,
            status: usual.status
          }
        ];
      })
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
        valueLabel: "Fantasy Score (FHFH default)",
        averageLabel: `${windowCode.toUpperCase()} Avg`,
        baselineLabel: "Season Avg"
      });
    }

    // Scores without sufficient inputs are unavailable: left out, not 50.
    const rows = (scoreHistoryData?.rows ?? []).flatMap((row) =>
      typeof row.score === "number" && Number.isFinite(row.score)
        ? [{ ...row, score: row.score }]
        : []
    );
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

  const skaterCorrelationSummary = useMemo(() => {
    if (entityType !== "skater" || !skaterTrendRows.length) return null;

    const metricLabel =
      entityConfig.metrics.find((metric) => metric.key === selectedMetric)?.label ??
      "Selected Metric";

    return {
      metricLabel,
      isFantasySelfCorrelation: selectedMetric === "fantasy_score",
      ...summarizePairedCorrelation(
        skaterTrendRows.map((row) => ({
          x: getSkaterMetricValue(row, selectedMetric),
          y: row.fantasyScore
        }))
      ),
      pointsPerGame: mean(skaterTrendRows.map((row) => row.totalPoints)),
      shotsPerGame: mean(skaterTrendRows.map((row) => row.shots)),
      hitsPerGame: mean(skaterTrendRows.map((row) => row.hits)),
      blocksPerGame: mean(skaterTrendRows.map((row) => row.blocks)),
      ppPointsPerGame: mean(skaterTrendRows.map((row) => row.ppPoints))
    };
  }, [entityConfig.metrics, entityType, selectedMetric, skaterTrendRows]);

  const leaderboard = useMemo(() => {
    const rows = scoreData?.rows ?? [];
    return {
      overperforming: rows
        .filter((row) => row.expectationState === "overperforming")
        .slice(0, 5),
      stable: rows.filter((row) => row.expectationState === "stable").slice(0, 5),
      underperforming: rows
        .filter((row) => row.expectationState === "underperforming")
        .slice(0, 5),
      unavailable: rows.filter((row) => row.expectationState === "unavailable").slice(0, 5)
    };
  }, [scoreData]);

  const reasonHighlights = useMemo(
    () => extractReasonHighlights(driverComponents(activeRow?.components), 5),
    [activeRow]
  );


  // Only real drivers get a card; the empty state is one note, not filler cards.
  const reasonComparisonRows = useMemo(() => {
    return reasonHighlights.map((reason) => {
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
  }, [bandRowsByMetricKey, reasonHighlights]);
  // While a selection's scores load, Why This Reading shows its header with
  // "Loading…" so the cards don't appear from nowhere.
  const reasonsLoading =
    selectedEntity != null && scoreLoading && reasonComparisonRows.length === 0;

  // One empty-state voice for every panel: nothing picked, still loading, or
  // picked with nothing to show (never "Select an entity" with a team chosen).
  const entityNoun = entityType === "team" ? "team" : entityType === "goalie" ? "goalie" : "skater";
  const entityNounPlural = `${entityNoun}s`;
  const emptyCopy = (subject: string) =>
    !selectedEntity
      ? `Pick a ${entityNoun} to see ${subject}.`
      : scoreLoading
        ? "Loading…"
        : `No reading for ${selectedEntity.name} on ${requestedDate}.`;

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
  const usualLevelMissing = Boolean(activeRow) && !hasUsualLevelData;

  const resetState = () => {
    setEntityType("skater");
    setChartSurfaceTab("elasticity");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedEntity(null);
    setRequestedDate(todayLocalIsoDate());
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

  // The confirm takes focus on No and closes itself after a few seconds.
  useEffect(() => {
    if (!confirmingReset) return;
    resetCancelRef.current?.focus();
    const timer = setTimeout(() => {
      const hadFocus = resetConfirmRef.current?.contains(document.activeElement);
      setConfirmingReset(false);
      if (hadFocus) requestAnimationFrame(() => resetButtonRef.current?.focus());
    }, RESET_CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirmingReset]);

  const closeResetConfirm = (confirmed: boolean) => {
    if (confirmed) resetState();
    setConfirmingReset(false);
    // Return focus to Reset once it renders again.
    requestAnimationFrame(() => resetButtonRef.current?.focus());
  };

  return (
    <main className={styles.page}>
      <a
        href="#sandbox-entity-types"
        className={styles.skipLink}
        onClick={(event) => {
          // Land on the selected entity tab; the href is the no-script fallback.
          if (!activeEntityTabRef.current) return;
          event.preventDefault();
          activeEntityTabRef.current.focus();
        }}
      >
        Skip to sandbox
      </a>
      <section className={styles.topWorkspace}>
        <article className={styles.overviewCard}>
          <div className={styles.overviewHeader}>
            <div className={styles.overviewTitleRow}>
              <div>
                <h1 className={styles.overviewTitle}>Sustainability Sandbox</h1>
                <p className={styles.overviewDescription}>
                  Read whether a team, skater, or goalie is running hotter or colder
                  than their usual level using rolling windows and baseline checks.
                </p>
              </div>
            </div>
          </div>

          <div
            id="sandbox-entity-types"
            tabIndex={-1}
            role="group"
            aria-label="Entity type"
            className={styles.entityTabs}
          >
            {(["team", "skater", "goalie"] as const).map((type) => (
              <button
                key={type}
                ref={type === entityType ? activeEntityTabRef : undefined}
                type="button"
                className={
                  type === entityType ? styles.entityTabActive : styles.entityTab
                }
                aria-pressed={type === entityType}
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
            <h2
              id="sandbox-controls"
              ref={controlsHeadingRef}
              tabIndex={-1}
              className={styles.compactTitle}
            >
              Controls
            </h2>
            {/* What the controls below are reading right now. */}
            <p className={styles.currentReadLine}>
              <span className={styles.currentReadEntity}>
                {selectedEntity?.name ?? entityConfig.label}
              </span>
              <span aria-hidden="true"> · </span>
              <span>{getWindowLabel(windowCode)}</span>
              <span aria-hidden="true"> · </span>
              <span>
                {scoreData?.snapshotDate ?? (scoreLoading ? "Loading…" : "No scores yet")}
              </span>
            </p>
            {confirmingReset ? (
              <span
                ref={resetConfirmRef}
                role="group"
                aria-label="Reset all controls?"
                className={styles.resetConfirm}
                onKeyDown={(event) => {
                  if (event.key === "Escape") closeResetConfirm(false);
                }}
              >
                <span aria-hidden="true">Reset?</span>
                <button
                  type="button"
                  className={`${styles.resetButton} ${styles.resetConfirmYes}`}
                  onClick={() => closeResetConfirm(true)}
                >
                  Clear all
                </button>
                <button
                  ref={resetCancelRef}
                  type="button"
                  className={styles.resetButton}
                  onClick={() => closeResetConfirm(false)}
                >
                  No
                </button>
              </span>
            ) : (
              <button
                ref={resetButtonRef}
                type="button"
                onClick={() => setConfirmingReset(true)}
                className={styles.resetButton}
              >
                Reset
              </button>
            )}
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
              <span id="sandbox-window-label">Window</span>
              <div
                className={styles.windowButtons}
                role="group"
                aria-labelledby="sandbox-window-label"
              >
                {WINDOW_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={
                      option === windowCode
                        ? styles.windowButtonActive
                        : styles.windowButton
                    }
                    aria-pressed={option === windowCode}
                    // Name starts with the visible "L5" (WCAG 2.5.3), then spells it out.
                    aria-label={`${option.toUpperCase()} (${getWindowLabel(option).toLowerCase()} games)`}
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
                <div className={styles.searchBox}>
                  <input
                    id="entity-search"
                    type="search"
                    placeholder={entityConfig.searchPlaceholder}
                    value={searchQuery}
                    aria-describedby={selectedEntityTag ? "entity-search-tag" : undefined}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setErrorMessage(null);
                    }}
                  />
                  {selectedEntityTag ? (
                    <span id="entity-search-tag" className={styles.searchTag}>
                      {selectedEntityTag}
                    </span>
                  ) : null}
                </div>
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
                              {formatEntityTag(option.subtitle)}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

          </div>
          {SHOW_DEV_DIAGNOSTICS && (
            <div className={styles.summary}>
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
          )}
        </section>
      </section>

      {/* Announces a retry in progress; empty otherwise, so it stays quiet. */}
      <p className={styles.visuallyHidden} aria-live="polite">
        {retryKey > 0 && scoreLoading ? "Reloading scores…" : ""}
      </p>
      {errorMessage && (
        <div className={styles.errorNotice} role="alert">
          <p>{errorMessage}</p>
          <button
            type="button"
            className={styles.resetButton}
            onClick={() => {
              setErrorMessage(null);
              setRetryKey((key) => key + 1);
              // The notice (and this button) unmounts; keep focus on the controls.
              controlsHeadingRef.current?.focus();
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* With a reading but no usual-level numbers, the score panel runs full
          width and says so in one line instead of an empty half-width card. */}
      <section
        className={
          usualLevelMissing
            ? `${styles.sustainabilityWorkbench} ${styles.sustainabilityWorkbenchSingle}`
            : styles.sustainabilityWorkbench
        }
      >
        <article className={styles.surfaceCard}>
          <div className={styles.surfaceCardHeader}>
            <h2 className={styles.surfaceCardTitle}>{activeRow?.expectationState === "unavailable" ? "Process Support Index" : "Form Barometer"}</h2>
            <span className={styles.surfaceCardMeta}>
              {activeRow
                ? getBarometerLabel(activeRow.expectationState)
                : !selectedEntity
                  ? "Nothing picked"
                  : scoreLoading
                    ? "Loading"
                    : "No reading"}
            </span>
          </div>
          {activeRow ? (
            <div className={styles.meterBlock}>
              <div className={styles.barometerRail}>
                {activeRow.expectationState !== "unavailable" ? <>
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
                </> : null}
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
                {/* "Performance unavailable" is said once, in the header and
                    paragraph; the unavailable state shows only the raw index. */}
                {activeRow.expectationState !== "unavailable" && (
                  <div>
                    <strong>Reading</strong>
                    <span>{getBarometerLabel(activeRow.expectationState)}</span>
                  </div>
                )}
                <div>
                  <strong>{activeRow.expectationState === "unavailable" ? "Raw index" : "Raw score"}</strong>
                  <span>{formatNumber(activeRow.rawScore, 2)}</span>
                </div>
                {activeRow.expectationState !== "unavailable" && (
                  <>
                    <div>
                      <strong>Z-score</strong>
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
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.bandEmpty}>{emptyCopy("their form reading")}</div>
          )}
          {usualLevelMissing ? (
            <p className={styles.usualLevelNote}>
              Usual-level numbers aren&apos;t available for this reading yet.
            </p>
          ) : null}
        </article>

        {usualLevelMissing ? null : (
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
                  <strong>Expected</strong>
                  <span>{formatNumber(activeRow.expectedValue, 2)}</span>
                </div>
                <div>
                  <strong>Window</strong>
                  <span>{getWindowLabel(activeRow.windowCode)}</span>
                </div>
              </div>
            ) : (
              <div className={styles.bandEmpty}>{emptyCopy("where they usually land")}</div>
            )}
          </article>
        )}
      </section>

      <section className={styles.bandChartSection}>
        <div className={styles.bandHeader}>
          <h2>Season Charts</h2>
          <div
            className={styles.chartSurfaceTabs}
            role="tablist"
            aria-label="Chart view"
            onKeyDown={(event) => {
              // Arrow keys / Home / End move between tabs and select (APG tabs pattern).
              const index = CHART_SURFACE_TABS.findIndex((tab) => tab.key === chartSurfaceTab);
              const last = CHART_SURFACE_TABS.length - 1;
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % CHART_SURFACE_TABS.length
                  : event.key === "ArrowLeft"
                    ? (index - 1 + CHART_SURFACE_TABS.length) % CHART_SURFACE_TABS.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? last
                        : null;
              if (next == null) return;
              event.preventDefault();
              const nextKey = CHART_SURFACE_TABS[next].key;
              setChartSurfaceTab(nextKey);
              document.getElementById(`chart-surface-tab-${nextKey}`)?.focus();
            }}
          >
            {CHART_SURFACE_TABS.map((tab) => (
              <button
                key={tab.key}
                id={`chart-surface-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={chartSurfaceTab === tab.key}
                aria-controls="chart-surface-panel"
                tabIndex={chartSurfaceTab === tab.key ? 0 : -1}
                className={
                  chartSurfaceTab === tab.key
                    ? styles.chartSurfaceTabActive
                    : styles.chartSurfaceTab
                }
                onClick={() => setChartSurfaceTab(tab.key)}
              >
                <span className={styles.tabLabelFull}>{tab.label}</span>
                <span className={styles.tabLabelShort} aria-hidden="true">
                  {tab.shortLabel}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Focus metric picker: chips, one pressed; the selected metric's
            description reads underneath. */}
        <div className={styles.metricPicker}>
          <span id="focus-metric-label" className={styles.metricPickerLabel}>
            Focus metric
          </span>
          <div
            ref={metricChipsRef}
            className={styles.metricChips}
            role="group"
            aria-labelledby="focus-metric-label"
          >
            {entityConfig.metrics.map((metric) => {
              const shortLabel =
                METRIC_SHORT_LABELS[entityType][metric.key] ?? metric.label;
              const abbreviated = shortLabel !== metric.label;
              return (
                <button
                  key={metric.key}
                  type="button"
                  className={styles.metricChip}
                  aria-pressed={metric.key === selectedMetric}
                  // Name starts with the visible text (WCAG 2.5.3), then the full name.
                  aria-label={abbreviated ? `${shortLabel} (${metric.label})` : undefined}
                  title={abbreviated ? metric.label : undefined}
                  onClick={() => setSelectedMetric(metric.key)}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>
          {selectedMetricConfig ? (
            <p className={styles.metricPickerNote}>
              <span className={styles.metricPickerNoteName}>
                {selectedMetricConfig.label}
              </span>
              : {selectedMetricConfig.description}
            </p>
          ) : null}
        </div>
        <div
          id="chart-surface-panel"
          role="tabpanel"
          aria-labelledby={`chart-surface-tab-${chartSurfaceTab}`}
          className={styles.chartSurfacePanel}
        >
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
                        ? "No season metric history for this skater yet."
                        : "Pick a skater to see their season metric history."
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
                    ? "No metric streak history for this selection yet."
                    : `Pick a ${entityNoun} to see metric streaks.`
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
                      ? "No season score history for this skater yet."
                      : "Pick a skater to see their season score history."
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
                  ? "No score history for this selection yet."
                  : `Pick a ${entityNoun} to see score streaks.`
              }
            />
          )}
        </div>
      </section>

      {/* The whole section hides when it has nothing to show. */}
      {(bandRows.length > 0 ||
        bandError ||
        reasonComparisonRows.length > 0 ||
        reasonsLoading) && (
        <section className={styles.bandSection}>
          <div
            className={`${styles.bandWorkspace} ${
              bandRows.length === 0 ? styles.bandWorkspaceStacked : ""
            }`}
          >
            {/* Checkpoints show only when there are rows (or an error to report);
                otherwise Why This Reading leads the section and carries the
                loading status. */}
            {(bandRows.length > 0 || bandError) && (
              <div className={styles.bandWorkspacePanel}>
                <div className={styles.bandHeader}>
                  <h2>Performance Checkpoints</h2>
                  {bandLoading && <span className={styles.bandStatus}>Refreshing…</span>}
                  {bandError && <span className={styles.error}>{bandError}</span>}
                </div>
                <div className={styles.bandGrid}>
                  {bandRows.length > 0 ? (
                    bandRows.map((row) => {
                      const usual = readUsualRange(row.distribution);
                      const statusClass =
                        usual.status === "hot"
                          ? styles.bandHot
                          : usual.status === "cold"
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
                              {usual.range
                                ? usual.range.observed.toFixed(2)
                                : row.ewma != null
                                  ? row.ewma.toFixed(2)
                                  : "—"}
                            </span>
                          </div>
                          {usual.range ? (
                            <>
                              <div className={styles.bandRange}>
                                Usual range {usual.range.lower.toFixed(2)} –{" "}
                                {usual.range.upper.toFixed(2)} (descriptive, from
                                prior seasons; {usual.range.gamesCovered} of{" "}
                                {usual.range.gamesInWindow} games)
                              </div>
                              <div className={styles.bandBaseline}>
                                Normal level {usual.range.baseline.toFixed(2)}
                              </div>
                            </>
                          ) : (
                            <div className={styles.bandRange}>
                              Usual range unavailable:{" "}
                              {USUAL_RANGE_REASON_LABELS[usual.reason ?? ""] ??
                                "unavailable"}
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
                      ? "No checkpoints for this selection yet."
                      : `Pick a ${entityNoun} to see checkpoints.`}
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Shown only when there are drivers to explain (or they're loading). */}
            {(reasonComparisonRows.length > 0 || reasonsLoading) && (
              <div className={styles.reasonColumn}>
                <div className={styles.bandHeader}>
                  <h2>Why This Reading</h2>
                  <span className={styles.bandStatus}>
                    {reasonsLoading || (bandLoading && bandRows.length === 0)
                      ? "Loading…"
                      : "The biggest drivers underneath it"}
                  </span>
                </div>
                <div className={styles.reasonGrid}>
                  {/* Faint placeholders reserve the space while scores load. */}
                  {reasonsLoading &&
                    [0, 1, 2].map((index) => (
                      <div
                        key={`skeleton-${index}`}
                        className={`${styles.reasonCard} ${styles.reasonSkeleton}`}
                        aria-hidden="true"
                      >
                        <span />
                        <span />
                        <span />
                      </div>
                    ))}
                  {reasonComparisonRows.map((reason) => (
                    <div key={reason.key} className={styles.reasonCard}>
                      <div className={styles.reasonLabel}>{reason.label}</div>
                      <div className={styles.reasonValue}>{formatDelta(reason.value, 2)}</div>
                      <p className={styles.reasonSentence}>{reason.sentence}</p>
                      {/* Window comparisons show only when the bands supply them. */}
                      {reason.comparisons.length > 0 && (
                        <div className={styles.reasonComparisonList}>
                          {reason.comparisons.map((comparison) => (
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
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className={styles.correlationSection}>
        <article className={`${styles.surfaceCard} ${styles.metricShelfCard}`}>
          <div className={styles.surfaceCardHeader}>
            <h2 className={styles.surfaceCardTitle}>Boxscore + Fantasy Correlation</h2>
            <span className={styles.surfaceCardMeta}>
              {skaterCorrelationSummary
                ? `${skaterCorrelationSummary.sampleSize} paired games`
                : "Skaters only"}
            </span>
          </div>
          {entityType !== "skater" ? (
            <div className={styles.bandEmpty}>Fantasy correlation covers skaters only.</div>
          ) : !selectedEntity ? (
            <div className={styles.bandEmpty}>
              Pick a skater to compare the focus metric with fantasy points and box-score stats.
            </div>
          ) : skaterCorrelationSummary ? (
            <>
              <div className={styles.correlationGroups}>
                <div role="group" aria-labelledby="correlation-metric-vs-fantasy">
                  <h3 id="correlation-metric-vs-fantasy" className={styles.correlationGroupTitle}>
                    Metric vs fantasy
                  </h3>
                  <div className={`${styles.detailGrid} ${styles.detailGridWide}`}>
                    <div>
                      <strong>{skaterCorrelationSummary.metricLabel} Avg</strong>
                      <span>{formatNumber(skaterCorrelationSummary.xMean, 2)}</span>
                    </div>
                    <div>
                      <strong>FHFH Fantasy Avg</strong>
                      <span>{formatNumber(skaterCorrelationSummary.yMean, 2)}</span>
                    </div>
                    <div>
                      <strong>Pearson r</strong>
                      <span>
                        {skaterCorrelationSummary.isFantasySelfCorrelation &&
                        skaterCorrelationSummary.r != null
                          ? "1.00 (same series)"
                          : formatNumber(skaterCorrelationSummary.r, 2)}
                      </span>
                    </div>
                    <div>
                      <strong>r²</strong>
                      <span>
                        {skaterCorrelationSummary.isFantasySelfCorrelation &&
                        skaterCorrelationSummary.r2 != null
                          ? "1.00 (same series)"
                          : formatNumber(skaterCorrelationSummary.r2, 2)}
                      </span>
                    </div>
                  </div>
                </div>
                <div role="group" aria-labelledby="correlation-per-game">
                  <h3 id="correlation-per-game" className={styles.correlationGroupTitle}>
                    Per game
                  </h3>
                  <div className={`${styles.detailGrid} ${styles.detailGridWide}`}>
                    <div>
                      <strong>Points / Game</strong>
                      <span>{formatNumber(skaterCorrelationSummary.pointsPerGame, 2)}</span>
                    </div>
                    <div>
                      <strong>Shots / Game</strong>
                      <span>{formatNumber(skaterCorrelationSummary.shotsPerGame, 2)}</span>
                    </div>
                    <div>
                      <strong>Hits / Game</strong>
                      <span>{formatNumber(skaterCorrelationSummary.hitsPerGame, 2)}</span>
                    </div>
                    <div>
                      <strong>Blocks / Game</strong>
                      <span>{formatNumber(skaterCorrelationSummary.blocksPerGame, 2)}</span>
                    </div>
                    <div>
                      <strong>PPP / Game</strong>
                      <span>{formatNumber(skaterCorrelationSummary.ppPointsPerGame, 2)}</span>
                    </div>
                  </div>
                </div>
              </div>
              {skaterCorrelationSummary.sampleSize < 3 && (
                <div className={styles.bandEmpty}>
                  Pearson r and r² require at least three games with both values present.
                </div>
              )}
            </>
          ) : (
            <div className={styles.bandEmpty}>
              No paired game history is available for this skater and metric.
            </div>
          )}
        </article>
      </section>

      <section className={styles.surfaceSection}>
        <div className={styles.bandHeader}>
          <h2>Slate Snapshot</h2>
          <span className={styles.bandStatus}>
            {entityType === "skater" ? "Ranked by process support index; performance comparison unavailable" : "Quick leaders by current form reading"}
          </span>
        </div>
        <div
          className={`${styles.leaderboardGrid} ${
            entityType === "skater" ? styles.leaderboardGridSingle : ""
          }`}
        >
          {(entityType === "skater" ? ["unavailable"] as const : ["overperforming", "stable", "underperforming"] as const).map(
            (state) => (
              // Skaters have one state, already named in the section status, so
              // their players sit directly under the heading without a card.
              <div
                key={state}
                className={entityType === "skater" ? undefined : styles.leaderboardCard}
              >
                {entityType !== "skater" && (
                  <div className={styles.leaderboardTitle}>
                    {getBarometerLabel(state)}
                  </div>
                )}
                {(leaderboard[state] ?? []).length > 0 ? (
                  <ul className={styles.leaderboardList}>
                    {leaderboard[state].map((row, _index, rows) => (
                      <li key={`${row.entityType}-${row.entityId}`} className={styles.leaderboardRow}>
                        <button
                          type="button"
                          className={styles.leaderboardButton}
                          onClick={() => {
                            setSelectedEntity({
                              id: row.entityId,
                              name: row.entityName,
                              subtitle: row.entitySubtitle,
                              imageUrl: null
                            });
                            if (row.entityType !== "team") setSearchQuery(row.entityName);
                          }}
                        >
                          <span className={styles.leaderboardRank}>
                            {/* Equal shown scores share a rank (1, 1, 1, 4). */}
                            {rows.findIndex(
                              (other) =>
                                formatNumber(other.score, 1) === formatNumber(row.score, 1)
                            ) + 1}
                          </span>
                          <span className={styles.leaderboardName}>{row.entityName}</span>
                          <span>{formatNumber(row.score, 1)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={styles.bandEmpty}>
                    {scoreLoading
                      ? "Loading…"
                      : state === "unavailable"
                        ? `No ${entityNounPlural} scored on ${requestedDate}.`
                        : `No ${entityNounPlural} ${getBarometerLabel(state).toLowerCase()} on ${requestedDate}.`}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </section>
    </main>
  );
}
