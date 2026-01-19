import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import supabase from "lib/supabase";
import { teamsInfo } from "lib/teamsInfo";
import React from "react";
import {
  DEFAULT_SKATER_LIMIT,
  SKATER_TREND_CATEGORIES,
  type SkaterTrendCategoryDefinition,
  type SkaterTrendCategoryId
} from "lib/trends/skaterMetricConfig";
import {
  TEAM_TREND_CATEGORIES,
  type TrendCategoryDefinition,
  type TrendCategoryId
} from "lib/trends/teamMetricConfig";
import { type CtpiScore } from "lib/trends/ctpi";
import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Brush,
  Tooltip
} from "recharts";
import TopMovers from "components/TopMovers/TopMovers";
import styles from "./index.module.scss";

type PlayerListItem = {
  id: number;
  fullName: string;
  position: string;
  team_abbrev: string | null;
};

type SeriesPoint = { gp: number; percentile: number };

type RankingRow = {
  team: string;
  percentile: number;
  gp: number;
  rank: number;
  previousRank: number | null;
  delta: number;
};

interface CategoryResult {
  series: Record<string, SeriesPoint[]>;
  rankings: RankingRow[];
}

interface TeamTrendsResponse {
  seasonId: number;
  generatedAt: string;
  categories: Record<TrendCategoryId, CategoryResult>;
}

type ChartDatasetRow = {
  gp: number;
  [team: string]: number;
};

type CategorySnapshot = {
  percentile: number;
  gp: number;
  delta: number | null;
};

type PowerBoardRow = {
  team: string;
  name: string;
  logo: string;
  overall: number;
  specialTeams: number | null;
  momentum: number | null;
  snapshots: Partial<Record<TrendCategoryId, CategorySnapshot>>;
  topDriver?: TrendCategoryId;
  drag?: TrendCategoryId;
  reason: string;
  ctpi?: CtpiScore;
  ctpiDelta?: number | null;
  sosPastPct?: number | null;
  sosFuturePct?: number | null;
  sosPastRecord?: string;
  sosFutureRecord?: string;
};

type PlayerMetadata = {
  id: number;
  fullName: string;
  position: string | null;
  teamAbbrev: string | null;
  imageUrl: string | null;
};

type SkaterRankingRow = {
  playerId: number;
  percentile: number;
  gp: number;
  rank: number;
  previousRank: number | null;
  delta: number;
  latestValue: number | null;
};

interface SkaterCategoryResult {
  series: Record<string, SeriesPoint[]>;
  rankings: SkaterRankingRow[];
}

interface SkaterTrendsResponse {
  seasonId: number;
  generatedAt: string;
  positionGroup: "forward" | "defense" | "all";
  limit: number;
  windowSize: number;
  categories: Record<SkaterTrendCategoryId, SkaterCategoryResult>;
  playerMetadata: Record<string, PlayerMetadata>;
}

const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const formatSigned = (value: number | null | undefined, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}`;
};
const formatPct = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
};

type SparkPoint = { date: string; value: number };

type SosRating = {
  team: string;
  past: { wins: number; losses: number; otl: number };
  future: { wins: number; losses: number; otl: number };
};

function SparkMini({
  points,
  variant
}: {
  points: SparkPoint[];
  variant: "hot" | "cold";
}) {
  const data = React.useMemo(() => {
    if (!points || points.length === 0) return null;
    const series = points.slice(-10);
    const values = series.map((p) => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 0.5;
      max += 0.5;
    }
    const range = max - min || 1;
    const norm = series.map((p, i) => ({
      x: series.length === 1 ? 0 : (i / (series.length - 1)) * 100,
      y: 38 - ((p.value - min) / range) * 30 - 2
    }));
    const line = norm.map((n) => `${n.x},${n.y.toFixed(2)}`).join(" ");
    const area = `0,40 ${line} 100,40`;
    const baseVal = series[0].value;
    const baselineY = 38 - ((baseVal - min) / range) * 30 - 2;
    return {
      line,
      area,
      baselineY: Math.min(38, Math.max(2, baselineY))
    };
  }, [points]);

  if (!data) return <div className={styles.sparkEmpty}>—</div>;

  return (
    <svg
      className={styles.sparkSvg}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
    >
      <polyline
        className={styles.sparkBaseline}
        points={`0,${data.baselineY} 100,${data.baselineY}`}
      />
      <polygon
        className={`${styles.sparkArea} ${variant === "hot" ? styles.rise : styles.fall}`}
        points={data.area}
      />
      <polyline
        className={`${styles.sparkPath} ${variant === "hot" ? styles.rise : styles.fall}`}
        points={data.line}
      />
    </svg>
  );
}
const DEFAULT_TEAM_LOGO = "/teamLogos/default.png";
const DEFAULT_PLAYER_IMAGE = DEFAULT_TEAM_LOGO;

const CHART_COLOR_PALETTE = [
  "#07aae2", // $secondary-color
  "#4bc0c0", // $color-teal
  "#ff9f40", // $color-orange
  "#ff6384", // $danger-color
  "#9b59b6", // $color-purple
  "#ffcc33", // $warning-color
  "#3b82f6", // $info-color
  "#00ff99", // $success-color
  "#cccccc", // $text-primary
  "#a0aec0" // grey
];

function getChartColor(key: string): string {
  let hash = 0;
  if (!key) return CHART_COLOR_PALETTE[0];
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0; // convert to 32bit int
  }
  const idx = Math.abs(hash) % CHART_COLOR_PALETTE.length;
  return CHART_COLOR_PALETTE[idx];
}

const clampBrush = (
  length: number,
  start: number | undefined,
  end: number | undefined,
  window: number
): { start: number; end: number } => {
  if (length === 0) return { start: 0, end: 0 };
  const safeEnd = Number.isFinite(end)
    ? Math.min(length - 1, end!)
    : length - 1;
  const fallbackStart = Math.max(0, safeEnd - (window - 1));
  const safeStart = Number.isFinite(start)
    ? Math.min(Math.max(0, start!), safeEnd)
    : fallbackStart;
  return { start: safeStart, end: safeEnd };
};

const emptyCategoryResult: CategoryResult = {
  series: {},
  rankings: []
};

const emptySkaterResult: SkaterCategoryResult = {
  series: {},
  rankings: []
};

// Brief calculation blurbs for team strength categories.
// These are shown in the chart header tooltip to explain methodology at a high level.
const TEAM_ALGO_HELP: Record<TrendCategoryId, string> = {
  offense:
    "Weighted composite of per-game league percentiles for all-strength creation. We normalize each game vs league, then combine metrics (goals/xG/shots/chances) with weights; higher creation → higher percentile.",
  defense:
    "Weighted composite of per-game league percentiles for all-strength suppression. Against/allowed metrics are inverted so better suppression yields a higher percentile; save% contributes positively.",
  powerPlay:
    "Weighted composite of PP-specific percentiles plus PP rate context (opportunities/TOI). We normalize per game and combine PP goals/xG/shots/chances with weights for a single PP strength score.",
  penaltyKill:
    "Weighted composite of PK suppression percentiles plus situational context (times shorthanded). Against/allowed are inverted so stronger PK reads higher; PK save% contributes positively."
};

const CTPI_TOOLTIPS = {
  offense: `Formula:
    Offense = 0.50 * Z(xGF/60) + 0.30 * Z(HDCF/60) + 0.20 * Z(GF/60)

What it means:
Offense measures how well a team creates scoring chances at 5-on-5. It leans heavily on expected goals (xGF/60) and high-danger chances (HDCF/60), which capture "how many good chances you create," and then lightly includes actual goals scored (GF/60) to account for real finishing talent. Higher Offense means the team consistently drives dangerous offense, not just riding a hot shooting streak.`,
  defense: `Formula:
    Defense = 0.50 * (-Z(xGA/60)) + 0.30 * (-Z(HDCA/60)) + 0.20 * (-Z(CA/60))

What it means:
Defense measures how well a team limits chances against at 5-on-5. Because lower defensive numbers are better, we flip the Z-scores with a negative sign. It prioritizes expected goals against (xGA/60) and high-danger chances against (HDCA/60), with shot volume against (CA/60) as a supporting factor. Higher Defense means the team keeps opponents away from dangerous areas and limits overall pressure.`,
  specialTeams: `Formula:
    SpecialTeams = 0.55 * Z(PP_xGF/60) + 0.45 * (-Z(PK_xGA/60))

What it means:
SpecialTeams captures how strong a team is on the power play and penalty kill. On the power play, we look at expected goals for per 60 (PP xGF/60): how many quality chances they create with the man advantage. On the penalty kill, we look at expected goals against per 60 (PK xGA/60), flipped so that allowing fewer chances is rewarded. Higher SpecialTeams means your team tilts games in its favor when penalties are called, by creating more and allowing less than an average team.`,
  goaltending: `Formula:
    Goaltending = 0.40 * Z(season_GSAx/60) + 0.60 * Z(last10_GSAx/60)

