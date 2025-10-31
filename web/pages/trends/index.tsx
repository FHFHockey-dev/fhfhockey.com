import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import supabase from "lib/supabase";
import { teamsInfo } from "lib/teamsInfo";
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
const DEFAULT_TEAM_LOGO = "/teamLogos/default.png";
const DEFAULT_PLAYER_IMAGE = DEFAULT_TEAM_LOGO;

function lightenHexColor(hex: string, amount = 0.3): string {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return hex;
  let normalized = hex.replace("#", "");
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (normalized.length !== 6) return hex;
  const num = parseInt(normalized, 16);
  if (Number.isNaN(num)) return hex;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const adjust = (channel: number) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount));
  const newColor = (adjust(r) << 16) | (adjust(g) << 8) | adjust(b);
  return `#${newColor.toString(16).padStart(6, "0")}`;
}

const PLAYER_COLOR_PALETTE = [
  "#7dd3fc",
  "#fcd34d",
  "#fca5a5",
  "#c4b5fd",
  "#a5f3fc",
  "#f9a8d4",
  "#fbbf24",
  "#86efac",
  "#f472b6",
  "#f97316",
  "#bef264",
  "#fda4af"
];

function getPlayerColor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0; // convert to 32bit int
  }
  const idx = Math.abs(hash) % PLAYER_COLOR_PALETTE.length;
  return PLAYER_COLOR_PALETTE[idx];
}

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
    const end = dataset.length - 1;
    const start = Math.max(0, end - 4);
    setBrushStart(start);
    setBrushEnd(end);
  }, [dataset, seriesForChart]);
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
    }, 1000);
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
          onMouseEnter={() => scheduleHover(team)}
          onMouseLeave={clearHover}
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
    const hoveredPayload =
      (hoveredTeam && payload.find((item) => item.dataKey === hoveredTeam)) ||
      payload[0];
    if (!hoveredPayload) return null;
    const { dataKey, value } = hoveredPayload;
    const teamInfo = teamsInfo[dataKey as keyof typeof teamsInfo];
    return (
      <div className={styles.chartTooltip}>
        <p className={styles.chartTooltipLabel}>GP {label}</p>
        <p className={styles.chartTooltipTeam}>
          {teamInfo?.shortName ?? dataKey}
        </p>
        <p className={styles.chartTooltipValue}>{formatPercent(value)}</p>
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
                      const s =
                        typeof e.startIndex === "number"
                          ? e.startIndex
                          : brushStart;
                      const en =
                        typeof e.endIndex === "number" ? e.endIndex : brushEnd;
                      setBrushStart(s);
                      setBrushEnd(en);
                    }}
                  />
                )}
                {teamKeys.map((team) => {
                  const teamInfo = teamsInfo[team as keyof typeof teamsInfo];
                  const stroke =
                    teamInfo?.lightColor ??
                    (teamInfo?.primaryColor
                      ? lightenHexColor(teamInfo.primaryColor, 0.35)
                      : "#a0aec0");
                  const isHovered = hoveredTeam === team;
                  const hasFocus = hoveredTeam !== null;
                  const strokeOpacity = hasFocus ? (isHovered ? 1 : 0.2) : 1;
                  return (
                    <Line
                      key={team}
                      type="stepAfter"
                      dataKey={team}
                      connectNulls
                      stroke={stroke}
                      strokeWidth={isHovered ? 3.8 : 2.4}
                      strokeOpacity={strokeOpacity}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dot={{
                        r: isHovered ? 3 : 2,
                        fill: stroke,
                        strokeWidth: 0
                      }}
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
    const end = dataset.length - 1;
    const start = Math.max(0, end - 4);
    setBrushStart(start);
    setBrushEnd(end);
  }, [dataset, seriesForChart]);

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
    }, 800);
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
          onMouseEnter={() => scheduleHover(playerId)}
          onMouseLeave={clearHover}
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
    const hoveredPayload =
      (hoveredPlayer &&
        payload.find((item) => item.dataKey === hoveredPlayer)) ||
      payload[0];
    if (!hoveredPayload) return null;
    const { dataKey, value } = hoveredPayload;
    const meta = playerMetadata[dataKey];
    return (
      <div className={styles.chartTooltip}>
        <p className={styles.chartTooltipLabel}>GP {label}</p>
        <p className={styles.chartTooltipTeam}>
          {meta?.fullName ?? `Player ${dataKey}`}
        </p>
        <p className={styles.chartTooltipValue}>{formatPercent(value)}</p>
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
                      const s =
                        typeof e.startIndex === "number"
                          ? e.startIndex
                          : brushStart;
                      const en =
                        typeof e.endIndex === "number" ? e.endIndex : brushEnd;
                      setBrushStart(s);
                      setBrushEnd(en);
                    }}
                  />
                )}
                {teamKeys.map((playerId) => {
                  const isHovered = hoveredPlayer === playerId;
                  const hasFocus = hoveredPlayer !== null;
                  const strokeOpacity = hasFocus ? (isHovered ? 1 : 0.2) : 1;
                  const stroke = getPlayerColor(playerId);
                  return (
                    <Line
                      key={playerId}
                      type="stepAfter"
                      dataKey={playerId}
                      connectNulls
                      stroke={stroke}
                      strokeWidth={isHovered ? 3.8 : 2.4}
                      strokeOpacity={strokeOpacity}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dot={{
                        r: isHovered ? 3 : 2,
                        fill: stroke,
                        strokeWidth: 0
                      }}
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
              <div className={styles.windowToggle} aria-label="Rolling window">
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
            <div
              style={{ marginLeft: "auto" }}
              className={styles.skaterControls}
            >
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
                  <SkaterCategoryChartCard
                    config={category}
                    result={categoryResult}
                    playerMetadata={playerMetadata}
                    large
                  />
                );
              })()
            )}
          </div>
        </>
      )}

      <section className={`${styles.teamSection} ${styles.hidden}`}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Team Trends</h2>
            <p className={styles.sectionSubtitle}>
              Percentile trajectories by game played across four strengths.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <p className={styles.sectionTimestamp}>
              {teamTrends?.generatedAt
                ? `Updated ${new Date(teamTrends.generatedAt).toLocaleString()}`
                : ""}
            </p>

            <div
              className={styles.windowToggle}
              role="tablist"
              aria-label="Rolling average window"
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
        {teamTrendsError && (
          <div className={styles.teamError}>{teamTrendsError}</div>
        )}
        {teamTrendsLoading ? (
          <div className={styles.teamLoading}>
            Loading team percentile trends…
          </div>
        ) : (
          <div className={styles.trendGrid}>
            {CATEGORY_ORDER.flatMap((categoryId) => {
              const category = CATEGORY_CONFIG_MAP[categoryId];
              const categoryResult =
                teamTrends?.categories?.[categoryId] ?? emptyCategoryResult;
              return [
                <RankingTable
                  key={`${category.id}-ranking`}
                  config={category}
                  result={categoryResult}
                />,
                <CategoryChartCard
                  key={`${category.id}-chart`}
                  config={category}
                  result={categoryResult}
                  windowSize={rollingWindow}
                />
              ];
            })}
          </div>
        )}
      </section>

      <section className={`${styles.teamSection} ${styles.hidden}`}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Skater Trends</h2>
            <p className={styles.sectionSubtitle}>
              Top skater percentiles for shot volume, ixG, and usage.
            </p>
          </div>
          <div className={styles.skaterControls}>
            <div
              className={styles.windowToggle}
              role="tablist"
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
              role="tablist"
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
        {skaterTrendsError && (
          <div className={styles.teamError}>{skaterTrendsError}</div>
        )}
        {skaterTrendsLoading ? (
          <div className={styles.teamLoading}>Loading skater trends…</div>
        ) : (
          <div className={styles.trendGrid}>
            {SKATER_TREND_CATEGORIES.flatMap((category) => {
              const categoryResult =
                skaterTrends?.categories?.[category.id] ?? emptySkaterResult;
              const playerMetadata = skaterTrends?.playerMetadata ?? {};
              return [
                <SkaterRankingTable
                  key={`${category.id}-skater-ranking`}
                  config={category}
                  result={categoryResult}
                  playerMetadata={playerMetadata}
                />,
                <SkaterCategoryChartCard
                  key={`${category.id}-skater-chart`}
                  config={category}
                  result={categoryResult}
                  playerMetadata={playerMetadata}
                />
              ];
            })}
          </div>
        )}
      </section>

      <p className={styles.legacyLink}>
        Looking for classic sustainability tables?{" "}
        <button type="button" onClick={() => router.push("/trends/legacy")}>
          View legacy dashboard
        </button>
      </p>
    </div>
  );
}
