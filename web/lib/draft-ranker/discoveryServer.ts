import { randomUUID } from "node:crypto";

import serviceRoleClient from "lib/supabase/server";
import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";

import { DRAFT_RANKER_TARGET_SEASON_ID } from "./contracts";
import {
  DRAFT_RANKER_DISCOVERY_ALGORITHM_VERSION,
  buildOpportunityChangeSignals,
  buildOwnershipRiserSignals,
  buildProjectionBackedSignals,
  buildProjectionConsensus,
  stableDiscoveryHash,
  type DiscoverySourceHealth,
  type MaterializedDiscoverySignal,
  type OpportunityCandidate,
  type OwnershipCandidate,
  type PriorAdpEvidence,
  type ProjectionConsensus,
} from "./discovery";

const PAGE_SIZE = 1000;
const ID_CHUNK_SIZE = 400;

type QueryClient = {
  from(table: string): any;
  rpc(name: string, args: any): any;
};

type YahooPlayerRow = {
  player_key: string;
  draft_analysis: unknown;
  average_draft_pick: number | null;
  ownership_timeline: unknown;
  last_updated: string | null;
  season: number | null;
};

export type DraftRankerDiscoverySnapshot = {
  targetSeasonId: number;
  asOf: string;
  offseason: boolean;
  algorithmVersion: string;
  sourceFingerprint: string;
  sourceSummary: Record<string, unknown>;
  groupCounts: Record<string, number>;
  warningCodes: string[];
  sourceHealth: DiscoverySourceHealth[];
  projectionConsensus: ProjectionConsensus[];
  signals: MaterializedDiscoverySignal[];
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

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function positiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function yahooPriorSeason(targetSeasonId: number): number {
  return Math.floor(targetSeasonId / 10000) - 1;
}

function previousNhlSeason(targetSeasonId: number): number {
  const start = Math.floor(targetSeasonId / 10000) - 1;
  return start * 10000 + start + 1;
}

function sourceSeasonFromProjectionTable(tableName: string): number | null {
  const match = tableName.match(/PROJECTIONS_(\d{8})/u);
  return match ? Number(match[1]) : null;
}

function parseTimeline(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((point) => {
    const row = jsonObject(point);
    const date = typeof row.date === "string" ? row.date : null;
    const numericValue = Number(row.value);
    return date &&
      /^\d{4}-\d{2}-\d{2}$/u.test(date) &&
      Number.isFinite(numericValue)
      ? [{ date, value: numericValue }]
      : [];
  });
}

function latestTimelineDate(rows: YahooPlayerRow[]): string | null {
  let latest: string | null = null;
  for (const row of rows) {
    for (const point of parseTimeline(row.ownership_timeline)) {
      if (!latest || point.date > latest) latest = point.date;
    }
  }
  return latest;
}

function expiryFromDate(sourceDate: string, days: number): string {
  const timestamp = Date.parse(`${sourceDate}T23:59:59.999Z`);
  return new Date(timestamp + days * 86_400_000).toISOString();
}

async function exactCount(client: QueryClient, table: string): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select("player_id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function loadYahooEvidence(args: {
  client: QueryClient;
  asOf: string;
  offseason: boolean;
  targetSeasonId: number;
}) {
  const priorSeason = yahooPriorSeason(args.targetSeasonId);
  const yahooRows = await fetchAll<YahooPlayerRow>((from, to) =>
    args.client
      .from("yahoo_players")
      .select(
        "player_key,draft_analysis,average_draft_pick,ownership_timeline,last_updated,season",
      )
      .eq("season", priorSeason)
      .order("player_key", { ascending: true })
      .range(from, to),
  );
  const playerKeys = [...new Set(yahooRows.map((row) => row.player_key))];
  const mappedRows: Array<{
    external_player_id: string;
    fhfh_player_id: number;
  }> = [];
  for (const keyChunk of chunks(playerKeys)) {
    const { data, error } = await args.client
      .from("fhfh_player_external_identities")
      .select("external_player_id,fhfh_player_id")
      .eq("provider", "yahoo")
      .eq("verification_status", "verified")
      .in("external_player_id", keyChunk);
    if (error) throw error;
    mappedRows.push(...((data ?? []) as typeof mappedRows));
  }
  const fhfhByYahooKey = new Map(
    mappedRows.map((row) => [row.external_player_id, row.fhfh_player_id]),
  );
  const priorAdp: PriorAdpEvidence[] = [];
  const ownership: OwnershipCandidate[] = [];
  for (const row of yahooRows) {
    const fhfhPlayerId = fhfhByYahooKey.get(row.player_key);
    if (!fhfhPlayerId) continue;
    const draftAnalysis = jsonObject(row.draft_analysis);
    const adp =
      positiveNumber(draftAnalysis.preseason_average_pick) ??
      positiveNumber(row.average_draft_pick);
    priorAdp.push({
      fhfhPlayerId,
      priorAdp: adp,
      adpState: adp == null ? "previously_undrafted" : "known",
      sourceKey: "yahoo_players.adp",
    });
    ownership.push({
      fhfhPlayerId,
      timeline: parseTimeline(row.ownership_timeline),
      sourceKey: "yahoo_players.ownership_timeline",
    });
  }

  const sourceDate = latestTimelineDate(yahooRows);
  const expiresAt = sourceDate
    ? expiryFromDate(sourceDate, args.offseason ? 7 : 2)
    : null;
  const asOfTimestamp = Date.parse(args.asOf);
  const available = expiresAt != null && Date.parse(expiresAt) > asOfTimestamp;
  const latestRowUpdate = yahooRows.reduce<string | null>((latest, row) => {
    if (!row.last_updated) return latest;
    return !latest || row.last_updated > latest ? row.last_updated : latest;
  }, null);
  const health: DiscoverySourceHealth = {
    source_key: "yahoo_players",
    health_state: available
      ? "available"
      : sourceDate
        ? "stale"
        : "unavailable",
    source_season_id: priorSeason * 10000 + priorSeason + 1,
    source_date: sourceDate,
    source_observed_at: sourceDate ? `${sourceDate}T23:59:59.999Z` : null,
    expires_at: expiresAt,
    row_count: yahooRows.length,
    mapped_player_count: fhfhByYahooKey.size,
    eligible_player_count: ownership.filter((row) => row.timeline.length >= 2)
      .length,
    warning_codes: available
      ? []
      : [
          sourceDate
            ? "ownership_timeline_stale"
            : "ownership_timeline_missing",
        ],
    metadata: {
      priorYahooSeason: priorSeason,
      latestRowUpdate,
      adpMappedPlayers: priorAdp.length,
    },
  };
  return { health, ownership, priorAdp, yahooRows };
}

