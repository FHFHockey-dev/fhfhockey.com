import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FANTASY_PROJECTION_CONTRACT_CHECKSUM,
  FANTASY_PROJECTION_CONTRACT_VERSION,
  FANTASY_PROJECTION_SUPPORTED_CONTRACTS,
  GOALIE_DERIVED_TARGETS,
  GOALIE_EXPANDED_DERIVED_TARGETS,
  GOALIE_FANTASY_V4_PRIMITIVE_TARGETS,
  GOALIE_PRIMITIVE_TARGETS,
  reconcileProjectionQuantiles,
  reconcileProjectionValues,
  SKATER_DERIVED_TARGETS,
  SKATER_EXPANDED_DERIVED_TARGETS,
  SKATER_FANTASY_V4_PRIMITIVE_TARGETS,
  SKATER_PRIMITIVE_TARGETS,
  type FantasyProjectionPopulation,
  type ProjectionValues,
} from "./contracts";
import { checksumCanonicalJson } from "./evaluator";
import {
  validateSeasonDraft,
  type SeasonDraftPlayer,
  type SeasonValidationIssue,
} from "./validation";

type JsonRecord = Record<string, any>;

const DERIVED_TARGETS = new Set<string>([
  ...SKATER_DERIVED_TARGETS,
  ...GOALIE_DERIVED_TARGETS,
  ...SKATER_EXPANDED_DERIVED_TARGETS,
  ...GOALIE_EXPANDED_DERIVED_TARGETS,
]);
const PRIMITIVE_TARGETS = new Set<string>([
  ...SKATER_PRIMITIVE_TARGETS,
  ...GOALIE_PRIMITIVE_TARGETS,
  ...SKATER_FANTASY_V4_PRIMITIVE_TARGETS,
  ...GOALIE_FANTASY_V4_PRIMITIVE_TARGETS,
]);
const POOL_STATUSES = new Set([
  "verified_active",
  "active_prospect",
  "unsigned_relevant",
  "review_required",
  "excluded",
]);
const POSITIONS = new Set(["C", "L", "R", "D", "G"]);

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function numericRecord(value: unknown): ProjectionValues {
  return Object.fromEntries(
    Object.entries(record(value))
      .map(([key, raw]) => [key, Number(raw)])
      .filter(([, parsed]) => Number.isFinite(parsed)),
  );
}

function populationForPosition(position: string): FantasyProjectionPopulation {
  if (position === "G") return "goalie";
  if (position === "D") return "defense";
  return "forward";
}

function setNested(root: JsonRecord, path: string[], value: unknown): JsonRecord {
  const next = structuredClone(root);
  let cursor = next;
  for (const segment of path.slice(0, -1)) {
    cursor[segment] = record(cursor[segment]);
    cursor = cursor[segment];
  }
  cursor[path[path.length - 1]] = value;
  return next;
}

function getNested(root: JsonRecord, path: string[]): unknown {
  return path.reduce<unknown>(
    (value, segment) => record(value)[segment],
    root,
  );
}

function activeOverrides(rows: any[], now = Date.now()): any[] {
  const superseded = new Set(
    rows.map((row) => row.supersedes_id).filter(Boolean).map(String),
  );
  return rows.filter(
    (row) =>
      !superseded.has(String(row.id)) &&
      (!row.expires_at || new Date(row.expires_at).getTime() > now),
  );
}

export function activePendingPlayerPoolReviews(rows: any[]): any[] {
  return activeOverrides(rows).filter(
    (row) => row.resolution_status === "pending",
  );
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

function validateOverrideValue(fieldPath: string, value: unknown): void {
  if (fieldPath.startsWith("stats.")) {
    const target = fieldPath.slice("stats.".length);
    if (
      !PRIMITIVE_TARGETS.has(target) ||
      DERIVED_TARGETS.has(target) ||
      target === "GAMES_PLAYED" ||
      target === "GAMES_STARTED"
    ) {
      throw new Error("Only primitive raw-hockey totals may be overridden.");
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || (target !== "PLUS_MINUS" && numeric < 0)) {
      throw new Error("Primitive-stat overrides must be finite and nonnegative.");
    }
    return;
  }
  if (fieldPath === "player.teamId") {
    if (!Number.isInteger(Number(value)) || Number(value) <= 0) {
      throw new Error("Projected team must be a valid team id.");
    }
    return;
  }
  if (fieldPath === "player.position") {
    if (!POSITIONS.has(String(value))) throw new Error("Invalid projected position.");
    return;
  }
  if (fieldPath === "player.poolStatus") {
    if (!POOL_STATUSES.has(String(value))) throw new Error("Invalid player-pool status.");
    return;
  }
  if (fieldPath === "expected.games" || fieldPath === "expected.starts") {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 84) {
      throw new Error("Expected games and starts must be within [0,84].");
    }
    return;
  }
  if (fieldPath.startsWith("ratings.")) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
      throw new Error("Ratings must be within [0,100].");
    }
    return;
  }
  if (["toi.evenStrength", "toi.powerPlay", "toi.penaltyKill", "toi.total"].includes(fieldPath)) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      throw new Error("Expected time on ice must be finite and nonnegative.");
    }
    return;
  }
  const probabilityFamily = fieldPath.match(
    /^deployment\.roleProbabilities\.(forwardLine|defensePair|powerPlayUnit|penaltyKillUnit|goalieOrder)$/,
  )?.[1];
  if (probabilityFamily) {
    const distribution = record(value);
    const probabilities = Object.values(distribution).map(Number);
    if (
      probabilities.length === 0 ||
      probabilities.some(
        (probability) =>
          !Number.isFinite(probability) || probability < 0 || probability > 1,
      ) ||
      Math.abs(probabilities.reduce((sum, probability) => sum + probability, 0) - 1) > 1e-6
    ) {
      throw new Error("A role-probability distribution must contain [0,1] values that sum to 1.");
    }
    return;
  }
  const roleField = fieldPath.match(
    /^deployment\.mostLikelyRole\.(forwardLine|defensePair|powerPlayUnit|penaltyKillUnit|goalieOrder)$/,
  )?.[1];
  if (roleField) {
    const maximum = roleField === "forwardLine" ? 4 : roleField === "defensePair" ? 3 : roleField === "goalieOrder" ? 3 : 2;
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > maximum) {
      throw new Error(`${roleField} must be an integer within [1,${maximum}].`);
    }
    return;
  }
  const deploymentShape = {
    "deployment.forwardLines": [4, 3],
    "deployment.defensePairs": [3, 2],
    "deployment.powerPlayUnits": [2, 5],
    "deployment.penaltyKillUnits": [2, 4],
  }[fieldPath];
  if (deploymentShape) {
    const [maximumGroups, maximumMembers] = deploymentShape;
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      value.length > maximumGroups ||
      value.some(
        (group) =>
          !Array.isArray(group) ||
          group.length === 0 ||
          group.length > maximumMembers ||
          group.some((playerId) => !Number.isInteger(Number(playerId)) || Number(playerId) <= 0),
      )
    ) {
      throw new Error(`${fieldPath} must be a bounded array of positive player-id arrays.`);
    }
    return;
  }
  if (fieldPath === "deployment.goalieOrder") {
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      value.length > 3 ||
      value.some((playerId) => !Number.isInteger(Number(playerId)) || Number(playerId) <= 0)
    ) {
      throw new Error("Goalie order must contain one to three positive player ids.");
    }
    return;
  }
  throw new Error("Unsupported projection override field.");
}

