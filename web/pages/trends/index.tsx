import { useEffect, useMemo, useRef, useState } from "react";
import type { GetServerSideProps, NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import DashboardPillarHero from "components/dashboard/DashboardPillarHero";
import GoalieShareChart from "components/GoalieShareChart";
import { useDashboardData } from "hooks/useDashboardData";
import TopMovers from "components/TopMovers/TopMovers";
import { getTeamMetaById } from "lib/dashboard/teamMetadata";
import {
  TEAM_TREND_CATEGORIES,
  type TrendCategoryId
} from "lib/trends/teamMetricConfig";
import {
  SKATER_TREND_CATEGORIES,
  SKATER_WINDOW_OPTIONS,
  type SkaterTrendCategoryId,
  type SkaterPositionGroup,
  type SkaterWindowSize
} from "lib/trends/skaterMetricConfig";
import {
  GOALIE_TREND_CATEGORIES,
  type GoalieTrendCategoryId
} from "lib/trends/goalieMetricConfig";
import { TRENDS_SURFACE_LINKS } from "lib/navigation/siteSurfaceLinks";
import {
  describeLockedBaselines,
  buildSkaterRecentSummaryCards,
  formatGoalieTrendValue,
  formatPercentileOrdinal,
  formatRecentFormValue,
  formatSkaterTrendWindowLabel
} from "lib/trends/trendsSurface";
import { useRouter } from "next/router";
import supabase from "lib/supabase";
import { getTeamAbbreviationById } from "lib/teamsInfo";
import { fallbackTeamLogo } from "lib/images";
import type { DashboardSection } from "lib/dashboard/dataFetchers";
import {
  CartesianGrid,
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";
import styles from "./dashboard.module.scss";

type ForgeProjectionRow = {
  player_id: number;
  player_name: string;
  team_name: string;
  position: string;
  g: number;
  a: number;
  pts: number;
  ppp: number;
  sog: number;
  hit: number;
  blk: number;
  opponent?: string | null;
  gamesRemaining?: number | null;
  uncertainty?: Record<string, unknown> | null;
};

type StartChartPlayer = {
  player_id: number;
  name: string;
  positions: string[];
  team_abbrev: string | null;
  opponent_abbrev: string | null;
  start_probability?: number | null;
  projected_gsaa?: number | null;
  games_remaining_week?: number;
  proj_fantasy_points?: number | null;
  proj_goals?: number | null;
  proj_assists?: number | null;
  proj_shots?: number | null;
  proj_pp_points?: number | null;
  proj_hits?: number | null;
  proj_blocks?: number | null;
};

type ForgeGoalieRow = {
  goalie_id: number;
  team_id: number;
  opponent_team_id: number;
  proj_win_prob: number | null;
  proj_shutout_prob: number | null;
  starter_probability: number | null;
  uncertainty?: Record<string, unknown> | null;
};

type GoalieDisplayRow = {
  goalieId: number;
  name: string;
  team: string;
  opponent: string;
  startProb: number | null;
  winProb: number | null;
  shutoutProb: number | null;
  uncertainty?: Record<string, unknown> | null;
};

type PlayerSearchRow = {
  id: number;
  fullName: string;
  position: string | null;
  teamAbbrev: string | null;
};

type TrendRankingRow = {
  playerId: number;
  percentile: number;
  gp: number;
  rank: number;
  previousRank: number | null;
  delta: number;
  latestValue: number | null;
  sampleSize?: number;
  confidence?: "low" | "medium" | "high";
  volatility?: number | null;
};

type SkaterRankingRow = TrendRankingRow;

type SkaterCategoryResult = {
  series?: Record<string, Array<{ gp: number; percentile: number }>>;
  rankings?: SkaterRankingRow[];
};

const getTodayEt = (): string => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
};


const DEFAULT_TEAM_LOGO = fallbackTeamLogo;
const DEFAULT_PLAYER_IMAGE = DEFAULT_TEAM_LOGO;
const TREND_LINE_LIMIT = 8;

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

type TrendsPageProps = {
  initialDate: string;
};

const normalizeDashboardDate = (value: unknown): string | null => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : value;
};

// Trend-line legend/tooltip label: "F. Lastname" (TJ, 2026-11-06), so players who
// share a last name stay distinct; falls back to the id when metadata is missing.
const trendLegendName = (fullName: string | undefined, playerId: string | number) => {
  const parts = fullName?.trim().split(/\s+/) ?? [];
  if (parts.length === 0) return String(playerId);
  if (parts.length === 1) return parts[0];
  return `${parts[0].charAt(0)}. ${parts.slice(1).join(" ")}`;
};

type TrendTooltipEntry = { dataKey?: string | number; value?: number | string };

