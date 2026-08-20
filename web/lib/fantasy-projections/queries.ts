import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FANTASY_PROJECTION_BETA_LABEL,
  FANTASY_PROJECTION_SUMMARY_ENCODING,
  FANTASY_PROJECTION_SUPPORTED_CONTRACTS,
  type FantasyProjectionCompactPlayersResponse,
  type FantasyProjectionPlayer,
  type FantasyProjectionPlayerSummaryTuple,
  type FantasyProjectionPopulation,
  type FantasyProjectionRelease,
  type FantasyProjectionTeam,
  type FantasyProjectionView,
  type ProjectionValues,
} from "./contracts";

export class FantasyProjectionReleaseNotFoundError extends Error {
  constructor() {
    super("No published fantasy-projection release exists for this selection.");
    this.name = "FantasyProjectionReleaseNotFoundError";
  }
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function numberRecord(value: unknown): ProjectionValues {
  return Object.fromEntries(
    Object.entries(record(value))
      .map(([key, raw]) => [key, Number(raw)])
      .filter(([, parsed]) => Number.isFinite(parsed)),
  );
}

function summaryNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(4)) : 0;
}

function publicProvenance(value: unknown): Record<string, unknown> {
  const blocked = /(note|editor|user|actor|reason|email|token|internal)/i;
  return Object.fromEntries(
    Object.entries(record(value))
      .filter(([key]) => !blocked.test(key))
      .map(([key, child]) => [
        key,
        child && typeof child === "object" && !Array.isArray(child)
          ? publicProvenance(child)
          : child,
      ]),
  );
}

export function releaseMatchesPublicContract(row: Record<string, any>): boolean {
  return FANTASY_PROJECTION_SUPPORTED_CONTRACTS[String(row.contract_version)] ===
    String(row.contract_checksum);
}

function mapRelease(row: Record<string, any>, active: boolean): FantasyProjectionRelease {
  if (!releaseMatchesPublicContract(row)) {
    throw new Error("PLAYER_FORECAST_SEASON_PUBLIC_CONTRACT_MISMATCH");
  }
  return {
    id: String(row.id),
    seasonId: Number(row.season_id),
    view: row.view_key as FantasyProjectionView,
    releaseNumber: Number(row.release_number),
    label: String(row.release_label),
    beta: Boolean(row.beta),
    issuedAt: String(row.issued_at),
    cutoffAt: String(row.cutoff_at),
    artifactChecksum: String(row.artifact_checksum),
    contractVersion: String(row.contract_version),
    contractChecksum: String(row.contract_checksum),
    rosterRevisionHash: String(row.roster_revision_hash),
    scheduleRevisionHash: String(row.schedule_revision_hash),
    sourceHighWatermark: String(row.source_high_watermark),
    releaseHash: String(row.release_hash),
    active,
    metricSetVersion: String(row.metric_set_version ?? "core-v3"),
    rosterObservedAt: row.roster_observed_at ? String(row.roster_observed_at) : null,
    transactionCutoffAt: row.transaction_cutoff_at
      ? String(row.transaction_cutoff_at)
      : null,
    healthStatus: ["healthy", "held", "stale"].includes(row.health_status)
      ? row.health_status
      : "unknown",
    healthSummary: publicProvenance(row.health_summary),
  };
}

const RELEASE_COLUMNS =
  "id,season_id,view_key,release_number,release_label,beta,issued_at,cutoff_at,artifact_checksum,contract_version,contract_checksum,roster_revision_hash,schedule_revision_hash,source_high_watermark,release_hash,metric_set_version,roster_observed_at,transaction_cutoff_at,health_status,health_summary";

async function activeRelease(
  supabase: SupabaseClient<any>,
  seasonId: number,
  view: FantasyProjectionView,
): Promise<FantasyProjectionRelease> {
  const client = supabase as any;
  const { data: pointer, error: pointerError } = await client
    .from("player_forecast_season_active_releases")
    .select("release_id")
    .eq("season_id", seasonId)
    .eq("view_key", view)
    .maybeSingle();
  if (pointerError) throw pointerError;
  if (!pointer?.release_id) throw new FantasyProjectionReleaseNotFoundError();

  const { data: release, error: releaseError } = await client
    .from("player_forecast_season_releases")
    .select(RELEASE_COLUMNS)
    .eq("id", pointer.release_id)
    .maybeSingle();
  if (releaseError) throw releaseError;
  if (!release) throw new FantasyProjectionReleaseNotFoundError();
  return mapRelease(release, true);
}

