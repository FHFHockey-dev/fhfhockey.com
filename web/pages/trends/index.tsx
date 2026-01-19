import { useEffect, useMemo, useRef, useState } from "react";
import type { GetServerSideProps, NextPage } from "next";
import Head from "next/head";
import { useDashboardData } from "hooks/useDashboardData";
import type { DashboardData } from "lib/dashboard/dataFetchers";
import TopMovers from "components/TopMovers/TopMovers";
import { getTeamMetaById } from "lib/dashboard/teamMetadata";
import {
  TEAM_TREND_CATEGORIES,
  type TrendCategoryId
} from "lib/trends/teamMetricConfig";
import {
  SKATER_TREND_CATEGORIES,
  type SkaterTrendCategoryId,
  type SkaterPositionGroup,
  type SkaterWindowSize
} from "lib/trends/skaterMetricConfig";
import { useRouter } from "next/router";
import supabase from "lib/supabase";
import { getTeamAbbreviationById } from "lib/teamsInfo";
import { fetchTeamRatings, type TeamRating } from "lib/teamRatingsService";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Brush,
  Legend
} from "recharts";
import styles from "./dashboard.module.scss";

type TeamPowerRow = {
  teamAbbr: string;
  teamName: string;
  powerScore: number;
  ctpiScore: number | null;
  sosScore: number | null;
};

type SparkPoint = { date: string; value: number };

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

const SPECIAL_TEAM_STEP = 1.5;
const computePowerScore = (rating: {
  offRating: number;
  defRating: number;
  paceRating: number;
  ppTier: number;
  pkTier: number;
}): number => {
  const base = (rating.offRating + rating.defRating + rating.paceRating) / 3;
  const ppAdj = (3 - rating.ppTier) * SPECIAL_TEAM_STEP;
  const pkAdj = (3 - rating.pkTier) * SPECIAL_TEAM_STEP;
  return base + ppAdj + pkAdj;
};

const formatOptional = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(1);
};

