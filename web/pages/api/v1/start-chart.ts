import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { teamsInfo } from "lib/teamsInfo";
import { fetchTeamRatings } from "lib/teamRatingsService";

type ProjectionRow = {
  player_id: number;
  game_id: number;
  opponent_team_id: number;
  proj_fantasy_points: number | null;
  proj_goals: number | null;
  proj_assists: number | null;
  proj_shots: number | null;
  proj_pp_points: number | null;
  proj_hits: number | null;
  proj_blocks: number | null;
  proj_pim: number | null;
  matchup_grade: number | null;
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

  try {
    const season = await fetchCurrentSeason();
    const yahooSeason = Number(String(season.id).slice(0, 4));

    // manual filter by game dates since there is no FK; fetch games first
    let dateUsed = initialDate;

    const fetchForDate = async (targetDate: string) => {
      const { data: games, error: gErr } = await supabase
        .from("games")
        .select("id, date, homeTeamId, awayTeamId")
        .eq("date", targetDate);
      if (gErr) throw gErr;
      if (!games || games.length === 0)
        return { projections: null, goalies: null, games: [] as any[] };
      const gameIds = games.map((g) => g.id);
      const { data: projRows, error: pErr } = await supabase
        .from("player_projections")
        .select(
          "player_id, game_id, opponent_team_id, proj_fantasy_points, proj_goals, proj_assists, proj_shots, proj_pp_points, proj_hits, proj_blocks, proj_pim, matchup_grade"
        )
        .in("game_id", gameIds);
      if (pErr) throw pErr;

      const { data: goalieRows, error: gProjErr } = await supabase
        .from("goalie_start_projections")
        .select(
          "game_id, team_id, player_id, start_probability, projected_gsaa_per_60, confirmed_status"
        )
        .in("game_id", gameIds);
      if (gProjErr) throw gProjErr;

      return {
        projections: projRows as ProjectionRow[] | null,
        goalies: goalieRows as GoalieRow[] | null,
        games
      };
    };

    // Find most recent date with projections (used if today/yesterday missing)
    const fetchLatestAvailable = async () => {
      const { data: recentProjIds, error: idsErr } = await supabase
        .from("player_projections")
        .select("game_id")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (idsErr) throw idsErr;
      const gameIds = Array.from(
        new Set(
          (recentProjIds ?? []).map((r: any) => r.game_id).filter(Boolean)
        )
      );
      if (gameIds.length === 0)
        return {
          projections: null,
          goalies: null,
          games: [] as any[],
          dateUsed: initialDate
        };
      const { data: games, error: gErr } = await supabase
        .from("games")
        .select("id, date, homeTeamId, awayTeamId")
        .in("id", gameIds)
        .order("date", { ascending: false })
        .limit(1);
      if (gErr) throw gErr;
      const targetDate = games?.[0]?.date as string | undefined;
      if (!targetDate)
        return {
          projections: null,
          goalies: null,
          games: [] as any[],
          dateUsed: initialDate
        };
      const {
        projections,
        goalies,
        games: gameRows
      } = await fetchForDate(targetDate);
      return { projections, goalies, games: gameRows, dateUsed: targetDate };
    };

    let {
      projections: projRows,
      goalies: goalieRows,
      games: gameRows
    } = await fetchForDate(initialDate);

    const hasData =
      (projRows && projRows.length > 0) ||
      (goalieRows && goalieRows.length > 0);
    const hasGames = gameRows && gameRows.length > 0;

    // Only fallback if we have NO games AND no data.
    // If we have games but no projections, show the games (empty state for players).
    if (!hasGames && !hasData) {
      const prev = fallbackDate(initialDate);
      const fallback = await fetchForDate(prev);

      // Check if fallback has anything
      const fallbackHasGames = fallback.games && fallback.games.length > 0;

      if (fallbackHasGames) {
        projRows = fallback.projections;
        goalieRows = fallback.goalies;
        gameRows = fallback.games;
        dateUsed = prev;
      }
    }

    // If still no games/data, try latest available
    const finalHasGames = gameRows && gameRows.length > 0;
    if (!finalHasGames && (!projRows || projRows.length === 0)) {
      const latest = await fetchLatestAvailable();
      projRows = latest.projections;
      goalieRows = latest.goalies;
      gameRows = latest.games;
      dateUsed = latest.dateUsed ?? dateUsed;
    }

    if (
      (!projRows || projRows.length === 0) &&
      (!goalieRows || goalieRows.length === 0) &&
      (!gameRows || gameRows.length === 0)
    ) {
      return res.status(200).json({
        dateUsed,
        projections: [],
        players: [],
        ctpi: []
      });
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

    const players = [];

    // Process Skaters
    if (projRows) {
      for (const p of projRows) {
        const game = gameMap.get(p.game_id);
        if (!game) continue;

        const yahooId = nhlToYahoo.get(Number(p.player_id));
        const yp = yahooId ? yahooMap.get(yahooId) : undefined;

        const positions = yp ? parsePositions(yp.eligible_positions) : [];
        const ownership = yp ? parseOwnership(yp) : null;
        const opponentAbbrev = findAbbrev(p.opponent_team_id);
        const home = game.homeTeamId;
        const away = game.awayTeamId;
        const teamId =
          p.opponent_team_id === home
            ? away
            : p.opponent_team_id === away
              ? home
              : null;
        const teamAbbrev = teamId ? findAbbrev(teamId) : null;

        players.push({
          player_id: p.player_id,
          name: yp?.full_name || yp?.player_name || `Player ${p.player_id}`,
          positions,
          ownership,
          percent_ownership: ownership,
          opponent_team_id: p.opponent_team_id,
          opponent_abbrev: opponentAbbrev,
          team_id: teamId,
          team_abbrev: teamAbbrev,
          proj_fantasy_points: p.proj_fantasy_points,
          proj_goals: p.proj_goals,
          proj_assists: p.proj_assists,
          proj_shots: p.proj_shots,
          proj_pp_points: p.proj_pp_points,
          proj_hits: p.proj_hits,
          proj_blocks: p.proj_blocks,
          proj_pim: p.proj_pim,
          matchup_grade: p.matchup_grade
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

        // Heuristic: Map start probability to fantasy points so they sort by likelihood to start
        const startProb = g.start_probability ?? 0;

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
          proj_pp_points: null,
          proj_hits: null,
          proj_blocks: null,
          proj_pim: null,
          matchup_grade: null // Goalies don't have matchup grade yet
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

    // Fetch team ratings
    const ratings = await fetchTeamRatings(dateUsed);

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

    return res.status(200).json({
      dateUsed,
      projections: playersWithGames.length,
      players: playersWithGames,
      ctpi,
      games: enrichedGames
    });
  } catch (err: any) {
    console.error("start-chart API error", err);
    return res.status(500).json({ error: err?.message ?? "Unexpected error" });
  }
}