export async function loadFantasyProjectionReleases(
  supabase: SupabaseClient<any>,
  seasonId: number,
): Promise<{
  betaLabel: string;
  releases: FantasyProjectionRelease[];
}> {
  const client = supabase as any;
  const [{ data: rows, error }, { data: pointers, error: pointerError }] =
    await Promise.all([
      client
        .from("player_forecast_season_releases")
        .select(RELEASE_COLUMNS)
        .eq("season_id", seasonId)
        .order("issued_at", { ascending: false }),
      client
        .from("player_forecast_season_active_releases")
        .select("release_id")
        .eq("season_id", seasonId),
    ]);
  if (error) throw error;
  if (pointerError) throw pointerError;
  const activeIds = new Set((pointers ?? []).map((row: any) => String(row.release_id)));
  return {
    betaLabel: FANTASY_PROJECTION_BETA_LABEL,
    releases: (rows ?? [])
      .filter((row: any) => releaseMatchesPublicContract(row))
      .map((row: any) => mapRelease(row, activeIds.has(String(row.id)))),
  };
}

export async function loadFantasyProjectionPlayers(args: {
  supabase: SupabaseClient<any>;
  seasonId: number;
  view: FantasyProjectionView;
  population?: "skater" | "goalie" | null;
  format?: "summary" | "full";
}): Promise<{
  betaLabel: string;
  release: FantasyProjectionRelease;
  players: FantasyProjectionPlayer[];
} | Omit<FantasyProjectionCompactPlayersResponse, "success">> {
  const client = args.supabase as any;
  const release = await activeRelease(args.supabase, args.seasonId, args.view);
  const format = args.format ?? "full";
  const summaryColumns =
    "fhfh_player_id,team_id,player_name,position,population,pool_status,roster_status,roster_confidence,source_fresh_at,rookie_profile,ratings,deployment,published_values,adjusted,fallback_flags";
  const fullColumns =
    "id,release_id,fhfh_player_id,team_id,player_name,position,population,pool_status,roster_status,roster_confidence,source_fresh_at,rookie_profile,expected_games,expected_starts,expected_toi,ratings,deployment,base_values,published_values,p10,p50,p90,adjustment_delta,adjusted,provenance,fallback_flags";
  const rows: any[] = [];
  for (let start = 0; ; start += 1000) {
    let query = client
      .from("player_forecast_season_release_players")
      .select(format === "summary" ? summaryColumns : fullColumns)
      .eq("release_id", release.id)
      .order("player_name", { ascending: true })
      .range(start, start + 999);
    if (args.population === "goalie") query = query.eq("population", "goalie");
    if (args.population === "skater") query = query.in("population", ["forward", "defense"]);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }

  const teamIds = Array.from(
    new Set(
      rows
        .map((row: any) => Number(row.team_id))
        .filter((teamId: number) => Number.isFinite(teamId)),
    ),
  );
  const teamAbbreviations = new Map<number, string>();
  if (teamIds.length > 0) {
    const { data: teams, error: teamsError } = await client
      .from("teams")
      .select("id,abbreviation")
      .in("id", teamIds);
    if (teamsError) throw teamsError;
    for (const team of teams ?? []) {
      teamAbbreviations.set(Number(team.id), String(team.abbreviation).trim());
    }
  }

  if (format === "summary") {
    const metricKeys = Array.from(
      new Set(rows.flatMap((row: any) => Object.keys(record(row.published_values)))),
    ).sort();
    return {
      betaLabel: FANTASY_PROJECTION_BETA_LABEL,
      release,
      encoding: FANTASY_PROJECTION_SUMMARY_ENCODING,
      metricKeys,
      players: rows.map((row: any) =>
        mapPlayerSummary(row, teamAbbreviations, metricKeys),
      ),
    };
  }
  return {
    betaLabel: FANTASY_PROJECTION_BETA_LABEL,
    release,
    players: rows.map((row: any) => mapPlayer(row, teamAbbreviations)),
  };
}

