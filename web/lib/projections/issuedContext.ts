import supabase from "lib/supabase/server";
import { playerForecastSourcePayloadHash } from "lib/player-forecasts/sourceSnapshot";

export type ForgeIssuedContextV1 = {
  version: "forge-issued-context-v1";
  game: { id: number; date: string; seasonId: number; startTime: string; homeTeamId: number; awayTeamId: number };
  schedule: Array<{ gameKey: string; season: string; sourceSeasonId: number; teamId: number; opponentTeamId: number;
    teamAbbreviation: string; opponentAbbreviation: string; startTime: string; gameStatus: string; scheduleStatus: string;
    sourceUpdatedAt: string | null; fetchedAt: string | null; revision: string }>;
  roster: Array<{ canonicalId: number; nhlId: number; seasonId: number; teamId: number;
    membershipCreatedAt: string[]; identityUpdatedAt: string | null; revision: string }>;
  observedAt: string;
};

export function forgeScheduleRevision(row: { source_game_id: number; start_time: string; team_abbreviation: string;
  opponent_abbreviation: string; game_status: string; schedule_status: string }): string {
  return playerForecastSourcePayloadHash({ id: String(row.source_game_id), start: row.start_time,
    team: row.team_abbreviation, opponent: row.opponent_abbreviation,
    status: String(row.game_status ?? "").toUpperCase(), schedule: String(row.schedule_status ?? "").toUpperCase() });
}

export function forgeRosterRevision(row: { canonicalId: number; nhlId: number; seasonId: number; teamId: number;
  membershipCreatedAt: string[] }): string {
  return playerForecastSourcePayloadHash({ playerId: row.canonicalId, nhlId: row.nhlId,
    seasonId: row.seasonId, teamId: row.teamId, membership: [...row.membershipCreatedAt].sort() });
}

type Row = Record<string, any>;
const scheduleRevisionForRow = (row: Row) => forgeScheduleRevision({
  source_game_id: row.source_game_id, start_time: row.start_time,
  team_abbreviation: row.team_abbreviation, opponent_abbreviation: row.opponent_abbreviation,
  game_status: row.game_status, schedule_status: row.schedule_status,
});
const validTime = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const chunks = (values: number[], size: number) => Array.from({ length: Math.ceil(values.length / size) },
  (_, index) => values.slice(index * size, (index + 1) * size));
async function completeRead(build: () => any, maxRows: number): Promise<Row[]> {
  const rows: Row[] = [];
  let total: number | null = null;
  for (;;) {
    const result = await build().range(rows.length, rows.length + 499);
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count)
      || result.count < 0 || result.count > maxRows || total !== null && result.count !== total
      || result.data.length > result.count - rows.length) {
      throw new Error("Issued FORGE context read was incomplete");
    }
    if (total === null) total = result.count;
    rows.push(...result.data);
    if (rows.length === total) return rows;
    if (!result.data.length) throw new Error("Issued FORGE context read was truncated");
  }
}

