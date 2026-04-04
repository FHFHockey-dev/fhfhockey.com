import { describe, expect, it } from "vitest";
import { formatPlayerStatsValue } from "lib/underlying-stats/playerStatsFormatting";
import type { PlayerStatsTableFamily } from "lib/underlying-stats/playerStatsTypes";

import {
  getAllPlayerStatsTableFamilies,
  getPlayerStatsColumnByKey,
  getPlayerStatsColumns,
  getPlayerStatsDefaultSortForFamily,
  getPlayerStatsIdentityColumns,
  PLAYER_STATS_GOALIE_IDENTITY_COLUMN_KEYS,
  PLAYER_STATS_IDENTITY_COLUMNS,
  PLAYER_STATS_SHARED_IDENTITY_COLUMN_KEYS,
  PLAYER_STATS_SKATER_IDENTITY_COLUMN_KEYS,
  resolvePlayerStatsTableFamily,
} from "./playerStatsColumns";

const EXPECTED_FAMILY_COLUMN_KEYS: Record<PlayerStatsTableFamily, string[]> = {
  individualCounts: [
    "playerName",
    "teamLabel",
    "positionCode",
    "gamesPlayed",
    "toiSeconds",
    "goals",
    "totalAssists",
    "firstAssists",
    "secondAssists",
    "totalPoints",
    "ipp",
    "shots",
    "shootingPct",
    "ixg",
    "iCf",
    "iFf",
    "iScf",
    "iHdcf",
    "rushAttempts",
    "reboundsCreated",
    "pim",
    "totalPenalties",
    "minorPenalties",
    "majorPenalties",
    "misconductPenalties",
    "penaltiesDrawn",
    "giveaways",
    "takeaways",
    "hits",
    "hitsTaken",
    "shotsBlocked",
    "faceoffsWon",
    "faceoffsLost",
    "faceoffPct",
  ],
  individualRates: [
    "playerName",
    "teamLabel",
    "positionCode",
    "gamesPlayed",
    "toiSeconds",
    "toiPerGameSeconds",
    "goalsPer60",
    "totalAssistsPer60",
    "firstAssistsPer60",
    "secondAssistsPer60",
    "totalPointsPer60",
    "ipp",
    "shotsPer60",
    "shootingPct",
    "ixgPer60",
    "iCfPer60",
    "iFfPer60",
    "iScfPer60",
    "iHdcfPer60",
    "rushAttemptsPer60",
    "reboundsCreatedPer60",
    "pimPer60",
    "totalPenaltiesPer60",
    "minorPenaltiesPer60",
    "majorPenaltiesPer60",
    "misconductPenaltiesPer60",
    "penaltiesDrawnPer60",
    "giveawaysPer60",
    "takeawaysPer60",
    "hitsPer60",
    "hitsTakenPer60",
    "shotsBlockedPer60",
    "faceoffsWonPer60",
    "faceoffsLostPer60",
    "faceoffPct",
  ],
  onIceCounts: [
    "playerName",
    "teamLabel",
    "positionCode",
    "gamesPlayed",
    "toiSeconds",
    "cf",
    "ca",
    "cfPct",
    "ff",
    "fa",
    "ffPct",
    "sf",
    "sa",
    "sfPct",
    "gf",
    "ga",
    "gfPct",
    "xgf",
    "xga",
    "xgfPct",
    "scf",
    "sca",
    "scfPct",
    "hdcf",
    "hdca",
    "hdcfPct",
    "hdgf",
    "hdga",
    "hdgfPct",
    "mdcf",
    "mdca",
    "mdcfPct",
    "mdgf",
    "mdga",
    "mdgfPct",
    "ldcf",
  ],
  onIceRates: [
    "playerName",
    "teamLabel",
    "positionCode",
    "gamesPlayed",
    "toiSeconds",
    "toiPerGameSeconds",
    "cfPer60",
    "caPer60",
    "cfPct",
    "ffPer60",
    "faPer60",
    "ffPct",
    "sfPer60",
    "saPer60",
    "sfPct",
    "gfPer60",
    "gaPer60",
    "gfPct",
    "xgfPer60",
    "xgaPer60",
    "xgfPct",
    "scfPer60",
    "scaPer60",
    "scfPct",
    "hdcfPer60",
    "hdcaPer60",
    "hdcfPct",
    "hdgfPer60",
    "hdgaPer60",
    "hdgfPct",
    "mdcfPer60",
    "mdcaPer60",
    "mdcfPct",
    "mdgfPer60",
    "mdgaPer60",
    "mdgfPct",
  ],
  goalieCounts: [
    "playerName",
    "teamLabel",
    "gamesPlayed",
    "toiSeconds",
    "shotsAgainst",
    "saves",
    "goalsAgainst",
    "savePct",
    "gaa",
    "gsaa",
    "xgAgainst",
    "hdShotsAgainst",
    "hdSaves",
    "hdGoalsAgainst",
    "hdSavePct",
    "hdGaa",
    "hdGsaa",
    "mdShotsAgainst",
    "mdSaves",
    "mdGoalsAgainst",
    "mdSavePct",
    "mdGaa",
    "mdGsaa",
    "ldShotsAgainst",
    "ldSaves",
    "ldGoalsAgainst",
    "ldSavePct",
    "ldGaa",
    "ldGsaa",
    "rushAttemptsAgainst",
    "reboundAttemptsAgainst",
    "avgShotDistance",
    "avgGoalDistance",
  ],
  goalieRates: [
    "playerName",
    "teamLabel",
    "gamesPlayed",
    "toiSeconds",
    "toiPerGameSeconds",
    "shotsAgainstPer60",
    "savesPer60",
    "savePct",
    "gaa",
    "gsaaPer60",
    "xgAgainstPer60",
    "hdShotsAgainstPer60",
    "hdSavesPer60",
    "hdSavePct",
    "hdGaa",
    "hdGsaaPer60",
    "mdShotsAgainstPer60",
    "mdSavesPer60",
    "mdSavePct",
    "mdGaa",
    "mdGsaaPer60",
    "ldShotsAgainstPer60",
    "ldSavesPer60",
    "ldSavePct",
    "ldGaa",
    "ldGsaaPer60",
    "rushAttemptsAgainstPer60",
    "reboundAttemptsAgainstPer60",
    "avgShotDistance",
    "avgGoalDistance",
  ],
};

