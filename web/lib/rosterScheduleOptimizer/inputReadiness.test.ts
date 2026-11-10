import { describe, expect, it } from "vitest";
import { defaultWorkspace } from "./workspace";
import type { ManagerRuleOverrides, PlanningSnapshot } from "./planningTypes";
import { INFERRED_ACQUISITION_TIMING_KEY, INFERRED_ACQUISITION_TIMING_SOURCE } from "./providerRules";
import { manualLineupConfirmation, planningInputIssues, rememberInputConfirmation } from "./inputReadiness";

function fixture(): PlanningSnapshot {
  const workspace = defaultWorkspace(new Date("2026-11-10T12:00:00Z"));
  return { id: "synthetic", context: { ...workspace.context, provider: "yahoo", timeZone: "UTC" },
    roster: [{ playerId: "7", position: "active" }], players: [], games: [], forecasts: [], lockedAssignments: [], realized: {}, opponent: null, evidence: {},
    rules: { ...workspace.rules, scoring: { mode: "points", weights: { GOALS: 3 }, categories: [] }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "week", start: "2026-11-09T00:00:00Z", end: "2026-11-16T00:00:00Z", remaining: 2, source: "provider" }] } };
}
const ids = (snapshot: PlanningSnapshot | null, overrides: ManagerRuleOverrides = {}, acquisitions = true) =>
  planningInputIssues(snapshot, overrides, { acquisitions }).map(issue => issue.id);

describe("planning input readiness", () => {
  it("uses supplied provider facts without a session acknowledgement", () => {
    const snapshot = fixture(), before = structuredClone(snapshot);
    expect(ids(snapshot, { timeZone: "UTC" })).toEqual([]);
    expect(snapshot).toEqual(before);
  });
  it("asks for unknown scoring and acquisition values rather than accepting them with a click", () => {
    const snapshot = fixture(); snapshot.rules.scoring.weights = {}; snapshot.rules.acquisitionTiming = "unknown";
    snapshot.rules.acquisitionCost = null; snapshot.rules.periods = [];
    const questions = planningInputIssues(snapshot, { timeZone: "UTC" }, { acquisitions: true });
    expect(questions.map(issue => issue.id)).toEqual(["scoring", "timing", "budget"]);
    expect(questions.every(issue => issue.confirmation === undefined)).toBe(true);
  });
  it("does not require acquisition details to inspect a no-acquisition lineup", () => {
    const snapshot = fixture(); snapshot.rules.acquisitionTiming = "unknown"; snapshot.rules.periods = [];
    expect(ids(snapshot, { timeZone: "UTC" }, false)).toEqual([]);
    expect(ids(snapshot, { timeZone: "UTC" })).toEqual(["timing", "budget"]);
  });
  it("retains explicit manual lineup settings across reload and unrelated player or scoring changes", () => {
    const snapshot = fixture(); snapshot.context.provider = "manual";
    expect(ids(snapshot)).toEqual(["lineup"]);
    const saved = rememberInputConfirmation({}, manualLineupConfirmation(snapshot));
    const reopened = structuredClone(snapshot); reopened.id = "new-read"; reopened.context.asOf = "2026-11-10T13:00:00Z";
    reopened.rules.scoring.weights.GOALS = 4; reopened.roster.push({ playerId: "8", position: "bench" });
    expect(ids(reopened, JSON.parse(JSON.stringify(saved)))).toEqual([]);
    reopened.rules.rosterSlots.C += 1;
    expect(ids(reopened, saved)).toEqual(["lineup"]);
  });
  it("asks again when the relevant league day boundary changes", () => {
    const snapshot = fixture();
    expect(ids(snapshot)).toEqual(["timezone"]);
    expect(ids(snapshot, { timeZone: "UTC" })).toEqual([]);
    snapshot.context.timeZone = "America/New_York";
    expect(ids(snapshot, { timeZone: "UTC" })).toEqual(["timezone"]);
  });
  it("scopes add-timing confirmation to the inferred value and reuses existing exact-note answers", () => {
    const snapshot = fixture();
    snapshot.evidence[INFERRED_ACQUISITION_TIMING_KEY] = { source: INFERRED_ACQUISITION_TIMING_SOURCE, asOf: null, seasonId: snapshot.context.seasonId, completeness: "partial", limitations: ["Same-day inference"] };
    const issue = planningInputIssues(snapshot, { timeZone: "UTC" }, { acquisitions: true })[0];
    expect(issue.id).toBe("inferred-timing");
    const saved = rememberInputConfirmation({ timeZone: "UTC" }, issue.confirmation!.key);
    expect(ids(snapshot, saved)).toEqual([]);
    expect(ids(snapshot, { timeZone: "UTC", confirmedRuleNotes: ["Same-day inference"] })).toEqual([]);
    snapshot.rules.acquisitionTiming = "next_day"; snapshot.evidence[INFERRED_ACQUISITION_TIMING_KEY].limitations = ["Next-day inference"];
    expect(ids(snapshot, saved)).toEqual(["inferred-timing"]);
    expect(ids(snapshot, saved, false)).toEqual([]);
  });
  it("remembers the assumed reset rule across weeks but not a changed day boundary", () => {
    const snapshot = fixture(); snapshot.rules.periods[0].id = "yahoo-week-6";
    const issue = planningInputIssues(snapshot, { timeZone: "UTC" }, { acquisitions: true })[0];
    expect(issue.id).toBe("weekly-reset");
    const saved = rememberInputConfirmation({ timeZone: "UTC" }, issue.confirmation!.key);
    snapshot.rules.periods[0] = { ...snapshot.rules.periods[0], id: "yahoo-week-7", remaining: 1 };
    expect(ids(snapshot, saved)).toEqual([]);
    snapshot.context.timeZone = "America/New_York";
    expect(ids(snapshot, { ...saved, timeZone: snapshot.context.timeZone })).toEqual(["weekly-reset"]);
  });
  it("keeps unrelated answers and replaces only the same rule's old answer within the schema bound", () => {
    const saved = rememberInputConfirmation({ timeZone: "UTC", confirmedRuleNotes: ["unrelated provider note", "rso-input:add-timing:same_day", "rso-input:weekly-reset:UTC"] }, "rso-input:add-timing:next_day");
    expect(saved.confirmedRuleNotes).toEqual(["unrelated provider note", "rso-input:weekly-reset:UTC", "rso-input:add-timing:next_day"]);
    expect(rememberInputConfirmation({ confirmedRuleNotes: Array.from({ length: 20 }, (_, i) => `note ${i}`) }, "new note").confirmedRuleNotes).toHaveLength(20);
  });
  it("does not treat retained provider inputs or unsupported manual formats as confirmed", () => {
    const snapshot = fixture();
    const retained = planningInputIssues(snapshot, { timeZone: "UTC" }, { retainedProvider: true })[0];
    expect(retained.id).toBe("provider"); expect(retained.confirmation).toBeUndefined();
    snapshot.context.provider = "manual"; snapshot.rules.lineupMode = "unsupported";
    expect(planningInputIssues(snapshot, rememberInputConfirmation({}, manualLineupConfirmation(snapshot)))[0].confirmation).toBeUndefined();
    expect(ids(snapshot)).toEqual(["lineup"]);
  });
});
