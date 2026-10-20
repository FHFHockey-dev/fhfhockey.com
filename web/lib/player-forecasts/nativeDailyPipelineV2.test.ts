// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertFreshMeansBinding, assertFreshMeansPolicyTemplates, assertParticipationCoverage, assertParticipationMaterializationBound, assertStandingApprovalMethods,
  buildRollingDailyParticipationInputs, NATIVE_DAILY_APPROVED_METHODS, FROZEN_PARTICIPATION_LAST_CUTOFF, NATIVE_DAILY_V2_FLAGS, nativeDailyCaptureMethod, nativeDailyKnownConflicts,
  nativeDailyNullParticipation, nativeDailyParticipationMethod, nativeDailyPolicyTerms, nativeDailyRollingCapturePlan, nativeDailyScheduleRevision, nativeDailyUniverse,
  nativeDailyV2Flags } from "./nativeDailyPipelineV2";
import { NATIVE_MATERIALIZATION_MAX_PARTICIPATION_INPUTS, prepareNativeInputMaterialization } from "./nativeInputMaterialization";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { buildDailyMaterializationRequestsV2, NATIVE_DAILY_SOURCE_KEYS } from "./nativeDailyPipelineV2";
import { buildRollingParticipationHistories } from "./rollingParticipationFrame";
import { prepareNativeCadenceOutputs } from "./nativeCadenceOutputPreparation";
import { nativeCadenceSourceManifests, observeClosedNativeCadenceSources, publishNativeBaselineCadence } from "./nativeBaselineCadence";
import { applyNativeDailyReview } from "./nativeDailyPipeline";
import { validateCadenceCommand } from "../../scripts/native-baseline-cadence";
import { PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY_HASH } from "./yahooUniverse";

const off = nativeDailyV2Flags(undefined);
const universe = (overrides: Record<string, unknown> = {}) => ({ version: "forge-daily-yahoo-universe-v1", date: "2026-10-21", seasonId: 20262027,
  status: "complete", ownedComplete: true, counts: { owned: 1 }, unmapped: [], ambiguous: [], membershipUnresolved: [], excluded: [], change: null,
  injury: { evidence: [] }, players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, class: "skater", universe: "owned", rosterRevision: "r7", yahooPlayerKey: "477.p.7" }],
  ...overrides }) as any;

