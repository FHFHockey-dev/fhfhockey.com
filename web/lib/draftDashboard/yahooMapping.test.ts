import { describe, expect, it } from "vitest";

import {
  resolveYahooMappings,
  type YahooMappingRow,
  type YahooPlayerDetailRow,
  type YahooProjectionIdentityHint,
} from "./yahooMapping";

function hint(
  positions: string[],
  teams: string[] = [],
): YahooProjectionIdentityHint {
  return { playerType: "skater", positions, teams };
}

describe("resolveYahooMappings", () => {
  it("uses current-game type and position to reject same-name false matches", () => {
    const mappings: YahooMappingRow[] = [
      { nhl_player_id: "8476473", yahoo_player_id: "31437" },
      { nhl_player_id: "8476473", yahoo_player_id: "5381" },
      { nhl_player_id: "8478427", yahoo_player_id: "6777" },
      { nhl_player_id: "8478427", yahoo_player_id: "7654" },
      { nhl_player_id: "8480012", yahoo_player_id: "32762" },
      { nhl_player_id: "8480012", yahoo_player_id: "7520" },
    ];
    const details = new Map<string, YahooPlayerDetailRow>([
      ["31437", { player_id: "31437", display_position: "G" }],
      ["5381", { player_id: "5381", display_position: "D" }],
      ["6777", { player_id: "6777", display_position: "C" }],
      ["7654", { player_id: "7654", display_position: "D" }],
      ["32762", { player_id: "32762", display_position: "D" }],
      ["7520", { player_id: "7520", display_position: "C,LW" }],
    ]);
    const hints = new Map<number, YahooProjectionIdentityHint>([
      [8476473, hint(["D"])],
      [8478427, hint(["C"])],
      [8480012, hint(["C", "LW"], ["VAN"])],
    ]);

    const result = resolveYahooMappings(mappings, details, hints);

    expect(result.mappingsByNhlId.get(8476473)?.yahoo_player_id).toBe("5381");
    expect(result.mappingsByNhlId.get(8478427)?.yahoo_player_id).toBe("6777");
    expect(result.mappingsByNhlId.get(8480012)?.yahoo_player_id).toBe("7520");
    expect(result.diagnostics).toMatchObject({
      unmappedNhlIds: 0,
      duplicateNhlIds: 3,
      conflictingYahooIdNhlIds: 3,
      selectedNhlIds: 3,
      unresolvedNhlIds: 0,
    });
  });

  it("collapses identical rows and resolves a current team when positions tie", () => {
    const mappings: YahooMappingRow[] = [
      { nhl_player_id: "1", yahoo_player_id: "10" },
      { nhl_player_id: "1", yahoo_player_id: "10" },
      { nhl_player_id: "1", yahoo_player_id: "11" },
    ];
    const details = new Map<string, YahooPlayerDetailRow>([
      [
        "10",
        {
          player_id: "10",
          display_position: "D",
          editorial_team_abbreviation: "CGY",
        },
      ],
      [
        "11",
        {
          player_id: "11",
          display_position: "D",
          editorial_team_abbreviation: "EDM",
        },
      ],
    ]);

    const result = resolveYahooMappings(
      mappings,
      details,
      new Map([[1, hint(["D"], ["EDM"])]]),
    );

    expect(result.mappingsByNhlId.get(1)?.yahoo_player_id).toBe("11");
    expect(result.diagnostics.duplicateNhlIds).toBe(1);
    expect(result.diagnostics.conflictingYahooIdNhlIds).toBe(1);
  });

  it("fails closed for unresolved ties and missing current-game details", () => {
    const mappings: YahooMappingRow[] = [
      { nhl_player_id: "1", yahoo_player_id: "10" },
      { nhl_player_id: "1", yahoo_player_id: "11" },
      { nhl_player_id: "2", yahoo_player_id: "20" },
    ];
    const details = new Map<string, YahooPlayerDetailRow>([
      ["10", { player_id: "10", display_position: "C" }],
      ["11", { player_id: "11", display_position: "C" }],
    ]);

    const result = resolveYahooMappings(
      mappings,
      details,
      new Map([
        [1, hint(["C"])],
        [2, hint(["D"])],
      ]),
    );

    expect(result.mappingsByNhlId.size).toBe(0);
    expect(result.diagnostics).toMatchObject({
      currentGameMissingNhlIds: 1,
      unresolvedNhlIds: 2,
      currentGameMissingNhlIdSamples: [2],
      unresolvedNhlIdSamples: [1, 2]
    });
  });

  it("keeps goalie and skater candidates separated", () => {
    const mappings: YahooMappingRow[] = [
      { nhl_player_id: "1", yahoo_player_id: "10" },
      { nhl_player_id: "1", yahoo_player_id: "11" },
    ];
    const details = new Map<string, YahooPlayerDetailRow>([
      ["10", { player_id: "10", eligible_positions: ["G"] }],
      ["11", { player_id: "11", eligible_positions: ["D"] }],
    ]);
    const goalieHint: YahooProjectionIdentityHint = {
      playerType: "goalie",
      positions: ["G"],
      teams: [],
    };

    const result = resolveYahooMappings(
      mappings,
      details,
      new Map([[1, goalieHint]]),
    );

    expect(result.mappingsByNhlId.get(1)?.yahoo_player_id).toBe("10");
  });

  it("matches a composite mapping key to the current-game numeric player ID", () => {
    const result = resolveYahooMappings(
      [{ nhl_player_id: "1", yahoo_player_id: "465.p.10" }],
      new Map([["10", { player_id: "10", display_position: "C" }]]),
      new Map([[1, hint(["C"])]]),
    );

    expect(result.mappingsByNhlId.get(1)?.yahoo_player_id).toBe("465.p.10");
  });

  it("counts projected NHL IDs that have no mapping row as unresolved", () => {
    const result = resolveYahooMappings(
      [],
      new Map(),
      new Map([[1, hint(["C"])]]),
    );

    expect(result.diagnostics).toMatchObject({
      projectedNhlIds: 1,
      mappedNhlIds: 0,
      unmappedNhlIds: 1,
      unresolvedNhlIds: 1,
    });
  });
});
