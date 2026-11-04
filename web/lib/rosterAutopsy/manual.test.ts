import { describe, expect, it } from "vitest";

import { defaultWorkspace } from "lib/rosterScheduleOptimizer/workspace";
import type { PlanningPlayer } from "lib/rosterScheduleOptimizer/planningTypes";
import { analyzeRoster, copyManualRsoWorkspace, emptyWorkspace, mergeManualRsoWorkspace, parseWorkspace, retainedRecentPoints, rsoMergeCandidates, storageKey, type ManualPlayer } from "./manual";

const player = (id: string, eligibility: string, status: ManualPlayer["status"] = "bench"): ManualPlayer =>
  ({ id, name: id, team: "", eligibility, status, recent: null });
const reviewed = (players: ManualPlayer[], slots: Partial<ReturnType<typeof emptyWorkspace>["slots"]>) => ({
  ...emptyWorkspace(), players, slots: { ...emptyWorkspace().slots, ...slots }, slotsReviewed: true, rosterReviewed: true,
});

describe("manual roster structure", () => {
  it("uses one player at most once and makes overlapping position coverage visible", () => {
    const one = analyzeRoster(reviewed([player("dual", "C/LW")], { C: "1", LW: "1" }))!;
    expect(one.assignments).toHaveLength(1);
    expect(one.totalSlots).toBe(2);
    expect(one.positions.find(row => row.position === "C")?.state).toBe("covered");
    expect(one.positions.find(row => row.position === "LW")?.state).toBe("covered");
    const two = analyzeRoster(reviewed([player("dual", "C/LW"), player("center", "C")], { C: "1", LW: "1" }))!;
    expect(two.assignments.map(row => `${row.playerId}:${row.slotType}`).sort()).toEqual(["center:C", "dual:LW"]);
  });

  it("counts a bench player, excludes reserve players, and flags a confirmed positional gap", () => {
    const result = analyzeRoster(reviewed([player("center", "C"), player("wing", "LW", "IR")], { C: "2", LW: "1" }))!;
    expect(result.available).toBe(1);
    expect(result.excludedReserves).toBe(1);
    expect(result.positions.find(row => row.position === "C")).toMatchObject({ state: "short", dedicatedSlots: 2 });
    expect(result.positions.find(row => row.position === "LW")).toMatchObject({ state: "short", dedicatedSlots: 1 });
  });

  it("keeps missing, generic, unreviewed or unresolved eligibility from becoming a definite gap", () => {
    for (const roster of [[player("unknown", "")], [player("generic", "F")]]) {
      const result = analyzeRoster(reviewed(roster, { C: "1", F: "1" }))!;
      expect(result.incomplete).toBe(true);
      expect(result.positions.find(row => row.position === "C")?.state).toBe("needs_review");
    }
    const result = analyzeRoster({ ...reviewed([player("center", "C")], { C: "2" }), rosterReviewed: false });
    expect(result?.positions.find(row => row.position === "C")?.state).toBe("needs_review");
    const unresolved = analyzeRoster({ ...reviewed([player("center", "C")], { C: "2" }), unresolved: ["Unmatched"] });
    expect(unresolved?.incomplete).toBe(true);
  });

  it("distinguishes flex-only and absent slots and requires reviewed valid slot counts", () => {
    const roster = reviewed([player("wing", "LW")], { F: "2" });
    const result = analyzeRoster(roster)!;
    expect(result.positions.find(row => row.position === "LW")?.state).toBe("flex_only");
    expect(result.positions.find(row => row.position === "G")?.state).toBe("no_slot");
    expect(analyzeRoster({ ...roster, slotsReviewed: false })).toBeNull();
    expect(analyzeRoster({ ...roster, slots: { ...roster.slots, F: "-1" } })).toBeNull();
    expect(analyzeRoster({ ...roster, slots: { ...roster.slots, F: "26" } })).toBeNull();
    expect(analyzeRoster({ ...roster, slots: { ...roster.slots, C: "25", D: "16" } })).toBeNull();
  });
});

