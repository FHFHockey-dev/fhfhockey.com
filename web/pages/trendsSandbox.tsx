import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { format } from "date-fns";
import supabase from "lib/supabase/client";
import type { Database } from "lib/supabase/database-generated.types";
import type {
  ChartPoint,
  GameLogRow,
  PlayerOption,
  RollingWindowOption,
  SeasonSummary,
  StreakSegment,
  TrendDataBundle
} from "lib/trends/types";
import { buildTrendData, winsorize } from "lib/trends/utils";
import styles from "./trends/sandbox.module.scss";

type SkaterTotalsRow =
  Database["public"]["Tables"]["wgo_skater_stats_totals"]["Row"];
type GameLogCountsRow =
  Database["public"]["Tables"]["nst_gamelog_as_counts"]["Row"];
type WgoSkaterRow = Database["public"]["Tables"]["wgo_skater_stats"]["Row"];
type RosterRow = Database["public"]["Tables"]["rosters"]["Row"];
type GameRow = Database["public"]["Tables"]["games"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];

type SupabaseError = { message: string };

const ROLLING_WINDOWS: RollingWindowOption[] = [
  { label: "3-game", value: 3 },
  { label: "5-game", value: 5 },
  { label: "10-game", value: 10 }
];

const MIN_SEARCH_LENGTH = 2;

function formatSeasonLabel(season: string): string {
  if (season.length !== 8) return season;
  return `${season.slice(0, 4)}-${season.slice(4)}`;
}

async function searchPlayersByName(query: string): Promise<PlayerOption[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, fullName, position")
    .ilike("fullName", `%${query}%`)
    .limit(40);

  if (error) throw error as SupabaseError;

  return (
    (data as PlayerRow[] | null)?.map((row) => ({
      id: Number(row.id),
      name: (row as any).fullName ?? "Unknown",
      position: (row as any).position ?? null
    })) ?? []
  ).slice(0, 12);
}

async function fetchPlayerSeasons(playerId: number): Promise<SeasonSummary[]> {
  const { data, error } = await supabase
    .from("wgo_skater_stats_totals")
    .select("season, goals, assists, points, games_played, points_per_game")
    .eq("player_id", playerId)
    .order("season", { ascending: false });

  if (error) throw error as SupabaseError;

  return (
    (data as SkaterTotalsRow[] | null)?.map((row) => ({
      season: row.season,
      goals: row.goals,
      assists: row.assists,
      points: row.points,
      gamesPlayed: row.games_played,
      pointsPerGame: row.points_per_game
    })) ?? []
  );
}

async function fetchSeasonGameLog(
  playerId: number,
  season: string
): Promise<GameLogRow[]> {
  const seasonNumeric = Number(season);
  if (!Number.isFinite(seasonNumeric)) return [];

  // Compute season window (NHL year runs roughly Jul 1 to Jul 1)
  const startYear = Number(String(season).slice(0, 4));
  const endYear = Number(String(season).slice(4));
  const startDateStr = `${startYear}-07-01`;
  const endDateStr = `${endYear}-07-01`;

  // Strict server-side date window filter plus player filter
  const { data, error } = await supabase
    .from("wgo_skater_stats")
    .select(
      "date, points, goals, assists, games_played, season_id, shots, hits, blocked_shots, pp_points"
    )
    .eq("player_id", playerId)
    .gte("date", startDateStr)
    .lt("date", endDateStr)
    .gt("games_played", 0)
    .order("date", { ascending: true });

  if (error) throw error as SupabaseError;

  const rows = (data as WgoSkaterRow[] | null) ?? [];

  // Dev: sanity check
  if (process.env.NODE_ENV !== "production") {
    const count = rows.length;
    const minD = rows[0]?.date ?? null;
    const maxD = rows.at(-1)?.date ?? null;
    // eslint-disable-next-line no-console
    console.debug(
      `[Trends] Loaded ${count} games for season ${season} between ${startDateStr} and ${endDateStr}`,
      {
        minDate: minD,
        maxDate: maxD
      }
    );
  }

  return rows.map((row) => ({
    date: (row as any).date?.toString() ?? "",
    totalPoints: (row as any).points ?? 0,
    goals: (row as any).goals ?? 0,
    totalAssists: (row as any).assists ?? 0,
    shots: (row as any).shots ?? 0,
    hits: (row as any).hits ?? 0,
    blocks: (row as any).blocked_shots ?? 0,
    ppPoints: (row as any).pp_points ?? 0
  }));
}

