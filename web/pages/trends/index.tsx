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
  DEFERRED_PLAYER_BASELINE_NOTE,
  LOCKED_PLAYER_BASELINES,
  buildSkaterRecentSummaryCards,
  formatSkaterTrendWindowLabel
} from "lib/trends/trendsSurface";
import { useRouter } from "next/router";
import supabase from "lib/supabase";
import { getTeamAbbreviationById } from "lib/teamsInfo";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend
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

const CHART_COLORS = ["#2563eb", "#16a34a", "#f97316", "#ef4444", "#8b5cf6"];

const getChartColor = (index: number): string =>
  CHART_COLORS[index % CHART_COLORS.length];

const DEFAULT_TEAM_LOGO = "/teamLogos/default.png";
const DEFAULT_PLAYER_IMAGE = DEFAULT_TEAM_LOGO;
const TREND_LINE_LIMIT = 8;

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

type TrendsPageProps = {
  initialDate: string;
};

const TrendsDashboardPage: NextPage<TrendsPageProps> = ({ initialDate }) => {
  const [date] = useState(initialDate ?? getTodayEt);
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
  const router = useRouter();
  const { data, error, isLoading } = useDashboardData({
    date,
    skaterPosition,
    skaterWindow
  });

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

  const ArrowDelta = ({ delta }: { delta: number }) => {
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
        <span>{symbol}</span>
        <span>
          {prefix}
          {delta}
        </span>
      </span>
    );
  };

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
                        alt={meta?.fullName ?? `Goalie ${row.playerId}`}
                        className={styles.skaterHeadshot}
                        width={42}
                        height={42}
                        loading="lazy"
                      />
                    </div>
                    <div className={styles.skaterText}>
                      <p className={styles.skaterName}>
                        {meta?.fullName ?? `Goalie ${row.playerId}`}
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
              eyebrow="Recent-form pillar"
              title="Trends Dashboard"
              description={
                <p>
                  Use this page to read movement fast across teams, skaters, and
                  goalies. Underlying-stats still owns deeper team diagnosis;
                  this surface owns directionality, recent form, risers,
                  fallers, and the support context around those shifts.
                </p>
              }
              emphasis="Movement and directionality"
              owns={[
                "Team, skater, and goalie movement views with rolling recent-form context",
                "Risers, fallers, and hot/cold states before you drill deeper",
                "Projection and goalie-start runway that supports the movement read"
              ]}
              defers={[
                "Full team-strength reads, process-vs-results diagnosis, and schedule texture",
                "Predictions-vs-actual and candlestick views until the model contracts harden",
                "Experimental elasticity-band and sustainability prototypes that still belong in the lab"
              ]}
              surfaceLinks={TRENDS_SURFACE_LINKS.slice(0, 4)}
            />
            <div className={styles.headerRail}>
              <div className={styles.searchPanel}>
                <div className={styles.panelHeader}>
                  <h2 className={styles.panelTitle}>Player Search</h2>
                  <span className={styles.panelMeta}>Trends lookup</span>
                </div>
                <div className={styles.searchBoxButton}>
                  <form onSubmit={handleSearch} className={styles.searchForm}>
                    <div className={styles.searchInputWrap}>
                      <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search by player name"
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
                    <button type="submit" className={styles.primaryButton}>
                      {searchLoading ? "Searching…" : "Find Player"}
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

              <section className={styles.summaryBand}>
                <div className={styles.summaryBandHeader}>
                  <div>
                    <h2 className={styles.panelTitle}>Recent-Form Scan</h2>
                    <p className={styles.summaryBandCopy}>
                      Scan deployment, shot pressure, PP usage, and chance
                      creation before drilling into a player trend page.
                    </p>
                  </div>
                  <div className={styles.summaryBandMeta}>
                    <span className={styles.panelMeta}>
                      Window {formatSkaterTrendWindowLabel(skaterWindow)}
                    </span>
                    <span className={styles.summaryContract}>
                      Strong v1 baselines:{" "}
                      {LOCKED_PLAYER_BASELINES.map((baseline) => baseline.label).join(
                        ", "
                      )}
                      .
                    </span>
                    <span className={styles.summaryContract}>
                      {DEFERRED_PLAYER_BASELINE_NOTE}
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
                            No recent trend leaders yet.
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
                                <span className={styles.summaryLeaderValue}>
                                  {formatPercent(leader.percentile)}
                                </span>
                                <ArrowDelta delta={leader.delta} />
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

          <section className={`${styles.panel} ${styles.movementSection}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Movement Workspace</h2>
                <p className={styles.summaryBandCopy}>
                  One working surface for directionality, entity movers, and
                  the immediate follow-up context once a trend is identified.
                </p>
              </div>
              <div className={styles.movementHeaderMeta}>
                <span className={styles.panelMeta}>Date {date}</span>
                <span className={styles.panelMeta}>
                  Teams, skaters, and goalies
                </span>
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
                        {activeTeamCategory.description}. Stay at the movement
                        layer here, then hand off to deeper surfaces only after
                        the trend is clear.
                      </p>
                    </div>
                    <div className={styles.chartMetaStack}>
                      <div className={styles.panelMeta}>
                        Rolling percentile by games played
                      </div>
                      <div className={styles.panelMeta}>
                        Recent directionality first
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

                  {error && teamTrendSeries.series.length === 0 ? (
                    <p className={styles.errorText}>
                      Failed to load team trends: {error.message}
                    </p>
                  ) : teamTrendSeries.series.length === 0 && isLoading ? (
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
                        {isLoading && (
                          <p className={styles.refreshText}>
                            Refreshing team trends…
                          </p>
                        )}
                        <div className={styles.chartBody}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={teamTrendSeries.series}>
                              <XAxis dataKey="gp" />
                              <YAxis domain={[0, 100]} />
                              <Tooltip />
                              <Legend />
                              {teamTrendSeries.teams.map((team, idx) => (
                                <Line
                                  key={team}
                                  type="monotone"
                                  dataKey={team}
                                  dot={false}
                                  stroke={getChartColor(idx)}
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className={styles.teamRankStrip}>
                          {teamTrendRankings.slice(0, 5).map((row) => (
                            <div key={row.team} className={styles.teamRankCard}>
                              <span className={styles.teamRankLabel}>
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
                            isLoading ? (
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

                        <section
                          className={`${styles.panel} ${styles.workspaceRailPanel}`}
                        >
                          <div className={styles.panelHeader}>
                            <h3 className={styles.panelTitle}>Next Surface</h3>
                            <span className={styles.panelMeta}>
                              Handoff points
                            </span>
                          </div>
                          <div className={styles.panelBody}>
                            <p className={styles.summaryBandCopy}>
                              Use deeper team diagnosis or sustainability only
                              after the movement read is complete.
                            </p>
                            <div className={styles.surfaceLinkList}>
                              <Link
                                href="/underlying-stats"
                                className={styles.surfaceLinkPill}
                              >
                                Open Underlying Stats
                              </Link>
                              <a
                                href="#projections"
                                className={styles.surfaceLinkPill}
                              >
                                Projection Runway
                              </a>
                              <Link
                                href="/trendsSandbox"
                                className={styles.surfaceLinkPill}
                              >
                                Open Trends Sandbox
                              </Link>
                            </div>
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
                        Find risers, fallers, and hot recent-form skaters before
                        handing off to player detail, projections, or later
                        model work.
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

                  {error && skaterTrendSeries.series.length === 0 ? (
                    <p className={styles.errorText}>
                      Failed to load skater trends: {error.message}
                    </p>
                  ) : skaterTrendSeries.series.length === 0 && isLoading ? (
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
                        {isLoading && (
                          <p className={styles.refreshText}>
                            Refreshing skater trends…
                          </p>
                        )}
                        <ResponsiveContainer width="100%" height={260}>
                          <LineChart data={skaterTrendSeries.series}>
                            <XAxis dataKey="gp" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Legend />
                            {skaterTrendSeries.players.map((playerId, idx) => (
                              <Line
                                key={playerId}
                                type="monotone"
                                dataKey={playerId}
                                dot={false}
                                stroke={getChartColor(idx)}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
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
                        Track recent goalie movement first, then use start
                        runway and workload context as the follow-up layer.
                      </p>
                    </div>
                    <div className={styles.chartMetaStack}>
                      <div className={styles.panelMeta}>
                        Window {formatSkaterTrendWindowLabel(skaterWindow)}
                      </div>
                      <div className={styles.panelMeta}>
                        Efficiency and workload movement
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

                  {error && goalieTrendSeries.series.length === 0 ? (
                    <p className={styles.errorText}>
                      Failed to load goalie trends: {error.message}
                    </p>
                  ) : goalieTrendSeries.series.length === 0 && isLoading ? (
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
                        {isLoading && (
                          <p className={styles.refreshText}>
                            Refreshing goalie trends…
                          </p>
                        )}
                        <ResponsiveContainer width="100%" height={260}>
                          <LineChart data={goalieTrendSeries.series}>
                            <XAxis dataKey="gp" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Legend />
                            {goalieTrendSeries.players.map((playerId, idx) => (
                              <Line
                                key={playerId}
                                type="monotone"
                                dataKey={playerId}
                                dot={false}
                                stroke={getChartColor(idx)}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className={styles.surfaceBridgeStrip}>
            <article className={styles.surfaceBridgeCard}>
              <span className={styles.surfaceBridgeLabel}>Deep team read</span>
              <h2 className={styles.panelTitle}>Underlying Stats</h2>
              <p className={styles.summaryBandCopy}>
                Hand off here when movement needs explanation, schedule texture,
                or team-level process context.
              </p>
              <Link href="/underlying-stats" className={styles.surfaceLinkPill}>
                Open Underlying Stats
              </Link>
            </article>

            <article className={styles.surfaceBridgeCard}>
              <span className={styles.surfaceBridgeLabel}>Immediate support</span>
              <h2 className={styles.panelTitle}>Projection And Starts</h2>
              <p className={styles.summaryBandCopy}>
                Use runway and goalie-start support after the movement read, not
                before it.
              </p>
              <div className={styles.surfaceLinkList}>
                <a href="#projections" className={styles.surfaceLinkPill}>
                  Projection Runway
                </a>
                <a href="#goalie-starts" className={styles.surfaceLinkPill}>
                  Goalie Starts
                </a>
              </div>
            </article>

            <article className={styles.surfaceBridgeCard}>
              <span className={styles.surfaceBridgeLabel}>Experimental layer</span>
              <h2 className={styles.panelTitle}>Sustainability Lab</h2>
              <p className={styles.summaryBandCopy}>
                Keep elasticity bands, sustainability meters, and prototype
                baselines in the lab until the contracts harden.
              </p>
              <Link href="/trendsSandbox" className={styles.surfaceLinkPill}>
                Open Trends Sandbox
              </Link>
            </article>
          </section>

          <section className={styles.supportSection}>
            <div className={styles.summaryBandHeader}>
              <div>
                <h2 className={styles.panelTitle}>Supporting Runway</h2>
                <p className={styles.summaryBandCopy}>
                  These modules support the movement read. They should inform
                  the next decision after the trend is identified, not obscure
                  the trend scan itself.
                </p>
              </div>
              <div className={styles.summaryBandMeta}>
                <span className={styles.panelMeta}>
                  Projections and start context
                </span>
                <span className={styles.summaryContract}>
                  Predictions-vs-actual and candlestick views are explicitly
                  held for a later implementation pass.
                </span>
              </div>
            </div>

            <div className={styles.supportGrid}>
              <section
                id="projections"
                className={`${styles.panel} ${styles.supportPanel}`}
              >
                <div className={styles.panelHeader}>
                  <h2 className={styles.panelTitle}>
                    Projection Runway ({projectionSource.toUpperCase()})
                  </h2>
                  <div className={styles.tabRow}>
                    <button
                      type="button"
                      onClick={() => setProjectionSource("forge")}
                      disabled={projectionSource === "forge"}
                      className={styles.tabButton}
                    >
                      FORGE
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectionSource("legacy")}
                      disabled={projectionSource === "legacy"}
                      className={styles.tabButton}
                    >
                      Legacy
                    </button>
                  </div>
                </div>
                <div className={styles.panelBody}>
                  <p className={styles.summaryBandCopy}>
                    Use this after the movement read to see who still has slate
                    runway.
                  </p>
                  {error && projectionRows.length === 0 ? (
                    <p className={styles.errorText}>
                      Failed to load projections: {error.message}
                    </p>
                  ) : projectionRows.length === 0 && isLoading ? (
                    <p className={styles.loadingText}>Loading projections…</p>
                  ) : projectionRows.length === 0 ? (
                    <p className={styles.emptyText}>
                      No projections available for this date.
                    </p>
                  ) : (
                    <>
                      {isLoading && (
                        <p className={styles.refreshText}>
                          Refreshing projections…
                        </p>
                      )}
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th className={styles.thLeft}>Player</th>
                            <th className={styles.thLeft}>Team</th>
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
                              <td className={styles.tdLeft}>{row.team_name}</td>
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
                  <h2 className={styles.panelTitle}>Goalie Start Runway</h2>
                  <span className={styles.panelMeta}>Top 8</span>
                </div>
                <div className={styles.panelBody}>
                  <p className={styles.summaryBandCopy}>
                    Start probability, win runway, and shutout ceiling to
                    support the goalie movement view.
                  </p>
                  {error && goalieRows.length === 0 ? (
                    <p className={styles.errorText}>
                      Failed to load goalie starts: {error.message}
                    </p>
                  ) : goalieRows.length === 0 && isLoading ? (
                    <p className={styles.loadingText}>Loading goalie starts…</p>
                  ) : goalieRows.length === 0 ? (
                    <p className={styles.emptyText}>
                      No goalie start data available for this date.
                    </p>
                  ) : (
                    <>
                      {isLoading && (
                        <p className={styles.refreshText}>
                          Refreshing goalie starts…
                        </p>
                      )}
                      <table className={styles.table}>
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
                              <td className={styles.tdLeft}>
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

              <section className={`${styles.panel} ${styles.placeholderPanel}`}>
                <div className={styles.panelHeader}>
                  <h2 className={styles.panelTitle}>Predictions Vs Actual</h2>
                  <span className={styles.panelMeta}>Later implementation</span>
                </div>
                <div className={styles.placeholderBody}>
                  <p className={styles.summaryBandCopy}>
                    Reserved for model expectation against realized results once
                    the accuracy contract is promoted into the Trends route.
                  </p>
                  <ul className={styles.placeholderList}>
                    <li>Expected vs realized team trend movement</li>
                    <li>Skater and goalie hit-rate framing</li>
                    <li>Model drift by rolling window</li>
                  </ul>
                </div>
              </section>

              <section className={`${styles.panel} ${styles.placeholderPanel}`}>
                <div className={styles.panelHeader}>
                  <h2 className={styles.panelTitle}>Candlestick Trend View</h2>
                  <span className={styles.panelMeta}>Later implementation</span>
                </div>
                <div className={styles.placeholderBody}>
                  <p className={styles.summaryBandCopy}>
                    Reserved for the candlestick format once open, close, range,
                    and expectation overlays are finalized for each entity
                    class.
                  </p>
                  <ul className={styles.placeholderList}>
                    <li>Team percentile candles</li>
                    <li>Skater metric candles</li>
                    <li>Goalie efficiency and workload candles</li>
                  </ul>
                </div>
              </section>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.goalieSharePanel}`}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Goalie Workload Share</h2>
              <span className={styles.panelMeta}>L10 to season</span>
            </div>
            <div className={styles.goalieShareBody}>
              <p className={styles.summaryBandCopy}>
                Use the existing goalie-share chart here as the workload context
                companion to the goalie starts table.
              </p>
              <GoalieShareChart />
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
> = async () => {
  const date = getTodayEt();
  return {
    props: {
      initialDate: date
    }
  };
};
