import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { getCurrentSeason, getTeams } from "lib/NHL/server";
import {
  buildTeamDirectory,
  type RosterNameEntry
} from "lib/sources/lineupSourceIngestion";
import {
  buildLinesCccSourceFromIftttEvent,
  toLinesCccRow,
  type LinesCccIftttEventInput
} from "lib/sources/linesCccIngestion";
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

function parseBatchSize(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : 25;
  if (!Number.isFinite(parsed)) return 25;
  return Math.min(Math.max(parsed, 1), 100);
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
  if (args.teamIds.length === 0) return new Map();

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

function extractTweetId(value: string | null): string | null {
  if (!value) return null;
  return value.match(/\/status(?:es)?\/(\d+)/i)?.[1] ?? null;
}

function normalizeTweetUrl(value: string | null, tweetId: string | null): string | null {
  if (value) {
    const id = extractTweetId(value);
    if (id) return `https://twitter.com/i/web/status/${id}`;
  }
  return tweetId ? `https://twitter.com/i/web/status/${tweetId}` : null;
}

async function fetchPendingIftttEvents(args: {
  supabase: any;
  limit: number;
}): Promise<LinesCccIftttEventInput[]> {
  const { data, error } = await args.supabase
    .from("lines_ccc_ifttt_events")
    .select(
      "id, source, source_account, username, text, link_to_tweet, tweet_id, tweet_created_at, created_at_label, raw_payload, received_at"
    )
    .eq("processing_status", "pending")
    .order("received_at", { ascending: true })
    .limit(args.limit);

  if (error) throw error;

  return (data ?? []) as LinesCccIftttEventInput[];
}

export default withCronJobAudit(
  adminOnly(async (req, res) => {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({
        success: false,
        error: "Method not allowed"
      });
    }

    const batchSize = parseBatchSize(req.query.limit);
    const requestedDate = parseRequestedDate(req.query.date);
    const currentSeason = await getCurrentSeason();
    const teamDirectory = buildTeamDirectory(await getTeams(currentSeason.seasonId));
    const scheduledGames = await fetchScheduledGamesForDate({
      supabase: req.supabase,
      date: requestedDate
    });
    const scheduledTeamIds = Array.from(
      new Set(scheduledGames.flatMap((game) => [game.homeTeamId, game.awayTeamId]))
    );
    const rosterByTeam = await fetchRosterEntriesByTeam({
      supabase: req.supabase,
      teamIds: scheduledTeamIds,
      seasonId: currentSeason.seasonId
    });
    const gameIdByTeamId = new Map<number, number>();
    for (const game of scheduledGames) {
      gameIdByTeamId.set(game.homeTeamId, game.id);
      gameIdByTeamId.set(game.awayTeamId, game.id);
    }
    const pendingEvents = await fetchPendingIftttEvents({
      supabase: req.supabase,
      limit: batchSize
    });
    const discoveredTweets = pendingEvents
      .map((event) => ({
        eventId: event.id,
        tweetId: event.tweet_id ?? extractTweetId(event.link_to_tweet),
        tweetUrl: normalizeTweetUrl(event.link_to_tweet, event.tweet_id),
        sourceAccount: event.source_account,
        username: event.username
      }))
      .filter((tweet) => tweet.tweetUrl != null || tweet.tweetId != null);
    const parsedCandidates = pendingEvents.map((event) =>
      buildLinesCccSourceFromIftttEvent({
        event,
        snapshotDate: requestedDate,
        teams: teamDirectory,
        rosterByTeam,
        gameIdByTeamId
      })
    );
    const rowsToUpsert = parsedCandidates.map((candidate) =>
      toLinesCccRow({
        source: candidate,
        rosterEntries: candidate.team ? rosterByTeam.get(candidate.team.id) ?? [] : []
      })
    );
    const parsedSummary = parsedCandidates.reduce(
      (summary, candidate) => {
        summary.total += 1;
        summary.byFilterStatus[candidate.nhlFilterStatus] =
          (summary.byFilterStatus[candidate.nhlFilterStatus] ?? 0) + 1;
        summary.byClassification[candidate.classification ?? "unknown"] =
          (summary.byClassification[candidate.classification ?? "unknown"] ?? 0) + 1;
        return summary;
      },
      {
        total: 0,
        byFilterStatus: {} as Record<string, number>,
        byClassification: {} as Record<string, number>
      }
    );

    if (rowsToUpsert.length > 0) {
      const { error } = await req.supabase
        .from("lines_ccc" as any)
        .upsert(rowsToUpsert as any, {
          onConflict: "capture_key"
        });
      if (error) throw error;
    }
    const processedEventUpdates = parsedCandidates.map((candidate, index) => {
      const event = pendingEvents[index]!;
      return {
        id: event.id,
        processing_status:
          candidate.nhlFilterStatus === "accepted" ? "processed" : "rejected",
        raw_payload: {
          ...(event.raw_payload ?? {}),
          linesCccProcessing: {
            processedAt: new Date().toISOString(),
            captureKey: rowsToUpsert[index]?.capture_key ?? null,
            classification: candidate.classification,
            detectedLeague: candidate.detectedLeague,
            nhlFilterStatus: candidate.nhlFilterStatus,
            nhlFilterReason: candidate.nhlFilterReason,
            teamId: candidate.team?.id ?? null,
            teamAbbreviation: candidate.team?.abbreviation ?? null
          }
        },
        updated_at: new Date().toISOString()
      };
    });

    for (const update of processedEventUpdates) {
      const { error } = await req.supabase
        .from("lines_ccc_ifttt_events" as any)
        .update({
          processing_status: update.processing_status,
          raw_payload: update.raw_payload,
          updated_at: update.updated_at
        })
        .eq("id", update.id);
      if (error) throw error;
    }

    return res.json({
      success: true,
      route: "/api/v1/db/update-lines-ccc",
      date: requestedDate,
      batchSize,
      seasonId: currentSeason.seasonId,
      teamsLoaded: teamDirectory.length,
      scheduledGamesLoaded: scheduledGames.length,
      scheduledTeamsLoaded: scheduledTeamIds.length,
      rosterTeamsLoaded: rosterByTeam.size,
      gameTeamLinksLoaded: gameIdByTeamId.size,
      pendingEventsLoaded: pendingEvents.length,
      concreteTweetUrlsDiscovered: discoveredTweets.length,
      rowsUpserted: rowsToUpsert.length,
      eventsProcessed: processedEventUpdates.filter(
        (event) => event.processing_status === "processed"
      ).length,
      eventsRejected: processedEventUpdates.filter(
        (event) => event.processing_status === "rejected"
      ).length,
      discoveredTweets,
      parsedSummary,
      parsedCandidates: parsedCandidates.map((candidate) => ({
        tweetId: candidate.tweetId,
        teamId: candidate.team?.id ?? null,
        teamAbbreviation: candidate.team?.abbreviation ?? null,
        classification: candidate.classification,
        detectedLeague: candidate.detectedLeague,
        nhlFilterStatus: candidate.nhlFilterStatus,
        nhlFilterReason: candidate.nhlFilterReason,
        goalies: candidate.goalies,
        matchedPlayerIds: candidate.matchedPlayerIds
      })),
      message:
        "lines_ccc processor route parsed pending events, upserted rows, and updated source event statuses."
    });
  }),
  {
    jobName: "/api/v1/db/update-lines-ccc"
  }
);