What it means:
Goaltending measures how much your goalies are outperforming (or underperforming) expectation, after adjusting for shot quality. GSAx/60 (Goals Saved Above Expected per 60) tells us how many goals your goalies save beyond what an average goalie would. The formula blends the full-season performance with recent form, giving a little extra weight to the last 10 games. Higher Goaltending means your crease is a real strength, not just protected by team defense.`,
  luck: `Formula:
    Luck = Z(PDO)

What it means:
Luck is a measure of how "hot" or "cold" a team is running based on PDO (Shooting % + Save %). A high positive score means the team has a high PDO (Lucky), suggesting their current results might be inflated by good fortune. A low negative score means the team has a low PDO (Unlucky), suggesting they are playing better than their results indicate.`,
  trend: `Formula (example over 10 games):
    TrendWeighted_Metric =
        (1.0 * M1 + 0.9 * M2 + ... + 0.1 * M10) / Sum(Weights)

What it means:
Trend controls how much recent games matter. For any metric (like xGF/60 or xGA/60), we take a weighted average of the last 10 games, where the most recent game gets the highest weight. This trend-weighted value is then used to compute the Z-score that feeds into Offense, Defense, Goaltending, and SpecialTeams. In simple terms: recent performance pulls the ranking more than what happened months ago, without completely ignoring the full season.`
};

const CATEGORY_ORDER: TrendCategoryId[] = [
  "offense",
  "defense",
  "powerPlay",
  "penaltyKill"
];

const CATEGORY_CONFIG_MAP: Record<TrendCategoryId, TrendCategoryDefinition> =
  TEAM_TREND_CATEGORIES.reduce(
    (acc, category) => {
      acc[category.id] = category;
      return acc;
    },
    {} as Record<TrendCategoryId, TrendCategoryDefinition>
  );

const POWER_WEIGHTS: Record<TrendCategoryId, number> = {
  offense: 0.35,
  defense: 0.35,
  powerPlay: 0.15,
  penaltyKill: 0.15
};

function buildChartDataset(series: Record<string, SeriesPoint[]>) {
  const gpSet = new Set<number>();
  const teamMaps: Record<string, Map<number, number>> = {};

  Object.entries(series).forEach(([team, points]) => {
    const map = new Map<number, number>();
    points.forEach((point) => {
      gpSet.add(point.gp);
      map.set(point.gp, point.percentile);
    });
    teamMaps[team] = map;
  });

  const sortedGps = Array.from(gpSet).sort((a, b) => a - b);
  const dataset: ChartDatasetRow[] = sortedGps.map((gp) => {
    const row: ChartDatasetRow = { gp };
    Object.entries(teamMaps).forEach(([team, map]) => {
      const value = map.get(gp);
      if (value !== undefined) {
        row[team] = Number(value.toFixed(2));
      }
    });
    return row;
  });

  return { dataset, teamKeys: Object.keys(series) };
}

/**
 * Return a new series object where each team's percentiles are replaced
 * with a simple trailing moving average over `windowSize` points.
 */
function computeSmoothedSeries(
  series: Record<string, SeriesPoint[]>,
  windowSize: number
): Record<string, SeriesPoint[]> {
  if (!series || windowSize <= 1) return series;
  const out: Record<string, SeriesPoint[]> = {};
  Object.entries(series).forEach(([team, points]) => {
    if (!points || points.length === 0) {
      out[team] = [];
      return;
    }
    const sorted = [...points].sort((a, b) => a.gp - b.gp);
    const smoothed: SeriesPoint[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const start = Math.max(0, i - (windowSize - 1));
      let sum = 0;
      let count = 0;
      for (let j = start; j <= i; j++) {
        sum += sorted[j].percentile;
        count += 1;
      }
      const avg = count > 0 ? sum / count : sorted[i].percentile;
      smoothed.push({ gp: sorted[i].gp, percentile: Number(avg) });
    }
    out[team] = smoothed;
  });
  return out;
}

function computeFiveGameDelta(points: SeriesPoint[]): number | null {
  if (!points || points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.gp - b.gp);
  const last = sorted[sorted.length - 1];
  const targetGp = last.gp - 4;
  let prior: SeriesPoint | undefined;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].gp <= targetGp) {
      prior = sorted[i];
      break;
    }
  }
  if (!prior) {
    prior = sorted[Math.max(0, sorted.length - 5)];
  }
  if (!prior) return null;
  return Number((last.percentile - prior.percentile).toFixed(2));
}

function describeRowReason(
  snapshots: Partial<Record<TrendCategoryId, CategorySnapshot>>,
  momentum: number | null
): string {
  const entries = CATEGORY_ORDER.map((id) => ({
    id,
    snap: snapshots[id]
  })).filter(
    (entry): entry is { id: TrendCategoryId; snap: CategorySnapshot } =>
      Boolean(entry.snap)
  );

  if (!entries.length) return "Waiting on games played.";

  const top = entries.reduce((acc, entry) =>
    !acc || entry.snap.percentile > acc.snap.percentile ? entry : acc
  );
  const drag = entries.reduce((acc, entry) =>
    !acc || entry.snap.percentile < acc.snap.percentile ? entry : acc
  );
  const bestDelta = entries
    .filter((entry) => entry.snap.delta !== null)
    .sort((a, b) => (b.snap.delta ?? 0) - (a.snap.delta ?? 0))[0];
  const worstDelta = entries
    .filter((entry) => entry.snap.delta !== null)
    .sort((a, b) => (a.snap.delta ?? 0) - (b.snap.delta ?? 0))[0];

  const pieces: string[] = [];
  if (top) {
    // piece: strongest current category by percentile
    pieces.push(
      `${CATEGORY_CONFIG_MAP[top.id]?.label ?? top.id} strong (${top.snap.percentile.toFixed(1)}p)`
    );
  }
  if (bestDelta?.snap.delta !== undefined && bestDelta.snap.delta !== null) {
    if (bestDelta.snap.delta >= 1.2) {
      // piece: fastest improving category over last 5GP
      pieces.push(
        `${CATEGORY_CONFIG_MAP[bestDelta.id]?.label ?? bestDelta.id} heating (+${bestDelta.snap.delta} last 5GP)`
      );
    }
  }
  if (
    worstDelta?.snap.delta !== undefined &&
    worstDelta.snap.delta !== null &&
    worstDelta.snap.delta <= -1
  ) {
    // piece: largest drop over last 5GP
    pieces.push(
      `${CATEGORY_CONFIG_MAP[worstDelta.id]?.label ?? worstDelta.id} cooling (${worstDelta.snap.delta})`
    );
  } else if (drag && pieces.length < 2) {
    // piece: weakest current category by percentile
    pieces.push(
      `${CATEGORY_CONFIG_MAP[drag.id]?.label ?? drag.id} lagging (${drag.snap.percentile.toFixed(1)}p)`
    );
  } else if (momentum !== null && pieces.length === 0) {
    // fallback: light direction if no other signals
    pieces.push(momentum >= 0 ? "Trending up slightly" : "Trending down");
  }

  if (!pieces.length) return "Balanced profile.";
  return pieces.slice(0, 2).join(" · ");
}

function buildPowerBoard(
  teamTrends: TeamTrendsResponse | null
): PowerBoardRow[] {
  if (!teamTrends?.categories) return [];

  const teams = new Set<string>();
  CATEGORY_ORDER.forEach((cid) => {
    const series = teamTrends.categories[cid]?.series ?? {};
    Object.keys(series).forEach((team) => teams.add(team));
  });

  const rows: PowerBoardRow[] = [];

  teams.forEach((team) => {
    const snapshots: Partial<Record<TrendCategoryId, CategorySnapshot>> = {};

    CATEGORY_ORDER.forEach((cid) => {
      const series = teamTrends.categories[cid]?.series?.[team] ?? [];
      if (!series.length) return;
      const sorted = [...series].sort((a, b) => a.gp - b.gp);
      const latest = sorted[sorted.length - 1];
      snapshots[cid] = {
        percentile: latest.percentile,
        gp: latest.gp,
        delta: computeFiveGameDelta(sorted)
      };
    });

    const availableWeight = CATEGORY_ORDER.reduce((sum, cid) => {
      if (snapshots[cid]) {
        return sum + POWER_WEIGHTS[cid];
      }
      return sum;
    }, 0);

    if (availableWeight === 0) return;

    const weightedSum = CATEGORY_ORDER.reduce((sum, cid) => {
      const snap = snapshots[cid];
      if (!snap) return sum;
      return sum + POWER_WEIGHTS[cid] * snap.percentile;
    }, 0);
    const overall = weightedSum / availableWeight;

    const deltaWeight = CATEGORY_ORDER.reduce((sum, cid) => {
      const snap = snapshots[cid];
      if (!snap || snap.delta === null) return sum;
      return sum + POWER_WEIGHTS[cid];
    }, 0);

    const momentum =
      deltaWeight > 0
        ? CATEGORY_ORDER.reduce((sum, cid) => {
            const snap = snapshots[cid];
            if (!snap || snap.delta === null) return sum;
            return sum + POWER_WEIGHTS[cid] * snap.delta;
          }, 0) / deltaWeight
        : null;

    const specialValues = [
      snapshots.powerPlay?.percentile,
      snapshots.penaltyKill?.percentile
    ].filter((value): value is number => typeof value === "number");
    const specialTeams =
      specialValues.length > 0
        ? specialValues.reduce((a, b) => a + b, 0) / specialValues.length
        : null;

    const topDriver = CATEGORY_ORDER.reduce<TrendCategoryId | undefined>(
      (acc, cid) => {
        const snap = snapshots[cid];
        if (!snap) return acc;
        if (!acc || snap.percentile > (snapshots[acc]?.percentile ?? -1)) {
          return cid;
        }
        return acc;
      },
      undefined
    );

    const drag = CATEGORY_ORDER.reduce<TrendCategoryId | undefined>(
      (acc, cid) => {
        const snap = snapshots[cid];
        if (!snap) return acc;
        if (!acc || snap.percentile < (snapshots[acc]?.percentile ?? 101)) {
          return cid;
        }
        return acc;
      },
      undefined
    );

    rows.push({
      team,
      name: teamsInfo[team as keyof typeof teamsInfo]?.shortName ?? team,
      logo: `/teamLogos/${team}.png`,
      overall: Number(overall.toFixed(1)),
      specialTeams:
        specialTeams !== null ? Number(specialTeams.toFixed(1)) : null,
      momentum: momentum !== null ? Number(momentum.toFixed(1)) : null,
      snapshots,
      topDriver,
      drag,
      reason: describeRowReason(snapshots, momentum)
    });
  });

  return rows.sort((a, b) => b.overall - a.overall);
}

function resolveMomentumTone(momentum: number | null | undefined): {
  label: string;
  toneClass: string;
} {
  if (momentum === null || momentum === undefined || Number.isNaN(momentum)) {
    return { label: "Steady", toneClass: styles.momentumNeutral };
  }
  const rounded = Number(momentum.toFixed(1));
  if (rounded >= 3) {
    return {
      label: `Hot ${rounded > 0 ? "+" : ""}${rounded}`,
      toneClass: styles.momentumHot
    };
  }
  if (rounded >= 1) {
    return {
      label: `Warming ${rounded > 0 ? "+" : ""}${rounded}`,
      toneClass: styles.momentumWarm
    };
  }
  if (rounded <= -3) {
    return { label: `Cold ${rounded}`, toneClass: styles.momentumCold };
  }
  if (rounded <= -1) {
    return { label: `Cooling ${rounded}`, toneClass: styles.momentumCool };
  }
  return {
    label: `Steady ${rounded > 0 ? "+" : ""}${rounded}`,
    toneClass: styles.momentumNeutral
  };
}

function selectTopDriver(ctpi?: CtpiScore): TrendCategoryId | undefined {
  if (!ctpi) return undefined;
  const entries: Array<{ id: TrendCategoryId; value: number }> = [
    { id: "offense", value: ctpi.offense },
    { id: "defense", value: ctpi.defense },
    { id: "powerPlay", value: ctpi.specialTeams },
    { id: "penaltyKill", value: ctpi.specialTeams }
  ];
  entries.sort((a, b) => b.value - a.value);
  return entries[0]?.id;
}

function ratingToneClass(value: number | null | undefined): string | undefined {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return styles.tierNeutral;
  }
  if (value >= 1.5) return styles.tierElite;
  if (value >= 0.5) return styles.tierGood;
  if (value <= -1.5) return styles.tierPoor;
  if (value <= -0.5) return styles.tierCaution;
  return styles.tierNeutral;
}

function formatDriverLabel(
  driver: TrendCategoryId | undefined,
  percentile: number | undefined
): string {
  if (!driver) return "Balanced profile";
  const label = CATEGORY_CONFIG_MAP[driver]?.label ?? driver;
  if (percentile === undefined || percentile === null) {
    return `${label} leading`;
  }
  return `${label} leading (${percentile.toFixed(1)}p)`;
}

function ArrowDelta({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className={`${styles.delta} ${styles.deltaNeutral}`}>—</span>;
  }
  const positive = delta > 0;
  const symbol = positive ? "▲" : "▼";
  const prefix = positive ? "+" : "";
  return (
    <span
      className={`${styles.delta} ${
        positive ? styles.deltaPositive : styles.deltaNegative
      }`}
    >
      <span> {symbol}</span>
      <span>
        {" "}
        {prefix} {delta}
      </span>
    </span>
  );
}

function CategoryChartCard({
  config,
  result,
  windowSize = 1,
  large
}: {
  config: TrendCategoryDefinition;
  result: CategoryResult;
  windowSize?: number;
  large?: boolean;
}) {
  const hasData = Object.keys(result.series || {}).length > 0;
  const seriesForChart = useMemo<Record<string, SeriesPoint[]>>(() => {
    if (!hasData) {
      return {};
    }
    if (windowSize > 1) {
      return computeSmoothedSeries(result.series, windowSize);
    }
    return result.series;
  }, [hasData, result.series, windowSize]);

  const { dataset, teamKeys } = useMemo(() => {
    if (!hasData) {
      return { dataset: [], teamKeys: [] };
    }
    return buildChartDataset(seriesForChart);
  }, [hasData, seriesForChart]);
  // brush indices for zooming - default to last 5 games window
  const [brushStart, setBrushStart] = useState<number | undefined>(undefined);
  const [brushEnd, setBrushEnd] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!dataset || dataset.length === 0) {
      setBrushStart(undefined);
      setBrushEnd(undefined);
      return;
    }
    const { start, end } = clampBrush(dataset.length, brushStart, brushEnd, 5);
    setBrushStart(start);
    setBrushEnd(end);
  }, [dataset, seriesForChart, brushStart, brushEnd]);
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const clearHover = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredTeam(null);
  };

  const scheduleHover = (team: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredTeam(team);
      hoverTimeoutRef.current = null;
    }, 100);
  };

  const handleMouseMove = (state: any) => {
    const teamKey =
      state?.activePayload && state.activePayload[0]
        ? state.activePayload[0].dataKey
        : null;
    if (teamKey) {
      setHoveredTeam(String(teamKey));
    }
  };

  function renderActiveDot(team: string, strokeColor: string) {
    function ActiveDot(props: any) {
      const radius =
        hoveredTeam === team ? Math.max(props.r ?? 4, 5.5) : (props.r ?? 4);
      return (
        <circle
          {...props}
          r={radius}
          fill={strokeColor}
          stroke={props.stroke ?? strokeColor}
          strokeWidth={hoveredTeam === team ? 1 : 0.5}
        />
      );
    }
    ActiveDot.displayName = `ActiveDot-${team}`;
    return ActiveDot;
  }

  const CustomTooltip = ({
    active,
    payload,
    label
  }: {
    active?: boolean;
    payload?: any[];
    label?: number;
  }) => {
    if (!active || !payload || payload.length === 0) return null;

    const hoveredData =
      (hoveredTeam && payload.find((item) => item.dataKey === hoveredTeam)) ||
      payload.sort((a, b) => b.value - a.value)[0];

    if (!hoveredData) return null;

    const { dataKey, value, stroke } = hoveredData;
    const teamInfo = teamsInfo[dataKey as keyof typeof teamsInfo];

    return (
      <div className={styles.chartTooltip}>
        <div className={styles.chartTooltipHeader}>
          <div className={styles.teamLogoWrapper}>
            <Image
              src={`/teamLogos/${dataKey}.png`}
              alt={`${dataKey} logo`}
              className={styles.teamLogo}
              width={24}
              height={24}
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = DEFAULT_TEAM_LOGO;
              }}
            />
          </div>
          <span style={{ color: stroke }}>
            {teamInfo?.shortName ?? dataKey}
          </span>
        </div>
        <p className={styles.chartTooltipValue}>{formatPercent(value)}</p>
        <p className={styles.chartTooltipLabel}>Game: {label}</p>
      </div>
    );
  };

  const { improved: categoryImproved, degraded: categoryDegraded } =
    useMemo(() => {
      // Always compute movers from the RAW series and use a fixed 5GP window
      const series = result?.series ?? {};
      const movers: Array<{
        id: string;
        name: string;
        logo?: string;
        delta: number;
        current?: number;
      }> = [];

      Object.entries(series).forEach(([team, points]) => {
        if (!points || points.length < 2) return;
        const sorted = [...points].sort((a, b) => a.gp - b.gp);
        const last = sorted[sorted.length - 1];
        const targetGp = last.gp - 4; // fixed 5GP delta

        let prior: SeriesPoint | undefined = undefined;
        for (let i = sorted.length - 1; i >= 0; i--) {
          if (sorted[i].gp <= targetGp) {
            prior = sorted[i];
            break;
          }
        }
        // fallback: earliest point within the last 5 entries
        if (!prior) {
          prior = sorted[Math.max(0, sorted.length - 5)];
        }
        if (!prior) return;

        const delta = Number((last.percentile - prior.percentile).toFixed(2));
        movers.push({
          id: team,
          name: teamsInfo[team as keyof typeof teamsInfo]?.shortName ?? team,
          logo: `/teamLogos/${team}.png`,
          delta,
          current: last.percentile
        });
      });

      const improvedSorted = movers
        .slice()
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 5);
      const degradedSorted = movers
        .slice()
        .sort((a, b) => a.delta - b.delta)
        .slice(0, 5);

      return { improved: improvedSorted, degraded: degradedSorted };
    }, [result]);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeaderWrapper}>
        <div className={styles.chartTitleGroup}>
          <p className={styles.chartHeading}>{config.label}</p>
          <div className={styles.infoWrapper}>
            <button
              type="button"
              className={styles.infoButton}
              aria-label={`How we calculate ${config.label}`}
              title={`How we calculate ${config.label}`}
            >
              <svg
                className={styles.infoIcon}
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="currentColor"
                  opacity="0.18"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <line
                  x1="12"
                  y1="10"
                  x2="12"
                  y2="16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="7.5" r="1.2" fill="currentColor" />
              </svg>
            </button>
            <div className={styles.infoTooltip} role="tooltip">
              <strong>How we calculate {config.label}</strong>
              <div style={{ height: 6 }} />
              <div>
                {TEAM_ALGO_HELP[config.id as TrendCategoryId] ??
                  "Weighted composite of per-game league percentiles. Higher values indicate stronger performance."}
              </div>
              <div style={{ height: 8 }} />
              <div style={{ opacity: 0.9 }}>
                <em>Composite inputs</em>
              </div>
              <ul className={styles.infoList}>
                {config.metrics.map((m) => {
                  const sourceLabel: Record<string, string> = {
                    as: "All Strengths",
                    pp: "Power Play",
                    pk: "Penalty Kill",
                    wgo: "Game log rates"
                  };
                  const weightLabel = (w: number) =>
                    w >= 5
                      ? "High"
                      : w === 4
                        ? "Med-High"
                        : w === 3
                          ? "Med"
                          : w === 2
                            ? "Med-Low"
                            : "Low";
                  return (
                    <li key={m.key}>
                      {m.label} ({sourceLabel[m.source] ?? m.source}) — weight{" "}
                      {weightLabel(m.weight)},{" "}
                      {m.higherIsBetter
                        ? "higher ↑ is better"
                        : "lower ↓ is better"}
                    </li>
                  );
                })}
              </ul>
              <div style={{ height: 8 }} />
              <div>
                We compute per-game league percentiles for each metric, invert
                when lower is better, then take a weighted average. The line
                reflects game-by-game results; optional smoothing applies a{" "}
                {windowSize} GP rolling window.
              </div>
            </div>
          </div>
        </div>
        <p className={styles.chartDescription}>{config.description}</p>
      </div>
      {hasData && dataset.length > 0 ? (
        <>
          <div
            className={`${styles.chartShell} ${styles.chartTheme} ${large ? styles.chartShellLarge : ""}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ReLineChart
                data={dataset}
                onMouseLeave={clearHover}
                onMouseMove={handleMouseMove}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--chart-grid)"
                />
                <XAxis
                  dataKey="gp"
                  tick={{ fontSize: 11, fill: "var(--chart-tick)" }}
                  label={{
                    value: "GP",
                    position: "insideBottomRight",
                    offset: -6,
                    fill: "var(--chart-tick)",
                    fontSize: 11
                  }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "var(--chart-tick)" }}
                  width={30}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{
                    stroke: "var(--chart-cursor)",
                    strokeDasharray: "4 2"
                  }}
                />
                {dataset && dataset.length > 0 && (
                  <Brush
                    dataKey="gp"
                    height={28}
                    stroke="var(--chart-tick)"
                    travellerWidth={8}
                    startIndex={brushStart}
                    endIndex={brushEnd}
                    onChange={(e: any) => {
                      // Recharts onChange provides { startIndex, endIndex }
                      if (!e) return;
                      const { start, end } = clampBrush(
                        dataset.length,
                        typeof e.startIndex === "number"
                          ? e.startIndex
                          : brushStart,
                        typeof e.endIndex === "number" ? e.endIndex : brushEnd,
                        5
                      );
                      setBrushStart(start);
                      setBrushEnd(end);
                    }}
                  />
                )}
                {teamKeys.map((team) => {
                  const stroke = getChartColor(team);
                  const isHovered = hoveredTeam === team;
                  const hasFocus = hoveredTeam !== null;
                  const strokeOpacity = hasFocus ? (isHovered ? 1 : 0.2) : 0.9;
                  return (
                    <Line
                      key={team}
                      type="monotone"
                      dataKey={team}
                      connectNulls
                      stroke={stroke}
                      strokeWidth={isHovered ? 3 : 2}
                      strokeOpacity={strokeOpacity}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dot={false}
                      activeDot={renderActiveDot(team, stroke)}
                      isAnimationActive={false}
                      onMouseEnter={() => scheduleHover(team)}
                      onMouseLeave={clearHover}
                    />
                  );
                })}
              </ReLineChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.chartMovers}>
            <TopMovers
              improved={categoryImproved}
              degraded={categoryDegraded}
            />
          </div>
        </>
      ) : (
        <div className={styles.chartEmpty}>Trend data not available yet.</div>
      )}
    </div>
  );
}

