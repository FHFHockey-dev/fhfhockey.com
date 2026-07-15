import { describe, expect, it } from "vitest";
import type { ProjectionSourceConfig } from "lib/projectionsConfig/projectionSourcesConfig";
import {
  normalizeProjectionTeam,
  selectProjectionRowForPlayer
} from "./projectionRowSelection";

const source: ProjectionSourceConfig = {
  id: "test",
  displayName: "Test",
  tableName: "test",
  playerType: "skater",
  primaryPlayerIdKey: "player_id",
  originalPlayerNameKey: "Player_Name",
  teamKey: "Team",
  statMappings: [{ key: "GAMES_PLAYED", dbColumnName: "GP" }]
};

describe("duplicate projection row selection", () => {
  it("prefers the player's current team before projection volume", () => {
    const selected = selectProjectionRowForPlayer({
      rows: [
        { player_id: 1, Team: "OLD", GP: 82, Goals: 40 },
        { player_id: 1, Team: "NEW", GP: 10, Goals: 8 }
      ],
      source,
      playerId: 1,
      currentTeam: "new"
    });
    expect(selected?.Team).toBe("NEW");
  });

  it("reconciles abbreviations, full names, and short team names", () => {
    expect(normalizeProjectionTeam("COL")).toBe("COL");
    expect(normalizeProjectionTeam("Colorado Avalanche")).toBe("COL");
    expect(normalizeProjectionTeam("Avalanche")).toBe("COL");
    const selected = selectProjectionRowForPlayer({
      rows: [
        { player_id: 1, Team: "Jets", GP: 82 },
        { player_id: 1, Team: "Avalanche", GP: 10 }
      ],
      source,
      playerId: 1,
      currentTeam: "COL"
    });
    expect(selected?.Team).toBe("Avalanche");
  });

  it("uses games played and a stable tie-breaker when team evidence is absent", () => {
    const rows = [
      { player_id: 1, Team: "B", GP: 20, Goals: 10 },
      { player_id: 1, Team: "A", GP: 40, Goals: 12 }
    ];
    expect(
      selectProjectionRowForPlayer({ rows, source, playerId: 1 })?.Team
    ).toBe("A");
    expect(
      selectProjectionRowForPlayer({ rows: [...rows].reverse(), source, playerId: 1 })
    ).toEqual(selectProjectionRowForPlayer({ rows, source, playerId: 1 }));
  });

  it("returns null for an absent player", () => {
    expect(
      selectProjectionRowForPlayer({ rows: [], source, playerId: 1 })
    ).toBeNull();
  });
});
