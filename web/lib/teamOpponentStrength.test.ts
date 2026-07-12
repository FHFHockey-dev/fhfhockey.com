import { describe, expect, it } from "vitest";
import { buildDatedOpponentStrengthIndex, type TeamPowerRatingRow } from "./teamOpponentStrength";

const row = (team: string, score: number, date = "2026-01-10"): TeamPowerRatingRow => ({
  date,
  team_abbreviation: team,
  off_rating: score,
  def_rating: score,
  pace_rating: score,
  pp_tier: 2,
  pk_tier: 2,
  trend10: 0
});

describe("buildDatedOpponentStrengthIndex", () => {
  it("classifies each dated league snapshot into deterministic thirds", () => {
    const rows = Array.from({ length: 30 }, (_, index) =>
      row(`T${String(index).padStart(2, "0")}`, 100 - index)
    );
    const index = buildDatedOpponentStrengthIndex(rows);
    expect(index.get("2026-01-10:T00")).toBe("strong");
    expect(index.get("2026-01-10:T15")).toBe("average");
    expect(index.get("2026-01-10:T29")).toBe("weak");
  });

  it("does not invent strength when a snapshot is too sparse", () => {
    expect(buildDatedOpponentStrengthIndex([row("AAA", 90)]).size).toBe(0);
  });
});
