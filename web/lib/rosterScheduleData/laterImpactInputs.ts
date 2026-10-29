import type { SupabaseClient } from "@supabase/supabase-js";
import type { ForecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { playerForecastSourcePayloadHash } from "lib/player-forecasts/sourceSnapshot";
import type { CapturedLaterImpactScenario, LaterImpactScenarioPayload } from "lib/in-season/workspaceSchema";
import { blocked, evaluateLaterImpact, LATER_IMPACT_CONTRACT, LATER_IMPACT_RATE_POLICY, laterImpactForApp, resolveLaterPeriod,
  type CaptureReceipt, type LaterImpactInput, type LaterImpactResult, type LaterPeriod, type LeaguePeriod, type LaterSchedule,
  type ScenarioSourceRow, type TeamMembership } from "lib/rosterScheduleOptimizer/futureImpact";
import type { PlanIntent, PlanStep, PlanningData, PlanningGame, PlanningPlayer, PlanningSnapshot, StatLine } from "lib/rosterScheduleOptimizer/planningTypes";
import { compactBridgeForecasts, jsonUtf8Bytes, PLANNING_RESPONSE_BYTE_BUDGET, type BridgeRunProof } from "./bridgeForecastWire";
import { FORGE_DAILY_BRIDGE_VERSION, forgeNativeLine, type ForgeBridgeCapture } from "./forgeDailyBridge";
import { encodePlanningDataTransport } from "./planningDataTransport";
import { hasScheduleCoverage, normalizePlanningGames, pages, type PlanningDataQuery } from "./planningInputs";

/**
 * VORP S3: the offline data side of RSO's later-impact rate scenario (`S3-SCENARIO-CONTRACT.md` v2). It produces the inputs
 * S2's pure engine (`futureImpact.ts`) takes: the later period F, F's schedule as its own evidence (the selected-window games
 * are untouched), verified team membership, one basis-rate row per player from the admitted FORGE h1 rows, and the
 * `observed_capture` witness for those rows. Behind `RSO_LATER_IMPACT_SCENARIO` (default off); with it off nothing here runs.
 *
 * Checksums (all `playerForecastSourcePayloadHash`: sha256 hex of the JSON of the value with object keys sorted, recursively):
 * - source row:   H(the selected FORGE output row exactly as read, every selected column);
 * - row identity: { runId, slateDate, basisGameId, playerId, horizonGames, components: sorted component keys };
 * - row checksum: H({ identity, components: the native line served to the scenario, sourceRowHash });
 * - set checksum: H(every receipt row as { identity, checksum }, ordered by the H of its identity);
 * - receipt id:   "observed_capture:" + the first 32 hex of H({ startedAt, completedAt, setChecksum }).
 * The capture is the bridge's own server-side read of the admitted runs' output rows, timed around that read, so its
 * completion is "observed available by", never "first published"; `decisionAsOf` is taken after every read completes.
 */
export const LATER_IMPACT_SCENARIO_FLAG = "RSO_LATER_IMPACT_SCENARIO";
export const LATER_IMPACT_SCENARIO_VERSION = "rso-later-impact-scenario-v1" as const;
/** On only when explicitly "on"; unset or anything else is off. */
export const laterImpactScenarioEnabled = (env: Record<string, string | undefined> = process.env) => env[LATER_IMPACT_SCENARIO_FLAG] === "on";
/** The scenario's own ceiling, measured in laterImpactInputs.test.ts for a full league catalog with room to spare. */
export const LATER_IMPACT_SCENARIO_BYTE_BUDGET = 900_000;
/** Kept free inside the 4,000,000-byte response for the fields routes add around `data` (forecast source, read receipt) and
 * for a Yahoo snapshot's own roster, rules and lineups, so the scenario never pushes the bridge wire into trimming. */
export const LATER_IMPACT_SCENARIO_ENVELOPE_MARGIN = 120_000;
export const LATER_IMPACT_CAPTURE_SOURCE = "server:forge_daily_bridge_read";

type Row = Record<string, any>;
type CapturedScenario = CapturedLaterImpactScenario;
const hash = playerForecastSourcePayloadHash;
const DAY_MS = 86400000;
const CONTRACT = { name: LATER_IMPACT_CONTRACT.name, version: LATER_IMPACT_CONTRACT.version };
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;
const datesBetween = (start: string, end: string) => { const out: string[] = []; for (let date = start; date <= end; date = addDays(date, 1)) out.push(date); return out; };
const iso = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

// ---------------------------------------------------------------- checksums
export type ScenarioRowIdentity = { runId: string; slateDate: string; basisGameId: string; playerId: string; horizonGames: number; components: string[] };
export const scenarioRowChecksum = (identity: ScenarioRowIdentity, components: StatLine, sourceRowHash: string) =>
  hash({ identity: { ...identity, components: [...identity.components].sort() }, components, sourceRowHash });
export const scenarioSetChecksum = (rows: Array<{ identity: ScenarioRowIdentity; checksum: string }>) =>
  hash(rows.map(row => ({ identity: { ...row.identity, components: [...row.identity.components].sort() }, checksum: row.checksum }))
    .map(row => ({ key: hash(row.identity), row })).sort((a, b) => a.key.localeCompare(b.key)).map(item => item.row));

// ---------------------------------------------------------------- §2 F: league periods and the season span
/** Matchup weeks as league periods. `yahoo_matchup_weeks` rows carry a season-wide `game_key` and no league key, which is
 * not proof of the workspace's league (§2.1): such rows give no actual period, so F falls back to the labelled 7 days. */
export function laterPeriodSource(weekRows: Row[]): CapturedScenario["periods"] & { season: CapturedScenario["season"] } {
  const rows = weekRows.filter(row => Number.isInteger(row.week) && row.week > 0 && isDate(row.start_date) && isDate(row.end_date) && row.start_date <= row.end_date);
  const gameKeys = [...new Set(rows.map(row => String(row.game_key)))].sort();
  const leagueKeys = [...new Set(rows.map(row => typeof row.league_key === "string" && row.league_key ? row.league_key : null))];
  // One league identity for every row, or none at all: a mixed set is no league's periods.
  const leagueKey = leagueKeys.length === 1 ? leagueKeys[0] : null;
  const season = rows.length && gameKeys.length === 1 && Number.isInteger(Number(rows[0].season))
    ? { id: Number(rows[0].season) * 10001 + 1, startDate: rows.map(row => row.start_date as string).sort()[0], endDate: rows.map(row => row.end_date as string).sort().at(-1)! } : null;
  return { source: "yahoo_matchup_weeks", leagueKey, gameKeys,
    rows: (leagueKey ? rows : []).map(row => ({ id: String(row.id), week: row.week, startDate: row.start_date, endDate: row.end_date }))
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id)), season };
}

