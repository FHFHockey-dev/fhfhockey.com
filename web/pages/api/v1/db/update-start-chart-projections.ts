import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import { teamsInfo } from "lib/teamsInfo";

type GameRow = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
};

type LineCombinationRow = {
  gameId: number;
  teamId: number;
  forwards: number[] | null;
  defensemen: number[] | null;
};

type RollingMetrics = {
  goals_avg_last5: number | null;
  goals_avg_all: number | null;
  assists_avg_last5: number | null;
  assists_avg_all: number | null;
  points_avg_last5: number | null;
  points_avg_all: number | null;
  sog_per_60_avg_last5: number | null;
  sog_per_60_avg_all: number | null;
  toi_seconds_avg_last5: number | null;
  toi_seconds_avg_all: number | null;
};

type TeamRatingRow = {
  team_abbreviation: string;
  date: string;
  xga60: number | null;
};

const clamp = (val: number, min: number, max: number) =>
  Math.min(max, Math.max(min, val));

function findAbbrev(teamId: number): string | null {
  const found = Object.values(teamsInfo).find((t) => t.id === teamId);
  return found?.abbrev ?? null;
}

function computeMatchupMultiplier(rating: TeamRatingRow | undefined) {
  if (!rating) return { shotMult: 1, grade: 50 };
  const xga = rating.xga60 ?? 2.7; // league-ish xGA/60
  const shotMult = clamp((xga / 2.7) || 1, 0.75, 1.25); // use xGA as a proxy if CA is unavailable
  // Higher xGA -> friendlier matchup; invert and scale to 0-100
  const grade = clamp(100 - (xga - 2.5) * 22.5, 5, 95);
  return { shotMult, grade };
}

function computeGoalieSuppression(gsaaPer60?: number | null) {
  if (gsaaPer60 == null) return 1;
  return clamp(1 - gsaaPer60 / 10, 0.8, 1.2);
}

