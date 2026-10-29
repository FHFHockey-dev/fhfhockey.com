import { afterEach, describe, expect, it, vi } from "vitest";
import { forecastCalendarPolicy } from "../player-forecasts/contributions";
import { boundaryRosters, evaluateLaterImpact, laterImpactForApp, LATER_IMPACT_CONTRACT, MAX_SOURCE_AGE_MS, resolveLaterPeriod, selectSourceRow,
  sourceTiming, weakerState, type CaptureReceipt, type LaterImpactInput, type LeaguePeriod, type ScenarioSourceRow } from "./futureImpact";
import { evaluatePlan, evaluateScenarioPlan, forecastAllows, LATER_IMPACT_USE, planRoster } from "./planning";
import type { GameForecast, PlanStep, PlanningGame, PlanningPlayer, PlanningSnapshot, StatLine } from "./planningTypes";

// Synthetic fixtures only (VORP S2): no data loading, no native forecasts, no clock reads by the engine.
const D = "2026-11-01T12:00:00Z";
const H = 3600000;
const at = (offsetMs: number, from = D) => new Date(Date.parse(from) + offsetMs).toISOString();
const offline = { offlineFixture: true } as const;
const SEASON = { id: 20262027, startDate: "2026-10-07", endDate: "2027-04-15" };
const period = (id: string, startDate: string, endDate: string, extra: Partial<LeaguePeriod> = {}): LeaguePeriod =>
  ({ id, leagueKey: "L1", seasonId: SEASON.id, startDate, endDate, ...extra });
const PERIODS = [period("w1", "2026-11-02", "2026-11-08"), period("w2", "2026-11-09", "2026-11-15"), period("w3", "2026-11-16", "2026-11-22")];
const F = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];

const skater = (id: string, team: string, positions = ["C"], availability: PlanningPlayer["availability"] = "rostered"): PlanningPlayer => ({
  id, nhlId: null, name: id, teamAbbreviation: team, eligiblePositions: positions, eligibilityVerified: true, playerClass: "skater",
  availability, ownership: null, canDrop: true, holdValue: null, reserveEligibility: ["IR"] });
const goalie = (id: string, team: string): PlanningPlayer => ({ ...skater(id, team, ["G"]), playerClass: "goalie" });
const game = (team: string, date: string): PlanningGame => ({ id: `${team}-${date}`, scheduleRevision: "s1", date,
  startsAt: `${date}T23:00:00Z`, teamAbbreviation: team, opponent: "X", home: true, status: "scheduled" });
// F schedule: A on 9th and 11th; B on 9th and 10th; D on 9th; S on 9th, 10th and 12th; other teams verified off.
const F_GAMES = [game("A", F[0]), game("B", F[0]), game("D", F[0]), game("S", F[0]), game("B", F[1]), game("S", F[1]), game("A", F[2]), game("S", F[3])];
const row = (playerId: string, team: string, components: StatLine, overrides: Partial<ScenarioSourceRow> = {}): ScenarioSourceRow => ({
  playerId, runId: `run-${playerId}`, slateDate: "2026-10-31", basisGameId: `basis-${playerId}`, teamAbbreviation: team, seasonId: SEASON.id,
  checksum: `sum-${playerId}`, modelVersion: "forge-fixture", bridgeVersion: "bridge-fixture",
  admission: { succeeded: true, public: true, released: true, horizonGames: 1, exclusionProof: true },
  timing: { inputCutoff: at(-30 * H), issuedAt: at(-26 * H), reconstruction: false }, witness: { kind: "observed_capture", receiptId: "cap-1" },
  conditioning: "unconditional", components, units: Object.fromEntries(Object.keys(components).map(key => [key, "count"])), ...overrides });

function snapshot(): PlanningSnapshot {
  const players = [skater("a", "A"), skater("b", "B"), skater("d", "D", ["D"]), skater("s", "S", ["C"], "free_agent"),
    skater("s2", "T", ["C"], "free_agent"), skater("x", "X")];
  return { id: "weekly", context: { provider: "manual", seasonId: SEASON.id, leagueId: "L1", teamId: "t", startDate: "2026-11-02",
    endDate: "2026-11-08", timeZone: "UTC", asOf: D }, players,
  roster: [{ playerId: "a", position: "active" }, { playerId: "b", position: "active" }, { playerId: "d", position: "active" }],
  games: [], forecasts: [], lockedAssignments: [], realized: { pts: 3 }, opponent: null,
  rules: { lineupMode: "daily", rosterSlots: { C: 1, D: 1, UTIL: 1, G: 1, BN: 2, IR: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
    periods: [{ id: "w", start: "2026-11-01T00:00:00Z", end: "2026-11-09T00:00:00Z", remaining: 4, source: "manager" }],
    scoring: { mode: "points", weights: { pts: 1 }, categories: [] },
    goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] },
  evidence: { schedule: { source: "weekly", asOf: at(-H), seasonId: SEASON.id, completeness: "complete", limitations: [] } } };
}
const step = (id: string, playerId: string, dropPlayerId?: string, extra: Partial<PlanStep> = {}): PlanStep =>
  ({ id, type: "add", playerId, dropPlayerId, at: D, effectiveAt: D, conditional: false, dependsOn: [], ...extra });