// ---------------------------------------------------------------- §3–§4, §7 basis rows and the observed capture
const conditioningOf = (row: Row): "unconditional" | "conditional" | null =>
  row.conditioning === "unconditional" ? "unconditional" : ["conditional", "per_appearance", "if_dressed", "if_starts"].includes(row.conditioning) ? "conditional" : null;
const isReserve = (row: Row) => row.player_class === "skater" && row.conditioning === "if_dressed" || row.player_class === "goalie" && row.conditioning === "if_starts";
const UNITS: Record<string, "count" | "minutes"> = { TIME_ON_ICE_PER_GAME: "minutes" };
/** Season of an NHL game id (its first four digits are the season's first year), as the bridge reads it. */
const gameSeason = (gameId: number) => Math.floor(gameId / 1000000) * 10001 + 1;

export type RunTiming = { inputCutoff: string | null; reconstruction: boolean | null };
/** Each run's input cutoff and replay classification from its captured input snapshot (`forge-run-inputs-v1`). A run with
 * no snapshot, or snapshots that disagree, keeps both unknown: no timestamp is guessed. */
export async function loadRunTimings(db: SupabaseClient<any>, runIds: string[], deadline: number): Promise<Map<string, RunTiming>> {
  if (!runIds.length) return new Map();
  const rows = await pages(() => db.from("player_forecast_source_observations")
    .select("id,entity_key,input_cutoff:payload->>inputCutoff,replay_classification:metadata->>replayClassification", { count: "exact" })
    .eq("provider", "forge").eq("dataset_key", "forge-run-inputs-v1").in("entity_key", runIds).order("entity_key").order("id"), deadline, 500);
  return runTimings(rows);
}
export function runTimings(rows: Row[]): Map<string, RunTiming> {
  const byRun = new Map<string, Row[]>();
  for (const row of rows) if (typeof row.entity_key === "string") byRun.set(row.entity_key, [...byRun.get(row.entity_key) ?? [], row]);
  return new Map([...byRun].map(([runId, snapshots]) => {
    const cutoffs = new Set(snapshots.map(row => iso(row.input_cutoff))), classes = new Set(snapshots.map(row => row.replay_classification));
    const cls = classes.size === 1 ? [...classes][0] : null;
    return [runId, { inputCutoff: cutoffs.size === 1 ? [...cutoffs][0] : null,
      reconstruction: cls === "historical_reconstruction" ? true : cls === "captured_live" ? false : null }];
  }));
}

