import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import { fetchCurrentSeason } from "utils/fetchCurrentSeason";
import { teamsInfo } from "lib/teamsInfo";

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
  const today = new Date().toISOString().slice(0, 10);
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
      if (!games || games.length === 0) return { projections: null, games: [] as any[] };
      const gameIds = games.map((g) => g.id);
      const { data: projRows, error: pErr } = await supabase
        .from("player_projections")
        .select(
          "player_id, game_id, opponent_team_id, proj_fantasy_points, proj_goals, proj_assists, proj_shots, proj_pp_points, proj_hits, proj_blocks, proj_pim, matchup_grade"
        )
        .in("game_id", gameIds);
      if (pErr) throw pErr;
      return { projections: projRows as ProjectionRow[] | null, games };
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
        new Set((recentProjIds ?? []).map((r: any) => r.game_id).filter(Boolean))
      );
      if (gameIds.length === 0) return { projections: null, games: [] as any[], dateUsed: initialDate };
      const { data: games, error: gErr } = await supabase
        .from("games")
        .select("id, date, homeTeamId, awayTeamId")
        .in("id", gameIds)
        .order("date", { ascending: false })
        .limit(1);
      if (gErr) throw gErr;
      const targetDate = games?.[0]?.date as string | undefined;
      if (!targetDate) return { projections: null, games: [] as any[], dateUsed: initialDate };
      const { projections, games: gameRows } = await fetchForDate(targetDate);
      return { projections, games: gameRows, dateUsed: targetDate };
    };

    let { projections: projRows, games: gameRows } = await fetchForDate(initialDate);
    if (!projRows || projRows.length === 0) {
      const prev = fallbackDate(initialDate);
      const fallback = await fetchForDate(prev);
      projRows = fallback.projections;
      gameRows = fallback.games;
      dateUsed = prev;
    }
    if (!projRows || projRows.length === 0) {
      const latest = await fetchLatestAvailable();
      projRows = latest.projections;
      gameRows = latest.games;
      dateUsed = latest.dateUsed ?? dateUsed;
    }

    if (!projRows || projRows.length === 0) {
      return res.status(200).json({
        dateUsed,
        projections: [],
        players: [],
        ctpi: []
      });
    }

    // Grab Yahoo players for current season
    const { data: yahooPlayers, error: ypError } = await supabase
      .from("yahoo_players")
      .select(
        "player_id, player_name, full_name, eligible_positions, percent_ownership, ownership_timeline"
      )
      .eq("season", yahooSeason);
    if (ypError) throw ypError;
    const yahooMap = new Map<number, YahooPlayerRow>();
    (yahooPlayers ?? []).forEach((row) => {
      const key = Number(row.player_id);
      if (!Number.isNaN(key)) {
        yahooMap.set(key, row as YahooPlayerRow);
      }
    });

    const gameMap = new Map<number, { id: number; date: string; homeTeamId: number; awayTeamId: number }>();
    (gameRows ?? []).forEach((g: any) => {
      gameMap.set(g.id, g);
    });

    const players = (projRows ?? []).flatMap((p) => {
      const game = gameMap.get(p.game_id);
      if (!game) return [];
      const yp = yahooMap.get(Number(p.player_id));
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
      return {
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
      };
    });

    // CTPI sparkline (league average by date, last 30 days)
    const startRange = shiftDate(initialDate, -30); // last 30 days for sparkline
    const { data: ctpiRows, error: ctpiError } = await supabase
      .from("team_ctpi_daily")
      .select("date, ctpi_0_to_100")
      .gte("date", startRange)
      .order("date", { ascending: true });
    if (ctpiError) throw ctpiError;
    const ctpiByDate = new Map<string, number[]>();
    (ctpiRows as CtpiRow[] | null)?.forEach((row) => {
      if (!row.date) return;
      const list = ctpiByDate.get(row.date) ?? [];
      if (typeof row.ctpi_0_to_100 === "number") {
        list.push(row.ctpi_0_to_100);
        ctpiByDate.set(row.date, list);
      }
    });
    const ctpi = Array.from(ctpiByDate.entries()).map(([date, vals]) => ({
      date,
      value:
        vals.length > 0
          ? Number(
              (vals.reduce((sum, v) => sum + v, 0) / vals.length).toFixed(2)
            )
          : null
    }));

    return res.status(200).json({
      dateUsed,
      projections: players.length,
      players,
      ctpi
    });
  } catch (err: any) {
    console.error("start-chart API error", err);
    return res.status(500).json({ error: err?.message ?? "Unexpected error" });
  }
}
