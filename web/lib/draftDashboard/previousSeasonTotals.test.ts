import { describe, expect, it } from "vitest";

import { selectLatestSeasonRows } from "./previousSeasonTotals";

describe("previous season totals", () => {
  it("excludes the active season from previous-season details", () => {
    const latest = selectLatestSeasonRows([{ id: 1, season: 20252026 }, { id: 1, season: 20242025 }], "id", "season", 20252026);
    expect(latest.get("1")?.season).toBe(20242025);
  });
  it("selects one deterministic latest row per player across unordered pages", () => {
    const latest = selectLatestSeasonRows(
      [
        { player_id: 1, season: 20232024, goals: 10 },
        { player_id: 2, season: 20242025, goals: 20 },
        { player_id: 1, season: 20252026, goals: 30 },
        { player_id: 1, season: 20242025, goals: 25 },
      ],
      "player_id",
      "season",
    );
    expect(latest.get("1")).toMatchObject({ season: 20252026, goals: 30 });
    expect(latest.get("2")).toMatchObject({ season: 20242025, goals: 20 });
  });
});