async function loadProjectionHealth(args: {
  client: QueryClient;
  targetSeasonId: number;
}) {
  return Promise.all(
    PROJECTION_SOURCES_CONFIG.map(async (source) => {
      const sourceSeasonId = sourceSeasonFromProjectionTable(source.tableName);
      let rowCount = 0;
      const warningCodes: string[] = [];
      try {
        rowCount = await exactCount(args.client, source.tableName);
      } catch {
        warningCodes.push("projection_table_unreadable");
      }
      const seasonMatches = sourceSeasonId === args.targetSeasonId;
      if (!seasonMatches) warningCodes.push("projection_season_mismatch");
      if (seasonMatches) warningCodes.push("projection_observed_at_missing");
      return {
        source_key: `projection:${source.id}`,
        health_state: seasonMatches ? "unavailable" : "season_mismatch",
        source_season_id: sourceSeasonId,
        source_date: null,
        source_observed_at: null,
        expires_at: null,
        row_count: rowCount,
        mapped_player_count: 0,
        eligible_player_count: 0,
        warning_codes: warningCodes,
        metadata: {
          tableName: source.tableName,
          displayName: source.displayName,
          playerType: source.playerType,
          observedAtField: null,
        },
      } satisfies DiscoverySourceHealth;
    }),
  );
}

async function latestHealthRow(args: {
  client: QueryClient;
  table: string;
  select: string;
  orderColumn: string;
  filters?: (query: any) => any;
}) {
  let countQuery = args.client
    .from(args.table)
    .select(args.orderColumn, { count: "exact", head: true });
  let latestQuery = args.client
    .from(args.table)
    .select(args.select)
    .order(args.orderColumn, { ascending: false, nullsFirst: false })
    .limit(1);
  if (args.filters) {
    countQuery = args.filters(countQuery);
    latestQuery = args.filters(latestQuery);
  }
  const [countResult, latestResult] = await Promise.all([
    countQuery,
    latestQuery,
  ]);
  if (countResult.error) throw countResult.error;
  if (latestResult.error) throw latestResult.error;
  return {
    count: countResult.count ?? 0,
    latest: (latestResult.data?.[0] ?? null) as Record<string, unknown> | null,
  };
}

