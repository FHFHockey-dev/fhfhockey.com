import type { NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { normalizeNewsTeamId } from "lib/newsFeed";
import {
  buildTweetNewsAmbiguousCandidate,
  buildTweetNewsAutomationCandidate,
  type TweetNewsAutomationPlayer,
  type TweetNewsAutomationReviewRow,
} from "lib/sources/tweetNewsAutomation";
import { syncTweetPatternReviewItems } from "pages/api/v1/db/tweet-pattern-review";
import adminOnly from "utils/adminOnlyMiddleware";

type ExistingNewsItemRow = {
  id: string;
  source_review_item_id: string | null;
  card_status: "draft" | "published" | "archived";
  published_at: string | null;
  metadata: Record<string, unknown> | null;
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

async function fetchValidTeamIds(args: {
  supabase: any;
}): Promise<Set<number>> {
  const { data, error } = await args.supabase.from("teams" as any).select("id");
  if (error) throw error;

  return new Set(
    ((data ?? []) as Array<{ id: unknown }>)
      .map((row) => Number(row.id))
      .filter((teamId) => Number.isFinite(teamId)),
  );
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
    card_status: args.candidate.cardStatus,
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
    const validTeamIds = await fetchValidTeamIds({ supabase: req.supabase });
    const existingByReviewItemId = await fetchExistingNewsItems({
      supabase: req.supabase,
      reviewItemIds: rows.map((row) => row.id),
    });

    const candidates = rows
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
      },
      sample,
    });
  }),
  { jobName: "/api/v1/db/auto-news-feed-items" },
);
