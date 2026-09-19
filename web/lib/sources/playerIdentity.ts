import { fetchAllSupabasePages } from "lib/supabase/pagination";

export type PlayerIdentity = {
  playerId: number;
  fullName: string;
  lastName: string;
  position?: string | null;
  teamId?: number | null;
  aliases?: string[];
  registryId?: number;
};

export type PlayerIdentityResolution =
  | { status: "matched"; player: PlayerIdentity; basis: "full_name" | "alias" | "surname" | "initial" }
  | { status: "ambiguous" | "conflicting_membership"; candidates: PlayerIdentity[] }
  | { status: "missing_player"; candidates: [] };

export function normalizeIdentityName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'").replace(/[‐‑–—−-]/g, " ")
    .replace(/\./g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Roster planning rolls over in the offseason; statistical seasons do not. */
export function rosterSeasonForDate(date: string = new Date().toISOString()): number {
  const day = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day))) {
    throw new Error("Invalid roster context date");
  }
  const year = Number(day.slice(0, 4)) - (Number(day.slice(5, 7)) < 7 ? 1 : 0);
  return Number(`${year}${year + 1}`);
}

export function resolvePlayerIdentity(
  rawName: string,
  players: PlayerIdentity[],
  teamId?: number | null,
): PlayerIdentityResolution {
  const key = normalizeIdentityName(rawName);
  if (!key) return { status: "missing_player", candidates: [] };
  const unique = [...new Map(players.map((player) => [player.playerId, player])).values()];
  for (const basis of ["full_name", "alias", "initial", "surname"] as const) {
    const candidates = unique.filter((player) => {
      if (basis === "full_name") return normalizeIdentityName(player.fullName) === key;
      if (basis === "alias") return player.aliases?.some((alias) => normalizeIdentityName(alias) === key);
      if (basis === "surname") return normalizeIdentityName(player.lastName) === key;
      return normalizeIdentityName(`${player.fullName[0]} ${player.lastName}`) === key;
    });
    if (!candidates.length) continue;
    const scoped = teamId == null ? candidates : candidates.filter((player) => player.teamId === teamId);
    if (scoped.length === 1) return { status: "matched", player: scoped[0]!, basis };
    if (scoped.length > 1) return { status: "ambiguous", candidates: scoped };
    return { status: "conflicting_membership", candidates };
  }
  return { status: "missing_player", candidates: [] };
}

export async function fetchPlayerIdentityDirectory(supabase: any, registered?: RegisteredPlayerIdentity[]): Promise<PlayerIdentity[]> {
  const rows = await fetchAllSupabasePages<any>(({ from, to }) => supabase
    .from("players").select("id, fullName, lastName, position, team_id")
    .order("id", { ascending: true }).range(from, to));
  const aliases = process.env.TWEET_PIPELINE_INTERPRETATION_ENABLED === "true"
    ? await fetchAllSupabasePages<any>(({ from, to }) => supabase.from("lineup_player_name_aliases")
      .select("alias, player_id, team_id").order("normalized_alias").order("player_id").range(from, to)) : [];
  const registry = process.env.TWEET_PIPELINE_INTERPRETATION_ENABLED === "true"
    ? registered ?? await fetchRegisteredPlayerIdentities(supabase) : [];
  const byNhlId = new Map(registry.filter((row) => row.nhl_player_id).map((row) => [Number(row.nhl_player_id), row]));
  const memberships = process.env.TWEET_PIPELINE_INTERPRETATION_ENABLED === "true"
    ? await fetchAllSupabasePages<any>(({ from, to }) => supabase.from("tweet_player_memberships")
      .select("player_id,team_id,expires_at").eq("season_id", rosterSeasonForDate())
      .order("player_id").order("team_id").order("membership_kind").range(from, to)) : [];
  const rosters = process.env.TWEET_PIPELINE_INTERPRETATION_ENABLED === "true"
    ? await fetchAllSupabasePages<any>(({ from, to }) => supabase.from("rosters")
      .select("playerId,teamId").eq("seasonId", rosterSeasonForDate()).eq("is_current", true)
      .order("playerId").order("teamId").range(from, to)) : [];
  memberships.push(...rosters.map((row) => ({ player_id: row.playerId, team_id: row.teamId, expires_at: null })));
  const organizationByPlayer = new Map<number, Set<number>>();
  for (const membership of memberships) {
    if (membership.expires_at && Date.parse(membership.expires_at) <= Date.now()) continue;
    const teams = organizationByPlayer.get(Number(membership.player_id)) ?? new Set<number>();
    teams.add(Number(membership.team_id));
    organizationByPlayer.set(Number(membership.player_id), teams);
  }
  return rows.filter((row) => row.fullName && Number.isSafeInteger(Number(row.id))).map((row) => ({
    playerId: Number(row.id), fullName: row.fullName, lastName: row.lastName,
    position: row.position ?? null, teamId: organizationByPlayer.has(Number(row.id))
      ? (organizationByPlayer.get(Number(row.id))!.size === 1 ? [...organizationByPlayer.get(Number(row.id))!][0] : null)
      : process.env.TWEET_PIPELINE_INTERPRETATION_ENABLED === "true" || row.team_id == null ? null : Number(row.team_id),
    registryId: byNhlId.get(Number(row.id))?.id,
    aliases: [...(byNhlId.get(Number(row.id))?.aliases ?? []), ...(byNhlId.has(Number(row.id)) ? [byNhlId.get(Number(row.id))!.canonical_name] : []), ...aliases.filter((alias) => Number(alias.player_id) === Number(row.id) && (alias.team_id == null || organizationByPlayer.get(Number(row.id))?.has(Number(alias.team_id)))).map((alias) => alias.alias)],
  }));
}

export type RegisteredPlayerIdentity = { id: number; nhl_player_id: number | null; canonical_name: string; last_name: string | null; canonical_position: string | null; aliases: string[] };

export async function fetchRegisteredPlayerIdentities(supabase: any): Promise<RegisteredPlayerIdentity[]> {
  const [identities, aliases] = await Promise.all([
    fetchAllSupabasePages<any>(({ from, to }) => supabase.from("fhfh_player_identities")
      .select("id,nhl_player_id,canonical_name,last_name,canonical_position").eq("verification_status", "verified").order("id").range(from, to)),
    fetchAllSupabasePages<any>(({ from, to }) => supabase.from("fhfh_player_identity_aliases")
      .select("id,fhfh_player_id,alias").eq("verification_status", "verified").order("id").range(from, to)),
  ]);
  const byIdentity = new Map<number, string[]>();
  for (const alias of aliases) byIdentity.set(Number(alias.fhfh_player_id), [...(byIdentity.get(Number(alias.fhfh_player_id)) ?? []), alias.alias]);
  return identities.map((row) => ({ ...row, id: Number(row.id), aliases: byIdentity.get(Number(row.id)) ?? [] }));
}