function playerBaseValue(row: any, fieldPath: string): unknown {
  if (fieldPath.startsWith("stats.")) {
    return record(row.model_means)[fieldPath.slice("stats.".length)];
  }
  const [group, ...path] = fieldPath.split(".");
  if (group === "player") {
    if (path[0] === "teamId") return row.team_id;
    if (path[0] === "position") return row.position;
    if (path[0] === "poolStatus") return row.pool_status;
  }
  if (group === "expected") {
    return path[0] === "starts" ? row.expected_starts : row.expected_games;
  }
  if (group === "ratings") return getNested(record(row.ratings), path);
  if (group === "toi") return getNested(record(row.expected_toi), path);
  if (group === "deployment") return getNested(record(row.deployment), path);
  return null;
}

function teamBaseValue(row: any, fieldPath: string): unknown {
  const [group, ...path] = fieldPath.split(".");
  if (group === "ratings") return getNested(record(row.ratings), path);
  if (group === "deployment") return getNested(record(row.deployment), path);
  return null;
}

function effectivePlayer(row: any, overrides: any[]): any {
  let teamId = row.team_id == null ? null : Number(row.team_id);
  let position = String(row.position);
  let poolStatus = String(row.pool_status);
  let expectedGames = Number(row.expected_games);
  let expectedStarts =
    row.expected_starts == null ? null : Number(row.expected_starts);
  let expectedToi = numericRecord(row.expected_toi);
  let ratings = record(row.ratings);
  let deployment = record(row.deployment);
  const baseValues = reconcileProjectionValues(
    numericRecord(row.model_means),
    row.population,
  );
  let publishedValues = { ...baseValues };
  const primitiveDeltas: ProjectionValues = {};

  for (const override of overrides) {
    const value = override.override_value;
    const fieldPath = String(override.field_path);
    if (fieldPath.startsWith("stats.")) {
      const target = fieldPath.slice("stats.".length);
      primitiveDeltas[target] = Number(value) - Number(baseValues[target] ?? 0);
      publishedValues[target] = Number(value);
    } else if (fieldPath === "player.teamId") {
      teamId = Number(value);
    } else if (fieldPath === "player.position") {
      position = String(value);
    } else if (fieldPath === "player.poolStatus") {
      poolStatus = String(value);
    } else if (fieldPath === "expected.games") {
      expectedGames = Number(value);
    } else if (fieldPath === "expected.starts") {
      expectedStarts = Number(value);
    } else if (fieldPath.startsWith("ratings.")) {
      ratings = setNested(ratings, fieldPath.split(".").slice(1), Number(value));
    } else if (fieldPath.startsWith("toi.")) {
      expectedToi = setNested(
        expectedToi,
        fieldPath.split(".").slice(1),
        Number(value),
      ) as ProjectionValues;
    } else if (fieldPath.startsWith("deployment.")) {
      deployment = setNested(
        deployment,
        fieldPath.split(".").slice(1),
        value,
      );
    }
  }

  const population = populationForPosition(position);
  publishedValues.GAMES_PLAYED = expectedGames;
  if (population === "goalie" && expectedStarts != null) {
    publishedValues.GAMES_STARTED = expectedStarts;
  }
  publishedValues = reconcileProjectionValues(publishedValues, population);
  const p10 = numericRecord(row.p10);
  const p50 = numericRecord(row.p50);
  const p90 = numericRecord(row.p90);
  for (const [target, delta] of Object.entries(primitiveDeltas)) {
    p10[target] = Math.max(target === "PLUS_MINUS" ? -Infinity : 0, (p10[target] ?? 0) + delta);
    p50[target] = Math.max(target === "PLUS_MINUS" ? -Infinity : 0, (p50[target] ?? 0) + delta);
    p90[target] = Math.max(p50[target], (p90[target] ?? 0) + delta);
  }
  const {
    p10: effectiveP10,
    p50: effectiveP50,
    p90: effectiveP90,
  } = reconcileProjectionQuantiles({ p10, p50, p90 }, population);
  const adjustmentDelta = Object.fromEntries(
    Object.keys(publishedValues)
      .map((target) => [
        target,
        Number(publishedValues[target] ?? 0) - Number(baseValues[target] ?? 0),
      ])
      .filter(([, delta]) => Math.abs(Number(delta)) > 1e-9),
  );

  return {
    fhfh_player_id: Number(row.fhfh_player_id),
    team_id: teamId,
    player_name: String(row.player_name),
    position,
    population,
    pool_status: poolStatus,
    roster_status: String(row.roster_status ?? "unresolved"),
    roster_confidence: Number(row.roster_confidence),
    source_fresh_at: row.source_fresh_at ?? null,
    rookie_profile: record(row.rookie_profile),
    expected_games: expectedGames,
    expected_starts: population === "goalie" ? expectedStarts : null,
    expected_toi: expectedToi,
    ratings,
    deployment,
    base_values: baseValues,
    published_values: publishedValues,
    p10: effectiveP10,
    p50: effectiveP50,
    p90: effectiveP90,
    adjustment_delta: adjustmentDelta,
    adjusted: overrides.length > 0,
    provenance: record(row.provenance),
    fallback_flags: Array.isArray(row.fallback_flags) ? row.fallback_flags : [],
    component_manifest: Array.isArray(row.component_manifest)
      ? row.component_manifest
      : [],
  };
}

