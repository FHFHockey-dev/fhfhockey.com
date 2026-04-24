import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { getCurrentSeason, getTeams } from "lib/NHL/server";
import type { Team } from "lib/NHL/types";
import {
  buildGameDayTweetsLineupSourceFromTweet,
  buildGoalieStartSourceFromModel,
  buildGoalieStartSourceFromOfficialLineup,
  buildNhlLineupProjectionsUrl,
  buildTeamDirectory,
  fetchGameDayTweetOEmbedData,
  parseDailyFaceoffLineCombinationsPage,
  parseDailyFaceoffStartingGoaliesPage,
  parseGameDayTweetsGoaliesPage,
  parseGameDayTweetsLinesPage,
  parseNhlLineupProjectionsPage,
  selectBestGoalieStartSource,
  selectBestPregameLineupSource,
  toHistoricalLineSourceRow,
  toGoalieStartProvenanceSnapshotRow,
  toSourceProvenanceSnapshotRow,
  type ParsedPregameLineupSource,
  type HistoricalLineSourceRow,
  type RosterNameEntry,
  type SourceProvenanceSnapshotRow
} from "lib/sources/lineupSourceIngestion";
import adminOnly from "utils/adminOnlyMiddleware";

type ScheduledGameRow = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
};

function parseRequestedDate(value: string | string[] | undefined): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (typeof rawValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return rawValue;
  }
  return new Date().toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isPastReplayDate(requestedDate: string): boolean {
  return requestedDate < todayIsoDate();
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)"
    },
    cache: "no-store"
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return body;
}

async function fetchScheduledGamesForDate(args: {
  supabase: any;
  date: string;
}): Promise<ScheduledGameRow[]> {
  const { data, error } = await args.supabase
    .from("games")
    .select("id, date, homeTeamId, awayTeamId")
    .eq("date", args.date)
    .order("id", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as ScheduledGameRow[]).filter(
    (row) => Number.isFinite(row.homeTeamId) && Number.isFinite(row.awayTeamId)
  );
}

async function fetchRosterEntriesByTeam(args: {
  supabase: any;
  teamIds: number[];
  seasonId: number;
}): Promise<Map<number, RosterNameEntry[]>> {
  const { data, error } = await args.supabase
    .from("rosters")
    .select("teamId, playerId, is_current, players!inner(fullName, lastName)")
    .in("teamId", args.teamIds)
    .eq("seasonId", args.seasonId);

  if (error) throw error;

  const result = new Map<number, RosterNameEntry[]>();
  for (const row of data ?? []) {
    const teamId = Number((row as any).teamId);
    if (!Number.isFinite(teamId)) continue;
    const entry: RosterNameEntry = {
      playerId: Number((row as any).playerId),
      fullName: String((row as any).players?.fullName ?? ""),
      lastName: String((row as any).players?.lastName ?? "")
    };
    if (!result.has(teamId)) {
      result.set(teamId, []);
    }
    result.get(teamId)?.push(entry);
  }

  return result;
}

async function fetchTopGoalieModelRowsByTeamGame(args: {
  supabase: any;
  gameIds: number[];
}): Promise<Map<string, any>> {
  const { data, error } = await args.supabase
    .from("goalie_start_projections")
    .select("game_id, team_id, player_id, start_probability, updated_at")
    .in("game_id", args.gameIds)
    .order("start_probability", { ascending: false });

  if (error) throw error;

  const result = new Map<string, any>();
  for (const row of data ?? []) {
    const gameId = Number((row as any).game_id);
    const teamId = Number((row as any).team_id);
    if (!Number.isFinite(gameId) || !Number.isFinite(teamId)) continue;
    const key = `${gameId}:${teamId}`;
    if (!result.has(key)) {
      result.set(key, row);
    }
  }
  return result;
}