/** One basis row per player: his newest admitted lineup line (by issue time, then run id, then basis game; never slate order),
 * or else his newest reserve line, which plans a labelled conservative zero beside its kept conditional line. The receipt
 * lists every selected row's full identity and checksum, so the set is coherent under one capture. */
export function buildBasis(observation: ForgeBridgeCapture | null, players: PlanningPlayer[], timings: Map<string, RunTiming>):
  Pick<CapturedScenario, "basis" | "capture"> & { limitations: string[] } {
  const empty = { ratePolicy: LATER_IMPACT_RATE_POLICY as typeof LATER_IMPACT_RATE_POLICY, bridgeVersion: FORGE_DAILY_BRIDGE_VERSION, componentSets: [], units: {}, runs: [], rows: [] };
  if (!observation) return { basis: empty, capture: null, limitations: ["No FORGE capture was observed for this request."] };
  const runs = observation.runs.filter(row => row.external_input_proven === true && typeof row.run_id === "string" && isDate(row.as_of_date) && iso(row.created_at));
  const runIndex = new Map(runs.map((row, index) => [row.run_id as string, index]));
  const byNhl = new Map(players.filter(player => player.nhlId !== null && player.teamAbbreviation && player.rosterRevision && Number.isFinite(player.nhlTeamId))
    .map(player => [player.nhlId!, player]));
  const teamById = new Map(players.filter(player => Number.isFinite(player.nhlTeamId) && player.teamAbbreviation).map(player => [player.nhlTeamId!, player.teamAbbreviation!]));
  const order = (row: Row) => [iso(runs[runIndex.get(row.run_id)!].created_at)!, row.run_id as string, String(row.game_id)] as const;
  const newer = (a: Row, b: Row) => { const [x, y] = [order(a), order(b)]; return x[0] !== y[0] ? x[0] > y[0] : x[1] !== y[1] ? x[1] > y[1] : x[2] > y[2]; };
  const pick = new Map<string, { row: Row; reserve: boolean; playerClass: "skater" | "goalie" }>();
  const offer = (row: Row, nhlId: unknown, playerClass: "skater" | "goalie", reserve: boolean) => {
    const player = typeof nhlId === "number" ? byNhl.get(nhlId) : undefined;
    if (!player || player.playerClass !== playerClass || !runIndex.has(row.run_id) || row.horizon_games !== 1 || !Number.isSafeInteger(row.game_id)) return;
    const current = pick.get(player.id);
    // A lineup line always beats a reserve line; within a kind, the newest wins.
    if (!current || current.reserve && !reserve || current.reserve === reserve && newer(row, current.row)) pick.set(player.id, { row, reserve, playerClass });
  };
  for (const row of observation.skaters) offer(row, row.player_id, "skater", false);
  for (const row of observation.goalies) offer(row, row.goalie_id, "goalie", false);
  for (const row of observation.reserves ?? []) if (isReserve(row)) offer(row, row.player_id, row.player_class, true);
  const componentSets: string[][] = [], setIndex = new Map<string, number>(), units: Record<string, "count" | "minutes"> = {};
  const rows: CapturedScenario["basis"]["rows"] = [], receiptRows: NonNullable<CapturedScenario["capture"]>["rows"] = [], identities: Array<{ identity: ScenarioRowIdentity; checksum: string }> = [];
  for (const [playerId, { row, reserve, playerClass }] of [...pick].sort(([a], [b]) => a.localeCompare(b))) {
    const line = forgeNativeLine(row, playerClass);
    if (!line) continue;
    const keys = Object.keys(line).sort(), setKey = keys.join("|");
    if (!setIndex.has(setKey)) { setIndex.set(setKey, componentSets.length); componentSets.push(keys); }
    for (const key of keys) units[key] = UNITS[key] ?? "count";
    const run = runs[runIndex.get(row.run_id)!];
    const identity: ScenarioRowIdentity = { runId: row.run_id, slateDate: run.as_of_date, basisGameId: String(row.game_id), playerId, horizonGames: 1, components: keys };
    const sourceRowHash = hash(row), checksum = scenarioRowChecksum(identity, line, sourceRowHash);
    const conditioning = reserve ? "unconditional" : conditioningOf(row);
    rows.push([playerId, runIndex.get(row.run_id)!, identity.basisGameId, teamById.get(row.team_id) ?? `#${row.team_id}`, setIndex.get(setKey)!,
      keys.map(key => line[key] ?? null), conditioning, checksum, sourceRowHash, reserve]);
    receiptRows.push([playerId, runIndex.get(row.run_id)!, identity.basisGameId, 1, setIndex.get(setKey)!, checksum]);
    identities.push({ identity, checksum });
  }
  const basis = { ...empty, componentSets, units, rows, runs: runs.map(row => ({ runId: row.run_id as string, slateDate: row.as_of_date as string,
    issuedAt: iso(row.created_at)!, inputCutoff: timings.get(row.run_id)?.inputCutoff ?? null, reconstruction: timings.get(row.run_id)?.reconstruction ?? null,
    modelVersion: `${FORGE_DAILY_BRIDGE_VERSION}:${row.git_sha ?? "unknown"}`, proof: (row.proof as BridgeRunProof | null) ?? null })) };
  const startedAt = iso(observation.startedAt), completedAt = iso(observation.completedAt);
  if (!startedAt || !completedAt) return { basis, capture: null, limitations: ["The FORGE capture has no valid timing, so it is no witness."] };
  const setChecksum = scenarioSetChecksum(identities);
  return { basis, limitations: [], capture: { id: `observed_capture:${hash({ startedAt, completedAt, setChecksum }).slice(0, 32)}`, kind: "observed_capture",
    trustedSource: LATER_IMPACT_CAPTURE_SOURCE, startedAt, completedAt, setChecksum, rows: receiptRows,
    // Runs were read as succeeded, released, public h1 and proof-admitted; rows are bound to a unique catalog player and
    // their own run; conditioning is read from the source field as stored (a missing tag stays unknown).
    bindings: { runSucceeded: true, admission: true, identity: true, conditioning: true, proof: runs.every(row => !!row.proof) } } };
}