const renderSparkline = (points: SparkPoint[]) => {
  if (!points || points.length === 0) return "—";
  const series = points.slice(-10);
  const values = series.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 0.5;
    max += 0.5;
  }
  const range = max - min || 1;
  const line = series
    .map((p, i) => {
      const x = series.length === 1 ? 0 : (i / (series.length - 1)) * 100;
      const y = 30 - ((p.value - min) / range) * 24;
      return `${x},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" width={120} height={32}>
      <polyline points={line} fill="none" stroke="#2d6cdf" strokeWidth={2} />
    </svg>
  );
};

const formatUncertaintyBand = (
  uncertainty: Record<string, unknown> | null | undefined,
  keys: string[],
  formatAsPercent = false
): string => {
  if (!uncertainty) return "—";
  for (const key of keys) {
    const candidate = uncertainty[key] as
      | { p10?: number; p90?: number }
      | undefined;
    if (
      candidate &&
      typeof candidate.p10 === "number" &&
      typeof candidate.p90 === "number"
    ) {
      const p10 = formatAsPercent ? candidate.p10 * 100 : candidate.p10;
      const p90 = formatAsPercent ? candidate.p90 * 100 : candidate.p90;
      const suffix = formatAsPercent ? "%" : "";
      return `${p10.toFixed(2)}${suffix}–${p90.toFixed(2)}${suffix}`;
    }
  }
  return "—";
};

const CHART_COLORS = ["#2563eb", "#16a34a", "#f97316", "#ef4444", "#8b5cf6"];

const getChartColor = (index: number): string =>
  CHART_COLORS[index % CHART_COLORS.length];

type TrendsPageProps = {
  initialDate: string;
  initialTeamRatings: TeamRating[];
};

const TrendsDashboardPage: NextPage<TrendsPageProps> = ({
  initialDate,
  initialTeamRatings
}) => {
  const [date] = useState(initialDate ?? getTodayEt);
  const [projectionSource, setProjectionSource] = useState<"forge" | "legacy">(
    "forge"
  );
  const [teamCategory, setTeamCategory] = useState<TrendCategoryId>("offense");
  const [skaterCategory, setSkaterCategory] =
    useState<SkaterTrendCategoryId>("shotsPer60");
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

  const teamRows = useMemo<TeamPowerRow[]>(() => {
    const ratings = data?.teamRatings ?? initialTeamRatings;
    if (!ratings || ratings.length === 0) return [];
    const ctpiTeams = data?.teamCtpi?.teams ?? [];
    const sosTeams = data?.teamSos?.teams ?? [];
    const metaIndex = data?.teamMeta ?? {};

    const ctpiMap = new Map(
      ctpiTeams.map((row) => [row.team, row.ctpi_0_to_100])
    );
    const sosMap = new Map(sosTeams.map((row) => [row.team, row.sosScore]));

    return ratings
      .map((rating) => {
        const meta = metaIndex[rating.teamAbbr];
        return {
          teamAbbr: rating.teamAbbr,
          teamName: meta?.name ?? rating.teamAbbr,
          powerScore: computePowerScore(rating),
          ctpiScore: ctpiMap.get(rating.teamAbbr) ?? null,
          sosScore: sosMap.get(rating.teamAbbr) ?? null
        };
      })
      .sort((a, b) => b.powerScore - a.powerScore);
  }, [data, initialTeamRatings]);

  const visibleTeamRows = useMemo(() => teamRows.slice(0, 12), [teamRows]);

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

  const ratingMap = useMemo(() => {
    const map = new Map<string, DashboardData["teamRatings"][number]>();
    const ratings = data?.teamRatings ?? [];
    ratings.forEach((row) => {
      map.set(row.teamAbbr, row);
    });
    return map;
  }, [data]);

  const teamTrendSeries = useMemo(() => {
    const category = data?.teamTrends?.categories?.[teamCategory];
    if (!category) return { series: [], teams: [] as string[] };
    const rankings = category.rankings ?? [];
    const topTeams = rankings.slice(0, 5).map((row) => row.team);

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

  const skaterTrendSeries = useMemo(() => {
    const categories = data?.skaterTrends?.categories ?? {};
    const category = categories[skaterCategory] as
      | {
          series?: Record<string, Array<{ gp: number; percentile: number }>>;
          rankings?: Array<{ playerId: number }>;
        }
      | undefined;
    if (!category) return { series: [], players: [] as string[] };

    const rankings = category.rankings ?? [];
    const topPlayers = rankings.slice(0, 5).map((row) => String(row.playerId));
    const series = category.series ?? {};
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
  }, [data, skaterCategory]);

  const ctpiMovers = useMemo(() => {
    if (!data?.teamCtpi?.teams || !data.teamMeta) {
      return { improved: [], degraded: [] };
    }
    const deltas = data.teamCtpi.teams
      .map((team) => {
        const spark = team.sparkSeries ?? [];
        if (spark.length < 2) return null;
        const window = spark.slice(-5);
        if (window.length < 2) return null;
        const delta = window[window.length - 1].value - window[0].value;
        const meta = data.teamMeta[team.team];
        return {
          id: team.team,
          name: meta?.shortName ?? team.team,
          logo: meta?.logo,
          delta,
          current: team.ctpi_0_to_100
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const improved = [...deltas].sort((a, b) => b.delta - a.delta).slice(0, 5);
    const degraded = [...deltas].sort((a, b) => a.delta - b.delta).slice(0, 5);
    return { improved, degraded };
  }, [data]);

  const ctpiSparkRows = useMemo(() => {
    if (!data?.teamCtpi?.teams) return [];
    return [...data.teamCtpi.teams]
      .sort((a, b) => (b.ctpi_0_to_100 ?? 0) - (a.ctpi_0_to_100 ?? 0))
      .slice(0, 5)
      .map((row) => {
        const meta = data.teamMeta?.[row.team];
        return {
          team: row.team,
          name: meta?.shortName ?? row.team,
          ctpi: row.ctpi_0_to_100,
          spark: row.sparkSeries ?? []
        };
      });
  }, [data]);

  return (
    <>
      <Head>
        <title>FHFH Dashboard | FHFHockey</title>
        <meta
          name="description"
          content="Unified FORGE, Trends, and Start Chart dashboard."
        />
      </Head>
      <div className={styles.page}>
        <main className={styles.main}>
          <header className={styles.header}>
            <div className={styles.trendsHeaderSection}>
              <h1 className={styles.title}>Trends Dashboard</h1>
              <p className={styles.subtitle}>
                Sustainability dashboard, team power, and player trends.
              </p>
            </div>
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
                      onFocus={() => setShowSuggestions(suggestions.length > 0)}
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
          </header>

          <div className={styles.grid}>
            <section id="team-power" className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Team Power</h2>
                <span className={styles.panelMeta}>Top 12 snapshot</span>
              </div>
              <div className={styles.panelBody}>
                {error && teamRows.length === 0 ? (
                  <p className={styles.errorText}>
                    Failed to load team power: {error.message}
                  </p>
                ) : teamRows.length === 0 && isLoading ? (
                  <p className={styles.loadingText}>
                    Loading team power snapshot…
                  </p>
                ) : teamRows.length === 0 ? (
                  <p className={styles.emptyText}>
                    No team power data for the selected date.
                  </p>
                ) : (
                  <>
                    {isLoading && (
                      <p className={styles.refreshText}>
                        Refreshing team power…
                      </p>
                    )}
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.thLeft}>Team</th>
                          <th className={styles.thRight}>Power</th>
                          <th className={styles.thRight}>CTPI</th>
                          <th className={styles.thRight}>SOS</th>
                          <th className={styles.thLeft}>Comp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleTeamRows.map((row) => {
                          const rating = ratingMap.get(row.teamAbbr);
                          return (
                            <tr key={row.teamAbbr}>
                              <td className={styles.tdLeft}>
                                {row.teamName} ({row.teamAbbr})
                              </td>
                              <td className={styles.tdRight}>
                                {row.powerScore.toFixed(1)}
                              </td>
                              <td className={styles.tdRight}>
                                {row.ctpiScore !== null
                                  ? row.ctpiScore.toFixed(1)
                                  : "—"}
                              </td>
                              <td className={styles.tdRight}>
                                {row.sosScore !== null
                                  ? row.sosScore.toFixed(1)
                                  : "—"}
                              </td>
                              <td className={styles.tdLeft}>
                                F {formatOptional(rating?.finishingRating)} · G{" "}
                                {formatOptional(rating?.goalieRating)} · D{" "}
                                {formatOptional(rating?.dangerRating)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>CTPI Movers</h2>
                <span className={styles.panelMeta}>Last 5 GP</span>
              </div>
              <div className={styles.panelBody}>
                {ctpiMovers.improved.length === 0 && isLoading ? (
                  <p className={styles.loadingText}>Loading CTPI movers…</p>
                ) : ctpiMovers.improved.length === 0 ? (
                  <p className={styles.emptyText}>No CTPI mover data yet.</p>
                ) : (
                  <TopMovers
                    improved={ctpiMovers.improved}
                    degraded={ctpiMovers.degraded}
                  />
                )}
              </div>
            </section>

            <section id="projections" className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>
                  Projections ({projectionSource.toUpperCase()})
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

            <section id="goalie-starts" className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Goalie Starts</h2>
                <span className={styles.panelMeta}>Top 8</span>
              </div>
              <div className={styles.panelBody}>
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

            <section id="team-trends" className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Team Trends</h2>
                <div className={styles.tabRow}>
                  {TEAM_TREND_CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setTeamCategory(category.id)}
                      disabled={teamCategory === category.id}
                      className={styles.tabButton}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.panelBody}>
                {error && teamTrendSeries.series.length === 0 ? (
                  <p className={styles.errorText}>
                    Failed to load team trends: {error.message}
                  </p>
                ) : teamTrendSeries.series.length === 0 && isLoading ? (
                  <p className={styles.loadingText}>Loading trend charts…</p>
                ) : teamTrendSeries.series.length === 0 ? (
                  <p className={styles.emptyText}>No trend history yet.</p>
                ) : (
                  <>
                    {isLoading && (
                      <p className={styles.refreshText}>
                        Refreshing trend charts…
                      </p>
                    )}
                    <ResponsiveContainer width="100%" height={220}>
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
                  </>
                )}
              </div>
            </section>

            <section id="skater-trends" className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Skater Trends</h2>
                <div className={styles.tabRow}>
                  {SKATER_TREND_CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSkaterCategory(category.id)}
                      disabled={skaterCategory === category.id}
                      className={styles.tabButton}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.tabRow}>
                  {(["forward", "defense", "all"] as SkaterPositionGroup[]).map(
                    (group) => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => setSkaterPosition(group)}
                        disabled={skaterPosition === group}
                        className={styles.tabButton}
                      >
                        {group === "all"
                          ? "All"
                          : group === "forward"
                            ? "Forwards"
                            : "Defense"}
                      </button>
                    )
                  )}
                  {([1, 3, 5, 10] as SkaterWindowSize[]).map((windowSize) => (
                    <button
                      key={windowSize}
                      type="button"
                      onClick={() => setSkaterWindow(windowSize)}
                      disabled={skaterWindow === windowSize}
                      className={styles.tabButton}
                    >
                      {windowSize} GP
                    </button>
                  ))}
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
                  <>
                    {isLoading && (
                      <p className={styles.refreshText}>
                        Refreshing skater trends…
                      </p>
                    )}
                    <ResponsiveContainer width="100%" height={220}>
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
                  </>
                )}
              </div>
            </section>
          </div>
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
  const initialTeamRatings = await fetchTeamRatings(date);
  return {
    props: {
      initialDate: date,
      initialTeamRatings
    }
  };
};
