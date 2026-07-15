import serviceRoleClient from "lib/supabase/server";

import type { Json } from "lib/supabase/database-generated.types";

import {
  DRAFT_RANKER_TARGET_SEASON_ID,
  DRAFT_RANKER_CONSENT_POLICY_VERSION,
  operationPayloadHash,
  type DraftContributionPreferenceInput,
  type DraftPairComparisonInput,
  type DraftPairQueueInput,
  type DraftPairPromptIssueInput,
  type DraftPlacementMutationInput,
  type DraftPlacementQuery,
  type InitializeDraftRankingInput,
  type DraftPlayerActionInput,
  type DraftPlayerSearchQuery,
  type ReorderDraftRankingInput,
  type RequestDraftPlayerAdditionInput,
} from "./contracts";
import {
  answerPlacementEngine,
  startPlacementEngine,
  type PlacementAnchor,
  type PlacementAnswer,
  type PlacementEngineState,
  type PlacementEntry,
  type PlacementRoughRange,
} from "./placementEngine";
import {
  buildDeterministicDraftPairQueue,
  canonicalPairKey,
  DRAFT_PAIR_QUEUE_ALGORITHM_VERSION,
  type DraftPairQueueCandidate,
  type DraftPairQueuePlayer,
} from "./queue";
import {
  DraftRankerApiError,
  isDraftRankerCommunityContributionEnabled,
} from "./api";
import { draftPairwiseRateLimitConfig } from "./rateLimit";

