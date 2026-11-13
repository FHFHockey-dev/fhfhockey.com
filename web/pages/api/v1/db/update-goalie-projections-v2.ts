import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import { getSeasonLeagueSavePct, type SeasonLeagueSavePctCache } from "lib/projections/goalie/leagueSavePct";
import { GOALIE_START_TABLE_OWNERSHIP } from "lib/projections/compatibilityInventory";
import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { teamsInfo } from "lib/teamsInfo";
import Fetch from "lib/cors-fetch";
import { buildNhlStatsScoringGameTypeCayenne } from "lib/NHL/playoffs";
import adminOnly from "utils/adminOnlyMiddleware";

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

export async function upsertGoalieProjectionRows(
  client: Pick<typeof supabase, "from">,
  updates: any[],
  chunkSize = 1000
) {
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    throw new Error("Goalie projection chunk size must be a positive integer.");
  }
  // Validate the complete write set before splitting it: otherwise a duplicate
  // across chunks silently overwrites the first team's row instead of failing.
  const identities = new Set<string>();
  for (const row of updates) {
    if (!Number.isSafeInteger(row.game_id) || row.game_id <= 0
      || !Number.isSafeInteger(row.player_id) || row.player_id <= 0) {
      throw new Error("Goalie projection has an invalid game/player identity.");
    }
    const key = `${row.game_id}:${row.player_id}`;
    if (identities.has(key)) throw new Error(`Duplicate goalie projection identity: ${key}. No rows written.`);
    identities.add(key);
  }

  let rowsUpserted = 0;
  const failures: Array<{
    stage: "goalie_start_projections_upsert";
    batchIndex: number;
    rows: number;
    error: string;
  }> = [];

  for (let offset = 0; offset < updates.length; offset += chunkSize) {
    const batch = updates.slice(offset, offset + chunkSize);
    const { error } = await client
      .from("goalie_start_projections" as any)
      .upsert(batch, { onConflict: "game_id, player_id" });

    if (error) {
      failures.push({
        stage: "goalie_start_projections_upsert",
        batchIndex: Math.floor(offset / chunkSize),
        rows: batch.length,
        error: error.message
      });
      continue;
    }

    rowsUpserted += batch.length;
  }

  return {
    rowsUpserted,
    failedRows: failures.reduce((sum, failure) => sum + failure.rows, 0),
    failures
  };
}

/** Remove only rejected source candidates, after a complete replacement write.
 * The old team is part of every predicate: a traded goalie's valid new-team row
 * can share the game/player conflict key and must never be removed. */
export async function pruneIneligibleGoalieProjectionRows(
  client: Pick<typeof supabase, "from">,
  rejected: Array<{ game_id: number; team_id: number; player_id: number }>,
) {
  let rowsRemoved = 0;
  const failures: Array<{ stage: "goalie_start_projections_prune"; batchIndex: number; rows: number; error: string }> = [];
  const unique = [...new Map(rejected.map(row => [`${row.game_id}:${row.team_id}:${row.player_id}`, row])).values()];
  for (const row of unique) {
    if (![row.game_id, row.team_id, row.player_id].every(id => Number.isSafeInteger(id) && id > 0)) {
      throw new Error("Invalid rejected goalie identity. No rows removed.");
    }
  }
  for (const [batchIndex, row] of unique.entries()) {
    const { error, count } = await client.from("goalie_start_projections" as any)
      .delete({ count: "exact" }).eq("game_id", row.game_id).eq("team_id", row.team_id).eq("player_id", row.player_id);
    if (error || count === null || count === undefined) {
      failures.push({ stage: "goalie_start_projections_prune", batchIndex, rows: 1,
        error: error?.message ?? "Goalie stale-row removal count was not acknowledged." });
      break;
    }
    rowsRemoved += count;
  }
  return { rowsRemoved, failures };
}

/** Current roster membership is a team-identity filter, not a new goalie model.
 * Query all candidate players, including their new team when it has no game in
 * this window. Missing membership excludes a historical candidate; conflicting
 * current memberships fail closed rather than picking a home/away winner. */