const RATES = { a: 1, b: 0.5, d: 0.25, s: 2, s2: 4, x: 3 } as Record<string, number>;
function input(overrides: Partial<LaterImpactInput> = {}): LaterImpactInput {
  const data = snapshot();
  return { snapshot: data, intent: { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk",
    goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 5 },
  steps: [step("add-s", "s", "d")],
  period: { window: { startDate: "2026-11-02", endDate: "2026-11-08" }, decisionAsOf: D, season: SEASON, calendarPolicy: forecastCalendarPolicy(21), periods: PERIODS },
  schedule: { startDate: F[0], endDate: F[6], completeness: "complete", offDaysVerified: true, asOf: at(-H), revision: "F-1", games: F_GAMES },
  membership: Object.fromEntries(data.players.map(player => [player.id, { teamAbbreviation: player.teamAbbreviation, verified: true, asOf: at(-2 * H) }])),
  sourceRows: data.players.map(player => row(player.id, player.teamAbbreviation!, { pts: RATES[player.id] })), captures: [], ...overrides };
}
/** A trusted pre-decision observed capture of exactly these rows (contract v2 §3). */
const capture = (id: string, rows: ScenarioSourceRow[], completedAt = at(-25 * H), extra: Partial<CaptureReceipt> = {}): CaptureReceipt => ({
  id, kind: "observed_capture", trustedSource: "fixture-server-reader", startedAt: at(-60_000, completedAt), completedAt,
  rows: rows.map(item => ({ runId: item.runId, slateDate: item.slateDate, basisGameId: item.basisGameId, playerId: item.playerId,
    horizonGames: item.admission.horizonGames, components: Object.keys(item.components), checksum: item.checksum })),
  setChecksum: `set-${id}`, bindings: { runSucceeded: true, admission: true, identity: true, conditioning: true, proof: true }, ...extra });
/** Offline engine run; with no captures given, one receipt covers every supplied row. */
const run = (value: LaterImpactInput) => evaluateLaterImpact(value.captures.length ? value : { ...value, captures: [capture("cap-1", value.sourceRows)] }, offline);

/** Independent oracle: exhaustive best daily lineup over C/D/UTIL/G for a frozen roster, summing rate × assigned games. */
function oracle(rosterIds: string[], rates: Record<string, number>, slots = ["C", "D", "UTIL"]) {
  const players = new Map(snapshot().players.map(player => [player.id, player]));
  const fits = (id: string, slot: string) => slot === "UTIL" ? !players.get(id)!.eligiblePositions.includes("G") : players.get(id)!.eligiblePositions.includes(slot);
  let total = 0;
  for (const date of F) {
    const playing = rosterIds.filter(id => F_GAMES.some(item => item.date === date && item.teamAbbreviation === players.get(id)!.teamAbbreviation));
    const best = (index: number, used: Set<string>): number => index === slots.length ? 0 : Math.max(best(index + 1, used),
      ...playing.filter(id => !used.has(id) && fits(id, slots[index])).map(id => rates[id] + best(index + 1, new Set([...used, id]))));
    total += best(0, new Set());
  }
  return total;
}

afterEach(() => vi.useRealTimers());

describe("contract gate and app path", () => {
  it("returns scenario_contract_not_accepted by default, before reading any input", () => {
    expect(LATER_IMPACT_CONTRACT.accepted).toBe(false);
    for (const result of [laterImpactForApp(), evaluateLaterImpact(input()), evaluateLaterImpact(null as unknown as LaterImpactInput)]) {
      expect(result).toMatchObject({ state: "scenario_contract_not_accepted", reasons: ["scenario_contract_not_accepted"], delta: null, arms: null, provenance: [] });
    }
  });
  it("orders states weakest-last and lets the delta take the weaker arm", () => {
    expect(weakerState("complete", "complete_with_assumptions")).toBe("complete_with_assumptions");
    expect(weakerState("conditional", "unknown")).toBe("unknown");
    expect(weakerState("stale", "unknown")).toBe("stale");
    expect(weakerState("outside_scenario_horizon", "temporal_provenance_unavailable")).toBe("outside_scenario_horizon");
  });
});