function RankingTable({
  config,
  result
}: {
  config: TrendCategoryDefinition;
  result: CategoryResult;
}) {
  const rows = result.rankings.slice(0, 10);
  const handleLogoError = (
    event: React.SyntheticEvent<HTMLImageElement, Event>
  ) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = DEFAULT_TEAM_LOGO;
  };
  return (
    <div className={styles.rankingCard}>
      <div className={styles.rankingHeading}>
        <div className={styles.rankingTitle}>{config.label}</div>
        <p className={styles.rankingMeta}>
          Latest percentile vs league (GP {rows[0]?.gp ?? "—"})
        </p>
      </div>
      {rows.length === 0 ? (
        <p className={styles.chartDescription}>No ranking data yet.</p>
      ) : (
        <ul className={styles.rankingList}>
          {rows.map((row) => {
            const info = teamsInfo[row.team as keyof typeof teamsInfo];
            return (
              <li key={row.team} className={styles.rankingRow}>
                <div className={styles.teamCell}>
                  <span className={styles.rank}>{row.rank}</span>
                  <span className={styles.deltaWrapper}>
                    <ArrowDelta delta={row.delta} />
                  </span>

                  <div className={styles.teamLogoWrapper}>
                    <Image
                      src={`/teamLogos/${row.team}.png`}
                      alt={`${row.team} logo`}
                      className={styles.teamLogo}
                      width={30}
                      height={30}
                      loading="lazy"
                      onError={handleLogoError}
                    />
                  </div>
                </div>
                <div className={styles.scoreCell}>
                  <span className={styles.percentile}>
                    {formatPercent(row.percentile)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SkaterRankingTable({
  config,
  result,
  playerMetadata
}: {
  config: SkaterTrendCategoryDefinition;
  result: SkaterCategoryResult;
  playerMetadata: Record<string, PlayerMetadata>;
}) {
  const rows = result.rankings;
  const handleHeadshotError = (
    event: React.SyntheticEvent<HTMLImageElement, Event>
  ) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = DEFAULT_PLAYER_IMAGE;
  };

  return (
    <div className={`${styles.chartCard} ${styles.skaterRankingCard}`}>
      <div className={styles.rankingHeading}>
        <div className={styles.rankingTitle}>{config.label}</div>
        <p className={styles.rankingMeta}>Top percentile skaters</p>
      </div>
      {rows.length === 0 ? (
        <p className={styles.chartDescription}>No skater data yet.</p>
      ) : (
        <ul className={styles.skaterRankingList}>
          {rows.map((row) => {
            const meta = playerMetadata[String(row.playerId)];
            return (
              <li key={row.playerId} className={styles.skaterRankingRow}>
                <div className={styles.skaterInfo}>
                  <span className={styles.rank}>{row.rank}</span>
                  <div className={styles.skaterHeadshotWrapper}>
                    <Image
                      src={meta?.imageUrl ?? DEFAULT_PLAYER_IMAGE}
                      alt={meta?.fullName ?? `Player ${row.playerId}`}
                      className={styles.skaterHeadshot}
                      width={42}
                      height={42}
                      loading="lazy"
                      onError={handleHeadshotError}
                    />
                  </div>
                  <div className={styles.skaterText}>
                    <p className={styles.skaterName}>
                      {meta?.fullName ?? `Player ${row.playerId}`}
                    </p>
                    <p className={styles.skaterMeta}>
                      {meta?.teamAbbrev ?? "FA"}
                      {meta?.position ? ` · ${meta.position}` : ""}
                    </p>
                  </div>
                </div>
                <div className={styles.skaterScore}>
                  <ArrowDelta delta={row.delta} />
                  <span className={styles.percentile}>
                    {formatPercent(row.percentile)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SkaterCategoryChartCard({
  config,
  result,
  playerMetadata,
  large
}: {
  config: SkaterTrendCategoryDefinition;
  result: SkaterCategoryResult;
  playerMetadata: Record<string, PlayerMetadata>;
  large?: boolean;
}) {
  const hasData = Object.keys(result.series || {}).length > 0;
  const seriesForChart = useMemo(() => {
    if (!hasData) {
      return {};
    }
    return result.series;
  }, [hasData, result.series]);

  const { dataset, teamKeys } = useMemo(() => {
    if (!hasData) {
      return { dataset: [], teamKeys: [] };
    }
    return buildChartDataset(seriesForChart);
  }, [hasData, seriesForChart]);
  const [brushStart, setBrushStart] = useState<number | undefined>(undefined);
  const [brushEnd, setBrushEnd] = useState<number | undefined>(undefined);
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!dataset || dataset.length === 0) {
      setBrushStart(undefined);
      setBrushEnd(undefined);
      return;
    }
    const { start, end } = clampBrush(dataset.length, brushStart, brushEnd, 5);
    setBrushStart(start);
    setBrushEnd(end);
  }, [dataset, seriesForChart, brushStart, brushEnd]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const clearHover = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredPlayer(null);
  };

  const scheduleHover = (playerId: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredPlayer(playerId);
      hoverTimeoutRef.current = null;
    }, 100);
  };

  function renderActiveDot(playerId: string, strokeColor: string) {
    function ActiveDot(props: any) {
      const radius =
        hoveredPlayer === playerId
          ? Math.max(props.r ?? 4, 5.5)
          : (props.r ?? 4);
      return (
        <circle
          {...props}
          r={radius}
          fill={strokeColor}
          stroke={props.stroke ?? strokeColor}
          strokeWidth={hoveredPlayer === playerId ? 1 : 0.5}
        />
      );
    }
    ActiveDot.displayName = `ActiveDot-${playerId}`;
    return ActiveDot;
  }

  const CustomTooltip = ({
    active,
    payload,
    label
  }: {
    active?: boolean;
    payload?: any[];
    label?: number;
  }) => {
    if (!active || !payload || payload.length === 0) return null;

    const hoveredData =
      (hoveredPlayer &&
        payload.find((item) => item.dataKey === hoveredPlayer)) ||
      payload.sort((a, b) => b.value - a.value)[0];

    if (!hoveredData) return null;

    const { dataKey, value, stroke } = hoveredData;
    const meta = playerMetadata[dataKey];

    return (
      <div className={styles.chartTooltip}>
        <div className={styles.chartTooltipHeader}>
          <div className={styles.skaterHeadshotWrapper}>
            <Image
              src={meta?.imageUrl ?? DEFAULT_PLAYER_IMAGE}
              alt={meta?.fullName ?? `Player ${dataKey}`}
              className={styles.skaterHeadshot}
              width={28}
              height={28}
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = DEFAULT_PLAYER_IMAGE;
              }}
            />
          </div>
          <span style={{ color: stroke }}>
            {meta?.fullName ?? `Player ${dataKey}`}
          </span>
        </div>
        <p className={styles.chartTooltipValue}>{formatPercent(value)}</p>
        <p className={styles.chartTooltipLabel}>Game: {label}</p>
      </div>
    );
  };

  const { improved: categoryImproved, degraded: categoryDegraded } =
    useMemo(() => {
      const movers: Array<{
        id: string;
        name: string;
        logo?: string;
        delta: number;
      }> = [];
      Object.entries(result.series ?? {}).forEach(([playerId, points]) => {
        if (!points || points.length < 2) return;
        const sorted = [...points].sort((a, b) => a.gp - b.gp);
        const last = sorted[sorted.length - 1];
        const targetGp = last.gp - 4;
        let prior: SeriesPoint | undefined;
        for (let i = sorted.length - 1; i >= 0; i -= 1) {
          if (sorted[i].gp <= targetGp) {
            prior = sorted[i];
            break;
          }
        }
        if (!prior) {
          prior = sorted[Math.max(0, sorted.length - 5)];
        }
        if (!prior) return;
        const delta = Number((last.percentile - prior.percentile).toFixed(2));
        const meta = playerMetadata[playerId];
        movers.push({
          id: playerId,
          name: meta?.fullName ?? `Player ${playerId}`,
          logo: meta?.imageUrl ?? DEFAULT_PLAYER_IMAGE,
          delta
        });
      });

      const improvedSorted = movers
        .slice()
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 5);
      const degradedSorted = movers
        .slice()
        .sort((a, b) => a.delta - b.delta)
        .slice(0, 5);
      return { improved: improvedSorted, degraded: degradedSorted };
    }, [playerMetadata, result.series]);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeaderWrapper}>
        <p className={styles.chartHeading}>{config.label}</p>
        <p className={styles.chartDescription}>{config.description}</p>
      </div>
      {hasData && dataset.length > 0 ? (
        <>
          <div
            className={`${styles.chartShell} ${styles.chartTheme} ${large ? styles.chartShellLarge : ""}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ReLineChart data={dataset} onMouseLeave={clearHover}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--chart-grid)"
                />
                <XAxis
                  dataKey="gp"
                  tick={{ fontSize: 11, fill: "var(--chart-tick)" }}
                  label={{
                    value: "GP",
                    position: "insideBottomRight",
                    offset: -6,
                    fill: "var(--chart-tick)",
                    fontSize: 11
                  }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "var(--chart-tick)" }}
                  width={30}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{
                    stroke: "var(--chart-cursor)",
                    strokeDasharray: "4 2"
                  }}
                />
                {dataset.length > 0 && (
                  <Brush
                    dataKey="gp"
                    height={28}
                    stroke="var(--chart-tick)"
                    travellerWidth={8}
                    startIndex={brushStart}
                    endIndex={brushEnd}
                    onChange={(e: any) => {
                      if (!e) return;
                      const { start, end } = clampBrush(
                        dataset.length,
                        typeof e.startIndex === "number"
                          ? e.startIndex
                          : brushStart,
                        typeof e.endIndex === "number" ? e.endIndex : brushEnd,
                        5
                      );
                      setBrushStart(start);
                      setBrushEnd(end);
                    }}
                  />
                )}
                {teamKeys.map((playerId) => {
                  const isHovered = hoveredPlayer === playerId;
                  const hasFocus = hoveredPlayer !== null;
                  const strokeOpacity = hasFocus ? (isHovered ? 1 : 0.25) : 0.9;
                  const stroke = getChartColor(playerId);
                  return (
                    <Line
                      key={playerId}
                      type="monotone"
                      dataKey={playerId}
                      connectNulls
                      stroke={stroke}
                      strokeWidth={isHovered ? 3 : 2}
                      strokeOpacity={strokeOpacity}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dot={false}
                      activeDot={renderActiveDot(playerId, stroke)}
                      isAnimationActive={false}
                      onMouseEnter={() => scheduleHover(playerId)}
                      onMouseLeave={clearHover}
                    />
                  );
                })}
              </ReLineChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.chartMovers}>
            <TopMovers
              improved={categoryImproved}
              degraded={categoryDegraded}
            />
          </div>
        </>
      ) : (
        <div className={styles.chartEmpty}>Skater data not available yet.</div>
      )}
    </div>
  );
}

export default function TrendsIndexPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PlayerListItem[]>([]);
  const [suggestions, setSuggestions] = useState<PlayerListItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Rolling-average window size. 1 = raw game-by-game granularity. Default to 1GP.
  const [rollingWindow, setRollingWindow] = useState<number>(1);

  const [teamTrends, setTeamTrends] = useState<TeamTrendsResponse | null>(null);
  const [teamTrendsLoading, setTeamTrendsLoading] = useState(true);
  const [teamTrendsError, setTeamTrendsError] = useState<string | null>(null);
  const [ctpiScores, setCtpiScores] = useState<CtpiScore[] | null>(null);
  const [ctpiLoading, setCtpiLoading] = useState(true);
  const [ctpiError, setCtpiError] = useState<string | null>(null);
  const [sosRatings, setSosRatings] = useState<SosRating[] | null>(null);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosError, setSosError] = useState<string | null>(null);
  const [skaterPositionGroup, setSkaterPositionGroup] = useState<
    "forward" | "defense" | "all"
  >("forward");
  const [skaterLimit, setSkaterLimit] = useState<number>(DEFAULT_SKATER_LIMIT);
  const [skaterTrends, setSkaterTrends] = useState<SkaterTrendsResponse | null>(
    null
  );
  const [skaterTrendsLoading, setSkaterTrendsLoading] = useState(true);
  const [skaterTrendsError, setSkaterTrendsError] = useState<string | null>(
    null
  );
  // Dashboard tabs state
  const [activeTopTab, setActiveTopTab] = useState<"teams" | "skaters">(
    "teams"
  );
  const [activeTeamCategory, setActiveTeamCategory] = useState<TrendCategoryId>(
    () => CATEGORY_ORDER[0]
  );
  const [activeSkaterCategory, setActiveSkaterCategory] =
    useState<SkaterTrendCategoryId>(
      () => SKATER_TREND_CATEGORIES[0]?.id as SkaterTrendCategoryId
    );

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "overall", direction: "desc" });

  const handleSort = (key: string) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "desc" ? "asc" : "desc"
    }));
  };

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = "player-suggestions";
  const teamIdToAbbrev = useMemo(() => {
    const map: Record<number, string> = {};
    Object.values(teamsInfo).forEach((t) => {
      map[t.id] = t.abbrev;
    });
    return map;
  }, []);

  const disabled = useMemo(
    () => loading || query.trim().length < 2,
    [loading, query]
  );

  const powerBoard = useMemo(() => {
    const base = buildPowerBoard(teamTrends);
    if (!ctpiScores || ctpiScores.length === 0) return base;
    const ctpiMap = new Map(ctpiScores.map((c) => [c.team, c]));
    const sosMap = sosRatings
      ? new Map(sosRatings.map((s) => [s.team, s]))
      : null;
    const sosPct = (record?: { wins: number; losses: number; otl: number }) => {
      if (!record) return null;
      const gp = record.wins + record.losses + record.otl;
      if (gp <= 0) return null;
      // Align with backend: straight win percentage (no half-credit for OTL).
      return record.wins / gp;
    };
    const fmtRecord = (record?: {
      wins: number;
      losses: number;
      otl: number;
    }) => (record ? `${record.wins}-${record.losses}-${record.otl}` : "");
    const mapped = base.map((row) => {
      const ctpi = ctpiMap.get(row.team);
      if (!ctpi) return row;
      const ctpiDelta =
        ctpi.sparkSeries && ctpi.sparkSeries.length > 1
          ? ctpi.sparkSeries[ctpi.sparkSeries.length - 1].value -
            ctpi.sparkSeries[0].value
          : null;
      return {
        ...row,
        overall: Number(ctpi.ctpi_0_to_100.toFixed(1)),
        specialTeams: Number(ctpi.specialTeams.toFixed(2)),
        topDriver: selectTopDriver(ctpi),
        ctpi,
        ctpiDelta,
        sosPastPct: sosPct(sosMap?.get(row.team)?.past),
        sosFuturePct: sosPct(sosMap?.get(row.team)?.future),
        sosPastRecord: fmtRecord(sosMap?.get(row.team)?.past),
        sosFutureRecord: fmtRecord(sosMap?.get(row.team)?.future)
      };
    });

    return mapped.sort((a, b) => {
      const getValue = (item: PowerBoardRow) => {
        if (sortConfig.key === "team") return item.name;
        if (sortConfig.key === "overall") return item.overall;
        if (sortConfig.key === "sosPastPct") return item.sosPastPct ?? -999;
        if (sortConfig.key === "sosFuturePct") return item.sosFuturePct ?? -999;
        // Handle CTPI specific fields
        if (
          ["offense", "defense", "goaltending", "luck"].includes(sortConfig.key)
        ) {
          if (item.ctpi) {
            return (item.ctpi as any)[sortConfig.key];
          }
          // Fallback for non-CTPI rows (shouldn't happen often if CTPI is loaded)
          if (sortConfig.key === "offense")
            return item.snapshots.offense?.percentile ?? -999;
          if (sortConfig.key === "defense")
            return item.snapshots.defense?.percentile ?? -999;
          return -999;
        }
        if (sortConfig.key === "specialTeams") return item.specialTeams ?? -999;
        return 0;
      };

      const valA = getValue(a);
      const valB = getValue(b);

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [ctpiScores, teamTrends, sortConfig]);
  const hotTeams = useMemo(
    () =>
      powerBoard
        .filter((row) => (row.ctpiDelta ?? row.momentum) !== null)
        .sort(
          (a, b) =>
            (b.ctpiDelta ?? b.momentum ?? 0) - (a.ctpiDelta ?? a.momentum ?? 0)
        )
        .slice(0, 5),
    [powerBoard]
  );
  const coldTeams = useMemo(
    () =>
      powerBoard
        .filter((row) => (row.ctpiDelta ?? row.momentum) !== null)
        .sort(
          (a, b) =>
            (a.ctpiDelta ?? a.momentum ?? 0) - (b.ctpiDelta ?? b.momentum ?? 0)
        )
        .slice(0, 5),
    [powerBoard]
  );

  // Normalize name parts to Title Case to better match stored fullName values
  const normalizeName = (str: string) =>
    str
      .trim()
      .split(/\s+/)
      .map((chunk) => chunk[0]?.toUpperCase() + chunk.slice(1).toLowerCase())
      .join(" ");

  // Debounced autocomplete fetch
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveIndex(-1);
      return;
    }

    const handle = setTimeout(async () => {
      try {
        const normalized = normalizeName(q);
        const { data, error } = await (supabase as any)
          .from("players")
          .select("id, fullName, position, team_id")
          .ilike("fullName", `%${normalized}%`)
          .order("fullName", { ascending: true })
          .limit(8);

        if (error) throw error;

        const mapped = ((data as any[]) ?? []).map((row: any) => ({
          id: row.id,
          fullName: row.fullName,
          position: row.position,
          team_abbrev:
            row.team_id != null ? (teamIdToAbbrev[row.team_id] ?? null) : null
        })) as PlayerListItem[];

        setSuggestions(mapped);
        setShowSuggestions(mapped.length > 0);
        setActiveIndex(-1);
      } catch (err) {
        console.error(err);
        // Don't show global error for autocomplete; keep suggestions hidden instead
        setSuggestions([]);
        setShowSuggestions(false);
        setActiveIndex(-1);
      }
    }, 200);

    return () => clearTimeout(handle);
  }, [query, teamIdToAbbrev]);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;

    const trimmedQuery = query.trim();
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const normalized = normalizeName(trimmedQuery);

      const { data, error } = await (supabase as any)
        .from("players")
        .select("id, fullName, position, team_id")
        .ilike("fullName", `%${normalized}%`)
        .order("fullName", { ascending: true })
        .limit(20);

      if (error) throw error;

      if (!data || data.length === 0) {
        setError("No players found. Try another name.");
        return;
      }

      setResults(
        ((data as any[]) ?? []).map((row: any) => ({
          id: row.id,
          fullName: row.fullName,
          position: row.position,
          team_abbrev:
            row.team_id != null ? (teamIdToAbbrev[row.team_id] ?? null) : null
        })) as PlayerListItem[]
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Unexpected error searching players.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((idx) => Math.min(idx + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((idx) => Math.max(idx - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        const chosen = suggestions[activeIndex];
        router.push(`/trends/player/${chosen.id}`);
        setShowSuggestions(false);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    async function loadTeamTrends() {
      try {
        setTeamTrendsLoading(true);
        const response = await fetch("/api/v1/trends/team-power", {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(
            `Trend API failed with status ${response.status}: ${response.statusText}`
          );
        }
        const payload = (await response.json()) as TeamTrendsResponse;
        if (mounted) {
          setTeamTrends(payload);
          setTeamTrendsError(null);
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Failed to load team trends", err);
        if (mounted) {
          setTeamTrendsError(
            err?.message ?? "Unexpected error fetching team trends."
          );
        }
      } finally {
        if (mounted) {
          setTeamTrendsLoading(false);
        }
      }
    }
    loadTeamTrends();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    async function loadCtpi() {
      try {
        setCtpiLoading(true);
        const response = await fetch("/api/v1/trends/team-ctpi", {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(
            `CTPI API failed with status ${response.status}: ${response.statusText}`
          );
        }
        const payload = (await response.json()) as {
          teams: CtpiScore[];
        };
        if (mounted) {
          setCtpiScores(payload.teams ?? []);
          setCtpiError(null);
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Failed to load CTPI", err);
        if (mounted) {
          setCtpiError(err?.message ?? "Unexpected error fetching CTPI.");
        }
      } finally {
        if (mounted) {
          setCtpiLoading(false);
        }
      }
    }
    loadCtpi();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    async function loadSos() {
      try {
        setSosLoading(true);
        const response = await fetch("/api/v1/trends/team-sos", {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(
            `SOS API failed with status ${response.status}: ${response.statusText}`
          );
        }
        const payload = (await response.json()) as { teams: SosRating[] };
        if (mounted) {
          setSosRatings(payload.teams ?? []);
          setSosError(null);
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Failed to load SOS", err);
        if (mounted) {
          setSosError(err?.message ?? "Unexpected error fetching SOS.");
        }
      } finally {
        if (mounted) {
          setSosLoading(false);
        }
      }
    }
    loadSos();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    async function loadSkaterTrends() {
      try {
        setSkaterTrendsLoading(true);
        const params = new URLSearchParams({
          position: skaterPositionGroup,
          limit: String(skaterLimit),
          window: String(rollingWindow)
        });
        const response = await fetch(
          `/api/v1/trends/skater-power?${params.toString()}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(
            `Skater trend API failed with status ${response.status}: ${response.statusText}`
          );
        }
        const payload = (await response.json()) as SkaterTrendsResponse;
        if (mounted) {
          setSkaterTrends(payload);
          setSkaterTrendsError(null);
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Failed to load skater trends", err);
        if (mounted) {
          setSkaterTrendsError(
            err?.message ?? "Unexpected error fetching skater trends."
          );
        }
      } finally {
        if (mounted) {
          setSkaterTrendsLoading(false);
        }
      }
    }

    loadSkaterTrends();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [skaterPositionGroup, skaterLimit, rollingWindow]);

  return (
    <div className={styles.page}>
      <div style={{ marginBottom: "1rem" }}>
        <a href="/trends">Visit the unified dashboard →</a>
      </div>
      <div className={styles.pageContent}>
        <section className={styles.hero}>
          <div className={styles.titleInfo}>
            <h1 className={styles.heroTitle}>
              <span className={styles.heroAccent}>Sustainability</span> Trends
            </h1>
            <p className={styles.heroSubtitle}>
              Search for an NHL skater or explore team-wide power metrics.
            </p>
          </div>

          <form onSubmit={handleSearch} className={styles.searchForm}>
            <div className={styles.searchInputWrapper}>
              <input
                ref={inputRef}
                type="text"
                autoFocus
                role="combobox"
                aria-expanded={showSuggestions}
                aria-controls={listboxId}
                aria-autocomplete="list"
                placeholder="Search by player name (e.g., Connor McDavid)"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(suggestions.length > 0)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                className={styles.searchInput}
              />

              {showSuggestions && suggestions.length > 0 && (
                <ul
                  id={listboxId}
                  role="listbox"
                  className={styles.suggestionList}
                >
                  {suggestions.map((player, idx) => (
                    <li
                      key={player.id}
                      role="option"
                      aria-selected={idx === activeIndex}
                    >
                      <button
                        type="button"
                        className={`${styles.suggestionButton} ${
                          idx === activeIndex ? styles.suggestionActive : ""
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          router.push(`/trends/player/${player.id}`);
                          setShowSuggestions(false);
                        }}
                      >
                        <span>{player.fullName}</span>
                        <span>
                          {player.team_abbrev ?? "FA"} · {player.position}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="submit"
              disabled={disabled}
              className={styles.searchButton}
            >
              {loading ? "Searching…" : "Find Player"}
            </button>
          </form>

          {error && <p className={styles.errorMessage}>{error}</p>}

          {!error && results.length > 0 && (
            <div className={styles.resultsPanel}>
              <h2 className={styles.sectionSubtitle}>Select a player</h2>
              <ul className={styles.resultsList}>
                {results.map((player) => (
                  <li key={player.id} className={styles.resultRow}>
                    <button
                      type="button"
                      onClick={() => router.push(`/trends/player/${player.id}`)}
                      className={styles.resultButton}
                    >
                      <span>{player.fullName}</span>
                      <span>
                        {player.team_abbrev ?? "FA"} · {player.position}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className={styles.powerSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>
                <span className={styles.heroAccent}>League</span> Power Ladder
              </h2>
              <p className={styles.sectionDescription}>
                Weighted blend of offense (35%), defense (30%), goaltending
                (20%), special teams (15%), and a luck adjustment. Recent games
                are weighted more heavily to reflect current form.
              </p>
            </div>
            <div className={styles.sectionMeta}>
              <span>
                {teamTrends?.generatedAt
                  ? `Updated ${new Date(teamTrends.generatedAt).toLocaleString()}`
                  : "Nightly update"}
              </span>
              <span>Momentum = last 5GP delta</span>
            </div>
          </div>
          {teamTrendsLoading || ctpiLoading ? (
            <div className={styles.teamLoading}>Building composite ladder…</div>
          ) : teamTrendsError || ctpiError ? (
            <div className={styles.teamError}>
              {teamTrendsError || ctpiError}
            </div>
          ) : powerBoard.length === 0 ? (
            <div className={styles.chartEmpty}>
              No composite trend data available yet.
            </div>
          ) : (
            <div className={styles.powerGrid}>
              <div className={styles.powerTableWrapper}>
                <div className={styles.powerTableHead}>
                  <span>Rank</span>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => handleSort("team")}
                  >
                    Team{" "}
                    {sortConfig.key === "team" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </button>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => handleSort("overall")}
                  >
                    CTPI{" "}
                    {sortConfig.key === "overall" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </button>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => handleSort("offense")}
                    title={CTPI_TOOLTIPS.offense}
                  >
                    Offense{" "}
                    {sortConfig.key === "offense" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </button>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => handleSort("defense")}
                    title={CTPI_TOOLTIPS.defense}
                  >
                    Defense{" "}
                    {sortConfig.key === "defense" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </button>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => handleSort("goaltending")}
                    title={CTPI_TOOLTIPS.goaltending}
                  >
                    Goaltending{" "}
                    {sortConfig.key === "goaltending" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </button>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => handleSort("specialTeams")}
                    title={CTPI_TOOLTIPS.specialTeams}
                  >
                    Special Teams{" "}
                    {sortConfig.key === "specialTeams" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </button>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => handleSort("luck")}
                    title={CTPI_TOOLTIPS.luck}
                  >
                    Luck{" "}
                    {sortConfig.key === "luck" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </button>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => handleSort("sosPastPct")}
                    title="Opponents' win% so far"
                  >
                    Past SOS{" "}
                    {sortConfig.key === "sosPastPct" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </button>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => handleSort("sosFuturePct")}
                    title="Opponents' win% upcoming"
                  >
                    Future SOS{" "}
                    {sortConfig.key === "sosFuturePct" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </button>
                </div>
                <ul className={styles.powerTable} role="list">
                  {powerBoard.map((row, index) => {
                    const handleLogoError = (
                      event: React.SyntheticEvent<HTMLImageElement, Event>
                    ) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = DEFAULT_TEAM_LOGO;
                    };
                    return (
                      <li key={row.team} className={styles.powerRow}>
                        <span className={styles.powerRank}>#{index + 1}</span>
                        <div className={styles.powerTeamCell}>
                          <div
                            className={`${styles.teamLogoWrapper} ${styles.powerTeamLogo}`}
                          >
                            <Image
                              src={row.logo}
                              alt={`${row.team} logo`}
                              className={styles.teamLogo}
                              width={34}
                              height={34}
                              loading="lazy"
                              onError={handleLogoError}
                            />
                          </div>
                          <div className={styles.powerTeamText}>
                            <div className={styles.powerTeamName}>
                              {row.name}
                            </div>
                            <div className={styles.powerTeamMeta}>
                              GP{" "}
                              {row.snapshots[row.topDriver ?? "offense"]?.gp ??
                                "—"}
                            </div>
                          </div>
                        </div>

                        <div className={styles.powerScoreCell}>
                          <span
                            className={`${styles.driverTag} ${ratingToneClass(row.overall)}`}
                          >
                            {row.ctpi
                              ? row.ctpi.ctpi_0_to_100.toFixed(1)
                              : formatPercent(row.overall)}
                          </span>
                        </div>

                        <div className={styles.powerValueCell}>
                          <span
                            title={CTPI_TOOLTIPS.offense}
                            className={`${styles.valuePill} ${ratingToneClass(row.ctpi ? row.ctpi.offense : row.snapshots.offense?.percentile)}`}
                          >
                            {row.ctpi
                              ? formatSigned(row.ctpi.offense, 2)
                              : row.snapshots.offense
                                ? formatPercent(
                                    row.snapshots.offense.percentile
                                  )
                                : "—"}
                          </span>
                        </div>

                        <div className={styles.powerValueCell}>
                          <span
                            title={CTPI_TOOLTIPS.defense}
                            className={`${styles.valuePill} ${ratingToneClass(row.ctpi ? row.ctpi.defense : row.snapshots.defense?.percentile)}`}
                          >
                            {row.ctpi
                              ? formatSigned(row.ctpi.defense, 2)
                              : row.snapshots.defense
                                ? formatPercent(
                                    row.snapshots.defense.percentile
                                  )
                                : "—"}
                          </span>
                        </div>

                        <div className={styles.powerValueCell}>
                          <span
                            title={CTPI_TOOLTIPS.goaltending}
                            className={`${styles.valuePill} ${ratingToneClass(row.ctpi?.goaltending)}`}
                          >
                            {row.ctpi
                              ? formatSigned(row.ctpi.goaltending, 2)
                              : "—"}
                          </span>
                        </div>

                        <div className={styles.powerValueCell}>
                          <span
                            title={CTPI_TOOLTIPS.specialTeams}
                            className={`${styles.valuePill} ${ratingToneClass(row.ctpi ? row.ctpi.specialTeams : row.specialTeams)}`}
                          >
                            {row.ctpi
                              ? formatSigned(row.ctpi.specialTeams, 2)
                              : row.specialTeams !== null &&
                                  row.specialTeams !== undefined
                                ? formatPercent(row.specialTeams)
                                : "—"}
                          </span>
                        </div>

                        <div className={styles.powerValueCell}>
                          <div
                            title={CTPI_TOOLTIPS.luck}
                            className={`${styles.luckWrapper} ${row.ctpi && Math.abs(row.ctpi.luck) > 0.5 ? styles.hasBadge : ""}`}
                          >
                            {row.ctpi && Math.abs(row.ctpi.luck) > 0.5 && (
                              <span
                                className={`${styles.luckBadge} ${row.ctpi.luck > 0 ? styles.luckLucky : styles.luckUnlucky}`}
                              >
                                {row.ctpi.luck > 0 ? "LUCKY" : "UNLUCKY"}
                              </span>
                            )}
                            <span
                              className={`${styles.valuePill} ${ratingToneClass(row.ctpi?.luck)}`}
                            >
                              {row.ctpi ? formatSigned(row.ctpi.luck, 2) : "—"}
                            </span>
                          </div>
                        </div>
                        <div className={styles.powerValueCell}>
                          <span
                            title={
                              row.sosPastRecord
                                ? `Past opponents: ${row.sosPastRecord}`
                                : "Past strength of schedule (points %)"
                            }
                            className={`${styles.valuePill} ${ratingToneClass(row.sosPastPct)}`}
                          >
                            {formatPct(row.sosPastPct)}
                          </span>
                        </div>
                        <div className={styles.powerValueCell}>
                          <span
                            title={
                              row.sosFutureRecord
                                ? `Future opponents: ${row.sosFutureRecord}`
                                : "Future strength of schedule (points %)"
                            }
                            className={`${styles.valuePill} ${ratingToneClass(row.sosFuturePct)}`}
                          >
                            {formatPct(row.sosFuturePct)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className={styles.powerSidebar}>
                <div className={styles.hotColdCard}>
                  <p className={styles.sectionSubtitle}>Hot streaks</p>
                  <ul>
                    {hotTeams.map((row) => {
                      const tone = resolveMomentumTone(
                        row.ctpiDelta ?? row.momentum
                      );
                      const sparkPoints = row.ctpi?.sparkSeries ?? [];
                      return (
                        <li
                          key={`hot-${row.team}`}
                          className={styles.hotColdRow}
                        >
                          <div className={styles.hotColdTeam}>
                            <div className={styles.teamLogoWrapper}>
                              <Image
                                src={row.logo}
                                alt={`${row.team} logo`}
                                className={styles.teamLogo}
                                width={28}
                                height={28}
                                loading="lazy"
                              />
                            </div>
                            <div>
                              <p className={styles.powerTeamName}>{row.name}</p>
                              <p className={styles.hotColdMeta}>{row.reason}</p>
                            </div>
                          </div>
                          <div
                            className={`${styles.sparkCell} ${styles.sparkHot}`}
                          >
                            <SparkMini points={sparkPoints} variant="hot" />
                          </div>
                          <span
                            className={`${styles.momentumPill} ${tone.toneClass}`}
                          >
                            {tone.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className={styles.hotColdCard}>
                  <p className={styles.sectionSubtitle}>Cold streaks</p>
                  <ul>
                    {coldTeams.map((row) => {
                      const tone = resolveMomentumTone(
                        row.ctpiDelta ?? row.momentum
                      );
                      const sparkPoints = row.ctpi?.sparkSeries ?? [];
                      return (
                        <li
                          key={`cold-${row.team}`}
                          className={styles.hotColdRow}
                        >
                          <div className={styles.hotColdTeam}>
                            <div className={styles.teamLogoWrapper}>
                              <Image
                                src={row.logo}
                                alt={`${row.team} logo`}
                                className={styles.teamLogo}
                                width={28}
                                height={28}
                                loading="lazy"
                              />
                            </div>
                            <div>
                              <p className={styles.powerTeamName}>{row.name}</p>
                              <p className={styles.hotColdMeta}>{row.reason}</p>
                            </div>
                          </div>
                          <div
                            className={`${styles.sparkCell} ${styles.sparkCold}`}
                          >
                            <SparkMini points={sparkPoints} variant="cold" />
                          </div>
                          <span
                            className={`${styles.momentumPill} ${tone.toneClass}`}
                          >
                            {tone.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Dashboard tabs */}
        <div className={styles.topTabs} role="tablist" aria-label="Dataset">
          {(
            [
              { id: "teams", label: "Teams" },
              { id: "skaters", label: "Skaters" }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTopTab === tab.id}
              className={`${styles.tab} ${activeTopTab === tab.id ? styles.tabActive : ""}`}
              onClick={() => setActiveTopTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTopTab === "teams" ? (
          <>
            <div className={styles.subTabs} aria-label="Team categories">
              {CATEGORY_ORDER.map((cid) => {
                const cat = CATEGORY_CONFIG_MAP[cid];
                return (
                  <button
                    key={cid}
                    type="button"
                    className={`${styles.subTab} ${activeTeamCategory === cid ? styles.subTabActive : ""}`}
                    aria-pressed={activeTeamCategory === cid}
                    onClick={() => setActiveTeamCategory(cid)}
                  >
                    {cat.label}
                  </button>
                );
              })}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <div
                  className={styles.windowToggle}
                  aria-label="Rolling window"
                >
                  {[1, 3, 5, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.windowButton} ${rollingWindow === n ? styles.windowActive : ""}`}
                      aria-pressed={rollingWindow === n}
                      onClick={() => setRollingWindow(n)}
                    >
                      {n}GP
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              className={styles.dashboardContent}
              role="region"
              aria-label="Team chart"
            >
              {teamTrendsError && (
                <div className={styles.teamError}>{teamTrendsError}</div>
              )}
              {teamTrendsLoading ? (
                <div className={styles.teamLoading}>
                  Loading team percentile trends…
                </div>
              ) : (
                (() => {
                  const category = CATEGORY_CONFIG_MAP[activeTeamCategory];
                  const categoryResult =
                    teamTrends?.categories?.[activeTeamCategory] ??
                    emptyCategoryResult;
                  return (
                    <CategoryChartCard
                      config={category}
                      result={categoryResult}
                      windowSize={rollingWindow}
                      large
                    />
                  );
                })()
              )}
            </div>
          </>
        ) : (
          <>
            <div className={styles.subTabs} aria-label="Skater categories">
              {SKATER_TREND_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`${styles.subTab} ${activeSkaterCategory === cat.id ? styles.subTabActive : ""}`}
                  aria-pressed={activeSkaterCategory === cat.id}
                  onClick={() => setActiveSkaterCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
              <div className={styles.skaterControls}>
                <div
                  className={styles.windowToggle}
                  aria-label="Skater position group"
                >
                  {[
                    { value: "forward", label: "Forwards" },
                    { value: "defense", label: "Defense" },
                    { value: "all", label: "All" }
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.windowButton} ${skaterPositionGroup === option.value ? styles.windowActive : ""}`}
                      aria-pressed={skaterPositionGroup === option.value}
                      onClick={() =>
                        setSkaterPositionGroup(
                          option.value as "forward" | "defense" | "all"
                        )
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div
                  className={styles.windowToggle}
                  aria-label="Skater cohort size"
                >
                  {[25, 50].map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={`${styles.windowButton} ${skaterLimit === count ? styles.windowActive : ""}`}
                      aria-pressed={skaterLimit === count}
                      onClick={() => setSkaterLimit(count)}
                    >
                      Top {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              className={styles.dashboardContent}
              role="region"
              aria-label="Skater chart"
            >
              {skaterTrendsError && (
                <div className={styles.teamError}>{skaterTrendsError}</div>
              )}
              {skaterTrendsLoading ? (
                <div className={styles.teamLoading}>Loading skater trends…</div>
              ) : (
                (() => {
                  const category = SKATER_TREND_CATEGORIES.find(
                    (c) => c.id === activeSkaterCategory
                  )!;
                  const categoryResult =
                    skaterTrends?.categories?.[activeSkaterCategory] ??
                    emptySkaterResult;
                  const playerMetadata = skaterTrends?.playerMetadata ?? {};
                  return (
                    <div className={styles.trendGrid}>
                      <SkaterRankingTable
                        config={category}
                        result={categoryResult}
                        playerMetadata={playerMetadata}
                      />
                      <SkaterCategoryChartCard
                        config={category}
                        result={categoryResult}
                        playerMetadata={playerMetadata}
                        large
                      />
                    </div>
                  );
                })()
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