const EXPECTED_FAMILY_COLUMN_LABELS: Record<PlayerStatsTableFamily, string[]> = {
  individualCounts: [
    "Player",
    "Team",
    "Position",
    "GP",
    "TOI",
    "Goals",
    "Total Assists",
    "First Assists",
    "Second Assists",
    "Total Points",
    "IPP",
    "Shots",
    "SH%",
    "ixG",
    "iCF",
    "iFF",
    "iSCF",
    "iHDCF",
    "Rush Attempts",
    "Rebounds Created",
    "PIM",
    "Total Penalties",
    "Minor",
    "Major",
    "Misconduct",
    "Penalties Drawn",
    "Giveaways",
    "Takeaways",
    "Hits",
    "Hits Taken",
    "Shots Blocked",
    "Faceoffs Won",
    "Faceoffs Lost",
    "Faceoffs %",
  ],
  individualRates: [
    "Player",
    "Team",
    "Position",
    "GP",
    "TOI",
    "TOI/GP",
    "Goals/60",
    "Total Assists/60",
    "First Assists/60",
    "Second Assists/60",
    "Total Points/60",
    "IPP",
    "Shots/60",
    "SH%",
    "ixG/60",
    "iCF/60",
    "iFF/60",
    "iSCF/60",
    "iHDCF/60",
    "Rush Attempts/60",
    "Rebounds Created/60",
    "PIM/60",
    "Total Penalties/60",
    "Minor/60",
    "Major/60",
    "Misconduct/60",
    "Penalties Drawn/60",
    "Giveaways/60",
    "Takeaways/60",
    "Hits/60",
    "Hits Taken/60",
    "Shots Blocked/60",
    "Faceoffs Won/60",
    "Faceoffs Lost/60",
    "Faceoffs %",
  ],
  onIceCounts: [
    "Player",
    "Team",
    "Position",
    "GP",
    "TOI",
    "CF",
    "CA",
    "CF%",
    "FF",
    "FA",
    "FF%",
    "SF",
    "SA",
    "SF%",
    "GF",
    "GA",
    "GF%",
    "xGF",
    "xGA",
    "xGF%",
    "SCF",
    "SCA",
    "SCF%",
    "HDCF",
    "HDCA",
    "HDCF%",
    "HDGF",
    "HDGA",
    "HDGF%",
    "MDCF",
    "MDCA",
    "MDCF%",
    "MDGF",
    "MDGA",
    "MDGF%",
    "LDCF",
  ],
  onIceRates: [
    "Player",
    "Team",
    "Position",
    "GP",
    "TOI",
    "TOI/GP",
    "CF/60",
    "CA/60",
    "CF%",
    "FF/60",
    "FA/60",
    "FF%",
    "SF/60",
    "SA/60",
    "SF%",
    "GF/60",
    "GA/60",
    "GF%",
    "xGF/60",
    "xGA/60",
    "xGF%",
    "SCF/60",
    "SCA/60",
    "SCF%",
    "HDCF/60",
    "HDCA/60",
    "HDCF%",
    "HDGF/60",
    "HDGA/60",
    "HDGF%",
    "MDCF/60",
    "MDCA/60",
    "MDCF%",
    "MDGF/60",
    "MDGA/60",
    "MDGF%",
  ],
  goalieCounts: [
    "Player",
    "Team",
    "GP",
    "TOI",
    "Shots Against",
    "Saves",
    "Goals Against",
    "SV%",
    "GAA",
    "GSAA",
    "xGA",
    "HD Shots Against",
    "HD Saves",
    "HD Goals Against",
    "HD SV%",
    "HD GAA",
    "HD GSAA",
    "MD Shots Against",
    "MD Saves",
    "MD Goals Against",
    "MD SV%",
    "MD GAA",
    "MD GSAA",
    "LD Shots Against",
    "LD Saves",
    "LD Goals Against",
    "LD SV%",
    "LD GAA",
    "LD GSAA",
    "Rush Attempts Against",
    "Rebound Attempts Against",
    "Avg Shot Distance",
    "Avg Goal Distance",
  ],
  goalieRates: [
    "Player",
    "Team",
    "GP",
    "TOI",
    "TOI/GP",
    "Shots Against/60",
    "Saves/60",
    "SV%",
    "GAA",
    "GSAA/60",
    "xGA/60",
    "HD Shots Against/60",
    "HD Saves/60",
    "HD SV%",
    "HD GAA",
    "HD GSAA/60",
    "MD Shots Against/60",
    "MD Saves/60",
    "MD SV%",
    "MD GAA",
    "MD GSAA/60",
    "LD Shots Against/60",
    "LD Saves/60",
    "LD SV%",
    "LD GAA",
    "LD GSAA/60",
    "Rush Attempts Against/60",
    "Rebound Attempts Against/60",
    "Avg Shot Distance",
    "Avg Goal Distance",
  ],
};

