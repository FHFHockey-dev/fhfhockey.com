import serviceRoleClient from "lib/supabase/server";

import { isCommunityDraftRankingsEnabled } from "./api";
import type { DraftRankingExportQuery } from "./contracts";
import {
  DRAFT_RANKING_EXPORT_SCHEMA_VERSION,
  type DraftRankingExportDocument,
  type DraftRankingExportPlayer,
} from "./export";
import {
  loadDraftPlayerActions,
  loadDraftRankingEntries,
  requireOwnedDraftRanking,
} from "./server";

type QueryClient = { from(table: string): any };

function chunks<T>(values: T[], size = 300): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

async function fetchInChunks<T>(
  values: number[] | string[],
  build: (chunk: Array<number | string>) => any,
): Promise<T[]> {
  const rows: T[] = [];
  for (const chunk of chunks<Array<number | string>[number]>(values)) {
    const { data, error } = await build(chunk);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
  }
  return rows;
}

async function loadExportEvidence(args: {
  client: QueryClient;
  playerIds: number[];
  targetSeasonId: number;
}) {
  const identities = await fetchInChunks<{
    id: number;
    canonical_name: string;
    canonical_position: string | null;
    current_organization_name: string | null;
    lifecycle_status: string;
    nhl_player_id: number | null;
    updated_at: string;
  }>(args.playerIds, (idChunk) =>
    args.client
      .from("fhfh_player_identities")
      .select(
        "id,canonical_name,canonical_position,current_organization_name,lifecycle_status,nhl_player_id,updated_at",
      )
      .in("id", idChunk),
  );
  const yahooMappings = await fetchInChunks<{
    fhfh_player_id: number;
    external_player_id: string;
    is_primary: boolean;
  }>(args.playerIds, (idChunk) =>
    args.client
      .from("fhfh_player_external_identities")
      .select("fhfh_player_id,external_player_id,is_primary")
      .eq("provider", "yahoo")
      .eq("verification_status", "verified")
      .in("fhfh_player_id", idChunk),
  );
  const yahooKeyByPlayer = new Map<number, string>();
  for (const mapping of yahooMappings.sort(
    (left, right) => Number(right.is_primary) - Number(left.is_primary),
  )) {
    if (!yahooKeyByPlayer.has(mapping.fhfh_player_id)) {
      yahooKeyByPlayer.set(mapping.fhfh_player_id, mapping.external_player_id);
    }
  }
  const priorYahooSeason = Math.floor(args.targetSeasonId / 10_000) - 1;
  const yahooKeys = [...new Set(yahooKeyByPlayer.values())];
  const yahooRows = yahooKeys.length
    ? await fetchInChunks<{
        player_key: string;
        draft_analysis: unknown;
        average_draft_pick: number | null;
      }>(yahooKeys, (keyChunk) =>
        args.client
          .from("yahoo_players")
          .select("player_key,draft_analysis,average_draft_pick")
          .eq("season", priorYahooSeason)
          .in("player_key", keyChunk),
      )
    : [];
  const yahooByKey = new Map(yahooRows.map((row) => [row.player_key, row]));

  const communityByPlayer = new Map<
    number,
    { publicRank: number | null; confidence: string | null }
  >();
  if (isCommunityDraftRankingsEnabled()) {
    const { data: snapshot, error: snapshotError } = await args.client
      .from("draft_ranker_community_snapshots")
      .select("id")
      .eq("target_season_id", args.targetSeasonId)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snapshotError) throw snapshotError;
    if (snapshot) {
      const results = await fetchInChunks<{
        fhfh_player_id: number;
        public_rank: number | null;
        confidence_label: string;
      }>(args.playerIds, (idChunk) =>
        args.client
          .from("draft_ranker_community_player_results")
          .select("fhfh_player_id,public_rank,confidence_label")
          .eq("snapshot_id", snapshot.id)
          .in("fhfh_player_id", idChunk),
      );
      for (const result of results) {
        communityByPlayer.set(result.fhfh_player_id, {
          publicRank: result.public_rank,
          confidence: result.confidence_label,
        });
      }
    }
  }

  const projectionFptsByPlayer = new Map<number, number>();
  const { data: discoveryRun, error: runError } = await args.client
    .from("draft_ranker_discovery_refresh_runs")
    .select("id")
    .eq("target_season_id", args.targetSeasonId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError) throw runError;
  if (discoveryRun) {
    const consensus = await fetchInChunks<{
      fhfh_player_id: number;
      evidence: unknown;
    }>(args.playerIds, (idChunk) =>
      args.client
        .from("draft_ranker_discovery_projection_consensus")
        .select("fhfh_player_id,evidence")
        .eq("run_id", discoveryRun.id)
        .in("fhfh_player_id", idChunk),
    );
    for (const result of consensus) {
      const evidence = objectValue(result.evidence);
      const projectedFpts = positiveNumber(
        evidence.projectedFantasyPointsPerGame ?? evidence.consensusFptsPerGame,
      );
      if (projectedFpts != null) {
        projectionFptsByPlayer.set(result.fhfh_player_id, projectedFpts);
      }
    }
  }

  return {
    identityByPlayer: new Map(identities.map((row) => [row.id, row])),
    yahooKeyByPlayer,
    yahooByKey,
    communityByPlayer,
    projectionFptsByPlayer,
  };
}

