import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { defaultWorkspace } from "./workspace";
import { reconcileIntent } from "./reconciliation";
import { buildTimeline } from "./planningTimeline";
import type { PlanStep, PlanningSnapshot } from "./planningTypes";
const legal = (s: PlanningSnapshot, steps: PlanStep[]) => { const t = buildTimeline(s, defaultWorkspace(new Date("2026-10-01T00:00:00Z")).intent, steps); t.at("9999-12-31T23:59:59Z"); return t.legal; };
const ws = defaultWorkspace(new Date("2026-10-01T00:00:00Z"));
const member = (id: string, extra: Partial<PlanningSnapshot["players"][number]> = {}) => ({ id, nhlId: id.length, name: id, teamAbbreviation: "CAR", eligiblePositions: ["C"], playerClass: "skater" as const,
  availability: "rostered" as const, ownership: null, canDrop: true, holdValue: null, reserveEligibility: [], ...extra });
const base = (extra: Partial<PlanningSnapshot["rules"]> = {}): PlanningSnapshot => ({ id: "s", context: { ...ws.context, timeZone: "UTC" },
  players: [member("holder", { reserveEligibility: ["IR"] }), member("inj", { reserveEligibility: ["IR"] }), member("fa", { availability: "free_agent" }), member("wv", { availability: "waivers" })],
  roster: [{ playerId: "holder", position: "IR" }, { playerId: "inj", position: "bench" }], games: [], forecasts: [],
  rules: { ...ws.rules, rosterSlots: { C: 1, BN: 2, IR: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1, waivers: { mode: "priority", remainingBudget: null },
    periods: [{ id: "week", start: "2026-10-01T00:00:00Z", end: "2026-10-08T00:00:00Z", remaining: 3, source: "provider" }], ...extra },
  lockedAssignments: [], realized: {}, opponent: null, evidence: {} });
const out: Record<string, unknown> = {};
describe("C7 R30 reconciliation vs timeline", () => {
  it("X1 legal plan (drop the IR holder at T1, reserve at T2) → no reconciliation issue", () => {
    const s = base();
    const steps: PlanStep[] = [{ id: "swap", type: "add", playerId: "fa", dropPlayerId: "holder", at: "2026-10-02T06:00:00Z", effectiveAt: "2026-10-02T06:00:00Z", conditional: true, dependsOn: [] },
      { id: "res", type: "reserve", playerId: "inj", reservePosition: "IR", at: "2026-10-02T12:00:00Z", effectiveAt: "2026-10-02T12:00:00Z", conditional: false, dependsOn: [] }];
    const r = reconcileIntent(s, { ...ws.intent, steps });
    out.X1 = { timelineLegal: legal(s, steps), issues: r.issues };
    expect(legal(s, steps)).toBe(true); expect(r.issues).toEqual([]);
  });
  it("X2 action order vs effective order: next-day add (at T1, effective T3) dropping the IR holder, reserve at T2 — timeline illegal, reconciliation silent (false negative)", () => {
    const s = base({ acquisitionTiming: "next_day" });
    const steps: PlanStep[] = [{ id: "swap", type: "add", playerId: "fa", dropPlayerId: "holder", at: "2026-10-02T06:00:00Z", effectiveAt: "2026-10-03T00:00:00Z", conditional: true, dependsOn: [] },
      { id: "res", type: "reserve", playerId: "inj", reservePosition: "IR", at: "2026-10-02T12:00:00Z", effectiveAt: "2026-10-02T12:00:00Z", conditional: false, dependsOn: [] }];
    const r = reconcileIntent(s, { ...ws.intent, steps });
    out.X2 = { timelineLegal: legal(s, steps), issues: r.issues, suggestedSteps: r.suggestedSteps };
    expect(legal(s, steps)).toBe(false);
  });
  it("X3 waiver claim with no waiverClearsAt: timeline rejects; does reconciliation flag it?", () => {
    const s = base();
    const steps: PlanStep[] = [{ id: "claim", type: "add", playerId: "wv", at: "2026-10-02T06:00:00Z", effectiveAt: "2026-10-02T06:00:00Z", conditional: true, dependsOn: [] }];
    const r = reconcileIntent(s, { ...ws.intent, steps });
    out.X3 = { timelineLegal: legal(s, steps), issues: r.issues };
    expect(legal(s, steps)).toBe(false);
    if (process.env.C7_R30_OUT) writeFileSync(process.env.C7_R30_OUT, JSON.stringify(out, null, 2));
  });
});