function mapPlayerSummary(
  row: Record<string, any>,
  teamAbbreviations: Map<number, string>,
  metricKeys: string[],
): FantasyProjectionPlayerSummaryTuple {
  const teamId = row.team_id == null ? null : Number(row.team_id);
  const population = row.population as FantasyProjectionPopulation;
  const fallbackFlags = Array.isArray(row.fallback_flags)
    ? row.fallback_flags.map(String)
    : [];
  const poolStatus = [
    "verified_active",
    "active_prospect",
    "unsigned_relevant",
    "review_required",
  ].includes(row.pool_status)
    ? row.pool_status
    : "review_required";
  const rosterStatus = [
    "active_nhl",
    "injured_nhl",
    "affiliate",
    "prospect_reserve",
    "unsigned",
  ].includes(row.roster_status)
    ? row.roster_status
    : "unresolved";
  const rookieProfile = record(row.rookie_profile);
  const deployment = record(row.deployment);
  const role = record(deployment.mostLikelyRole);
  const ratings = record(row.ratings);
  const ratingKey =
    population === "goalie"
      ? "goaltending"
      : population === "defense"
        ? "defense"
        : "offense";
  const rawRating = ratings[ratingKey];
  const primaryRating =
    typeof rawRating === "number" ? rawRating : Number(record(rawRating).value ?? 0);
  const values = numberRecord(row.published_values);
  return [
    Number(row.fhfh_player_id),
    teamId,
    teamId == null ? null : teamAbbreviations.get(teamId) ?? null,
    String(row.player_name),
    row.position,
    population,
    poolStatus,
    rosterStatus,
    summaryNumber(row.roster_confidence),
    row.source_fresh_at ? String(row.source_fresh_at) : null,
    rookieProfile.rookie == null
      ? fallbackFlags.includes("prior_based_projection") || poolStatus === "active_prospect"
        ? 1
        : 0
      : rookieProfile.rookie
        ? 1
        : 0,
    summaryNumber(primaryRating),
    summaryNumber(deployment.confidence),
    [
      role.forwardLine ?? null,
      role.defensePair ?? null,
      role.powerPlayUnit ?? null,
      role.penaltyKillUnit ?? null,
      role.goalieOrder ?? null,
    ],
    row.adjusted ? 1 : 0,
    fallbackFlags,
    metricKeys.map((key) => summaryNumber(values[key])),
  ];
}

function mapPlayer(
  row: Record<string, any>,
  teamAbbreviations: Map<number, string>,
): FantasyProjectionPlayer {
  const teamId = row.team_id == null ? null : Number(row.team_id);
  const fallbackFlags = Array.isArray(row.fallback_flags)
    ? row.fallback_flags.map(String)
    : [];
  const poolStatus = [
    "verified_active",
    "active_prospect",
    "unsigned_relevant",
    "review_required",
  ].includes(row.pool_status)
    ? row.pool_status
    : "review_required";
  const rookie = record(row.rookie_profile);
  return {
    id: String(row.id),
    releaseId: String(row.release_id),
    fhfhPlayerId: Number(row.fhfh_player_id),
    teamId,
    teamAbbreviation: teamId == null ? null : teamAbbreviations.get(teamId) ?? null,
    playerName: String(row.player_name),
    position: row.position,
    population: row.population as FantasyProjectionPopulation,
    poolStatus,
    rosterStatus: [
      "active_nhl",
      "injured_nhl",
      "affiliate",
      "prospect_reserve",
      "unsigned",
    ].includes(row.roster_status)
      ? row.roster_status
      : "unresolved",
    rosterConfidence: Number(row.roster_confidence),
    sourceFreshAt: row.source_fresh_at ? String(row.source_fresh_at) : null,
    rookieProfile: {
      rookie:
        rookie.rookie == null
          ? fallbackFlags.includes("prior_based_projection") ||
            poolStatus === "active_prospect"
          : Boolean(rookie.rookie),
      rosterProbability:
        rookie.rosterProbability == null
          ? null
          : Number(rookie.rosterProbability),
      sourceCoverage: Array.isArray(rookie.sourceCoverage)
        ? rookie.sourceCoverage.map(String)
        : [],
      nhleMethod: rookie.nhleMethod ? String(rookie.nhleMethod) : null,
      sourceLeague: rookie.sourceLeague ? String(rookie.sourceLeague) : null,
    },
    expectedGames: Number(row.expected_games),
    expectedStarts: row.expected_starts == null ? null : Number(row.expected_starts),
    expectedToi: numberRecord(row.expected_toi),
    ratings: record(row.ratings),
    deployment: record(row.deployment),
    modelValues: numberRecord(row.base_values),
    publishedValues: numberRecord(row.published_values),
    p10: numberRecord(row.p10),
    p50: numberRecord(row.p50),
    p90: numberRecord(row.p90),
    adjustmentDelta: numberRecord(row.adjustment_delta),
    adjusted: Boolean(row.adjusted),
    fallbackFlags,
    provenance: publicProvenance(row.provenance),
  };
}

