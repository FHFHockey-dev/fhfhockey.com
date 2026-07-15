import serviceRoleClient from "lib/supabase/server";

import type { DraftDiscoveryQuery } from "./contracts";
import { deriveOwnerRelativeDiscovery } from "./discovery";
import { loadDraftPlayerActions, loadDraftRankingEntries } from "./server";

type StoredSignal = {
  fhfh_player_id: number;
  signal_type: string;
  score: number;
  reason_code: string;
  reason_text: string;
  source_keys: string[];
  source_date: string | null;
  source_observed_at: string;
  expires_at: string;
  evidence: Record<string, unknown>;
};

type ConsensusRow = {
  fhfh_player_id: number;
  consensus_rank: number;
  source_count: number;
  source_keys: string[];
  source_observed_at: string;
  expires_at: string;
  evidence: Record<string, unknown>;
};

const TYPE_PRIORITY: Record<string, number> = {
  cutoff_challenger: 0,
  opportunity_change: 1,
  previously_undrafted: 2,
  projection_gap: 3,
  ownership_riser: 4,
};

function emptyMessage(sourceHealth: Array<Record<string, unknown>>) {
  const projectionMismatch = sourceHealth.some(
    (source) =>
      source.health_state === "season_mismatch" &&
      String(source.source_key).startsWith("projection:"),
  );
  if (projectionMismatch) {
    return "New 2026–27 projection sources have not landed yet. FHFH is withholding projection-based suggestions instead of reusing last season’s numbers.";
  }
  const staleSources = sourceHealth.some(
    (source) => source.health_state === "stale",
  );
  if (staleSources) {
    return "Discovery sources are stale. Suggestions will return after a verified refresh.";
  }
  return "No player currently clears the explainable discovery thresholds. Your board and watchlist remain available.";
}