function effectiveTeam(row: any, overrides: any[]): any {
  const baseRatings = record(row.ratings);
  const baseValues = numericRecord(row.model_means);
  let publishedRatings = structuredClone(baseRatings);
  let publishedValues = structuredClone(baseValues);
  let p10 = numericRecord(row.p10);
  let p50 = numericRecord(row.p50);
  let p90 = numericRecord(row.p90);
  let deployment = record(row.deployment);
  for (const override of overrides) {
    const fieldPath = String(override.field_path);
    if (fieldPath.startsWith("ratings.")) {
      publishedRatings = setNested(
        publishedRatings,
        fieldPath.split(".").slice(1),
        Number(override.override_value),
      );
    } else if (fieldPath.startsWith("deployment.")) {
      deployment = setNested(
        deployment,
        fieldPath.split(".").slice(1),
        override.override_value,
      );
    } else if (fieldPath.startsWith("values.")) {
      const target = fieldPath.split(".")[1];
      const overrideValue = Number(override.override_value);
      if (target && Number.isFinite(overrideValue)) {
        const delta = overrideValue - Number(baseValues[target] ?? 0);
        publishedValues[target] = Math.max(0, overrideValue);
        p10[target] = Math.max(0, Number(p10[target] ?? 0) + delta);
        p50[target] = Math.max(0, Number(p50[target] ?? 0) + delta);
        p90[target] = Math.max(0, Number(p90[target] ?? 0) + delta);
      }
    }
  }
  const ratingDelta = Object.fromEntries(
    Object.keys(publishedRatings)
      .map((key) => [
        key,
        Number(publishedRatings[key] ?? 0) - Number(baseRatings[key] ?? 0),
      ])
      .filter(([, delta]) => Number.isFinite(Number(delta)) && Math.abs(Number(delta)) > 1e-9),
  );
  const valueDelta = Object.fromEntries(
    Object.keys(publishedValues)
      .map((key) => [key, Number(publishedValues[key] ?? 0) - Number(baseValues[key] ?? 0)])
      .filter(([, delta]) => Number.isFinite(Number(delta)) && Math.abs(Number(delta)) > 1e-9),
  );
  return {
    team_id: Number(row.team_id),
    team_name: String(row.team_name),
    abbreviation: String(row.abbreviation),
    base_ratings: baseRatings,
    published_ratings: publishedRatings,
    deployment,
    roster_counts: record(row.roster_counts),
    base_values: baseValues,
    published_values: publishedValues,
    p10,
    p50,
    p90,
    adjustment_delta: { ...ratingDelta, ...valueDelta },
    adjusted: overrides.length > 0,
    confidence: Number(row.confidence),
    provenance: record(row.provenance),
  };
}

async function effectiveRunRows(
  supabase: SupabaseClient<any>,
  runId: string,
  teamId?: number | null,
): Promise<{ players: any[]; teams: any[]; overrides: any[] }> {
  const client = supabase as any;
  const [playerRows, teamRows, overrideRows] = await Promise.all([
    teamId === null
      ? Promise.resolve([])
      : selectAll(
          client,
          "player_forecast_season_player_aggregates",
          "*",
          (query) => {
            const scoped = query.eq("run_id", runId);
            return (teamId == null ? scoped : scoped.eq("team_id", teamId))
              .order("fhfh_player_id");
          },
        ),
    selectAll(
      client,
      "player_forecast_season_team_aggregates",
      "*",
      (query) => query.eq("run_id", runId).order("team_id"),
    ),
    selectAll(
      client,
      "player_forecast_season_overrides",
      "*",
      (query) => query.eq("run_id", runId).order("created_at"),
    ),
  ]);
  const overrides = activeOverrides(overrideRows);
  const byPlayer = new Map<number, any[]>();
  const byTeam = new Map<number, any[]>();
  for (const override of overrides) {
    if (override.scope_type === "player") {
      const id = Number(override.fhfh_player_id);
      byPlayer.set(id, [...(byPlayer.get(id) ?? []), override]);
    } else {
      const id = Number(override.team_id);
      byTeam.set(id, [...(byTeam.get(id) ?? []), override]);
    }
  }
  return {
    players: playerRows.map((row) =>
      effectivePlayer(row, byPlayer.get(Number(row.fhfh_player_id)) ?? []),
    ),
    teams: teamRows.map((row) =>
      effectiveTeam(row, byTeam.get(Number(row.team_id)) ?? []),
    ),
    overrides,
  };
}

