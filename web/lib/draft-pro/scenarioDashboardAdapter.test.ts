import { describe, expect, it } from "vitest";

import type { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import type { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import { scenarioFingerprint } from "./scenarios";
import { adaptScenarioDashboard, type ScenarioDashboardAdapterArgs } from "./scenarioDashboardAdapter";

const player = (id: number, position: string, projectedPoints: number | null, stats: Record<string, number | null> = {}): ProcessedPlayer => ({
  playerId: id,
  fullName: `Player ${id}`,
  displayTeam: id === 3 ? "BBB" : "AAA",
  displayPosition: position,
  eligiblePositions: [position],
  combinedStats: Object.fromEntries(Object.entries(stats).map(([key, projected]) => [key, { projected, actual: null, diffPercentage: null, projectedDetail: { value: projected, contributingSources: [], missingFromSelectedSources: [], statDefinition: { key } } }])) as unknown as ProcessedPlayer["combinedStats"],
  fantasyPoints: { projected: projectedPoints, actual: null, diffPercentage: null, projectedPerGame: null, actualPerGame: null },
});

const players = [player(1, "C", 80, { GOALS: 20 }), player(2, "LW", 70, { GOALS: 15 }), player(3, "G", 100, { SAVES_GOALIE: 900, SHOTS_AGAINST_GOALIE: 1000, GOALS_AGAINST_GOALIE: 100, TOTAL_TOI: 180000 })];
const metrics = new Map<string, PlayerVorpMetrics>(players.map((value, index) => [String(value.playerId), { value: 100 - index, vorp: 30 - index, vols: 0, vona: 0, vbd: 0, bestPos: value.displayPosition!, eligible: [value.displayPosition!] }]));
const base = (): ScenarioDashboardAdapterArgs => ({
  players,
  availablePlayers: [players[1], players[2]],
  rosterAssignments: [{ playerId: "1", teamId: "mine" }],
  myTeamId: "mine",
  candidateIds: ["2", "3"],
  vorpMetrics: metrics,
  leagueType: "points",
  scoring: { GOALS: 2, SAVE_PERCENTAGE: 3 },
  positionNeeds: { LW: 1, G: 0.5 },
  season: "20262027",
  schedule: { gameKey: "477", startWeek: 1, endWeek: 27, lineupMode: "daily", rosterSlots: { C: 1, LW: 1, G: 1 } },
  sourceControls: { ag_skaters: { isSelected: true, weight: 1 } },
  goalieSourceControls: { cullen_goalies: { isSelected: true, weight: 0.75 } },
  customCsvList: [],
  savedImportContext: null,
});

describe("adaptScenarioDashboard", () => {
  it("maps the current roster and two available candidates without mutating dashboard inputs", () => {
    const args = base();
    const before = JSON.stringify({ assignments: args.rosterAssignments, candidates: args.candidateIds, needs: args.positionNeeds });
    const result = adaptScenarioDashboard(args);
    expect(result.unavailableReason).toBeNull();
    expect(result.input).toMatchObject({
      roster: [{ id: "1", globalVorp: 30, rankValue: 100, projectedPoints: 80, eligiblePositions: ["C"], categoryValues: { GOALS: 20, SAVES_GOALIE: null, SHOTS_AGAINST_GOALIE: null } }],
      candidateA: { id: "2", available: true, drafted: false, globalVorp: 29, projectedPoints: 70 },
      candidateB: { id: "3", role: "goalie", globalVorp: 28, projectedPoints: 100, categoryValues: { GOALS: null, SAVES_GOALIE: 900, SHOTS_AGAINST_GOALIE: 1000 } },
      categoryWeights: { GOALS: 2, SAVE_PERCENTAGE: 3 },
      source: { projection: { origin: "server" }, schedule: { season: "20262027", gameKey: "477" } },
    });
    expect(JSON.stringify({ assignments: args.rosterAssignments, candidates: args.candidateIds, needs: args.positionNeeds })).toBe(before);
  });

  it("maps enabled category values and goalie ratio numerators and denominators", () => {
    const result = adaptScenarioDashboard({ ...base(), leagueType: "categories", categoryWeights: { GOALS: 1, SAVE_PERCENTAGE: 1, GOALS_AGAINST_AVERAGE: -1 } });
    expect(result.input?.roster[0].categoryValues).toEqual({ GOALS: 20, SAVES_GOALIE: null, SHOTS_AGAINST_GOALIE: null, GOALS_AGAINST_GOALIE: null, TOTAL_TOI: null });
    expect(result.input?.candidateB.categoryValues).toEqual({ GOALS: null, SAVES_GOALIE: 900, SHOTS_AGAINST_GOALIE: 1000, GOALS_AGAINST_GOALIE: 100, TOTAL_TOI: 180000 });
    expect(result.input?.categoryWeights).toEqual({ GOALS: 1, SAVE_PERCENTAGE: 1, GOALS_AGAINST_AVERAGE: -1 });
  });

  it("emits distinct selected saved imports and accepts JSONB mapping key order", () => {
    const rowsA = [{ Player: "A", Rank: 1 }];
    const rowsB = [{ Player: "B", Rank: 2 }];
    const headers = [{ original: "Player", standardized: "name", selected: true }];
    const customCsvList = [{ id: "custom_csv_1", label: "One", headers, rows: rowsA }, { id: "custom_csv_2", label: "Two", headers, rows: rowsB }];
    const result = adaptScenarioDashboard({
      ...base(),
      sourceControls: { custom_csv_1: { isSelected: true, weight: 1 }, custom_csv_2: { isSelected: true, weight: 0.5 } },
      goalieSourceControls: { custom_csv_1: { isSelected: true, weight: 1 } },
      customCsvList,
      savedImportContext: {
        draftId: "00000000-0000-4000-8000-000000000001",
        privateImports: [
          { id: "00000000-0000-4000-8000-000000000011", name: "One", sourceId: "custom_csv_1", mapping: [{ original: "Player", selected: true, standardized: "name" }], rows: rowsA },
          { id: "00000000-0000-4000-8000-000000000012", name: "Two", sourceId: "custom_csv_2", mapping: headers, rows: rowsB },
        ],
      },
    });
    expect(result.draftId).toBe("00000000-0000-4000-8000-000000000001");
    expect(result.input?.source.projection).toMatchObject({
      origin: "saved_private_import",
      privateImports: [
        { id: "00000000-0000-4000-8000-000000000011", contentFingerprint: scenarioFingerprint(rowsA) },
        { id: "00000000-0000-4000-8000-000000000012", contentFingerprint: scenarioFingerprint(rowsB) },
      ],
    });
  });

  it("blocks missing, changed, and unsaved selected private imports", () => {
    const selected = { custom_csv_1: { isSelected: true, weight: 1 } };
    const current = [{ id: "custom_csv_1", label: "One", rows: [{ Player: "Changed" }] }];
    expect(adaptScenarioDashboard({ ...base(), sourceControls: selected, goalieSourceControls: {}, customCsvList: current }).unavailableReason).toMatch(/Save the selected private/);
    const context = { draftId: "00000000-0000-4000-8000-000000000001", privateImports: [{ id: "00000000-0000-4000-8000-000000000011", name: "One", sourceId: "custom_csv_1", mapping: [], rows: [{ Player: "Saved" }] }] };
    expect(adaptScenarioDashboard({ ...base(), sourceControls: selected, goalieSourceControls: {}, customCsvList: current, savedImportContext: context }).unavailableReason).toMatch(/has changed or is not saved/);
    expect(adaptScenarioDashboard({ ...base(), sourceControls: selected, goalieSourceControls: {}, customCsvList: [], savedImportContext: context }).unavailableReason).toMatch(/has no imported rows/);
  });

  it("returns readable reasons when candidates or required point values are unavailable", () => {
    expect(adaptScenarioDashboard({ ...base(), candidateIds: ["2", "9"] }).unavailableReason).toMatch(/must still be available/);
    const missingPoints = player(2, "LW", null);
    const args = base();
    expect(adaptScenarioDashboard({ ...args, players: [players[0], missingPoints, players[2]], availablePlayers: [missingPoints, players[2]] }).unavailableReason).toMatch(/no projected fantasy points/);
  });
});
