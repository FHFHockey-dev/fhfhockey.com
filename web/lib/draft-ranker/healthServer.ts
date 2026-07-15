import { createHash } from "node:crypto";

import type { Json } from "lib/supabase/database-generated.types";

import { operationPayloadHash } from "./contracts";
import {
  draftRankerRolloutStage,
  isCommunityDraftRankingsEnabled,
  isDraftRankerCommunityContributionEnabled,
  isDraftRankerDiscoveryEnabled,
  isDraftRankerEnabled,
  isDraftRankerHomepageEnabled,
} from "./api";
import {
  analyzeDraftRankingOrdering,
  summarizeDraftRankerHealth,
} from "./health";

type QueryClient = {
  from(table: string): any;
  rpc(name: string, args: any): any;
};

async function exactCount(query: any): Promise<number> {
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function loadDraftRankerHealth(
  client: QueryClient,
  asOf = new Date().toISOString(),
) {
  const { data: rankings, error: rankingError } = await client
    .from("draft_rankings")
    .select("id,lock_version,target_season_id")
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (rankingError) throw rankingError;
  const rankingRows = (rankings ?? []) as Array<{
    id: string;
    lock_version: number;
    target_season_id: number;
  }>;
  const rankingIds = rankingRows.map((ranking) => ranking.id);
  const { data: entries, error: entryError } = rankingIds.length
    ? await client
        .from("draft_ranking_entries")
        .select(
          "ranking_id,fhfh_player_id,order_key,player:fhfh_player_identities!draft_ranking_entries_fhfh_player_id_fkey(id,verification_status,merged_into_id,lifecycle_status)",
        )
        .in("ranking_id", rankingIds)
        .order("order_key", { ascending: true })
    : { data: [], error: null };
  if (entryError) throw entryError;
  const entryRows = (entries ?? []) as unknown as Array<{
    ranking_id: string;
    fhfh_player_id: number;
    order_key: number;
    player: null | {
      id: number;
      verification_status: string;
      merged_into_id: number | null;
      lifecycle_status: string;
    };
  }>;
  const entriesByRanking = new Map<string, number[]>();
  for (const entry of entryRows) {
    const keys = entriesByRanking.get(entry.ranking_id) ?? [];
    keys.push(Number(entry.order_key));
    entriesByRanking.set(entry.ranking_id, keys);
  }
  const orderings = rankingRows.map((ranking) =>
    analyzeDraftRankingOrdering({
      rankingId: ranking.id,
      lockVersion: Number(ranking.lock_version),
      orderKeys: entriesByRanking.get(ranking.id) ?? [],
    }),
  );
  const rankableLifecycles = new Set([
    "active_nhl",
    "active_prospect",
    "unsigned_relevant",
  ]);
  const identityReviewCandidateIds = [
    ...new Set(
      entryRows.flatMap((entry) =>
        !entry.player ||
        entry.player.verification_status !== "verified" ||
        entry.player.merged_into_id != null ||
        !rankableLifecycles.has(entry.player.lifecycle_status)
          ? [entry.fhfh_player_id]
          : [],
      ),
    ),
  ].sort((left, right) => left - right);

  const [
    expiredActivePlacementCount,
    incompleteSeedRunCount,
    pendingIdentityReviewCount,
  ] = await Promise.all([
    exactCount(
      client
        .from("draft_ranker_placement_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .lte("expires_at", asOf),
    ),
    exactCount(
      client
        .from("draft_ranking_seed_runs")
        .select("id", { count: "exact", head: true })
        .neq("status", "completed"),
    ),
    exactCount(
      client
        .from("fhfh_player_identity_review_queue")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "in_review"]),
    ),
  ]);
  const targetSeasonId = rankingRows[0]?.target_season_id ?? 20262027;
  const rateWindowStart = new Date(
    Date.parse(asOf) - 24 * 60 * 60 * 1_000,
  ).toISOString();
  const [
    communityResult,
    discoveryResult,
    recentRateEventCount,
    hardLimitedRateEventCount,
    communitySuppressedRateEventCount,
  ] = await Promise.all([
    client
      .from("draft_ranker_community_snapshots")
      .select(
        "id,published_at,model_version,player_count,public_display_count,public_top250_count,metadata",
      )
      .eq("target_season_id", targetSeasonId)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("draft_ranker_discovery_refresh_runs")
      .select(
        "id,completed_at,algorithm_version,group_counts,warning_codes,source_summary",
      )
      .eq("target_season_id", targetSeasonId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    exactCount(
      client
        .from("draft_ranker_pairwise_rate_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", rateWindowStart),
    ),
    exactCount(
      client
        .from("draft_ranker_pairwise_rate_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", rateWindowStart)
        .eq("decision", "hard_limited"),
    ),
    exactCount(
      client
        .from("draft_ranker_pairwise_rate_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", rateWindowStart)
        .eq("decision", "community_suppressed"),
    ),
  ]);
  const resultError = communityResult.error ?? discoveryResult.error;
  if (resultError) throw resultError;
  const summary = summarizeDraftRankerHealth({
    orderings,
    identityReviewCandidateCount: identityReviewCandidateIds.length,
    pendingIdentityReviewCount,
    expiredActivePlacementCount,
    incompleteSeedRunCount,
    missingCommunitySnapshot: !communityResult.data,
    missingDiscoveryRefresh: !discoveryResult.data,
  });
  return {
    ...summary,
    asOf,
    targetSeasonId,
    counts: {
      activeRankings: rankingRows.length,
      rankingEntries: entryRows.length,
      normalizationRecommended: orderings.filter(
        (ordering) => ordering.normalizationRecommended,
      ).length,
      underfilledTop250: orderings.filter(
        (ordering) => ordering.underfilledTop250,
      ).length,
      identityReviewCandidates: identityReviewCandidateIds.length,
      pendingIdentityReviews: pendingIdentityReviewCount,
      expiredActivePlacements: expiredActivePlacementCount,
      incompleteSeedRuns: incompleteSeedRunCount,
      pairwiseRateEvents24h: recentRateEventCount,
      hardLimitedPairwiseEvents24h: hardLimitedRateEventCount,
      communitySuppressedPairwiseEvents24h: communitySuppressedRateEventCount,
    },
    flags: {
      ranker: isDraftRankerEnabled(),
      homepage: isDraftRankerHomepageEnabled(),
      contribution: isDraftRankerCommunityContributionEnabled(),
      discovery: isDraftRankerDiscoveryEnabled(),
      community: isCommunityDraftRankingsEnabled(),
      rolloutStage: draftRankerRolloutStage(),
      staffAllowlistCount: String(process.env.DRAFT_RANKER_STAFF_USER_IDS ?? "")
        .split(",")
        .filter(Boolean).length,
      betaAllowlistCount: String(process.env.DRAFT_RANKER_BETA_USER_IDS ?? "")
        .split(",")
        .filter(Boolean).length,
    },
    orderings,
    identityReviewCandidateIds: identityReviewCandidateIds.slice(0, 100),
    identityReviewCandidateIdsTruncated:
      identityReviewCandidateIds.length > 100,
    community: communityResult.data ?? null,
    discovery: discoveryResult.data ?? null,
  };
}

export async function normalizeDraftRankingOrdering(
  client: QueryClient,
  input: {
    rankingId: string;
    expectedVersion: number;
    operationId: string;
    reason: string;
    confirmation: "NORMALIZE_ORDERING";
  },
) {
  const { data, error } = await client.rpc("repair_draft_ranking_ordering", {
    p_ranking_id: input.rankingId,
    p_expected_version: input.expectedVersion,
    p_operation_id: input.operationId,
    p_operation_payload_hash: operationPayloadHash(input),
    p_reason: input.reason,
    p_confirmation: input.confirmation,
  });
  if (error) throw error;
  return data;
}

export async function queueDraftRankerIdentityReview(
  client: QueryClient,
  input: {
    playerId: number;
    operationId: string;
    reason: string;
    confirmation: "QUEUE_IDENTITY_REVIEW";
  },
) {
  const { data: player, error: playerError } = await client
    .from("fhfh_player_identities")
    .select(
      "id,canonical_name,verification_status,lifecycle_status,merged_into_id",
    )
    .eq("id", input.playerId)
    .maybeSingle();
  if (playerError) throw playerError;
  if (!player) return { status: "not_found", playerId: input.playerId };
  const reasonKey = createHash("sha256")
    .update(input.reason.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
  const dedupeKey = `draft-ranker-health:${input.playerId}:${reasonKey}`;
  const row = {
    review_type: "identity_conflict",
    raw_name: player.canonical_name,
    submitted_context: {
      source: "draft_ranker_health",
      reason: input.reason.trim(),
    } as Json,
    candidate_fhfh_player_ids: [input.playerId],
    source_evidence: {
      operationId: input.operationId,
      verificationStatus: player.verification_status,
      lifecycleStatus: player.lifecycle_status,
      mergedIntoId: player.merged_into_id,
    } as Json,
    dedupe_key: dedupeKey,
    status: "pending",
  };
  const { data, error } = await client
    .from("fhfh_player_identity_review_queue")
    .insert(row)
    .select("id,status,dedupe_key")
    .single();
  if (!error)
    return { status: "queued", review: data, idempotentReplay: false };
  if (error.code !== "23505") throw error;
  const { data: existing, error: existingError } = await client
    .from("fhfh_player_identity_review_queue")
    .select("id,status,dedupe_key")
    .eq("dedupe_key", dedupeKey)
    .in("status", ["pending", "in_review"])
    .single();
  if (existingError) throw existingError;
  return { status: "queued", review: existing, idempotentReplay: true };
}
