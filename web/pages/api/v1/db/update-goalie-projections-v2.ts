import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { teamsInfo } from "lib/teamsInfo";
import Fetch from "lib/cors-fetch";

// Helper to fetch current season info
async function fetchCurrentSeasonInfo() {
  const url = `https://api.nhle.com/stats/rest/en/season?sort=[{"property":"id","direction":"DESC"}]`;
  const response = await Fetch(url).then((res) => res.json());
  return response.data[0];
}

// Create a lookup map for team IDs to team info
const teamIdMap = Object.values(teamsInfo).reduce(
  (acc, team) => {
    acc[team.id] = team;
    return acc;
  },
  {} as Record<number, (typeof teamsInfo)[string]>
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to process items in batches with concurrency limit
async function processBatched<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    // Delay between batches to be nice to the API
    if (i + batchSize < items.length) await sleep(1000);
  }
  return results;
}

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["POST", "GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("Starting goalie projection update...");
    const currentSeason = await fetchCurrentSeasonInfo();
    const seasonStartDate = currentSeason.startDate.split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    // Optional limit parameter to control how many days to process
    const limitDays = req.query.limit
      ? parseInt(req.query.limit as string)
      : 30; // Default 30 days

    // 1. Determine Start Date for Processing
    const { data: lastProjection } = await supabase
      .from("goalie_start_projections" as any)
      .select("game_date")
      .order("game_date", { ascending: false })
      .limit(1)
      .single();

    let processingStartDate = seasonStartDate;

    if (lastProjection && (lastProjection as any).game_date) {
      processingStartDate = (lastProjection as any).game_date;
      console.log(
        `Found existing projections. Resuming/Overwriting from ${processingStartDate}`
      );
    } else {
      console.log(
        `No existing projections found. Starting from season start: ${seasonStartDate}`
      );
    }

    // 2. Fetch all games from processingStartDate to Today (inclusive)
    const { data: gamesToProcess, error: gamesError } = await supabase
      .from("games")
      .select("id, homeTeamId, awayTeamId, date")
      .gte("date", processingStartDate)
      .lte("date", today)
      .order("date", { ascending: true });

    if (gamesError) throw gamesError;
    if (!gamesToProcess || gamesToProcess.length === 0) {
      return res
        .status(200)
        .json({ message: "No games found to process in the date range." });
    }

    // Apply limit to the number of days processed
    const uniqueDates = Array.from(
      new Set(gamesToProcess.map((g) => g.date))
    ).sort();
    const datesToProcess = uniqueDates.slice(0, limitDays);
    const lastDateToProcess = datesToProcess[datesToProcess.length - 1];

    const filteredGames = gamesToProcess.filter(
      (g) => g.date <= lastDateToProcess
    );

    console.log(
      `Found ${gamesToProcess.length} games. Processing ${filteredGames.length} games from ${processingStartDate} to ${lastDateToProcess} (Limit: ${limitDays} days).`
    );

    // 3. Identify all teams involved
    const teamIds = new Set<number>();
    filteredGames.forEach((g) => {
      teamIds.add(g.homeTeamId);
      teamIds.add(g.awayTeamId);
    });

    console.log(`Fetching season logs for ${teamIds.size} teams...`);

    // 4. Fetch ALL goalie logs for these teams for the entire season (up to today)
    // We do this ONCE per team to avoid N^2 API calls
    const teamLogsMap: Record<number, any[]> = {};

    await processBatched(Array.from(teamIds), 5, async (teamId) => {
      const teamData = teamIdMap[teamId];
      if (!teamData) return;

      const franchiseId = teamData.franchiseId;
      const params = new URLSearchParams();
      params.append("isGame", "true");
      params.append("start", "0");
      params.append("limit", "200"); // Cover full season
      params.append("factCayenneExp", "gamesPlayed>=1");
      // Fetch everything from season start up to today (or lastDateToProcess to be safe, but today is fine)
      params.append(
        "cayenneExp",
        `franchiseId=${franchiseId} and gameDate>="${seasonStartDate}" and gameTypeId=2`
      );

      const queryString = params.toString().replace(/\+/g, "%20");
      const url = `https://api.nhle.com/stats/rest/en/goalie/summary?${queryString}`;

      try {
        const res = await Fetch(url);
        if (res.ok) {
          const json = await res.json();
          teamLogsMap[teamId] = json.data || [];
        } else {
          console.error(
            `Failed to fetch logs for team ${teamId}: ${res.status}`
          );
        }
      } catch (e) {
        console.error(`Error fetching logs for team ${teamId}:`, e);
      }
    });

    console.log("Finished fetching team logs. Starting processing...");

    let totalUpserted = 0;
    const updates: any[] = [];

    // 5. Process Games
    for (const game of filteredGames) {
      for (const type of ["home", "away"] as const) {
        const teamId = type === "home" ? game.homeTeamId : game.awayTeamId;
        const allLogs = teamLogsMap[teamId] || [];

        // Filter logs: Only games played BEFORE or ON the current game date
        // But wait, for "Season Stats" we want stats UP TO this game?
        // Usually projections are based on stats *prior* to the game.
        // But the original script used `gameDate <= game.date`.
        // If we include the current game in the stats, we are "peeking" at the result if the game is already played.
        // However, the original script said: "User wants 'rolling tally' including the current game for the stats columns"
        // So we will stick to that logic: `log.gameDate <= game.date`.

        const logsForStats = allLogs.filter(
          (log: any) => log.gameDate <= game.date
        );
        const currentLogs = allLogs.filter(
          (log: any) => log.gameDate === game.date
        );

        // Calculate Season Stats
        const uniqueDates = new Set(logsForStats.map((l: any) => l.gameDate));
        const totalSeasonGames = uniqueDates.size;

        // Calculate L10 Window
        // Get unique dates sorted descending
        const sortedDates = Array.from(uniqueDates).sort().reverse();
        // Take top 10
        const l10Dates = new Set(sortedDates.slice(0, 10));

        const l10Logs = logsForStats.filter((log: any) =>
          l10Dates.has(log.gameDate)
        );
        const totalL10Games = l10Dates.size;

        // Group stats by player
        const playerStats: Record<number, any> = {};

        logsForStats.forEach((log: any) => {
          if (!playerStats[log.playerId]) {
            playerStats[log.playerId] = {
              name: log.goalieFullName,
              seasonStarts: 0,
              l10Starts: 0,
              gamesPlayed: 0,
              saves: 0,
              shots: 0,
              minutes: 0
            };
          }
          playerStats[log.playerId].seasonStarts += log.gamesStarted;
          playerStats[log.playerId].gamesPlayed += log.gamesPlayed;
          playerStats[log.playerId].saves += log.saves;
          playerStats[log.playerId].shots += log.shotsAgainst;
          playerStats[log.playerId].minutes += log.timeOnIce / 60;
        });

        l10Logs.forEach((log: any) => {
          if (playerStats[log.playerId]) {
            playerStats[log.playerId].l10Starts += log.gamesStarted;
          }
        });

        for (const playerIdStr in playerStats) {
          const stats = playerStats[playerIdStr];
          const playerId = parseInt(playerIdStr);

          const seasonPct =
            totalSeasonGames > 0 ? stats.seasonStarts / totalSeasonGames : 0;
          const l10Pct =
            totalL10Games > 0 ? stats.l10Starts / totalL10Games : 0;
          const startProb = l10Pct; // Primary metric

          const leagueSvPct = 0.9;
          const gsaa = stats.saves - stats.shots * leagueSvPct;
          const gsaaPer60 = stats.minutes > 0 ? (gsaa / stats.minutes) * 60 : 0;

          updates.push({
            game_id: game.id,
            game_date: game.date,
            team_id: teamId,
            player_id: playerId,
            start_probability: startProb,
            l10_start_pct: l10Pct,
            season_start_pct: seasonPct,
            games_played: stats.gamesPlayed,
            projected_gsaa_per_60: gsaaPer60,
            confirmed_status: false
          });
        }
      }
    }

    // 6. Batch Upsert
    if (updates.length > 0) {
      console.log(`Upserting ${updates.length} records...`);
      // Upsert in chunks of 1000 to avoid payload limits
      await processBatched(updates, 1000, async (batch) => {
        const { error } = await supabase
          .from("goalie_start_projections" as any)
          .upsert(batch, { onConflict: "game_id, player_id" });
        if (error) console.error("Upsert error:", error);
      });
      totalUpserted = updates.length;
    }

    return res.status(200).json({
      success: true,
      message: `Updated projections. Total upserted: ${totalUpserted}`,
      updates: totalUpserted
    });
  } catch (err: any) {
    console.error("Error updating goalie projections:", err);
    return res.status(500).json({ error: err.message });
  }
};

export default withCronJobAudit(handler);
