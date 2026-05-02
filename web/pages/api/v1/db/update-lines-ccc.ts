import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { getCurrentSeason, getTeams } from "lib/NHL/server";
import { buildTeamDirectory } from "lib/sources/lineupSourceIngestion";
import {
  applyPlayerNameAliasesToRosterMap,
  extractTweetId,
  fetchPlayerNameAliases,
  fetchRosterEntriesByTeam,
  fetchScheduledGamesForDate,
  normalizeTweetUrl,
  parseBatchSize,
  parseBooleanFlag,
  parseRequestedDate,
  parseStringQueryValue,
  persistUnresolvedPlayerNames,
  sendPlayerAliasReviewEmailForQueuedNames,
} from "lib/sources/lineSourceProcessing";
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
  type LinesCccIftttEventInput,
} from "lib/sources/linesCccIngestion";
import adminOnly from "utils/adminOnlyMiddleware";

async function fetchPendingIftttEvents(args: {
  supabase: any;
  limit: number;
  reprocess: boolean;
  tweetId: string | null;
}): Promise<LinesCccIftttEventInput[]> {
  let query = args.supabase
    .from("lines_ccc_ifttt_events")
    .select(
      "id, source, source_account, username, text, link_to_tweet, tweet_id, tweet_created_at, created_at_label, raw_payload, received_at",
    );

  if (args.tweetId) {
    query = query.eq("tweet_id", args.tweetId);
  } else if (args.reprocess) {
    query = query.in("processing_status", [
      "pending",
      "processed",
      "rejected",
      "failed",
    ]);
  } else {
    query = query.eq("processing_status", "pending");
  }

  const { data, error } = await query
    .order("received_at", { ascending: true })
    .limit(args.limit);

  if (error) throw error;

  return (data ?? []) as LinesCccIftttEventInput[];
}

