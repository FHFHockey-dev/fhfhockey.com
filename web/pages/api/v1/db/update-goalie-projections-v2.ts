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
    // Check the most recent game_id in our projections table to see where we left off.
    // We join with games table to get the date.
    const { data: lastProjection } = await supabase
      .from("goalie_start_projections" as any)
      .select("game_id, games(date)")
      .order("game_id", { ascending: false }) // Assuming higher game_id = later date, but date sort is safer if we could
      .limit(1)
      .single();

    let processingStartDate = seasonStartDate;

    // If we have data, start from the date of the last projection (to overwrite/update it)
    // or the day after? The prompt says "overwrite most recent date".
    if (lastProjection && (lastProjection as any).games) {
      processingStartDate = (lastProjection as any).games.date;
      console.log(
        `Found existing projections. Resuming/Overwriting from ${processingStartDate}`
      );
    } else {
      console.log(
        `No existing projections found. Starting from season start: ${seasonStartDate}`
      );
    }

    // 2. Fetch all games from processingStartDate to Today (inclusive)
    // We need to process day-by-day to ensure the "L10" window is correct for THAT day.
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

    const updates = [];

    // Cache team schedules to avoid re-fetching for every game
    const teamSchedules: Record<string, string[]> = {};

    for (const game of gamesToProcess) {
      const teams = [game.homeTeamId, game.awayTeamId];

      for (const teamId of teams) {
        // Get team info from local map
        const teamData = teamIdMap[teamId];

        if (!teamData) {
          console.warn(`Team ID ${teamId} not found in teamsInfo.`);
          continue;
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

        // 1. Calculate L10 Window relative to THIS game's date
        const startDate = calculateStartDate(
          teamSchedules[abbreviation],
          game.date
        );

        if (!startDate) {
          // console.log(`No past games found for ${abbreviation} before ${game.date}`);
          continue;
        }

        // 2. Fetch Goalie Stats for L10 window
        // Note: gameDate < game.date ensures we only look at PAST games relative to the game being predicted
        const params = new URLSearchParams();
        params.append("isAggregate", "true");
        params.append("isGame", "true");
        params.append("start", "0");
        params.append("limit", "50");
        params.append("factCayenneExp", "gamesPlayed>=1");
        params.append(
          "cayenneExp",
          `franchiseId=${franchiseId} and gameDate<"${game.date}" and gameDate>="${startDate}" and gameTypeId=2`
        );

        const queryString = params.toString().replace(/\+/g, "%20");
        const url = `https://api.nhle.com/stats/rest/en/goalie/summary?${queryString}`;

        let res;
        let attempts = 0;
        while (attempts < 3) {
          // Add a small delay to avoid rate limiting
          await sleep(250);
          res = await Fetch(url);
          if (res.status === 429) {
            console.warn(`Rate limited (429). Retrying in 2s...`);
            await sleep(2000);
            attempts++;
          } else {
            break;
          }
        }

        if (!res || !res.ok) {
          console.error(`Failed to fetch goalie stats. URL: ${url}`);
          const text = res ? await res.text() : "No response";
          throw new Error(
            `NHL API Error: ${res?.status} - ${text.substring(0, 100)}`
          );
        }
        const goalieStatsRes = await res.json();
        const goalieStats = goalieStatsRes.data || [];

        // 3. Calculate Shares
        const totalStarts = goalieStats.reduce(
          (sum: number, g: any) => sum + g.gamesStarted,
          0
        );

        for (const goalie of goalieStats) {
          const startProb =
            totalStarts > 0 ? goalie.gamesStarted / totalStarts : 0;

          // Calculate GSAA/60 (Simplified)
          const leagueSvPct = 0.9;
          const gsaa = goalie.saves - goalie.shotsAgainst * leagueSvPct;
          const minutes = goalie.timeOnIce / 60;
          const gsaaPer60 = minutes > 0 ? (gsaa / minutes) * 60 : 0;

          updates.push({
            game_id: game.id,
            team_id: teamId,
            player_id: goalie.playerId,
            start_probability: startProb,
            projected_gsaa_per_60: gsaaPer60,
            confirmed_status: false // Default
          });
        }
      }
    }

    // 4. Bulk Upsert
    if (updates.length > 0) {
      const { error: upsertError } = await supabase
        .from("goalie_start_projections" as any)
        .upsert(updates, { onConflict: "game_id, player_id" });

      if (upsertError) throw upsertError;
    }

    return res.status(200).json({
      success: true,
      message: `Updated projections for ${updates.length} goalie-game combinations.`,
      updates: updates.length
    });
  } catch (err: any) {
    console.error("Error updating goalie projections:", err);
    return res.status(500).json({ error: err.message });
  }
}
