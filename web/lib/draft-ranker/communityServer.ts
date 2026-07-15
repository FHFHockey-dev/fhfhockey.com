import { createHmac, randomUUID } from "node:crypto";

import serviceRoleClient from "lib/supabase/server";

import { DRAFT_RANKER_TARGET_SEASON_ID } from "./contracts";
import {
  DRAFT_RANKER_COMMUNITY_MODEL_VERSION,
  computeCommunityRanking,
  deduplicateCommunityPreferences,
  stableCommunityHash,
  type CommunityCandidate,
  type CommunityPairPreference,
  type CommunityPlayerResult,
} from "./communityModel";

const PAGE_SIZE = 1000;
const ID_CHUNK_SIZE = 400;

type QueryClient = {
  from(table: string): any;
  rpc(name: string, args: any): any;
};

type IdentityRow = {
  id: number;
  lifecycle_status: string;
};

type YahooRow = {
  player_key: string;
  draft_analysis: unknown;
  average_draft_pick: number | null;
};

type PairPreferenceRow = {
  user_id: string;
  low_player_id: number;
  high_player_id: number;
  preferred_player_id: number;
  comparison_id: string;
  established_at: string;
};

type CommunityPersistedResult = {
  fhfh_player_id: number;
  model_rank: number;
  public_rank: number | null;
  model_score: number;
  market_rank: number | null;
  prior_state: string;
  market_prior_weight: number;
  evidence_state: string;
  confidence_label: string;
  independent_users: number;
  comparison_count: number;
  distinct_opponents: number;
  cutoff_opponents_inside: number;
  cutoff_opponents_outside: number;
  stability_buffer_ranks: number;
  conservative_rank: number;
  public_display_eligible: boolean;
  public_top250_eligible: boolean;
  admission_basis: string | null;
  previous_public_rank: number | null;
  rank_delta: number | null;
  last_evidence_at: string | null;
  metadata: Record<string, unknown>;
};

export type DraftRankerCommunitySnapshot = {
  targetSeasonId: number;
  snapshotAsOf: string;
  cadence: "daily" | "weekly" | "manual";
  modelVersion: string;
  sourceFingerprint: string;
  operationPayloadHash: string;
  sourceSummary: Record<string, unknown>;
  exclusionSummary: Record<string, number>;
  acceptedComparisonCount: number;
  excludedComparisonCount: number;
  deduplicatedComparisonCount: number;
  converged: boolean;
  iterations: number;
  results: CommunityPersistedResult[];
};

function chunks<T>(values: T[], size = ID_CHUNK_SIZE): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function fetchAll<T>(build: (from: number, to: number) => any) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function positiveNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function priorYahooSeason(targetSeasonId: number) {
  return Math.floor(targetSeasonId / 10000) - 1;
}

function pairKey(lowPlayerId: number, highPlayerId: number) {
  return `${Math.min(lowPlayerId, highPlayerId)}:${Math.max(lowPlayerId, highPlayerId)}`;
}

function pseudonymizeUser(userId: string, key: string): string {
  return createHmac("sha256", key)
    .update(`draft-ranker-community-v1:${userId}`)
    .digest("hex");
}

export function communityCadenceForDate(
  asOf: string,
  targetSeasonId = DRAFT_RANKER_TARGET_SEASON_ID,
): "daily" | "weekly" {
  const timestamp = Date.parse(asOf);
  if (!Number.isFinite(timestamp))
    throw new Error("A valid community as-of time is required.");
  const startYear = Math.floor(targetSeasonId / 10000);
  const dailyStart = Date.UTC(startYear, 7, 15);
  const dailyEnd = Date.UTC(startYear, 9, 16);
  return timestamp >= dailyStart && timestamp < dailyEnd ? "daily" : "weekly";
}

export function communityRefreshIsDue(args: {
  asOf: string;
  cadence: "daily" | "weekly" | "manual";
}) {
  if (args.cadence !== "weekly") return true;
  return new Date(args.asOf).getUTCDay() === 0;
}

