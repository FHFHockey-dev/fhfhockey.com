import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { getCurrentSeason, getTeams } from "lib/NHL/server";
import {
  buildTeamDirectory,
  type RosterNameEntry
} from "lib/sources/lineupSourceIngestion";
import {
  buildUnresolvedPlayerNameDedupeKey,
  mergePlayerNameAliasesIntoRoster,
  normalizePlayerNameAlias,
  type PlayerNameAliasRow
} from "lib/sources/playerNameAliases";
import {
  applyLinesCccWrapperOEmbed,
  applyQuotedTweetPreference,
  buildLinesCccWrapperOEmbedDeferredState,
  buildLinesCccWrapperOEmbedFailureState,
  buildLinesCccWrapperOEmbedSuccessState,
  buildLinesCccSourceFromIftttEvent,
  fetchLinesCccTweetOEmbedAttempt,
  readLinesCccWrapperOEmbedBackfillState,
  refreshLinesCccSourceFromPrimaryText,
  rejectInsufficientQuoteWrapper,
  resolveLinesCccQuotedTweet,
  shouldAttemptLinesCccWrapperOEmbedBackfill,
  toLinesCccTweetOEmbedDataFromBackfillState,
  toLinesCccRow,
  type ParsedLinesCccSource,
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

function parseBooleanFlag(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true" || rawValue === "yes";
}

function parseStringQueryValue(value: string | string[] | undefined): string | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === "string" && rawValue.trim() ? rawValue.trim() : null;
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

async function fetchPlayerNameAliases(args: {
  supabase: any;
  teamIds: number[];
}): Promise<PlayerNameAliasRow[]> {
  let query = args.supabase
    .from("lineup_player_name_aliases" as any)
    .select("alias, player_id, team_id");

  query =
    args.teamIds.length > 0
      ? query.or(`team_id.is.null,team_id.in.(${args.teamIds.join(",")})`)
      : query.is("team_id", null);

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as PlayerNameAliasRow[];
}

function applyPlayerNameAliasesToRosterMap(args: {
  rosterByTeam: Map<number, RosterNameEntry[]>;
  aliases: PlayerNameAliasRow[];
}): Map<number, RosterNameEntry[]> {
  const result = new Map<number, RosterNameEntry[]>();
  for (const [teamId, rosterEntries] of args.rosterByTeam.entries()) {
    result.set(
      teamId,
      mergePlayerNameAliasesIntoRoster({
        rosterEntries,
        aliases: args.aliases,
        teamId
      })
    );
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
  reprocess: boolean;
  tweetId: string | null;
}): Promise<LinesCccIftttEventInput[]> {
  let query = args.supabase
    .from("lines_ccc_ifttt_events")
    .select(
      "id, source, source_account, username, text, link_to_tweet, tweet_id, tweet_created_at, created_at_label, raw_payload, received_at"
    );

  if (args.tweetId) {
    query = query.eq("tweet_id", args.tweetId);
  } else if (args.reprocess) {
    query = query.in("processing_status", ["pending", "processed", "rejected", "failed"]);
  } else {
    query = query.eq("processing_status", "pending");
  }

  const { data, error } = await query
    .order("received_at", { ascending: true })
    .limit(args.limit);

  if (error) throw error;

  return (data ?? []) as LinesCccIftttEventInput[];
}

function shouldResolveQuotedTweetForCandidate(source: ParsedLinesCccSource): boolean {
  if (source.quotedTweetId || source.quotedTweetUrl) return false;

  const text = source.enrichedText ?? source.rawText ?? "";
  if (!/https?:\/\/t\.co\//i.test(text)) return false;
  if (!/\b(lines?|lineup|rushes|pairings|starting goalie|goalie)\b/i.test(text)) {
    return false;
  }

  const meaningfulLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const textWithoutShortLinks = text.replace(/https?:\/\/t\.co\/\S+/gi, "").trim();
  const hasDirectGoalieName = /\bStarting Goalie:\s+[A-Z][A-Za-z.'’`-]+/i.test(text);
  const hasStructuredLines = /[A-Z][A-Za-z.'’`-]+\s*[-–—/]\s*[A-Z]/.test(text);

  return (
    !hasDirectGoalieName &&
    !hasStructuredLines &&
    (meaningfulLines.length <= 1 || textWithoutShortLinks.length <= 80)
  );
}

function isLinesCccTweetTeamUniqueConflict(error: unknown): boolean {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  return (
    message.includes("lines_ccc_tweet_id_team_unique_idx") ||
    message.includes("lines_ccc_quoted_tweet_id_team_unique_idx")
  );
}

async function persistLinesCccRow(args: {
  supabase: any;
  row: ReturnType<typeof toLinesCccRow>;
}): Promise<void> {
  const { error } = await args.supabase.from("lines_ccc" as any).upsert([args.row] as any, {
    onConflict: "capture_key"
  });
  if (!error) return;

  if (
    !isLinesCccTweetTeamUniqueConflict(error) ||
    args.row.status !== "observed" ||
    args.row.nhl_filter_status !== "accepted" ||
    !args.row.team_id ||
    (!args.row.tweet_id && !args.row.quoted_tweet_id)
  ) {
    throw error;
  }

  const query = args.row.tweet_id
    ? args.supabase
        .from("lines_ccc" as any)
        .update(args.row as any)
        .eq("tweet_id", args.row.tweet_id)
    : args.supabase
        .from("lines_ccc" as any)
        .update(args.row as any)
        .eq("quoted_tweet_id", args.row.quoted_tweet_id);

  const { error: updateError } = await query
    .eq("team_id", args.row.team_id)
    .eq("status", "observed")
    .eq("nhl_filter_status", "accepted");

  if (updateError) throw updateError;
}

function collectUnresolvedNamesFromRows(rows: Array<ReturnType<typeof toLinesCccRow>>) {
  const pending = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    if (
      row.status !== "observed" ||
      row.nhl_filter_status !== "accepted" ||
      !row.team_id
    ) {
      continue;
    }

    const isReviewablePlayerName = (rawName: string | null | undefined) => {
      const trimmed = rawName?.trim() ?? "";
      if (!trimmed) return false;
      if (trimmed.length > 36) return false;
      if (/https?:|www\.|t\.co|pic\.twitter\.com|@|#|…/.test(trimmed)) return false;
      if (/[:]/.test(trimmed)) return false;
      if (!/[A-Za-z]/.test(trimmed)) return false;
      if (/\d/.test(trimmed)) return false;
      if (!trimmed.includes(" ")) {
        const uppercaseCount = (trimmed.match(/[A-Z]/g) ?? []).length;
        if (uppercaseCount > 2) return false;
      }
      if (!/^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ.' -]+$/.test(trimmed)) return false;
      if (/^(rt|per|confirmed|lineup|lines|starting|goalie|starter)$/i.test(trimmed)) {
        return false;
      }
      return true;
    };

    const addName = (rawName: string | null | undefined, reason: string) => {
      if (!isReviewablePlayerName(rawName)) return;
      const normalizedName = normalizePlayerNameAlias(rawName);
      if (!normalizedName) return;
      const dedupeKey = buildUnresolvedPlayerNameDedupeKey({
        source: row.source,
        tweetId: row.tweet_id,
        teamId: row.team_id,
        normalizedName
      });
      pending.set(dedupeKey, {
        dedupe_key: dedupeKey,
        source: row.source,
        source_url: row.source_url,
        tweet_id: row.tweet_id,
        raw_name: rawName.trim(),
        normalized_name: normalizedName,
        team_id: row.team_id,
        team_abbreviation: row.team_abbreviation,
        context_text:
          row.quoted_enriched_text ??
          row.quoted_raw_text ??
          row.enriched_text ??
          row.raw_text ??
          null,
        status: "pending",
        metadata: {
          reason,
          captureKey: row.capture_key,
          classification: row.classification,
          quotedTweetId: row.quoted_tweet_id
        },
        updated_at: new Date().toISOString()
      });
    };

    for (const rawName of row.unmatched_names ?? []) {
      addName(rawName, "unmatched_names");
    }

    const groupedNames = [
      { names: row.line_1_player_names, ids: row.line_1_player_ids, reason: "line_1_null_id" },
      { names: row.line_2_player_names, ids: row.line_2_player_ids, reason: "line_2_null_id" },
      { names: row.line_3_player_names, ids: row.line_3_player_ids, reason: "line_3_null_id" },
      { names: row.line_4_player_names, ids: row.line_4_player_ids, reason: "line_4_null_id" },
      { names: row.pair_1_player_names, ids: row.pair_1_player_ids, reason: "pair_1_null_id" },
      { names: row.pair_2_player_names, ids: row.pair_2_player_ids, reason: "pair_2_null_id" },
      { names: row.pair_3_player_names, ids: row.pair_3_player_ids, reason: "pair_3_null_id" },
      {
        names: row.scratches_player_names,
        ids: row.scratches_player_ids,
        reason: "scratches_null_id"
      },
      {
        names: row.injured_player_names,
        ids: row.injured_player_ids,
        reason: "injuries_null_id"
      }
    ];

    for (const group of groupedNames) {
      group.names?.forEach((name, index) => {
        if (group.ids?.[index] == null) {
          addName(name, group.reason);
        }
      });
    }

    if (row.goalie_1_name && row.goalie_1_player_id == null) {
      addName(row.goalie_1_name, "goalie_1_null_id");
    }
    if (row.goalie_2_name && row.goalie_2_player_id == null) {
      addName(row.goalie_2_name, "goalie_2_null_id");
    }
  }

  return Array.from(pending.values());
}

async function persistUnresolvedPlayerNames(args: {
  supabase: any;
  rows: Array<ReturnType<typeof toLinesCccRow>>;
}): Promise<number> {
  const unresolvedRows = collectUnresolvedNamesFromRows(args.rows);
  if (unresolvedRows.length === 0) return 0;

  const { error } = await args.supabase
    .from("lineup_unresolved_player_names" as any)
    .upsert(unresolvedRows as any, {
      onConflict: "dedupe_key",
      ignoreDuplicates: true
    });

  if (error) throw error;
  return unresolvedRows.length;
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
    const reprocess = parseBooleanFlag(req.query.reprocess);
    const requestedTweetId = parseStringQueryValue(req.query.tweetId);
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
    const rawRosterByTeam = await fetchRosterEntriesByTeam({
      supabase: req.supabase,
      teamIds: scheduledTeamIds,
      seasonId: currentSeason.seasonId
    });
    const playerNameAliases = await fetchPlayerNameAliases({
      supabase: req.supabase,
      teamIds: scheduledTeamIds
    });
    const rosterByTeam = applyPlayerNameAliasesToRosterMap({
      rosterByTeam: rawRosterByTeam,
      aliases: playerNameAliases
    });
    const gameIdByTeamId = new Map<number, number>();
    for (const game of scheduledGames) {
      gameIdByTeamId.set(game.homeTeamId, game.id);
      gameIdByTeamId.set(game.awayTeamId, game.id);
    }
    const pendingEvents = await fetchPendingIftttEvents({
      supabase: req.supabase,
      limit: batchSize,
      reprocess,
      tweetId: requestedTweetId
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
    const nowIso = new Date().toISOString();
    const deferredEventUpdates: Array<{
      id: string;
      processing_status: "pending";
      raw_payload: Record<string, unknown>;
      updated_at: string;
    }> = [];
    const parsedCandidates: ReturnType<typeof buildLinesCccSourceFromIftttEvent>[] = [];
    const parsedEvents: LinesCccIftttEventInput[] = [];
    let oembedFetchSuccessCount = 0;
    let oembedBackfillCacheHitCount = 0;
    let oembedBackfillDeferred429Count = 0;
    let oembedBackfillFailedCount = 0;
    let quotedTweetResolveAttemptCount = 0;
    let quotedTweetResolveFailedCount = 0;

    for (const event of pendingEvents) {
      const candidateBase = buildLinesCccSourceFromIftttEvent({
        event,
        snapshotDate: requestedDate,
        teams: teamDirectory,
        rosterByTeam,
        gameIdByTeamId
      });
      const existingWrapperState = readLinesCccWrapperOEmbedBackfillState(event.raw_payload);
      const tweetId = event.tweet_id ?? extractTweetId(event.link_to_tweet);
      const tweetUrl = normalizeTweetUrl(event.link_to_tweet, tweetId);
      let wrapperState = existingWrapperState;
      let candidate = candidateBase;
      let shouldDeferEvent = false;

      const cachedOembedData = toLinesCccTweetOEmbedDataFromBackfillState(existingWrapperState);
      if (cachedOembedData) {
        candidate = applyLinesCccWrapperOEmbed({
          source: candidate,
          oembedData: cachedOembedData
        });
        oembedBackfillCacheHitCount += 1;
      } else if (
        shouldAttemptLinesCccWrapperOEmbedBackfill({
          tweetId,
          tweetUrl,
          existingState: existingWrapperState,
          nowIso
        })
      ) {
        const oembedAttempt = await fetchLinesCccTweetOEmbedAttempt(event.link_to_tweet ?? tweetUrl!);
        if (oembedAttempt.ok) {
          wrapperState = buildLinesCccWrapperOEmbedSuccessState({
            tweetId,
            tweetUrl,
            nowIso,
            data: oembedAttempt.data,
            existingState: existingWrapperState
          });
          candidate = applyLinesCccWrapperOEmbed({
            source: candidate,
            oembedData: oembedAttempt.data
          });
          oembedFetchSuccessCount += 1;
        } else if (oembedAttempt.retryable) {
          wrapperState = buildLinesCccWrapperOEmbedDeferredState({
            tweetId,
            tweetUrl,
            existingState: existingWrapperState,
            nowIso,
            httpStatus: oembedAttempt.httpStatus,
            error: oembedAttempt.error
          });
          shouldDeferEvent = true;
          oembedBackfillDeferred429Count += 1;
        } else {
          wrapperState = buildLinesCccWrapperOEmbedFailureState({
            tweetId,
            tweetUrl,
            existingState: existingWrapperState,
            nowIso,
            httpStatus: oembedAttempt.httpStatus,
            error: oembedAttempt.error
          });
          oembedBackfillFailedCount += 1;
        }
      }

      let quoteResolutionState: Record<string, unknown> | null = null;
      if (shouldResolveQuotedTweetForCandidate(candidate)) {
        quotedTweetResolveAttemptCount += 1;
        const quotedTweet = await resolveLinesCccQuotedTweet({
          wrapperText: candidate.enrichedText ?? candidate.rawText ?? ""
        });
        candidate = applyQuotedTweetPreference({
          source: candidate,
          quotedTweet
        });
        candidate = rejectInsufficientQuoteWrapper({
          source: candidate,
          quotedTweet
        });
        if (!quotedTweet) {
          quotedTweetResolveFailedCount += 1;
        }
        quoteResolutionState = {
          status: quotedTweet ? "success" : "failed",
          resolvedAt: nowIso,
          quotedTweetId: quotedTweet?.quotedTweetId ?? null,
          quotedTweetUrl: quotedTweet?.quotedTweetUrl ?? null
        };
      }

      candidate = refreshLinesCccSourceFromPrimaryText({
        source: candidate,
        teams: teamDirectory,
        rosterByTeam,
        gameIdByTeamId
      });

      const nextRawPayload = {
        ...(event.raw_payload ?? {}),
        linesCccOembed: {
          ...(((event.raw_payload ?? {}).linesCccOembed as Record<string, unknown> | undefined) ??
            {}),
          wrapper: wrapperState
        },
        ...(quoteResolutionState
          ? {
              linesCccQuote: quoteResolutionState
            }
          : {})
      };

      if (shouldDeferEvent) {
        deferredEventUpdates.push({
          id: event.id,
          processing_status: "pending",
          raw_payload: nextRawPayload,
          updated_at: nowIso
        });
        continue;
      }

      parsedCandidates.push(candidate);
      parsedEvents.push({
        ...event,
        raw_payload: nextRawPayload
      });
    }
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
    const acceptedCount = parsedCandidates.filter(
      (candidate) => candidate.nhlFilterStatus === "accepted"
    ).length;
    const nonNhlRejectedCount = parsedCandidates.filter(
      (candidate) => candidate.nhlFilterStatus === "rejected_non_nhl"
    ).length;
    const ambiguousRejectedCount = parsedCandidates.filter(
      (candidate) => candidate.nhlFilterStatus === "rejected_ambiguous"
    ).length;
    const insufficientTextRejectedCount = parsedCandidates.filter(
      (candidate) => candidate.nhlFilterStatus === "rejected_insufficient_text"
    ).length;
    const quoteTweetsResolved = parsedCandidates.filter(
      (candidate) => candidate.quotedTweetId || candidate.quotedTweetUrl
    ).length;
    const duplicateCaptureKeysSkipped =
      rowsToUpsert.length - new Set(rowsToUpsert.map((row) => row.capture_key)).size;

    for (const row of rowsToUpsert) {
      await persistLinesCccRow({
        supabase: req.supabase,
        row
      });
    }
    const unresolvedNamesQueued = await persistUnresolvedPlayerNames({
      supabase: req.supabase,
      rows: rowsToUpsert
    });
    const processedEventUpdates = parsedCandidates.map((candidate, index) => {
      const event = parsedEvents[index]!;
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
            primaryTextSource: candidate.primaryTextSource ?? null,
            detectedLeague: candidate.detectedLeague,
            nhlFilterStatus: candidate.nhlFilterStatus,
            nhlFilterReason: candidate.nhlFilterReason,
            tweetUrl: candidate.tweetUrl ?? null,
            quotedTweetUrl: candidate.quotedTweetUrl ?? null,
            quotedTweetId: candidate.quotedTweetId ?? null,
            keywordHits: candidate.keywordHits ?? [],
            structureSignals:
              (candidate.metadata?.primaryStructureSignals as Record<string, unknown> | null) ??
              null,
            oembedWrapperStatus:
              readLinesCccWrapperOEmbedBackfillState(event.raw_payload)?.status ?? null,
            teamId: candidate.team?.id ?? null,
            teamAbbreviation: candidate.team?.abbreviation ?? null
          }
        },
        updated_at: nowIso
      };
    });

    for (const update of [...deferredEventUpdates, ...processedEventUpdates]) {
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
      summary: {
        sourcesProcessed: new Set(pendingEvents.map((event) => event.source_account)).size,
        eventsLoaded: pendingEvents.length,
        tweetsDiscovered: discoveredTweets.length,
        tweetsParsed: parsedCandidates.length,
        quoteTweetsResolved,
        quoteResolveAttempts: quotedTweetResolveAttemptCount,
        quoteResolveFailures: quotedTweetResolveFailedCount,
        oembedFetched: oembedFetchSuccessCount,
        oembedCacheHits: oembedBackfillCacheHitCount,
        oembedDeferred429: oembedBackfillDeferred429Count,
        oembedFailures: oembedBackfillFailedCount,
        acceptedNhl: acceptedCount,
        nonNhlRejected: nonNhlRejectedCount,
        ambiguousRejected: ambiguousRejectedCount,
        insufficientTextRejected: insufficientTextRejectedCount,
        duplicatesSkipped: duplicateCaptureKeysSkipped,
        rowsUpserted: rowsToUpsert.length,
        unresolvedNamesQueued,
        eventsDeferred: deferredEventUpdates.length,
        eventsProcessed: processedEventUpdates.filter(
          (event) => event.processing_status === "processed"
        ).length,
        eventsRejected: processedEventUpdates.filter(
          (event) => event.processing_status === "rejected"
        ).length
      },
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