export async function loadFantasyProjectionPlayerDetail(args: {
  supabase: SupabaseClient<any>;
  seasonId: number;
  view: FantasyProjectionView;
  fhfhPlayerId: number;
}): Promise<{
  betaLabel: string;
  release: FantasyProjectionRelease;
  player: FantasyProjectionPlayer;
  releaseHistory: Array<{
    view: FantasyProjectionView;
    releaseNumber: number;
    issuedAt: string;
    publishedValues: ProjectionValues;
    teamAbbreviation: string | null;
  }>;
}> {
  const client = args.supabase as any;
  const release = await activeRelease(args.supabase, args.seasonId, args.view);
  const { data: row, error } = await client
    .from("player_forecast_season_release_players")
    .select(
      "id,release_id,fhfh_player_id,team_id,player_name,position,population,pool_status,roster_status,roster_confidence,source_fresh_at,rookie_profile,expected_games,expected_starts,expected_toi,ratings,deployment,base_values,published_values,p10,p50,p90,adjustment_delta,adjusted,provenance,fallback_flags",
    )
    .eq("release_id", release.id)
    .eq("fhfh_player_id", args.fhfhPlayerId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new FantasyProjectionReleaseNotFoundError();

  const { data: releaseRows, error: releasesError } = await client
    .from("player_forecast_season_releases")
    .select(RELEASE_COLUMNS)
    .eq("season_id", args.seasonId)
    .order("issued_at", { ascending: false })
    .limit(30);
  if (releasesError) throw releasesError;
  const supportedReleases = (releaseRows ?? []).filter(releaseMatchesPublicContract);
  const releaseIds = supportedReleases.map((candidate: any) => candidate.id);
  const { data: historyRows, error: historyError } = releaseIds.length
    ? await client
        .from("player_forecast_season_release_players")
        .select("release_id,team_id,published_values")
        .eq("fhfh_player_id", args.fhfhPlayerId)
        .in("release_id", releaseIds)
    : { data: [], error: null };
  if (historyError) throw historyError;

  const teamIds = Array.from(
    new Set(
      [row, ...(historyRows ?? [])]
        .map((candidate: any) => candidate.team_id)
        .filter((teamId: unknown): teamId is number => teamId != null)
        .map(Number),
    ),
  );
  const teamAbbreviations = new Map<number, string>();
  if (teamIds.length) {
    const { data: teams, error: teamsError } = await client
      .from("teams")
      .select("id,abbreviation")
      .in("id", teamIds);
    if (teamsError) throw teamsError;
    for (const team of teams ?? []) {
      teamAbbreviations.set(Number(team.id), String(team.abbreviation).trim());
    }
  }

  const releaseById = new Map<string, any>(
    supportedReleases.map((candidate: any): [string, any] => [String(candidate.id), candidate]),
  );
  return {
    betaLabel: FANTASY_PROJECTION_BETA_LABEL,
    release,
    player: mapPlayer(row, teamAbbreviations),
    releaseHistory: (historyRows ?? [])
      .flatMap((history: any) => {
        const releaseRow = releaseById.get(String(history.release_id));
        if (!releaseRow) return [];
        const teamId = history.team_id == null ? null : Number(history.team_id);
        return [{
          view: releaseRow.view_key as FantasyProjectionView,
          releaseNumber: Number(releaseRow.release_number),
          issuedAt: String(releaseRow.issued_at),
          publishedValues: numberRecord(history.published_values),
          teamAbbreviation:
            teamId == null ? null : teamAbbreviations.get(teamId) ?? null,
        }];
      })
      .sort(
        (
          left: { issuedAt: string },
          right: { issuedAt: string },
        ) => Date.parse(right.issuedAt) - Date.parse(left.issuedAt),
      ),
  };
}

export async function loadFantasyProjectionTeams(args: {
  supabase: SupabaseClient<any>;
  seasonId: number;
  view: "opening" | "current";
}): Promise<{
  betaLabel: string;
  release: FantasyProjectionRelease;
  teams: FantasyProjectionTeam[];
}> {
  const client = args.supabase as any;
  const release = await activeRelease(args.supabase, args.seasonId, args.view);
  const { data: rows, error } = await client
    .from("player_forecast_season_release_teams")
    .select(
      "id,release_id,team_id,team_name,abbreviation,base_ratings,published_ratings,deployment,roster_counts,base_values,published_values,p10,p50,p90,adjustment_delta,adjusted,confidence,provenance",
    )
    .eq("release_id", release.id)
    .order("abbreviation", { ascending: true });
  if (error) throw error;
  return {
    betaLabel: FANTASY_PROJECTION_BETA_LABEL,
    release,
    teams: (rows ?? []).map((row: any) => ({
      id: String(row.id),
      releaseId: String(row.release_id),
      teamId: Number(row.team_id),
      teamName: String(row.team_name),
      abbreviation: String(row.abbreviation),
      modelRatings: record(row.base_ratings),
      publishedRatings: record(row.published_ratings),
      deployment: publicProvenance(row.deployment),
      rosterCounts: numberRecord(row.roster_counts),
      modelValues: numberRecord(row.base_values),
      publishedValues: numberRecord(row.published_values),
      p10: numberRecord(row.p10),
      p50: numberRecord(row.p50),
      p90: numberRecord(row.p90),
      adjustmentDelta: numberRecord(row.adjustment_delta),
      adjusted: Boolean(row.adjusted),
      confidence: Number(row.confidence),
      provenance: publicProvenance(row.provenance),
    })),
  };
}
