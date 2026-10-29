// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { forecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { laterImpactScenarioSchema, saveWorkspaceSchema, snapshotSchema, WORKSPACE_SAVE_BYTE_BUDGET, type CapturedLaterImpactScenario,
  type LaterImpactScenarioPayload } from "lib/in-season/workspaceSchema";
import { LATER_IMPACT_CONTRACT, type LeaguePeriod } from "lib/rosterScheduleOptimizer/futureImpact";
import type { PlanIntent, PlanStep, PlanningData, PlanningPlayer, PlanningSnapshot, PlanningWorkspace } from "lib/rosterScheduleOptimizer/planningTypes";
import { compactBridgeForecasts, jsonUtf8Bytes, packPlanningSnapshots, PLANNING_RESPONSE_BYTE_BUDGET, unpackPlanningSnapshots } from "./bridgeForecastWire";
import { buildForgeDailyBridgeForecasts, FORGE_DAILY_BRIDGE_BYTE_BUDGET, FORGE_RESERVE_EXPANDED_BYTE_BUDGET, forgeNativeLine, type ForgeBridgeCapture } from "./forgeDailyBridge";
import { league, now as fixtureNow, seasonId as fixtureSeason } from "./forgeReservePayload.fixture";
import { assembleLaterImpactScenario, buildBasis, fitLaterImpactScenario, LATER_IMPACT_CAPTURE_SOURCE, LATER_IMPACT_SCENARIO_BYTE_BUDGET,
  LATER_IMPACT_SCENARIO_ENVELOPE_MARGIN, laterImpactFromScenario, laterImpactInputFromScenario, laterImpactScenarioEnabled, laterPeriodSource, laterSchedule,
  loadLaterImpactScenario, planningBodyBytes, runTimings, scenarioRowChecksum, scenarioSetChecksum, type RunTiming } from "./laterImpactInputs";
import { decodePlanningDataTransport, encodePlanningDataTransport } from "./planningDataTransport";
import { playerForecastSourcePayloadHash } from "lib/player-forecasts/sourceSnapshot";

// VORP S3: synthetic fixtures only. No production read, Yahoo call, capture or clock other than the fixtures' own.
const SEASON = 20262027;
const WINDOW = { startDate: "2026-11-02", endDate: "2026-11-08" };
const DECISION = "2026-11-01T12:00:00.000Z";
const H = 3600000;
const at = (offset: number, from = DECISION) => new Date(Date.parse(from) + offset).toISOString();
const offline = { offlineFixture: true } as const;
const POLICY = forecastCalendarPolicy(21);
const proof = { runId: "run-1", basis: "verified_release" as const, releaseSha: "b".repeat(40), closureSha256: null };
const runRow = (runId = "run-1", created = "2026-10-31T10:00:00Z", asOf = "2026-10-31") =>
  ({ run_id: runId, as_of_date: asOf, created_at: created, git_sha: "b".repeat(40), external_input_proven: true, proof: { ...proof, runId } });
const TIMINGS = new Map<string, RunTiming>([["run-1", { inputCutoff: "2026-10-31T09:00:00.000Z", reconstruction: false }]]);
const teamIds: Record<string, number> = { AAA: 1, BBB: 2, SSS: 3, RRR: 4 };
const person = (id: string, nhlId: number, team: string, extra: Partial<PlanningPlayer> = {}): PlanningPlayer => ({ id, nhlId, nhlTeamId: teamIds[team],
  rosterRevision: `roster-${id}`, name: id, teamAbbreviation: team, eligiblePositions: ["C"], eligibilityVerified: true, playerClass: "skater",
  availability: "rostered", ownership: null, canDrop: true, holdValue: null, reserveEligibility: ["IR"], ...extra });
const PLAYERS = [person("a", 8001, "AAA"), person("b", 8002, "BBB"), person("s", 8003, "SSS", { availability: "free_agent" }),
  person("g", 8004, "AAA", { eligiblePositions: ["G"], playerClass: "goalie" }), person("r", 8005, "RRR", { availability: "free_agent" })];
const skaterRow = (nhlId: number, team: string, goals: number, extra: Record<string, unknown> = {}) => ({ run_id: "run-1", as_of_date: "2026-10-31",
  horizon_games: 1, game_id: 2026020100 + nhlId % 100, player_id: nhlId, team_id: teamIds[team], opponent_team_id: 9,
  proj_goals_es: goals, proj_goals_pp: 0, proj_goals_pk: null, proj_assists_es: 0.1, proj_assists_pp: 0, proj_assists_pk: null,
  proj_shots_es: 2, proj_shots_pp: 0, proj_shots_pk: null, proj_toi_es_seconds: 900, proj_toi_pp_seconds: 60, proj_toi_pk_seconds: null,
  proj_hits: 1, proj_blocks: 0.5, proj_pim: null, proj_plus_minus: null, conditioning: "unconditional", ...extra });
const goalieRow = (extra: Record<string, unknown> = {}) => ({ run_id: "run-1", as_of_date: "2026-10-31", horizon_games: 1, game_id: 2026020104, goalie_id: 8004,
  team_id: 1, opponent_team_id: 9, starter_probability: 0.6, proj_saves: 25, proj_goals_allowed: 2.5, proj_shots_against: 27.5, proj_win_prob: 0.3,
  proj_shutout_prob: 0.05, conditioning: "unconditional", ...extra });