async function loadOpportunityEvidence(args: {
  client: QueryClient;
  asOf: string;
  targetSeasonId: number;
}) {
  const previousSeasonId = previousNhlSeason(args.targetSeasonId);
  const [roster, deployment, contracts] = await Promise.all([
    latestHealthRow({
      client: args.client,
      table: "nhl_api_game_roster_spots",
      select: "game_date,updated_at",
      orderColumn: "game_date",
      filters: (query) => query.eq("season_id", previousSeasonId),
    }),
    latestHealthRow({
      client: args.client,
      table: "player_lineup_deployment_tallies",
      select: "last_game_date,updated_at",
      orderColumn: "last_game_date",
      filters: (query) => query.eq("season_id", previousSeasonId),
    }),
    latestHealthRow({
      client: args.client,
      table: "nhl_player_contracts",
      select: "updated_at,end_season_id",
      orderColumn: "updated_at",
      filters: (query) =>
        query
          .eq("resolution_status", "matched")
          .lte("start_season_id", args.targetSeasonId)
          .gte("end_season_id", args.targetSeasonId),
    }),
  ]);

  const { data: rawEvents, error: eventError } = await args.client
    .from("forge_roster_events")
    .select(
      "player_id,event_type,confidence,effective_from,effective_to,payload,updated_at",
    )
    .not("player_id", "is", null)
    .lte("effective_from", args.asOf)
    .order("effective_from", { ascending: false })
    .limit(5000);
  if (eventError) throw eventError;
  const asOfTimestamp = Date.parse(args.asOf);
  const events = ((rawEvents ?? []) as Array<Record<string, unknown>>).filter(
    (event) =>
      event.effective_to == null ||
      Date.parse(String(event.effective_to)) > asOfTimestamp,
  );
  const nhlPlayerIds = [
    ...new Set(
      events
        .map((event) => Number(event.player_id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  const identities: Array<{
    id: number;
    nhl_player_id: number;
    current_nhl_team_id: number | null;
  }> = [];
  for (const idChunk of chunks(nhlPlayerIds)) {
    const { data, error } = await args.client
      .from("fhfh_player_identities")
      .select("id,nhl_player_id,current_nhl_team_id")
      .eq("verification_status", "verified")
      .is("merged_into_id", null)
      .in("nhl_player_id", idChunk);
    if (error) throw error;
    identities.push(...((data ?? []) as typeof identities));
  }
  const identityByNhlId = new Map(
    identities.map((identity) => [identity.nhl_player_id, identity]),
  );
  const priorTeamByNhlId = new Map<number, number>();
  for (const idChunk of chunks(nhlPlayerIds)) {
    const rows = await fetchAll<{
      player_id: number;
      team_id: number;
      game_date: string;
    }>((from, to) =>
      args.client
        .from("nhl_api_game_roster_spots")
        .select("player_id,team_id,game_date")
        .eq("season_id", previousSeasonId)
        .in("player_id", idChunk)
        .order("game_date", { ascending: false })
        .range(from, to),
    );
    for (const row of rows) {
      if (!priorTeamByNhlId.has(row.player_id)) {
        priorTeamByNhlId.set(row.player_id, row.team_id);
      }
    }
  }
  const candidates: OpportunityCandidate[] = [];
  const seenPlayers = new Set<number>();
  for (const event of events) {
    const nhlPlayerId = Number(event.player_id);
    const identity = identityByNhlId.get(nhlPlayerId);
    if (!identity || seenPlayers.has(identity.id)) continue;
    const effectiveFrom = String(event.effective_from);
    const defaultExpiry = new Date(
      Date.parse(effectiveFrom) + 7 * 86_400_000,
    ).toISOString();
    const payload = jsonObject(event.payload);
    candidates.push({
      fhfhPlayerId: identity.id,
      currentTeamId: identity.current_nhl_team_id,
      priorTeamId: priorTeamByNhlId.get(nhlPlayerId) ?? null,
      eventType: typeof event.event_type === "string" ? event.event_type : null,
      eventConfidence: Number.isFinite(Number(event.confidence))
        ? Number(event.confidence)
        : null,
      eventObservedAt: effectiveFrom,
      eventExpiresAt:
        typeof event.effective_to === "string"
          ? event.effective_to
          : defaultExpiry,
      projectionRankGain: null,
      projectionObservedAt: null,
      projectionExpiresAt: null,
      deploymentShareGain: Number.isFinite(
        Number(payload.deployment_share_gain),
      )
        ? Number(payload.deployment_share_gain)
        : null,
      sourceKeys: [
        "forge_roster_events",
        "fhfh_player_identities",
        "nhl_api_game_roster_spots",
      ],
    });
    seenPlayers.add(identity.id);
  }

  const health: DiscoverySourceHealth[] = [
    {
      source_key: "nhl_api_game_roster_spots",
      health_state: roster.count > 0 ? "available" : "unavailable",
      source_season_id: previousSeasonId,
      source_date: (roster.latest?.game_date as string | null) ?? null,
      source_observed_at: (roster.latest?.updated_at as string | null) ?? null,
      expires_at: null,
      row_count: roster.count,
      mapped_player_count: roster.count,
      eligible_player_count: roster.count,
      warning_codes: roster.count > 0 ? [] : ["prior_roster_missing"],
      metadata: { grain: "player-game roster spot" },
    },
    {
      source_key: "player_lineup_deployment_tallies",
      health_state: deployment.count > 0 ? "available" : "unavailable",
      source_season_id: previousSeasonId,
      source_date: (deployment.latest?.last_game_date as string | null) ?? null,
      source_observed_at:
        (deployment.latest?.updated_at as string | null) ?? null,
      expires_at: null,
      row_count: deployment.count,
      mapped_player_count: deployment.count,
      eligible_player_count: deployment.count,
      warning_codes:
        deployment.count > 0 ? [] : ["deployment_baseline_missing"],
      metadata: { role: "historical baseline" },
    },
    {
      source_key: "nhl_player_contracts",
      health_state: contracts.count > 0 ? "available" : "unavailable",
      source_season_id: args.targetSeasonId,
      source_date: null,
      source_observed_at:
        (contracts.latest?.updated_at as string | null) ?? null,
      expires_at: null,
      row_count: contracts.count,
      mapped_player_count: contracts.count,
      eligible_player_count: contracts.count,
      warning_codes:
        contracts.count > 0 ? [] : ["matched_target_contracts_missing"],
      metadata: { resolutionStatus: "matched" },
    },
    {
      source_key: "forge_roster_events",
      health_state: events.length > 0 ? "available" : "unavailable",
      source_season_id: args.targetSeasonId,
      source_date: events[0]?.effective_from
        ? dateOnly(String(events[0].effective_from))
        : null,
      source_observed_at: events[0]?.effective_from
        ? String(events[0].effective_from)
        : null,
      expires_at: events[0]
        ? typeof events[0].effective_to === "string"
          ? events[0].effective_to
          : new Date(
              Date.parse(String(events[0].effective_from)) + 7 * 86_400_000,
            ).toISOString()
        : null,
      row_count: events.length,
      mapped_player_count: identities.length,
      eligible_player_count: candidates.length,
      warning_codes: events.length > 0 ? [] : ["no_current_roster_events"],
      metadata: { minimumConfidence: 0.75 },
    },
  ];
  return { candidates, health };
}

export async function buildDraftRankerDiscoverySnapshot(
  args: {
    client?: QueryClient;
    asOf?: string;
    targetSeasonId?: number;
  } = {},
): Promise<DraftRankerDiscoverySnapshot> {
  const client = args.client ?? (serviceRoleClient as unknown as QueryClient);
  const asOf = args.asOf ?? new Date().toISOString();
  const targetSeasonId = args.targetSeasonId ?? DRAFT_RANKER_TARGET_SEASON_ID;
  const { data: season, error: seasonError } = await client
    .from("seasons")
    .select("id,startDate,regularSeasonEndDate,endDate")
    .eq("id", targetSeasonId)
    .maybeSingle();
  if (seasonError) throw seasonError;
  if (!season)
    throw new Error(`Target season ${targetSeasonId} is unavailable.`);
  const asOfDate = dateOnly(asOf);
  const offseason = asOfDate < season.startDate || asOfDate > season.endDate;

  const [yahoo, projectionHealth, opportunity] = await Promise.all([
    loadYahooEvidence({ client, asOf, offseason, targetSeasonId }),
    loadProjectionHealth({ client, targetSeasonId }),
    loadOpportunityEvidence({ client, asOf, targetSeasonId }),
  ]);

  // Current projection tables fail the season/observed-at contract, so the
  // normalized observation list is empty until a source can prove both.
  const projectionConsensus = buildProjectionConsensus({
    observations: [],
    asOf,
    targetSeasonId,
  });
  const signals = [
    ...buildProjectionBackedSignals({
      consensus: projectionConsensus,
      priorAdp: yahoo.priorAdp,
    }),
    ...buildOwnershipRiserSignals({
      candidates: yahoo.ownership,
      asOf,
      offseason,
    }),
    ...buildOpportunityChangeSignals({
      candidates: opportunity.candidates,
      asOf,
    }),
  ].sort(
    (left, right) =>
      left.signal_type.localeCompare(right.signal_type) ||
      right.score - left.score ||
      left.fhfh_player_id - right.fhfh_player_id,
  );
  const sourceHealth = [
    yahoo.health,
    ...projectionHealth,
    ...opportunity.health,
  ].sort((left, right) => left.source_key.localeCompare(right.source_key));
  const groupCounts = signals.reduce<Record<string, number>>(
    (counts, signal) => {
      counts[signal.signal_type] = (counts[signal.signal_type] ?? 0) + 1;
      return counts;
    },
    {
      projection_gap: 0,
      previously_undrafted: 0,
      cutoff_challenger: 0,
      ownership_riser: 0,
      opportunity_change: 0,
    },
  );
  const warningCodes = [
    ...new Set(sourceHealth.flatMap((source) => source.warning_codes)),
  ].sort();
  const sourceSummary = {
    asOf,
    offseason,
    availableSources: sourceHealth.filter(
      (source) => source.health_state === "available",
    ).length,
    degradedSources: sourceHealth.filter(
      (source) => source.health_state !== "available",
    ).length,
    yahooRows: yahoo.yahooRows.length,
    projectionConsensusPlayers: projectionConsensus.length,
    opportunityCandidates: opportunity.candidates.length,
  };
  const sourceFingerprint = stableDiscoveryHash({
    algorithmVersion: DRAFT_RANKER_DISCOVERY_ALGORITHM_VERSION,
    sourceHealth,
    projectionConsensus,
    signals,
    targetSeasonId,
  });
  return {
    targetSeasonId,
    asOf,
    offseason,
    algorithmVersion: DRAFT_RANKER_DISCOVERY_ALGORITHM_VERSION,
    sourceFingerprint,
    sourceSummary,
    groupCounts,
    warningCodes,
    sourceHealth,
    projectionConsensus,
    signals,
  };
}

export async function persistDraftRankerDiscoverySnapshot(args: {
  client?: QueryClient;
  snapshot: DraftRankerDiscoverySnapshot;
  operationId?: string;
  requestedBy?: string | null;
}) {
  const client = args.client ?? (serviceRoleClient as unknown as QueryClient);
  const operationId = args.operationId ?? randomUUID();
  const operationPayloadHash = stableDiscoveryHash({
    operationId,
    sourceFingerprint: args.snapshot.sourceFingerprint,
    targetSeasonId: args.snapshot.targetSeasonId,
  });
  const { data, error } = await client.rpc(
    "replace_draft_ranker_discovery_snapshot",
    {
      p_target_season_id: args.snapshot.targetSeasonId,
      p_operation_id: operationId,
      p_operation_payload_hash: operationPayloadHash,
      p_source_fingerprint: args.snapshot.sourceFingerprint,
      p_algorithm_version: args.snapshot.algorithmVersion,
      p_requested_by: args.requestedBy ?? null,
      p_source_summary: args.snapshot.sourceSummary,
      p_group_counts: args.snapshot.groupCounts,
      p_warning_codes: args.snapshot.warningCodes,
      p_source_health: args.snapshot.sourceHealth,
      p_projection_consensus: args.snapshot.projectionConsensus,
      p_signals: args.snapshot.signals,
    },
  );
  if (error) throw error;
  const result = data as Record<string, unknown>;
  if (result.status === "conflict") {
    throw new Error(
      "Discovery refresh operation ID was reused with another payload.",
    );
  }
  return result;
}