// ---------------------------------------------------------------- §2.5 F's schedule, as separate evidence
/** The schedule for every date F could take inside the horizon bound, read on its own: the window's games are not touched.
 * `verifiedDates` are the dates whose source-day coverage witness (games and off days) verifies, each judged alone. */
export async function loadLaterSchedule(db: SupabaseClient<any>, seasonId: number, span: { startDate: string; endDate: string }, timeZone: string | undefined,
  deadline: number, clock: () => Date = () => new Date()): Promise<NonNullable<CapturedScenario["schedule"]>> {
  const rows = await pages(() => db.from("roster_optimizer_team_games")
    .select("id,source_game_id,source_season_id,game_type,game_date,start_time,game_status,schedule_status,is_countable,team_abbreviation,opponent_abbreviation,home_away,fetched_at,source_metadata", { count: "exact" })
    .eq("source_season_id", seasonId).gte("game_date", addDays(span.startDate, -1)).lte("game_date", addDays(span.endDate, 1))
    .order("source_game_id").order("team_abbreviation").order("fetched_at").order("id"), deadline);
  return laterSchedule(rows, seasonId, span, timeZone, clock());
}
export function laterSchedule(rows: Row[], seasonId: number, span: { startDate: string; endDate: string }, timeZone: string | undefined, readAt: Date):
  NonNullable<CapturedScenario["schedule"]> {
  const limitations: string[] = [];
  let games: PlanningGame[] = [];
  try { games = normalizePlanningGames(rows, timeZone).filter(game => game.date >= span.startDate && game.date <= span.endDate); }
  catch { limitations.push("Later-period schedule status could not be verified."); }
  const verifiedDates = limitations.length ? [] : datesBetween(span.startDate, span.endDate)
    .filter(date => hasScheduleCoverage(rows, { seasonId, startDate: date, endDate: date, ...(timeZone ? { timeZone } : {}) }, readAt));
  const keys = new Set(games.map(game => `${game.id}:${game.teamAbbreviation}`));
  const fetched = rows.filter(row => keys.has(`${row.source_game_id}:${row.team_abbreviation}`)).map(row => iso(row.fetched_at)).filter((value): value is string => !!value).sort();
  return { startDate: span.startDate, endDate: span.endDate, asOf: fetched[0] ?? null, revision: hash(games.map(game => game.scheduleRevision ?? null).sort()),
    verifiedDates, games, limitations };
}