export async function loadSeasonEditorWorkspace(
  supabase: SupabaseClient<any>,
  seasonId: number,
  teamId: number | null = null,
): Promise<Record<string, unknown>> {
  const client = supabase as any;
  const [
    { data: runs, error: runsError },
    { data: releases, error: releaseError },
    { data: queue, error: queueError },
    { data: conflicts, error: conflictsError },
    { data: playerPoolReview, error: playerPoolReviewError },
    { data: rosterObservations, error: rosterObservationsError },
    { data: rosterSnapshots, error: rosterSnapshotsError },
  ] =
    await Promise.all([
      client
        .from("player_forecast_season_runs")
        .select("id,view_key,run_kind,status,cutoff_at,hold_reason_code,validation_receipt,contract_version,contract_checksum,created_at")
        .eq("season_id", seasonId)
        .order("created_at", { ascending: false })
        .limit(30),
      client
        .from("player_forecast_season_releases")
        .select("id,view_key,release_number,release_label,issued_at,release_hash,metric_set_version,roster_observed_at,transaction_cutoff_at,health_status,health_summary")
        .eq("season_id", seasonId)
        .order("issued_at", { ascending: false })
        .limit(30),
      client
        .from("player_forecast_season_queue")
        .select("id,scope_key,status,reasons,not_before,attempt_count,last_error_code")
        .eq("season_id", seasonId)
        .order("not_before", { ascending: true })
        .limit(100),
      client
        .from("player_forecast_season_roster_conflicts")
        .select("id,conflict_key,conflict_type,summary,detected_at,fhfh_player_id,nhl_player_id,candidate_team_ids,player_forecast_season_roster_conflict_resolutions(id)")
        .eq("season_id", seasonId)
        .order("detected_at", { ascending: false })
        .limit(50),
      client
        .from("player_forecast_season_player_pool_review")
        .select("*")
        .eq("season_id", seasonId)
        .order("created_at", { ascending: false })
        .limit(200),
      client
        .from("player_forecast_season_roster_observations")
        .select("id,fhfh_player_id,nhl_player_id,raw_player_name,observation_kind,event_type,organization_team_id,roster_status,source_key,source_url,observed_at,available_at,effective_at,confidence,supersedes_id")
        .eq("season_id", seasonId)
        .order("available_at", { ascending: false })
        .limit(200),
      client
        .from("player_forecast_season_roster_snapshots")
        .select("id,observed_at,available_at,completeness,revision_hash,metadata,created_at")
        .eq("season_id", seasonId)
        .order("available_at", { ascending: false })
        .limit(5),
    ]);
  if (runsError) throw runsError;
  if (releaseError) throw releaseError;
  if (queueError) throw queueError;
  if (conflictsError) throw conflictsError;
  if (playerPoolReviewError) throw playerPoolReviewError;
  if (rosterObservationsError) throw rosterObservationsError;
  if (rosterSnapshotsError) throw rosterSnapshotsError;

  const activeConflicts = (conflicts ?? []).filter(
    (conflict: any) =>
      (conflict.player_forecast_season_roster_conflict_resolutions ?? []).length === 0,
  );
  const conflictPlayerIds = Array.from(new Set(
    activeConflicts.map((conflict: any) => Number(conflict.fhfh_player_id)).filter(Number.isFinite),
  ));
  const conflictIds = activeConflicts.map((conflict: any) => String(conflict.id));
  const [identityRows, teamRows, conflictMembers] = await Promise.all([
    conflictPlayerIds.length
      ? selectAll(client, "fhfh_player_identities", "id,canonical_name,current_nhl_team_id", (query) =>
          query.in("id", conflictPlayerIds))
      : Promise.resolve([]),
    selectAll(client, "teams", "id,name,abbreviation", (query) => query.order("id")),
    conflictIds.length
      ? selectAll(
          client,
          "player_forecast_season_roster_conflict_members",
          "conflict_id,observation_id",
          (query) => query.in("conflict_id", conflictIds),
        )
      : Promise.resolve([]),
  ]);
  const conflictObservationIds = Array.from(new Set(
    conflictMembers.map((member: any) => String(member.observation_id)),
  ));
  const conflictEvidence = conflictObservationIds.length
    ? await selectAll(
        client,
        "player_forecast_season_roster_observations",
        "id,observation_kind,event_type,organization_team_id,roster_status,source_url,available_at,confidence",
        (query) => query.in("id", conflictObservationIds),
      )
    : [];
  const identityById = new Map(identityRows.map((row: any) => [Number(row.id), row]));
  const teamById = new Map(teamRows.map((row: any) => [Number(row.id), row]));
  const evidenceById = new Map(conflictEvidence.map((row: any) => [String(row.id), row]));
  const membersByConflict = new Map<string, any[]>();
  for (const member of conflictMembers) {
    const evidence = evidenceById.get(String(member.observation_id));
    if (!evidence) continue;
    const conflictId = String(member.conflict_id);
    membersByConflict.set(conflictId, [
      ...(membersByConflict.get(conflictId) ?? []),
      {
        ...evidence,
        organization: evidence.organization_team_id == null
          ? null
          : teamById.get(Number(evidence.organization_team_id)) ?? null,
      },
    ]);
  }

  const latestRunId = runs?.[0]?.id;
  const playerCountResult = latestRunId
    ? await client
        .from("player_forecast_season_player_aggregates")
        .select("id", { count: "exact", head: true })
        .eq("run_id", latestRunId)
    : { count: 0, error: null };
  if (playerCountResult.error) throw playerCountResult.error;
  const effective = latestRunId
    ? await effectiveRunRows(supabase, latestRunId, teamId)
    : { players: [], teams: [], overrides: [] };
  return {
    success: true,
    seasonId,
    contract: {
      version: FANTASY_PROJECTION_CONTRACT_VERSION,
      checksum: FANTASY_PROJECTION_CONTRACT_CHECKSUM,
      supported: FANTASY_PROJECTION_SUPPORTED_CONTRACTS,
    },
    runs: runs ?? [],
    releases: releases ?? [],
    queue: queue ?? [],
    conflicts: activeConflicts.map((conflict: any) => {
      const identity = identityById.get(Number(conflict.fhfh_player_id));
      return {
        ...conflict,
        player_name: identity?.canonical_name ?? `NHL ${conflict.nhl_player_id}`,
        current_team: identity?.current_nhl_team_id == null
          ? null
          : teamById.get(Number(identity.current_nhl_team_id)) ?? null,
        candidate_teams: (conflict.candidate_team_ids ?? []).map(
          (candidateTeamId: number) => teamById.get(Number(candidateTeamId)) ?? {
            id: Number(candidateTeamId),
            name: `Team ${candidateTeamId}`,
            abbreviation: String(candidateTeamId),
          },
        ),
        evidence: membersByConflict.get(String(conflict.id)) ?? [],
      };
    }),
    rosterIntegrity: {
      latestSnapshot: rosterSnapshots?.[0] ?? null,
      recentObservations: rosterObservations ?? [],
      rosterFreshAt: (rosterObservations ?? []).reduce(
        (latest: string | null, observation: any) =>
          !latest || String(observation.available_at) > latest
            ? String(observation.available_at)
            : latest,
        null,
      ),
      transactionCutoffAt: (rosterObservations ?? [])
        .filter((observation: any) =>
          ["official_transaction", "trusted_ifttt"].includes(
            observation.observation_kind,
          ),
        )
        .reduce(
          (latest: string | null, observation: any) =>
            !latest || String(observation.available_at) > latest
              ? String(observation.available_at)
              : latest,
          null,
        ),
      transactionCoverage:
        {
          ...(rosterSnapshots?.[0]?.metadata?.transactionCoverage ?? {
            windowStart: "2026-06-16T00:00:00Z",
            cutoffAt: null,
            complete: false,
            status: "missing",
            holdReason: "A complete official transaction audit has not been imported.",
          }),
          stale:
            !rosterSnapshots?.[0]?.metadata?.transactionCoverage?.cutoffAt ||
            Date.now() - Date.parse(
              String(rosterSnapshots[0].metadata.transactionCoverage.cutoffAt),
            ) > 36 * 60 * 60 * 1000,
        },
      openConflictCount: (conflicts ?? []).filter(
        (conflict: any) =>
          (conflict.player_forecast_season_roster_conflict_resolutions ?? []).length === 0,
      ).length,
    },
    playerPoolReview: activePendingPlayerPoolReviews(playerPoolReview ?? []),
    draft: latestRunId
      ? {
          runId: latestRunId,
          playerCount: playerCountResult.count ?? 0,
          selectedTeamId: teamId,
          players: effective.players,
          teams: effective.teams,
          overrides: effective.overrides,
        }
      : null,
  };
}