const observation = (extra: Partial<ForgeBridgeCapture> = {}): ForgeBridgeCapture => ({ startedAt: at(-2 * 60000), completedAt: at(-60000), runs: [runRow()],
  skaters: [skaterRow(8001, "AAA", 0.4), skaterRow(8002, "BBB", 0.25), skaterRow(8003, "SSS", 0.5), skaterRow(8005, "RRR", 0.3)],
  goalies: [goalieRow()], reserves: undefined, ...extra });

// F (fallback, 7 days after the window): AAA plays 9th, 11th; BBB 9th, 12th, 13th; SSS 9th, 11th, 13th; RRR 9th, 12th; 10th, 14th, 15th are off.
const F = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
const F_GAMES: Array<[string, string, string, number]> = [[F[0], "AAA", "BBB", 301], [F[0], "SSS", "RRR", 302], [F[2], "AAA", "SSS", 303],
  [F[3], "BBB", "RRR", 304], [F[4], "SSS", "BBB", 305]];
function scheduleRows(games = F_GAMES, emptyDates = [F[1], F[5], F[6]], fetchedAt = "2026-11-01T06:00:00Z") {
  const days = [...new Set(games.map(([date]) => date))];
  return games.flatMap(([date, home, away, id], index) => {
    const witness = { version: "nhl-source-days-v1", date, gameIds: games.filter(item => item[0] === date).map(item => 2026020000 + item[3]),
      emptyDates: date === days[0] ? emptyDates : [] };
    return [[home, away, "home"], [away, home, "away"]].map(([team, opponent, side], offset) => ({ id: index * 2 + offset + 1,
      source_game_id: 2026020000 + id, source_season_id: SEASON, game_type: 2, game_date: date, start_time: `${date}T23:00:00Z`, game_status: "FUT",
      schedule_status: "OK", is_countable: true, team_abbreviation: team, opponent_abbreviation: opponent, home_away: side, fetched_at: fetchedAt,
      source_metadata: { scheduleCoverage: witness } }));
  });
}
const SPAN = { startDate: F[0], endDate: "2026-11-21" };
const schedule = (rows = scheduleRows()) => laterSchedule(rows, SEASON, SPAN, undefined, new Date(at(-30000)));
const WEEKS = [1, 2, 3, 4, 5, 6].map(week => ({ id: week, game_key: "465", season: "2026", week,
  start_date: new Date(Date.parse("2026-10-05T00:00:00Z") + (week - 1) * 7 * 86400000).toISOString().slice(0, 10),
  end_date: new Date(Date.parse("2026-10-11T00:00:00Z") + (week - 1) * 7 * 86400000).toISOString().slice(0, 10) }))
  .concat([{ id: 30, game_key: "465", season: "2026", week: 30, start_date: "2027-04-05", end_date: "2027-04-11" }]);
const args = (extra: Partial<Parameters<typeof assembleLaterImpactScenario>[0]> = {}) => ({ query: { seasonId: SEASON, ...WINDOW }, players: PLAYERS,
  weekRows: WEEKS, calendarPolicy: POLICY, membershipAsOf: at(-H), rosterRevision: "roster-rev", observation: observation(), ...extra });
const scenario = (extra: Partial<Parameters<typeof assembleLaterImpactScenario>[0]> = {}, timings = TIMINGS, decisionAsOf = DECISION,
  read: CapturedLaterImpactScenario["schedule"] = schedule()) =>
  assembleLaterImpactScenario(args(extra), timings, read, decisionAsOf);

const intent: PlanIntent = { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any",
  goalieSplit: "mon_thu", alternativeCount: 5 };
const step = (id: string, playerId: string, dropPlayerId?: string): PlanStep => ({ id, type: "add", playerId, dropPlayerId, at: DECISION, effectiveAt: DECISION,
  conditional: false, dependsOn: [] });
const STEPS = [step("add-s", "s", "b")];
function snapshotFor(roster = ["a", "b"], players = PLAYERS, extra: Partial<PlanningSnapshot> = {}): PlanningSnapshot {
  return { id: "weekly", context: { provider: "manual", seasonId: SEASON, leagueId: "L1", teamId: "t", ...WINDOW, timeZone: "UTC", asOf: DECISION },
    players, roster: roster.map(playerId => ({ playerId, position: "active" as const })), games: [], forecasts: [], lockedAssignments: [], realized: {}, opponent: null,
    rules: { lineupMode: "daily", rosterSlots: { C: 2, UTIL: 1, G: 1, BN: 2, IR: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "w", start: "2026-11-01T00:00:00Z", end: "2026-11-09T00:00:00Z", remaining: 4, source: "manager" }],
      scoring: { mode: "points", weights: { GOALS: 1, SHOTS_ON_GOAL: 0.1 }, categories: [] },
      goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] },
    evidence: { schedule: { source: "weekly", asOf: at(-H), seasonId: SEASON, completeness: "complete", limitations: [] } }, ...extra };
}
const actual = (id: string, startDate: string, endDate: string, leagueKey = "L1"): LeaguePeriod => ({ id, leagueKey, seasonId: SEASON, startDate, endDate });
const evaluate = (payload: LaterImpactScenarioPayload | undefined, snap = snapshotFor(), steps = STEPS, options: { leaguePeriods?: LeaguePeriod[] } = {}) =>
  laterImpactFromScenario(payload, snap, intent, steps, { ...offline, ...options });