// ---------------------------------------------------------------- the server-side build
export type LaterImpactScenarioArgs = { query: PlanningDataQuery; players: PlanningPlayer[]; weekRows: Row[]; calendarPolicy: ForecastCalendarPolicy;
  membershipAsOf: string; rosterRevision: string; observation: ForgeBridgeCapture | null; deadline: number };
/** Reads F's schedule and the runs' timing evidence, then fixes `decisionAsOf` after every read (so after capture completion). */
export async function loadLaterImpactScenario(db: SupabaseClient<any>, args: LaterImpactScenarioArgs, clock: () => Date = () => new Date()): Promise<CapturedScenario> {
  const { query, calendarPolicy } = args;
  const runIds = (args.observation?.runs ?? []).map(row => row.run_id).filter((id): id is string => typeof id === "string");
  const limitations: string[] = [];
  const timings = await loadRunTimings(db, runIds, args.deadline).catch(() => { limitations.push("Run timing evidence could not be read."); return new Map<string, RunTiming>(); });
  // Every F inside the bound starts after the window and ends by today + calendarDays − 1 (one spare day for the clock).
  const span = { startDate: addDays(query.endDate, 1), endDate: addDays(clock().toISOString().slice(0, 10), calendarPolicy.calendarDays) };
  const schedule = span.startDate > span.endDate ? null
    : await loadLaterSchedule(db, query.seasonId, span, query.timeZone, args.deadline, clock).catch(() => { limitations.push("The later-period schedule could not be read."); return null; });
  return assembleLaterImpactScenario(args, timings, schedule, clock().toISOString(), limitations);
}
/** Pure assembly; `decisionAsOf` must come after capture completion and every read. */
export function assembleLaterImpactScenario(args: Omit<LaterImpactScenarioArgs, "deadline">, timings: Map<string, RunTiming>,
  schedule: CapturedScenario["schedule"], decisionAsOf: string, limitations: string[] = []): CapturedScenario {
  const { season, ...periods } = laterPeriodSource(args.weekRows);
  const built = buildBasis(args.observation, args.players, timings);
  const teams = Object.fromEntries(args.players.filter(player => player.teamAbbreviation && player.rosterRevision && Number.isFinite(player.nhlTeamId))
    .map(player => [player.id, player.teamAbbreviation!]).sort(([a], [b]) => a.localeCompare(b)));
  return { version: LATER_IMPACT_SCENARIO_VERSION, status: "captured", contract: CONTRACT, reasons: [], decisionAsOf,
    window: { startDate: args.query.startDate, endDate: args.query.endDate }, timeZone: args.query.timeZone ?? null,
    calendarPolicy: args.calendarPolicy, season, periods, schedule,
    membership: { asOf: args.membershipAsOf, revision: args.rosterRevision, teams }, basis: built.basis, capture: built.capture,
    limitations: [...limitations, ...built.limitations, ...(periods.leagueKey ? [] : ["Matchup weeks carry no league identity, so F is the assumed 7 days after the window."])] };
}

// ---------------------------------------------------------------- §8 the combined byte budget
const withheld = (reasons: string[], decisionAsOf: string | null): LaterImpactScenarioPayload =>
  ({ version: LATER_IMPACT_SCENARIO_VERSION, status: "withheld", contract: CONTRACT, reasons, decisionAsOf });
const FIELD_BYTES = jsonUtf8Bytes({ laterImpactScenario: null }) - jsonUtf8Bytes({}) - jsonUtf8Bytes(null) + 1;
/** Bytes of the response body the routes build around this data (transport plus the full bridge wire), without the scenario. */
export function planningBodyBytes(data: PlanningData, seasonId: number, proofs: readonly BridgeRunProof[]): number {
  const bridge = compactBridgeForecasts(data.forecasts, data, seasonId, proofs);
  return jsonUtf8Bytes({ success: true, data: encodePlanningDataTransport({ ...data, forecasts: bridge.forecasts }), ...(bridge.wire ? { bridgeForecasts: bridge.wire } : {}) });
}
/**
 * The scenario that may ride beside this response. It must fit its own ceiling and leave the whole body inside the 4,000,000-byte
 * budget with the envelope margin, so the bridge wire is never trimmed for it. Otherwise it is withheld: the truncation is
 * disclosed and no number can follow. When even that notice cannot fit, nothing is attached and later impact stays unknown.
 */
