import type { SupabaseClient } from "@supabase/supabase-js";
import { playerForecastSourcePayloadHash } from "lib/player-forecasts/sourceSnapshot";
import type { PlanningData, PlanningGame, PlanningPlayer, SourceEvidence } from "lib/rosterScheduleOptimizer/planningTypes";
import { planningScheduleStatus } from "./normalize";

export type PlanningDataQuery = { seasonId: number; startDate: string; endDate: string; timeZone?: string };
type Row = Record<string, any>;
const position = (value: string) => ({ L: "LW", R: "RW" }[value] ?? value);
function evidence(source: string, asOf: string | null, seasonId: number | null, limitations: string[] = []): SourceEvidence {
  return { source, asOf, seasonId, completeness: limitations.length ? "partial" : "complete", limitations };
}

export function normalizePlanningGames(rows: Row[], timeZone?: string): PlanningGame[] {
  const result = new Map<string, PlanningGame>();
  for (const row of rows) {
    const id = String(row.source_game_id);
    const key = `${id}:${row.team_abbreviation}`;
    // Yahoo week mapping is not a prerequisite for a manual/custom-date NHL schedule.
    if (row.game_type !== 2 || !row.team_abbreviation || !row.game_date) continue;
    const status = String(row.game_status ?? "").toUpperCase();
    const schedule = String(row.schedule_status ?? "").toUpperCase();
    const planningStatus = planningScheduleStatus(status, schedule);
    if (!planningStatus) throw new Error("Planning schedule status could not be verified.");
    const instant = Date.parse(row.start_time ?? "");
    const date = timeZone && Number.isFinite(instant)
      ? new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant)) : row.game_date;
    result.set(key, {
      scheduleRevision: playerForecastSourcePayloadHash({ id, start: row.start_time, team: row.team_abbreviation, opponent: row.opponent_abbreviation, status, schedule }),
      id, date, startsAt: Number.isFinite(instant) ? new Date(instant).toISOString() : null,
      teamAbbreviation: row.team_abbreviation, opponent: row.opponent_abbreviation ?? "?", home: row.home_away === "home",
      status: planningStatus,
    });
  }
  return [...result.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id) || a.teamAbbreviation.localeCompare(b.teamAbbreviation));
}

export class PlanningReadDeadlineError extends Error {
  constructor() { super("Planning read deadline exceeded"); }
}

export async function withinDeadline<T>(deadline: number, work: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const remaining = deadline - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) throw new PlanningReadDeadlineError();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve().then(() => work(controller.signal)), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new PlanningReadDeadlineError()); }, remaining);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}

export async function pages(build: () => any, deadline: number, maximum = 15000,
  key: (row: Row) => unknown = row => row.id): Promise<Row[]> {
  return withinDeadline(deadline, async signal => {
    const rows: Row[] = [], seen = new Set<string>();
    let count: number | null = null;
    do {
      if (signal.aborted) throw new PlanningReadDeadlineError();
      const result = await build().range(rows.length, rows.length + 999).abortSignal(signal);
      if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count)
        || result.count < 0 || result.count > maximum || count !== null && count !== result.count
        || result.data.length > result.count - rows.length || !result.data.length && result.count > rows.length) {
        throw new Error("Planning source read is incomplete");
      }
      count = result.count;
      for (const row of result.data) {
        const value = key(row), parts = Array.isArray(value) ? value : [value];
        if (parts.some(part => part === undefined || part === null || part === "")) throw new Error("Planning source identity is missing");
        const identity = JSON.stringify(value);
        if (seen.has(identity)) throw new Error("Planning source read contains duplicate rows");
        seen.add(identity);
        rows.push(row);
      }
    } while (rows.length < count!);
    return rows;
  });
}

