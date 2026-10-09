import { describe, expect, it } from "vitest";
import {
  diagnoseProjectionVisibility,
  getProjectionDisplayPosition,
  matchesProjectionPosition,
} from "./projectionVisibility";
import { applyFantraxPlayerSources } from "./fantraxPlayerSources";
import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";

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

  it("filters exact dual and tri eligible forward combinations", () => {
    const dual = players[0];
    const tri = { ...dual, eligiblePositions: ["C", "LW", "RW"] };
    expect(matchesProjectionPosition(dual, "ELIGIBLE_DUAL", "fwd")).toBe(true);
    expect(matchesProjectionPosition(dual, "ELIGIBLE_C_LW", "fwd")).toBe(true);
    expect(matchesProjectionPosition(dual, "ELIGIBLE_C_RW", "fwd")).toBe(false);
    expect(matchesProjectionPosition(tri, "ELIGIBLE_DUAL", "split")).toBe(false);
    expect(matchesProjectionPosition(tri, "ELIGIBLE_TRI", "fwd")).toBe(true);
    expect(matchesProjectionPosition(players[1], "ELIGIBLE_TRI", "split")).toBe(false);
  });

  it("switches ADP and position sources independently", () => {
    const player = players[0] as ProcessedPlayer;
    const fantrax = [{ id: "fx-1", name: "Forward, Multi", team: "CAR", positions: ["RW"], adp: 42 }];
    const adpOnly = applyFantraxPlayerSources([player], fantrax, "fantrax", "yahoo")[0];
    expect(adpOnly.yahooAvgPick).toBe(42);
    expect(adpOnly.eligiblePositions).toEqual(["C", "LW"]);
    const positionOnly = applyFantraxPlayerSources([player], fantrax, "yahoo", "fantrax")[0];
    expect(positionOnly.yahooAvgPick).toBeUndefined();
    expect(positionOnly.eligiblePositions).toEqual(["RW"]);
    expect(matchesProjectionPosition(positionOnly, "ELIGIBLE_DUAL", "split")).toBe(false);
    const leagueEligible = applyFantraxPlayerSources([player], [{ ...fantrax[0], positions: ["C", "LW", "RW"] }], "yahoo", "fantrax")[0];
    expect(matchesProjectionPosition(leagueEligible, "ELIGIBLE_TRI", "split")).toBe(true);
  });

  it("uses verified Fantrax identities for variant and duplicate names in the projections table", () => {
    const aho = { ...players[0], playerId: 8478427, fullName: "Sebastian Aho", displayTeam: "CAR" } as ProcessedPlayer;
    const vladar = { ...players[0], playerId: 8478435, fullName: "Dan Vladar", displayTeam: "PHI" } as ProcessedPlayer;
    const fantrax = [
      { id: "03rmx", name: "Aho, Sebastian", team: "CAR", positions: ["C"], adp: 12 },
      { id: "03el6", name: "Aho, Sebastian", team: "PIT", positions: ["D"], adp: 250 },
      { id: "03rfo", name: "Vladar, Daniel", team: "PHI", positions: ["G"], adp: 180 },
    ];
    const result = applyFantraxPlayerSources([aho, vladar], fantrax, "fantrax", "fantrax");
    expect(result.map((row) => row.yahooAvgPick)).toEqual([12, 180]);
    expect(result.map((row) => row.eligiblePositions)).toEqual([["C"], ["G"]]);
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
