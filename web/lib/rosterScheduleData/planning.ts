import type { SupabaseClient } from "@supabase/supabase-js";
import { boardGoalieForecast, boardSkaterForecast, boardSkaterStatsFromProjection } from "lib/projections/starterBoardScoring";
import type { ForgeGameRevision } from "lib/projections/gameRevisions";
import { starterBoardCanaryGameIds, starterBoardFlags } from "lib/projections/starterBoardFlags";
import type { GameForecast, PlanningData, PlanningGame, PlanningPlayer, SourceEvidence } from "lib/rosterScheduleOptimizer/planningTypes";

export type PlanningDataQuery = { seasonId: number; startDate: string; endDate: string; timeZone?: string };
export function parsePlanningDataQuery(query: Record<string, unknown>): PlanningDataQuery {
  const seasonId = Number(query.seasonId);
  const season = String(seasonId);
  const startDate = typeof query.startDate === "string" ? query.startDate : "";
  const endDate = typeof query.endDate === "string" ? query.endDate : "";
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (!/^\d{8}$/.test(season) || Number(season.slice(4)) !== Number(season.slice(0, 4)) + 1
    || !validDate(startDate) || !validDate(endDate) || startDate > endDate
    || Date.parse(endDate) - Date.parse(startDate) > 366 * 86400000) {
    throw new Error("Provide a valid NHL season and a date range of at most 367 days.");
  }
  const timeZone = typeof query.timeZone === "string" ? query.timeZone : undefined;
  if (timeZone) { try { new Intl.DateTimeFormat("en", { timeZone }); } catch { throw new Error("Provide a valid league time zone."); } }
  return { seasonId, startDate, endDate, ...(timeZone ? { timeZone } : {}) };
}

type Row = Record<string, any>;
const numberOrNull = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
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
    const instant = Date.parse(row.start_time ?? "");
    const date = timeZone && Number.isFinite(instant)
      ? new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant)) : row.game_date;
    result.set(key, {
      id, date, startsAt: Number.isFinite(instant) ? new Date(instant).toISOString() : null,
      teamAbbreviation: row.team_abbreviation, opponent: row.opponent_abbreviation ?? "?", home: row.home_away === "home",
      status: /CANCEL|^CNCL$/.test(schedule) ? "cancelled" : /POST|^PPD$/.test(schedule) ? "postponed"
        : ["OFF", "FINAL", "FINAL_OT", "FINAL_SO"].includes(status) ? "final"
          : ["LIVE", "CRIT"].includes(status) ? "live" : "scheduled",
    });
  }
  return [...result.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id) || a.teamAbbreviation.localeCompare(b.teamAbbreviation));
}

/** Whitelist issued, selected FORGE outputs. Research/admin payloads never leave this boundary. */
export function publicPlanningForecasts(revisions: ForgeGameRevision[], players: PlanningPlayer[], games: PlanningGame[], now: Date): GameForecast[] {
  const byNhl = new Map(players.filter((player) => player.nhlId !== null).map((player) => [player.nhlId, player]));
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const forecasts = new Map<string, GameForecast>();
  for (const revision of revisions) {
    const gameId = String(revision.game_id);
    if (!gamesById.has(gameId) || !Number.isFinite(Date.parse(revision.published_at)) || Date.parse(revision.published_at) > now.getTime()) continue;
    const emit = (nhlId: number, stats: Record<string, number | null> | null, startProbability: number | null, confirmedStart: boolean, limitations: string[]) => {
      const player = byNhl.get(nhlId);
      if (!player || !stats) return;
      const safeStats = Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, numberOrNull(value)]));
      if (!Object.values(safeStats).some((value) => value !== null)) return;
      const output: GameForecast = {
        playerId: player.id, gameId, stats: safeStats, conditioning: "unconditional", startProbability, confirmedStart,
        revisionId: revision.id, issuedAt: revision.published_at,
        modelVersion: revision.payload.codeVersion ?? null,
        limitations: ["Game forecasts are provisional; joint plan uncertainty is not calibrated.", ...limitations],
      };
      const key = `${player.id}:${gameId}`, previous = forecasts.get(key);
      if (!previous || previous.issuedAt < output.issuedAt) forecasts.set(key, output);
    };
    for (const row of revision.payload.players ?? []) {
      const prediction = boardSkaterForecast(boardSkaterStatsFromProjection(row), row.uncertainty);
      // The shared skater model can be conditional-only. Do not assume participation = 1.
      emit(row.player_id, prediction.expected, null, false, prediction.conflicts);
    }
    for (const row of revision.payload.goalies ?? []) {
      const candidates = row.uncertainty?.daily_board_candidates ?? [];
      const probabilities = candidates.map((candidate: Row) => numberOrNull(candidate.startingProbability));
      const mass = probabilities.reduce((sum: number, value: number | null) => sum + (value ?? 0), 0);
      if (mass > 1.000001 || probabilities.some((value: number | null) => value === null || value < 0 || value > 1)) continue;
      for (const candidate of candidates) {
        const prediction = boardGoalieForecast(candidate);
        emit(candidate.playerId, prediction?.expected ?? null, prediction?.participationProbability ?? null,
          prediction?.probabilityStatus === "confirmed_evidence" && prediction.participationProbability === 1,
          ["Goalie start assignments share one team-game; no guaranteed future starts.", "Non-start relief contribution is unavailable."]);
      }
    }
  }
  return [...forecasts.values()];
}