export async function cloneSeasonDraft(
  supabase: SupabaseClient<any>,
  sourceRunId: string,
): Promise<any> {
  const { data, error } = await (supabase as any).rpc(
    "clone_player_forecast_season_run",
    {
      p_source_run_id: sourceRunId,
      p_idempotency_key: `season-editorial:${sourceRunId}:${randomUUID()}`,
    },
  );
  if (error) throw error;
  const cloned = Array.isArray(data) ? data[0] : data;
  if (cloned?.id) {
    const { error: lineageError } = await (supabase as any)
      .from("player_forecast_season_runs")
      .update({ source_run_id: sourceRunId })
      .eq("id", cloned.id)
      .is("source_run_id", null);
    if (lineageError) throw lineageError;
  }
  return data;
}

export async function createSeasonOverride(args: {
  supabase: SupabaseClient<any>;
  editorUserId: string;
  runId: string;
  scopeType: "player" | "team";
  fhfhPlayerId?: number | null;
  teamId?: number | null;
  fieldPath: string;
  overrideValue: unknown;
  reason: string;
  expiresAt?: string | null;
  supersedesId?: string | null;
}): Promise<any> {
  validateOverrideValue(args.fieldPath, args.overrideValue);
  if (!args.reason.trim()) throw new Error("An editorial reason is required.");
  const client = args.supabase as any;
  const { data: run, error: runError } = await client
    .from("player_forecast_season_runs")
    .select("id,season_id,status")
    .eq("id", args.runId)
    .maybeSingle();
  if (runError) throw runError;
  if (!run || run.status !== "draft") {
    throw new Error("Overrides require a complete draft that has not been validated.");
  }

  const targetTable =
    args.scopeType === "player"
      ? "player_forecast_season_player_aggregates"
      : "player_forecast_season_team_aggregates";
  let targetQuery = client.from(targetTable).select("*").eq("run_id", args.runId);
  targetQuery =
    args.scopeType === "player"
      ? targetQuery.eq("fhfh_player_id", args.fhfhPlayerId)
      : targetQuery.eq("team_id", args.teamId);
  const { data: target, error: targetError } = await targetQuery.maybeSingle();
  if (targetError) throw targetError;
  if (!target) throw new Error("Projection override target was not found.");

  if (args.supersedesId) {
    const { data: previous, error: previousError } = await client
      .from("player_forecast_season_overrides")
      .select("id,run_id,scope_type,fhfh_player_id,team_id,field_path")
      .eq("id", args.supersedesId)
      .maybeSingle();
    if (previousError) throw previousError;
    if (
      !previous ||
      previous.run_id !== args.runId ||
      previous.scope_type !== args.scopeType ||
      previous.field_path !== args.fieldPath ||
      Number(previous.fhfh_player_id ?? 0) !== Number(args.fhfhPlayerId ?? 0) ||
      Number(previous.team_id ?? 0) !== Number(args.teamId ?? 0)
    ) {
      throw new Error("Superseded override does not match this target and field.");
    }
  }

  const baseValue =
    args.scopeType === "player"
      ? playerBaseValue(target, args.fieldPath)
      : teamBaseValue(target, args.fieldPath);
  const { data, error } = await client
    .from("player_forecast_season_overrides")
    .insert({
      season_id: run.season_id,
      run_id: args.runId,
      scope_type: args.scopeType,
      fhfh_player_id:
        args.scopeType === "player" ? Number(args.fhfhPlayerId) : null,
      team_id: args.scopeType === "team" ? Number(args.teamId) : null,
      field_path: args.fieldPath,
      base_value: baseValue ?? null,
      override_value: args.overrideValue,
      reason: args.reason.trim(),
      expires_at: args.expiresAt ?? null,
      supersedes_id: args.supersedesId ?? null,
      created_by: args.editorUserId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function enqueueSeasonRerun(args: {
  supabase: SupabaseClient<any>;
  seasonId: number;
  teamId?: number | null;
  fhfhPlayerId?: number | null;
  reason: string;
}): Promise<any> {
  const teamPart = args.teamId ? `:team:${args.teamId}` : "";
  const playerPart = args.fhfhPlayerId ? `:player:${args.fhfhPlayerId}` : "";
  const now = new Date().toISOString();
  const results = await Promise.all(
    (["current", "ros"] as const).map(async (view) => {
      const { data, error } = await (args.supabase as any).rpc(
        "enqueue_player_forecast_season_job",
        {
          p_scope_key: `season:${args.seasonId}:view:${view}${teamPart}${playerPart}:manual`,
          p_season_id: args.seasonId,
          p_view_key: view,
          p_team_id: args.teamId ?? null,
          p_opponent_team_id: null,
          p_fhfh_player_id: args.fhfhPlayerId ?? null,
          p_reason: args.reason,
          p_source_high_watermark: now,
          p_not_before: now,
          p_metadata: { requestedBy: "season_editor" },
        },
      );
      if (error) throw error;
      return data;
    }),
  );
  return results;
}

export async function resolveSeasonRosterConflict(args: {
  supabase: SupabaseClient<any>;
  editorUserId: string;
  conflictId: string;
  action: "select_team" | "mark_unsigned" | "retain_current" | "exclude_evidence";
  organizationTeamId?: number | null;
  rosterStatus?:
    | "active_nhl"
    | "injured_nhl"
    | "affiliate"
    | "prospect_reserve"
    | "unsigned"
    | "unresolved";
  reason: string;
}): Promise<any> {
  if (!args.reason.trim()) throw new Error("A roster-conflict resolution reason is required.");
  const client = args.supabase as any;
  const { data: conflict, error: conflictError } = await client
    .from("player_forecast_season_roster_conflicts")
    .select("id,season_id,fhfh_player_id,nhl_player_id")
    .eq("id", args.conflictId)
    .maybeSingle();
  if (conflictError) throw conflictError;
  if (!conflict) throw new Error("Roster conflict was not found.");

  const { data: latestSnapshot, error: snapshotError } = await client
    .from("player_forecast_season_roster_snapshots")
    .select("id")
    .eq("season_id", conflict.season_id)
    .order("available_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snapshotError) throw snapshotError;
  const { data: currentMember, error: memberError } = latestSnapshot
    ? await client
        .from("player_forecast_season_roster_members")
        .select("team_id,roster_status")
        .eq("snapshot_id", latestSnapshot.id)
        .eq("fhfh_player_id", conflict.fhfh_player_id)
        .maybeSingle()
    : { data: null, error: null };
  if (memberError) throw memberError;

  let organizationTeamId = currentMember?.team_id ?? null;
  let rosterStatus = currentMember?.roster_status ?? "unresolved";
  if (args.action === "select_team") {
    if (!Number.isInteger(Number(args.organizationTeamId)) || Number(args.organizationTeamId) <= 0) {
      throw new Error("Selecting a team requires a valid organization team id.");
    }
    organizationTeamId = Number(args.organizationTeamId);
    rosterStatus = args.rosterStatus ?? "active_nhl";
  } else if (args.action === "mark_unsigned") {
    organizationTeamId = null;
    rosterStatus = "unsigned";
  }

  const { data: priorResolutions, error: priorError } = await client
    .from("player_forecast_season_roster_conflict_resolutions")
    .select("id,supersedes_id,created_at")
    .eq("conflict_id", conflict.id)
    .order("created_at", { ascending: false });
  if (priorError) throw priorError;
  const superseded = new Set(
    (priorResolutions ?? []).map((resolution: any) => resolution.supersedes_id).filter(Boolean),
  );
  const activePrior = (priorResolutions ?? []).find(
    (resolution: any) => !superseded.has(resolution.id),
  );
  const { data, error } = await client
    .from("player_forecast_season_roster_conflict_resolutions")
    .insert({
      conflict_id: conflict.id,
      resolution_action: args.action,
      organization_team_id: organizationTeamId,
      roster_status: rosterStatus,
      reason: args.reason.trim(),
      created_by: args.editorUserId,
      supersedes_id: activePrior?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function validateSeasonRun(
  supabase: SupabaseClient<any>,
  runId: string,
  options: { ignoreQueueIds?: readonly string[] } = {},
): Promise<{ valid: boolean; issues: SeasonValidationIssue[]; receipt: JsonRecord }> {
  const client = supabase as any;
  const { data: run, error: runError } = await client
    .from("player_forecast_season_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (runError) throw runError;
  if (!run) throw new Error("Season run was not found.");
  if (!["draft", "validated"].includes(run.status)) {
    throw new Error("Only draft or validated runs may be checked.");
  }

  const { players, teams } = await effectiveRunRows(supabase, runId);
  const [scheduleGames, waiverRows, queueRows, poolReviewRows] = await Promise.all([
    selectAll(
      client,
      "player_forecast_season_schedule_games",
      "game_id,home_team_id,away_team_id,scheduled_start_at,game_status",
      (query) => query.eq("snapshot_id", run.schedule_snapshot_id),
    ),
    selectAll(
      client,
      "player_forecast_season_completeness_waivers",
      "id,team_id,expires_at,supersedes_id",
      (query) => query.eq("roster_snapshot_id", run.roster_snapshot_id),
    ),
    selectAll(
      client,
      "player_forecast_season_queue",
      "id,status,team_id,fhfh_player_id",
      (query) =>
        query
          .eq("season_id", run.season_id)
          .eq("view_key", run.view_key)
          .in("status", ["pending", "running", "failed"]),
    ),
    selectAll(
      client,
      "player_forecast_season_player_pool_review",
      "id,nhl_player_id,resolution_status,mapped_fhfh_player_id,supersedes_id",
      (query) => query.eq("season_id", run.season_id),
    ),
  ]);

  const gamesPerTeam: Record<string, number> = {};
  for (const game of scheduleGames) {
    gamesPerTeam[String(game.home_team_id)] =
      (gamesPerTeam[String(game.home_team_id)] ?? 0) + 1;
    gamesPerTeam[String(game.away_team_id)] =
      (gamesPerTeam[String(game.away_team_id)] ?? 0) + 1;
  }
  const rosterCounts: Record<
    string,
    { forwards: number; defensemen: number; goalies: number }
  > = {};
  for (const player of players.filter((row) => row.pool_status !== "excluded" && row.team_id != null)) {
    const counts = (rosterCounts[String(player.team_id)] ??= {
      forwards: 0,
      defensemen: 0,
      goalies: 0,
    });
    if (player.position === "G") counts.goalies += 1;
    else if (player.position === "D") counts.defensemen += 1;
    else counts.forwards += 1;
  }
  const waivedTeamIds = activeOverrides(waiverRows).map((row) => Number(row.team_id));
  const draftPlayers: SeasonDraftPlayer[] = players
    .filter((row) => row.pool_status !== "excluded")
    .map((row) => ({
      fhfhPlayerId: row.fhfh_player_id,
      teamId: row.team_id,
      population: row.population,
      expectedGames: row.expected_games,
      expectedStarts: row.expected_starts,
      modelValues: row.base_values,
      publishedValues: row.published_values,
      p10: row.p10,
      p50: row.p50,
      p90: row.p90,
      deployment: row.deployment,
    }));
  const issues = validateSeasonDraft({
    contractVersion: run.contract_version,
    contractChecksum: run.contract_checksum,
    scheduleGameCount: scheduleGames.length,
    gamesPerTeam,
    rosterCounts,
    waivedTeamIds,
    players: draftPlayers,
  });

  for (const player of players) {
    if (player.pool_status === "review_required") {
      issues.push({
        code: "player_pool_review_required",
        fhfhPlayerId: player.fhfh_player_id,
        message: "Player-pool review must be resolved before publication.",
      });
    }
    const remainingGames = scheduleGames.filter(
      (game) =>
        new Date(game.scheduled_start_at).getTime() > new Date(run.cutoff_at).getTime() &&
        game.game_status !== "cancelled" &&
        (Number(game.home_team_id) === player.team_id ||
          Number(game.away_team_id) === player.team_id),
    ).length;
    if (player.component_manifest.length !== remainingGames) {
      issues.push({
        code: "component_manifest_incomplete",
        fhfhPlayerId: player.fhfh_player_id,
        message: `Expected ${remainingGames} remaining-game components; found ${player.component_manifest.length}.`,
      });
    }
  }
  if (teams.length !== 32) {
    issues.push({
      code: "team_aggregates_incomplete",
      message: `Expected 32 team aggregates; found ${teams.length}.`,
    });
  }
  const ignoredQueueIds = new Set(options.ignoreQueueIds ?? []);
  const blockingQueueRows = queueRows.filter(
    (row) => !ignoredQueueIds.has(String(row.id)),
  );
  if (blockingQueueRows.length > 0) {
    issues.push({
      code: "dirty_queue",
      message: `${blockingQueueRows.length} dirty or failed incremental jobs must clear before publication.`,
    });
  }
  const activePoolRows = activeOverrides(poolReviewRows);
  const unresolvedPoolRows = activePoolRows.filter(
    (row) => row.resolution_status === "pending",
  );
  if (unresolvedPoolRows.length > 0) {
    issues.push({
      code: "player_pool_identity_review",
      message: `${unresolvedPoolRows.length} official-roster identities require mapping or an explicit exclusion.`,
    });
  }
  const projectedPlayerIds = new Set(players.map((row) => Number(row.fhfh_player_id)));
  for (const row of activePoolRows.filter((review) => review.resolution_status === "mapped")) {
    if (!projectedPlayerIds.has(Number(row.mapped_fhfh_player_id))) {
      issues.push({
        code: "mapped_player_projection_missing",
        fhfhPlayerId: Number(row.mapped_fhfh_player_id),
        message: `Mapped official-roster player ${row.nhl_player_id} requires a regenerated projection before publication.`,
      });
    }
  }

  const receipt = {
    contractVersion: run.contract_version,
    contractChecksum: run.contract_checksum,
    checkedAt: new Date().toISOString(),
    runId,
    playerCount: draftPlayers.length,
    teamCount: teams.length,
    scheduleGameCount: scheduleGames.length,
    ignoredClaimedQueueJobs: queueRows.length - blockingQueueRows.length,
    issueCount: issues.length,
    issueCodes: Array.from(new Set(issues.map((issue) => issue.code))).sort(),
    effectiveOutputHash: checksumCanonicalJson({
      players: players.filter((row) => row.pool_status !== "excluded"),
      teams,
    }),
  };
  if (issues.length === 0 && run.status !== "validated") {
    const { error } = await client
      .from("player_forecast_season_runs")
      .update({
        status: "validated",
        validation_receipt: receipt,
        completed_at: receipt.checkedAt,
      })
      .eq("id", runId)
      .eq("status", "draft");
    if (error) throw error;
  }
  return { valid: issues.length === 0, issues, receipt };
}

export async function publishSeasonRun(args: {
  supabase: SupabaseClient<any>;
  editorUserId: string;
  runId: string;
  label: string;
  reason: string;
}): Promise<any> {
  const client = args.supabase as any;
  const { data: run, error: runError } = await client
    .from("player_forecast_season_runs")
    .select("id,status,validation_receipt")
    .eq("id", args.runId)
    .maybeSingle();
  if (runError) throw runError;
  if (!run || run.status !== "validated" || !run.validation_receipt) {
    throw new Error("A successful validation receipt is required before publication.");
  }
  const { players, teams } = await effectiveRunRows(args.supabase, args.runId);
  const publishablePlayers = players
    .filter((row) => row.pool_status !== "excluded")
    .map(({ component_manifest: _componentManifest, ...row }) => row);
  const releaseHash = checksumCanonicalJson({
    runId: args.runId,
    validationReceipt: run.validation_receipt,
    players: publishablePlayers,
    teams,
  });
  const { data, error } = await client.rpc(
    "publish_player_forecast_season_release_atomic",
    {
      p_run_id: args.runId,
      p_release_label: args.label,
      p_release_hash: releaseHash,
      p_validation_receipt: run.validation_receipt,
      p_player_rows: publishablePlayers,
      p_team_rows: teams,
      p_actor_kind: "editor",
      p_actor_user_id: args.editorUserId,
      p_reason: args.reason,
    },
  );
  if (error) throw error;
  return data;
}

export async function publishSeasonRunAsSystem(args: {
  supabase: SupabaseClient<any>;
  runId: string;
  label: string;
  reason: string;
}): Promise<any> {
  const client = args.supabase as any;
  const { data: run, error: runError } = await client
    .from("player_forecast_season_runs")
    .select("id,status,validation_receipt")
    .eq("id", args.runId)
    .maybeSingle();
  if (runError) throw runError;
  if (!run || run.status !== "validated" || !run.validation_receipt) {
    throw new Error("A successful validation receipt is required before publication.");
  }
  const { players, teams } = await effectiveRunRows(args.supabase, args.runId);
  const publishablePlayers = players
    .filter((row) => row.pool_status !== "excluded")
    .map(({ component_manifest: _componentManifest, ...row }) => row);
  const releaseHash = checksumCanonicalJson({
    runId: args.runId,
    validationReceipt: run.validation_receipt,
    players: publishablePlayers,
    teams,
  });
  const { data, error } = await client.rpc(
    "publish_player_forecast_season_release_atomic",
    {
      p_run_id: args.runId,
      p_release_label: args.label,
      p_release_hash: releaseHash,
      p_validation_receipt: run.validation_receipt,
      p_player_rows: publishablePlayers,
      p_team_rows: teams,
      p_actor_kind: "system",
      p_actor_user_id: null,
      p_reason: args.reason,
    },
  );
  if (error) throw error;
  return data;
}

export async function rollbackSeasonRelease(args: {
  supabase: SupabaseClient<any>;
  editorUserId: string;
  releaseId: string;
  reason: string;
}): Promise<any> {
  const { data, error } = await (args.supabase as any).rpc(
    "rollback_player_forecast_season_release_atomic",
    {
      p_release_id: args.releaseId,
      p_actor_user_id: args.editorUserId,
      p_reason: args.reason,
    },
  );
  if (error) throw error;
  return data;
}