export async function loadDraftRankerDiscovery(
  userId: string,
  input: DraftDiscoveryQuery,
) {
  const [board, actions] = await Promise.all([
    loadDraftRankingEntries(userId, input.rankingId),
    loadDraftPlayerActions(userId, input.rankingId),
  ]);
  const { data: run, error: runError } = await serviceRoleClient
    .from("draft_ranker_discovery_refresh_runs")
    .select(
      "id,target_season_id,algorithm_version,source_summary,group_counts,warning_codes,completed_at",
    )
    .eq("target_season_id", board.ranking.targetSeasonId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError) throw runError;
  if (!run) {
    return {
      rankingId: input.rankingId,
      status: "unavailable" as const,
      message: "Discovery has not completed its first verified source refresh.",
      refresh: null,
      sourceHealth: [],
      cards: [],
    };
  }

  const now = new Date().toISOString();
  const [signalsResult, consensusResult, healthResult] = await Promise.all([
    serviceRoleClient
      .from("draft_ranker_discovery_signals")
      .select(
        "fhfh_player_id,signal_type,score,reason_code,reason_text,source_keys,source_date,source_observed_at,expires_at,evidence",
      )
      .eq("run_id", run.id)
      .gt("expires_at", now)
      .order("score", { ascending: false }),
    serviceRoleClient
      .from("draft_ranker_discovery_projection_consensus")
      .select(
        "fhfh_player_id,consensus_rank,source_count,source_keys,source_observed_at,expires_at,evidence",
      )
      .eq("run_id", run.id)
      .gt("expires_at", now)
      .order("consensus_rank", { ascending: true }),
    serviceRoleClient
      .from("draft_ranker_discovery_source_health")
      .select(
        "source_key,health_state,source_season_id,source_date,source_observed_at,expires_at,row_count,mapped_player_count,eligible_player_count,warning_codes,metadata",
      )
      .eq("run_id", run.id)
      .order("source_key", { ascending: true }),
  ]);
  const queryError =
    signalsResult.error ?? consensusResult.error ?? healthResult.error;
  if (queryError) throw queryError;
  const storedSignals = (signalsResult.data ?? []) as unknown as StoredSignal[];
  const consensus = (consensusResult.data ?? []) as unknown as ConsensusRow[];
  const sourceHealth = (healthResult.data ?? []) as unknown as Array<
    Record<string, unknown>
  >;
  const dispositionByPlayer = new Map(
    actions.preferences.map((preference) => [
      preference.playerId,
      preference.disposition,
    ]),
  );
  const watched = new Set(actions.watchlist.map((item) => item.playerId));
  const entryByPlayer = new Map(
    board.entries.map((entry) => [entry.playerId, entry]),
  );

  const dynamicSignals: StoredSignal[] = consensus.flatMap((row) => {
    const entry = entryByPlayer.get(row.fhfh_player_id);
    if (!entry) return [];
    const type = deriveOwnerRelativeDiscovery({
      personalRank: entry.rank,
      consensusRank: Number(row.consensus_rank),
    });
    if (!type) return [];
    const gap = entry.rank - Number(row.consensus_rank);
    return [
      {
        fhfh_player_id: row.fhfh_player_id,
        signal_type: type,
        score: gap,
        reason_code:
          type === "cutoff_challenger"
            ? "candidate_bench_projection_challenger"
            : "consensus_projection_above_personal_rank",
        reason_text:
          type === "cutoff_challenger"
            ? `Currently #${entry.rank} on your board, with a consensus projection ${Math.round(gap)} places higher.`
            : `Consensus projection is ${Math.round(gap)} places higher than your personal rank.`,
        source_keys: row.source_keys,
        source_date: row.source_observed_at.slice(0, 10),
        source_observed_at: row.source_observed_at,
        expires_at: row.expires_at,
        evidence: {
          ...row.evidence,
          personalRank: entry.rank,
          consensusRank: Number(row.consensus_rank),
          rankGap: gap,
          projectionSourceCount: row.source_count,
        },
      },
    ];
  });

  const deduplicated = new Map<string, StoredSignal>();
  for (const signal of [...dynamicSignals, ...storedSignals]) {
    const key = `${signal.fhfh_player_id}:${signal.signal_type}`;
    const existing = deduplicated.get(key);
    if (!existing || signal.score > existing.score)
      deduplicated.set(key, signal);
  }
  const eligibleSignals = [...deduplicated.values()].filter(
    (signal) =>
      dispositionByPlayer.get(signal.fhfh_player_id) !== "dismissed" &&
      dispositionByPlayer.get(signal.fhfh_player_id) !== "not_relevant",
  );
  const playerIds = [
    ...new Set(eligibleSignals.map((signal) => signal.fhfh_player_id)),
  ];
  const { data: identities, error: identityError } = playerIds.length
    ? await serviceRoleClient
        .from("fhfh_player_identities")
        .select(
          "id,canonical_name,canonical_position,current_organization_name,headshot_url,lifecycle_status",
        )
        .in("id", playerIds)
    : { data: [], error: null };
  if (identityError) throw identityError;
  const identityByPlayer = new Map(
    (identities ?? []).map((identity) => [identity.id, identity]),
  );

  const cards = eligibleSignals
    .flatMap((signal) => {
      const identity = identityByPlayer.get(signal.fhfh_player_id);
      if (!identity) return [];
      const entry = entryByPlayer.get(signal.fhfh_player_id);
      return [
        {
          playerId: signal.fhfh_player_id,
          type: signal.signal_type,
          score: Number(signal.score),
          reasonCode: signal.reason_code,
          reason: signal.reason_text,
          sources: signal.source_keys,
          sourceDate: signal.source_date,
          sourceObservedAt: signal.source_observed_at,
          expiresAt: signal.expires_at,
          evidence: signal.evidence,
          personalRank: entry?.rank ?? null,
          onBoard: Boolean(entry),
          watched: watched.has(signal.fhfh_player_id),
          player: {
            canonicalName: identity.canonical_name,
            position: identity.canonical_position,
            organizationName: identity.current_organization_name,
            headshotUrl: identity.headshot_url,
            lifecycleStatus: identity.lifecycle_status,
          },
        },
      ];
    })
    .sort(
      (left, right) =>
        (TYPE_PRIORITY[left.type] ?? 99) - (TYPE_PRIORITY[right.type] ?? 99) ||
        right.score - left.score ||
        left.player.canonicalName.localeCompare(right.player.canonicalName),
    )
    .slice(0, input.limit);

  return {
    rankingId: input.rankingId,
    status: cards.length > 0 ? ("available" as const) : ("empty" as const),
    message: cards.length > 0 ? null : emptyMessage(sourceHealth),
    refresh: {
      runId: run.id,
      targetSeasonId: run.target_season_id,
      algorithmVersion: run.algorithm_version,
      completedAt: run.completed_at,
      sourceSummary: run.source_summary,
      groupCounts: run.group_counts,
      warningCodes: run.warning_codes,
    },
    sourceHealth,
    cards,
  };
}