export function fitLaterImpactScenario(scenario: CapturedScenario | null, baseBytes: number, budget = PLANNING_RESPONSE_BYTE_BUDGET): LaterImpactScenarioPayload | undefined {
  const room = budget - LATER_IMPACT_SCENARIO_ENVELOPE_MARGIN - baseBytes - FIELD_BYTES;
  const decisionAsOf = scenario?.decisionAsOf ?? null;
  const candidate: LaterImpactScenarioPayload = scenario ?? withheld(["scenario_read_failed"], null);
  const bytes = jsonUtf8Bytes(candidate);
  if (bytes <= room && bytes <= LATER_IMPACT_SCENARIO_BYTE_BUDGET) return candidate;
  const notice = withheld(["scenario_payload_truncated"], decisionAsOf);
  return jsonUtf8Bytes(notice) <= room ? notice : undefined;
}

// ---------------------------------------------------------------- the engine's inputs from a saved payload
export type ScenarioConversion = { input: LaterImpactInput | null; reasons: string[]; period: LaterPeriod | null };
/** Rebuilds futureImpact's plain inputs from a payload. Nothing is re-read and the clock stays the payload's `decisionAsOf`.
 * Row and set checksums are recomputed, so changed bytes surface as a checksum mismatch. `leaguePeriods` are a caller's
 * league-confirmed periods for this exact league; without them only league-keyed matchup weeks count as actual. */
export function laterImpactInputFromScenario(scenario: LaterImpactScenarioPayload | null | undefined, snapshot: PlanningSnapshot, intent: PlanIntent,
  steps: PlanStep[], options: { leaguePeriods?: LeaguePeriod[] } = {}): ScenarioConversion {
  const none = (reasons: string[], period: LaterPeriod | null = null): ScenarioConversion => ({ input: null, reasons, period });
  if (!scenario) return none(["scenario_unavailable"]);
  if (scenario.status === "withheld") return none(scenario.reasons.length ? scenario.reasons : ["scenario_withheld"]);
  const context = snapshot.context;
  if (!scenario.season) return none(["season_bounds_unavailable"]);
  if (scenario.season.id !== context.seasonId) return none(["season_mismatch"]);
  if (scenario.window.startDate !== context.startDate || scenario.window.endDate !== context.endDate) return none(["window_mismatch"]);
  if (scenario.timeZone !== null && scenario.timeZone !== context.timeZone) return none(["time_zone_mismatch"]);
  const periods = options.leaguePeriods ?? (scenario.periods.leagueKey ? scenario.periods.rows.map(row =>
    ({ id: row.id, leagueKey: scenario.periods.leagueKey!, seasonId: scenario.season!.id, startDate: row.startDate, endDate: row.endDate })) : null);
  const periodInput = { window: scenario.window, decisionAsOf: scenario.decisionAsOf, season: scenario.season, calendarPolicy: scenario.calendarPolicy, periods };
  const period = resolveLaterPeriod({ ...periodInput, timeZone: context.timeZone, leagueKey: context.leagueId });
  const reasons: string[] = [];
  const schedule = laterImpactSchedule(scenario.schedule, period);
  const membership: Record<string, TeamMembership> = Object.fromEntries(Object.entries(scenario.membership.teams)
    .map(([playerId, teamAbbreviation]) => [playerId, { teamAbbreviation, verified: true, asOf: scenario.membership.asOf }]));
  const { basis, capture } = scenario;
  const sourceRows = basis.rows.flatMap(([playerId, runAt, basisGameId, teamAbbreviation, set, values, conditioning, checksum, sourceRowHash, reserve]): ScenarioSourceRow[] => {
    const run = basis.runs[runAt], keys = basis.componentSets[set];
    if (!run || !keys || keys.length !== values.length) { reasons.push(`basis_row_malformed:${playerId}`); return []; }
    const components: StatLine = Object.fromEntries(keys.map((key, index) => [key, values[index]]));
    const identity = { runId: run.runId, slateDate: run.slateDate, basisGameId, playerId, horizonGames: 1, components: keys };
    // The recomputed checksum is what the receipt is compared with: bytes changed after capture never match it.
    const recomputed = scenarioRowChecksum(identity, components, sourceRowHash);
    if (recomputed !== checksum) reasons.push(`row_checksum_changed:${playerId}`);
    return [{ playerId, runId: run.runId, slateDate: run.slateDate, basisGameId, teamAbbreviation, seasonId: gameSeason(Number(basisGameId)),
      checksum: recomputed, modelVersion: run.modelVersion, bridgeVersion: basis.bridgeVersion,
      admission: { succeeded: true, public: true, released: true, horizonGames: 1, exclusionProof: !!run.proof },
      timing: { inputCutoff: run.inputCutoff, issuedAt: run.issuedAt, reconstruction: run.reconstruction },
      witness: capture ? { kind: "observed_capture", receiptId: capture.id } : null, conditioning, components,
      units: Object.fromEntries(keys.map(key => [key, basis.units[key] ?? "count"])),
      ...(reserve ? { reserveZero: { conditionalLine: { ...components } } } : {}) }];
  });
  const captures: CaptureReceipt[] = [];
  if (capture) {
    const rows = capture.rows.flatMap(([playerId, runAt, basisGameId, horizonGames, set, checksum]) => {
      const run = basis.runs[runAt], keys = basis.componentSets[set];
      return run && keys ? [{ runId: run.runId, slateDate: run.slateDate, basisGameId, playerId, horizonGames, components: keys, checksum }] : [];
    });
    const intact = rows.length === capture.rows.length && scenarioSetChecksum(rows.map(({ checksum, ...identity }) => ({ identity, checksum }))) === capture.setChecksum;
    if (!intact) reasons.push("set_checksum_mismatch");
    captures.push({ id: capture.id, kind: capture.kind, trustedSource: capture.trustedSource, startedAt: capture.startedAt, completedAt: capture.completedAt,
      rows, setChecksum: intact ? capture.setChecksum : null, bindings: { ...capture.bindings } });
  }
  return { input: { snapshot, intent, steps, period: periodInput, schedule, membership, sourceRows, captures }, reasons, period };
}