// Movement charts as a highlight chart: one line in focus (brand blue), the rest
// recessive grey, so eight series never read as spaghetti. The name buttons under
// the chart move the focus (hover previews it). Lines are straight: smoothing
// invented peaks and dips between games. Module-level so focus survives renders.
const TrendLineChart = ({
  data,
  keys,
  labelFor,
  ariaLabel,
  className
}: {
  data: Array<Record<string, number>>;
  keys: Array<string | number>;
  labelFor: (key: string) => string;
  ariaLabel: string;
  className: string;
}) => {
  const [focused, setFocused] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const keyList = keys.map(String);
  const active =
    preview ?? (focused && keyList.includes(focused) ? focused : keyList[0]);

  const renderTooltip = ({
    active: isActive,
    payload,
    label
  }: {
    active?: boolean;
    payload?: TrendTooltipEntry[];
    label?: string | number;
  }) => {
    if (!isActive || !payload?.length) return null;
    const rows = payload
      .filter((entry) => typeof entry.value === "number")
      .sort((a, b) => Number(b.value) - Number(a.value));
    return (
      <div className={styles.trendTooltip}>
        <p className={styles.trendTooltipTitle}>Game {label}</p>
        <ul>
          {rows.map((entry) => (
            <li
              key={String(entry.dataKey)}
              className={String(entry.dataKey) === active ? styles.trendTooltipActive : undefined}
            >
              <span>{labelFor(String(entry.dataKey))}</span>
              <span>{Math.round(Number(entry.value))}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <>
      <div
        className={`${className} ${styles.trendChart}`}
        role="img"
        aria-label={`${ariaLabel}. Highlighted: ${active ? labelFor(active) : "none"}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="gp" tickLine={false} />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={renderTooltip} />
            {keyList
              .filter((key) => key !== active)
              .map((key) => (
                <Line
                  key={key}
                  type="linear"
                  dataKey={key}
                  dot={false}
                  activeDot={false}
                  strokeWidth={1.5}
                  className={styles.trendLineMuted}
                  isAnimationActive={false}
                />
              ))}
            {active ? (
              <Line
                key={active}
                type="linear"
                dataKey={active}
                dot={false}
                activeDot={{ r: 4, className: styles.trendDotFocus }}
                strokeWidth={3}
                className={styles.trendLineFocus}
                isAnimationActive={false}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.trendLegend} role="group" aria-label="Highlight a line">
        {keyList.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={key === active}
            className={styles.trendLegendButton}
            onClick={() => setFocused(key)}
            onMouseEnter={() => setPreview(key)}
            onMouseLeave={() => setPreview(null)}
          >
            <span className={styles.trendLegendSwatch} aria-hidden="true" />
            {labelFor(key)}
          </button>
        ))}
      </div>
    </>
  );
};

const TrendsDashboardPage: NextPage<TrendsPageProps> = ({ initialDate }) => {
  const [date, setDate] = useState(initialDate ?? getTodayEt);
  const [projectionSource, setProjectionSource] = useState<"forge" | "legacy">(
    "forge"
  );
  const [teamCategory, setTeamCategory] = useState<TrendCategoryId>("offense");
  const [skaterCategory, setSkaterCategory] =
    useState<SkaterTrendCategoryId>("shotsPer60");
  const [goalieCategory, setGoalieCategory] =
    useState<GoalieTrendCategoryId>("savePct");
  const [activeTrendTab, setActiveTrendTab] = useState<
    "teams" | "skaters" | "goalies"
  >("teams");
  const [skaterPosition, setSkaterPosition] =
    useState<SkaterPositionGroup>("forward");
  const [skaterWindow, setSkaterWindow] = useState<SkaterWindowSize>(3);
  const [query, setQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlayerSearchRow[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [results, setResults] = useState<PlayerSearchRow[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const goalieShareRef = useRef<HTMLElement | null>(null);
  const [showGoalieShare, setShowGoalieShare] = useState(false);
  const router = useRouter();
  const {
    data,
    error,
    loadingSections,
    sectionErrors,
    retrySection
  } = useDashboardData({
    date,
    skaterPosition,
    skaterWindow
  });

  useEffect(() => {
    if (router.isReady === false) return;
    const queryDate = normalizeDashboardDate(router.query.date);
    if (queryDate && queryDate !== date) setDate(queryDate);
  }, [date, router.isReady, router.query.date]);

  useEffect(() => {
    const node = goalieShareRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShowGoalieShare(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShowGoalieShare(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const forgeRows = useMemo<ForgeProjectionRow[]>(() => {
    const raw = data?.forgePlayers?.data ?? [];
    const startChartSkaters = (data?.startChart?.players ?? []).filter(
      (row) => !(row as StartChartPlayer).positions?.includes("G")
    );
    const startChartMap = new Map<number, StartChartPlayer>();
    startChartSkaters.forEach((row) => {
      const player = row as StartChartPlayer;
      startChartMap.set(player.player_id, player);
    });

    const parsed = raw
      .map((row) => {
        const playerId = Number(row.player_id);
        const startRow = startChartMap.get(playerId);
        return {
          player_id: playerId,
          player_name: String(row.player_name ?? ""),
          team_name: String(row.team_name ?? ""),
          position: String(row.position ?? ""),
          g: Number(row.g ?? 0),
          a: Number(row.a ?? 0),
          pts: Number(row.pts ?? 0),
          ppp: Number(row.ppp ?? 0),
          sog: Number(row.sog ?? 0),
          hit: Number(row.hit ?? 0),
          blk: Number(row.blk ?? 0),
          opponent: startRow?.opponent_abbrev ?? null,
          gamesRemaining:
            startRow?.games_remaining_week !== undefined
              ? Number(startRow.games_remaining_week)
              : null,
          uncertainty:
            typeof row.uncertainty === "object" && row.uncertainty !== null
              ? (row.uncertainty as Record<string, unknown>)
              : null
        };
      })
      .filter((row) => row.player_id && row.player_name);
    return parsed.sort((a, b) => b.pts - a.pts).slice(0, 20);
  }, [data]);

  const legacyRows = useMemo<ForgeProjectionRow[]>(() => {
    const skaters = (data?.startChart?.players ?? [])
      .filter((row) => !(row as StartChartPlayer).positions?.includes("G"))
      .map((row) => row as StartChartPlayer);
    return skaters
      .map((row) => ({
        player_id: row.player_id,
        player_name: row.name,
        team_name: row.team_abbrev ?? "",
        position: row.positions?.[0] ?? "",
        g: row.proj_goals ?? 0,
        a: row.proj_assists ?? 0,
        pts:
          row.proj_goals != null && row.proj_assists != null
            ? row.proj_goals + row.proj_assists
            : (row.proj_fantasy_points ?? 0),
        ppp: row.proj_pp_points ?? 0,
        sog: row.proj_shots ?? 0,
        hit: row.proj_hits ?? 0,
        blk: row.proj_blocks ?? 0,
        opponent: row.opponent_abbrev ?? null,
        gamesRemaining: row.games_remaining_week ?? null
      }))
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 20);
  }, [data]);

  const projectionRows = projectionSource === "legacy" ? legacyRows : forgeRows;

  const goalieRows = useMemo<GoalieDisplayRow[]>(() => {
    if (!data) return [];
    const startChartGoalies = (data.startChart?.players ?? [])
      .filter((row) => (row as StartChartPlayer).positions?.includes("G"))
      .map((row) => row as StartChartPlayer);

    const startGoalieMap = new Map<number, StartChartPlayer>();
    startChartGoalies.forEach((row) => {
      startGoalieMap.set(row.player_id, row);
    });

    const forgeGoalies = (data.forgeGoalies?.data ?? []).map(
      (row) => row as ForgeGoalieRow
    );

    return forgeGoalies
      .map((row) => {
        const startRow = startGoalieMap.get(row.goalie_id);
        const teamMeta = getTeamMetaById(row.team_id);
        const oppMeta = getTeamMetaById(row.opponent_team_id);
        const team = startRow?.team_abbrev ?? teamMeta?.abbr ?? "—";
        const opponent = startRow?.opponent_abbrev ?? oppMeta?.abbr ?? "—";
        const startProb =
          startRow?.start_probability ?? row.starter_probability ?? null;
        return {
          goalieId: row.goalie_id,
          name: startRow?.name ?? `Goalie ${row.goalie_id}`,
          team,
          opponent,
          startProb,
          winProb: row.proj_win_prob ?? null,
          shutoutProb: row.proj_shutout_prob ?? null,
          uncertainty:
            typeof row.uncertainty === "object" && row.uncertainty !== null
              ? (row.uncertainty as Record<string, unknown>)
              : null
        };
      })
      .sort((a, b) => (b.startProb ?? 0) - (a.startProb ?? 0))
      .slice(0, 12);
  }, [data]);

  const visibleGoalieRows = useMemo(() => goalieRows.slice(0, 8), [goalieRows]);

  const visibleProjectionRows = useMemo(
    () => projectionRows.slice(0, 10),
    [projectionRows]
  );

  const teamTrendSeries = useMemo(() => {
    const category = data?.teamTrends?.categories?.[teamCategory];
    if (!category) return { series: [], teams: [] as string[] };
    const rankings = category.rankings ?? [];
    const topTeams = rankings.slice(0, TREND_LINE_LIMIT).map((row) => row.team);

    const series = category.series ?? {};
    const gpMap = new Map<number, Record<string, number>>();

    topTeams.forEach((team) => {
      const points = series[team] ?? [];
      points.forEach((point) => {
        if (!gpMap.has(point.gp)) gpMap.set(point.gp, {});
        gpMap.get(point.gp)![team] = point.percentile;
      });
    });

    const chartData = Array.from(gpMap.entries())
      .map(([gp, values]) => ({ gp, ...values }))
      .sort((a, b) => a.gp - b.gp);

    return { series: chartData, teams: topTeams };
  }, [data, teamCategory]);

  const normalizeName = (value: string) =>
    value
      .trim()
      .split(/\s+/)
      .map((chunk) => chunk[0]?.toUpperCase() + chunk.slice(1).toLowerCase())
      .join(" ");

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
        const { data: players, error: fetchError } = await (supabase as any)
          .from("players")
          .select("id, fullName, position, team_id")
          .ilike("fullName", `%${normalized}%`)
          .order("fullName", { ascending: true })
          .limit(8);

        if (fetchError) throw fetchError;

        const mapped = ((players as any[]) ?? []).map((row) => ({
          id: row.id,
          fullName: row.fullName,
          position: row.position,
          teamAbbrev:
            row.team_id != null
              ? (getTeamAbbreviationById(row.team_id) ?? null)
              : null
        })) as PlayerSearchRow[];

        setSuggestions(mapped);
        setShowSuggestions(mapped.length > 0);
        setActiveIndex(-1);
      } catch (err) {
        console.error(err);
        setSuggestions([]);
        setShowSuggestions(false);
        setActiveIndex(-1);
      }
    }, 200);

    return () => clearTimeout(handle);
  }, [query]);

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return;
    setSearchLoading(true);
    setSearchError(null);
    setResults([]);

    try {
      const normalized = normalizeName(trimmedQuery);
      const { data: players, error: fetchError } = await (supabase as any)
        .from("players")
        .select("id, fullName, position, team_id")
        .ilike("fullName", `%${normalized}%`)
        .order("fullName", { ascending: true })
        .limit(20);

      if (fetchError) throw fetchError;

      const mapped = ((players as any[]) ?? []).map((row) => ({
        id: row.id,
        fullName: row.fullName,
        position: row.position,
        teamAbbrev:
          row.team_id != null
            ? (getTeamAbbreviationById(row.team_id) ?? null)
            : null
      })) as PlayerSearchRow[];

      if (mapped.length === 1) {
        router.push(`/trends/player/${mapped[0].id}`);
        return;
      }

      if (mapped.length === 0) {
        setSearchError("No players found. Try another name.");
        return;
      }

      setResults(mapped);
    } catch (err: any) {
      console.error(err);
      setSearchError(err?.message ?? "Unexpected error searching players.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((idx) => Math.min(idx + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((idx) => Math.max(idx - 1, 0));
    } else if (event.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        event.preventDefault();
        const chosen = suggestions[activeIndex];
        router.push(`/trends/player/${chosen.id}`);
        setShowSuggestions(false);
      }
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  const skaterCategoryData = useMemo(() => {
    const categories = data?.skaterTrends?.categories ?? {};
    const category = categories[skaterCategory] as
      | SkaterCategoryResult
      | undefined;
    return {
      series: category?.series ?? {},
      rankings: category?.rankings ?? []
    };
  }, [data, skaterCategory]);

  const activeSkaterLabel = useMemo(() => {
    return (
      SKATER_TREND_CATEGORIES.find((category) => category.id === skaterCategory)
        ?.label ?? "Skater Rankings"
    );
  }, [skaterCategory]);

  const skaterSummaryCards = useMemo(
    () =>
      buildSkaterRecentSummaryCards({
        categories: data?.skaterTrends?.categories ?? {},
        playerMetadata: data?.skaterTrends?.playerMetadata ?? {},
        windowSize: skaterWindow
      }),
    [data, skaterWindow]
  );

  const skaterTrendSeries = useMemo(() => {
    const rankings = skaterCategoryData.rankings ?? [];
    const topPlayers = rankings
      .slice(0, TREND_LINE_LIMIT)
      .map((row) => String(row.playerId));
    const series = skaterCategoryData.series ?? {};
    const gpMap = new Map<number, Record<string, number>>();

    topPlayers.forEach((playerId) => {
      const points = series[playerId] ?? [];
      points.forEach((point) => {
        if (!gpMap.has(point.gp)) gpMap.set(point.gp, {});
        gpMap.get(point.gp)![playerId] = point.percentile;
      });
    });

    const chartData = Array.from(gpMap.entries())
      .map(([gp, values]) => ({ gp, ...values }))
      .sort((a, b) => a.gp - b.gp);

    return { series: chartData, players: topPlayers };
  }, [skaterCategoryData]);

  const teamTrendRankings = useMemo(
    () => data?.teamTrends?.categories?.[teamCategory]?.rankings ?? [],
    [data, teamCategory]
  );

  const teamMovementMovers = useMemo(() => {
    if (!data?.teamMeta) {
      return { improved: [], degraded: [] };
    }

    const improved = [...teamTrendRankings]
      .filter((row) => row.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 5)
      .map((row) => {
        const meta = data.teamMeta[row.team];
        return {
          id: row.team,
          name: meta?.shortName ?? row.team,
          logo: meta?.logo,
          delta: row.delta,
          current: row.percentile
        };
      });

    const degraded = [...teamTrendRankings]
      .filter((row) => row.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 5)
      .map((row) => {
        const meta = data.teamMeta[row.team];
        return {
          id: row.team,
          name: meta?.shortName ?? row.team,
          logo: meta?.logo,
          delta: row.delta,
          current: row.percentile
        };
      });

    return { improved, degraded };
  }, [data, teamTrendRankings]);

  const teamTemperature = useMemo(() => {
    const hot = [...teamTrendRankings]
      .filter((row) => row.percentile >= 70 || row.delta >= 2)
      .slice(0, 3);
    const cold = [...teamTrendRankings]
      .filter((row) => row.percentile <= 35 || row.delta <= -2)
      .sort((a, b) => a.percentile - b.percentile)
      .slice(0, 3);
    return { hot, cold };
  }, [teamTrendRankings]);

  const activeTeamCategory = useMemo(
    () =>
      TEAM_TREND_CATEGORIES.find((category) => category.id === teamCategory) ??
      TEAM_TREND_CATEGORIES[0],
    [teamCategory]
  );

  // The stat in its own unit with the percentile underneath; falls back to the
  // percentile alone when the stat is missing.
  const StatWithPercentile = ({
    stat,
    percentile
  }: {
    stat: { value: string; unit: string } | null;
    percentile: number;
  }) =>
    stat ? (
      <span className={styles.summaryLeaderStat}>
        <span className={styles.summaryLeaderValue}>
          {stat.value}
          <span className={styles.summaryLeaderUnit}>{stat.unit}</span>
        </span>
        <span className={styles.summaryLeaderPercentile}>
          {formatPercentileOrdinal(percentile)} pct
        </span>
      </span>
    ) : (
      <span className={styles.summaryLeaderValue}>{formatPercent(percentile)}</span>
    );

  // `rankMove` names the movement for readers ("Up 52 spots") where the delta is
  // a change in rank rather than in the stat beside it.
  const ArrowDelta = ({ delta, rankMove = false }: { delta: number; rankMove?: boolean }) => {
    const label = rankMove
      ? delta === 0
        ? "No change in rank"
        : `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)} spot${Math.abs(delta) === 1 ? "" : "s"} in rank`
      : undefined;
    if (delta === 0) {
      return (
        <span className={`${styles.delta} ${styles.deltaNeutral}`} title={label}>
          <span aria-hidden={label ? true : undefined}>—</span>
          {label && <span className={styles.srOnly}>{label}</span>}
        </span>
      );
    }
    const positive = delta > 0;
    const symbol = positive ? "▲" : "▼";
    const prefix = positive ? "+" : "";
    return (
      <span
        className={`${styles.delta} ${
          positive ? styles.deltaPositive : styles.deltaNegative
        }`}
        title={label}
      >
        <span aria-hidden={label ? true : undefined}>{symbol}</span>
        <span aria-hidden={label ? true : undefined}>
          {prefix}
          {delta}
        </span>
        {label && <span className={styles.srOnly}>{label}</span>}
      </span>
    );
  };

  // One ranking row for skaters and goalies: squircle headshot with the rank cut
  // into its top-left corner; name over team · position · rank move; the stat and
  // its percentile on the right; optional sample context underneath.
  const PlayerRankingRow = ({
    row,
    name,
    meta,
    stat,
    detail = null
  }: {
    row: TrendRankingRow;
    name: string;
    meta?: { teamAbbrev: string | null; position: string | null; imageUrl: string | null };
    stat: { value: string; unit: string } | null;
    detail?: string | null;
  }) => (
    <li className={styles.skaterRankingRow}>
      <div className={styles.rowAvatar}>
        <div className={styles.skaterHeadshotWrapper}>
          <Image
            src={meta?.imageUrl ?? DEFAULT_PLAYER_IMAGE}
            alt=""
            className={styles.skaterHeadshot}
            width={44}
            height={44}
            loading="lazy"
          />
        </div>
        <span
          className={`${styles.rankBadge} ${
            [styles.rankBadgeGold, styles.rankBadgeSilver, styles.rankBadgeBronze][row.rank - 1] ?? ""
          }`}
        >
          <span className={styles.srOnly}>Rank </span>
          {row.rank}
        </span>
      </div>
      <p className={styles.skaterName}>{name}</p>
      <p className={styles.skaterMeta}>
        <span>
          {meta?.teamAbbrev ?? "FA"}
          {meta?.position ? ` · ${meta.position}` : ""}
        </span>
        <ArrowDelta delta={row.delta} rankMove />
      </p>
      <div className={styles.rowStat}>
        <StatWithPercentile stat={stat} percentile={row.percentile} />
      </div>
      {detail ? <p className={styles.skaterDetail}>{detail}</p> : null}
    </li>
  );

  const SkaterRankingCard = ({
    rows
  }: {
    rows: TrendRankingRow[];
  }) => {
    const playerMetadata = data?.skaterTrends?.playerMetadata ?? {};

    return (
      <div className={styles.skaterRankingCard}>
        <div className={styles.rankingHeading}>
          <div className={styles.rankingTitle}>{activeSkaterLabel}</div>
          <p className={styles.rankingMeta}>Top percentile skaters</p>
        </div>
        {rows.length === 0 ? (
          <p className={styles.emptyText}>No skater data yet.</p>
        ) : (
          <ul className={styles.skaterRankingList} tabIndex={0} aria-label="Top percentile skaters">
            {rows.map((row) => {
              const meta = playerMetadata[String(row.playerId)];
              return (
                <PlayerRankingRow
                  key={row.playerId}
                  row={row}
                  name={meta?.fullName ?? `Player ${row.playerId}`}
                  meta={meta}
                  stat={formatRecentFormValue(skaterCategory, row.latestValue)}
                />
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  const goalieCategoryData = useMemo(() => {
    const category = data?.goalieTrends?.categories?.[goalieCategory];
    return {
      series: category?.series ?? {},
      rankings: category?.rankings ?? []
    };
  }, [data, goalieCategory]);

  const activeGoalieLabel = useMemo(() => {
    return (
      GOALIE_TREND_CATEGORIES.find((category) => category.id === goalieCategory)
        ?.label ?? "Goalie Rankings"
    );
  }, [goalieCategory]);

  const goalieTrendSeries = useMemo(() => {
    const rankings = goalieCategoryData.rankings ?? [];
    const topGoalies = rankings
      .slice(0, TREND_LINE_LIMIT)
      .map((row) => String(row.playerId));
    const series = goalieCategoryData.series ?? {};
    const gpMap = new Map<number, Record<string, number>>();

    topGoalies.forEach((playerId) => {
      const points = series[playerId] ?? [];
      points.forEach((point) => {
        if (!gpMap.has(point.gp)) gpMap.set(point.gp, {});
        gpMap.get(point.gp)![playerId] = point.percentile;
      });
    });

    const chartData = Array.from(gpMap.entries())
      .map(([gp, values]) => ({ gp, ...values }))
      .sort((a, b) => a.gp - b.gp);

    return { series: chartData, players: topGoalies };
  }, [goalieCategoryData]);

  const GoalieRankingCard = ({
    rows
  }: {
    rows: TrendRankingRow[];
  }) => {
    const playerMetadata = data?.goalieTrends?.playerMetadata ?? {};

    return (
      <div className={styles.skaterRankingCard}>
        <div className={styles.rankingHeading}>
          <div className={styles.rankingTitle}>{activeGoalieLabel}</div>
          <p className={styles.rankingMeta}>Top percentile goalies</p>
        </div>
        {rows.length === 0 ? (
          <p className={styles.emptyText}>No goalie data yet.</p>
        ) : (
          <ul className={styles.skaterRankingList} tabIndex={0} aria-label="Top percentile goalies">
            {rows.map((row) => {
              const meta = playerMetadata[String(row.playerId)];
              // Sample context on its own line so narrow cards don't crush the name.
              const detail = [
                row.confidence
                  ? `${row.confidence.charAt(0).toUpperCase()}${row.confidence.slice(1)} confidence · ${row.sampleSize ?? 0} GP`
                  : null,
                row.volatility !== null && row.volatility !== undefined
                  ? `volatility ${row.volatility.toFixed(1)}`
                  : null
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <PlayerRankingRow
                  key={row.playerId}
                  row={row}
                  name={meta?.fullName ?? `Goalie ${row.playerId}`}
                  meta={meta}
                  stat={formatGoalieTrendValue(goalieCategory, row.latestValue)}
                  detail={detail || null}
                />
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  const renderSectionNotice = (
    section: DashboardSection,
    label: string
  ) => {
    const sectionError = sectionErrors[section];
    if (!sectionError) return null;
    const updatedAt = data?.sectionUpdatedAt?.[section];
    const resolvedFor = data?.sectionResolvedFor?.[section];
    return (
      <div className={styles.sectionNotice} role="status">
        <span>
          {updatedAt
            ? `${label} refresh failed. Showing the last successful data from ${updatedAt.slice(0, 16).replace("T", " ")}${resolvedFor ? ` for ${resolvedFor}` : ""}.`
            : `${label} data is temporarily unavailable.`}
        </span>
        <button
          type="button"
          className={styles.retryButton}
          disabled={loadingSections.includes(section)}
          onClick={() => retrySection(section)}
        >
          {loadingSections.includes(section) ? "Retrying…" : `Retry ${label}`}
        </button>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>Trends Dashboard | FHFHockey</title>
        <meta
          name="description"
          content="Movement-first team, skater, and goalie trend reads with supporting projection and workload context."
        />
      </Head>
      <div className={styles.page}>
        <main className={styles.main}>
          <header className={styles.header}>
            <DashboardPillarHero
              title="Trends Dashboard"
              shortTitle="Trends"
              description={
                <p>Who&rsquo;s heating up and cooling off across teams, skaters and goalies.</p>
              }
              owns={[
                "Team, skater and goalie movement over the last few games",
                "Risers, fallers and who's running hot or cold",
                "Upcoming projections and goalie starts that follow the trends"
              ]}
              defers={[
                "Full team strength, process vs results and schedule: Underlying Stats",
                "Predictions vs actual and candlestick views: coming later",
                "Experimental sustainability and elasticity tools: Trends Sandbox"
              ]}
              surfaceLinks={TRENDS_SURFACE_LINKS.slice(0, 4)}
              // Player Search sits in the hero's side slot so the first row has no
              // empty band beside the hero (pass 6, 2026-11-06).
              actions={
                <div className={styles.searchPanel}>
                  <h2 className={styles.srOnly}>Player Search</h2>
                  <div className={styles.searchBoxButton}>
                    <form onSubmit={handleSearch} className={styles.searchForm}>
                      <div className={styles.searchInputWrap}>
                        <input
                          ref={inputRef}
                          type="text"
                          aria-label="Search players"
                          placeholder="Player name"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          onKeyDown={handleSearchKeyDown}
                          onFocus={() =>
                            setShowSuggestions(suggestions.length > 0)
                          }
                          onBlur={() =>
                            setTimeout(() => setShowSuggestions(false), 120)
                          }
                          className={styles.searchInput}
                        />
                        {showSuggestions && suggestions.length > 0 && (
                          <div className={styles.suggestionPanel}>
                            {suggestions.map((player, idx) => (
                              <button
                                key={player.id}
                                type="button"
                                className={`${styles.suggestionItem} ${
                                  idx === activeIndex ? styles.suggestionActive : ""
                                }`}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  router.push(`/trends/player/${player.id}`);
                                  setShowSuggestions(false);
                                }}
                              >
                                {player.fullName} · {player.teamAbbrev ?? "FA"} ·{" "}
                                {player.position ?? "—"}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="submit"
                        className={`${styles.primaryButton} ${styles.iconButton}`}
                        title="Find player"
                        aria-busy={searchLoading || undefined}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <circle cx="10.5" cy="10.5" r="6.5" />
                          <path d="M15.5 15.5 20 20" />
                        </svg>
                        <span className={styles.srOnly}>
                          {searchLoading ? "Searching…" : "Find player"}
                        </span>
                      </button>
                    </form>
                    {searchError && (
                      <p className={styles.errorText}>{searchError}</p>
                    )}
                    {!searchError && results.length > 0 && (
                      <div className={styles.searchResults}>
                        {results.map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() =>
                              router.push(`/trends/player/${player.id}`)
                            }
                            className={styles.resultButton}
                          >
                            {player.fullName} · {player.teamAbbrev ?? "FA"} ·{" "}
                            {player.position ?? "—"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              }
            />
            <div className={styles.headerRail}>
              <section className={styles.summaryBand}>
                <div className={styles.summaryBandHeader}>
                  <div>
                    <h2 className={styles.panelTitle}>Recent-Form Scan</h2>
                    <p className={styles.summaryBandCopy}>
                      Ice time, shots, power-play usage and chance creation over the last few games. Open a player for their full trend.
                    </p>
                  </div>
                  <div className={styles.summaryBandMeta}>
                    <span className={styles.panelMeta}>
                      Window {formatSkaterTrendWindowLabel(skaterWindow)}
                    </span>
                    <span className={styles.summaryContract}>
                      {describeLockedBaselines()}
                    </span>
                  </div>
                </div>

                <div className={styles.summaryBandGrid}>
                  {skaterSummaryCards.map((card) => (
                    <article key={card.categoryId} className={styles.summaryCard}>
                      <div className={styles.summaryCardHeader}>
                        <div>
                          <h3 className={styles.summaryCardTitle}>{card.label}</h3>
                          <p className={styles.summaryCardCopy}>
                            {card.description}
                          </p>
                        </div>
                        <span className={styles.summaryBadge}>
                          {card.windowLabel}
                        </span>
                      </div>
                      <ul className={styles.summaryLeaderList}>
                        {card.leaders.length === 0 ? (
                          <li className={styles.summaryEmpty}>
                            {/* Loading reads as loading, not as "no data". */}
                            {loadingSections.includes("skater") || !data?.skaterTrends
                              ? "Loading leaders…"
                              : "No leaders in this window yet."}
                          </li>
                        ) : (
                          card.leaders.map((leader) => (
                            <li
                              key={leader.playerId}
                              className={styles.summaryLeaderRow}
                            >
                              <div className={styles.summaryLeaderText}>
                                <Link
                                  href={`/trends/player/${leader.playerId}`}
                                  className={styles.summaryLeaderLink}
                                >
                                  {leader.fullName}
                                </Link>
                                <span className={styles.summaryLeaderMeta}>
                                  {leader.teamAbbrev ?? "FA"}
                                  {leader.position
                                    ? ` · ${leader.position}`
                                    : ""}
                                </span>
                              </div>
                              <div className={styles.summaryLeaderMetrics}>
                                <StatWithPercentile
                                  stat={formatRecentFormValue(card.categoryId, leader.latestValue)}
                                  percentile={leader.percentile}
                                />
                                <ArrowDelta delta={leader.delta} rankMove />
                              </div>
                            </li>
                          ))
                        )}
                      </ul>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </header>

          {error && (
            <p className={styles.errorText} role="alert">
              The dashboard refresh could not start. Existing section data remains
              available where possible.
            </p>
          )}

          {data?.recency?.status === "mixed" && (
            <div className={styles.sectionNotice} role="alert">
              <span>
                {data.recency.warning} Observed source-date gap: {data.recency.gapDays}
                days.
              </span>
              <span className={styles.panelMeta}>Mixed dates · downgraded</span>
            </div>
          )}

          <section className={`${styles.panel} ${styles.movementSection}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Movement Workspace</h2>
                <p className={styles.summaryBandCopy}>
                  Which teams, skaters and goalies are rising or falling, and by how much.
                </p>
              </div>
            </div>

            <div className={styles.movementSectionBody}>
              <div className={styles.topTabs} role="tablist" aria-label="Dataset">
                {(
                  [
                    { id: "teams", label: "Teams" },
                    { id: "skaters", label: "Skaters" },
                    { id: "goalies", label: "Goalies" }
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTrendTab === tab.id}
                    className={`${styles.tab} ${
                      activeTrendTab === tab.id ? styles.tabActive : ""
                    }`}
                    onClick={() => setActiveTrendTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTrendTab === "teams" ? (
                <div className={styles.movementTabPanel}>
                  <div className={styles.workspaceIntro}>
                    <div>
                      <div className={styles.chartTitle}>
                        Team Directionality: {activeTeamCategory.label}
                      </div>
                      <p className={styles.chartCopy}>
                        {activeTeamCategory.description}.
                      </p>
                    </div>
                    <div className={styles.chartMetaStack}>
                      <div className={styles.panelMeta}>
                        Rolling percentile by games played
                      </div>
                      <div className={styles.panelMeta}>
                        {data?.teamTrends?.generatedAt
                          ? `Source updated ${data.teamTrends.generatedAt.slice(0, 10)}`
                          : "Source update unavailable"}
                      </div>
                    </div>
                  </div>

                  <div className={styles.subTabs} aria-label="Team categories">
                    {TEAM_TREND_CATEGORIES.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        className={`${styles.subTab} ${
                          teamCategory === category.id ? styles.subTabActive : ""
                        }`}
                        aria-pressed={teamCategory === category.id}
                        onClick={() => setTeamCategory(category.id)}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>

                  {renderSectionNotice("team", "Team trends")}
                  {sectionErrors.team && teamTrendSeries.series.length === 0 ? (
                    // The section notice above already explains the failure and offers a retry.
                    null
                  ) : teamTrendSeries.series.length === 0 &&
                    loadingSections.includes("team") ? (
                    <p className={styles.loadingText}>
                      Loading team directionality…
                    </p>
                  ) : teamTrendSeries.series.length === 0 ? (
                    <p className={styles.emptyText}>No team trend history yet.</p>
                  ) : (
                    <div className={styles.teamWorkspaceGrid}>
                      <div className={styles.chartCard}>
                        <div className={styles.temperatureStrip}>
                          <div className={styles.temperatureCard}>
                            <span className={styles.temperatureLabel}>
                              Heating Up
                            </span>
                            <div className={styles.temperatureList}>
                              {teamTemperature.hot.length === 0
                                ? "No clear heaters yet."
                                : teamTemperature.hot
                                    .map((row) => row.team)
                                    .join(" · ")}
                            </div>
                          </div>
                          <div className={styles.temperatureCard}>
                            <span className={styles.temperatureLabel}>
                              Cooling Off
                            </span>
                            <div className={styles.temperatureList}>
                              {teamTemperature.cold.length === 0
                                ? "No clear coolers yet."
                                : teamTemperature.cold
                                    .map((row) => row.team)
                                    .join(" · ")}
                            </div>
                          </div>
                        </div>
                        {loadingSections.includes("team") && (
                          <p className={styles.refreshText}>
                            Refreshing team trends…
                          </p>
                        )}
                        <TrendLineChart
                          className={styles.chartBody}
                          ariaLabel={`${activeTeamCategory.label} team percentile trend lines by games played`}
                          data={teamTrendSeries.series}
                          keys={teamTrendSeries.teams}
                          labelFor={(team) => team}
                        />
                        <div className={styles.teamRankStrip}>
                          {teamTrendRankings.slice(0, 5).map((row) => (
                            <div key={row.team} className={styles.teamRankCard}>
                              <span className={styles.teamRankLabel}>
                                <img
                                  src={data?.teamMeta?.[row.team]?.logo ?? DEFAULT_TEAM_LOGO}
                                  alt=""
                                  width={20}
                                  height={20}
                                  loading="lazy"
                                  className={styles.teamRankLogo}
                                  onError={(event) => {
                                    event.currentTarget.src = DEFAULT_TEAM_LOGO;
                                  }}
                                />
                                {row.team}
                              </span>
                              <span className={styles.teamRankValue}>
                                {formatPercent(row.percentile)}
                              </span>
                              <ArrowDelta delta={row.delta} />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={styles.workspaceRail}>
                        <section
                          className={`${styles.panel} ${styles.workspaceRailPanel}`}
                        >
                          <div className={styles.panelHeader}>
                            <h3 className={styles.panelTitle}>
                              Team Risers And Fallers
                            </h3>
                            <span className={styles.panelMeta}>
                              {activeTeamCategory.label}
                            </span>
                          </div>
                          <div className={styles.panelBody}>
                            {teamMovementMovers.improved.length === 0 &&
                            teamMovementMovers.degraded.length === 0 &&
                            loadingSections.includes("team") ? (
                              <p className={styles.loadingText}>
                                Loading team movers…
                              </p>
                            ) : teamMovementMovers.improved.length === 0 &&
                              teamMovementMovers.degraded.length === 0 ? (
                              <p className={styles.emptyText}>
                                No team mover data yet.
                              </p>
                            ) : (
                              <TopMovers
                                improved={teamMovementMovers.improved}
                                degraded={teamMovementMovers.degraded}
                              />
                            )}
                          </div>
                        </section>

                      </div>
                    </div>
                  )}
                </div>
              ) : activeTrendTab === "skaters" ? (
                <div className={styles.movementTabPanel}>
                  <div className={styles.workspaceIntro}>
                    <div>
                      <div className={styles.chartTitle}>
                        Skater Movement: {activeSkaterLabel}
                      </div>
                      <p className={styles.chartCopy}>
                        Rising and falling skaters by recent form.
                      </p>
                    </div>
                    <div className={styles.chartMetaStack}>
                      <div className={styles.panelMeta}>
                        Window {formatSkaterTrendWindowLabel(skaterWindow)}
                      </div>
                      <div className={styles.panelMeta}>
                        {skaterPosition === "all"
                          ? "All skaters"
                          : skaterPosition === "forward"
                            ? "Forwards only"
                            : "Defense only"}
                      </div>
                    </div>
                  </div>

                  <div className={styles.subTabs} aria-label="Skater categories">
                    {SKATER_TREND_CATEGORIES.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        className={`${styles.subTab} ${
                          skaterCategory === category.id
                            ? styles.subTabActive
                            : ""
                        }`}
                        aria-pressed={skaterCategory === category.id}
                        onClick={() => setSkaterCategory(category.id)}
                      >
                        {category.label}
                      </button>
                    ))}
                    <div className={styles.skaterControls}>
                      <div
                        className={styles.windowToggle}
                        aria-label="Skater position group"
                      >
                        {(
                          ["forward", "defense", "all"] as SkaterPositionGroup[]
                        ).map((group) => (
                          <button
                            key={group}
                            type="button"
                            className={`${styles.windowButton} ${
                              skaterPosition === group
                                ? styles.windowActive
                                : ""
                            }`}
                            aria-pressed={skaterPosition === group}
                            onClick={() => setSkaterPosition(group)}
                          >
                            {group === "all"
                              ? "All"
                              : group === "forward"
                                ? "Forwards"
                                : "Defense"}
                          </button>
                        ))}
                      </div>
                      <div
                        className={styles.windowToggle}
                        aria-label="Skater window size"
                      >
                        {(SKATER_WINDOW_OPTIONS as readonly SkaterWindowSize[]).map(
                          (windowSize) => (
                            <button
                              key={windowSize}
                              type="button"
                              className={`${styles.windowButton} ${
                                skaterWindow === windowSize
                                  ? styles.windowActive
                                  : ""
                              }`}
                              aria-pressed={skaterWindow === windowSize}
                              onClick={() => setSkaterWindow(windowSize)}
                            >
                              {windowSize} GP
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  {renderSectionNotice("skater", "Skater trends")}
                  {sectionErrors.skater && skaterTrendSeries.series.length === 0 ? (
                    // The section notice above already explains the failure and offers a retry.
                    null
                  ) : skaterTrendSeries.series.length === 0 &&
                    loadingSections.includes("skater") ? (
                    <p className={styles.loadingText}>Loading skater trends…</p>
                  ) : skaterTrendSeries.series.length === 0 ? (
                    <p className={styles.emptyText}>
                      No skater trend history yet.
                    </p>
                  ) : (
                    <div className={styles.trendGrid}>
                      <SkaterRankingCard rows={skaterCategoryData.rankings} />
                      <div className={styles.chartCard}>
                        <div className={styles.rankingHeading}>
                          <div className={styles.rankingTitle}>
                            Trend Lines
                          </div>
                          <p className={styles.rankingMeta}>
                            Recent percentile movement for the current skater
                            lens.
                          </p>
                        </div>
                        {loadingSections.includes("skater") && (
                          <p className={styles.refreshText}>
                            Refreshing skater trends…
                          </p>
                        )}
                        <TrendLineChart
                          className={styles.chartFill}
                          ariaLabel={`${activeSkaterLabel} skater percentile trend lines by games played`}
                          data={skaterTrendSeries.series}
                          keys={skaterTrendSeries.players}
                          labelFor={(id) =>
                            trendLegendName(data?.skaterTrends?.playerMetadata?.[id]?.fullName, id)
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.movementTabPanel}>
                  <div className={styles.workspaceIntro}>
                    <div>
                      <div className={styles.chartTitle}>
                        Goalie Movement: {activeGoalieLabel}
                      </div>
                      <p className={styles.chartCopy}>
                        Rising and falling goalies by recent form.
                      </p>
                    </div>
                    <div className={styles.chartMetaStack}>
                      <div className={styles.panelMeta}>
                        Window {formatSkaterTrendWindowLabel(skaterWindow)}
                      </div>
                    </div>
                  </div>

                  <div className={styles.subTabs} aria-label="Goalie categories">
                    {GOALIE_TREND_CATEGORIES.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        className={`${styles.subTab} ${
                          goalieCategory === category.id
                            ? styles.subTabActive
                            : ""
                        }`}
                        aria-pressed={goalieCategory === category.id}
                        onClick={() => setGoalieCategory(category.id)}
                      >
                        {category.label}
                      </button>
                    ))}
                    <div className={styles.skaterControls}>
                      <div
                        className={styles.windowToggle}
                        aria-label="Goalie window size"
                      >
                        {(SKATER_WINDOW_OPTIONS as readonly SkaterWindowSize[]).map(
                          (windowSize) => (
                            <button
                              key={windowSize}
                              type="button"
                              className={`${styles.windowButton} ${
                                skaterWindow === windowSize
                                  ? styles.windowActive
                                  : ""
                              }`}
                              aria-pressed={skaterWindow === windowSize}
                              onClick={() => setSkaterWindow(windowSize)}
                            >
                              {windowSize} GP
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  {renderSectionNotice("goalie", "Goalie trends")}
                  {sectionErrors.goalie && goalieTrendSeries.series.length === 0 ? (
                    // The section notice above already explains the failure and offers a retry.
                    null
                  ) : goalieTrendSeries.series.length === 0 &&
                    loadingSections.includes("goalie") ? (
                    <p className={styles.loadingText}>Loading goalie trends…</p>
                  ) : goalieTrendSeries.series.length === 0 ? (
                    <p className={styles.emptyText}>
                      No goalie trend history yet.
                    </p>
                  ) : (
                    <div className={styles.trendGrid}>
                      <GoalieRankingCard rows={goalieCategoryData.rankings} />
                      <div className={styles.chartCard}>
                        <div className={styles.rankingHeading}>
                          <div className={styles.rankingTitle}>
                            Trend Lines
                          </div>
                          <p className={styles.rankingMeta}>
                            Recent percentile movement for the current goalie
                            lens.
                          </p>
                        </div>
                        {loadingSections.includes("goalie") && (
                          <p className={styles.refreshText}>
                            Refreshing goalie trends…
                          </p>
                        )}
                        <TrendLineChart
                          className={styles.chartFill}
                          ariaLabel={`${activeGoalieLabel} goalie percentile trend lines by games played`}
                          data={goalieTrendSeries.series}
                          keys={goalieTrendSeries.players}
                          labelFor={(id) =>
                            trendLegendName(data?.goalieTrends?.playerMetadata?.[id]?.fullName, id)
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className={styles.surfaceBridgeStrip}>
            <article className={styles.surfaceBridgeCard}>
              <span className={styles.surfaceBridgeLabel}>Team deep dive</span>
              <h2 className={styles.panelTitle}>Underlying Stats</h2>
              <p className={styles.summaryBandCopy}>
                Explain a team&rsquo;s movement with process stats and schedule context.
              </p>
              <Link href="/underlying-stats" className={styles.surfaceLinkPill}>
                Open Underlying Stats
              </Link>
            </article>

            <article className={styles.surfaceBridgeCard}>
              <span className={styles.surfaceBridgeLabel}>Next games</span>
              <h2 className={styles.panelTitle}>Projections And Starts</h2>
              <p className={styles.summaryBandCopy}>
                Upcoming projections and likely goalie starts.
              </p>
              <div className={styles.surfaceLinkList}>
                <a href="#projections" className={styles.surfaceLinkPill}>
                  Projections
                </a>
                <a href="#goalie-starts" className={styles.surfaceLinkPill}>
                  Goalie Starts
                </a>
              </div>
            </article>

            <article className={styles.surfaceBridgeCard}>
              <span className={styles.surfaceBridgeLabel}>Experimental</span>
              <h2 className={styles.panelTitle}>Sustainability Lab</h2>
              <p className={styles.summaryBandCopy}>
                Experimental sustainability and elasticity tools.
              </p>
              <Link href="/trendsSandbox" className={styles.surfaceLinkPill}>
                Open Trends Sandbox
              </Link>
            </article>
          </section>

          <section className={styles.supportSection}>
            <div className={styles.summaryBandHeader}>
              <div>
                <h2 className={styles.panelTitle}>Upcoming Games</h2>
                <p className={styles.summaryBandCopy}>
                  Projections and goalie starts for the next slate.
                </p>
              </div>
              <div className={styles.summaryBandMeta}>
                <span className={styles.summaryContract}>
                  Coming next: predictions vs actual and candlestick views
                </span>
              </div>
            </div>

            <div className={styles.supportGrid}>
              <section
                id="projections"
                className={`${styles.panel} ${styles.supportPanel}`}
              >
                <div className={styles.panelHeader}>
                  {/* The FORGE / Legacy toggle beside the title names the source. */}
                  <h2 className={styles.panelTitle}>Projections</h2>
                  {data?.recency?.status === "mixed" && (
                    <span className={styles.panelMeta}>Context downgraded</span>
                  )}
                  <div className={styles.tabRow}>
                    <button
                      type="button"
                      onClick={() => setProjectionSource("forge")}
                      aria-pressed={projectionSource === "forge"}
                      className={styles.tabButton}
                    >
                      FORGE
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectionSource("legacy")}
                      aria-pressed={projectionSource === "legacy"}
                      className={styles.tabButton}
                    >
                      Legacy
                    </button>
                  </div>
                </div>
                <div className={styles.panelBody} tabIndex={0} role="region" aria-label="Projections table">
                  <p className={styles.summaryBandCopy}>
                    Projected points and shots for upcoming games.
                  </p>
                  {renderSectionNotice("projection", "Projections")}
                  {sectionErrors.projection && projectionRows.length === 0 ? (
                    <p className={styles.errorText}>
                      Projection data is unavailable.
                    </p>
                  ) : projectionRows.length === 0 &&
                    loadingSections.includes("projection") ? (
                    <p className={styles.loadingText}>Loading projections…</p>
                  ) : projectionRows.length === 0 ? (
                    <p className={styles.emptyText}>
                      No projections available for this date.
                    </p>
                  ) : (
                    <>
                      {loadingSections.includes("projection") && (
                        <p className={styles.refreshText}>
                          Refreshing projections…
                        </p>
                      )}
                      <table className={styles.table}>
                        <caption className={styles.srOnly}>
                          Projection leaders for {date}
                        </caption>
                        <thead>
                          <tr>
                            <th className={styles.thLeft}>Player</th>
                            <th className={`${styles.thLeft} ${styles.hideOnPhone}`}>Team</th>
                            <th className={styles.thLeft}>Pos</th>
                            <th className={styles.thLeft}>Opp</th>
                            <th className={styles.thRight}>GR</th>
                            <th className={styles.thRight}>PTS</th>
                            <th className={styles.thRight}>SOG</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleProjectionRows.map((row) => (
                            <tr key={row.player_id}>
                              <td className={styles.tdLeft}>{row.player_name}</td>
                              <td className={`${styles.tdLeft} ${styles.hideOnPhone}`}>
                                {row.team_name}
                              </td>
                              <td className={styles.tdLeft}>{row.position}</td>
                              <td className={styles.tdLeft}>
                                {row.opponent ?? "—"}
                              </td>
                              <td className={styles.tdRight}>
                                {row.gamesRemaining ?? "—"}
                              </td>
                              <td className={styles.tdRight}>
                                {row.pts.toFixed(2)}
                              </td>
                              <td className={styles.tdRight}>
                                {row.sog.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              </section>

              <section
                id="goalie-starts"
                className={`${styles.panel} ${styles.supportPanel}`}
              >
                <div className={styles.panelHeader}>
                  <h2 className={styles.panelTitle}>Goalie Starts</h2>
                  <span className={styles.panelMeta}>
                    {data?.recency?.status === "mixed"
                      ? "Downgraded"
                      : visibleGoalieRows.length
                        ? `Top ${visibleGoalieRows.length}`
                        : null}
                  </span>
                </div>
                <div className={styles.panelBody} tabIndex={0} role="region" aria-label="Goalie starts table">
                  <p className={styles.summaryBandCopy}>
                    Start, win and shutout chances for the next slate.
                  </p>
                  {renderSectionNotice("schedule", "Goalie starts")}
                  {sectionErrors.schedule && goalieRows.length === 0 ? (
                    <p className={styles.errorText}>
                      Goalie start data is unavailable.
                    </p>
                  ) : goalieRows.length === 0 &&
                    loadingSections.includes("schedule") ? (
                    <p className={styles.loadingText}>Loading goalie starts…</p>
                  ) : goalieRows.length === 0 ? (
                    <p className={styles.emptyText}>
                      No goalie start data available for this date.
                    </p>
                  ) : (
                    <>
                      {loadingSections.includes("schedule") && (
                        <p className={styles.refreshText}>
                          Refreshing goalie starts…
                        </p>
                      )}
                      <table className={styles.table}>
                        <caption className={styles.srOnly}>
                          Goalie start leaders for {date}
                        </caption>
                        <thead>
                          <tr>
                            <th className={styles.thLeft}>Goalie</th>
                            <th className={styles.thLeft}>Matchup</th>
                            <th className={styles.thRight}>Start</th>
                            <th className={styles.thRight}>Win</th>
                            <th className={styles.thRight}>SO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleGoalieRows.map((row) => (
                            <tr key={row.goalieId}>
                              <td className={styles.tdLeft}>{row.name}</td>
                              <td className={`${styles.tdLeft} ${styles.noWrap}`}>
                                {row.team} vs {row.opponent}
                              </td>
                              <td className={styles.tdRight}>
                                {row.startProb !== null
                                  ? `${(row.startProb * 100).toFixed(0)}%`
                                  : "—"}
                              </td>
                              <td className={styles.tdRight}>
                                {row.winProb !== null
                                  ? `${(row.winProb * 100).toFixed(0)}%`
                                  : "—"}
                              </td>
                              <td className={styles.tdRight}>
                                {row.shutoutProb !== null
                                  ? `${(row.shutoutProb * 100).toFixed(0)}%`
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              </section>

            </div>
          </section>

          <section
            ref={goalieShareRef}
            className={`${styles.panel} ${styles.goalieSharePanel}`}
          >
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Goalie Workload Share</h2>
            </div>
            <div className={styles.goalieShareBody}>
              <p className={styles.summaryBandCopy}>
                How each team splits its starts between goalies.
              </p>
              {showGoalieShare ? (
                <GoalieShareChart />
              ) : (
                <p className={styles.loadingText}>
                  Goalie workload chart loads when this section enters view.
                </p>
              )}
            </div>
          </section>
        </main>
      </div>
    </>
  );
};

export default TrendsDashboardPage;

export const getServerSideProps: GetServerSideProps<
  TrendsPageProps
> = async ({ query }) => {
  const date = normalizeDashboardDate(query.date) ?? getTodayEt();
  return {
    props: {
      initialDate: date
    }
  };
};