describe("local workspace and RSO handoff", () => {
  it("scopes saved workspaces and refuses invalid or duplicate records", () => {
    expect(storageKey(null)).not.toBe(storageKey("user-1"));
    expect(storageKey("user-1")).not.toBe(storageKey("user-2"));
    const valid = reviewed([player("one", "C")], { C: "1" });
    expect(parseWorkspace(JSON.stringify(valid))).toEqual(valid);
    expect(parseWorkspace(JSON.stringify({ ...valid, players: [valid.players[0], valid.players[0]] }))).toBeNull();
    expect(parseWorkspace(JSON.stringify({ ...valid, futureData: true }))).toBeNull();
    expect(parseWorkspace("not json")).toBeNull();
  });

  it("copies only manual RSO input and retains missing players for review without changing RSO", () => {
    const source = defaultWorkspace(new Date("2026-10-29T12:00:00Z"));
    const rosterPlayer: PlanningPlayer = { id: "10", nhlId: 10, name: "Example", teamAbbreviation: "AAA", eligiblePositions: ["C", "LW"], playerClass: "skater", availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [], recentTotals: { games: 5, stats: { GOALS: 4, ASSISTS: 6 } } };
    source.roster = [{ playerId: "10", position: "bench" }, { playerId: "missing", position: "active" }];
    source.manualPlayers = [rosterPlayer];
    source.unresolvedNames = ["Unmatched name"];
    source.rules.scoring = { mode: "points", weights: { GOALS: 3, ASSISTS: 2 }, categories: [] };
    const before = JSON.stringify(source);
    const copied = copyManualRsoWorkspace(source)!;
    expect(copied.players).toHaveLength(1);
    expect(copied.unresolved).toEqual(["RSO player details unavailable: missing", "Unmatched name"]);
    expect(copied.slotsReviewed).toBe(false);
    expect(copied.rosterReviewed).toBe(false);
    expect(retainedRecentPoints(copied.players[0], copied.scoring)).toBe(4.8);
    expect(retainedRecentPoints({ ...copied.players[0], eligibility: "G" }, copied.scoring)).toBeNull();
    expect(retainedRecentPoints(copied.players[0], { ...copied.scoring!, unsupported: ["unknown scoring"] })).toBeNull();
    expect(JSON.stringify(source)).toBe(before);
    const ambiguous = copyManualRsoWorkspace({ ...source, manualPlayers: [rosterPlayer, rosterPlayer] })!;
    expect(ambiguous.players).toHaveLength(0);
    expect(ambiguous.unresolved).toContain("Ambiguous RSO player details: 10");
    expect(copyManualRsoWorkspace({ ...source, context: { ...source.context, provider: "yahoo" } })).toBeNull();
  });

  it("merges selected players without changing existing entries, slots or scoring", () => {
    const manual = { ...player("manual:one", "C"), name: "Same Name" };
    const existing = { ...player("rso:10", "RW"), name: "Existing" };
    const current = { ...reviewed([manual, existing], { C: "2" }), scoring: { mode: "points" as const, weights: { GOALS: 2 }, unsupported: [] }, unresolved: ["Existing issue"] };
    const source = { ...emptyWorkspace(), slots: { ...emptyWorkspace().slots, C: "4" }, scoring: { mode: "points" as const, weights: { GOALS: 3 }, unsupported: [] },
      players: [{ ...existing, eligibility: "D" }, { ...player("rso:20", "LW"), name: "Same Name" },
        { ...player("rso:30", "D"), name: "New Player", recent: { playerClass: "skater" as const, games: 5, stats: { GOALS: 4 } } }],
      unresolved: ["Existing issue", "New issue"] };
    expect(rsoMergeCandidates(current, source).map(item => item.status)).toEqual(["already_present", "possible_duplicate", "new"]);
    const merged = mergeManualRsoWorkspace(current, source, ["rso:10", "rso:30"], false);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.workspace.players.slice(0, 2)).toEqual([manual, existing]);
    expect(merged.workspace.players.map(item => item.id)).toEqual(["manual:one", "rso:10", "rso:30"]);
    expect(merged.workspace.players[2].recent).toBeNull();
    expect(merged.recentOmitted).toBe(true);
    expect(merged.workspace.slots).toEqual(current.slots);
    expect(merged.workspace.scoring).toEqual(current.scoring);
    expect(merged.workspace.unresolved).toEqual(["Existing issue", "New issue"]);
    expect(merged.workspace.rosterReviewed).toBe(false);
    expect(current.players).toEqual([manual, existing]);
  });

  it("allows a reviewed possible duplicate and only replaces slots on explicit selection", () => {
    const current = reviewed([{ ...player("manual:one", "C"), name: "Shared" }], { C: "2" });
    const source = { ...emptyWorkspace(), slots: { ...emptyWorkspace().slots, LW: "1" },
      players: [{ ...player("rso:20", "LW"), name: "Shared" }] };
    const merged = mergeManualRsoWorkspace(current, source, ["rso:20"], true);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.workspace.players.map(item => item.id)).toEqual(["manual:one", "rso:20"]);
    expect(merged.workspace.slots).toEqual(source.slots);
    expect(merged.workspace.slotsReviewed).toBe(false);
    expect(mergeManualRsoWorkspace(current, { ...source, slots: emptyWorkspace().slots }, ["rso:20"], true).ok).toBe(false);
  });

  it("preserves retained RSO scoring for a first import and refuses overflow", () => {
    const source = { ...emptyWorkspace(), scoring: { mode: "points" as const, weights: { GOALS: 3 }, unsupported: [] },
      players: [{ ...player("rso:1", "C"), recent: { playerClass: "skater" as const, games: 5, stats: { GOALS: 4 } } }] };
    const first = mergeManualRsoWorkspace(emptyWorkspace(), source, ["rso:1"], false);
    expect(first.ok && retainedRecentPoints(first.workspace.players[0], first.workspace.scoring)).toBe(2.4);
    const full = { ...emptyWorkspace(), players: Array.from({ length: 100 }, (_, i) => player(`manual:${i}`, "C")) };
    expect(mergeManualRsoWorkspace(full, source, ["rso:1"], false)).toEqual({ ok: false, message: "This workspace supports up to 100 players." });
  });
});