describe("v2 daily composition flags and gates", () => {
  it("defaults every pending-approval flag off and refuses unknown or non-boolean flags", () => {
    expect(off).toEqual({ injuryPolicy: false, nullGateNonConflictOnly: false, universeThresholds: false, rollingFirstIssuance: false });
    expect(Object.values(NATIVE_DAILY_V2_FLAGS).every(value => value === false)).toBe(true);
    expect(nativeDailyV2Flags({ rollingFirstIssuance: true }).rollingFirstIssuance).toBe(true);
    expect(() => nativeDailyV2Flags({ publish: true })).toThrow("invalid_v2_flag:publish");
    expect(() => nativeDailyV2Flags({ injuryPolicy: "yes" })).toThrow("invalid_v2_flag:injuryPolicy");
  });

  it("uses the frozen method through its last cutoff and rolling only once its first issuance is approved", () => {
    expect(nativeDailyParticipationMethod("2026-10-21T11:00:00Z", off)).toBe("frozen_window");
    expect(nativeDailyParticipationMethod(FROZEN_PARTICIPATION_LAST_CUTOFF, off)).toBe("frozen_window");
    expect(() => nativeDailyParticipationMethod("2026-10-27T04:00:00.001Z", off)).toThrow("rolling_first_issuance_not_approved");
    expect(nativeDailyParticipationMethod("2026-10-27T11:00:00Z", { ...off, rollingFirstIssuance: true })).toBe("rolling_14d");
  });

  it("always gates owned completeness and reports or enforces the universe thresholds by flag", () => {
    expect(nativeDailyUniverse(universe(), off).rows).toEqual([{ playerId: 7, nhlPlayerId: 77, teamId: 1, playerClass: "skater", rosterRevision: "r7", yahooPlayerKey: "477.p.7" }]);
    expect(() => nativeDailyUniverse(universe({ ownedComplete: false }), off)).toThrow("universe_owned_incomplete");
    const crowded = universe({ change: { added: [], removed: [] }, unmapped: Array.from({ length: 6 }, (_, index) => ({ yahooPlayerKey: `477.p.${index}` })) });
    expect(nativeDailyUniverse(crowded, off).gate).toMatchObject({ unresolved: 6, thresholdsApplied: false, thresholdsExceeded: true });
    expect(() => nativeDailyUniverse(crowded, { ...off, universeThresholds: true })).toThrow("universe_threshold_exceeded");
  });

  it("requires a previous universe before enforcing the growth threshold (A-13)", () => {
    expect(nativeDailyUniverse(universe(), off).gate).toMatchObject({ added: 0, thresholdsApplied: false });
    expect(() => nativeDailyUniverse(universe(), { ...off, universeThresholds: true })).toThrow("universe_previous_required");
    const grown = universe({ change: { added: Array.from({ length: 11 }, (_, index) => index + 100), removed: [] } });
    expect(() => nativeDailyUniverse(grown, { ...off, universeThresholds: true })).toThrow("universe_threshold_exceeded");
    expect(nativeDailyUniverse(universe({ change: { added: [8], removed: [] } }), { ...off, universeThresholds: true }).gate.added).toBe(1);
  });

  it("bounds each split materialization by kind, so a 1,520-input rolling day passes and a per-kind overflow still stops (A-14)", () => {
    expect(NATIVE_MATERIALIZATION_MAX_PARTICIPATION_INPUTS).toBe(1500);
    // 62 skaters x 20 games, plus 7 goalies x 20 games x (appearance + start): one request each.
    const skaters = Array.from({ length: 62 * 20 }, () => ({ playerClass: "skater" })), goalies = Array.from({ length: 7 * 2 * 20 }, () => ({ playerClass: "goalie" }));
    expect(() => assertParticipationMaterializationBound([...skaters, ...goalies])).not.toThrow();
    expect(() => assertParticipationMaterializationBound([...skaters, ...skaters.slice(0, 261), ...goalies]))
      .toThrow("participation_inputs_exceed_materialization_bound:skater:1501");
    expect(() => assertParticipationMaterializationBound([...skaters, ...Array.from({ length: 1501 }, () => ({ playerClass: "goalie" }))]))
      .toThrow("participation_inputs_exceed_materialization_bound:goalie:1501");
    expect(() => assertParticipationMaterializationBound([{}])).toThrow("participation_input_class_unknown");
  });

  it("binds fresh means to the run date, a complete plan and the whole universe (A-17)", () => {
    const rows = [{ playerId: 7, nhlPlayerId: 77, teamId: 1, playerClass: "skater" as const, rosterRevision: "r7" },
      { playerId: 8, nhlPlayerId: 88, teamId: 2, playerClass: "goalie" as const, rosterRevision: "r8" }];
    const coverage = rows.map(({ playerId, nhlPlayerId, teamId }) => ({ playerId, nhlPlayerId, teamId }));
    const means = { cutoffAt: "2026-10-21T10:40:00Z", plan: { status: "complete" }, coverage };
    expect(assertFreshMeansBinding(means, rows, "2026-10-21")).toEqual({ uncovered: [], approvedUncovered: 0 });
    expect(() => assertFreshMeansBinding({ ...means, cutoffAt: "2026-10-12T15:00:00Z" }, rows, "2026-10-21")).toThrow("means_cutoff_not_on_run_date");
    expect(() => assertFreshMeansBinding({ ...means, cutoffAt: "2026-10-21T03:00:00Z" }, rows, "2026-10-21")).toThrow("means_cutoff_not_on_run_date");
    expect(() => assertFreshMeansBinding({ ...means, plan: { status: "requests_pending" } }, rows, "2026-10-21")).toThrow("means_plan_incomplete");
    expect(() => assertFreshMeansBinding({ cutoffAt: means.cutoffAt, coverage }, rows, "2026-10-21")).toThrow("means_plan_incomplete");
    expect(() => assertFreshMeansBinding({ ...means, coverage: [coverage[0]] }, rows, "2026-10-21")).toThrow("means_coverage_differs_from_universe:1");
    expect(assertFreshMeansBinding({ ...means, coverage: [coverage[0]] }, rows, "2026-10-21", 1).uncovered).toEqual([8]);
    expect(() => assertFreshMeansBinding({ ...means, coverage: [...coverage, { playerId: 9, nhlPlayerId: 99, teamId: 1 }] }, rows, "2026-10-21")).toThrow("means_universe_conflict");
    expect(() => assertFreshMeansBinding({ ...means, coverage: [{ ...coverage[0], teamId: 3 }, coverage[1]] }, rows, "2026-10-21")).toThrow("means_universe_conflict");
  });

  it("passes fresh known conflicts only under the approved policy hash", () => {
    expect(nativeDailyKnownConflicts(universe(), "2026-10-21T11:00:00Z", off)).toBeUndefined();
    expect(() => nativeDailyKnownConflicts(universe(), "2026-10-21T11:00:00Z", { ...off, injuryPolicy: true })).toThrow("injury_policy_not_approved");
    expect(() => nativeDailyKnownConflicts(universe(), "2026-10-21T11:00:00Z", { ...off, injuryPolicy: true }, "0".repeat(64))).toThrow("injury_policy_not_approved");
    expect(nativeDailyKnownConflicts(universe(), "2026-10-21T11:00:00Z", { ...off, injuryPolicy: true }, PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY_HASH)).toEqual({ 7: null });
  });

  it("counts conflict-withheld nulls against the gate unless the null-gate flag is on", () => {
    const entry = (probability: number | null, reasons: string[]) => ({ receipt: { probability, reasons } });
    const plan = { rows: [{ entity_kind: "participation_bundle", payload: { entries: [entry(null, ["known_current_roster_conflict"]),
      entry(null, ["no_eligible_history"]), entry(0.5, [])] } }, { entity_kind: "seasonal_rate_bundle", payload: {} }] } as any;
    expect(nativeDailyNullParticipation(plan, off)).toEqual({ total: 2, conflictWithheld: 1, gated: 2 });
    expect(nativeDailyNullParticipation(plan, { ...off, nullGateNonConflictOnly: true }).gated).toBe(1);
  });

  it("restores v1's coverage gate and stops on any lost frozen template", () => {
    expect(() => assertParticipationCoverage([{ playerId: 7, games: 20, reasons: [] }])).not.toThrow();
    expect(() => assertParticipationCoverage([{ playerId: 7, games: 20, reasons: ["missing_official_club_roster"] }])).toThrow("participation_coverage_incomplete");
    expect(() => assertParticipationCoverage([{ playerId: 7, games: 0, reasons: [] }])).toThrow("participation_coverage_incomplete");
    expect(() => assertParticipationCoverage([], [7, 8])).toThrow("participation_template_lost:2");
  });

  it("mints rows only for pinned definition hashes and participation datasets", () => {
    const hash = NATIVE_DAILY_APPROVED_METHODS.policies["current-appearance-skater-rates-v1"];
    const plan = (rows: any[]) => ({ seasonId: 20262027, rows }) as any;
    const input = (definitionHash: string) => ({ entity_kind: "player", payload: { policyVersion: "current-appearance-skater-rates-v1", definitionHash } });
    expect(assertStandingApprovalMethods(plan([input(hash), { entity_kind: "participation_bundle", dataset_key: "skater-roster-observation-participation-bundle-v1" }]), off))
      .toEqual({ policies: 6, participationDatasets: 3 });
    expect(() => assertStandingApprovalMethods(plan([input("0".repeat(64))]), off)).toThrow("method_not_in_standing_approval:current-appearance-skater-rates-v1");
    expect(() => assertStandingApprovalMethods(plan([{ entity_kind: "baseline_evaluation_policy", payload: { policyVersion: "new-policy-v2" } }]), off)).toThrow("method_not_in_standing_approval:new-policy-v2");
    const rolling = { entity_kind: "participation_bundle", dataset_key: "skater-rolling-14d-participation-bundle-v1" };
    expect(() => assertStandingApprovalMethods(plan([rolling]), off)).toThrow("method_not_in_standing_approval:skater-rolling-14d-participation-bundle-v1");
    expect(() => assertStandingApprovalMethods(plan([rolling]), { ...off, rollingFirstIssuance: true })).not.toThrow();
    expect(() => assertStandingApprovalMethods({ seasonId: 20272028, rows: [] } as any, off)).toThrow("method_not_in_standing_approval:season");
  });

  it("pins the standing-approval ref and each policy's terms, and refuses ambiguous templates (A-18)", () => {
    const approved = NATIVE_DAILY_APPROVED_METHODS, uses = ["assignment", "totals", "comparison", "conditionalTieBreak"];
    expect(approved.standingApprovalRef).toBe("tj-standing-approval-2026-10-17:forge-daily");
    expect(Object.keys(approved.policyTerms)).toEqual(Object.keys(approved.policies));
    const terms = (policyVersion: string, extra: Record<string, unknown> = {}) => ({ version: "baseline-evaluation-policy-v1", seasonId: 20262027, policyVersion,
      allowedPublicUses: uses, candidateInputHash: "a".repeat(64), status: "owner_approved", prospectiveEvidenceRef: "ref", ownerApprovalRef: "old", approvedAt: "2026-10-16T12:00:00Z", ...extra });
    for (const policyVersion of Object.keys(approved.policies)) {
      expect(playerForecastSourcePayloadHash(nativeDailyPolicyTerms(terms(policyVersion)))).toBe(approved.policyTerms[policyVersion]);
    }
    const policy = (policyVersion: string, extra: Record<string, unknown> = {}) => ({ entity_kind: "baseline_evaluation_policy", payload: terms(policyVersion, extra) });
    const review = (policyVersion: string) => ({ entity_kind: "baseline_validation_review", payload: { policyVersion } });
    const pv = "native-goalie-appearance-win-rates-v1", other = "current-appearance-skater-rates-v1";
    expect(assertFreshMeansPolicyTemplates([policy(pv), review(pv), policy(other), review(other), policy("unrelated-v1"), policy("unrelated-v1")] as any)).toEqual({ templates: 4 });
    expect(() => assertFreshMeansPolicyTemplates([policy(pv), review(pv), policy(pv, { allowedPublicUses: ["totals"] })] as any)).toThrow("fresh_means_policy_template_ambiguous");
    expect(() => assertFreshMeansPolicyTemplates([policy(pv), review(pv), review(pv)] as any)).toThrow("fresh_means_policy_template_ambiguous");
    expect(() => assertFreshMeansPolicyTemplates([policy(pv, { allowedPublicUses: ["assignment", "totals", "comparison"] })] as any))
      .toThrow(`fresh_means_policy_terms_not_approved:${pv}`);
    const plan = (rows: any[]) => ({ seasonId: 20262027, rows }) as any;
    expect(() => assertStandingApprovalMethods(plan([policy(pv, { ownerApprovalRef: approved.standingApprovalRef })]), off)).not.toThrow();
    expect(() => assertStandingApprovalMethods(plan([policy(pv, { ownerApprovalRef: "replay:any-string" })]), off)).toThrow(`method_not_in_standing_approval:${pv}`);
    expect(() => assertStandingApprovalMethods(plan([policy(pv, { ownerApprovalRef: approved.standingApprovalRef, allowedPublicUses: ["totals"] })]), off))
      .toThrow(`method_not_in_standing_approval:${pv}`);
  });

  it("plans the rolling capture from the universe's clubs: window schedules, their final boxscores, future weeks, rosters (A-15)", () => {
    const receipt = (url: string, body: unknown) => { const rawBody = JSON.stringify(body);
      return { url, capturedAt: "2026-10-27T10:30:00Z", rawBody, bodySha256: createHash("sha256").update(rawBody).digest("hex") }; };
    const shift = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
    const game = (id: number, date: string, home: [number, string], away: [number, string], gameState = "OFF") => ({ id, gameType: 2, season: 20262027,
      startTimeUTC: `${date}T23:00:00Z`, gameState, homeTeam: { id: home[0], abbrev: home[1] }, awayTeam: { id: away[0], abbrev: away[1] } });
    const week = (start: string, games: Record<string, any[]>) => receipt(`https://api-web.nhle.com/v1/schedule/${start}`,
      { gameWeek: Array.from({ length: 7 }, (_, index) => ({ date: shift(start, index), games: games[shift(start, index)] ?? [] })) });
    const players = [{ playerId: 7, nhlPlayerId: 77, teamId: 1, playerClass: "skater" as const, rosterRevision: "r7" },
      { playerId: 8, nhlPlayerId: 88, teamId: 2, playerClass: "goalie" as const, rosterRevision: "r8" }];
    const args = { universe: players, seasonId: 20262027, date: "2026-10-27", weeks: 2 };
    expect(nativeDailyCaptureMethod("2026-10-26")).toBe("frozen_window");
    expect(nativeDailyCaptureMethod("2026-10-27")).toBe("rolling_14d");
    expect(() => nativeDailyRollingCapturePlan({ ...args, date: "2026-10-21" })).toThrow("capture_method_not_rolling");
    expect(nativeDailyRollingCapturePlan(args)).toEqual({ windowSchedules: ["https://api-web.nhle.com/v1/schedule/2026-10-13", "https://api-web.nhle.com/v1/schedule/2026-10-20"],
      boxscores: null, futureSchedules: ["https://api-web.nhle.com/v1/schedule/2026-10-27", "https://api-web.nhle.com/v1/schedule/2026-11-03"], rosters: null });
    const window = [week("2026-10-13", { "2026-10-14": [game(2026020101, "2026-10-14", [1, "AAA"], [3, "CCC"]), game(2026020102, "2026-10-14", [3, "CCC"], [4, "DDD"])] }),
      week("2026-10-20", { "2026-10-22": [game(2026020201, "2026-10-22", [2, "BBB"], [1, "AAA"])], "2026-10-26": [game(2026020301, "2026-10-26", [2, "BBB"], [3, "CCC"], "LIVE")] })];
    // Only final games of the universe's clubs; an unrelated club's game and a game not yet final are not fetched.
    expect(nativeDailyRollingCapturePlan({ ...args, scheduleReceipts: window })).toMatchObject({ rosters: null,
      boxscores: ["https://api-web.nhle.com/v1/gamecenter/2026020101/boxscore", "https://api-web.nhle.com/v1/gamecenter/2026020201/boxscore"] });
    const future = [week("2026-10-27", {}), week("2026-11-03", {})];
    expect(nativeDailyRollingCapturePlan({ ...args, scheduleReceipts: [...window, ...future] }).rosters)
      .toEqual(["https://api-web.nhle.com/v1/roster/AAA/20262027", "https://api-web.nhle.com/v1/roster/BBB/20262027"]);
    expect(() => nativeDailyRollingCapturePlan({ ...args, universe: [...players, { ...players[0], playerId: 9, nhlPlayerId: 99, teamId: 9 }],
      scheduleReceipts: [...window, ...future] })).toThrow("club_abbreviation_unknown");
  });

  it("leaves rolling participation uncovered, with a reason, when the roster or history is missing", () => {
    const schedule = { url: "https://api-web.nhle.com/v1/schedule/2026-10-27", capturedAt: "2026-10-27T10:50:00Z", rawBody: "{}",
      bodySha256: createHash("sha256").update("{}").digest("hex") };
    const bindings = { teams: new Map([[1, "TST"]]), sourceByGame: new Map([["2026020300:TST", schedule]]), exclusions: [],
      byTeam: new Map([["TST", [{ id: "2026020300", teamAbbreviation: "TST", startsAt: "2026-10-27T23:00:00Z", scheduleRevision: "s" }]]]) } as any;
    const players = [{ playerId: 7, nhlPlayerId: 77, teamId: 1, playerClass: "skater" as const, rosterRevision: "r7" }];
    const args = { players, bindings, frame: { histories: new Map() } as any, cutoffAt: "2026-10-27T11:00:00Z", seasonId: 20262027 };
    expect(buildRollingDailyParticipationInputs({ ...args, rosterReceipts: [] })).toMatchObject({ inputs: [], coverage: [{ playerId: 7, reasons: ["missing_official_club_roster"] }] });
    const roster = { ...schedule, url: "https://api-web.nhle.com/v1/roster/TST/20262027" };
    expect(buildRollingDailyParticipationInputs({ ...args, rosterReceipts: [roster] }).coverage[0].reasons).toEqual(["missing_rolling_history"]);
    expect(nativeDailyScheduleRevision([schedule, roster])).toBe(nativeDailyScheduleRevision([schedule]));
  });
});

