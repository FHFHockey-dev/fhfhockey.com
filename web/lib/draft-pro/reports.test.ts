import { describe, expect, it } from "vitest";
import { buildDraftProReport } from "./reports";

const player = (id: string, role: "skater" | "goalie" = "skater") => ({ id, name: id, role, eligiblePositions: role === "goalie" ? ["G"] : ["C"], teamAbbreviation: "AAA", projectionSeason: "20262027", globalVorp: 2, rankValue: 2, projectedPoints: 10, categoryValues: role === "goalie" ? { SAVES_GOALIE: 90, SHOTS_AGAINST_GOALIE: 100, GOALS_AGAINST_GOALIE: 10, TOTAL_TOI: 3600 } : { GOALS: 2 } });
const input = { roster: [player("a"), player("g", "goalie")], categoryWeights: { GOALS: 1, SAVE_PERCENTAGE: 1 }, leagueType: "categories" as const, season: "20262027", source: { projection: { id: "blend", version: "v2", origin: "server" as const }, schedule: { season: "20262027", startWeek: 1, endWeek: 2, lineupMode: "daily" as const, rosterSlots: { C: 1, G: 1 } } }, scoring: { GOALS: 1 }, sourceWeights: { blend: 1 } };

describe("Draft Pro reports", () => {
  it("reconciles shared roster totals, including goalie ratios", () => {
    const report = buildDraftProReport("draft_summary", input, new Date("2026-09-07T00:00:00Z"));
    expect(report.totals.rawVorp).toBe(4);
    expect(report.totals.projectedPoints).toBe(20);
    expect(report.totals.categories.GOALS).toBe(2);
    expect(report.totals.categories.SAVE_PERCENTAGE).toBeCloseTo(0.9);
    expect(report.schedule.state).toBe("schedule_unavailable");
    expect(report.provenance.projectionVersion).toBe("v2");
  });
  it("is deterministic for the same inputs and marks missing categories explicitly", () => {
    const one = buildDraftProReport("draft_summary", { ...input, roster: [] }, new Date("2026-09-07T00:00:00Z"));
    const two = buildDraftProReport("draft_summary", { ...input, roster: [] }, new Date("2026-09-07T00:00:00Z"));
    expect(one.sourceFingerprint).toBe(two.sourceFingerprint);
    expect(one.weaknesses[0]).toContain("unavailable");
  });
  it("uses category direction and does not treat missing reference totals as a known tie", () => {
    const rosterGoalie = { ...player("g", "goalie"), categoryValues: { GOALS_AGAINST_GOALIE: 10, TOTAL_TOI: 3600 } };
    const referenceGoalie = { ...player("r", "goalie"), categoryValues: { GOALS_AGAINST_GOALIE: 8, TOTAL_TOI: 3600 } };
    const report = buildDraftProReport("draft_summary", { ...input, roster: [rosterGoalie], referenceRoster: [referenceGoalie], referenceBasis: "Other Team roster", categoryWeights: { GOALS_AGAINST_AVERAGE: 1, SAVE_PERCENTAGE: 1 } });
    expect(report.weaknesses).toContain("goals against average is weaker than Other Team roster");
    expect(report.weaknesses.some((value) => value.includes("save percentage comparison is unavailable"))).toBe(true);
  });
});