async function fetchPlayerScheduleDates(
  playerId: number,
  season: string
): Promise<Date[]> {
  const seasonNumeric = Number(season);
  if (!Number.isFinite(seasonNumeric)) return [];

  // Teams the player was rostered on for this season
  const { data: roster, error: rosterError } = await supabase
    .from("rosters")
    .select("teamId")
    .eq("playerId", playerId)
    .eq("seasonId", seasonNumeric);
  if (rosterError) throw rosterError as SupabaseError;
  const teamIds = Array.from(
    new Set(((roster as RosterRow[] | null) ?? []).map((r) => r.teamId))
  ).filter(Boolean) as number[];

  if (teamIds.length === 0) return [];

  const inList = teamIds.join(",");
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("date, homeTeamId, awayTeamId")
    .eq("seasonId", seasonNumeric)
    .or(`homeTeamId.in.(${inList}),awayTeamId.in.(${inList})`)
    .order("date", { ascending: true });
  if (gamesError) throw gamesError as SupabaseError;

  const uniqueIso = Array.from(
    new Set(
      ((games as GameRow[] | null) ?? [])
        .map((g) => g.date)
        .filter(Boolean)
        .map((d) => d!.slice(0, 10))
    )
  ).sort();

  return uniqueIso.map((iso) => new Date(iso));
}

const INITIAL_TREND: TrendDataBundle = {
  baseline: 0,
  chartPoints: [],
  streaks: []
};

function HotColdStreakChartPlaceholder() {
  return (
    <div className={styles.chartPlaceholder}>
      <p>Select a player and season to view the streak chart.</p>
    </div>
  );
}