describe("later period F and horizon (§2)", () => {
  const resolve = (overrides: Partial<Parameters<typeof resolveLaterPeriod>[0]> = {}) => resolveLaterPeriod({ ...input().period, timeZone: "UTC", leagueKey: "L1", ...overrides });
  it("passes a near-term actual period", () => {
    expect(resolve()).toMatchObject({ state: "ok", kind: "actual", periodId: "w2", dates: F, bound: { first: "2026-11-01", last: "2026-11-21" } });
  });
  it("gives outside_scenario_horizon for a far-future window even with a fresh source", () => {
    const later = input({ period: { ...input().period, window: { startDate: "2026-11-30", endDate: "2026-12-06" },
      periods: [...PERIODS, period("w6", "2026-12-07", "2026-12-13")] } });
    expect(run(later)).toMatchObject({ state: "outside_scenario_horizon", reasons: ["beyond_calendar_policy"], arms: null, delta: null,
      period: { kind: "actual", periodId: "w6", dates: ["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12", "2026-12-13"] } });
  });
  it("keeps an actual period straddling the bound whole and never swaps in the fallback", () => {
    const result = resolve({ calendarPolicy: forecastCalendarPolicy(14) });
    expect(result).toMatchObject({ state: "outside_scenario_horizon", kind: "actual", periodId: "w2", label: null, dates: F, bound: { last: "2026-11-14" } });
  });
  it("rejects a period across the season boundary", () => {
    expect(resolve({ season: { ...SEASON, endDate: "2026-11-12" } })).toMatchObject({ state: "outside_scenario_horizon", reason: "season_boundary", dates: F });
    expect(resolve({ periods: [period("next", F[0], F[6], { seasonId: 20272028 })] })).toMatchObject({ state: "outside_scenario_horizon", reason: "season_boundary" });
  });
  it("uses the labelled 7-day fallback only when no actual period exists", () => {
    for (const periods of [null, [], [PERIODS[0]]]) expect(resolve({ periods })).toMatchObject({ state: "ok", kind: "assumed", periodId: null,
      label: "assumed period, not league-confirmed", dates: F });
    const result = run(input({ period: { ...input().period, periods: null } }));
    expect(result.state).toBe("complete_with_assumptions");
    expect(result.assumptions).toEqual(["assumed_period_not_league_confirmed"]);
    expect(result.arms!.plan.assumptions).toEqual(["assumed_period_not_league_confirmed"]);
    expect(result.arms!.noMove.assumptions).toEqual(["assumed_period_not_league_confirmed"]);
  });
  it("keeps an irregular actual period's own dates", () => {
    expect(resolve({ periods: [PERIODS[0], period("long", "2026-11-09", "2026-11-18")] }).dates).toHaveLength(10);
  });
  it("takes the first period after a custom window spanning two periods", () => {
    const result = resolve({ window: { startDate: "2026-11-05", endDate: "2026-11-11" }, decisionAsOf: "2026-11-04T12:00:00Z" });
    expect(result).toMatchObject({ state: "ok", periodId: "w3", dates: ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"] });
  });
  it("applies the stricter of the UTC and league-local decision dates", () => {
    const decisionAsOf = "2026-11-02T03:00:00Z"; // still 1 November in New York
    const policy = forecastCalendarPolicy(14), window = { startDate: "2026-11-02", endDate: "2026-11-08" };
    expect(resolve({ decisionAsOf, window, calendarPolicy: policy })).toMatchObject({ state: "ok", bound: { first: "2026-11-02", last: "2026-11-15" } });
    expect(resolve({ decisionAsOf, window, calendarPolicy: policy, timeZone: "America/New_York" }))
      .toMatchObject({ state: "outside_scenario_horizon", bound: { first: "2026-11-02", last: "2026-11-14" }, dates: F });
  });
  it("rejects invalid, ambiguous or mismatched periods and policies as unknown", () => {
    expect(resolve({ periods: [...PERIODS, period("dup", F[0], "2026-11-16")] })).toMatchObject({ state: "unknown", reason: "ambiguous_period" });
    expect(resolve({ periods: [...PERIODS, period("other", "2026-11-23", "2026-11-29", { leagueKey: "game-key-465" })] })).toMatchObject({ state: "unknown", reason: "league_identity_mismatch" });
    expect(resolve({ periods: [period("bad", "2026-11-12", "2026-11-09")] })).toMatchObject({ state: "unknown", reason: "invalid_period" });
    expect(resolve({ calendarPolicy: { ...forecastCalendarPolicy(14), calendarDays: 22 } })).toMatchObject({ state: "unknown", reason: "invalid_calendar_policy" });
    expect(resolve({ window: { startDate: "2026-11-08", endDate: "2026-11-02" } })).toMatchObject({ state: "unknown", reason: "invalid_window" });
  });
});

describe("source timing, exact-output availability and age (§3)", () => {
  const timed = (inputCutoff: string | null, issuedAt: string | null, extra: Partial<ScenarioSourceRow> = {}) =>
    row("a", "A", { pts: 1 }, { timing: { inputCutoff, issuedAt, reconstruction: false }, ...extra });
  /** Timing with one receipt for the row, completed at `completedAt`. */
  const check = (source: ScenarioSourceRow, completedAt = at(-H), decision = D, extra: Partial<CaptureReceipt> = {}) =>
    sourceTiming(source, decision, [capture("cap-1", [source], completedAt, extra)]);
  it.each([[-1000, "ok"], [0, "ok"], [1000, "stale"]] as const)("issue age at 8×24 h %+d ms is %s (inclusive)", (delta, state) => {
    const issued = at(-MAX_SOURCE_AGE_MS - delta);
    expect(check(timed(issued, issued))).toMatchObject({ state, reasons: state === "ok" ? [] : ["issue_age_exceeded", "input_age_exceeded"] });
  });
  it.each([[-1000, "ok"], [0, "ok"], [1000, "stale"]] as const)("input age at 8×24 h %+d ms is %s (inclusive)", (delta, state) => {
    expect(check(timed(at(-MAX_SOURCE_AGE_MS - delta), at(-2 * H)))).toMatchObject({ state, reasons: state === "ok" ? [] : ["input_age_exceeded"] });
  });
  it("measures ages on UTC instants across a DST change", () => {
    const decision = "2026-11-04T12:00:00-05:00"; // New York left DST on 1 November
    // Exactly 8 local wall-clock days earlier is 8×24 h + 1 h of elapsed time.
    const wall = "2026-10-27T12:00:00-04:00", exact = "2026-10-27T13:00:00-04:00";
    expect(check(timed(wall, wall), "2026-10-28T00:00:00Z", decision).state).toBe("stale");
    expect(check(timed(exact, exact), "2026-10-28T00:00:00Z", decision)).toMatchObject({ state: "ok", issueAgeMs: MAX_SOURCE_AGE_MS, inputAgeMs: MAX_SOURCE_AGE_MS });
  });
  it("accepts a valid pre-decision observed capture and labels it observed-available-by", () => {
    expect(check(timed(at(-3 * H), at(-2 * H)))).toMatchObject({ state: "ok", reasons: [], availableAt: at(-H), receipt: { id: "cap-1" } });
    const result = run(input());
    expect(result.provenance.find(item => item.playerId === "a")!.witness).toEqual({ kind: "observed_capture", label: "observed available by",
      availableAt: at(-25 * H), receiptId: "cap-1", trustedSource: "fixture-server-reader", captureStartedAt: at(-25 * H - 60_000),
      captureCompletedAt: at(-25 * H), setChecksum: "set-cap-1", bindings: { runSucceeded: true, admission: true, identity: true, conditioning: true, proof: true } });
  });
  const base = timed(at(-3 * H), at(-2 * H));
  it.each([
    ["a finish time before D whose final acknowledgement came after D", { ...base, witness: { kind: "finished_at", at: at(-H) } }, [], "no_exact_output_witness"],
    ["a stale-run failure finished_at", { ...base, witness: { kind: "finished_at", at: at(-H) } }, [capture("cap-1", [base], at(-H), { bindings: { runSucceeded: false, admission: true, identity: true, conditioning: true, proof: true } })], "no_exact_output_witness"],
    ["updated_at", { ...base, witness: { kind: "updated_at", at: at(-H) } }, [], "no_exact_output_witness"],
    ["the current succeeded status", { ...base, witness: { kind: "run_status", at: null } }, [], "no_exact_output_witness"],
    ["a missing immutable version", { ...base, witness: { kind: "immutable_publication", version: null } }, [], "immutable_publication_unavailable"],
    ["a missing receipt", base, [], "missing_receipt"],
    ["no witness at all", { ...base, witness: null }, [], "missing_witness"],
    ["a later same-key overwrite with a changed checksum", { ...base, checksum: "sum-a-overwritten" }, [capture("cap-1", [base], at(-H))], "checksum_mismatch"],
    ["a post-decision capture", base, [capture("cap-1", [base], at(H))], "capture_after_decision"],
    ["a capture of other rows only", base, [capture("cap-1", [{ ...base, runId: "other" }], at(-H))], "row_not_in_capture"],
    ["a receipt unbound from the run's admitted state", base, [capture("cap-1", [base], at(-H), { bindings: { runSucceeded: true, admission: true, identity: false, conditioning: true, proof: true } })], "unbound_witness"],
    ["an untrusted reader", base, [capture("cap-1", [base], at(-H), { trustedSource: null })], "untrusted_capture"],
    ["a missing set checksum", base, [capture("cap-1", [base], at(-H), { setChecksum: null })], "missing_set_checksum"],
    ["a non-finite issuedAt", { ...base, timing: { ...base.timing, issuedAt: "not-a-time" } }, [capture("cap-1", [base], at(-H))], "missing_timestamp"],
    ["a reversed cutoff", { ...base, timing: { ...base.timing, inputCutoff: at(-H / 2) } }, [capture("cap-1", [base], at(-H / 4))], "timestamps_out_of_order"],
    ["an issue after its capture", base, [capture("cap-1", [base], at(-2.5 * H))], "timestamps_out_of_order"],
  ] as Array<[string, ScenarioSourceRow, CaptureReceipt[], string]>)("%s gives temporal_provenance_unavailable", (_name, source, captures, reason) => {
    expect(sourceTiming(source, D, captures)).toMatchObject({ state: "temporal_provenance_unavailable", reasons: expect.arrayContaining([reason]) });
    expect(selectSourceRow([source], D, captures)).toMatchObject({ row: null, timing: { state: "temporal_provenance_unavailable", reasons: expect.arrayContaining([reason]) } });
  });
  it("keeps several reason codes together under the weakest state", () => {
    const old = timed(at(-10 * 24 * H), at(-9 * 24 * H));
    const timing = sourceTiming(old, D, [capture("cap-1", [old], at(H))]);
    expect(timing).toMatchObject({ state: "temporal_provenance_unavailable", reasons: ["capture_after_decision", "issue_age_exceeded", "input_age_exceeded"] });
    const rows = input().sourceRows.map(source => source.playerId === "s" ? { ...source, timing: { ...source.timing, inputCutoff: at(-9 * 24 * H) }, checksum: "changed" } : source);
    const result = run(input({ sourceRows: rows, captures: [capture("cap-1", input().sourceRows)] }));
    expect(result.state).toBe("temporal_provenance_unavailable");
    expect(result.reasons).toEqual(expect.arrayContaining(["plan:checksum_mismatch:s", "plan:input_age_exceeded:s"]));
  });
  it("never backdates a capture, and a later recapture does not make an earlier decision eligible", () => {
    const source = timed(at(-3 * H), at(-2 * H));
    expect(selectSourceRow([source], D, [capture("cap-1", [source], at(2 * H))]).row).toBeNull();
    const later = run(input({ period: { ...input().period }, captures: [capture("cap-1", input().sourceRows, at(H))] }));
    expect(later).toMatchObject({ state: "temporal_provenance_unavailable", delta: null });
  });
  it("claims a coherent set only when one receipt covers every selected row", () => {
    const rows = input().sourceRows, split = [capture("cap-1", rows.filter(item => item.playerId !== "s")),
      capture("cap-2", rows.filter(item => item.playerId === "s"))];
    const result = run(input({ sourceRows: rows.map(item => item.playerId === "s" ? { ...item, witness: { kind: "observed_capture", receiptId: "cap-2" } } : item), captures: split }));
    expect(result).toMatchObject({ state: "temporal_provenance_unavailable", delta: null, arms: { plan: { points: null }, noMove: { points: null } } });
    expect(result.reasons).toEqual(["plan:capture_not_coherent", "no_move:capture_not_coherent"]);
    // A capture covering only part of the selected rows leaves the uncovered row without a witness.
    const partial = run(input({ captures: [capture("cap-1", rows.filter(item => item.playerId !== "s"))] }));
    expect(partial.state).toBe("temporal_provenance_unavailable");
    expect(partial.reasons).toEqual(expect.arrayContaining(["plan:row_not_in_capture:s"]));
  });
  it("marks recently reissued old-cutoff data stale", () => {
    expect(check(timed(at(-10 * 24 * H), at(-2 * H)))).toMatchObject({ state: "stale", reasons: ["input_age_exceeded"] });
  });
  it("excludes historical reconstruction runs whatever their issue time", () => {
    const rebuilt = timed(at(-2 * H), at(-H), { timing: { inputCutoff: at(-2 * H), issuedAt: at(-H), reconstruction: true } });
    expect(check(rebuilt, at(-H / 2))).toMatchObject({ state: "unknown", reasons: ["historical_reconstruction_excluded"] });
    expect(selectSourceRow([rebuilt], D, [capture("cap-1", [rebuilt], at(-H / 2))])).toMatchObject({ row: null, timing: { state: "unknown", reasons: ["historical_reconstruction_excluded"] } });
  });
  it("selects the greatest availableAt at or before the decision among valid witnesses, never by slate order", () => {
    const make = (runId: string, completedAt: string, extra: Partial<ScenarioSourceRow> = {}) => {
      const source = { ...timed(at(-6 * H), at(-5 * H)), runId, witness: { kind: "observed_capture" as const, receiptId: `cap-${runId}` }, ...extra };
      return { source, receipt: capture(`cap-${runId}`, [source], completedAt) };
    };
    const pick = (...items: Array<ReturnType<typeof make>>) => selectSourceRow(items.map(item => item.source), D, items.map(item => item.receipt)).row;
    const early = make("r-early", at(-3 * H), { slateDate: "2026-11-02" }), late = make("r-late", at(-2 * H), { slateDate: "2026-10-30" }), future = make("r-future", at(H));
    expect(pick(early, late, future)!.runId).toBe("r-late");
    // A row whose capture completes after the decision is not available to it; the earlier captured row is selected.
    expect(pick(early, future)!.runId).toBe("r-early");
    // A broken witness on the newest row makes that row ineligible rather than guessed.
    const captured = make("r-broken", at(-H));
    expect(pick(early, { ...captured, source: { ...captured.source, checksum: "changed-after-capture" } })!.runId).toBe("r-early");
    const tie = (runId: string, basisGameId: string, issuedAt = at(-5 * H)) => make(runId + basisGameId, at(-2 * H), { basisGameId,
      timing: { inputCutoff: at(-6 * H), issuedAt, reconstruction: false } });
    const named = (item: ReturnType<typeof make>, runId: string) => ({ source: { ...item.source, runId }, receipt: capture(item.receipt.id, [{ ...item.source, runId }], at(-2 * H)) });
    expect(pick(named(tie("x", "g1"), "r1"), named(tie("y", "g9", at(-4 * H)), "r0"))!.runId).toBe("r0");
    expect(pick(named(tie("x", "g1"), "r1"), named(tie("y", "g0"), "r2"))!.runId).toBe("r2");
    expect(pick(named(tie("x", "g1"), "r1"), named(tie("y", "g2"), "r1"))!.basisGameId).toBe("g2");
    const unreleased = { ...late.source, admission: { ...late.source.admission, released: false } };
    expect(selectSourceRow([unreleased], D, [late.receipt]).timing.reasons).toEqual(["source_not_admitted"]);
    expect(selectSourceRow([{ ...late.source, admission: { ...late.source.admission, horizonGames: 2 } }], D, [late.receipt]).timing.reasons).toEqual(["source_not_admitted"]);
  });
  it("carries a stale row into the arm and the delta", () => {
    const rows = input().sourceRows.map(source => source.playerId === "s" ? { ...source, timing: { ...source.timing, inputCutoff: at(-9 * 24 * H) } } : source);
    const result = run(input({ sourceRows: rows }));
    expect(result).toMatchObject({ state: "stale", delta: null, arms: { plan: { state: "stale", points: null }, noMove: { state: "complete" } } });
    expect(result.reasons).toEqual(["plan:input_age_exceeded:s", "plan:missing_component:s:pts"]);
  });
  it("does not reset the decision clock on reload", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T13:00:00Z"));
    const first = JSON.stringify(run(input()));
    vi.setSystemTime(new Date("2026-11-20T13:00:00Z"));
    const reloaded = run(input());
    expect(JSON.stringify(reloaded)).toBe(first);
    expect(reloaded).toMatchObject({ decisionAsOf: D, state: "complete" });
  });
});

describe("boundary rosters and evaluator reuse (§6)", () => {
  it("applies plan steps, keeps no-move frozen, and ends a chain on its last held streamer", () => {
    const base = input();
    expect(boundaryRosters(base.snapshot, base.intent, base.steps)).toMatchObject({ legal: true,
      plan: [{ playerId: "a" }, { playerId: "b" }, { playerId: "s", position: "bench" }], noMove: [{ playerId: "a" }, { playerId: "b" }, { playerId: "d" }] });
    const chain = [step("leg1", "s", "d"), step("leg2", "s2", "s", { at: at(2 * H), effectiveAt: at(2 * H), dependsOn: ["leg1"], conditional: true })];
    expect(boundaryRosters(base.snapshot, base.intent, chain).plan.map(entry => entry.playerId)).toEqual(["a", "b", "s2"]);
    const reserve = [step("ir", "b", undefined, { type: "reserve", reservePosition: "IR" })];
    expect(boundaryRosters(base.snapshot, base.intent, reserve).plan.find(entry => entry.playerId === "b")?.position).toBe("IR");
  });
  it("scores two boundary rosters with slot displacement through the existing evaluator", () => {
    const result = run(input());
    const plan = oracle(["a", "b", "s"], RATES), noMove = oracle(["a", "b", "d"], RATES);
    expect(result).toMatchObject({ state: "complete", assumptions: [], reasons: [], arms: { plan: { state: "complete", points: plan }, noMove: { state: "complete", points: noMove } } });
    expect(result.delta!.points).toBeCloseTo(plan - noMove, 10);
    expect(result.delta!.points).toBeCloseTo(5.25, 10);
    // On the 9th the new C takes C, a moves to UTIL, and b is displaced to the bench; in N b plays UTIL.
    const day = (lineup: Array<{ date: string; playerId: string; slotId: string }>) => lineup.filter(item => item.date === F[0]).map(item => item.playerId).sort();
    expect(day(result.arms!.plan.lineup)).toEqual(["a", "s"]);
    expect(day(result.arms!.noMove.lineup)).toEqual(["a", "b", "d"]);
    expect(result.provenance.map(item => item.playerId)).toEqual(["a", "b", "d", "s"]);
    expect(result.context).toMatchObject({ schedule: { revision: "F-1" }, calendarPolicy: { calendarDays: 21 } });
  });
  it("scores a streaming chain's held streamer and leaves reserve placements out of the lineup", () => {
    const chain = [step("leg1", "s", "d"), step("leg2", "s2", "s", { at: at(2 * H), effectiveAt: at(2 * H), dependsOn: ["leg1"], conditional: true })];
    const schedule = { ...input().schedule, games: [...F_GAMES, game("T", F[4])] };
    const result = run(input({ steps: chain, schedule }));
    expect(result.arms!.plan.points).toBe(oracle(["a", "b"], RATES) + 4);
    const reserved = input({ steps: [step("ir", "b", undefined, { type: "reserve", reservePosition: "IR" })],
      sourceRows: input().sourceRows.filter(source => source.playerId !== "b") });
    const outcome = run(reserved);
    expect(outcome.arms!.plan).toMatchObject({ state: "complete", coverage: { notInLineup: ["b"] } });
    expect(outcome.arms!.noMove.state).toBe("unknown");
    expect(outcome).toMatchObject({ state: "unknown", delta: null });
  });
  it("reports an illegal plan as unknown without scoring", () => {
    const result = run(input({ steps: [step("bad", "b", "d")] }));
    expect(result).toMatchObject({ state: "unknown", reasons: ["plan_illegal"], arms: null });
  });
});

describe("result states and coverage (§4–§5)", () => {
  const withRows = (edit: (rows: ScenarioSourceRow[]) => ScenarioSourceRow[], overrides: Partial<LaterImpactInput> = {}) => {
    const base = input(overrides);
    return run({ ...base, sourceRows: edit(base.sourceRows) });
  };
  it("labels a complete result as a rate scenario, never as native F forecasts (§2.6)", () => {
    expect(run(input()).claims).toEqual({ withinBound: true, scenarioInputsComplete: true, nativeForecasts: false, basis: "rate_scenario",
      label: "Rate scenario: eligible decision-time basis rates applied to F under fixed rosters and stationary rates; not native F forecasts." });
    // Missing basis evidence inside the cap is unknown: within the bound, inputs incomplete.
    expect(withRows(rows => rows.filter(source => source.playerId !== "s"))).toMatchObject({ state: "unknown",
      claims: { withinBound: true, scenarioInputsComplete: false, nativeForecasts: false } });
    expect(run(input({ period: { ...input().period, calendarPolicy: forecastCalendarPolicy(14) } })).claims).toMatchObject({ withinBound: false, scenarioInputsComplete: false });
  });
  it("separates a verified no-game player from a missing line", () => {
    const base = input();
    base.snapshot.roster.push({ playerId: "x", position: "bench" });
    const noGame = run({ ...base, sourceRows: base.sourceRows.filter(source => source.playerId !== "x") });
    expect(noGame).toMatchObject({ state: "complete", arms: { plan: { coverage: { noGamePlayers: ["x"] } }, noMove: { coverage: { noGamePlayers: ["x"] } } } });
    const withGame = { ...base, schedule: { ...base.schedule, games: [...F_GAMES, game("X", F[5])] } };
    const missing = run({ ...withGame, sourceRows: base.sourceRows.filter(source => source.playerId !== "x") });
    expect(missing).toMatchObject({ state: "unknown", delta: null, arms: { plan: { points: null, components: null }, noMove: { points: null } } });
    expect(missing.reasons).toEqual(["plan:missing_component:x:pts", "plan:no_source_row:x", "no_move:missing_component:x:pts", "no_move:no_source_row:x"]);
  });
  it("treats an incomplete schedule or unverified off days as unknown", () => {
    expect(run(input({ schedule: { ...input().schedule, completeness: "partial" } })).reasons).toEqual(["schedule_incomplete"]);
    expect(run(input({ schedule: { ...input().schedule, offDaysVerified: false } })).state).toBe("unknown");
    expect(run(input({ schedule: { ...input().schedule, endDate: F[5] } })).reasons).toEqual(["schedule_range_mismatch"]);
    expect(run(input({ schedule: { ...input().schedule, asOf: at(-40 * H) } })).reasons).toContain("plan:schedule_stale");
  });
  it("treats a trade or unverified membership as unknown and never rebuilds history", () => {
    const base = input();
    const traded = run({ ...base, membership: { ...base.membership, a: { teamAbbreviation: "B", verified: true, asOf: at(-H) } } });
    expect(traded).toMatchObject({ state: "unknown", delta: null });
    expect(traded.reasons).toEqual(["plan:missing_component:a:pts", "plan:team_mismatch:a", "no_move:missing_component:a:pts", "no_move:team_mismatch:a"]);
    expect(run({ ...base, membership: { ...base.membership, b: { ...base.membership.b, asOf: at(H) } } }).reasons).toContain("plan:membership_after_decision:b");
    expect(run({ ...base, membership: { ...base.membership, d: { ...base.membership.d, verified: false } } }).reasons).toEqual(["no_move:membership_unverified:d", "no_move:missing_component:d:pts"]);
    expect(withRows(rows => rows.map(source => source.playerId === "s" ? { ...source, teamAbbreviation: "Q" } : source)).reasons).toEqual(["plan:missing_component:s:pts", "plan:team_mismatch:s"]);
  });
  it("never cancels identical unknown goalie coverage in P and N", () => {
    const base = input();
    base.snapshot.players.push(goalie("g", "A"));
    base.snapshot.roster.push({ playerId: "g", position: "bench" });
    base.membership.g = { teamAbbreviation: "A", verified: true, asOf: at(-H) };
    const result = run(base);
    expect(result).toMatchObject({ state: "unknown", delta: null, arms: { plan: { state: "unknown", points: null }, noMove: { state: "unknown", points: null } } });
    expect(result.reasons).toEqual(["plan:no_source_row:g", "no_move:no_source_row:g"]);
    // A conditional goalie line is conditional, never a number, even with an unconditional tag.
    for (const conditioning of ["conditional", "unconditional"] as const) {
      const lined = run({ ...base, sourceRows: [...base.sourceRows, row("g", "A", { pts: 3 }, { conditioning })] });
      expect(lined).toMatchObject({ state: "conditional", delta: null, arms: { plan: { state: "conditional", points: null }, noMove: { state: "conditional" } } });
    }
  });
  it("distinguishes a labelled reserve zero from a missing line", () => {
    const reserve = withRows(rows => rows.map(source => source.playerId === "b" ? { ...source, components: { pts: 0 }, reserveZero: { conditionalLine: { pts: 0.75 } } } : source));
    expect(reserve).toMatchObject({ state: "complete_with_assumptions", assumptions: ["reserve_conservative_zero:b"],
      arms: { plan: { state: "complete_with_assumptions", conditionalLines: { b: { pts: 0.75 } } }, noMove: { state: "complete_with_assumptions" } } });
    const zeroB = { ...RATES, b: 0 };
    expect(reserve.delta!.points).toBeCloseTo(oracle(["a", "b", "s"], zeroB) - oracle(["a", "b", "d"], zeroB), 10);
    expect(withRows(rows => rows.filter(source => source.playerId !== "b"))).toMatchObject({ state: "unknown", assumptions: [], delta: null });
  });
  it("treats an absent conditioning tag as unknown, not unconditional", () => {
    const result = withRows(rows => rows.map(source => source.playerId === "a" ? { ...source, conditioning: undefined } : source));
    expect(result).toMatchObject({ state: "unknown", delta: null });
    expect(result.reasons).toEqual(["plan:conditioning_unknown:a", "plan:missing_component:a:pts", "no_move:conditioning_unknown:a", "no_move:missing_component:a:pts"]);
    expect(withRows(rows => rows.map(source => source.playerId === "s" ? { ...source, conditioning: "conditional" } : source)))
      .toMatchObject({ state: "conditional", arms: { plan: { state: "conditional" }, noMove: { state: "complete" } }, delta: null });
  });
  it("keeps native units and treats a null component as missing, never zero", () => {
    const units = withRows(rows => rows.map(source => ({ ...source, units: { pts: "fantasy points per game" } })));
    expect(units.provenance.every(item => item.units.pts === "fantasy points per game")).toBe(true);
    const nulls = withRows(rows => rows.map(source => source.playerId === "s" ? { ...source, components: { pts: null } } : source));
    expect(nulls).toMatchObject({ state: "unknown", delta: null, arms: { plan: { state: "unknown", components: null }, noMove: { state: "complete" } } });
    expect(nulls.arms!.plan.coverage.missing.map(item => item.key)).toEqual(["pts", "pts", "pts"]);
  });
  it("needs no line for a statistic that does not apply to the player", () => {
    const base = input();
    base.snapshot.rules.scoring.weights = { pts: 1, SAVES_GOALIE: 0.2 };
    expect(run(base)).toMatchObject({ state: "complete" });
  });

  describe("pooled categories", () => {
    const categories = (overrides: Partial<LaterImpactInput> = {}) => {
      const base = input(overrides);
      base.snapshot.rules.rosterSlots = { C: 1, D: 1, UTIL: 2, BN: 2 };
      base.snapshot.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "G", direction: "higher" }, { key: "SOG", direction: "higher" },
        { key: "SHPCT", direction: "higher", numerator: "G", denominator: "SOG" }] };
      const lines: Record<string, StatLine> = { a: { G: 0.5, SOG: 4 }, b: { G: 0.25, SOG: 2 }, d: { G: 0.125, SOG: 1 }, s: { G: 1, SOG: 3 } };
      return { ...base, sourceRows: base.sourceRows.map(source => ({ ...source, components: lines[source.playerId] ?? { G: 0, SOG: 0 } })) };
    };
    // Every playing player fits a slot here, so pooled sums are rate × games: a 2, b 2, d 1, s 3 games.
    const sums = (ids: string[]) => {
      const games: Record<string, number> = { a: 2, b: 2, d: 1, s: 3 }, lines: Record<string, [number, number]> = { a: [0.5, 4], b: [0.25, 2], d: [0.125, 1], s: [1, 3] };
      return ids.reduce(([g, sog], id) => [g + games[id] * lines[id][0], sog + games[id] * lines[id][1]], [0, 0]);
    };
    it("gives native component deltas and pooled ratios, never a scalar", () => {
      const result = run(categories());
      const [pg, ps] = sums(["a", "b", "s"]), [ng, ns] = sums(["a", "b", "d"]);
      expect(result).toMatchObject({ state: "complete_with_assumptions", assumptions: ["category_lineup_schedule_capacity"] });
      expect(result.delta!.points).toBeNull();
      expect(result.delta!.components).toEqual({ G: pg - ng, SOG: ps - ns });
      const pooled = result.delta!.categories!.find(item => item.key === "SHPCT")!;
      expect(pooled.plan).toEqual({ numerator: pg, denominator: ps, value: pg / ps });
      expect(pooled.noMove).toEqual({ numerator: ng, denominator: ns, value: ng / ns });
      expect(pooled.delta.value).toBeCloseTo(pg / ps - ng / ns, 12);
      expect(Object.keys(result.delta!)).toEqual(["points", "components", "categories"]);
    });
    it("makes a known points component with a missing denominator unknown, with no partial totals", () => {
      const base = categories();
      const result = run({ ...base, sourceRows: base.sourceRows.map(source => source.playerId === "a" ? { ...source, components: { G: 0.5, SOG: null } } : source) });
      expect(result).toMatchObject({ state: "unknown", delta: null, arms: { plan: { components: null, categories: null }, noMove: { components: null } } });
      expect(result.reasons).toEqual(["plan:missing_component:a:SOG", "no_move:missing_component:a:SOG"]);
    });
  });
});