/** Shared current schedule and identity inputs; no forecast or account mutations. */
export async function loadPlanningInputs(db: SupabaseClient<any>, query: PlanningDataQuery, now: Date,
  inputDeadline = Date.now() + 8000) {
  const offsetDate = (value: string, days: number) => new Date(Date.parse(`${value}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const [scheduleRows, identities, teams, rosters] = await Promise.all([
    pages(() => db.from("roster_optimizer_team_games")
      .select("id,source_game_id,source_season_id,game_type,game_date,start_time,game_status,schedule_status,is_countable,team_abbreviation,opponent_abbreviation,home_away,fetched_at", { count: "exact" })
      .eq("source_season_id", query.seasonId).gte("game_date", offsetDate(query.startDate, -1)).lte("game_date", offsetDate(query.endDate, 1))
      .order("source_game_id").order("team_abbreviation").order("fetched_at").order("id"), inputDeadline),
    pages(() => db.from("fhfh_player_identities")
      .select("id,nhl_player_id,canonical_name,canonical_position,current_nhl_team_id,updated_at", { count: "exact" })
      .eq("verification_status", "verified").eq("lifecycle_status", "active_nhl").is("merged_into_id", null).not("nhl_player_id", "is", null).order("id"), inputDeadline),
    pages(() => db.from("teams").select("id,abbreviation", { count: "exact" }).order("id"), inputDeadline, 500),
    pages(() => db.from("rosters").select("playerId,teamId,created_at", { count: "exact" }).eq("seasonId", query.seasonId).eq("is_current", true)
      .order("playerId").order("teamId").order("created_at"), inputDeadline, 15000, row => [row.playerId, row.teamId, row.created_at]),
  ]);
  const teamNames = new Map(teams.map((row: Row) => [row.id, row.abbreviation as string]));
  const rosterTeams = new Map<number, Set<number>>();
  for (const row of rosters) rosterTeams.set(row.playerId, new Set([...(rosterTeams.get(row.playerId) ?? []), row.teamId]));
  const uniqueNhl = new Map<number, number>();
  for (const row of identities) uniqueNhl.set(row.nhl_player_id, (uniqueNhl.get(row.nhl_player_id) ?? 0) + 1);
  const players: PlanningPlayer[] = identities.filter((row) => uniqueNhl.get(row.nhl_player_id) === 1).map((row) => {
    const current = rosterTeams.get(row.nhl_player_id);
    const teamId = current?.size === 1 ? [...current][0] : null;
    return {
      ...(teamId !== null ? { nhlTeamId: teamId, rosterRevision: playerForecastSourcePayloadHash({ playerId: row.id, nhlId: row.nhl_player_id, seasonId: query.seasonId, teamId,
        membership: rosters.filter(roster => roster.playerId === row.nhl_player_id).map(roster => roster.created_at).sort() }) } : {}),
      id: String(row.id), nhlId: row.nhl_player_id, name: row.canonical_name,
      teamAbbreviation: teamId === null ? null : teamNames.get(teamId) ?? null,
      eligibilityVerified: false,
      eligiblePositions: row.canonical_position ? [position(row.canonical_position)] : [],
      playerClass: row.canonical_position === "G" ? "goalie" : "skater", availability: "unknown", ownership: null,
      canDrop: null, holdValue: null, reserveEligibility: [],
    };
  });
  const games = normalizePlanningGames(scheduleRows, query.timeZone).filter(game => game.date >= query.startDate && game.date <= query.endDate);
  // Padding supports league-local dates; unrelated padding must not stale the returned game scope.
  const gameKeys = new Set(games.map(game => `${game.id}:${game.teamAbbreviation}`));
  const scopedScheduleRows = scheduleRows.filter(row => row.game_type === 2 && gameKeys.has(`${row.source_game_id}:${row.team_abbreviation}`));
  const timestamps = scopedScheduleRows.map(row => row.fetched_at).filter((value): value is string => typeof value === "string"
    && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now.getTime()).sort((a, b) => Date.parse(a) - Date.parse(b));
  const scheduleProblems = !games.length ? ["No countable schedule games were found for this range."] : [];
  if (timestamps.length !== scopedScheduleRows.length || !timestamps[0] || now.getTime() - Date.parse(timestamps[0]) > 36 * 3600000) scheduleProblems.push("Schedule coverage may be stale or incomplete. Reloading this reader does not update the upstream cache.");
  const identityProblems = players.some((player) => !player.teamAbbreviation) ? ["Some canonical players lack unique current-season NHL roster membership; review their team before planning."] : [];
  if (uniqueNhl.size !== identities.length) identityProblems.push("Conflicting NHL identity mappings were excluded from the search catalog.");
  const sources: PlanningData["evidence"] = {
    schedule: evidence("roster_optimizer_team_games", timestamps[0] ?? null, query.seasonId, scheduleProblems),
    identities: evidence("fhfh_player_identities + current-season rosters", identities.map((row) => row.updated_at).filter(Boolean).sort()[0] ?? null, query.seasonId, identityProblems),
    availability: { source: "not_supplied", asOf: null, seasonId: query.seasonId, completeness: "unknown", limitations: ["League availability is unknown until verified by the manager or provider."] },
  };
  return { players, games, scheduleRows, scheduleProblems, evidence: sources };
}