export async function loadDraftRankerBootstrap(userId: string) {
  const { data: ranking, error: rankingError } = await serviceRoleClient
    .from("draft_rankings")
    .select(
      "id,target_season_id,name,status,is_default,scoring_profile,external_context,schema_version,seed_revision,lock_version,created_at,updated_at",
    )
    .eq("user_id", userId)
    .eq("target_season_id", DRAFT_RANKER_TARGET_SEASON_ID)
    .eq("status", "active")
    .eq("is_default", true)
    .maybeSingle();

  if (rankingError) {
    throw rankingError;
  }

  if (!ranking) {
    return {
      initialized: false,
      targetSeasonId: DRAFT_RANKER_TARGET_SEASON_ID,
      ranking: null,
      counts: { entries: 0, watchlist: 0 },
      latestSeedRun: null,
    };
  }

  const [entriesResult, watchlistResult, seedRunResult] = await Promise.all([
    serviceRoleClient
      .from("draft_ranking_entries")
      .select("fhfh_player_id", { count: "exact", head: true })
      .eq("ranking_id", ranking.id)
      .eq("user_id", userId),
    serviceRoleClient
      .from("draft_ranking_watchlist")
      .select("fhfh_player_id", { count: "exact", head: true })
      .eq("ranking_id", ranking.id)
      .eq("user_id", userId),
    serviceRoleClient
      .from("draft_ranking_seed_runs")
      .select(
        "id,seed_revision,source_season_id,status,source_count,seeded_count,invalid_adp_count,unmapped_count,fallback_count,result_summary,error_summary,started_at,completed_at",
      )
      .eq("ranking_id", ranking.id)
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const queryError =
    entriesResult.error ?? watchlistResult.error ?? seedRunResult.error;
  if (queryError) {
    throw queryError;
  }

  return {
    initialized: true,
    targetSeasonId: DRAFT_RANKER_TARGET_SEASON_ID,
    ranking,
    counts: {
      entries: entriesResult.count ?? 0,
      watchlist: watchlistResult.count ?? 0,
    },
    latestSeedRun: seedRunResult.data ?? null,
  };
}

export async function requireOwnedDraftRanking(
  userId: string,
  rankingId: string,
) {
  const { data, error } = await serviceRoleClient
    .from("draft_rankings")
    .select("id,user_id,target_season_id,lock_version,status")
    .eq("id", rankingId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new DraftRankerApiError(
      404,
      "not_found",
      "The requested ranking was not found.",
    );
  }
  return data;
}

export async function loadDraftRankingEntries(
  userId: string,
  rankingId: string,
) {
  const ranking = await requireOwnedDraftRanking(userId, rankingId);
  const { data, error } = await serviceRoleClient
    .from("draft_ranking_entries")
    .select(
      "fhfh_player_id,order_key,seed_source,seed_adp,seed_rank,tier,notes,updated_at,player:fhfh_player_identities!draft_ranking_entries_fhfh_player_id_fkey(canonical_name,canonical_position,current_organization_name,headshot_url,lifecycle_status)",
    )
    .eq("ranking_id", rankingId)
    .eq("user_id", userId)
    .order("order_key", { ascending: true });

  if (error) throw error;

  return {
    ranking: {
      id: ranking.id,
      lockVersion: ranking.lock_version,
      targetSeasonId: ranking.target_season_id,
      status: ranking.status,
    },
    entries: (data ?? []).map((entry, index) => ({
      playerId: entry.fhfh_player_id,
      rank: index + 1,
      orderKey: entry.order_key,
      seedSource: entry.seed_source,
      seedAdp: entry.seed_adp,
      seedRank: entry.seed_rank,
      tier: entry.tier,
      notes: entry.notes,
      updatedAt: entry.updated_at,
      player: entry.player,
    })),
  };
}

type DraftPlayerSearchRow = {
  player_id: number;
  canonical_name: string;
  birth_year: number | null;
  canonical_position: string | null;
  current_organization_name: string | null;
  current_organization_type: string;
  lifecycle_status: string;
  headshot_url: string | null;
  nhl_player_id: number | null;
  yahoo_player_id: string | null;
  external_providers: string[];
  is_rankable: boolean;
  match_kind: string;
  similarity_score: number;
};

export async function searchDraftPlayers(input: DraftPlayerSearchQuery) {
  const { data, error } = await serviceRoleClient.rpc(
    "search_fhfh_draft_players",
    {
      p_query: input.query,
      p_include_archived: input.includeArchived,
      p_limit: input.limit,
    },
  );

  if (error) throw error;

  return {
    query: input.query,
    includeArchived: input.includeArchived,
    results: ((data ?? []) as DraftPlayerSearchRow[]).map((player) => ({
      playerId: player.player_id,
      canonicalName: player.canonical_name,
      birthYear: player.birth_year,
      position: player.canonical_position,
      organizationName: player.current_organization_name,
      organizationType: player.current_organization_type,
      lifecycleStatus: player.lifecycle_status,
      headshotUrl: player.headshot_url,
      nhlPlayerId: player.nhl_player_id,
      yahooPlayerId: player.yahoo_player_id,
      externalProviders: player.external_providers ?? [],
      isRankable: player.is_rankable,
      matchKind: player.match_kind,
      similarityScore: player.similarity_score,
    })),
  };
}

type PlayerAdditionResult = {
  status: "completed" | "duplicate" | "rate_limited" | "failed";
  code?: string;
  message?: string;
  requestId?: string;
  requestStatus?: string;
  created?: boolean;
  retryAfterSeconds?: number;
};

export async function requestDraftPlayerAddition(
  userId: string,
  input: RequestDraftPlayerAdditionInput,
) {
  const submittedContext = Object.fromEntries(
    Object.entries({
      organization: input.organization,
      position: input.position,
      notes: input.notes,
    }).filter(([, value]) => value !== undefined && value !== ""),
  );
  const { data, error } = await serviceRoleClient.rpc(
    "request_fhfh_player_addition",
    {
      p_user_id: userId,
      p_raw_name: input.rawName,
      p_submitted_context: submittedContext,
      p_candidate_fhfh_player_ids: input.candidatePlayerIds,
    },
  );

  if (error) throw error;
  const result = data as PlayerAdditionResult | null;
  if (!result || !result.status) {
    throw new Error("Player-addition request returned an invalid result.");
  }
  if (result.status === "rate_limited") {
    throw new DraftRankerApiError(
      429,
      "rate_limited",
      result.message ?? "Too many player-addition requests.",
      { retryAfterSeconds: result.retryAfterSeconds ?? 86400 },
    );
  }
  if (result.status === "failed") {
    throw new DraftRankerApiError(
      422,
      "unprocessable",
      result.message ?? "The player-addition request could not be submitted.",
      { reason: result.code ?? "player_addition_failed" },
    );
  }
  return result;
}

export async function loadDraftPlayerActions(
  userId: string,
  rankingId: string,
) {
  await requireOwnedDraftRanking(userId, rankingId);
  const [watchlistResult, preferencesResult] = await Promise.all([
    serviceRoleClient
      .from("draft_ranking_watchlist")
      .select(
        "fhfh_player_id,priority,note,source,reason,created_at,updated_at,player:fhfh_player_identities!draft_ranking_watchlist_fhfh_player_id_fkey(canonical_name,canonical_position,current_organization_name,headshot_url,lifecycle_status)",
      )
      .eq("ranking_id", rankingId)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    serviceRoleClient
      .from("draft_ranker_player_preferences")
      .select(
        "fhfh_player_id,disposition,comparison_requested_at,source,created_at,updated_at",
      )
      .eq("ranking_id", rankingId)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
  ]);

  const error = watchlistResult.error ?? preferencesResult.error;
  if (error) throw error;
  return {
    rankingId,
    watchlist: (watchlistResult.data ?? []).map((row) => ({
      playerId: row.fhfh_player_id,
      priority: row.priority,
      note: row.note,
      source: row.source,
      reason: row.reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      player: row.player,
    })),
    preferences: (preferencesResult.data ?? []).map((row) => ({
      playerId: row.fhfh_player_id,
      disposition: row.disposition,
      comparisonRequestedAt: row.comparison_requested_at,
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

export async function applyDraftPlayerAction(
  userId: string,
  input: DraftPlayerActionInput,
) {
  const { data, error } = await serviceRoleClient.rpc(
    "apply_draft_ranker_player_action",
    {
      p_user_id: userId,
      p_ranking_id: input.rankingId,
      p_fhfh_player_id: input.playerId,
      p_action: input.action,
      p_operation_id: input.operationId,
      p_priority: input.priority ?? undefined,
      p_note: input.note ?? undefined,
      p_source:
        input.sourceContext === "discovery"
          ? "draft_ranker_discovery"
          : "draft_ranker_search",
    },
  );
  if (error) throw error;
  if (!isMutationResult(data)) {
    throw new Error("Draft Ranker player action returned an invalid result.");
  }
  if (data.status === "not_found") {
    throw new DraftRankerApiError(
      404,
      "not_found",
      data.message ?? "The requested ranking was not found.",
    );
  }
  if (data.status === "conflict") {
    throw new DraftRankerApiError(
      409,
      "idempotency_conflict",
      data.message ?? "The operation conflicts with an earlier request.",
    );
  }
  if (data.status === "failed") {
    throw new DraftRankerApiError(
      422,
      "unprocessable",
      data.message ?? "The player action could not be applied.",
      { reason: data.code ?? "player_action_failed" },
    );
  }
  return data;
}

type PlacementSessionRow = {
  id: string;
  user_id: string;
  ranking_id: string;
  fhfh_player_id: number;
  status: string;
  rough_range: string | null;
  interval_low: number;
  interval_high: number;
  plausible_low: number | null;
  plausible_high: number | null;
  question_count: number;
  contradiction_count: number;
  ranking_version: number;
  issued_anchors: Json;
  answers: Json;
  suggested_rank: number | null;
  expires_at: string;
  engine_version: string;
  confidence: string;
  completion_reason: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  player?: unknown;
};

function placementStateFromRow(row: PlacementSessionRow): PlacementEngineState {
  if (!Array.isArray(row.issued_anchors) || !Array.isArray(row.answers)) {
    throw new Error("Placement session contains invalid engine evidence.");
  }
  return {
    roughRange: (row.rough_range ?? "unsure") as PlacementRoughRange,
    intervalLow: row.interval_low,
    intervalHigh: row.interval_high,
    plausibleLow: row.plausible_low,
    plausibleHigh: row.plausible_high,
    questionCount: row.question_count,
    contradictionCount: row.contradiction_count,
    issuedAnchors: row.issued_anchors as unknown as PlacementAnchor[],
    answers: row.answers as unknown as PlacementAnswer[],
    suggestedRank: row.suggested_rank,
    ready: row.suggested_rank !== null && row.completion_reason !== null,
    confidence: row.confidence as PlacementEngineState["confidence"],
    completionReason: row.completion_reason,
  };
}

function placementStateJson(state: PlacementEngineState): Json {
  return {
    roughRange: state.roughRange,
    intervalLow: state.intervalLow,
    intervalHigh: state.intervalHigh,
    plausibleLow: state.plausibleLow,
    plausibleHigh: state.plausibleHigh,
    questionCount: state.questionCount,
    contradictionCount: state.contradictionCount,
    issuedAnchors: state.issuedAnchors as unknown as Json,
    answers: state.answers as unknown as Json,
    suggestedRank: state.suggestedRank,
    ready: state.ready,
    confidence: state.confidence,
    completionReason: state.completionReason,
  };
}

async function loadPlacementEntries(
  userId: string,
  rankingId: string,
  targetPlayerId: number,
): Promise<PlacementEntry[]> {
  await requireOwnedDraftRanking(userId, rankingId);
  const { data, error } = await serviceRoleClient
    .from("draft_ranking_entries")
    .select("fhfh_player_id,order_key")
    .eq("ranking_id", rankingId)
    .eq("user_id", userId)
    .order("order_key", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter((entry) => entry.fhfh_player_id !== targetPlayerId)
    .map((entry, index) => ({
      playerId: entry.fhfh_player_id,
      rank: index + 1,
    }));
}

export async function loadDraftPlacement(
  userId: string,
  query: DraftPlacementQuery,
) {
  let request = serviceRoleClient
    .from("draft_ranker_placement_sessions")
    .select(
      "id,user_id,ranking_id,fhfh_player_id,status,rough_range,interval_low,interval_high,plausible_low,plausible_high,question_count,contradiction_count,ranking_version,issued_anchors,answers,suggested_rank,expires_at,engine_version,confidence,completion_reason,created_at,updated_at,completed_at,player:fhfh_player_identities!draft_ranker_placement_sessions_fhfh_player_id_fkey(canonical_name,canonical_position,current_organization_name,headshot_url,lifecycle_status)",
    )
    .eq("user_id", userId);
  if (query.sessionId) request = request.eq("id", query.sessionId);
  if (query.rankingId) {
    await requireOwnedDraftRanking(userId, query.rankingId);
    request = request
      .eq("ranking_id", query.rankingId)
      .eq("status", "active")
      .order("updated_at", { ascending: false });
  }
  const { data, error } = await request.limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return { session: null };

  const row = data as unknown as PlacementSessionRow;
  const state = placementStateFromRow(row);
  const currentAnchor = state.issuedAnchors.at(-1) ?? null;
  let anchorPlayer = null;
  if (currentAnchor && !state.ready) {
    const anchorResult = await serviceRoleClient
      .from("fhfh_player_identities")
      .select(
        "id,canonical_name,canonical_position,current_organization_name,headshot_url,lifecycle_status",
      )
      .eq("id", currentAnchor.playerId)
      .maybeSingle();
    if (anchorResult.error) throw anchorResult.error;
    anchorPlayer = anchorResult.data;
  }
  const entries = state.ready
    ? await loadDraftRankingEntries(userId, row.ranking_id)
    : null;
  const suggested = state.suggestedRank;
  return {
    session: {
      id: row.id,
      rankingId: row.ranking_id,
      playerId: row.fhfh_player_id,
      status: row.status,
      rankingVersion: row.ranking_version,
      expiresAt: row.expires_at,
      engineVersion: row.engine_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      player: row.player ?? null,
      state,
      currentAnchor,
      anchorPlayer,
      neighbors:
        entries && suggested
          ? {
              above: entries.entries[suggested - 2] ?? null,
              below: entries.entries[suggested - 1] ?? null,
            }
          : null,
    },
  };
}

function throwPlacementMutationError(
  data: Json,
  fallback: string,
): asserts data is Json & DraftRankerMutationResult {
  if (!isMutationResult(data))
    throw new Error(`${fallback} returned an invalid result.`);
  if (data.status === "not_found") {
    throw new DraftRankerApiError(
      404,
      "not_found",
      "Placement session was not found.",
    );
  }
  if (data.status === "conflict") {
    const stale = data.code === "stale_ranking_version";
    const activePlacement = data.code === "active_placement_exists";
    throw new DraftRankerApiError(
      409,
      stale ? "stale_ranking_version" : "idempotency_conflict",
      stale
        ? "The ranking changed. Placement must be revalidated."
        : activePlacement
          ? "Another placement is already active. Resume or cancel it first."
          : "Placement state changed in another request.",
      {
        reason: data.code ?? "placement_conflict",
        sessionId: data.sessionId ?? null,
        playerId: data.playerId ?? null,
        currentVersion: data.currentVersion ?? null,
      },
    );
  }
  if (data.status === "failed") {
    throw new DraftRankerApiError(
      422,
      "unprocessable",
      "The placement action could not be applied.",
      { reason: data.code ?? "placement_failed" },
    );
  }
}

export async function mutateDraftPlacement(
  userId: string,
  input: DraftPlacementMutationInput,
) {
  const payloadHash = operationPayloadHash(input);
  if (input.action === "start") {
    const entries = await loadPlacementEntries(
      userId,
      input.rankingId,
      input.playerId,
    );
    if (!entries.length) {
      throw new DraftRankerApiError(
        422,
        "unprocessable",
        "The ranking needs at least one placed anchor.",
      );
    }
    const state = startPlacementEngine(input.roughRange, entries);
    const { data, error } = await serviceRoleClient.rpc(
      "begin_draft_ranker_placement",
      {
        p_user_id: userId,
        p_ranking_id: input.rankingId,
        p_fhfh_player_id: input.playerId,
        p_expected_version: input.expectedVersion,
        p_operation_id: input.operationId,
        p_operation_payload_hash: payloadHash,
        p_state: placementStateJson(state),
      },
    );
    if (error) throw error;
    throwPlacementMutationError(data, "Placement start");
    return loadDraftPlacement(userId, { sessionId: String(data.sessionId) });
  }

  const current = await loadDraftPlacement(userId, {
    sessionId: input.sessionId,
  });
  if (!current.session) {
    throw new DraftRankerApiError(
      404,
      "not_found",
      "Placement session was not found.",
    );
  }

  if (input.action === "answer") {
    const entries = await loadPlacementEntries(
      userId,
      current.session.rankingId,
      current.session.playerId,
    );
    const nextState = answerPlacementEngine(
      current.session.state,
      entries,
      input.outcome,
    );
    const anchor = current.session.currentAnchor;
    if (!anchor) throw new Error("Placement session has no active anchor.");
    const { data, error } = await serviceRoleClient.rpc(
      "advance_draft_ranker_placement",
      {
        p_user_id: userId,
        p_session_id: input.sessionId,
        p_expected_question_count: current.session.state.questionCount,
        p_expected_anchor_player_id: anchor.playerId,
        p_operation_id: input.operationId,
        p_operation_payload_hash: payloadHash,
        p_state: placementStateJson(nextState),
      },
    );
    if (error) throw error;
    throwPlacementMutationError(data, "Placement answer");
  } else {
    const functionName =
      input.action === "confirm"
        ? "confirm_draft_ranker_placement"
        : "cancel_draft_ranker_placement";
    const { data, error } = await serviceRoleClient.rpc(functionName, {
      p_user_id: userId,
      p_session_id: input.sessionId,
      p_operation_id: input.operationId,
      p_operation_payload_hash: payloadHash,
    });
    if (error) throw error;
    throwPlacementMutationError(data, `Placement ${input.action}`);
  }
  return loadDraftPlacement(userId, { sessionId: input.sessionId });
}

type DraftRankerMutationResult = {
  status: "completed" | "conflict" | "failed" | "not_found" | "rate_limited";
  code?: string;
  message?: string;
  rankingId?: string;
  idempotentReplay?: boolean;
  [key: string]: unknown;
};

function isMutationResult(
  value: Json,
): value is Json & DraftRankerMutationResult {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    ["completed", "conflict", "failed", "not_found", "rate_limited"].includes(
      String(value.status),
    ),
  );
}

export async function initializeDraftRanking(
  userId: string,
  input: InitializeDraftRankingInput,
) {
  const payloadHash = operationPayloadHash(input);
  const { data, error } = await serviceRoleClient.rpc(
    "initialize_draft_ranking_from_yahoo",
    {
      p_user_id: userId,
      p_operation_id: input.operationId,
      p_operation_payload_hash: payloadHash,
      p_scoring_profile: input.scoringProfile as Json,
    },
  );

  if (error) {
    throw error;
  }
  if (!isMutationResult(data)) {
    throw new Error("Draft Ranker initialization returned an invalid result.");
  }
  if (data.status === "conflict") {
    throw new DraftRankerApiError(
      409,
      "idempotency_conflict",
      data.message ?? "The operation conflicts with an earlier request.",
      { rankingId: data.rankingId ?? null },
    );
  }
  if (data.status === "failed") {
    const conflict = data.code === "ranking_not_empty";
    throw new DraftRankerApiError(
      conflict ? 409 : 422,
      conflict ? "idempotency_conflict" : "unprocessable",
      data.message ?? "The ranking could not be initialized.",
      {
        reason: data.code ?? "initialization_failed",
        rankingId: data.rankingId ?? null,
      },
    );
  }
  return data;
}

export async function reorderDraftRanking(
  userId: string,
  input: ReorderDraftRankingInput,
) {
  const payloadHash = operationPayloadHash(input);
  const targetRank = input.action === "move_to_rank" ? input.targetRank : null;
  const anchorPlayerId =
    input.action === "insert_above" || input.action === "insert_below"
      ? input.anchorPlayerId
      : null;
  const { data, error } = await serviceRoleClient.rpc("reorder_draft_ranking", {
    p_user_id: userId,
    p_ranking_id: input.rankingId,
    p_player_id: input.playerId,
    p_action: input.action,
    p_target_rank: targetRank,
    p_anchor_player_id: anchorPlayerId,
    p_expected_version: input.expectedVersion,
    p_operation_id: input.operationId,
    p_operation_payload_hash: payloadHash,
  } as any);

  if (error) throw error;
  if (!isMutationResult(data)) {
    throw new Error("Draft Ranker reorder returned an invalid result.");
  }
  if (data.status === "not_found") {
    throw new DraftRankerApiError(
      404,
      "not_found",
      data.message ?? "The requested ranking resource was not found.",
    );
  }
  if (data.status === "conflict") {
    const stale = data.code === "stale_ranking_version";
    throw new DraftRankerApiError(
      409,
      stale ? "stale_ranking_version" : "idempotency_conflict",
      data.message ?? "The reorder conflicts with current ranking state.",
      {
        rankingId: data.rankingId ?? null,
        expectedVersion: data.expectedVersion ?? input.expectedVersion,
        currentVersion: data.currentVersion ?? null,
      },
    );
  }
  if (data.status === "failed") {
    throw new DraftRankerApiError(
      422,
      "unprocessable",
      data.message ?? "The requested reorder cannot be applied.",
      { reason: data.code ?? "reorder_failed" },
    );
  }
  return data;
}

function throwPairwiseMutationError(
  data: Json,
  fallback: string,
): asserts data is Json & DraftRankerMutationResult {
  if (!isMutationResult(data)) {
    throw new Error(`${fallback} returned an invalid result.`);
  }
  if (data.status === "not_found") {
    throw new DraftRankerApiError(
      404,
      "not_found",
      data.message ?? "The requested pairwise resource was not found.",
    );
  }
  if (data.status === "conflict") {
    const stale = data.code === "stale_ranking_version";
    throw new DraftRankerApiError(
      409,
      stale ? "stale_ranking_version" : "idempotency_conflict",
      data.message ?? "The pairwise action conflicts with current state.",
      {
        reason: data.code ?? "pairwise_conflict",
        expectedVersion: data.expectedVersion ?? null,
        currentVersion: data.currentVersion ?? null,
      },
    );
  }
  if (data.status === "rate_limited") {
    throw new DraftRankerApiError(
      429,
      "rate_limited",
      data.message ??
        "Too many Draft Ranker pairwise requests. Try again later.",
      {
        reason: data.code ?? data.moderationReasonCode ?? "pairwise_rate_limit",
        retryAfterSeconds: data.retryAfterSeconds ?? 60,
      },
    );
  }
  if (data.status === "failed") {
    throw new DraftRankerApiError(
      422,
      "unprocessable",
      data.message ?? "The pairwise action could not be applied.",
      { reason: data.code ?? "pairwise_failed" },
    );
  }
}

export async function loadDraftContributionPreference(userId: string) {
  const { data, error } = await serviceRoleClient
    .from("draft_ranker_contribution_preferences")
    .select(
      "contribution_enabled,privacy_policy_version,consented_at,revoked_at,update_source,created_at,updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    contributionEnabled: data?.contribution_enabled ?? false,
    privacyPolicyVersion: data?.privacy_policy_version ?? null,
    consentedAt: data?.consented_at ?? null,
    revokedAt: data?.revoked_at ?? null,
    updateSource: data?.update_source ?? null,
    updatedAt: data?.updated_at ?? null,
    currentPolicyVersion: DRAFT_RANKER_CONSENT_POLICY_VERSION,
  };
}

export async function setDraftContributionPreference(
  userId: string,
  input: DraftContributionPreferenceInput,
) {
  const payload = {
    ...input,
    privacyPolicyVersion: input.contributionEnabled
      ? DRAFT_RANKER_CONSENT_POLICY_VERSION
      : null,
    updateSource: "draft_ranker_onboarding",
  };
  const { data, error } = await (serviceRoleClient.rpc as any)(
    "set_draft_ranker_contribution_preference",
    {
      p_user_id: userId,
      p_contribution_enabled: input.contributionEnabled,
      p_privacy_policy_version: payload.privacyPolicyVersion,
      p_update_source: payload.updateSource,
      p_operation_id: input.operationId,
      p_operation_payload_hash: operationPayloadHash(payload),
    },
  );
  if (error) throw error;
  throwPairwiseMutationError(data, "Contribution preference");
  return loadDraftContributionPreference(userId);
}

export async function issueDraftPairPrompt(
  userId: string,
  input: DraftPairPromptIssueInput,
  rateOperationPayloadHash = operationPayloadHash(input),
) {
  const { data, error } = await (serviceRoleClient.rpc as any)(
    "issue_draft_ranker_pair_prompt_guarded",
    {
      p_user_id: userId,
      p_ranking_id: input.rankingId,
      p_player_a_id: input.playerAId,
      p_player_b_id: input.playerBId,
      p_queue_mode: input.queueMode,
      p_queue_reason: input.queueReason,
      p_algorithm_version: input.algorithmVersion,
      p_expected_version: input.expectedVersion,
      p_operation_id: input.operationId,
      p_operation_payload_hash: operationPayloadHash(input),
      p_rate_operation_payload_hash: rateOperationPayloadHash,
      p_rate_config: draftPairwiseRateLimitConfig(),
    },
  );
  if (error) throw error;
  throwPairwiseMutationError(data, "Pairwise prompt issuance");
  return data;
}

export async function submitDraftPairComparison(
  userId: string,
  input: DraftPairComparisonInput,
) {
  const { data, error } = await (serviceRoleClient.rpc as any)(
    "submit_draft_ranker_pair_comparison_guarded",
    {
      p_user_id: userId,
      p_prompt_id: input.promptId,
      p_outcome: input.outcome,
      p_expected_version: input.expectedVersion,
      p_client_operation_id: input.operationId,
      p_operation_payload_hash: operationPayloadHash(input),
      p_rate_operation_payload_hash: operationPayloadHash(input),
      p_community_collection_enabled:
        isDraftRankerCommunityContributionEnabled(),
      p_rate_config: draftPairwiseRateLimitConfig(),
    },
  );
  if (error) throw error;
  throwPairwiseMutationError(data, "Pairwise comparison");
  return data;
}

type QueuePromptRow = {
  id: string;
  ranking_id: string;
  low_player_id: number;
  high_player_id: number;
  queue_mode: string;
  queue_reason: string;
  algorithm_version: string;
  ranking_version: number | null;
  expires_at: string;
  status: string;
};

function queuePlayerCard(
  player: DraftPairQueuePlayer,
  entry: Awaited<ReturnType<typeof loadDraftRankingEntries>>["entries"][number],
) {
  const identity = Array.isArray(entry.player) ? entry.player[0] : entry.player;
  return {
    playerId: player.playerId,
    rank: player.rank,
    name: identity?.canonical_name ?? "Unknown player",
    position: player.position,
    organization: identity?.current_organization_name ?? null,
    headshotUrl: identity?.headshot_url ?? null,
    lifecycleStatus: player.lifecycleStatus,
    evidence: {
      yahooAdp: player.seedAdp,
      previouslyUndrafted: player.seedAdp === null,
    },
  };
}

function queuePromptResponse(
  row: QueuePromptRow,
  candidate: DraftPairQueueCandidate | null,
  playerById: Map<number, DraftPairQueuePlayer>,
  entryById: Map<
    number,
    Awaited<ReturnType<typeof loadDraftRankingEntries>>["entries"][number]
  >,
  idempotentReplay: boolean,
) {
  const low = playerById.get(row.low_player_id)!;
  const high = playerById.get(row.high_player_id)!;
  return {
    promptId: row.id,
    rankingId: row.ranking_id,
    rankingVersion: row.ranking_version,
    status: row.status,
    expiresAt: row.expires_at,
    mode: row.queue_mode,
    reason: row.queue_reason,
    reasonCode: candidate?.reasonCode ?? "previously_issued",
    category: candidate?.category ?? null,
    focusPosition: candidate?.focusPosition ?? null,
    algorithmVersion: row.algorithm_version,
    idempotentReplay,
    players: [
      queuePlayerCard(low, entryById.get(low.playerId)!),
      queuePlayerCard(high, entryById.get(high.playerId)!),
    ],
  };
}

export async function issueNextDraftPairPrompt(
  userId: string,
  input: DraftPairQueueInput,
) {
  const board = await loadDraftRankingEntries(userId, input.rankingId);
  const entryById = new Map(
    board.entries.map((entry) => [entry.playerId, entry]),
  );
  const watchedResult = await serviceRoleClient
    .from("draft_ranking_watchlist")
    .select("fhfh_player_id")
    .eq("ranking_id", input.rankingId)
    .eq("user_id", userId);
  if (watchedResult.error) throw watchedResult.error;
  const watched = new Set(
    (watchedResult.data ?? []).map((row) => row.fhfh_player_id),
  );
  const players: DraftPairQueuePlayer[] = board.entries.map((entry) => {
    const identity = Array.isArray(entry.player)
      ? entry.player[0]
      : entry.player;
    return {
      playerId: entry.playerId,
      rank: entry.rank,
      position: identity?.canonical_position ?? null,
      lifecycleStatus: identity?.lifecycle_status ?? "review_required",
      seedAdp: entry.seedAdp === null ? null : Number(entry.seedAdp),
      watched: watched.has(entry.playerId),
    };
  });
  const playerById = new Map(
    players.map((player) => [player.playerId, player]),
  );

  const { data: existing, error: existingError } = await serviceRoleClient
    .from("draft_ranker_pair_prompts")
    .select(
      "id,ranking_id,low_player_id,high_player_id,queue_mode,queue_reason,algorithm_version,ranking_version,expires_at,status",
    )
    .eq("user_id", userId)
    .eq("issue_operation_id", input.operationId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    if (
      existing.ranking_id !== input.rankingId ||
      existing.queue_mode !== input.mode ||
      existing.ranking_version !== input.expectedVersion
    ) {
      throw new DraftRankerApiError(
        409,
        "idempotency_conflict",
        "The operation ID was already used with a different queue request.",
      );
    }
    return {
      algorithmVersion: existing.algorithm_version,
      mode: input.mode,
      plannedSlots: input.mode === "quick_five" ? 5 : 20,
      availableSlots: null,
      reviewedThroughRank: null,
      prompt: queuePromptResponse(
        existing as QueuePromptRow,
        null,
        playerById,
        entryById,
        true,
      ),
    };
  }

  if (board.ranking.lockVersion !== input.expectedVersion) {
    throw new DraftRankerApiError(
      409,
      "stale_ranking_version",
      "The ranking changed. Reload before requesting a matchup.",
      {
        expectedVersion: input.expectedVersion,
        currentVersion: board.ranking.lockVersion,
      },
    );
  }

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const [preferencesResult, lastThirtyResult, lastSevenDaysResult] =
    await Promise.all([
      serviceRoleClient
        .from("draft_ranker_pair_preferences")
        .select(
          "low_player_id,high_player_id,preferred_player_id,established_at",
        )
        .eq("ranking_id", input.rankingId)
        .eq("user_id", userId),
      serviceRoleClient
        .from("draft_ranker_pair_prompts")
        .select("low_player_id,high_player_id")
        .eq("ranking_id", input.rankingId)
        .eq("user_id", userId)
        .order("issued_at", { ascending: false })
        .limit(30),
      serviceRoleClient
        .from("draft_ranker_pair_prompts")
        .select("low_player_id,high_player_id")
        .eq("ranking_id", input.rankingId)
        .eq("user_id", userId)
        .gte("issued_at", sevenDaysAgo)
        .limit(1000),
    ]);
  const queryError =
    preferencesResult.error ??
    lastThirtyResult.error ??
    lastSevenDaysResult.error;
  if (queryError) throw queryError;
  const recentPairKeys = new Set(
    [...(lastThirtyResult.data ?? []), ...(lastSevenDaysResult.data ?? [])].map(
      (row) => canonicalPairKey(row.low_player_id, row.high_player_id),
    ),
  );
  const preferences = (preferencesResult.data ?? []).map((preference) => ({
    lowPlayerId: preference.low_player_id,
    highPlayerId: preference.high_player_id,
    preferredPlayerId: preference.preferred_player_id,
    establishedAt: preference.established_at,
  }));
  const reviewedThroughRank =
    preferences.reduce((highest, preference) => {
      const lowRank = playerById.get(preference.lowPlayerId)?.rank ?? 0;
      const highRank = playerById.get(preference.highPlayerId)?.rank ?? 0;
      return Math.max(highest, lowRank, highRank);
    }, 0) || null;
  const queue = buildDeterministicDraftPairQueue({
    players,
    preferences,
    recentPairKeys,
    mode: input.mode,
  });
  const candidate = queue[0];
  if (!candidate) {
    return {
      algorithmVersion: DRAFT_PAIR_QUEUE_ALGORITHM_VERSION,
      mode: input.mode,
      plannedSlots: input.mode === "quick_five" ? 5 : 20,
      availableSlots: 0,
      reviewedThroughRank,
      prompt: null,
    };
  }
  const issued = (await issueDraftPairPrompt(
    userId,
    {
      rankingId: input.rankingId,
      playerAId: candidate.playerAId,
      playerBId: candidate.playerBId,
      queueMode: input.mode,
      queueReason: candidate.reason,
      algorithmVersion: DRAFT_PAIR_QUEUE_ALGORITHM_VERSION,
      expectedVersion: input.expectedVersion,
      operationId: input.operationId,
    },
    operationPayloadHash(input),
  )) as Record<string, unknown>;
  const lowPlayerId = Number(issued.lowPlayerId);
  const highPlayerId = Number(issued.highPlayerId);
  const row: QueuePromptRow = {
    id: String(issued.promptId),
    ranking_id: input.rankingId,
    low_player_id: lowPlayerId,
    high_player_id: highPlayerId,
    queue_mode: input.mode,
    queue_reason: candidate.reason,
    algorithm_version: DRAFT_PAIR_QUEUE_ALGORITHM_VERSION,
    ranking_version: input.expectedVersion,
    expires_at: String(issued.expiresAt),
    status: "issued",
  };
  return {
    algorithmVersion: DRAFT_PAIR_QUEUE_ALGORITHM_VERSION,
    mode: input.mode,
    plannedSlots: input.mode === "quick_five" ? 5 : 20,
    availableSlots: queue.length,
    reviewedThroughRank,
    prompt: queuePromptResponse(
      row,
      candidate,
      playerById,
      entryById,
      Boolean(issued.idempotentReplay),
    ),
  };
}