const FAMILY_FORMAT_EXPECTATIONS: Array<{
  family: PlayerStatsTableFamily;
  columnKey: string;
  rawValue: string | number | null;
  expected: string;
}> = [
  {
    family: "individualCounts",
    columnKey: "ipp",
    rawValue: 0.612,
    expected: "61.2%",
  },
  {
    family: "individualRates",
    columnKey: "goalsPer60",
    rawValue: 1.789,
    expected: "1.79",
  },
  {
    family: "onIceCounts",
    columnKey: "xgf",
    rawValue: 19.444,
    expected: "19.44",
  },
  {
    family: "onIceRates",
    columnKey: "toiPerGameSeconds",
    rawValue: 255,
    expected: "4:15",
  },
  {
    family: "goalieCounts",
    columnKey: "avgShotDistance",
    rawValue: 34.44,
    expected: "34.4",
  },
  {
    family: "goalieRates",
    columnKey: "savePct",
    rawValue: 0.914,
    expected: "91.4%",
  },
];

describe("resolvePlayerStatsTableFamily", () => {
  it("maps mode and display pairs to the six canonical families", () => {
    expect(resolvePlayerStatsTableFamily("individual", "counts")).toBe(
      "individualCounts"
    );
    expect(resolvePlayerStatsTableFamily("individual", "rates")).toBe(
      "individualRates"
    );
    expect(resolvePlayerStatsTableFamily("onIce", "counts")).toBe("onIceCounts");
    expect(resolvePlayerStatsTableFamily("onIce", "rates")).toBe("onIceRates");
    expect(resolvePlayerStatsTableFamily("goalies", "counts")).toBe(
      "goalieCounts"
    );
    expect(resolvePlayerStatsTableFamily("goalies", "rates")).toBe("goalieRates");
  });
});