function projectFromRolling(
  metrics: RollingMetrics | null,
  matchupMult: number,
  goalieMult: number
) {
  const baseGoals = Number(metrics?.goals_avg_all ?? 0);
  const trendGoals = Number(metrics?.goals_avg_last5 ?? baseGoals);
  const baseAssists = Number(metrics?.assists_avg_all ?? 0);
  const trendAssists = Number(metrics?.assists_avg_last5 ?? baseAssists);
  const shotsPer60Base = Number(metrics?.sog_per_60_avg_all ?? 0);
  const shotsPer60Trend = Number(
    metrics?.sog_per_60_avg_last5 ?? shotsPer60Base
  );
  const toiSeconds = Number(
    metrics?.toi_seconds_avg_last5 ?? metrics?.toi_seconds_avg_all ?? 900
  );

  const blend = (recent: number, baseline: number) =>
    0.6 * recent + 0.4 * baseline;

  const goals = blend(trendGoals, baseGoals) * matchupMult * goalieMult;
  const assists = blend(trendAssists, baseAssists) * matchupMult;
  const toiMinutes = toiSeconds / 60;
  const shotsPer60 = blend(shotsPer60Trend, shotsPer60Base) * matchupMult;
  const shots = (shotsPer60 / 60) * toiMinutes;

  // Simple fantasy scoring weights (can be replaced with user scoring later)
  const fantasy = goals * 3.0 + assists * 2.0 + shots * 0.5; // hits/blocks/pp not available here yet

  return {
    proj_goals: Number(goals.toFixed(3)),
    proj_assists: Number(assists.toFixed(3)),
    proj_shots: Number(shots.toFixed(3)),
    proj_pp_points: null,
    proj_hits: null,
    proj_blocks: null,
    proj_pim: null,
    proj_fantasy_points: Number(fantasy.toFixed(3))
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const date =
    (req.method === "GET"
      ? (req.query.date as string | undefined)
      : req.body?.date) ||
    new Date().toISOString().slice(0, 10);

  if (!date || typeof date !== "string") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res
      .status(400)
      .json({ error: "Date is required (YYYY-MM-DD) via query or body." });
  }

  const initialDate =
    (req.method === "GET"
      ? (req.query.date as string | undefined)
      : req.body?.date) ||
    new Date().toISOString().slice(0, 10);

  if (!initialDate || typeof initialDate !== "string") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res
      .status(400)
      .json({ error: "Date is required (YYYY-MM-DD) via query or body." });
  }

  const prevDate = (dateStr: string) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const processDate = async (
    date: string,
    allowFallback: boolean
  ): Promise<{ status: number; body: Record<string, any> }> => {
    // 1) Fetch games for the target date
    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("id, date, homeTeamId, awayTeamId")
      .eq("date", date);
    if (gamesError) throw gamesError;
    if (!games || games.length === 0) {
      if (allowFallback) {
        return processDate(prevDate(date), false);
      }
      return {
        status: 200,
        body: { message: "No games found for date", date, projections: 0 }
      };
    }

    // 2) Fetch line combinations to derive expected skaters
    const gameIds = games.map((g) => g.id);
    const { data: lineRows, error: lineError } = await supabase
      .from("lineCombinations")
      .select("gameId, teamId, forwards, defensemen")
      .in("gameId", gameIds);
    if (lineError) throw lineError;

    // Build team -> players mapping
    const teamPlayers = new Map<number, Set<number>>();
    (lineRows ?? []).forEach((row: LineCombinationRow) => {
      const players = [
        ...(row.forwards ?? []),
        ...(row.defensemen ?? [])
      ].filter(Boolean);
      if (!teamPlayers.has(row.teamId)) teamPlayers.set(row.teamId, new Set());
      const set = teamPlayers.get(row.teamId)!;
      players.forEach((p) => set.add(p));
    });

    // 3) Fetch opponent ratings once for all teams
    const opponentAbbrevs = Array.from(
      new Set(
        games
          .flatMap((g) => [findAbbrev(g.homeTeamId), findAbbrev(g.awayTeamId)])
          .filter(Boolean) as string[]
      )
    );
    let ratingsByTeam = new Map<string, TeamRatingRow>();
    if (opponentAbbrevs.length > 0) {
      const { data: ratingRows, error: ratingError } = await supabase
        .from("team_power_ratings_daily")
        .select("team_abbreviation, date, xga60")
        .in("team_abbreviation", opponentAbbrevs)
        .lte("date", date)
        .order("team_abbreviation", { ascending: true })
        .order("date", { ascending: false });
      if (ratingError) throw ratingError;
      ratingsByTeam = new Map();
      (ratingRows ?? []).forEach((r) => {
        if (!ratingsByTeam.has(r.team_abbreviation)) {
          ratingsByTeam.set(r.team_abbreviation, r);
        }
      });
    }

    // 4) Fetch goalie projections to add suppression factor
    const { data: goalieRows, error: goalieError } = await supabase
      .from("goalie_start_projections")
      .select("game_id, team_id, projected_gsaa_per_60, start_probability")
      .in("game_id", gameIds);
    if (goalieError) throw goalieError;
    const goalieByGameTeam = new Map<
      string,
      { prob: number; gsaa: number | null }
    >();
    (goalieRows ?? []).forEach((g) => {
      const key = `${g.game_id}|${g.team_id}`;
      const existing = goalieByGameTeam.get(key);
      const prob = Number(g.start_probability ?? 0);
      // keep the highest start_probability row
      if (!existing || prob > existing.prob) {
        goalieByGameTeam.set(key, {
          prob,
          gsaa: g.projected_gsaa_per_60 ?? null
        });
      }
    });

    // 5) Build projections
    const upserts: any[] = [];
    for (const game of games as GameRow[]) {
      const pairs: Array<{ teamId: number; opponentId: number }> = [
        { teamId: game.homeTeamId, opponentId: game.awayTeamId },
        { teamId: game.awayTeamId, opponentId: game.homeTeamId }
      ];

      for (const { teamId, opponentId } of pairs) {
        const playerSet = teamPlayers.get(teamId);
        if (!playerSet || playerSet.size === 0) continue;

        const opponentAbbrev = findAbbrev(opponentId);
        const rating = opponentAbbrev
          ? ratingsByTeam.get(opponentAbbrev)
          : undefined;
        const matchup = computeMatchupMultiplier(rating);
        const goalieSuppression = computeGoalieSuppression(
          goalieByGameTeam.get(`${game.id}|${opponentId}`)?.gsaa ?? null
        );

        for (const playerId of playerSet) {
          const { data: metricRow, error: metricError } = await supabase
            .from("rolling_player_game_metrics")
            .select(
              "goals_avg_last5, goals_avg_all, assists_avg_last5, assists_avg_all, points_avg_last5, points_avg_all, sog_per_60_avg_last5, sog_per_60_avg_all, toi_seconds_avg_last5, toi_seconds_avg_all"
            )
            .eq("player_id", playerId)
            .eq("strength_state", "all")
            .lte("game_date", date)
            .order("game_date", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (metricError) throw metricError;

          const projections = projectFromRolling(
            (metricRow as RollingMetrics | null) ?? null,
            matchup.shotMult,
            goalieSuppression
          );

          upserts.push({
            player_id: playerId,
            game_id: game.id,
            opponent_team_id: opponentId,
            matchup_grade: matchup.grade,
            ...projections
          });
        }
      }
    }

    if (upserts.length === 0) {
      if (allowFallback) {
        return processDate(prevDate(date), false);
      }
      return {
        status: 200,
        body: {
          message:
            "No players found in lineCombinations for the date; nothing to upsert.",
          date,
          projections: 0
        }
      };
    }

    // 6) Upsert into player_projections
    const { error: upsertError } = await supabase
      .from("player_projections" as any)
      .upsert(upserts, { onConflict: "player_id, game_id" });
    if (upsertError) throw upsertError;

    return {
      status: 200,
      body: {
        message: "Start Chart projections updated",
        date,
        projections: upserts.length
      }
    };
  };

  try {
    const result = await processDate(initialDate, true);
    return res.status(result.status).json(result.body);
  } catch (err: any) {
    console.error("update-start-chart-projections error", err);
    return res
      .status(500)
      .json({ error: err?.message ?? "Failed to update projections" });
  }
}
