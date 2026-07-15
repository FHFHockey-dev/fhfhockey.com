import type { NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import {
  normalizeNewsTeamId,
  resolveAutomatedNewsCardStatus,
} from "lib/newsFeed";
import {
  buildTweetNewsAmbiguousCandidate,
  buildTweetNewsAutomationCandidate,
  type TweetNewsAutomationPlayer,
  type TweetNewsAutomationReviewRow,
} from "lib/sources/tweetNewsAutomation";
import {
  buildTweetNewsInferenceDedupeKey,
  buildTweetNewsInferenceSources,
  inferTweetNewsCandidate,
  isTweetNewsInferenceEnabled,
  TWEET_NEWS_INFERENCE_PROMPT_VERSION,
  DEFAULT_TWEET_NEWS_INFERENCE_MODEL,
  type TweetNewsInferenceResult,
  type TweetNewsInferenceTeam,
} from "lib/sources/tweetNewsInference";
import { syncTweetPatternReviewItems } from "pages/api/v1/db/tweet-pattern-review";
import adminOnly from "utils/adminOnlyMiddleware";

type ExistingNewsItemRow = {
  id: string;
  source_review_item_id: string | null;
  card_status: "draft" | "published" | "archived";
  published_at: string | null;
  metadata: Record<string, unknown> | null;
};

type TweetNewsInferenceStateRow = {
  id: string;
  status: "processing" | "published" | "review" | "error";
  attempts: number;
  lease_expires_at: string | null;
  next_attempt_at: string | null;
  updated_at: string;
};

function parseLimit(
  value: string | string[] | undefined,
  fallback = 200,
): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : fallback;
  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 1), 1000)
    : fallback;
}

function parseBooleanFlag(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true" || rawValue === "yes";
}

