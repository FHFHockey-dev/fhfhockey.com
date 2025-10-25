import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import supabase from "lib/supabase";
import { teamsInfo } from "lib/teamsInfo";
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
  Tooltip
} from "recharts";
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

const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const DEFAULT_TEAM_LOGO = "/teamLogos/default.png";

const emptyCategoryResult: CategoryResult = {
  series: {},
  rankings: []
};

const CATEGORY_ORDER: TrendCategoryId[] = [
  "offense",
  "defense",
  "penaltyKill",
  "powerPlay"
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
      {symbol} {prefix}
      {delta}
    </span>
  );
}

function CategoryChartCard({
  config,
  result
}: {
  config: TrendCategoryDefinition;
  result: CategoryResult;
}) {
  const hasData = Object.keys(result.series || {}).length > 0;
  const topTeams = new Set(result.rankings.slice(0, 5).map((row) => row.team));
  const { dataset, teamKeys } = hasData
    ? buildChartDataset(result.series)
    : { dataset: [], teamKeys: [] };
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);

  const handleChartMouseMove = (state: any) => {
    const payload = state?.activePayload;
    if (payload && payload.length > 0) {
      const teamKey = payload[0]?.dataKey;
      if (teamKey) {
        setHoveredTeam(teamKey);
      }
    } else if (hoveredTeam) {
      setHoveredTeam(null);
    }
  };

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
    const [{ dataKey, value }] = payload;
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

  return (
    <div className={styles.chartCard}>
      <div>
        <p className={styles.chartHeading}>{config.label}</p>
        <p className={styles.chartDescription}>{config.description}</p>
      </div>
      {hasData && dataset.length > 0 ? (
        <div className={styles.chartShell}>
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart
              data={dataset}
              onMouseMove={handleChartMouseMove}
              onMouseLeave={() => setHoveredTeam(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="gp"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                label={{
                  value: "GP",
                  position: "insideBottomRight",
                  offset: -6,
                  fill: "#94a3b8",
                  fontSize: 11
                }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                width={30}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: "#475569", strokeDasharray: "4 2" }}
              />
              {teamKeys.map((team) => {
                const teamInfo = teamsInfo[team as keyof typeof teamsInfo];
                const stroke = teamInfo?.primaryColor ?? "#94a3b8";
                const highlight = hoveredTeam
                  ? hoveredTeam === team
                  : topTeams.has(team);
                return (
                  <Line
                    key={team}
                    type="linear"
                    dataKey={team}
                    stroke={stroke}
                    strokeWidth={highlight ? 2.4 : 1}
                    strokeOpacity={highlight ? 1 : 0.15}
                    dot={{
                      r: highlight ? 3 : 1.5,
                      fill: stroke,
                      strokeWidth: 0
                    }}
                    activeDot={{
                      r: 4,
                      fill: stroke,
                      strokeWidth: 0
                    }}
                    isAnimationActive={false}
                    onMouseEnter={() => setHoveredTeam(team)}
                    onMouseLeave={() => setHoveredTeam(null)}
                  />
                );
              })}
            </ReLineChart>
          </ResponsiveContainer>
        </div>
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
        <p className={styles.rankingTitle}>{config.label} Power</p>
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
                  <span className={styles.rank}>{row.rank}.</span>
                  <img
                    src={`/teamLogos/${row.team}.png`}
                    alt={`${row.team} logo`}
                    className={styles.teamLogo}
                    loading="lazy"
                    onError={handleLogoError}
                  />
                  <div className={styles.nameBlock}>
                    <p className={styles.teamAbbr}>{row.team}</p>
                  </div>
                </div>
                <div className={styles.scoreCell}>
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

export default function TrendsIndexPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PlayerListItem[]>([]);
  const [suggestions, setSuggestions] = useState<PlayerListItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const [teamTrends, setTeamTrends] = useState<TeamTrendsResponse | null>(null);
  const [teamTrendsLoading, setTeamTrendsLoading] = useState(true);
  const [teamTrendsError, setTeamTrendsError] = useState<string | null>(null);

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
  }, [query]);

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

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>Sustainability Trends</h1>
        <p className={styles.heroSubtitle}>
          Search for an NHL skater or explore team-wide power metrics.
        </p>

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

      <section className={styles.teamSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Team Power Trends</h2>
            <p className={styles.sectionSubtitle}>
              Percentile trajectories by game played across four strengths.
            </p>
          </div>
          <p className={styles.sectionTimestamp}>
            {teamTrends?.generatedAt
              ? `Updated ${new Date(teamTrends.generatedAt).toLocaleString()}`
              : ""}
          </p>
        </div>
        {teamTrendsError && (
          <div className={styles.teamError}>{teamTrendsError}</div>
        )}
        {teamTrendsLoading ? (
          <div className={styles.teamLoading}>
            Loading team percentile trends…
          </div>
        ) : (
          <div className={styles.dashboardGrid}>
            <div className={styles.chartGrid}>
              {CATEGORY_ORDER.map((categoryId) => {
                const category = CATEGORY_CONFIG_MAP[categoryId];
                return (
                  <CategoryChartCard
                    key={category.id}
                    config={category}
                    result={
                      teamTrends?.categories?.[categoryId] ??
                      emptyCategoryResult
                    }
                  />
                );
              })}
            </div>
            <div className={styles.rankingGrid}>
              {CATEGORY_ORDER.map((categoryId) => {
                const category = CATEGORY_CONFIG_MAP[categoryId];
                return (
                  <RankingTable
                    key={`${category.id}-ranking`}
                    config={category}
                    result={
                      teamTrends?.categories?.[categoryId] ??
                      emptyCategoryResult
                    }
                  />
                );
              })}
            </div>
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