async function loadCommunityCandidates(args: {
  client: QueryClient;
  targetSeasonId: number;
}) {
  const identities = await fetchAll<IdentityRow>((from, to) =>
    args.client
      .from("fhfh_player_identities")
      .select("id,lifecycle_status")
      .eq("verification_status", "verified")
      .in("lifecycle_status", [
        "active_nhl",
        "active_prospect",
        "unsigned_relevant",
      ])
      .order("id", { ascending: true })
      .range(from, to),
  );
  const priorSeason = priorYahooSeason(args.targetSeasonId);
  const yahooRows = await fetchAll<YahooRow>((from, to) =>
    args.client
      .from("yahoo_players")
      .select("player_key,draft_analysis,average_draft_pick")
      .eq("season", priorSeason)
      .order("player_key", { ascending: true })
      .range(from, to),
  );
  const mappings: Array<{
    external_player_id: string;
    fhfh_player_id: number;
  }> = [];
  for (const keyChunk of chunks(yahooRows.map((row) => row.player_key))) {
    if (!keyChunk.length) continue;
    const { data, error } = await args.client
      .from("fhfh_player_external_identities")
      .select("external_player_id,fhfh_player_id")
      .eq("provider", "yahoo")
      .eq("verification_status", "verified")
      .in("external_player_id", keyChunk);
    if (error) throw error;
    mappings.push(...(data ?? []));
  }
  const playerByYahooKey = new Map(
    mappings.map((row) => [row.external_player_id, row.fhfh_player_id]),
  );
  const marketRankByPlayer = new Map<number, number>();
  for (const row of yahooRows) {
    const playerId = playerByYahooKey.get(row.player_key);
    if (!playerId) continue;
    const analysis = object(row.draft_analysis);
    const adp =
      positiveNumber(analysis.preseason_average_pick) ??
      positiveNumber(row.average_draft_pick);
    if (adp == null) continue;
    const current = marketRankByPlayer.get(playerId);
    if (current == null || adp < current) marketRankByPlayer.set(playerId, adp);
  }
  const candidates: CommunityCandidate[] = identities.map((identity) => {
    const marketRank = marketRankByPlayer.get(identity.id) ?? null;
    return {
      fhfhPlayerId: identity.id,
      marketRank,
      priorState: marketRank == null ? "previously_undrafted" : "market_ranked",
    };
  });
  return {
    candidates,
    priorYahooSeason: priorSeason,
    yahooRowCount: yahooRows.length,
    mappedYahooCount: marketRankByPlayer.size,
  };
}