function isLocalDevRequest(req: any): boolean {
  const host = typeof req.headers?.host === "string" ? req.headers.host : "";
  const hostname = host.toLowerCase().split(":")[0];
  return (
    process.env.NODE_ENV !== "production" &&
    (hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1")
  );
}

function parseString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getAutomationSource(
  metadata: Record<string, unknown> | null,
): string | null {
  const automation = metadata?.automation;
  if (!automation || typeof automation !== "object") return null;
  const source = (automation as Record<string, unknown>).source;
  return typeof source === "string" ? source : null;
}

function getAutomationMetadata(
  metadata: Record<string, unknown> | null,
): Record<string, unknown> | null {
  const automation = metadata?.automation;
  return automation && typeof automation === "object"
    ? (automation as Record<string, unknown>)
    : null;
}

function canUpdateExistingNewsItem(args: {
  existing: ExistingNewsItemRow | null;
  reprocess: boolean;
}): boolean {
  if (!args.existing) return true;
  if (args.reprocess) return true;
  return (
    getAutomationSource(args.existing.metadata) ===
    "tweet_news_phrase_dictionary"
  );
}

async function fetchReviewRows(args: {
  supabase: any;
  limit: number;
  reviewItemId: string | null;
  daysBack: number | null;
}): Promise<TweetNewsAutomationReviewRow[]> {
  let query = args.supabase
    .from("tweet_pattern_review_items" as any)
    .select(
      [
        "id",
        "source_account",
        "source_label",
        "source_handle",
        "author_name",
        "source_created_at",
        "tweet_id",
        "tweet_url",
        "source_url",
        "quoted_tweet_url",
        "team_id",
        "team_abbreviation",
        "parser_classification",
        "parser_filter_status",
        "parser_filter_reason",
        "review_text",
        "raw_text",
        "enriched_text",
        "quoted_text",
        "review_status",
        "reviewed_category",
        "reviewed_subcategory",
        "selected_highlights",
        "review_assignments",
        "notes",
        "metadata",
      ].join(", "),
    )
    .neq("review_status", "ignored")
    .order("source_created_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(args.limit);

  if (args.reviewItemId) {
    query = query.eq("id", args.reviewItemId);
  }
  if (args.daysBack && args.daysBack > 0) {
    const cutoff = new Date(
      Date.now() - args.daysBack * 24 * 60 * 60 * 1000,
    ).toISOString();
    query = query.gte("source_created_at", cutoff);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TweetNewsAutomationReviewRow[];
}

async function fetchPlayers(args: {
  supabase: any;
}): Promise<TweetNewsAutomationPlayer[]> {
  const { data, error } = await args.supabase
    .from("players" as any)
    .select("id, fullName, position, team_id")
    .not("fullName", "is", null);
  if (error) throw error;

  return ((data ?? []) as any[])
    .map((row) => ({
      id: Number(row.id),
      fullName: typeof row.fullName === "string" ? row.fullName : "",
      position: typeof row.position === "string" ? row.position : null,
      team_id: Number.isFinite(Number(row.team_id))
        ? Number(row.team_id)
        : null,
    }))
    .filter((row) => Number.isFinite(row.id) && row.fullName);
}

async function fetchTeams(args: {
  supabase: any;
}): Promise<TweetNewsInferenceTeam[]> {
  const { data, error } = await args.supabase
    .from("teams" as any)
    .select("id, abbreviation, name");
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => ({
      id: Number(row.id),
      abbreviation:
        typeof row.abbreviation === "string" ? row.abbreviation : "",
      name: typeof row.name === "string" ? row.name : "",
    }))
    .filter(
      (team) =>
        Number.isFinite(team.id) && Boolean(team.abbreviation) && Boolean(team.name),
    );
}

async function claimTweetNewsInference(args: {
  supabase: any;
  row: TweetNewsAutomationReviewRow;
  dedupeKey: string;
  model: string;
  nowIso: string;
}): Promise<string | null> {
  const leaseExpiresAt = new Date(
    Date.parse(args.nowIso) + 3 * 60 * 1000,
  ).toISOString();
  const insertPayload = {
    review_item_id: args.row.id,
    source_tweet_id: args.row.tweet_id,
    dedupe_key: args.dedupeKey,
    status: "processing",
    attempts: 1,
    model: args.model,
    prompt_version: TWEET_NEWS_INFERENCE_PROMPT_VERSION,
    lease_expires_at: leaseExpiresAt,
    created_at: args.nowIso,
    updated_at: args.nowIso,
  };
  const { data: inserted, error: insertError } = await args.supabase
    .from("tweet_news_inference_state" as any)
    .insert(insertPayload)
    .select("id")
    .maybeSingle();
  if (!insertError && inserted?.id) return String(inserted.id);
  if (insertError?.code !== "23505") throw insertError;

  const { data: existing, error: existingError } = await args.supabase
    .from("tweet_news_inference_state" as any)
    .select(
      "id, status, attempts, lease_expires_at, next_attempt_at, updated_at",
    )
    .eq("dedupe_key", args.dedupeKey)
    .maybeSingle();
  if (existingError) throw existingError;
  const state = existing as TweetNewsInferenceStateRow | null;
  if (!state || state.status === "published" || state.status === "review") {
    return null;
  }

  const nowMs = Date.parse(args.nowIso);
  const retryAt = Date.parse(
    state.status === "processing"
      ? state.lease_expires_at ?? ""
      : state.next_attempt_at ?? "",
  );
  if (Number.isFinite(retryAt) && retryAt > nowMs) return null;

  const { data: reclaimed, error: reclaimError } = await args.supabase
    .from("tweet_news_inference_state" as any)
    .update({
      status: "processing",
      attempts: Math.max(Number(state.attempts) || 0, 0) + 1,
      error: null,
      lease_expires_at: leaseExpiresAt,
      next_attempt_at: null,
      updated_at: args.nowIso,
    })
    .eq("id", state.id)
    .eq("updated_at", state.updated_at)
    .select("id")
    .maybeSingle();
  if (reclaimError) throw reclaimError;
  return reclaimed?.id ? String(reclaimed.id) : null;
}

async function completeTweetNewsInference(args: {
  supabase: any;
  stateId: string;
  result: TweetNewsInferenceResult;
  candidate: NonNullable<ReturnType<typeof buildTweetNewsAutomationCandidate>>;
  nowIso: string;
}): Promise<void> {
  const { error } = await args.supabase
    .from("tweet_news_inference_state" as any)
    .update({
      status:
        args.candidate.cardStatus === "published" ? "published" : "review",
      decision: args.result.decision,
      category: args.candidate.category,
      subcategory: args.candidate.subcategory,
      verification_state: args.result.verificationState,
      confidence: args.result.confidence,
      result: args.result,
      evidence: args.result.evidence,
      error: null,
      lease_expires_at: null,
      next_attempt_at: null,
      updated_at: args.nowIso,
    })
    .eq("id", args.stateId);
  if (error) throw error;
}

async function failTweetNewsInference(args: {
  supabase: any;
  stateId: string;
  error: unknown;
  nowIso: string;
}): Promise<void> {
  const nextAttemptAt = new Date(
    Date.parse(args.nowIso) + 30 * 60 * 1000,
  ).toISOString();
  const { error } = await args.supabase
    .from("tweet_news_inference_state" as any)
    .update({
      status: "error",
      error:
        args.error instanceof Error
          ? args.error.message.slice(0, 1000)
          : String(args.error).slice(0, 1000),
      lease_expires_at: null,
      next_attempt_at: nextAttemptAt,
      updated_at: args.nowIso,
    })
    .eq("id", args.stateId);
  if (error) throw error;
}

async function fetchExistingNewsItems(args: {
  supabase: any;
  reviewItemIds: string[];
}): Promise<Map<string, ExistingNewsItemRow>> {
  if (args.reviewItemIds.length === 0) return new Map();

  const { data, error } = await args.supabase
    .from("news_feed_items" as any)
    .select("id, source_review_item_id, card_status, published_at, metadata")
    .in("source_review_item_id", args.reviewItemIds);
  if (error) throw error;

  return new Map(
    ((data ?? []) as ExistingNewsItemRow[])
      .filter((row) => row.source_review_item_id)
      .map((row) => [row.source_review_item_id!, row]),
  );
}

async function persistAutomatedNewsItem(args: {
  supabase: any;
  existing: ExistingNewsItemRow | null;
  candidate: NonNullable<ReturnType<typeof buildTweetNewsAutomationCandidate>>;
  validTeamIds: ReadonlySet<number>;
  nowIso: string;
}): Promise<{ itemId: string; action: "inserted" | "updated" }> {
  const cardStatus = resolveAutomatedNewsCardStatus({
    existingStatus: args.existing?.card_status,
    candidateStatus: args.candidate.cardStatus,
  });
  const payload = {
    source_review_item_id: args.candidate.reviewItemId,
    source_tweet_id: args.candidate.sourceTweetId,
    source_url: args.candidate.sourceUrl,
    tweet_url: args.candidate.tweetUrl,
    source_label: args.candidate.sourceLabel,
    source_account: args.candidate.sourceAccount,
    team_id: normalizeNewsTeamId(args.candidate.teamId, args.validTeamIds),
    team_abbreviation: args.candidate.teamAbbreviation,
    headline: args.candidate.headline,
    blurb: args.candidate.blurb,
    category: args.candidate.category,
    subcategory: args.candidate.subcategory,
    card_status: cardStatus,
    observed_at: args.candidate.observedAt,
    published_at:
      args.existing?.published_at ??
      (args.candidate.cardStatus === "published"
        ? args.candidate.publishedAt
        : null),
    metadata: args.candidate.metadata,
    updated_at: args.nowIso,
  };

  let itemId = args.existing?.id ?? null;
  let action: "inserted" | "updated" = "updated";
  if (args.existing) {
    const { error } = await args.supabase
      .from("news_feed_items" as any)
      .update(payload)
      .eq("id", args.existing.id);
    if (error) throw error;
  } else {
    const { data, error } = await args.supabase
      .from("news_feed_items" as any)
      .insert({ ...payload, created_at: args.nowIso })
      .select("id")
      .single();
    if (error) throw error;
    itemId = data?.id ?? null;
    action = "inserted";
  }

  if (!itemId) throw new Error("Unable to resolve saved news item id.");

  const { error: deleteError } = await args.supabase
    .from("news_feed_item_players" as any)
    .delete()
    .eq("news_item_id", itemId);
  if (deleteError) throw deleteError;

  if (args.candidate.playerAssignments.length > 0) {
    const { error: playerError } = await args.supabase
      .from("news_feed_item_players" as any)
      .insert(
        args.candidate.playerAssignments.map((player) => ({
          news_item_id: itemId,
          player_id: player.playerId,
          player_name: player.playerName,
          team_id: normalizeNewsTeamId(player.teamId, args.validTeamIds),
          role: "subject",
          created_at: args.nowIso,
          updated_at: args.nowIso,
        })),
      );
    if (playerError) throw playerError;
  }

  return { itemId, action };
}

export default withCronJobAudit(
  adminOnly(async (req: any, res: NextApiResponse) => {
    if (req.method !== "POST" && req.method !== "GET") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({
        success: false,
        message: "Method not allowed.",
      });
    }

    const limit = parseLimit(req.query.limit, 200);
    const dryRun =
      req.query.dryRun === undefined
        ? req.method === "GET" && isLocalDevRequest(req)
        : parseBooleanFlag(req.query.dryRun);
    const reprocess = parseBooleanFlag(req.query.reprocess);
    const includeAmbiguous = req.query.includeAmbiguous
      ? parseBooleanFlag(req.query.includeAmbiguous)
      : true;
    const attachAssignments = !parseBooleanFlag(req.query.skipAssignmentSync);
    const syncFirst = !dryRun && !parseBooleanFlag(req.query.skipReviewSync);
    const reviewItemId = parseString(req.query.reviewItemId);
    const daysBack = req.query.daysBack ? Number(req.query.daysBack) : null;
    const nowIso = new Date().toISOString();
    const syncSummary = syncFirst
      ? await syncTweetPatternReviewItems({
          supabase: req.supabase,
          perSourceLimit: parseLimit(req.query.perSourceLimit, 500),
        })
      : null;
    const [rows, players] = await Promise.all([
      fetchReviewRows({
        supabase: req.supabase,
        limit,
        reviewItemId,
        daysBack: Number.isFinite(daysBack) ? daysBack : null,
      }),
      fetchPlayers({ supabase: req.supabase }),
    ]);
    const teams = await fetchTeams({ supabase: req.supabase });
    const validTeamIds = new Set(teams.map((team) => team.id));
    const existingByReviewItemId = await fetchExistingNewsItems({
      supabase: req.supabase,
      reviewItemIds: rows.map((row) => row.id),
    });

    let candidates = rows
      .map((row) => ({
        row,
        candidate:
          buildTweetNewsAutomationCandidate({
            row,
            players,
            nowIso,
          }) ??
          (includeAmbiguous
            ? buildTweetNewsAmbiguousCandidate({
                row,
                players,
                nowIso,
              })
            : null),
      }))
      .filter(
        (
          entry,
        ): entry is {
          row: TweetNewsAutomationReviewRow;
          candidate: NonNullable<
            ReturnType<typeof buildTweetNewsAutomationCandidate>
          >;
        } => Boolean(entry.candidate),
      );
    const inferenceEnabled = isTweetNewsInferenceEnabled();
    const inferenceLimit = Math.min(parseLimit(req.query.inferenceLimit, 8), 12);
    const inferenceModel =
      process.env.TWEET_NEWS_INFERENCE_MODEL ??
      DEFAULT_TWEET_NEWS_INFERENCE_MODEL;
    let inferenceAttempted = 0;
    let inferencePublished = 0;
    let inferenceReview = 0;
    let inferenceSkippedClaim = 0;
    let inferenceErrors = 0;
    const pendingInferenceCompletions = new Map<
      string,
      { stateId: string; result: TweetNewsInferenceResult }
    >();

    if (inferenceEnabled && !dryRun) {
      const nextCandidates = [...candidates];
      for (let index = 0; index < nextCandidates.length; index += 1) {
        if (inferenceAttempted >= inferenceLimit) break;
        const entry = nextCandidates[index]!;
        const automation = getAutomationMetadata(entry.candidate.metadata);
        if (automation?.dictionaryGap !== true) continue;
        if (
          !canUpdateExistingNewsItem({
            existing: existingByReviewItemId.get(entry.row.id) ?? null,
            reprocess,
          })
        ) {
          continue;
        }

        const sources = buildTweetNewsInferenceSources(entry.row);
        if (sources.length === 0) continue;
        const dedupeKey = buildTweetNewsInferenceDedupeKey({
          row: entry.row,
          sources,
          model: inferenceModel,
        });
        const stateId = await claimTweetNewsInference({
          supabase: req.supabase,
          row: entry.row,
          dedupeKey,
          model: inferenceModel,
          nowIso,
        });
        if (!stateId) {
          inferenceSkippedClaim += 1;
          continue;
        }

        inferenceAttempted += 1;
        try {
          const inferred = await inferTweetNewsCandidate({
            row: entry.row,
            players,
            teams,
            model: inferenceModel,
            nowIso,
          });
          nextCandidates[index] = {
            row: entry.row,
            candidate: inferred.candidate,
          };
          pendingInferenceCompletions.set(entry.row.id, {
            stateId,
            result: inferred.result,
          });
          if (inferred.candidate.cardStatus === "published") {
            inferencePublished += 1;
          } else {
            inferenceReview += 1;
          }
        } catch (error) {
          inferenceErrors += 1;
          await failTweetNewsInference({
            supabase: req.supabase,
            stateId,
            error,
            nowIso,
          });
        }
      }
      candidates = nextCandidates;
    }
    const writableCandidates = candidates.filter(({ row }) =>
      canUpdateExistingNewsItem({
        existing: existingByReviewItemId.get(row.id) ?? null,
        reprocess,
      }),
    );

    let insertedCount = 0;
    let updatedCount = 0;
    let publishedCount = 0;
    let draftCount = 0;
    let assignmentsSynced = 0;
    const skippedExistingManual = candidates.length - writableCandidates.length;
    const sample = writableCandidates.slice(0, 12).map(({ candidate }) => ({
      ambiguityReason: getAutomationMetadata(candidate.metadata)
        ?.ambiguityReason,
      reviewItemId: candidate.reviewItemId,
      status: candidate.cardStatus,
      category: candidate.category,
      subcategory: candidate.subcategory,
      headline: candidate.headline,
      players: candidate.playerAssignments.map((player) => player.playerName),
      phrases: candidate.reviewAssignments.flatMap(
        (assignment) => assignment.highlightPhrases,
      ),
      candidatePhrases:
        getAutomationMetadata(candidate.metadata)?.candidatePhrases ?? [],
    }));

    if (!dryRun) {
      for (const { row, candidate } of writableCandidates) {
        const existing = existingByReviewItemId.get(row.id) ?? null;
        const result = await persistAutomatedNewsItem({
          supabase: req.supabase,
          existing,
          candidate,
          validTeamIds,
          nowIso,
        });
        if (result.action === "inserted") insertedCount += 1;
        if (result.action === "updated") updatedCount += 1;
        if (candidate.cardStatus === "published") publishedCount += 1;
        if (candidate.cardStatus === "draft") draftCount += 1;

        if (
          attachAssignments &&
          candidate.reviewAssignments.length > 0 &&
          (row.review_assignments ?? []).length === 0
        ) {
          const { error: assignmentError } = await req.supabase
            .from("tweet_pattern_review_items" as any)
            .update({
              review_assignments: candidate.reviewAssignments,
              selected_highlights: candidate.reviewAssignments.flatMap(
                (assignment) => assignment.highlightPhrases,
              ),
              updated_at: nowIso,
            })
            .eq("id", row.id);
          if (assignmentError) throw assignmentError;
          assignmentsSynced += 1;
        }

        const inferenceCompletion = pendingInferenceCompletions.get(row.id);
        if (inferenceCompletion) {
          await completeTweetNewsInference({
            supabase: req.supabase,
            stateId: inferenceCompletion.stateId,
            result: inferenceCompletion.result,
            candidate,
            nowIso,
          });
        }
      }
    } else {
      publishedCount = writableCandidates.filter(
        ({ candidate }) => candidate.cardStatus === "published",
      ).length;
      draftCount = writableCandidates.filter(
        ({ candidate }) => candidate.cardStatus === "draft",
      ).length;
    }

    return res.json({
      success: true,
      dryRun,
      summary: {
        reviewSync: syncSummary,
        rowsLoaded: rows.length,
        includeAmbiguous,
        candidates: candidates.length,
        writableCandidates: writableCandidates.length,
        ambiguousCandidates: candidates.filter(
          ({ candidate }) =>
            getAutomationMetadata(candidate.metadata)?.dictionaryGap === true,
        ).length,
        autoPublishCandidates: candidates.filter(
          ({ candidate }) => candidate.cardStatus === "published",
        ).length,
        skippedExistingManual,
        insertedCount,
        updatedCount,
        publishedCount,
        draftCount,
        assignmentsSynced,
        inference: {
          enabled: inferenceEnabled,
          model: inferenceModel,
          promptVersion: TWEET_NEWS_INFERENCE_PROMPT_VERSION,
          limit: inferenceLimit,
          attempted: inferenceAttempted,
          published: inferencePublished,
          review: inferenceReview,
          skippedClaim: inferenceSkippedClaim,
          errors: inferenceErrors,
        },
      },
      sample,
    });
  }),
  { jobName: "/api/v1/db/auto-news-feed-items" },
);
