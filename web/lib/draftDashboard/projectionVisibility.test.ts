import { describe, expect, it } from "vitest";
import {
  diagnoseProjectionVisibility,
  getProjectionDisplayPosition,
  matchesProjectionPosition,
} from "./projectionVisibility";

const players = [
  {
    playerId: 1,
    fullName: "Multi Forward",
    displayTeam: "CAR",
    displayPosition: "C",
    eligiblePositions: ["C", "LW"],
  },
  {
    playerId: 2,
    fullName: "Drafted Defense",
    displayTeam: "NYR",
    displayPosition: "D",
  },
  {
    playerId: 3,
    fullName: "Goalie",
    displayTeam: "BOS",
    displayPosition: "G",
  },
];

describe("projection visibility", () => {
  it("uses complete eligibility tokens for split and grouped forwards", () => {
    expect(getProjectionDisplayPosition(players[0], "split")).toBe("C, LW");
    expect(getProjectionDisplayPosition(players[0], "fwd")).toBe("FWD");
    expect(matchesProjectionPosition(players[0], "LW", "split")).toBe(true);
    expect(matchesProjectionPosition(players[0], "FORWARDS", "fwd")).toBe(true);
    expect(matchesProjectionPosition(players[2], "SKATER", "split")).toBe(
      false,
    );
  });

  it("accounts independently for position, search, drafted, and favorites", () => {
    expect(
      diagnoseProjectionVisibility({
        players,
        positionFilter: "ALL",
        forwardGrouping: "split",
        searchTerm: "",
        hideDrafted: true,
        draftedIds: new Set(["2"]),
        favoritesOnly: true,
        favoriteIds: new Set(["1"]),
      }),
    ).toEqual({
      total: 3,
      shown: 1,
      excluded: 2,
      reasons: { hideDrafted: 1, favoritesOnly: 1 },
    });
  });

  it("normalizes search across player and team names", () => {
    const byTeam = diagnoseProjectionVisibility({
      players,
      positionFilter: "ALL",
      forwardGrouping: "split",
      searchTerm: "car",
      hideDrafted: false,
      draftedIds: new Set(),
      favoritesOnly: false,
      favoriteIds: new Set(),
    });
    expect(byTeam).toMatchObject({ shown: 1, reasons: { searchFilter: 2 } });
  });

  it("keeps null ADP players visible when no explicit filter excludes them", () => {
    const noAdp = { ...players[0], playerId: 4, yahooAvgPick: null };
    expect(
      diagnoseProjectionVisibility({
        players: [noAdp],
        positionFilter: "ALL",
        forwardGrouping: "split",
        searchTerm: "",
        hideDrafted: false,
        draftedIds: new Set(),
        favoritesOnly: false,
        favoriteIds: new Set(),
      }),
    ).toMatchObject({ total: 1, shown: 1, excluded: 0 });
  });

  it("keeps a representative 10,000-player filter interaction under 150ms", () => {
    const largePool = Array.from({ length: 10_000 }, (_, index) => ({
      playerId: index,
      fullName: `Player ${index}`,
      displayTeam: index % 2 === 0 ? "CAR" : "NYR",
      displayPosition: index % 12 === 0 ? "G" : "C",
    }));
    const started = performance.now();
    const result = diagnoseProjectionVisibility({
      players: largePool,
      positionFilter: "SKATER",
      forwardGrouping: "split",
      searchTerm: "player 9",
      hideDrafted: true,
      draftedIds: new Set(["9", "99"]),
      favoritesOnly: false,
      favoriteIds: new Set(),
    });
    const elapsedMs = performance.now() - started;

    console.info(
      `[A-DRAFT visibility benchmark] 10,000 players: ${elapsedMs.toFixed(2)}ms`,
    );
    expect(result.total).toBe(10_000);
    expect(elapsedMs).toBeLessThan(150);
  });
});
