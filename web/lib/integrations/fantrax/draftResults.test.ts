import { describe, expect, it } from "vitest";

import { normalizeFantraxDraftResults } from "./draftResults";

const base = {
  draftState: "inProgress",
  draftType: "snake",
  draftOrder: ["team-a", "team-b"],
  draftPicks: [
    { round: 1, pick: 1, pickInRound: 1, teamId: "team-b", playerId: "player-1", time: 123 },
    { round: 1, pick: 2, pickInRound: 2, teamId: "team-a", playerId: "player-2", time: 124 },
  ],
};

describe("Fantrax numbered draft results", () => {
  it("uses the reported pick number and owner even when they differ from the base order", () => {
    const result = normalizeFantraxDraftResults(base);
    expect(result.safeToApply).toBe(true);
    expect(result.picks.map(({ pickNumber, teamId }) => [pickNumber, teamId])).toEqual([
      [1, "team-b"], [2, "team-a"],
    ]);
  });

  it("replaces corrected picks and changes its deduplication hash", () => {
    const first = normalizeFantraxDraftResults(base);
    const corrected = normalizeFantraxDraftResults({
      ...base,
      draftPicks: [{ ...base.draftPicks[0], playerId: "replacement" }, base.draftPicks[1]],
    });
    expect(corrected.picks[0].playerId).toBe("replacement");
    expect(corrected.hash).not.toBe(first.hash);
    expect(normalizeFantraxDraftResults(base).hash).toBe(first.hash);
  });

  it("treats trailing null players as future slots, not skipped picks", () => {
    const pending = normalizeFantraxDraftResults({
      ...base,
      draftState: "running",
      draftPicks: [...base.draftPicks,
        { round: 2, pick: 3, pickInRound: 1, teamId: "team-a", playerId: null },
        { round: 2, pick: 4, pickInRound: 2, teamId: "team-b", playerId: null },
      ],
    });
    expect(pending.safeToApply).toBe(true);
    expect(pending.picks).toHaveLength(2);
    expect(pending.slots).toHaveLength(4);
    expect(pending.slots[2]).toMatchObject({ pickNumber: 3, playerId: null, teamId: "team-a" });
  });

  it("falls back for an interior empty pick, duplicate number, or unknown owner", () => {
    const interiorEmpty = normalizeFantraxDraftResults({
      ...base,
      draftPicks: [{ ...base.draftPicks[0], playerId: null }, base.draftPicks[1]],
    });
    expect(interiorEmpty.safeToApply).toBe(false);
    expect(interiorEmpty.warning).toMatch(/skipped or missing/);
    expect(normalizeFantraxDraftResults({ ...base, draftPicks: [...base.draftPicks, base.draftPicks[0]] }).safeToApply).toBe(false);
    expect(normalizeFantraxDraftResults({ ...base, draftPicks: [{ ...base.draftPicks[0], teamId: "unknown" }] }).safeToApply).toBe(false);
  });

  it("leaves auction and roster-shaped data manual only", () => {
    expect(normalizeFantraxDraftResults({ ...base, draftType: "auction" }).safeToApply).toBe(false);
    expect(normalizeFantraxDraftResults({ rosters: {} }).safeToApply).toBe(false);
    expect(normalizeFantraxDraftResults({ ...base, draftState: "completed", draftPicks: [] }).safeToApply).toBe(false);
  });
});