async function fetchCurrentGoalieTeams(playerIds: number[], seasonId: number) {
  if (!Number.isSafeInteger(seasonId) || seasonId <= 0) throw new Error("Invalid goalie roster season.");
  const membership = new Map<number, number>();
  for (let offset = 0; offset < playerIds.length; offset += 100) {
    const ids = playerIds.slice(offset, offset + 100);
    const { data, error, count } = await supabase.from("rosters")
      .select("playerId,teamId", { count: "exact" })
      .eq("seasonId", seasonId).eq("is_current", true).in("playerId", ids).limit(500);
    if (error) throw error;
    if (!Array.isArray(data) || count === null || data.length !== count) {
      throw new Error("Current goalie roster membership was incomplete.");
    }
    for (const row of data) {
      if (!ids.includes(row.playerId) || !Number.isSafeInteger(row.teamId) || row.teamId <= 0
        || membership.has(row.playerId) && membership.get(row.playerId) !== row.teamId) {
        throw new Error(`Current goalie roster membership is ambiguous or invalid for player ${row.playerId}.`);
      }
      membership.set(row.playerId, row.teamId);
    }
  }
  return membership;
}

/** Historical refreshes must not apply today's roster retroactively. The latest
 * observed game before that date supplies identity only, not start odds. */
export function historicalGoalieTeams(teamLogs: Record<number, any[]>, date: string) {
  const latest = new Map<number, { date: string; teamId: number | null }>();
  for (const [team, logs] of Object.entries(teamLogs)) {
    for (const log of logs) {
      if (log.gameDate >= date) continue;
      const previous = latest.get(log.playerId);
      if (!previous || log.gameDate > previous.date) {
        latest.set(log.playerId, { date: log.gameDate, teamId: Number(team) });
      } else if (log.gameDate === previous.date && previous.teamId !== Number(team)) {
        previous.teamId = null;
      }
    }
  }
  return new Map([...latest].map(([playerId, value]) => [playerId, value.teamId]));
}

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["POST", "GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const today = new Date().toISOString().split("T")[0];
  // Optional last game date to project (inclusive), at most a week ahead so
  // future games stay bounded; defaults to today.
  const maxEndDate = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000)
    .toISOString()
    .split("T")[0];
  const endDate =
    typeof req.query.endDate === "string" ? req.query.endDate : today;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
    Number.isNaN(Date.parse(`${endDate}T00:00:00Z`)) ||
    new Date(`${endDate}T00:00:00Z`).toISOString().split("T")[0] !== endDate
  ) {
    return res
      .status(400)
      .json({ error: "endDate must be a valid YYYY-MM-DD date." });
  }
  if (endDate > maxEndDate) {
    return res
      .status(400)
      .json({ error: `endDate must be on or before ${maxEndDate}.` });
  }

  try {
    console.log("Starting goalie projection update...");
    const currentSeason = await fetchCurrentSeasonInfo();
    const seasonStartDate = currentSeason.startDate.split("T")[0];

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
      // Never resume after today: rows already written for future games must
      // not skip refreshing today's games with history through today.
      const lastGameDate: string = (lastProjection as any).game_date;
      processingStartDate = lastGameDate < today ? lastGameDate : today;
      console.log(
        `Found existing projections. Resuming/Overwriting from ${processingStartDate}`
      );
    } else {
      console.log(
        `No existing projections found. Starting from season start: ${seasonStartDate}`
      );
    }

    // 2. Fetch all games from processingStartDate to endDate (inclusive).
    // Future games use goalie logs through today.
    const { data: gamesToProcess, error: gamesError } = await supabase
      .from("games")
      .select("id, homeTeamId, awayTeamId, date")
      .gte("date", processingStartDate)
      .lte("date", endDate)
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
    let missingTeamMetadata = 0;
    let failedTeamLogFetches = 0;

    await processBatched(Array.from(teamIds), 5, async (teamId) => {
      const teamData = teamIdMap[teamId];
      if (!teamData) {
        missingTeamMetadata += 1;
        return;
      }

      const franchiseId = teamData.franchiseId;
      const params = new URLSearchParams();
      params.append("isGame", "true");
      params.append("start", "0");
      params.append("limit", "200"); // Cover full season
      params.append("factCayenneExp", "gamesPlayed>=1");
      // Fetch everything from season start up to today (or lastDateToProcess to be safe, but today is fine)
      params.append(
        "cayenneExp",
        `franchiseId=${franchiseId} and gameDate>="${seasonStartDate}" and gameDate<="${today}" and ${buildNhlStatsScoringGameTypeCayenne()}`
      );

      const queryString = params.toString().replace(/\+/g, "%20");
      const url = `https://api.nhle.com/stats/rest/en/goalie/summary?${queryString}`;

      try {
        const res = await Fetch(url);
        if (res.ok) {
          const json = await res.json();
          teamLogsMap[teamId] = json.data || [];
        } else {
          failedTeamLogFetches += 1;
          console.error(
            `Failed to fetch logs for team ${teamId}: ${res.status}`
          );
        }
      } catch (e) {
        failedTeamLogFetches += 1;
        console.error(`Error fetching logs for team ${teamId}:`, e);
      }
    });
    const teamsWithNoLogs = Array.from(teamIds).filter(
      (teamId) => (teamLogsMap[teamId]?.length ?? 0) === 0
    ).length;

    if (failedTeamLogFetches > 0 || missingTeamMetadata > 0) {
      throw new Error(`Goalie inputs incomplete: ${failedTeamLogFetches} team log fetches failed; ${missingTeamMetadata} teams lack metadata. No rows written.`);
    }
    const candidateIds = [...new Set(Object.values(teamLogsMap).flat().map(log => log.playerId))];
    const currentTeams = filteredGames.some(game => game.date >= today)
      ? await fetchCurrentGoalieTeams(candidateIds, Number(currentSeason.id))
      : new Map<number, number>();
    let excludedHistoricalCandidates = 0;

    console.log("Finished fetching team logs. Starting processing...");

    let totalUpserted = 0;
    let failedRows = 0;
    let rowsRemoved = 0;
    let databaseWriteFailures: Array<
      Awaited<ReturnType<typeof upsertGoalieProjectionRows>>["failures"][number]
      | Awaited<ReturnType<typeof pruneIneligibleGoalieProjectionRows>>["failures"][number]
    > = [];
    const updates: any[] = [];
    const rejected: Array<{ game_id: number; team_id: number; player_id: number }> = [];
    const missingGameTeams: Array<{ gameId: number; teamId: number }> = [];

    const leagueSavePctCache: SeasonLeagueSavePctCache = new Map();
    const leagueBaselines = new Map<string, Awaited<ReturnType<typeof getSeasonLeagueSavePct>>>();

    // 5. Process Games
    for (const game of filteredGames) {
      if (!leagueBaselines.has(game.date)) {
        leagueBaselines.set(game.date, await getSeasonLeagueSavePct(game.date, leagueSavePctCache));
      }
      const leagueSvPct = leagueBaselines.get(game.date)!.savePct;
      const eligibleTeams = game.date >= today ? currentTeams : historicalGoalieTeams(teamLogsMap, game.date);
      for (const type of ["home", "away"] as const) {
        const teamId = type === "home" ? game.homeTeamId : game.awayTeamId;
        const allLogs = teamLogsMap[teamId] || [];

        // Pregame shares and rates must exclude the target game's results.
        const logsForStats = allLogs.filter(
          (log: any) => log.gameDate < game.date
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

        const rowsBeforeTeam = updates.length;
        for (const playerIdStr in playerStats) {
          const stats = playerStats[playerIdStr];
          const playerId = parseInt(playerIdStr);
          if (eligibleTeams.get(playerId) === null) {
            throw new Error(`Ambiguous historical goalie team for player ${playerId} on ${game.date}. No rows written.`);
          }
          if (eligibleTeams.get(playerId) !== teamId) {
            excludedHistoricalCandidates += 1;
            rejected.push({ game_id: game.id, team_id: teamId, player_id: playerId });
            continue;
          }

          const seasonPct =
            totalSeasonGames > 0 ? stats.seasonStarts / totalSeasonGames : 0;
          const l10Pct =
            totalL10Games > 0 ? stats.l10Starts / totalL10Games : 0;
          // Compatibility column: this is the raw L10 start share, not a
          // calibrated probability. Start Chart labels it with this same basis.
          const startProb = l10Pct;
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
        if (updates.length === rowsBeforeTeam) missingGameTeams.push({ gameId: game.id, teamId });
      }
    }
    if (missingGameTeams.length > 0) {
      return res.status(422).json({
        success: false,
        error: "No eligible goalie history for one or more game teams. No rows written.",
        missingGameTeams: missingGameTeams.slice(0, 20),
        missingGameTeamCount: missingGameTeams.length,
        updates: 0,
      });
    }

    // 6. Batch Upsert
    if (updates.length > 0) {
      console.log(`Upserting ${updates.length} records...`);
      const upsertResult = await upsertGoalieProjectionRows(supabase, updates);
      totalUpserted = upsertResult.rowsUpserted;
      failedRows = upsertResult.failedRows;
      databaseWriteFailures = upsertResult.failures;
      if (databaseWriteFailures.length === 0 && rejected.length > 0) {
        const pruned = await pruneIneligibleGoalieProjectionRows(supabase, rejected);
        rowsRemoved = pruned.rowsRemoved;
        databaseWriteFailures.push(...pruned.failures);
      }
    }

    const statusCode = databaseWriteFailures.length > 0
      ? totalUpserted > 0
        ? 207
        : 500
      : 200;

    return res.status(statusCode).json({
      success: databaseWriteFailures.length === 0,
      message:
        databaseWriteFailures.length === 0
          ? `Updated projections. Total upserted: ${totalUpserted}`
          : `Goalie projection writes were incomplete: ${totalUpserted} upserted, ${failedRows} failed; ${databaseWriteFailures.length} write/reconciliation failures.`,
      updates: totalUpserted,
      rowsRemoved,
      failedRows,
      failures: databaseWriteFailures.slice(0, 10),
      ownershipDecision: GOALIE_START_TABLE_OWNERSHIP,
      observability: {
        startProbabilityBasis: "l10_start_share",
        leagueSavePctBaselines: Object.fromEntries(leagueBaselines),
        goalieRowsProcessed: totalUpserted,
        databaseWriteFailures: databaseWriteFailures.length,
        excludedHistoricalCandidates,
        dataQualityWarnings: [
          ...(filteredGames.length > 0 && totalUpserted === 0
            ? [
                {
                  code: "goalie_start_rows_zero",
                  message:
                    "Processed games but wrote zero goalie_start_projections rows."
                }
              ]
            : []),
          ...(teamsWithNoLogs > 0
            ? [
                {
                  code: "team_goalie_logs_missing",
                  message: "One or more teams had no goalie logs during fetch.",
                  detail: `teams_with_no_logs=${teamsWithNoLogs}`
                }
              ]
            : []),
          ...(failedTeamLogFetches > 0
            ? [
                {
                  code: "team_goalie_log_fetch_failed",
                  message: "Failed to fetch goalie logs for one or more teams.",
                  detail: `failed_fetches=${failedTeamLogFetches}`
                }
              ]
            : []),
          ...(missingTeamMetadata > 0
            ? [
                {
                  code: "team_metadata_missing",
                  message: "Team metadata missing for one or more team IDs.",
                  detail: `missing_team_metadata=${missingTeamMetadata}`
                }
              ]
            : [])
        ]
      }
    });
  } catch (err: any) {
    console.error("Error updating goalie projections:", err);
    return res.status(500).json({ error: err.message });
  }
};

export default withCronJobAudit(adminOnly(withNhlOffSeasonSkip(handler as any)));