async function loadCommunityEvidence(args: {
  client: QueryClient;
  targetSeasonId: number;
  asOf: string;
  pseudonymKey: string;
}) {
  const [preferenceRows, consentRows, exclusions] = await Promise.all([
    fetchAll<PairPreferenceRow>((from, to) =>
      args.client
        .from("draft_ranker_pair_preferences")
        .select(
          "user_id,low_player_id,high_player_id,preferred_player_id,comparison_id,established_at",
        )
        .eq("season_id", args.targetSeasonId)
        .order("established_at", { ascending: true })
        .range(from, to),
    ),
    fetchAll<{ user_id: string }>((from, to) =>
      args.client
        .from("draft_ranker_contribution_preferences")
        .select("user_id")
        .eq("contribution_enabled", true)
        .order("user_id", { ascending: true })
        .range(from, to),
    ),
    fetchAll<{
      id: string;
      exclusion_scope: "user" | "comparison" | "pair";
      user_id: string | null;
      comparison_id: string | null;
      low_player_id: number | null;
      high_player_id: number | null;
      reason_code: string;
      expires_at: string | null;
    }>((from, to) =>
      args.client
        .from("draft_ranker_community_moderation_exclusions")
        .select(
          "id,exclusion_scope,user_id,comparison_id,low_player_id,high_player_id,reason_code,expires_at",
        )
        .eq("target_season_id", args.targetSeasonId)
        .eq("active", true)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);
  const comparisonRows: Array<{
    id: string;
    community_eligible: boolean;
    created_at: string;
  }> = [];
  for (const idChunk of chunks(
    preferenceRows.map((row) => row.comparison_id),
  )) {
    if (!idChunk.length) continue;
    const { data, error } = await args.client
      .from("draft_ranker_pair_comparisons")
      .select("id,community_eligible,created_at")
      .in("id", idChunk);
    if (error) throw error;
    comparisonRows.push(...(data ?? []));
  }
  const comparisonById = new Map(comparisonRows.map((row) => [row.id, row]));
  const activeConsent = new Set(consentRows.map((row) => row.user_id));
  const asOfTimestamp = Date.parse(args.asOf);
  const activeExclusions = exclusions.filter(
    (row) =>
      row.expires_at == null || Date.parse(row.expires_at) > asOfTimestamp,
  );
  const excludedUsers = new Set(
    activeExclusions.flatMap((row) =>
      row.exclusion_scope === "user" && row.user_id ? [row.user_id] : [],
    ),
  );
  const excludedComparisons = new Set(
    activeExclusions.flatMap((row) =>
      row.exclusion_scope === "comparison" && row.comparison_id
        ? [row.comparison_id]
        : [],
    ),
  );
  const excludedPairs = new Set(
    activeExclusions.flatMap((row) =>
      row.exclusion_scope === "pair" && row.low_player_id && row.high_player_id
        ? [pairKey(row.low_player_id, row.high_player_id)]
        : [],
    ),
  );
  const preferences: CommunityPairPreference[] = preferenceRows.map((row) => {
    const comparison = comparisonById.get(row.comparison_id);
    return {
      comparisonId: row.comparison_id,
      userKey: pseudonymizeUser(row.user_id, args.pseudonymKey),
      lowPlayerId: row.low_player_id,
      highPlayerId: row.high_player_id,
      preferredPlayerId: row.preferred_player_id,
      establishedAt: row.established_at,
      communityEligible: comparison?.community_eligible === true,
      consentActive: activeConsent.has(row.user_id),
      rateEligible: comparison?.community_eligible === true,
      moderationExcluded:
        excludedUsers.has(row.user_id) ||
        excludedComparisons.has(row.comparison_id) ||
        excludedPairs.has(pairKey(row.low_player_id, row.high_player_id)),
    };
  });
  const exclusionSummary = activeExclusions.reduce<Record<string, number>>(
    (summary, exclusion) => {
      summary[exclusion.reason_code] =
        (summary[exclusion.reason_code] ?? 0) + 1;
      return summary;
    },
    {},
  );
  return {
    preferences,
    rawPreferenceCount: preferenceRows.length,
    currentConsentAccountCount: activeConsent.size,
    activeModerationExclusionCount: activeExclusions.length,
    exclusionSummary,
  };
}

function publicRanks(results: CommunityPlayerResult[]) {
  const admitted = results
    .filter(
      (result) => result.publicDisplayEligible && result.publicTop250Eligible,
    )
    .sort((left, right) => left.modelRank - right.modelRank)
    .slice(0, 250);
  return new Map(
    admitted.map((result, index) => [result.fhfhPlayerId, index + 1]),
  );
}

async function loadPreviousPublicRanks(args: {
  client: QueryClient;
  targetSeasonId: number;
}) {
  const { data: snapshot, error: snapshotError } = await args.client
    .from("draft_ranker_community_snapshots")
    .select("id")
    .eq("target_season_id", args.targetSeasonId)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snapshotError) throw snapshotError;
  if (!snapshot?.id) return new Map<number, number>();
  const rows = await fetchAll<{ fhfh_player_id: number; public_rank: number }>(
    (from, to) =>
      args.client
        .from("draft_ranker_community_player_results")
        .select("fhfh_player_id,public_rank")
        .eq("snapshot_id", snapshot.id)
        .not("public_rank", "is", null)
        .order("public_rank", { ascending: true })
        .range(from, to),
  );
  return new Map(rows.map((row) => [row.fhfh_player_id, row.public_rank]));
}

export async function buildDraftRankerCommunitySnapshot(args: {
  client?: QueryClient;
  snapshotAsOf?: string;
  cadence?: "daily" | "weekly" | "manual";
  targetSeasonId?: number;
  pseudonymKey?: string;
}): Promise<DraftRankerCommunitySnapshot> {
  const client = args.client ?? (serviceRoleClient as unknown as QueryClient);
  const targetSeasonId = args.targetSeasonId ?? DRAFT_RANKER_TARGET_SEASON_ID;
  const snapshotAsOf = args.snapshotAsOf ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(snapshotAsOf))) {
    throw new Error("A valid community snapshot time is required.");
  }
  const cadence =
    args.cadence ?? communityCadenceForDate(snapshotAsOf, targetSeasonId);
  const pseudonymKey =
    args.pseudonymKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pseudonymKey)
    throw new Error("Community pseudonymization key is unavailable.");

  const [candidateSource, evidence, previousRanks] = await Promise.all([
    loadCommunityCandidates({ client, targetSeasonId }),
    loadCommunityEvidence({
      client,
      targetSeasonId,
      asOf: snapshotAsOf,
      pseudonymKey,
    }),
    loadPreviousPublicRanks({ client, targetSeasonId }),
  ]);
  const model = computeCommunityRanking({
    candidates: candidateSource.candidates,
    preferences: evidence.preferences,
  });
  if (!model.converged) throw new Error("Community model did not converge.");
  const accepted = deduplicateCommunityPreferences(
    evidence.preferences,
  ).accepted;
  const latestEvidenceByPlayer = new Map<number, string>();
  for (const preference of accepted) {
    for (const playerId of [preference.lowPlayerId, preference.highPlayerId]) {
      const current = latestEvidenceByPlayer.get(playerId);
      if (!current || preference.establishedAt > current) {
        latestEvidenceByPlayer.set(playerId, preference.establishedAt);
      }
    }
  }
  const currentPublicRanks = publicRanks(model.players);
  const results: CommunityPersistedResult[] = model.players.map((player) => {
    const publicRank = currentPublicRanks.get(player.fhfhPlayerId) ?? null;
    const previousPublicRank = previousRanks.get(player.fhfhPlayerId) ?? null;
    return {
      fhfh_player_id: player.fhfhPlayerId,
      model_rank: player.modelRank,
      public_rank: publicRank,
      model_score: player.score,
      market_rank: player.marketRank,
      prior_state: player.priorState,
      market_prior_weight: player.marketPriorWeight,
      evidence_state: player.evidenceState,
      confidence_label: player.confidenceLabel,
      independent_users: player.independentUsers,
      comparison_count: player.comparisonCount,
      distinct_opponents: player.distinctOpponents,
      cutoff_opponents_inside: player.cutoffOpponentsInside,
      cutoff_opponents_outside: player.cutoffOpponentsOutside,
      stability_buffer_ranks: player.stabilityBufferRanks,
      conservative_rank: player.conservativeRank,
      public_display_eligible: player.publicDisplayEligible,
      public_top250_eligible: player.publicTop250Eligible,
      admission_basis: player.admissionBasis,
      previous_public_rank: previousPublicRank,
      rank_delta:
        publicRank != null && previousPublicRank != null
          ? previousPublicRank - publicRank
          : null,
      last_evidence_at: latestEvidenceByPlayer.get(player.fhfhPlayerId) ?? null,
      metadata: {
        modelVersion: model.modelVersion,
        conservativeAdmission: player.admissionBasis === "community_evidence",
      },
    };
  });
  const sourceSummary = {
    candidateCount: candidateSource.candidates.length,
    marketRankedCount: candidateSource.candidates.filter(
      (row) => row.marketRank != null,
    ).length,
    previouslyUndraftedCount: candidateSource.candidates.filter(
      (row) => row.marketRank == null,
    ).length,
    priorYahooSeason: candidateSource.priorYahooSeason,
    yahooRowCount: candidateSource.yahooRowCount,
    mappedYahooCount: candidateSource.mappedYahooCount,
    rawPreferenceCount: evidence.rawPreferenceCount,
    currentConsentAccountCount: evidence.currentConsentAccountCount,
    activeModerationExclusionCount: evidence.activeModerationExclusionCount,
    publicDisplayCount: results.filter((row) => row.public_display_eligible)
      .length,
    publicTop250Count: results.filter((row) => row.public_rank != null).length,
  };
  const sourceFingerprint = stableCommunityHash({
    targetSeasonId,
    candidates: candidateSource.candidates,
    preferences: accepted,
    exclusions: evidence.exclusionSummary,
  });
  const operationPayloadHash = stableCommunityHash({
    targetSeasonId,
    snapshotAsOf,
    cadence,
    modelVersion: DRAFT_RANKER_COMMUNITY_MODEL_VERSION,
    sourceFingerprint,
  });
  return {
    targetSeasonId,
    snapshotAsOf,
    cadence,
    modelVersion: DRAFT_RANKER_COMMUNITY_MODEL_VERSION,
    sourceFingerprint,
    operationPayloadHash,
    sourceSummary,
    exclusionSummary: evidence.exclusionSummary,
    acceptedComparisonCount: model.acceptedComparisonCount,
    excludedComparisonCount: model.excludedComparisonCount,
    deduplicatedComparisonCount: model.deduplicatedComparisonCount,
    converged: model.converged,
    iterations: model.iterations,
    results,
  };
}