/** Independent oracle: every skater plays every one of his team's F games (two C slots and a UTIL), GOALS + 0.1 × SOG a game. */
const perGame = (goals: number) => goals + 0.1 * 2;
const games = (team: string, dates = F) => F_GAMES.filter(([date, home, away]) => dates.includes(date) && (home === team || away === team)).length;

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("flag", () => {
  it("is off unless RSO_LATER_IMPACT_SCENARIO is exactly 'on'", () => {
    expect(laterImpactScenarioEnabled({})).toBe(false);
    for (const value of ["", "off", "ON", "1", "true", "yes"]) expect(laterImpactScenarioEnabled({ RSO_LATER_IMPACT_SCENARIO: value })).toBe(false);
    expect(laterImpactScenarioEnabled({ RSO_LATER_IMPACT_SCENARIO: "on" })).toBe(true);
  });
  it("keeps the app path on scenario_contract_not_accepted before reading any input", () => {
    expect(LATER_IMPACT_CONTRACT.accepted).toBe(false);
    const result = laterImpactFromScenario(scenario(), snapshotFor(), intent, STEPS);
    expect(result).toMatchObject({ state: "scenario_contract_not_accepted", delta: null, arms: null, provenance: [] });
    expect(laterImpactFromScenario(undefined, snapshotFor(), intent, STEPS).state).toBe("scenario_contract_not_accepted");
  });
});

describe("checksums (documented scheme)", () => {
  it("hashes the canonical identity, native components and source-row hash; the set is order independent", () => {
    const identity = { runId: "run-1", slateDate: "2026-10-31", basisGameId: "1", playerId: "a", horizonGames: 1, components: ["SHOTS_ON_GOAL", "GOALS"] };
    const sum = scenarioRowChecksum(identity, { GOALS: 0.4, SHOTS_ON_GOAL: 2 }, "f".repeat(64));
    expect(sum).toBe(playerForecastSourcePayloadHash({ identity: { ...identity, components: ["GOALS", "SHOTS_ON_GOAL"] },
      components: { SHOTS_ON_GOAL: 2, GOALS: 0.4 }, sourceRowHash: "f".repeat(64) }));
    expect(scenarioRowChecksum({ ...identity, components: ["GOALS", "SHOTS_ON_GOAL"] }, { SHOTS_ON_GOAL: 2, GOALS: 0.4 }, "f".repeat(64))).toBe(sum);
    expect(scenarioRowChecksum(identity, { GOALS: 0.41, SHOTS_ON_GOAL: 2 }, "f".repeat(64))).not.toBe(sum);
    const other = { identity: { ...identity, playerId: "b" }, checksum: "c".repeat(64) }, mine = { identity, checksum: sum };
    expect(scenarioSetChecksum([mine, other])).toBe(scenarioSetChecksum([other, mine]));
    expect(scenarioSetChecksum([mine])).not.toBe(scenarioSetChecksum([mine, other]));
  });
  it("binds every selected row in one receipt, completed before the decision, with per-row and set checksums", () => {
    const payload = scenario();
    const capture = payload.capture!;
    expect(capture).toMatchObject({ kind: "observed_capture", trustedSource: LATER_IMPACT_CAPTURE_SOURCE, startedAt: at(-120000), completedAt: at(-60000),
      bindings: { runSucceeded: true, admission: true, identity: true, conditioning: true, proof: true } });
    expect(capture.id).toMatch(/^observed_capture:[a-f0-9]{32}$/);
    expect(Date.parse(capture.completedAt)).toBeLessThanOrEqual(Date.parse(payload.decisionAsOf));
    expect(capture.rows.map(row => row[0])).toEqual(payload.basis.rows.map(row => row[0]));
    expect(capture.rows.map(row => row[5])).toEqual(payload.basis.rows.map(row => row[7]));
    const row = payload.basis.rows.find(item => item[0] === "a")!;
    const keys = payload.basis.componentSets[row[4]];
    expect(row[8]).toBe(playerForecastSourcePayloadHash(skaterRow(8001, "AAA", 0.4)));
    expect(row[7]).toBe(scenarioRowChecksum({ runId: "run-1", slateDate: "2026-10-31", basisGameId: "2026020101", playerId: "a", horizonGames: 1, components: keys },
      Object.fromEntries(keys.map((key, index) => [key, row[5][index]])), row[8]));
  });
});