function shouldResolveQuotedTweetForCandidate(
  source: ParsedLinesCccSource,
): boolean {
  if (source.quotedTweetId || source.quotedTweetUrl) return false;

  const text = source.enrichedText ?? source.rawText ?? "";
  if (!/https?:\/\/t\.co\//i.test(text)) return false;
  if (
    !/\b(lines?|lineup|rushes|pairings|starting goalie|goalie)\b/i.test(text)
  ) {
    return false;
  }

  const meaningfulLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const textWithoutShortLinks = text
    .replace(/https?:\/\/t\.co\/\S+/gi, "")
    .trim();
  const hasDirectGoalieName = /\bStarting Goalie:\s+[A-Z][A-Za-z.'’`-]+/i.test(
    text,
  );
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
  const { error } = await args.supabase
    .from("lines_ccc" as any)
    .upsert([args.row] as any, {
      onConflict: "capture_key",
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

export default withCronJobAudit(
  adminOnly(async (req, res) => {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    const batchSize = parseBatchSize(req.query.limit);
    const reprocess = parseBooleanFlag(req.query.reprocess);
    const requestedTweetId = parseStringQueryValue(req.query.tweetId);
    const requestedDate = parseRequestedDate(req.query.date);
    const currentSeason = await getCurrentSeason();
    const teamDirectory = buildTeamDirectory(
      await getTeams(currentSeason.seasonId),
    );
    const scheduledGames = await fetchScheduledGamesForDate({
      supabase: req.supabase,
      date: requestedDate,
    });
    const scheduledTeamIds = Array.from(
      new Set(
        scheduledGames.flatMap((game) => [game.homeTeamId, game.awayTeamId]),
      ),
    );
    const rawRosterByTeam = await fetchRosterEntriesByTeam({
      supabase: req.supabase,
      teamIds: scheduledTeamIds,
      seasonId: currentSeason.seasonId,
    });
    const playerNameAliases = await fetchPlayerNameAliases({
      supabase: req.supabase,
      teamIds: scheduledTeamIds,
    });
    let rosterByTeam = applyPlayerNameAliasesToRosterMap({
      rosterByTeam: rawRosterByTeam,
      aliases: playerNameAliases,
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
      tweetId: requestedTweetId,
    });
    const discoveredTweets = pendingEvents
      .map((event) => ({
        eventId: event.id,
        tweetId: event.tweet_id ?? extractTweetId(event.link_to_tweet),
        tweetUrl: normalizeTweetUrl(event.link_to_tweet, event.tweet_id),
        sourceAccount: event.source_account,
        username: event.username,
      }))
      .filter((tweet) => tweet.tweetUrl != null || tweet.tweetId != null);
    const nowIso = new Date().toISOString();
    const deferredEventUpdates: Array<{
      id: string;
      processing_status: "pending";
      raw_payload: Record<string, unknown>;
      updated_at: string;
    }> = [];
    const parsedCandidates: ReturnType<
      typeof buildLinesCccSourceFromIftttEvent
    >[] = [];
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
        gameIdByTeamId,
      });
      const existingWrapperState = readLinesCccWrapperOEmbedBackfillState(
        event.raw_payload,
      );
      const tweetId = event.tweet_id ?? extractTweetId(event.link_to_tweet);
      const tweetUrl = normalizeTweetUrl(event.link_to_tweet, tweetId);
      let wrapperState = existingWrapperState;
      let candidate = candidateBase;
      let shouldDeferEvent = false;

      const cachedOembedData =
        toLinesCccTweetOEmbedDataFromBackfillState(existingWrapperState);
      if (cachedOembedData) {
        candidate = applyLinesCccWrapperOEmbed({
          source: candidate,
          oembedData: cachedOembedData,
        });
        oembedBackfillCacheHitCount += 1;
      } else if (
        shouldAttemptLinesCccWrapperOEmbedBackfill({
          tweetId,
          tweetUrl,
          existingState: existingWrapperState,
          nowIso,
        })
      ) {
        const oembedAttempt = await fetchLinesCccTweetOEmbedAttempt(
          event.link_to_tweet ?? tweetUrl!,
        );
        if (oembedAttempt.ok) {
          wrapperState = buildLinesCccWrapperOEmbedSuccessState({
            tweetId,
            tweetUrl,
            nowIso,
            data: oembedAttempt.data,
            existingState: existingWrapperState,
          });
          candidate = applyLinesCccWrapperOEmbed({
            source: candidate,
            oembedData: oembedAttempt.data,
          });
          oembedFetchSuccessCount += 1;
        } else if (oembedAttempt.retryable) {
          wrapperState = buildLinesCccWrapperOEmbedDeferredState({
            tweetId,
            tweetUrl,
            existingState: existingWrapperState,
            nowIso,
            httpStatus: oembedAttempt.httpStatus,
            error: oembedAttempt.error,
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
            error: oembedAttempt.error,
          });
          oembedBackfillFailedCount += 1;
        }
      }

      let quoteResolutionState: Record<string, unknown> | null = null;
      if (shouldResolveQuotedTweetForCandidate(candidate)) {
        quotedTweetResolveAttemptCount += 1;
        const quotedTweet = await resolveLinesCccQuotedTweet({
          wrapperText: candidate.enrichedText ?? candidate.rawText ?? "",
        });
        candidate = applyQuotedTweetPreference({
          source: candidate,
          quotedTweet,
        });
        candidate = rejectInsufficientQuoteWrapper({
          source: candidate,
          quotedTweet,
        });
        if (!quotedTweet) {
          quotedTweetResolveFailedCount += 1;
        }
        quoteResolutionState = {
          status: quotedTweet ? "success" : "failed",
          resolvedAt: nowIso,
          quotedTweetId: quotedTweet?.quotedTweetId ?? null,
          quotedTweetUrl: quotedTweet?.quotedTweetUrl ?? null,
        };
      }

      candidate = refreshLinesCccSourceFromPrimaryText({
        source: candidate,
        teams: teamDirectory,
        rosterByTeam,
        gameIdByTeamId,
      });

      const nextRawPayload = {
        ...(event.raw_payload ?? {}),
        linesCccOembed: {
          ...(((event.raw_payload ?? {}).linesCccOembed as
            | Record<string, unknown>
            | undefined) ?? {}),
          wrapper: wrapperState,
        },
        ...(quoteResolutionState
          ? {
              linesCccQuote: quoteResolutionState,
            }
          : {}),
      };

      if (shouldDeferEvent) {
        deferredEventUpdates.push({
          id: event.id,
          processing_status: "pending",
          raw_payload: nextRawPayload,
          updated_at: nowIso,
        });
        continue;
      }

      parsedCandidates.push(candidate);
      parsedEvents.push({
        ...event,
        raw_payload: nextRawPayload,
      });
    }

    const unscheduledAcceptedTeamIds = Array.from(
      new Set(
        parsedCandidates
          .map((candidate) =>
            candidate.nhlFilterStatus === "accepted"
              ? candidate.team?.id
              : null,
          )
          .filter(
            (teamId): teamId is number =>
              typeof teamId === "number" && !rosterByTeam.has(teamId),
          ),
      ),
    );
    if (unscheduledAcceptedTeamIds.length > 0) {
      const additionalRosterByTeam = applyPlayerNameAliasesToRosterMap({
        rosterByTeam: await fetchRosterEntriesByTeam({
          supabase: req.supabase,
          teamIds: unscheduledAcceptedTeamIds,
          seasonId: currentSeason.seasonId,
        }),
        aliases: await fetchPlayerNameAliases({
          supabase: req.supabase,
          teamIds: unscheduledAcceptedTeamIds,
        }),
      });
      rosterByTeam = new Map([...rosterByTeam, ...additionalRosterByTeam]);

      for (let index = 0; index < parsedCandidates.length; index += 1) {
        const candidate = parsedCandidates[index];
        if (!candidate?.team) continue;
        if (!unscheduledAcceptedTeamIds.includes(candidate.team.id)) continue;

        parsedCandidates[index] = refreshLinesCccSourceFromPrimaryText({
          source: candidate,
          teams: teamDirectory,
          rosterByTeam,
          gameIdByTeamId,
        });
      }
    }

    const hasAmbiguousNhlCandidates = parsedCandidates.some(
      (candidate) => candidate.nhlFilterStatus === "rejected_ambiguous",
    );
    const unloadedTeamIds = teamDirectory
      .map((team) => team.id)
      .filter((teamId) => !rosterByTeam.has(teamId));
    if (hasAmbiguousNhlCandidates && unloadedTeamIds.length > 0) {
      const additionalRosterByTeam = applyPlayerNameAliasesToRosterMap({
        rosterByTeam: await fetchRosterEntriesByTeam({
          supabase: req.supabase,
          teamIds: unloadedTeamIds,
          seasonId: currentSeason.seasonId,
        }),
        aliases: await fetchPlayerNameAliases({
          supabase: req.supabase,
          teamIds: unloadedTeamIds,
        }),
      });
      rosterByTeam = new Map([...rosterByTeam, ...additionalRosterByTeam]);

      for (let index = 0; index < parsedCandidates.length; index += 1) {
        const candidate = parsedCandidates[index];
        if (candidate?.nhlFilterStatus !== "rejected_ambiguous") continue;

        parsedCandidates[index] = refreshLinesCccSourceFromPrimaryText({
          source: candidate,
          teams: teamDirectory,
          rosterByTeam,
          gameIdByTeamId,
        });
      }
    }

    const rowsToUpsert = parsedCandidates.map((candidate) =>
      toLinesCccRow({
        source: candidate,
        rosterEntries: candidate.team
          ? (rosterByTeam.get(candidate.team.id) ?? [])
          : [],
      }),
    );
    const parsedSummary = parsedCandidates.reduce(
      (summary, candidate) => {
        summary.total += 1;
        summary.byFilterStatus[candidate.nhlFilterStatus] =
          (summary.byFilterStatus[candidate.nhlFilterStatus] ?? 0) + 1;
        summary.byClassification[candidate.classification ?? "unknown"] =
          (summary.byClassification[candidate.classification ?? "unknown"] ??
            0) + 1;
        return summary;
      },
      {
        total: 0,
        byFilterStatus: {} as Record<string, number>,
        byClassification: {} as Record<string, number>,
      },
    );
    const acceptedCount = parsedCandidates.filter(
      (candidate) => candidate.nhlFilterStatus === "accepted",
    ).length;
    const nonNhlRejectedCount = parsedCandidates.filter(
      (candidate) => candidate.nhlFilterStatus === "rejected_non_nhl",
    ).length;
    const ambiguousRejectedCount = parsedCandidates.filter(
      (candidate) => candidate.nhlFilterStatus === "rejected_ambiguous",
    ).length;
    const insufficientTextRejectedCount = parsedCandidates.filter(
      (candidate) => candidate.nhlFilterStatus === "rejected_insufficient_text",
    ).length;
    const quoteTweetsResolved = parsedCandidates.filter(
      (candidate) => candidate.quotedTweetId || candidate.quotedTweetUrl,
    ).length;
    const duplicateCaptureKeysSkipped =
      rowsToUpsert.length -
      new Set(rowsToUpsert.map((row) => row.capture_key)).size;

    for (const row of rowsToUpsert) {
      await persistLinesCccRow({
        supabase: req.supabase,
        row,
      });
    }
    const unresolvedNamesQueued = await persistUnresolvedPlayerNames({
      supabase: req.supabase,
      rows: rowsToUpsert,
    });
    const unresolvedNameEmail =
      await sendPlayerAliasReviewEmailForQueuedNames({
        req,
        unresolvedNamesQueued,
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
              (candidate.metadata?.primaryStructureSignals as Record<
                string,
                unknown
              > | null) ?? null,
            oembedWrapperStatus:
              readLinesCccWrapperOEmbedBackfillState(event.raw_payload)
                ?.status ?? null,
            teamId: candidate.team?.id ?? null,
            teamAbbreviation: candidate.team?.abbreviation ?? null,
          },
        },
        updated_at: nowIso,
      };
    });

    for (const update of [...deferredEventUpdates, ...processedEventUpdates]) {
      const { error } = await req.supabase
        .from("lines_ccc_ifttt_events" as any)
        .update({
          processing_status: update.processing_status,
          raw_payload: update.raw_payload,
          updated_at: update.updated_at,
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
        sourcesProcessed: new Set(
          pendingEvents.map((event) => event.source_account),
        ).size,
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
        unresolvedNameEmail,
        eventsDeferred: deferredEventUpdates.length,
        eventsProcessed: processedEventUpdates.filter(
          (event) => event.processing_status === "processed",
        ).length,
        eventsRejected: processedEventUpdates.filter(
          (event) => event.processing_status === "rejected",
        ).length,
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
        matchedPlayerIds: candidate.matchedPlayerIds,
      })),
      message:
        "lines_ccc processor route parsed pending events, upserted rows, and updated source event statuses.",
    });
  }),
  {
    jobName: "/api/v1/db/update-lines-ccc",
  },
);