export async function loadDraftRankingExport(
  userId: string,
  input: DraftRankingExportQuery,
  exportedAt = new Date().toISOString(),
): Promise<DraftRankingExportDocument> {
  await requireOwnedDraftRanking(userId, input.rankingId);
  const [rankingResult, board, actions, seedResult, eventResult] =
    await Promise.all([
      serviceRoleClient
        .from("draft_rankings")
        .select(
          "id,name,status,lock_version,target_season_id,scoring_profile,schema_version,seed_revision",
        )
        .eq("id", input.rankingId)
        .eq("user_id", userId)
        .single(),
      loadDraftRankingEntries(userId, input.rankingId),
      loadDraftPlayerActions(userId, input.rankingId),
      serviceRoleClient
        .from("draft_ranking_seed_runs")
        .select(
          "seed_revision,source_season_id,source_count,seeded_count,fallback_count,completed_at",
        )
        .eq("ranking_id", input.rankingId)
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      input.includeEventSummary
        ? serviceRoleClient
            .from("draft_ranking_events")
            .select("event_type,created_at")
            .eq("ranking_id", input.rankingId)
            .eq("user_id", userId)
        : Promise.resolve({ data: [], error: null }),
    ]);
  const queryError =
    rankingResult.error ?? seedResult.error ?? eventResult.error;
  if (queryError) throw queryError;
  const ranking = rankingResult.data;
  if (!ranking) {
    throw new Error("The owned ranking could not be loaded for export.");
  }
  const watched = new Map(
    actions.watchlist.map((item) => [item.playerId, item]),
  );
  const playerIds = [
    ...new Set([
      ...board.entries.map((entry) => entry.playerId),
      ...actions.watchlist.map((item) => item.playerId),
    ]),
  ];
  const evidence = await loadExportEvidence({
    client: serviceRoleClient as unknown as QueryClient,
    playerIds,
    targetSeasonId: ranking.target_season_id,
  });

  const playerRow = (args: {
    playerId: number;
    rank: number | null;
    listState: DraftRankingExportPlayer["listState"];
    seedAdp?: number | null;
    tier?: string | null;
    notes?: string | null;
    updatedAt: string;
  }): DraftRankingExportPlayer => {
    const identity = evidence.identityByPlayer.get(args.playerId);
    if (!identity) {
      throw new Error(`Export identity ${args.playerId} is unavailable.`);
    }
    const yahooKey = evidence.yahooKeyByPlayer.get(args.playerId);
    const yahoo = yahooKey ? evidence.yahooByKey.get(yahooKey) : null;
    const draftAnalysis = objectValue(yahoo?.draft_analysis);
    const priorYahooAdp =
      positiveNumber(args.seedAdp) ??
      positiveNumber(draftAnalysis.preseason_average_pick) ??
      positiveNumber(yahoo?.average_draft_pick);
    const community = evidence.communityByPlayer.get(args.playerId);
    return {
      rank: args.rank,
      listState: args.listState,
      fhfhPlayerId: args.playerId,
      nhlPlayerId: identity.nhl_player_id,
      playerName: identity.canonical_name,
      organization: identity.current_organization_name,
      position: identity.canonical_position,
      identityStatus: identity.lifecycle_status,
      yahooEligibility: yahooKey ? "verified" : "unavailable",
      priorYahooAdp,
      adpState:
        priorYahooAdp != null
          ? "numeric"
          : yahooKey && yahoo
            ? "previously_undrafted"
            : "unavailable",
      communityRank: community?.publicRank ?? null,
      communityConfidence: community?.confidence ?? null,
      projectionFptsPerGame:
        evidence.projectionFptsByPlayer.get(args.playerId) ?? null,
      tier: args.tier ?? null,
      notes: args.notes ?? null,
      watchlisted: watched.has(args.playerId),
      updatedAt: args.updatedAt,
    };
  };

  const top250 = board.entries.slice(0, 250).map((entry) =>
    playerRow({
      playerId: entry.playerId,
      rank: entry.rank,
      listState: "top_250",
      seedAdp: entry.seedAdp,
      tier: entry.tier,
      notes: entry.notes,
      updatedAt: entry.updatedAt,
    }),
  );
  const candidates = input.includeCandidates
    ? board.entries.slice(250).map((entry) =>
        playerRow({
          playerId: entry.playerId,
          rank: entry.rank,
          listState: "candidate",
          seedAdp: entry.seedAdp,
          tier: entry.tier,
          notes: entry.notes,
          updatedAt: entry.updatedAt,
        }),
      )
    : [];
  const watchlist = input.includeWatchlist
    ? actions.watchlist.map((item) =>
        playerRow({
          playerId: item.playerId,
          rank:
            board.entries.find((entry) => entry.playerId === item.playerId)
              ?.rank ?? null,
          listState: "watchlist",
          notes: item.note,
          updatedAt: item.updatedAt,
        }),
      )
    : [];
  const events = eventResult.data ?? [];
  const byType: Record<string, number> = {};
  let latestAt: string | null = null;
  for (const event of events) {
    byType[event.event_type] = (byType[event.event_type] ?? 0) + 1;
    if (!latestAt || event.created_at > latestAt) latestAt = event.created_at;
  }
  const seed = seedResult.data;

  return {
    schemaVersion: DRAFT_RANKING_EXPORT_SCHEMA_VERSION,
    exportedAt,
    ranking: {
      id: ranking.id,
      name: ranking.name,
      status: ranking.status,
      version: ranking.lock_version,
      targetSeason: ranking.target_season_id,
      scoringProfile: ranking.scoring_profile,
      schemaVersion: ranking.schema_version,
      seedRevision: ranking.seed_revision,
      seedProvenance: seed
        ? {
            seedRevision: seed.seed_revision,
            sourceSeasonId: seed.source_season_id,
            sourceCount: seed.source_count,
            seededCount: seed.seeded_count,
            fallbackCount: seed.fallback_count,
            completedAt: seed.completed_at,
          }
        : null,
    },
    options: {
      includeCandidates: input.includeCandidates,
      includeWatchlist: input.includeWatchlist,
      includeEventSummary: input.includeEventSummary,
      privateComparisonEvidenceIncluded: false,
    },
    top250,
    candidates,
    watchlist,
    eventSummary: input.includeEventSummary
      ? { totalEvents: events.length, byType, latestAt }
      : null,
  };
}