async function pages(build: () => any, pageSize = 1000): Promise<Row[]> {
  const rows: Row[] = [];
  for (let start = 0; ; start += pageSize) {
    const result = await build().range(start, start + pageSize - 1);
    if (result.error) throw result.error;
    rows.push(...(result.data ?? []));
    if ((result.data ?? []).length < pageSize) return rows;
  }
}

export async function loadPlanningData(db: SupabaseClient<any>, query: PlanningDataQuery, options: { now?: Date; forecastsEnabled?: boolean } = {}): Promise<PlanningData> {
  const now = options.now ?? new Date();
  const offsetDate = (value: string, days: number) => new Date(Date.parse(`${value}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const [scheduleRows, identities, teams, rosters, weeks] = await Promise.all([
    pages(() => db.from("roster_optimizer_team_games")
      .select("source_game_id,source_season_id,game_type,game_date,start_time,game_status,schedule_status,is_countable,team_abbreviation,opponent_abbreviation,home_away,fetched_at")
      .eq("source_season_id", query.seasonId).gte("game_date", offsetDate(query.startDate, -1)).lte("game_date", offsetDate(query.endDate, 1))
      .order("source_game_id").order("team_abbreviation").order("fetched_at")),
    pages(() => db.from("fhfh_player_identities")
      .select("id,nhl_player_id,canonical_name,canonical_position,current_nhl_team_id,updated_at")
      .eq("verification_status", "verified").eq("lifecycle_status", "active_nhl").is("merged_into_id", null).not("nhl_player_id", "is", null).order("id")),
    db.from("teams").select("id,abbreviation"),
    pages(() => db.from("rosters").select("playerId,teamId,created_at").eq("seasonId", query.seasonId).eq("is_current", true).order("playerId")),
    db.from("yahoo_matchup_weeks").select("game_key,week,start_date,end_date").eq("season", String(query.seasonId).slice(0, 4)).order("week"),
  ]);
  if (teams.error) throw teams.error;
  const teamNames = new Map((teams.data ?? []).map((row: Row) => [row.id, row.abbreviation as string]));
  const rosterTeams = new Map<number, Set<number>>();
  for (const row of rosters) rosterTeams.set(row.playerId, new Set([...(rosterTeams.get(row.playerId) ?? []), row.teamId]));
  const uniqueNhl = new Map<number, number>();
  for (const row of identities) uniqueNhl.set(row.nhl_player_id, (uniqueNhl.get(row.nhl_player_id) ?? 0) + 1);
  const players: PlanningPlayer[] = identities.filter((row) => uniqueNhl.get(row.nhl_player_id) === 1).map((row) => {
    const current = rosterTeams.get(row.nhl_player_id);
    const teamId = current?.size === 1 ? [...current][0] : null;
    return {
      id: String(row.id), nhlId: row.nhl_player_id, name: row.canonical_name,
      teamAbbreviation: teamId === null ? null : teamNames.get(teamId) ?? null,
      eligiblePositions: row.canonical_position ? [position(row.canonical_position)] : [],
      playerClass: row.canonical_position === "G" ? "goalie" : "skater", availability: "unknown", ownership: null,
      canDrop: null, holdValue: null, reserveEligibility: [],
    };
  });
  const games = normalizePlanningGames(scheduleRows, query.timeZone).filter(game => game.date >= query.startDate && game.date <= query.endDate);
  const timestamps = scheduleRows.map((row) => row.fetched_at).filter((value): value is string => typeof value === "string").sort();
  const scheduleProblems = !games.length ? ["No countable schedule games were found for this range."] : [];
  if (timestamps.length !== scheduleRows.length || !timestamps[0] || now.getTime() - Date.parse(timestamps[0]) > 36 * 3600000) scheduleProblems.push("Schedule coverage may be stale or incomplete. Reloading this reader does not update the upstream cache.");
  const identityProblems = players.some((player) => !player.teamAbbreviation) ? ["Some canonical players lack unique current-season NHL roster membership; review their team before planning."] : [];
  if (uniqueNhl.size !== identities.length) identityProblems.push("Conflicting NHL identity mappings were excluded from the search catalog.");
  const sources: PlanningData["evidence"] = {
    schedule: evidence("roster_optimizer_team_games", timestamps[0] ?? null, query.seasonId, scheduleProblems),
    identities: evidence("fhfh_player_identities + current-season rosters", identities.map((row) => row.updated_at).filter(Boolean).sort()[0] ?? null, query.seasonId, identityProblems),
    availability: { source: "not_supplied", asOf: null, seasonId: query.seasonId, completeness: "unknown", limitations: ["League availability is unknown until verified by the manager or provider."] },
  };
  const revisions: ForgeGameRevision[] = [];
  const forecastProblems: string[] = [];
  let canary: number[] | null = null;
  let rolloutValid = true;
  try { canary = starterBoardCanaryGameIds(); }
  catch { rolloutValid = false; forecastProblems.push("Shared forecast rollout configuration could not be verified; schedule planning remains available."); }
  if (rolloutValid && (options.forecastsEnabled ?? starterBoardFlags().serving)) {
    // Revision slates retain the NHL source date even when the league-local date differs.
    const selectedGameIds = new Set(games.filter(game => canary === null || canary.includes(Number(game.id))).map(game => game.id));
    if (canary !== null) forecastProblems.push("Only games enabled by the shared forecast rollout are served.");
    const dates = [...new Set(scheduleRows.filter(row => selectedGameIds.has(String(row.source_game_id))).map(row => String(row.game_date)))];
    // Bounded concurrency, with no update/pipeline side effects.
    const readStarted = Date.now();
    for (let index = 0; index < dates.length; index += 4) {
      if (Date.now() - readStarted >= 8000) { forecastProblems.push("Forecast discovery reached its time budget; uncovered dates remain schedule-only."); break; }
      const results = await Promise.allSettled(dates.slice(index, index + 4).map(async (date) => {
        const response = await db.rpc("read_forge_game_revisions", { p_slate_date: date });
        if (response.error) throw response.error;
        return response.data as ForgeGameRevision[];
      }));
      for (const result of results) {
        if (result.status === "fulfilled") revisions.push(...result.value.filter(revision => selectedGameIds.has(String(revision.game_id))));
        else forecastProblems.push("Some issued game forecasts could not be read.");
      }
    }
  } else forecastProblems.push("Shared game-forecast serving is not enabled; schedule planning remains available.");
  const forecasts = publicPlanningForecasts(revisions, players, games, now);
  forecastProblems.push("Only issued unconditional game forecasts are used. Conditional-only, missing, or out-of-horizon statistics are unknown, not zero.");
  sources.forecasts = evidence("selected FORGE game revisions", forecasts.map((row) => row.issuedAt).sort()[0] ?? null, query.seasonId, [...new Set(forecastProblems)]);

  // Ownership is platform-wide context, never league availability. This season-scoped view may be absent/stale.
  try {
    const ownership = await pages(() => db.from("yahoo_player_ownership_daily").select("player_id,ownership_pct,ownership_date,updated_at")
      .eq("season_id", query.seasonId).gte("ownership_date", new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10))
      .order("ownership_date", { ascending: false }).order("player_id"));
    const mapping = await pages(() => db.from("yahoo_nhl_player_map_read").select("nhl_player_id,yahoo_player_id").order("nhl_player_id").order("yahoo_player_id"));
    const nhlByYahoo = new Map<string, Set<number>>();
    for (const row of mapping) nhlByYahoo.set(String(row.yahoo_player_id), new Set([...(nhlByYahoo.get(String(row.yahoo_player_id)) ?? []), Number(row.nhl_player_id)]));
    const latest = new Map<number, Row>();
    for (const row of ownership) {
      const matches = nhlByYahoo.get(String(row.player_id));
      if (matches?.size !== 1) continue;
      const nhl = [...matches][0];
      if (!latest.has(nhl)) latest.set(nhl, row);
    }
    for (const player of players) {
      const row = player.nhlId === null ? null : latest.get(player.nhlId);
      const value = numberOrNull(row?.ownership_pct);
      if (value !== null && value >= 0 && value <= 100 && Date.parse(`${row!.ownership_date}T00:00:00Z`) >= now.getTime() - 3 * 86400000) player.ownership = value;
    }
    sources.ownership = evidence("Yahoo daily ownership", ownership[0]?.updated_at ?? null, query.seasonId, ["Ownership is not league availability; missing or older than three days is unknown."]);
  } catch { sources.ownership = evidence("Yahoo daily ownership", null, query.seasonId, ["Ownership could not be verified."]); }
  try {
    const start = new Date(now.getTime() - 21 * 86400000).toISOString().slice(0, 10);
    const cutoff = new Date(now.getTime() - 24 * 3600000).toISOString().slice(0, 10);
    const recent = await pages(() => db.from("skatersGameStats").select("playerId,gameId,points,games!inner(date,seasonId,type)")
      .eq("games.seasonId", query.seasonId).eq("games.type", 2).gte("games.date", start).lte("games.date", cutoff)
      .order("gameId", { ascending: false }).order("playerId"));
    const byPlayer = new Map<number, Row[]>();
    for (const row of recent) byPlayer.set(row.playerId, [...(byPlayer.get(row.playerId) ?? []), row]);
    for (const player of players) {
      const samples = player.nhlId === null ? [] : byPlayer.get(player.nhlId) ?? [];
      if (samples.length < 3 || samples.slice(0, 5).some(row => numberOrNull(row.points) === null)) continue;
      const lastThree = samples.slice(0, 3).reduce((sum, row) => sum + row.points, 0);
      const lastFive = samples.slice(0, 5).reduce((sum, row) => sum + row.points, 0);
      const hot = lastThree >= 6, cold = samples.length >= 5 && lastFive === 0;
      player.form = { label: hot ? "Scoring hot" : cold ? "Scoring cold" : "Recent scoring", games: hot ? 3 : Math.min(samples.length, 5), points: hot ? lastThree : lastFive, includedInForecast: null };
    }
    sources.form = evidence("Recent regular-season box scores", null, query.seasonId, ["Recent scoring uses available game logs before the previous day; projection incorporation is unknown and no form bonus is added."]);
  } catch { sources.form = evidence("Recent box scores", null, query.seasonId, ["Recent-form evidence could not be loaded."]); }
  const weekRows = weeks.error ? [] : weeks.data ?? [];
  const matchupWeeks = new Set(weekRows.map((row: Row) => row.game_key)).size === 1 ? weekRows
    .filter((row: Row) => Number.isInteger(row.week) && row.week > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.start_date) && row.start_date <= row.end_date)
    .map((row: Row) => ({ gameKey: String(row.game_key), week: row.week, startDate: row.start_date, endDate: row.end_date })) : [];
  sources.matchupWeeks = evidence("Yahoo matchup weeks", null, query.seasonId, matchupWeeks.length ? [] : ["Matchup week presets are unavailable for this season; use custom dates."]);
  return { players, games, forecasts, evidence: sources, matchupWeeks };
}