describe("getAllPlayerStatsTableFamilies", () => {
  it("returns all six canonical families", () => {
    expect(getAllPlayerStatsTableFamilies()).toEqual([
      "individualCounts",
      "individualRates",
      "onIceCounts",
      "onIceRates",
      "goalieCounts",
      "goalieRates",
    ]);
  });
});

describe("getPlayerStatsColumns", () => {
  it("defines the exact ordered column keys for all six stat families", () => {
    for (const family of getAllPlayerStatsTableFamilies()) {
      expect(getPlayerStatsColumns(family).map((column) => column.key)).toEqual(
        EXPECTED_FAMILY_COLUMN_KEYS[family]
      );
    }
  });

  it("defines the exact ordered requested labels for all six stat families", () => {
    for (const family of getAllPlayerStatsTableFamilies()) {
      expect(getPlayerStatsColumns(family).map((column) => column.label)).toEqual(
        EXPECTED_FAMILY_COLUMN_LABELS[family]
      );
    }
  });

  it("includes the explicitly derived goalie danger-split and distance fields from the source inventory", () => {
    expect(getPlayerStatsColumns("goalieCounts").map((column) => column.key)).toEqual(
      expect.arrayContaining([
        "hdGoalsAgainst",
        "ldSaves",
        "ldGoalsAgainst",
        "avgShotDistance",
        "avgGoalDistance",
      ])
    );
    expect(getPlayerStatsColumns("goalieRates").map((column) => column.key)).toEqual(
      expect.arrayContaining([
        "ldSavesPer60",
        "ldGsaaPer60",
        "avgShotDistance",
        "avgGoalDistance",
      ])
    );
  });

  it("leaves out extra parity-map fields that were documented as outside the requested day-one surface", () => {
    const onIceCountKeys = getPlayerStatsColumns("onIceCounts").map((column) => column.key);
    const onIceRateKeys = getPlayerStatsColumns("onIceRates").map((column) => column.key);

    expect(onIceCountKeys).not.toEqual(expect.arrayContaining(["ldca", "ldcfPct", "ldgfPct"]));
    expect(onIceRateKeys).not.toEqual(expect.arrayContaining(["ldcaPer60", "ldcfPct", "ldgfPct"]));
  });

  it("uses formatting/alignment tokens that match table expectations", () => {
    expect(getPlayerStatsColumnByKey("individualRates", "toiPerGameSeconds")).toEqual({
      key: "toiPerGameSeconds",
      label: "TOI/GP",
      sortKey: "toiPerGameSeconds",
      format: "toiPerGame",
      align: "right",
    });

    expect(getPlayerStatsColumnByKey("onIceCounts", "xgfPct")).toEqual({
      key: "xgfPct",
      label: "xGF%",
      sortKey: "xgfPct",
      format: "percentage",
      align: "right",
    });

    expect(getPlayerStatsColumnByKey("goalieRates", "avgShotDistance")).toEqual({
      key: "avgShotDistance",
      label: "Avg Shot Distance",
      sortKey: "avgShotDistance",
      format: "distance",
      align: "right",
    });
  });

  it("assigns formatter tokens that produce the expected display output across all families", () => {
    for (const expectation of FAMILY_FORMAT_EXPECTATIONS) {
      const column = getPlayerStatsColumnByKey(
        expectation.family,
        expectation.columnKey
      );

      expect(column).toBeTruthy();
      expect(
        formatPlayerStatsValue(
          expectation.rawValue,
          column!.format
        )
      ).toBe(expectation.expected);
    }
  });
});