describe("adapter leakage and weekly isolation (§6)", () => {
  const marked = (forecast: Partial<GameForecast> = {}) => ({ playerId: "a", gameId: "A-x", stats: { pts: 1 }, conditioning: "unconditional", startProbability: null,
    confirmedStart: false, revisionId: "r", issuedAt: D, modelVersion: null, limitations: [], scenarioUse: LATER_IMPACT_USE,
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true }, ...forecast }) as GameForecast;
  it("refuses marked rows everywhere outside the scenario entry point, even with every native use set", () => {
    const row = marked();
    for (const use of ["assignment", "totals", "comparison", "conditionalTieBreak"] as const) expect(forecastAllows(row, "pts", use)).toBe(false);
    const { scenarioUse: _mark, ...native } = row as GameForecast & { scenarioUse: string };
    expect(forecastAllows(native as GameForecast, "pts", "totals")).toBe(true);
    const data = { ...snapshot(), games: [game("A", "2026-11-03")], forecasts: [marked({ gameId: "A-2026-11-03" })] };
    const weekly = evaluatePlan(data, input().intent, "outcome", []);
    expect(weekly.projectedValue).toBeNull();
    // The native resolver strips a leaked row to nothing usable.
    expect(weekly.forecastInputs!.every(item => Object.values(item.stats).every(value => value === null)
      && Object.values(item.allowedUses!).every(value => value === false))).toBe(true);
  });
  it("accepts only marked rows and the later-impact use, and always clears the hook", () => {
    const data = { ...snapshot(), games: [game("A", "2026-11-03")], forecasts: [marked({ gameId: "A-2026-11-03" })] };
    const before = JSON.stringify(evaluatePlan(data, input().intent, "outcome", []));
    const { scenarioUse: _mark, ...native } = data.forecasts[0] as GameForecast & { scenarioUse: string };
    expect(() => evaluateScenarioPlan({ ...data, forecasts: [native as GameForecast] }, input().intent, "outcome", LATER_IMPACT_USE)).toThrow(/only marked/);
    expect(() => evaluateScenarioPlan(data, input().intent, "outcome", "totals" as typeof LATER_IMPACT_USE)).toThrow(/later-impact use/);
    expect(() => evaluateScenarioPlan({ ...data, baselineSources: [{} as never] }, input().intent, "outcome", LATER_IMPACT_USE)).toThrow(/only marked/);
    const scenario = evaluateScenarioPlan(data, input().intent, "outcome", LATER_IMPACT_USE);
    expect(scenario.projectedValue).toBe(1 + 3);
    expect(scenario.forecastInputs).toEqual([]);
    expect(JSON.stringify(evaluatePlan(data, input().intent, "outcome", []))).toBe(before);
  });
  it("returns no scenario row and leaves the weekly input untouched", () => {
    const base = input(), frozen = structuredClone(base);
    const text = JSON.stringify(run(base));
    expect(base).toEqual(frozen);
    for (const leaked of ["scenarioUse", "allowedUses", "forecastInputs", "\"stats\"", "revisionId"]) expect(text).not.toContain(leaked);
  });
  it.each(["points", "categories", "missing"] as const)("leaves weekly planning identical with the scenario on vs off (%s)", kind => {
    const base = input();
    base.snapshot.games = ["2026-11-03", "2026-11-05"].flatMap(date => ["A", "B", "D", "S", "T"].map(team => game(team, date)));
    if (kind === "categories") base.snapshot.rules.scoring = { mode: "categories", weights: {}, categories: [{ key: "G", direction: "higher" }] };
    if (kind === "missing") base.sourceRows = base.sourceRows.filter(source => source.playerId !== "a");
    const options = { maxSteps: 2, maxCandidates: 3, maxEvaluations: 200 };
    const weekly = () => { const result = planRoster(base.snapshot, base.intent, options); return JSON.stringify({ ...result, search: { ...result.search, elapsedMs: 0 } }); };
    const off = weekly();
    const scenario = run(base);
    expect(scenario.state).not.toBe("scenario_contract_not_accepted");
    expect(weekly()).toBe(off);
    expect(JSON.stringify(evaluatePlan(base.snapshot, base.intent, "outcome", base.steps))).toBe(JSON.stringify(evaluatePlan(structuredClone(base.snapshot), base.intent, "outcome", base.steps)));
  });
});