/** Captured inside FORGE's input transcript, before and after calculation. */
export async function captureForgeIssuedContexts(slateDate: string, gameIds: number[], db: any = supabase): Promise<ForgeIssuedContextV1[]> {
  if (!gameIds.length || gameIds.length > 16 || new Set(gameIds).size !== gameIds.length
    || gameIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error("Issued FORGE context requires 1–16 unique games");
  const games = await completeRead(() => db.from("games")
    .select("id,date,seasonId,startTime,homeTeamId,awayTeamId", { count: "exact" })
    .in("id", gameIds).order("id"), 16);
  if (games.length !== gameIds.length || games.some((row) => row.date !== slateDate || !validTime(row.startTime)
    || !Number.isSafeInteger(row.id) || !Number.isSafeInteger(row.seasonId)
    || !Number.isSafeInteger(row.homeTeamId) || !Number.isSafeInteger(row.awayTeamId)
    || row.homeTeamId === row.awayTeamId)) {
    throw new Error("Issued FORGE game context is missing or inconsistent");
  }
  const seasonIds = [...new Set(games.map((row) => row.seasonId))];
  if (seasonIds.length !== 1) throw new Error("Issued FORGE games must belong to one NHL season");
  const seasonId = seasonIds[0];
  const teamIds = [...new Set(games.flatMap((game) => [game.homeTeamId, game.awayTeamId]))];
  const [schedule, scopedMemberships] = await Promise.all([
    completeRead(() => db.from("roster_optimizer_team_games")
      .select("game_key,season,source_season_id,source_game_id,team_id,opponent_team_id,team_abbreviation,opponent_abbreviation,start_time,game_status,schedule_status,source_updated_at,fetched_at", { count: "exact" })
      .eq("source_season_id", seasonId).in("source_game_id", gameIds)
      .order("source_game_id").order("team_id").order("game_key"), 128),
    completeRead(() => db.from("rosters").select("playerId,teamId,seasonId,created_at", { count: "exact" })
      .eq("seasonId", seasonId).eq("is_current", true).in("teamId", teamIds)
      .order("playerId").order("teamId").order("created_at"), 1_200),
  ]);
  if (scopedMemberships.some((row) => !Number.isSafeInteger(row.playerId) || row.playerId <= 0
    || !Number.isSafeInteger(row.teamId) || !teamIds.includes(row.teamId)
    || row.seasonId !== seasonId || !validTime(row.created_at))) {
    throw new Error("Issued FORGE roster membership is malformed");
  }
  const candidateNhlIds = [...new Set(scopedMemberships.map((row) => row.playerId))].sort((a, b) => a - b);
  if (!candidateNhlIds.length) throw new Error("Issued FORGE game teams have no current-season roster members");
  const memberships = (await Promise.all(chunks(candidateNhlIds, 100).map((ids) => completeRead(() =>
    db.from("rosters").select("playerId,teamId,seasonId,created_at", { count: "exact" })
      .eq("seasonId", seasonId).eq("is_current", true).in("playerId", ids)
      .order("playerId").order("teamId").order("created_at"), 500)))).flat();
  const identities = (await Promise.all(chunks(candidateNhlIds, 100).map((ids) => completeRead(() =>
    db.from("fhfh_player_identities")
      .select("id,nhl_player_id,current_nhl_team_id,updated_at", { count: "exact" })
      .eq("verification_status", "verified").eq("lifecycle_status", "active_nhl")
      .is("merged_into_id", null).in("nhl_player_id", ids).order("id"), 500)))).flat();
  if (memberships.some((row) => !Number.isSafeInteger(row.playerId) || !candidateNhlIds.includes(row.playerId)
    || !Number.isSafeInteger(row.teamId) || row.teamId <= 0 || row.seasonId !== seasonId
    || !validTime(row.created_at))
    || identities.some((row) => !Number.isSafeInteger(row.id) || row.id <= 0
      || !Number.isSafeInteger(row.nhl_player_id) || !candidateNhlIds.includes(row.nhl_player_id)
      || row.updated_at != null && !validTime(row.updated_at))) {
    throw new Error("Issued FORGE roster identity or membership is malformed");
  }
  const membershipByNhl = new Map<number, Row[]>();
  for (const row of memberships) {
    const entries = membershipByNhl.get(row.playerId) ?? [];
    entries.push(row);
    membershipByNhl.set(row.playerId, entries);
  }
  const identityByNhl = new Map<number, Row[]>();
  for (const row of identities) {
    const entries = identityByNhl.get(row.nhl_player_id) ?? [];
    entries.push(row);
    identityByNhl.set(row.nhl_player_id, entries);
  }
  const observedAt = new Date().toISOString();
  if (memberships.some((row) => Date.parse(row.created_at) > Date.parse(observedAt))
    || identities.some((row) => row.updated_at != null && Date.parse(row.updated_at) > Date.parse(observedAt))
    || schedule.some((row) => Date.parse(row.fetched_at) > Date.parse(observedAt)
      || row.source_updated_at != null && Date.parse(row.source_updated_at) > Date.parse(observedAt))) {
    throw new Error("Issued FORGE context contains a future source timestamp");
  }
  return games.map((game) => {
    const teams = [game.homeTeamId, game.awayTeamId];
    const sourceSchedule = schedule.filter((row) => row.source_game_id === game.id);
    if (sourceSchedule.length < 2 || sourceSchedule.some((row) => !Number.isSafeInteger(row.team_id)
        || !Number.isSafeInteger(row.opponent_team_id) || !teams.includes(row.team_id)
        || row.opponent_team_id !== teams.find((id) => id !== row.team_id)
        || row.source_season_id !== seasonId || row.season !== String(seasonId).slice(0, 4)
        || !validTime(row.start_time) || Date.parse(row.start_time) !== Date.parse(game.startTime)
        || typeof row.game_key !== "string" || !row.game_key
        || !validTime(row.fetched_at) || row.source_updated_at != null && !validTime(row.source_updated_at))) {
      throw new Error("Issued FORGE schedule context is missing or inconsistent");
    }
    const gameSchedule = teams.map((teamId) => {
      const versions = sourceSchedule.filter((row) => row.team_id === teamId);
      if (!versions.length || versions.some((row) => row.opponent_team_id !== versions[0].opponent_team_id
        || scheduleRevisionForRow(row) !== scheduleRevisionForRow(versions[0]))) {
        throw new Error("Issued FORGE schedule context has conflicting cache versions");
      }
      return versions.sort((left, right) => String(right.source_updated_at ?? "").localeCompare(String(left.source_updated_at ?? ""))
        || String(right.fetched_at).localeCompare(String(left.fetched_at))
        || String(left.game_key).localeCompare(String(right.game_key)))[0];
    });
    const roster = [...membershipByNhl.entries()].flatMap(([nhlId, rows]) => {
      const teamIds = [...new Set(rows.map((row) => row.teamId))];
      const identity = identityByNhl.get(nhlId);
      if (!teamIds.some((id) => teams.includes(id))) return [];
      if (teamIds.length !== 1 || (identity?.length ?? 0) > 1) {
        throw new Error("Issued FORGE roster identity is ambiguous");
      }
      if (!identity?.length) return [];
      const item = { canonicalId: Number(identity[0].id), nhlId, seasonId, teamId: teamIds[0],
        membershipCreatedAt: rows.map((row) => String(row.created_at)).sort(),
        identityUpdatedAt: typeof identity[0].updated_at === "string" ? identity[0].updated_at : null };
      return [{ ...item, revision: forgeRosterRevision(item) }];
    }).sort((left, right) => left.nhlId - right.nhlId);
    return { version: "forge-issued-context-v1" as const,
      game: { id: game.id, date: game.date, seasonId, startTime: game.startTime,
        homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId },
      schedule: gameSchedule.map((row) => ({ gameKey: row.game_key, season: row.season,
        sourceSeasonId: row.source_season_id, teamId: row.team_id, opponentTeamId: row.opponent_team_id,
        teamAbbreviation: row.team_abbreviation, opponentAbbreviation: row.opponent_abbreviation,
        startTime: row.start_time, gameStatus: row.game_status, scheduleStatus: row.schedule_status,
        sourceUpdatedAt: row.source_updated_at ?? null, fetchedAt: row.fetched_at ?? null,
        revision: scheduleRevisionForRow(row) })).sort((left, right) => left.teamId - right.teamId),
      roster, observedAt };
  }).sort((left, right) => left.game.id - right.game.id);
}

export function forgeIssuedContextsFingerprint(contexts: ForgeIssuedContextV1[]): string {
  return playerForecastSourcePayloadHash(contexts.map(({ observedAt: _observedAt, ...context }) => context));
}
