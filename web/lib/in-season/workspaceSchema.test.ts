import { describe, expect, it } from "vitest";
import { saveWorkspaceSchema, workspaceQuerySchema } from "./workspaceSchema";

const context = { provider: "manual", seasonId: 20262027, leagueId: "league", teamId: "team", startDate: "2026-10-01", endDate: "2026-10-07", timeZone: "America/New_York", asOf: "2026-10-01T12:00:00Z" };
const rules = { lineupMode: "daily", rosterSlots: { C: 1 }, lineupPeriods: [{ id: "week", start: "2026-10-01T00:00:00Z", end: "2026-10-08T00:00:00Z", lockAt: null }], acquisitionTiming: "unknown", acquisitionCost: null, periods: [], scoring: { mode: "points", weights: {}, categories: [] }, goalieMinimum: { required: null, credited: null, periodStart: "2026-10-01", periodEnd: "2026-10-07", counts: "unknown", penalty: "unknown" }, unsupported: [] };
const workspace = { version: 1, context, rules, managerRuleOverrides: { acquisitionTiming: "next_day", scoring: { categories: [{ key: "GOALS", direction: "higher" }] }, goalieMinimum: { credited: 2 } }, roster: [], intent: { revision: 0, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 10 }, manualPlayers: [], unresolvedNames: [], realized: {}, opponent: null };
const snapshot = { id: "snapshot", context, players: [], roster: [], games: [], forecasts: [], rules, lockedAssignments: [], realized: {}, opponent: null, evidence: {} };

describe("saved in-season workspace validation", () => {
  it("accepts a coherent manual workspace and snapshot", () => {
    const parsed = saveWorkspaceSchema.safeParse({ workspace, snapshot, expectedVersion: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.workspace.rules.lineupPeriods).toEqual(rules.lineupPeriods);
      expect(parsed.data.workspace.managerRuleOverrides?.acquisitionTiming).toBe("next_day");
      expect(parsed.data.workspace.managerRuleOverrides?.scoring).toEqual(workspace.managerRuleOverrides.scoring);
      expect(parsed.data.workspace.managerRuleOverrides?.goalieMinimum).toEqual({ credited: 2 });
      expect(parsed.data.snapshot?.rules.goalieMinimum.periodStart).toBe(rules.goalieMinimum.periodStart);
    }
  });
  it("preserves manager-entered locked assignments", () => {
    const lockedAssignments = [{ date: "2026-10-01", playerId: "p", slotId: "G" }];
    const parsed = saveWorkspaceSchema.safeParse({ workspace: { ...workspace, lockedAssignments }, snapshot, expectedVersion: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.workspace.lockedAssignments).toEqual(lockedAssignments);
  });
  it("preserves explicit waiver policy and spend without inventing missing values", () => {
    const waiverRules = { ...rules, waivers: { mode: "budget", remainingBudget: 35 } };
    const waiverStep = { id: "bid", type: "add", playerId: "p", at: context.asOf, effectiveAt: context.asOf, conditional: false, waiverSpend: 7, dependsOn: [] };
    const parsed = saveWorkspaceSchema.safeParse({ workspace: { ...workspace, rules: waiverRules, intent: { ...workspace.intent, steps: [waiverStep] } }, snapshot: { ...snapshot, rules: waiverRules }, expectedVersion: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.workspace.rules.waivers).toEqual(waiverRules.waivers);
      expect(parsed.data.workspace.intent.steps[0].waiverSpend).toBe(7);
    }
    expect(saveWorkspaceSchema.safeParse({ workspace: { ...workspace, rules: { ...rules, waivers: { mode: "unknown", remainingBudget: null } } }, snapshot: null, expectedVersion: null }).success).toBe(true);
    expect(saveWorkspaceSchema.safeParse({ workspace: { ...workspace, rules: { ...rules, waivers: { mode: "budget", remainingBudget: -1 } } }, snapshot: null, expectedVersion: null }).success).toBe(false);
  });
  it("orders reset and lock instants by absolute time across DST offsets", () => {
    const period = { id: "dst", start: "2026-11-01T01:30:00-04:00", end: "2026-11-01T01:15:00-05:00", remaining: 1, source: "manager" };
    const parse = (start: string, end: string, lockAt: string) => saveWorkspaceSchema.safeParse({ workspace: { ...workspace, rules: { ...rules, periods: [{ ...period, start, end }], lineupPeriods: [{ id: "dst", start, end, lockAt }] } }, snapshot: null, expectedVersion: null });
    expect(parse(period.start, period.end, "2026-11-01T01:45:00-04:00").success).toBe(true);
    expect(parse(period.end, period.start, period.end).success).toBe(false);
    expect(parse(period.start, period.end, "2026-11-01T01:30:00-05:00").success).toBe(false);
  });
  it("rejects account fields and cross-context snapshots", () => {
    expect(saveWorkspaceSchema.safeParse({ workspace: { ...workspace, userId: "other" }, snapshot, expectedVersion: null }).success).toBe(false);
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: { ...snapshot, context: { ...context, teamId: "other" } }, expectedVersion: 1 }).success).toBe(false);
  });
  it("rejects invalid context ranges and query account spoofing", () => {
    const query = { provider: "manual", seasonId: 20262027, leagueId: "league", teamId: "team", startDate: "2026-10-07", endDate: "2026-10-01" };
    expect(workspaceQuerySchema.safeParse(query).success).toBe(false);
    expect(workspaceQuerySchema.safeParse({ ...query, endDate: "2026-10-07", userId: "other" }).success).toBe(false);
    expect(workspaceQuerySchema.safeParse({ ...query, startDate: "2026-02-31", endDate: "2026-10-07" }).success).toBe(false);
    expect(workspaceQuerySchema.safeParse({ ...query, startDate: "2026-10-01", endDate: "2027-10-03" }).success).toBe(false);
  });
  it("rejects impossible probabilities, ownership, costs and rule periods", () => {
    const invalidRules = { ...rules, acquisitionCost: -1 };
    expect(saveWorkspaceSchema.safeParse({ workspace: { ...workspace, rules: invalidRules }, snapshot, expectedVersion: null }).success).toBe(false);
    const invalidPeriod = { ...rules, lineupPeriods: [{ id: "bad", start: "2026-10-08T00:00:00Z", end: "2026-10-01T00:00:00Z", lockAt: null }] };
    expect(saveWorkspaceSchema.safeParse({ workspace: { ...workspace, rules: invalidPeriod }, snapshot, expectedVersion: null }).success).toBe(false);
    const badProbability = { ...snapshot, forecasts: [{ playerId: "p", gameId: "g", stats: {}, conditioning: "unconditional", startProbability: 1.2, confirmedStart: false, revisionId: "r", issuedAt: context.asOf, modelVersion: null, limitations: [] }] };
    expect(saveWorkspaceSchema.safeParse({ workspace, snapshot: badProbability, expectedVersion: null }).success).toBe(false);
    const badOwnership = { ...workspace, manualPlayers: [{ id: "p", nhlId: null, name: "Player", teamAbbreviation: null, eligiblePositions: [], playerClass: "skater", availability: "unknown", ownership: 101, canDrop: null, holdValue: null, reserveEligibility: [] }] };
    expect(saveWorkspaceSchema.safeParse({ workspace: badOwnership, snapshot, expectedVersion: null }).success).toBe(false);
  });
});
