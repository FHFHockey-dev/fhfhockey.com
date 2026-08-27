import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { FANTASY_PROJECTION_SEASON_ID } from "./contracts";
import {
  resolveSeasonRosterConsensus,
  rosterStatusFromPoolStatus,
  type SeasonRosterObservation,
  type SeasonRosterObservationKind,
  type SeasonRosterStatus,
} from "./rosterIntegrity";
import {
  captureOfficialNhlTransactionAudit,
  findOfficialRosterAuditEvidence,
  OFFICIAL_TRANSACTION_AUDIT_WINDOW_START,
  type OfficialNhlArticleCapture,
} from "./transactionAudit";

const CURRENT_NHL_TEAM_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19,
  20, 21, 22, 23, 24, 25, 26, 28, 29, 30, 52, 54, 55, 68,
] as const;

type FetchLike = typeof fetch;
type JsonRecord = Record<string, any>;

type OfficialRosterPlayer = {
  nhlPlayerId: number;
  playerName: string;
  position: "C" | "L" | "R" | "D" | "G";
  teamId: number;
  teamAbbreviation: string;
  sourceUrl: string;
  sourceHash: string;
  payload: JsonRecord;
};

type IdentityRow = {
  id: number;
  nhl_player_id: number | null;
  canonical_name: string;
  canonical_position: string | null;
  current_nhl_team_id: number | null;
  lifecycle_status: string;
  source_provenance: JsonRecord | null;
};

type CurrentMember = {
  fhfh_player_id: number;
  team_id: number | null;
  position: string;
  pool_status: string;
  roster_status?: SeasonRosterStatus;
  roster_confidence: number;
  prior_based: boolean;
  resolved_observation_ids?: string[];
  source_fresh_at?: string | null;
};

