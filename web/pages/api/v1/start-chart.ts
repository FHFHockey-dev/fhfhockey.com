import type { NextApiRequest, NextApiResponse } from "next";
import { buildResolvedDataServingContract } from "lib/dashboard/freshness";
import { buildStartChartCompatibility } from "lib/projections/compatibilityInventory";
import supabase from "lib/supabase/server";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { teamsInfo } from "lib/teamsInfo";
import {
  fetchTeamRatings,
  type TeamRating as TeamPowerRating
} from "lib/teamRatingsService";
import { requireLatestSucceededRunId } from "pages/api/v1/projections/_helpers";

type ProjectionRow = {
  run_id: string;
  as_of_date: string;
  player_id: number;
  team_id: number;
  game_id: number;
  opponent_team_id: number;
  proj_goals_es: number | null;
  proj_goals_pp: number | null;
  proj_goals_pk: number | null;
  proj_assists_es: number | null;
  proj_assists_pp: number | null;
  proj_assists_pk: number | null;
  proj_shots_es: number | null;
  proj_shots_pp: number | null;
  proj_shots_pk: number | null;
  proj_hits: number | null;
  proj_blocks: number | null;
  proj_pim: number | null;
};

type GoalieRow = {
  game_id: number;
  team_id: number;
  player_id: number;
  start_probability: number | null;
  projected_gsaa_per_60: number | null;
  confirmed_status: boolean | null;
};

type YahooPlayerRow = {
  player_id: string | null;
  player_name: string | null;
  full_name: string | null;
  eligible_positions: string[] | null;
  percent_ownership: number | null;
  ownership_timeline: any;
};

type CtpiRow = { date: string; ctpi_0_to_100: number | null };
const RESPONSE_TTL_MS = 60_000;
const responseCache = new Map<string, { expiresAt: number; payload: any }>();
const inFlight = new Map<string, Promise<any>>();

const fallbackDate = (dateStr: string) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

const shiftDate = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const parseOwnership = (row: YahooPlayerRow): number | null => {
  if (Array.isArray(row.ownership_timeline) && row.ownership_timeline.length) {
    const last = row.ownership_timeline[row.ownership_timeline.length - 1];
    const keys = ["percent", "ownership", "value", "pct"];
    for (const k of keys) {
      if (last && typeof last[k] === "number") return last[k];
      if (last && typeof last[k] === "string" && !isNaN(Number(last[k]))) {
        return Number(last[k]);
      }
    }
  }
  return row.percent_ownership ?? null;
};

const parsePositions = (pos: any): string[] => {
  if (Array.isArray(pos)) return pos.map(String);
  if (typeof pos === "string") return pos.split(",").map((p) => p.trim());
  return [];
};

const findAbbrev = (teamId: number): string | null => {
  const t = Object.values(teamsInfo).find((team) => team.id === teamId);
  return t?.abbrev ?? null;
};

const computeMatchupGrade = (
  rating: TeamPowerRating | undefined
): number | null => {
  const xga60 = rating?.components?.xga60;
  if (xga60 == null || Number.isNaN(xga60)) return null;
  const grade = 100 - (xga60 - 2.5) * 22.5;
  return Math.min(95, Math.max(5, grade));
};

const computeFantasyPoints = (args: {
  goals: number;
  assists: number;
  shots: number;
}) => Number((args.goals * 3 + args.assists * 2 + args.shots * 0.5).toFixed(3));