/** F's schedule cut from the read span: complete only when every F date's coverage (games and off days) verified. */
function laterImpactSchedule(read: CapturedScenario["schedule"], period: LaterPeriod): LaterSchedule {
  const first = period.dates[0], last = period.dates[period.dates.length - 1];
  if (!read || !first) return { startDate: first ?? "", endDate: last ?? "", completeness: "unknown", offDaysVerified: false, asOf: null, revision: "unavailable", games: [] };
  if (first < read.startDate || last > read.endDate) return { startDate: read.startDate, endDate: read.endDate, completeness: "partial", offDaysVerified: false,
    asOf: read.asOf, revision: read.revision, games: [] };
  const verified = period.dates.every(date => read.verifiedDates.includes(date)) && !read.limitations.length;
  const games = read.games.filter(game => game.date >= first && game.date <= last);
  return { startDate: first, endDate: last, completeness: verified ? "complete" : "partial", offDaysVerified: verified, asOf: read.asOf,
    revision: hash(games.map(game => game.scheduleRevision ?? null).sort()), games };
}

/** ΔF from a saved payload. The app path returns `scenario_contract_not_accepted` before reading anything, as futureImpact does;
 * `offlineFixture` (tests only, never acceptance) runs the engine. Converter reasons are kept beside the engine's. */
export function laterImpactFromScenario(scenario: LaterImpactScenarioPayload | null | undefined, snapshot: PlanningSnapshot, intent: PlanIntent, steps: PlanStep[],
  options: { offlineFixture?: true; leaguePeriods?: LeaguePeriod[] } = {}): LaterImpactResult {
  if (!LATER_IMPACT_CONTRACT.accepted && options.offlineFixture !== true) return laterImpactForApp();
  const { input, reasons, period } = laterImpactInputFromScenario(scenario, snapshot, intent, steps, options);
  if (!input) return blocked("unknown", reasons, period, scenario?.decisionAsOf ?? null);
  const result = evaluateLaterImpact(input, { offlineFixture: true });
  return reasons.length ? { ...result, reasons: [...result.reasons, ...reasons] } : result;
}