export default function TrendsSandboxPage() {
  const [playerQuery, setPlayerQuery] = useState("");
  const [playerResults, setPlayerResults] = useState<PlayerOption[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerOption | null>(
    null
  );

  const [seasonSummaries, setSeasonSummaries] = useState<SeasonSummary[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);

  const [gameLogRows, setGameLogRows] = useState<GameLogRow[]>([]);
  const [rollingWindow, setRollingWindow] = useState<number>(5);
  const [scheduleDates, setScheduleDates] = useState<Date[]>([]);
  const [snapToSchedule, setSnapToSchedule] = useState<boolean>(true);

  const [searchingPlayers, setSearchingPlayers] = useState(false);
  const [loadingSeasonData, setLoadingSeasonData] = useState(false);
  const [loadingGameLog, setLoadingGameLog] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (playerQuery.trim().length < MIN_SEARCH_LENGTH) {
      setPlayerResults([]);
      return;
    }

    let isCancelled = false;
    setSearchingPlayers(true);

    const handle = setTimeout(async () => {
      try {
        const results = await searchPlayersByName(playerQuery.trim());
        if (!isCancelled) {
          setPlayerResults(results);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error(err);
          setErrorMessage("Unable to search players right now.");
        }
      } finally {
        if (!isCancelled) setSearchingPlayers(false);
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(handle);
    };
  }, [playerQuery]);

  useEffect(() => {
    if (!selectedPlayer) return;
    let ignore = false;

    async function loadSeasons() {
      setLoadingSeasonData(true);
      setSeasonSummaries([]);
      setSelectedSeason(null);
      try {
        const pid = selectedPlayer!.id; // guarded above
        const seasons = await fetchPlayerSeasons(pid);
        if (!ignore) {
          setSeasonSummaries(seasons);
          setSelectedSeason(seasons[0]?.season ?? null);
        }
      } catch (err) {
        if (!ignore) {
          console.error(err);
          setErrorMessage("Failed to load season summaries.");
        }
      } finally {
        if (!ignore) setLoadingSeasonData(false);
      }
    }

    loadSeasons();
    return () => {
      ignore = true;
    };
  }, [selectedPlayer?.id]);

  useEffect(() => {
    if (!selectedPlayer || !selectedSeason) {
      setGameLogRows([]);
      setScheduleDates([]);
      return;
    }

    let aborted = false;

    async function loadGameLog() {
      setLoadingGameLog(true);
      try {
        const pid = selectedPlayer!.id; // guarded above
        const seasonStr = selectedSeason as string; // guarded above
        const games = await fetchSeasonGameLog(pid, seasonStr);
        if (!aborted) {
          setGameLogRows(games);
        }
      } catch (err) {
        if (!aborted) {
          console.error(err);
          setErrorMessage("Failed to load game log data.");
          setGameLogRows([]);
        }
      } finally {
        if (!aborted) setLoadingGameLog(false);
      }
    }

    loadGameLog();
    return () => {
      aborted = true;
    };
  }, [selectedPlayer?.id, selectedSeason]);

  // Load team schedule dates for this player-season; used to infer missed games
  useEffect(() => {
    if (!selectedPlayer || !selectedSeason) {
      setScheduleDates([]);
      return;
    }
    let aborted = false;
    (async () => {
      try {
        const dates = await fetchPlayerScheduleDates(
          selectedPlayer.id,
          selectedSeason
        );
        if (!aborted) setScheduleDates(dates);
      } catch (err) {
        if (!aborted) {
          console.error("Failed to fetch schedule dates", err);
          setScheduleDates([]);
        }
      }
    })();
    return () => {
      aborted = true;
    };
  }, [selectedPlayer?.id, selectedSeason]);

  const selectedSeasonSummary = useMemo(
    () =>
      seasonSummaries.find((summary) => summary.season === selectedSeason) ??
      null,
    [seasonSummaries, selectedSeason]
  );

  const baseline = useMemo(() => {
    if (!selectedSeasonSummary) return 0;
    if (selectedSeasonSummary.pointsPerGame != null) {
      return selectedSeasonSummary.pointsPerGame;
    }

    const { points, gamesPlayed } = selectedSeasonSummary;
    if (points != null && gamesPlayed) {
      return gamesPlayed === 0 ? 0 : points / gamesPlayed;
    }

    return 0;
  }, [selectedSeasonSummary]);

  const trendData = useMemo<TrendDataBundle>(() => {
    if (!gameLogRows.length) return INITIAL_TREND;

    const dates = gameLogRows.map((row) => new Date(row.date));
    const points = gameLogRows.map((row) => Number(row.totalPoints ?? 0));

    return buildTrendData({
      dates,
      points,
      window: rollingWindow,
      baseline
    });
  }, [gameLogRows, rollingWindow, baseline]);

  // Fantasy scoring weights (temporary baseline provided by user)
  const FANTASY_WEIGHTS = useMemo(
    () => ({
      G: 3,
      A: 2,
      PPP_BONUS: 1, // applied per goal/assist that is on PP as a total +1 per PP point
      SOG: 0.2,
      HIT: 0.2,
      BLK: 0.25
    }),
    []
  );

  // Compute per-game RFV (Rolling Fantasy Value base series) and baseline as the season average RFV
  const rfvTrend = useMemo<TrendDataBundle>(() => {
    if (!gameLogRows.length) return INITIAL_TREND;
    const rfvPerGame = gameLogRows.map((g) => {
      const gVal = (g.goals ?? 0) * FANTASY_WEIGHTS.G;
      const aVal = (g.totalAssists ?? 0) * FANTASY_WEIGHTS.A;
      const ppBonus = (g.ppPoints ?? 0) * FANTASY_WEIGHTS.PPP_BONUS;
      const sog = (g.shots ?? 0) * FANTASY_WEIGHTS.SOG;
      const hit = (g.hits ?? 0) * FANTASY_WEIGHTS.HIT;
      const blk = (g.blocks ?? 0) * FANTASY_WEIGHTS.BLK;
      return gVal + aVal + ppBonus + sog + hit + blk;
    });
    const rfvBaseline = rfvPerGame.length
      ? rfvPerGame.reduce((a, b) => a + b, 0) / rfvPerGame.length
      : 0;
    return buildTrendData({
      dates: gameLogRows.map((g) => new Date(g.date)),
      points: rfvPerGame,
      window: rollingWindow,
      baseline: rfvBaseline
    });
  }, [gameLogRows, rollingWindow, FANTASY_WEIGHTS]);

  const latestGameDate = trendData.chartPoints.at(-1)?.date;

  const hasChartData = trendData.chartPoints.length > 0;

  const resetState = () => {
    setSelectedPlayer(null);
    setSeasonSummaries([]);
    setSelectedSeason(null);
    setGameLogRows([]);
    setPlayerQuery("");
    setPlayerResults([]);
    setErrorMessage(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Trends Sandbox</h1>
        <button
          type="button"
          onClick={resetState}
          className={styles.resetButton}
        >
          Reset
        </button>
      </div>

      <section className={styles.controls}>
        <div className={styles.controlGroup}>
          <label htmlFor="player-search">Player</label>
          <input
            id="player-search"
            type="search"
            value={playerQuery}
            placeholder="Search skaters by name"
            onChange={(event) => {
              setPlayerQuery(event.target.value);
              setErrorMessage(null);
            }}
          />
          {searchingPlayers && (
            <span className={styles.status}>Searching…</span>
          )}
          {!searchingPlayers && playerResults.length > 0 && (
            <ul className={styles.playerResults}>
              {playerResults.map((player) => (
                <li key={player.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlayer(player);
                      setPlayerQuery(player.name);
                      setPlayerResults([]);
                    }}
                  >
                    <span>{player.name}</span>
                    {player.position ? (
                      <span className={styles.positionTag}>
                        {player.position}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.controlGroup}>
          <label htmlFor="season-select">Season</label>
          <select
            id="season-select"
            disabled={!seasonSummaries.length || loadingSeasonData}
            value={selectedSeason ?? ""}
            onChange={(event) => setSelectedSeason(event.target.value)}
          >
            <option value="" disabled>
              {loadingSeasonData ? "Loading seasons…" : "Select a season"}
            </option>
            {seasonSummaries.map((summary) => (
              <option key={summary.season} value={summary.season}>
                {formatSeasonLabel(summary.season)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.controlGroup}>
          <span>Rolling Average</span>
          <div className={styles.windowButtons}>
            {ROLLING_WINDOWS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  option.value === rollingWindow
                    ? styles.windowButtonActive
                    : styles.windowButton
                }
                onClick={() => setRollingWindow(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.controlGroup}>
          <label htmlFor="snap-toggle" className={styles.inlineLabel}>
            <input
              id="snap-toggle"
              type="checkbox"
              checked={snapToSchedule}
              onChange={(e) => setSnapToSchedule(e.target.checked)}
            />
            <span>Snap tooltip to schedule</span>
          </label>
        </div>
      </section>

      {errorMessage && <p className={styles.error}>{errorMessage}</p>}

      <section className={styles.summary}>
        <div>
          <strong>Selected Player:</strong>
          <span>
            {selectedPlayer ? selectedPlayer.name : "—"}
            {selectedPlayer?.position ? ` (${selectedPlayer.position})` : ""}
          </span>
        </div>
        <div>
          <strong>Season:</strong>
          <span>
            {selectedSeason ? formatSeasonLabel(selectedSeason) : "—"}
          </span>
        </div>
        <div>
          <strong>Baseline PPG:</strong>
          <span>{baseline.toFixed(2)}</span>
        </div>
        <div>
          <strong>Games Loaded:</strong>
          <span>
            {loadingGameLog
              ? "Loading…"
              : hasChartData
                ? trendData.chartPoints.length
                : "0"}
          </span>
        </div>
        <div>
          <strong>Last Game:</strong>
          <span>
            {latestGameDate ? format(latestGameDate, "MMM d, yyyy") : "—"}
          </span>
        </div>
      </section>

      <section className={styles.chartSection}>
        {hasChartData ? (
          <HotColdStreakChart
            data={trendData}
            baseline={baseline}
            seasonLabel={
              selectedSeason ? formatSeasonLabel(selectedSeason) : ""
            }
            rollingWindow={rollingWindow}
            scheduleDates={scheduleDates}
            snapToSchedule={snapToSchedule}
          />
        ) : (
          <HotColdStreakChartPlaceholder />
        )}
      </section>

      {/* Fantasy Value Chart */}
      <section className={styles.chartSection}>
        {rfvTrend.chartPoints.length ? (
          <HotColdStreakChart
            data={rfvTrend}
            baseline={
              rfvTrend.chartPoints.length
                ? rfvTrend.chartPoints.reduce((acc, p) => acc + p.points, 0) /
                  rfvTrend.chartPoints.length
                : 0
            }
            seasonLabel={
              selectedSeason
                ? `${formatSeasonLabel(selectedSeason)} — Fantasy Value`
                : "Fantasy Value"
            }
            rollingWindow={rollingWindow}
            scheduleDates={scheduleDates}
            snapToSchedule={snapToSchedule}
          />
        ) : (
          <HotColdStreakChartPlaceholder />
        )}
      </section>
    </div>
  );
}

interface HotColdStreakChartProps {
  data: TrendDataBundle;
  baseline: number;
  seasonLabel: string;
  rollingWindow: number;
  scheduleDates: Date[];
  snapToSchedule?: boolean;
}

function HotColdStreakChart({
  data,
  baseline,
  seasonLabel,
  rollingWindow,
  scheduleDates,
  snapToSchedule = false
}: HotColdStreakChartProps) {
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
      if (entry) {
        const { width } = entry.contentRect;
        setContainerWidth((prev) =>
          Math.abs(prev - width) > 1 ? width : prev
        );
      }
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

    const clipId = `clip-${Math.random().toString(36).slice(2, 9)}`;
    svg
      .append("defs")
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
      const paddingMs = 2 * 24 * 60 * 60 * 1000; // ±2 days for single-game seasons
      minDate = new Date(minDate.getTime() - paddingMs);
      maxDate = new Date(maxDate.getTime() + paddingMs);
    }

    x.domain([minDate, maxDate]);
    x2.domain([minDate, maxDate]);

    const valueCandidates = [
      baseline,
      ...points.flatMap((point) => [point.points, point.rollingAverage])
    ];
    // Filter to plausible values for hockey points context
    const finiteVals = (
      valueCandidates.filter((v) => Number.isFinite(v)) as number[]
    ).filter((v) => Math.abs(v) <= 10);
    // Dev-only: surface suspiciously large values to console for investigation
    if (process.env.NODE_ENV !== "production") {
      const sus = finiteVals.filter((v) => v > 8);
      if (sus.length) {
        const maxSus = Math.max(...sus);
        const offenders = points.filter(
          (p) => p.points === maxSus || p.rollingAverage === maxSus
        );
        // eslint-disable-next-line no-console
        console.warn("[Trends] Outlier detected in valueCandidates:", {
          maxValue: maxSus,
          offenders: offenders.map((p) => ({
            date: p.date.toISOString().slice(0, 10),
            points: p.points,
            rollingAverage: p.rollingAverage
          }))
        });
      }
    }
    // Robust domain: winsorize extremes so one spike doesn't dominate
    const trimmed = winsorize(finiteVals, 0.01);
    let minValue = d3.min(trimmed) ?? 0;
    let maxValue = d3.max(trimmed) ?? 1;
    if (minValue === maxValue) {
      const delta = Math.abs(minValue) < 1 ? 1 : Math.abs(minValue) * 0.2;
      minValue -= delta;
      maxValue += delta;
    }
    const valuePadding = (maxValue - minValue) * 0.15 || 1;
    y.domain([minValue - valuePadding, maxValue + valuePadding]);
    y2.domain(y.domain());

    type PathPoint = { date: Date; ra: number; played: boolean };
    const playedMap = new Map(
      points.map((p) => [p.date.toISOString().slice(0, 10), p])
    );
    const sched = (scheduleDates ?? []).slice().sort((a, b) => +a - +b);
    const pathPoints: PathPoint[] = sched.length
      ? sched.map((d) => {
          const iso = d.toISOString().slice(0, 10);
          const p = playedMap.get(iso);
          return { date: d, ra: p?.rollingAverage ?? Number.NaN, played: !!p };
        })
      : points.map((p) => ({
          date: p.date,
          ra: p.rollingAverage,
          played: true
        }));

    const rollingLine = d3
      .line<PathPoint>()
      .defined((d) => d.played && Number.isFinite(d.ra))
      .x((d) => x(d.date))
      .y((d) => y(d.ra));

    const rollingLineContext = d3
      .line<PathPoint>()
      .defined((d) => d.played && Number.isFinite(d.ra))
      .x((d) => x2(d.date))
      .y((d) => y2(d.ra));

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
      .datum(pathPoints)
      .attr("class", "rolling-line focus-line")
      .attr("fill", "none")
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("stroke-width", 2.5);

    const contextLinePath = contextLayer
      .append("path")
      .datum(pathPoints)
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

    const yAxisGroup = focus
      .append("g")
      .attr("class", "y-axis")
      .call(focusYAxis);

    context
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${contextHeight})`)
      .call(contextXAxis);

    const streakRects = streakLayer
      .selectAll<SVGRectElement, StreakSegment>("rect")
      .data(
        data.streaks,
        (segment) => `${segment.type}-${segment.startIndex}-${segment.endIndex}`
      )
      .join("rect")
      .attr("class", (segment) => `streak ${segment.type}`)
      .attr("fill", (segment) =>
        segment.type === "hot"
          ? `rgba(242, 82, 33, ${Math.min(1, Math.max(segment.intensity, 0.25)).toFixed(2)})`
          : `rgba(32, 168, 255, ${Math.min(1, Math.max(segment.intensity, 0.25)).toFixed(2)})`
      );

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
      .selectAll<SVGCircleElement, ChartPoint>("circle")
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

    const tooltipFull = d3.timeFormat("%b %d, %Y");
    circles.each(function handled(this: SVGCircleElement, point: ChartPoint) {
      const node = d3.select<SVGCircleElement, ChartPoint>(this);
      const tooltipLines = [
        tooltipFull(point.date),
        `Points: ${point.points}`,
        `Rolling (${rollingWindow}) avg: ${
          Number.isFinite(point.rollingAverage)
            ? point.rollingAverage.toFixed(2)
            : "—"
        }`,
        `Streak: ${
          point.streakType === "neutral"
            ? "neutral"
            : `${point.streakType} ×${point.streakLength}`
        }`
      ].join("\n");
      const title = node.select<SVGTitleElement>("title");
      if (title.empty()) {
        node.append("title").text(tooltipLines);
      } else {
        title.text(tooltipLines);
      }
    });

    // Custom hover tooltip for richer info
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

    // Crosshair overlay elements (vertical & horizontal lines + nearest point focus)
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
    const bisectDate = d3.bisector<ChartPoint, Date>((d) => d.date).left;
    const schedIsoSet = new Set(
      (scheduleDates ?? []).map((d) => d.toISOString().slice(0, 10))
    );
    const pointByIso = new Map(
      points.map((p) => [p.date.toISOString().slice(0, 10), p])
    );

    const spacing = innerWidth / Math.max(points.length, 1);
    const offset = spacing * 0.45;
    const clampX = (value: number) =>
      Number.isFinite(value) ? Math.max(0, Math.min(innerWidth, value)) : 0;

    const updateFocus = () => {
      linePath.attr("d", rollingLine);
      contextLinePath.attr("d", rollingLineContext);

      baselineLine
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", y(baseline))
        .attr("y2", y(baseline));

      contextBaseline
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", y2(baseline))
        .attr("y2", y2(baseline));

      streakRects
        .attr("y", 0)
        .attr("height", focusHeight)
        .attr("x", (segment) => {
          const start = clampX(x(segment.startDate) - offset);
          return start;
        })
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
      .filter((ev: any) => {
        // Allow wheel zoom; allow primary-button drag; always allow touch
        return (
          ev.type === "wheel" ||
          (ev.type === "mousedown" && ev.button === 0) ||
          ev.type === "touchstart" ||
          ev.type === "touchmove" ||
          ev.type === "touchend"
        );
      })
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
        // Show crosshair following cursor; tooltip shows nearest game
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

        // Compute the intended date under the cursor
        const xm = x.invert(clampedX);

        let show = true;
        let nearest: ChartPoint | null = null;
        if (snapToSchedule) {
          // Snap to the nearest scheduled date; show tooltip only when near that date in pixels
          const i = Math.max(
            1,
            Math.min(points.length - 1, bisectDate(points, xm))
          );
          const p0 = points[i - 1];
          const p1 = points[i];
          const candidate =
            !p1 ||
            xm.getTime() - p0.date.getTime() < p1.date.getTime() - xm.getTime()
              ? p0
              : p1;
          const iso = candidate.date.toISOString().slice(0, 10);
          // If it's a scheduled day but player didn't play, we still snap but mark as missed
          if (schedIsoSet.has(iso)) {
            if (pointByIso.has(iso)) {
              nearest = pointByIso.get(iso)!;
            } else {
              // Missed game day: we render crosshair but show a "No game played" tooltip
              nearest = {
                ...candidate,
                points: NaN,
                rollingAverage: NaN,
                streakType: "neutral",
                streakLength: 0
              } as ChartPoint;
            }
            // Only show when within 20px of the snapped date position
            const px = x(candidate.date);
            show = Math.abs(clampedX - px) <= 20;
          } else {
            show = false;
          }
        } else {
          // Free hover: nearest by date among actual played games
          const i = Math.max(
            1,
            Math.min(points.length - 1, bisectDate(points, xm))
          );
          const p0 = points[i - 1];
          const p1 = points[i];
          nearest =
            !p1 ||
            xm.getTime() - p0.date.getTime() < p1.date.getTime() - xm.getTime()
              ? p0
              : p1;
        }

        if (!show || !nearest) {
          hoverDot.style("opacity", 0);
          hover.style("opacity", "0");
          return;
        }

        // Position hover elements
        hoverDot
          .attr("cx", x(nearest.date))
          .attr(
            "cy",
            y(Number.isFinite(nearest.points) ? nearest.points : baseline)
          )
          .style("opacity", 1);

        const html = Number.isFinite(nearest.points)
          ? `
          <div><strong>${fmtFull(nearest.date)}</strong></div>
          <div>Points: ${nearest.points}</div>
          <div>Rolling (${rollingWindow}): ${
            Number.isFinite(nearest.rollingAverage)
              ? nearest.rollingAverage.toFixed(2)
              : "—"
          }</div>
          <div>Baseline: ${baseline.toFixed(2)}</div>
          <div>Streak: ${
            nearest.streakType === "neutral"
              ? "neutral"
              : `${nearest.streakType} ×${nearest.streakLength}`
          }</div>`
          : `
          <div><strong>${fmtFull(nearest.date)}</strong></div>
          <div>No game played</div>
          <div>Baseline: ${baseline.toFixed(2)}</div>`;

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
  }, [data, baseline, containerWidth, rollingWindow, scheduleDates]);

  return (
    <div ref={containerRef} className={styles.chartWrapper}>
      <div className={styles.chartMeta}>
        <h2>{seasonLabel || "Season"}</h2>
        <span>{rollingWindow}-game rolling average</span>
      </div>
      <svg
        ref={svgRef}
        className={styles.chartSvg}
        role="img"
        aria-label="Hot and cold streak chart"
      />
    </div>
  );
}