export default withCronJobAudit(
  adminOnly(async (req, res) => {
    try {
      const requestedDate = parseRequestedDate(req.query.date);
      if (isPastReplayDate(requestedDate)) {
        return res.status(400).json({
          success: false,
          date: requestedDate,
          message:
            "Historical replay is blocked for lineup source ingestion. NHL.com, DailyFaceoff, and GameDayTweets are current-state sources, so replaying past dates would create dishonest history.",
          note:
            "Use this route only for same-day or forward-looking prospective archiving. Historical sweeps are intentionally rejected."
        });
      }
      const currentSeason = await getCurrentSeason();
      const teams = await getTeams(currentSeason.seasonId);
      const teamDirectory = buildTeamDirectory(teams);

      const scheduledGames = await fetchScheduledGamesForDate({
        supabase: req.supabase,
        date: requestedDate
      });

      const scheduledTeamIds = Array.from(
        new Set(scheduledGames.flatMap((game) => [game.homeTeamId, game.awayTeamId]))
      );

      if (scheduledTeamIds.length === 0) {
        return res.json({
          success: true,
          date: requestedDate,
          rowsUpserted: 0,
          message: "No scheduled games found for requested date."
        });
      }

      const rosterByTeam = await fetchRosterEntriesByTeam({
        supabase: req.supabase,
        teamIds: scheduledTeamIds,
        seasonId: currentSeason.seasonId
      });
      const goalieModelByTeamGame = await fetchTopGoalieModelRowsByTeamGame({
        supabase: req.supabase,
        gameIds: scheduledGames.map((game) => game.id)
      });

      const officialUrl = buildNhlLineupProjectionsUrl(currentSeason.seasonId);
      const officialHtml = await fetchHtml(officialUrl);
      const officialLineups = parseNhlLineupProjectionsPage({
        html: officialHtml,
        teams: teamDirectory,
        sourceUrl: officialUrl,
        observedAt: new Date().toISOString(),
        rosterByTeam
      });
      const officialByTeamId = new Map(
        officialLineups.map((lineup) => [lineup.team.id, lineup])
      );
      const dailyFaceoffGoalieUrl = "https://www.dailyfaceoff.com/starting-goalies";
      const dailyFaceoffGoalieHtml = await fetchHtml(dailyFaceoffGoalieUrl);
      const dailyFaceoffGoalies = parseDailyFaceoffStartingGoaliesPage({
        html: dailyFaceoffGoalieHtml,
        teams: teamDirectory,
        rosterByTeam,
        sourceUrl: dailyFaceoffGoalieUrl
      });
      const dailyFaceoffGoalieByTeamId = new Map(
        dailyFaceoffGoalies.map((goalie) => [goalie.team.id, goalie])
      );
      const gameDayTweetsGoalieUrl = "https://www.gamedaytweets.com/goalies";
      const gameDayTweetsGoalieHtml = await fetchHtml(gameDayTweetsGoalieUrl);
      const gameDayTweetsGoalies = parseGameDayTweetsGoaliesPage({
        html: gameDayTweetsGoalieHtml,
        teams: teamDirectory,
        rosterByTeam,
        sourceUrl: gameDayTweetsGoalieUrl
      });
      const gameDayTweetsGoalieByTeamId = new Map(
        gameDayTweetsGoalies.map((goalie) => [goalie.team.id, goalie])
      );

      const gameIdByTeamId = new Map<number, number>();
      for (const game of scheduledGames) {
        gameIdByTeamId.set(game.homeTeamId, game.id);
        gameIdByTeamId.set(game.awayTeamId, game.id);
      }

      const rowsToUpsert: SourceProvenanceSnapshotRow[] = [];
      const lineRowsByTable: Record<"lines_nhl" | "lines_dfo" | "lines_gdl", HistoricalLineSourceRow[]> = {
        lines_nhl: [],
        lines_dfo: [],
        lines_gdl: []
      };
      const teamSummaries: Array<Record<string, unknown>> = [];

      for (const teamId of scheduledTeamIds) {
        const team = teamDirectory.find((entry) => entry.id === teamId);
        if (!team) continue;

        const rosterEntries = rosterByTeam.get(teamId) ?? [];
        const official = officialByTeamId.get(teamId) ?? null;

        const dfoUrl = `https://www.dailyfaceoff.com/teams/${team.slug}/line-combinations`;
        const dfoHtml = await fetchHtml(dfoUrl);
        const dailyFaceoff = parseDailyFaceoffLineCombinationsPage({
          html: dfoHtml,
          team,
          rosterEntries,
          sourceUrl: dfoUrl
        });

        const gameDayTweetsUrl = `https://www.gamedaytweets.com/lines?team=${team.abbreviation}`;
        const gameDayTweetsHtml = await fetchHtml(gameDayTweetsUrl);
        const parsedGameDayTweets = parseGameDayTweetsLinesPage({
          html: gameDayTweetsHtml,
          team,
          rosterEntries,
          sourceUrl: gameDayTweetsUrl
        });
        let gameDayTweets = parsedGameDayTweets.selectedLineup;
        if (gameDayTweets?.metadata?.tweetUrl && typeof gameDayTweets.metadata.tweetUrl === "string") {
          const enrichedTweet = await fetchGameDayTweetOEmbedData(
            String(gameDayTweets.metadata.tweetUrl)
          );
          const selectedTweet = parsedGameDayTweets.tweets.find(
            (tweet) => tweet.tweetUrl === String(gameDayTweets?.metadata?.tweetUrl)
          );
          if (selectedTweet && enrichedTweet?.text) {
            gameDayTweets =
              buildGameDayTweetsLineupSourceFromTweet({
                team,
                rosterEntries,
                sourceUrl: gameDayTweetsUrl,
                tweet: selectedTweet,
                enrichedText: enrichedTweet.text,
                enrichedPostedAt: enrichedTweet.postedAt,
                enrichedPostedLabel: enrichedTweet.postedLabel,
                enrichedSourceTweetUrl: enrichedTweet.sourceTweetUrl
              }) ?? gameDayTweets;
          }
        }
        const gameDayTweetCount = parsedGameDayTweets.tweets.length;

        const selected = selectBestPregameLineupSource([
          official,
          dailyFaceoff,
          gameDayTweets
        ]);
        const gameId = gameIdByTeamId.get(team.id) ?? null;

        const sources = [official, dailyFaceoff, gameDayTweets].filter(
          (source): source is ParsedPregameLineupSource => source != null
        );
        for (const source of sources) {
          rowsToUpsert.push(
            toSourceProvenanceSnapshotRow({
              snapshotDate: requestedDate,
              gameId,
              sourceType: "lineup",
              source,
              selectedSourceName: selected?.sourceName ?? null
            })
          );

          const lineRow = toHistoricalLineSourceRow({
            snapshotDate: requestedDate,
            gameId,
            source,
            rosterEntries
          });

          if (source.sourceName === "nhl.com") {
            lineRowsByTable.lines_nhl.push(lineRow);
          } else if (source.sourceName === "dailyfaceoff") {
            lineRowsByTable.lines_dfo.push(lineRow);
          } else if (source.sourceName === "gamedaytweets") {
            lineRowsByTable.lines_gdl.push(lineRow);
          }
        }

        const officialGoalie = official
          ? buildGoalieStartSourceFromOfficialLineup({
              lineupSource: official,
              rosterEntries
            })
          : null;
        const dailyFaceoffGoalie = dailyFaceoffGoalieByTeamId.get(team.id) ?? null;
        const gameDayTweetsGoalie = gameDayTweetsGoalieByTeamId.get(team.id) ?? null;
        const modelRow = gameId != null ? goalieModelByTeamGame.get(`${gameId}:${team.id}`) ?? null : null;
        const modelGoalie =
          modelRow != null
            ? buildGoalieStartSourceFromModel({
                team,
                sourceUrl: "/api/v1/db/update-goalie-projections-v2",
                goalieName:
                  rosterEntries.find(
                    (entry) => entry.playerId === Number((modelRow as any).player_id)
                  )?.fullName ?? "",
                goaliePlayerId: Number((modelRow as any).player_id),
                startProbability: Number((modelRow as any).start_probability ?? 0),
                observedAt: (modelRow as any).updated_at ?? null
              })
            : null;
        const selectedGoalie = selectBestGoalieStartSource([
          dailyFaceoffGoalie,
          gameDayTweetsGoalie,
          officialGoalie,
          modelGoalie
        ]);

        for (const source of [
          dailyFaceoffGoalie,
          gameDayTweetsGoalie,
          officialGoalie,
          modelGoalie
        ]) {
          if (!source) continue;
          const row = toGoalieStartProvenanceSnapshotRow({
            snapshotDate: requestedDate,
            gameId,
            source,
            selectedSourceName: selectedGoalie?.sourceName ?? null
          });
          if (row) {
            rowsToUpsert.push(row);
          }
        }

        teamSummaries.push({
          teamId: team.id,
          teamAbbreviation: team.abbreviation,
          selectedSource: selected?.sourceName ?? null,
          selectedGoalieSource: selectedGoalie?.sourceName ?? null,
          sourceStatuses: {
            official: official?.status ?? "missing",
            dailyFaceoff: dailyFaceoff.status,
            gameDayTweets: gameDayTweets?.status ?? "missing"
          },
          goalieStatuses: {
            official: officialGoalie?.startStatus ?? "missing",
            dailyFaceoff: dailyFaceoffGoalie?.startStatus ?? "missing",
            gameDayTweets: gameDayTweetsGoalie?.startStatus ?? "missing",
            model: modelGoalie?.startStatus ?? "missing"
          },
          validation: {
            officialMatched: official?.validation.matchedPlayerIds.length ?? 0,
            dailyFaceoffMatched: dailyFaceoff.validation.matchedPlayerIds.length,
            gameDayTweetsMatched: gameDayTweets?.validation.matchedPlayerIds.length ?? 0
          },
          gameDayTweetCount
        });
      }

      if (rowsToUpsert.length > 0) {
        const { error } = await req.supabase
          .from("source_provenance_snapshots" as any)
          .upsert(rowsToUpsert as any, {
            onConflict:
              "snapshot_date,source_type,entity_type,entity_id,source_name,game_id"
          });
        if (error) throw error;
      }

      for (const [tableName, rows] of Object.entries(lineRowsByTable) as Array<
        [keyof typeof lineRowsByTable, HistoricalLineSourceRow[]]
      >) {
        if (rows.length === 0) continue;
        const upsertRows =
          tableName === "lines_gdl"
            ? rows
            : rows.map(({ tweet_posted_at: _tweetPostedAt, ...row }) => row);
        const { error } = await req.supabase
          .from(tableName as any)
          .upsert(upsertRows as any, {
            onConflict: "capture_key"
          });
        if (error) throw error;
      }

      return res.json({
        success: true,
        date: requestedDate,
        rowsUpserted: rowsToUpsert.length,
        lineRowsUpserted: {
          lines_nhl: lineRowsByTable.lines_nhl.length,
          lines_dfo: lineRowsByTable.lines_dfo.length,
          lines_gdl: lineRowsByTable.lines_gdl.length
        },
        teamsProcessed: scheduledTeamIds.length,
        teamSummaries
      });
    } catch (error: any) {
      console.error("update-lineup-source-provenance error:", error);
      return res.status(500).json({
        success: false,
        error: error?.message ?? "Unknown error"
      });
    }
  }),
  {
    jobName: "/api/v1/db/update-lineup-source-provenance"
  }
);