async function fetchFallbackRunWithPlayerData(
  targetDate: string
): Promise<{ runId: string; asOfDate: string } | null> {
  const { data: candidates, error: candidatesError } = await supabase
    .from("forge_runs")
    .select("run_id,as_of_date")
    .eq("status", "succeeded")
    .lte("as_of_date", targetDate)
    .order("as_of_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);
  if (candidatesError) throw candidatesError;

  const rows = (candidates ?? []) as Array<{
    run_id: string;
    as_of_date: string;
  }>;

  for (const row of rows) {
    const { count, error } = await supabase
      .from("forge_player_projections")
      .select("player_id", { count: "exact", head: true })
      .eq("run_id", row.run_id)
      .eq("horizon_games", 1);
    if (error) throw error;
    if ((count ?? 0) > 0) {
      return { runId: row.run_id, asOfDate: row.as_of_date };
    }
  }

  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const dateParam = typeof req.query.date === "string" ? req.query.date : null;

  // Use EST for "today" to avoid UTC rollover issues late at night
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
  const today = `${y}-${m}-${d}`;

  const initialDate = dateParam || today;
  const cacheKey = `date:${initialDate}`;

  try {
    const nowMs = Date.now();
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) {
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
      return res.status(200).json(cached.payload);
    }

    const pending = inFlight.get(cacheKey);
    if (pending) {
      const payload = await pending;
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
      return res.status(200).json(payload);
    }

    const loadPromise = (async () => {
      const season = await fetchCurrentSeason();
      const yahooSeason = Number(String(season.id).slice(0, 4));

      let dateUsed = initialDate;
      let projectionRunId: string | null = null;
      let skaterSourceDate = initialDate;
      let fallbackApplied = false;
      let fallbackStrategy:
        | "requested_date"
        | "previous_date_with_games"
        | "latest_available_with_data" = "requested_date";

      const fetchForDate = async (targetDate: string) => {
        const { data: games, error: gErr } = await supabase
          .from("games")
          .select("id, date, homeTeamId, awayTeamId")
          .eq("date", targetDate);
        if (gErr) throw gErr;
        if (!games || games.length === 0) {
          return {
            projections: null,
            goalies: null,
            games: [] as any[],
            runId: null
          };
        }

        const gameIds = games.map((g) => g.id);
        let runId: string | null = null;

        try {
          runId = await requireLatestSucceededRunId(targetDate);
        } catch (error) {
          if ((error as any)?.statusCode !== 404) throw error;
        }

        let projRows: ProjectionRow[] | null = null;
        if (runId) {
          const { data, error: pErr } = await supabase
            .from("forge_player_projections")
            .select(
              `
                run_id,
                as_of_date,
                player_id,
                team_id,
                game_id,
                opponent_team_id,
                proj_goals_es,
                proj_goals_pp,
                proj_goals_pk,
                proj_assists_es,
                proj_assists_pp,
                proj_assists_pk,
                proj_shots_es,
                proj_shots_pp,
                proj_shots_pk,
                proj_hits,
                proj_blocks,
                proj_pim
              `
            )
            .eq("run_id", runId)
            .eq("horizon_games", 1)
            .in("game_id", gameIds);
          if (pErr) throw pErr;
          projRows = (data ?? []) as ProjectionRow[];
        }

        const { data: goalieRows, error: gProjErr } = await supabase
          .from("goalie_start_projections")
          .select(
            "game_id, team_id, player_id, start_probability, projected_gsaa_per_60, confirmed_status"
          )
          .in("game_id", gameIds);
        if (gProjErr) throw gProjErr;

        return {
          projections: projRows,
          goalies: goalieRows as GoalieRow[] | null,
          games,
          runId
        };
      };

      const fetchLatestAvailable = async () => {
        const fallback = await fetchFallbackRunWithPlayerData(initialDate);
        if (!fallback) {
          return {
            projections: null,
            goalies: null,
            games: [] as any[],
            dateUsed: initialDate,
            runId: null
          };
        }

        const {
          projections,
          goalies,
          games: gameRows,
          runId
        } = await fetchForDate(fallback.asOfDate);

        return {
          projections,
          goalies,
          games: gameRows,
          dateUsed: fallback.asOfDate,
          runId
        };
      };

      let {
        projections: projRows,
        goalies: goalieRows,
        games: gameRows,
        runId
      } = await fetchForDate(initialDate);
      const requestedGamesCount = gameRows?.length ?? 0;
      projectionRunId = runId;
      skaterSourceDate = initialDate;

      const hasData =
        (projRows && projRows.length > 0) ||
        (goalieRows && goalieRows.length > 0);
      const hasGames = gameRows && gameRows.length > 0;

      // Only fallback if we have NO games AND no data.
      // If we have games but no projections, show the games (empty state for players).
      if (!hasGames && !hasData) {
        const prev = fallbackDate(initialDate);
        const fallback = await fetchForDate(prev);
        const fallbackHasGames = fallback.games && fallback.games.length > 0;

        if (fallbackHasGames) {
          projRows = fallback.projections;
          goalieRows = fallback.goalies;
          gameRows = fallback.games;
          runId = fallback.runId;
          dateUsed = prev;
          skaterSourceDate = prev;
          fallbackApplied = prev !== initialDate;
          fallbackStrategy = "previous_date_with_games";
        }
      }

      // If still no games/data, try latest available
      const finalHasGames = gameRows && gameRows.length > 0;
      if (!finalHasGames && (!projRows || projRows.length === 0)) {
        const latest = await fetchLatestAvailable();
        projRows = latest.projections;
        goalieRows = latest.goalies;
        gameRows = latest.games;
        runId = latest.runId;
        dateUsed = latest.dateUsed ?? dateUsed;
        skaterSourceDate = latest.dateUsed ?? skaterSourceDate;
        fallbackApplied = dateUsed !== initialDate;
        fallbackStrategy = fallbackApplied
          ? "latest_available_with_data"
          : fallbackStrategy;
      }

      projectionRunId = runId;
      const serving = buildResolvedDataServingContract({
        requestedDate: initialDate,
        resolvedDate: dateUsed,
        fallbackApplied,
        strategy: fallbackApplied ? fallbackStrategy : "requested_date",
        requestedScheduledGames: requestedGamesCount,
        resolvedScheduledGames: gameRows?.length ?? 0,
        sourceLabel: "Start-chart slate"
      });

      if (
        (!projRows || projRows.length === 0) &&
        (!goalieRows || goalieRows.length === 0) &&
        (!gameRows || gameRows.length === 0)
      ) {
        return {
          dateUsed,
          requestedDate: initialDate,
          fallbackApplied,
          serving,
          compatibilityInventory: buildStartChartCompatibility(),
          skaterSourceDate,
          projectionRunId,
          skaterSource: "forge_player_projections",
          goalieSource: "goalie_start_projections",
          legacyPlayerProjectionsUsed: false,
          projections: [],
          players: [],
          ctpi: []
        };
      }

    // Fetch mapping for the players in projections
    const playerIds = [
      ...(projRows ?? []).map((p) => p.player_id),
      ...(goalieRows ?? []).map((g) => g.player_id)
    ];
    const { data: mappingRows, error: mapError } = await supabase
      .from("yahoo_nhl_player_map_mat")
      .select("nhl_player_id, yahoo_player_id")
      .in("nhl_player_id", playerIds.map(String));

    if (mapError) console.error("Mapping fetch error", mapError);

    const nhlToYahoo = new Map<number, number>();
    const yahooPlayerIds: number[] = [];

    (mappingRows ?? []).forEach((m: any) => {
      const nhl = Number(m.nhl_player_id);
      const yahoo = Number(m.yahoo_player_id);
      if (!isNaN(nhl) && !isNaN(yahoo)) {
        nhlToYahoo.set(nhl, yahoo);
        yahooPlayerIds.push(yahoo);
      }
    });

    // Grab ONLY the relevant Yahoo players (avoid 1000 row limit)
    const { data: yahooPlayers, error: ypError } = await supabase
      .from("yahoo_players")
      .select(
        "player_id, player_name, full_name, eligible_positions, percent_ownership, ownership_timeline"
      )
      .eq("season", yahooSeason)
      .in("player_id", yahooPlayerIds.map(String));

    if (ypError) throw ypError;

    const yahooMap = new Map<number, YahooPlayerRow>();
    (yahooPlayers ?? []).forEach((row) => {
      const key = Number(row.player_id);
      if (!Number.isNaN(key)) {
        yahooMap.set(key, row as YahooPlayerRow);
      }
    });

      const gameMap = new Map<
        number,
        { id: number; date: string; homeTeamId: number; awayTeamId: number }
      >();
      (gameRows ?? []).forEach((g: any) => {
        gameMap.set(g.id, g);
      });

      const ratings = await fetchTeamRatings(dateUsed);
      const teamRatingsByAbbrev = new Map(
        ratings.map((rating) => [rating.teamAbbr, rating] as const)
      );

      const players = [];

      // Process Skaters from canonical FORGE outputs.
      if (projRows) {
        for (const p of projRows) {
          const game = gameMap.get(p.game_id);
          if (!game) continue;

          const yahooId = nhlToYahoo.get(Number(p.player_id));
          const yp = yahooId ? yahooMap.get(yahooId) : undefined;

          const positions = yp ? parsePositions(yp.eligible_positions) : [];
          const ownership = yp ? parseOwnership(yp) : null;
          const opponentAbbrev = findAbbrev(p.opponent_team_id);
          const teamAbbrev = findAbbrev(p.team_id);
          const goals =
            (p.proj_goals_es ?? 0) +
            (p.proj_goals_pp ?? 0) +
            (p.proj_goals_pk ?? 0);
          const assists =
            (p.proj_assists_es ?? 0) +
            (p.proj_assists_pp ?? 0) +
            (p.proj_assists_pk ?? 0);
          const shots =
            (p.proj_shots_es ?? 0) +
            (p.proj_shots_pp ?? 0) +
            (p.proj_shots_pk ?? 0);
          const matchupGrade = opponentAbbrev
            ? computeMatchupGrade(teamRatingsByAbbrev.get(opponentAbbrev))
            : null;

          players.push({
            player_id: p.player_id,
            name: yp?.full_name || yp?.player_name || `Player ${p.player_id}`,
            positions,
            ownership,
            percent_ownership: ownership,
            opponent_team_id: p.opponent_team_id,
            opponent_abbrev: opponentAbbrev,
            team_id: p.team_id,
            team_abbrev: teamAbbrev,
            proj_fantasy_points: computeFantasyPoints({
              goals,
              assists,
              shots
            }),
            proj_goals: goals,
            proj_assists: assists,
            proj_shots: shots,
            matchup_grade: matchupGrade
          });
        }
      }

      // Process Goalies
      if (goalieRows) {
        for (const g of goalieRows) {
          const game = gameMap.get(g.game_id);
          if (!game) continue;

          const yahooId = nhlToYahoo.get(Number(g.player_id));
          const yp = yahooId ? yahooMap.get(yahooId) : undefined;

          const positions = yp ? parsePositions(yp.eligible_positions) : ["G"];
          const ownership = yp ? parseOwnership(yp) : null;

          const home = game.homeTeamId;
          const away = game.awayTeamId;
          const opponentId = g.team_id === home ? away : home;
          const opponentAbbrev = findAbbrev(opponentId);
          const teamAbbrev = findAbbrev(g.team_id);

          players.push({
            player_id: g.player_id,
            name: yp?.full_name || yp?.player_name || `Goalie ${g.player_id}`,
            positions,
            ownership,
            percent_ownership: ownership,
            opponent_team_id: opponentId,
            opponent_abbrev: opponentAbbrev,
            team_id: g.team_id,
            team_abbrev: teamAbbrev,
            proj_fantasy_points: null,
            start_probability: g.start_probability,
            projected_gsaa: g.projected_gsaa_per_60,
            proj_goals: null,
            proj_assists: null,
            proj_shots: null,
            matchup_grade: null
          });
        }
      }

    // Calculate games remaining this week (until Sunday)
    // Use UTC to avoid timezone shifts causing "today" to be "yesterday"
    const d = new Date(`${dateUsed}T00:00:00Z`);
    const day = d.getUTCDay(); // 0 is Sunday
    const diff = day === 0 ? 0 : 7 - day; // days until next Sunday

    const sunday = new Date(d);
    sunday.setUTCDate(d.getUTCDate() + diff);
    const sundayStr = sunday.toISOString().slice(0, 10);

      const { data: weekGames } = await supabase
        .from("games")
        .select("id, date, homeTeamId, awayTeamId")
        .gte("date", dateUsed)
        .lte("date", sundayStr);

      const gamesRemainingMap = new Map<number, number>();
      (weekGames ?? []).forEach((g) => {
        gamesRemainingMap.set(
          g.homeTeamId,
          (gamesRemainingMap.get(g.homeTeamId) ?? 0) + 1
        );
        gamesRemainingMap.set(
          g.awayTeamId,
          (gamesRemainingMap.get(g.awayTeamId) ?? 0) + 1
        );
      });

    // Attach games remaining to players
      const playersWithGames = players.map((p) => ({
        ...p,
        games_remaining_week: p.team_id
          ? (gamesRemainingMap.get(p.team_id) ?? 0)
          : 0
      }));

    // CTPI sparkline (history for teams playing on dateUsed)
    const startRange = shiftDate(dateUsed, -30); // last 30 days for sparkline

    // Identify teams playing on the target date (dateUsed)
    const teamsPlayingTodayIds = new Set<number>();
    (gameRows ?? []).forEach((g: any) => {
      teamsPlayingTodayIds.add(g.homeTeamId);
      teamsPlayingTodayIds.add(g.awayTeamId);
    });

    const teamsPlayingTodayAbbrevs = new Set<string>();
    teamsPlayingTodayIds.forEach((id) => {
      const abbrev = findAbbrev(id);
      if (abbrev) teamsPlayingTodayAbbrevs.add(abbrev);
    });

    const { data: ctpiRows, error: ctpiError } = await supabase
      .from("team_ctpi_daily")
      .select("date, team, ctpi_0_to_100")
      .gte("date", startRange)
      .order("date", { ascending: true });
    if (ctpiError) throw ctpiError;

    const ctpiMap = new Map<string, Record<string, number>>(); // date -> { team: value }

    (ctpiRows as any[] | null)?.forEach((row) => {
      if (!row.date || !row.team) return;
      if (!teamsPlayingTodayAbbrevs.has(row.team)) return; // Only care about teams playing today

      if (!ctpiMap.has(row.date)) ctpiMap.set(row.date, {});
      const dateEntry = ctpiMap.get(row.date)!;

      if (typeof row.ctpi_0_to_100 === "number") {
        dateEntry[row.team] = row.ctpi_0_to_100;
      }
    });

    const ctpi = Array.from(ctpiMap.entries())
      .map(([date, values]) => ({
        date,
        ...values
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Enrich games with ratings and goalie info
    const enrichedGames = (gameRows ?? []).map((g: any) => {
      const homeAbbrev = findAbbrev(g.homeTeamId);
      const awayAbbrev = findAbbrev(g.awayTeamId);
      const homeRating = ratings.find((r) => r.teamAbbr === homeAbbrev);
      const awayRating = ratings.find((r) => r.teamAbbr === awayAbbrev);

      const gameGoalies = goalieRows?.filter((gr) => gr.game_id === g.id) || [];

      const processGoalie = (gr: GoalieRow) => {
        const yahooId = nhlToYahoo.get(Number(gr.player_id));
        const yp = yahooId ? yahooMap.get(yahooId) : undefined;
        return {
          ...gr,
          name: yp?.player_name ?? yp?.full_name ?? "Unknown Goalie",
          percent_ownership: yp?.percent_ownership ?? null
        };
      };

      const homeGoalies = gameGoalies
        .filter((gr) => gr.team_id === g.homeTeamId)
        .map(processGoalie)
        .sort(
          (a, b) => (b.start_probability ?? 0) - (a.start_probability ?? 0)
        );

      const awayGoalies = gameGoalies
        .filter((gr) => gr.team_id === g.awayTeamId)
        .map(processGoalie)
        .sort(
          (a, b) => (b.start_probability ?? 0) - (a.start_probability ?? 0)
        );

      return {
        ...g,
        homeRating,
        awayRating,
        homeGoalies,
        awayGoalies
      };
    });

      return {
        dateUsed,
        requestedDate: initialDate,
        fallbackApplied,
        serving,
        compatibilityInventory: buildStartChartCompatibility(),
        skaterSourceDate,
        projectionRunId,
        skaterSource: "forge_player_projections",
        goalieSource: "goalie_start_projections",
        legacyPlayerProjectionsUsed: false,
        projections: playersWithGames.length,
        players: playersWithGames,
        ctpi,
        games: enrichedGames
      };
    })();

    inFlight.set(cacheKey, loadPromise);
    const payload = await loadPromise;
    inFlight.delete(cacheKey);

    responseCache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + RESPONSE_TTL_MS
    });
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json(payload);
  } catch (err: any) {
    inFlight.delete(cacheKey);
    console.error("start-chart API error", err);
    return res.status(500).json({ error: err?.message ?? "Unexpected error" });
  }
}