describe("A-14 split materializations: one issuance from a skater and a goalie closure", () => {
  const date = "2026-10-15", cutoffAt = "2026-10-15T10:00:00Z", closedAt = "2026-10-15T11:30:00.000Z", issued = new Date("2026-10-15T12:00:00Z");
  const expiresAt = "2026-10-15T22:59:59.999Z", seasonId = 20262027, approvalRef = NATIVE_DAILY_APPROVED_METHODS.standingApprovalRef;
  const runIds = { skater: "00000000-0000-4000-8000-000000000201", goalie: "00000000-0000-4000-8000-000000000202" };
  const body = { id: 2026020001, season: seasonId, gameDate: "2026-10-01", gameType: 2, startTimeUTC: "2026-10-01T23:00:00Z", gameState: "FINAL",
    homeTeam: { id: 1 }, awayTeam: { id: 2 }, playerByGameStats: {
      homeTeam: { forwards: [{ playerId: 1001, toi: "20:00", goals: 1, assists: 0, sog: 3, hits: 0, blockedShots: 0, pim: 0 }], defense: [], goalies: [{ playerId: 9003 }] },
      awayTeam: { forwards: [{ playerId: 9001 }], defense: [], goalies: [{ playerId: 9002 }] } } };
  const rawBody = JSON.stringify(body), sha = (value: string) => createHash("sha256").update(value).digest("hex");
  const boxscore = { url: `https://api-web.nhle.com/v1/gamecenter/${body.id}/boxscore`, capturedAt: "2026-10-02T03:00:00Z", bodySha256: sha(rawBody), rawBody };
  const week = (start: string) => {
    const raw = JSON.stringify({ gameWeek: Array.from({ length: 7 }, (_, i) => {
      const day = new Date(Date.parse(`${start}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
      return { date: day, games: day === "2026-10-01" ? [{ id: body.id, season: seasonId, gameType: 2, startTimeUTC: body.startTimeUTC,
        gameState: "OFF", gameScheduleState: "OK", homeTeam: { id: 1, abbrev: "AAA" }, awayTeam: { id: 2, abbrev: "BBB" } }] : [] };
    }) });
    return { url: `https://api-web.nhle.com/v1/schedule/${start}`, capturedAt: "2026-10-15T09:00:00Z", rawBody: raw, bodySha256: sha(raw) };
  };
  const universeRows = [...Array.from({ length: 62 }, (_, i) => ({ playerId: 100 + i, nhlPlayerId: 1001 + i, teamId: 1, rosterRevision: `r${100 + i}`, playerClass: "skater" as const })),
    ...Array.from({ length: 7 }, (_, i) => ({ playerId: 200 + i, nhlPlayerId: 2001 + i, teamId: 1, rosterRevision: `r${200 + i}`, playerClass: "goalie" as const }))];
  // Today's game first, then later games: every input targets the next 20 scheduled team games (25 for the overflow case).
  const games = Array.from({ length: 25 }, (_, i) => ({ gameId: 2026020100 + i, startsAt: new Date(Date.parse("2026-10-15T23:00:00Z") + i * 2 * 86400000).toISOString() }));
  const fixture = (perSkater = 20) => {
    const frame = buildRollingParticipationHistories({ cutoffAt, seasonId, players: universeRows.map(({ playerId, nhlPlayerId, teamId, playerClass }) =>
      ({ playerId, nhlPlayerId, teamId, playerClass })), scheduleReceipts: [week("2026-10-01"), week("2026-10-08")], boxscoreReceipts: [boxscore] });
    const inputs = universeRows.flatMap(player => games.slice(0, player.playerClass === "skater" ? perSkater : 20).flatMap(game => {
      const base = { playerClass: player.playerClass, cutoffAt, scheduleEvidence: frame.evidence, rosterEvidence: frame.evidence, targetRosterObservation: null,
        history: frame.histories.get(player.playerId)!, scope: { playerId: player.playerId, nhlPlayerId: player.nhlPlayerId, seasonId, teamId: 1,
          gameId: game.gameId, scheduledAt: game.startsAt, scheduleRevision: "schedule", rosterRevision: player.rosterRevision } };
      return player.playerClass === "skater" ? [{ ...base, version: "skater-rolling-14d-participation-input-v1" }]
        : [{ ...base, version: "goalie-rolling-14d-participation-input-v1" }, { ...base, version: "goalie-rolling-14d-start-input-v1" }];
    })) as any[];
    const split = buildDailyMaterializationRequestsV2({ acquisition: { seasonId, cutoffAt, games: [{ id: body.id, seasonId, date: "2026-10-01", type: 2,
      startTime: body.startTimeUTC, homeTeamId: 1, awayTeamId: 2, endpoints: ["boxscore"] }], roster: [], receipts: [boxscore] } as any,
    universe: universeRows, means: { cutoffAt, nativeSelection: [], additionalNativeObservations: [], parents: [] }, participationInputs: inputs,
    participationParents: frame.parents, cutoffAt, runIds, date, seasonId, games: games.slice(0, 1) });
    return { inputs, split };
  };

  it("splits a 62-skater, 7-goalie, 20-game day (1,520 inputs) into two bounded closures and issues it once", async () => {
    const { inputs, split } = fixture();
    expect(inputs).toHaveLength(1520);
    const { skater, goalie } = split.requests;
    expect(skater.participationInputs).toHaveLength(1240);
    expect(goalie.participationInputs).toHaveLength(280);
    expect([skater.sourceKey, goalie.sourceKey]).toEqual([NATIVE_DAILY_SOURCE_KEYS.skater, NATIVE_DAILY_SOURCE_KEYS.goalie]);
    expect(skater.closureScopeHash).toBe(split.closureScopeHash);
    expect(goalie.closureScopeHash).toBe(split.closureScopeHash);
    // The unsplit request would exceed the materializer's bound.
    expect(() => prepareNativeInputMaterialization({ ...skater, participationInputs: [...skater.participationInputs!, ...goalie.participationInputs!] }, closedAt))
      .toThrow("Parent acquisition scope is incomplete or duplicated.");
    const proofs = { skater: { status: "closed", ...prepareNativeInputMaterialization(skater, closedAt) },
      goalie: { status: "closed", ...prepareNativeInputMaterialization(goalie, closedAt) } };
    const command = { version: "native-output-preparation-v1" as const, slotKey: `morning:${date}`, dueAt: "2026-10-15T12:00:00.000Z",
      materialization: { runId: skater.runId, sourceKey: skater.sourceKey, date, closureScopeHash: split.closureScopeHash },
      goalieMaterialization: { runId: goalie.runId, sourceKey: goalie.sourceKey, date, closureScopeHash: split.closureScopeHash },
      games: games.slice(0, 1), requiredAcquisitionScopes: split.requiredAcquisitionScopes,
      reviewedPlan: { version: "native-baseline-publication-plan-v1" as const, seasonId, rows: [] },
      daily: { expiresAt, participationOwnerApprovalRef: approvalRef, freshMeans: { standingApprovalRef: approvalRef, scheduleRevision: "daily-schedule:synthetic" } } };
    let counter = 300;
    const result = await prepareNativeCadenceOutputs(command, proofs, issued, () => `00000000-0000-4000-8000-${String(counter++).padStart(12, "0")}`);
    expect(result.receipt).toMatchObject({ participationEntries: 1520, nativeInputs: 0 });
    // One plan, one slot, one catalog head: both closures are required sources of the same issuance.
    const input = result.cadenceCommand.cadenceInput;
    expect(input.cadence.requiredSources.slice().sort()).toEqual([NATIVE_DAILY_SOURCE_KEYS.goalie, NATIVE_DAILY_SOURCE_KEYS.skater]);
    expect(input.inputSources).toEqual({ skater: skater.sourceKey, goalie: goalie.sourceKey });
    expect(result.cadenceCommand.producerReceiptIds).toEqual({ [skater.sourceKey]: proofs.skater.closure.id, [goalie.sourceKey]: proofs.goalie.closure.id });
    const manifests = nativeCadenceSourceManifests(input);
    expect(manifests[skater.sourceKey]).toEqual(proofs.skater.manifest);
    expect(manifests[goalie.sourceKey]).toEqual(proofs.goalie.manifest);
    const reviewed = applyNativeDailyReview(result.plan, { version: "native-daily-review-decision-v1", planHash: playerForecastSourcePayloadHash(result.plan),
      decision: "approve", reviewRef: "synthetic-review", reviewer: "synthetic", reviewedAt: "2026-10-15T12:05:00Z", findings: [] } as any);
    const at = new Date("2026-10-15T12:10:00Z");
    const command2 = { ...result.cadenceCommand, cadenceInput: { ...input, publicationPlan: reviewed },
      catalogHead: { headId: runIds.skater, expectedRevision: 0, expectedHash: null, observationId: runIds.goalie } };
    await expect(validateCadenceCommand(command2 as any, proofs, at)).resolves.toMatchObject({ validation: { rows: reviewed.rows.length } });
    // Either closure alone is not the issuance.
    await expect(validateCadenceCommand(command2 as any, proofs.skater, at)).rejects.toThrow("materialization_publication_scope_mismatch");
    await expect(validateCadenceCommand(command2 as any, { skater: proofs.skater, goalie: proofs.skater }, at)).rejects.toThrow("materialization_publication_scope_mismatch");
    // Both closures share content-addressed parent and receipt rows; the store holds each row once.
    const all = [...proofs.skater.rows, proofs.skater.report, proofs.skater.closure, ...proofs.goalie.rows, proofs.goalie.report, proofs.goalie.closure];
    const shared = all.filter(row => all.filter(other => other.id === row.id).length > 1);
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.every(row => all.filter(other => other.id === row.id).every(other => other.payload_hash === row.payload_hash))).toBe(true);
    const stored = [...new Map(all.map(row => [row.id, row])).values()];
    const local: any = { from() { let selected = stored.slice(); const query: any = { select: () => query, limit: (n: number) => { selected = selected.slice(0, n); return query; },
      eq: (key: string, value: unknown) => { selected = selected.filter(row => (row as any)[key] === value); return query; }, abortSignal: () => query,
      then: (ok: any, no: any) => Promise.resolve({ data: selected, error: null }).then(ok, no) }; return query; } };
    const cadenceInput = { ...command2.cadenceInput, cadence: { ...command2.cadenceInput.cadence, now: at } };
    const observed = await observeClosedNativeCadenceSources(cadenceInput, local, command2.producerReceiptIds);
    expect(observed).toMatchObject({ complete: true, reason: null });
    expect(observed.sources.map(source => source.key).sort()).toEqual([NATIVE_DAILY_SOURCE_KEYS.goalie, NATIVE_DAILY_SOURCE_KEYS.skater]);
    expect(await observeClosedNativeCadenceSources(cadenceInput, local, { [skater.sourceKey]: proofs.skater.closure.id }))
      .toMatchObject({ complete: false, reason: `producer_closed_receipt_missing:${goalie.sourceKey}` });
    const published = await publishNativeBaselineCadence({ ...cadenceInput, cadence: { ...cadenceInput.cadence, sources: observed.sources } });
    expect(published.status).toBe("dry_run");
    // A closure that reports another part's revision holds the slot instead of publishing a partial day.
    const swapped = observed.sources.map(source => ({ ...source, revision: observed.sources.find(other => other.key !== source.key)!.revision }));
    expect(await publishNativeBaselineCadence({ ...cadenceInput, cadence: { ...cadenceInput.cadence, sources: swapped } }))
      .toMatchObject({ status: "held", reasons: ["native_input_manifest_mismatch"] });
  }, 120000);

  it("still stops offline when one kind alone exceeds the bound", () => {
    expect(() => fixture(25)).toThrow("participation_inputs_exceed_materialization_bound:skater:1550");
  }, 60000);
});
