import { describe, expect, it } from "vitest";
import {
  adaptManualDraftRecovery,
  createManualDraftRecoveryRecord,
  parseManualDraftRecovery,
  readManualDraftAnalysisPreferences,
} from "./manualDraftRecovery";

const settings = {
  teamCount: 2,
  draftOrder: ["Team 1", "Team 2"],
  rosterConfig: { C: 1, G: 1, bench: 1, utility: 0 },
  scoringCategories: { GOALS: 3 },
};

describe("manual draft recovery contract", () => {
  it("migrates legacy durable records without losing picks or undo overrides", () => {
    const result = adaptManualDraftRecovery({
      version: 1,
      draftSettings: settings,
      draftedPlayers: [{ playerId: "1", teamId: "Team 1", pickNumber: 1, round: 1, pickInRound: 1 }],
      currentPick: 2,
      draftHistory: [{
        players: [],
        pickNumber: 1,
        positionOverrides: {},
      }],
      positionOverrides: { "1": "C" },
      goaliePointValues: { WINS_GOALIE: 4 },
      pickOwnerOverrides: { "1-2": "Team 1" },
      customCsvList: [{ id: "custom_csv_legacy", label: "Legacy", rows: [] }],
    });

    expect(result.error).toBeUndefined();
    expect(result.record).toMatchObject({
      v: 4,
      draftedPlayers: [{ playerId: "1" }],
      positionOverrides: { "1": "C" },
      goalieScoringCategories: { WINS_GOALIE: 4 },
      pickTrades: [{ round: 1, pickInRound: 2, currentTeamId: "Team 1" }],
      csvMetadata: [{ id: "custom_csv_legacy", label: "Legacy" }],
    });
    expect(result.record?.draftHistory[0]).toMatchObject({
      pickNumber: 1,
      positionOverrides: {},
    });
  });

  it("keeps CSV rows optional and rejects malformed undo state before application", () => {
    const base = {
      v: 4,
      settings,
      draftedPlayers: [],
      currentPick: 1,
      customCsvEntries: [{ id: "custom_csv_one", label: "Imported", rows: [] }],
    };
    expect(adaptManualDraftRecovery(base).record?.customCsvEntries).toHaveLength(1);
    expect(
      adaptManualDraftRecovery({
        ...base,
        draftHistory: [{ players: [], pickNumber: "one" }],
      }).error,
    ).toContain("undo history");
    expect(parseManualDraftRecovery("{").error).toContain("corrupt");
    expect(adaptManualDraftRecovery({ ...base, draftedPlayers: [null] }).error).toContain("invalid or duplicate picks");
  });

  it("rejects conflicting keepers and invalid traded-pick owners", () => {
    const base = {
      v: 4,
      settings,
      draftedPlayers: [],
      currentPick: 1,
    };
    expect(adaptManualDraftRecovery({
      ...base,
      keepers: [
        { playerId: "keeper", teamId: "Team 1", cost: "none" },
        { playerId: "keeper", teamId: "Team 1", cost: "none" },
      ],
    }).error).toContain("invalid keepers");
    expect(adaptManualDraftRecovery({
      ...base,
      pickTrades: [{ round: 1, pickInRound: 1, currentTeamId: "missing" }],
    }).error).toContain("invalid traded picks");
  });

  it("round-trips canonical analysis preferences with their established bounds", () => {
    const preferences = readManualDraftAnalysisPreferences({
      getItem: (key) => ({
        "projections.prorate84": "true",
        "projections.riskSd": "99",
      })[key] ?? null,
    });
    const record = createManualDraftRecoveryRecord({
      configured: true,
      settings,
      draftedPlayers: [],
      draftHistory: [],
      currentPick: 1,
      isSnakeDraft: true,
      myTeamId: "Team 1",
      customTeamNames: {},
      forwardGrouping: "split",
      baselineMode: "remaining",
      personalizeReplacement: false,
      needWeightEnabled: false,
      needAlpha: 0.5,
      goalieScoringCategories: { WINS_GOALIE: 4 },
      sourceControls: {},
      goalieSourceControls: {},
      keepers: [],
      pickTrades: [],
      positionOverrides: {},
      preserveExactCategoryWeights: false,
      csvMetadata: [],
      ...preferences,
    });

    expect(record).toMatchObject({
      v: 4,
      settings,
      goalieScoringCategories: { WINS_GOALIE: 4 },
      prorate84: true,
      riskSd: 40,
    });
    expect(record).not.toHaveProperty("draftSettings");
    expect(record).not.toHaveProperty("goaliePointValues");
    expect(adaptManualDraftRecovery(record).record).toMatchObject({
      prorate84: true,
      riskSd: 40,
    });
  });

  it("allows validated no-pick keeper overrides in current and undo state but rejects orphans", () => {
    const keeperRecord = {
      v: 4,
      settings,
      draftedPlayers: [],
      currentPick: 1,
      keepers: [{ playerId: "keeper", teamId: "Team 1", cost: "none" }],
      positionOverrides: { keeper: "C" },
      draftHistory: [{
        players: [],
        pickNumber: 1,
        positionOverrides: { keeper: "C" },
      }],
    };

    expect(adaptManualDraftRecovery(keeperRecord)).toMatchObject({
      record: {
        keepers: [{ playerId: "keeper", cost: "none" }],
        positionOverrides: { keeper: "C" },
        draftHistory: [{ positionOverrides: { keeper: "C" } }],
      },
    });
    expect(adaptManualDraftRecovery({
      ...keeperRecord,
      positionOverrides: { orphan: "C" },
    }).error).toContain("missing player");
    expect(adaptManualDraftRecovery({
      ...keeperRecord,
      draftHistory: [{ players: [], pickNumber: 1, positionOverrides: { orphan: "C" } }],
    }).error).toContain("Draft undo history");
  });
});