describe("§2 the later period F", () => {
  it("treats game-key-only matchup weeks as no league period: the labelled 7-day fallback, never a league week", () => {
    const source = laterPeriodSource(WEEKS);
    expect(source).toMatchObject({ source: "yahoo_matchup_weeks", leagueKey: null, gameKeys: ["465"], rows: [],
      season: { id: SEASON, startDate: "2026-10-05", endDate: "2027-04-11" } });
    const result = evaluate(scenario());
    expect(result.period).toMatchObject({ kind: "assumed", label: "assumed period, not league-confirmed", dates: F });
    expect(result).toMatchObject({ state: "complete_with_assumptions", assumptions: ["assumed_period_not_league_confirmed"] });
    expect(scenario().limitations).toContain("Matchup weeks carry no league identity, so F is the assumed 7 days after the window.");
  });
  it("uses a league-keyed week that matches the workspace exactly, and refuses one from another league", () => {
    // Week 5 is the window; week 6 is F.
    const keyed = WEEKS.map(row => ({ ...row, league_key: "L1" }));
    const match = evaluate(scenario({ weekRows: keyed }));
    expect(match.period).toMatchObject({ kind: "actual", periodId: "6", dates: F });
    expect(match.state).toBe("complete");
    const other = evaluate(scenario({ weekRows: keyed.map(row => ({ ...row, league_key: "L2" })) }));
    expect(other).toMatchObject({ state: "unknown", reasons: ["league_identity_mismatch"], delta: null });
    // Mixed identities are no single league's periods: no actual period, so the fallback (labelled).
    const mixed = keyed.map((row, index) => ({ ...row, league_key: index ? "L1" : "L2" }));
    expect(laterPeriodSource(mixed).leagueKey).toBeNull();
  });
  it("keeps a known actual period that is ineligible instead of swapping in the fallback", () => {
    const later = evaluate(scenario(), snapshotFor(), STEPS, { leaguePeriods: [actual("w9", "2026-11-09", "2026-11-22")] });
    expect(later).toMatchObject({ state: "outside_scenario_horizon", reasons: ["beyond_calendar_policy"] });
    expect(later.period).toMatchObject({ kind: "actual", periodId: "w9" });
    expect(later.period!.dates).toHaveLength(14);
  });
  it("is outside the bound when the captured 14-day policy cannot reach F, and inside it with 21", () => {
    expect(evaluate(scenario({ calendarPolicy: forecastCalendarPolicy(14) }))).toMatchObject({ state: "outside_scenario_horizon", reasons: ["beyond_calendar_policy"] });
    expect(scenario({ calendarPolicy: forecastCalendarPolicy(14) }).calendarPolicy.calendarDays).toBe(14);
    expect(evaluate(scenario()).claims.withinBound).toBe(true);
  });
  it("is unknown without season bounds, and outside the horizon across the season boundary", () => {
    expect(evaluate(scenario({ weekRows: [] }))).toMatchObject({ state: "unknown", reasons: ["season_bounds_unavailable"] });
    const short = WEEKS.slice(0, 1).map(row => ({ ...row, end_date: "2026-11-12" }));
    expect(evaluate(scenario({ weekRows: short }))).toMatchObject({ state: "outside_scenario_horizon", reasons: ["season_boundary"] });
  });
  it("is bound to the window, season and time zone it was built for", () => {
    const payload = scenario();
    expect(evaluate(payload, snapshotFor(["a", "b"], PLAYERS, { context: { ...snapshotFor().context, endDate: "2026-11-07" } }))).toMatchObject({ reasons: ["window_mismatch"] });
    expect(evaluate({ ...payload, timeZone: "America/New_York" })).toMatchObject({ state: "unknown", reasons: ["time_zone_mismatch"] });
    expect(evaluate({ ...payload, season: { ...payload.season!, id: 20252026 } })).toMatchObject({ reasons: ["season_mismatch"] });
  });
});

describe("§2.5 F's schedule, read as separate evidence", () => {
  it("reads only after the window, leaving the window's games untouched, and verifies off days per date", () => {
    const read = schedule();
    expect(read.games.every(game => game.date > WINDOW.endDate)).toBe(true);
    expect(read.verifiedDates).toEqual(expect.arrayContaining(F));
    const snap = snapshotFor();
    const before = JSON.stringify(snap);
    const result = evaluate(scenario({}, TIMINGS, DECISION, read), snap);
    expect(JSON.stringify(snap)).toBe(before);
    expect(result.state).toBe("complete_with_assumptions");
    // ΔF = (s − b) over their F games, each playing all of them; a cancels.
    expect(result.delta!.points).toBeCloseTo(games("SSS") * perGame(0.5) - games("BBB") * perGame(0.25), 6);
    expect(result.arms!.plan.coverage.noGamePlayers).toEqual([]);
    expect(result.claims).toMatchObject({ withinBound: true, scenarioInputsComplete: true, nativeForecasts: false, basis: "rate_scenario" });
    expect(result.claims.label).toMatch(/not native F forecasts/);
  });
  it("is incomplete when one F date's coverage is unverified, but a verified off day is not missing", () => {
    const missing = evaluate(scenario({}, TIMINGS, DECISION, schedule(scheduleRows(F_GAMES, [F[1], F[5]]))));
    expect(missing).toMatchObject({ state: "unknown", reasons: ["schedule_incomplete"], delta: null });
    const offOnly = scenario({}, TIMINGS, DECISION, schedule(scheduleRows(F_GAMES.filter(([, home, away]) => home !== "BBB" && away !== "BBB"), [F[1], F[3], F[4], F[5], F[6]])));
    const result = evaluate(offOnly, snapshotFor(["a", "b"]), []);
    expect(result.arms!.noMove.coverage.noGamePlayers).toEqual(["b"]);
    expect(result.state).toBe("complete_with_assumptions");
  });
  it("is unknown when the schedule could not be read or is stale", () => {
    expect(evaluate(scenario({}, TIMINGS, DECISION, null))).toMatchObject({ state: "unknown", reasons: expect.arrayContaining(["schedule_incomplete"]) });
    const stale = schedule(scheduleRows(F_GAMES, [F[1], F[5], F[6]], "2026-10-30T20:00:00Z"));
    expect(stale.verifiedDates).toEqual([]);
  });
});

