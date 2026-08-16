import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FANTASY_PROJECTION_BETA_LABEL,
  FANTASY_PROJECTION_CONTRACT_CHECKSUM,
  FANTASY_PROJECTION_CONTRACT_VERSION,
  type FantasyProjectionPlayer,
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
  return (
    row.contract_version === FANTASY_PROJECTION_CONTRACT_VERSION &&
    row.contract_checksum === FANTASY_PROJECTION_CONTRACT_CHECKSUM
  );
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
  };
}

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
    .select(
      "id,season_id,view_key,release_number,release_label,beta,issued_at,cutoff_at,artifact_checksum,contract_version,contract_checksum,roster_revision_hash,schedule_revision_hash,source_high_watermark,release_hash",
    )
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
        .select(
          "id,season_id,view_key,release_number,release_label,beta,issued_at,cutoff_at,artifact_checksum,contract_version,contract_checksum,roster_revision_hash,schedule_revision_hash,source_high_watermark,release_hash",
        )
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
}): Promise<{
  betaLabel: string;
  release: FantasyProjectionRelease;
  players: FantasyProjectionPlayer[];
}> {
  const client = args.supabase as any;
  const release = await activeRelease(args.supabase, args.seasonId, args.view);
  const rows: any[] = [];
  for (let start = 0; ; start += 1000) {
    let query = client
      .from("player_forecast_season_release_players")
      .select(
        "id,release_id,fhfh_player_id,team_id,player_name,position,population,roster_confidence,expected_games,expected_starts,expected_toi,ratings,deployment,base_values,published_values,p10,p50,p90,adjustment_delta,adjusted,provenance,fallback_flags",
      )
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

  return {
    betaLabel: FANTASY_PROJECTION_BETA_LABEL,
    release,
    players: rows.map((row: any) => {
      const teamId = row.team_id == null ? null : Number(row.team_id);
      return {
        id: String(row.id),
        releaseId: String(row.release_id),
        fhfhPlayerId: Number(row.fhfh_player_id),
        teamId,
        teamAbbreviation: teamId == null ? null : teamAbbreviations.get(teamId) ?? null,
        playerName: String(row.player_name),
        position: row.position,
        population: row.population as FantasyProjectionPopulation,
        rosterConfidence: Number(row.roster_confidence),
        expectedGames: Number(row.expected_games),
        expectedStarts:
          row.expected_starts == null ? null : Number(row.expected_starts),
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
        fallbackFlags: Array.isArray(row.fallback_flags)
          ? row.fallback_flags.map(String)
          : [],
        provenance: publicProvenance(row.provenance),
      };
    }),
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
      "id,release_id,team_id,team_name,abbreviation,base_ratings,published_ratings,deployment,roster_counts,adjustment_delta,adjusted,confidence,provenance",
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
      adjustmentDelta: numberRecord(row.adjustment_delta),
      adjusted: Boolean(row.adjusted),
      confidence: Number(row.confidence),
      provenance: publicProvenance(row.provenance),
    })),
  };
}
