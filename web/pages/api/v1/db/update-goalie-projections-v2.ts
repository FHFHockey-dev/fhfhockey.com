import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase";
import { teamsInfo } from "lib/teamsInfo";
import Fetch from "lib/cors-fetch";

// Helper to fetch current season info
async function fetchCurrentSeasonInfo() {
  const url = `https://api.nhle.com/stats/rest/en/season?sort=[{"property":"id","direction":"DESC"}]`;
  const response = await Fetch(url).then((res) => res.json());
  return response.data[0];
}

// Helper to fetch game dates for a team
async function fetchGameDatesForTeam(teamAbbrev: string, seasonId: number) {
  const url = `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbrev}/${seasonId}`;
  try {
    const response = await Fetch(url).then((res) => res.json());
    return response.games
      .filter((game: any) => game.gameType === 2)
      .map((game: any) => game.gameDate.split("T")[0]);
  } catch (error) {
    console.error(`Failed to fetch games for ${teamAbbrev}:`, error);
    return [];
  }
}

// Create a lookup map for team IDs to team info
const teamIdMap = Object.values(teamsInfo).reduce(
  (acc, team) => {
    acc[team.id] = team;
    return acc;
  },
  {} as Record<number, (typeof teamsInfo)[string]>
);

// Helper to calculate start date for L10 games relative to a specific game date
function calculateStartDate(gameDates: string[], targetDate: string) {
  // Filter for games that happened BEFORE the target date
  const pastGames = gameDates
    .filter((date) => date < targetDate)
    .sort((a, b) => b.localeCompare(a)); // Newest first

  if (pastGames.length === 0) return null;

  // Get the 10th most recent game (index 9), or the oldest if fewer than 10
  const index = Math.min(9, pastGames.length - 1);
  return pastGames[index];
}

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
    if (i + batchSize < items.length) await sleep(2000);
  }
  return results;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["POST", "GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("Starting goalie projection update...");
    const currentSeason = await fetchCurrentSeasonInfo();
    const seasonId = currentSeason.id;
    const seasonStartDate = currentSeason.startDate.split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    // 1. Determine Start Date for Processing
    // Check the most recent game_date in our projections table to see where we left off.
    const { data: lastProjection } = await supabase
      .from("goalie_start_projections" as any)
      .select("game_date")
      .order("game_date", { ascending: false })
      .limit(1)
      .single();

    let processingStartDate = seasonStartDate;

    // If we have data, start from the date of the last projection (to overwrite/update it)
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
      .lte("date", today) // Up to today
      .order("date", { ascending: true });

    if (gamesError) throw gamesError;
    if (!gamesToProcess || gamesToProcess.length === 0) {
      return res
        .status(200)
        .json({ message: "No games found to process in the date range." });
    }

    console.log(
      `Found ${gamesToProcess.length} games to process from ${processingStartDate} to ${today}.`
    );

    // Group games by date
    const gamesByDate: Record<string, typeof gamesToProcess> = {};
    for (const game of gamesToProcess) {
      if (!gamesByDate[game.date]) {
        gamesByDate[game.date] = [];
      }
      gamesByDate[game.date].push(game);
    }

    const sortedDates = Object.keys(gamesByDate).sort();
    const teamSchedules: Record<string, string[]> = {};
    let totalUpserted = 0;
    const loopStart = Date.now();

    // 3. Process Day by Day
    for (const date of sortedDates) {
      const dateStart = Date.now();
      const gamesOnDate = gamesByDate[date];
      const tasks = [];

      // Prepare tasks (Team + Game context)
      for (const game of gamesOnDate) {
        tasks.push({ game, teamId: game.homeTeamId, type: "home" });
        tasks.push({ game, teamId: game.awayTeamId, type: "away" });
      }

      console.log(`[${date}] Processing ${tasks.length} team-games...`);

      // Process tasks in parallel batches
      const results = await processBatched(
        tasks,
        2,
        async ({ game, teamId }) => {
          try {
            const teamData = teamIdMap[teamId];
            if (!teamData) {
              console.warn(`Team ID ${teamId} not found in teamsInfo.`);
              return [];
            }

            const abbreviation = teamData.abbrev;
            const franchiseId = teamData.franchiseId;

            // Fetch schedule if not cached
            if (!teamSchedules[abbreviation]) {
              teamSchedules[abbreviation] = await fetchGameDatesForTeam(
                abbreviation,
                seasonId
              );
            }

            // Calculate L10 Window
            let startDate = calculateStartDate(
              teamSchedules[abbreviation],
              game.date
            );

            // If no past games (start of season), use season start date or game date
            if (!startDate) {
              startDate = seasonStartDate;
            }

            // Fetch Goalie Stats (Season to Date + Current Game)
            // We fetch individual game logs (no aggregation) to calculate both Season and L10 stats
            const params = new URLSearchParams();
            params.append("isGame", "true");
            params.append("start", "0");
            params.append("limit", "200"); // Cover full season of games
            params.append("factCayenneExp", "gamesPlayed>=1");
            params.append(
              "cayenneExp",
              `franchiseId=${franchiseId} and gameDate<="${game.date}" and gameDate>="${seasonStartDate}" and gameTypeId=2`
            );

            const queryString = params.toString().replace(/\+/g, "%20");
            const url = `https://api.nhle.com/stats/rest/en/goalie/summary?${queryString}`;

            let res;
            let attempts = 0;
            while (attempts < 5) {
              // Add jitter/delay to avoid thundering herd with concurrency
              await sleep(1000 + Math.random() * 1000);

              try {
                res = await Fetch(url);
                if (res.status === 429) {
                  console.warn(
                    `Rate limited (429) for ${abbreviation} on ${game.date}. Retrying (Attempt ${attempts + 1})...`
                  );
                  await sleep(2000 * (attempts + 1));
                  attempts++;
                } else if (res.status >= 500) {
                  console.warn(
                    `Server error (${res.status}) for ${abbreviation} on ${game.date}. Retrying (Attempt ${attempts + 1})...`
                  );
                  await sleep(1000 * (attempts + 1));
                  attempts++;
                } else {
                  break;
                }
              } catch (e) {
                console.error(
                  `Network error fetching ${abbreviation} on ${game.date}:`,
                  e
                );
                await sleep(1000);
                attempts++;
              }
            }

            if (!res || !res.ok) {
              const status = res ? res.status : "No Response";
              const text = res ? await res.text() : "Unknown error";
              console.error(
                `Failed to fetch goalie stats for ${abbreviation} on ${game.date}. Status: ${status}. Response: ${text.slice(0, 200)}`
              );
              return [];
            }

            const goalieStatsRes = await res.json();
            const allLogs = goalieStatsRes.data || [];

            // Split logs into Past (for projection) and Current (for actual result)
            // Split logs into Past (for projection) and Current (for actual result)
            // User wants "rolling tally" including the current game for the stats columns
            const logsForStats = allLogs; // Includes current game if played
            const currentLogs = allLogs.filter(
              (log: any) => log.gameDate === game.date
            );

            // 1. Calculate Season Stats
            // Count unique gameDates to get total team games played
            const uniqueDates = new Set(
              logsForStats.map((l: any) => l.gameDate)
            );
            const totalSeasonGames = uniqueDates.size;

            // 2. Calculate L10 Stats
            // We already have startDate for L10 window
            const l10Logs = logsForStats.filter(
              (log: any) => log.gameDate >= startDate!
            );
            const uniqueL10Dates = new Set(l10Logs.map((l: any) => l.gameDate));
            const totalL10Games = uniqueL10Dates.size;

            // Group stats by player
            const playerStats: Record<number, any> = {};

            // Initialize with all goalies found in history
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

            // Add L10 starts
            l10Logs.forEach((log: any) => {
              if (playerStats[log.playerId]) {
                playerStats[log.playerId].l10Starts += log.gamesStarted;
              }
            });

            const teamUpdates = [];
            let projectedStarterName = "Unknown";
            let maxProb = -1;

            for (const playerIdStr in playerStats) {
              const stats = playerStats[playerIdStr];
              const playerId = parseInt(playerIdStr);

              // Calculate Percentages
              const seasonPct =
                totalSeasonGames > 0
                  ? stats.seasonStarts / totalSeasonGames
                  : 0;
              const l10Pct =
                totalL10Games > 0 ? stats.l10Starts / totalL10Games : 0;

              // Use L10 % as the primary start probability, fallback to Season % if L10 is 0 (e.g. start of season)
              // or maybe just use L10. Let's use L10 as requested for "10 game start percentage".
              // If totalL10Games is 0 (first game), probability is 0.
              const startProb = l10Pct;

              if (startProb > maxProb) {
                maxProb = startProb;
                projectedStarterName = stats.name;
              }

              // Calculate GSAA/60 (Season Aggregate)
              const leagueSvPct = 0.9;
              const gsaa = stats.saves - stats.shots * leagueSvPct;
              const gsaaPer60 =
                stats.minutes > 0 ? (gsaa / stats.minutes) * 60 : 0;

              teamUpdates.push({
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

            // Determine Actual Starter (for logging)
            const actualStarterLog = currentLogs.find(
              (l: any) => l.gamesStarted > 0
            );
            const actualStarter = actualStarterLog
              ? actualStarterLog.goalieFullName
              : "TBD/Unknown";

            console.log(
              `[${game.date}] ${abbreviation}: Projected ${projectedStarterName} (${(maxProb * 100).toFixed(0)}%). Actual: ${actualStarter}. (Season G: ${totalSeasonGames}, L10 G: ${totalL10Games})`
            );

            return teamUpdates;
          } catch (err) {
            console.error(
              `Error processing team ${teamId} for game ${game.id}:`,
              err
            );
            return [];
          }
        }
      );

      const flatUpdates = results.flat();

      if (flatUpdates.length > 0) {
        const { error: upsertError } = await supabase
          .from("goalie_start_projections" as any)
          .upsert(flatUpdates, { onConflict: "game_id, player_id" });

        if (upsertError) {
          console.error(`Error upserting for date ${date}:`, upsertError);
        } else {
          totalUpserted += flatUpdates.length;
        }
      }

      const duration = ((Date.now() - dateStart) / 1000).toFixed(2);
      console.log(
        `[${date}] Completed. Processed: ${tasks.length}, Upserted: ${flatUpdates.length}. Took ${duration}s`
      );
    }

    const totalDuration = ((Date.now() - loopStart) / 1000).toFixed(2);
    console.log(`Total processing time: ${totalDuration}s`);

    return res.status(200).json({
      success: true,
      message: `Updated projections. Total upserted: ${totalUpserted}`,
      updates: totalUpserted
    });
  } catch (err: any) {
    console.error("Error updating goalie projections:", err);
    return res.status(500).json({ error: err.message });
  }
}