describe("§3 timing, witness and selection", () => {
  it("is eligible with a pre-decision capture, saving full provenance", () => {
    const result = evaluate(scenario());
    const a = result.provenance.find(item => item.playerId === "a")!;
    expect(a).toMatchObject({ runId: "run-1", slateDate: "2026-10-31", basisGameId: "2026020101", teamAbbreviation: "AAA", seasonId: SEASON,
      issuedAt: "2026-10-31T10:00:00.000Z", inputCutoff: "2026-10-31T09:00:00.000Z", reconstruction: false, conditioning: "unconditional",
      witness: { kind: "observed_capture", label: "observed available by", availableAt: at(-60000), trustedSource: LATER_IMPACT_CAPTURE_SOURCE } });
    expect(a.modelVersion).toBe(`forge-daily-bridge-v1:${"b".repeat(40)}`);
  });
  it("never backdates: a capture completed after the decision is not a witness for it", () => {
    const late = evaluate(scenario({}, TIMINGS, at(-90000)));
    expect(late.state).toBe("temporal_provenance_unavailable");
    expect(late.reasons).toEqual(expect.arrayContaining(["plan:capture_after_decision:a", "plan:capture_after_decision:s"]));
    expect(late.delta).toBeNull();
  });
  it("refuses a capture that covers only part of the selected rows", () => {
    const payload = scenario();
    const partial = { ...payload, capture: { ...payload.capture!, rows: payload.capture!.rows.filter(row => row[0] !== "s") } };
    const result = evaluate(partial);
    expect(result.state).toBe("temporal_provenance_unavailable");
    expect(result.reasons).toEqual(expect.arrayContaining(["plan:row_not_in_capture:s", "set_checksum_mismatch"]));
  });
  it("detects changed bytes after capture: a row checksum and the set checksum", () => {
    const payload = scenario();
    const rows = payload.basis.rows.map(row => row[0] === "s" ? [...row.slice(0, 5), row[5].map(value => value === 0.5 ? 0.9 : value), ...row.slice(6)] as typeof row : row);
    const changed = evaluate({ ...payload, basis: { ...payload.basis, rows } });
    expect(changed.state).toBe("temporal_provenance_unavailable");
    expect(changed.reasons).toEqual(expect.arrayContaining(["plan:checksum_mismatch:s", "row_checksum_changed:s"]));
    const receipt = { ...payload.capture!, setChecksum: "0".repeat(64) };
    expect(evaluate({ ...payload, capture: receipt }).reasons).toEqual(expect.arrayContaining(["plan:missing_set_checksum:a", "set_checksum_mismatch"]));
    // A later same-key overwrite: the bridge re-read gives new bytes, so the new capture's checksum differs from the saved one.
    const overwrite = scenario({ observation: observation({ skaters: [skaterRow(8001, "AAA", 0.45), ...observation().skaters.slice(1)] }) });
    expect(overwrite.basis.rows[0][7]).not.toBe(payload.basis.rows[0][7]);
  });
  it("has no witness without a capture, and keeps every reason code together", () => {
    const none = scenario({ observation: null });
    expect(none.capture).toBeNull();
    expect(evaluate(none)).toMatchObject({ state: "unknown" });
    const stale = new Map([["run-1", { inputCutoff: "2026-10-20T00:00:00.000Z", reconstruction: false }]]);
    const several = evaluate(scenario({}, stale, at(-90000)));
    expect(several.state).toBe("temporal_provenance_unavailable");
    expect(several.reasons).toEqual(expect.arrayContaining(["plan:capture_after_decision:s", "plan:input_age_exceeded:s"]));
  });
  it("excludes reconstruction runs, and an unrecorded replay classification or cutoff is never guessed", () => {
    const rebuilt = evaluate(scenario({}, new Map([["run-1", { inputCutoff: "2026-10-31T09:00:00.000Z", reconstruction: true }]])));
    expect(rebuilt.state).toBe("unknown");
    expect(rebuilt.reasons).toContain("plan:historical_reconstruction_excluded:s");
    const unrecorded = evaluate(scenario({}, new Map()));
    expect(unrecorded.state).toBe("temporal_provenance_unavailable");
    expect(unrecorded.reasons).toEqual(expect.arrayContaining(["plan:replay_classification_unknown:s", "plan:missing_timestamp:s"]));
    expect(runTimings([{ entity_key: "x", input_cutoff: "2026-10-31T09:00:00Z", replay_classification: "captured_live" },
      { entity_key: "x", input_cutoff: "2026-10-31T08:00:00Z", replay_classification: "captured_live" }]).get("x")).toEqual({ inputCutoff: null, reconstruction: false });
    expect(runTimings([{ entity_key: "y", input_cutoff: "2026-10-31T09:00:00Z", replay_classification: "historical_reconstruction" }]).get("y"))
      .toEqual({ inputCutoff: "2026-10-31T09:00:00.000Z", reconstruction: true });
  });
  it("selects each player's newest line by issue time, run and basis game, never by slate order", () => {
    const runs = [runRow("run-1", "2026-10-31T10:00:00Z", "2026-11-02"), runRow("run-2", "2026-10-31T11:00:00Z", "2026-10-30")];
    const built = buildBasis(observation({ runs, skaters: [skaterRow(8001, "AAA", 0.4), { ...skaterRow(8001, "AAA", 0.7), run_id: "run-2", game_id: 2026020099 }] }), PLAYERS, TIMINGS);
    const row = built.basis.rows.find(item => item[0] === "a")!;
    expect(built.basis.runs[row[1]].runId).toBe("run-2");
    expect(row[2]).toBe("2026020099");
  });
  it("keeps the saved decision clock on reload", () => {
    const payload = JSON.parse(JSON.stringify(scenario()));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T13:00:00Z"));
    const first = JSON.stringify(evaluate(payload));
    vi.setSystemTime(new Date("2026-12-25T00:00:00Z"));
    expect(JSON.stringify(evaluate(payload))).toBe(first);
    expect(JSON.parse(first).decisionAsOf).toBe(DECISION);
  });
});