export async function persistDraftRankerCommunitySnapshot(args: {
  client?: QueryClient;
  snapshot: DraftRankerCommunitySnapshot;
  operationId?: string;
  requestedBy?: string | null;
}) {
  const client = args.client ?? (serviceRoleClient as unknown as QueryClient);
  const operationId = args.operationId ?? randomUUID();
  const { data, error } = await client.rpc(
    "replace_draft_ranker_community_snapshot",
    {
      p_target_season_id: args.snapshot.targetSeasonId,
      p_snapshot_as_of: args.snapshot.snapshotAsOf,
      p_cadence: args.snapshot.cadence,
      p_model_version: args.snapshot.modelVersion,
      p_operation_id: operationId,
      p_operation_payload_hash: args.snapshot.operationPayloadHash,
      p_source_fingerprint: args.snapshot.sourceFingerprint,
      p_requested_by: args.requestedBy ?? null,
      p_source_summary: args.snapshot.sourceSummary,
      p_exclusion_summary: args.snapshot.exclusionSummary,
      p_accepted_comparison_count: args.snapshot.acceptedComparisonCount,
      p_excluded_comparison_count: args.snapshot.excludedComparisonCount,
      p_deduplicated_comparison_count:
        args.snapshot.deduplicatedComparisonCount,
      p_results: args.snapshot.results,
    },
  );
  if (error) throw error;
  const result = object(data);
  if (result.status === "conflict") {
    throw new Error(
      String(result.message ?? "Community snapshot idempotency conflict."),
    );
  }
  if (result.status !== "completed") {
    throw new Error("Community snapshot persistence did not complete.");
  }
  return result;
}
