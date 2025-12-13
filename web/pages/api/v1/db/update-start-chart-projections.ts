import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
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
  const shotMult = clamp(xga / 2.7 || 1, 0.75, 1.25); // use xGA as a proxy if CA is unavailable
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

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  const startTime = Date.now();
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Helper to get "Tomorrow" in EST (default behavior is to project for tomorrow)
  const getTomorrowEST = () => {
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

    // Treat as UTC to safely add 1 day without DST issues
    const today = new Date(`${y}-${m}-${d}T00:00:00Z`);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    return tomorrow.toISOString().slice(0, 10);
  };

  const defaultDate = getTomorrowEST();

  const date =
    (req.method === "GET"
      ? (req.query.date as string | undefined)
      : req.body?.date) || defaultDate;

  if (!date || typeof date !== "string") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res
      .status(400)
      .json({ error: "Date is required (YYYY-MM-DD) via query or body." });
  }

  const processDate = async (
    date: string
  ): Promise<{ status: number; body: Record<string, any> }> => {
    // 1) Fetch games for the target date
    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("id, date, homeTeamId, awayTeamId")
      .eq("date", date);
    if (gamesError) throw gamesError;
    if (!games || games.length === 0) {
      return {
        status: 200,
        body: { message: "No games found for date", date, projections: 0 }
      };
    }

    // 2) Fetch line combinations to derive expected skaters
    // We need to find the MOST RECENT line combination for each team playing today.
    // We cannot just query by today's gameIds because lineCombinations are only created AFTER a game is played.
    const gameIds = games.map((g) => g.id);
    const teamIds = games.flatMap((g) => [g.homeTeamId, g.awayTeamId]);

    const lineRows = (
      await Promise.all(
        teamIds.map(async (teamId) => {
          const { data } = await supabase
            .from("lineCombinations")
            .select(
              "gameId, teamId, forwards, defensemen, games!inner(date, startTime)"
            )
            .eq("teamId", teamId)
            .lt("games.date", date) // Get most recent PAST game
            .order("games(startTime)", { ascending: false })
            .limit(1)
            .maybeSingle();
          return data;
        })
      )
    ).filter(Boolean) as LineCombinationRow[];

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

    // 3) Fetch opponent ratings (Optimized: Limit to last 30 days to avoid 1000 row limit)
    const opponentAbbrevs = Array.from(
      new Set(
        games
          .flatMap((g) => [findAbbrev(g.homeTeamId), findAbbrev(g.awayTeamId)])
          .filter(Boolean) as string[]
      )
    );

    let ratingsByTeam = new Map<string, TeamRatingRow>();
    if (opponentAbbrevs.length > 0) {
      // Calculate date 30 days ago
      const d = new Date(date);
      d.setDate(d.getDate() - 30);
      const thirtyDaysAgo = d.toISOString().slice(0, 10);

      const { data: ratingRows, error: ratingError } = await supabase
        .from("team_power_ratings_daily")
        .select("team_abbreviation, date, xga60")
        .in("team_abbreviation", opponentAbbrevs)
        .lte("date", date)
        .gte("date", thirtyDaysAgo) // Optimization: Prevent fetching full history
        .order("team_abbreviation", { ascending: true })
        .order("date", { ascending: false });

      if (ratingError) throw ratingError;
      ratingsByTeam = new Map();
      (ratingRows ?? []).forEach((r) => {
        if (r.team_abbreviation && !ratingsByTeam.has(r.team_abbreviation)) {
          ratingsByTeam.set(r.team_abbreviation, r as TeamRatingRow);
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

    // 5) Build projections (Optimized: Parallel Processing)
    const upserts: any[] = [];
    const playerTasks: Array<{
      playerId: number;
      gameId: number;
      opponentId: number;
      matchup: { shotMult: number; grade: number };
      goalieSuppression: number;
    }> = [];

    // Prepare tasks
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
          playerTasks.push({
            playerId,
            gameId: game.id,
            opponentId,
            matchup,
            goalieSuppression
          });
        }
      }
    }

    // Process tasks in batches to avoid timeouts and overwhelm
    const BATCH_SIZE = 20;
    for (let i = 0; i < playerTasks.length; i += BATCH_SIZE) {
      const batch = playerTasks.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (task) => {
          const { data: metricRow, error: metricError } = await supabase
            .from("rolling_player_game_metrics")
            .select(
              "goals_avg_last5, goals_avg_all, assists_avg_last5, assists_avg_all, points_avg_last5, points_avg_all, sog_per_60_avg_last5, sog_per_60_avg_all, toi_seconds_avg_last5, toi_seconds_avg_all"
            )
            .eq("player_id", task.playerId)
            .eq("strength_state", "all")
            .lte("game_date", date)
            .order("game_date", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (metricError) {
            console.error(
              `Error fetching metrics for player ${task.playerId}`,
              metricError
            );
            return;
          }

          const projections = projectFromRolling(
            (metricRow as RollingMetrics | null) ?? null,
            task.matchup.shotMult,
            task.goalieSuppression
          );

          upserts.push({
            player_id: task.playerId,
            game_id: task.gameId,
            opponent_team_id: task.opponentId,
            matchup_grade: task.matchup.grade,
            ...projections
          });
        })
      );
    }

    if (upserts.length === 0) {
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
    const result = await processDate(date);
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = ((durationMs % 60000) / 1000).toFixed(2);
    const executionTime = `${minutes}m ${seconds}s`;

    return res.status(result.status).json({ ...result.body, executionTime });
  } catch (err: any) {
    console.error("update-start-chart-projections error", err);
    return res
      .status(500)
      .json({ error: err?.message ?? "Failed to update projections" });
  }
};

export default withCronJobAudit(handler);
