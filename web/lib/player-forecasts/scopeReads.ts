import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePlayerForecastGameStart, regularSeasonForDate, type PlayerForecastScheduleGame } from "./schedule";
import { planningScheduleStatus } from "../rosterScheduleData/normalize";
import { forgeScheduleRevision } from "../projections/issuedContext";

type ScheduleRejectionReason = "incomplete_read" | "read_deadline" | "out_of_scope" | "season_mismatch" | "type_mismatch"
  | "date_mismatch" | "identity_conflict" | "invalid_start" | "start_time_mismatch" | "invalid_receipt"
  | "unknown_status" | "missing_sides" | "conflicting_versions" | "conflicting_sides";

export type ForecastScheduleRejection = {
  readStatus: "complete" | "incomplete";
  validationStatus: "rejected";
  stage: "canonical_games" | "team_game_status" | "reconciliation";
  scope: { fromDate: string; throughDate: string | null; teamId: number | null };
  discoveredGames: number | null;
  checkedGames: number;
  unreadGames: number | null;
  reasons: ScheduleRejectionReason[];
  rejectedGames: Array<{ gameId: number | null; reasons: ScheduleRejectionReason[] }>;
};

/** Only explicit safe codes and canonical game IDs cross the operational API boundary. */
export class ForecastScheduleError extends Error {
  constructor(readonly receipt: ForecastScheduleRejection) {
    super(receipt.reasons.includes("read_deadline") ? "Forecast schedule scope read deadline exceeded"
      : "Forecast schedule scope is incomplete or inconsistent");
    this.name = "ForecastScheduleError";
  }
}

class ForecastReadDeadlineError extends Error {
  constructor() { super("Forecast scope read deadline exceeded"); }
}

/** Bounded operational reads; completion never implies a forecast release. */
export async function readForecastQuery<T>(deadlineMs: number, build: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const remaining = deadlineMs - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) throw new ForecastReadDeadlineError();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve().then(() => build(controller.signal)), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new ForecastReadDeadlineError()); }, remaining);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}

export async function readForecastScopeRows<T extends Record<string, any>>(args: {
  build: () => any; key: keyof T | ((row: T) => unknown); maximum: number; deadlineMs: number;
}): Promise<T[]> {
  const rows: T[] = [], seen = new Set<unknown>();
  let count: number | null = null;
  do {
    const response: any = await readForecastQuery(args.deadlineMs, signal => args.build()
      .range(rows.length, rows.length + 499).abortSignal(signal));
    if (response.error || !Array.isArray(response.data) || !Number.isSafeInteger(response.count)
      || response.count < 0 || response.count > args.maximum || count !== null && response.count !== count
      || response.data.length > Math.min(500, response.count - rows.length)
      || !response.data.length && response.count > rows.length) throw new Error("Forecast scope read is incomplete");
    count = response.count;
    for (const row of response.data as T[]) {
      const key = typeof args.key === "function" ? args.key(row) : row?.[args.key];
      if (key == null || key === "" || seen.has(key)) throw new Error("Forecast scope contains missing or duplicate identities");
      seen.add(key);
      rows.push(row);
    }
  } while (rows.length < count!);
  return rows;
}

