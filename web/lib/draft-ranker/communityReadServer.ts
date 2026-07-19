import serviceRoleClient from "lib/supabase/server";

import {
  DRAFT_RANKER_TARGET_SEASON_ID,
  type CommunityDraftRankingsQuery,
} from "./contracts";

const ID_CHUNK_SIZE = 400;

type QueryClient = { from(table: string): any };

type Identity = {
  id: number;
  canonical_name: string;
  canonical_position: string | null;
  current_organization_name: string | null;
  current_organization_type: string;
  lifecycle_status: string;
  headshot_url: string | null;
};

type ResultRow = {
  fhfh_player_id: number;
  model_rank: number;
  public_rank: number | null;
  market_rank: number | null;
  prior_state: string;
  evidence_state: string;
  confidence_label: string;
  independent_users: number;
  comparison_count: number;
  distinct_opponents: number;
  cutoff_opponents_inside: number;
  cutoff_opponents_outside: number;
  stability_buffer_ranks: number;
  conservative_rank: number;
  admission_basis: string | null;
  previous_public_rank: number | null;
  rank_delta: number | null;
  last_evidence_at: string | null;
};

function chunks<T>(values: T[], size = ID_CHUNK_SIZE): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function loadIdentities(client: QueryClient, playerIds: number[]) {
  const rows: Identity[] = [];
  for (const idChunk of chunks([...new Set(playerIds)])) {
    if (!idChunk.length) continue;
    const { data, error } = await client
      .from("fhfh_player_identities")
      .select(
        "id,canonical_name,canonical_position,current_organization_name,current_organization_type,lifecycle_status,headshot_url",
      )
      .in("id", idChunk);
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  return new Map(rows.map((row) => [row.id, row]));
}

async function loadPersonalRanks(args: {
  client: QueryClient;
  userId: string | null;
}): Promise<Map<number, number>> {
  if (!args.userId) return new Map<number, number>();
  const { data: ranking, error: rankingError } = await args.client
    .from("draft_rankings")
    .select("id")
    .eq("user_id", args.userId)
    .eq("target_season_id", DRAFT_RANKER_TARGET_SEASON_ID)
    .eq("status", "active")
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();
  if (rankingError) throw rankingError;
  if (!ranking?.id) return new Map<number, number>();
  const { data, error } = await args.client
    .from("draft_ranking_entries")
    .select("fhfh_player_id,order_key")
    .eq("ranking_id", ranking.id)
    .eq("user_id", args.userId)
    .order("order_key", { ascending: true });
  if (error) throw error;
  return new Map(
    (data ?? []).map(
      (row: { fhfh_player_id: number }, index: number) =>
        [row.fhfh_player_id, index + 1] as [number, number],
    ),
  );
}

function publicRow(
  row: ResultRow,
  identity: Identity,
  personalRank: number | null,
) {
  return {
    playerId: row.fhfh_player_id,
    communityRank: row.public_rank,
    estimatedRank: row.model_rank,
    previousYahooAdp: row.market_rank,
    previouslyUndrafted: row.prior_state === "previously_undrafted",
    evidenceState: row.evidence_state,
    confidenceLabel: row.confidence_label,
    independentUsers: row.independent_users,
    comparisonCount: row.comparison_count,
    distinctOpponents: row.distinct_opponents,
    cutoffCoverage: {
      inside: row.cutoff_opponents_inside,
      outside: row.cutoff_opponents_outside,
    },
    stabilityBufferRanks: row.stability_buffer_ranks,
    conservativeRank: row.conservative_rank,
    admissionBasis: row.admission_basis,
    previousCommunityRank: row.previous_public_rank,
    rankChange: row.rank_delta,
    lastEvidenceAt: row.last_evidence_at,
    personalRank,
    personalDelta:
      personalRank != null && row.public_rank != null
        ? personalRank - row.public_rank
        : null,
    player: {
      canonicalName: identity.canonical_name,
      position: identity.canonical_position,
      organizationName: identity.current_organization_name,
      organizationType: identity.current_organization_type,
      lifecycleStatus: identity.lifecycle_status,
      headshotUrl: identity.headshot_url,
    },
  };
}

export async function loadCommunityDraftRankings(args: {
  client?: QueryClient;
  userId?: string | null;
  query: CommunityDraftRankingsQuery;
}) {
  const client = args.client ?? (serviceRoleClient as unknown as QueryClient);
  const { data: snapshot, error: snapshotError } = await client
    .from("draft_ranker_community_snapshots")
    .select(
      "id,target_season_id,snapshot_as_of,cadence,model_version,player_count,public_display_count,public_top250_count,published_at,metadata",
    )
    .eq("target_season_id", DRAFT_RANKER_TARGET_SEASON_ID)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snapshotError) throw snapshotError;
  if (!snapshot) {
    return {
      status: "unavailable" as const,
      message:
        "FHFH Community Rankings have not completed their first audited snapshot.",
      snapshot: null,
      rows: [],
      emerging: [],
      pagination: { page: args.query.page, limit: args.query.limit, total: 0 },
      signedInPersonalContext: Boolean(args.userId),
    };
  }
  const from = (args.query.page - 1) * args.query.limit;
  const to = from + args.query.limit - 1;
  const select =
    "fhfh_player_id,model_rank,public_rank,market_rank,prior_state,evidence_state,confidence_label,independent_users,comparison_count,distinct_opponents,cutoff_opponents_inside,cutoff_opponents_outside,stability_buffer_ranks,conservative_rank,admission_basis,previous_public_rank,rank_delta,last_evidence_at";
  const [rankingResult, emergingResult] = await Promise.all([
    client
      .from("draft_ranker_community_player_results")
      .select(select, { count: "exact" })
      .eq("snapshot_id", snapshot.id)
      .not("public_rank", "is", null)
      .order("public_rank", { ascending: true })
      .range(from, to),
    client
      .from("draft_ranker_community_player_results")
      .select(select)
      .eq("snapshot_id", snapshot.id)
      .eq("public_display_eligible", true)
      .is("public_rank", null)
      .in("evidence_state", ["emerging", "established"])
      .order("model_rank", { ascending: true })
      .limit(20),
  ]);
  const queryError = rankingResult.error ?? emergingResult.error;
  if (queryError) throw queryError;
  const rankedRows = (rankingResult.data ?? []) as ResultRow[];
  const emergingRows = (emergingResult.data ?? []) as ResultRow[];
  const allPlayerIds = [...rankedRows, ...emergingRows].map(
    (row) => row.fhfh_player_id,
  );
  const [identityByPlayer, personalRanks] = await Promise.all([
    loadIdentities(client, allPlayerIds),
    loadPersonalRanks({ client, userId: args.userId ?? null }),
  ]);
  const mapRows = (rows: ResultRow[]) =>
    rows.flatMap((row) => {
      const identity = identityByPlayer.get(row.fhfh_player_id);
      if (!identity) return [];
      return [
        publicRow(row, identity, personalRanks.get(row.fhfh_player_id) ?? null),
      ];
    });
  const metadata =
    snapshot.metadata && typeof snapshot.metadata === "object"
      ? (snapshot.metadata as Record<string, unknown>)
      : {};
  const acceptedComparisonCount = Number(metadata.acceptedComparisonCount ?? 0);
  const coldStart = acceptedComparisonCount === 0;
  return {
    status: coldStart ? ("market_seeded" as const) : ("available" as const),
    message: coldStart
      ? "This first snapshot is seeded from verified 2025 Yahoo draft ADP while FHFH collects opted-in explicit comparisons. It is not presented as community consensus."
      : null,
    snapshot: {
      id: snapshot.id,
      targetSeasonId: snapshot.target_season_id,
      snapshotAsOf: snapshot.snapshot_as_of,
      publishedAt: snapshot.published_at,
      cadence: snapshot.cadence,
      modelVersion: snapshot.model_version,
      playerCount: snapshot.player_count,
      publicDisplayCount: snapshot.public_display_count,
      publicTop250Count: snapshot.public_top250_count,
      acceptedComparisonCount,
      coldStart,
    },
    rows: mapRows(rankedRows),
    emerging: mapRows(emergingRows),
    pagination: {
      page: args.query.page,
      limit: args.query.limit,
      total: rankingResult.count ?? 0,
    },
    signedInPersonalContext: Boolean(args.userId),
  };
}
