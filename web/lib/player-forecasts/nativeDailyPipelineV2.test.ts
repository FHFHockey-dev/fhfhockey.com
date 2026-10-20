// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertParticipationCoverage, assertStandingApprovalMethods, buildRollingDailyParticipationInputs, NATIVE_DAILY_APPROVED_METHODS, FROZEN_PARTICIPATION_LAST_CUTOFF, NATIVE_DAILY_V2_FLAGS, nativeDailyKnownConflicts,
  nativeDailyNullParticipation, nativeDailyParticipationMethod, nativeDailyScheduleRevision, nativeDailyUniverse, nativeDailyV2Flags } from "./nativeDailyPipelineV2";
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
    const crowded = universe({ unmapped: Array.from({ length: 6 }, (_, index) => ({ yahooPlayerKey: `477.p.${index}` })) });
    expect(nativeDailyUniverse(crowded, off).gate).toMatchObject({ unresolved: 6, thresholdsApplied: false, thresholdsExceeded: true });
    expect(() => nativeDailyUniverse(crowded, { ...off, universeThresholds: true })).toThrow("universe_threshold_exceeded");
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