function canonical(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function checksum(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function localized(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as JsonRecord;
    return String(record.default ?? record.en ?? "");
  }
  return "";
}

function isOfficialNhlUrl(value: unknown): boolean {
  try {
    const hostname = new URL(String(value ?? "")).hostname.toLowerCase();
    return hostname === "nhl.com" || hostname.endsWith(".nhl.com");
  } catch {
    return false;
  }
}

async function selectAll(
  client: any,
  table: string,
  columns: string,
  configure: (query: any) => any,
): Promise<any[]> {
  const rows: any[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await configure(
      client.from(table).select(columns).range(start, start + 999),
    );
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

async function rpcAll(client: any, functionName: string, parameters: JsonRecord): Promise<any[]> {
  const rows: any[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await client
      .rpc(functionName, parameters)
      .range(start, start + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  callback: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await callback(values[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
  return results;
}

async function fetchJson(fetchImpl: FetchLike, url: string): Promise<JsonRecord> {
  const response = await fetchImpl(url, {
    headers: { "User-Agent": "FHFH-player-forecasts/4.0" },
  });
  if (!response.ok) {
    throw new Error(`Official NHL source returned ${response.status} for ${url}.`);
  }
  return (await response.json()) as JsonRecord;
}

function rosterPlayers(
  payload: JsonRecord,
  teamId: number,
  abbreviation: string,
  sourceUrl: string,
): OfficialRosterPlayer[] {
  const groups: Array<[string, string | null]> = [
    ["forwards", null],
    ["defensemen", "D"],
    ["goalies", "G"],
  ];
  return groups.flatMap(([group, fixedPosition]) =>
    (Array.isArray(payload[group]) ? payload[group] : []).map((player: JsonRecord) => {
      const normalized = {
        nhlPlayerId: Number(player.id),
        playerName: [localized(player.firstName), localized(player.lastName)]
          .filter(Boolean)
          .join(" "),
        position: String(fixedPosition ?? player.positionCode ?? "C"),
        teamId,
        teamAbbreviation: abbreviation,
      };
      return {
        ...normalized,
        position: normalized.position as OfficialRosterPlayer["position"],
        sourceUrl,
        sourceHash: checksum(normalized),
        payload: player,
      };
    }),
  );
}

function poolStatusForRosterStatus(
  status: SeasonRosterStatus,
  currentPoolStatus: string,
): string {
  if (status === "active_nhl" || status === "injured_nhl") return "verified_active";
  if (status === "affiliate" || status === "prospect_reserve") return "active_prospect";
  if (status === "unsigned") return "unsigned_relevant";
  return currentPoolStatus || "review_required";
}

function currentFromIdentity(identity: IdentityRow): CurrentMember {
  const poolStatus =
    identity.lifecycle_status === "active_nhl"
      ? "verified_active"
      : identity.lifecycle_status === "active_prospect"
        ? "active_prospect"
        : identity.lifecycle_status === "unsigned_relevant"
          ? "unsigned_relevant"
          : "review_required";
  return {
    fhfh_player_id: Number(identity.id),
    team_id:
      identity.current_nhl_team_id == null
        ? null
        : Number(identity.current_nhl_team_id),
    position: String(identity.canonical_position ?? "C"),
    pool_status: poolStatus,
    roster_status: rosterStatusFromPoolStatus(poolStatus),
    roster_confidence: poolStatus === "verified_active" ? 0.7 : 0.4,
    prior_based: poolStatus !== "verified_active",
    resolved_observation_ids: [],
    source_fresh_at: null,
  };
}

function activeConflictRows(rows: any[]): any[] {
  const superseded = new Set(rows.map((row) => row.supersedes_id).filter(Boolean));
  return rows.filter(
    (row) =>
      !superseded.has(row.id) &&
      (row.player_forecast_season_roster_conflict_resolutions ?? []).length === 0,
  );
}

export async function refreshSeasonRosterIntegrity(args: {
  supabase: SupabaseClient<any>;
  seasonId?: number;
  fetchImpl?: FetchLike;
  now?: Date;
  landingBatchSize?: number;
  verifiedTransactionCoverage?: {
    windowStart: string;
    cutoffAt: string;
    sourceManifestChecksum: string;
    sourceCount: number;
  };
}): Promise<Record<string, unknown>> {
  const client = args.supabase as any;
  const seasonId = args.seasonId ?? FANTASY_PROJECTION_SEASON_ID;
  const fetchImpl = args.fetchImpl ?? fetch;
  const startedAt = args.now ?? new Date();
  const availableAt = startedAt.toISOString();
  const captureDate = availableAt.slice(0, 10);

  const [
    teams,
    identities,
    snapshotResult,
    latestObservationResult,
    conflictResult,
    processedIftttRows,
  ] =
    await Promise.all([
      selectAll(client, "teams", "id,name,abbreviation", (query) =>
        query.in("id", [...CURRENT_NHL_TEAM_IDS]).order("id"),
      ),
      selectAll(
        client,
        "fhfh_player_identities",
        "id,nhl_player_id,canonical_name,canonical_position,current_nhl_team_id,lifecycle_status,source_provenance",
        (query) =>
          query
            .in("lifecycle_status", [
              "active_nhl",
              "active_prospect",
              "unsigned_relevant",
            ])
            .in("verification_status", ["verified", "provisional"])
            .order("id"),
      ),
      client
        .from("player_forecast_season_roster_snapshots")
        .select("id,revision_hash,available_at,metadata")
        .eq("season_id", seasonId)
        .order("available_at", { ascending: false })
        .limit(1),
      rpcAll(client, "latest_player_forecast_season_roster_observations", {
        p_season_id: seasonId,
      }),
      client
        .from("player_forecast_season_roster_conflicts")
        .select(
          "id,fhfh_player_id,nhl_player_id,supersedes_id,player_forecast_season_roster_conflict_resolutions(id,resolution_action,organization_team_id,roster_status,reason,created_at,supersedes_id)",
        )
        .eq("season_id", seasonId)
        .order("detected_at", { ascending: false })
        .limit(2000),
      selectAll(
        client,
        "line_source_ifttt_events",
        "id,source_key,source_account,text,link_to_tweet,tweet_id,tweet_created_at,raw_payload,received_at,processing_status",
        (query) =>
          query
            .eq("processing_status", "processed")
            .gte("received_at", "2026-06-16T00:00:00Z")
            .order("received_at", { ascending: true }),
      ),
    ]);
  if (teams.length !== 32) {
    throw new Error(`Roster reconciliation requires 32 current NHL teams; found ${teams.length}.`);
  }
  if (snapshotResult.error) throw snapshotResult.error;
  if (conflictResult.error) throw conflictResult.error;

  const latestSnapshot = snapshotResult.data?.[0] ?? null;
  const currentMembers = latestSnapshot
    ? await selectAll(
        client,
        "player_forecast_season_roster_members",
        "fhfh_player_id,team_id,position,pool_status,roster_status,roster_confidence,prior_based,resolved_observation_ids,source_fresh_at",
        (query) => query.eq("snapshot_id", latestSnapshot.id).order("fhfh_player_id"),
      )
    : [];
  const currentByPlayer = new Map<number, CurrentMember>(
    currentMembers.map((row) => [Number(row.fhfh_player_id), row]),
  );
  const identitiesByNhl = new Map<number, IdentityRow>(
    (identities as IdentityRow[])
      .filter((identity) => identity.nhl_player_id != null)
      .map((identity) => [Number(identity.nhl_player_id), identity]),
  );
  const teamById = new Map<number, any>(
    teams.map((team: any) => [Number(team.id), team]),
  );

  const rosterCaptures = await mapWithConcurrency(teams, 8, async (team) => {
    const abbreviation = String(team.abbreviation).trim();
    const sourceUrl = `https://api-web.nhle.com/v1/roster/${abbreviation}/current`;
    const payload = await fetchJson(fetchImpl, sourceUrl);
    return rosterPlayers(payload, Number(team.id), abbreviation, sourceUrl);
  });
  const officialPlayers = rosterCaptures.flat();
  const officialByNhl = new Map(
    officialPlayers.map((player) => [player.nhlPlayerId, player]),
  );
  let officialTransactionCaptures: OfficialNhlArticleCapture[] = [];
  let officialTransactionAuditError: string | null = null;
  if (!args.verifiedTransactionCoverage) {
    try {
      officialTransactionCaptures = (
        await captureOfficialNhlTransactionAudit({ fetchImpl, capturedAt: availableAt })
      ).captures;
    } catch (error) {
      officialTransactionAuditError =
        error instanceof Error ? error.message : String(error);
    }
  }

  const latestObservations = latestObservationResult as any[];
  const latestByPlayerKind = new Map<string, any>();
  for (const observation of latestObservations) {
    latestByPlayerKind.set(
      `${observation.fhfh_player_id ?? `nhl:${observation.nhl_player_id}`}:${observation.observation_kind}`,
      observation,
    );
  }

  const observationRows: any[] = officialPlayers.map((player) => {
    const identity = identitiesByNhl.get(player.nhlPlayerId);
    const key = `${identity?.id ?? `nhl:${player.nhlPlayerId}`}:official_roster`;
    return {
      season_id: seasonId,
      fhfh_player_id: identity?.id ?? null,
      nhl_player_id: player.nhlPlayerId,
      raw_player_name: player.playerName,
      observation_kind: "official_roster",
      event_type: "membership",
      organization_team_id: player.teamId,
      // During the offseason this endpoint is organization-wide. Membership
      // does not independently prove active-NHL, affiliate, or reserve status.
      roster_status: "unresolved",
      source_key: `official-roster:${player.teamAbbreviation}:${captureDate}`,
      source_url: player.sourceUrl,
      source_hash: player.sourceHash,
      observed_at: availableAt,
      available_at: availableAt,
      effective_at: null,
      confidence: 1,
      evidence: { position: player.position, officialPayload: player.payload },
      supersedes_id: latestByPlayerKind.get(key)?.id ?? null,
    };
  });
  for (const event of processedIftttRows) {
    const rawPayload =
      event.raw_payload && typeof event.raw_payload === "object"
        ? event.raw_payload
        : {};
    const evidence =
      rawPayload.normalized_roster_evidence &&
      typeof rawPayload.normalized_roster_evidence === "object"
        ? rawPayload.normalized_roster_evidence
        : null;
    if (rawPayload.forecast_relevant !== true || !evidence) continue;
    const nhlPlayerId = Number(evidence.nhl_player_id);
    const organizationTeamId =
      evidence.organization_team_id == null
        ? null
        : Number(evidence.organization_team_id);
    const allowedStatuses = new Set([
      "active_nhl",
      "injured_nhl",
      "affiliate",
      "prospect_reserve",
      "unsigned",
      "unresolved",
    ]);
    if (
      !Number.isInteger(nhlPlayerId) ||
      nhlPlayerId <= 0 ||
      (organizationTeamId != null &&
        (!Number.isInteger(organizationTeamId) || organizationTeamId <= 0)) ||
      !allowedStatuses.has(String(evidence.roster_status))
    ) {
      continue;
    }
    const identity = identitiesByNhl.get(nhlPlayerId);
    const officialTransaction =
      isOfficialNhlUrl(evidence.official_source_url) &&
      ["signing", "trade", "waiver", "release"].includes(
        String(evidence.event_type),
      );
    const observationKind = officialTransaction
      ? "official_transaction"
      : "trusted_ifttt";
    const key = `${identity?.id ?? `nhl:${nhlPlayerId}`}:${observationKind}`;
    const receivedAt = String(event.received_at);
    const claimedObservedAt = String(event.tweet_created_at ?? receivedAt);
    const observedAt =
      Date.parse(claimedObservedAt) <= Date.parse(receivedAt)
        ? claimedObservedAt
        : receivedAt;
    const normalized = {
      eventId: event.id,
      nhlPlayerId,
      organizationTeamId,
      rosterStatus: String(evidence.roster_status),
      eventType: String(evidence.event_type ?? "unknown"),
      officialSourceUrl: evidence.official_source_url ?? null,
    };
    observationRows.push({
      season_id: seasonId,
      fhfh_player_id: identity?.id ?? null,
      nhl_player_id: nhlPlayerId,
      raw_player_name: String(
        evidence.player_name ?? identity?.canonical_name ?? `NHL ${nhlPlayerId}`,
      ),
      observation_kind: observationKind,
      event_type: [
        "membership",
        "signing",
        "trade",
        "waiver",
        "release",
        "affiliate_assignment",
        "injury",
      ].includes(String(evidence.event_type))
        ? String(evidence.event_type)
        : "unknown",
      organization_team_id: organizationTeamId,
      roster_status: String(evidence.roster_status),
      source_key: `${observationKind}:${event.source_key}:${event.tweet_id ?? event.id}`,
      source_url: String(evidence.official_source_url ?? event.link_to_tweet ?? "") || null,
      source_hash: checksum(normalized),
      observed_at: observedAt,
      available_at: receivedAt,
      effective_at: evidence.effective_at ?? null,
      confidence: officialTransaction
        ? Math.min(1, Math.max(0.9, Number(evidence.confidence ?? 0.95)))
        : Math.min(0.89, Math.max(0, Number(evidence.confidence ?? 0.75))),
      evidence: {
        normalized,
        sourceAccount: event.source_account,
        text: event.text,
        rawEventId: event.id,
      },
      supersedes_id: latestByPlayerKind.get(key)?.id ?? null,
    });
  }

  const lastLandingByNhl = new Map<number, any>();
  for (const observation of latestObservations) {
    if (observation.observation_kind === "player_landing" && observation.nhl_player_id) {
      lastLandingByNhl.set(Number(observation.nhl_player_id), observation);
    }
  }
  const changedOfficialIds = officialPlayers
    .filter((player) => {
      const identity = identitiesByNhl.get(player.nhlPlayerId);
      const current = identity
        ? currentByPlayer.get(identity.id) ?? currentFromIdentity(identity)
        : null;
      return !current || current.team_id !== player.teamId;
    })
    .map((player) => player.nhlPlayerId);
  const rotationCandidates = (identities as IdentityRow[])
    .filter((identity) => identity.nhl_player_id != null)
    .sort((left, right) => {
      const leftAt = lastLandingByNhl.get(Number(left.nhl_player_id))?.available_at;
      const rightAt = lastLandingByNhl.get(Number(right.nhl_player_id))?.available_at;
      return Date.parse(leftAt ?? "1970-01-01") - Date.parse(rightAt ?? "1970-01-01");
    })
    .slice(0, Math.max(1, Math.min(250, args.landingBatchSize ?? 96)))
    .map((identity) => Number(identity.nhl_player_id));
  const landingIds = Array.from(new Set([...changedOfficialIds, ...rotationCandidates]));
  const landingCaptures = await mapWithConcurrency(landingIds, 12, async (nhlPlayerId) => {
    const sourceUrl = `https://api-web.nhle.com/v1/player/${nhlPlayerId}/landing`;
    try {
      const payload = await fetchJson(fetchImpl, sourceUrl);
      return { nhlPlayerId, sourceUrl, payload, error: null as string | null };
    } catch (error) {
      return {
        nhlPlayerId,
        sourceUrl,
        payload: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
  const landingFailures = landingCaptures.filter((capture) => capture.error);
  for (const capture of landingCaptures.filter((row) => row.payload)) {
    const payload = capture.payload as JsonRecord;
    const identity = identitiesByNhl.get(capture.nhlPlayerId);
    const current = identity
      ? currentByPlayer.get(identity.id) ?? currentFromIdentity(identity)
      : null;
    const landingTeamId = payload.currentTeamId == null ? null : Number(payload.currentTeamId);
    const rosterStatus: SeasonRosterStatus =
      current?.roster_status ??
      (identity
        ? rosterStatusFromPoolStatus(currentFromIdentity(identity).pool_status)
        : "unresolved");
    const normalized = {
      nhlPlayerId: capture.nhlPlayerId,
      playerName: [localized(payload.firstName), localized(payload.lastName)]
        .filter(Boolean)
        .join(" "),
      currentTeamId: landingTeamId,
      currentTeamAbbreviation: payload.currentTeamAbbrev ?? null,
      position: payload.position ?? null,
    };
    const key = `${identity?.id ?? `nhl:${capture.nhlPlayerId}`}:player_landing`;
    observationRows.push({
      season_id: seasonId,
      fhfh_player_id: identity?.id ?? null,
      nhl_player_id: capture.nhlPlayerId,
      raw_player_name: normalized.playerName || identity?.canonical_name || `NHL ${capture.nhlPlayerId}`,
      observation_kind: "player_landing",
      event_type: "membership",
      organization_team_id: landingTeamId,
      roster_status: rosterStatus,
      source_key: `player-landing:${capture.nhlPlayerId}:${captureDate}`,
      source_url: capture.sourceUrl,
      source_hash: checksum(normalized),
      observed_at: availableAt,
      available_at: availableAt,
      effective_at: null,
      confidence: 1,
      evidence: { officialPayload: payload },
      supersedes_id: latestByPlayerKind.get(key)?.id ?? null,
    });
  }

  if (officialTransactionCaptures.length) {
    for (const capture of landingCaptures.filter((row) => row.payload)) {
      const identity = identitiesByNhl.get(capture.nhlPlayerId);
      if (!identity) continue;
      const landingTeamId = Number((capture.payload as JsonRecord).currentTeamId);
      const team = teamById.get(landingTeamId);
      if (!Number.isInteger(landingTeamId) || !team) continue;
      const evidence = findOfficialRosterAuditEvidence({
        playerName: String(identity.canonical_name),
        teamName: String(team.name),
        teamAbbreviation: String(team.abbreviation),
        captures: officialTransactionCaptures,
      });
      if (!evidence) continue;
      const current = currentByPlayer.get(identity.id) ?? currentFromIdentity(identity);
      const key = `${identity.id}:official_transaction`;
      observationRows.push({
        season_id: seasonId,
        fhfh_player_id: identity.id,
        nhl_player_id: capture.nhlPlayerId,
        raw_player_name: identity.canonical_name,
        observation_kind: "official_transaction",
        event_type: evidence.eventType,
        organization_team_id: landingTeamId,
        // Tracker articles establish organization movement, not active-roster
        // placement. Preserve the independently resolved lifecycle status.
        roster_status:
          current.roster_status ?? rosterStatusFromPoolStatus(current.pool_status),
        source_key: `official-transaction-tracker:${capture.nhlPlayerId}:${evidence.sourceHash}`,
        source_url: evidence.sourceUrl,
        source_hash: evidence.sourceHash,
        observed_at: availableAt,
        available_at: availableAt,
        effective_at: null,
        confidence: 1,
        evidence: {
          trackerExcerpt: evidence.excerpt,
          trackerCapturedAt: availableAt,
        },
        supersedes_id: latestByPlayerKind.get(key)?.id ?? null,
      });
    }
  }

  for (let start = 0; start < observationRows.length; start += 500) {
    const { error } = await client
      .from("player_forecast_season_roster_observations")
      .upsert(observationRows.slice(start, start + 500), {
        onConflict: "season_id,observation_kind,source_key,source_hash",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }

  const unmappedOfficial = officialPlayers.filter(
    (player) => !identitiesByNhl.has(player.nhlPlayerId),
  );
  if (unmappedOfficial.length) {
    const { error } = await client
      .from("player_forecast_season_player_pool_review")
      .upsert(
        unmappedOfficial.map((player) => ({
          review_key: `season-roster-identity:${seasonId}:${player.nhlPlayerId}`,
          season_id: seasonId,
          nhl_player_id: player.nhlPlayerId,
          raw_player_name: player.playerName,
          team_id: player.teamId,
          position: player.position,
          issue_code: "official_roster_identity_unmapped",
          resolution_status: "pending",
          source_provenance: {
            sourceUrl: player.sourceUrl,
            sourceHash: player.sourceHash,
            observedAt: availableAt,
          },
        })),
        { onConflict: "review_key", ignoreDuplicates: true },
      );
    if (error) throw error;
  }

  const refreshedObservations = await rpcAll(
    client,
    "latest_player_forecast_season_roster_observations",
    { p_season_id: seasonId },
  );
  const observationsByPlayer = new Map<number, any[]>();
  for (const observation of refreshedObservations) {
    if (observation.fhfh_player_id == null) continue;
    const playerId = Number(observation.fhfh_player_id);
    observationsByPlayer.set(playerId, [
      ...(observationsByPlayer.get(playerId) ?? []),
      observation,
    ]);
  }

  const openConflicts = activeConflictRows(conflictResult.data ?? []);
  const openConflictByPlayer = new Map<number, any>(
    openConflicts
      .filter((row) => row.fhfh_player_id != null)
      .map((row) => [Number(row.fhfh_player_id), row]),
  );
  const manualResolutionByPlayer = new Map<number, any>();
  for (const conflict of conflictResult.data ?? []) {
    if (conflict.fhfh_player_id == null) continue;
    const resolutions = conflict.player_forecast_season_roster_conflict_resolutions ?? [];
    const supersededResolutions = new Set(
      resolutions.map((resolution: any) => resolution.supersedes_id).filter(Boolean),
    );
    const latest = resolutions
      .filter(
        (resolution: any) =>
          resolution.resolution_action !== "automatic_consensus" &&
          !supersededResolutions.has(resolution.id),
      )
      .sort(
        (left: any, right: any) =>
          Date.parse(right.created_at) - Date.parse(left.created_at),
      )[0];
    if (!latest) continue;
    const playerId = Number(conflict.fhfh_player_id);
    const current = manualResolutionByPlayer.get(playerId);
    if (!current || Date.parse(latest.created_at) > Date.parse(current.created_at)) {
      manualResolutionByPlayer.set(playerId, latest);
    }
  }
  const members: any[] = [];
  let automaticChanges = 0;
  let stagedConflicts = 0;

  for (const identity of identities as IdentityRow[]) {
    const current = currentByPlayer.get(identity.id) ?? currentFromIdentity(identity);
    const observations = (observationsByPlayer.get(identity.id) ?? []).map(
      (row): SeasonRosterObservation => ({
        id: String(row.id),
        observationKind: row.observation_kind as SeasonRosterObservationKind,
        organizationTeamId:
          row.organization_team_id == null ? null : Number(row.organization_team_id),
        rosterStatus: row.roster_status as SeasonRosterStatus,
        availableAt: String(row.available_at),
        confidence: Number(row.confidence),
        supersedesId: row.supersedes_id,
      }),
    );
    const consensus = resolveSeasonRosterConsensus({
      observations,
      currentOrganizationTeamId: current.team_id,
      currentRosterStatus: current.roster_status ??
        rosterStatusFromPoolStatus(current.pool_status),
    });
    const approvedResolution =
      consensus.resolution === "review_required"
        ? manualResolutionByPlayer.get(identity.id)
        : null;
    const automatic = consensus.resolution === "automatic";
    const resolved = automatic || Boolean(approvedResolution);
    const nextTeamId = automatic
      ? consensus.organizationTeamId
      : approvedResolution?.resolution_action === "mark_unsigned"
        ? null
        : approvedResolution?.resolution_action === "select_team"
          ? Number(approvedResolution.organization_team_id)
          : current.team_id;
    const nextStatus = automatic
      ? consensus.rosterStatus
      : approvedResolution?.roster_status ??
        current.roster_status ??
        rosterStatusFromPoolStatus(current.pool_status);
    const changed =
      resolved &&
      (nextTeamId !== current.team_id || nextStatus !== current.roster_status);
    if (changed) automaticChanges += 1;

    const openConflict = openConflictByPlayer.get(identity.id);
    if (automatic && openConflict) {
      const { error } = await client
        .from("player_forecast_season_roster_conflict_resolutions")
        .insert({
          conflict_id: openConflict.id,
          resolution_action: "automatic_consensus",
          organization_team_id: nextTeamId,
          roster_status: nextStatus,
          reason: "A newer approved pair of official sources reached consensus.",
          created_by: null,
        });
      if (error) throw error;
    }

    const activeEvidenceTeams = Array.from(
      new Set(
        observations
          .map((observation) => observation.organizationTeamId)
          .filter((teamId): teamId is number => teamId != null),
      ),
    );
    const proposedChange =
      consensus.resolution === "review_required" &&
      (activeEvidenceTeams.some((teamId) => teamId !== current.team_id) ||
        activeEvidenceTeams.length > 1);
    if (proposedChange) {
      const conflictKey = `roster:${seasonId}:${identity.id}:${checksum({
        type: consensus.conflictType,
        observations: consensus.observationIds.slice().sort(),
      })}`;
      const { data: existingConflict, error: existingConflictError } = await client
        .from("player_forecast_season_roster_conflicts")
        .select("id")
        .eq("conflict_key", conflictKey)
        .maybeSingle();
      if (existingConflictError) throw existingConflictError;
      if (!existingConflict) {
        const { data: conflict, error: conflictError } = await client
          .from("player_forecast_season_roster_conflicts")
          .insert({
            season_id: seasonId,
            conflict_key: conflictKey,
            fhfh_player_id: identity.id,
            nhl_player_id: identity.nhl_player_id,
            conflict_type: consensus.conflictType,
            candidate_team_ids: activeEvidenceTeams,
            summary: consensus.summary,
            detected_at: availableAt,
            supersedes_id: openConflict?.id ?? null,
          })
          .select("id")
          .single();
        if (conflictError) throw conflictError;
        if (consensus.observationIds.length) {
          const { error: memberError } = await client
            .from("player_forecast_season_roster_conflict_members")
            .insert(
              consensus.observationIds.map((observationId) => ({
                conflict_id: conflict.id,
                observation_id: observationId,
              })),
            );
          if (memberError) throw memberError;
        }
        stagedConflicts += 1;
      }
    }

    const official =
      identity.nhl_player_id == null
        ? null
        : officialByNhl.get(Number(identity.nhl_player_id));
    const position = String(official?.position ?? current.position ?? identity.canonical_position ?? "C");
    members.push({
      fhfh_player_id: identity.id,
      team_id: nextTeamId,
      previous_team_id:
        changed && current.team_id !== nextTeamId ? current.team_id : null,
      position,
      pool_status: poolStatusForRosterStatus(nextStatus, current.pool_status),
      roster_status: nextStatus,
      roster_confidence: resolved
        ? automatic
          ? consensus.confidence
          : 1
        : Number(current.roster_confidence ?? 0.4),
      prior_based: current.prior_based || nextStatus !== "active_nhl",
      resolved_observation_ids: automatic
        ? consensus.observationIds
        : current.resolved_observation_ids ?? [],
      source_fresh_at: automatic
        ? consensus.sourceFreshAt
        : approvedResolution?.created_at ??
          current.source_fresh_at ?? null,
      source_provenance: {
        automaticConsensus: automatic,
        approvedResolution: Boolean(approvedResolution),
        resolutionId: approvedResolution?.id ?? null,
        changed,
        observationIds: consensus.observationIds,
        conflictType: consensus.conflictType,
        rosterOmissionIsNotRemoval: !official,
      },
    });
  }

  const mappedOfficialCount = officialPlayers.filter((player) =>
    identitiesByNhl.has(player.nhlPlayerId),
  ).length;
  const completeness = officialPlayers.length
    ? mappedOfficialCount / officialPlayers.length
    : 0;
  const normalizedTransactionRows = refreshedObservations.filter((row) =>
    ["official_transaction", "trusted_ifttt"].includes(row.observation_kind),
  );
  const transactionCutoffAt = normalizedTransactionRows.reduce<string | null>(
    (latest, row) =>
      !latest || String(row.available_at) > latest ? String(row.available_at) : latest,
    null,
  );
  const priorCoverage =
    latestSnapshot?.metadata?.transactionCoverage?.complete === true
      ? latestSnapshot.metadata.transactionCoverage
      : null;
  const liveTrackerCoverage = officialTransactionCaptures.length
    ? {
        windowStart: OFFICIAL_TRANSACTION_AUDIT_WINDOW_START,
        cutoffAt: availableAt,
        sourceManifestChecksum: checksum(
          officialTransactionCaptures.map((capture) => ({
            url: capture.url,
            sourceHash: capture.sourceHash,
            datePublished: capture.datePublished,
            dateModified: capture.dateModified,
          })),
        ),
        sourceCount: officialTransactionCaptures.length,
      }
    : undefined;
  const verifiedCoverage =
    args.verifiedTransactionCoverage ??
    liveTrackerCoverage ??
    (priorCoverage
      ? {
          windowStart: String(priorCoverage.windowStart ?? ""),
          cutoffAt: String(priorCoverage.cutoffAt ?? ""),
          sourceManifestChecksum: String(
            priorCoverage.sourceManifestChecksum ?? "",
          ),
          sourceCount: Number(priorCoverage.sourceCount ?? 0),
        }
      : undefined);
  if (
    verifiedCoverage &&
    (verifiedCoverage.windowStart !== OFFICIAL_TRANSACTION_AUDIT_WINDOW_START ||
      !Number.isFinite(Date.parse(verifiedCoverage.cutoffAt)) ||
      Date.parse(verifiedCoverage.cutoffAt) < Date.parse(verifiedCoverage.windowStart) ||
      Date.parse(verifiedCoverage.cutoffAt) > Date.parse(availableAt) ||
      !/^[0-9a-f]{64}$/.test(verifiedCoverage.sourceManifestChecksum) ||
      !Number.isInteger(verifiedCoverage.sourceCount) ||
      verifiedCoverage.sourceCount < 1)
  ) {
    throw new Error("Verified transaction coverage manifest is invalid.");
  }
  const transactionCoverage = {
    windowStart: OFFICIAL_TRANSACTION_AUDIT_WINDOW_START,
    cutoffAt: verifiedCoverage?.cutoffAt ?? transactionCutoffAt,
    processedIftttEvents: processedIftttRows.length,
    normalizedObservations: normalizedTransactionRows.length,
    officialObservations: normalizedTransactionRows.filter(
      (row) => row.observation_kind === "official_transaction",
    ).length,
    trustedIftttObservations: normalizedTransactionRows.filter(
      (row) => row.observation_kind === "trusted_ifttt",
    ).length,
    sourceManifestChecksum: verifiedCoverage?.sourceManifestChecksum ?? null,
    sourceCount: verifiedCoverage?.sourceCount ?? 0,
    complete: Boolean(verifiedCoverage),
    status: verifiedCoverage
      ? "complete"
      : normalizedTransactionRows.length
        ? "partial"
        : "missing",
    holdReason: verifiedCoverage
      ? null
      : "A complete checksum-manifested official transaction audit has not been imported.",
    auditError: officialTransactionAuditError,
  };
  const revisionHash = checksum({
    members: members
      .map((member) => ({
        fhfhPlayerId: member.fhfh_player_id,
        teamId: member.team_id,
        position: member.position,
        poolStatus: member.pool_status,
        rosterStatus: member.roster_status,
        rosterConfidence: member.roster_confidence,
        priorBased: member.prior_based,
      }))
      .sort((left, right) => left.fhfhPlayerId - right.fhfhPlayerId),
    transactionCoverage,
  });
  const { data: snapshot, error: snapshotError } = await client.rpc(
    "apply_player_forecast_season_roster_snapshot",
    {
      p_season_id: seasonId,
      p_source: "official_nhl_roster_and_player_landing_consensus",
      p_observed_at: availableAt,
      p_available_at: availableAt,
      p_completeness: completeness,
      p_revision_hash: revisionHash,
      p_source_manifest: [
        ...observationRows.map((row) => ({
          sourceKey: row.source_key,
          sourceHash: row.source_hash,
          sourceUrl: row.source_url,
        })),
        ...officialTransactionCaptures.map((capture) => ({
          sourceKey: `official-transaction-tracker:${capture.url}`,
          sourceHash: capture.sourceHash,
          sourceUrl: capture.url,
        })),
      ],
      p_metadata: {
        officialRosterScope: "organization",
        officialRosterStatusSemantics:
          "unresolved_without_independent_status_evidence",
        officialRosterPlayers: officialPlayers.length,
        mappedOfficialPlayers: mappedOfficialCount,
        landingChecks: landingIds.length,
        landingFailures: landingFailures.map((failure) => ({
          nhlPlayerId: failure.nhlPlayerId,
          error: failure.error,
        })),
        officialTransactionTrackers: officialTransactionCaptures.length,
        officialTransactionAuditError,
        transactionCoverage,
      },
      p_members: members,
    },
  );
  if (snapshotError) throw snapshotError;

  return {
    success: true,
    seasonId,
    capturedAt: availableAt,
    officialRosterPlayers: officialPlayers.length,
    mappedOfficialPlayers: mappedOfficialCount,
    unmappedOfficialPlayers: unmappedOfficial.length,
    landingChecks: landingIds.length,
    landingFailures: landingFailures.length,
    officialTransactionTrackers: officialTransactionCaptures.length,
    officialTransactionAuditError,
    automaticChanges,
    stagedConflicts,
    revisionHash,
    snapshotId: snapshot?.id ?? null,
    rosterFreshAt: availableAt,
    transactionCutoffAt: transactionCoverage.cutoffAt,
    transactionCoverage,
  };
}