describe("§4–§5 rates, membership and states", () => {
  it("is unknown for a source row without a conditioning tag (today's FORGE lineup rows have none)", () => {
    const untagged = scenario({ observation: observation({ skaters: observation().skaters.map(({ conditioning: _tag, ...row }) => row) }) });
    expect(untagged.basis.rows.filter(row => row[0] !== "g").every(row => row[6] === null)).toBe(true);
    const result = evaluate(untagged);
    expect(result.state).toBe("unknown");
    expect(result.reasons).toEqual(expect.arrayContaining(["plan:conditioning_unknown:a", "no_move:conditioning_unknown:b"]));
  });
  it("is unknown after a trade: a basis row from another team, or a team change since the decision", () => {
    const traded = scenario({ observation: observation({ skaters: [skaterRow(8001, "AAA", 0.4), { ...skaterRow(8002, "BBB", 0.25), team_id: 3 }, skaterRow(8003, "SSS", 0.5)] }) });
    expect(evaluate(traded).reasons).toContain("no_move:team_mismatch:b");
    const moved = PLAYERS.map(item => item.id === "a" ? { ...item, teamAbbreviation: "RRR" } : item);
    expect(evaluate(scenario(), snapshotFor(["a", "b"], moved)).reasons).toEqual(expect.arrayContaining(["plan:team_mismatch:a", "no_move:team_mismatch:a"]));
  });
  it("is unknown when a boundary player has no verified membership", () => {
    const unverified = scenario({ players: PLAYERS.map(item => item.id === "b" ? { ...item, rosterRevision: undefined } : item) });
    expect(unverified.membership.teams.b).toBeUndefined();
    expect(evaluate(unverified).reasons).toContain("no_move:membership_unverified:b");
  });
  it("plans a reserve line as a labelled conservative zero beside its kept conditional line; a lineup line wins over it", () => {
    const reserve = { ...skaterRow(8003, "SSS", 0.5), player_class: "skater", conditioning: "if_dressed", reserve_reason: "not_in_lineup" };
    const onlyReserve = scenario({ observation: observation({ skaters: observation().skaters.filter(row => row.player_id !== 8003), reserves: [reserve] }) });
    const result = evaluate(onlyReserve);
    expect(result.state).toBe("complete_with_assumptions");
    expect(result.assumptions).toContain("reserve_conservative_zero:s");
    expect(result.arms!.plan.conditionalLines.s.GOALS).toBe(0.5);
    expect(result.delta!.points).toBeCloseTo(-games("BBB") * perGame(0.25), 6);
    const both = scenario({ observation: observation({ reserves: [reserve] }) });
    expect(both.basis.rows.find(row => row[0] === "s")![9]).toBe(false);
    // A missing line is not a reserve zero: it is unknown.
    const missing = scenario({ observation: observation({ skaters: observation().skaters.filter(row => row.player_id !== 8003) }) });
    expect(evaluate(missing)).toMatchObject({ state: "unknown", delta: null });
  });
  it("keeps goalies conditional: no start extrapolation and no number", () => {
    const result = evaluate(scenario(), snapshotFor(["a", "b", "g"]));
    expect(result.state).toBe("conditional");
    expect(result.delta).toBeNull();
    expect(result.reasons).toEqual(expect.arrayContaining(["plan:conditional_line:g", "no_move:conditional_line:g"]));
    const line = forgeNativeLine(goalieRow(), "goalie")!;
    expect(line).not.toHaveProperty("GAMES_STARTED");
    expect(line).not.toHaveProperty("GOALIE_MINUTES");
  });
  it("carries native units and nulls, with no season-rate substitutes", () => {
    const payload = scenario();
    const keys = payload.basis.componentSets[payload.basis.rows[0][4]];
    const values = Object.fromEntries(keys.map((key, index) => [key, payload.basis.rows[0][5][index]]));
    expect(values).toMatchObject({ GOALS: 0.4, TIME_ON_ICE_PER_GAME: 16, PENALTY_MINUTES: null, PLUS_MINUS: null, FACEOFFS_WON: null });
    expect(payload.basis.units).toMatchObject({ TIME_ON_ICE_PER_GAME: "minutes", GOALS: "count" });
    // A league that scores a stat FORGE does not project is unknown, never filled.
    const pim = snapshotFor(); pim.rules.scoring.weights = { GOALS: 1, PENALTY_MINUTES: 0.5 };
    expect(evaluate(payload, pim)).toMatchObject({ state: "unknown", delta: null });
  });
});