describe("getPlayerStatsIdentityColumns", () => {
  it("returns the reusable skater identity slice for skater families", () => {
    expect(PLAYER_STATS_SHARED_IDENTITY_COLUMN_KEYS).toEqual([
      "player",
      "team",
      "gp",
      "toi",
    ]);
    expect(PLAYER_STATS_SKATER_IDENTITY_COLUMN_KEYS).toEqual([
      "player",
      "team",
      "position",
      "gp",
      "toi",
    ]);
    expect(getPlayerStatsIdentityColumns("onIceRates")).toEqual([
      PLAYER_STATS_IDENTITY_COLUMNS.player,
      PLAYER_STATS_IDENTITY_COLUMNS.team,
      PLAYER_STATS_IDENTITY_COLUMNS.position,
      PLAYER_STATS_IDENTITY_COLUMNS.gp,
      PLAYER_STATS_IDENTITY_COLUMNS.toi,
    ]);
  });

  it("returns the reusable goalie identity slice without position", () => {
    expect(PLAYER_STATS_GOALIE_IDENTITY_COLUMN_KEYS).toEqual([
      "player",
      "team",
      "gp",
      "toi",
    ]);
    expect(getPlayerStatsIdentityColumns("goalieCounts")).toEqual([
      PLAYER_STATS_IDENTITY_COLUMNS.player,
      PLAYER_STATS_IDENTITY_COLUMNS.team,
      PLAYER_STATS_IDENTITY_COLUMNS.gp,
      PLAYER_STATS_IDENTITY_COLUMNS.toi,
    ]);
  });

  it("exposes stable identity column definitions for direct table reuse", () => {
    expect(PLAYER_STATS_IDENTITY_COLUMNS).toMatchObject({
      player: {
        key: "playerName",
        label: "Player",
        sortKey: "playerName",
        format: "text",
        align: "left",
        isIdentity: true,
      },
      team: {
        key: "teamLabel",
        label: "Team",
        sortKey: "teamLabel",
        format: "team",
        align: "left",
        isIdentity: true,
      },
      position: {
        key: "positionCode",
        label: "Position",
        sortKey: "positionCode",
        format: "position",
        align: "center",
        isIdentity: true,
      },
      gp: {
        key: "gamesPlayed",
        label: "GP",
        sortKey: "gamesPlayed",
        format: "integer",
        align: "right",
        isIdentity: true,
      },
      toi: {
        key: "toiSeconds",
        label: "TOI",
        sortKey: "toiSeconds",
        format: "toi",
        align: "right",
        isIdentity: true,
      },
    });
  });
});

describe("getPlayerStatsDefaultSortForFamily", () => {
  it("matches the canonical default sort for each family", () => {
    expect(getPlayerStatsDefaultSortForFamily("individualCounts")).toEqual({
      sortKey: "totalPoints",
      direction: "desc",
    });
    expect(getPlayerStatsDefaultSortForFamily("individualRates")).toEqual({
      sortKey: "totalPointsPer60",
      direction: "desc",
    });
    expect(getPlayerStatsDefaultSortForFamily("onIceCounts")).toEqual({
      sortKey: "xgfPct",
      direction: "desc",
    });
    expect(getPlayerStatsDefaultSortForFamily("onIceRates")).toEqual({
      sortKey: "xgfPct",
      direction: "desc",
    });
    expect(getPlayerStatsDefaultSortForFamily("goalieCounts")).toEqual({
      sortKey: "savePct",
      direction: "desc",
    });
    expect(getPlayerStatsDefaultSortForFamily("goalieRates")).toEqual({
      sortKey: "savePct",
      direction: "desc",
    });
  });

  it("points every family default sort at a visible column", () => {
    for (const family of getAllPlayerStatsTableFamilies()) {
      const defaultSort = getPlayerStatsDefaultSortForFamily(family);
      const visibleSortKeys = new Set(
        getPlayerStatsColumns(family).map((column) => column.sortKey)
      );

      expect(visibleSortKeys.has(defaultSort.sortKey)).toBe(true);
    }
  });
});