/** Shared discovery for calendar windows and the distinct next-ten-team-games contract. */
export async function readForecastSchedule(args: {
  db: SupabaseClient<any>; now: Date; throughDate?: string; teamId?: number;
}): Promise<PlayerForecastScheduleGame[]> {
  if (!Number.isFinite(args.now.getTime()) || args.teamId !== undefined
    && (!Number.isSafeInteger(args.teamId) || args.teamId <= 0)) throw new Error("Invalid forecast schedule scope");
  const firstDate = new Date(Date.parse(`${args.now.toISOString().slice(0, 10)}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  if (args.throughDate !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(args.throughDate)
    || args.throughDate < firstDate || new Date(`${args.throughDate}T00:00:00Z`).toISOString().slice(0, 10) !== args.throughDate)) {
    throw new Error("Invalid forecast schedule end date");
  }
  const deadlineMs = Date.now() + 8000;
  const scope = { fromDate: firstDate, throughDate: args.throughDate ?? null, teamId: args.teamId ?? null };
  const rejection: ForecastScheduleRejection = { readStatus: "incomplete", validationStatus: "rejected",
    stage: "canonical_games", scope, discoveredGames: null, checkedGames: 0, unreadGames: null,
    reasons: [], rejectedGames: [] };
  let rows: PlayerForecastScheduleGame[];
  try { rows = await readForecastScopeRows<PlayerForecastScheduleGame>({ key: "id",
    maximum: args.throughDate ? 500 : 5000, deadlineMs,
    build: () => {
      let query = args.db.from("games").select("id,seasonId,date,startTime,homeTeamId,awayTeamId,type", { count: "exact" })
        .eq("type", 2).gte("date", firstDate);
      if (args.throughDate) query = query.lte("date", args.throughDate);
      if (args.teamId !== undefined) query = query.or(`homeTeamId.eq.${args.teamId},awayTeamId.eq.${args.teamId}`);
      return query.order("date").order("startTime").order("id");
    } }); }
  catch (error) { throw new ForecastScheduleError({ ...rejection,
    reasons: [error instanceof ForecastReadDeadlineError ? "read_deadline" : "incomplete_read"] }); }
  rejection.discoveredGames = rows.length;
  rejection.unreadGames = rows.length;
  const outOfScope = rows.filter(row => !Number.isSafeInteger(row.id) || row.id <= 0 || row.type !== 2
    || row.seasonId !== regularSeasonForDate(row.date)
    || row.date < firstDate || args.throughDate !== undefined && row.date > args.throughDate
    || args.teamId !== undefined && row.homeTeamId !== args.teamId && row.awayTeamId !== args.teamId);
  if (outOfScope.length) {
    throw new ForecastScheduleError({ ...rejection, reasons: ["out_of_scope"], rejectedGames: outOfScope.map(row => ({
      gameId: Number.isSafeInteger(row.id) && row.id > 0 ? row.id : null, reasons: ["out_of_scope"] })) });
  }
  const verified: PlayerForecastScheduleGame[] = [];
  let scheduleRowCount = 0;
  for (let index = 0; index < rows.length; index += 100) {
    const games = rows.slice(index, index + 100), ids = games.map(game => game.id);
    let schedule: Record<string, any>[];
    try { schedule = await readForecastScopeRows<Record<string, any>>({ key: "id",
      maximum: 20000 - scheduleRowCount, deadlineMs,
      build: () => args.db.from("roster_optimizer_team_games")
        .select("id,source_game_id,source_season_id,season,game_type,game_date,team_id,opponent_team_id,team_abbreviation,opponent_abbreviation,home_away,start_time,game_status,schedule_status,fetched_at", { count: "exact" })
        .in("source_game_id", ids).order("source_game_id").order("team_id").order("id") }); }
    catch (error) { throw new ForecastScheduleError({ ...rejection, stage: "team_game_status",
      reasons: [error instanceof ForecastReadDeadlineError ? "read_deadline" : "incomplete_read"] }); }
    scheduleRowCount += schedule.length;
    if (schedule.some(row => !ids.includes(row.source_game_id))) {
      throw new ForecastScheduleError({ ...rejection, stage: "team_game_status", reasons: ["out_of_scope"] });
    }
    for (const game of games) {
      const start = parsePlayerForecastGameStart(game.startTime, game.date);
      const teams = [game.homeTeamId, game.awayTeamId];
      const versions = schedule.filter(row => row.source_game_id === game.id);
      const reasons = new Set<ScheduleRejectionReason>();
      if (!start) reasons.add("invalid_start");
      if (teams.some(team => !Number.isSafeInteger(team) || team <= 0) || teams[0] === teams[1]) reasons.add("identity_conflict");
      for (const row of versions) {
        if (row.source_season_id !== game.seasonId || row.season !== String(game.seasonId).slice(0, 4)) reasons.add("season_mismatch");
        if (row.game_type !== 2) reasons.add("type_mismatch");
        if (row.game_date !== game.date) reasons.add("date_mismatch");
        if (!teams.includes(row.team_id)
          || row.opponent_team_id !== teams.find(team => team !== row.team_id)
          || row.home_away !== (row.team_id === game.homeTeamId ? "home" : "away")
          || typeof row.team_abbreviation !== "string" || !/^[A-Z]{3}$/.test(row.team_abbreviation)
          || typeof row.opponent_abbreviation !== "string" || !/^[A-Z]{3}$/.test(row.opponent_abbreviation)) reasons.add("identity_conflict");
        if (!Number.isFinite(Date.parse(row.start_time))) reasons.add("invalid_start");
        else if (start && Date.parse(row.start_time) !== Date.parse(start)) reasons.add("start_time_mismatch");
        if (!Number.isFinite(Date.parse(row.fetched_at)) || Date.parse(row.fetched_at) > args.now.getTime()) reasons.add("invalid_receipt");
        if (!planningScheduleStatus(String(row.game_status ?? ""), String(row.schedule_status ?? ""))) reasons.add("unknown_status");
      }
      const sides = teams.map(teamId => versions.filter(row => row.team_id === teamId));
      if (sides.some(side => !side.length)) reasons.add("missing_sides");
      if (!reasons.size && sides.some(side => side.some(row => forgeScheduleRevision(row as any) !== forgeScheduleRevision(side[0] as any)))) {
        reasons.add("conflicting_versions");
      }
      rejection.checkedGames++;
      rejection.unreadGames = rows.length - rejection.checkedGames;
      if (reasons.size) { rejection.rejectedGames.push({ gameId: game.id, reasons: [...reasons].sort() }); continue; }
      const selected = sides.map(side => side.sort((a, b) => Date.parse(b.fetched_at) - Date.parse(a.fetched_at) || a.id - b.id)[0]);
      const status = planningScheduleStatus(selected[0].game_status, selected[0].schedule_status)!;
      if (planningScheduleStatus(selected[1].game_status, selected[1].schedule_status) !== status
        || selected[0].team_abbreviation !== selected[1].opponent_abbreviation
        || selected[1].team_abbreviation !== selected[0].opponent_abbreviation) {
        rejection.rejectedGames.push({ gameId: game.id, reasons: ["conflicting_sides"] });
        continue;
      }
      verified.push({ ...game, scheduleEvidence: { status,
        fetchedAt: selected.map(row => row.fetched_at).sort((a, b) => Date.parse(a) - Date.parse(b))[0],
        teams: selected.map(row => ({ teamId: row.team_id, abbreviation: row.team_abbreviation,
          revision: forgeScheduleRevision(row as any) })) } });
    }
  }
  if (rejection.rejectedGames.length) throw new ForecastScheduleError({ ...rejection,
    stage: "reconciliation", readStatus: "complete", reasons: [...new Set(rejection.rejectedGames.flatMap(game => game.reasons))].sort() });
  return verified;
}