describe("§8 schema, storage and byte budgets", () => {
  it("validates strictly and round-trips through wire, save, export, pack and old snapshots", () => {
    const payload = scenario();
    expect(laterImpactScenarioSchema.parse(payload)).toEqual(payload);
    expect(() => laterImpactScenarioSchema.parse({ ...payload, extra: 1 })).toThrow();
    expect(() => laterImpactScenarioSchema.parse({ ...payload, basis: { ...payload.basis, rows: [[...payload.basis.rows[0], "x"]] } })).toThrow();
    const withheld = fitLaterImpactScenario(payload, PLANNING_RESPONSE_BYTE_BUDGET - LATER_IMPACT_SCENARIO_ENVELOPE_MARGIN - 1000)!;
    expect(withheld.status).toBe("withheld");
    expect(laterImpactScenarioSchema.parse(withheld)).toEqual(withheld);
    // Snapshot: old (absent) and new (present) both valid; JSON export, pack and unpack keep it byte for byte.
    const old = snapshotFor();
    expect(snapshotSchema.parse(old)).toEqual(old);
    const saved = { ...old, laterImpactScenario: payload } as PlanningSnapshot;
    expect(snapshotSchema.parse(saved)).toEqual(saved);
    const exported = JSON.parse(JSON.stringify(saved));
    expect(snapshotSchema.parse(exported)).toEqual(saved);
    expect(unpackPlanningSnapshots(packPlanningSnapshots(exported))).toEqual(exported);
    const workspace: PlanningWorkspace = { version: 1, context: old.context, rules: old.rules, roster: old.roster, intent: { ...intent, objective: "outcome" },
      manualPlayers: [], unresolvedNames: [], realized: {}, opponent: null };
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: exported, expectedVersion: null }).success).toBe(true);
    expect(evaluate((snapshotSchema.parse(exported) as PlanningSnapshot & { laterImpactScenario?: LaterImpactScenarioPayload }).laterImpactScenario).state)
      .toBe("complete_with_assumptions");
    // An old snapshot has no scenario: later impact is unknown.
    expect(evaluate((old as PlanningSnapshot & { laterImpactScenario?: LaterImpactScenarioPayload }).laterImpactScenario))
      .toMatchObject({ state: "unknown", reasons: ["scenario_unavailable"] });
    // Planning transport: the scenario rides as an optional field; old responses without it still decode.
    const data: PlanningData = { players: PLAYERS, games: [], forecasts: [], evidence: {} };
    const decoded = decodePlanningDataTransport(JSON.parse(JSON.stringify(encodePlanningDataTransport({ ...data, laterImpactScenario: payload } as PlanningData))));
    expect((decoded as PlanningData & { laterImpactScenario?: unknown }).laterImpactScenario).toEqual(payload);
    expect(decodePlanningDataTransport(JSON.parse(JSON.stringify(encodePlanningDataTransport(data))))).toEqual(data);
    expect(() => encodePlanningDataTransport({ ...data, laterImpactScenario: { ...payload, version: "v0" } } as unknown as PlanningData)).toThrow();
    // Never a GameForecast or native revision.
    expect(JSON.stringify(payload)).not.toMatch(/"allowedUses"|"revisionId"|"scenarioUse"|"forecasts"/);
  });
  it("discloses truncation and withholds the number when the scenario cannot fit", () => {
    const payload = scenario();
    const bytes = jsonUtf8Bytes(payload);
    expect(fitLaterImpactScenario(payload, 1_000_000)).toBe(payload);
    const tight = PLANNING_RESPONSE_BYTE_BUDGET - LATER_IMPACT_SCENARIO_ENVELOPE_MARGIN - bytes;
    expect(fitLaterImpactScenario(payload, tight - 100)).toBe(payload);
    const truncated = fitLaterImpactScenario(payload, tight)!;
    expect(truncated).toEqual({ version: "rso-later-impact-scenario-v1", status: "withheld", contract: { name: "rso-later-impact-rate-scenario", version: "v2" },
      reasons: ["scenario_payload_truncated"], decisionAsOf: DECISION });
    expect(evaluate(truncated)).toMatchObject({ state: "unknown", reasons: ["scenario_payload_truncated"], delta: null, arms: null });
    // No room even for the notice: nothing is attached (unknown), and the bridge wire is never trimmed for it.
    expect(fitLaterImpactScenario(payload, PLANNING_RESPONSE_BYTE_BUDGET - LATER_IMPACT_SCENARIO_ENVELOPE_MARGIN)).toBeUndefined();
    expect(fitLaterImpactScenario(null, 1_000_000)).toMatchObject({ status: "withheld", reasons: ["scenario_read_failed"] });
  });
  it("fits a production-shaped full catalog beside the bridge wire inside every limit, measured", () => {
    const { players, games: weekGames, inputs } = league(7, "typical");
    const policy = forecastCalendarPolicy(14);
    const bridge = buildForgeDailyBridgeForecasts(inputs, players, weekGames, fixtureNow, fixtureSeason, policy, FORGE_DAILY_BRIDGE_BYTE_BUDGET, FORGE_RESERVE_EXPANDED_BYTE_BUDGET);
    const run: Record<string, any> = { ...inputs.runs[0], proof: { runId: inputs.runs[0].run_id, basis: "verified_release", releaseSha: "a".repeat(40), closureSha256: null } };
    const timings = new Map([[run.run_id as string, { inputCutoff: "2026-10-26T09:00:00.000Z", reconstruction: false }]]);
    // F's schedule shaped like two later weeks of the same league (about 48 games a week, both sides).
    const later = weekGames.map(game => ({ ...game, date: new Date(Date.parse(`${game.date}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10) }));
    const read = { startDate: "2026-11-03", endDate: "2026-11-16", asOf: "2026-10-26T06:00:00.000Z", revision: "a".repeat(64),
      verifiedDates: Array.from({ length: 14 }, (_, day) => new Date(Date.parse("2026-11-03T00:00:00Z") + day * 86400000).toISOString().slice(0, 10)),
      games: [...later, ...later.map(game => ({ ...game, id: `${game.id}9`, date: new Date(Date.parse(`${game.date}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10) }))], limitations: [] };
    const payload = assembleLaterImpactScenario({ query: { seasonId: fixtureSeason, startDate: "2026-10-27", endDate: "2026-11-02" }, players, weekRows: WEEKS,
      calendarPolicy: policy, membershipAsOf: "2026-10-26T11:00:00.000Z", rosterRevision: "r", observation: { startedAt: "2026-10-26T11:58:00.000Z",
        completedAt: "2026-10-26T11:59:00.000Z", runs: [run], skaters: inputs.skaters, goalies: inputs.goalies, reserves: inputs.reserves } },
    timings, read, "2026-10-26T12:00:00.000Z");
    expect(laterImpactScenarioSchema.safeParse(payload).success).toBe(true);
    const scenarioBytes = jsonUtf8Bytes(payload);
    const data: PlanningData = { players, games: weekGames, forecasts: bridge.forecasts, evidence: {} };
    const base = planningBodyBytes(data, fixtureSeason, []);
    const { wire } = compactBridgeForecasts(bridge.forecasts, data, fixtureSeason);
    const expanded = bridge.forecasts.reduce((sum, row) => sum + jsonUtf8Bytes(row) + 1, 0);
    const fitted = fitLaterImpactScenario(payload, base);
    const measured = { basisRows: payload.basis.rows.length, captureRows: payload.capture!.rows.length, membership: Object.keys(payload.membership.teams).length,
      scheduleGames: payload.schedule!.games.length, scenarioBytes, bridgeWireBytes: jsonUtf8Bytes(wire), bridgeExpandedBytes: expanded, baseBodyBytes: base,
      combinedBodyBytes: base + scenarioBytes + 23, margin: LATER_IMPACT_SCENARIO_ENVELOPE_MARGIN,
      packedSnapshotBytes: jsonUtf8Bytes({ ...data, forecasts: [], bridgeForecastWire: wire, laterImpactScenario: payload }),
      // The saved snapshot is validated unpacked; the tightest such check is the 8 MiB preservation backup.
      unpackedSnapshotBytes: expanded + jsonUtf8Bytes(players) + jsonUtf8Bytes(weekGames) + scenarioBytes };
    console.info(`LATER_IMPACT_SCENARIO_BYTES ${JSON.stringify(measured)}`);
    expect(payload.basis.rows.length).toBe(32 * 34);
    expect(scenarioBytes).toBeLessThanOrEqual(LATER_IMPACT_SCENARIO_BYTE_BUDGET);
    expect(measured.bridgeWireBytes).toBeLessThanOrEqual(FORGE_DAILY_BRIDGE_BYTE_BUDGET);
    expect(expanded).toBeLessThanOrEqual(FORGE_RESERVE_EXPANDED_BYTE_BUDGET);
    expect(fitted).toBe(payload);
    expect(measured.combinedBodyBytes + LATER_IMPACT_SCENARIO_ENVELOPE_MARGIN).toBeLessThanOrEqual(PLANNING_RESPONSE_BYTE_BUDGET);
    expect(measured.packedSnapshotBytes + LATER_IMPACT_SCENARIO_ENVELOPE_MARGIN).toBeLessThanOrEqual(WORKSPACE_SAVE_BYTE_BUDGET);
    expect(measured.unpackedSnapshotBytes).toBeLessThan(8 * 1024 * 1024 - 1_500_000);
  });
});

describe("the server-side build", () => {
  function db(tables: Record<string, Record<string, unknown>[]>, fail: string[] = []) {
    const calls: Array<{ table: string; filters: Array<[string, string, unknown]> }> = [];
    return { calls, db: { from: (table: string) => {
      const filters: Array<[string, string, unknown]> = [];
      calls.push({ table, filters });
      let start = 0, end = Infinity;
      const rows = () => (tables[table] ?? []).filter(row => filters.every(([method, column, value]) => method === "eq" ? row[column] === value
        : method === "in" ? (value as unknown[]).includes(row[column]) : method === "gte" ? String(row[column]) >= String(value) : String(row[column]) <= String(value)));
      const chain: any = new Proxy({}, { get: (_, method) => method === "then" ? (resolve: (value: unknown) => void) => resolve(fail.includes(table)
        ? { data: null, count: null, error: { message: "fixture failure" } } : { data: rows().slice(start, end + 1), count: rows().length, error: null })
        : (...values: any[]) => {
          if (["eq", "in", "gte", "lte"].includes(String(method))) filters.push([String(method), values[0], values[1]]);
          if (method === "range") [start, end] = values;
          return chain;
        } });
      return chain;
    } } as never };
  }
  const observations = [{ id: "o1", provider: "forge", dataset_key: "forge-run-inputs-v1", entity_key: "run-1",
    input_cutoff: "2026-10-31T09:00:00Z", replay_classification: "captured_live" }];
  it("reads F's schedule separately after the window, then fixes the decision clock after every read", async () => {
    const { db: client, calls } = db({ player_forecast_source_observations: observations, roster_optimizer_team_games: scheduleRows() });
    const ticks = [at(-30000), at(-30000), DECISION];
    const payload = await loadLaterImpactScenario(client, { ...args(), deadline: Date.now() + 5000 }, () => new Date(ticks.shift() ?? DECISION));
    const scheduleRead = calls.find(call => call.table === "roster_optimizer_team_games")!;
    expect(scheduleRead.filters).toEqual(expect.arrayContaining([["gte", "game_date", "2026-11-08"], ["eq", "source_season_id", SEASON]]));
    expect(payload.decisionAsOf).toBe(DECISION);
    expect(Date.parse(payload.decisionAsOf)).toBeGreaterThanOrEqual(Date.parse(payload.capture!.completedAt));
    expect(payload.basis.runs[0]).toMatchObject({ inputCutoff: "2026-10-31T09:00:00.000Z", reconstruction: false });
    expect(payload.schedule!.verifiedDates).toEqual(expect.arrayContaining(F));
    expect(evaluate(payload).state).toBe("complete_with_assumptions");
  });
  it("keeps going with honest gaps when timing or schedule reads fail", async () => {
    const { db: client } = db({}, ["player_forecast_source_observations", "roster_optimizer_team_games"]);
    const payload = await loadLaterImpactScenario(client, { ...args(), deadline: Date.now() + 5000 }, () => new Date(DECISION));
    expect(payload.schedule).toBeNull();
    expect(payload.limitations).toEqual(expect.arrayContaining(["Run timing evidence could not be read.", "The later-period schedule could not be read."]));
    expect(evaluate(payload).state).toBe("unknown");
  });
});
